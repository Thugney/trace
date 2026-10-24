import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { authenticate } from '../middleware/auth.js';
import { requireFeature } from '../middleware/feature-access.js';
import { isFeatureEnabledForProfile } from '../services/profileFeatures.js';
import { testDb } from './setup.js';
import { createTestProfile, authHeaders } from './helpers.js';

function createApp() {
  const app = express();
  app.get('/learn', authenticate, requireFeature('learn'), (_req, res) => res.json({ ok: true }));
  app.get('/tasks', authenticate, requireFeature('tasks'), (_req, res) => res.json({ ok: true }));
  app.get('/activities', authenticate, requireFeature('activities'), (_req, res) => res.json({ ok: true }));
  return app;
}

function setSetting(key: string, value: string) {
  testDb.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

describe('learn feature flag', () => {
  it('is off by default for parents and children, without changing other defaults', () => {
    const parent = createTestProfile({ name: 'Parent', type: 'parent' });
    const child = createTestProfile({ name: 'Kid', type: 'child', parent_id: parent.id });

    expect(isFeatureEnabledForProfile(parent, 'learn')).toBe(false);
    expect(isFeatureEnabledForProfile(child, 'learn')).toBe(false);
    expect(isFeatureEnabledForProfile(child, 'tasks')).toBe(true);
  });

  it('turns on for the family when the parent opts in, and can be disabled per child', () => {
    const parent = createTestProfile({ name: 'Parent', type: 'parent' });
    const child = createTestProfile({ name: 'Kid', type: 'child', parent_id: parent.id });
    const sibling = createTestProfile({ name: 'Sibling', type: 'child', parent_id: parent.id });

    testDb.prepare("INSERT INTO family_features (parent_id, feature_key, enabled) VALUES (?, 'learn', 1)").run(parent.id);
    testDb.prepare("INSERT INTO profile_features (profile_id, feature_key, enabled) VALUES (?, 'learn', 0)").run(sibling.id);

    expect(isFeatureEnabledForProfile(child, 'learn')).toBe(true);
    expect(isFeatureEnabledForProfile(sibling, 'learn')).toBe(false);
  });
});

describe('school-only mode', () => {
  it('blocks core modules but allows the default learning components', async () => {
    const parent = createTestProfile({ name: 'Parent', type: 'parent' });
    const child = createTestProfile({ name: 'Kid', type: 'child', parent_id: parent.id });
    testDb.prepare("INSERT INTO family_features (parent_id, feature_key, enabled) VALUES (?, 'learn', 1)").run(parent.id);
    setSetting('school_only_mode', 'true');

    const app = createApp();
    expect((await request(app).get('/tasks').set(authHeaders(child.id))).status).toBe(403);
    expect((await request(app).get('/learn').set(authHeaders(child.id))).status).toBe(200);
    expect((await request(app).get('/activities').set(authHeaders(child.id))).status).toBe(403);
  });

  it('respects an admin-configured allowlist and still honours per-profile feature flags', async () => {
    const parent = createTestProfile({ name: 'Parent', type: 'parent' });
    const child = createTestProfile({ name: 'Kid', type: 'child', parent_id: parent.id });
    setSetting('school_only_mode', 'true');
    setSetting('school_only_allowed_features', JSON.stringify(['learn', 'activities', 'not-a-feature']));

    const app = createApp();
    expect((await request(app).get('/activities').set(authHeaders(child.id))).status).toBe(200);
    // learn is allowed by school-only mode but the family has not opted in
    expect((await request(app).get('/learn').set(authHeaders(child.id))).status).toBe(403);
    expect((await request(app).get('/tasks').set(authHeaders(child.id))).status).toBe(403);
  });
});
