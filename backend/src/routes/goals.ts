import express, { Response } from 'express';
import db from '../database/init';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireFeature } from '../middleware/feature-access';
import { NotificationHelpers, sendPushNotification } from '../services/notifications';

const router = express.Router();
router.use(authenticate, requireFeature('goals'));

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

// Get current month's goal (legacy - returns single goal)
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

// Get all active (non-achieved) goals for a profile - supports multiple simultaneous goals
router.get('/:profileId/active', (req, res) => {
  try {
    const { profileId } = req.params;
    const { category } = req.query;

    let query = `
      SELECT mg.*,
        (SELECT COUNT(*) FROM goal_milestones gm WHERE gm.goal_id = mg.id AND gm.achieved = 1) as milestones_achieved,
        (SELECT COUNT(*) FROM goal_milestones gm WHERE gm.goal_id = mg.id) as total_milestones
      FROM monthly_goals mg
      WHERE mg.profile_id = ? AND mg.achieved = 0 AND mg.parent_approved = 1
    `;
    const params: any[] = [profileId];

    if (category && category !== 'all') {
      query += ' AND mg.goal_category = ?';
      params.push(category);
    }

    query += ' ORDER BY mg.created_at DESC';

    const goals = db.prepare(query).all(...params);

    // Get milestones for each goal
    const goalsWithMilestones = goals.map((goal: any) => {
      const milestones = db.prepare(
        'SELECT * FROM goal_milestones WHERE goal_id = ? ORDER BY milestone_points ASC'
      ).all(goal.id);
      return { ...goal, milestones };
    });

    res.json(goalsWithMilestones);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get goal history (achieved goals)
router.get('/:profileId/history', (req, res) => {
  try {
    const { profileId } = req.params;
    const { limit } = req.query;

    const goals = db.prepare(`
      SELECT * FROM monthly_goals
      WHERE profile_id = ? AND achieved = 1
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(profileId, parseInt(limit as string) || 20);

    // Get summary stats
    const stats: any = db.prepare(`
      SELECT
        COUNT(*) as total_achieved,
        SUM(goal_points) as total_points_earned,
        MAX(updated_at) as last_achievement
      FROM monthly_goals
      WHERE profile_id = ? AND achieved = 1
    `).get(profileId);

    res.json({
      goals,
      stats: {
        totalAchieved: stats.total_achieved || 0,
        totalPointsEarned: stats.total_points_earned || 0,
        lastAchievement: stats.last_achievement || null
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create monthly goal
router.post('/', (req, res) => {
  try {
    const { profile_id, month, goal_description, goal_points, goal_type, goal_category, reward_image, notes, created_by, milestones } = req.body;

    if (!profile_id || !month || !goal_description || !goal_points) {
      return res.status(400).json({
        error: 'Profile ID, month, description, and points are required'
      });
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
      INSERT INTO monthly_goals (profile_id, month, goal_description, goal_points, goal_type, goal_category, reward_image, notes, created_by, parent_approved, approved_by, current_points)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      profile_id,
      month,
      goal_description,
      goal_points,
      goal_type || 'kroner',
      goal_category || 'monthly',
      reward_image || null,
      notes || null,
      created_by || null,
      parentApproved,
      approvedBy
    );

    const goalId = result.lastInsertRowid;

    // Create milestones if provided
    if (milestones && Array.isArray(milestones)) {
      const insertMilestone = db.prepare(`
        INSERT INTO goal_milestones (goal_id, milestone_points, milestone_reward)
        VALUES (?, ?, ?)
      `);
      for (const milestone of milestones) {
        if (milestone.points && milestone.reward) {
          insertMilestone.run(goalId, milestone.points, milestone.reward);
        }
      }
    }

    const newGoal: any = db.prepare('SELECT * FROM monthly_goals WHERE id = ?').get(goalId);
    const goalMilestones = db.prepare('SELECT * FROM goal_milestones WHERE goal_id = ? ORDER BY milestone_points ASC').all(goalId);

    // Send notification if child created a goal (needs approval)
    if (!parentApproved && created_by) {
      const creator: any = db.prepare('SELECT name, type FROM profiles WHERE id = ?').get(created_by);
      if (creator && creator.type === 'child') {
        NotificationHelpers.goalCreatedByChild(created_by, creator.name, goal_description).catch(console.error);
      }
    }

    res.status(201).json({ ...newGoal, milestones: goalMilestones });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update monthly goal
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { goal_description, goal_points, goal_type, goal_category, reward_image, achieved, reward_given, notes } = req.body;

    // Get goal before update to check if being marked as achieved
    const beforeUpdate: any = db.prepare('SELECT * FROM monthly_goals WHERE id = ?').get(id);

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
    if (goal_category !== undefined) {
      updates.push('goal_category = ?');
      values.push(goal_category);
    }
    if (reward_image !== undefined) {
      updates.push('reward_image = ?');
      values.push(reward_image);
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

    const updatedGoal: any = db.prepare('SELECT * FROM monthly_goals WHERE id = ?').get(id);

    // Send notification if goal was just marked as achieved
    if (achieved && beforeUpdate && !beforeUpdate.achieved) {
      const profile: any = db.prepare('SELECT name, type FROM profiles WHERE id = ?').get(updatedGoal.profile_id);
      if (profile && profile.type === 'child') {
        NotificationHelpers.goalAchieved(updatedGoal.profile_id, profile.name, updatedGoal.goal_description).catch(console.error);
      }
    }

    res.json(updatedGoal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete goal - with authorization (owner, parent of owner, or admin)
router.delete('/:id', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const userProfile = req.profile!;

    // Get goal to check ownership
    const goal: any = db.prepare('SELECT profile_id FROM monthly_goals WHERE id = ?').get(req.params.id);
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Authorization: admin can delete any, owner can delete own, parent can delete child's
    let canDelete = false;
    if (userProfile.type === 'admin') {
      canDelete = true;
    } else if (userProfile.id === goal.profile_id) {
      // Owner can delete their own goal
      canDelete = true;
    } else if (userProfile.type === 'parent') {
      // Parent can delete their child's goal
      const goalOwner: any = db.prepare('SELECT parent_id FROM profiles WHERE id = ?').get(goal.profile_id);
      if (goalOwner && goalOwner.parent_id === userProfile.id) {
        canDelete = true;
      }
    }

    if (!canDelete) {
      return res.status(403).json({ error: 'Access denied: You can only delete your own goals or your children\'s goals' });
    }

    const result = db.prepare('DELETE FROM monthly_goals WHERE id = ?').run(req.params.id);
    res.json({ message: 'Goal deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Award bonus points (creates progress entry without task_id)
router.post('/:profileId/bonus-points', async (req, res) => {
  try {
    const { profileId } = req.params;
    const { points, stars, reason, awardedBy } = req.body;

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
      JSON.stringify([{ type: 'bonus', reason, awardedBy, date: new Date().toISOString() }])
    );

    const bonusEntry = db.prepare('SELECT * FROM progress WHERE id = ?').get(result.lastInsertRowid);

    // Get awarder's name for the notification
    let awarderName = 'Parent';
    if (awardedBy) {
      const awarder: any = db.prepare('SELECT name FROM profiles WHERE id = ?').get(awardedBy);
      if (awarder) awarderName = awarder.name;
    }

    // Send notification to the child about the bonus
    const rewardParts = [];
    if (points) rewardParts.push(`${points} points`);
    if (stars) rewardParts.push(`${stars} stars`);
    const rewardText = rewardParts.join(' and ');

    await sendPushNotification(parseInt(profileId), {
      type: 'achievement',
      title: 'Surprise Bonus! 🎉',
      message: `${awarderName} gave you ${rewardText}${reason ? ` for: ${reason}` : '!'}`,
      icon: '🎁',
      data: {
        bonusId: result.lastInsertRowid,
        points: points || 0,
        stars: stars || 0,
        reason: reason || '',
        awardedBy: awarderName
      },
      url: '/'
    });

    res.status(201).json({
      message: 'Bonus points awarded!',
      progress: bonusEntry
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add progress to a goal (points toward goal completion)
router.post('/:id/add-progress', (req, res) => {
  try {
    const { id } = req.params;
    const { points, reason } = req.body;

    if (!points || points <= 0) {
      return res.status(400).json({ error: 'Points must be a positive number' });
    }

    // Get current goal
    const goal: any = db.prepare('SELECT * FROM monthly_goals WHERE id = ?').get(id);
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    if (goal.achieved) {
      return res.status(400).json({ error: 'Goal is already achieved' });
    }

    const newPoints = (goal.current_points || 0) + points;
    const goalAchieved = newPoints >= goal.goal_points;

    // Update goal progress
    db.prepare(`
      UPDATE monthly_goals
      SET current_points = ?, achieved = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newPoints, goalAchieved ? 1 : 0, id);

    // Check for newly achieved milestones
    const newlyAchievedMilestones = db.prepare(`
      UPDATE goal_milestones
      SET achieved = 1, achieved_at = CURRENT_TIMESTAMP
      WHERE goal_id = ? AND milestone_points <= ? AND achieved = 0
    `).run(id, newPoints);

    // Get updated goal with milestones
    const updatedGoal: any = db.prepare('SELECT * FROM monthly_goals WHERE id = ?').get(id);
    const milestones = db.prepare('SELECT * FROM goal_milestones WHERE goal_id = ? ORDER BY milestone_points ASC').all(id);

    // Get just-achieved milestones for notification
    const justAchieved = db.prepare(`
      SELECT * FROM goal_milestones
      WHERE goal_id = ? AND achieved = 1 AND achieved_at >= datetime('now', '-1 minute')
      ORDER BY milestone_points ASC
    `).all(id);

    // Send notification if goal was just achieved
    if (goalAchieved && !goal.achieved) {
      const profile: any = db.prepare('SELECT name, type FROM profiles WHERE id = ?').get(updatedGoal.profile_id);
      if (profile && profile.type === 'child') {
        NotificationHelpers.goalAchieved(updatedGoal.profile_id, profile.name, updatedGoal.goal_description).catch(console.error);
      }
    }

    res.json({
      goal: { ...updatedGoal, milestones },
      pointsAdded: points,
      newTotal: newPoints,
      goalAchieved,
      milestonesAchieved: justAchieved,
      reason
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get milestones for a goal
router.get('/:id/milestones', (req, res) => {
  try {
    const { id } = req.params;
    const milestones = db.prepare(`
      SELECT * FROM goal_milestones WHERE goal_id = ? ORDER BY milestone_points ASC
    `).all(id);
    res.json(milestones);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add milestone to a goal
router.post('/:id/milestones', (req, res) => {
  try {
    const { id } = req.params;
    const { milestone_points, milestone_reward } = req.body;

    if (!milestone_points || !milestone_reward) {
      return res.status(400).json({ error: 'milestone_points and milestone_reward are required' });
    }

    // Check goal exists
    const goal = db.prepare('SELECT * FROM monthly_goals WHERE id = ?').get(id);
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const result = db.prepare(`
      INSERT INTO goal_milestones (goal_id, milestone_points, milestone_reward)
      VALUES (?, ?, ?)
    `).run(id, milestone_points, milestone_reward);

    const newMilestone = db.prepare('SELECT * FROM goal_milestones WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newMilestone);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete milestone
router.delete('/:goalId/milestones/:milestoneId', (req, res) => {
  try {
    const { goalId, milestoneId } = req.params;

    const result = db.prepare('DELETE FROM goal_milestones WHERE id = ? AND goal_id = ?').run(milestoneId, goalId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    res.json({ message: 'Milestone deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Approve goal (parent/admin only)
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
      return res.status(403).json({ error: 'Only parents or admins can approve goals' });
    }

    // Get goal before approval for notification
    const goal: any = db.prepare('SELECT goal_description, profile_id FROM monthly_goals WHERE id = ?').get(id);

    db.prepare(`
      UPDATE monthly_goals
      SET parent_approved = 1, approved_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(approved_by, id);

    const updatedGoal = db.prepare('SELECT * FROM monthly_goals WHERE id = ?').get(id);

    // Send notification to child that their goal was approved
    if (goal) {
      NotificationHelpers.goalApproved(goal.profile_id, goal.goal_description).catch(console.error);
    }

    res.json(updatedGoal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reject/delete goal (parent/admin only)
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
      return res.status(403).json({ error: 'Only parents or admins can reject goals' });
    }

    // Get goal before deletion for notification
    const goal: any = db.prepare('SELECT goal_description, profile_id FROM monthly_goals WHERE id = ?').get(id);

    const result = db.prepare('DELETE FROM monthly_goals WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    // Send notification to child that their goal was rejected
    if (goal) {
      sendPushNotification(goal.profile_id, {
        type: 'goal_rejected',
        title: 'Goal Not Approved',
        message: `Your goal "${goal.goal_description}" was not approved. Ask your parent why!`,
        icon: '❌',
        url: '/tasks'
      }).catch(console.error);
    }

    res.json({ message: 'Goal rejected and deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get pending goals (for parents to review)
router.get('/pending/:parentId', (req, res) => {
  try {
    const { parentId } = req.params;

    // Optimized single-query approach using JOIN to avoid N+1 queries
    const pendingGoals = db.prepare(`
      SELECT mg.*, p.name as child_name, p.avatar as child_avatar
      FROM monthly_goals mg
      JOIN profiles p ON mg.profile_id = p.id
      WHERE p.parent_id = ? AND p.type = 'child' AND mg.parent_approved = 0
      ORDER BY mg.created_at DESC
    `).all(parentId);

    res.json(pendingGoals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
