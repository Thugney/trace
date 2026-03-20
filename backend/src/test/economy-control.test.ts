import { describe, expect, it } from 'vitest';
import { awardPoints, getEconomySettings, updateEconomySettings } from '../services/economyControl.js';
import { createTestProfile, createTestProgress } from './helpers.js';
import { testDb } from './setup.js';

describe('economy control', () => {
  it('applies and consumes a task power-up once, but not for non-task awards', () => {
    const child = createTestProfile({ name: 'Power Kid', type: 'child' });
    createTestProgress(child.id, { total_points: 0, total_stars: 0, level: 1 });

    testDb.prepare(`
      INSERT INTO power_ups (profile_id, power_up_type, quantity, expires_at)
      VALUES (?, 'spin_multiplier', 2, ?)
    `).run(child.id, '2099-01-01T00:00:00.000Z');

    const quizAward = awardPoints({
      profileId: child.id,
      basePoints: 10,
      source: 'quiz',
      enforceRateLimit: false
    });

    expect(quizAward.awarded).toBe(10);
    expect(quizAward.newTotal).toBe(10);
    expect(testDb.prepare('SELECT total_points FROM progress WHERE profile_id = ? ORDER BY id DESC LIMIT 1').get(child.id)).toEqual({ total_points: 10 });
    expect(testDb.prepare('SELECT COUNT(*) as count FROM power_ups WHERE profile_id = ?').get(child.id)).toEqual({ count: 1 });

    const taskAward = awardPoints({
      profileId: child.id,
      basePoints: 10,
      stars: 1,
      source: 'task',
      enforceRateLimit: false
    });

    expect(taskAward.awarded).toBe(20);
    expect(taskAward.newTotal).toBe(30);
    expect(testDb.prepare('SELECT total_points FROM progress WHERE profile_id = ? ORDER BY id DESC LIMIT 1').get(child.id)).toEqual({ total_points: 30 });
    expect(testDb.prepare('SELECT COUNT(*) as count FROM power_ups WHERE profile_id = ?').get(child.id)).toEqual({ count: 0 });

    const followUpTaskAward = awardPoints({
      profileId: child.id,
      basePoints: 10,
      source: 'task',
      enforceRateLimit: false
    });

    expect(followUpTaskAward.awarded).toBe(10);
    expect(followUpTaskAward.newTotal).toBe(40);
    expect(testDb.prepare('SELECT total_points FROM progress WHERE profile_id = ? ORDER BY id DESC LIMIT 1').get(child.id)).toEqual({ total_points: 40 });
  });

  it('ignores invalid economy numeric updates and preserves prior settings', () => {
    const child = createTestProfile({ name: 'Economy Kid', type: 'child' });

    updateEconomySettings(child.id, {
      daily_points_cap: 250,
      weekly_points_cap: 1200,
      points_multiplier: 1.5,
      cooldown_seconds: 20,
      min_task_duration_minutes: 8
    });

    updateEconomySettings(child.id, {
      daily_points_cap: Number.NaN,
      weekly_points_cap: Number.POSITIVE_INFINITY,
      points_multiplier: Number.NaN,
      cooldown_seconds: Number.NaN,
      min_task_duration_minutes: Number.NaN
    });

    const settings = getEconomySettings(child.id);

    expect(settings.daily_points_cap).toBe(250);
    expect(settings.weekly_points_cap).toBe(1200);
    expect(settings.points_multiplier).toBe(1.5);
    expect(settings.cooldown_seconds).toBe(20);
    expect(settings.min_task_duration_minutes).toBe(8);
  });
});
