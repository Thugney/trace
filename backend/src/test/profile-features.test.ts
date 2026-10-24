import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import profilesRouter from '../routes/profiles.js';
import { authenticate } from '../middleware/auth.js';
import { requireFeature } from '../middleware/feature-access.js';
import { getEffectiveFeaturesForProfile } from '../services/profileFeatures.js';
import { testDb } from './setup.js';
import { createTestProfile, authHeaders } from './helpers.js';

function createProfilesApp() {
  const app = express();
  app.use(express.json());
  app.use('/profiles', profilesRouter);
  return app;
}

function createProtectedApp() {
  const app = express();
  app.use(express.json());
  app.get('/protected-ai', authenticate, requireFeature('ai'), (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/protected-tasks', authenticate, requireFeature('tasks'), (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe('profile feature access', () => {
  it('keeps a family-disabled feature off even when the child profile row is enabled', async () => {
    const app = createProfilesApp();
    const parent = createTestProfile({ name: 'Parent', type: 'parent' });
    const child = createTestProfile({ name: 'Child', type: 'child', parent_id: parent.id });

    testDb.prepare(`
      INSERT INTO profile_features (profile_id, feature_key, enabled)
      VALUES (?, 'ai', 1)
    `).run(child.id);

    testDb.prepare(`
      INSERT INTO family_features (parent_id, feature_key, enabled)
      VALUES (?, 'ai', 0)
    `).run(parent.id);

    expect(getEffectiveFeaturesForProfile({
      id: child.id,
      type: 'child',
      parent_id: parent.id
    }).ai).toBe(false);

    const response = await request(app)
      .get('/profiles/me/features')
      .set(authHeaders(child.id));

    expect(response.status).toBe(200);
    expect(response.body.features.ai).toBe(false);
  });

  it('allows legacy profiles with no profile_features rows to use enabled features', async () => {
    const app = createProtectedApp();
    const child = createTestProfile({ name: 'Legacy Child', type: 'child' });

    const response = await request(app)
      .get('/protected-tasks')
      .set(authHeaders(child.id));

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  it('blocks protected routes when the parent disabled a family feature', async () => {
    const app = createProtectedApp();
    const parent = createTestProfile({ name: 'Parent', type: 'parent' });
    const child = createTestProfile({ name: 'Child', type: 'child', parent_id: parent.id });

    testDb.prepare(`
      INSERT INTO family_features (parent_id, feature_key, enabled)
      VALUES (?, 'ai', 0)
    `).run(parent.id);

    const response = await request(app)
      .get('/protected-ai')
      .set(authHeaders(child.id));

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('disabled');
  });
});
