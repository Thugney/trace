import { Router, Request, Response } from 'express';
import { db } from '../database/init';
import { authenticate } from '../middleware/auth';
import { requireFeature } from '../middleware/feature-access';
import { sendPushNotification } from '../services/notifications';

const router = Router();
router.use(authenticate, requireFeature('rewards'));

// Get available rewards for the shop (for a specific child or all available)
router.get('/shop/:profileId', (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    // Get rewards that are either:
    // 1. Available for all children
    // 2. Specifically assigned to this child
    // 3. Not yet claimed or still in stock
    // Also check if this user already has a pending/approved claim
    const rewards = db.prepare(`
      SELECT r.*,
             COALESCE(r.stock, -1) as stock,
             (SELECT COUNT(*) FROM reward_claims rc WHERE rc.reward_id = r.id AND rc.status != 'rejected') as times_claimed,
             (SELECT rc2.status FROM reward_claims rc2 WHERE rc2.reward_id = r.id AND rc2.profile_id = ? AND rc2.status IN ('pending', 'approved') LIMIT 1) as user_claim_status
      FROM rewards r
      WHERE (r.available_for_all = 1 OR r.profile_id = ?)
        AND r.is_claimed = 0
        AND (r.stock = -1 OR r.stock > (SELECT COUNT(*) FROM reward_claims rc WHERE rc.reward_id = r.id AND rc.status != 'rejected'))
      ORDER BY r.points_required ASC
    `).all(profileId, profileId);

    // Get user's current points
    const progress = db.prepare(`
      SELECT COALESCE(SUM(points_earned), 0) as total_points
      FROM progress
      WHERE profile_id = ?
    `).get(profileId) as { total_points: number } | undefined;

    const totalPoints = progress?.total_points || 0;

    // Calculate spent points
    const spentPoints = db.prepare(`
      SELECT COALESCE(SUM(points_spent), 0) as spent
      FROM reward_claims
      WHERE profile_id = ? AND status != 'rejected'
    `).get(profileId) as { spent: number } | undefined;

    const availablePoints = totalPoints - (spentPoints?.spent || 0);

    res.json({
      rewards,
      availablePoints,
      totalPoints
    });
  } catch (error) {
    console.error('Error fetching shop rewards:', error);
    res.status(500).json({ error: 'Failed to fetch rewards' });
  }
});

// Purchase/claim a reward
router.post('/:rewardId/purchase', (req: Request, res: Response) => {
  try {
    const { rewardId } = req.params;
    const { profileId } = req.body;

    if (!profileId) {
      return res.status(400).json({ error: 'Profile ID required' });
    }

    // Get the reward
    const reward = db.prepare('SELECT * FROM rewards WHERE id = ?').get(rewardId) as any;

    if (!reward) {
      return res.status(404).json({ error: 'Reward not found' });
    }

    // Check if reward is available for this profile
    if (!reward.available_for_all && reward.profile_id !== parseInt(profileId)) {
      return res.status(403).json({ error: 'Reward not available for this profile' });
    }

    // Check if user already has a pending/approved claim for this reward
    const existingClaim = db.prepare(`
      SELECT id, status FROM reward_claims
      WHERE reward_id = ? AND profile_id = ? AND status IN ('pending', 'approved')
    `).get(rewardId, profileId) as { id: number; status: string } | undefined;

    if (existingClaim) {
      return res.status(400).json({
        error: existingClaim.status === 'pending'
          ? 'You already have a pending claim for this reward'
          : 'You already claimed this reward',
        code: 'ALREADY_CLAIMED'
      });
    }

    // Check stock
    if (reward.stock !== -1) {
      const claimedCount = db.prepare(`
        SELECT COUNT(*) as count FROM reward_claims
        WHERE reward_id = ? AND status != 'rejected'
      `).get(rewardId) as { count: number };

      if (claimedCount.count >= reward.stock) {
        return res.status(400).json({ error: 'Reward out of stock' });
      }
    }

    // Get user's available points
    const progress = db.prepare(`
      SELECT COALESCE(SUM(points_earned), 0) as total_points
      FROM progress
      WHERE profile_id = ?
    `).get(profileId) as { total_points: number } | undefined;

    const totalPoints = progress?.total_points || 0;

    const spentPoints = db.prepare(`
      SELECT COALESCE(SUM(points_spent), 0) as spent
      FROM reward_claims
      WHERE profile_id = ? AND status != 'rejected'
    `).get(profileId) as { spent: number } | undefined;

    const availablePoints = totalPoints - (spentPoints?.spent || 0);

    if (availablePoints < reward.points_required) {
      return res.status(400).json({
        error: 'Not enough points',
        required: reward.points_required,
        available: availablePoints
      });
    }

    // Create the claim
    const result = db.prepare(`
      INSERT INTO reward_claims (reward_id, profile_id, points_spent, status)
      VALUES (?, ?, ?, 'pending')
    `).run(rewardId, profileId, reward.points_required);

    // Get the created claim
    const claim = db.prepare('SELECT * FROM reward_claims WHERE id = ?').get(result.lastInsertRowid);

    // Notify parent about reward claim
    const child = db.prepare('SELECT name, parent_id FROM profiles WHERE id = ?').get(profileId) as { name: string; parent_id: number } | undefined;
    if (child?.parent_id) {
      sendPushNotification(child.parent_id, {
        type: 'general',
        title: `${child.name} wants a reward! 🎁`,
        message: `${child.name} is requesting "${reward.title}" for ${reward.points_required} points`,
        icon: '🎁',
        url: '/shop'
      }).catch(console.error);
    }

    res.json({
      success: true,
      claim,
      newBalance: availablePoints - reward.points_required
    });
  } catch (error) {
    console.error('Error purchasing reward:', error);
    res.status(500).json({ error: 'Failed to purchase reward' });
  }
});

// Get claimed rewards history for a profile
router.get('/claimed/:profileId', (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    const claims = db.prepare(`
      SELECT rc.*, r.title, r.description, r.icon, r.image_url, r.type
      FROM reward_claims rc
      JOIN rewards r ON rc.reward_id = r.id
      WHERE rc.profile_id = ?
      ORDER BY rc.claimed_at DESC
    `).all(profileId);

    res.json(claims);
  } catch (error) {
    console.error('Error fetching claimed rewards:', error);
    res.status(500).json({ error: 'Failed to fetch claimed rewards' });
  }
});

// Get all pending claims (for parents to review)
router.get('/pending', (req: Request, res: Response) => {
  try {
    const { parentId } = req.query;

    let sql = `
      SELECT rc.*, r.title, r.description, r.icon, r.image_url, r.type, r.points_required,
             p.name as child_name, p.avatar as child_avatar
      FROM reward_claims rc
      JOIN rewards r ON rc.reward_id = r.id
      JOIN profiles p ON rc.profile_id = p.id
      WHERE rc.status = 'pending'
    `;
    const params: any[] = [];

    // If parentId is provided, only show claims from this parent's children
    if (parentId) {
      sql += ` AND p.parent_id = ?`;
      params.push(parentId);
    }

    sql += ` ORDER BY rc.claimed_at DESC`;

    const claims = db.prepare(sql).all(...params);
    res.json(claims);
  } catch (error) {
    console.error('Error fetching pending claims:', error);
    res.status(500).json({ error: 'Failed to fetch pending claims' });
  }
});

// Approve or reject a claim (parent action)
router.put('/claims/:claimId/status', (req: Request, res: Response) => {
  try {
    const { claimId } = req.params;
    const { status, approvedBy, notes } = req.body;

    if (!['approved', 'given', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updateFields: string[] = ['status = ?'];
    const values: any[] = [status];

    if (status === 'approved' || status === 'given') {
      updateFields.push('approved_at = CURRENT_TIMESTAMP');
      updateFields.push('approved_by = ?');
      values.push(approvedBy);
    }

    if (notes) {
      updateFields.push('notes = ?');
      values.push(notes);
    }

    values.push(claimId);

    db.prepare(`
      UPDATE reward_claims
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `).run(...values);

    // If rejected, the points are effectively refunded (not spent)
    // No action needed since we calculate available points dynamically

    const claim = db.prepare(`
      SELECT rc.*, r.title, p.name as child_name
      FROM reward_claims rc
      JOIN rewards r ON rc.reward_id = r.id
      JOIN profiles p ON rc.profile_id = p.id
      WHERE rc.id = ?
    `).get(claimId) as any;

    // Notify child about approval/rejection
    if (claim) {
      if (status === 'approved' || status === 'given') {
        sendPushNotification(claim.profile_id, {
          type: 'general',
          title: `Reward approved! 🎉`,
          message: `Your reward "${claim.title}" has been approved! ${status === 'given' ? 'Enjoy!' : 'Ask your parent to give it to you.'}`,
          icon: '🎁',
          url: '/shop'
        }).catch(console.error);
      } else if (status === 'rejected') {
        sendPushNotification(claim.profile_id, {
          type: 'general',
          title: `Reward request declined 😢`,
          message: `Your request for "${claim.title}" was not approved${notes ? `: ${notes}` : '. Try another reward!'}`,
          icon: '❌',
          url: '/shop'
        }).catch(console.error);
      }
    }

    res.json(claim);
  } catch (error) {
    console.error('Error updating claim status:', error);
    res.status(500).json({ error: 'Failed to update claim status' });
  }
});

// Create a new reward (parent/admin)
router.post('/', (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      pointsRequired,
      icon,
      imageUrl,
      type = 'real',
      category = 'general',
      profileId, // null for all, or specific child id
      availableForAll = true,
      stock = -1,
      createdBy
    } = req.body;

    if (!title || !pointsRequired) {
      return res.status(400).json({ error: 'Title and points required' });
    }

    if (!createdBy) {
      return res.status(400).json({ error: 'Creator ID required' });
    }

    // Use createdBy as profile_id if not specified (for legacy schema compatibility)
    // profile_id indicates which child can claim it, or if available_for_all, use createdBy
    const effectiveProfileId = profileId || createdBy;

    const result = db.prepare(`
      INSERT INTO rewards (
        title, description, points_required, icon, image_url, type,
        category, profile_id, available_for_all, stock, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title, description || null, pointsRequired, icon || null, imageUrl || null, type,
      category, effectiveProfileId, availableForAll ? 1 : 0, stock, createdBy
    );

    const reward = db.prepare('SELECT * FROM rewards WHERE id = ?').get(result.lastInsertRowid);

    res.json(reward);
  } catch (error: any) {
    console.error('Error creating reward:', error.message, error.stack);
    res.status(500).json({ error: 'Failed to create reward', details: error.message });
  }
});

// Update a reward
router.put('/:rewardId', (req: Request, res: Response) => {
  try {
    const { rewardId } = req.params;
    const {
      title,
      description,
      pointsRequired,
      points_required, // Handle both camelCase and snake_case
      icon,
      imageUrl,
      type,
      category,
      availableForAll,
      available_for_all, // Handle both cases
      profileId,
      profile_id, // Handle both cases
      stock
    } = req.body;

    // Normalize to handle both naming conventions
    const normalizedPointsRequired = pointsRequired ?? points_required;
    const normalizedAvailableForAll = availableForAll ?? available_for_all;
    const normalizedProfileId = profileId ?? profile_id;

    const updateFields: string[] = [];
    const values: any[] = [];

    if (title !== undefined) {
      updateFields.push('title = ?');
      values.push(title);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      values.push(description);
    }
    if (normalizedPointsRequired !== undefined) {
      updateFields.push('points_required = ?');
      values.push(normalizedPointsRequired);
    }
    if (icon !== undefined) {
      updateFields.push('icon = ?');
      values.push(icon);
    }
    if (imageUrl !== undefined) {
      updateFields.push('image_url = ?');
      values.push(imageUrl);
    }
    if (type !== undefined) {
      updateFields.push('type = ?');
      values.push(type);
    }
    if (category !== undefined) {
      updateFields.push('category = ?');
      values.push(category);
    }
    if (normalizedAvailableForAll !== undefined) {
      updateFields.push('available_for_all = ?');
      values.push(normalizedAvailableForAll ? 1 : 0);
    }
    if (normalizedProfileId !== undefined) {
      updateFields.push('profile_id = ?');
      values.push(normalizedProfileId);
    }
    if (stock !== undefined) {
      updateFields.push('stock = ?');
      values.push(stock);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(rewardId);

    db.prepare(`
      UPDATE rewards
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `).run(...values);

    const reward = db.prepare('SELECT * FROM rewards WHERE id = ?').get(rewardId);

    res.json(reward);
  } catch (error) {
    console.error('Error updating reward:', error);
    res.status(500).json({ error: 'Failed to update reward' });
  }
});

// Delete a reward
router.delete('/:rewardId', (req: Request, res: Response) => {
  try {
    const { rewardId } = req.params;

    // Check if reward has any pending claims
    const pendingClaims = db.prepare(`
      SELECT COUNT(*) as count FROM reward_claims
      WHERE reward_id = ? AND status = 'pending'
    `).get(rewardId) as { count: number };

    if (pendingClaims.count > 0) {
      return res.status(400).json({
        error: 'Cannot delete reward with pending claims',
        pendingCount: pendingClaims.count
      });
    }

    db.prepare('DELETE FROM rewards WHERE id = ?').run(rewardId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting reward:', error);
    res.status(500).json({ error: 'Failed to delete reward' });
  }
});

// Get all rewards (for admin/parent management)
// If parentId query param is provided, filter to only rewards created by this parent
router.get('/all', (req: Request, res: Response) => {
  try {
    const { parentId } = req.query;

    let sql = `
      SELECT r.*,
             (SELECT COUNT(*) FROM reward_claims rc WHERE rc.reward_id = r.id) as total_claims,
             (SELECT COUNT(*) FROM reward_claims rc WHERE rc.reward_id = r.id AND rc.status = 'pending') as pending_claims,
             (SELECT name FROM profiles WHERE id = r.profile_id) as target_child_name
      FROM rewards r
    `;
    const params: any[] = [];

    if (parentId) {
      sql += ` WHERE r.created_by = ?`;
      params.push(parentId);
    }

    sql += ` ORDER BY r.created_at DESC`;

    const rewards = db.prepare(sql).all(...params);
    res.json(rewards);
  } catch (error) {
    console.error('Error fetching all rewards:', error);
    res.status(500).json({ error: 'Failed to fetch rewards' });
  }
});

// Get children for a parent (for reward targeting dropdown)
router.get('/parent/:parentId/children', (req: Request, res: Response) => {
  try {
    const { parentId } = req.params;

    const children = db.prepare(`
      SELECT id, name, avatar, age
      FROM profiles
      WHERE parent_id = ? AND type = 'child'
      ORDER BY name
    `).all(parentId);

    res.json(children);
  } catch (error: any) {
    console.error('Error fetching parent children:', error.message);
    res.status(500).json({ error: 'Failed to fetch children' });
  }
});

// ==================== REWARD CATEGORIES ====================

// Get all reward categories (default + custom for this parent)
router.get('/categories/:parentId', (req: Request, res: Response) => {
  try {
    const { parentId } = req.params;

    const categories = db.prepare(`
      SELECT * FROM reward_categories
      WHERE is_default = 1 OR created_by = ?
      ORDER BY is_default DESC, display_name ASC
    `).all(parentId);

    res.json(categories);
  } catch (error: any) {
    console.error('Error fetching reward categories:', error.message);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create a custom reward category
router.post('/categories', (req: Request, res: Response) => {
  try {
    const { name, displayName, icon, description, color, createdBy } = req.body;

    if (!name || !displayName || !createdBy) {
      return res.status(400).json({ error: 'Name, display name, and createdBy are required' });
    }

    // Sanitize name for database key
    const safeName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    // Check if category already exists for this user
    const existing = db.prepare(`
      SELECT id FROM reward_categories WHERE name = ? AND created_by = ?
    `).get(safeName, createdBy);

    if (existing) {
      return res.status(400).json({ error: 'Category with this name already exists' });
    }

    const result = db.prepare(`
      INSERT INTO reward_categories (name, display_name, icon, description, color, created_by, is_default)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(safeName, displayName, icon || '🎁', description || '', color || '#9333ea', createdBy);

    const category = db.prepare('SELECT * FROM reward_categories WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(category);
  } catch (error: any) {
    console.error('Error creating reward category:', error.message);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// Update a custom reward category
router.put('/categories/:categoryId', (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;
    const { displayName, icon, description, color } = req.body;

    // Only allow updating non-default categories
    const category: any = db.prepare('SELECT * FROM reward_categories WHERE id = ?').get(categoryId);

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (category.is_default) {
      return res.status(403).json({ error: 'Cannot modify default categories' });
    }

    const updateFields: string[] = [];
    const values: any[] = [];

    if (displayName !== undefined) {
      updateFields.push('display_name = ?');
      values.push(displayName);
    }
    if (icon !== undefined) {
      updateFields.push('icon = ?');
      values.push(icon);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      values.push(description);
    }
    if (color !== undefined) {
      updateFields.push('color = ?');
      values.push(color);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(categoryId);
    db.prepare(`UPDATE reward_categories SET ${updateFields.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM reward_categories WHERE id = ?').get(categoryId);
    res.json(updated);
  } catch (error: any) {
    console.error('Error updating reward category:', error.message);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// Delete a custom reward category
router.delete('/categories/:categoryId', (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;

    const category: any = db.prepare('SELECT * FROM reward_categories WHERE id = ?').get(categoryId);

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (category.is_default) {
      return res.status(403).json({ error: 'Cannot delete default categories' });
    }

    // Update rewards using this category to 'general'
    db.prepare('UPDATE rewards SET category = ? WHERE category = ?').run('general', category.name);

    // Delete the category
    db.prepare('DELETE FROM reward_categories WHERE id = ?').run(categoryId);

    res.json({ message: 'Category deleted', affectedRewards: 0 });
  } catch (error: any) {
    console.error('Error deleting reward category:', error.message);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
