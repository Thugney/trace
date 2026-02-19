import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createTestProfile, createTestNote } from './helpers.js';
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
        .set('x-profile-id', String(profile.id));

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('should allow parent to access child notes', async () => {
      const parent = createTestProfile({ name: 'Parent', type: 'parent' });
      const child = createTestProfile({ name: 'Child', type: 'child', parent_id: parent.id });
      createTestNote(child.id, { title: 'Child Note' });

      const response = await request(app)
        .get(`/notes/${child.id}`)
        .set('x-profile-id', String(parent.id));

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
        .set('x-profile-id', String(parent2.id));

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('denied');
    });
  });

  describe('POST /notes', () => {
    it('should create a note', async () => {
      const profile = createTestProfile({ name: 'Test User', type: 'child' });

      const response = await request(app)
        .post('/notes')
        .set('x-profile-id', String(profile.id))
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
        .set('x-profile-id', String(profile.id))
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
        .set('x-profile-id', String(profile.id));

      expect(response.status).toBe(200);

      // Verify it's deleted
      const deletedNote = testDb.prepare('SELECT * FROM notes WHERE id = ?').get(note.id);
      expect(deletedNote).toBeUndefined();
    });
  });
});
