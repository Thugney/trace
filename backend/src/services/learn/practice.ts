import db from '../../database/init';
import { parsePractice, type LessonRow } from './catalog';

/**
 * Adapter from a reviewed Learn lesson to the existing Learning Activity Engine.
 *
 * Practice is materialized once per learner as a `learning_sessions` row
 * (created by the learner's guardian, assigned to the learner) and linked via
 * learn_resource_links. Delivery, attempts and scoring then use the existing
 * /api/activities endpoints, so scores always come from server-verified
 * session_attempts and never from client-reported marks.
 */

export class PracticeUnavailableError extends Error {}

function resolveSessionOwner(learner: { id: number; type: string; parent_id?: number | null }): number {
  if (learner.type !== 'child') {
    // Adults practising for themselves own their own copy
    return learner.id;
  }

  if (learner.parent_id) {
    return learner.parent_id;
  }

  const guardian = db.prepare(`
    SELECT guardian_id FROM guardian_students WHERE student_id = ? ORDER BY guardian_id LIMIT 1
  `).get(learner.id) as { guardian_id: number } | undefined;

  if (!guardian) {
    // A child must never own (and therefore be able to edit) its own answer key
    throw new PracticeUnavailableError('Practice needs a linked parent or guardian');
  }

  return guardian.guardian_id;
}

export function getLinkedPracticeSessionId(lessonId: number, learnerId: number): number | null {
  const link = db.prepare(`
    SELECT l.existing_resource_id
    FROM learn_resource_links l
    JOIN learning_sessions ls ON ls.id = l.existing_resource_id
    WHERE l.lesson_id = ? AND l.kind = 'activity' AND l.learner_profile_id = ?
  `).get(lessonId, learnerId) as { existing_resource_id: number } | undefined;

  return link?.existing_resource_id ?? null;
}

export function ensurePracticeSession(
  lesson: LessonRow,
  learner: { id: number; type: string; parent_id?: number | null }
): number {
  const existing = getLinkedPracticeSessionId(lesson.id, learner.id);
  if (existing) {
    return existing;
  }

  const items = parsePractice(lesson);
  if (items.length === 0) {
    throw new PracticeUnavailableError('This lesson has no practice items');
  }

  const ownerId = resolveSessionOwner(learner);
  const typeIds = new Map<string, number>();
  for (const item of items) {
    if (!typeIds.has(item.type)) {
      const type = db.prepare('SELECT id FROM activity_types WHERE name = ?').get(item.type) as { id: number } | undefined;
      if (!type) {
        throw new PracticeUnavailableError(`Activity type ${item.type} is not installed`);
      }
      typeIds.set(item.type, type.id);
    }
  }

  const create = db.transaction(() => {
    // Remove a stale link whose session was deleted outside Learn
    db.prepare(`
      DELETE FROM learn_resource_links WHERE lesson_id = ? AND kind = 'activity' AND learner_profile_id = ?
    `).run(lesson.id, learner.id);

    const session = db.prepare(`
      INSERT INTO learning_sessions (
        title, description, topic, created_by, assigned_to,
        points_per_activity, stars_per_session, bonus_points, pass_threshold, is_ai_generated
      ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, 70, 0)
    `).run(
      `Learn: ${lesson.title}`,
      `FamilyHub Learn practice (lesson ${lesson.id}, version ${lesson.version})`,
      lesson.title,
      ownerId,
      learner.id
    );
    const sessionId = Number(session.lastInsertRowid);

    const insertActivity = db.prepare(`
      INSERT INTO learning_activities (
        session_id, activity_type_id, title, instructions, content_data, correct_data,
        hints, explanation, points, order_index
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 20, ?)
    `);
    items.forEach((item, index) => {
      insertActivity.run(
        sessionId, typeIds.get(item.type), item.title, item.instructions || null,
        JSON.stringify(item.content), JSON.stringify(item.correct),
        JSON.stringify(item.hints), item.explanation, index
      );
    });

    db.prepare(`
      INSERT INTO learn_resource_links (lesson_id, kind, existing_resource_id, learner_profile_id, created_by)
      VALUES (?, 'activity', ?, ?, ?)
    `).run(lesson.id, sessionId, learner.id, ownerId);

    return sessionId;
  });

  return create();
}

/**
 * Best verified practice result for a learner, read from the activity engine.
 */
export function getPracticeResult(lessonId: number, learnerId: number) {
  const sessionId = getLinkedPracticeSessionId(lessonId, learnerId);
  if (!sessionId) {
    return null;
  }

  const best = db.prepare(`
    SELECT id, score_percentage, passed, completed_at
    FROM session_attempts
    WHERE session_id = ? AND profile_id = ? AND completed_at IS NOT NULL
    ORDER BY score_percentage DESC, completed_at DESC
    LIMIT 1
  `).get(sessionId, learnerId) as { id: number; score_percentage: number; passed: number; completed_at: string } | undefined;

  const attempts = db.prepare(`
    SELECT COUNT(*) as n FROM session_attempts WHERE session_id = ? AND profile_id = ? AND completed_at IS NOT NULL
  `).get(sessionId, learnerId) as { n: number };

  return {
    sessionId,
    attempts: attempts.n,
    bestAttemptId: best?.id ?? null,
    bestPercent: best?.score_percentage ?? null,
    passed: best ? best.passed === 1 : false,
    lastCompletedAt: best?.completed_at ?? null
  };
}

/**
 * Learn practice sessions award economy points only for the learner's first
 * passed attempt, so repeated practice cannot farm points or spam guardians.
 * Returns false when the session is not a Learn practice session.
 */
export function isRepeatLearnPracticeCompletion(sessionId: number, profileId: number, attemptId: number): boolean {
  try {
    const link = db.prepare(`
      SELECT 1 FROM learn_resource_links WHERE kind = 'activity' AND existing_resource_id = ?
    `).get(sessionId);

    if (!link) {
      return false;
    }

    const previousPass = db.prepare(`
      SELECT 1 FROM session_attempts
      WHERE session_id = ? AND profile_id = ? AND passed = 1 AND completed_at IS NOT NULL AND id != ?
      LIMIT 1
    `).get(sessionId, profileId, attemptId);

    return Boolean(previousPass);
  } catch {
    // learn_* tables absent (Learn never initialized): not a Learn session
    return false;
  }
}
