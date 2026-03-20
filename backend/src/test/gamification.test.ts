import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createTestProfile, createTestProgress, createTestStreak, createTestAchievement } from './helpers.js';
import { testDb } from './setup.js';
import gamificationRouter from '../routes/gamification.js';

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/gamification', gamificationRouter);
  return app;
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
  });

  describe('GET /gamification/stats/:profileId', () => {
    it('should return gamification stats for a profile', async () => {
      const profile = createTestProfile({ name: 'Test Child', type: 'child' });
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

      const response = await request(app)
        .get(`/gamification/streaks/${profile.id}`)
        .set('x-profile-id', String(profile.id));

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body.some((s: any) => s.streak_type === 'tasks')).toBe(true);
    });
  });
});
