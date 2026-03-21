import express, { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../database/init';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireFeature } from '../middleware/feature-access';
import { NotificationHelpers } from '../services/notifications';
import { checkMysteryReward, updateCountdownProgress, incrementSpinProgress, checkHiddenAchievementsOnTaskComplete } from './gamification';
import { formatDateOnly, getTodayDateOnly, normalizeDateOnlyInput, parseDateOnly, startOfLocalDay } from '../utils/date-only';
import {
  checkRateLimit,
  updateRateLimit,
  checkTaskTimeElapsed,
  canEarnPoints,
  applyPointsMultiplier,
  recordEarnings,
  areBonusesEnabled,
  isSpinWheelEnabled,
  areCountdownChallengesEnabled
} from '../services/economyControl';

const router = express.Router();
router.use(authenticate, requireFeature('tasks'));

// Configure multer for photo proof uploads
const PROOF_DIR = process.env.PROOF_DIR || '/app/data/proofs';

// Ensure proof directory exists
if (!fs.existsSync(PROOF_DIR)) {
  fs.mkdirSync(PROOF_DIR, { recursive: true });
  console.log(`[Proof] Created proof directory: ${PROOF_DIR}`);
}

const proofStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PROOF_DIR);
  },
  filename: (req, file, cb) => {
    const taskId = req.params.id;
    const ext = path.extname(file.originalname) || '.jpg';
    const filename = `task-${taskId}-${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const proofUpload = multer({
  storage: proofStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get tasks for a profile
router.get('/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;
    const { completed, category } = req.query;

    let query = 'SELECT * FROM tasks WHERE profile_id = ?';
    const params: any[] = [profileId];

    if (completed !== undefined) {
      query += ' AND completed = ?';
      params.push(completed === 'true' ? 1 : 0);
    }

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    query += ' ORDER BY due_date ASC, created_at DESC';

    const tasks = db.prepare(query).all(...params);
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single task
router.get('/task/:id', (req, res) => {
  try {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Categories that require a timer by default
const TIMED_CATEGORIES_CREATE = ['read-book', 'tigrinya', 'clean-room', 'clean-kitchen', 'school'];

// Default timer durations by category (in minutes)
const DEFAULT_TIMER_DURATIONS_CREATE: Record<string, number> = {
  'read-book': 15,
  'tigrinya': 20,
  'clean-room': 15,
  'clean-kitchen': 20,
  'school': 30,
  'other': 10
};

// Create task
router.post('/', (req, res) => {
  try {
    const {
      profile_id,
      title,
      description,
      category,
      points,
      difficulty,
      is_recurring,
      recurrence_pattern,
      due_date,
      created_by,
      priority,
      estimated_minutes,
      requires_timer,
      timer_duration_minutes,
      scheduled_time // HH:MM format for task-specific reminders
    } = req.body;

    if (!profile_id || !title) {
      return res.status(400).json({ error: 'profile_id and title are required' });
    }

    // Due date is mandatory for all tasks
    if (!due_date) {
      return res.status(400).json({ error: 'due_date is required. All tasks must have a due date.' });
    }

    let normalizedDueDate: string | null;
    try {
      normalizedDueDate = normalizeDateOnlyInput(due_date);
    } catch {
      return res.status(400).json({ error: 'Invalid due_date. Expected YYYY-MM-DD.' });
    }

    // Calculate points based on difficulty if not provided
    let taskPoints = points;
    if (!taskPoints && difficulty) {
      const pointsMap: Record<string, number> = { easy: 10, medium: 20, hard: 30 };
      taskPoints = pointsMap[difficulty] || 10;
    }

    // Determine if timer is required based on category (unless explicitly set)
    const taskCategory = category || 'other';
    const needsTimer = requires_timer !== undefined
      ? (requires_timer ? 1 : 0)
      : (TIMED_CATEGORIES_CREATE.includes(taskCategory) ? 1 : 0);

    // Set default timer duration based on category
    const timerDuration = timer_duration_minutes ||
      (needsTimer ? DEFAULT_TIMER_DURATIONS_CREATE[taskCategory] || 10 : null);

    // Check if creator is parent or admin - auto-approve
    // Check if creator is child - require parent approval
    let parentApproved = 0;
    let approvedBy = null;

    if (created_by) {
      const creator: any = db.prepare('SELECT type FROM profiles WHERE id = ?').get(created_by);
      if (creator && (creator.type === 'parent' || creator.type === 'admin')) {
        parentApproved = 1;
        approvedBy = created_by;
      }
    }

    const result = db.prepare(`
      INSERT INTO tasks (
        profile_id, title, description, category, points, difficulty,
        is_recurring, recurrence_pattern, due_date, created_by, parent_approved, approved_by,
        priority, estimated_minutes, requires_timer, timer_duration_minutes, scheduled_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      profile_id,
      title,
      description || null,
      taskCategory,
      taskPoints || 10,
      difficulty || 'easy',
      is_recurring ? 1 : 0,
      recurrence_pattern || null,
      normalizedDueDate,
      created_by || null,
      parentApproved,
      approvedBy,
      priority || 'medium',
      estimated_minutes || null,
      needsTimer,
      timerDuration,
      scheduled_time || null // HH:MM format
    );

    const newTask: any = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);

    // Send notification if child created a task (needs approval)
    if (!parentApproved && created_by) {
      const creator: any = db.prepare('SELECT name, type FROM profiles WHERE id = ?').get(created_by);
      if (creator && creator.type === 'child') {
        NotificationHelpers.taskCreatedByChild(created_by, creator.name, title).catch(console.error);
      }
    }

    res.status(201).json(newTask);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update task
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      category,
      points,
      difficulty,
      is_recurring,
      recurrence_pattern,
      due_date,
      completed
    } = req.body;

    const updates: string[] = [];
    const values: any[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category);
    }
    if (points !== undefined) {
      updates.push('points = ?');
      values.push(points);
    }
    if (difficulty !== undefined) {
      updates.push('difficulty = ?');
      values.push(difficulty);
    }
    if (is_recurring !== undefined) {
      updates.push('is_recurring = ?');
      values.push(is_recurring ? 1 : 0);
    }
    if (recurrence_pattern !== undefined) {
      updates.push('recurrence_pattern = ?');
      values.push(recurrence_pattern);
    }
    if (req.body.priority !== undefined) {
      updates.push('priority = ?');
      values.push(req.body.priority);
    }
    if (req.body.estimated_minutes !== undefined) {
      updates.push('estimated_minutes = ?');
      values.push(req.body.estimated_minutes);
    }
    if (due_date !== undefined) {
      let normalizedDueDate: string | null;
      try {
        normalizedDueDate = normalizeDateOnlyInput(due_date);
      } catch {
        return res.status(400).json({ error: 'Invalid due_date. Expected YYYY-MM-DD.' });
      }
      updates.push('due_date = ?');
      values.push(normalizedDueDate);
    }
    if (completed !== undefined) {
      updates.push('completed = ?');
      values.push(completed ? 1 : 0);
      if (completed) {
        updates.push('completed_at = CURRENT_TIMESTAMP');
      }
    }
    if (req.body.scheduled_time !== undefined) {
      updates.push('scheduled_time = ?');
      values.push(req.body.scheduled_time || null);
    }

    values.push(id);

    db.prepare(`
      UPDATE tasks
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);

    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.json(updatedTask);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Complete task and award points
// WITH ECONOMY CONTROLS: rate limiting, time verification, daily caps
// RACE CONDITION FIX: Uses transaction to ensure atomic points calculation
router.post('/:id/complete', (req, res) => {
  try {
    const { id } = req.params;
    const today = getTodayDateOnly();

    // Get task first (outside transaction for early validation)
    const task: any = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // ===== ANTI-ABUSE CHECK 0: Already completed today =====
    if (task.last_completed_date === today) {
      return res.status(400).json({
        error: 'This task was already completed today. You cannot earn more points for it.',
        code: 'ALREADY_COMPLETED_TODAY'
      });
    }

    // ===== ANTI-ABUSE CHECK 0.5: Timer required but not used =====
    if (task.requires_timer === 1) {
      return res.status(400).json({
        error: 'This task requires a timer. Please use the Start Timer button to begin.',
        code: 'TIMER_REQUIRED',
        requires_timer: true,
        timer_duration_minutes: task.timer_duration_minutes
      });
    }

    // ===== ANTI-ABUSE CHECK 0.6: Task is overdue (past due date) =====
    if (task.due_date) {
      const dueDate = parseDateOnly(task.due_date);
      const todayStart = startOfLocalDay(new Date());
      if (dueDate && dueDate < todayStart) {
        return res.status(400).json({
          error: 'This task is overdue and can no longer be completed. The due date has passed.',
          code: 'TASK_OVERDUE',
          due_date: task.due_date
        });
      }
    }

    // ===== ANTI-ABUSE CHECK 1: Already completed =====
    if (task.completed) {
      return res.status(400).json({ error: 'Task already completed', code: 'ALREADY_COMPLETED' });
    }

    // ===== ANTI-ABUSE CHECK 2: Rate limiting (cooldown) =====
    const rateCheck = checkRateLimit(task.profile_id, 'task');
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Please wait ${rateCheck.waitSeconds} seconds before completing another task`,
        code: 'RATE_LIMITED',
        waitSeconds: rateCheck.waitSeconds
      });
    }

    // ===== ANTI-ABUSE CHECK 3: Time elapsed for timed tasks =====
    const timeCheck = checkTaskTimeElapsed(task);
    if (!timeCheck.allowed) {
      return res.status(400).json({
        error: timeCheck.reason,
        code: 'TIME_NOT_ELAPSED',
        minutesRemaining: timeCheck.minutesRemaining
      });
    }

    // ===== ANTI-ABUSE CHECK 4: Proof required but not provided =====
    if (task.proof_required && !task.proof_photo_url) {
      return res.status(400).json({
        error: 'This task requires photo proof. Please upload a photo first.',
        code: 'PROOF_REQUIRED'
      });
    }

    // Calculate base points with multiplier
    const rawPoints = task.points || 10;
    const basePoints = applyPointsMultiplier(task.profile_id, rawPoints);
    const stars = task.difficulty === 'hard' ? 3 : task.difficulty === 'medium' ? 2 : 1;

    // ===== ANTI-ABUSE CHECK 5: Daily/weekly caps =====
    const capCheck = canEarnPoints(task.profile_id, basePoints);
    if (!capCheck.allowed) {
      return res.status(400).json({
        error: capCheck.reason,
        code: 'EARNING_CAP_REACHED'
      });
    }

    // Apply cap if needed
    const cappedPoints = capCheck.cappedAmount !== undefined ? capCheck.cappedAmount : basePoints;

    // ===== TRANSACTION: Complete task and award points atomically =====
    // This prevents race conditions where two concurrent task completions
    // read the same total_points and then both add on top, losing points
    const completeTaskTransaction = db.transaction(() => {
      // Atomically mark task as completed (prevents duplicate completion)
      const updateResult = db.prepare(`
        UPDATE tasks SET completed = 1, completed_at = CURRENT_TIMESTAMP, last_completed_date = ?
        WHERE id = ? AND completed = 0
      `).run(today, id);

      // If no rows updated, task was already completed (race condition caught)
      if (updateResult.changes === 0) {
        return { error: 'Task already completed', code: 'ALREADY_COMPLETED' };
      }

      // Update rate limit tracker
      updateRateLimit(task.profile_id, 'task');

      // Check for mystery reward (only if bonuses enabled)
      let mysteryReward = null;
      let bonusPoints = 0;
      if (areBonusesEnabled(task.profile_id)) {
        mysteryReward = checkMysteryReward(task.profile_id, parseInt(id), cappedPoints);
        if (mysteryReward) {
          // Cap bonus points too
          const maxBonusCheck = canEarnPoints(task.profile_id, mysteryReward.bonusPoints);
          bonusPoints = maxBonusCheck.cappedAmount !== undefined
            ? Math.min(mysteryReward.bonusPoints, maxBonusCheck.cappedAmount)
            : mysteryReward.bonusPoints;
        }
      }

      const totalPointsEarned = cappedPoints + bonusPoints;

      // Get current progress INSIDE transaction for consistency
      const currentProgress: any = db.prepare(`
        SELECT * FROM progress WHERE profile_id = ? ORDER BY logged_at DESC LIMIT 1
      `).get(task.profile_id);

      const totalPoints = (currentProgress?.total_points || 0) + totalPointsEarned;
      const totalStars = (currentProgress?.total_stars || 0) + stars;
      const level = Math.floor(totalPoints / 100) + 1;

      // Insert progress record
      db.prepare(`
        INSERT INTO progress (profile_id, task_id, points_earned, stars_earned, level, total_points, total_stars)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(task.profile_id, id, totalPointsEarned, stars, level, totalPoints, totalStars);

      // Record earnings in daily tracker
      recordEarnings(task.profile_id, totalPointsEarned, stars, true, bonusPoints > 0);

      return {
        success: true,
        totalPointsEarned,
        bonusPoints,
        mysteryReward,
        totalPoints,
        totalStars,
        level
      };
    });

    // Execute the transaction
    const txResult = completeTaskTransaction();

    if (txResult.error) {
      return res.status(400).json({ error: txResult.error, code: txResult.code });
    }

    // TypeScript narrowing: after error check, these values are guaranteed to exist
    const totalPointsEarned = txResult.totalPointsEarned!;
    const bonusPoints = txResult.bonusPoints!;
    const mysteryReward = txResult.mysteryReward;

    const completedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    const progress = db.prepare(`
      SELECT * FROM progress WHERE profile_id = ? ORDER BY logged_at DESC LIMIT 1
    `).get(task.profile_id);

    // Send notification to parent that child completed a task
    const profile: any = db.prepare('SELECT name, type FROM profiles WHERE id = ?').get(task.profile_id);
    if (profile && profile.type === 'child') {
      NotificationHelpers.taskCompleted(task.profile_id, profile.name, task.title, totalPointsEarned).catch(console.error);
    }

    // Handle recurring tasks - create next occurrence
    let nextTask = null;
    if (task.is_recurring && task.recurrence_pattern) {
      const nextDueDate = calculateNextDueDate(task.due_date, task.recurrence_pattern);

      const newTaskResult = db.prepare(`
        INSERT INTO tasks (
          profile_id, title, description, category, points, difficulty,
          is_recurring, recurrence_pattern, due_date, created_by, parent_approved, approved_by,
          priority, estimated_minutes, proof_required
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        task.profile_id,
        task.title,
        task.description,
        task.category,
        task.points,
        task.difficulty,
        1, // is_recurring
        task.recurrence_pattern,
        nextDueDate,
        task.created_by,
        task.parent_approved,
        task.approved_by,
        task.priority || 'medium',
        task.estimated_minutes,
        task.proof_required || 0
      );

      nextTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(newTaskResult.lastInsertRowid);
      console.log(`[Tasks] Created next recurring task: ${task.title}, due: ${nextDueDate}`);
    }

    // ===== GAMIFICATION FEATURES (with economy checks) =====
    let countdownResult = null;
    let spinReady = false;

    // Update countdown challenge progress (if enabled)
    if (areCountdownChallengesEnabled(task.profile_id)) {
      countdownResult = updateCountdownProgress(task.profile_id, cappedPoints);
    }

    // Increment spin wheel progress (if enabled)
    if (isSpinWheelEnabled(task.profile_id)) {
      spinReady = incrementSpinProgress(task.profile_id);
    }

    // Check for hidden achievements
    checkHiddenAchievementsOnTaskComplete(task.profile_id, new Date());

    // Include cap warning in response if points were reduced
    const wasPointsCapped = cappedPoints < basePoints || (capCheck.cappedAmount !== undefined);

    res.json({
      task: completedTask,
      progress,
      pointsEarned: totalPointsEarned,
      starsEarned: stars,
      nextRecurringTask: nextTask,
      mysteryReward: mysteryReward ? {
        type: mysteryReward.rewardType,
        multiplier: mysteryReward.multiplier,
        bonusPoints: bonusPoints
      } : null,
      countdownChallenge: countdownResult,
      spinWheelReady: spinReady,
      // Economy info
      economyInfo: wasPointsCapped ? {
        warning: 'Points were capped due to daily/weekly limits',
        originalPoints: basePoints,
        actualPoints: cappedPoints
      } : null
    });
  } catch (error: any) {
    console.error('[Tasks] Complete error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Day name to number mapping
const DAY_MAP: Record<string, number> = {
  'sun': 0, 'sunday': 0,
  'mon': 1, 'monday': 1,
  'tue': 2, 'tuesday': 2,
  'wed': 3, 'wednesday': 3,
  'thu': 4, 'thursday': 4,
  'fri': 5, 'friday': 5,
  'sat': 6, 'saturday': 6
};

// Helper function to calculate next due date for recurring tasks
// Supports patterns:
// - daily, weekdays, weekly, biweekly, monthly (basic)
// - specific_days:mon,wed,fri (specific days of week)
// - every_N_days (every N days, e.g., every_3_days)
// - day_of_month_N (specific day of month, e.g., day_of_month_15)
function calculateNextDueDate(currentDueDate: string | null, pattern: string): string {
  const baseDate = parseDateOnly(currentDueDate) || startOfLocalDay(new Date());
  const today = startOfLocalDay(new Date());

  // If base date is in the past, start from today
  if (baseDate < today) {
    baseDate.setTime(today.getTime());
  }

  // Handle specific_days pattern (e.g., "specific_days:mon,wed,fri")
  if (pattern.startsWith('specific_days:')) {
    const daysStr = pattern.replace('specific_days:', '');
    const days = daysStr.split(',').map(d => DAY_MAP[d.trim().toLowerCase()]).filter(d => d !== undefined);

    if (days.length > 0) {
      // Find the next occurrence of one of the specified days
      let found = false;
      for (let i = 1; i <= 7 && !found; i++) {
        const checkDate = new Date(baseDate);
        checkDate.setDate(checkDate.getDate() + i);
        if (days.includes(checkDate.getDay())) {
          baseDate.setTime(checkDate.getTime());
          found = true;
        }
      }
    } else {
      // Fallback to daily if no valid days
      baseDate.setDate(baseDate.getDate() + 1);
    }
    return formatDateOnly(baseDate);
  }

  // Handle every_N_days pattern (e.g., "every_3_days")
  if (pattern.startsWith('every_') && pattern.endsWith('_days')) {
    const match = pattern.match(/every_(\d+)_days/);
    if (match) {
      const n = parseInt(match[1], 10);
      baseDate.setDate(baseDate.getDate() + (n > 0 ? n : 1));
      return formatDateOnly(baseDate);
    }
  }

  // Handle day_of_month_N pattern (e.g., "day_of_month_15")
  if (pattern.startsWith('day_of_month_')) {
    const match = pattern.match(/day_of_month_(\d+)/);
    if (match) {
      const targetDay = parseInt(match[1], 10);
      if (targetDay >= 1 && targetDay <= 31) {
        // Move to next month if the target day has passed this month
        if (baseDate.getDate() >= targetDay) {
          baseDate.setMonth(baseDate.getMonth() + 1);
        }
        // Set to target day (or last day of month if target exceeds month's days)
        const lastDayOfMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate();
        baseDate.setDate(Math.min(targetDay, lastDayOfMonth));
        return formatDateOnly(baseDate);
      }
    }
  }

  // Basic patterns
  switch (pattern) {
    case 'daily':
      baseDate.setDate(baseDate.getDate() + 1);
      break;
    case 'weekdays':
      // Move to next weekday
      do {
        baseDate.setDate(baseDate.getDate() + 1);
      } while (baseDate.getDay() === 0 || baseDate.getDay() === 6);
      break;
    case 'weekly':
      baseDate.setDate(baseDate.getDate() + 7);
      break;
    case 'biweekly':
      baseDate.setDate(baseDate.getDate() + 14);
      break;
    case 'monthly':
      baseDate.setMonth(baseDate.getMonth() + 1);
      break;
    default:
      baseDate.setDate(baseDate.getDate() + 1);
  }

  return formatDateOnly(baseDate);
}

// Delete task - with authorization (owner, parent of owner, or admin)
router.delete('/:id', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const userProfile = req.profile!;

    // Get task to check ownership
    const task: any = db.prepare('SELECT profile_id FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Authorization: admin can delete any, owner can delete own, parent can delete child's
    let canDelete = false;
    if (userProfile.type === 'admin') {
      canDelete = true;
    } else if (userProfile.id === task.profile_id) {
      // Owner can delete their own task
      canDelete = true;
    } else if (userProfile.type === 'parent') {
      // Parent can delete their child's task
      const taskOwner: any = db.prepare('SELECT parent_id FROM profiles WHERE id = ?').get(task.profile_id);
      if (taskOwner && taskOwner.parent_id === userProfile.id) {
        canDelete = true;
      }
    }

    if (!canDelete) {
      return res.status(403).json({ error: 'Access denied: You can only delete your own tasks or your children\'s tasks' });
    }

    const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ message: 'Task deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get progress for profile
router.get('/progress/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;
    const { limit = 30 } = req.query;

    const progress = db.prepare(`
      SELECT * FROM progress
      WHERE profile_id = ?
      ORDER BY logged_at DESC
      LIMIT ?
    `).all(profileId, limit);

    const current: any = db.prepare(`
      SELECT * FROM progress WHERE profile_id = ? ORDER BY logged_at DESC LIMIT 1
    `).get(profileId);

    // Get weekly stats (use difference method for points reliability)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = formatDateOnly(weekAgo);

    const weekStartProgress: any = db.prepare(`
      SELECT total_points, total_stars FROM progress
      WHERE profile_id = ? AND DATE(logged_at) < DATE(?)
      ORDER BY logged_at DESC LIMIT 1
    `).get(profileId, weekAgoStr);

    const tasksThisWeek: any = db.prepare(`
      SELECT COUNT(DISTINCT task_id) as count
      FROM progress
      WHERE profile_id = ? AND DATE(logged_at) >= DATE(?)
    `).get(profileId, weekAgoStr);

    const weeklyStats = {
      points_this_week: (current?.total_points || 0) - (weekStartProgress?.total_points || 0),
      stars_this_week: (current?.total_stars || 0) - (weekStartProgress?.total_stars || 0),
      tasks_completed_this_week: tasksThisWeek?.count || 0
    };

    res.json({
      current: current || { total_points: 0, total_stars: 0, level: 1 },
      history: progress,
      weekly: weeklyStats || { points_this_week: 0, stars_this_week: 0, tasks_completed_this_week: 0 }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get rewards
router.get('/rewards/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;
    const rewards = db.prepare(`
      SELECT * FROM rewards WHERE profile_id = ? ORDER BY points_required ASC
    `).all(profileId);

    res.json(rewards);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create reward
router.post('/rewards', (req, res) => {
  try {
    const { profile_id, title, description, type, points_required, icon } = req.body;

    if (!profile_id || !title || !points_required) {
      return res.status(400).json({ error: 'profile_id, title, and points_required are required' });
    }

    const result = db.prepare(`
      INSERT INTO rewards (profile_id, title, description, type, points_required, icon)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      profile_id,
      title,
      description || null,
      type || 'virtual',
      points_required,
      icon || null
    );

    const reward = db.prepare('SELECT * FROM rewards WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(reward);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Claim reward
router.post('/rewards/:id/claim', (req, res) => {
  try {
    const { id } = req.params;

    const reward: any = db.prepare('SELECT * FROM rewards WHERE id = ?').get(id);
    if (!reward) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    if (reward.is_claimed) {
      return res.status(400).json({ error: 'Reward already claimed' });
    }

    // Check if profile has enough points
    const progress: any = db.prepare(`
      SELECT * FROM progress WHERE profile_id = ? ORDER BY logged_at DESC LIMIT 1
    `).get(reward.profile_id);

    if (!progress || progress.total_points < reward.points_required) {
      return res.status(400).json({ error: 'Not enough points to claim this reward' });
    }

    // Claim reward
    db.prepare(`
      UPDATE rewards SET is_claimed = 1, claimed_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(id);

    const claimedReward = db.prepare('SELECT * FROM rewards WHERE id = ?').get(id);
    res.json(claimedReward);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Approve task (parent/admin only)
router.post('/:id/approve', (req, res) => {
  try {
    const { id } = req.params;
    const { approved_by } = req.body;

    if (!approved_by) {
      return res.status(400).json({ error: 'approved_by is required' });
    }

    // Verify approver is parent or admin
    const approver: any = db.prepare('SELECT type FROM profiles WHERE id = ?').get(approved_by);
    if (!approver || (approver.type !== 'parent' && approver.type !== 'admin')) {
      return res.status(403).json({ error: 'Only parents or admins can approve tasks' });
    }

    // Get task before approval for notification
    const task: any = db.prepare('SELECT title, profile_id FROM tasks WHERE id = ?').get(id);

    db.prepare(`
      UPDATE tasks
      SET parent_approved = 1, approved_by = ?
      WHERE id = ?
    `).run(approved_by, id);

    const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

    // Send notification to child that their task was approved
    if (task) {
      NotificationHelpers.taskApproved(task.profile_id, task.title).catch(console.error);
    }

    res.json(updatedTask);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reject/delete task (parent/admin only)
router.post('/:id/reject', (req, res) => {
  try {
    const { id } = req.params;
    const { rejected_by } = req.body;

    if (!rejected_by) {
      return res.status(400).json({ error: 'rejected_by is required' });
    }

    // Verify rejector is parent or admin
    const rejector: any = db.prepare('SELECT type FROM profiles WHERE id = ?').get(rejected_by);
    if (!rejector || (rejector.type !== 'parent' && rejector.type !== 'admin')) {
      return res.status(403).json({ error: 'Only parents or admins can reject tasks' });
    }

    // Get task before deletion for notification
    const task: any = db.prepare('SELECT title, profile_id FROM tasks WHERE id = ?').get(id);

    const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Send notification to child that their task was rejected
    if (task) {
      NotificationHelpers.taskRejected(task.profile_id, task.title).catch(console.error);
    }

    res.json({ message: 'Task rejected and deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get pending tasks (for parents to review)
router.get('/pending/:parentId', (req, res) => {
  try {
    const { parentId } = req.params;

    // Optimized single-query approach using JOIN to avoid N+1 queries
    const pendingTasks = db.prepare(`
      SELECT t.*, p.name as child_name, p.avatar as child_avatar
      FROM tasks t
      JOIN profiles p ON t.profile_id = p.id
      WHERE p.parent_id = ? AND p.type = 'child' AND t.parent_approved = 0
      ORDER BY t.created_at DESC
    `).all(parentId);

    res.json(pendingTasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get tasks with photo proofs pending parent verification
router.get('/pending-proofs/:parentId', (req, res) => {
  try {
    const { parentId } = req.params;

    // Get tasks that have photo proof uploaded but are not yet completed
    const pendingProofs = db.prepare(`
      SELECT t.*, p.name as child_name, p.avatar as child_avatar
      FROM tasks t
      JOIN profiles p ON t.profile_id = p.id
      WHERE p.parent_id = ?
        AND p.type = 'child'
        AND t.proof_required = 1
        AND t.proof_photo_url IS NOT NULL
        AND t.completed = 0
      ORDER BY t.created_at DESC
    `).all(parentId);

    res.json(pendingProofs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Verify photo proof (parent approves or rejects)
router.post('/:id/verify-proof', (req, res) => {
  try {
    const { id } = req.params;
    const { approved, verified_by } = req.body;

    if (!verified_by) {
      return res.status(400).json({ error: 'verified_by is required' });
    }

    // Verify that verifier is parent or admin
    const verifier: any = db.prepare('SELECT type FROM profiles WHERE id = ?').get(verified_by);
    if (!verifier || (verifier.type !== 'parent' && verifier.type !== 'admin')) {
      return res.status(403).json({ error: 'Only parents or admins can verify photo proofs' });
    }

    // Get task
    const task: any = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (approved) {
      // Approve: Complete the task and award points
      db.prepare('UPDATE tasks SET completed = 1, completed_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

      // Delete proof photo to save storage (task is approved, no longer needed)
      const proofFiles = fs.readdirSync(PROOF_DIR).filter((f: string) => f.startsWith(`task-${id}-`));
      for (const file of proofFiles) {
        try {
          fs.unlinkSync(path.join(PROOF_DIR, file));
          console.log(`[Proof] Deleted proof file after approval: ${file}`);
        } catch (err) {
          console.error(`[Proof] Failed to delete proof file: ${file}`, err);
        }
      }
      // Clear proof URL in database
      db.prepare('UPDATE tasks SET proof_photo_url = NULL WHERE id = ?').run(id);

      // Award points
      const basePoints = task.points || 10;
      const stars = task.difficulty === 'hard' ? 3 : task.difficulty === 'medium' ? 2 : 1;

      // Get current progress
      const currentProgress: any = db.prepare(`
        SELECT * FROM progress WHERE profile_id = ? ORDER BY logged_at DESC LIMIT 1
      `).get(task.profile_id);

      const totalPoints = (currentProgress?.total_points || 0) + basePoints;
      const totalStars = (currentProgress?.total_stars || 0) + stars;
      const level = Math.floor(totalPoints / 100) + 1;

      // Insert progress record
      db.prepare(`
        INSERT INTO progress (profile_id, task_id, points_earned, stars_earned, level, total_points, total_stars)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(task.profile_id, id, basePoints, stars, level, totalPoints, totalStars);

      // Handle recurring tasks
      if (task.is_recurring && task.recurrence_pattern) {
        const nextDueDate = calculateNextDueDate(task.due_date, task.recurrence_pattern);
        db.prepare(`
          INSERT INTO tasks (
            profile_id, title, description, category, points, difficulty,
            is_recurring, recurrence_pattern, due_date, created_by, parent_approved, approved_by,
            priority, estimated_minutes, proof_required
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          task.profile_id, task.title, task.description, task.category, task.points, task.difficulty,
          1, task.recurrence_pattern, nextDueDate, task.created_by, task.parent_approved, task.approved_by,
          task.priority || 'medium', task.estimated_minutes, task.proof_required || 0
        );
      }

      const completedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
      res.json({
        success: true,
        message: 'Photo proof approved, task completed!',
        task: completedTask,
        pointsEarned: basePoints,
        starsEarned: stars
      });
    } else {
      // Reject: Clear the photo URL so child can upload again
      // Also delete the photo file
      const fs = require('fs');
      const PROOF_DIR = process.env.PROOF_DIR || '/app/data/proofs';
      const proofFiles = fs.readdirSync(PROOF_DIR).filter((f: string) => f.startsWith(`task-${id}-`));
      for (const file of proofFiles) {
        fs.unlinkSync(require('path').join(PROOF_DIR, file));
      }

      db.prepare('UPDATE tasks SET proof_photo_url = NULL WHERE id = ?').run(id);

      res.json({
        success: true,
        message: 'Photo proof rejected. Child can upload a new photo.',
        task: db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
      });
    }
  } catch (error: any) {
    console.error('[Tasks] Verify proof error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== SUBTASKS ====================

// Get subtasks for a task
router.get('/:taskId/subtasks', (req, res) => {
  try {
    const { taskId } = req.params;
    const subtasks = db.prepare(
      'SELECT * FROM subtasks WHERE task_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(taskId);
    res.json(subtasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add subtask to a task
router.post('/:taskId/subtasks', (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, sort_order } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Get max sort_order for this task
    const maxOrder: any = db.prepare(
      'SELECT MAX(sort_order) as max FROM subtasks WHERE task_id = ?'
    ).get(taskId);

    const result = db.prepare(`
      INSERT INTO subtasks (task_id, title, sort_order)
      VALUES (?, ?, ?)
    `).run(taskId, title, sort_order ?? (maxOrder?.max || 0) + 1);

    const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(subtask);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update subtask (toggle complete or edit title)
router.put('/subtasks/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, completed, sort_order } = req.body;

    const updates: string[] = [];
    const values: any[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (completed !== undefined) {
      updates.push('completed = ?');
      values.push(completed ? 1 : 0);
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      values.push(sort_order);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    values.push(id);
    db.prepare(`UPDATE subtasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const subtask = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id);
    res.json(subtask);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete subtask
router.delete('/subtasks/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM subtasks WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Subtask not found' });
    }
    res.json({ message: 'Subtask deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk add subtasks to a task
router.post('/:taskId/subtasks/bulk', (req, res) => {
  try {
    const { taskId } = req.params;
    const { subtasks } = req.body;

    if (!Array.isArray(subtasks) || subtasks.length === 0) {
      return res.status(400).json({ error: 'subtasks array is required' });
    }

    const insertStmt = db.prepare(`
      INSERT INTO subtasks (task_id, title, sort_order)
      VALUES (?, ?, ?)
    `);

    const insertMany = db.transaction((items: { title: string; sort_order?: number }[]) => {
      items.forEach((item, index) => {
        insertStmt.run(taskId, item.title, item.sort_order ?? index);
      });
    });

    insertMany(subtasks);

    const allSubtasks = db.prepare(
      'SELECT * FROM subtasks WHERE task_id = ? ORDER BY sort_order ASC'
    ).all(taskId);

    res.status(201).json(allSubtasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== Photo Proof Routes ====================

// Upload photo proof for a task
router.post('/:id/proof', (req, res) => {
  proofUpload.single('proof')(req, res, async (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 10MB' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }

    try {
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No photo uploaded' });
      }

      // Get task
      const task: any = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
      if (!task) {
        // Clean up uploaded file
        fs.unlinkSync(file.path);
        return res.status(404).json({ error: 'Task not found' });
      }

      // Store the proof URL (without /api prefix - frontend adds it)
      const proofUrl = `/tasks/${id}/proof`;
      db.prepare('UPDATE tasks SET proof_photo_url = ? WHERE id = ?').run(proofUrl, id);

      const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

      console.log(`[Proof] Photo uploaded for task ${id}: ${file.filename}`);

      res.json({
        success: true,
        task: updatedTask,
        message: 'Photo proof uploaded successfully'
      });
    } catch (error: any) {
      console.error('[Proof] Upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Get photo proof for a task
router.get('/:id/proof', (req, res) => {
  try {
    const { id } = req.params;

    // Get task
    const task: any = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!task.proof_photo_url) {
      return res.status(404).json({ error: 'No photo proof for this task' });
    }

    // Find the proof file
    const proofFiles = fs.readdirSync(PROOF_DIR).filter(f => f.startsWith(`task-${id}-`));
    if (proofFiles.length === 0) {
      return res.status(404).json({ error: 'Proof file not found' });
    }

    // Get the latest proof file
    const latestFile = proofFiles.sort().reverse()[0];
    const filePath = path.join(PROOF_DIR, latestFile);

    // Determine content type
    const ext = path.extname(latestFile).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };

    res.setHeader('Content-Type', contentTypes[ext] || 'image/jpeg');
    res.sendFile(filePath);
  } catch (error: any) {
    console.error('[Proof] Get proof error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete photo proof for a task
router.delete('/:id/proof', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get task
    const task: any = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Delete proof files
    const proofFiles = fs.readdirSync(PROOF_DIR).filter(f => f.startsWith(`task-${id}-`));
    for (const file of proofFiles) {
      fs.unlinkSync(path.join(PROOF_DIR, file));
    }

    // Clear proof URL
    db.prepare('UPDATE tasks SET proof_photo_url = NULL WHERE id = ?').run(id);

    res.json({ success: true, message: 'Photo proof deleted' });
  } catch (error: any) {
    console.error('[Proof] Delete proof error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== TIMER ENDPOINTS ====================

// Categories that require a timer by default
const TIMED_CATEGORIES = ['read-book', 'tigrinya', 'clean-room', 'clean-kitchen', 'school'];

// Default timer durations by category (in minutes)
const DEFAULT_TIMER_DURATIONS: Record<string, number> = {
  'read-book': 15,
  'tigrinya': 20,
  'clean-room': 15,
  'clean-kitchen': 20,
  'school': 30,
  'other': 10
};

// Get timer state for a task
router.get('/:id/timer', (req, res) => {
  try {
    const { id } = req.params;

    const task: any = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get active timer state
    const timerState: any = db.prepare(`
      SELECT * FROM timer_states
      WHERE task_id = ? AND timer_type = 'task'
      ORDER BY last_updated DESC LIMIT 1
    `).get(id);

    // Calculate current elapsed time if timer is running
    let currentElapsed = timerState?.elapsed_seconds || 0;
    if (timerState?.is_running && timerState.start_time) {
      const now = Date.now();
      const startTime = new Date(timerState.start_time).getTime();
      const runningTime = Math.floor((now - startTime) / 1000);
      currentElapsed = timerState.elapsed_seconds + runningTime;
    }

    res.json({
      task_id: parseInt(id),
      requires_timer: task.requires_timer === 1,
      timer_duration_minutes: task.timer_duration_minutes,
      timer_state: timerState ? {
        is_running: !!timerState.is_running,
        is_paused: !!timerState.is_paused,
        elapsed_seconds: currentElapsed,
        start_time: timerState.start_time,
        pause_time: timerState.pause_time
      } : null,
      can_complete: !task.requires_timer || (timerState && currentElapsed > 0),
      completed_today: task.last_completed_date === getTodayDateOnly()
    });
  } catch (error: any) {
    console.error('[Timer] Get timer state error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start timer for a task
router.post('/:id/timer/start', (req, res) => {
  try {
    const { id } = req.params;

    const task: any = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if task is already completed today
    const today = getTodayDateOnly();
    if (task.last_completed_date === today) {
      return res.status(400).json({
        error: 'This task was already completed today',
        code: 'ALREADY_COMPLETED_TODAY'
      });
    }

    // Check if there's already an active timer
    const existingTimer: any = db.prepare(`
      SELECT * FROM timer_states
      WHERE task_id = ? AND timer_type = 'task' AND (is_running = 1 OR is_paused = 1)
    `).get(id);

    if (existingTimer) {
      return res.status(400).json({
        error: 'Timer already exists for this task',
        code: 'TIMER_EXISTS',
        timer_state: existingTimer
      });
    }

    // Create new timer state
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO timer_states (profile_id, task_id, timer_type, is_running, is_paused, elapsed_seconds, start_time, last_updated)
      VALUES (?, ?, 'task', 1, 0, 0, ?, ?)
    `).run(task.profile_id, id, now, now);

    const newTimer = db.prepare(`
      SELECT * FROM timer_states WHERE task_id = ? AND timer_type = 'task' ORDER BY id DESC LIMIT 1
    `).get(id);

    console.log(`[Timer] Started timer for task ${id}`);

    res.json({
      success: true,
      message: 'Timer started',
      timer_state: newTimer
    });
  } catch (error: any) {
    console.error('[Timer] Start timer error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Pause timer for a task
router.post('/:id/timer/pause', (req, res) => {
  try {
    const { id } = req.params;

    const task: any = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get running timer
    const timerState: any = db.prepare(`
      SELECT * FROM timer_states
      WHERE task_id = ? AND timer_type = 'task' AND is_running = 1
    `).get(id);

    if (!timerState) {
      return res.status(400).json({
        error: 'No running timer found for this task',
        code: 'NO_RUNNING_TIMER'
      });
    }

    // Calculate elapsed time
    const now = new Date();
    const startTime = new Date(timerState.start_time);
    const additionalSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    const totalElapsed = timerState.elapsed_seconds + additionalSeconds;

    // Update timer state to paused
    db.prepare(`
      UPDATE timer_states
      SET is_running = 0, is_paused = 1, elapsed_seconds = ?, pause_time = ?, last_updated = ?
      WHERE id = ?
    `).run(totalElapsed, now.toISOString(), now.toISOString(), timerState.id);

    const updatedTimer = db.prepare('SELECT * FROM timer_states WHERE id = ?').get(timerState.id);

    console.log(`[Timer] Paused timer for task ${id}, elapsed: ${totalElapsed}s`);

    res.json({
      success: true,
      message: 'Timer paused',
      timer_state: updatedTimer
    });
  } catch (error: any) {
    console.error('[Timer] Pause timer error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Resume timer for a task
router.post('/:id/timer/resume', (req, res) => {
  try {
    const { id } = req.params;

    const task: any = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get paused timer
    const timerState: any = db.prepare(`
      SELECT * FROM timer_states
      WHERE task_id = ? AND timer_type = 'task' AND is_paused = 1
    `).get(id);

    if (!timerState) {
      return res.status(400).json({
        error: 'No paused timer found for this task',
        code: 'NO_PAUSED_TIMER'
      });
    }

    // Update timer state to running
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE timer_states
      SET is_running = 1, is_paused = 0, start_time = ?, pause_time = NULL, last_updated = ?
      WHERE id = ?
    `).run(now, now, timerState.id);

    const updatedTimer = db.prepare('SELECT * FROM timer_states WHERE id = ?').get(timerState.id);

    console.log(`[Timer] Resumed timer for task ${id}`);

    res.json({
      success: true,
      message: 'Timer resumed',
      timer_state: updatedTimer
    });
  } catch (error: any) {
    console.error('[Timer] Resume timer error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Finish timer and complete task
router.post('/:id/timer/finish', (req, res) => {
  try {
    const { id } = req.params;

    const task: any = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check if task is already completed today
    const today = getTodayDateOnly();
    if (task.last_completed_date === today) {
      return res.status(400).json({
        error: 'This task was already completed today. You cannot earn more points for it.',
        code: 'ALREADY_COMPLETED_TODAY'
      });
    }

    // Get active timer (running or paused)
    let timerState: any = db.prepare(`
      SELECT * FROM timer_states
      WHERE task_id = ? AND timer_type = 'task' AND (is_running = 1 OR is_paused = 1)
    `).get(id);

    // If task requires timer but no timer state exists, reject
    if (task.requires_timer && !timerState) {
      return res.status(400).json({
        error: 'This task requires a timer. Please start the timer first.',
        code: 'TIMER_REQUIRED'
      });
    }

    // Calculate final elapsed time
    let finalElapsed = 0;
    if (timerState) {
      finalElapsed = timerState.elapsed_seconds;
      if (timerState.is_running && timerState.start_time) {
        const now = Date.now();
        const startTime = new Date(timerState.start_time).getTime();
        finalElapsed += Math.floor((now - startTime) / 1000);
      }
    }

    // If task requires timer, check minimum time (at least 60 seconds)
    if (task.requires_timer && finalElapsed < 60) {
      return res.status(400).json({
        error: 'You need to work on this task for at least 1 minute before completing it.',
        code: 'MINIMUM_TIME_NOT_MET',
        elapsed_seconds: finalElapsed,
        minimum_seconds: 60
      });
    }

    // ===== TRANSACTION: Complete task via timer atomically =====
    // This prevents race conditions where points could be lost
    const finishTimerTransaction = db.transaction(() => {
      // Clean up timer state
      if (timerState) {
        db.prepare('DELETE FROM timer_states WHERE id = ?').run(timerState.id);
      }

      // Mark task as completed and set last_completed_date
      const updateResult = db.prepare(`
        UPDATE tasks
        SET completed = 1, completed_at = CURRENT_TIMESTAMP, last_completed_date = ?
        WHERE id = ? AND completed = 0
      `).run(today, id);

      // If no rows updated, task was already completed (race condition caught)
      if (updateResult.changes === 0) {
        return { error: 'Task already completed', code: 'ALREADY_COMPLETED' };
      }

      // Award points (using same logic as regular complete)
      const rawPoints = task.points || 10;
      const basePoints = applyPointsMultiplier(task.profile_id, rawPoints);
      const stars = task.difficulty === 'hard' ? 3 : task.difficulty === 'medium' ? 2 : 1;

      // Check caps
      const capCheck = canEarnPoints(task.profile_id, basePoints);
      const cappedPoints = capCheck.cappedAmount !== undefined ? capCheck.cappedAmount : basePoints;

      // Get current progress INSIDE transaction for consistency
      const currentProgress: any = db.prepare(`
        SELECT * FROM progress WHERE profile_id = ? ORDER BY logged_at DESC LIMIT 1
      `).get(task.profile_id);

      const totalPoints = (currentProgress?.total_points || 0) + cappedPoints;
      const totalStars = (currentProgress?.total_stars || 0) + stars;
      const level = Math.floor(totalPoints / 100) + 1;

      // Insert progress record
      db.prepare(`
        INSERT INTO progress (profile_id, task_id, points_earned, stars_earned, level, total_points, total_stars)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(task.profile_id, id, cappedPoints, stars, level, totalPoints, totalStars);

      // Record earnings
      recordEarnings(task.profile_id, cappedPoints, stars, true, false);

      // Handle recurring tasks
      let nextTask = null;
      if (task.is_recurring && task.recurrence_pattern) {
        const nextDueDate = calculateNextDueDate(task.due_date, task.recurrence_pattern);

        const newTaskResult = db.prepare(`
          INSERT INTO tasks (
            profile_id, title, description, category, points, difficulty,
            is_recurring, recurrence_pattern, due_date, created_by, parent_approved, approved_by,
            priority, estimated_minutes, proof_required, requires_timer, timer_duration_minutes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          task.profile_id,
          task.title,
          task.description,
          task.category,
          task.points,
          task.difficulty,
          1,
          task.recurrence_pattern,
          nextDueDate,
          task.created_by,
          task.parent_approved,
          task.approved_by,
          task.priority || 'medium',
          task.estimated_minutes,
          task.proof_required || 0,
          task.requires_timer || 0,
          task.timer_duration_minutes
        );

        nextTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(newTaskResult.lastInsertRowid);
      }

      return { success: true, cappedPoints, stars, nextTask };
    });

    // Execute the transaction
    const txResult = finishTimerTransaction();

    if (txResult.error) {
      return res.status(400).json({ error: txResult.error, code: txResult.code });
    }

    const { cappedPoints, stars, nextTask } = txResult;

    const completedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    const progress = db.prepare(`
      SELECT * FROM progress WHERE profile_id = ? ORDER BY logged_at DESC LIMIT 1
    `).get(task.profile_id);

    console.log(`[Timer] Task ${id} completed via timer, elapsed: ${finalElapsed}s, points: ${cappedPoints}`);

    res.json({
      success: true,
      task: completedTask,
      progress,
      pointsEarned: cappedPoints,
      starsEarned: stars,
      timeSpent: finalElapsed,
      nextRecurringTask: nextTask
    });
  } catch (error: any) {
    console.error('[Timer] Finish timer error:', error);
    res.status(500).json({ error: error.message });
  }
});

export { TIMED_CATEGORIES, DEFAULT_TIMER_DURATIONS };
export default router;
