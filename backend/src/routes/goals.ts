import express from 'express';
import db from '../database/init';

const router = express.Router();

// Get monthly goals for a profile
router.get('/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;
    const { month } = req.query;

    let query = 'SELECT * FROM monthly_goals WHERE profile_id = ?';
    const params: any[] = [profileId];

    if (month) {
      query += ' AND month = ?';
      params.push(month);
    }

    query += ' ORDER BY created_at DESC';

    const goals = db.prepare(query).all(...params);
    res.json(goals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get current month's goal
router.get('/:profileId/current', (req, res) => {
  try {
    const { profileId } = req.params;
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    const goal = db.prepare(
      'SELECT * FROM monthly_goals WHERE profile_id = ? AND month = ?'
    ).get(profileId, currentMonth);

    res.json(goal || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create monthly goal
router.post('/', (req, res) => {
  try {
    const { profile_id, month, goal_description, goal_points, goal_type, notes } = req.body;

    if (!profile_id || !month || !goal_description || !goal_points) {
      return res.status(400).json({
        error: 'Profile ID, month, description, and points are required'
      });
    }

    // Check if goal already exists for this month
    const existing = db.prepare(
      'SELECT id FROM monthly_goals WHERE profile_id = ? AND month = ?'
    ).get(profile_id, month);

    if (existing) {
      return res.status(400).json({
        error: 'Goal already exists for this month'
      });
    }

    const result = db.prepare(`
      INSERT INTO monthly_goals (profile_id, month, goal_description, goal_points, goal_type, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(profile_id, month, goal_description, goal_points, goal_type || 'kroner', notes || null);

    const newGoal = db.prepare('SELECT * FROM monthly_goals WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newGoal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update monthly goal
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { goal_description, goal_points, goal_type, achieved, reward_given, notes } = req.body;

    const updates: string[] = [];
    const values: any[] = [];

    if (goal_description !== undefined) {
      updates.push('goal_description = ?');
      values.push(goal_description);
    }
    if (goal_points !== undefined) {
      updates.push('goal_points = ?');
      values.push(goal_points);
    }
    if (goal_type !== undefined) {
      updates.push('goal_type = ?');
      values.push(goal_type);
    }
    if (achieved !== undefined) {
      updates.push('achieved = ?');
      values.push(achieved ? 1 : 0);
    }
    if (reward_given !== undefined) {
      updates.push('reward_given = ?');
      values.push(reward_given ? 1 : 0);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`
      UPDATE monthly_goals
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);

    const updatedGoal = db.prepare('SELECT * FROM monthly_goals WHERE id = ?').get(id);
    res.json(updatedGoal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete monthly goal
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM monthly_goals WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    res.json({ message: 'Goal deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Award bonus points (creates progress entry without task_id)
router.post('/:profileId/bonus-points', (req, res) => {
  try {
    const { profileId } = req.params;
    const { points, stars, reason } = req.body;

    if (!points && !stars) {
      return res.status(400).json({ error: 'Points or stars required' });
    }

    // Create progress entry for bonus points
    const result = db.prepare(`
      INSERT INTO progress (profile_id, task_id, points_earned, stars_earned, total_points, total_stars, achievements)
      VALUES (?, NULL, ?, ?,
        (SELECT COALESCE(SUM(points_earned), 0) + ? FROM progress WHERE profile_id = ?),
        (SELECT COALESCE(SUM(stars_earned), 0) + ? FROM progress WHERE profile_id = ?),
        ?)
    `).run(
      profileId,
      points || 0,
      stars || 0,
      points || 0,
      profileId,
      stars || 0,
      profileId,
      JSON.stringify([{ type: 'bonus', reason, date: new Date().toISOString() }])
    );

    const bonusEntry = db.prepare('SELECT * FROM progress WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({
      message: 'Bonus points awarded!',
      progress: bonusEntry
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
