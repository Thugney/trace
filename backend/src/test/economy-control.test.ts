import { describe, expect, it } from 'vitest';
import { awardPoints, getCurrentTotalPoints } from '../services/economyControl.js';
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
    expect(getCurrentTotalPoints(child.id)).toBe(10);
    expect(testDb.prepare('SELECT COUNT(*) as count FROM power_ups WHERE profile_id = ?').get(child.id)).toEqual({ count: 1 });

    const taskAward = awardPoints({
      profileId: child.id,
      basePoints: 10,
      stars: 1,
      source: 'task',
      enforceRateLimit: false
    });

    expect(taskAward.awarded).toBe(20);
    expect(getCurrentTotalPoints(child.id)).toBe(30);
    expect(testDb.prepare('SELECT COUNT(*) as count FROM power_ups WHERE profile_id = ?').get(child.id)).toEqual({ count: 0 });

    const followUpTaskAward = awardPoints({
      profileId: child.id,
      basePoints: 10,
      source: 'task',
      enforceRateLimit: false
    });

    expect(followUpTaskAward.awarded).toBe(10);
    expect(getCurrentTotalPoints(child.id)).toBe(40);
  });
});
