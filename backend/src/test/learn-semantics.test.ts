import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { testDb } from './setup.js';
import { authHeaders, createLearnEngineTables, createTestProfile, createTestProgress } from './helpers.js';
import { ensureLearnSchema } from '../services/learn/schema.js';
import { getVisibleLessons, seedLearnCatalog } from '../services/learn/catalog.js';
import { sendPushNotification } from '../services/notifications.js';

vi.mock('../services/notifications', () => ({ sendPushNotification: vi.fn().mockResolvedValue(undefined) }));

const tables = [
  'learn_open_responses', 'learn_review_attempts', 'learn_assignments', 'learn_review_papers',
  'learn_course_topics', 'learn_courses', 'learn_personal_cards', 'learn_flashcard_reviews',
  'learn_mock_attempts', 'learn_progress', 'learn_resource_links', 'learn_mock_exams',
  'learn_lessons', 'learn_topic_goals', 'learn_topics', 'learn_goals', 'learn_subjects',
  'activity_results', 'session_attempts', 'learning_activities', 'learning_sessions', 'audit_logs', 'ai_settings'
];

async function fixture() {
  const [{ default: learn }, { default: activities }] = await Promise.all([
    import('../routes/learn.js'), import('../routes/activities.js')
  ]);
  const app = express();
  app.use(express.json());
  app.use('/learn', learn);
  app.use('/activities', activities);
  const parent = createTestProfile({ type: 'parent', name: 'Parent' });
  const child = createTestProfile({ type: 'child', name: 'Learner', parent_id: parent.id, age: 13 });
  createTestProgress(child.id);
  expect((await request(app).put('/learn/family/settings').set(authHeaders(parent.id)).send({ enabled: true })).status).toBe(200);
  testDb.exec("UPDATE learn_lessons SET review_status = 'reviewed'; UPDATE learn_mock_exams SET review_status = 'reviewed'");
  const lesson = testDb.prepare('SELECT * FROM learn_lessons ORDER BY id LIMIT 1').get() as any;
  return { app, parent, child, lesson };
}

describe('PR13 learning semantics (SEC-009/010/011)', () => {
  beforeAll(() => { createLearnEngineTables(); ensureLearnSchema(); });
  beforeEach(() => {
    for (const table of tables) testDb.exec(`DELETE FROM ${table}`);
    seedLearnCatalog();
    vi.mocked(sendPushNotification).mockClear();
  });

  it('credits and notifies only the first passed Learn attempt, preserving failed scores and replay protection', async () => {
    const { app, parent, child, lesson } = await fixture();
    // Three real server-scored questions allow a positive but sub-threshold result.
    const items = Array.from({ length: 3 }, (_, i) => ({
      key: `q${i}`, type: 'multiple_choice', title: `Question ${i}`, content: {
        question: 'One plus one?', options: [{ id: 'a', text: '2' }, { id: 'b', text: '3' }]
      }, correct: { correctAnswer: 'a' }, hints: [], explanation: 'One plus one is two.'
    }));
    testDb.prepare('UPDATE learn_lessons SET practice = ? WHERE id = ?').run(JSON.stringify(items), lesson.id);
    const prepared = await request(app).post(`/learn/lessons/${lesson.id}/practice`).set(authHeaders(child.id));
    expect(prepared.status).toBe(200);
    const sessionId = prepared.body.session_id;
    const questions = testDb.prepare('SELECT id FROM learning_activities WHERE session_id = ? ORDER BY order_index').all(sessionId) as { id: number }[];
    async function play(correctCount: number) {
      const start = await request(app).post(`/activities/sessions/${sessionId}/start`).set(authHeaders(child.id)).send({});
      expect(start.status).toBe(201);
      for (const [index, question] of questions.entries()) {
        expect((await request(app).post(`/activities/attempts/${start.body.attemptId}/submit`).set(authHeaders(child.id))
          .send({ activityId: question.id, userResponse: { answer: index < correctCount ? 'a' : 'b' } })).status).toBe(200);
      }
      const completed = await request(app).post(`/activities/attempts/${start.body.attemptId}/complete`).set(authHeaders(child.id));
      expect(completed.status).toBe(200);
      return { result: completed.body, id: start.body.attemptId };
    }
    const before = testDb.prepare('SELECT * FROM progress WHERE profile_id = ?').get(child.id);
    const failedAttempts = [await play(1), await play(1)];
    expect(failedAttempts.map(({ result }) => result.pointsEarned)).toEqual([0, 0]);
    for (const { result, id } of failedAttempts) {
      expect(result).toMatchObject({ passed: false, totalScore: 20, scorePercentage: 33 });
      expect(result.pointsEarned).toBe(0);
      expect(result.starsEarned).toBe(0);
      expect(testDb.prepare('SELECT passed, total_score, points_earned FROM session_attempts WHERE id = ?').get(id))
        .toEqual({ passed: 0, total_score: 20, points_earned: 0 });
    }
    expect(testDb.prepare('SELECT * FROM progress WHERE profile_id = ?').get(child.id)).toEqual(before);
    expect(sendPushNotification).not.toHaveBeenCalled();
    const firstPass = await play(3);
    expect(firstPass.result).toMatchObject({ passed: true, pointsEarned: 60 });
    expect(sendPushNotification).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendPushNotification).mock.calls[0][0]).toBe(parent.id);
    const credited = testDb.prepare('SELECT * FROM progress WHERE profile_id = ?').get(child.id);
    expect((await play(3)).result.pointsEarned).toBe(0);
    expect((await play(1)).result.pointsEarned).toBe(0);
    expect((await request(app).post(`/activities/attempts/${firstPass.id}/complete`).set(authHeaders(child.id))).status).toBe(400);
    expect(testDb.prepare('SELECT * FROM progress WHERE profile_id = ?').get(child.id)).toEqual(credited);
    expect(sendPushNotification).toHaveBeenCalledTimes(1);
    // Removing only the Learn link makes this an ordinary activity, whose partial-score policy remains intact.
    testDb.prepare('DELETE FROM learn_resource_links WHERE existing_resource_id = ?').run(sessionId);
    expect((await play(1)).result.pointsEarned).toBe(20);
    expect(sendPushNotification).toHaveBeenCalledTimes(2);
  });

  const timestampCases = [
    ['earlier same day', '2026-10-25 14:00:00', '2026-10-25T09:00:00.000Z', false],
    ['later same day', '2026-10-25 14:00:00', '2026-10-25T15:00:00.000Z', true],
    ['equal mixed formats', '2026-10-25 14:00:00', '2026-10-25T14:00:00.000Z', true],
    ['one millisecond earlier', '2026-10-25 14:00:00.501', '2026-10-25T14:00:00.500Z', false],
    ['one millisecond later, reverse formats', '2026-10-25T14:00:00.500Z', '2026-10-25 14:00:00.501', true],
    ['equal offset instant', '2026-10-25 14:00:00', '2026-10-25T15:00:00.000+01:00', true],
    ['invalid submission', '2026-10-25 14:00:00', 'invalid', false],
    ['invalid assignment', 'invalid', '2026-10-25T15:00:00.000Z', false]
  ] as const;
  for (const kind of ['review_paper', 'mock_exam'] as const) {
    it.each(timestampCases)(`${kind}: %s uses chronological instants`, async (_label, assigned, submitted, completed) => {
      const { app, parent, child, lesson } = await fixture();
      const exam = testDb.prepare('SELECT id FROM learn_mock_exams WHERE topic_id = ?').get(lesson.topic_id) as { id: number };
      let paperId: number | null = null;
      if (kind === 'review_paper') {
        testDb.exec(`INSERT INTO learn_courses (course_key,subject_id,grade,title,curriculum_code,checkpoint_after_grade,checkpoint_url,track_type,assessment_mode,grading_mode,source_package)
          SELECT 'test',subject_id,8,'Test','test',10,'https://example.test','test','test','test','test' FROM learn_topics WHERE id = ${lesson.topic_id}`);
        const course = testDb.prepare('SELECT id FROM learn_courses').get() as { id: number };
        paperId = Number(testDb.prepare(`INSERT INTO learn_review_papers
          (content_id,course_id,title,mode,duration_minutes,instructions,items,score_policy,source_lesson_ids,content_hash,review_status)
          VALUES ('test',?,'Test','formative',20,'[]','[]','{}',?,'test','reviewed')`).run(course.id, JSON.stringify([lesson.id])).lastInsertRowid);
        testDb.prepare(`INSERT INTO learn_review_attempts (paper_id,profile_id,started_at,expires_at,submitted_at) VALUES (?,?,'2026-10-25T08:00:00Z','2026-10-25T16:00:00Z',?)`)
          .run(paperId, child.id, submitted);
      } else {
        testDb.prepare(`INSERT INTO learn_mock_attempts (exam_id,profile_id,rubric_version,started_at,expires_at,submitted_at) VALUES (?,?,1,'2026-10-25T08:00:00Z','2026-10-25T16:00:00Z',?)`)
          .run(exam.id, child.id, submitted);
      }
      const id = Number(testDb.prepare(`INSERT INTO learn_assignments (assigned_by,child_id,lesson_id,mock_exam_id,review_paper_id,target_kind,idempotency_key,created_at)
        VALUES (?,?,?,?,?,?,?,?)`).run(parent.id, child.id, kind === 'review_paper' ? lesson.id : null, kind === 'mock_exam' ? exam.id : null, paperId, kind, 'time-test', assigned).lastInsertRowid);
      const response = await request(app).get('/learn/assignments').set(authHeaders(child.id));
      expect(response.status).toBe(200);
      expect(response.body.find((row: any) => row.id === id).state).toBe(completed ? 'completed' : 'assigned');
      const stored = testDb.prepare('SELECT completed_at FROM learn_assignments WHERE id = ?').get(id) as { completed_at: string | null };
      expect(Boolean(stored.completed_at)).toBe(completed);
    });
  }

  it.each([2, 0])('chooses reviewed v2 before display ordering when its new position is %i', (newPosition) => {
    const original = testDb.prepare('SELECT * FROM learn_lessons ORDER BY id LIMIT 1').get() as any;
    testDb.prepare("UPDATE learn_lessons SET review_status = 'reviewed', sort_order = 1 WHERE id = ?").run(original.id);
    const clone = (slug: string, locale: string, version: number, order: number, status: string, contentId: string | null = null) =>
      Number(testDb.prepare(`INSERT INTO learn_lessons (topic_id,slug,locale,version,sort_order,review_status,title,body,practice,flashcards,authored_by,content_id)
        VALUES (?,?,?,?,?,?,'Version fixture','{}','[]','[]','test',?)`).run(original.topic_id, slug, locale, version, order, status, contentId).lastInsertRowid);
    const newest = clone(original.slug, original.locale, 2, newPosition, 'reviewed');
    clone(original.slug, original.locale, 3, -10, 'draft');
    clone(original.slug, original.locale, 4, -20, 'retired');
    const otherLocale = clone(original.slug, 'en', 1, 5, 'reviewed');
    const otherLesson = clone('another-lesson', original.locale, 1, 3, 'reviewed');
    const visible = getVisibleLessons(original.topic_id, false);
    expect(visible.map(row => row.id)).toEqual([newest, otherLesson, otherLocale]);
    expect(visible.find(row => row.slug === original.slug && row.locale === original.locale)?.version).toBe(2);
    expect(getVisibleLessons(original.topic_id, true)).toHaveLength(6);
    // A withdrawn replacement must fall back to reviewed v1, not the newer draft/retired versions.
    testDb.prepare("UPDATE learn_lessons SET review_status = 'retired' WHERE id = ?").run(newest);
    expect(getVisibleLessons(original.topic_id, false).find(row => row.locale === original.locale && row.slug === original.slug)?.id).toBe(original.id);
  });
});
