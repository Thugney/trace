import express, { Response } from 'express';
import db from '../database/init';
import { authenticate, AuthRequest } from '../middleware/auth';
import { NotificationHelpers } from '../services/notifications';
import { checkMysteryReward } from './gamification';

const router = express.Router();

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
      estimated_minutes
    } = req.body;

    if (!profile_id || !title) {
      return res.status(400).json({ error: 'profile_id and title are required' });
    }

    // Calculate points based on difficulty if not provided
    let taskPoints = points;
    if (!taskPoints && difficulty) {
      const pointsMap: Record<string, number> = { easy: 10, medium: 20, hard: 30 };
      taskPoints = pointsMap[difficulty] || 10;
    }

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
        priority, estimated_minutes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      profile_id,
      title,
      description || null,
      category || 'chore',
      taskPoints || 10,
      difficulty || 'easy',
      is_recurring ? 1 : 0,
      recurrence_pattern || null,
      due_date || null,
      created_by || null,
      parentApproved,
      approvedBy,
      priority || 'medium',
      estimated_minutes || null
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
      updates.push('due_date = ?');
      values.push(due_date);
    }
    if (completed !== undefined) {
      updates.push('completed = ?');
      values.push(completed ? 1 : 0);
      if (completed) {
        updates.push('completed_at = CURRENT_TIMESTAMP');
      }
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
router.post('/:id/complete', (req, res) => {
  try {
    const { id } = req.params;

    // Get task
    const task: any = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.completed) {
      return res.status(400).json({ error: 'Task already completed' });
    }

    // Mark task as completed
    db.prepare(`
      UPDATE tasks SET completed = 1, completed_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(id);

    // Award points to profile
    const basePoints = task.points || 10;
    const stars = task.difficulty === 'hard' ? 3 : task.difficulty === 'medium' ? 2 : 1;

    // Check for mystery reward (15% chance for bonus)
    const mysteryReward = checkMysteryReward(task.profile_id, parseInt(id), basePoints);
    const bonusPoints = mysteryReward ? mysteryReward.bonusPoints : 0;
    const points = basePoints + bonusPoints;

    // Get current progress
    const currentProgress: any = db.prepare(`
      SELECT * FROM progress WHERE profile_id = ? ORDER BY logged_at DESC LIMIT 1
    `).get(task.profile_id);

    const totalPoints = (currentProgress?.total_points || 0) + points;
    const totalStars = (currentProgress?.total_stars || 0) + stars;
    const level = Math.floor(totalPoints / 100) + 1;

    // Insert progress record
    db.prepare(`
      INSERT INTO progress (profile_id, task_id, points_earned, stars_earned, level, total_points, total_stars)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(task.profile_id, id, points, stars, level, totalPoints, totalStars);

    const completedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    const progress = db.prepare(`
      SELECT * FROM progress WHERE profile_id = ? ORDER BY logged_at DESC LIMIT 1
    `).get(task.profile_id);

    // Send notification to parent that child completed a task
    const profile: any = db.prepare('SELECT name, type FROM profiles WHERE id = ?').get(task.profile_id);
    if (profile && profile.type === 'child') {
      NotificationHelpers.taskCompleted(task.profile_id, profile.name, task.title, points).catch(console.error);
    }

    // Handle recurring tasks - create next occurrence
    let nextTask = null;
    if (task.is_recurring && task.recurrence_pattern) {
      const nextDueDate = calculateNextDueDate(task.due_date, task.recurrence_pattern);

      const newTaskResult = db.prepare(`
        INSERT INTO tasks (
          profile_id, title, description, category, points, difficulty,
          is_recurring, recurrence_pattern, due_date, created_by, parent_approved, approved_by,
          priority, estimated_minutes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        task.estimated_minutes
      );

      nextTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(newTaskResult.lastInsertRowid);
      console.log(`[Tasks] Created next recurring task: ${task.title}, due: ${nextDueDate}`);
    }

    res.json({
      task: completedTask,
      progress,
      pointsEarned: points,
      starsEarned: stars,
      nextRecurringTask: nextTask,
      mysteryReward: mysteryReward ? {
        type: mysteryReward.rewardType,
        multiplier: mysteryReward.multiplier,
        bonusPoints: mysteryReward.bonusPoints
      } : null
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to calculate next due date for recurring tasks
function calculateNextDueDate(currentDueDate: string | null, pattern: string): string {
  const baseDate = currentDueDate ? new Date(currentDueDate) : new Date();
  const today = new Date();

  // If base date is in the past, start from today
  if (baseDate < today) {
    baseDate.setTime(today.getTime());
  }

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

  return baseDate.toISOString().split('T')[0];
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

    // Get weekly stats
    const weeklyStats = db.prepare(`
      SELECT
        SUM(points_earned) as points_this_week,
        SUM(stars_earned) as stars_this_week,
        COUNT(DISTINCT task_id) as tasks_completed_this_week
      FROM progress
      WHERE profile_id = ?
        AND DATE(logged_at) >= DATE('now', '-7 days')
    `).get(profileId);

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

export default router;
