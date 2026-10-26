import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { testDb } from './setup.js';
import { authHeaders, createLearnEngineTables, createTestProfile, createTestProgress } from './helpers.js';
import { ensureLearnSchema } from '../services/learn/schema.js';
import { seedLearnCatalog } from '../services/learn/catalog.js';

vi.mock('../services/h5pService', async () => {
  const path = await import('node:path');
  const os = await import('node:os');
  const fs = await import('node:fs');
  const data = path.join(os.tmpdir(), `familyhub-pr13-auth-${process.pid}`);
  fs.mkdirSync(data, { recursive: true });
  return {
    H5P_PATHS: Object.fromEntries(['data', 'libraries', 'content', 'temp', 'core', 'editor', 'downloads', 'cardImages'].map(key => [key, path.join(data, key)])),
    initializeH5P: vi.fn(async () => {}),
    createH5PUser: vi.fn((id: number, name: string) => ({ id: String(id), name })),
    getH5PPlayer: vi.fn(() => ({ render: vi.fn(async () => ({ scripts: [], styles: [], integration: {} })) })),
    getInstalledContentTypes: vi.fn(async () => [])
  };
});

let app: express.Express;
afterAll(() => rmSync(path.join(tmpdir(), `familyhub-pr13-auth-${process.pid}`), { recursive: true, force: true }));
beforeAll(async () => {
  createLearnEngineTables();
  ensureLearnSchema();
  testDb.exec(`
    CREATE TABLE h5p_content (id INTEGER PRIMARY KEY, h5p_content_id TEXT, title TEXT, content_type TEXT, library_name TEXT, created_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE h5p_assignments (id INTEGER PRIMARY KEY, h5p_content_id INTEGER, assigned_to INTEGER, assigned_by INTEGER, points INTEGER DEFAULT 10, due_date TEXT, is_required INTEGER DEFAULT 0, max_attempts INTEGER DEFAULT 0, pass_percentage INTEGER DEFAULT 70, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE h5p_attempts (id INTEGER PRIMARY KEY, assignment_id INTEGER, profile_id INTEGER, h5p_content_id INTEGER, score REAL, max_score REAL, score_percentage REAL, passed INTEGER DEFAULT 0, started_at TEXT DEFAULT CURRENT_TIMESTAMP, completed_at TEXT, xapi_data TEXT);
    CREATE TABLE h5p_xapi_logs (id INTEGER PRIMARY KEY, attempt_id INTEGER, profile_id INTEGER, h5p_content_id INTEGER, verb TEXT, object_id TEXT, object_type TEXT, result_score REAL, result_max_score REAL, result_success INTEGER, result_completion INTEGER, result_duration TEXT, context_data TEXT);
  `);
  const [{ default: learn }, { default: activities }, { default: h5p }] = await Promise.all([
    import('../routes/learn.js'), import('../routes/activities.js'), import('../routes/h5p.js')
  ]);
  app = express();
  app.use(express.json());
  app.use('/learn', learn); app.use('/activities', activities); app.use('/h5p', h5p);
});
beforeEach(() => {
  for (const table of ['learn_review_attempts', 'learn_mock_attempts', 'learn_assignments', 'learn_progress', 'learn_resource_links', 'learn_lessons', 'learn_mock_exams', 'learn_topic_goals', 'learn_topics', 'learn_goals', 'learn_subjects', 'session_attempts', 'activity_results', 'learning_activities', 'learning_sessions', 'audit_logs', 'ai_settings', 'h5p_xapi_logs', 'h5p_attempts', 'h5p_assignments', 'h5p_content']) {
    testDb.exec(`DELETE FROM ${table}`);
  }
  seedLearnCatalog();
});

function family() {
  const parent = createTestProfile({ name: 'Guardian', type: 'parent' });
  const child = createTestProfile({ name: 'Learner', type: 'child', parent_id: parent.id, age: 13 });
  const stranger = createTestProfile({ name: 'Other learner', type: 'child', age: 13 });
  createTestProgress(child.id);
  testDb.prepare("INSERT INTO family_features (parent_id,feature_key,enabled) VALUES (?,'learn',1)").run(parent.id);
  return { parent, child, stranger };
}
function feature(profile: number, key: string, enabled: boolean) {
  testDb.prepare('INSERT OR REPLACE INTO profile_features (profile_id,feature_key,enabled) VALUES (?,?,?)').run(profile, key, Number(enabled));
}
function setting(key: string, value: string) {
  testDb.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run(key, value);
}
async function prepare(childId: number) {
  const lesson = testDb.prepare('SELECT id, topic_id FROM learn_lessons ORDER BY id LIMIT 1').get() as { id: number; topic_id: number };
  testDb.prepare("UPDATE learn_lessons SET review_status = 'reviewed' WHERE id = ?").run(lesson.id);
  const result = await request(app).post(`/learn/lessons/${lesson.id}/practice`).set(authHeaders(childId));
  expect(result.status).toBe(200);
  return { lesson, id: result.body.session_id as number };
}

describe('Learn-linked practice authorization', () => {
  it('replays only a stored Learn answer with unchanged score/hints and all live access guards', async () => {
    const { child, stranger } = family();
    const { id, lesson } = await prepare(child.id);
    const activity = testDb.prepare('SELECT * FROM learning_activities WHERE session_id = ? ORDER BY order_index LIMIT 1').get(id) as any;
    const key = JSON.parse(activity.correct_data);
    const originalAnswer = { answer: key.correctAnswer };
    const started = await request(app).post(`/activities/sessions/${id}/start`).set(authHeaders(child.id));
    const attemptId = started.body.attemptId;
    const first = await request(app).post(`/activities/attempts/${attemptId}/submit`).set(authHeaders(child.id))
      .send({ activityId: activity.id, userResponse: originalAnswer, hintsUsed: 1 });
    expect(first.status).toBe(200);
    const snapshot = () => ({
      attempt: testDb.prepare('SELECT * FROM session_attempts WHERE id = ?').get(attemptId),
      results: testDb.prepare('SELECT * FROM activity_results WHERE attempt_id = ?').all(attemptId),
      progress: testDb.prepare('SELECT * FROM progress WHERE profile_id = ?').get(child.id)
    });
    const before = snapshot();
    const resumed = await request(app).post(`/activities/sessions/${id}/start`).set(authHeaders(child.id));
    expect(resumed.body).toMatchObject({ attemptId, resumed: true });
    const url = `/activities/attempts/${attemptId}/submit`;
    const duplicate = { activityId: activity.id, userResponse: { answer: 'forged-replacement' }, hintsUsed: 0, timeTakenSeconds: 0 };
    const replay = await request(app).post(url).set(authHeaders(child.id)).send(duplicate);
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ replayed: true, userResponse: originalAnswer, hintsUsed: 1, score: 18, maxScore: 20, isCorrect: true, partialScore: 1, correctData: key });
    expect(snapshot()).toEqual(before);
    expect((await request(app).post(url).set(authHeaders(stranger.id)).send(duplicate)).status).toBe(403);
    setting('learn_enabled', 'false');
    expect((await request(app).post(url).set(authHeaders(child.id)).send(duplicate)).body.code).toBe('learn_disabled');
    setting('learn_enabled', 'true');
    const exam = testDb.prepare('SELECT id FROM learn_mock_exams WHERE topic_id = ?').get(lesson.topic_id) as { id: number };
    testDb.prepare('INSERT INTO learn_mock_attempts (exam_id,profile_id,rubric_version,started_at,expires_at) VALUES (?,?,1,?,?)')
      .run(exam.id, child.id, new Date().toISOString(), new Date(Date.now() + 60000).toISOString());
    expect((await request(app).post(url).set(authHeaders(child.id)).send(duplicate)).status).toBe(423);
    expect(snapshot()).toEqual(before);
    testDb.prepare('UPDATE learn_mock_attempts SET submitted_at = ? WHERE profile_id = ?').run(new Date().toISOString(), child.id);
    expect((await request(app).post(`/activities/attempts/${attemptId}/complete`).set(authHeaders(child.id))).status).toBe(200);
    const completedReplay = await request(app).post(url).set(authHeaders(child.id)).send(duplicate);
    expect(completedReplay.status).toBe(400);
    expect(completedReplay.body).not.toHaveProperty('correctData');
  });

  it.each([true, false])('honors global rollback on every linked play route with activities=%s', async (activities) => {
    const { child } = family();
    const { id } = await prepare(child.id);
    const start = await request(app).post(`/activities/sessions/${id}/start`).set(authHeaders(child.id));
    expect(start.status).toBe(201);
    feature(child.id, 'activities', activities);
    setting('learn_enabled', 'false');
    const before = testDb.prepare('SELECT * FROM session_attempts WHERE id = ?').get(start.body.attemptId);
    for (const [method, url] of [['get', `/activities/sessions/${id}`], ['post', `/activities/sessions/${id}/start`], ['post', `/activities/attempts/${start.body.attemptId}/submit`], ['post', `/activities/attempts/${start.body.attemptId}/complete`]] as const) {
      const denied = await request(app)[method](url).set(authHeaders(child.id)).send({ userResponse: {} });
      expect(denied.status).toBe(403);
      expect(denied.body.code).toBe('learn_disabled');
    }
    expect(testDb.prepare('SELECT * FROM session_attempts WHERE id = ?').get(start.body.attemptId)).toEqual(before);
    // The global Learn switch does not disable an independently enabled ordinary activity.
    testDb.prepare('DELETE FROM learn_resource_links WHERE existing_resource_id = ?').run(id);
    expect((await request(app).get(`/activities/sessions/${id}`).set(authHeaders(child.id))).status).toBe(activities ? 200 : 403);
  });

  it.each(['draft', 'retired'])('does not fall back to ordinary activity access for a linked %s lesson', async (status) => {
    const { child } = family();
    const { id, lesson } = await prepare(child.id);
    feature(child.id, 'activities', true);
    const start = await request(app).post(`/activities/sessions/${id}/start`).set(authHeaders(child.id));
    expect(start.status).toBe(201);
    testDb.prepare('UPDATE learn_lessons SET review_status = ? WHERE id = ?').run(status, lesson.id);
    const before = testDb.prepare('SELECT * FROM session_attempts WHERE id = ?').get(start.body.attemptId);
    for (const [method, url] of [['get', `/activities/sessions/${id}`], ['post', `/activities/sessions/${id}/start`], ['post', `/activities/attempts/${start.body.attemptId}/submit`], ['post', `/activities/attempts/${start.body.attemptId}/complete`]] as const) {
      expect((await request(app)[method](url).set(authHeaders(child.id)).send({ userResponse: {} })).status).toBe(404);
    }
    expect(testDb.prepare('SELECT * FROM session_attempts WHERE id = ?').get(start.body.attemptId)).toEqual(before);
    expect(testDb.prepare('SELECT COUNT(*) AS n FROM activity_results').get()).toEqual({ n: 0 });
  });

  it('delivers safe questions before answering, returns authorized feedback, and preserves guardian authoring fields', async () => {
    const { child, parent, stranger } = family();
    const { id } = await prepare(child.id);
    const delivered = await request(app).get(`/activities/sessions/${id}`).set(authHeaders(child.id));
    expect(delivered.status).toBe(200);
    for (const item of delivered.body.activities) {
      expect(item).not.toHaveProperty('correct_data');
      expect(item).not.toHaveProperty('explanation');
      expect(item.content_data).toBeTruthy();
      expect(item.hints).toBeInstanceOf(Array);
    }
    const parentView = await request(app).get(`/activities/sessions/${id}`).set(authHeaders(parent.id));
    expect(parentView.status).toBe(200);
    expect(parentView.body.activities[0]).toHaveProperty('correct_data');
    expect(parentView.body.activities[0]).toHaveProperty('explanation');
    expect((await request(app).get(`/activities/sessions/${id}`).set(authHeaders(stranger.id))).status).toBe(403);
    const start = await request(app).post(`/activities/sessions/${id}/start`).set(authHeaders(child.id));
    expect(start.status).toBe(201);
    for (const item of parentView.body.activities) {
      const key = item.correct_data;
      const answer = key.correctAnswer ? { answer: key.correctAnswer } : { answers: key.blanks.map((blank: any) => blank.answer) };
      const submitted = await request(app).post(`/activities/attempts/${start.body.attemptId}/submit`).set(authHeaders(child.id))
        .send({ activityId: item.id, userResponse: answer });
      expect(submitted.status).toBe(200);
      expect(submitted.body).toMatchObject({ isCorrect: true, explanation: item.explanation, correctData: key });
    }
    // Subsequent GET remains safe: submission feedback is scoped to its own answer.
    expect(JSON.stringify((await request(app).get(`/activities/sessions/${id}`).set(authHeaders(child.id))).body)).not.toContain('correct_data');
    const retry = await request(app).post(`/activities/sessions/${id}/start`).set(authHeaders(child.id));
    // Start resumes an unfinished attempt, so finish it before a new retry.
    expect((await request(app).post(`/activities/attempts/${retry.body.attemptId}/complete`).set(authHeaders(child.id))).status).toBe(200);
    const wrongRun = await request(app).post(`/activities/sessions/${id}/start`).set(authHeaders(child.id));
    for (const item of parentView.body.activities) {
      const key = item.correct_data;
      const wrong = key.correctAnswer
        ? { answer: item.content_data.options.find((option: any) => option.id !== key.correctAnswer).id }
        : { answers: key.blanks.map(() => 'wrong') };
      const submitted = await request(app).post(`/activities/attempts/${wrongRun.body.attemptId}/submit`).set(authHeaders(child.id))
        .send({ activityId: item.id, userResponse: wrong });
      expect(submitted.status).toBe(200);
      expect(submitted.body).toMatchObject({ isCorrect: false, correctData: key, explanation: item.explanation });
    }
  });

  it('supports only the assigned learner practice journey in default school mode, retaining ownership and assessment locks', async () => {
    const { child, stranger } = family();
    setting('school_only_mode', 'true');
    feature(child.id, 'activities', false);
    const { id, lesson } = await prepare(child.id);
    const delivered = await request(app).get(`/activities/sessions/${id}`).set(authHeaders(child.id));
    expect(delivered.status).toBe(200);
    expect((await request(app).get('/activities/types').set(authHeaders(child.id))).status).toBe(403);
    expect((await request(app).put(`/activities/sessions/${id}`).set(authHeaders(child.id)).send({ title: 'Tampered' })).status).toBe(403);
    expect((await request(app).post('/activities/sessions').set(authHeaders(child.id)).send({ title: 'Unrelated' })).status).toBe(403);
    expect((await request(app).get(`/activities/sessions/${id}`).set(authHeaders(stranger.id))).status).toBe(403);
    const start = await request(app).post(`/activities/sessions/${id}/start`).set(authHeaders(child.id));
    expect(start.status).toBe(201);
    const questions = testDb.prepare('SELECT * FROM learning_activities WHERE session_id = ? ORDER BY order_index').all(id) as any[];
    const exam = testDb.prepare('SELECT id FROM learn_mock_exams WHERE topic_id = ?').get(lesson.topic_id) as { id: number };
    testDb.prepare('INSERT INTO learn_mock_attempts (exam_id,profile_id,rubric_version,started_at,expires_at) VALUES (?,?,1,?,?)')
      .run(exam.id, child.id, new Date().toISOString(), new Date(Date.now() + 60000).toISOString());
    for (const [method, url] of [['get', `/activities/sessions/${id}`], ['post', `/activities/sessions/${id}/start`], ['post', `/activities/attempts/${start.body.attemptId}/submit`], ['post', `/activities/attempts/${start.body.attemptId}/complete`]] as const) {
      expect((await request(app)[method](url).set(authHeaders(child.id)).send({ activityId: questions[0].id, userResponse: {} })).status).toBe(423);
    }
    testDb.prepare('UPDATE learn_mock_attempts SET submitted_at = ? WHERE profile_id = ?').run(new Date().toISOString(), child.id);
    feature(child.id, 'learn', false);
    expect((await request(app).get(`/activities/sessions/${id}`).set(authHeaders(child.id))).status).toBe(403);
    feature(child.id, 'learn', true);
    setting('school_only_allowed_features', '["school"]');
    expect((await request(app).get(`/activities/sessions/${id}`).set(authHeaders(child.id))).status).toBe(403);
    setting('school_only_allowed_features', '["school","learn"]');
    for (const question of questions) {
      const key = JSON.parse(question.correct_data);
      const answer = key.correctAnswer ? { answer: key.correctAnswer } : { answers: key.blanks.map((blank: any) => blank.answer) };
      expect((await request(app).post(`/activities/attempts/${start.body.attemptId}/submit`).set(authHeaders(child.id))
        .send({ activityId: question.id, userResponse: answer })).status).toBe(200);
    }
    expect((await request(app).post(`/activities/attempts/${start.body.attemptId}/complete`).set(authHeaders(child.id))).body.passed).toBe(true);
    testDb.prepare('DELETE FROM learn_resource_links WHERE existing_resource_id = ?').run(id);
    expect((await request(app).get(`/activities/sessions/${id}`).set(authHeaders(child.id))).status).toBe(403);
  });
});

describe('consolidated H5P quiz authorization', () => {
  it.each([[true, false], [false, true], [false, false]] as const)('quizzes=%s activities=%s respects effective features, ownership and upload roles', async (quizzes, activities) => {
    const { parent, child, stranger } = family();
    feature(child.id, 'quizzes', quizzes); feature(child.id, 'activities', activities);
    testDb.prepare("INSERT INTO h5p_content (id,h5p_content_id,title,content_type,library_name,created_by) VALUES (1,'test','Test','QuestionSet','H5P.QuestionSet',?)").run(parent.id);
    testDb.prepare('INSERT INTO h5p_assignments (id,h5p_content_id,assigned_to,assigned_by) VALUES (1,1,?,?)').run(child.id, parent.id);
    const allowed = quizzes || activities;
    expect((await request(app).get('/h5p/content').set(authHeaders(child.id))).status).toBe(allowed ? 200 : 403);
    expect((await request(app).get('/h5p/content/1').set(authHeaders(child.id))).status).toBe(allowed ? 200 : 403);
    const play = await request(app).get('/h5p/play/1').set(authHeaders(child.id));
    expect(play.status).toBe(allowed ? 200 : 403);
    if (allowed) {
      const completed = await request(app).post('/h5p/xapi').set(authHeaders(child.id))
        .send({ attemptId: play.body.attemptId, verb: 'completed', result: { score: { raw: 1, max: 1 } } });
      expect(completed.status).toBe(200);
      expect(completed.body.passed).toBe(true);
      expect((await request(app).post('/h5p/xapi').set(authHeaders(stranger.id)).send({ attemptId: play.body.attemptId, verb: 'completed' })).status).toBe(404);
    }
    expect((await request(app).get('/h5p/play/1').set(authHeaders(stranger.id))).status).toBe(403);
    expect((await request(app).post('/h5p/content/import').set(authHeaders(child.id)).attach('file', Buffer.from('test'), 'test.h5p')).status).toBe(403);
    setting('school_only_mode', 'true');
    expect((await request(app).get('/h5p/content').set(authHeaders(child.id))).status).toBe(403);
    setting('school_only_allowed_features', '["school","quizzes"]');
    expect((await request(app).get('/h5p/content').set(authHeaders(child.id))).status).toBe(quizzes ? 200 : 403);
    testDb.prepare("INSERT INTO family_features (parent_id,feature_key,enabled) VALUES (?,'quizzes',0)").run(parent.id);
    expect((await request(app).get('/h5p/content').set(authHeaders(child.id))).status).toBe(403);
  });
});
