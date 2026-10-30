import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import dietRouter from '../routes/diet.js';
import profilesRouter from '../routes/profiles.js';
import { testDb } from './setup.js';
import { createTestProfile, authHeaders } from './helpers.js';

// The frontend shows the Diet nav item from GET /profiles/me/features (`diet`),
// so that flag must agree with what requireFeature('diet') lets through.
function createApp() {
  // The shared test schema has no diet tables; the endpoint probed below needs meal_plans
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS meal_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      day_of_week INTEGER,
      meal_type TEXT,
      recipe_data TEXT,
      is_family_plan BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const app = express();
  app.use(express.json());
  app.use('/diet', dietRouter);
  app.use('/profiles', profilesRouter);
  return app;
}

async function dietAccess(app: express.Express, profileId: number) {
  const features = await request(app).get('/profiles/me/features').set(authHeaders(profileId));
  const diet = await request(app).get('/diet/meal-plans').set(authHeaders(profileId));
  return { advertised: features.body.features.diet as boolean, status: diet.status };
}

describe('diet access', () => {
  it('lets family members use Diet by default, without the legacy diet_enabled flag', async () => {
    const app = createApp();
    const parent = createTestProfile({ name: 'Parent', type: 'parent' });
    const child = createTestProfile({ name: 'Kid', type: 'child', parent_id: parent.id, diet_enabled: 0 });

    expect(await dietAccess(app, parent.id)).toEqual({ advertised: true, status: 200 });
    expect(await dietAccess(app, child.id)).toEqual({ advertised: true, status: 200 });
  });

  it('hides and blocks Diet when the family or the profile turns it off', async () => {
    const app = createApp();
    const parent = createTestProfile({ name: 'Parent', type: 'parent' });
    const child = createTestProfile({ name: 'Kid', type: 'child', parent_id: parent.id });
    const otherParent = createTestProfile({ name: 'Other Parent', type: 'parent' });
    const optedOutChild = createTestProfile({ name: 'Opted Out', type: 'child', parent_id: otherParent.id, diet_enabled: 1 });

    testDb.prepare("INSERT INTO family_features (parent_id, feature_key, enabled) VALUES (?, 'diet', 0)").run(parent.id);
    testDb.prepare("INSERT INTO profile_features (profile_id, feature_key, enabled) VALUES (?, 'diet', 0)").run(optedOutChild.id);

    expect(await dietAccess(app, parent.id)).toEqual({ advertised: false, status: 403 });
    expect(await dietAccess(app, child.id)).toEqual({ advertised: false, status: 403 });
    expect(await dietAccess(app, optedOutChild.id)).toEqual({ advertised: false, status: 403 });
    expect(await dietAccess(app, otherParent.id)).toEqual({ advertised: true, status: 200 });
  });
});
