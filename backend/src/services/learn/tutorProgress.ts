import db from '../../database/init';
import { getVisibleLessons } from './catalog';
import { getPracticeResult } from './practice';
import type { TutorRecommendation } from './tutorCoach';

/** Read-only: never turn chat or client claims into progress. Identity comes from the session. */
export function tutorNextStep(profileId: number, topicId: number, currentLessonId: number): TutorRecommendation | null {
  const current = db.prepare('SELECT subject_id, grade FROM learn_topics WHERE id = ?').get(topicId) as { subject_id: number; grade: number };
  if (!current) return null;
  const topics = db.prepare(`
    SELECT t.id, COALESCE(MIN(ct.position), t.sort_order) as sequence
    FROM learn_topics t LEFT JOIN learn_course_topics ct ON ct.topic_id = t.id
    WHERE t.subject_id = ? AND t.grade = ?
    GROUP BY t.id ORDER BY sequence, t.sort_order, t.id
  `).all(current.subject_id, current.grade) as { id: number; sequence: number }[];
  // Use the learner catalog's reviewed slug/locale/version selection. Historical
  // results remain tied to their original lesson ID, never transferred to v2.
  const lessons = topics.flatMap(topic => getVisibleLessons(topic.id, false));
  const recentReviews = db.prepare(`SELECT feedback FROM learn_review_attempts WHERE profile_id = ? AND submitted_at IS NOT NULL ORDER BY submitted_at DESC LIMIT 10`).all(profileId) as { feedback: string | null }[];
  const revise = new Set<string>();
  for (const review of recentReviews) {
    try {
      const ids = JSON.parse(review.feedback || '{}').topics_to_revise;
      if (Array.isArray(ids)) for (const id of ids) if (typeof id === 'string') revise.add(id);
    } catch { /* An unusable legacy feedback row is not progress evidence. */ }
  }
  const now = new Date().toISOString();
  const candidates = lessons.map((lesson, index) => {
    const result = getPracticeResult(lesson.id, profileId);
    const cards = db.prepare(`SELECT
      SUM(CASE WHEN last_rating = 'missed' THEN 1 ELSE 0 END) as missed,
      SUM(CASE WHEN next_due_at <= ? THEN 1 ELSE 0 END) as due
      FROM learn_flashcard_reviews WHERE profile_id = ? AND lesson_id = ?`).get(now, profileId, lesson.id) as { missed: number; due: number };
    const reason: TutorRecommendation['reason'] = result && result.attempts > 0 && !result.passed ? 'practice_not_passed'
      : lesson.content_id && revise.has(lesson.content_id) ? 'review_paper_missed'
      : cards.missed > 0 ? 'flashcards_missed' : cards.due > 0 ? 'flashcards_due'
      : !result?.passed ? 'next_in_sequence' : 'review_current';
    const priority = ['practice_not_passed', 'review_paper_missed', 'flashcards_missed', 'flashcards_due', 'next_in_sequence', 'review_current'].indexOf(reason);
    return { lesson_id: lesson.id, title: lesson.title, reason, priority, index };
  });
  candidates.sort((a, b) => a.priority - b.priority || a.index - b.index);
  const first = candidates[0];
  if (!first) return null;
  if (first.reason === 'review_current') {
    const currentLesson = lessons.find(l => l.id === currentLessonId) ?? lessons[0];
    return { lesson_id: currentLesson.id, title: currentLesson.title, reason: 'review_current' };
  }
  return { lesson_id: first.lesson_id, title: first.title, reason: first.reason };
}
