import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import rewardsRoutes from '../routes/rewards.js';
import { createTestProfile, authHeaders } from './helpers.js';
import { testDb } from './setup.js';

function createRewardsApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/rewards', rewardsRoutes);
  return app;
}

function enableRewards(profileId: number) {
  testDb.prepare(`
    INSERT INTO profile_features (profile_id, feature_key, enabled)
    VALUES (?, 'rewards', 1)
  `).run(profileId);
}

describe('reward categories', () => {
  it('dedupes family-visible categories and rejects duplicate family category creation', async () => {
    const app = createRewardsApp();
    const familyId = Number(testDb.prepare(`
      INSERT INTO families (name, family_type)
      VALUES ('Rewards Family', 'A')
    `).run().lastInsertRowid);

    const primaryParent = createTestProfile({ name: 'Primary Parent', type: 'parent', family_id: familyId });
    const coParent = createTestProfile({ name: 'Co Parent', type: 'parent', family_id: familyId });

    enableRewards(primaryParent.id);
    enableRewards(coParent.id);

    testDb.prepare(`
      INSERT INTO reward_categories (name, display_name, icon, description, color, is_default)
      VALUES ('screen_time', 'Screen Time', '📱', 'Default screen rewards', '#3b82f6', 1)
    `).run();

    testDb.prepare(`
      INSERT INTO reward_categories (name, display_name, icon, description, color, created_by, is_default)
      VALUES ('screen_time', 'Screen Time', '📺', 'Duplicate family custom category', '#2563eb', ?, 0)
    `).run(primaryParent.id);

    testDb.prepare(`
      INSERT INTO reward_categories (name, display_name, icon, description, color, created_by, is_default)
      VALUES ('adventures', 'Adventures', '🎢', 'Family adventures', '#9333ea', ?, 0)
    `).run(primaryParent.id);

    const categoriesResponse = await request(app)
      .get(`/api/rewards/categories/${coParent.id}`)
      .set(authHeaders(coParent.id));

    expect(categoriesResponse.status).toBe(200);
    expect(categoriesResponse.body).toHaveLength(2);
    expect(categoriesResponse.body.map((category: any) => category.name)).toEqual([
      'screen_time',
      'adventures'
    ]);

    const duplicateCreate = await request(app)
      .post('/api/rewards/categories')
      .set(authHeaders(coParent.id))
      .send({
        displayName: 'Screen Time',
        icon: '📱'
      });

    expect(duplicateCreate.status).toBe(400);
    expect(duplicateCreate.body.error).toContain('already exists');
  });

  it('keeps reward assignments intact when deleting a duplicate category key', async () => {
    const app = createRewardsApp();
    const parent = createTestProfile({ name: 'Parent', type: 'parent' });

    enableRewards(parent.id);

    testDb.prepare(`
      INSERT INTO reward_categories (name, display_name, icon, description, color, is_default)
      VALUES ('screen_time', 'Screen Time', '📱', 'Default screen rewards', '#3b82f6', 1)
    `).run();

    const duplicateCategoryId = Number(testDb.prepare(`
      INSERT INTO reward_categories (name, display_name, icon, description, color, created_by, is_default)
      VALUES ('screen_time', 'Screen Time', '📺', 'Duplicate family custom category', '#2563eb', ?, 0)
    `).run(parent.id).lastInsertRowid);

    const rewardId = Number(testDb.prepare(`
      INSERT INTO rewards (
        title,
        points_required,
        category,
        available_for_all,
        stock,
        created_by
      )
      VALUES ('Extra Tablet Time', 150, 'screen_time', 1, -1, ?)
    `).run(parent.id).lastInsertRowid);

    const deleteResponse = await request(app)
      .delete(`/api/rewards/categories/${duplicateCategoryId}`)
      .set(authHeaders(parent.id));

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.rewardsMovedToGeneral).toBe(false);

    const reward = testDb.prepare('SELECT category FROM rewards WHERE id = ?').get(rewardId) as { category: string };
    expect(reward.category).toBe('screen_time');
  });
});
