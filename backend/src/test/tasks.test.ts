import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestProfile, createTestTask, authHeaders } from './helpers.js';
import { testDb } from './setup.js';
import { formatDateOnly, getTodayDateOnly, parseDateOnly } from '../utils/date-only.js';

let tasksRouter: express.Router;

beforeAll(async () => {
  process.env.PROOF_DIR = path.join(process.cwd(), 'tmp-test-proofs');
  tasksRouter = (await import('../routes/tasks.js')).default;
});

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/tasks', tasksRouter);
  return app;
}

function enableTasksFeature(profileId: number) {
  testDb.prepare(`
    INSERT INTO profile_features (profile_id, feature_key, enabled)
    VALUES (?, 'tasks', 1)
  `).run(profileId);
}

function seedEconomySettings(profileId: number) {
  testDb.prepare(`
    INSERT INTO economy_settings (
      profile_id,
      daily_points_cap,
      weekly_points_cap,
      points_multiplier,
      require_time_elapsed,
      min_task_duration_minutes,
      cooldown_seconds,
      bonuses_enabled,
      spin_wheel_enabled,
      countdown_challenges_enabled
    ) VALUES (?, 500, 5000, 1.0, 0, 1, 0, 0, 0, 0)
  `).run(profileId);
}

function getTaskStreak(profileId: number) {
  return testDb.prepare(`
    SELECT * FROM streaks
    WHERE profile_id = ? AND streak_type = 'tasks'
  `).get(profileId) as any;
}

describe('Task Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
  });

  it('files a streak under the local day, so a task finished just after midnight cannot advance it twice', async () => {
    const parent = createTestProfile({ name: 'Parent', type: 'parent' });
    const child = createTestProfile({ name: 'Child', type: 'child', parent_id: parent.id });
    enableTasksFeature(child.id);
    seedEconomySettings(child.id);

    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      // 00:30 in Oslo, when the UTC date is still the day before
      vi.setSystemTime(new Date(2026, 9, 14, 0, 30, 0));
      const localDay = getTodayDateOnly();
      expect(localDay).toBe('2026-10-14');
      expect(new Date().toISOString()).toBe('2026-10-13T22:30:00.000Z');

      const early = createTestTask(child.id, { title: 'Just after midnight', parent_approved: 1 });
      expect((await request(app).post(`/tasks/${early.id}/complete`).set(authHeaders(child.id))).status).toBe(200);
      expect(getTaskStreak(child.id)).toMatchObject({ current_streak: 1, last_activity_date: localDay });

      // Later the same local day: one day, one streak step
      vi.setSystemTime(new Date(2026, 9, 14, 10, 0, 0));
      const later = createTestTask(child.id, { title: 'Same morning', parent_approved: 1 });
      expect((await request(app).post(`/tasks/${later.id}/complete`).set(authHeaders(child.id))).status).toBe(200);
      expect(getTaskStreak(child.id)).toMatchObject({ current_streak: 1, last_activity_date: localDay });

      // The next local day advances it exactly once
      vi.setSystemTime(new Date(2026, 9, 15, 9, 0, 0));
      const next = createTestTask(child.id, { title: 'Next day', parent_approved: 1 });
      expect((await request(app).post(`/tasks/${next.id}/complete`).set(authHeaders(child.id))).status).toBe(200);
      expect(getTaskStreak(child.id)).toMatchObject({ current_streak: 2, last_activity_date: '2026-10-15' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('completes a recurring task, updates streaks, and creates the next dated copy', async () => {
    const parent = createTestProfile({ name: 'Parent', type: 'parent' });
    const child = createTestProfile({ name: 'Child', type: 'child', parent_id: parent.id });
    enableTasksFeature(child.id);
    seedEconomySettings(child.id);

    const today = getTodayDateOnly();
    const task = createTestTask(child.id, {
      title: 'Read today',
      is_recurring: 1,
      recurrence_pattern: 'daily',
      due_date: today,
      scheduled_time: '08:00',
      parent_approved: 1
    });

    const response = await request(app)
      .post(`/tasks/${task.id}/complete`)
      .set(authHeaders(child.id));

    expect(response.status).toBe(200);
    expect(response.body.task.completed).toBe(1);
    expect(response.body.task.last_completed_date).toBe(today);

    const streak = getTaskStreak(child.id);
    expect(streak?.current_streak).toBe(1);
    expect(streak?.last_activity_date).toBe(today);

    const followUps = testDb.prepare(`
      SELECT * FROM tasks
      WHERE profile_id = ? AND title = ? AND completed = 0
      ORDER BY id DESC
    `).all(child.id, 'Read today') as any[];

    expect(followUps).toHaveLength(1);
    expect(followUps[0].id).not.toBe(task.id);
    expect(followUps[0].due_date).not.toBe(today);
    expect(followUps[0].scheduled_time).toBe('08:00');
  });

  it('reduces points for overdue task completion', async () => {
    const parent = createTestProfile({ name: 'Parent', type: 'parent' });
    const child = createTestProfile({ name: 'Child', type: 'child', parent_id: parent.id });
    enableTasksFeature(child.id);
    seedEconomySettings(child.id);

    const todayDate = parseDateOnly(getTodayDateOnly())!;
    const yesterday = new Date(todayDate);
    yesterday.setDate(yesterday.getDate() - 1);

    const task = createTestTask(child.id, {
      title: 'Late chore',
      points: 10,
      due_date: formatDateOnly(yesterday),
      parent_approved: 1
    });

    const response = await request(app)
      .post(`/tasks/${task.id}/complete`)
      .set(authHeaders(child.id));

    expect(response.status).toBe(200);
    expect(response.body.pointsEarned).toBe(5);
    expect(response.body.latePenaltyApplied).toBe(true);
    expect(response.body.overdueDays).toBe(1);
    expect(response.body.originalPoints).toBe(10);
    expect(response.body.adjustedPoints).toBe(5);
  });

  it('parent proof approval updates last_completed_date, streaks, and preserves recurring timer settings', async () => {
    const parent = createTestProfile({ name: 'Parent', type: 'parent' });
    const child = createTestProfile({ name: 'Child', type: 'child', parent_id: parent.id });
    enableTasksFeature(child.id);
    seedEconomySettings(child.id);

    const today = getTodayDateOnly();
    const task = createTestTask(child.id, {
      title: 'Kitchen cleanup',
      is_recurring: 1,
      recurrence_pattern: 'daily',
      due_date: today,
      proof_required: 1,
      proof_photo_url: '/tasks/1/proof',
      requires_timer: 1,
      timer_duration_minutes: 20,
      parent_approved: 1
    });

    const response = await request(app)
      .post(`/tasks/${task.id}/verify-proof`)
      .set(authHeaders(parent.id))
      .send({ approved: true });

    expect(response.status).toBe(200);
    expect(response.body.task.completed).toBe(1);
    expect(response.body.task.last_completed_date).toBe(today);

    const streak = getTaskStreak(child.id);
    expect(streak?.current_streak).toBe(1);
    expect(streak?.last_activity_date).toBe(today);

    const followUp = testDb.prepare(`
      SELECT * FROM tasks
      WHERE profile_id = ? AND title = ? AND completed = 0
      ORDER BY id DESC LIMIT 1
    `).get(child.id, 'Kitchen cleanup') as any;

    expect(followUp).toBeTruthy();
    expect(followUp.id).not.toBe(task.id);
    expect(followUp.requires_timer).toBe(1);
    expect(followUp.timer_duration_minutes).toBe(20);
  });

  it('timer completion updates streaks and preserves recurring timer settings', async () => {
    const parent = createTestProfile({ name: 'Parent', type: 'parent' });
    const child = createTestProfile({ name: 'Child', type: 'child', parent_id: parent.id });
    enableTasksFeature(child.id);
    seedEconomySettings(child.id);

    const today = getTodayDateOnly();
    const task = createTestTask(child.id, {
      title: 'Study block',
      is_recurring: 1,
      recurrence_pattern: 'daily',
      due_date: today,
      requires_timer: 1,
      timer_duration_minutes: 15,
      parent_approved: 1
    });

    testDb.prepare(`
      INSERT INTO timer_states (
        profile_id, task_id, timer_type, is_running, is_paused, elapsed_seconds, start_time, last_updated
      ) VALUES (?, ?, 'task', 0, 1, 905, NULL, CURRENT_TIMESTAMP)
    `).run(child.id, task.id);

    const response = await request(app)
      .post(`/tasks/${task.id}/timer/finish`)
      .set(authHeaders(child.id));

    expect(response.status).toBe(200);
    expect(response.body.task.completed).toBe(1);
    expect(response.body.task.last_completed_date).toBe(today);

    const streak = getTaskStreak(child.id);
    expect(streak?.current_streak).toBe(1);
    expect(streak?.last_activity_date).toBe(today);

    const followUp = testDb.prepare(`
      SELECT * FROM tasks
      WHERE profile_id = ? AND title = ? AND completed = 0
      ORDER BY id DESC LIMIT 1
    `).get(child.id, 'Study block') as any;

    expect(followUp).toBeTruthy();
    expect(followUp.id).not.toBe(task.id);
    expect(followUp.requires_timer).toBe(1);
    expect(followUp.timer_duration_minutes).toBe(15);
  });

  it('allows a parent to send a reminder for an overdue approved task', async () => {
    const parent = createTestProfile({ name: 'Parent', type: 'parent' });
    const child = createTestProfile({ name: 'Child', type: 'child', parent_id: parent.id });
    enableTasksFeature(parent.id);
    enableTasksFeature(child.id);
    seedEconomySettings(child.id);

    const todayDate = parseDateOnly(getTodayDateOnly())!;
    const yesterday = new Date(todayDate);
    yesterday.setDate(yesterday.getDate() - 1);

    const task = createTestTask(child.id, {
      title: 'Brush teeth',
      due_date: formatDateOnly(yesterday),
      parent_approved: 1
    });

    const response = await request(app)
      .post(`/tasks/${task.id}/remind`)
      .set(authHeaders(parent.id));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const reminder = testDb.prepare(`
      SELECT * FROM notifications
      WHERE profile_id = ? AND type = 'reminder'
      ORDER BY id DESC
      LIMIT 1
    `).get(child.id) as any;

    expect(reminder).toBeTruthy();
    expect(reminder.message).toContain('Brush teeth');
    expect(reminder.message).toContain('half points');
  });

  it('lets a parent update all major task settings and notifies the child', async () => {
    const parent = createTestProfile({ name: 'Parent', type: 'parent' });
    const child = createTestProfile({ name: 'Child', type: 'child', parent_id: parent.id });
    enableTasksFeature(parent.id);
    enableTasksFeature(child.id);

    const task = createTestTask(child.id, {
      title: 'Original Task',
      category: 'other',
      difficulty: 'easy',
      points: 10,
      parent_approved: 1,
      estimated_minutes: 15,
      scheduled_time: '08:00'
    });

    const response = await request(app)
      .put(`/tasks/${task.id}`)
      .set(authHeaders(parent.id))
      .send({
        title: 'Updated Task',
        description: 'Use the new instructions',
        category: 'read-book',
        difficulty: 'hard',
        priority: 'high',
        due_date: getTodayDateOnly(),
        estimated_minutes: 45,
        scheduled_time: '16:30',
        is_recurring: true,
        recurrence_pattern: 'weekly',
        proof_required: true,
        requires_timer: true,
        timer_duration_minutes: 25
      });

    expect(response.status).toBe(200);
    expect(response.body.title).toBe('Updated Task');
    expect(response.body.description).toBe('Use the new instructions');
    expect(response.body.category).toBe('read-book');
    expect(response.body.difficulty).toBe('hard');
    expect(response.body.points).toBe(30);
    expect(response.body.priority).toBe('high');
    expect(response.body.estimated_minutes).toBe(45);
    expect(response.body.scheduled_time).toBe('16:30');
    expect(response.body.is_recurring).toBe(1);
    expect(response.body.recurrence_pattern).toBe('weekly');
    expect(response.body.proof_required).toBe(1);
    expect(response.body.requires_timer).toBe(1);
    expect(response.body.timer_duration_minutes).toBe(25);

    const notification = testDb.prepare(`
      SELECT * FROM notifications
      WHERE profile_id = ? AND type = 'task_updated'
      ORDER BY id DESC
      LIMIT 1
    `).get(child.id) as any;

    expect(notification).toBeTruthy();
    expect(notification.title).toBe('Task Updated');
    expect(notification.message).toContain('Updated Task');
  });
});
