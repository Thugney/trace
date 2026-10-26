import express, { NextFunction, Response } from 'express';
import db from '../database/init';
import { authenticate, type AuthRequest } from '../middleware/auth';
import { requireFeature, isSchoolOnlyModeEnabled, getSchoolOnlyAllowedFeatures } from '../middleware/feature-access';
import { canAccessOwnOrManagedChild, getManagedChildIdsForParent } from '../services/familyAccess';
import { isFeatureEnabledForProfile } from '../services/profileFeatures';
import { sendPushNotification } from '../services/notifications';
import { canGenerateAi, logAiUsage } from '../services/aiUsageControl';
import { generateTextWithProviderFallback, getAISettings } from './ai';
import { awardPoints } from '../services/economyControl';
import {
  assessmentPolicyForGrade,
  getCatalog,
  getCatalogOverview,
  getCourseNavigation,
  getLesson,
  getMockExam,
  getTopicContext,
  getVisibleLessons,
  getVisibleMockExams,
  parseContentMeta,
  parseFlashcards,
  parseLessonBody,
  parseMockItems,
  parseMockRubric,
  parseOpenPrompts,
  parsePractice,
  type LessonRow,
  type MockExamRow
} from '../services/learn/catalog';
import { ensurePracticeSession, getPracticeResult, PracticeUnavailableError } from '../services/learn/practice';
import { assessmentLocked, getOpenAssessment } from '../services/learn/assessmentLock';
import { scoreMockExam } from '../services/learn/mockScoring';
import { buildTutorPrompt, buildTutorFallback } from '../services/learn/tutor';
import {
  getPaperContext,
  getReviewPaper,
  getSourceLessons,
  parsePaperItems,
  parseScorePolicy,
  presentItemsForAttempt,
  sanitizeResponses,
  scoreReviewPaper,
  MAX_OPEN_RESPONSE_LENGTH,
  REVIEW_POINTS_PER_CORRECT,
  type ReviewFeedback,
  type ReviewPaperRow
} from '../services/learn/reviewPapers';
import { importContentPackage, pilotGrade8Topics } from '../services/learn/contentImport';
import { loadContentPackage, validateContentPackage } from '../services/learn/contentPackage';

/**
 * FamilyHub Learn API (docs/familyhub-learn-architecture.md §5).
 * All identity comes from the server session; every object is checked against
 * the viewer: child = self, guardian = managed children, admin = audited.
 */
const router = express.Router();

const MASTERY_PERCENT = 85;
const MOCK_SUBMIT_GRACE_MS = 2 * 60 * 1000;
const FLASHCARD_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];
const REVIEW_STATUSES = ['draft', 'reviewed', 'retired'];

const nowIso = () => new Date().toISOString();
const isReviewer = (req: AuthRequest) => req.profile!.type === 'admin';

function audit(req: AuthRequest, action: string, entityType: string, entityId: number | null, details: Record<string, unknown> = {}) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (action, entity_type, entity_id, actor_id, actor_type, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(action, entityType, entityId, req.profile!.id, req.profile!.type, JSON.stringify(details), req.ip || null);
  } catch (error: any) {
    console.error('[Learn] Audit log failed:', error.message);
  }
}

function isLearnGloballyEnabled(): boolean {
  const setting = db.prepare("SELECT value FROM settings WHERE key = 'learn_enabled'").get() as { value: string } | undefined;
  return setting?.value !== 'false';
}

// Global kill switch: `learn_enabled = false` turns Learn off for everyone (rollback lever)
const requireLearnEnabled = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!isLearnGloballyEnabled()) {
    return res.status(403).json({ error: 'FamilyHub Learn is switched off', code: 'learn_disabled' });
  }
  next();
};

const parseId = (value: unknown): number | null => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

function loadVisibleLesson(req: AuthRequest, res: Response): LessonRow | null {
  const lessonId = parseId(req.params.lessonId);
  const lesson = lessonId ? getLesson(lessonId) : undefined;
  if (!lesson || (lesson.review_status !== 'reviewed' && !isReviewer(req))) {
    res.status(404).json({ error: 'Lesson not found' });
    return null;
  }
  return lesson;
}

function loadVisibleExam(req: AuthRequest, res: Response): MockExamRow | null {
  const examId = parseId(req.params.examId);
  const exam = examId ? getMockExam(examId) : undefined;
  if (!exam || (exam.review_status !== 'reviewed' && !isReviewer(req))) {
    res.status(404).json({ error: 'Mock exam not found' });
    return null;
  }
  return exam;
}

function getOpenMockAttempt(profileId: number) {
  return db.prepare(`
    SELECT * FROM learn_mock_attempts
    WHERE profile_id = ? AND submitted_at IS NULL AND expires_at > ?
    ORDER BY started_at DESC LIMIT 1
  `).get(profileId, nowIso()) as any;
}

function getOpenReviewAttempt(profileId: number) {
  return db.prepare(`
    SELECT * FROM learn_review_attempts
    WHERE profile_id = ? AND submitted_at IS NULL AND expires_at > ?
    ORDER BY started_at DESC LIMIT 1
  `).get(profileId, nowIso()) as any;
}

// ---------------------------------------------------------------- learner settings (profiles.settings JSON)

function readProfileSettings(profileId: number): Record<string, any> {
  const row = db.prepare('SELECT settings FROM profiles WHERE id = ?').get(profileId) as { settings: string | null } | undefined;
  try {
    return JSON.parse(row?.settings || '{}') || {};
  } catch {
    return {};
  }
}

function patchProfileSettings(profileId: number, patch: Record<string, unknown>) {
  const settings = { ...readProfileSettings(profileId), ...patch };
  db.prepare('UPDATE profiles SET settings = ? WHERE id = ?').run(JSON.stringify(settings), profileId);
}

const isGrade = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 10;

function getLearnerSettings(profileId: number) {
  const profile = db.prepare('SELECT age FROM profiles WHERE id = ?').get(profileId) as { age: number | null } | undefined;
  const settings = readProfileSettings(profileId);
  const age = Number(profile?.age);
  return {
    grade: isGrade(settings.learn_grade) ? settings.learn_grade : null,
    // Norwegian pupils start Year 1 the year they turn six
    suggested_grade: Number.isFinite(age) && age > 0 ? Math.min(10, Math.max(1, age - 5)) : null,
    tutor_enabled: settings.learn_tutor_enabled !== false
  };
}

/** The tutor needs the existing AI feature, the profile's ai_enabled switch and the Learn tutor switch. */
function isTutorAvailable(profile: { id: number; type: any; parent_id?: number | null }) {
  if (profile.type === 'admin') return true;
  return isFeatureEnabledForProfile(profile, 'ai')
    && getAISettings(profile.id).ai_enabled === 1
    && getLearnerSettings(profile.id).tutor_enabled;
}

function topicGradeOf(topicId: number): number {
  return (db.prepare('SELECT grade FROM learn_topics WHERE id = ?').get(topicId) as { grade: number } | undefined)?.grade ?? 8;
}

function presentLesson(lesson: LessonRow) {
  const practice = parsePractice(lesson);
  const meta = parseContentMeta(lesson);
  return {
    id: lesson.id,
    topic_id: lesson.topic_id,
    slug: lesson.slug,
    title: lesson.title,
    locale: lesson.locale,
    version: lesson.version,
    authored_by: lesson.authored_by,
    review_status: lesson.review_status,
    reviewed_at: lesson.reviewed_at,
    content_id: lesson.content_id,
    meta: {
      curriculum: meta.curriculum ?? null,
      assessment_mode: meta.assessment_mode ?? null,
      estimated_minutes: meta.estimated_minutes ?? null,
      source_locale: meta.source_locale ?? null
    },
    body: parseLessonBody(lesson),
    flashcards: parseFlashcards(lesson),
    // Practice answer keys stay in the activity engine; only a summary is exposed here
    practice: practice.map((item) => ({ key: item.key, type: item.type, title: item.title })),
    // Open prompts are shown without their model answer until the learner has responded
    open_prompts: parseOpenPrompts(lesson).map((prompt) => ({ key: prompt.key, question: prompt.question }))
  };
}

function visibleReviewPaper(req: AuthRequest, res: Response): ReviewPaperRow | null {
  const paperId = parseId(req.params.paperId);
  const paper = paperId ? getReviewPaper(paperId) : undefined;
  if (!paper || (paper.review_status !== 'reviewed' && !isReviewer(req))) {
    res.status(404).json({ error: 'Review paper not found' });
    return null;
  }
  return paper;
}

// ---------------------------------------------------------------- progress model

function buildLearnerProgress(learnerId: number) {
  const lessons = db.prepare(`
    SELECT l.id, l.title, l.topic_id, l.version, l.content_id, t.title as topic_title, t.grade, s.title as subject_title, s.slug as subject_slug
    FROM learn_lessons l
    JOIN learn_topics t ON t.id = l.topic_id
    JOIN learn_subjects s ON s.id = t.subject_id
    WHERE l.review_status = 'reviewed'
    ORDER BY s.sort_order, t.sort_order, l.sort_order
  `).all() as any[];

  const upsert = db.prepare(`
    INSERT INTO learn_progress (profile_id, lesson_id, state, practiced_at, best_practice_percent, practice_attempt_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(profile_id, lesson_id) DO UPDATE SET
      state = excluded.state,
      practiced_at = COALESCE(excluded.practiced_at, learn_progress.practiced_at),
      best_practice_percent = excluded.best_practice_percent,
      practice_attempt_id = excluded.practice_attempt_id,
      updated_at = excluded.updated_at
  `);

  const lessonProgress = lessons.map((lesson) => {
    const stored = db.prepare('SELECT * FROM learn_progress WHERE profile_id = ? AND lesson_id = ?').get(learnerId, lesson.id) as any;
    const practice = getPracticeResult(lesson.id, learnerId);

    // State is derived on the server from verified engine attempts only
    let state: 'not_started' | 'reading' | 'practiced' | 'mastered' = stored?.read_at ? 'reading' : 'not_started';
    if (practice?.passed) state = 'practiced';
    if (practice?.bestPercent !== null && practice?.bestPercent !== undefined && practice.bestPercent >= MASTERY_PERCENT) state = 'mastered';

    if (stored || practice) {
      upsert.run(
        learnerId, lesson.id, state, practice?.lastCompletedAt ?? null,
        practice?.bestPercent ?? null, practice?.bestAttemptId ?? null, nowIso()
      );
    }

    const flashcardsDue = (db.prepare(`
      SELECT COUNT(*) as n FROM learn_flashcard_reviews WHERE profile_id = ? AND lesson_id = ? AND next_due_at <= ?
    `).get(learnerId, lesson.id, nowIso()) as { n: number }).n;

    return {
      lesson_id: lesson.id,
      lesson_title: lesson.title,
      topic_id: lesson.topic_id,
      topic_title: lesson.topic_title,
      subject_title: lesson.subject_title,
      subject_slug: lesson.subject_slug,
      grade: lesson.grade,
      content_id: lesson.content_id,
      state,
      read_at: stored?.read_at ?? null,
      practice: practice
        ? { attempts: practice.attempts, best_percent: practice.bestPercent, passed: practice.passed, last_completed_at: practice.lastCompletedAt }
        : null,
      flashcards_due: flashcardsDue
    };
  });

  const mockAttempts = db.prepare(`
    SELECT a.id, a.exam_id, e.title as exam_title, a.submitted_at, a.score, a.max_score, a.outcome, a.indicative_grade
    FROM learn_mock_attempts a
    JOIN learn_mock_exams e ON e.id = a.exam_id
    WHERE a.profile_id = ? AND a.submitted_at IS NOT NULL
    ORDER BY a.submitted_at DESC
    LIMIT 20
  `).all(learnerId);

  syncAssignmentCompletion(learnerId);
  const assignments = listAssignmentsForChild(learnerId);
  const openResponses = listOpenResponses(learnerId);
  const reviewAttempts = listReviewAttempts(learnerId);

  // Topics needing more work, derived only from verified server-side records
  const needsPractice = new Map<number, { lesson_id: number; lesson_title: string; subject_title: string; grade: number; reasons: string[] }>();
  const flag = (lesson: { lesson_id: number; lesson_title: string; subject_title: string; grade: number }, reason: string) => {
    const entry = needsPractice.get(lesson.lesson_id) || { ...lesson, reasons: [] };
    if (!entry.reasons.includes(reason)) entry.reasons.push(reason);
    needsPractice.set(lesson.lesson_id, entry);
  };
  const missedCards = new Map((db.prepare(`
    SELECT lesson_id, COUNT(*) as n FROM learn_flashcard_reviews WHERE profile_id = ? AND last_rating = 'missed' GROUP BY lesson_id
  `).all(learnerId) as Array<{ lesson_id: number; n: number }>).map((row) => [row.lesson_id, row.n]));
  const reviseContentIds = new Set(reviewAttempts.slice(0, 10).flatMap((attempt) => attempt.topics_to_revise_ids));
  const contentIdByLesson = new Map((db.prepare('SELECT id, content_id FROM learn_lessons WHERE content_id IS NOT NULL')
    .all() as Array<{ id: number; content_id: string }>).map((row) => [row.id, row.content_id]));

  for (const lesson of lessonProgress) {
    if (lesson.practice && lesson.practice.attempts > 0 && !lesson.practice.passed) flag(lesson, 'practice_not_passed');
    if ((missedCards.get(lesson.lesson_id) || 0) > 0) flag(lesson, 'flashcards_missed');
    const contentId = contentIdByLesson.get(lesson.lesson_id);
    if (contentId && reviseContentIds.has(contentId)) flag(lesson, 'review_paper_missed');
  }

  const learner = db.prepare('SELECT id, type, parent_id FROM profiles WHERE id = ?').get(learnerId) as any;
  return {
    learner_id: learnerId,
    settings: {
      ...getLearnerSettings(learnerId),
      learn_enabled: learner ? isFeatureEnabledForProfile(learner, 'learn') : false,
      tutor_available: learner ? isTutorAvailable(learner) : false
    },
    lessons: lessonProgress,
    mock_attempts: mockAttempts,
    review_attempts: reviewAttempts.map(({ topics_to_revise_ids, ...attempt }) => attempt),
    open_responses: openResponses,
    needs_practice: [...needsPractice.values()],
    assignments
  };
}

function listOpenResponses(profileId: number) {
  const rows = db.prepare(`
    SELECT r.id, r.lesson_id, r.item_key, r.response, r.submitted_at, r.updated_at, r.feedback, r.feedback_at,
           fp.name as feedback_by_name, l.title as lesson_title, l.open_prompts, s.title as subject_title, t.grade
    FROM learn_open_responses r
    JOIN learn_lessons l ON l.id = r.lesson_id
    JOIN learn_topics t ON t.id = l.topic_id
    JOIN learn_subjects s ON s.id = t.subject_id
    LEFT JOIN profiles fp ON fp.id = r.feedback_by
    WHERE r.profile_id = ?
    ORDER BY CASE WHEN r.feedback IS NULL THEN 0 ELSE 1 END, r.updated_at DESC
    LIMIT 100
  `).all(profileId) as any[];
  return rows.map(({ open_prompts, ...row }) => ({
    ...row,
    question: (JSON.parse(open_prompts || '[]') as Array<{ key: string; question: string }>).find((prompt) => prompt.key === row.item_key)?.question ?? null
  }));
}

function presentReviewAttempt(attempt: any) {
  const feedback = attempt.feedback ? JSON.parse(attempt.feedback) as ReviewFeedback & { submitted_late?: boolean } : null;
  return {
    attempt_id: attempt.id,
    paper_id: attempt.paper_id,
    profile_id: attempt.profile_id,
    started_at: attempt.started_at,
    expires_at: attempt.expires_at,
    submitted_at: attempt.submitted_at,
    objective_correct: attempt.objective_correct,
    objective_total: attempt.objective_total,
    points_awarded: attempt.points_awarded,
    // Review papers never carry a numerical grade, for any school year
    numeric_grade: null,
    is_official_grade: false,
    feedback,
    guardian_feedback: attempt.guardian_feedback ? JSON.parse(attempt.guardian_feedback) : null,
    guardian_feedback_at: attempt.guardian_feedback_at
  };
}

function listReviewAttempts(profileId: number) {
  const rows = db.prepare(`
    SELECT a.*, p.title as paper_title, p.source_lesson_ids, c.grade, s.title as subject_title
    FROM learn_review_attempts a
    JOIN learn_review_papers p ON p.id = a.paper_id
    JOIN learn_courses c ON c.id = p.course_id
    JOIN learn_subjects s ON s.id = c.subject_id
    WHERE a.profile_id = ? AND a.submitted_at IS NOT NULL
    ORDER BY a.submitted_at DESC
    LIMIT 20
  `).all(profileId) as any[];
  const titles = new Map((db.prepare('SELECT content_id, title FROM learn_lessons WHERE content_id IS NOT NULL')
    .all() as Array<{ content_id: string; title: string }>).map((row) => [row.content_id, row.title]));

  return rows.map((row) => {
    const feedback = row.feedback ? JSON.parse(row.feedback) as ReviewFeedback : null;
    const toRevise = feedback?.topics_to_revise || [];
    return {
      id: row.id,
      paper_id: row.paper_id,
      paper_title: row.paper_title,
      subject_title: row.subject_title,
      grade: row.grade,
      submitted_at: row.submitted_at,
      objective_correct: row.objective_correct,
      objective_total: row.objective_total,
      open_answered: feedback?.open_answered ?? 0,
      awaiting_feedback: (feedback?.open_answered ?? 0) > 0 && !row.guardian_feedback_at,
      guardian_feedback_at: row.guardian_feedback_at,
      topics_to_revise: toRevise.map((contentId) => titles.get(contentId) || contentId),
      topics_to_revise_ids: toRevise
    };
  });
}

// ---------------------------------------------------------------- assignments

function listAssignmentsForChild(childId: number) {
  const rows = db.prepare(`
    SELECT a.id, a.child_id, a.assigned_by, p.name as assigned_by_name, a.lesson_id, l.title as lesson_title,
           a.mock_exam_id, e.title as mock_exam_title, a.topic_id, t.title as topic_title,
           a.review_paper_id, rp.title as review_paper_title,
           COALESCE(a.target_kind, CASE WHEN a.mock_exam_id IS NOT NULL THEN 'mock_exam' ELSE 'lesson' END) as target_kind,
           a.due_at, a.note, a.state, a.created_at, a.completed_at
    FROM learn_assignments a
    JOIN profiles p ON p.id = a.assigned_by
    LEFT JOIN learn_lessons l ON l.id = a.lesson_id
    LEFT JOIN learn_mock_exams e ON e.id = a.mock_exam_id
    LEFT JOIN learn_topics t ON t.id = a.topic_id
    LEFT JOIN learn_review_papers rp ON rp.id = a.review_paper_id
    WHERE a.child_id = ? AND a.state != 'cancelled'
    ORDER BY CASE a.state WHEN 'assigned' THEN 0 ELSE 1 END, COALESCE(a.due_at, a.created_at)
  `).all(childId) as any[];
  const now = nowIso();

  return rows.map((row) => ({
    ...row,
    // review_paper rows keep a source lesson in lesson_id only to satisfy the legacy CHECK constraint
    lesson_id: row.target_kind === 'review_paper' ? null : row.lesson_id,
    lesson_title: row.target_kind === 'review_paper' ? null : row.lesson_title,
    title: row.target_kind === 'review_paper' ? row.review_paper_title
      : row.target_kind === 'topic' ? row.topic_title
        : row.target_kind === 'mock_exam' ? row.mock_exam_title : row.lesson_title,
    overdue: row.state === 'assigned' && Boolean(row.due_at) && row.due_at < now
  }));
}

function syncAssignmentCompletion(childId: number) {
  const open = db.prepare(`
    SELECT * FROM learn_assignments WHERE child_id = ? AND state = 'assigned'
  `).all(childId) as any[];

  for (const assignment of open) {
    let done = false;
    if (assignment.target_kind === 'review_paper') {
      done = Boolean(db.prepare(`
        SELECT 1 FROM learn_review_attempts
        WHERE paper_id = ? AND profile_id = ? AND submitted_at IS NOT NULL AND submitted_at >= ?
      `).get(assignment.review_paper_id, childId, assignment.created_at));
    } else if (assignment.target_kind === 'topic') {
      const lessons = db.prepare(`
        SELECT id FROM learn_lessons WHERE topic_id = ? AND review_status = 'reviewed'
      `).all(assignment.topic_id) as Array<{ id: number }>;
      done = lessons.some((lesson) => getPracticeResult(lesson.id, childId)?.passed);
    } else if (assignment.mock_exam_id) {
      done = Boolean(db.prepare(`
        SELECT 1 FROM learn_mock_attempts
        WHERE exam_id = ? AND profile_id = ? AND submitted_at IS NOT NULL AND submitted_at >= ?
      `).get(assignment.mock_exam_id, childId, assignment.created_at));
    } else if (assignment.lesson_id) {
      done = Boolean(getPracticeResult(assignment.lesson_id, childId)?.passed);
    }

    if (done) {
      db.prepare(`
        UPDATE learn_assignments SET state = 'completed', completed_at = ? WHERE id = ? AND state = 'assigned'
      `).run(nowIso(), assignment.id);
    }
  }
}

// ============================================================== routes

router.use(authenticate, requireLearnEnabled);

// Learn availability for the current profile (no feature gate so parents can opt in)
router.get('/status', (req: AuthRequest, res: Response) => {
  const viewer = req.profile!;
  const schoolOnly = isSchoolOnlyModeEnabled();
  const blockedBySchoolOnly = schoolOnly && !getSchoolOnlyAllowedFeatures().includes('learn');
  const learner = getLearnerSettings(viewer.id);
  res.json({
    enabled: viewer.type === 'admin' || (isFeatureEnabledForProfile(viewer, 'learn') && !blockedBySchoolOnly),
    family_opted_in: viewer.type === 'admin' || isFeatureEnabledForProfile(viewer, 'learn'),
    role: viewer.type,
    can_manage_family: viewer.type === 'parent',
    can_review: viewer.type === 'admin',
    blocked_by_school_only_mode: blockedBySchoolOnly,
    grade: learner.grade,
    suggested_grade: learner.suggested_grade,
    tutor_available: isTutorAvailable(viewer)
  });
});

// Guardian controls per child: Learn access, AI tutor and school grade
router.put('/children/:childId/settings', (req: AuthRequest, res: Response) => {
  const viewer = req.profile!;
  const childId = parseId(req.params.childId);
  const child = childId ? db.prepare('SELECT id, type, parent_id FROM profiles WHERE id = ?').get(childId) as any : null;
  if (!child || child.type !== 'child' || !['parent', 'admin'].includes(viewer.type) || !canAccessOwnOrManagedChild(viewer, childId!)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { grade, learn_enabled: learnEnabled, tutor_enabled: tutorEnabled } = req.body || {};
  if (grade !== undefined && grade !== null && !isGrade(grade)) {
    return res.status(400).json({ error: 'grade must be between 1 and 10' });
  }
  if ((learnEnabled !== undefined && typeof learnEnabled !== 'boolean') || (tutorEnabled !== undefined && typeof tutorEnabled !== 'boolean')) {
    return res.status(400).json({ error: 'learn_enabled and tutor_enabled must be booleans' });
  }

  db.transaction(() => {
    const patch: Record<string, unknown> = {};
    if (grade !== undefined) patch.learn_grade = grade;
    if (tutorEnabled !== undefined) patch.learn_tutor_enabled = tutorEnabled;
    if (Object.keys(patch).length > 0) patchProfileSettings(childId!, patch);
    if (learnEnabled !== undefined) {
      // Profile override of the existing feature system; the family opt-in still applies
      db.prepare(`
        INSERT INTO profile_features (profile_id, feature_key, enabled, updated_at)
        VALUES (?, 'learn', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(profile_id, feature_key) DO UPDATE SET enabled = excluded.enabled, updated_at = CURRENT_TIMESTAMP
      `).run(childId, learnEnabled ? 1 : 0);
    }
  })();

  audit(req, 'learn.child_settings_updated', 'profiles', childId, { grade, learn_enabled: learnEnabled, tutor_enabled: tutorEnabled });
  res.json({
    child_id: childId,
    ...getLearnerSettings(childId!),
    learn_enabled: isFeatureEnabledForProfile(child, 'learn'),
    tutor_available: isTutorAvailable(child)
  });
});

// Parent opt-in for the whole family (pilot is off by default)
router.put('/family/settings', (req: AuthRequest, res: Response) => {
  const viewer = req.profile!;
  if (viewer.type !== 'parent') {
    return res.status(403).json({ error: 'Only parents can change Learn for their family' });
  }

  const enabled = req.body?.enabled === true;
  const childIds = getManagedChildIdsForParent(viewer.id);
  const familyHeads = new Set<number>([viewer.id]);
  for (const childId of childIds) {
    const child = db.prepare('SELECT parent_id FROM profiles WHERE id = ?').get(childId) as { parent_id: number | null } | undefined;
    if (child?.parent_id) familyHeads.add(child.parent_id);
  }

  const upsert = db.prepare(`
    INSERT INTO family_features (parent_id, feature_key, enabled, updated_at)
    VALUES (?, 'learn', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(parent_id, feature_key) DO UPDATE SET enabled = excluded.enabled, updated_at = CURRENT_TIMESTAMP
  `);
  db.transaction(() => familyHeads.forEach((parentId) => upsert.run(parentId, enabled ? 1 : 0)))();

  audit(req, enabled ? 'learn.family_enabled' : 'learn.family_disabled', 'family_features', viewer.id, {
    family_heads: Array.from(familyHeads)
  });
  res.json({ enabled, family_heads: familyHeads.size });
});

// ------------------------------------------------------------ reviewer (admin)

router.get('/admin/review-queue', (req: AuthRequest, res: Response) => {
  if (!isReviewer(req)) {
    return res.status(403).json({ error: 'Reviewer access required' });
  }

  // Optional filters keep the 250+ item queue workable: ?grade=&subject=&status=
  const grade = parseId(req.query.grade);
  const subject = typeof req.query.subject === 'string' ? req.query.subject : null;
  const status = typeof req.query.status === 'string' && REVIEW_STATUSES.includes(req.query.status) ? req.query.status : null;
  const where = (alias: string, gradeColumn: string) => {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (grade) { clauses.push(`${gradeColumn} = ?`); params.push(grade); }
    if (subject) { clauses.push('s.slug = ?'); params.push(subject); }
    if (status) { clauses.push(`${alias}.review_status = ?`); params.push(status); }
    return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
  };

  const lessonFilter = where('l', 't.grade');
  const lessons = (db.prepare(`
    SELECT l.id, l.title, l.version, l.locale, l.review_status, l.reviewed_at, l.authored_by, l.content_id, l.content_meta,
           t.title as topic_title, t.grade, s.title as subject_title, s.slug as subject_slug
    FROM learn_lessons l
    JOIN learn_topics t ON t.id = l.topic_id
    JOIN learn_subjects s ON s.id = t.subject_id
    ${lessonFilter.sql}
    ORDER BY t.grade, s.sort_order, l.sort_order, l.review_status, l.version DESC
  `).all(...lessonFilter.params) as any[]).map(({ content_meta, ...lesson }) => ({
    ...lesson,
    content_warnings: (JSON.parse(content_meta || '{}').content_warnings as string[] | undefined) || []
  }));
  const examFilter = where('e', 't.grade');
  const exams = db.prepare(`
    SELECT e.id, e.title, e.version, e.review_status, e.reviewed_at, t.title as topic_title, t.grade,
           s.title as subject_title, s.slug as subject_slug
    FROM learn_mock_exams e
    JOIN learn_topics t ON t.id = e.topic_id
    JOIN learn_subjects s ON s.id = t.subject_id
    ${examFilter.sql}
    ORDER BY t.grade, s.sort_order, e.review_status, e.version DESC
  `).all(...examFilter.params);
  const paperFilter = where('p', 'c.grade');
  const reviewPapers = db.prepare(`
    SELECT p.id, p.content_id, p.title, p.version, p.mode, p.duration_minutes, p.review_status, p.reviewed_at,
           c.grade, s.title as subject_title, s.slug as subject_slug
    FROM learn_review_papers p
    JOIN learn_courses c ON c.id = p.course_id
    JOIN learn_subjects s ON s.id = c.subject_id
    ${paperFilter.sql}
    ORDER BY c.grade, s.sort_order, p.review_status, p.version DESC
  `).all(...paperFilter.params);
  const goals = db.prepare(`
    SELECT g.id, g.goal_key, g.description, g.source_locator, g.source_url, g.goal_after_grade, g.goal_level,
           g.curriculum_revision, g.verification_status, s.title as subject_title, s.slug as subject_slug, s.udir_code
    FROM learn_goals g JOIN learn_subjects s ON s.id = g.subject_id
    ${subject ? 'WHERE s.slug = ?' : ''}
    ORDER BY s.sort_order, g.goal_after_grade, g.id
  `).all(...(subject ? [subject] : []));
  const totals = db.prepare(`
    SELECT 'lessons' as kind, review_status, COUNT(*) as n FROM learn_lessons GROUP BY review_status
    UNION ALL SELECT 'mock_exams', review_status, COUNT(*) FROM learn_mock_exams GROUP BY review_status
    UNION ALL SELECT 'review_papers', review_status, COUNT(*) FROM learn_review_papers GROUP BY review_status
  `).all();

  res.json({ lessons, mock_exams: exams, review_papers: reviewPapers, goals, totals });
});

// Reviewer view of everything that must be checked before approval, answer keys included
router.get('/admin/lessons/:lessonId', (req: AuthRequest, res: Response) => {
  if (!isReviewer(req)) {
    return res.status(403).json({ error: 'Reviewer access required' });
  }
  const lessonId = parseId(req.params.lessonId);
  const lesson = lessonId ? getLesson(lessonId) : undefined;
  if (!lesson) {
    return res.status(404).json({ error: 'Lesson not found' });
  }
  const meta = parseContentMeta(lesson);
  res.json({
    ...presentLesson(lesson),
    topic: getTopicContext(lesson.topic_id),
    practice_items: parsePractice(lesson),
    open_prompts: parseOpenPrompts(lesson),
    content_meta: meta,
    review_notes: (db.prepare('SELECT review_notes FROM learn_lessons WHERE id = ?').get(lesson.id) as any)?.review_notes ?? null
  });
});

router.get('/admin/review-papers/:paperId', (req: AuthRequest, res: Response) => {
  if (!isReviewer(req)) {
    return res.status(403).json({ error: 'Reviewer access required' });
  }
  const paper = visibleReviewPaper(req, res);
  if (!paper) return;
  res.json({
    ...paper,
    items: parsePaperItems(paper),
    score_policy: parseScorePolicy(paper),
    source_lesson_ids: JSON.parse(paper.source_lesson_ids),
    source_lessons: [...getSourceLessons(paper, { includeUnreviewed: true }).values()],
    context: getPaperContext(paper)
  });
});

router.post('/review-papers/:paperId/review', (req: AuthRequest, res: Response) => {
  if (!isReviewer(req)) {
    return res.status(403).json({ error: 'Reviewer access required' });
  }
  const paperId = parseId(req.params.paperId);
  const status = req.body?.status;
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.slice(0, 2000) : null;
  if (!paperId || !getReviewPaper(paperId)) {
    return res.status(404).json({ error: 'Review paper not found' });
  }
  if (!REVIEW_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'status must be draft, reviewed or retired' });
  }

  db.prepare(`
    UPDATE learn_review_papers SET review_status = ?, reviewed_by = ?, reviewed_at = ?, review_notes = ? WHERE id = ?
  `).run(status, status === 'draft' ? null : req.profile!.id, status === 'draft' ? null : nowIso(), notes, paperId);
  audit(req, `learn.review_paper_${status}`, 'learn_review_papers', paperId);
  res.json({ id: paperId, review_status: status });
});

// Research package import: status + live validation, and an audited (dry-)run
router.get('/admin/content-import', (req: AuthRequest, res: Response) => {
  if (!isReviewer(req)) {
    return res.status(403).json({ error: 'Reviewer access required' });
  }
  const runs = (db.prepare('SELECT * FROM learn_content_imports ORDER BY id DESC LIMIT 10').all() as any[]).map((run) => ({
    ...run,
    summary: JSON.parse(run.summary),
    errors: JSON.parse(run.errors),
    warnings: JSON.parse(run.warnings)
  }));
  let validation: unknown = null;
  try {
    const pkg = loadContentPackage();
    const report = validateContentPackage(pkg, { existingGrade8PilotTopics: pilotGrade8Topics() });
    // Newest stored lesson per affected content ID (notices and lessons the last import skipped),
    // so the reviewer can open each one
    const skippedIds = runs.find((run) => !run.dry_run)?.summary?.skipped?.map((item: string) => item.split(' ')[0]) || [];
    const affected = [...new Set([...report.notices.flatMap((notice) => notice.examples), ...skippedIds])];
    const lessonLinks = affected.length
      ? Object.fromEntries((db.prepare(`
          SELECT content_id, MAX(id) as id FROM learn_lessons
          WHERE content_id IN (${affected.map(() => '?').join(',')}) GROUP BY content_id
        `).all(...affected) as Array<{ content_id: string; id: number }>).map((row) => [row.content_id, row.id]))
      : {};
    validation = { source_hash: pkg.sourceHash, ...report, lesson_links: lessonLinks };
  } catch (error: any) {
    validation = { ok: false, errors: [`package unreadable: ${error.message}`], warnings: [] };
  }
  res.json({ runs, validation });
});

router.post('/admin/content-import', (req: AuthRequest, res: Response) => {
  if (!isReviewer(req)) {
    return res.status(403).json({ error: 'Reviewer access required' });
  }
  // Dry run unless the reviewer explicitly asks to write
  const dryRun = req.body?.dry_run !== false;
  try {
    const result = importContentPackage(loadContentPackage(), { dryRun, triggeredBy: req.profile!.id });
    audit(req, dryRun ? 'learn.content_import_dry_run' : 'learn.content_import', 'learn_content_imports', result.import_id, {
      ok: result.ok, created: result.summary?.created
    });
    res.status(result.ok ? 200 : 422).json(result);
  } catch (error: any) {
    res.status(500).json({ error: `Content package unreadable: ${error.message}` });
  }
});

router.post('/lessons/:lessonId/review', (req: AuthRequest, res: Response) => {
  if (!isReviewer(req)) {
    return res.status(403).json({ error: 'Reviewer access required' });
  }
  const lessonId = parseId(req.params.lessonId);
  const status = req.body?.status;
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.slice(0, 2000) : null;
  if (!lessonId || !getLesson(lessonId)) {
    return res.status(404).json({ error: 'Lesson not found' });
  }
  if (!REVIEW_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'status must be draft, reviewed or retired' });
  }

  db.prepare(`
    UPDATE learn_lessons SET review_status = ?, reviewed_by = ?, reviewed_at = ?, review_notes = ? WHERE id = ?
  `).run(status, status === 'draft' ? null : req.profile!.id, status === 'draft' ? null : nowIso(), notes, lessonId);
  audit(req, `learn.lesson_${status}`, 'learn_lessons', lessonId);
  res.json(presentLesson(getLesson(lessonId)!));
});

router.post('/mock-exams/:examId/review', (req: AuthRequest, res: Response) => {
  if (!isReviewer(req)) {
    return res.status(403).json({ error: 'Reviewer access required' });
  }
  const examId = parseId(req.params.examId);
  const status = req.body?.status;
  if (!examId || !getMockExam(examId)) {
    return res.status(404).json({ error: 'Mock exam not found' });
  }
  if (!REVIEW_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'status must be draft, reviewed or retired' });
  }

  db.prepare(`
    UPDATE learn_mock_exams SET review_status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?
  `).run(status, status === 'draft' ? null : req.profile!.id, status === 'draft' ? null : nowIso(), examId);
  audit(req, `learn.mock_exam_${status}`, 'learn_mock_exams', examId);
  res.json({ id: examId, review_status: status });
});

router.post('/goals/:goalId/verify', (req: AuthRequest, res: Response) => {
  if (!isReviewer(req)) {
    return res.status(403).json({ error: 'Reviewer access required' });
  }
  const goalId = parseId(req.params.goalId);
  const goal = goalId ? db.prepare('SELECT * FROM learn_goals WHERE id = ?').get(goalId) as any : null;
  if (!goal) {
    return res.status(404).json({ error: 'Goal not found' });
  }

  const officialRef = typeof req.body?.official_goal_ref === 'string' ? req.body.official_goal_ref.trim().slice(0, 100) : null;
  const sourceUrl = typeof req.body?.source_url === 'string' && /^https:\/\/(www\.)?udir\.no\//.test(req.body.source_url)
    ? req.body.source_url
    : goal.source_url;

  db.prepare(`
    UPDATE learn_goals SET verification_status = 'verified', official_goal_ref = COALESCE(?, official_goal_ref), source_url = ? WHERE id = ?
  `).run(officialRef || null, sourceUrl, goalId);
  audit(req, 'learn.goal_verified', 'learn_goals', goalId, { official_goal_ref: officialRef });
  res.json(db.prepare('SELECT * FROM learn_goals WHERE id = ?').get(goalId));
});

// ------------------------------------------------------------ learner content (feature-gated)

router.use(requireFeature('learn'));

router.get('/catalog/overview', (req: AuthRequest, res: Response) => {
  res.json({ grades: getCatalogOverview() });
});

router.get('/catalog', (req: AuthRequest, res: Response) => {
  // Default to the learner's chosen school grade; grade 8 keeps the pilot behaviour
  const grade = parseId(req.query.grade) ?? getLearnerSettings(req.profile!.id).grade ?? 8;
  if (grade < 1 || grade > 10) {
    return res.status(400).json({ error: 'grade must be between 1 and 10' });
  }
  res.json({ grade, assessment_policy: assessmentPolicyForGrade(grade), subjects: getCatalog(grade, isReviewer(req)) });
});

router.put('/me/settings', (req: AuthRequest, res: Response) => {
  const grade = req.body?.grade;
  if (!isGrade(grade)) {
    return res.status(400).json({ error: 'grade must be between 1 and 10' });
  }
  patchProfileSettings(req.profile!.id, { learn_grade: grade });
  res.json(getLearnerSettings(req.profile!.id));
});

router.get('/topics/:topicId', (req: AuthRequest, res: Response) => {
  const topicId = parseId(req.params.topicId);
  const topic = topicId ? getTopicContext(topicId) : null;
  if (!topic) {
    return res.status(404).json({ error: 'Topic not found' });
  }

  const lessons = getVisibleLessons(topic.id, isReviewer(req));
  const exams = getVisibleMockExams(topic.id, isReviewer(req));
  // The same rule the catalogue applies: a learner never sees a topic, not even
  // its title, summary or goal mappings, until it has reviewed content. The
  // response stays 'Topic not found' so a direct ID cannot confirm it exists
  if (!isReviewer(req) && !lessons.length && !exams.length) {
    return res.status(404).json({ error: 'Topic not found' });
  }

  res.json({
    ...topic,
    lessons: lessons.map((lesson) => ({ id: lesson.id, title: lesson.title, version: lesson.version, review_status: lesson.review_status })),
    mock_exams: exams.map((exam) => ({
      id: exam.id, title: exam.title, version: exam.version, time_limit_minutes: exam.time_limit_minutes,
      item_count: parseMockItems(exam).length, review_status: exam.review_status
    }))
  });
});

router.get('/lessons/:lessonId', (req: AuthRequest, res: Response) => {
  const lesson = loadVisibleLesson(req, res);
  if (!lesson) return;

  const topic = getTopicContext(lesson.topic_id);
  const personalCards = db.prepare(`
    SELECT id, forked_from_card_key, front, back, updated_at FROM learn_personal_cards
    WHERE profile_id = ? AND lesson_id = ? ORDER BY id
  `).all(req.profile!.id, lesson.id);
  const course = db.prepare(`
    SELECT c.id FROM learn_course_topics ct JOIN learn_courses c ON c.id = ct.course_id WHERE ct.topic_id = ?
  `).get(lesson.topic_id) as { id: number } | undefined;
  const reviewPapers = course
    ? (db.prepare(`
        SELECT id, content_id, title, version, duration_minutes, review_status FROM learn_review_papers
        WHERE course_id = ? ${isReviewer(req) ? '' : "AND review_status = 'reviewed'"} ORDER BY version DESC
      `).all(course.id) as any[]).filter((paper, index, all) => all.findIndex((other) => other.content_id === paper.content_id) === index)
    : [];

  res.json({
    ...presentLesson(lesson),
    topic,
    assessment_policy: assessmentPolicyForGrade(topic?.grade ?? 8),
    course_nav: getCourseNavigation(lesson.topic_id, isReviewer(req)),
    review_papers: reviewPapers,
    personal_cards: personalCards,
    open_responses: presentOpenResponses(lesson, req.profile!.id),
    practice_result: getPracticeResult(lesson.id, req.profile!.id),
    tutor_available: isTutorAvailable(req.profile!),
    content_warnings: isReviewer(req) ? parseContentMeta(lesson).content_warnings || [] : undefined
  });
});

function presentOpenResponses(lesson: LessonRow, profileId: number) {
  const prompts = parseOpenPrompts(lesson);
  const locked = Boolean(getOpenAssessment(profileId));
  const rows = db.prepare(`
    SELECT r.id, r.item_key, r.response, r.submitted_at, r.updated_at, r.feedback, r.feedback_at, p.name as feedback_by_name
    FROM learn_open_responses r LEFT JOIN profiles p ON p.id = r.feedback_by
    WHERE r.profile_id = ? AND r.lesson_id = ?
  `).all(profileId, lesson.id) as any[];
  return rows.map((row) => ({
    ...row,
    // The model answer is a comparison aid after responding, never during a test
    model_answer: locked ? null : prompts.find((prompt) => prompt.key === row.item_key)?.model_answer ?? null
  }));
}

// Learner's own answer to an open (human-reviewed) prompt; editable until a guardian gives feedback
router.post('/lessons/:lessonId/open-responses/:itemKey', (req: AuthRequest, res: Response) => {
  const lesson = loadVisibleLesson(req, res);
  if (!lesson) return;

  const open = getOpenAssessment(req.profile!.id);
  if (open) return assessmentLocked(res, open);

  const prompt = parseOpenPrompts(lesson).find((item) => item.key === req.params.itemKey);
  const response = typeof req.body?.response === 'string' ? req.body.response.trim().slice(0, MAX_OPEN_RESPONSE_LENGTH) : '';
  if (!prompt) {
    return res.status(404).json({ error: 'Prompt not found' });
  }
  if (!response) {
    return res.status(400).json({ error: 'response is required' });
  }

  const existing = db.prepare('SELECT * FROM learn_open_responses WHERE profile_id = ? AND lesson_id = ? AND item_key = ?')
    .get(req.profile!.id, lesson.id, prompt.key) as any;
  if (existing?.feedback) {
    return res.status(409).json({ error: 'This answer already has feedback', code: 'feedback_given' });
  }

  const now = nowIso();
  db.prepare(`
    INSERT INTO learn_open_responses (profile_id, lesson_id, item_key, response, submitted_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(profile_id, lesson_id, item_key) DO UPDATE SET response = excluded.response, updated_at = excluded.updated_at
  `).run(req.profile!.id, lesson.id, prompt.key, response, now, now);

  // First submission only: let a guardian know there is something to give feedback on
  if (!existing && req.profile!.type === 'child' && req.profile!.parent_id) {
    const learnerName = (db.prepare('SELECT name FROM profiles WHERE id = ?').get(req.profile!.id) as { name: string } | undefined)?.name;
    sendPushNotification(req.profile!.parent_id, {
      type: 'learn_open_response' as any,
      title: 'Svar som venter på tilbakemelding',
      message: `${learnerName || 'Barnet ditt'} har svart på en oppgave i «${lesson.title}».`,
      icon: '📝',
      data: { lessonId: lesson.id },
      url: '/learn/parent'
    });
  }

  res.status(existing ? 200 : 201).json(presentOpenResponses(lesson, req.profile!.id).find((row) => row.item_key === prompt.key));
});

router.post('/open-responses/:responseId/feedback', (req: AuthRequest, res: Response) => {
  const viewer = req.profile!;
  const responseId = parseId(req.params.responseId);
  const row = responseId ? db.prepare('SELECT * FROM learn_open_responses WHERE id = ?').get(responseId) as any : null;
  // Guardians (or an audited admin) give feedback; never the learner on their own work
  if (!row || row.profile_id === viewer.id || !['parent', 'admin'].includes(viewer.type) || !canAccessOwnOrManagedChild(viewer, row.profile_id)) {
    return res.status(404).json({ error: 'Response not found' });
  }
  const feedback = typeof req.body?.feedback === 'string' ? req.body.feedback.trim().slice(0, 1000) : '';
  if (!feedback) {
    return res.status(400).json({ error: 'feedback is required' });
  }

  db.prepare('UPDATE learn_open_responses SET feedback = ?, feedback_by = ?, feedback_at = ? WHERE id = ?')
    .run(feedback, viewer.id, nowIso(), responseId);
  audit(req, 'learn.open_response_feedback', 'learn_open_responses', responseId, { learner_id: row.profile_id });
  sendPushNotification(row.profile_id, {
    type: 'learn_feedback' as any,
    title: 'Du har fått tilbakemelding 💬',
    message: 'Se hva en voksen skrev om svaret ditt i FamilyHub Learn.',
    icon: '💬',
    data: { lessonId: row.lesson_id },
    url: `/learn/lessons/${row.lesson_id}`
  });
  res.json(db.prepare('SELECT * FROM learn_open_responses WHERE id = ?').get(responseId));
});

router.post('/lessons/:lessonId/read', (req: AuthRequest, res: Response) => {
  const lesson = loadVisibleLesson(req, res);
  if (!lesson) return;

  db.prepare(`
    INSERT INTO learn_progress (profile_id, lesson_id, state, read_at, updated_at)
    VALUES (?, ?, 'reading', ?, ?)
    ON CONFLICT(profile_id, lesson_id) DO UPDATE SET
      read_at = COALESCE(learn_progress.read_at, excluded.read_at),
      state = CASE WHEN learn_progress.state = 'not_started' THEN 'reading' ELSE learn_progress.state END,
      updated_at = excluded.updated_at
  `).run(req.profile!.id, lesson.id, nowIso(), nowIso());

  res.json({ ok: true });
});

// Materialize (once) and return the existing-engine practice session for this learner
router.post('/lessons/:lessonId/practice', (req: AuthRequest, res: Response) => {
  const lesson = loadVisibleLesson(req, res);
  if (!lesson) return;

  // Review papers reuse the practice questions, so practice stays closed during a test
  const open = getOpenAssessment(req.profile!.id);
  if (open) return assessmentLocked(res, open);

  try {
    const learner = db.prepare('SELECT id, type, parent_id FROM profiles WHERE id = ?').get(req.profile!.id) as any;
    const sessionId = ensurePracticeSession(lesson, learner);
    res.json({ session_id: sessionId, result: getPracticeResult(lesson.id, learner.id) });
  } catch (error: any) {
    if (error instanceof PracticeUnavailableError) {
      return res.status(409).json({ error: error.message, code: 'practice_unavailable' });
    }
    console.error('[Learn] Practice setup failed:', error);
    res.status(500).json({ error: 'Failed to prepare practice' });
  }
});

// ------------------------------------------------------------ flashcards (curated + personal)

router.get('/lessons/:lessonId/flashcards', (req: AuthRequest, res: Response) => {
  const lesson = loadVisibleLesson(req, res);
  if (!lesson) return;

  const reviews = db.prepare(`
    SELECT card_key, box, last_rating, reviewed_at, next_due_at FROM learn_flashcard_reviews
    WHERE profile_id = ? AND lesson_id = ?
  `).all(req.profile!.id, lesson.id) as any[];
  const byKey = new Map(reviews.map((review) => [review.card_key, review]));
  const personal = db.prepare(`
    SELECT id, forked_from_card_key, front, back FROM learn_personal_cards WHERE profile_id = ? AND lesson_id = ? ORDER BY id
  `).all(req.profile!.id, lesson.id) as any[];
  const now = nowIso();

  const forkedKeys = new Set(personal.map((card) => card.forked_from_card_key).filter(Boolean));
  const cards = [
    // A personal fork replaces the curated card for this learner only
    ...parseFlashcards(lesson)
      .filter((card) => !forkedKeys.has(card.key))
      .map((card) => ({ key: card.key, front: card.front, back: card.back, source: 'curated' as const })),
    ...personal.map((card) => ({ key: `personal-${card.id}`, front: card.front, back: card.back, source: 'personal' as const, personal_id: card.id }))
  ].map((card) => {
    const review = byKey.get(card.key);
    return { ...card, box: review?.box ?? 0, last_rating: review?.last_rating ?? null, due: !review || review.next_due_at <= now, next_due_at: review?.next_due_at ?? null };
  });

  res.json({ lesson_id: lesson.id, cards });
});

router.post('/lessons/:lessonId/flashcards/:cardKey/review', (req: AuthRequest, res: Response) => {
  const lesson = loadVisibleLesson(req, res);
  if (!lesson) return;

  const rating = req.body?.rating;
  if (rating !== 'known' && rating !== 'missed') {
    return res.status(400).json({ error: 'rating must be known or missed' });
  }

  const cardKey = String(req.params.cardKey);
  const isCurated = parseFlashcards(lesson).some((card) => card.key === cardKey);
  const personalMatch = /^personal-(\d+)$/.exec(cardKey);
  const isOwnPersonal = personalMatch
    ? Boolean(db.prepare('SELECT 1 FROM learn_personal_cards WHERE id = ? AND profile_id = ? AND lesson_id = ?')
      .get(Number(personalMatch[1]), req.profile!.id, lesson.id))
    : false;
  if (!isCurated && !isOwnPersonal) {
    return res.status(404).json({ error: 'Card not found' });
  }

  const existing = db.prepare(`
    SELECT box FROM learn_flashcard_reviews WHERE profile_id = ? AND lesson_id = ? AND card_key = ?
  `).get(req.profile!.id, lesson.id, cardKey) as { box: number } | undefined;

  // Leitner boxes: known moves up a box, missed goes back to box 1
  const box = rating === 'known' ? Math.min((existing?.box ?? 0) + 1, FLASHCARD_INTERVAL_DAYS.length - 1) : 1;
  const reviewedAt = new Date();
  const nextDue = new Date(reviewedAt.getTime() + FLASHCARD_INTERVAL_DAYS[rating === 'known' ? box : 0] * 24 * 60 * 60 * 1000);

  db.prepare(`
    INSERT INTO learn_flashcard_reviews (profile_id, lesson_id, card_key, box, last_rating, reviewed_at, next_due_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(profile_id, lesson_id, card_key) DO UPDATE SET
      box = excluded.box, last_rating = excluded.last_rating, reviewed_at = excluded.reviewed_at, next_due_at = excluded.next_due_at
  `).run(req.profile!.id, lesson.id, cardKey, box, rating, reviewedAt.toISOString(), nextDue.toISOString());

  res.json({ card_key: cardKey, box, next_due_at: nextDue.toISOString() });
});

const cleanCardText = (value: unknown) => (typeof value === 'string' ? value.trim().slice(0, 300) : '');

router.post('/lessons/:lessonId/cards', (req: AuthRequest, res: Response) => {
  const lesson = loadVisibleLesson(req, res);
  if (!lesson) return;

  const front = cleanCardText(req.body?.front);
  const back = cleanCardText(req.body?.back);
  const forkedFrom = typeof req.body?.forked_from_card_key === 'string' ? req.body.forked_from_card_key : null;
  if (!front || !back) {
    return res.status(400).json({ error: 'front and back are required' });
  }
  if (forkedFrom && !parseFlashcards(lesson).some((card) => card.key === forkedFrom)) {
    return res.status(400).json({ error: 'Unknown card to copy' });
  }

  const count = (db.prepare('SELECT COUNT(*) as n FROM learn_personal_cards WHERE profile_id = ? AND lesson_id = ?')
    .get(req.profile!.id, lesson.id) as { n: number }).n;
  if (count >= 50) {
    return res.status(400).json({ error: 'You can have at most 50 personal cards per lesson' });
  }

  const result = db.prepare(`
    INSERT INTO learn_personal_cards (profile_id, lesson_id, forked_from_card_key, front, back) VALUES (?, ?, ?, ?, ?)
  `).run(req.profile!.id, lesson.id, forkedFrom, front, back);
  res.status(201).json(db.prepare('SELECT * FROM learn_personal_cards WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/cards/:cardId', (req: AuthRequest, res: Response) => {
  const cardId = parseId(req.params.cardId);
  const card = cardId ? db.prepare('SELECT * FROM learn_personal_cards WHERE id = ?').get(cardId) as any : null;
  if (!card || card.profile_id !== req.profile!.id) {
    return res.status(404).json({ error: 'Card not found' });
  }
  const front = cleanCardText(req.body?.front) || card.front;
  const back = cleanCardText(req.body?.back) || card.back;
  db.prepare('UPDATE learn_personal_cards SET front = ?, back = ?, updated_at = ? WHERE id = ?').run(front, back, nowIso(), cardId);
  res.json(db.prepare('SELECT * FROM learn_personal_cards WHERE id = ?').get(cardId));
});

router.delete('/cards/:cardId', (req: AuthRequest, res: Response) => {
  const cardId = parseId(req.params.cardId);
  const card = cardId ? db.prepare('SELECT * FROM learn_personal_cards WHERE id = ?').get(cardId) as any : null;
  if (!card || card.profile_id !== req.profile!.id) {
    return res.status(404).json({ error: 'Card not found' });
  }
  db.prepare('DELETE FROM learn_personal_cards WHERE id = ?').run(cardId);
  db.prepare('DELETE FROM learn_flashcard_reviews WHERE profile_id = ? AND lesson_id = ? AND card_key = ?')
    .run(req.profile!.id, card.lesson_id, `personal-${cardId}`);
  res.json({ deleted: true });
});

// ------------------------------------------------------------ progress

router.get('/me/progress', (req: AuthRequest, res: Response) => {
  res.json(buildLearnerProgress(req.profile!.id));
});

router.get('/children/:childId/progress', (req: AuthRequest, res: Response) => {
  const childId = parseId(req.params.childId);
  const viewer = req.profile!;
  const child = childId ? db.prepare('SELECT id, name, type FROM profiles WHERE id = ?').get(childId) as any : null;

  if (!child || child.type !== 'child' || viewer.id === childId || !['parent', 'admin'].includes(viewer.type)
    || !canAccessOwnOrManagedChild(viewer, childId!)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (viewer.type === 'admin') {
    audit(req, 'learn.admin_viewed_child_progress', 'profiles', childId);
  }

  res.json({ child: { id: child.id, name: child.name }, ...buildLearnerProgress(childId!) });
});

// ------------------------------------------------------------ assignments

router.post('/assignments', (req: AuthRequest, res: Response) => {
  const viewer = req.profile!;
  if (viewer.type === 'teacher') {
    // Class assignments wait for the church-school organization boundary decision (§6)
    return res.status(403).json({ error: 'Class assignments are not available yet', code: 'organization_boundary_unresolved' });
  }
  if (!['parent', 'admin'].includes(viewer.type)) {
    return res.status(403).json({ error: 'Only parents can assign Learn work' });
  }

  const childId = parseId(req.body?.child_id);
  const lessonId = parseId(req.body?.lesson_id);
  const mockExamId = parseId(req.body?.mock_exam_id);
  const topicId = parseId(req.body?.topic_id);
  const reviewPaperId = parseId(req.body?.review_paper_id);
  const idempotencyKey = typeof req.body?.idempotency_key === 'string' ? req.body.idempotency_key.trim().slice(0, 100) : '';
  const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : null;
  const dueAt = typeof req.body?.due_at === 'string' && !Number.isNaN(Date.parse(req.body.due_at))
    ? new Date(req.body.due_at).toISOString()
    : null;

  const targets = [lessonId, mockExamId, topicId, reviewPaperId].filter(Boolean);
  if (!childId || targets.length !== 1 || !idempotencyKey) {
    return res.status(400).json({
      error: 'child_id, exactly one of lesson_id, topic_id, mock_exam_id or review_paper_id, and idempotency_key are required'
    });
  }

  const child = db.prepare('SELECT id, name, type, parent_id FROM profiles WHERE id = ?').get(childId) as any;
  if (!child || child.type !== 'child' || !canAccessOwnOrManagedChild(viewer, childId)) {
    return res.status(403).json({ error: 'You can only assign work to your own children' });
  }
  if (!isFeatureEnabledForProfile(child, 'learn')) {
    return res.status(409).json({ error: 'Learn is not switched on for this child', code: 'learn_not_enabled' });
  }

  // Resolve the target; only reviewed content can be assigned. lesson_id always gets a
  // value (the topic's lesson, or a paper's first source lesson) for the legacy CHECK.
  let targetKind: 'lesson' | 'mock_exam' | 'topic' | 'review_paper';
  let target: { title: string; review_status: string } | undefined;
  let anchorLessonId: number | null = lessonId;
  if (topicId) {
    targetKind = 'topic';
    const topic = db.prepare('SELECT id, title FROM learn_topics WHERE id = ?').get(topicId) as { id: number; title: string } | undefined;
    const lesson = topic ? getVisibleLessons(topic.id, false)[0] : undefined;
    target = topic && lesson ? { title: topic.title, review_status: 'reviewed' } : undefined;
    anchorLessonId = lesson?.id ?? null;
  } else if (reviewPaperId) {
    targetKind = 'review_paper';
    const paper = getReviewPaper(reviewPaperId);
    target = paper;
    anchorLessonId = paper ? [...getSourceLessons(paper).values()][0]?.id ?? null : null;
  } else if (mockExamId) {
    targetKind = 'mock_exam';
    target = getMockExam(mockExamId);
  } else {
    targetKind = 'lesson';
    target = getLesson(lessonId!);
  }
  if (!target || target.review_status !== 'reviewed' || (targetKind === 'review_paper' && !anchorLessonId)) {
    return res.status(404).json({ error: 'Only reviewed lessons, topics, mock exams and review papers can be assigned' });
  }

  // Idempotent: a retried request with the same key returns the original assignment
  const existing = db.prepare('SELECT * FROM learn_assignments WHERE assigned_by = ? AND idempotency_key = ?')
    .get(viewer.id, idempotencyKey) as any;
  if (existing) {
    return res.status(200).json({ ...existing, idempotent_replay: true });
  }

  const result = db.prepare(`
    INSERT INTO learn_assignments (
      assigned_by, child_id, lesson_id, mock_exam_id, topic_id, review_paper_id, target_kind, due_at, note, idempotency_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(viewer.id, childId, anchorLessonId, mockExamId, topicId, reviewPaperId, targetKind, dueAt, note, idempotencyKey);
  const assignmentId = Number(result.lastInsertRowid);

  audit(req, 'learn.assignment_created', 'learn_assignments', assignmentId, {
    child_id: childId, target_kind: targetKind, lesson_id: lessonId, topic_id: topicId, mock_exam_id: mockExamId, review_paper_id: reviewPaperId
  });
  sendPushNotification(childId, {
    type: 'learn_assignment' as any,
    title: 'Ny læringsoppgave 📘',
    message: `Du har fått «${target.title}» i FamilyHub Learn.`,
    icon: '📘',
    data: { assignmentId, lessonId: targetKind === 'review_paper' ? null : anchorLessonId, mockExamId, reviewPaperId },
    url: '/learn'
  });

  res.status(201).json(db.prepare('SELECT * FROM learn_assignments WHERE id = ?').get(assignmentId));
});

router.get('/assignments', (req: AuthRequest, res: Response) => {
  const viewer = req.profile!;
  if (viewer.type === 'child') {
    syncAssignmentCompletion(viewer.id);
    return res.json(listAssignmentsForChild(viewer.id));
  }
  if (viewer.type === 'parent') {
    const childIds = getManagedChildIdsForParent(viewer.id);
    childIds.forEach(syncAssignmentCompletion);
    return res.json(childIds.flatMap((childId) => listAssignmentsForChild(childId)));
  }
  res.json([]);
});

router.patch('/assignments/:assignmentId', (req: AuthRequest, res: Response) => {
  const viewer = req.profile!;
  const assignmentId = parseId(req.params.assignmentId);
  const assignment = assignmentId ? db.prepare('SELECT * FROM learn_assignments WHERE id = ?').get(assignmentId) as any : null;

  if (!assignment || !['parent', 'admin'].includes(viewer.type) || !canAccessOwnOrManagedChild(viewer, assignment.child_id)) {
    return res.status(404).json({ error: 'Assignment not found' });
  }
  if (req.body?.state !== 'cancelled') {
    return res.status(400).json({ error: 'Only cancelling an assignment is supported' });
  }

  db.prepare("UPDATE learn_assignments SET state = 'cancelled' WHERE id = ?").run(assignmentId);
  audit(req, 'learn.assignment_cancelled', 'learn_assignments', assignmentId);
  res.json(db.prepare('SELECT * FROM learn_assignments WHERE id = ?').get(assignmentId));
});

// ------------------------------------------------------------ mock exams

router.get('/mock-exams/:examId', (req: AuthRequest, res: Response) => {
  const exam = loadVisibleExam(req, res);
  if (!exam) return;

  const rubric = parseMockRubric(exam);
  const topic = getTopicContext(exam.topic_id);
  res.json({
    id: exam.id,
    topic_id: exam.topic_id,
    grade: topic?.grade ?? null,
    locale: topic?.instruction_locale ?? 'nb',
    title: exam.title,
    version: exam.version,
    time_limit_minutes: exam.time_limit_minutes,
    item_count: parseMockItems(exam).length,
    criteria: rubric.criteria,
    limitations: rubric.limitations,
    disclaimer: rubric.disclaimer,
    review_status: exam.review_status
  });
});

router.post('/mock-exams/:examId/start', (req: AuthRequest, res: Response) => {
  const exam = loadVisibleExam(req, res);
  if (!exam) return;

  const viewer = req.profile!;
  const items = parseMockItems(exam).map((item) => ({
    // Answer keys never leave the server
    key: item.key, criterion: item.criterion, type: item.type, prompt: item.prompt, options: item.options, points: item.points
  }));

  // Grades 1-7 are formative only: no graded mock exams, whatever the content says
  if (topicGradeOf(exam.topic_id) <= 7) {
    return res.status(409).json({ error: 'Mock exams are not used for grades 1-7', code: 'formative_only' });
  }

  const openReview = getOpenReviewAttempt(viewer.id);
  if (openReview) {
    return res.status(409).json({ error: 'Finish your review paper first', code: 'exam_in_progress', attempt_id: openReview.id });
  }

  const open = getOpenMockAttempt(viewer.id);
  if (open && open.exam_id !== exam.id) {
    return res.status(409).json({ error: 'Finish your other mock exam first', code: 'exam_in_progress', attempt_id: open.id });
  }

  let attempt = open;
  if (!attempt) {
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + exam.time_limit_minutes * 60 * 1000);
    const result = db.prepare(`
      INSERT INTO learn_mock_attempts (exam_id, profile_id, rubric_version, started_at, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(exam.id, viewer.id, exam.rubric_version, startedAt.toISOString(), expiresAt.toISOString());
    attempt = db.prepare('SELECT * FROM learn_mock_attempts WHERE id = ?').get(result.lastInsertRowid);
  }

  res.status(open ? 200 : 201).json({
    attempt_id: attempt.id,
    exam_id: exam.id,
    title: exam.title,
    started_at: attempt.started_at,
    expires_at: attempt.expires_at,
    resumed: Boolean(open),
    items,
    disclaimer: parseMockRubric(exam).disclaimer
  });
});

function presentAttempt(attempt: any) {
  const evidence = attempt.evidence ? JSON.parse(attempt.evidence) : null;
  const feedback = attempt.feedback ? JSON.parse(attempt.feedback) : null;
  return {
    attempt_id: attempt.id,
    exam_id: attempt.exam_id,
    profile_id: attempt.profile_id,
    started_at: attempt.started_at,
    submitted_at: attempt.submitted_at,
    score: attempt.score,
    max_score: attempt.max_score,
    outcome: attempt.outcome,
    indicative_grade: attempt.indicative_grade,
    is_official_grade: false,
    ...(evidence || {}),
    ...(feedback || {})
  };
}

router.post('/mock-attempts/:attemptId/submit', (req: AuthRequest, res: Response) => {
  const attemptId = parseId(req.params.attemptId);
  const attempt = attemptId ? db.prepare('SELECT * FROM learn_mock_attempts WHERE id = ?').get(attemptId) as any : null;

  // Only the learner who started the attempt may submit it
  if (!attempt || attempt.profile_id !== req.profile!.id) {
    return res.status(404).json({ error: 'Attempt not found' });
  }

  // Idempotent: retries return the stored result instead of rescoring
  if (attempt.submitted_at) {
    return res.json({ ...presentAttempt(attempt), already_submitted: true });
  }

  const exam = getMockExam(attempt.exam_id)!;
  const rawResponses = req.body?.responses;
  const responses: Record<string, string> = {};
  if (rawResponses && typeof rawResponses === 'object') {
    for (const item of parseMockItems(exam)) {
      const value = (rawResponses as Record<string, unknown>)[item.key];
      if (typeof value === 'string') responses[item.key] = value.slice(0, 200);
    }
  }

  const late = Date.now() > Date.parse(attempt.expires_at) + MOCK_SUBMIT_GRACE_MS;
  const result = scoreMockExam(parseMockItems(exam), parseMockRubric(exam), responses);

  const evidence = {
    percent: result.percent,
    answered_ratio: result.answeredRatio,
    insufficient_reasons: result.insufficientReasons,
    criteria: result.criteria,
    items: result.items,
    submitted_late: late
  };
  const feedback = { next_steps: result.nextSteps, limitations: result.limitations, disclaimer: result.disclaimer };

  const update = db.prepare(`
    UPDATE learn_mock_attempts
    SET submitted_at = ?, responses = ?, score = ?, max_score = ?, outcome = ?, indicative_grade = ?, evidence = ?, feedback = ?
    WHERE id = ? AND submitted_at IS NULL
  `).run(
    nowIso(), JSON.stringify(responses), result.score, result.maxScore, result.outcome,
    result.indicativeGrade, JSON.stringify(evidence), JSON.stringify(feedback), attemptId
  );

  const stored = db.prepare('SELECT * FROM learn_mock_attempts WHERE id = ?').get(attemptId);
  syncAssignmentCompletion(attempt.profile_id);
  res.json({ ...presentAttempt(stored), already_submitted: update.changes === 0 });
});

router.get('/mock-attempts/:attemptId', (req: AuthRequest, res: Response) => {
  const attemptId = parseId(req.params.attemptId);
  const attempt = attemptId ? db.prepare('SELECT * FROM learn_mock_attempts WHERE id = ?').get(attemptId) as any : null;
  if (!attempt || !canAccessOwnOrManagedChild(req.profile!, attempt.profile_id) || !attempt.submitted_at) {
    return res.status(404).json({ error: 'Attempt not found' });
  }
  res.json(presentAttempt(attempt));
});

// ------------------------------------------------------------ formative review papers

const REVIEW_SUBMIT_GRACE_MS = 2 * 60 * 1000;

router.get('/review-papers/:paperId', (req: AuthRequest, res: Response) => {
  const paper = visibleReviewPaper(req, res);
  if (!paper) return;
  const context = getPaperContext(paper);
  const policy = parseScorePolicy(paper);
  res.json({
    id: paper.id,
    content_id: paper.content_id,
    title: paper.title,
    version: paper.version,
    mode: paper.mode,
    duration_minutes: paper.duration_minutes,
    instructions: paper.instructions,
    item_count: parsePaperItems(paper).length,
    grade: context.grade,
    subject_slug: context.subject_slug,
    subject_title: context.subject_title,
    locale: context.instruction_locale,
    curriculum_code: context.curriculum_code,
    numeric_grade_allowed: false,
    policy_reason: policy.reason,
    source_lessons: [...getSourceLessons(paper, { includeUnreviewed: isReviewer(req) }).values()]
      .map((lesson) => ({ id: lesson.id, content_id: lesson.content_id, title: lesson.title })),
    review_status: paper.review_status,
    previous_attempts: (db.prepare(`
      SELECT id, submitted_at, objective_correct, objective_total FROM learn_review_attempts
      WHERE paper_id = ? AND profile_id = ? AND submitted_at IS NOT NULL ORDER BY submitted_at DESC LIMIT 5
    `).all(paper.id, req.profile!.id))
  });
});

router.post('/review-papers/:paperId/start', (req: AuthRequest, res: Response) => {
  const paper = visibleReviewPaper(req, res);
  if (!paper) return;
  const viewer = req.profile!;

  const openMock = getOpenMockAttempt(viewer.id);
  if (openMock) {
    return res.status(409).json({ error: 'Finish your mock exam first', code: 'exam_in_progress', attempt_id: openMock.id });
  }
  const open = getOpenReviewAttempt(viewer.id);
  if (open && open.paper_id !== paper.id) {
    return res.status(409).json({ error: 'Finish your other review paper first', code: 'exam_in_progress', attempt_id: open.id });
  }

  let attempt = open;
  if (!attempt) {
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + paper.duration_minutes * 60 * 1000);
    const result = db.prepare(`
      INSERT INTO learn_review_attempts (paper_id, profile_id, started_at, expires_at) VALUES (?, ?, ?, ?)
    `).run(paper.id, viewer.id, startedAt.toISOString(), expiresAt.toISOString());
    attempt = db.prepare('SELECT * FROM learn_review_attempts WHERE id = ?').get(result.lastInsertRowid);
  }

  res.status(open ? 200 : 201).json({
    attempt_id: attempt.id,
    paper_id: paper.id,
    title: paper.title,
    instructions: paper.instructions,
    started_at: attempt.started_at,
    expires_at: attempt.expires_at,
    resumed: Boolean(open),
    // Answer keys, explanations and expected content never leave the server during an attempt
    items: presentItemsForAttempt(parsePaperItems(paper))
  });
});

router.post('/review-attempts/:attemptId/submit', (req: AuthRequest, res: Response) => {
  const attemptId = parseId(req.params.attemptId);
  const attempt = attemptId ? db.prepare('SELECT * FROM learn_review_attempts WHERE id = ?').get(attemptId) as any : null;
  if (!attempt || attempt.profile_id !== req.profile!.id) {
    return res.status(404).json({ error: 'Attempt not found' });
  }
  // Idempotent: a retry returns the stored result and never rescores or re-awards
  if (attempt.submitted_at) {
    // ...but once a retake is running, replaying this submit would hand back its answer key
    const openRetake = getOpenAssessment(attempt.profile_id);
    if (openRetake) return assessmentLocked(res, openRetake);
    return res.json({ ...presentReviewAttempt(attempt), already_submitted: true });
  }

  const paper = getReviewPaper(attempt.paper_id)!;
  const items = parsePaperItems(paper);
  const responses = sanitizeResponses(items, req.body?.responses);
  const feedback = {
    ...scoreReviewPaper(items, parseScorePolicy(paper), responses),
    submitted_late: Date.now() > Date.parse(attempt.expires_at) + REVIEW_SUBMIT_GRACE_MS
  };

  const update = db.prepare(`
    UPDATE learn_review_attempts
    SET submitted_at = ?, responses = ?, objective_correct = ?, objective_total = ?, feedback = ?
    WHERE id = ? AND submitted_at IS NULL
  `).run(nowIso(), JSON.stringify(responses), feedback.objective_correct, feedback.objective_total, JSON.stringify(feedback), attemptId);

  // Reward points once per learner and paper: only the first submitted attempt counts
  if (update.changes === 1 && req.profile!.type === 'child' && feedback.objective_correct > 0) {
    const earlier = db.prepare(`
      SELECT 1 FROM learn_review_attempts WHERE paper_id = ? AND profile_id = ? AND submitted_at IS NOT NULL AND id != ?
    `).get(attempt.paper_id, attempt.profile_id, attemptId);
    if (!earlier) {
      try {
        const award = awardPoints({
          profileId: attempt.profile_id,
          basePoints: feedback.objective_correct * REVIEW_POINTS_PER_CORRECT,
          source: 'quiz',
          applyMultiplier: false,
          enforceRateLimit: false
        });
        db.prepare('UPDATE learn_review_attempts SET points_awarded = ? WHERE id = ?').run(award.awarded, attemptId);
      } catch (error: any) {
        console.error('[Learn] Review paper points failed:', error.message);
      }
    }
  }

  const stored = db.prepare('SELECT * FROM learn_review_attempts WHERE id = ?').get(attemptId) as any;
  syncAssignmentCompletion(attempt.profile_id);
  if (update.changes === 1 && req.profile!.parent_id) {
    sendPushNotification(req.profile!.parent_id, {
      type: 'learn_review_paper' as any,
      title: 'Repetisjonsprøve levert',
      message: `«${paper.title}» er levert og venter på tilbakemelding fra deg.`,
      icon: '📝',
      data: { attemptId },
      url: '/learn/parent'
    });
  }
  res.json({ ...presentReviewAttempt(stored), already_submitted: update.changes === 0 });
});

router.get('/review-attempts/:attemptId', (req: AuthRequest, res: Response) => {
  const attemptId = parseId(req.params.attemptId);
  const attempt = attemptId ? db.prepare('SELECT * FROM learn_review_attempts WHERE id = ?').get(attemptId) as any : null;
  if (!attempt || !attempt.submitted_at || !canAccessOwnOrManagedChild(req.profile!, attempt.profile_id)) {
    return res.status(404).json({ error: 'Attempt not found' });
  }
  // An earlier attempt's feedback is the answer key of the paper now running, so the
  // learner's own review stays shut during a test. A guardian still needs it to respond.
  if (attempt.profile_id === req.profile!.id) {
    const open = getOpenAssessment(req.profile!.id);
    if (open) return assessmentLocked(res, open);
  }
  const paper = getReviewPaper(attempt.paper_id)!;
  res.json({
    ...presentReviewAttempt(attempt),
    paper: { id: paper.id, title: paper.title, locale: getPaperContext(paper).instruction_locale, grade: getPaperContext(paper).grade },
    prompts: Object.fromEntries(parsePaperItems(paper).map((item) => [item.id, item.prompt])),
    options: Object.fromEntries(parsePaperItems(paper)
      .map((item) => [item.id, item.kind === 'single_select' ? item.options : undefined])),
    source_lessons: Object.fromEntries([...getSourceLessons(paper, { includeUnreviewed: isReviewer(req) }).values()]
      .map((lesson) => [lesson.content_id, { id: lesson.id, title: lesson.title }]))
  });
});

// Guardian feedback on the open (human-reviewed) answers of a submitted review paper
router.post('/review-attempts/:attemptId/feedback', (req: AuthRequest, res: Response) => {
  const viewer = req.profile!;
  const attemptId = parseId(req.params.attemptId);
  const attempt = attemptId ? db.prepare('SELECT * FROM learn_review_attempts WHERE id = ?').get(attemptId) as any : null;
  if (!attempt || !attempt.submitted_at || attempt.profile_id === viewer.id || !['parent', 'admin'].includes(viewer.type)
    || !canAccessOwnOrManagedChild(viewer, attempt.profile_id)) {
    return res.status(404).json({ error: 'Attempt not found' });
  }

  const summary = typeof req.body?.summary === 'string' ? req.body.summary.trim().slice(0, 1000) : '';
  const validKeys = new Set(parsePaperItems(getReviewPaper(attempt.paper_id)!).map((item) => item.id));
  const items: Record<string, string> = {};
  if (req.body?.items && typeof req.body.items === 'object') {
    for (const [key, value] of Object.entries(req.body.items as Record<string, unknown>)) {
      if (validKeys.has(key) && typeof value === 'string' && value.trim()) items[key] = value.trim().slice(0, 1000);
    }
  }
  if (!summary && Object.keys(items).length === 0) {
    return res.status(400).json({ error: 'summary or item feedback is required' });
  }

  db.prepare(`
    UPDATE learn_review_attempts SET guardian_feedback = ?, guardian_feedback_by = ?, guardian_feedback_at = ? WHERE id = ?
  `).run(JSON.stringify({ summary, items }), viewer.id, nowIso(), attemptId);
  audit(req, 'learn.review_attempt_feedback', 'learn_review_attempts', attemptId, { learner_id: attempt.profile_id });
  sendPushNotification(attempt.profile_id, {
    type: 'learn_feedback' as any,
    title: 'Du har fått tilbakemelding 💬',
    message: 'Se tilbakemeldingen på repetisjonsprøven din i FamilyHub Learn.',
    icon: '💬',
    data: { attemptId },
    url: `/learn/review-attempts/${attemptId}`
  });
  res.json(presentReviewAttempt(db.prepare('SELECT * FROM learn_review_attempts WHERE id = ?').get(attemptId)));
});

// ------------------------------------------------------------ AI tutor

router.post('/tutor', async (req: AuthRequest, res: Response) => {
  const viewer = req.profile!;
  const lessonId = parseId(req.body?.lesson_id);
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (!lessonId || !question || question.length > 500) {
    return res.status(400).json({ error: 'lesson_id and a question (max 500 characters) are required' });
  }

  const lesson = getLesson(lessonId);
  if (!lesson || (lesson.review_status !== 'reviewed' && viewer.type !== 'admin')) {
    return res.status(404).json({ error: 'Lesson not found' });
  }

  // Strict server-side lockout while any mock exam or review paper is in progress
  if (getOpenAssessment(viewer.id)) {
    return res.status(423).json({ error: 'The tutor is turned off during a test', code: 'exam_in_progress' });
  }

  // Parent controls: the existing AI feature flag, per-profile ai_enabled and the Learn tutor switch
  if (!isTutorAvailable(viewer)) {
    return res.status(403).json({ error: 'The AI tutor is turned off for this profile', code: 'ai_disabled' });
  }

  const body = parseLessonBody(lesson);
  const fallback = buildTutorFallback(lesson.locale, body, question);

  if (viewer.type !== 'admin') {
    const usage = canGenerateAi(viewer.id, 'chat');
    if (!usage.allowed) {
      return res.json({ answer: fallback, source: 'lesson_fallback', reason: usage.reason });
    }
  }

  try {
    const prompt = buildTutorPrompt(lesson.locale, lesson.title, body, question, topicGradeOf(lesson.topic_id));
    const { text, provider } = await generateTextWithProviderFallback(prompt.system, prompt.user, { maxTokens: 350 });
    logAiUsage(viewer.id, 'chat', provider, { estimatedCost: 0.001, success: true });
    res.json({ answer: text.slice(0, 1500), source: 'ai', provider });
  } catch (error: any) {
    console.error('[Learn] Tutor provider failure:', error.message);
    res.json({ answer: fallback, source: 'lesson_fallback' });
  }
});

export default router;
