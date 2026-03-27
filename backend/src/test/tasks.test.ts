import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestProfile, createTestTask } from './helpers.js';
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
      .set('x-profile-id', String(child.id));

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
      .set('x-profile-id', String(child.id));

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
      .set('x-profile-id', String(parent.id))
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
      .set('x-profile-id', String(child.id));

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
      .set('x-profile-id', String(parent.id));

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
});
