import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import axios from 'axios';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../database/init';
import { sendPushNotification } from '../services/notifications';
import { authenticate } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import {
  canActOnAttempt,
  canManageOwnedResource,
  canViewAttempt,
  ownedResourceParamGuard,
  paramGuard,
  parentParamGuard,
  profileParamGuard,
  resolveActingProfileId
} from '../services/resourceAccess';
import { requireFeature } from '../middleware/feature-access';
import { canGenerateAi, logAiUsage, estimateCost } from '../services/aiUsageControl';
import { awardPoints } from '../services/economyControl';
import { isRepeatLearnPracticeCompletion } from '../services/learn/practice';
import { assessmentLocked, getOpenAssessment, isLearnPracticeSession } from '../services/learn/assessmentLock';

const router = Router();

// AI Provider URLs
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// ==================== HELPER FUNCTIONS ====================

const getOllamaUrl = (): string | null => {
  let url = process.env.OLLAMA_URL;
  if (!url || url.trim() === '') {
    try {
      const setting: any = db.prepare('SELECT value FROM settings WHERE key = ?').get('ollama_url');
      if (setting?.value) url = setting.value;
    } catch (error) {
      console.error('Failed to read ollama_url from settings:', error);
    }
  }
  return url && url.trim() !== '' ? url : null;
};

const getOllamaModel = (): string => {
  let model = process.env.OLLAMA_MODEL;
  if (!model || model.trim() === '') {
    try {
      const setting: any = db.prepare('SELECT value FROM settings WHERE key = ?').get('ollama_model');
      if (setting?.value) model = setting.value;
    } catch (error) {
      console.error('Failed to read ollama_model from settings:', error);
    }
  }
  return model && model.trim() !== '' ? model : 'llama3.2';
};

const getGrokApiKey = (): string | null => {
  let apiKey = process.env.GROK_API_KEY;
  if (!apiKey || apiKey === 'your_grok_api_key_here' || apiKey.trim() === '') {
    try {
      const setting: any = db.prepare('SELECT value FROM settings WHERE key = ?').get('grok_api_key');
      if (setting?.value) apiKey = setting.value;
    } catch (error) {
      console.error('Failed to read grok_api_key from settings:', error);
    }
  }
  return apiKey && apiKey !== 'your_grok_api_key_here' && apiKey.trim() !== '' ? apiKey : null;
};

const getOpenAiApiKey = (): string | null => {
  let apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    try {
      const setting: any = db.prepare('SELECT value FROM settings WHERE key = ?').get('openai_api_key');
      if (setting?.value) apiKey = setting.value;
    } catch (error) {
      console.error('Failed to read openai_api_key from settings:', error);
    }
  }
  return apiKey && apiKey.trim() !== '' ? apiKey : null;
};

const getGeminiApiKey = (): string | null => {
  let apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    try {
      const setting: any = db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_api_key');
      if (setting?.value) apiKey = setting.value;
    } catch (error) {
      console.error('Failed to read gemini_api_key from settings:', error);
    }
  }
  return apiKey && apiKey.trim() !== '' ? apiKey : null;
};

// Configure multer for activity media uploads
const ACTIVITY_MEDIA_DIR = process.env.ACTIVITY_MEDIA_DIR || '/app/data/activity-media';

if (!fs.existsSync(ACTIVITY_MEDIA_DIR)) {
  fs.mkdirSync(ACTIVITY_MEDIA_DIR, { recursive: true });
  console.log(`[Activity Media] Created directory: ${ACTIVITY_MEDIA_DIR}`);
}

const activityMediaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ACTIVITY_MEDIA_DIR);
  },
  filename: (req, file, cb) => {
    const sessionId = req.params.sessionId || 'unknown';
    const ext = path.extname(file.originalname) || '.jpg';
    const filename = `activity-${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, filename);
  }
});

const activityMediaUpload = multer({
  storage: activityMediaStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const allowedAudioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'];
    if (allowedImageTypes.includes(file.mimetype) || allowedAudioTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image and audio files are allowed'));
    }
  }
});

// ==================== AI JOB QUEUE ====================

type AiJobStatus = 'queued' | 'running' | 'completed' | 'failed';
interface AiJob {
  id: string;
  ownerId?: number;
  status: AiJobStatus;
  createdAt: number;
  updatedAt: number;
  result?: any;
  error?: string;
}

const AI_JOB_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const aiJobs = new Map<string, AiJob>();

const pruneAiJobs = () => {
  const now = Date.now();
  for (const [id, job] of aiJobs.entries()) {
    if (now - job.updatedAt > AI_JOB_TTL_MS) {
      aiJobs.delete(id);
    }
  }
};

const createJobId = () => {
  if (typeof randomUUID === 'function') {
    return randomUUID();
  }
  return `activity-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

// ==================== JSON PARSING HELPERS ====================

const stripCodeFences = (content: string) => {
  return content.replace(/```json/gi, '```').replace(/```/g, '').trim();
};

const extractJsonBlock = (content: string) => {
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    const firstBracket = content.indexOf('[');
    const lastBracket = content.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      return content.slice(firstBracket, lastBracket + 1);
    }
    return null;
  }
  return content.slice(firstBrace, lastBrace + 1);
};

const removeTrailingCommas = (content: string) => {
  return content.replace(/,\s*([}\]])/g, '$1');
};

const parseAiJson = (content: string) => {
  const cleaned = stripCodeFences(content);
  const candidates = [extractJsonBlock(cleaned), cleaned].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        return JSON.parse(removeTrailingCommas(candidate));
      } catch {
        continue;
      }
    }
  }
  throw new Error('Failed to parse AI JSON response');
};

// ==================== MEDIA ROUTE (PUBLIC - NO AUTH) ====================

router.get('/media/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;
  const safeName = path.basename(filename);
  const filePath = path.join(ACTIVITY_MEDIA_DIR, safeName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.sendFile(filePath);
});

// ==================== AUTH MIDDLEWARE ====================

router.use(authenticate, (req: AuthRequest, res, next) => {
  // Learn uses this engine without enabling the unrelated activities module.
  // Only the assigned learner's reviewed, linked practice play endpoints qualify;
  // normal object guards still run after this feature gate.
  const sessionMatch = req.path.match(/^\/sessions\/(\d+)(\/start)?\/?$/);
  const attemptMatch = req.path.match(/^\/attempts\/(\d+)\/(submit|complete)\/?$/);
  const sessionRead = sessionMatch && !sessionMatch[2] && ['GET', 'HEAD'].includes(req.method);
  const sessionStart = sessionMatch?.[2] && req.method === 'POST';
  const attemptAction = attemptMatch && req.method === 'POST';
  if (sessionRead || sessionStart || attemptAction) {
    try {
      const sessionId = sessionMatch ? Number(sessionMatch[1]) : (db.prepare(
        'SELECT session_id FROM session_attempts WHERE id = ? AND profile_id = ?'
      ).get(Number(attemptMatch![1]), req.profile!.id) as { session_id: number } | undefined)?.session_id;
      if (sessionId && isLearnPracticeSession(sessionId)) {
        const linked = db.prepare(`
          SELECT lesson.review_status FROM learn_resource_links link
          LEFT JOIN learn_lessons lesson ON lesson.id = link.lesson_id
          JOIN learning_sessions session ON session.id = link.existing_resource_id
          WHERE link.kind = 'activity' AND link.existing_resource_id = ?
            AND link.learner_profile_id = ? AND session.assigned_to = ?
        `).get(sessionId, req.profile!.id, req.profile!.id) as { review_status: string | null } | undefined;
        if (linked) {
          const enabled = db.prepare("SELECT value FROM settings WHERE key = 'learn_enabled'").get() as { value: string } | undefined;
          if (enabled?.value === 'false') {
            return res.status(403).json({ error: 'FamilyHub Learn is switched off', code: 'learn_disabled' });
          }
          // A real Learn link never falls through to generic activity access:
          // withdrawn/draft content stays closed even when activities is enabled.
          if (linked.review_status !== 'reviewed') return res.status(404).json({ error: 'Lesson not found' });
          return requireFeature('learn')(req, res, next);
        }
      }
    } catch (error) {
      console.error('[Activities] Learn access check failed:', error);
      return res.status(500).json({ error: 'Feature access check failed' });
    }
  }
  return requireFeature('activities')(req, res, next);
});

// ==================== OBJECT-LEVEL ACCESS ====================
router.param('parentId', parentParamGuard);
router.param('childId', profileParamGuard);
router.param('profileId', profileParamGuard);
// Assigned children may read, start and see the leaderboard of a session; all else requires manage access
router.param('sessionId', ownedResourceParamGuard({
  table: 'learning_sessions',
  playSuffixes: /^\/sessions\/[^/]+\/(start|leaderboard)$/,
  readForPlayers: true
}));
router.param('activityId', paramGuard((req, value) => {
  const session = db.prepare(`
    SELECT ls.created_by, ls.assigned_to
    FROM learning_activities la
    JOIN learning_sessions ls ON ls.id = la.session_id
    WHERE la.id = ?
  `).get(value) as any;
  return session ? canManageOwnedResource(req.profile!, session) : 'not_found';
}));
router.param('attemptId', paramGuard((req, value) => {
  const attempt = db.prepare('SELECT profile_id FROM session_attempts WHERE id = ?').get(value) as any;
  if (!attempt) {
    return 'not_found';
  }
  return req.method === 'GET'
    ? canViewAttempt(req.profile!, attempt.profile_id)
    : canActOnAttempt(req.profile!, attempt.profile_id);
}));

// ==================== ACTIVITY TYPES ====================

router.get('/types', (req: Request, res: Response) => {
  try {
    const types = db.prepare('SELECT * FROM activity_types ORDER BY name').all();
    res.json(types);
  } catch (error: any) {
    console.error('Failed to get activity types:', error);
    res.status(500).json({ error: 'Failed to get activity types' });
  }
});

router.get('/types/:idOrName', (req: Request, res: Response) => {
  try {
    const { idOrName } = req.params;
    const isNumeric = /^\d+$/.test(idOrName);

    const type = isNumeric
      ? db.prepare('SELECT * FROM activity_types WHERE id = ?').get(idOrName)
      : db.prepare('SELECT * FROM activity_types WHERE name = ?').get(idOrName);

    if (!type) {
      return res.status(404).json({ error: 'Activity type not found' });
    }

    res.json(type);
  } catch (error: any) {
    console.error('Failed to get activity type:', error);
    res.status(500).json({ error: 'Failed to get activity type' });
  }
});

// ==================== LEARNING SESSIONS CRUD ====================

// Get sessions created by a parent
router.get('/sessions/parent/:parentId', (req: Request, res: Response) => {
  try {
    const { parentId } = req.params;

    const sessions = db.prepare(`
      SELECT ls.*, p.name as assigned_to_name, p.avatar as assigned_to_avatar,
             (SELECT COUNT(*) FROM learning_activities WHERE session_id = ls.id) as activity_count
      FROM learning_sessions ls
      LEFT JOIN profiles p ON ls.assigned_to = p.id
      WHERE ls.created_by = ?
      ORDER BY ls.created_at DESC
    `).all(parentId);

    res.json(sessions);
  } catch (error: any) {
    console.error('Failed to get parent sessions:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// Get sessions assigned to a child
router.get('/sessions/child/:childId', (req: Request, res: Response) => {
  try {
    const { childId } = req.params;

    const sessions = db.prepare(`
      SELECT ls.*,
             (SELECT COUNT(*) FROM learning_activities WHERE session_id = ls.id) as activity_count,
             (SELECT MAX(score_percentage) FROM session_attempts
              WHERE session_id = ls.id AND profile_id = ? AND passed = 1) as best_score,
             (SELECT COUNT(*) FROM session_attempts
              WHERE session_id = ls.id AND profile_id = ? AND completed_at IS NOT NULL) as attempt_count
      FROM learning_sessions ls
      WHERE ls.assigned_to = ? AND ls.is_active = 1
      ORDER BY ls.created_at DESC
    `).all(childId, childId, childId);

    res.json(sessions);
  } catch (error: any) {
    console.error('Failed to get child sessions:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// Get a single session with all activities
router.get('/sessions/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session: any = db.prepare(`
      SELECT ls.*, p.name as assigned_to_name, p.avatar as assigned_to_avatar
      FROM learning_sessions ls
      LEFT JOIN profiles p ON ls.assigned_to = p.id
      WHERE ls.id = ?
    `).get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Learn practice reuses the review-paper questions, so this answer key stays
    // shut while the viewer has a test running
    if (isLearnPracticeSession(session.id)) {
      const open = getOpenAssessment((req as AuthRequest).profile!.id);
      if (open) return assessmentLocked(res, open);
    }

    const activities = db.prepare(`
      SELECT la.*, at.name as activity_type_name, at.display_name as activity_type_display,
             at.icon as activity_type_icon
      FROM learning_activities la
      LEFT JOIN activity_types at ON la.activity_type_id = at.id
      WHERE la.session_id = ?
      ORDER BY la.order_index ASC
    `).all(sessionId);

    const learnerPractice = isLearnPracticeSession(session.id)
      && !canManageOwnedResource((req as AuthRequest).profile!, session);
    session.activities = activities.map((a: any) => {
      const { correct_data, explanation, ...question } = a;
      return {
        ...question,
        content_data: a.content_data ? JSON.parse(a.content_data) : null,
        hints: a.hints ? JSON.parse(a.hints) : [],
        ...(!learnerPractice ? { correct_data: correct_data ? JSON.parse(correct_data) : null, explanation } : {})
      };
    });

    res.json(session);
  } catch (error: any) {
    console.error('Failed to get session:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// Create a new learning session
router.post('/sessions', (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      topic,
      ageRange,
      createdBy,
      assignedTo,
      pointsPerActivity = 20,
      starsPerSession = 1,
      bonusPoints = 50,
      timeLimitSeconds,
      passThreshold = 70,
      isCompetition = false,
      competitionEndsAt,
      firstPlaceBonus = 50,
      secondPlaceBonus = 25,
      thirdPlaceBonus = 10
    } = req.body;

    if (!title || !topic || !createdBy || !assignedTo) {
      return res.status(400).json({ error: 'Missing required fields: title, topic, createdBy, assignedTo' });
    }

    const viewer = (req as AuthRequest).profile!;
    if (viewer.type !== 'admin' && Number(createdBy) !== viewer.id) {
      return res.status(403).json({ error: 'You can only create sessions as yourself' });
    }
    if (resolveActingProfileId(viewer, assignedTo) === null) {
      return res.status(403).json({ error: 'You can only assign sessions to your own children' });
    }

    const result = db.prepare(`
      INSERT INTO learning_sessions (
        title, description, topic, age_range, created_by, assigned_to,
        points_per_activity, stars_per_session, bonus_points, time_limit_seconds,
        pass_threshold, is_competition, competition_ends_at,
        first_place_bonus, second_place_bonus, third_place_bonus
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title, description, topic, ageRange, createdBy, assignedTo,
      pointsPerActivity, starsPerSession, bonusPoints, timeLimitSeconds,
      passThreshold, isCompetition ? 1 : 0, competitionEndsAt,
      firstPlaceBonus, secondPlaceBonus, thirdPlaceBonus
    );

    // Notify assigned child
    sendPushNotification(assignedTo, {
      type: 'new_learning_session' as any,
      title: 'New Learning Activities!',
      message: `You have new ${title} activities to try!`,
      icon: '🎯',
      data: { sessionId: result.lastInsertRowid },
      url: '/activities'
    });

    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Session created successfully'
    });
  } catch (error: any) {
    console.error('Failed to create session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Update a learning session
router.put('/sessions/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const updates = req.body;

    const existing = db.prepare('SELECT id FROM learning_sessions WHERE id = ?').get(sessionId);
    if (!existing) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const allowedFields = [
      'title', 'description', 'topic', 'age_range', 'assigned_to',
      'points_per_activity', 'stars_per_session', 'bonus_points',
      'time_limit_seconds', 'pass_threshold', 'is_active',
      'is_competition', 'competition_ends_at',
      'first_place_bonus', 'second_place_bonus', 'third_place_bonus'
    ];

    const updateParts: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      const camelCase = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (updates[camelCase] !== undefined) {
        updateParts.push(`${field} = ?`);
        values.push(updates[camelCase]);
      } else if (updates[field] !== undefined) {
        updateParts.push(`${field} = ?`);
        values.push(updates[field]);
      }
    }

    if (updateParts.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updateParts.push('updated_at = CURRENT_TIMESTAMP');
    values.push(sessionId);

    db.prepare(`UPDATE learning_sessions SET ${updateParts.join(', ')} WHERE id = ?`).run(...values);

    res.json({ message: 'Session updated successfully' });
  } catch (error: any) {
    console.error('Failed to update session:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// Delete a learning session
router.delete('/sessions/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const existing = db.prepare('SELECT id FROM learning_sessions WHERE id = ?').get(sessionId);
    if (!existing) {
      return res.status(404).json({ error: 'Session not found' });
    }

    db.prepare('DELETE FROM learning_sessions WHERE id = ?').run(sessionId);

    res.json({ message: 'Session deleted successfully' });
  } catch (error: any) {
    console.error('Failed to delete session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// ==================== ACTIVITIES CRUD ====================

// Add activity to a session
router.post('/sessions/:sessionId/activities', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const {
      activityTypeId,
      title,
      instructions,
      contentData,
      correctData,
      hints,
      explanation,
      points = 20,
      timeLimitSeconds,
      difficulty = 'medium'
    } = req.body;

    const session = db.prepare('SELECT id FROM learning_sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get next order index
    const lastActivity: any = db.prepare(`
      SELECT MAX(order_index) as max_order FROM learning_activities WHERE session_id = ?
    `).get(sessionId);
    const orderIndex = (lastActivity?.max_order ?? -1) + 1;

    const result = db.prepare(`
      INSERT INTO learning_activities (
        session_id, activity_type_id, title, instructions,
        content_data, correct_data, hints, explanation,
        points, time_limit_seconds, order_index, difficulty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionId, activityTypeId, title, instructions,
      JSON.stringify(contentData), JSON.stringify(correctData),
      JSON.stringify(hints || []), explanation,
      points, timeLimitSeconds, orderIndex, difficulty
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Activity added successfully'
    });
  } catch (error: any) {
    console.error('Failed to add activity:', error);
    res.status(500).json({ error: 'Failed to add activity' });
  }
});

// Update an activity
router.put('/activities/:activityId', (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;
    const updates = req.body;

    const existing = db.prepare('SELECT id FROM learning_activities WHERE id = ?').get(activityId);
    if (!existing) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    const updateParts: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) {
      updateParts.push('title = ?');
      values.push(updates.title);
    }
    if (updates.instructions !== undefined) {
      updateParts.push('instructions = ?');
      values.push(updates.instructions);
    }
    if (updates.contentData !== undefined) {
      updateParts.push('content_data = ?');
      values.push(JSON.stringify(updates.contentData));
    }
    if (updates.correctData !== undefined) {
      updateParts.push('correct_data = ?');
      values.push(JSON.stringify(updates.correctData));
    }
    if (updates.hints !== undefined) {
      updateParts.push('hints = ?');
      values.push(JSON.stringify(updates.hints));
    }
    if (updates.explanation !== undefined) {
      updateParts.push('explanation = ?');
      values.push(updates.explanation);
    }
    if (updates.points !== undefined) {
      updateParts.push('points = ?');
      values.push(updates.points);
    }
    if (updates.difficulty !== undefined) {
      updateParts.push('difficulty = ?');
      values.push(updates.difficulty);
    }

    if (updateParts.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(activityId);
    db.prepare(`UPDATE learning_activities SET ${updateParts.join(', ')} WHERE id = ?`).run(...values);

    res.json({ message: 'Activity updated successfully' });
  } catch (error: any) {
    console.error('Failed to update activity:', error);
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

// Delete an activity
router.delete('/activities/:activityId', (req: Request, res: Response) => {
  try {
    const { activityId } = req.params;

    const existing = db.prepare('SELECT id FROM learning_activities WHERE id = ?').get(activityId);
    if (!existing) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    db.prepare('DELETE FROM learning_activities WHERE id = ?').run(activityId);

    res.json({ message: 'Activity deleted successfully' });
  } catch (error: any) {
    console.error('Failed to delete activity:', error);
    res.status(500).json({ error: 'Failed to delete activity' });
  }
});

// Reorder activities
router.put('/sessions/:sessionId/activities/reorder', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { activityIds } = req.body;

    if (!Array.isArray(activityIds)) {
      return res.status(400).json({ error: 'activityIds must be an array' });
    }

    const updateStmt = db.prepare('UPDATE learning_activities SET order_index = ? WHERE id = ? AND session_id = ?');

    activityIds.forEach((id, index) => {
      updateStmt.run(index, id, sessionId);
    });

    res.json({ message: 'Activities reordered successfully' });
  } catch (error: any) {
    console.error('Failed to reorder activities:', error);
    res.status(500).json({ error: 'Failed to reorder activities' });
  }
});

// ==================== SESSION ATTEMPTS ====================

// Start a session attempt
router.post('/sessions/:sessionId/start', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const profileId = resolveActingProfileId((req as AuthRequest).profile!, req.body.profileId);

    if (profileId === null) {
      return res.status(403).json({ error: 'You can only start sessions for yourself or your children' });
    }

    const session: any = db.prepare(`
      SELECT ls.*,
             (SELECT COUNT(*) FROM learning_activities WHERE session_id = ls.id) as activity_count,
             (SELECT COALESCE(SUM(points), 0) FROM learning_activities WHERE session_id = ls.id) as max_score
      FROM learning_sessions ls
      WHERE ls.id = ?
    `).get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.activity_count === 0) {
      return res.status(400).json({ error: 'Session has no activities' });
    }

    // No Learn practice run (new or resumed) while that learner has a test open
    if (isLearnPracticeSession(session.id)) {
      const open = getOpenAssessment(profileId);
      if (open) return assessmentLocked(res, open);
    }

    // Check for existing incomplete attempt
    const existingAttempt: any = db.prepare(`
      SELECT id FROM session_attempts
      WHERE session_id = ? AND profile_id = ? AND completed_at IS NULL
    `).get(sessionId, profileId);

    if (existingAttempt) {
      return res.json({
        attemptId: existingAttempt.id,
        resumed: true,
        message: 'Resumed existing attempt'
      });
    }

    const result = db.prepare(`
      INSERT INTO session_attempts (session_id, profile_id, total_activities, max_possible_score)
      VALUES (?, ?, ?, ?)
    `).run(sessionId, profileId, session.activity_count, session.max_score);

    res.status(201).json({
      attemptId: result.lastInsertRowid,
      totalActivities: session.activity_count,
      maxPossibleScore: session.max_score,
      message: 'Session started'
    });
  } catch (error: any) {
    console.error('Failed to start session:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// Submit an activity result
router.post('/attempts/:attemptId/submit', (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;
    const { activityId, userResponse, timeTakenSeconds, hintsUsed = 0 } = req.body;

    const attempt: any = db.prepare('SELECT * FROM session_attempts WHERE id = ?').get(attemptId);
    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    if (attempt.completed_at) {
      return res.status(400).json({ error: 'Attempt already completed' });
    }

    // Answering Learn practice would score the same items as the open paper
    if (isLearnPracticeSession(attempt.session_id)) {
      const open = getOpenAssessment(attempt.profile_id);
      if (open) return assessmentLocked(res, open);
    }

    const activity: any = db.prepare(`
      SELECT la.*, at.name as activity_type
      FROM learning_activities la
      LEFT JOIN activity_types at ON la.activity_type_id = at.id
      WHERE la.id = ? AND la.session_id = ?
    `).get(activityId, attempt.session_id);

    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    // The UI reveals each stored hint at most once. Reject coerced, negative,
    // fractional or excessive counts before either scoring or result replay.
    const availableHints: unknown = activity.hints ? JSON.parse(activity.hints) : [];
    const hintCount = Array.isArray(availableHints) ? availableHints.length : 0;
    if (!Number.isInteger(hintsUsed) || hintsUsed < 0 || hintsUsed > hintCount) {
      return res.status(400).json({ error: 'hintsUsed must be a nonnegative integer within the activity hint count', code: 'invalid_hints' });
    }

    // Check if already answered
    const existingResult = db.prepare(`
      SELECT * FROM activity_results WHERE attempt_id = ? AND activity_id = ?
    `).get(attemptId, activityId) as {
      user_response: string; score: number; max_score: number; is_correct: number;
      partial_score: number; hints_used: number;
    } | undefined;

    if (existingResult) {
      if (isLearnPracticeSession(attempt.session_id)) {
        // Resuming practice may revisit an answered question. Replay only its
        // stored response/result; never score the replacement request or mutate
        // progress. All ownership, source and assessment guards ran above.
        return res.json({
          replayed: true,
          userResponse: JSON.parse(existingResult.user_response),
          hintsUsed: existingResult.hints_used,
          score: existingResult.score,
          maxScore: existingResult.max_score,
          isCorrect: existingResult.is_correct === 1,
          partialScore: existingResult.partial_score,
          feedback: existingResult.is_correct ? 'Correct!' : 'Try again.',
          correctData: JSON.parse(activity.correct_data),
          explanation: activity.explanation
        });
      }
      return res.status(400).json({ error: 'Activity already answered' });
    }

    // Score the activity
    const correctData = JSON.parse(activity.correct_data);
    const scoringResult = scoreActivity(activity.activity_type, correctData, userResponse);

    // Apply hint penalty (10% per hint used, max 30%)
    const hintPenalty = Math.min(hintsUsed * 0.1, 0.3);
    const adjustedScore = Math.round(scoringResult.score * (1 - hintPenalty));

    db.prepare(`
      INSERT INTO activity_results (
        attempt_id, activity_id, user_response, score, max_score,
        is_correct, partial_score, hints_used, time_taken_seconds
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      attemptId, activityId, JSON.stringify(userResponse),
      adjustedScore, scoringResult.maxScore,
      scoringResult.isCorrect ? 1 : 0, scoringResult.partialScore,
      hintsUsed, timeTakenSeconds
    );

    // Update attempt progress
    db.prepare(`
      UPDATE session_attempts SET
        completed_activities = completed_activities + 1,
        total_score = total_score + ?
      WHERE id = ?
    `).run(adjustedScore, attemptId);

    res.json({
      score: adjustedScore,
      maxScore: scoringResult.maxScore,
      isCorrect: scoringResult.isCorrect,
      partialScore: scoringResult.partialScore,
      feedback: scoringResult.feedback,
      correctData,
      explanation: activity.explanation
    });
  } catch (error: any) {
    console.error('Failed to submit activity result:', error);
    res.status(500).json({ error: 'Failed to submit result' });
  }
});

// Complete a session attempt
router.post('/attempts/:attemptId/complete', (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;

    const attempt: any = db.prepare(`
      SELECT sa.*, ls.points_per_activity, ls.stars_per_session, ls.bonus_points,
             ls.pass_threshold, ls.is_competition, ls.first_place_bonus,
             ls.second_place_bonus, ls.third_place_bonus, ls.time_limit_seconds,
             ls.id as session_id, ls.created_by, ls.title
      FROM session_attempts sa
      JOIN learning_sessions ls ON sa.session_id = ls.id
      WHERE sa.id = ?
    `).get(attemptId);

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    if (attempt.completed_at) {
      return res.status(400).json({ error: 'Attempt already completed' });
    }

    if (isLearnPracticeSession(attempt.session_id)) {
      const open = getOpenAssessment(attempt.profile_id);
      if (open) return assessmentLocked(res, open);
      const results = db.prepare(`
        SELECT COUNT(DISTINCT activity.id) AS required, COUNT(DISTINCT result.activity_id) AS answered
        FROM learning_activities activity
        LEFT JOIN activity_results result ON result.activity_id = activity.id AND result.attempt_id = ?
        WHERE activity.session_id = ?
      `).get(attemptId, attempt.session_id) as { required: number; answered: number };
      if (results.required === 0 || results.answered < results.required) {
        return res.status(409).json({ error: 'Answer every practice activity before completing', code: 'practice_incomplete' });
      }
    }

    // Calculate score percentage
    const scorePercentage = attempt.max_possible_score > 0
      ? Math.round((attempt.total_score / attempt.max_possible_score) * 100)
      : 0;
    const passed = scorePercentage >= attempt.pass_threshold;

    // Calculate points earned
    let pointsEarned = attempt.total_score;
    let starsEarned = passed ? attempt.stars_per_session : 0;
    let timeBonusPoints = 0;

    // Add time bonus if passed and has time limit
    if (passed && attempt.time_limit_seconds) {
      const timeTaken = attempt.time_taken_seconds || 0;
      const remaining = Math.max(0, attempt.time_limit_seconds - timeTaken);
      timeBonusPoints = Math.round((remaining / attempt.time_limit_seconds) * attempt.bonus_points);
      pointsEarned += timeBonusPoints;
    } else if (passed) {
      pointsEarned += attempt.bonus_points;
    }

    // Handle competition ranking
    let competitionRank = null;
    let competitionBonus = 0;

    if (attempt.is_competition && passed) {
      const previousAttempts: any = db.prepare(`
        SELECT COUNT(*) as count FROM session_attempts
        WHERE session_id = ? AND completed_at IS NOT NULL AND passed = 1 AND id < ?
      `).get(attempt.session_id, attemptId);

      competitionRank = previousAttempts.count + 1;

      if (competitionRank === 1) {
        competitionBonus = attempt.first_place_bonus;
      } else if (competitionRank === 2) {
        competitionBonus = attempt.second_place_bonus;
      } else if (competitionRank === 3) {
        competitionBonus = attempt.third_place_bonus;
      }

      pointsEarned += competitionBonus;
    }

    // Update attempt
    db.prepare(`
      UPDATE session_attempts SET
        completed_at = CURRENT_TIMESTAMP,
        score_percentage = ?,
        points_earned = ?,
        stars_earned = ?,
        time_bonus_points = ?,
        passed = ?,
        competition_rank = ?,
        bonus_awarded = ?
      WHERE id = ?
    `).run(
      scorePercentage, pointsEarned, starsEarned, timeBonusPoints,
      passed ? 1 : 0, competitionRank, competitionBonus, attemptId
    );

    // FamilyHub Learn practice: only the first passed attempt earns economy points
    const isRepeatLearnPractice = isRepeatLearnPracticeCompletion(attempt.session_id, attempt.profile_id, Number(attemptId));
    if (isRepeatLearnPractice) {
      pointsEarned = 0;
      starsEarned = 0;
      db.prepare('UPDATE session_attempts SET points_earned = 0, stars_earned = 0 WHERE id = ?').run(attemptId);
    }

    // Award progress points using centralized economy-controlled system
    if (pointsEarned > 0 || starsEarned > 0) {
      const awardResult = awardPoints({
        profileId: attempt.profile_id,
        basePoints: pointsEarned,
        stars: starsEarned,
        source: 'activity',
        applyMultiplier: false,  // Activity already calculated points based on score
        enforceRateLimit: false  // No cooldown for activities
      });

      // Update pointsEarned to reflect any capping
      if (awardResult.capped) {
        pointsEarned = awardResult.awarded;
      }
    }

    // Notify parent (not for repeated Learn practice)
    const child: any = db.prepare('SELECT name FROM profiles WHERE id = ?').get(attempt.profile_id);
    if (!isRepeatLearnPractice) sendPushNotification(attempt.created_by, {
      type: 'learning_completed' as any,
      title: passed ? 'Great Learning!' : 'Session Completed',
      message: `${child?.name || 'Your child'} scored ${scorePercentage}% on ${attempt.title}!`,
      icon: passed ? '⭐' : '📚',
      data: { attemptId, sessionId: attempt.session_id, score: scorePercentage },
      url: '/activities'
    });

    res.json({
      completed: true,
      scorePercentage,
      passed,
      pointsEarned,
      starsEarned,
      timeBonusPoints,
      competitionRank,
      competitionBonus,
      totalScore: attempt.total_score,
      maxPossibleScore: attempt.max_possible_score
    });
  } catch (error: any) {
    console.error('Failed to complete session:', error);
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

// Get attempt history for a profile
router.get('/attempts/profile/:profileId', (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    const attempts = db.prepare(`
      SELECT sa.*, ls.title, ls.topic
      FROM session_attempts sa
      JOIN learning_sessions ls ON sa.session_id = ls.id
      WHERE sa.profile_id = ? AND sa.completed_at IS NOT NULL
      ORDER BY sa.completed_at DESC
      LIMIT ?
    `).all(profileId, limit);

    res.json(attempts);
  } catch (error: any) {
    console.error('Failed to get attempt history:', error);
    res.status(500).json({ error: 'Failed to get attempt history' });
  }
});

// Get session leaderboard
router.get('/sessions/:sessionId/leaderboard', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const leaderboard = db.prepare(`
      SELECT sa.*, p.name, p.avatar
      FROM session_attempts sa
      JOIN profiles p ON sa.profile_id = p.id
      WHERE sa.session_id = ? AND sa.completed_at IS NOT NULL AND sa.passed = 1
      ORDER BY sa.competition_rank ASC, sa.time_taken_seconds ASC
      LIMIT 10
    `).all(sessionId);

    res.json(leaderboard);
  } catch (error: any) {
    console.error('Failed to get leaderboard:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// ==================== STATISTICS ====================

router.get('/stats/parent/:parentId', (req: Request, res: Response) => {
  try {
    const { parentId } = req.params;

    const stats: any = db.prepare(`
      SELECT
        COUNT(DISTINCT ls.id) as total_sessions,
        COUNT(DISTINCT sa.id) as total_attempts,
        AVG(sa.score_percentage) as avg_score,
        SUM(CASE WHEN sa.passed = 1 THEN 1 ELSE 0 END) as passed_count
      FROM learning_sessions ls
      LEFT JOIN session_attempts sa ON ls.id = sa.session_id AND sa.completed_at IS NOT NULL
      WHERE ls.created_by = ?
    `).get(parentId);

    res.json(stats);
  } catch (error: any) {
    console.error('Failed to get parent stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

router.get('/stats/child/:childId', (req: Request, res: Response) => {
  try {
    const { childId } = req.params;

    const stats: any = db.prepare(`
      SELECT
        COUNT(DISTINCT sa.id) as total_attempts,
        SUM(sa.points_earned) as total_points,
        SUM(sa.stars_earned) as total_stars,
        AVG(sa.score_percentage) as avg_score,
        SUM(CASE WHEN sa.passed = 1 THEN 1 ELSE 0 END) as passed_count,
        MAX(sa.score_percentage) as best_score
      FROM session_attempts sa
      WHERE sa.profile_id = ? AND sa.completed_at IS NOT NULL
    `).get(childId);

    // Get activity type breakdown
    const byType = db.prepare(`
      SELECT at.display_name, at.icon,
             COUNT(*) as count,
             AVG(CASE WHEN ar.is_correct = 1 THEN 100 ELSE 0 END) as accuracy
      FROM activity_results ar
      JOIN learning_activities la ON ar.activity_id = la.id
      JOIN activity_types at ON la.activity_type_id = at.id
      JOIN session_attempts sa ON ar.attempt_id = sa.id
      WHERE sa.profile_id = ?
      GROUP BY at.id
    `).all(childId);

    res.json({ ...stats, byActivityType: byType });
  } catch (error: any) {
    console.error('Failed to get child stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ==================== AI GENERATION ====================

router.post('/ai-generate', async (req: Request, res: Response) => {
  try {
    const {
      // Support both old and new field names
      prompt,
      topic,
      ageRange,
      targetAge,
      activityTypes,
      preferredTypes,
      activityCount = 5,
      createdBy,
      assignedTo,
      textProvider = 'ollama',
      difficulty = 'medium',
      customInstructions,
      pointsPerActivity = 20
    } = req.body;

    // Use topic or prompt (frontend sends topic)
    const actualPrompt = topic || prompt;
    const actualAgeRange = targetAge ? `${targetAge} years old` : ageRange;
    const actualActivityTypes = preferredTypes || activityTypes;

    if (!actualPrompt || !createdBy || !assignedTo) {
      return res.status(400).json({ error: 'Missing required fields: topic, createdBy, assignedTo' });
    }

    const viewer = (req as AuthRequest).profile!;
    if (viewer.type !== 'admin' && Number(createdBy) !== viewer.id) {
      return res.status(403).json({ error: 'You can only create sessions as yourself' });
    }
    if (resolveActingProfileId(viewer, assignedTo) === null) {
      return res.status(403).json({ error: 'You can only assign sessions to your own children' });
    }

    // Check AI usage limits
    const estimatedCostValue = estimateCost(textProvider, null, 0);
    const usageCheck = canGenerateAi(createdBy, 'activity', estimatedCostValue);

    if (!usageCheck.allowed) {
      return res.status(429).json({
        error: usageCheck.reason,
        code: 'AI_LIMIT_REACHED',
        remaining: usageCheck.remaining
      });
    }

    // Create job
    pruneAiJobs();
    const job: AiJob = {
      id: createJobId(),
      ownerId: Number(createdBy),
      status: 'queued',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    aiJobs.set(job.id, job);

    // Start async processing
    processAiJob(job.id, {
      prompt: actualPrompt,
      ageRange: actualAgeRange,
      activityTypes: actualActivityTypes,
      activityCount,
      createdBy,
      assignedTo,
      textProvider,
      difficulty,
      customInstructions,
      pointsPerActivity
    });

    // Log usage
    logAiUsage(createdBy, 'activity', textProvider, {
      estimatedCost: estimatedCostValue,
      success: true
    });

    res.status(202).json({
      jobId: job.id,
      status: job.status,
      remaining: (usageCheck.remaining || 1) - 1
    });
  } catch (error: any) {
    console.error('Failed to start AI generation:', error);
    res.status(500).json({ error: 'Failed to start generation' });
  }
});

router.get('/ai-generate/status/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = aiJobs.get(jobId);
  const viewer = (req as AuthRequest).profile!;

  if (!job || (viewer.type !== 'admin' && job.ownerId !== undefined && Number(job.ownerId) !== viewer.id)) {
    return res.status(404).json({ error: 'Job not found or expired' });
  }

  // Flatten result to match frontend's expected AiGenerationJob type
  res.json({
    jobId: job.id,
    status: job.status,
    sessionId: job.result?.sessionId,
    activityCount: job.result?.activityCount,
    error: job.error
  });
});

// ==================== SCORING ENGINE ====================

interface ScoringResult {
  score: number;
  maxScore: number;
  isCorrect: boolean;
  partialScore: number;
  feedback: string;
}

function scoreActivity(activityType: string, correctData: any, userResponse: any): ScoringResult {
  const maxScore = 20; // Default max score per activity

  switch (activityType) {
    case 'multiple_choice':
      return scoreMultipleChoice(correctData, userResponse, maxScore);
    case 'true_false':
      return scoreTrueFalse(correctData, userResponse, maxScore);
    case 'fill_blanks':
      return scoreFillBlanks(correctData, userResponse, maxScore);
    case 'matching':
      return scoreMatching(correctData, userResponse, maxScore);
    case 'sorting':
      return scoreSorting(correctData, userResponse, maxScore);
    case 'drag_drop':
      return scoreDragDrop(correctData, userResponse, maxScore);
    case 'memory_game':
      return scoreMemoryGame(correctData, userResponse, maxScore);
    case 'arithmetic':
      return scoreArithmetic(correctData, userResponse, maxScore);
    case 'flashcards':
      return scoreFlashcards(correctData, userResponse, maxScore);
    case 'word_search':
      return scoreWordSearch(correctData, userResponse, maxScore);
    case 'crossword':
      return scoreCrossword(correctData, userResponse, maxScore);
    case 'image_hotspots':
      return scoreImageHotspots(correctData, userResponse, maxScore);
    default:
      return { score: 0, maxScore, isCorrect: false, partialScore: 0, feedback: 'Unknown activity type' };
  }
}

function scoreMultipleChoice(correct: any, response: any, maxScore: number): ScoringResult {
  const isCorrect = response.answer === correct.correctAnswer;
  return {
    score: isCorrect ? maxScore : 0,
    maxScore,
    isCorrect,
    partialScore: isCorrect ? 1 : 0,
    feedback: isCorrect ? 'Correct!' : `The correct answer was: ${correct.correctAnswer}`
  };
}

function scoreTrueFalse(correct: any, response: any, maxScore: number): ScoringResult {
  const isCorrect = response.answer === correct.isTrue;
  return {
    score: isCorrect ? maxScore : 0,
    maxScore,
    isCorrect,
    partialScore: isCorrect ? 1 : 0,
    feedback: isCorrect ? 'Correct!' : `The statement was ${correct.isTrue ? 'true' : 'false'}`
  };
}

function scoreFillBlanks(correct: any, response: any, maxScore: number): ScoringResult {
  const blanks = correct.blanks || [];
  const answers = response.answers || [];
  let correctCount = 0;

  blanks.forEach((blank: any, index: number) => {
    const userAnswer = (answers[index] || '').toLowerCase().trim();
    const correctAnswer = blank.answer.toLowerCase().trim();
    const alternatives = (blank.acceptAlternatives || []).map((a: string) => a.toLowerCase().trim());

    if (userAnswer === correctAnswer || alternatives.includes(userAnswer)) {
      correctCount++;
    }
  });

  const partialScore = blanks.length > 0 ? correctCount / blanks.length : 0;
  const score = Math.round(maxScore * partialScore);

  return {
    score,
    maxScore,
    isCorrect: correctCount === blanks.length,
    partialScore,
    feedback: correctCount === blanks.length
      ? 'All blanks correct!'
      : `${correctCount} of ${blanks.length} blanks correct`
  };
}

function scoreMatching(correct: any, response: any, maxScore: number): ScoringResult {
  const correctPairs = correct.correctPairs || {};
  const matches = response.matches || {};
  let correctCount = 0;
  const totalPairs = Object.keys(correctPairs).length;

  // correctPairs format: {0: 0, 1: 1, 2: 2} - maps left index to right index
  // matches format: {0: 2, 1: 1} - user's matches (left index to right index)
  Object.entries(correctPairs).forEach(([leftIdx, rightIdx]) => {
    if (matches[Number(leftIdx)] === rightIdx) {
      correctCount++;
    }
  });

  const partialScore = totalPairs > 0 ? correctCount / totalPairs : 0;
  const score = Math.round(maxScore * partialScore);

  return {
    score,
    maxScore,
    isCorrect: correctCount === totalPairs,
    partialScore,
    feedback: correctCount === totalPairs
      ? 'All pairs matched!'
      : `${correctCount} of ${totalPairs} pairs correct`
  };
}

function scoreSorting(correct: any, response: any, maxScore: number): ScoringResult {
  const correctOrder = correct.correctOrder || [];
  const userOrder = response.order || [];
  let correctCount = 0;

  correctOrder.forEach((id: string, index: number) => {
    if (userOrder[index] === id) {
      correctCount++;
    }
  });

  const partialScore = correctOrder.length > 0 ? correctCount / correctOrder.length : 0;
  const score = Math.round(maxScore * partialScore);

  return {
    score,
    maxScore,
    isCorrect: correctCount === correctOrder.length,
    partialScore,
    feedback: correctCount === correctOrder.length
      ? 'Perfect order!'
      : `${correctCount} of ${correctOrder.length} items in correct position`
  };
}

function scoreDragDrop(correct: any, response: any, maxScore: number): ScoringResult {
  const zones = correct.zones || [];
  const placements = response.placements || {};
  let correctCount = 0;

  zones.forEach((zone: any) => {
    const acceptedItems = zone.acceptsItems || [];
    const placedItem = placements[zone.id];
    if (acceptedItems.includes(placedItem)) {
      correctCount++;
    }
  });

  const partialScore = zones.length > 0 ? correctCount / zones.length : 0;
  const score = Math.round(maxScore * partialScore);

  return {
    score,
    maxScore,
    isCorrect: correctCount === zones.length,
    partialScore,
    feedback: correctCount === zones.length
      ? 'All items placed correctly!'
      : `${correctCount} of ${zones.length} items correct`
  };
}

function scoreMemoryGame(correct: any, response: any, maxScore: number): ScoringResult {
  // Memory game scoring based on moves and time
  const pairs = correct.pairs?.length || 0;
  const movesUsed = response.moves || 0;
  const minMoves = pairs * 2;
  const efficiency = movesUsed > 0 ? Math.min(1, minMoves / movesUsed) : 0;
  const score = Math.round(maxScore * efficiency);

  return {
    score,
    maxScore,
    isCorrect: response.completed === true,
    partialScore: efficiency,
    feedback: response.completed
      ? `Completed in ${movesUsed} moves!`
      : 'Game not completed'
  };
}

function scoreArithmetic(correct: any, response: any, maxScore: number): ScoringResult {
  const problems = correct.problems || [];
  const answers = response.answers || [];
  let correctCount = 0;

  problems.forEach((problem: any, index: number) => {
    if (parseFloat(answers[index]) === problem.answer) {
      correctCount++;
    }
  });

  const partialScore = problems.length > 0 ? correctCount / problems.length : 0;
  const score = Math.round(maxScore * partialScore);

  return {
    score,
    maxScore,
    isCorrect: correctCount === problems.length,
    partialScore,
    feedback: correctCount === problems.length
      ? 'All calculations correct!'
      : `${correctCount} of ${problems.length} correct`
  };
}

function scoreFlashcards(correct: any, response: any, maxScore: number): ScoringResult {
  // Flashcards are self-assessed, full credit for reviewing all
  const cards = correct.cards?.length || 0;
  const reviewed = response.reviewedCount || 0;
  const partialScore = cards > 0 ? Math.min(1, reviewed / cards) : 0;
  const score = Math.round(maxScore * partialScore);

  return {
    score,
    maxScore,
    isCorrect: reviewed >= cards,
    partialScore,
    feedback: reviewed >= cards
      ? 'All cards reviewed!'
      : `${reviewed} of ${cards} cards reviewed`
  };
}

function scoreWordSearch(correct: any, response: any, maxScore: number): ScoringResult {
  const words = correct.words || [];
  const found = response.foundWords || [];
  let correctCount = 0;

  words.forEach((word: any) => {
    const wordToFind = (word.word || word).toLowerCase();
    if (found.some((f: string) => f.toLowerCase() === wordToFind)) {
      correctCount++;
    }
  });

  const partialScore = words.length > 0 ? correctCount / words.length : 0;
  const score = Math.round(maxScore * partialScore);

  return {
    score,
    maxScore,
    isCorrect: correctCount === words.length,
    partialScore,
    feedback: correctCount === words.length
      ? 'All words found!'
      : `${correctCount} of ${words.length} words found`
  };
}

function scoreCrossword(correct: any, response: any, maxScore: number): ScoringResult {
  const allClues = [...(correct.clues?.across || []), ...(correct.clues?.down || [])];
  const answers = response.answers || {};
  let correctCount = 0;

  allClues.forEach((clue: any) => {
    const key = `${clue.row}-${clue.col}-${clue.direction || (correct.clues?.across?.includes(clue) ? 'across' : 'down')}`;
    const userAnswer = (answers[key] || '').toLowerCase().trim();
    const correctAnswer = clue.answer.toLowerCase().trim();
    if (userAnswer === correctAnswer) {
      correctCount++;
    }
  });

  const partialScore = allClues.length > 0 ? correctCount / allClues.length : 0;
  const score = Math.round(maxScore * partialScore);

  return {
    score,
    maxScore,
    isCorrect: correctCount === allClues.length,
    partialScore,
    feedback: correctCount === allClues.length
      ? 'Crossword complete!'
      : `${correctCount} of ${allClues.length} clues correct`
  };
}

function scoreImageHotspots(correct: any, response: any, maxScore: number): ScoringResult {
  const hotspots = correct.hotspots || [];
  const clicked = response.clickedHotspots || [];
  let correctCount = 0;

  // Check if user clicked all required hotspots
  hotspots.forEach((hotspot: any) => {
    if (clicked.includes(hotspot.id)) {
      correctCount++;
    }
  });

  const partialScore = hotspots.length > 0 ? correctCount / hotspots.length : 0;
  const score = Math.round(maxScore * partialScore);

  return {
    score,
    maxScore,
    isCorrect: correctCount === hotspots.length,
    partialScore,
    feedback: correctCount === hotspots.length
      ? 'All hotspots discovered!'
      : `${correctCount} of ${hotspots.length} hotspots found`
  };
}

// ==================== AI JOB PROCESSING ====================

async function processAiJob(jobId: string, payload: any) {
  const job = aiJobs.get(jobId);
  if (!job) return;

  job.status = 'running';
  job.updatedAt = Date.now();

  try {
    const result = await generateActivitiesInternal(payload);
    job.result = result;
    job.status = 'completed';
  } catch (error: any) {
    job.error = error?.message || 'Failed to generate activities';
    job.status = 'failed';
  } finally {
    job.updatedAt = Date.now();
  }
}

async function generateActivitiesInternal(payload: any) {
  const {
    prompt, ageRange, activityTypes, activityCount,
    createdBy, assignedTo, textProvider, difficulty,
    pointsPerActivity = 20
  } = payload;

  // Get activity types to use
  let selectedTypes = activityTypes;
  if (!selectedTypes || selectedTypes.length === 0) {
    selectedTypes = await selectActivityTypes(prompt, ageRange, activityCount, textProvider);
  }

  // Generate activities - cycle through preferred types to meet activityCount
  const activities = [];
  const targetCount = activityCount || selectedTypes.length;

  for (let i = 0; i < targetCount; i++) {
    // Cycle through selected types if we need more activities than types
    const typeName = selectedTypes[i % selectedTypes.length];
    const activityType: any = db.prepare('SELECT * FROM activity_types WHERE name = ?').get(typeName);
    if (!activityType) continue;

    const activityContent = await generateActivityContent(
      typeName, prompt, ageRange, difficulty, textProvider
    );

    if (activityContent) {
      activities.push({
        activityTypeId: activityType.id,
        points: pointsPerActivity,
        ...activityContent
      });
    }
  }

  if (activities.length === 0) {
    throw new Error('Failed to generate any activities');
  }

  // Create session with activities
  const title = generateTitle(prompt);
  const result = db.prepare(`
    INSERT INTO learning_sessions (
      title, topic, age_range, created_by, assigned_to, is_ai_generated, ai_prompt
    ) VALUES (?, ?, ?, ?, ?, 1, ?)
  `).run(title, prompt, ageRange, createdBy, assignedTo, prompt);

  const sessionId = result.lastInsertRowid;

  // Insert activities
  const insertActivity = db.prepare(`
    INSERT INTO learning_activities (
      session_id, activity_type_id, title, instructions,
      content_data, correct_data, hints, points, order_index, difficulty
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  activities.forEach((activity, index) => {
    insertActivity.run(
      sessionId,
      activity.activityTypeId,
      activity.title,
      activity.instructions,
      JSON.stringify(activity.contentData),
      JSON.stringify(activity.correctData),
      JSON.stringify(activity.hints || []),
      activity.points || pointsPerActivity,
      index,
      difficulty
    );
  });

  // Notify child
  sendPushNotification(assignedTo, {
    type: 'new_learning_session' as any,
    title: 'New Learning Activities!',
    message: `You have new activities about "${prompt}" to try!`,
    icon: '🎯',
    data: { sessionId },
    url: '/activities'
  });

  return { sessionId, activityCount: activities.length };
}

function generateTitle(prompt: string): string {
  const words = prompt.split(' ').slice(0, 5);
  return words.join(' ') + (words.length < prompt.split(' ').length ? '...' : '');
}

async function selectActivityTypes(
  topic: string,
  ageRange: string,
  count: number,
  provider: string
): Promise<string[]> {
  const systemPrompt = `You are an expert children's education designer. Select the best activity types to teach a concept.

Available activity types:
- multiple_choice: Best for knowledge recall and quick assessment
- true_false: Quick fact checking
- fill_blanks: Good for vocabulary/spelling
- matching: Excellent for relationships and associations
- sorting: Perfect for sequences and order
- drag_drop: Great for categorization
- memory_game: Fun for associations
- flashcards: Ideal for memorization
- arithmetic: Math practice
- word_search: Vocabulary reinforcement

Select ${count} activity types that best teach this topic for age ${ageRange || 'children'}.

Return ONLY a JSON array of type names, like: ["multiple_choice", "matching", "fill_blanks"]`;

  const userPrompt = `Topic: "${topic}"`;

  try {
    const response = await callAiProvider(provider, systemPrompt, userPrompt);
    const types = parseAiJson(response);
    if (Array.isArray(types) && types.length > 0) {
      return types.slice(0, count);
    }
  } catch (error) {
    console.error('Failed to select activity types, using defaults:', error);
  }

  // Default fallback
  return ['multiple_choice', 'matching', 'fill_blanks'].slice(0, count);
}

async function generateActivityContent(
  typeName: string,
  topic: string,
  ageRange: string,
  difficulty: string,
  provider: string
): Promise<any> {
  const prompts = getActivityPrompt(typeName, topic, ageRange, difficulty);

  try {
    const response = await callAiProvider(provider, prompts.system, prompts.user);
    const content = parseAiJson(response);
    return content;
  } catch (error) {
    console.error(`Failed to generate ${typeName} content:`, error);
    return null;
  }
}

function getActivityPrompt(typeName: string, topic: string, ageRange: string, difficulty: string): { system: string; user: string } {
  const baseContext = `Create educational content for ${ageRange || 'children'} about "${topic}". Difficulty: ${difficulty}.`;

  const prompts: Record<string, { system: string; user: string }> = {
    multiple_choice: {
      system: `${baseContext} Create a multiple choice question.
Return JSON: { "title": "...", "instructions": "Choose the correct answer", "contentData": { "question": "...", "options": [{"id": "a", "text": "..."}, {"id": "b", "text": "..."}, {"id": "c", "text": "..."}, {"id": "d", "text": "..."}] }, "correctData": { "correctAnswer": "a" }, "hints": ["hint1"] }`,
      user: `Create a multiple choice question about: ${topic}`
    },
    true_false: {
      system: `${baseContext} Create true/false statements.
Return JSON: { "title": "...", "instructions": "Is this true or false?", "contentData": { "statements": [{"text": "...", "isTrue": true}, {"text": "...", "isTrue": false}] }, "correctData": { "answers": [true, false] }, "hints": [] }`,
      user: `Create 3 true/false statements about: ${topic}`
    },
    fill_blanks: {
      system: `${baseContext} Create fill-in-the-blank sentences. Use ___ for blanks.
Return JSON: { "title": "...", "instructions": "Fill in the missing words", "contentData": { "sentences": ["The ___ is...", "A ___ can..."] }, "correctData": { "blanks": [{"position": 0, "answer": "word", "acceptAlternatives": []}] }, "hints": [] }`,
      user: `Create 2-3 fill-in-the-blank sentences about: ${topic}`
    },
    matching: {
      system: `${baseContext} Create matching pairs for a matching game.
Return JSON: { "title": "...", "instructions": "Match the pairs", "contentData": { "pairs": [{"left": "Term 1", "right": "Match 1"}, {"left": "Term 2", "right": "Match 2"}, {"left": "Term 3", "right": "Match 3"}] }, "correctData": { "correctPairs": {"0": 0, "1": 1, "2": 2} }, "hints": [] }
The "pairs" array contains the correct matches. "correctPairs" maps left index (as string key) to right index (number value). Always include at least 4 pairs.`,
      user: `Create 4-5 matching pairs about: ${topic}`
    },
    sorting: {
      system: `${baseContext} Create items to sort in order.
Return JSON: { "title": "...", "instructions": "Put in the correct order", "contentData": { "items": [{"id": "1", "text": "..."}, {"id": "2", "text": "..."}], "sortBy": "from first to last" }, "correctData": { "correctOrder": ["1", "2", "3"] }, "hints": [] }`,
      user: `Create 4-5 items to sort about: ${topic}`
    },
    drag_drop: {
      system: `${baseContext} Create drag and drop categorization.
Return JSON: { "title": "...", "instructions": "Drag items to the correct category", "contentData": { "items": [{"id": "i1", "text": "..."}], "zones": [{"id": "z1", "label": "Category 1"}] }, "correctData": { "zones": [{"id": "z1", "acceptsItems": ["i1", "i2"]}] }, "hints": [] }`,
      user: `Create a categorization activity about: ${topic}`
    },
    memory_game: {
      system: `${baseContext} Create memory card pairs.
Return JSON: { "title": "...", "instructions": "Find the matching pairs", "contentData": { "pairs": [{"id": "1", "front": "Term", "back": "Definition"}], "gridSize": {"rows": 2, "cols": 4} }, "correctData": { "pairs": [{"id": "1"}] }, "hints": [] }`,
      user: `Create 4-6 memory pairs about: ${topic}`
    },
    flashcards: {
      system: `${baseContext} Create flashcards.
Return JSON: { "title": "...", "instructions": "Review these flashcards", "contentData": { "cards": [{"front": "Question", "back": "Answer"}], "reviewMode": "sequential" }, "correctData": { "cards": [] }, "hints": [] }`,
      user: `Create 5-6 flashcards about: ${topic}`
    },
    arithmetic: {
      system: `${baseContext} Create math problems.
Return JSON: { "title": "...", "instructions": "Solve these problems", "contentData": { "problems": [{"expression": "5 + 3", "answer": 8}], "allowCalculator": false }, "correctData": { "problems": [{"expression": "5 + 3", "answer": 8}] }, "hints": [] }`,
      user: `Create 5 math problems related to: ${topic}`
    },
    word_search: {
      system: `${baseContext} Create a word search puzzle.
Return JSON: { "title": "...", "instructions": "Find the hidden words", "contentData": { "grid": [["A","B"],["C","D"]], "words": [{"word": "WORD", "hint": "optional hint"}], "gridSize": {"rows": 8, "cols": 8} }, "correctData": { "words": [{"word": "WORD"}] }, "hints": [] }`,
      user: `Create a word search with 4-5 words about: ${topic}`
    }
  };

  return prompts[typeName] || prompts.multiple_choice;
}

async function callAiProvider(provider: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const ollamaUrl = getOllamaUrl();
  const ollamaModel = getOllamaModel();
  const grokKey = getGrokApiKey();
  const openaiKey = getOpenAiApiKey();
  const geminiKey = getGeminiApiKey();

  // Try preferred provider first
  if (provider === 'ollama' && ollamaUrl) {
    return await callOllama(ollamaUrl, ollamaModel, systemPrompt, userPrompt);
  }
  if (provider === 'gemini' && geminiKey) {
    return await callGemini(geminiKey, systemPrompt, userPrompt);
  }
  if (provider === 'grok' && grokKey) {
    return await callGrok(grokKey, systemPrompt, userPrompt);
  }
  if (provider === 'openai' && openaiKey) {
    return await callOpenAi(openaiKey, systemPrompt, userPrompt);
  }

  // Fallback chain
  if (ollamaUrl) return await callOllama(ollamaUrl, ollamaModel, systemPrompt, userPrompt);
  if (geminiKey) return await callGemini(geminiKey, systemPrompt, userPrompt);
  if (grokKey) return await callGrok(grokKey, systemPrompt, userPrompt);
  if (openaiKey) return await callOpenAi(openaiKey, systemPrompt, userPrompt);

  throw new Error('No AI provider available');
}

async function callOllama(url: string, model: string, system: string, user: string): Promise<string> {
  const response = await axios.post(url, {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    stream: false
  }, { timeout: 120000 });

  return response.data?.message?.content || '';
}

async function callGemini(apiKey: string, system: string, user: string): Promise<string> {
  const response = await axios.post(
    `${GEMINI_API_URL}?key=${apiKey}`,
    {
      contents: [{
        parts: [{ text: `${system}\n\n${user}` }]
      }],
      generationConfig: { temperature: 0.7 }
    },
    { timeout: 60000 }
  );

  return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callGrok(apiKey: string, system: string, user: string): Promise<string> {
  const response = await axios.post(
    GROK_API_URL,
    {
      model: 'grok-3-latest',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.7
    },
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 60000
    }
  );

  return response.data?.choices?.[0]?.message?.content || '';
}

async function callOpenAi(apiKey: string, system: string, user: string): Promise<string> {
  const response = await axios.post(
    OPENAI_CHAT_URL,
    {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7
    },
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 60000
    }
  );

  return response.data?.choices?.[0]?.message?.content || '';
}

// ==================== MEDIA UPLOAD ====================

router.post('/sessions/:sessionId/media', activityMediaUpload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/api/activities/media/${req.file.filename}`;
    res.json({ url: fileUrl, filename: req.file.filename });
  } catch (error: any) {
    console.error('Failed to upload media:', error);
    res.status(500).json({ error: 'Failed to upload media' });
  }
});

export default router;
