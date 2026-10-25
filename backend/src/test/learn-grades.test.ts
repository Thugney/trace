import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import express from 'express';
import request from 'supertest';
import { testDb } from './setup.js';
import { createTestProfile, createTestProgress, authHeaders, createLearnEngineTables } from './helpers.js';
import { ensureLearnSchema } from '../services/learn/schema.js';
import { seedLearnCatalog } from '../services/learn/catalog.js';
import {
  GRADES,
  SUBJECT_SLUGS,
  DEFAULT_CONTENT_DIR,
  loadContentPackage,
  packageFileList,
  titleOf,
  validateContentPackage,
  type ContentPackage
} from '../services/learn/contentPackage.js';
import { importContentPackage, pilotGrade8Topics } from '../services/learn/contentImport.js';

const LEARN_TABLES = [
  'learn_open_responses', 'learn_review_attempts', 'learn_assignments', 'learn_review_papers', 'learn_course_topics',
  'learn_courses', 'learn_content_imports', 'learn_personal_cards', 'learn_flashcard_reviews', 'learn_mock_attempts',
  'learn_progress', 'learn_resource_links', 'learn_mock_exams', 'learn_lessons', 'learn_topic_goals', 'learn_topics',
  'learn_goals', 'learn_subjects'
];

const DOCS_DIR = path.resolve(__dirname, '../../../docs/learn');
const pkg = loadContentPackage();
const clonePackage = (): ContentPackage => JSON.parse(JSON.stringify(pkg));
const count = (sql: string, ...params: unknown[]) => (testDb.prepare(sql).get(...params) as { n: number }).n;
const lessonRowId = (contentId: string) =>
  (testDb.prepare('SELECT id FROM learn_lessons WHERE content_id = ? ORDER BY version DESC').get(contentId) as { id: number }).id;
const topicIdOf = (contentId: string) =>
  (testDb.prepare('SELECT topic_id FROM learn_lessons WHERE content_id = ?').get(contentId) as { topic_id: number }).topic_id;
const paperRowId = (contentId: string) =>
  (testDb.prepare('SELECT id FROM learn_review_papers WHERE content_id = ?').get(contentId) as { id: number }).id;

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
  const childA = createTestProfile({ name: 'Child A', type: 'child', parent_id: parentA.id, ai_enabled: 1, age: 8 });
  const parentB = createTestProfile({ name: 'Parent B', type: 'parent' });
  const childB = createTestProfile({ name: 'Child B', type: 'child', parent_id: parentB.id, age: 8 });
  createTestProgress(childA.id);
  createTestProgress(childB.id);
  return { admin, parentA, childA, parentB, childB };
}

const GRADE3_MATH = [
  'matematikk-g3-ganging-som-grupper', 'matematikk-g3-dobbelt-og-halvparten', 'matematikk-g3-dele-likt',
  'matematikk-g3-hundrerplass', 'matematikk-g3-lengde-og-maleenhet'
];
const GRADE3_MATH_PAPER = 'familyhub-learn-matematikk-g3-review-v1';

async function optIn(app: express.Application, parentId: number) {
  expect((await request(app).put('/learn/family/settings').set(authHeaders(parentId)).send({ enabled: true })).status).toBe(200);
}

async function review(app: express.Application, adminId: number, contentIds: string[], paperIds: string[] = []) {
  for (const contentId of contentIds) {
    expect((await request(app).post(`/learn/lessons/${lessonRowId(contentId)}/review`).set(authHeaders(adminId)).send({ status: 'reviewed' })).status).toBe(200);
  }
  for (const paperId of paperIds) {
    expect((await request(app).post(`/learn/review-papers/${paperRowId(paperId)}/review`).set(authHeaders(adminId)).send({ status: 'reviewed' })).status).toBe(200);
  }
}

async function playPractice(app: express.Application, learnerId: number, lessonId: number, correct: boolean) {
  const practice = await request(app).post(`/learn/lessons/${lessonId}/practice`).set(authHeaders(learnerId));
  expect(practice.status).toBe(200);
  const sessionId = practice.body.session_id;
  const start = await request(app).post(`/activities/sessions/${sessionId}/start`).set(authHeaders(learnerId)).send({});
  const activities = testDb.prepare('SELECT id, correct_data FROM learning_activities WHERE session_id = ?').all(sessionId) as any[];
  for (const activity of activities) {
    const key = JSON.parse(activity.correct_data).correctAnswer as string;
    const answer = correct ? key : ['A', 'B', 'C', 'D'].find((option) => option !== key);
    expect((await request(app).post(`/activities/attempts/${start.body.attemptId}/submit`).set(authHeaders(learnerId))
      .send({ activityId: activity.id, userResponse: { answer } })).status).toBe(200);
  }
  return request(app).post(`/activities/attempts/${start.body.attemptId}/complete`).set(authHeaders(learnerId)).send({});
}

describe('FamilyHub Learn Grades 1-10 content package', () => {
  it('ships a byte-identical copy of the docs/learn research package in the backend image', () => {
    for (const relative of packageFileList()) {
      expect(fs.readFileSync(path.join(DEFAULT_CONTENT_DIR, relative)).equals(fs.readFileSync(path.join(DOCS_DIR, relative))), relative).toBe(true);
    }
  });

  it('validates all 50 subject/grade combinations, 250 stable lesson IDs and every answer key', () => {
    const report = validateContentPackage(pkg, { existingGrade8PilotTopics: pilotGrade8Topics() });
    expect(report.errors).toEqual([]);
    expect(report.stats).toMatchObject({
      subjects: 5, grades: 10, grade_subject_groups: 50, courses: 50, lessons: 250,
      practice_prompts: 500, objective_items: 250, open_responses: 250, flashcards: 750,
      review_papers: 50, review_paper_items: 500, checkpoint_pages: 25
    });

    const lessons = pkg.subjects.flatMap((pack) => pack.lessons);
    for (const subject of SUBJECT_SLUGS) {
      for (const grade of GRADES) {
        const group = lessons.filter((lesson) => lesson.subject === subject && lesson.grade === grade);
        expect(group).toHaveLength(5);
        group.forEach((lesson) => expect(lesson.id).toBe(`${subject}-g${grade}-${lesson.slug}`));
      }
    }
    // Every keyed answer is one of four distinct options, and keys are spread over the slots
    for (const lesson of lessons) {
      const question = lesson.practice[0];
      expect(new Set(question.options.map((option) => option.label)).size).toBe(4);
      expect(question.options.find((option) => option.key === question.correct_key)?.label).toBe(question.correct_answer);
      expect(lesson.practice[1]).toMatchObject({ type: 'open_response', grading: 'human_feedback_required' });
    }
    expect(Object.values(report.stats.answer_key_distribution).every((n) => n > 0 && n < 125)).toBe(true);
  });

  it('maps every lesson to the registry checkpoint without inventing individual goal IDs', () => {
    const lessons = pkg.subjects.flatMap((pack) => pack.lessons);
    for (const lesson of lessons) {
      const subject = pkg.registry.subjects.find((item) => item.slug === lesson.subject)!;
      const stage = subject.official_stage_sources.find((source) => source.after_grade === lesson.curriculum.official_checkpoint_after_grade)!;
      expect(stage.after_grade).toBeGreaterThanOrEqual(lesson.grade);
      expect(lesson.curriculum.competence_goal_source_url).toBe(stage.url);
      expect(lesson.curriculum.lesson_specific_goal_crosswalk).toBe('unverified');
    }
    // Grade 1 maps to 2; outside maths 3->4, 5-6->7, 8-9->10 (contract §4)
    const checkpoint = (subject: string, grade: number) =>
      lessons.find((lesson) => lesson.subject === subject && lesson.grade === grade)!.curriculum.official_checkpoint_after_grade;
    expect([1, 3, 5, 6, 8, 9].map((grade) => checkpoint('norsk', grade))).toEqual([2, 4, 7, 7, 10, 10]);
    expect([1, 3, 8].map((grade) => checkpoint('matematikk', grade))).toEqual([2, 3, 8]);
  });

  it('has no open content notices after the 2026-10-25 data fixes', () => {
    const report = validateContentPackage(pkg);
    expect(report.notices).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.stats).toMatchObject({ untitled_lessons: 0, article_model_answer_mismatches: 0 });
  });

  it('reports content gaps as structured notices instead of filling them', () => {
    const broken = clonePackage();
    const english = broken.subjects[2].lessons[0];
    delete english.title;
    const maths = broken.subjects[0].lessons[0];
    maths.article.model_answer = ['A', 'B', 'C', 'D'].find((key) => key !== maths.practice[0].correct_key)!;
    broken.subjects[0].lessons.find((lesson) => lesson.id === 'matematikk-g8-potenser-og-kvadratrotter')!.existing_grade8_slug_preserved = true;
    broken.courseMap.courses.find((course) => course.grade === 9)!.assessment_mode = 'formative_with_optional_indicative_review_later';

    const report = validateContentPackage(broken);
    expect(report.ok).toBe(true);
    expect(report.notices).toEqual([
      { code: 'untitled_lessons', count: 1, examples: [english.id] },
      { code: 'article_model_answer_mismatch', count: 1, examples: [maths.id] },
      { code: 'grade8_preserve_flag_mismatch', count: 1, examples: ['matematikk-g8-potenser-og-kvadratrotter'] },
      expect.objectContaining({ code: 'assessment_mode_naming' })
    ]);
    // The display title falls back to supplied data and is flagged, never invented
    expect(titleOf(english, broken.grade8TopicMap)).toEqual({ title: 'Colours around us', source: 'slug' });
  });

  it('rejects a package whose answer key does not match its options, or that allows numeric grades', () => {
    const broken = clonePackage();
    broken.subjects[0].lessons[0].practice[0].correct_answer = 'not an option';
    broken.assessments.assessments[0].score_policy.numeric_grade_allowed = true;
    const report = validateContentPackage(broken);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.includes('correct_answer does not match'))).toBe(true);
    expect(report.errors.some((error) => error.includes('numeric grades are not allowed'))).toBe(true);
  });
});

describe('FamilyHub Learn Grades 1-10 import and learning flow', () => {
  beforeAll(() => {
    createLearnEngineTables();
    ensureLearnSchema();
  });

  beforeEach(() => {
    for (const table of [...LEARN_TABLES, 'activity_results', 'session_attempts', 'learning_activities', 'learning_sessions', 'audit_logs', 'ai_settings']) {
      testDb.exec(`DELETE FROM ${table}`);
    }
    seedLearnCatalog();
    expect(importContentPackage(pkg).ok).toBe(true);
  });

  describe('importer', () => {
    it('loads all drafts, keeps the five PR #9 grade 8 lessons and is repeat-safe', () => {
      expect(count('SELECT COUNT(*) as n FROM learn_lessons WHERE content_id IS NOT NULL')).toBe(250);
      expect(count('SELECT COUNT(*) as n FROM learn_lessons WHERE content_id IS NULL')).toBe(5);
      expect(count('SELECT COUNT(*) as n FROM learn_courses')).toBe(50);
      expect(count('SELECT COUNT(*) as n FROM learn_review_papers')).toBe(50);
      expect(count("SELECT COUNT(*) as n FROM learn_lessons WHERE review_status != 'draft'")).toBe(0);
      expect(count("SELECT COUNT(*) as n FROM learn_goals WHERE goal_level = 'checkpoint' AND official_goal_ref IS NULL")).toBe(25);
      // 750 curated flashcards with stable keys
      const cards = (testDb.prepare('SELECT flashcards FROM learn_lessons WHERE content_id IS NOT NULL').all() as any[])
        .flatMap((row) => JSON.parse(row.flashcards));
      expect(cards).toHaveLength(750);
      expect(new Set(cards.map((card: any) => card.key)).size).toBe(750);

      // Each course has exactly five topics; the pilot topics are shared, not duplicated
      expect(count('SELECT COUNT(*) as n FROM (SELECT course_id FROM learn_course_topics GROUP BY course_id HAVING COUNT(*) = 5)')).toBe(50);
      expect(count('SELECT COUNT(*) as n FROM learn_topics')).toBe(250);
      for (const pilot of pilotGrade8Topics()) {
        const lessons = testDb.prepare(`
          SELECT l.content_id FROM learn_lessons l JOIN learn_topics t ON t.id = l.topic_id JOIN learn_subjects s ON s.id = t.subject_id
          WHERE s.slug = ? AND t.grade = 8 AND t.slug = ?
        `).all(pilot.subject, pilot.slug) as any[];
        expect(lessons.map((lesson) => lesson.content_id).sort()).toEqual([`${pilot.subject}-g8-${pilot.slug}`, null].sort());
      }

      const snapshot = () => testDb.prepare('SELECT id, content_id, version, body, review_status FROM learn_lessons ORDER BY id').all();
      const before = snapshot();
      const again = importContentPackage(pkg);
      expect(again.summary!.created).toMatchObject({ lessons: 0, review_papers: 0, topics: 0, courses: 0, goals: 0 });
      expect(again.summary!.unchanged).toEqual({ lessons: 250, review_papers: 50 });
      expect(snapshot()).toEqual(before);
    });

    it('never overwrites reviewed content or learner records; changed content needs a new draft version', async () => {
      const app = await createApp();
      const { admin, parentA, childA } = setupFamilies();
      await optIn(app, parentA.id);
      await review(app, admin.id, [GRADE3_MATH[0]]);
      const lessonId = lessonRowId(GRADE3_MATH[0]);
      await request(app).post(`/learn/lessons/${lessonId}/read`).set(authHeaders(childA.id));

      // Same id + version with different text: skipped, stored row untouched
      const edited = clonePackage();
      const source = edited.subjects[0].lessons.find((lesson) => lesson.id === GRADE3_MATH[0])!;
      source.article.intro = 'Changed text';
      const skipped = importContentPackage(edited);
      expect(skipped.summary!.skipped.some((item) => item.startsWith(GRADE3_MATH[0]))).toBe(true);
      expect(testDb.prepare('SELECT review_status FROM learn_lessons WHERE id = ?').get(lessonId)).toEqual({ review_status: 'reviewed' });

      // New version: added as draft; learners keep seeing the reviewed version
      source.version = 2;
      edited.courseMap.courses.find((course) => course.course_id === 'learn-matematikk-grade-3')!
        .ordered_lessons.find((item) => item.lesson_id === GRADE3_MATH[0])!.content_version = 2;
      const versioned = importContentPackage(edited);
      expect(versioned.ok).toBe(true);
      expect(versioned.summary!.created.lessons).toBe(1);
      expect(testDb.prepare('SELECT version, review_status FROM learn_lessons WHERE content_id = ? ORDER BY version').all(GRADE3_MATH[0]))
        .toEqual([{ version: 1, review_status: 'reviewed' }, { version: 2, review_status: 'draft' }]);
      const catalog = await request(app).get('/learn/catalog?grade=3').set(authHeaders(childA.id));
      const topic = catalog.body.subjects.find((s: any) => s.slug === 'matematikk').topics[0];
      expect(topic.lessons).toEqual([expect.objectContaining({ id: lessonId, version: 1 })]);
      expect(count('SELECT COUNT(*) as n FROM learn_progress WHERE profile_id = ? AND lesson_id = ?', childA.id, lessonId)).toBe(1);
    });

    it('corrects unapproved, unused drafts in place but never drafts a learner has used', async () => {
      const app = await createApp();
      const { parentA, childA, admin } = setupFamilies();
      await optIn(app, parentA.id);
      const [unused, used] = GRADE3_MATH;
      // A learner touched `used` while an admin previewed it; it then went back to draft
      await review(app, admin.id, [used]);
      await request(app).post(`/learn/lessons/${lessonRowId(used)}/read`).set(authHeaders(childA.id));
      await request(app).post(`/learn/lessons/${lessonRowId(used)}/review`).set(authHeaders(admin.id)).send({ status: 'draft' });

      const edited = clonePackage();
      for (const id of [unused, used]) {
        edited.subjects[0].lessons.find((lesson) => lesson.id === id)!.article.key_takeaway = `Rettet: ${id}`;
      }
      const paper = edited.assessments.assessments.find((item) => item.id === GRADE3_MATH_PAPER)!;
      paper.instructions = 'Rettet instruksjon';
      const before = count('SELECT COUNT(*) as n FROM learn_lessons');

      const result = importContentPackage(edited);
      expect(result.summary!.refreshed).toEqual({ lessons: 1, review_papers: 1 });
      expect(result.summary!.skipped).toEqual([expect.stringContaining(`${used} v1`)]);
      expect(count('SELECT COUNT(*) as n FROM learn_lessons')).toBe(before);

      const body = (id: string) => JSON.parse((testDb.prepare('SELECT body FROM learn_lessons WHERE content_id = ?').get(id) as any).body);
      expect(body(unused).keyTakeaway).toBe(`Rettet: ${unused}`);
      expect(body(used).keyTakeaway).not.toBe(`Rettet: ${used}`);
      expect(testDb.prepare('SELECT review_status FROM learn_lessons WHERE content_id = ?').get(unused)).toEqual({ review_status: 'draft' });
      expect((testDb.prepare('SELECT instructions FROM learn_review_papers WHERE content_id = ?').get(GRADE3_MATH_PAPER) as any).instructions)
        .toBe('Rettet instruksjon');

      // Repeating the corrected import is a no-op
      expect(importContentPackage(edited).summary!.refreshed).toEqual({ lessons: 0, review_papers: 0 });
    });

    it('refuses an invalid package without writing anything', () => {
      const broken = clonePackage();
      broken.subjects[1].lessons.pop();
      const before = count('SELECT COUNT(*) as n FROM learn_lessons');
      const result = importContentPackage(broken);
      expect(result.ok).toBe(false);
      expect(count('SELECT COUNT(*) as n FROM learn_lessons')).toBe(before);
      expect(testDb.prepare('SELECT status FROM learn_content_imports ORDER BY id DESC LIMIT 1').get()).toEqual({ status: 'failed' });
    });

    it('is run and inspected by admins only, as an audited dry run by default', async () => {
      const app = await createApp();
      const { admin, parentA } = setupFamilies();
      expect((await request(app).post('/learn/admin/content-import').set(authHeaders(parentA.id)).send({})).status).toBe(403);
      const dry = await request(app).post('/learn/admin/content-import').set(authHeaders(admin.id)).send({});
      expect(dry.status).toBe(200);
      expect(dry.body.summary.dry_run).toBe(true);
      const status = await request(app).get('/learn/admin/content-import').set(authHeaders(admin.id));
      expect(status.body.validation.ok).toBe(true);
      expect(count("SELECT COUNT(*) as n FROM audit_logs WHERE action = 'learn.content_import_dry_run' AND actor_id = ?", admin.id)).toBe(1);
    });
  });

  describe('draft gate', () => {
    it('hides draft lessons, topics and review papers from children, including direct API access', async () => {
      const app = await createApp();
      const { parentA, childA } = setupFamilies();
      await optIn(app, parentA.id);
      const headers = authHeaders(childA.id);

      const catalog = await request(app).get('/learn/catalog?grade=3').set(headers);
      expect(catalog.status).toBe(200);
      const math = catalog.body.subjects.find((s: any) => s.slug === 'matematikk');
      expect(math.topics).toEqual([]);
      expect(math.review_papers).toEqual([]);
      expect(math.content_gap).toEqual({ topics_planned: 5, topics_available: 0 });
      expect(JSON.stringify(catalog.body)).not.toContain('Ganging');

      const lessonId = lessonRowId(GRADE3_MATH[0]);
      const paperId = paperRowId(GRADE3_MATH_PAPER);
      expect((await request(app).get(`/learn/lessons/${lessonId}`).set(headers)).status).toBe(404);
      expect((await request(app).get(`/learn/lessons/${lessonId}/flashcards`).set(headers)).status).toBe(404);
      expect((await request(app).post(`/learn/lessons/${lessonId}/practice`).set(headers)).status).toBe(404);
      expect((await request(app).post(`/learn/lessons/${lessonId}/open-responses/${GRADE3_MATH[0]}-q2`).set(headers).send({ response: 'x' })).status).toBe(404);
      expect((await request(app).get(`/learn/review-papers/${paperId}`).set(headers)).status).toBe(404);
      expect((await request(app).post(`/learn/review-papers/${paperId}/start`).set(headers)).status).toBe(404);
      expect((await request(app).post('/learn/tutor').set(headers).send({ lesson_id: lessonId, question: 'Hjelp?' })).status).toBe(404);
      expect((await request(app).get(`/learn/admin/lessons/${lessonId}`).set(headers)).status).toBe(403);
      expect((await request(app).post(`/learn/review-papers/${paperId}/review`).set(authHeaders(parentA.id)).send({ status: 'reviewed' })).status).toBe(403);

      const overview = await request(app).get('/learn/catalog/overview').set(headers);
      expect(overview.body.grades).toHaveLength(10);
      expect(overview.body.grades.every((grade: any) => grade.topics_available === 0 && grade.topics_planned >= 25)).toBe(true);
    });

    it('gives the reviewer answer keys, model answers and content warnings to check', async () => {
      const app = await createApp();
      const { admin } = setupFamilies();
      const detail = await request(app).get(`/learn/admin/lessons/${lessonRowId('engelsk-g1-colours-around-us')}`).set(authHeaders(admin.id));
      expect(detail.status).toBe(200);
      expect(detail.body.practice_items[0].correct).toEqual({ correctAnswer: 'C' });
      expect(detail.body.open_prompts[0].model_answer).toBeTruthy();
      expect(detail.body.content_meta).toMatchObject({ content_warnings: [], title_source: 'lesson' });
      expect(detail.body.title).toBe('Colours around us');

      const paper = await request(app).get(`/learn/admin/review-papers/${paperRowId(GRADE3_MATH_PAPER)}`).set(authHeaders(admin.id));
      expect(paper.body.items).toHaveLength(10);
      expect(paper.body.score_policy.numeric_grade_allowed).toBe(false);

      const queue = await request(app).get('/learn/admin/review-queue?grade=3&subject=matematikk').set(authHeaders(admin.id));
      expect(queue.body.lessons).toHaveLength(5);
      expect(queue.body.review_papers).toHaveLength(1);
    });
  });

  describe('parent assignment -> lesson -> practice -> feedback -> progress', () => {
    it('runs the full grade 3 loop with server-verified results', async () => {
      const app = await createApp();
      const { admin, parentA, childA } = setupFamilies();
      await optIn(app, parentA.id);
      await review(app, admin.id, GRADE3_MATH, [GRADE3_MATH_PAPER]);
      const child = authHeaders(childA.id);
      const parent = authHeaders(parentA.id);

      // Parent sets the school grade and assigns a topic with a deadline
      const settings = await request(app).put(`/learn/children/${childA.id}/settings`).set(parent).send({ grade: 3 });
      expect(settings.body).toMatchObject({ grade: 3, learn_enabled: true });
      const topicId = topicIdOf(GRADE3_MATH[1]);
      const due = new Date(Date.now() + 3 * 86400000).toISOString();
      const assignment = await request(app).post('/learn/assignments').set(parent)
        .send({ child_id: childA.id, topic_id: topicId, due_at: due, note: 'Øv før prøven', idempotency_key: 'topic-1' });
      expect(assignment.status).toBe(201);
      expect(assignment.body).toMatchObject({ target_kind: 'topic', topic_id: topicId, due_at: due });
      const replay = await request(app).post('/learn/assignments').set(parent)
        .send({ child_id: childA.id, topic_id: topicId, idempotency_key: 'topic-1' });
      expect(replay.body.idempotent_replay).toBe(true);

      // Child: grade defaults from settings; course path in order; free choice of any topic
      const status = await request(app).get('/learn/status').set(child);
      expect(status.body.grade).toBe(3);
      const catalog = await request(app).get('/learn/catalog').set(child);
      expect(catalog.body.grade).toBe(3);
      expect(catalog.body.assessment_policy.formative_only).toBe(true);
      const math = catalog.body.subjects.find((s: any) => s.slug === 'matematikk');
      expect(math.course).toMatchObject({ course_key: 'learn-matematikk-grade-3', checkpoint_after_grade: 3, assessment_mode: 'formative_only' });
      expect(math.topics.map((topic: any) => topic.lessons[0].content_id)).toEqual(GRADE3_MATH);
      expect(math.review_papers).toHaveLength(1);

      const lessonId = lessonRowId(GRADE3_MATH[1]);
      const lesson = await request(app).get(`/learn/lessons/${lessonId}`).set(child);
      expect(lesson.body.body.keyTakeaway).toBeTruthy();
      expect(lesson.body.open_prompts).toEqual([{ key: `${GRADE3_MATH[1]}-q2`, question: expect.any(String) }]);
      expect(JSON.stringify(lesson.body)).not.toMatch(/correctAnswer|model_answer"\s*:\s*"[^"]/);
      expect(lesson.body.course_nav).toMatchObject({ position: 2, previous: { lesson_id: lessonRowId(GRADE3_MATH[0]) }, next: { lesson_id: lessonRowId(GRADE3_MATH[2]) } });
      await request(app).post(`/learn/lessons/${lessonId}/read`).set(child);

      // Practice: a wrong first try is flagged for the parent, a correct retry completes the topic assignment
      const wrong = await playPractice(app, childA.id, lessonId, false);
      expect(wrong.body.passed).toBe(false);
      let progress = await request(app).get(`/learn/children/${childA.id}/progress`).set(parent);
      expect(progress.body.needs_practice).toEqual([expect.objectContaining({ lesson_id: lessonId, reasons: ['practice_not_passed'] })]);
      expect(progress.body.assignments[0].state).toBe('assigned');
      const right = await playPractice(app, childA.id, lessonId, true);
      expect(right.body.passed).toBe(true);
      progress = await request(app).get(`/learn/children/${childA.id}/progress`).set(parent);
      expect(progress.body.assignments[0]).toMatchObject({ state: 'completed', target_kind: 'topic', title: expect.any(String) });
      expect(progress.body.lessons.find((l: any) => l.lesson_id === lessonId)).toMatchObject({ state: 'mastered', content_id: GRADE3_MATH[1] });

      // Open response -> model answer revealed -> parent feedback -> locked
      const answer = await request(app).post(`/learn/lessons/${lessonId}/open-responses/${GRADE3_MATH[1]}-q2`).set(child).send({ response: 'Jeg dobler 4 og får 8.' });
      expect(answer.status).toBe(201);
      expect(answer.body.model_answer).toBeTruthy();
      const pending = progress = await request(app).get(`/learn/children/${childA.id}/progress`).set(parent);
      const responseId = pending.body.open_responses[0].id;
      expect(pending.body.open_responses[0]).toMatchObject({ feedback: null, question: expect.any(String) });
      expect((await request(app).post(`/learn/open-responses/${responseId}/feedback`).set(child).send({ feedback: 'Bra!' })).status).toBe(404);
      expect((await request(app).post(`/learn/open-responses/${responseId}/feedback`).set(parent).send({ feedback: 'Fin forklaring!' })).status).toBe(200);
      const after = await request(app).get(`/learn/lessons/${lessonId}`).set(child);
      expect(after.body.open_responses[0]).toMatchObject({ feedback: 'Fin forklaring!', feedback_by_name: 'Parent A' });
      expect((await request(app).post(`/learn/lessons/${lessonId}/open-responses/${GRADE3_MATH[1]}-q2`).set(child).send({ response: 'Endret' })).status).toBe(409);

      // Flashcards: curated review, personal edits persist and stay private
      const cardKey = `${GRADE3_MATH[1]}-fc1`;
      expect((await request(app).post(`/learn/lessons/${lessonId}/flashcards/${cardKey}/review`).set(child).send({ rating: 'missed' })).status).toBe(200);
      const fork = await request(app).post(`/learn/lessons/${lessonId}/cards`).set(child).send({ front: 'Dobbelt av 6?', back: '12', forked_from_card_key: cardKey });
      expect(fork.status).toBe(201);
      expect((await request(app).put(`/learn/cards/${fork.body.id}`).set(child).send({ back: 'Tolv' })).body.back).toBe('Tolv');
      const cards = await request(app).get(`/learn/lessons/${lessonId}/flashcards`).set(child);
      expect(cards.body.cards.map((card: any) => card.key)).toEqual([`${GRADE3_MATH[1]}-fc2`, `${GRADE3_MATH[1]}-fc3`, `personal-${fork.body.id}`]);
      progress = await request(app).get('/learn/me/progress').set(child);
      expect(progress.body.needs_practice.find((item: any) => item.lesson_id === lessonId).reasons).toContain('flashcards_missed');
    });
  });

  describe('formative review papers', () => {
    it('keeps keys server-side, locks help during the attempt, never grades and rewards only once', async () => {
      const app = await createApp();
      const { admin, parentA, childA } = setupFamilies();
      await optIn(app, parentA.id);
      await review(app, admin.id, GRADE3_MATH, [GRADE3_MATH_PAPER]);
      const child = authHeaders(childA.id);
      const paperId = paperRowId(GRADE3_MATH_PAPER);

      const assignment = await request(app).post('/learn/assignments').set(authHeaders(parentA.id))
        .send({ child_id: childA.id, review_paper_id: paperId, idempotency_key: 'paper-1' });
      expect(assignment.status).toBe(201);

      const start = await request(app).post(`/learn/review-papers/${paperId}/start`).set(child);
      expect(start.status).toBe(201);
      expect(start.body.items).toHaveLength(10);
      const payload = JSON.stringify(start.body);
      for (const secret of ['correct_key', 'correct_answer', 'expected_content', 'explanation']) {
        expect(payload).not.toContain(secret);
      }
      // Resume returns the same attempt; no help while it is open
      expect((await request(app).post(`/learn/review-papers/${paperId}/start`).set(child)).body).toMatchObject({ attempt_id: start.body.attempt_id, resumed: true });
      const lessonId = lessonRowId(GRADE3_MATH[0]);
      expect((await request(app).post('/learn/tutor').set(child).send({ lesson_id: lessonId, question: 'Hva er svaret?' })).status).toBe(423);
      expect((await request(app).post(`/learn/lessons/${lessonId}/practice`).set(child)).status).toBe(423);
      expect((await request(app).post(`/learn/lessons/${lessonId}/open-responses/${GRADE3_MATH[0]}-q2`).set(child).send({ response: 'x' })).status).toBe(423);

      // Answer every keyed item correctly except the first, plus one open response
      const items = JSON.parse((testDb.prepare('SELECT items FROM learn_review_papers WHERE id = ?').get(paperId) as any).items) as any[];
      const objective = items.filter((item) => item.kind === 'single_select');
      const responses: Record<string, string> = {};
      objective.forEach((item, index) => { responses[item.id] = index === 0 ? item.options.find((o: any) => o.key !== item.correct_key).key : item.correct_key; });
      const open = items.find((item) => item.kind === 'open_response');
      responses[open.id] = 'Min forklaring';
      // A client-reported score is ignored
      const submit = await request(app).post(`/learn/review-attempts/${start.body.attempt_id}/submit`).set(child).send({ responses, score: 100, numeric_grade: 6 });
      expect(submit.status).toBe(200);
      expect(submit.body).toMatchObject({ objective_correct: 4, objective_total: 5, numeric_grade: null, is_official_grade: false });
      expect(submit.body.feedback.topics_to_revise).toEqual([objective[0].source_lesson_id]);
      expect(submit.body.feedback.items.find((item: any) => item.key === open.id)).toMatchObject({ requires_human_review: true, correct: null });
      expect(submit.body.points_awarded).toBe(20);

      const retry = await request(app).post(`/learn/review-attempts/${start.body.attempt_id}/submit`).set(child).send({ responses: {} });
      expect(retry.body).toMatchObject({ already_submitted: true, objective_correct: 4, points_awarded: 20 });

      // A second attempt is allowed for study, but earns no points
      const second = await request(app).post(`/learn/review-papers/${paperId}/start`).set(child);
      const allRight = Object.fromEntries(objective.map((item) => [item.id, item.correct_key]));
      const secondSubmit = await request(app).post(`/learn/review-attempts/${second.body.attempt_id}/submit`).set(child).send({ responses: allRight });
      expect(secondSubmit.body).toMatchObject({ objective_correct: 5, points_awarded: 0 });

      // Parent sees the attempt awaiting feedback, gives it; assignment completed
      const parent = authHeaders(parentA.id);
      const progress = await request(app).get(`/learn/children/${childA.id}/progress`).set(parent);
      expect(progress.body.assignments.find((a: any) => a.target_kind === 'review_paper')).toMatchObject({ state: 'completed', lesson_id: null });
      const firstAttempt = progress.body.review_attempts.find((a: any) => a.id === start.body.attempt_id);
      expect(firstAttempt).toMatchObject({ awaiting_feedback: true, topics_to_revise: [expect.any(String)] });
      expect(progress.body.needs_practice.some((item: any) => item.reasons.includes('review_paper_missed'))).toBe(true);
      expect((await request(app).post(`/learn/review-attempts/${start.body.attempt_id}/feedback`).set(parent)
        .send({ summary: 'Godt jobbet', items: { [open.id]: 'Prøv å vise utregningen' } })).status).toBe(200);
      const seen = await request(app).get(`/learn/review-attempts/${start.body.attempt_id}`).set(child);
      expect(seen.body.guardian_feedback).toEqual({ summary: 'Godt jobbet', items: { [open.id]: 'Prøv å vise utregningen' } });
      expect(JSON.stringify(seen.body)).not.toMatch(/indicative_grade|"numeric_grade":\s*[1-6]/);
    });

    it('locks practice delivery and submission in the activity engine, not just its setup', async () => {
      const app = await createApp();
      const { admin, parentA, childA } = setupFamilies();
      await optIn(app, parentA.id);
      await review(app, admin.id, GRADE3_MATH, [GRADE3_MATH_PAPER]);
      const child = authHeaders(childA.id);
      const paperId = paperRowId(GRADE3_MATH_PAPER);
      const lessonId = lessonRowId(GRADE3_MATH[0]);

      // Materialize practice and open an engine attempt BEFORE the paper starts
      const practice = await request(app).post(`/learn/lessons/${lessonId}/practice`).set(child);
      expect(practice.status).toBe(200);
      const sessionId = practice.body.session_id;
      const opened = await request(app).post(`/activities/sessions/${sessionId}/start`).set(child).send({});
      expect(opened.status).toBe(201);
      const attemptId = opened.body.attemptId;
      const activityId = (testDb.prepare('SELECT id FROM learning_activities WHERE session_id = ? ORDER BY order_index').get(sessionId) as any).id;

      // A plain (non-Learn) session must keep working throughout
      const plain = await request(app).post('/activities/sessions').set(authHeaders(parentA.id))
        .send({ title: 'Vanlig økt', topic: 'Annet', createdBy: parentA.id, assignedTo: childA.id });
      expect(plain.status).toBe(201);

      const start = await request(app).post(`/learn/review-papers/${paperId}/start`).set(child);
      expect(start.status).toBe(201);

      // The already-materialized session, its answer key and the open attempt are all shut
      const locked = await request(app).get(`/activities/sessions/${sessionId}`).set(child);
      expect(locked.status).toBe(423);
      expect(locked.body.code).toBe('exam_in_progress');
      expect(JSON.stringify(locked.body)).not.toContain('correctAnswer');
      expect((await request(app).post(`/activities/sessions/${sessionId}/start`).set(child).send({})).status).toBe(423);
      expect((await request(app).post(`/activities/attempts/${attemptId}/submit`).set(child)
        .send({ activityId, userResponse: { answer: 'A' } })).status).toBe(423);
      expect((await request(app).get(`/activities/sessions/${plain.body.id ?? plain.body.sessionId}`).set(child)).status).toBe(200);

      // Submitting the paper reopens practice
      expect((await request(app).post(`/learn/review-attempts/${start.body.attempt_id}/submit`).set(child).send({ responses: {} })).status).toBe(200);
      expect((await request(app).get(`/activities/sessions/${sessionId}`).set(child)).status).toBe(200);
      expect((await request(app).post(`/activities/attempts/${attemptId}/submit`).set(child)
        .send({ activityId, userResponse: { answer: 'A' } })).status).toBe(200);
    });

    it('hides an earlier attempt\'s answer key while a retake is running', async () => {
      const app = await createApp();
      const { admin, parentA, childA } = setupFamilies();
      await optIn(app, parentA.id);
      await review(app, admin.id, GRADE3_MATH, [GRADE3_MATH_PAPER]);
      const child = authHeaders(childA.id);
      const parent = authHeaders(parentA.id);
      const paperId = paperRowId(GRADE3_MATH_PAPER);

      const first = await request(app).post(`/learn/review-papers/${paperId}/start`).set(child);
      const items = JSON.parse((testDb.prepare('SELECT items FROM learn_review_papers WHERE id = ?').get(paperId) as any).items) as any[];
      const responses = Object.fromEntries(items.filter((item) => item.kind === 'single_select').map((item) => [item.id, item.correct_key]));
      const firstId = first.body.attempt_id;
      expect((await request(app).post(`/learn/review-attempts/${firstId}/submit`).set(child).send({ responses })).status).toBe(200);

      // Between attempts the learner studies the full feedback
      const between = await request(app).get(`/learn/review-attempts/${firstId}`).set(child);
      expect(between.status).toBe(200);
      expect(between.body.feedback.items.some((item: any) => item.correct_key)).toBe(true);

      // A retake reuses the same items, so the first attempt's key is shut while it runs
      const retake = await request(app).post(`/learn/review-papers/${paperId}/start`).set(child);
      expect(retake.status).toBe(201);
      const hidden = await request(app).get(`/learn/review-attempts/${firstId}`).set(child);
      expect(hidden.status).toBe(423);
      expect(hidden.body.code).toBe('exam_in_progress');
      // ...including through the idempotent submit retry, which returns the same feedback
      const replay = await request(app).post(`/learn/review-attempts/${firstId}/submit`).set(child).send({ responses: {} });
      expect(replay.status).toBe(423);
      for (const secret of ['correct_key', 'correct_answer', 'expected_content', 'explanation']) {
        expect(JSON.stringify(hidden.body) + JSON.stringify(replay.body)).not.toContain(secret);
      }

      // A guardian still needs it to give feedback, and the learner gets it back after submitting
      expect((await request(app).get(`/learn/review-attempts/${firstId}`).set(parent)).status).toBe(200);
      expect((await request(app).post(`/learn/review-attempts/${retake.body.attempt_id}/submit`).set(child).send({ responses })).status).toBe(200);
      expect((await request(app).get(`/learn/review-attempts/${firstId}`).set(child)).status).toBe(200);
    });

    it('keeps the reviewed source-lesson link when a newer draft version arrives', async () => {
      const app = await createApp();
      const { admin, parentA, childA } = setupFamilies();
      await optIn(app, parentA.id);
      await review(app, admin.id, GRADE3_MATH, [GRADE3_MATH_PAPER]);
      const child = authHeaders(childA.id);
      const paperId = paperRowId(GRADE3_MATH_PAPER);
      const sourceContentId = (JSON.parse((testDb.prepare('SELECT source_lesson_ids FROM learn_review_papers WHERE id = ?')
        .get(paperId) as any).source_lesson_ids) as string[])[0];
      const reviewedRowId = lessonRowId(sourceContentId);

      // Draft a new version of that source lesson: the ordinary publishing workflow
      const edited = clonePackage();
      edited.subjects[0].lessons.find((lesson) => lesson.id === sourceContentId)!.version = 2;
      edited.courseMap.courses.find((course) => course.course_id === 'learn-matematikk-grade-3')!
        .ordered_lessons.find((item) => item.lesson_id === sourceContentId)!.content_version = 2;
      expect(importContentPackage(edited).ok).toBe(true);
      expect(testDb.prepare('SELECT version, review_status FROM learn_lessons WHERE content_id = ? ORDER BY version').all(sourceContentId))
        .toEqual([{ version: 1, review_status: 'reviewed' }, { version: 2, review_status: 'draft' }]);

      // Paper information still links the revision, pointing at the reviewed version
      const paper = await request(app).get(`/learn/review-papers/${paperId}`).set(child);
      expect(paper.status).toBe(200);
      expect(paper.body.source_lessons.find((lesson: any) => lesson.content_id === sourceContentId)).toMatchObject({ id: reviewedRowId });

      // ...and so do the results
      const start = await request(app).post(`/learn/review-papers/${paperId}/start`).set(child);
      expect((await request(app).post(`/learn/review-attempts/${start.body.attempt_id}/submit`).set(child).send({ responses: {} })).status).toBe(200);
      const attempt = await request(app).get(`/learn/review-attempts/${start.body.attempt_id}`).set(child);
      expect(attempt.body.source_lessons[sourceContentId]).toMatchObject({ id: reviewedRowId });

      // The reviewer keeps seeing the draft they are working on
      const reviewerView = await request(app).get(`/learn/admin/review-papers/${paperId}`).set(authHeaders(admin.id));
      expect(reviewerView.status).toBe(200);
      expect(reviewerView.body.source_lessons.find((lesson: any) => lesson.content_id === sourceContentId))
        .toMatchObject({ version: 2, review_status: 'draft' });
    });

    it('never produces a numeric grade for grade 8-10 papers either', async () => {
      const app = await createApp();
      const { admin, parentA, childA } = setupFamilies();
      await optIn(app, parentA.id);
      await review(app, admin.id, [], ['familyhub-learn-naturfag-g9-review-v1']);
      const paperId = paperRowId('familyhub-learn-naturfag-g9-review-v1');
      const start = await request(app).post(`/learn/review-papers/${paperId}/start`).set(authHeaders(childA.id));
      const items = JSON.parse((testDb.prepare('SELECT items FROM learn_review_papers WHERE id = ?').get(paperId) as any).items) as any[];
      const responses = Object.fromEntries(items.filter((i) => i.kind === 'single_select').map((i) => [i.id, i.correct_key]));
      const submit = await request(app).post(`/learn/review-attempts/${start.body.attempt_id}/submit`).set(authHeaders(childA.id)).send({ responses });
      expect(submit.body).toMatchObject({ objective_correct: 5, numeric_grade: null });
      expect(submit.body.feedback.numeric_grade_allowed).toBe(false);
    });

    it('refuses graded mock exams for grades 1-7', async () => {
      const app = await createApp();
      const { parentA, childA } = setupFamilies();
      await optIn(app, parentA.id);
      const topicId = topicIdOf(GRADE3_MATH[0]);
      const exam = testDb.prepare(`
        INSERT INTO learn_mock_exams (topic_id, slug, title, version, items, rubric, review_status) VALUES (?, 'x', 'X', 1, '[]', ?, 'reviewed')
      `).run(topicId, JSON.stringify({ criteria: [], limitations: [], disclaimer: '', gradeBands: [], minAnsweredRatio: 0.8, minItemsAnsweredPerCriterion: 2 }));
      const start = await request(app).post(`/learn/mock-exams/${exam.lastInsertRowid}/start`).set(authHeaders(childA.id));
      expect(start.status).toBe(409);
      expect(start.body.code).toBe('formative_only');
    });
  });

  describe('authorization across families', () => {
    it('denies cross-family reads, feedback, settings and assignments', async () => {
      const app = await createApp();
      const { admin, parentA, childA, parentB, childB } = setupFamilies();
      await optIn(app, parentA.id);
      await optIn(app, parentB.id);
      await review(app, admin.id, GRADE3_MATH, [GRADE3_MATH_PAPER]);
      const lessonId = lessonRowId(GRADE3_MATH[0]);
      const paperId = paperRowId(GRADE3_MATH_PAPER);

      await request(app).post(`/learn/lessons/${lessonId}/open-responses/${GRADE3_MATH[0]}-q2`).set(authHeaders(childA.id)).send({ response: 'Svar A' });
      const responseId = (testDb.prepare('SELECT id FROM learn_open_responses WHERE profile_id = ?').get(childA.id) as any).id;
      const start = await request(app).post(`/learn/review-papers/${paperId}/start`).set(authHeaders(childA.id));
      await request(app).post(`/learn/review-attempts/${start.body.attempt_id}/submit`).set(authHeaders(childA.id)).send({ responses: {} });

      const b = authHeaders(parentB.id);
      expect((await request(app).get(`/learn/children/${childA.id}/progress`).set(b)).status).toBe(403);
      expect((await request(app).put(`/learn/children/${childA.id}/settings`).set(b).send({ learn_enabled: false })).status).toBe(403);
      expect((await request(app).put(`/learn/children/${childA.id}/settings`).set(authHeaders(childA.id)).send({ tutor_enabled: true })).status).toBe(403);
      expect((await request(app).post(`/learn/open-responses/${responseId}/feedback`).set(b).send({ feedback: 'x' })).status).toBe(404);
      expect((await request(app).get(`/learn/review-attempts/${start.body.attempt_id}`).set(b)).status).toBe(404);
      expect((await request(app).get(`/learn/review-attempts/${start.body.attempt_id}`).set(authHeaders(childB.id))).status).toBe(404);
      expect((await request(app).post(`/learn/review-attempts/${start.body.attempt_id}/feedback`).set(b).send({ summary: 'x' })).status).toBe(404);
      expect((await request(app).post(`/learn/review-attempts/${start.body.attempt_id}/submit`).set(authHeaders(childB.id)).send({})).status).toBe(404);
      expect((await request(app).post('/learn/assignments').set(b)
        .send({ child_id: childA.id, review_paper_id: paperId, idempotency_key: 'x' })).status).toBe(403);
      expect((await request(app).post('/learn/assignments').set(authHeaders(parentA.id))
        .send({ child_id: childA.id, topic_id: topicIdOf(GRADE3_MATH[0]), review_paper_id: paperId, idempotency_key: 'two' })).status).toBe(400);
    });

    it('lets a guardian switch Learn and the AI tutor off per child', async () => {
      const app = await createApp();
      const { admin, parentA, childA } = setupFamilies();
      await optIn(app, parentA.id);
      await review(app, admin.id, [GRADE3_MATH[0]]);
      testDb.prepare("INSERT OR IGNORE INTO ai_settings (profile_id) VALUES (?)").run(childA.id);
      const lessonId = lessonRowId(GRADE3_MATH[0]);
      const parent = authHeaders(parentA.id);

      const off = await request(app).put(`/learn/children/${childA.id}/settings`).set(parent).send({ tutor_enabled: false });
      expect(off.body.tutor_available).toBe(false);
      const tutor = await request(app).post('/learn/tutor').set(authHeaders(childA.id)).send({ lesson_id: lessonId, question: 'Hjelp?' });
      expect(tutor.status).toBe(403);
      expect(tutor.body.code).toBe('ai_disabled');

      await request(app).put(`/learn/children/${childA.id}/settings`).set(parent).send({ learn_enabled: false });
      expect((await request(app).get('/learn/catalog').set(authHeaders(childA.id))).status).toBe(403);
      expect(count("SELECT COUNT(*) as n FROM audit_logs WHERE action = 'learn.child_settings_updated'")).toBe(2);
    });
  });
});
