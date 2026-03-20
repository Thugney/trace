import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
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

describe('goal templates', () => {
  it('shows system and family templates with deduped categories to a child viewer', async () => {
    const app = createGoalsApp();
    const familyId = Number(testDb.prepare(`
      INSERT INTO families (name, family_type)
      VALUES ('Goal Family', 'A')
    `).run().lastInsertRowid);

    const primaryParent = createTestProfile({ name: 'Primary Parent', type: 'parent', family_id: familyId });
    const coParent = createTestProfile({ name: 'Co Parent', type: 'parent', family_id: familyId });
    const child = createTestProfile({ name: 'Goal Kid', type: 'child', parent_id: primaryParent.id });

    enableGoals(primaryParent.id);
    enableGoals(coParent.id);
    enableGoals(child.id);

    testDb.prepare(`
      INSERT INTO goal_templates (
        name,
        description,
        category,
        icon,
        suggested_points,
        estimated_cost_min,
        estimated_cost_max,
        family_size_multiplier,
        is_default,
        is_system,
        is_active
      )
      VALUES ('Movie Night', 'Family movie night', 'family_outing', '🎬', 400, 20, 50, 1.2, 1, 1, 1)
    `).run();

    testDb.prepare(`
      INSERT INTO goal_templates (
        name,
        description,
        category,
        icon,
        suggested_points,
        estimated_cost_min,
        estimated_cost_max,
        family_size_multiplier,
        is_default,
        is_system,
        is_active,
        created_by
      )
      VALUES ('Family Trip Jar', 'Save up for a family trip', 'family_outing', '🚌', 900, 50, 150, 1.3, 0, 0, 1, ?)
    `).run(primaryParent.id);

    testDb.prepare(`
      INSERT INTO goal_templates (
        name,
        description,
        category,
        icon,
        suggested_points,
        estimated_cost_min,
        estimated_cost_max,
        family_size_multiplier,
        is_default,
        is_system,
        is_active,
        created_by
      )
      VALUES ('Weekend Screen Time', 'Save up for a longer game session', 'screen_time', '🎮', 250, 0, 0, 1.0, 0, 0, 1, ?)
    `).run(coParent.id);

    const response = await request(app)
      .get('/api/goals/templates/all')
      .set('x-profile-id', String(child.id));

    expect(response.status).toBe(200);
    expect(response.body.categories).toEqual(['family_outing', 'screen_time']);
    expect(response.body.templates.map((template: any) => template.name)).toEqual([
      'Movie Night',
      'Family Trip Jar',
      'Weekend Screen Time'
    ]);
  });

  it('rejects duplicate goal templates inside the same family scope', async () => {
    const app = createGoalsApp();
    const familyId = Number(testDb.prepare(`
      INSERT INTO families (name, family_type)
      VALUES ('Goal Family', 'A')
    `).run().lastInsertRowid);

    const primaryParent = createTestProfile({ name: 'Primary Parent', type: 'parent', family_id: familyId });
    const coParent = createTestProfile({ name: 'Co Parent', type: 'parent', family_id: familyId });

    enableGoals(primaryParent.id);
    enableGoals(coParent.id);

    testDb.prepare(`
      INSERT INTO goal_templates (
        name,
        description,
        category,
        icon,
        suggested_points,
        estimated_cost_min,
        estimated_cost_max,
        family_size_multiplier,
        is_default,
        is_system,
        is_active,
        created_by
      )
      VALUES ('Family Trip Jar', 'Save up for a family trip', 'family_outing', '🚌', 900, 50, 150, 1.3, 0, 0, 1, ?)
    `).run(primaryParent.id);

    const duplicateResponse = await request(app)
      .post('/api/goals/templates')
      .set('x-profile-id', String(coParent.id))
      .send({
        name: 'Family Trip Jar',
        category: 'family_outing',
        suggested_points: 1000,
        icon: '🎯'
      });

    expect(duplicateResponse.status).toBe(400);
    expect(duplicateResponse.body.error).toContain('already exists');
  });
});
