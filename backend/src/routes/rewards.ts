import { Router, Request, Response } from 'express';
import { db } from '../database/init';
import { authenticate } from '../middleware/auth';
import { requireFeature } from '../middleware/feature-access';

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
    const claims = db.prepare(`
      SELECT rc.*, r.title, r.description, r.icon, r.image_url, r.type, r.points_required,
             p.name as child_name, p.avatar as child_avatar
      FROM reward_claims rc
      JOIN rewards r ON rc.reward_id = r.id
      JOIN profiles p ON rc.profile_id = p.id
      WHERE rc.status = 'pending'
      ORDER BY rc.claimed_at DESC
    `).all();

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
    `).get(claimId);

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
      icon,
      imageUrl,
      type,
      category,
      availableForAll,
      stock
    } = req.body;

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
    if (pointsRequired !== undefined) {
      updateFields.push('points_required = ?');
      values.push(pointsRequired);
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
    if (availableForAll !== undefined) {
      updateFields.push('available_for_all = ?');
      values.push(availableForAll ? 1 : 0);
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
router.get('/all', (req: Request, res: Response) => {
  try {
    const rewards = db.prepare(`
      SELECT r.*,
             (SELECT COUNT(*) FROM reward_claims rc WHERE rc.reward_id = r.id) as total_claims,
             (SELECT COUNT(*) FROM reward_claims rc WHERE rc.reward_id = r.id AND rc.status = 'pending') as pending_claims
      FROM rewards r
      ORDER BY r.created_at DESC
    `).all();

    res.json(rewards);
  } catch (error) {
    console.error('Error fetching all rewards:', error);
    res.status(500).json({ error: 'Failed to fetch rewards' });
  }
});

export default router;
