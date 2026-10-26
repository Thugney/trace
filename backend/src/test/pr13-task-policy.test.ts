import { beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { testDb } from './setup.js';
import { authHeaders, createTestProfile, createTestTask } from './helpers.js';

let app: express.Express;
beforeAll(async () => {
  process.env.PROOF_DIR = `${process.cwd()}/tmp-test-proofs`;
  testDb.exec('CREATE TABLE IF NOT EXISTS subtasks (id INTEGER PRIMARY KEY, task_id INTEGER, title TEXT, completed INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0)');
  const { default: tasks } = await import('../routes/tasks.js');
  app = express(); app.use(express.json()); app.use('/tasks', tasks);
});
function fixture() {
  const parent = createTestProfile({ name: 'Guardian', type: 'parent' });
  const child = createTestProfile({ name: 'Child', type: 'child', parent_id: parent.id });
  const outsider = createTestProfile({ name: 'Other guardian', type: 'parent' });
  const admin = createTestProfile({ name: 'Admin', type: 'admin' });
  const task = createTestTask(child.id, { title: 'Parent-set work', parent_approved: 1 });
  testDb.prepare('UPDATE tasks SET proof_required=1, requires_timer=1, timer_duration_minutes=20 WHERE id=?').run(task.id);
  return { parent, child, outsider, admin, task };
}
const mutations = [
  { proof_required: false }, { proof_required: null }, { requires_timer: false },
  { timer_duration_minutes: 0 }, { timer_duration_minutes: null }, { timer_duration_minutes: 1 },
  { points: 99999 }, { difficulty: 'easy' }, { completed: true }, { completed: false },
  { title: 'New task' }, { description: 'No requirements' }, { category: 'other' },
  { is_recurring: false }, { recurrence_pattern: null }, { due_date: null },
  { priority: 'low' }, { estimated_minutes: 0 }, { scheduled_time: null },
  { title: 'Changed', proof_required: false, requires_timer: false, timer_duration_minutes: 0, completed: true }
];
describe('parent-set task policy', () => {
  it.each(mutations)('rejects child configuration write %j atomically', async (mutation) => {
    const { child, task } = fixture();
    const original = testDb.prepare('SELECT * FROM tasks WHERE id=?').get(task.id);
    expect((await request(app).put(`/tasks/${task.id}`).set(authHeaders(child.id)).send(mutation)).status).toBe(403);
    expect(testDb.prepare('SELECT * FROM tasks WHERE id=?').get(task.id)).toEqual(original);
    const complete = await request(app).post(`/tasks/${task.id}/complete`).set(authHeaders(child.id));
    expect(complete.status).toBe(400);
    expect(complete.body.code).toBe('TIMER_REQUIRED');
  });
  it('permits owning guardian/admin policy edits but denies an unrelated guardian', async () => {
    const { parent, outsider, admin, task } = fixture();
    const policy = { proof_required: false, requires_timer: false, timer_duration_minutes: 0 };
    expect((await request(app).put(`/tasks/${task.id}`).set(authHeaders(outsider.id)).send(policy)).status).toBe(403);
    for (const actor of [parent, admin]) {
      const updated = await request(app).put(`/tasks/${task.id}`).set(authHeaders(actor.id)).send(policy);
      expect(updated.status).toBe(200);
      expect(updated.body).toMatchObject({ proof_required: 0, requires_timer: 0, timer_duration_minutes: null });
    }
  });
  it('keeps child subtask completion but reserves single/bulk subtask configuration for guardians', async () => {
    const { parent, child, outsider, task } = fixture();
    const created = await request(app).post(`/tasks/${task.id}/subtasks`).set(authHeaders(parent.id)).send({ title: 'Do all required work' });
    expect(created.status).toBe(201);
    const id = created.body.id;
    expect((await request(app).put(`/tasks/subtasks/${id}`).set(authHeaders(child.id)).send({ completed: true })).status).toBe(200);
    expect((await request(app).put(`/tasks/subtasks/${id}`).set(authHeaders(child.id)).send({ title: 'Skip work', completed: false })).status).toBe(403);
    expect((await request(app).put(`/tasks/subtasks/${id}`).set(authHeaders(child.id)).send({ sort_order: 9 })).status).toBe(403);
    expect((await request(app).delete(`/tasks/subtasks/${id}`).set(authHeaders(child.id))).status).toBe(403);
    for (const actor of [child, outsider]) {
      expect((await request(app).post(`/tasks/${task.id}/subtasks`).set(authHeaders(actor.id)).send({ title: 'Changed' })).status).toBe(403);
      expect((await request(app).post(`/tasks/${task.id}/subtasks/bulk`).set(authHeaders(actor.id)).send({ subtasks: [{ title: 'Changed' }] })).status).toBe(403);
    }
    expect(testDb.prepare('SELECT title,completed FROM subtasks WHERE id=?').get(id)).toEqual({ title: 'Do all required work', completed: 1 });
    expect((await request(app).post(`/tasks/${task.id}/subtasks/bulk`).set(authHeaders(parent.id)).send({ subtasks: [{ title: 'Second step' }] })).status).toBe(201);
    expect((await request(app).delete(`/tasks/subtasks/${id}`).set(authHeaders(parent.id))).status).toBe(200);
  });
});
