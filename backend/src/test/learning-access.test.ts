import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { testDb } from './setup.js';
import { createTestProfile, createTestProgress, authHeaders } from './helpers.js';

/**
 * Negative authorization tests for the existing learning engines that
 * FamilyHub Learn reuses (family quizzes, activity sessions, H5P).
 */

function createLearningTables() {
  // Replace the simplified setup tables with the production column set used by the routes
  testDb.exec('DROP TABLE IF EXISTS family_quiz_attempts');
  testDb.exec('DROP TABLE IF EXISTS family_quizzes');
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS quiz_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      icon TEXT NOT NULL,
      description TEXT,
      theme_config TEXT NOT NULL,
      input_config TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE family_quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category_id INTEGER NOT NULL,
      created_by INTEGER NOT NULL,
      assigned_to INTEGER NOT NULL,
      points_per_correct INTEGER DEFAULT 10,
      stars_per_correct INTEGER DEFAULT 0,
      bonus_points INTEGER DEFAULT 20,
      time_limit_seconds INTEGER,
      pass_threshold INTEGER DEFAULT 70,
      difficulty TEXT DEFAULT 'medium',
      questions TEXT,
      attempts_allowed INTEGER DEFAULT 3,
      passing_score INTEGER DEFAULT 70,
      is_ai_generated INTEGER DEFAULT 0,
      ai_focus_areas TEXT,
      schedule_type TEXT DEFAULT 'anytime',
      schedule_days TEXT,
      is_active INTEGER DEFAULT 1,
      is_competition INTEGER DEFAULT 0,
      competition_ends_at DATETIME,
      first_place_bonus INTEGER DEFAULT 50,
      second_place_bonus INTEGER DEFAULT 25,
      third_place_bonus INTEGER DEFAULT 10,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS family_quiz_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      question_type TEXT DEFAULT 'multiple_choice',
      question_image TEXT,
      question_audio TEXT,
      options TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      hint TEXT,
      explanation TEXT,
      points INTEGER DEFAULT 10,
      order_index INTEGER DEFAULT 0
    );
    CREATE TABLE family_quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      profile_id INTEGER NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      total_questions INTEGER NOT NULL,
      correct_answers INTEGER DEFAULT 0,
      wrong_answers INTEGER DEFAULT 0,
      score_percentage INTEGER DEFAULT 0,
      points_earned INTEGER DEFAULT 0,
      stars_earned INTEGER DEFAULT 0,
      time_bonus_points INTEGER DEFAULT 0,
      time_taken_seconds INTEGER,
      passed INTEGER DEFAULT 0,
      competition_rank INTEGER,
      bonus_awarded INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS family_quiz_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      selected_answer TEXT,
      is_correct INTEGER DEFAULT 0,
      time_taken_seconds INTEGER,
      answered_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS activity_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      icon TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS learning_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      topic TEXT NOT NULL,
      age_range TEXT,
      created_by INTEGER NOT NULL,
      assigned_to INTEGER NOT NULL,
      points_per_activity INTEGER DEFAULT 20,
      stars_per_session INTEGER DEFAULT 1,
      bonus_points INTEGER DEFAULT 50,
      time_limit_seconds INTEGER,
      pass_threshold INTEGER DEFAULT 70,
      is_active INTEGER DEFAULT 1,
      is_competition INTEGER DEFAULT 0,
      competition_ends_at DATETIME,
      first_place_bonus INTEGER DEFAULT 50,
      second_place_bonus INTEGER DEFAULT 25,
      third_place_bonus INTEGER DEFAULT 10,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS learning_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      activity_type_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      instructions TEXT,
      content_data TEXT NOT NULL,
      correct_data TEXT NOT NULL,
      hints TEXT,
      explanation TEXT,
      points INTEGER DEFAULT 20,
      order_index INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS session_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      profile_id INTEGER NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      total_activities INTEGER NOT NULL,
      completed_activities INTEGER DEFAULT 0,
      total_score INTEGER DEFAULT 0,
      max_possible_score INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS h5p_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      h5p_content_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      content_type TEXT NOT NULL,
      library_name TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS h5p_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      h5p_content_id INTEGER NOT NULL,
      assigned_to INTEGER NOT NULL,
      assigned_by INTEGER NOT NULL,
      points INTEGER DEFAULT 10,
      due_date DATETIME,
      is_required INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 0,
      pass_percentage INTEGER DEFAULT 70,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(h5p_content_id, assigned_to)
    );
    CREATE TABLE IF NOT EXISTS h5p_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER,
      profile_id INTEGER NOT NULL,
      h5p_content_id INTEGER NOT NULL,
      score REAL, max_score REAL, score_percentage REAL,
      passed INTEGER DEFAULT 0,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      xapi_data TEXT
    );
    CREATE TABLE IF NOT EXISTS h5p_xapi_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER, profile_id INTEGER, h5p_content_id INTEGER, verb TEXT,
      object_id TEXT, object_type TEXT, result_score REAL, result_max_score REAL,
      result_success INTEGER, result_completion INTEGER, result_duration TEXT, context_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function clearLearningTables() {
  for (const table of [
    'family_quiz_answers', 'family_quiz_questions', 'quiz_categories',
    'learning_activities', 'session_attempts', 'learning_sessions', 'activity_types',
    'h5p_xapi_logs', 'h5p_attempts', 'h5p_assignments', 'h5p_content'
  ]) {
    testDb.exec(`DELETE FROM ${table}`);
  }
}

async function createApp() {
  const [{ default: quizRoutes }, { default: activityRoutes }, { default: h5pRoutes }] = await Promise.all([
    import('../routes/family-quizzes.js'),
    import('../routes/activities.js'),
    import('../routes/h5p.js')
  ]);
  const app = express();
  app.use(express.json());
  app.use('/family-quizzes', quizRoutes);
  app.use('/activities', activityRoutes);
  app.use('/h5p', h5pRoutes);
  return app;
}

function createFamilies() {
  const parentA = createTestProfile({ name: 'Parent A', type: 'parent' });
  const childA = createTestProfile({ name: 'Child A', type: 'child', parent_id: parentA.id });
  const parentB = createTestProfile({ name: 'Parent B', type: 'parent' });
  const childB = createTestProfile({ name: 'Child B', type: 'child', parent_id: parentB.id });
  return { parentA, childA, parentB, childB };
}

function createQuiz(createdBy: number, assignedTo: number) {
  const category = testDb.prepare(`
    INSERT INTO quiz_categories (name, display_name, icon, theme_config) VALUES (?, 'Math', '🔢', '{}')
  `).run(`math-${Date.now()}-${Math.random()}`);
  const quiz = testDb.prepare(`
    INSERT INTO family_quizzes (title, category_id, created_by, assigned_to, pass_threshold)
    VALUES ('Fractions', ?, ?, ?, 50)
  `).run(category.lastInsertRowid, createdBy, assignedTo);
  const question = testDb.prepare(`
    INSERT INTO family_quiz_questions (quiz_id, question_text, options, correct_answer)
    VALUES (?, '1/2 + 1/2?', '["1","2"]', '1')
  `).run(quiz.lastInsertRowid);
  return { quizId: Number(quiz.lastInsertRowid), questionId: Number(question.lastInsertRowid), categoryId: Number(category.lastInsertRowid) };
}

describe('learning engine object-level authorization', () => {
  beforeAll(() => {
    createLearningTables();
  });

  afterEach(() => {
    clearLearningTables();
  });

  describe('family quizzes', () => {
    it('only the owning family can read or delete a quiz (with answer key)', async () => {
      const app = await createApp();
      const { parentA, childA, parentB, childB } = createFamilies();
      const { quizId } = createQuiz(parentA.id, childA.id);

      expect((await request(app).get(`/family-quizzes/${quizId}`).set(authHeaders(parentA.id))).status).toBe(200);
      expect((await request(app).get(`/family-quizzes/${quizId}`).set(authHeaders(parentB.id))).status).toBe(403);
      // The assigned child may not read the editor view (it contains correct answers)
      expect((await request(app).get(`/family-quizzes/${quizId}`).set(authHeaders(childA.id))).status).toBe(403);
      expect((await request(app).get(`/family-quizzes/${quizId}`).set(authHeaders(childB.id))).status).toBe(403);

      expect((await request(app).delete(`/family-quizzes/${quizId}`).set(authHeaders(parentB.id))).status).toBe(403);
      expect(testDb.prepare('SELECT id FROM family_quizzes WHERE id = ?').get(quizId)).toBeTruthy();
    });

    it('rejects creating quizzes as another parent or for another family\'s child', async () => {
      const app = await createApp();
      const { parentA, childA, parentB, childB } = createFamilies();
      const { categoryId } = createQuiz(parentA.id, childA.id);

      const forOtherChild = await request(app)
        .post('/family-quizzes')
        .set(authHeaders(parentB.id))
        .send({ title: 'x', categoryId, createdBy: parentB.id, assignedTo: childA.id });
      expect(forOtherChild.status).toBe(403);

      const asOtherParent = await request(app)
        .post('/family-quizzes')
        .set(authHeaders(parentB.id))
        .send({ title: 'x', categoryId, createdBy: parentA.id, assignedTo: childB.id });
      expect(asOtherParent.status).toBe(403);

      const valid = await request(app)
        .post('/family-quizzes')
        .set(authHeaders(parentB.id))
        .send({ title: 'x', categoryId, createdBy: parentB.id, assignedTo: childB.id });
      expect(valid.status).toBe(200);
    });

    it('scopes child quiz lists and attempt history to the family', async () => {
      const app = await createApp();
      const { parentA, childA, parentB, childB } = createFamilies();
      createQuiz(parentA.id, childA.id);

      expect((await request(app).get(`/family-quizzes/child/${childA.id}`).set(authHeaders(childA.id))).status).toBe(200);
      expect((await request(app).get(`/family-quizzes/child/${childA.id}`).set(authHeaders(parentA.id))).status).toBe(200);
      expect((await request(app).get(`/family-quizzes/child/${childA.id}`).set(authHeaders(childB.id))).status).toBe(403);
      expect((await request(app).get(`/family-quizzes/child/${childA.id}`).set(authHeaders(parentB.id))).status).toBe(403);
      expect((await request(app).get(`/family-quizzes/attempts/profile/${childA.id}`).set(authHeaders(parentB.id))).status).toBe(403);
      expect((await request(app).get(`/family-quizzes/parent/${parentA.id}`).set(authHeaders(parentB.id))).status).toBe(403);
      expect((await request(app).get(`/family-quizzes/stats/parent/${parentA.id}`).set(authHeaders(childA.id))).status).toBe(403);
    });

    it('a learner cannot start, answer or complete another learner\'s quiz', async () => {
      const app = await createApp();
      const { parentA, childA, childB } = createFamilies();
      const { quizId, questionId } = createQuiz(parentA.id, childA.id);

      expect((await request(app).post(`/family-quizzes/${quizId}/start`).set(authHeaders(childB.id)).send({})).status).toBe(403);
      // A child cannot start an attempt on behalf of a sibling/other profile
      const spoofed = await request(app).post(`/family-quizzes/${quizId}/start`).set(authHeaders(childA.id)).send({ profileId: childB.id });
      expect(spoofed.status).toBe(403);

      const start = await request(app).post(`/family-quizzes/${quizId}/start`).set(authHeaders(childA.id)).send({});
      expect(start.status).toBe(200);
      const attemptId = start.body.attemptId;
      const attempt: any = testDb.prepare('SELECT profile_id FROM family_quiz_attempts WHERE id = ?').get(attemptId);
      expect(attempt.profile_id).toBe(childA.id);
      // Questions are delivered without the answer key
      expect(start.body.questions[0].correctAnswer).toBeUndefined();

      const foreignAnswer = await request(app)
        .post(`/family-quizzes/attempts/${attemptId}/answer`)
        .set(authHeaders(childB.id))
        .send({ questionId, selectedAnswer: '1' });
      expect(foreignAnswer.status).toBe(403);

      const foreignComplete = await request(app)
        .post(`/family-quizzes/attempts/${attemptId}/complete`)
        .set(authHeaders(childB.id))
        .send({});
      expect(foreignComplete.status).toBe(403);
    });

    it('retried answers and completions are idempotent (no double points)', async () => {
      const app = await createApp();
      const { parentA, childA } = createFamilies();
      createTestProgress(childA.id);
      const { quizId, questionId } = createQuiz(parentA.id, childA.id);

      const start = await request(app).post(`/family-quizzes/${quizId}/start`).set(authHeaders(childA.id)).send({});
      const attemptId = start.body.attemptId;

      const answer = await request(app)
        .post(`/family-quizzes/attempts/${attemptId}/answer`)
        .set(authHeaders(childA.id))
        .send({ questionId, selectedAnswer: '1' });
      expect(answer.status).toBe(200);
      expect(answer.body.isCorrect).toBe(true);

      const retry = await request(app)
        .post(`/family-quizzes/attempts/${attemptId}/answer`)
        .set(authHeaders(childA.id))
        .send({ questionId, selectedAnswer: '1' });
      expect(retry.status).toBe(409);

      const row: any = testDb.prepare('SELECT correct_answers FROM family_quiz_attempts WHERE id = ?').get(attemptId);
      expect(row.correct_answers).toBe(1);

      const first = await request(app).post(`/family-quizzes/attempts/${attemptId}/complete`).set(authHeaders(childA.id)).send({});
      expect(first.status).toBe(200);
      const pointsAfterFirst = (testDb.prepare('SELECT COUNT(*) as n FROM progress WHERE profile_id = ?').get(childA.id) as any).n;

      const second = await request(app).post(`/family-quizzes/attempts/${attemptId}/complete`).set(authHeaders(childA.id)).send({});
      expect(second.status).toBe(409);
      const pointsAfterSecond = (testDb.prepare('SELECT COUNT(*) as n FROM progress WHERE profile_id = ?').get(childA.id) as any).n;
      expect(pointsAfterSecond).toBe(pointsAfterFirst);
    });

    it('rejects answering a question from a different quiz', async () => {
      const app = await createApp();
      const { parentA, childA } = createFamilies();
      const { quizId } = createQuiz(parentA.id, childA.id);
      const other = createQuiz(parentA.id, childA.id);

      const start = await request(app).post(`/family-quizzes/${quizId}/start`).set(authHeaders(childA.id)).send({});
      const response = await request(app)
        .post(`/family-quizzes/attempts/${start.body.attemptId}/answer`)
        .set(authHeaders(childA.id))
        .send({ questionId: other.questionId, selectedAnswer: '1' });
      expect(response.status).toBe(404);
    });
  });

  describe('activity sessions', () => {
    function createSession(createdBy: number, assignedTo: number) {
      const type = testDb.prepare(`INSERT INTO activity_types (name, display_name, icon) VALUES (?, 'Flashcards', '🃏')`)
        .run(`flashcards-${Math.random()}`);
      const session = testDb.prepare(`
        INSERT INTO learning_sessions (title, topic, created_by, assigned_to) VALUES ('Science', 'Cells', ?, ?)
      `).run(createdBy, assignedTo);
      testDb.prepare(`
        INSERT INTO learning_activities (session_id, activity_type_id, title, content_data, correct_data)
        VALUES (?, ?, 'Cell parts', '{}', '{}')
      `).run(session.lastInsertRowid, type.lastInsertRowid);
      return Number(session.lastInsertRowid);
    }

    it('scopes session reads, starts and edits to the family', async () => {
      const app = await createApp();
      const { parentA, childA, parentB, childB } = createFamilies();
      const sessionId = createSession(parentA.id, childA.id);

      expect((await request(app).get(`/activities/sessions/${sessionId}`).set(authHeaders(childA.id))).status).toBe(200);
      expect((await request(app).get(`/activities/sessions/${sessionId}`).set(authHeaders(parentB.id))).status).toBe(403);
      expect((await request(app).get(`/activities/sessions/${sessionId}`).set(authHeaders(childB.id))).status).toBe(403);
      expect((await request(app).post(`/activities/sessions/${sessionId}/start`).set(authHeaders(childB.id)).send({})).status).toBe(403);
      expect((await request(app).put(`/activities/sessions/${sessionId}`).set(authHeaders(childA.id)).send({ title: 'hacked' })).status).toBe(403);
      expect((await request(app).delete(`/activities/sessions/${sessionId}`).set(authHeaders(parentB.id))).status).toBe(403);

      const start = await request(app).post(`/activities/sessions/${sessionId}/start`).set(authHeaders(childA.id)).send({});
      expect(start.status).toBe(201);
      const attempt: any = testDb.prepare('SELECT profile_id FROM session_attempts WHERE id = ?').get(start.body.attemptId);
      expect(attempt.profile_id).toBe(childA.id);
    });

    it('rejects creating sessions for another family\'s child', async () => {
      const app = await createApp();
      const { parentB, childA } = createFamilies();

      const response = await request(app)
        .post('/activities/sessions')
        .set(authHeaders(parentB.id))
        .send({ title: 'x', topic: 'y', createdBy: parentB.id, assignedTo: childA.id });
      expect(response.status).toBe(403);
    });
  });

  describe('H5P content', () => {
    function createContent(createdBy: number) {
      const result = testDb.prepare(`
        INSERT INTO h5p_content (h5p_content_id, title, content_type, library_name, created_by)
        VALUES (?, 'Quiz', 'H5P.MultiChoice', 'H5P.MultiChoice', ?)
      `).run(`h5p-${Math.random()}`, createdBy);
      return Number(result.lastInsertRowid);
    }

    it('parents cannot reach or assign another family\'s content', async () => {
      const app = await createApp();
      const { parentA, childA, parentB, childB } = createFamilies();
      const contentId = createContent(parentA.id);

      expect((await request(app).get(`/h5p/content/${contentId}/assignments`).set(authHeaders(parentB.id))).status).toBe(403);
      expect((await request(app).post(`/h5p/content/${contentId}/assign`).set(authHeaders(parentB.id)).send({ childIds: [childB.id] })).status).toBe(403);
    });

    it('awards H5P points once even when xAPI completion events are retried or duplicated', async () => {
      const app = await createApp();
      const { parentA, childA } = createFamilies();
      createTestProgress(childA.id);
      const contentId = createContent(parentA.id);
      const assignmentId = Number(testDb.prepare(`
        INSERT INTO h5p_assignments (h5p_content_id, assigned_to, assigned_by, points) VALUES (?, ?, ?, 15)
      `).run(contentId, childA.id, parentA.id).lastInsertRowid);
      const attemptId = Number(testDb.prepare(`
        INSERT INTO h5p_attempts (assignment_id, profile_id, h5p_content_id) VALUES (?, ?, ?)
      `).run(assignmentId, childA.id, contentId).lastInsertRowid);

      const event = { attemptId, verb: 'completed', result: { score: { raw: 9, max: 10 }, success: true, completion: true } };
      const first = await request(app).post('/h5p/xapi').set(authHeaders(childA.id)).send(event);
      const retry = await request(app).post('/h5p/xapi').set(authHeaders(childA.id)).send(event);
      const answered = await request(app).post('/h5p/xapi').set(authHeaders(childA.id)).send({ ...event, verb: 'answered' });

      expect(first.body.pointsAwarded).toBe(15);
      expect(retry.body.pointsAwarded).toBe(0);
      expect(answered.body.pointsAwarded).toBe(0);
      const progress: any = testDb.prepare('SELECT total_points FROM progress WHERE profile_id = ?').get(childA.id);
      expect(progress.total_points).toBe(15);
    });

    it('rejects assigning content to children outside the family', async () => {
      const app = await createApp();
      const { parentA, childA, childB } = createFamilies();
      const contentId = createContent(parentA.id);

      const foreign = await request(app)
        .post(`/h5p/content/${contentId}/assign`)
        .set(authHeaders(parentA.id))
        .send({ childIds: [childA.id, childB.id] });
      expect(foreign.status).toBe(403);
      expect(testDb.prepare('SELECT COUNT(*) as n FROM h5p_assignments').get()).toEqual({ n: 0 });

      const own = await request(app)
        .post(`/h5p/content/${contentId}/assign`)
        .set(authHeaders(parentA.id))
        .send({ childIds: [childA.id] });
      expect(own.status).toBe(200);
      expect(own.body.assigned).toBe(1);
    });
  });
});
