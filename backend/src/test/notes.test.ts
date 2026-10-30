import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createTestProfile, createTestNote, authHeaders } from './helpers.js';
import { testDb } from './setup.js';
import notesRouter from '../routes/notes.js';

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/notes', notesRouter);
  return app;
}

describe('Notes Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('GET /notes/:profileId', () => {
    it('should allow user to access their own notes', async () => {
      const profile = createTestProfile({ name: 'Test User', type: 'child' });
      createTestNote(profile.id, { title: 'My Note 1' });
      createTestNote(profile.id, { title: 'My Note 2' });

      const response = await request(app)
        .get(`/notes/${profile.id}`)
        .set(authHeaders(profile.id));

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should allow parent to access child notes', async () => {
      const parent = createTestProfile({ name: 'Parent', type: 'parent' });
      const child = createTestProfile({ name: 'Child', type: 'child', parent_id: parent.id });
      createTestNote(child.id, { title: 'Child Note' });

      const response = await request(app)
        .get(`/notes/${child.id}`)
        .set(authHeaders(parent.id));

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Child Note');
    });

    it('should deny parent access to other familys child notes', async () => {
      // Create two separate families
      const parent1 = createTestProfile({ name: 'Parent 1', type: 'parent' });
      const child1 = createTestProfile({ name: 'Child 1', type: 'child', parent_id: parent1.id });
      const parent2 = createTestProfile({ name: 'Parent 2', type: 'parent' });
      createTestNote(child1.id, { title: 'Private Note' });

      // parent2 trying to access child1's notes should be denied
      const response = await request(app)
        .get(`/notes/${child1.id}`)
        .set(authHeaders(parent2.id));

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('denied');
    });
  });

  describe('POST /notes', () => {
    it('should create a note', async () => {
      const profile = createTestProfile({ name: 'Test User', type: 'child' });

      const response = await request(app)
        .post('/notes')
        .set(authHeaders(profile.id))
        .send({
          profile_id: profile.id,
          title: 'New Note',
          content: 'Note content',
          color: '#ffcccc'
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('New Note');
      expect(response.body.color).toBe('#ffcccc');
    });
  });

  describe('PUT /notes/:id', () => {
    it('should update a note', async () => {
      const profile = createTestProfile({ name: 'Test User', type: 'child' });
      const note = createTestNote(profile.id, { title: 'Original Title' });

      const response = await request(app)
        .put(`/notes/${note.id}`)
        .set(authHeaders(profile.id))
        .send({
          title: 'Updated Title',
          content: 'Updated content'
        });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Title');
      expect(response.body.content).toBe('Updated content');
    });
  });

  describe('DELETE /notes/:id', () => {
    it('should delete a note', async () => {
      const profile = createTestProfile({ name: 'Test User', type: 'child' });
      const note = createTestNote(profile.id, { title: 'To Delete' });

      const response = await request(app)
        .delete(`/notes/${note.id}`)
        .set(authHeaders(profile.id));

      expect(response.status).toBe(200);

      // Verify it's deleted
      const deletedNote = testDb.prepare('SELECT * FROM notes WHERE id = ?').get(note.id);
      expect(deletedNote).toBeUndefined();
    });
  });

  describe('ownership (specs/003-learn-lesson-notes US4)', () => {
    function siblings() {
      const parent = createTestProfile({ name: 'Parent', type: 'parent' });
      const childA = createTestProfile({ name: 'Child A', type: 'child', parent_id: parent.id });
      const childB = createTestProfile({ name: 'Child B', type: 'child', parent_id: parent.id });
      const note = createTestNote(childB.id, { title: 'Diary', content: 'Secret', category: 'Journal' });
      testDb.prepare("UPDATE notes SET tags = ?, reminder_at = '2999-01-01' WHERE id = ?").run(JSON.stringify(['private']), note.id);
      return { parent, childA, childB, note };
    }

    it('refuses a child every read of a sibling\'s notes', async () => {
      const { childA, childB, note } = siblings();
      const headers = authHeaders(childA.id);

      for (const path of [`/notes/${childB.id}`, `/notes/${childB.id}/categories`, `/notes/${childB.id}/tags`, `/notes/${childB.id}/reminders`]) {
        const response = await request(app).get(path).set(headers);
        expect(response.status, path).toBe(403);
      }
      expect((await request(app).get(`/notes/note/${note.id}`).set(headers)).status).toBe(404);
    });

    it('refuses a child creating, changing or deleting a sibling\'s notes', async () => {
      const { childA, childB, note } = siblings();
      const headers = authHeaders(childA.id);

      expect((await request(app).post('/notes').set(headers).send({ profile_id: childB.id, title: 'Planted' })).status).toBe(403);
      expect((await request(app).put(`/notes/${note.id}`).set(headers).send({ content: 'Changed' })).status).toBe(403);
      expect((await request(app).delete(`/notes/${note.id}`).set(headers)).status).toBe(403);

      const after: any = testDb.prepare('SELECT content FROM notes WHERE id = ?').get(note.id);
      expect(after.content).toBe('Secret');
      expect((testDb.prepare('SELECT COUNT(*) as n FROM notes WHERE profile_id = ?').get(childB.id) as any).n).toBe(1);
    });

    it('refuses a parent who does not manage the child and keeps the managing parent\'s access', async () => {
      const { parent, childB, note } = siblings();
      const stranger = createTestProfile({ name: 'Stranger', type: 'parent' });

      expect((await request(app).get(`/notes/${childB.id}/tags`).set(authHeaders(stranger.id))).status).toBe(403);
      expect((await request(app).get(`/notes/note/${note.id}`).set(authHeaders(stranger.id))).status).toBe(404);
      expect((await request(app).put(`/notes/${note.id}`).set(authHeaders(stranger.id)).send({ content: 'x' })).status).toBe(403);

      expect((await request(app).get(`/notes/${childB.id}/tags`).set(authHeaders(parent.id))).body).toEqual(['private']);
      expect((await request(app).get(`/notes/${childB.id}/categories`).set(authHeaders(parent.id))).body).toEqual(['Journal']);
      expect((await request(app).get(`/notes/note/${note.id}`).set(authHeaders(parent.id))).body.title).toBe('Diary');
    });
  });
});
