import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import profilesRouter from '../routes/profiles.js';
import { createTestProfile } from './helpers.js';
import { testDb } from './setup.js';

// Create test app with profiles router
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/profiles', profilesRouter);
  return app;
}

describe('Profiles API', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('GET /api/profiles/:parentId/progress', () => {
    it('should return family progress with children and summary', async () => {
      // Create a parent profile
      const parent = createTestProfile({ name: 'Test Parent', type: 'parent' });

      // Create child profiles
      const child1 = createTestProfile({
        name: 'Child 1',
        type: 'child',
        parent_id: parent.id
      });
      const child2 = createTestProfile({
        name: 'Child 2',
        type: 'child',
        parent_id: parent.id
      });

      // Create tasks for child1 using direct SQL to avoid schema issues
      testDb.prepare(`
        INSERT INTO tasks (profile_id, title, completed, points, completed_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(child1.id, 'Task 1 for Child 1', 1, 10, '2026-01-10 10:00:00');

      testDb.prepare(`
        INSERT INTO tasks (profile_id, title, completed, points)
        VALUES (?, ?, ?, ?)
      `).run(child1.id, 'Task 2 for Child 1', 0, 5);

      // Create tasks for child2
      testDb.prepare(`
        INSERT INTO tasks (profile_id, title, completed, points, completed_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(child2.id, 'Task 1 for Child 2', 1, 15, '2026-01-11 11:00:00');

      // Create progress records using direct SQL
      testDb.prepare(`
        INSERT INTO progress (profile_id, total_points, total_stars, level)
        VALUES (?, ?, ?, ?)
      `).run(child1.id, 50, 3, 2);

      testDb.prepare(`
        INSERT INTO progress (profile_id, total_points, total_stars, level)
        VALUES (?, ?, ?, ?)
      `).run(child2.id, 30, 2, 1);

      const response = await request(app)
        .get(`/api/profiles/${parent.id}/progress`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('children');
      expect(response.body).toHaveProperty('summary');

      // Check children array
      expect(response.body.children).toHaveLength(2);

      // Check child1 data
      const child1Data = response.body.children.find((c: any) => c.id === child1.id);
      expect(child1Data).toBeDefined();
      expect(child1Data.tasks.total_tasks).toBe(2);
      expect(child1Data.tasks.completed_tasks).toBe(1);
      expect(child1Data.progress.total_points).toBe(50);
      expect(child1Data.progress.total_stars).toBe(3);
      expect(child1Data.completionRate).toBe(50); // 1 out of 2 tasks completed
      expect(child1Data.currentStreak).toBeDefined();

      // Check child2 data
      const child2Data = response.body.children.find((c: any) => c.id === child2.id);
      expect(child2Data).toBeDefined();
      expect(child2Data.tasks.total_tasks).toBe(1);
      expect(child2Data.tasks.completed_tasks).toBe(1);
      expect(child2Data.progress.total_points).toBe(30);
      expect(child2Data.progress.total_stars).toBe(2);
      expect(child2Data.completionRate).toBe(100); // 1 out of 1 task completed

      // Check family summary
      expect(response.body.summary.total_tasks).toBe(3); // 2 + 1 tasks
      expect(response.body.summary.completed_tasks).toBe(2); // 1 + 1 completed
      expect(response.body.summary.total_points).toBe(80); // 50 + 30 points
      expect(response.body.summary.total_stars).toBe(5); // 3 + 2 stars
    });

    it('should return empty array and zero summary when parent has no children', async () => {
      const parent = createTestProfile({ name: 'Parent with no kids', type: 'parent' });

      const response = await request(app)
        .get(`/api/profiles/${parent.id}/progress`);

      expect(response.status).toBe(200);
      expect(response.body.children).toEqual([]);
      expect(response.body.summary.total_tasks).toBe(0);
      expect(response.body.summary.completed_tasks).toBe(0);
      expect(response.body.summary.total_points).toBe(0);
      expect(response.body.summary.total_stars).toBe(0);
    });

    it('should handle child with no tasks or progress gracefully', async () => {
      const parent = createTestProfile({ name: 'Test Parent', type: 'parent' });
      const child = createTestProfile({
        name: 'Child with no data',
        type: 'child',
        parent_id: parent.id
      });

      const response = await request(app)
        .get(`/api/profiles/${parent.id}/progress`);

      expect(response.status).toBe(200);
      expect(response.body.children).toHaveLength(1);

      const childData = response.body.children[0];
      expect(childData.tasks.total_tasks).toBe(0);
      expect(childData.tasks.completed_tasks).toBe(0);
      expect(childData.tasks.overdue_tasks).toBe(0);
      expect(childData.progress.total_points).toBe(0);
      expect(childData.progress.total_stars).toBe(0);
      expect(childData.progress.level).toBe(1);
      expect(childData.completionRate).toBe(0);
      expect(childData.currentStreak).toBe(0);
    });
  });

  // Test for new /profiles/family/progress endpoint (authenticated)
  describe('GET /api/profiles/family/progress', () => {
    it('should return family progress for authenticated parent', async () => {
      // Create a parent profile
      const parent = createTestProfile({ name: 'Test Parent', type: 'parent' });

      // Create child profiles
      const child1 = createTestProfile({
        name: 'Child 1',
        type: 'child',
        parent_id: parent.id
      });
      const child2 = createTestProfile({
        name: 'Child 2',
        type: 'child',
        parent_id: parent.id
      });

      // Create tasks for child1
      // Note: We'll create tasks without proof_required column to avoid schema issues
      // We'll use the basic createTestTask function with minimal fields
      const task1 = testDb.prepare(`
        INSERT INTO tasks (profile_id, title, completed, points, completed_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(child1.id, 'Task 1 for Child 1', 1, 10, '2026-01-10 10:00:00');

      const task2 = testDb.prepare(`
        INSERT INTO tasks (profile_id, title, completed, points)
        VALUES (?, ?, ?, ?)
      `).run(child1.id, 'Task 2 for Child 1', 0, 5);

      // Create tasks for child2
      const task3 = testDb.prepare(`
        INSERT INTO tasks (profile_id, title, completed, points, completed_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(child2.id, 'Task 1 for Child 2', 1, 15, '2026-01-11 11:00:00');

      // Create progress records
      const progress1 = testDb.prepare(`
        INSERT INTO progress (profile_id, total_points, total_stars, level)
        VALUES (?, ?, ?, ?)
      `).run(child1.id, 50, 3, 2);

      const progress2 = testDb.prepare(`
        INSERT INTO progress (profile_id, total_points, total_stars, level)
        VALUES (?, ?, ?, ?)
      `).run(child2.id, 30, 2, 1);

      // This test will fail initially because the endpoint doesn't exist
      // It's expected to fail in RED phase
      const response = await request(app)
        .get('/api/profiles/family/progress')
        .set('x-profile-id', String(parent.id));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('children');
      expect(response.body).toHaveProperty('summary');

      // Check we have 2 children
      expect(response.body.children).toHaveLength(2);

      // Check summary totals
      expect(response.body.summary.total_tasks).toBe(3); // 2 + 1 tasks
      expect(response.body.summary.completed_tasks).toBe(2); // 1 + 1 completed
      expect(response.body.summary.total_points).toBe(80); // 50 + 30 points
      expect(response.body.summary.total_stars).toBe(5); // 3 + 2 stars
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .get('/api/profiles/family/progress');

      expect(response.status).toBe(401);
    });
  });
});