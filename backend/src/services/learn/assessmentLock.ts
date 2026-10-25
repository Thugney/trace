import type { Response } from 'express';
import db from '../../database/init';

/**
 * The server-side lock that keeps study aids shut while a test is running.
 *
 * Review papers and mock exams reuse the lesson practice questions, so the
 * tutor, practice delivery, model answers and earlier answer keys all stay
 * closed until the learner submits. Both the Learn routes and the existing
 * activity engine consult this, because Learn practice is delivered through
 * /api/activities: locking only the Learn setup endpoint would leave the
 * already-materialized session readable during a paper.
 */

export type OpenAssessment = { kind: 'mock_exam' | 'review_paper'; attempt_id: number };

const nowIso = () => new Date().toISOString();

/** Any running mock exam or review paper for this learner. */
export function getOpenAssessment(profileId: number): OpenAssessment | null {
  try {
    const mock = db.prepare(`
      SELECT id FROM learn_mock_attempts
      WHERE profile_id = ? AND submitted_at IS NULL AND expires_at > ?
      ORDER BY started_at DESC LIMIT 1
    `).get(profileId, nowIso()) as { id: number } | undefined;
    if (mock) return { kind: 'mock_exam', attempt_id: mock.id };

    const review = db.prepare(`
      SELECT id FROM learn_review_attempts
      WHERE profile_id = ? AND submitted_at IS NULL AND expires_at > ?
      ORDER BY started_at DESC LIMIT 1
    `).get(profileId, nowIso()) as { id: number } | undefined;
    return review ? { kind: 'review_paper', attempt_id: review.id } : null;
  } catch {
    // learn_* tables absent (Learn never initialized): nothing can be locked
    return null;
  }
}

/** True when an activity-engine session is a materialized Learn practice session. */
export function isLearnPracticeSession(sessionId: number): boolean {
  try {
    return Boolean(db.prepare(`
      SELECT 1 FROM learn_resource_links WHERE kind = 'activity' AND existing_resource_id = ?
    `).get(sessionId));
  } catch {
    // learn_* tables absent: not a Learn session, so the engine behaves as before
    return false;
  }
}

/**
 * The learner's open assessment, unless it is the very attempt being acted on.
 *
 * Acting on the attempt that is running is legitimate; acting on a different one
 * while a test is open is not. An attempt that expires unsubmitted drops out of
 * `getOpenAssessment` (which counts only unexpired rows), so submitting it late
 * would otherwise hand back the answer key of the test still in progress.
 */
export function getBlockingAssessment(
  profileId: number,
  self?: { kind: OpenAssessment['kind']; attempt_id: number }
): OpenAssessment | null {
  const open = getOpenAssessment(profileId);
  if (!open) return null;
  if (self && open.kind === self.kind && open.attempt_id === self.attempt_id) return null;
  return open;
}

export const assessmentLocked = (res: Response, open: OpenAssessment) =>
  res.status(423).json({ error: 'Not available while a test is in progress', code: 'exam_in_progress', ...open });
