import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { testDb } from './setup.js';
import { createTestProfile, authHeaders, createLearnEngineTables } from './helpers.js';
import { ensureLearnSchema } from '../services/learn/schema.js';
import { seedLearnCatalog } from '../services/learn/catalog.js';
import { migrateNotesLearnLink } from '../database/noteLearnLink.js';

// specs/003-learn-lesson-notes
const LEARN_TABLES = [
  'learn_personal_cards', 'learn_flashcard_reviews', 'learn_mock_attempts', 'learn_assignments',
  'learn_progress', 'learn_resource_links', 'learn_mock_exams', 'learn_lessons', 'learn_topic_goals',
  'learn_topics', 'learn_goals', 'learn_subjects'
];

async function createApp() {
  const [{ default: learnRoutes }, { default: notesRoutes }] = await Promise.all([
    import('../routes/learn.js'),
    import('../routes/notes.js')
  ]);
  const app = express();
  app.use(express.json());
  app.use('/learn', learnRoutes);
  app.use('/notes', notesRoutes);
  return app;
}

const lessonIdFor = (slug: string) => (testDb.prepare(`
  SELECT l.id FROM learn_lessons l JOIN learn_topics t ON t.id = l.topic_id JOIN learn_subjects s ON s.id = t.subject_id
  WHERE s.slug = ?
`).get(slug) as { id: number }).id;

const topicIdOf = (lessonId: number) => (testDb.prepare('SELECT topic_id FROM learn_lessons WHERE id = ?').get(lessonId) as { topic_id: number }).topic_id;

function startTest(profileId: number) {
  const exam = testDb.prepare('SELECT id, rubric_version FROM learn_mock_exams LIMIT 1').get() as any;
  testDb.prepare(`
    INSERT INTO learn_mock_attempts (exam_id, profile_id, rubric_version, started_at, expires_at) VALUES (?, ?, ?, ?, ?)
  `).run(exam.id, profileId, exam.rubric_version ?? 1, new Date().toISOString(), new Date(Date.now() + 3600_000).toISOString());
}

describe('Learn lesson notes', () => {
  let app: express.Application;
  let parent: any; let child: any; let sibling: any; let stranger: any; let admin: any;
  let maths: number; let norsk: number;

  beforeAll(() => {
    createLearnEngineTables();
    ensureLearnSchema();
    migrateNotesLearnLink(testDb);
  });

  beforeEach(async () => {
    for (const table of [...LEARN_TABLES, 'audit_logs']) testDb.exec(`DELETE FROM ${table}`);
    seedLearnCatalog();
    app = await createApp();
    admin = createTestProfile({ name: 'Admin', type: 'admin' });
    parent = createTestProfile({ name: 'Mamma', type: 'parent' });
    child = createTestProfile({ name: 'Emma', type: 'child', parent_id: parent.id, age: 13 });
    sibling = createTestProfile({ name: 'Ola', type: 'child', parent_id: parent.id, age: 13 });
    stranger = createTestProfile({ name: 'Other parent', type: 'parent' });
    expect((await request(app).put('/learn/family/settings').set(authHeaders(parent.id)).send({ enabled: true })).status).toBe(200);
    maths = lessonIdFor('matematikk');
    norsk = lessonIdFor('norsk');
    for (const lessonId of [maths, norsk]) {
      expect((await request(app).post(`/learn/lessons/${lessonId}/review`).set(authHeaders(admin.id)).send({ status: 'reviewed' })).status).toBe(200);
    }
  });

  const addNote = (profileId: number, lessonId: number, body: Record<string, unknown>) =>
    request(app).post(`/learn/lessons/${lessonId}/notes`).set(authHeaders(profileId)).send(body);

  it('migrates additively and repeat-safely', () => {
    migrateNotesLearnLink(testDb);
    const columns = (testDb.prepare('PRAGMA table_info(notes)').all() as any[]).map((col) => col.name);
    expect(columns).toEqual(expect.arrayContaining(['learn_lesson_id', 'learn_topic_id']));
    testDb.prepare("INSERT INTO notes (profile_id, title, content) VALUES (?, 'Old', 'x')").run(child.id);
    expect((testDb.prepare("SELECT learn_lesson_id FROM notes WHERE title = 'Old'").get() as any).learn_lesson_id).toBeNull();
  });

  describe('a child keeps notes beside a lesson (US1)', () => {
    it('creates, lists, edits and deletes own lesson notes', async () => {
      const created = await addNote(child.id, maths, { content: '  ½ = 0,5  ', color: '#bfdbfe' });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ content: '½ = 0,5', color: '#bfdbfe' });

      const row: any = testDb.prepare('SELECT * FROM notes WHERE id = ?').get(created.body.id);
      expect(row).toMatchObject({ profile_id: child.id, learn_lesson_id: maths, learn_topic_id: topicIdOf(maths), category: 'School' });

      const lesson = await request(app).get(`/learn/lessons/${maths}`).set(authHeaders(child.id));
      expect(lesson.body.notes).toMatchObject({ locked: false, limit: 30, from_parents: [] });
      expect(lesson.body.notes.mine.map((note: any) => note.id)).toEqual([created.body.id]);
      const other = await request(app).get(`/learn/lessons/${norsk}`).set(authHeaders(child.id));
      expect(other.body.notes.mine).toEqual([]);

      const edited = await request(app).put(`/learn/lesson-notes/${created.body.id}`).set(authHeaders(child.id)).send({ content: 'Brøk', color: 'red' });
      expect(edited.status).toBe(200);
      expect(edited.body).toMatchObject({ content: 'Brøk', color: '#fef08a' });

      expect((await request(app).delete(`/learn/lesson-notes/${created.body.id}`).set(authHeaders(child.id))).body).toEqual({ deleted: true });
      expect(testDb.prepare('SELECT 1 FROM notes WHERE id = ?').get(created.body.id)).toBeUndefined();
    });

    it('validates text, colour, the per-lesson limit and draft lessons', async () => {
      expect((await addNote(child.id, maths, { content: '   ' })).body.code).toBe('note_empty');
      expect((await addNote(child.id, maths, { content: 'x'.repeat(2001) })).body.code).toBe('note_too_long');
      expect((await addNote(child.id, maths, { content: 'x'.repeat(2000), color: 'javascript:' })).body.color).toBe('#fef08a');

      for (let i = 1; i < 30; i++) expect((await addNote(child.id, maths, { content: `n${i}` })).status).toBe(201);
      const overLimit = await addNote(child.id, maths, { content: 'one more' });
      expect(overLimit.status).toBe(400);
      expect(overLimit.body.code).toBe('note_limit');
      expect((await addNote(child.id, norsk, { content: 'other lesson' })).status).toBe(201);

      const draft = lessonIdFor('engelsk');
      expect((await addNote(child.id, draft, { content: 'draft' })).status).toBe(404);
    });

    it('shows lesson notes on /notes with Learn context and a link only to reviewed lessons', async () => {
      await addNote(child.id, maths, { content: 'Lesson note' });
      testDb.prepare("INSERT INTO notes (profile_id, title, content) VALUES (?, 'Plain', 'x')").run(child.id);

      const list = await request(app).get(`/notes/${child.id}`).set(authHeaders(child.id));
      expect(list.status).toBe(200);
      const lessonNote = list.body.find((note: any) => note.learn_lesson_id === maths);
      expect(lessonNote).toMatchObject({ learn_subject_slug: 'matematikk', learn_lesson_visible: true });
      expect(lessonNote.learn_lesson_title).toBeTruthy();
      expect(list.body.find((note: any) => note.title === 'Plain').learn_lesson_visible).toBe(false);

      testDb.prepare("UPDATE learn_lessons SET review_status = 'retired' WHERE id = ?").run(maths);
      const after = await request(app).get(`/notes/${child.id}`).set(authHeaders(child.id));
      expect(after.body.find((note: any) => note.learn_lesson_id === maths).learn_lesson_visible).toBe(false);
    });

    it('never lets another child change a lesson note', async () => {
      const note = (await addNote(child.id, maths, { content: 'Mine' })).body;
      expect((await request(app).put(`/learn/lesson-notes/${note.id}`).set(authHeaders(sibling.id)).send({ content: 'x' })).status).toBe(404);
      expect((await request(app).delete(`/learn/lesson-notes/${note.id}`).set(authHeaders(sibling.id))).status).toBe(404);
      expect((await request(app).put(`/learn/lesson-notes/${note.id}`).set(authHeaders(parent.id)).send({ content: 'x' })).status).toBe(404);
      expect((testDb.prepare('SELECT content FROM notes WHERE id = ?').get(note.id) as any).content).toBe('Mine');
    });

    it('withholds and freezes lesson notes while the child has a test running', async () => {
      const note = (await addNote(child.id, maths, { content: 'Answer hint', color: '#bbf7d0' })).body;
      testDb.prepare("UPDATE notes SET reminder_at = '2999-01-01', tags = ? WHERE id = ?").run(JSON.stringify(['hint']), note.id);
      testDb.prepare("INSERT INTO notes (profile_id, title, content) VALUES (?, 'Plain', 'x')").run(child.id);
      startTest(child.id);
      const headers = authHeaders(child.id);

      const lesson = await request(app).get(`/learn/lessons/${maths}`).set(headers);
      expect(lesson.body.notes).toEqual({ locked: true, mine: [], from_parents: [], limit: 30 });
      expect((await addNote(child.id, maths, { content: 'new' })).status).toBe(423);
      expect((await request(app).put(`/learn/lesson-notes/${note.id}`).set(headers).send({ content: 'x' })).status).toBe(423);
      expect((await request(app).delete(`/learn/lesson-notes/${note.id}`).set(headers)).status).toBe(423);

      const list = await request(app).get(`/notes/${child.id}`).set(headers);
      expect(list.body.map((row: any) => row.title)).toEqual(['Plain']);
      expect((await request(app).get(`/notes/note/${note.id}`).set(headers)).status).toBe(404);
      expect((await request(app).get(`/notes/${child.id}/reminders`).set(headers)).body).toEqual([]);
      expect((await request(app).get(`/notes/${child.id}/tags`).set(headers)).body).toEqual([]);
      expect((await request(app).put(`/notes/${note.id}`).set(headers).send({ content: 'x' })).status).toBe(423);
      expect((await request(app).delete(`/notes/${note.id}`).set(headers)).status).toBe(423);
      expect((testDb.prepare('SELECT content FROM notes WHERE id = ?').get(note.id) as any).content).toBe('Answer hint');

      // The parent is not the one sitting the test
      expect((await request(app).get(`/notes/${child.id}`).set(authHeaders(parent.id))).body).toHaveLength(2);

      testDb.prepare('UPDATE learn_mock_attempts SET submitted_at = ? WHERE profile_id = ?').run(new Date().toISOString(), child.id);
      expect((await request(app).get(`/learn/lessons/${maths}`).set(headers)).body.notes.mine).toHaveLength(1);
    });
  });

  describe('parent assignment notes appear as sticky notes (US2)', () => {
    const assign = (body: Record<string, unknown>) =>
      request(app).post('/learn/assignments').set(authHeaders(parent.id))
        .send({ child_id: child.id, idempotency_key: `k-${Math.random()}`, ...body });

    it('shows lesson and topic assignment notes on the lessons they cover, until cancelled', async () => {
      const lessonAssignment = await assign({ lesson_id: maths, note: 'Les dette før fredag!' });
      expect(lessonAssignment.status).toBe(201);
      await assign({ topic_id: topicIdOf(norsk), note: 'Ta hele temaet' });
      await assign({ lesson_id: norsk, note: '   ' });

      const mathsLesson = await request(app).get(`/learn/lessons/${maths}`).set(authHeaders(child.id));
      expect(mathsLesson.body.notes.from_parents).toEqual([
        expect.objectContaining({ assignment_id: lessonAssignment.body.id, note: 'Les dette før fredag!', from_name: 'Mamma', target_kind: 'lesson', lesson_id: maths })
      ]);
      const norskLesson = await request(app).get(`/learn/lessons/${norsk}`).set(authHeaders(child.id));
      expect(norskLesson.body.notes.from_parents.map((note: any) => note.note)).toEqual(['Ta hele temaet']);

      const forNotesPage = await request(app).get('/learn/me/assignment-notes').set(authHeaders(child.id));
      expect(forNotesPage.body.locked).toBe(false);
      expect(forNotesPage.body.notes).toHaveLength(2);
      // Siblings see only their own
      expect((await request(app).get('/learn/me/assignment-notes').set(authHeaders(sibling.id))).body.notes).toEqual([]);

      expect((await request(app).patch(`/learn/assignments/${lessonAssignment.body.id}`).set(authHeaders(parent.id)).send({ state: 'cancelled' })).status).toBe(200);
      expect((await request(app).get(`/learn/lessons/${maths}`).set(authHeaders(child.id))).body.notes.from_parents).toEqual([]);
      expect((await request(app).get('/learn/me/assignment-notes').set(authHeaders(child.id))).body.notes).toHaveLength(1);
    });

    it('hides parent notes during a test', async () => {
      await assign({ lesson_id: maths, note: 'Hint' });
      startTest(child.id);
      expect((await request(app).get('/learn/me/assignment-notes').set(authHeaders(child.id))).body).toEqual({ locked: true, notes: [] });
      expect((await request(app).get(`/learn/lessons/${maths}`).set(authHeaders(child.id))).body.notes.from_parents).toEqual([]);
    });
  });

  describe('a parent reads a child\'s lesson notes (US3)', () => {
    it('groups by subject and lesson for the managing parent and audits admins', async () => {
      await addNote(child.id, maths, { content: 'first' });
      await addNote(child.id, maths, { content: 'second' });
      await addNote(child.id, norsk, { content: 'norsk' });
      testDb.prepare("INSERT INTO notes (profile_id, title, content) VALUES (?, 'Diary', 'private')").run(child.id);

      const view = await request(app).get(`/learn/children/${child.id}/notes`).set(authHeaders(parent.id));
      expect(view.status).toBe(200);
      expect(view.body.child).toEqual({ id: child.id, name: 'Emma' });
      expect(view.body.subjects.map((subject: any) => subject.subject_slug)).toEqual(['matematikk', 'norsk']);
      expect(view.body.subjects[0].lessons[0]).toMatchObject({ lesson_id: maths, lesson_visible: true });
      expect(view.body.subjects[0].lessons[0].notes.map((note: any) => note.content).sort()).toEqual(['first', 'second']);
      expect(JSON.stringify(view.body)).not.toContain('private');

      for (const viewer of [stranger, child, sibling]) {
        expect((await request(app).get(`/learn/children/${child.id}/notes`).set(authHeaders(viewer.id))).status).toBe(403);
      }

      expect((await request(app).get(`/learn/children/${child.id}/notes`).set(authHeaders(admin.id))).status).toBe(200);
      expect(testDb.prepare("SELECT 1 FROM audit_logs WHERE action = 'learn.admin_viewed_child_notes' AND entity_id = ?").get(child.id)).toBeTruthy();
    });

    it('returns an empty list when the child has no lesson notes', async () => {
      const view = await request(app).get(`/learn/children/${child.id}/notes`).set(authHeaders(parent.id));
      expect(view.body.subjects).toEqual([]);
    });
  });
});
