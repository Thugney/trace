import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import rewardsRoutes from '../routes/rewards.js';
import { createTestProfile, createTestProgress } from './helpers.js';
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

describe('reward purchases', () => {
  it('tracks star discounts and restores stock when a claim is rejected', async () => {
    const app = createRewardsApp();
    const parent = createTestProfile({ name: 'Reward Parent', type: 'parent' });
    const child = createTestProfile({ name: 'Reward Kid', type: 'child', parent_id: parent.id });

    enableRewards(parent.id);
    enableRewards(child.id);

    createTestProgress(child.id, {
      points_earned: 100,
      stars_earned: 10,
      total_points: 100,
      total_stars: 10
    });

    const rewardId = Number(testDb.prepare(`
      INSERT INTO rewards (
        title,
        points_required,
        category,
        profile_id,
        available_for_all,
        stock,
        created_by
      )
      VALUES ('Arcade Pass', 20, 'activities', ?, 0, 1, ?)
    `).run(child.id, parent.id).lastInsertRowid);

    const purchaseResponse = await request(app)
      .post(`/api/rewards/${rewardId}/purchase`)
      .set('x-profile-id', String(child.id))
      .send({
        profileId: child.id,
        starsToSpend: 3
      });

    expect(purchaseResponse.status).toBe(200);
    expect(purchaseResponse.body.starDiscount).toBe(6);
    expect(purchaseResponse.body.starsUsed).toBe(3);
    expect(purchaseResponse.body.newBalance).toBe(86);

    const claim = testDb.prepare(`
      SELECT points_spent, stars_spent, status
      FROM reward_claims
      WHERE reward_id = ?
    `).get(rewardId) as { points_spent: number; stars_spent: number; status: string };

    expect(claim.points_spent).toBe(14);
    expect(claim.stars_spent).toBe(3);
    expect(claim.status).toBe('pending');

    const rewardAfterPurchase = testDb.prepare('SELECT stock FROM rewards WHERE id = ?').get(rewardId) as { stock: number };
    expect(rewardAfterPurchase.stock).toBe(0);

    const rejectResponse = await request(app)
      .put(`/api/rewards/claims/${purchaseResponse.body.claim.id}/status`)
      .set('x-profile-id', String(parent.id))
      .send({
        status: 'rejected',
        notes: 'Try a different reward'
      });

    expect(rejectResponse.status).toBe(200);

    const rewardAfterReject = testDb.prepare('SELECT stock FROM rewards WHERE id = ?').get(rewardId) as { stock: number };
    expect(rewardAfterReject.stock).toBe(1);
  });
});
