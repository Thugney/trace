import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import goalsRoutes from '../routes/goals.js';
import { createTestProfile } from './helpers.js';
import { testDb } from './setup.js';

function createGoalsApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/goals', goalsRoutes);
  return app;
}

function enableGoals(profileId: number) {
  testDb.prepare(`
    INSERT INTO profile_features (profile_id, feature_key, enabled)
    VALUES (?, 'goals', 1)
  `).run(profileId);
}

describe('pending goal approvals', () => {
  it('shows a child goal request to a co-parent in the same family', async () => {
    const app = createGoalsApp();

    const familyId = Number(testDb.prepare(`
      INSERT INTO families (name, family_type)
      VALUES ('Approval Family', 'A')
    `).run().lastInsertRowid);

    const primaryParent = createTestProfile({ name: 'Primary Parent', type: 'parent', family_id: familyId });
    const coParent = createTestProfile({ name: 'Co-Parent', type: 'parent', family_id: familyId });
    const child = createTestProfile({
      name: 'Goal Kid',
      type: 'child',
      parent_id: primaryParent.id
    });

    enableGoals(primaryParent.id);
    enableGoals(coParent.id);

    testDb.prepare(`
      INSERT INTO monthly_goals (
        profile_id,
        month,
        goal_description,
        goal_points,
        goal_type,
        parent_approved,
        created_by
      )
      VALUES (?, '2026-03', 'Save for a new bike', 500, 'toy', 0, ?)
    `).run(child.id, child.id);

    const response = await request(app)
      .get(`/api/goals/pending/${coParent.id}`)
      .set('x-profile-id', String(coParent.id));

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      profile_id: child.id,
      child_name: 'Goal Kid',
      goal_description: 'Save for a new bike',
      parent_approved: 0
    });
  });
});
