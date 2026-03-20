import path from 'path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createTestProfile } from './helpers.js';
import { testDb } from './setup.js';

let booksRouter: express.Router;

function createBook(overrides: Partial<{
  title: string;
  created_by: number;
  assigned_to: number;
  genre: string;
  language: string;
}> = {}) {
  const data = {
    title: 'Test Book',
    created_by: 0,
    assigned_to: null as number | null,
    genre: 'story',
    language: 'en',
    ...overrides
  };

  const result = testDb.prepare(`
    INSERT INTO books (title, created_by, assigned_to, genre, language, total_pages)
    VALUES (?, ?, ?, ?, ?, 4)
  `).run(data.title, data.created_by, data.assigned_to, data.genre, data.language);

  return testDb.prepare('SELECT * FROM books WHERE id = ?').get(result.lastInsertRowid) as any;
}

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/books', booksRouter);
  return app;
}

describe('Books API', () => {
  let app: express.Application;

  beforeAll(async () => {
    process.env.BOOK_MEDIA_DIR = path.join(process.cwd(), 'backend', '.tmp-book-media-tests');
    booksRouter = (await import('../routes/books.js')).default;
  });

  beforeEach(() => {
    app = createTestApp();
  });

  it('blocks reading another profile instructions', async () => {
    const parentA = createTestProfile({ name: 'Parent A', type: 'parent', ai_enabled: 1 });
    const parentB = createTestProfile({ name: 'Parent B', type: 'parent', ai_enabled: 1 });

    testDb.prepare('UPDATE profiles SET settings = ? WHERE id = ?')
      .run(JSON.stringify({ book_generation_instructions: 'Use short pages.' }), parentB.id);

    const response = await request(app)
      .get(`/api/books/generation-instructions/${parentB.id}`)
      .set('x-profile-id', String(parentA.id));

    expect(response.status).toBe(403);
  });

  it('saves and loads own generation instructions', async () => {
    const parent = createTestProfile({ name: 'Parent', type: 'parent', ai_enabled: 1 });

    const saveResponse = await request(app)
      .put(`/api/books/generation-instructions/${parent.id}`)
      .set('x-profile-id', String(parent.id))
      .send({ instructions: 'Use short sentences and gentle endings.' });

    expect(saveResponse.status).toBe(200);
    expect(saveResponse.body.instructions).toBe('Use short sentences and gentle endings.');

    const getResponse = await request(app)
      .get(`/api/books/generation-instructions/${parent.id}`)
      .set('x-profile-id', String(parent.id));

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.instructions).toBe('Use short sentences and gentle endings.');
  });

  it('blocks ai generation when createdBy does not match the authenticated profile', async () => {
    const parentA = createTestProfile({ name: 'Parent A', type: 'parent', ai_enabled: 1 });
    const parentB = createTestProfile({ name: 'Parent B', type: 'parent', ai_enabled: 1 });

    const response = await request(app)
      .post('/api/books/ai-generate')
      .set('x-profile-id', String(parentA.id))
      .send({
        prompt: 'A bedtime story about a fox learning patience.',
        createdBy: parentB.id,
        assignedTo: parentB.id
      });

    expect(response.status).toBe(403);
  });

  it('shows managed child books to the parent only', async () => {
    const parent = createTestProfile({ name: 'Parent', type: 'parent', ai_enabled: 1 });
    const child = createTestProfile({ name: 'Child', type: 'child', parent_id: parent.id, ai_enabled: 1 });
    const strangerParent = createTestProfile({ name: 'Other Parent', type: 'parent', ai_enabled: 1 });

    createBook({
      title: 'Garden Adventure',
      created_by: parent.id,
      assigned_to: child.id
    });

    const allowedResponse = await request(app)
      .get(`/api/books/profile/${child.id}`)
      .set('x-profile-id', String(parent.id));

    expect(allowedResponse.status).toBe(200);
    expect(allowedResponse.body).toHaveLength(1);
    expect(allowedResponse.body[0].title).toBe('Garden Adventure');

    const blockedResponse = await request(app)
      .get(`/api/books/profile/${child.id}`)
      .set('x-profile-id', String(strangerParent.id));

    expect(blockedResponse.status).toBe(403);
  });
});
