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
      instruction_locale = excluded.instruction_locale,
      sort_order = excluded.sort_order
  `);
  // udir_code is deliberately not refreshed here. These fixtures carry the
  // pre-2026 grade 8 pilot codes, and startup seeds before importing, so
  // refreshing it would put an obsolete code back on every restart. The content
  // package's source registry owns that column; a fresh row still starts with
  // the fixture's code until the first import reconciles it.
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
  // Grades 1-10 research package (NULL/defaults for pilot seed rows)
  content_id: string | null;
  content_meta: string;
  open_prompts: string;
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
  // The catalogue reports the course's curriculum code for the grade and falls
  // back to the subject's; topic detail has to agree, or one topic shows a
  // current code in one place and an obsolete one in the other
  const topic = db.prepare(`
    SELECT t.*, s.slug as subject_slug, s.title as subject_title, s.instruction_locale,
           COALESCE(c.curriculum_code, s.udir_code) as udir_code
    FROM learn_topics t
    JOIN learn_subjects s ON s.id = t.subject_id
    LEFT JOIN learn_courses c ON c.subject_id = s.id AND c.grade = t.grade
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
    SELECT * FROM learn_lessons AS lesson
    WHERE topic_id = ? ${includeUnreviewed ? '' : `AND review_status = 'reviewed'
      AND NOT EXISTS (
        SELECT 1 FROM learn_lessons AS newer
        WHERE newer.topic_id = lesson.topic_id AND newer.slug = lesson.slug AND newer.locale = lesson.locale
          AND newer.review_status = 'reviewed' AND newer.version > lesson.version
      )`}
    ORDER BY content_id IS NOT NULL, sort_order, slug, version DESC
  `).all(topicId) as LessonRow[];

  return rows;
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

export type LessonContentMeta = {
  source?: { package: string; file: string; content_id: string; content_hash: string; imported_at: string };
  curriculum?: {
    code: string;
    official_checkpoint_after_grade: number;
    competence_goal_source_url: string;
    lesson_specific_goal_crosswalk: string;
    topic_sequence_type: string;
  };
  assessment_mode?: string;
  local_domain?: string | null;
  source_locale?: string;
  estimated_minutes?: number;
  content_warnings?: string[];
};

export const parseContentMeta = (lesson: LessonRow) => JSON.parse(lesson.content_meta || '{}') as LessonContentMeta;
export const parseOpenPrompts = (lesson: LessonRow) =>
  JSON.parse(lesson.open_prompts || '[]') as Array<{ key: string; question: string; model_answer: string }>;

type CourseRow = {
  id: number; course_key: string; subject_id: number; grade: number; title: string; curriculum_code: string;
  checkpoint_after_grade: number; checkpoint_url: string; track_type: string; assessment_mode: string;
  grading_mode: string; locale: string;
};

type CourseTopicRow = {
  course_id: number; topic_id: number; position: number; prerequisite_topic_id: number | null;
  optional_challenge: number; estimated_minutes: number | null;
};

/** Grades 1-7 are formative only; grades 8-10 may show non-official mock exam results. */
export const assessmentPolicyForGrade = (grade: number) => ({
  formative_only: grade <= 7,
  numeric_grades_allowed: grade >= 8 ? 'rubric_backed_mock_exams_only' as const : 'never' as const,
  review_papers_numeric_grade: false
});

export function presentCourse(course: CourseRow) {
  return {
    id: course.id,
    course_key: course.course_key,
    title: course.title,
    curriculum_code: course.curriculum_code,
    checkpoint_after_grade: course.checkpoint_after_grade,
    checkpoint_url: course.checkpoint_url,
    checkpoint_is_this_grade: course.checkpoint_after_grade === course.grade,
    track_type: course.track_type,
    assessment_mode: course.assessment_mode,
    grading_mode: course.grading_mode,
    locale: course.locale
  };
}

function visibleReviewPapers(courseId: number, includeUnreviewed: boolean) {
  const rows = db.prepare(`
    SELECT id, content_id, version, title, duration_minutes, mode, review_status, items FROM learn_review_papers
    WHERE course_id = ? ${includeUnreviewed ? '' : "AND review_status = 'reviewed'"}
    ORDER BY content_id, version DESC
  `).all(courseId) as Array<{ id: number; content_id: string; version: number; title: string; duration_minutes: number; mode: string; review_status: string; items: string }>;

  // Learners get the newest reviewed version of each paper; reviewers see every version
  const seen = new Set<string>();
  return rows
    .filter((row) => {
      if (includeUnreviewed) return true;
      if (seen.has(row.content_id)) return false;
      seen.add(row.content_id);
      return true;
    })
    .map(({ items, ...row }) => ({ ...row, item_count: (JSON.parse(items) as unknown[]).length }));
}

export function getCatalog(grade: number, includeUnreviewed: boolean) {
  const subjects = db.prepare('SELECT * FROM learn_subjects ORDER BY sort_order, title').all() as any[];
  const topics = db.prepare(`
    SELECT * FROM learn_topics WHERE grade = ? ORDER BY subject_id, sort_order, title
  `).all(grade) as any[];
  const courses = db.prepare('SELECT * FROM learn_courses WHERE grade = ?').all(grade) as CourseRow[];
  const courseTopics = db.prepare(`
    SELECT ct.* FROM learn_course_topics ct JOIN learn_courses c ON c.id = ct.course_id WHERE c.grade = ?
  `).all(grade) as CourseTopicRow[];
  const placement = new Map(courseTopics.map((row) => [row.topic_id, row]));

  return subjects.map((subject) => {
    const course = courses.find((item) => item.subject_id === subject.id) || null;
    const subjectTopics = topics
      .filter((topic) => topic.subject_id === subject.id)
      .map((topic) => {
        const context = getTopicContext(topic.id);
        const lessons = getVisibleLessons(topic.id, includeUnreviewed);
        const exams = getVisibleMockExams(topic.id, includeUnreviewed);
        const place = placement.get(topic.id);
        return {
          id: topic.id,
          slug: topic.slug,
          grade: topic.grade,
          title: topic.title,
          summary: topic.summary,
          sort_order: topic.sort_order,
          course_position: place?.position ?? null,
          prerequisite_topic_id: place?.prerequisite_topic_id ?? topic.prerequisite_topic_id,
          optional_challenge: place ? place.optional_challenge === 1 : false,
          estimated_minutes: place?.estimated_minutes ?? null,
          goals: context?.goals || [],
          lessons: lessons.map((lesson) => ({
            id: lesson.id,
            title: lesson.title,
            version: lesson.version,
            locale: lesson.locale,
            content_id: lesson.content_id,
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
      // Course order first; topics outside a course follow in their own order
      .sort((a, b) => (a.course_position ?? 1000 + a.sort_order) - (b.course_position ?? 1000 + b.sort_order));

    const hasReviewedLesson = (topic: (typeof subjectTopics)[number]) =>
      topic.lessons.some((lesson) => lesson.review_status === 'reviewed');
    // Learners never see a topic (not even its title) until it has reviewed content
    const visibleTopics = includeUnreviewed
      ? subjectTopics
      : subjectTopics.filter((topic) => topic.lessons.length > 0 || topic.mock_exams.length > 0);

    return {
      id: subject.id,
      slug: subject.slug,
      title: subject.title,
      udir_code: course?.curriculum_code || subject.udir_code,
      instruction_locale: subject.instruction_locale,
      course: course ? presentCourse(course) : null,
      topics: visibleTopics,
      review_papers: course ? visibleReviewPapers(course.id, includeUnreviewed) : [],
      content_gap: {
        topics_planned: subjectTopics.length,
        topics_available: subjectTopics.filter(hasReviewedLesson).length
      }
    };
  }).filter((subject) => subject.topics.length > 0 || subject.course);
}

/** Per grade x subject availability for the grade picker. Counts only, never draft titles. */
export function getCatalogOverview() {
  const rows = db.prepare(`
    SELECT t.grade, s.slug as subject_slug, s.title as subject_title,
           COUNT(DISTINCT t.id) as topics_planned,
           COUNT(DISTINCT CASE WHEN l.review_status = 'reviewed' THEN t.id END) as topics_available
    FROM learn_topics t
    JOIN learn_subjects s ON s.id = t.subject_id
    LEFT JOIN learn_lessons l ON l.topic_id = t.id
    GROUP BY t.grade, s.id
    ORDER BY t.grade, s.sort_order
  `).all() as Array<{ grade: number; subject_slug: string; subject_title: string; topics_planned: number; topics_available: number }>;
  const papers = db.prepare(`
    SELECT c.grade, s.slug as subject_slug, COUNT(DISTINCT p.content_id) as papers_available
    FROM learn_review_papers p
    JOIN learn_courses c ON c.id = p.course_id
    JOIN learn_subjects s ON s.id = c.subject_id
    WHERE p.review_status = 'reviewed'
    GROUP BY c.grade, s.id
  `).all() as Array<{ grade: number; subject_slug: string; papers_available: number }>;
  const paperCount = new Map(papers.map((row) => [`${row.grade}:${row.subject_slug}`, row.papers_available]));

  return Array.from({ length: 10 }, (_, index) => index + 1).map((grade) => {
    const subjects = rows.filter((row) => row.grade === grade).map((row) => ({
      slug: row.subject_slug,
      title: row.subject_title,
      topics_planned: row.topics_planned,
      topics_available: row.topics_available,
      review_papers_available: paperCount.get(`${grade}:${row.subject_slug}`) || 0
    }));
    return {
      grade,
      assessment_policy: assessmentPolicyForGrade(grade),
      topics_planned: subjects.reduce((sum, subject) => sum + subject.topics_planned, 0),
      topics_available: subjects.reduce((sum, subject) => sum + subject.topics_available, 0),
      subjects
    };
  });
}

/** Previous/next topics of a lesson's course, limited to what the viewer may open. */
export function getCourseNavigation(topicId: number, includeUnreviewed: boolean) {
  const place = db.prepare(`
    SELECT ct.*, c.course_key, c.title as course_title FROM learn_course_topics ct
    JOIN learn_courses c ON c.id = ct.course_id WHERE ct.topic_id = ?
  `).get(topicId) as (CourseTopicRow & { course_key: string; course_title: string }) | undefined;
  if (!place) return null;

  const steps = (db.prepare(`
    SELECT ct.topic_id, ct.position, t.title FROM learn_course_topics ct
    JOIN learn_topics t ON t.id = ct.topic_id WHERE ct.course_id = ? ORDER BY ct.position
  `).all(place.course_id) as Array<{ topic_id: number; position: number; title: string }>)
    .map((step) => ({ ...step, lesson_id: getVisibleLessons(step.topic_id, includeUnreviewed)[0]?.id ?? null }))
    .filter((step) => step.lesson_id !== null);

  const index = steps.findIndex((step) => step.topic_id === topicId);
  return {
    course_key: place.course_key,
    course_title: place.course_title,
    position: place.position,
    previous: index > 0 ? steps[index - 1] : null,
    next: index >= 0 && index < steps.length - 1 ? steps[index + 1] : null
  };
}
