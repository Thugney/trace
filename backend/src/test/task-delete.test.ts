import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import tasksRoutes from '../routes/tasks.js';
import { createTestProfile, createTestTask, authHeaders } from './helpers.js';
import { testDb } from './setup.js';

function createTasksApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/tasks', tasksRoutes);
  return app;
}

function enableTasks(profileId: number) {
  testDb.prepare(`
    INSERT INTO profile_features (profile_id, feature_key, enabled)
    VALUES (?, 'tasks', 1)
  `).run(profileId);
}

describe('task deletion', () => {
  it('soft-deletes child tasks instead of removing them outright', async () => {
    const app = createTasksApp();
    const parent = createTestProfile({ name: 'Task Parent', type: 'parent' });
    const child = createTestProfile({ name: 'Task Kid', type: 'child', parent_id: parent.id });

    enableTasks(parent.id);
    enableTasks(child.id);

    const task = createTestTask(child.id, { title: 'Brush Teeth', created_by: parent.id });

    const response = await request(app)
      .delete(`/api/tasks/${task.id}`)
      .set(authHeaders(parent.id));

    expect(response.status).toBe(200);
    expect(response.body.soft_deleted).toBe(true);

    const archivedTask = testDb.prepare('SELECT deleted_at, deleted_by FROM tasks WHERE id = ?').get(task.id) as {
      deleted_at: string | null;
      deleted_by: number | null;
    };

    expect(archivedTask.deleted_at).not.toBeNull();
    expect(archivedTask.deleted_by).toBe(parent.id);
  });
});
