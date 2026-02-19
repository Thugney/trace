import express from 'express';
import db from '../database/init';
import { createNotification, notifyParentOfChild } from '../services/notifications';

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
      created_by
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

    const result = db.prepare(`
      INSERT INTO tasks (
        profile_id, title, description, category, points, difficulty,
        is_recurring, recurrence_pattern, due_date, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      created_by || null
    );

    const newTask: any = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);

    // Notify the child that a new task was assigned
    try {
      const creator: any = created_by ? db.prepare('SELECT name FROM profiles WHERE id = ?').get(created_by) : null;
      const senderName = creator?.name || 'Parent';
      createNotification({
        recipient_id: profile_id,
        sender_id: created_by || undefined,
        type: 'task_assigned',
        title: 'New Task!',
        body: `${senderName} assigned you: "${title}"`,
        icon: '📋',
        data: { task_id: newTask.id }
      });
    } catch (e) {
      console.error('Failed to send task notification:', e);
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
    const points = task.points || 10;
    const stars = task.difficulty === 'hard' ? 3 : task.difficulty === 'medium' ? 2 : 1;

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

    // Notify parent(s) that child completed a task
    try {
      const child: any = db.prepare('SELECT name FROM profiles WHERE id = ?').get(task.profile_id);
      const childName = child?.name || 'Your child';
      notifyParentOfChild(task.profile_id, {
        sender_id: task.profile_id,
        type: 'task_completed',
        title: 'Task Completed!',
        body: `${childName} completed "${task.title}" and earned ${points} points!`,
        icon: '✅',
        data: { task_id: task.id, points_earned: points, stars_earned: stars }
      });
    } catch (e) {
      console.error('Failed to send task completion notification:', e);
    }

    res.json({
      task: completedTask,
      progress,
      pointsEarned: points,
      starsEarned: stars
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete task
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

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

    const reward: any = db.prepare('SELECT * FROM rewards WHERE id = ?').get(result.lastInsertRowid);

    // Notify the child about the new reward
    try {
      createNotification({
        recipient_id: profile_id,
        type: 'reward_created',
        title: 'New Reward Available!',
        body: `"${title}" is now available for ${points_required} points!`,
        icon: '🎁',
        data: { reward_id: reward.id }
      });
    } catch (e) {
      console.error('Failed to send reward notification:', e);
    }

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

    // Notify parent(s) that child claimed a reward
    try {
      const child: any = db.prepare('SELECT name FROM profiles WHERE id = ?').get(reward.profile_id);
      const childName = child?.name || 'Your child';
      notifyParentOfChild(reward.profile_id, {
        sender_id: reward.profile_id,
        type: 'reward_claimed',
        title: 'Reward Claimed!',
        body: `${childName} claimed the reward "${reward.title}" (${reward.points_required} points)`,
        icon: '🏆',
        data: { reward_id: reward.id }
      });
    } catch (e) {
      console.error('Failed to send reward claimed notification:', e);
    }

    res.json(claimedReward);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
