import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createTestProfile, createTestProgress, createTestStreak, createTestAchievement } from './helpers.js';
import { testDb } from './setup.js';
import gamificationRouter from '../routes/gamification.js';
import { updateEconomySettings } from '../services/economyControl.js';

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/gamification', gamificationRouter);
  return app;
}

function enableGamification(profileId: number) {
  testDb.prepare(`
    INSERT INTO profile_features (profile_id, feature_key, enabled)
    VALUES (?, 'gamification', 1)
  `).run(profileId);
}

describe('Gamification Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('GET /gamification/family-leaderboard', () => {
    it('should return family members sorted by points', async () => {
      const familyId = Number(testDb.prepare(`
        INSERT INTO families (name, family_type)
        VALUES ('Gamification Family', 'A')
      `).run().lastInsertRowid);

      // Create family members with different points
      const parent = createTestProfile({ name: 'Parent', type: 'parent', family_id: familyId });
      const child1 = createTestProfile({ name: 'Child 1', type: 'child', family_id: familyId });
      const child2 = createTestProfile({ name: 'Child 2', type: 'child', family_id: familyId });

      enableGamification(parent.id);
      enableGamification(child1.id);
      enableGamification(child2.id);

      createTestProgress(parent.id, { total_points: 50 });
      createTestProgress(child1.id, { total_points: 150 });
      createTestProgress(child2.id, { total_points: 100 });

      const response = await request(app)
        .get('/gamification/family-leaderboard')
        .set('x-profile-id', String(parent.id));

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(3);
      expect(response.body[0].name).toBe('Child 1'); // highest points
      expect(response.body[0].rank).toBe(1);
      expect(response.body[1].name).toBe('Child 2');
      expect(response.body[1].rank).toBe(2);
      expect(response.body[2].name).toBe('Parent');
      expect(response.body[2].rank).toBe(3);
    });

    it('should include streak and achievement data', async () => {
      const familyId = Number(testDb.prepare(`
        INSERT INTO families (name, family_type)
        VALUES ('Achievement Family', 'A')
      `).run().lastInsertRowid);

      const parent = createTestProfile({ name: 'Parent', type: 'parent', family_id: familyId });
      const child = createTestProfile({ name: 'Test Child', type: 'child', family_id: familyId });
      enableGamification(parent.id);
      enableGamification(child.id);
      createTestProgress(child.id, { total_points: 100, total_stars: 10, level: 2 });
      createTestStreak(child.id, 'tasks', { current_streak: 5, longest_streak: 7 });

      const achievement = createTestAchievement({
        name: 'First Steps',
        requirement_type: 'tasks_completed',
        requirement_value: 1
      });
      testDb.prepare('INSERT INTO profile_achievements (profile_id, achievement_id) VALUES (?, ?)').run(child.id, achievement.id);

      const response = await request(app)
        .get('/gamification/family-leaderboard')
        .set('x-profile-id', String(parent.id));

      expect(response.status).toBe(200);
      expect(response.body[0].currentStreak).toBe(5);
      expect(response.body[0].longestStreak).toBe(7);
      expect(response.body[0].achievementCount).toBe(1);
    });

    it('includes legacy child profiles and calculates week and month points from period boundaries', async () => {
      const familyId = Number(testDb.prepare(`
        INSERT INTO families (name, family_type)
        VALUES ('Period Family', 'A')
      `).run().lastInsertRowid);

      const parent = createTestProfile({ name: 'Parent', type: 'parent', family_id: familyId });
      const legacyChild = createTestProfile({ name: 'Legacy Child', type: 'child', parent_id: parent.id });

      enableGamification(parent.id);
      enableGamification(legacyChild.id);

      const now = new Date();
      const tenDaysAgo = new Date(now);
      tenDaysAgo.setDate(now.getDate() - 10);
      const fortyDaysAgo = new Date(now);
      fortyDaysAgo.setDate(now.getDate() - 40);
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(now.getDate() - 2);

      testDb.prepare(`
        INSERT INTO progress (profile_id, points_earned, stars_earned, level, total_points, total_stars, logged_at)
        VALUES (?, 20, 0, 1, 20, 0, ?)
      `).run(legacyChild.id, fortyDaysAgo.toISOString());

      testDb.prepare(`
        INSERT INTO progress (profile_id, points_earned, stars_earned, level, total_points, total_stars, logged_at)
        VALUES (?, 20, 0, 1, 40, 0, ?)
      `).run(legacyChild.id, tenDaysAgo.toISOString());

      testDb.prepare(`
        INSERT INTO progress (profile_id, points_earned, stars_earned, level, total_points, total_stars, logged_at)
        VALUES (?, 60, 0, 2, 100, 0, ?)
      `).run(legacyChild.id, now.toISOString());

      testDb.prepare(`
        INSERT INTO tasks (profile_id, title, category, points, completed, completed_at)
        VALUES (?, 'Old Task', 'homework', 20, 1, ?)
      `).run(legacyChild.id, fortyDaysAgo.toISOString());

      testDb.prepare(`
        INSERT INTO tasks (profile_id, title, category, points, completed, completed_at)
        VALUES (?, 'Recent Task', 'homework', 60, 1, ?)
      `).run(legacyChild.id, twoDaysAgo.toISOString());

      const weekResponse = await request(app)
        .get('/gamification/family-leaderboard')
        .query({ period: 'week' })
        .set('x-profile-id', String(parent.id));

      expect(weekResponse.status).toBe(200);
      const weekChild = weekResponse.body.find((entry: any) => entry.id === legacyChild.id);
      expect(weekChild).toBeDefined();
      expect(weekChild.points).toBe(60);
      expect(weekChild.tasksCompleted).toBe(1);

      const monthResponse = await request(app)
        .get('/gamification/family-leaderboard')
        .query({ period: 'month' })
        .set('x-profile-id', String(parent.id));

      expect(monthResponse.status).toBe(200);
      const monthChild = monthResponse.body.find((entry: any) => entry.id === legacyChild.id);
      expect(monthChild.points).toBe(80);
      expect(monthChild.tasksCompleted).toBe(1);

      const allTimeResponse = await request(app)
        .get('/gamification/family-leaderboard')
        .query({ period: 'all' })
        .set('x-profile-id', String(parent.id));

      expect(allTimeResponse.status).toBe(200);
      const allTimeChild = allTimeResponse.body.find((entry: any) => entry.id === legacyChild.id);
      expect(allTimeChild.points).toBe(100);
      expect(allTimeChild.tasksCompleted).toBe(2);
    });
  });

  describe('GET /gamification/stats/:profileId', () => {
    it('should return gamification stats for a profile', async () => {
      const profile = createTestProfile({ name: 'Test Child', type: 'child' });
      enableGamification(profile.id);
      createTestProgress(profile.id, {
        total_points: 250,
        total_stars: 15,
        level: 3
      });
      createTestStreak(profile.id, 'tasks', { current_streak: 3, longest_streak: 5 });

      const response = await request(app)
        .get(`/gamification/stats/${profile.id}`)
        .set('x-profile-id', String(profile.id));

      expect(response.status).toBe(200);
      expect(response.body.points).toBe(250);
      expect(response.body.stars).toBe(15);
      expect(response.body.level).toBe(3);
      expect(response.body.streaks.tasks.current).toBe(3);
      expect(response.body.streaks.tasks.longest).toBe(5);
    });
  });

  describe('GET /gamification/streaks/:profileId', () => {
    it('should return streaks for a profile', async () => {
      const profile = createTestProfile({ name: 'Test Child', type: 'child' });
      enableGamification(profile.id);
      createTestStreak(profile.id, 'tasks', { current_streak: 7, longest_streak: 10 });

      const response = await request(app)
        .get(`/gamification/streaks/${profile.id}`)
        .set('x-profile-id', String(profile.id));

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].streak_type).toBe('tasks');
      expect(response.body[0].current_streak).toBe(7);
      expect(response.body[0].longest_streak).toBe(10);
    });

    it('should create default streaks if none exist', async () => {
      const profile = createTestProfile({ name: 'New User', type: 'child' });
      enableGamification(profile.id);

      const response = await request(app)
        .get(`/gamification/streaks/${profile.id}`)
        .set('x-profile-id', String(profile.id));

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body.some((s: any) => s.streak_type === 'tasks')).toBe(true);
    });
  });

  describe('Parent point and economy controls', () => {
    it('allows a parent to update child economy settings, including countdown challenges', async () => {
      const parent = createTestProfile({ name: 'Parent', type: 'parent' });
      const child = createTestProfile({ name: 'Child', type: 'child', parent_id: parent.id });

      enableGamification(parent.id);
      enableGamification(child.id);

      const response = await request(app)
        .put(`/gamification/economy/${child.id}`)
        .set('x-profile-id', String(parent.id))
        .send({
          dailyPointsCap: 180,
          weeklyPointsCap: 900,
          pointsMultiplier: 1.3,
          requireTimeElapsed: false,
          minTaskDuration: 7,
          cooldownSeconds: 15,
          bonusesEnabled: true,
          spinWheelEnabled: false,
          countdownChallengesEnabled: false
        });

      expect(response.status).toBe(200);
      expect(response.body.settings).toMatchObject({
        daily_points_cap: 180,
        weekly_points_cap: 900,
        points_multiplier: 1.3,
        require_time_elapsed: false,
        min_task_duration_minutes: 7,
        cooldown_seconds: 15,
        bonuses_enabled: true,
        spin_wheel_enabled: false,
        countdown_challenges_enabled: false
      });
    });

    it('lets a parent add points to a managed child even when earning caps are already reached', async () => {
      const parent = createTestProfile({ name: 'Parent', type: 'parent' });
      const child = createTestProfile({ name: 'Child', type: 'child', parent_id: parent.id });

      enableGamification(parent.id);
      enableGamification(child.id);
      createTestProgress(child.id, { total_points: 20, total_stars: 0, level: 1 });

      updateEconomySettings(child.id, {
        daily_points_cap: 5,
        weekly_points_cap: 5
      });

      const today = new Date().toISOString().split('T')[0];
      testDb.prepare(`
        INSERT INTO earning_tracker (profile_id, date, points_earned, stars_earned, tasks_completed, bonuses_claimed)
        VALUES (?, ?, 5, 0, 0, 0)
      `).run(child.id, today);

      const relatedTaskId = Number(testDb.prepare(`
        INSERT INTO tasks (profile_id, title, category, points, due_date, completed)
        VALUES (?, 'Missed Chore', 'chore', 10, '2099-01-01', 0)
      `).run(child.id).lastInsertRowid);

      const response = await request(app)
        .post(`/gamification/points/adjust/${child.id}`)
        .set('x-profile-id', String(parent.id))
        .send({
          amount: 10,
          reason: 'Bonus for helping without being asked',
          related_task_id: relatedTaskId
        });

      expect(response.status).toBe(200);
      expect(response.body.adjustment).toBe(10);
      expect(response.body.previous_points).toBe(20);
      expect(response.body.new_points).toBe(30);

      expect(testDb.prepare(`
        SELECT amount, related_task_id
        FROM points_adjustments
        WHERE profile_id = ?
        ORDER BY id DESC
        LIMIT 1
      `).get(child.id)).toEqual({
        amount: 10,
        related_task_id: relatedTaskId
      });
    });

    it('blocks unrelated parents from adjusting a child points balance', async () => {
      const parent = createTestProfile({ name: 'Parent', type: 'parent' });
      const unrelatedParent = createTestProfile({ name: 'Other Parent', type: 'parent' });
      const child = createTestProfile({ name: 'Child', type: 'child', parent_id: parent.id });

      enableGamification(parent.id);
      enableGamification(unrelatedParent.id);
      enableGamification(child.id);
      createTestProgress(child.id, { total_points: 20, total_stars: 0, level: 1 });

      const response = await request(app)
        .post(`/gamification/points/adjust/${child.id}`)
        .set('x-profile-id', String(unrelatedParent.id))
        .send({
          amount: -5,
          reason: 'Not your child'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('own children');
    });

    it('rejects non-whole-number point adjustments', async () => {
      const parent = createTestProfile({ name: 'Parent', type: 'parent' });
      const child = createTestProfile({ name: 'Child', type: 'child', parent_id: parent.id });

      enableGamification(parent.id);
      enableGamification(child.id);
      createTestProgress(child.id, { total_points: 20, total_stars: 0, level: 1 });

      const response = await request(app)
        .post(`/gamification/points/adjust/${child.id}`)
        .set('x-profile-id', String(parent.id))
        .send({
          amount: 2.5,
          reason: 'Fractional points should fail'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('whole number');
    });
  });
});
