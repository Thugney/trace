import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { testDb } from './setup.js';
import { createTestProfile, createTestProgress, authHeaders, createLearnEngineTables } from './helpers.js';
import { ensureLearnSchema } from '../services/learn/schema.js';
import { seedLearnCatalog } from '../services/learn/catalog.js';
import { GRADE8_PILOT } from '../services/learn/curriculum.js';

const LEARN_TABLES = [
  'learn_personal_cards', 'learn_flashcard_reviews', 'learn_mock_attempts', 'learn_assignments',
  'learn_progress', 'learn_resource_links', 'learn_mock_exams', 'learn_lessons', 'learn_topic_goals',
  'learn_topics', 'learn_goals', 'learn_subjects'
];

async function createApp() {
  const [{ default: learnRoutes }, { default: activityRoutes }] = await Promise.all([
    import('../routes/learn.js'),
    import('../routes/activities.js')
  ]);
  const app = express();
  app.use(express.json());
  app.use('/learn', learnRoutes);
  app.use('/activities', activityRoutes);
  return app;
}

function setupFamilies() {
  const admin = createTestProfile({ name: 'Admin', type: 'admin' });
  const parentA = createTestProfile({ name: 'Parent A', type: 'parent' });
  // The pilot is grade 8: Norwegian Year 8 pupils turn 13 that school year, and
  // its mock exams are only open to a learner of that year (contract §6)
  const childA = createTestProfile({ name: 'Child A', type: 'child', parent_id: parentA.id, ai_enabled: 1, age: 13 });
  const parentB = createTestProfile({ name: 'Parent B', type: 'parent' });
  const childB = createTestProfile({ name: 'Child B', type: 'child', parent_id: parentB.id, age: 13 });
  createTestProgress(childA.id);
  return { admin, parentA, childA, parentB, childB };
}

function lessonIdFor(subjectSlug: string): number {
  return (testDb.prepare(`
    SELECT l.id FROM learn_lessons l JOIN learn_topics t ON t.id = l.topic_id JOIN learn_subjects s ON s.id = t.subject_id
    WHERE s.slug = ?
  `).get(subjectSlug) as { id: number }).id;
}

function examIdFor(subjectSlug: string): number {
  return (testDb.prepare(`
    SELECT e.id FROM learn_mock_exams e JOIN learn_topics t ON t.id = e.topic_id JOIN learn_subjects s ON s.id = t.subject_id
    WHERE s.slug = ?
  `).get(subjectSlug) as { id: number }).id;
}

async function optIn(app: express.Application, parentId: number) {
  const response = await request(app).put('/learn/family/settings').set(authHeaders(parentId)).send({ enabled: true });
  expect(response.status).toBe(200);
}

async function reviewAll(app: express.Application, adminId: number) {
  for (const subject of GRADE8_PILOT) {
    expect((await request(app).post(`/learn/lessons/${lessonIdFor(subject.slug)}/review`).set(authHeaders(adminId)).send({ status: 'reviewed' })).status).toBe(200);
    expect((await request(app).post(`/learn/mock-exams/${examIdFor(subject.slug)}/review`).set(authHeaders(adminId)).send({ status: 'reviewed' })).status).toBe(200);
  }
}

const mathFixture = GRADE8_PILOT.find((subject) => subject.slug === 'matematikk')!;

describe('FamilyHub Learn', () => {
  beforeAll(() => {
    createLearnEngineTables();
    ensureLearnSchema();
  });

  beforeEach(() => {
    for (const table of [...LEARN_TABLES, 'activity_results', 'session_attempts', 'learning_activities', 'learning_sessions', 'audit_logs', 'ai_settings']) {
      testDb.exec(`DELETE FROM ${table}`);
    }
    seedLearnCatalog();
  });

  describe('catalog and review gate', () => {
    it('seeds one grade-8 topic per initial subject, idempotently', () => {
      seedLearnCatalog();
      seedLearnCatalog();
      const counts = Object.fromEntries(['learn_subjects', 'learn_topics', 'learn_lessons', 'learn_mock_exams'].map((table) => [
        table, (testDb.prepare(`SELECT COUNT(*) as n FROM ${table}`).get() as { n: number }).n
      ]));
      expect(counts).toEqual({ learn_subjects: 5, learn_topics: 5, learn_lessons: 5, learn_mock_exams: 5 });
      expect((testDb.prepare("SELECT COUNT(*) as n FROM learn_lessons WHERE review_status != 'draft'").get() as any).n).toBe(0);
    });

    it('is off until the family opts in', async () => {
      const app = await createApp();
      const { childA } = setupFamilies();

      const status = await request(app).get('/learn/status').set(authHeaders(childA.id));
      expect(status.body.enabled).toBe(false);
      expect((await request(app).get('/learn/catalog').set(authHeaders(childA.id))).status).toBe(403);
    });

    it('hides draft content from learners until an admin reviews it, and records the reviewer', async () => {
      const app = await createApp();
      const { admin, parentA, childA } = setupFamilies();
      await optIn(app, parentA.id);

      const before = await request(app).get('/learn/catalog?grade=8').set(authHeaders(childA.id));
      expect(before.status).toBe(200);
      expect(before.body.subjects.flatMap((s: any) => s.topics.flatMap((t: any) => t.lessons))).toHaveLength(0);
      expect((await request(app).get(`/learn/lessons/${lessonIdFor('matematikk')}`).set(authHeaders(childA.id))).status).toBe(404);

      const adminView = await request(app).get('/learn/catalog?grade=8').set(authHeaders(admin.id));
      expect(adminView.body.subjects).toHaveLength(5);

      // Parents cannot review
      expect((await request(app).post(`/learn/lessons/${lessonIdFor('matematikk')}/review`).set(authHeaders(parentA.id)).send({ status: 'reviewed' })).status).toBe(403);

      await reviewAll(app, admin.id);
      const reviewed: any = testDb.prepare('SELECT reviewed_by, reviewed_at FROM learn_lessons WHERE id = ?').get(lessonIdFor('matematikk'));
      expect(reviewed.reviewed_by).toBe(admin.id);
      expect(reviewed.reviewed_at).toBeTruthy();

      const after = await request(app).get('/learn/catalog?grade=8').set(authHeaders(childA.id));
      expect(after.body.subjects.map((s: any) => s.slug)).toEqual(['matematikk', 'norsk', 'engelsk', 'naturfag', 'samfunnsfag']);

      // Re-seeding never resets a review
      seedLearnCatalog();
      expect((testDb.prepare("SELECT COUNT(*) as n FROM learn_lessons WHERE review_status = 'reviewed'").get() as any).n).toBe(5);
    });

    it('labels goal levels honestly: grade-8 goals for maths, local sequence for goals after grade 10', async () => {
      const app = await createApp();
      const { admin, parentA, childA } = setupFamilies();
      await optIn(app, parentA.id);
      await reviewAll(app, admin.id);

      const catalog = await request(app).get('/learn/catalog?grade=8').set(authHeaders(childA.id));
      const goalsBySubject = Object.fromEntries(catalog.body.subjects.map((s: any) => [s.slug, s.topics[0].goals]));
      expect(goalsBySubject.matematikk[0]).toMatchObject({ goal_after_grade: 8, is_local_sequence: false, verification_status: 'unverified', official_goal_ref: null });
      expect(goalsBySubject.norsk.every((g: any) => g.goal_after_grade === 10 && g.is_local_sequence)).toBe(true);
      expect(goalsBySubject.engelsk[0].source_url).toMatch(/^https:\/\/www\.udir\.no\/lk20\//);
    });

    it('never exposes practice answer keys through the lesson endpoint', async () => {
      const app = await createApp();
      const { admin, parentA, childA } = setupFamilies();
      await optIn(app, parentA.id);
      await reviewAll(app, admin.id);

      const lesson = await request(app).get(`/learn/lessons/${lessonIdFor('matematikk')}`).set(authHeaders(childA.id));
      expect(lesson.status).toBe(200);
      expect(lesson.body.body.workedExamples.length).toBeGreaterThan(0);
      expect(JSON.stringify(lesson.body.practice)).not.toContain('correctAnswer');
    });
  });

  describe('practice through the existing activity engine', () => {
    it('records verified progress, completes assignments and awards points only once', async () => {
      const app = await createApp();
      const { admin, parentA, childA } = setupFamilies();
      await optIn(app, parentA.id);
      await reviewAll(app, admin.id);
      const lessonId = lessonIdFor('matematikk');

      const assignment = await request(app).post('/learn/assignments').set(authHeaders(parentA.id))
        .send({ child_id: childA.id, lesson_id: lessonId, idempotency_key: 'assign-1' });
      expect(assignment.status).toBe(201);

      expect((await request(app).post(`/learn/lessons/${lessonId}/read`).set(authHeaders(childA.id))).status).toBe(200);

      const practice = await request(app).post(`/learn/lessons/${lessonId}/practice`).set(authHeaders(childA.id));
      expect(practice.status).toBe(200);
      const sessionId = practice.body.session_id;
      const session: any = testDb.prepare('SELECT created_by, assigned_to, points_per_activity FROM learning_sessions WHERE id = ?').get(sessionId);
      // The guardian owns the answer key; the child only plays
      expect(session).toMatchObject({ created_by: parentA.id, assigned_to: childA.id });

      // Same session on retry
      expect((await request(app).post(`/learn/lessons/${lessonId}/practice`).set(authHeaders(childA.id))).body.session_id).toBe(sessionId);

      const playAllCorrect = async () => {
        const start = await request(app).post(`/activities/sessions/${sessionId}/start`).set(authHeaders(childA.id)).send({});
        const attemptId = start.body.attemptId;
        const activities = testDb.prepare('SELECT id, correct_data FROM learning_activities WHERE session_id = ? ORDER BY order_index').all(sessionId) as any[];
        for (const activity of activities) {
          const correct = JSON.parse(activity.correct_data);
          const response = correct.correctAnswer ? { answer: correct.correctAnswer } : { answers: correct.blanks.map((b: any) => b.answer) };
          expect((await request(app).post(`/activities/attempts/${attemptId}/submit`).set(authHeaders(childA.id))
            .send({ activityId: activity.id, userResponse: response })).status).toBe(200);
        }
        return request(app).post(`/activities/attempts/${attemptId}/complete`).set(authHeaders(childA.id)).send({});
      };

      const first = await playAllCorrect();
      expect(first.status).toBe(200);
      expect(first.body.passed).toBe(true);
      expect(first.body.pointsEarned).toBeGreaterThan(0);

      const second = await playAllCorrect();
      expect(second.body.pointsEarned).toBe(0);

      const progress = await request(app).get('/learn/me/progress').set(authHeaders(childA.id));
      const mathProgress = progress.body.lessons.find((l: any) => l.lesson_id === lessonId);
      expect(mathProgress.state).toBe('mastered');
      expect(mathProgress.practice).toMatchObject({ attempts: 2, best_percent: 100, passed: true });
      expect(progress.body.assignments[0].state).toBe('completed');

      // Stable after reload
      const reload = await request(app).get('/learn/me/progress').set(authHeaders(childA.id));
      expect(reload.body.lessons.find((l: any) => l.lesson_id === lessonId).state).toBe('mastered');
    });
  });

  describe('authorization', () => {
    it('scopes child progress to guardians and blocks cross-family assignment', async () => {
      const app = await createApp();
      const { admin, parentA, childA, parentB, childB } = setupFamilies();
      await optIn(app, parentA.id);
      await optIn(app, parentB.id);
      await reviewAll(app, admin.id);

      expect((await request(app).get(`/learn/children/${childA.id}/progress`).set(authHeaders(parentA.id))).status).toBe(200);
      expect((await request(app).get(`/learn/children/${childA.id}/progress`).set(authHeaders(parentB.id))).status).toBe(403);
      expect((await request(app).get(`/learn/children/${childA.id}/progress`).set(authHeaders(childB.id))).status).toBe(403);

      const crossFamily = await request(app).post('/learn/assignments').set(authHeaders(parentB.id))
        .send({ child_id: childA.id, lesson_id: lessonIdFor('norsk'), idempotency_key: 'x' });
      expect(crossFamily.status).toBe(403);

      const asChild = await request(app).post('/learn/assignments').set(authHeaders(childA.id))
        .send({ child_id: childA.id, lesson_id: lessonIdFor('norsk'), idempotency_key: 'x' });
      expect(asChild.status).toBe(403);
    });

    it('makes assignment creation idempotent and refuses unreviewed content and teachers', async () => {
      const app = await createApp();
      const { admin, parentA, childA } = setupFamilies();
      await optIn(app, parentA.id);
      expect((await request(app).post(`/learn/lessons/${lessonIdFor('norsk')}/review`).set(authHeaders(admin.id)).send({ status: 'reviewed' })).status).toBe(200);

      const body = { child_id: childA.id, lesson_id: lessonIdFor('norsk'), idempotency_key: 'retry-me' };
      const first = await request(app).post('/learn/assignments').set(authHeaders(parentA.id)).send(body);
      const retry = await request(app).post('/learn/assignments').set(authHeaders(parentA.id)).send(body);
      expect(first.status).toBe(201);
      expect(retry.status).toBe(200);
      expect(retry.body.id).toBe(first.body.id);
      expect((testDb.prepare('SELECT COUNT(*) as n FROM learn_assignments').get() as any).n).toBe(1);

      const draft = await request(app).post('/learn/assignments').set(authHeaders(parentA.id))
        .send({ child_id: childA.id, lesson_id: lessonIdFor('naturfag'), idempotency_key: 'draft' });
      expect(draft.status).toBe(404);

      const teacher = createTestProfile({ name: 'Teacher', type: 'parent' });
      testDb.prepare("UPDATE profiles SET type = 'teacher' WHERE id = ?").run(teacher.id);
      const asTeacher = await request(app).post('/learn/assignments').set(authHeaders(teacher.id))
        .send({ child_id: childA.id, lesson_id: lessonIdFor('norsk'), idempotency_key: 't' });
      // Teachers have no family Learn access; class assignments wait for the organization boundary decision
      expect(asTeacher.status).toBe(403);

      const audits = testDb.prepare("SELECT action FROM audit_logs WHERE action LIKE 'learn.%'").all().map((row: any) => row.action);
      expect(audits).toContain('learn.assignment_created');
      expect(audits).toContain('learn.lesson_reviewed');
    });

    it('lets the admin switch Learn off for everyone without deleting history', async () => {
      const app = await createApp();
      const { admin, parentA, childA } = setupFamilies();
      await optIn(app, parentA.id);
      await reviewAll(app, admin.id);
      await request(app).post(`/learn/lessons/${lessonIdFor('matematikk')}/read`).set(authHeaders(childA.id));

      testDb.prepare("INSERT INTO settings (key, value) VALUES ('learn_enabled', 'false') ON CONFLICT(key) DO UPDATE SET value = excluded.value").run();
      const blocked = await request(app).get('/learn/catalog').set(authHeaders(childA.id));
      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe('learn_disabled');
      expect((testDb.prepare('SELECT COUNT(*) as n FROM learn_progress').get() as any).n).toBe(1);

      testDb.prepare("UPDATE settings SET value = 'true' WHERE key = 'learn_enabled'").run();
      expect((await request(app).get('/learn/catalog').set(authHeaders(childA.id))).status).toBe(200);
    });
  });

  describe('mock exams', () => {
    it('serves items without answers and scores server-side with an indicative, non-official grade', async () => {
      const app = await createApp();
      const { admin, parentA, childA, parentB, childB } = setupFamilies();
      await optIn(app, parentA.id);
      await optIn(app, parentB.id);
      await reviewAll(app, admin.id);
      const examId = examIdFor('matematikk');

      const start = await request(app).post(`/learn/mock-exams/${examId}/start`).set(authHeaders(childA.id));
      expect(start.status).toBe(201);
      expect(JSON.stringify(start.body.items)).not.toMatch(/"answer"|acceptAlternatives|explanation/);

      // Resuming returns the same server-created attempt
      const resume = await request(app).post(`/learn/mock-exams/${examId}/start`).set(authHeaders(childA.id));
      expect(resume.body.attempt_id).toBe(start.body.attempt_id);

      const responses = Object.fromEntries(mathFixture.topic.mockExam.items.map((item) => [item.key, item.answer]));
      // Accept an alternative notation
      responses.f1 = '2 x 2 x 3 x 7';

      expect((await request(app).post(`/learn/mock-attempts/${start.body.attempt_id}/submit`).set(authHeaders(childB.id)).send({ responses })).status).toBe(404);

      const submit = await request(app).post(`/learn/mock-attempts/${start.body.attempt_id}/submit`).set(authHeaders(childA.id)).send({ responses });
      expect(submit.status).toBe(200);
      expect(submit.body).toMatchObject({ outcome: 'graded', indicative_grade: 6, is_official_grade: false, score: 18, max_score: 18 });
      expect(submit.body.disclaimer).toMatch(/ikke en offisiell karakter/);

      // Retried submit (even with different answers) returns the stored result
      const retry = await request(app).post(`/learn/mock-attempts/${start.body.attempt_id}/submit`).set(authHeaders(childA.id)).send({ responses: {} });
      expect(retry.body).toMatchObject({ already_submitted: true, score: 18, indicative_grade: 6 });

      // Guardian can read the result; another family cannot
      expect((await request(app).get(`/learn/mock-attempts/${start.body.attempt_id}`).set(authHeaders(parentA.id))).status).toBe(200);
      expect((await request(app).get(`/learn/mock-attempts/${start.body.attempt_id}`).set(authHeaders(childB.id))).status).toBe(404);
    });

    it('returns insufficient_evidence instead of a fabricated grade', async () => {
      const app = await createApp();
      const { admin, parentA, childA } = setupFamilies();
      await optIn(app, parentA.id);
      await reviewAll(app, admin.id);

      const start = await request(app).post(`/learn/mock-exams/${examIdFor('matematikk')}/start`).set(authHeaders(childA.id));
      const submit = await request(app).post(`/learn/mock-attempts/${start.body.attempt_id}/submit`).set(authHeaders(childA.id))
        .send({ responses: { c1: 'b', c2: 'b' } });
      expect(submit.body.outcome).toBe('insufficient_evidence');
      expect(submit.body.indicative_grade).toBeNull();
      expect(submit.body.insufficient_reasons).toContain('too_few_items_answered');
    });
  });

  describe('AI tutor', () => {
    it('is locked during a mock exam, respects parent AI controls and falls back to the lesson', async () => {
      const app = await createApp();
      const { admin, parentA, childA } = setupFamilies();
      await optIn(app, parentA.id);
      await reviewAll(app, admin.id);
      const lessonId = lessonIdFor('matematikk');

      const fallback = await request(app).post('/learn/tutor').set(authHeaders(childA.id)).send({ lesson_id: lessonId, question: 'Hvordan finner jeg fellesnevner?' });
      expect(fallback.status).toBe(200);
      expect(fallback.body.source).toBe('lesson_fallback');
      expect(fallback.body.answer).toMatch(/Fellesnevner/);

      const start = await request(app).post(`/learn/mock-exams/${examIdFor('matematikk')}/start`).set(authHeaders(childA.id));
      const locked = await request(app).post('/learn/tutor').set(authHeaders(childA.id)).send({ lesson_id: lessonId, question: 'Hva er 84 faktorisert?' });
      expect(locked.status).toBe(423);
      expect(locked.body.code).toBe('exam_in_progress');

      await request(app).post(`/learn/mock-attempts/${start.body.attempt_id}/submit`).set(authHeaders(childA.id)).send({ responses: {} });
      testDb.prepare('UPDATE profiles SET ai_enabled = 0 WHERE id = ?').run(childA.id);
      const disabled = await request(app).post('/learn/tutor').set(authHeaders(childA.id)).send({ lesson_id: lessonId, question: 'Hjelp?' });
      expect(disabled.status).toBe(403);
      expect(disabled.body.code).toBe('ai_disabled');
    });
  });

  describe('flashcards', () => {
    it('schedules reviews per learner and keeps personal edits separate from curated cards', async () => {
      const app = await createApp();
      const { admin, parentA, childA } = setupFamilies();
      const sibling = createTestProfile({ name: 'Sibling', type: 'child', parent_id: parentA.id });
      await optIn(app, parentA.id);
      await reviewAll(app, admin.id);
      const lessonId = lessonIdFor('matematikk');

      const known = await request(app).post(`/learn/lessons/${lessonId}/flashcards/mat-f1/review`).set(authHeaders(childA.id)).send({ rating: 'known' });
      expect(known.body.box).toBe(1);
      const missed = await request(app).post(`/learn/lessons/${lessonId}/flashcards/mat-f1/review`).set(authHeaders(childA.id)).send({ rating: 'missed' });
      expect(missed.body.box).toBe(1);

      const fork = await request(app).post(`/learn/lessons/${lessonId}/cards`).set(authHeaders(childA.id))
        .send({ front: 'Primtall (mine ord)', back: 'Bare 1 og seg selv', forked_from_card_key: 'mat-f1' });
      expect(fork.status).toBe(201);

      const mine = await request(app).get(`/learn/lessons/${lessonId}/flashcards`).set(authHeaders(childA.id));
      expect(mine.body.cards.some((c: any) => c.key === 'mat-f1')).toBe(false);
      expect(mine.body.cards.some((c: any) => c.front === 'Primtall (mine ord)')).toBe(true);

      // Curated content is unchanged for everyone else
      const theirs = await request(app).get(`/learn/lessons/${lessonId}/flashcards`).set(authHeaders(sibling.id));
      expect(theirs.body.cards.find((c: any) => c.key === 'mat-f1').front).toBe('Primtall');

      expect((await request(app).put(`/learn/cards/${fork.body.id}`).set(authHeaders(sibling.id)).send({ front: 'x' })).status).toBe(404);
    });
  });
});
