import { describe, it, expect, beforeEach } from 'vitest';
import express, { Response } from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { authenticate, authenticateEventSource, requireRole, AuthRequest } from '../middleware/auth.js';
import { createSession, createStreamToken, resolveSessionToken, revokeSession } from '../services/authSessions.js';
import { testDb } from './setup.js';
import { createTestProfile, authHeaders } from './helpers.js';

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());

  // Protected test route
  app.get('/protected', authenticate, (req: AuthRequest, res: Response) => {
    res.json({ profile: req.profile });
  });

  app.get('/stream', authenticateEventSource, (req: AuthRequest, res: Response) => {
    res.json({ profile: req.profile });
  });

  // Admin-only route
  app.get('/admin-only', authenticate, requireRole(['admin']), (req: AuthRequest, res: Response) => {
    res.json({ message: 'Admin access granted' });
  });

  // Parent or admin route
  app.get('/parent-admin', authenticate, requireRole(['parent', 'admin']), (req: AuthRequest, res: Response) => {
    res.json({ message: 'Access granted' });
  });

  return app;
}

async function createProfilesApp() {
  const { default: profileRoutes } = await import('../routes/profiles.js');
  const app = express();
  app.use(express.json());
  app.use('/profiles', profileRoutes);
  return app;
}

describe('Auth Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('authenticate', () => {
    it('should return 401 when no session token is provided', async () => {
      const response = await request(app)
        .get('/protected');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('auth_required');
    });

    it('ignores the legacy x-profile-id header (no identity spoofing)', async () => {
      const admin = createTestProfile({ name: 'Admin User', type: 'admin' });

      const response = await request(app)
        .get('/protected')
        .set('x-profile-id', String(admin.id));

      expect(response.status).toBe(401);
    });

    it('should return 401 when the token is unknown', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer not-a-real-token');

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('session_invalid');
    });

    it('should allow access with a valid session and derive identity server-side', async () => {
      const profile = createTestProfile({ name: 'Test User', type: 'child' });

      const response = await request(app)
        .get('/protected')
        .set(authHeaders(profile.id));

      expect(response.status).toBe(200);
      expect(response.body.profile.id).toBe(profile.id);
      expect(response.body.profile.type).toBe('child');
    });

    it('ignores a spoofed x-profile-id header alongside a valid child session', async () => {
      const child = createTestProfile({ name: 'Child', type: 'child' });
      const admin = createTestProfile({ name: 'Admin', type: 'admin' });

      const response = await request(app)
        .get('/protected')
        .set(authHeaders(child.id))
        .set('x-profile-id', String(admin.id));

      expect(response.status).toBe(200);
      expect(response.body.profile.id).toBe(child.id);
    });

    it('rejects revoked sessions', async () => {
      const profile = createTestProfile({ name: 'Test User', type: 'parent' });
      const session = createSession(profile.id);
      revokeSession(session.sessionId);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${session.token}`);

      expect(response.status).toBe(401);
    });

    it('rejects expired sessions', async () => {
      const profile = createTestProfile({ name: 'Test User', type: 'parent' });
      const session = createSession(profile.id);
      testDb.prepare('UPDATE auth_sessions SET idle_expires_at = ? WHERE id = ?')
        .run(new Date(Date.now() - 1000).toISOString(), session.sessionId);

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${session.token}`);

      expect(response.status).toBe(401);
    });

    it('stores only a hash of the session token', () => {
      const profile = createTestProfile({ name: 'Test User', type: 'parent' });
      const session = createSession(profile.id);
      const row: any = testDb.prepare('SELECT token_hash FROM auth_sessions WHERE id = ?').get(session.sessionId);

      expect(row.token_hash).not.toBe(session.token);
      expect(row.token_hash).toHaveLength(64);
    });
  });

  describe('stream tokens', () => {
    it('are accepted by EventSource auth via query string but not by regular auth', async () => {
      const profile = createTestProfile({ name: 'Kid', type: 'child' });
      const session = createSession(profile.id);
      const resolved = resolveSessionToken(session.token)!;
      const stream = createStreamToken(resolved);

      const streamResponse = await request(app)
        .get('/stream')
        .query({ access_token: stream.token });
      expect(streamResponse.status).toBe(200);
      expect(streamResponse.body.profile.id).toBe(profile.id);

      const regularResponse = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${stream.token}`);
      expect(regularResponse.status).toBe(401);
    });

    it('rejects the long-lived session token in a URL', async () => {
      const profile = createTestProfile({ name: 'Kid', type: 'child' });
      const session = createSession(profile.id);

      const response = await request(app)
        .get('/stream')
        .query({ access_token: session.token });
      expect(response.status).toBe(401);
    });

    it('rejects tampered and revoked stream tokens', async () => {
      const profile = createTestProfile({ name: 'Kid', type: 'child' });
      const other = createTestProfile({ name: 'Other', type: 'admin' });
      const session = createSession(profile.id);
      const stream = createStreamToken(resolveSessionToken(session.token)!);

      const parts = stream.token.split('.');
      parts[2] = String(other.id);
      const tampered = await request(app).get('/stream').query({ access_token: parts.join('.') });
      expect(tampered.status).toBe(401);

      revokeSession(session.sessionId);
      const revoked = await request(app).get('/stream').query({ access_token: stream.token });
      expect(revoked.status).toBe(401);
    });

    it('does not accept the legacy profile_id query parameter', async () => {
      const profile = createTestProfile({ name: 'Kid', type: 'child' });

      const response = await request(app)
        .get('/stream')
        .query({ profile_id: profile.id });
      expect(response.status).toBe(401);
    });
  });

  describe('requireRole', () => {
    it('should deny access when role is not allowed', async () => {
      const child = createTestProfile({ name: 'Child User', type: 'child' });

      const response = await request(app)
        .get('/admin-only')
        .set(authHeaders(child.id));

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should allow access when role is allowed', async () => {
      const admin = createTestProfile({ name: 'Admin User', type: 'admin' });

      const response = await request(app)
        .get('/admin-only')
        .set(authHeaders(admin.id));

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Admin access granted');
    });

    it('should allow parent access to parent-admin route', async () => {
      const parent = createTestProfile({ name: 'Parent User', type: 'parent' });

      const response = await request(app)
        .get('/parent-admin')
        .set(authHeaders(parent.id));

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Access granted');
    });
  });
});

describe('Login, session lifecycle and PIN endpoints', () => {
  it('login issues a session token that authenticates as the logged-in profile', async () => {
    const app = await createProfilesApp();
    const hashed = await bcrypt.hash('4321', 4);
    const child = createTestProfile({ name: 'Nora', type: 'child', pin: hashed });

    const login = await request(app).post('/profiles/login').send({ username: 'Nora', pin: '4321' });
    expect(login.status).toBe(200);
    expect(typeof login.body.token).toBe('string');

    const session = await request(app)
      .get('/profiles/session')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(session.status).toBe(200);
    expect(session.body.profile.id).toBe(child.id);
    expect(session.body.profile.pin).toBeUndefined();
  });

  it('rejects a wrong PIN without issuing a token', async () => {
    const app = await createProfilesApp();
    createTestProfile({ name: 'Nora', type: 'child', pin: await bcrypt.hash('4321', 4) });

    const login = await request(app).post('/profiles/login').send({ username: 'Nora', pin: '0000' });
    expect(login.status).toBe(401);
    expect(login.body.token).toBeUndefined();
  });

  it('accepts a legacy plaintext PIN once and upgrades it to a bcrypt hash', async () => {
    const app = await createProfilesApp();
    const child = createTestProfile({ name: 'Legacy', type: 'child', pin: '1234' });

    const login = await request(app).post('/profiles/login').send({ username: 'Legacy', pin: '1234' });
    expect(login.status).toBe(200);

    const row: any = testDb.prepare('SELECT pin FROM profiles WHERE id = ?').get(child.id);
    expect(row.pin).toMatch(/^\$2[aby]\$/);
    expect(await bcrypt.compare('1234', row.pin)).toBe(true);
  });

  it('logout revokes the session', async () => {
    const app = await createProfilesApp();
    const parent = createTestProfile({ name: 'Parent', type: 'parent' });
    const headers = authHeaders(parent.id);

    const logout = await request(app).post('/profiles/logout').set(headers);
    expect(logout.status).toBe(200);

    const after = await request(app).get('/profiles/session').set(headers);
    expect(after.status).toBe(401);
  });

  it('verify-pin requires authentication', async () => {
    const app = await createProfilesApp();
    const child = createTestProfile({ name: 'Kid', type: 'child', pin: await bcrypt.hash('1111', 4) });

    const response = await request(app).post(`/profiles/${child.id}/verify-pin`).send({ pin: '1111' });
    expect(response.status).toBe(401);
  });

  it('verify-pin and set-pin deny cross-family access', async () => {
    const app = await createProfilesApp();
    const parentA = createTestProfile({ name: 'Parent A', type: 'parent' });
    const parentB = createTestProfile({ name: 'Parent B', type: 'parent' });
    const childB = createTestProfile({ name: 'Kid B', type: 'child', parent_id: parentB.id, pin: await bcrypt.hash('1111', 4) });

    const verify = await request(app)
      .post(`/profiles/${childB.id}/verify-pin`)
      .set(authHeaders(parentA.id))
      .send({ pin: '1111' });
    expect(verify.status).toBe(403);

    const setPin = await request(app)
      .post(`/profiles/${childB.id}/set-pin`)
      .set(authHeaders(parentA.id))
      .send({ pin: '9999' });
    expect(setPin.status).toBe(403);
  });

  it('a guardian can set a child PIN, which is stored hashed and verifies correctly', async () => {
    const app = await createProfilesApp();
    const parent = createTestProfile({ name: 'Parent', type: 'parent' });
    const child = createTestProfile({ name: 'Kid', type: 'child', parent_id: parent.id });
    const childHeaders = authHeaders(child.id);

    const setPin = await request(app)
      .post(`/profiles/${child.id}/set-pin`)
      .set(authHeaders(parent.id))
      .send({ pin: '2468' });
    expect(setPin.status).toBe(200);

    const row: any = testDb.prepare('SELECT pin FROM profiles WHERE id = ?').get(child.id);
    expect(row.pin).toMatch(/^\$2[aby]\$/);

    const verify = await request(app)
      .post(`/profiles/${child.id}/verify-pin`)
      .set(authHeaders(parent.id))
      .send({ pin: '2468' });
    expect(verify.body.verified).toBe(true);

    // Child's existing sessions are revoked after a guardian changes their PIN
    const childSession = await request(app).get('/profiles/session').set(childHeaders);
    expect(childSession.status).toBe(401);
  });

  it('changing your own PIN requires the current PIN', async () => {
    const app = await createProfilesApp();
    const child = createTestProfile({ name: 'Kid', type: 'child', pin: await bcrypt.hash('1111', 4) });

    const response = await request(app)
      .post(`/profiles/${child.id}/set-pin`)
      .set(authHeaders(child.id))
      .send({ pin: '2222', currentPin: '0000' });
    expect(response.status).toBe(403);
  });
});
