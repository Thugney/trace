import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import settingsRoutes from '../routes/settings.js';
import { createStreamToken, resolveSessionToken, createSession } from '../services/authSessions.js';
import { migrateLegacyParentPin } from '../services/credentials.js';
import { testDb } from './setup.js';
import { createTestProfile, authHeaders } from './helpers.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/settings', settingsRoutes);
  return app;
}

function setSetting(key: string, value: string) {
  testDb.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

describe('settings route security', () => {
  it('requires authentication to read settings', async () => {
    const response = await request(createApp()).get('/settings');
    expect(response.status).toBe(401);
  });

  it('keeps feature flags public', async () => {
    setSetting('school_only_mode', 'true');
    const response = await request(createApp()).get('/settings/features/flags');
    expect(response.status).toBe(200);
    expect(response.body.school_only_mode).toBe(true);
  });

  it('denies children access to global settings', async () => {
    const child = createTestProfile({ name: 'Kid', type: 'child' });
    const response = await request(createApp()).get('/settings').set(authHeaders(child.id));
    expect(response.status).toBe(403);
  });

  it('masks credentials and never returns the token signing secret', async () => {
    const admin = createTestProfile({ name: 'Admin', type: 'admin' });
    setSetting('grok_api_key', 'xai-super-secret');
    setSetting('parent_pin', await bcrypt.hash('1234', 4));
    setSetting('ollama_model', 'llama3.2');
    // Force the signing secret to exist
    createStreamToken(resolveSessionToken(createSession(admin.id).token)!);

    const response = await request(createApp()).get('/settings').set(authHeaders(admin.id));
    expect(response.status).toBe(200);
    expect(response.body.grok_api_key).toBe('********');
    expect(response.body.parent_pin).toBe('********');
    expect(response.body.ollama_model).toBe('llama3.2');
    expect(response.body.auth_token_secret).toBeUndefined();

    const single = await request(createApp()).get('/settings/auth_token_secret').set(authHeaders(admin.id));
    expect(single.status).toBe(404);
  });

  it('only admins can write settings, and reserved keys are blocked', async () => {
    const parent = createTestProfile({ name: 'Parent', type: 'parent' });
    const admin = createTestProfile({ name: 'Admin', type: 'admin' });

    const parentWrite = await request(createApp())
      .post('/settings/school_only_mode')
      .set(authHeaders(parent.id))
      .send({ value: 'true' });
    expect(parentWrite.status).toBe(403);

    const anonymousWrite = await request(createApp())
      .post('/settings/school_only_mode')
      .send({ value: 'true' });
    expect(anonymousWrite.status).toBe(401);

    const reserved = await request(createApp())
      .post('/settings/auth_token_secret')
      .set(authHeaders(admin.id))
      .send({ value: 'attacker-chosen' });
    expect(reserved.status).toBe(400);

    const adminWrite = await request(createApp())
      .post('/settings/school_only_mode')
      .set(authHeaders(admin.id))
      .send({ value: 'true' });
    expect(adminWrite.status).toBe(200);
  });

  it('restricts Ollama management to admins', async () => {
    const parent = createTestProfile({ name: 'Parent', type: 'parent' });

    const anonymous = await request(createApp()).post('/settings/ollama/configure').send({ url: 'http://evil.example' });
    expect(anonymous.status).toBe(401);

    const asParent = await request(createApp())
      .post('/settings/ollama/configure')
      .set(authHeaders(parent.id))
      .send({ url: 'http://evil.example' });
    expect(asParent.status).toBe(403);
  });

  it('stores the parent PIN hashed and verifies it', async () => {
    const parent = createTestProfile({ name: 'Parent', type: 'parent' });
    const app = createApp();

    const setPin = await request(app).post('/settings/set-pin').set(authHeaders(parent.id)).send({ pin: '5555' });
    expect(setPin.status).toBe(200);

    const stored: any = testDb.prepare("SELECT value FROM settings WHERE key = 'parent_pin'").get();
    expect(stored.value).toMatch(/^\$2[aby]\$/);

    const verify = await request(app).post('/settings/verify-pin').set(authHeaders(parent.id)).send({ pin: '5555' });
    expect(verify.body.verified).toBe(true);

    const wrongCurrent = await request(app)
      .post('/settings/set-pin')
      .set(authHeaders(parent.id))
      .send({ pin: '6666', current_pin: '0000' });
    expect(wrongCurrent.status).toBe(401);
  });

  it('migrates a legacy plaintext parent PIN', async () => {
    setSetting('parent_pin', '7777');
    expect(migrateLegacyParentPin()).toBe(true);

    const stored: any = testDb.prepare("SELECT value FROM settings WHERE key = 'parent_pin'").get();
    expect(await bcrypt.compare('7777', stored.value)).toBe(true);
    expect(migrateLegacyParentPin()).toBe(false);
  });
});
