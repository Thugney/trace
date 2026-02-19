import { describe, it, expect, beforeEach } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { createTestProfile } from './helpers.js';

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());

  // Protected test route
  app.get('/protected', authenticate, (req: AuthRequest, res: Response) => {
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

describe('Auth Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('authenticate', () => {
    it('should return 401 when no profile ID is provided', async () => {
      const response = await request(app)
        .get('/protected');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('No profile ID provided');
    });

    it('should return 401 when profile ID is invalid', async () => {
      const response = await request(app)
        .get('/protected')
        .set('x-profile-id', '99999');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid profile ID');
    });

    it('should allow access with valid profile ID', async () => {
      const profile = createTestProfile({ name: 'Test User', type: 'child' });

      const response = await request(app)
        .get('/protected')
        .set('x-profile-id', String(profile.id));

      expect(response.status).toBe(200);
      expect(response.body.profile.id).toBe(profile.id);
      expect(response.body.profile.type).toBe('child');
    });
  });

  describe('requireRole', () => {
    it('should deny access when role is not allowed', async () => {
      const child = createTestProfile({ name: 'Child User', type: 'child' });

      const response = await request(app)
        .get('/admin-only')
        .set('x-profile-id', String(child.id));

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should allow access when role is allowed', async () => {
      const admin = createTestProfile({ name: 'Admin User', type: 'admin' });

      const response = await request(app)
        .get('/admin-only')
        .set('x-profile-id', String(admin.id));

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Admin access granted');
    });

    it('should allow parent access to parent-admin route', async () => {
      const parent = createTestProfile({ name: 'Parent User', type: 'parent' });

      const response = await request(app)
        .get('/parent-admin')
        .set('x-profile-id', String(parent.id));

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Access granted');
    });
  });
});
