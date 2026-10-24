import db from '../../database/init';
import { AUTHORED_BY, CURRICULUM_REVISION, GRADE8_PILOT, type SubjectFixture } from './curriculum';
import type { MockExamItem, MockExamRubric, PracticeItem, Flashcard, LessonBody } from './curriculum';

/**
 * Idempotent seeding of the reviewed-content library.
 * - Subjects/goals/topics are upserted by natural key; descriptive metadata
 *   may be refreshed, but a reviewer's goal verification is never reset.
 * - Lessons and mock exams are immutable per version: an existing version is
 *   never overwritten (its review status and learner progress stay valid).
 *   Content changes ship as a new version that starts as `draft`.
 */
export function seedLearnCatalog(fixtures: SubjectFixture[] = GRADE8_PILOT) {
  const upsertSubject = db.prepare(`
    INSERT INTO learn_subjects (slug, title, udir_code, instruction_locale, sort_order)
    VALUES (@slug, @title, @udirCode, @instructionLocale, @sortOrder)
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      udir_code = excluded.udir_code,
      instruction_locale = excluded.instruction_locale,
      sort_order = excluded.sort_order
  `);
  const upsertGoal = db.prepare(`
    INSERT INTO learn_goals (
      subject_id, goal_key, official_goal_ref, source_locator, goal_after_grade,
      description, description_is_paraphrase, source_url, curriculum_revision
    ) VALUES (?, ?, NULL, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(subject_id, goal_key, curriculum_revision) DO UPDATE SET
      source_locator = excluded.source_locator,
      goal_after_grade = excluded.goal_after_grade,
      description = CASE WHEN learn_goals.verification_status = 'verified' THEN learn_goals.description ELSE excluded.description END,
      source_url = excluded.source_url
  `);
  const upsertTopic = db.prepare(`
    INSERT INTO learn_topics (subject_id, grade, slug, title, summary, sort_order)
    VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT(subject_id, grade, slug) DO UPDATE SET
      title = excluded.title,
      summary = excluded.summary
  `);
  const linkGoal = db.prepare('INSERT OR IGNORE INTO learn_topic_goals (topic_id, goal_id) VALUES (?, ?)');
  const insertLesson = db.prepare(`
    INSERT OR IGNORE INTO learn_lessons (
      topic_id, slug, sort_order, locale, version, title, body, practice, flashcards, authored_by
    ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMockExam = db.prepare(`
    INSERT OR IGNORE INTO learn_mock_exams (
      topic_id, slug, title, version, time_limit_minutes, items, rubric, rubric_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const run = db.transaction(() => {
    for (const subject of fixtures) {
      upsertSubject.run(subject);
      const subjectId = (db.prepare('SELECT id FROM learn_subjects WHERE slug = ?').get(subject.slug) as { id: number }).id;

      const goalIds = new Map<string, number>();
      for (const goal of subject.goals) {
        upsertGoal.run(
          subjectId, goal.key, goal.sourceLocator, goal.goalAfterGrade,
          goal.description, subject.sourceUrl, CURRICULUM_REVISION
        );
        const row = db.prepare(`
          SELECT id FROM learn_goals WHERE subject_id = ? AND goal_key = ? AND curriculum_revision = ?
        `).get(subjectId, goal.key, CURRICULUM_REVISION) as { id: number };
        goalIds.set(goal.key, row.id);
      }

      const { topic } = subject;
      upsertTopic.run(subjectId, topic.grade, topic.slug, topic.title, topic.summary);
      const topicId = (db.prepare(`
        SELECT id FROM learn_topics WHERE subject_id = ? AND grade = ? AND slug = ?
      `).get(subjectId, topic.grade, topic.slug) as { id: number }).id;

      for (const goalKey of topic.goalKeys) {
        const goalId = goalIds.get(goalKey);
        if (!goalId) {
          throw new Error(`Learn fixture ${topic.slug} references unknown goal ${goalKey}`);
        }
        linkGoal.run(topicId, goalId);
      }

      const { lesson, mockExam } = topic;
      insertLesson.run(
        topicId, lesson.slug, subject.instructionLocale, lesson.version, lesson.title,
        JSON.stringify(lesson.body), JSON.stringify(lesson.practice), JSON.stringify(lesson.flashcards), AUTHORED_BY
      );
      insertMockExam.run(
        topicId, mockExam.slug, mockExam.title, mockExam.version, mockExam.timeLimitMinutes,
        JSON.stringify(mockExam.items), JSON.stringify(mockExam.rubric), mockExam.rubricVersion
      );
    }
  });

  run();
}

// ----------------------------------------------------------------- read model

export type LessonRow = {
  id: number;
  topic_id: number;
  slug: string;
  locale: string;
  version: number;
  title: string;
  body: string;
  practice: string;
  flashcards: string;
  authored_by: string;
  review_status: 'draft' | 'reviewed' | 'retired';
  reviewed_by: number | null;
  reviewed_at: string | null;
};

export type MockExamRow = {
  id: number;
  topic_id: number;
  slug: string;
  title: string;
  version: number;
  time_limit_minutes: number;
  items: string;
  rubric: string;
  rubric_version: number;
  review_status: 'draft' | 'reviewed' | 'retired';
  reviewed_by: number | null;
  reviewed_at: string | null;
};

export const parseLessonBody = (lesson: LessonRow) => JSON.parse(lesson.body) as LessonBody;
export const parsePractice = (lesson: LessonRow) => JSON.parse(lesson.practice) as PracticeItem[];
export const parseFlashcards = (lesson: LessonRow) => JSON.parse(lesson.flashcards) as Flashcard[];
export const parseMockItems = (exam: MockExamRow) => JSON.parse(exam.items) as MockExamItem[];
export const parseMockRubric = (exam: MockExamRow) => JSON.parse(exam.rubric) as MockExamRubric;

export function getLesson(lessonId: number): LessonRow | undefined {
  return db.prepare('SELECT * FROM learn_lessons WHERE id = ?').get(lessonId) as LessonRow | undefined;
}

export function getMockExam(examId: number): MockExamRow | undefined {
  return db.prepare('SELECT * FROM learn_mock_exams WHERE id = ?').get(examId) as MockExamRow | undefined;
}

export function getTopicContext(topicId: number) {
  const topic = db.prepare(`
    SELECT t.*, s.slug as subject_slug, s.title as subject_title, s.udir_code, s.instruction_locale
    FROM learn_topics t
    JOIN learn_subjects s ON s.id = t.subject_id
    WHERE t.id = ?
  `).get(topicId) as any;

  if (!topic) {
    return null;
  }

  const goals = db.prepare(`
    SELECT g.id, g.goal_key, g.official_goal_ref, g.source_locator, g.goal_after_grade, g.description,
           g.description_is_paraphrase, g.verification_status, g.source_url, g.curriculum_revision
    FROM learn_topic_goals tg
    JOIN learn_goals g ON g.id = tg.goal_id
    WHERE tg.topic_id = ?
    ORDER BY g.id
  `).all(topicId) as any[];

  return {
    ...topic,
    goals: goals.map((goal) => ({
      ...goal,
      description_is_paraphrase: goal.description_is_paraphrase === 1,
      // Grade 8 content mapped to goals after grade 10 is a local teaching sequence
      is_local_sequence: goal.goal_after_grade !== topic.grade
    }))
  };
}

/**
 * Only the newest reviewed version of each lesson/exam slug is visible to
 * learners. Reviewers (admin) see every version.
 */
export function getVisibleLessons(topicId: number, includeUnreviewed: boolean): LessonRow[] {
  const rows = db.prepare(`
    SELECT * FROM learn_lessons
    WHERE topic_id = ? ${includeUnreviewed ? '' : "AND review_status = 'reviewed'"}
    ORDER BY sort_order, slug, version DESC
  `).all(topicId) as LessonRow[];

  if (includeUnreviewed) {
    return rows;
  }

  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.slug}:${row.locale}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function getVisibleMockExams(topicId: number, includeUnreviewed: boolean): MockExamRow[] {
  const rows = db.prepare(`
    SELECT * FROM learn_mock_exams
    WHERE topic_id = ? ${includeUnreviewed ? '' : "AND review_status = 'reviewed'"}
    ORDER BY slug, version DESC
  `).all(topicId) as MockExamRow[];

  if (includeUnreviewed) {
    return rows;
  }

  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.slug)) {
      return false;
    }
    seen.add(row.slug);
    return true;
  });
}

export function getCatalog(grade: number, includeUnreviewed: boolean) {
  const subjects = db.prepare('SELECT * FROM learn_subjects ORDER BY sort_order, title').all() as any[];
  const topics = db.prepare(`
    SELECT * FROM learn_topics WHERE grade = ? ORDER BY subject_id, sort_order, title
  `).all(grade) as any[];

  return subjects.map((subject) => ({
    id: subject.id,
    slug: subject.slug,
    title: subject.title,
    udir_code: subject.udir_code,
    instruction_locale: subject.instruction_locale,
    topics: topics
      .filter((topic) => topic.subject_id === subject.id)
      .map((topic) => {
        const context = getTopicContext(topic.id);
        const lessons = getVisibleLessons(topic.id, includeUnreviewed);
        const exams = getVisibleMockExams(topic.id, includeUnreviewed);
        return {
          id: topic.id,
          slug: topic.slug,
          grade: topic.grade,
          title: topic.title,
          summary: topic.summary,
          sort_order: topic.sort_order,
          prerequisite_topic_id: topic.prerequisite_topic_id,
          goals: context?.goals || [],
          lessons: lessons.map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            version: lesson.version,
            locale: lesson.locale,
            review_status: lesson.review_status
          })),
          mock_exams: exams.map((exam) => ({
            id: exam.id,
            title: exam.title,
            version: exam.version,
            time_limit_minutes: exam.time_limit_minutes,
            review_status: exam.review_status
          }))
        };
      })
  })).filter((subject) => subject.topics.length > 0);
}
