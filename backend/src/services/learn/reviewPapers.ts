import db from '../../database/init';
import type { SourcePaper, SourcePaperQuestion } from './contentPackage';

/**
 * Formative review papers (docs/learn/content/grade1-10-assessment-papers.json).
 *
 * These are short, uncalibrated study papers. The server scores the keyed
 * single-select items, stores open responses for a parent's feedback and
 * points the learner at topics to revise. They never produce a numerical
 * grade, for any school year: the package's score_policy forbids it and no
 * separately validated rubric exists.
 */

export type ReviewPaperRow = {
  id: number;
  content_id: string;
  version: number;
  course_id: number;
  title: string;
  mode: string;
  duration_minutes: number;
  instructions: string;
  items: string;
  score_policy: string;
  source_lesson_ids: string;
  content_hash: string;
  review_status: 'draft' | 'reviewed' | 'retired';
  reviewed_by: number | null;
  reviewed_at: string | null;
};

export const parsePaperItems = (paper: ReviewPaperRow) => JSON.parse(paper.items) as SourcePaperQuestion[];
export const parseScorePolicy = (paper: ReviewPaperRow) => JSON.parse(paper.score_policy) as SourcePaper['score_policy'];

export function getReviewPaper(paperId: number): ReviewPaperRow | undefined {
  return db.prepare('SELECT * FROM learn_review_papers WHERE id = ?').get(paperId) as ReviewPaperRow | undefined;
}

export function getPaperContext(paper: ReviewPaperRow) {
  return db.prepare(`
    SELECT c.id as course_id, c.course_key, c.grade, c.assessment_mode, c.curriculum_code, c.checkpoint_after_grade,
           s.slug as subject_slug, s.title as subject_title, s.instruction_locale
    FROM learn_courses c JOIN learn_subjects s ON s.id = c.subject_id
    WHERE c.id = ?
  `).get(paper.course_id) as {
    course_id: number; course_key: string; grade: number; assessment_mode: string; curriculum_code: string;
    checkpoint_after_grade: number; subject_slug: string; subject_title: string; instruction_locale: 'nb' | 'en';
  };
}

export type SourceLessonRow = { id: number; content_id: string; title: string; version: number; review_status: string };

/**
 * Newest *visible* version of each source lesson, keyed by content_id (titles and links).
 *
 * Visibility is filtered before the newest version is picked, because a learner
 * only ever sees reviewed lessons: selecting the newest first would drop the link
 * entirely whenever the content has since been drafted again or the newest version
 * was retired, which is the ordinary draft-review publishing workflow. Reviewers
 * pass includeUnreviewed to keep seeing the draft they are working on.
 */
export function getSourceLessons(paper: ReviewPaperRow, options: { includeUnreviewed?: boolean } = {}) {
  const ids = JSON.parse(paper.source_lesson_ids) as string[];
  const byContentId = new Map<string, SourceLessonRow>();
  if (ids.length === 0) return byContentId;

  const rows = db.prepare(`
    SELECT id, content_id, title, version, review_status FROM learn_lessons
    WHERE content_id IN (${ids.map(() => '?').join(',')})
    ${options.includeUnreviewed ? '' : "AND review_status = 'reviewed'"}
    ORDER BY version DESC
  `).all(...ids) as SourceLessonRow[];
  for (const row of rows) {
    if (!byContentId.has(row.content_id)) byContentId.set(row.content_id, row);
  }
  return byContentId;
}

/** Items as shown during an active attempt: no keys, answers, explanations or expected content. */
export function presentItemsForAttempt(items: SourcePaperQuestion[]) {
  return items.map((item) => ({
    key: item.id,
    kind: item.kind,
    prompt: item.prompt,
    source_lesson_id: item.source_lesson_id,
    options: item.kind === 'single_select' ? item.options.map((option) => ({ key: option.key, label: option.label })) : undefined,
    requires_human_review: item.kind === 'open_response'
  }));
}

export const MAX_OPEN_RESPONSE_LENGTH = 2000;

export function sanitizeResponses(items: SourcePaperQuestion[], raw: unknown): Record<string, string> {
  const responses: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return responses;
  for (const item of items) {
    const value = (raw as Record<string, unknown>)[item.id];
    if (typeof value !== 'string' || !value.trim()) continue;
    if (item.kind === 'single_select') {
      // Only an offered option key counts as an answer
      if (item.options.some((option) => option.key === value)) responses[item.id] = value;
    } else {
      responses[item.id] = value.trim().slice(0, MAX_OPEN_RESPONSE_LENGTH);
    }
  }
  return responses;
}

export type ReviewFeedback = {
  items: Array<{
    key: string;
    kind: SourcePaperQuestion['kind'];
    source_lesson_id: string;
    answered: boolean;
    response: string | null;
    correct: boolean | null;
    correct_key?: string;
    correct_answer?: string;
    explanation?: string;
    expected_content?: string;
    requires_human_review: boolean;
  }>;
  objective_correct: number;
  objective_total: number;
  open_answered: number;
  open_total: number;
  topics_to_revise: string[];
  topics_secure: string[];
  reflection_prompts: string[];
  numeric_grade: null;
  numeric_grade_allowed: false;
};

export function scoreReviewPaper(items: SourcePaperQuestion[], policy: SourcePaper['score_policy'], responses: Record<string, string>): ReviewFeedback {
  const toRevise = new Set<string>();
  const secure = new Set<string>();
  const results = items.map((item) => {
    const response = responses[item.id] ?? null;
    if (item.kind === 'single_select') {
      const correct = response === item.correct_key;
      (correct ? secure : toRevise).add(item.source_lesson_id);
      return {
        key: item.id, kind: item.kind, source_lesson_id: item.source_lesson_id, answered: response !== null, response,
        correct, correct_key: item.correct_key, correct_answer: item.correct_answer, explanation: item.explanation,
        requires_human_review: false
      };
    }
    return {
      key: item.id, kind: item.kind, source_lesson_id: item.source_lesson_id, answered: response !== null, response,
      correct: null, expected_content: item.expected_content, requires_human_review: true
    };
  });

  const objective = results.filter((item) => item.kind === 'single_select');
  const open = results.filter((item) => item.kind === 'open_response');
  for (const lessonId of toRevise) secure.delete(lessonId);

  return {
    items: results,
    objective_correct: objective.filter((item) => item.correct).length,
    objective_total: objective.length,
    open_answered: open.filter((item) => item.answered).length,
    open_total: open.length,
    topics_to_revise: [...toRevise],
    topics_secure: [...secure],
    reflection_prompts: Array.isArray(policy.learner_feedback) ? policy.learner_feedback : [],
    numeric_grade: null,
    numeric_grade_allowed: false
  };
}

// Points for the first submitted attempt only, so retakes cannot farm rewards
export const REVIEW_POINTS_PER_CORRECT = 5;
