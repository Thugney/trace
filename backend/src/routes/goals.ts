import express, { Response } from 'express';
import db from '../database/init';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireFeature } from '../middleware/feature-access';
import { canAccessOwnOrManagedChild, canParentManageChild, getAccessibleParentIds, getManagedChildIdsForParent } from '../services/familyAccess';
import { NotificationHelpers, sendPushNotification } from '../services/notifications';

const router = express.Router();
router.use(authenticate, requireFeature('goals'));

function normalizeGoalCategory(value?: string) {
  if (!value) {
    return 'monthly';
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'monthly';
}

function normalizeGoalType(value?: string) {
  return value?.trim() || 'kroner';
}

function normalizeGoalTemplateName(value: string) {
  return value.trim().toLowerCase();
}

function isSystemGoalTemplate(template: { is_system?: number; is_default?: number }) {
  return Boolean(template.is_system) || Boolean(template.is_default);
}

function canManageGoalTemplate(viewer: AuthRequest['profile'], createdBy?: number | null) {
  if (!viewer) {
    return false;
  }

  if (viewer.type === 'admin') {
    return true;
  }

  if (viewer.type !== 'parent' || !createdBy) {
    return false;
  }

  return getAccessibleParentIds(viewer).includes(createdBy);
}

function getVisibleGoalTemplateOwnerIds(viewer: AuthRequest['profile']) {
  if (!viewer) {
    return [];
  }

  return getAccessibleParentIds(viewer);
}

function canViewGoalTemplate(viewer: AuthRequest['profile'], template: { created_by?: number | null; is_system?: number; is_default?: number }) {
  if (!viewer) {
    return false;
  }

  if (viewer.type === 'admin' || isSystemGoalTemplate(template)) {
    return true;
  }

  if (!template.created_by) {
    return false;
  }

  return getVisibleGoalTemplateOwnerIds(viewer).includes(template.created_by);
}

function denyGoalAccess(res: Response) {
  return res.status(403).json({ error: 'Access denied: You can only access your own or your children\'s goals' });
}

// Get monthly goals for a profile
router.get('/:profileId', (req: AuthRequest, res: Response) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);
    const { month } = req.query;

    if (!canAccessOwnOrManagedChild(req.profile!, profileIdNum)) {
      return denyGoalAccess(res);
    }

    let query = 'SELECT * FROM monthly_goals WHERE profile_id = ?';
    const params: any[] = [profileIdNum];

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
router.get('/:profileId/current', (req: AuthRequest, res: Response) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    if (!canAccessOwnOrManagedChild(req.profile!, profileIdNum)) {
      return denyGoalAccess(res);
    }

    const goal = db.prepare(
      'SELECT * FROM monthly_goals WHERE profile_id = ? AND month = ?'
    ).get(profileIdNum, currentMonth);

    res.json(goal || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all active (non-achieved) goals for a profile - supports multiple simultaneous goals
router.get('/:profileId/active', (req: AuthRequest, res: Response) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);
    const { category } = req.query;

    if (!canAccessOwnOrManagedChild(req.profile!, profileIdNum)) {
      return denyGoalAccess(res);
    }

    let query = `
      SELECT mg.*,
        (SELECT COUNT(*) FROM goal_milestones gm WHERE gm.goal_id = mg.id AND gm.achieved = 1) as milestones_achieved,
        (SELECT COUNT(*) FROM goal_milestones gm WHERE gm.goal_id = mg.id) as total_milestones
      FROM monthly_goals mg
      WHERE mg.profile_id = ? AND mg.achieved = 0 AND mg.parent_approved = 1
    `;
    const params: any[] = [profileIdNum];

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
router.get('/:profileId/history', (req: AuthRequest, res: Response) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);
    const { limit } = req.query;

    if (!canAccessOwnOrManagedChild(req.profile!, profileIdNum)) {
      return denyGoalAccess(res);
    }

    const goals = db.prepare(`
      SELECT * FROM monthly_goals
      WHERE profile_id = ? AND achieved = 1
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(profileIdNum, parseInt(limit as string) || 20);

    // Get summary stats
    const stats: any = db.prepare(`
      SELECT
        COUNT(*) as total_achieved,
        SUM(goal_points) as total_points_earned,
        MAX(updated_at) as last_achievement
      FROM monthly_goals
      WHERE profile_id = ? AND achieved = 1
    `).get(profileIdNum);

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
router.post('/', (req: AuthRequest, res: Response) => {
  try {
    const { profile_id, month, goal_description, goal_points, goal_type, goal_category, reward_image, notes, created_by, milestones } = req.body;
    const viewer = req.profile!;
    const profileIdNum = parseInt(String(profile_id), 10);

    if (!profileIdNum || !month || !goal_description || !goal_points) {
      return res.status(400).json({
        error: 'Profile ID, month, description, and points are required'
      });
    }

    if (!canAccessOwnOrManagedChild(viewer, profileIdNum)) {
      return denyGoalAccess(res);
    }

    // Check if creator is parent or admin - auto-approve
    // Check if creator is child - require parent approval
    let parentApproved = 0;
    let approvedBy = null;

    if (viewer.type === 'parent' || viewer.type === 'admin') {
      parentApproved = 1;
      approvedBy = viewer.id;
    } else if (created_by) {
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
      profileIdNum,
      month,
      String(goal_description).trim(),
      goal_points,
      normalizeGoalType(goal_type),
      normalizeGoalCategory(goal_category),
      reward_image || null,
      notes || null,
      viewer.id,
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
    if (!parentApproved) {
      const creator: any = db.prepare('SELECT name, type FROM profiles WHERE id = ?').get(viewer.id);
      if (creator && creator.type === 'child') {
        NotificationHelpers.goalCreatedByChild(viewer.id, creator.name, String(goal_description).trim()).catch(console.error);
      }
    }

    res.status(201).json({ ...newGoal, milestones: goalMilestones });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update monthly goal
router.put('/:id', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { goal_description, goal_points, goal_type, goal_category, reward_image, achieved, reward_given, notes } = req.body;
    const viewer = req.profile!;

    // Get goal before update to check if being marked as achieved
    const beforeUpdate: any = db.prepare('SELECT * FROM monthly_goals WHERE id = ?').get(id);
    if (!beforeUpdate) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    if (!canAccessOwnOrManagedChild(viewer, beforeUpdate.profile_id)) {
      return denyGoalAccess(res);
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (goal_description !== undefined) {
      updates.push('goal_description = ?');
      values.push(String(goal_description).trim());
    }
    if (goal_points !== undefined) {
      updates.push('goal_points = ?');
      values.push(goal_points);
    }
    if (goal_type !== undefined) {
      updates.push('goal_type = ?');
      values.push(normalizeGoalType(goal_type));
    }
    if (goal_category !== undefined) {
      updates.push('goal_category = ?');
      values.push(normalizeGoalCategory(goal_category));
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
      canDelete = canParentManageChild(userProfile.id, goal.profile_id);
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
// RACE CONDITION FIX: Uses transaction to ensure atomic points calculation
router.post('/:profileId/bonus-points', async (req: AuthRequest, res: Response) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);
    const { points, stars, reason, awardedBy } = req.body;

    if (!points && !stars) {
      return res.status(400).json({ error: 'Points or stars required' });
    }

    if (!canAccessOwnOrManagedChild(req.profile!, profileIdNum)) {
      return denyGoalAccess(res);
    }

    // Use transaction to prevent race conditions when awarding bonus points
    const awardBonus = db.transaction(() => {
      // Get current progress INSIDE transaction for consistency
      const currentProgress: any = db.prepare(`
        SELECT * FROM progress WHERE profile_id = ? ORDER BY logged_at DESC LIMIT 1
      `).get(profileIdNum);

      const currentPoints = currentProgress?.total_points || 0;
      const currentStars = currentProgress?.total_stars || 0;
      const newTotalPoints = currentPoints + (points || 0);
      const newTotalStars = currentStars + (stars || 0);
      const newLevel = Math.floor(newTotalPoints / 100) + 1;

      // Create progress entry for bonus points
      const result = db.prepare(`
        INSERT INTO progress (profile_id, task_id, points_earned, stars_earned, level, total_points, total_stars, achievements)
        VALUES (?, NULL, ?, ?, ?, ?, ?, ?)
      `).run(
        profileIdNum,
        points || 0,
        stars || 0,
        newLevel,
        newTotalPoints,
        newTotalStars,
        JSON.stringify([{ type: 'bonus', reason, awardedBy, date: new Date().toISOString() }])
      );

      return db.prepare('SELECT * FROM progress WHERE id = ?').get(result.lastInsertRowid);
    });

    // Execute the transaction
    const bonusEntry = awardBonus();

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

    await sendPushNotification(profileIdNum, {
      type: 'achievement',
      title: 'Surprise Bonus! 🎉',
      message: `${awarderName} gave you ${rewardText}${reason ? ` for: ${reason}` : '!'}`,
      icon: '🎁',
      data: {
        bonusId: (bonusEntry as any)?.id || 0,
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
router.post('/:id/add-progress', (req: AuthRequest, res: Response) => {
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

    if (!canAccessOwnOrManagedChild(req.profile!, goal.profile_id)) {
      return denyGoalAccess(res);
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
router.get('/:id/milestones', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const goal: any = db.prepare('SELECT profile_id FROM monthly_goals WHERE id = ?').get(id);
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    if (!canAccessOwnOrManagedChild(req.profile!, goal.profile_id)) {
      return denyGoalAccess(res);
    }

    const milestones = db.prepare(`
      SELECT * FROM goal_milestones WHERE goal_id = ? ORDER BY milestone_points ASC
    `).all(id);
    res.json(milestones);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add milestone to a goal
router.post('/:id/milestones', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { milestone_points, milestone_reward } = req.body;

    if (!milestone_points || !milestone_reward) {
      return res.status(400).json({ error: 'milestone_points and milestone_reward are required' });
    }

    // Check goal exists
    const goal: any = db.prepare('SELECT * FROM monthly_goals WHERE id = ?').get(id);
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    if (!canAccessOwnOrManagedChild(req.profile!, goal.profile_id)) {
      return denyGoalAccess(res);
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
router.delete('/:goalId/milestones/:milestoneId', (req: AuthRequest, res: Response) => {
  try {
    const { goalId, milestoneId } = req.params;
    const goal: any = db.prepare('SELECT profile_id FROM monthly_goals WHERE id = ?').get(goalId);
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    if (!canAccessOwnOrManagedChild(req.profile!, goal.profile_id)) {
      return denyGoalAccess(res);
    }

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
router.post('/:id/approve', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const approverId = req.profile?.id;

    if (!approverId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const approver = req.profile!;
    if (approver.type !== 'parent' && approver.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents or admins can approve goals' });
    }

    // Get goal before approval for notification
    const goal: any = db.prepare('SELECT goal_description, profile_id FROM monthly_goals WHERE id = ?').get(id);
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    if (approver.type === 'parent' && !canParentManageChild(approver.id, goal.profile_id)) {
      return res.status(403).json({ error: 'Access denied: You can only approve goals for your own children' });
    }

    db.prepare(`
      UPDATE monthly_goals
      SET parent_approved = 1, approved_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(approverId, id);

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
router.post('/:id/reject', (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const rejectorId = req.profile?.id;

    if (!rejectorId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const rejector = req.profile!;
    if (rejector.type !== 'parent' && rejector.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents or admins can reject goals' });
    }

    // Get goal before deletion for notification
    const goal: any = db.prepare('SELECT goal_description, profile_id FROM monthly_goals WHERE id = ?').get(id);
    if (!goal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    if (rejector.type === 'parent' && !canParentManageChild(rejector.id, goal.profile_id)) {
      return res.status(403).json({ error: 'Access denied: You can only reject goals for your own children' });
    }

    const result = db.prepare('DELETE FROM monthly_goals WHERE id = ?').run(id);

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

// Get goal templates (for cost estimation and quick goal creation)
router.get('/templates/all', (req: AuthRequest, res: Response) => {
  try {
    const viewer = req.profile!;
    const requestedCategory = typeof req.query.category === 'string'
      ? normalizeGoalCategory(req.query.category)
      : undefined;
    const ownerIds = getVisibleGoalTemplateOwnerIds(viewer);
    const params: any[] = [];
    let query = `
      SELECT *
      FROM goal_templates
      WHERE is_active = 1
    `;

    if (viewer.type !== 'admin') {
      if (ownerIds.length > 0) {
        query += ` AND (is_system = 1 OR is_default = 1 OR created_by IN (${ownerIds.map(() => '?').join(', ')}))`;
        params.push(...ownerIds);
      } else {
        query += ' AND (is_system = 1 OR is_default = 1)';
      }
    }

    if (requestedCategory && requestedCategory !== 'all') {
      query += ' AND category = ?';
      params.push(requestedCategory);
    }

    query += ' ORDER BY category ASC, is_system DESC, is_default DESC, suggested_points ASC, created_at ASC';

    const templates = db.prepare(query).all(...params);
    const categories = Array.from(new Set(
      (templates as any[]).map((template) => normalizeGoalCategory(template.category))
    )).sort();

    res.json({
      templates,
      categories
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single goal template
router.get('/templates/:templateId', (req: AuthRequest, res: Response) => {
  try {
    const { templateId } = req.params;
    const template: any = db.prepare('SELECT * FROM goal_templates WHERE id = ?').get(templateId);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (!canViewGoalTemplate(req.profile!, template)) {
      return denyGoalAccess(res);
    }

    res.json(template);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Calculate cost estimate for a template based on family size
router.post('/templates/:templateId/estimate', (req: AuthRequest, res: Response) => {
  try {
    const { templateId } = req.params;
    const { familySize } = req.body;

    const template: any = db.prepare('SELECT * FROM goal_templates WHERE id = ?').get(templateId);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (!canViewGoalTemplate(req.profile!, template)) {
      return denyGoalAccess(res);
    }

    const size = familySize || 1;
    const multiplier = template.family_size_multiplier || 1;

    // Calculate estimated costs with family size multiplier
    const estimatedCostMin = template.estimated_cost_min * (1 + (size - 1) * multiplier);
    const estimatedCostMax = template.estimated_cost_max * (1 + (size - 1) * multiplier);
    const suggestedPoints = Math.round(template.suggested_points * (1 + (size - 1) * 0.5));

    res.json({
      template,
      familySize: size,
      estimatedCostMin: Math.round(estimatedCostMin * 100) / 100,
      estimatedCostMax: Math.round(estimatedCostMax * 100) / 100,
      suggestedPoints
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create custom goal template (parents/admin only)
router.post('/templates', (req: AuthRequest, res: Response) => {
  try {
    const userProfile = req.profile!;

    if (userProfile.type !== 'parent' && userProfile.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents and admins can create templates' });
    }

    const { name, description, category, icon, suggested_points, estimated_cost_min, estimated_cost_max, family_size_multiplier } = req.body;
    const normalizedName = String(name || '').trim();
    const normalizedCategory = normalizeGoalCategory(category);

    if (!normalizedName || !normalizedCategory || !suggested_points) {
      return res.status(400).json({ error: 'Name, category, and suggested_points are required' });
    }

    const ownerIds = getVisibleGoalTemplateOwnerIds(userProfile);
    const familyFilter = ownerIds.length > 0
      ? `created_by IN (${ownerIds.map(() => '?').join(', ')})`
      : '1 = 0';
    const existing = db.prepare(`
      SELECT id
      FROM goal_templates
      WHERE LOWER(name) = ?
        AND category = ?
        AND is_active = 1
        AND (is_system = 1 OR is_default = 1 OR ${familyFilter})
      LIMIT 1
    `).get(normalizeGoalTemplateName(normalizedName), normalizedCategory, ...ownerIds);

    if (existing) {
      return res.status(400).json({ error: 'A goal template with this name already exists in your family' });
    }

    const result = db.prepare(`
      INSERT INTO goal_templates (
        name,
        description,
        category,
        icon,
        suggested_points,
        estimated_cost_min,
        estimated_cost_max,
        family_size_multiplier,
        is_default,
        is_system,
        is_active,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1, ?)
    `).run(
      normalizedName,
      description || null,
      normalizedCategory,
      icon || '🎯',
      suggested_points,
      estimated_cost_min || 0,
      estimated_cost_max || 0,
      family_size_multiplier || 1,
      userProfile.id
    );

    const newTemplate = db.prepare('SELECT * FROM goal_templates WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newTemplate);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update custom goal template (parents/admin only, can't modify system templates)
router.put('/templates/:templateId', (req: AuthRequest, res: Response) => {
  try {
    const userProfile = req.profile!;
    const { templateId } = req.params;

    if (userProfile.type !== 'parent' && userProfile.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents and admins can update templates' });
    }

    const existing: any = db.prepare('SELECT * FROM goal_templates WHERE id = ?').get(templateId);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (isSystemGoalTemplate(existing)) {
      return res.status(403).json({ error: 'Cannot modify system templates' });
    }

    if (!canManageGoalTemplate(userProfile, existing.created_by)) {
      return res.status(403).json({ error: 'Access denied: You can only update goal templates created in your family' });
    }

    const { name, description, category, icon, suggested_points, estimated_cost_min, estimated_cost_max, family_size_multiplier, is_active } = req.body;

    const updates: string[] = [];
    const values: any[] = [];

    const nextName = name !== undefined ? String(name).trim() : existing.name;
    const nextCategory = category !== undefined ? normalizeGoalCategory(category) : existing.category;

    if (name !== undefined || category !== undefined) {
      const ownerIds = getVisibleGoalTemplateOwnerIds(userProfile);
      const familyFilter = ownerIds.length > 0
        ? `created_by IN (${ownerIds.map(() => '?').join(', ')})`
        : '1 = 0';
      const duplicate = db.prepare(`
        SELECT id
        FROM goal_templates
        WHERE id != ?
          AND LOWER(name) = ?
          AND category = ?
          AND is_active = 1
          AND (is_system = 1 OR is_default = 1 OR ${familyFilter})
        LIMIT 1
      `).get(templateId, normalizeGoalTemplateName(nextName), nextCategory, ...ownerIds);

      if (duplicate) {
        return res.status(400).json({ error: 'A goal template with this name already exists in your family' });
      }
    }

    if (name !== undefined) { updates.push('name = ?'); values.push(nextName); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (category !== undefined) { updates.push('category = ?'); values.push(nextCategory); }
    if (icon !== undefined) { updates.push('icon = ?'); values.push(icon); }
    if (suggested_points !== undefined) { updates.push('suggested_points = ?'); values.push(suggested_points); }
    if (estimated_cost_min !== undefined) { updates.push('estimated_cost_min = ?'); values.push(estimated_cost_min); }
    if (estimated_cost_max !== undefined) { updates.push('estimated_cost_max = ?'); values.push(estimated_cost_max); }
    if (family_size_multiplier !== undefined) { updates.push('family_size_multiplier = ?'); values.push(family_size_multiplier); }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active ? 1 : 0); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(templateId);
    db.prepare(`UPDATE goal_templates SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updatedTemplate = db.prepare('SELECT * FROM goal_templates WHERE id = ?').get(templateId);
    res.json(updatedTemplate);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete custom goal template (parents/admin only, can't delete system templates)
router.delete('/templates/:templateId', (req: AuthRequest, res: Response) => {
  try {
    const userProfile = req.profile!;
    const { templateId } = req.params;

    if (userProfile.type !== 'parent' && userProfile.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents and admins can delete templates' });
    }

    const existing: any = db.prepare('SELECT * FROM goal_templates WHERE id = ?').get(templateId);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    if (isSystemGoalTemplate(existing)) {
      return res.status(403).json({ error: 'Cannot delete system templates' });
    }

    if (!canManageGoalTemplate(userProfile, existing.created_by)) {
      return res.status(403).json({ error: 'Access denied: You can only delete goal templates created in your family' });
    }

    db.prepare('DELETE FROM goal_templates WHERE id = ?').run(templateId);
    res.json({ message: 'Template deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get pending goals (for parents to review)
router.get('/pending/:parentId', (req: AuthRequest, res: Response) => {
  try {
    const viewer = req.profile!;

    if (viewer.type !== 'parent' && viewer.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents or admins can review pending goals' });
    }

    if (viewer.type === 'admin') {
      const pendingGoals = db.prepare(`
        SELECT mg.*, p.name as child_name, p.avatar as child_avatar
        FROM monthly_goals mg
        JOIN profiles p ON mg.profile_id = p.id
        WHERE p.type = 'child' AND mg.parent_approved = 0
        ORDER BY mg.created_at DESC
      `).all();

      return res.json(pendingGoals);
    }

    const childIds = getManagedChildIdsForParent(viewer.id);
    if (childIds.length === 0) {
      return res.json([]);
    }

    const placeholders = childIds.map(() => '?').join(', ');
    const pendingGoals = db.prepare(`
      SELECT mg.*, p.name as child_name, p.avatar as child_avatar
      FROM monthly_goals mg
      JOIN profiles p ON mg.profile_id = p.id
      WHERE p.type = 'child'
        AND mg.parent_approved = 0
        AND mg.profile_id IN (${placeholders})
      ORDER BY mg.created_at DESC
    `).all(...childIds);

    res.json(pendingGoals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
