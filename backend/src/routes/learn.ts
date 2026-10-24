import express, { NextFunction, Response } from 'express';
import db from '../database/init';
import { authenticate, type AuthRequest } from '../middleware/auth';
import { requireFeature, isSchoolOnlyModeEnabled, getSchoolOnlyAllowedFeatures } from '../middleware/feature-access';
import { canAccessOwnOrManagedChild, getManagedChildIdsForParent } from '../services/familyAccess';
import { isFeatureEnabledForProfile } from '../services/profileFeatures';
import { sendPushNotification } from '../services/notifications';
import { canGenerateAi, logAiUsage } from '../services/aiUsageControl';
import { generateTextWithProviderFallback, getAISettings } from './ai';
import {
  getCatalog,
  getLesson,
  getMockExam,
  getTopicContext,
  getVisibleLessons,
  getVisibleMockExams,
  parseFlashcards,
  parseLessonBody,
  parseMockItems,
  parseMockRubric,
  parsePractice,
  type LessonRow,
  type MockExamRow
} from '../services/learn/catalog';
import { ensurePracticeSession, getPracticeResult, PracticeUnavailableError } from '../services/learn/practice';
import { scoreMockExam } from '../services/learn/mockScoring';
import { buildTutorPrompt, buildTutorFallback } from '../services/learn/tutor';

/**
 * FamilyHub Learn API (docs/familyhub-learn-architecture.md §5).
 * All identity comes from the server session; every object is checked against
 * the viewer: child = self, guardian = managed children, admin = audited.
 */
const router = express.Router();

const MASTERY_PERCENT = 85;
const MOCK_SUBMIT_GRACE_MS = 2 * 60 * 1000;
const FLASHCARD_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];

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

function presentLesson(lesson: LessonRow) {
  const practice = parsePractice(lesson);
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
    body: parseLessonBody(lesson),
    flashcards: parseFlashcards(lesson),
    // Practice answer keys stay in the activity engine; only a summary is exposed here
    practice: practice.map((item) => ({ key: item.key, type: item.type, title: item.title }))
  };
}

// ---------------------------------------------------------------- progress model

function buildLearnerProgress(learnerId: number) {
  const lessons = db.prepare(`
    SELECT l.id, l.title, l.topic_id, l.version, t.title as topic_title, t.grade, s.title as subject_title, s.slug as subject_slug
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

  return { learner_id: learnerId, lessons: lessonProgress, mock_attempts: mockAttempts, assignments };
}

// ---------------------------------------------------------------- assignments

function listAssignmentsForChild(childId: number) {
  return db.prepare(`
    SELECT a.id, a.child_id, a.assigned_by, p.name as assigned_by_name, a.lesson_id, l.title as lesson_title,
           a.mock_exam_id, e.title as mock_exam_title, a.due_at, a.note, a.state, a.created_at, a.completed_at
    FROM learn_assignments a
    JOIN profiles p ON p.id = a.assigned_by
    LEFT JOIN learn_lessons l ON l.id = a.lesson_id
    LEFT JOIN learn_mock_exams e ON e.id = a.mock_exam_id
    WHERE a.child_id = ? AND a.state != 'cancelled'
    ORDER BY CASE a.state WHEN 'assigned' THEN 0 ELSE 1 END, COALESCE(a.due_at, a.created_at)
  `).all(childId);
}

function syncAssignmentCompletion(childId: number) {
  const open = db.prepare(`
    SELECT * FROM learn_assignments WHERE child_id = ? AND state = 'assigned'
  `).all(childId) as any[];

  for (const assignment of open) {
    let done = false;
    if (assignment.mock_exam_id) {
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
  res.json({
    enabled: viewer.type === 'admin' || (isFeatureEnabledForProfile(viewer, 'learn') && !blockedBySchoolOnly),
    family_opted_in: viewer.type === 'admin' || isFeatureEnabledForProfile(viewer, 'learn'),
    role: viewer.type,
    can_manage_family: viewer.type === 'parent',
    can_review: viewer.type === 'admin',
    blocked_by_school_only_mode: blockedBySchoolOnly
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

  const lessons = db.prepare(`
    SELECT l.id, l.title, l.version, l.locale, l.review_status, l.reviewed_at, l.authored_by,
           t.title as topic_title, s.title as subject_title
    FROM learn_lessons l
    JOIN learn_topics t ON t.id = l.topic_id
    JOIN learn_subjects s ON s.id = t.subject_id
    ORDER BY s.sort_order, l.review_status, l.version DESC
  `).all();
  const exams = db.prepare(`
    SELECT e.id, e.title, e.version, e.review_status, e.reviewed_at, t.title as topic_title, s.title as subject_title
    FROM learn_mock_exams e
    JOIN learn_topics t ON t.id = e.topic_id
    JOIN learn_subjects s ON s.id = t.subject_id
    ORDER BY s.sort_order, e.review_status, e.version DESC
  `).all();
  const goals = db.prepare(`
    SELECT g.id, g.goal_key, g.description, g.source_locator, g.source_url, g.goal_after_grade,
           g.verification_status, s.title as subject_title, s.udir_code
    FROM learn_goals g JOIN learn_subjects s ON s.id = g.subject_id
    ORDER BY s.sort_order, g.id
  `).all();

  res.json({ lessons, mock_exams: exams, goals });
});

const REVIEW_STATUSES = ['draft', 'reviewed', 'retired'];

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

router.get('/catalog', (req: AuthRequest, res: Response) => {
  const grade = parseId(req.query.grade) ?? 8;
  if (grade < 1 || grade > 10) {
    return res.status(400).json({ error: 'grade must be between 1 and 10' });
  }
  res.json({ grade, subjects: getCatalog(grade, isReviewer(req)) });
});

router.get('/topics/:topicId', (req: AuthRequest, res: Response) => {
  const topicId = parseId(req.params.topicId);
  const topic = topicId ? getTopicContext(topicId) : null;
  if (!topic) {
    return res.status(404).json({ error: 'Topic not found' });
  }

  const lessons = getVisibleLessons(topic.id, isReviewer(req));
  const exams = getVisibleMockExams(topic.id, isReviewer(req));
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

  res.json({
    ...presentLesson(lesson),
    topic,
    personal_cards: personalCards,
    practice_result: getPracticeResult(lesson.id, req.profile!.id)
  });
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
  const idempotencyKey = typeof req.body?.idempotency_key === 'string' ? req.body.idempotency_key.trim().slice(0, 100) : '';
  const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : null;
  const dueAt = typeof req.body?.due_at === 'string' && !Number.isNaN(Date.parse(req.body.due_at))
    ? new Date(req.body.due_at).toISOString()
    : null;

  if (!childId || (!lessonId && !mockExamId) || (lessonId && mockExamId) || !idempotencyKey) {
    return res.status(400).json({ error: 'child_id, exactly one of lesson_id or mock_exam_id, and idempotency_key are required' });
  }

  const child = db.prepare('SELECT id, name, type, parent_id FROM profiles WHERE id = ?').get(childId) as any;
  if (!child || child.type !== 'child' || !canAccessOwnOrManagedChild(viewer, childId)) {
    return res.status(403).json({ error: 'You can only assign work to your own children' });
  }
  if (!isFeatureEnabledForProfile(child, 'learn')) {
    return res.status(409).json({ error: 'Learn is not switched on for this child', code: 'learn_not_enabled' });
  }

  const target = lessonId ? getLesson(lessonId) : getMockExam(mockExamId!);
  if (!target || target.review_status !== 'reviewed') {
    return res.status(404).json({ error: 'Only reviewed lessons and mock exams can be assigned' });
  }

  // Idempotent: a retried request with the same key returns the original assignment
  const existing = db.prepare('SELECT * FROM learn_assignments WHERE assigned_by = ? AND idempotency_key = ?')
    .get(viewer.id, idempotencyKey) as any;
  if (existing) {
    return res.status(200).json({ ...existing, idempotent_replay: true });
  }

  const result = db.prepare(`
    INSERT INTO learn_assignments (assigned_by, child_id, lesson_id, mock_exam_id, due_at, note, idempotency_key)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(viewer.id, childId, lessonId, mockExamId, dueAt, note, idempotencyKey);
  const assignmentId = Number(result.lastInsertRowid);

  audit(req, 'learn.assignment_created', 'learn_assignments', assignmentId, { child_id: childId, lesson_id: lessonId, mock_exam_id: mockExamId });
  sendPushNotification(childId, {
    type: 'learn_assignment' as any,
    title: 'Ny læringsoppgave 📘',
    message: `Du har fått «${target.title}» i FamilyHub Learn.`,
    icon: '📘',
    data: { assignmentId, lessonId, mockExamId },
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
  res.json({
    id: exam.id,
    topic_id: exam.topic_id,
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

  // Strict server-side lockout while any mock exam is in progress
  if (getOpenMockAttempt(viewer.id)) {
    return res.status(423).json({ error: 'The tutor is turned off during a mock exam', code: 'exam_in_progress' });
  }

  // Parent controls: the existing AI feature flag and per-profile ai_enabled
  if (viewer.type !== 'admin') {
    const aiSettings = getAISettings(viewer.id);
    if (!isFeatureEnabledForProfile(viewer, 'ai') || aiSettings.ai_enabled !== 1) {
      return res.status(403).json({ error: 'The AI tutor is turned off for this profile', code: 'ai_disabled' });
    }
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
    const prompt = buildTutorPrompt(lesson.locale, lesson.title, body, question);
    const { text, provider } = await generateTextWithProviderFallback(prompt.system, prompt.user, { maxTokens: 350 });
    logAiUsage(viewer.id, 'chat', provider, { estimatedCost: 0.001, success: true });
    res.json({ answer: text.slice(0, 1500), source: 'ai', provider });
  } catch (error: any) {
    console.error('[Learn] Tutor provider failure:', error.message);
    res.json({ answer: fallback, source: 'lesson_fallback' });
  }
});

export default router;
