import express, { Response } from 'express';
import db from '../database/init';
import { authenticate, adminOnly } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

const router = express.Router();

// ==================== ADMIN: FAMILY MANAGEMENT ====================

// Get all families (admin only)
router.get('/', authenticate, adminOnly, (req: AuthRequest, res: Response) => {
  try {
    const families = db.prepare(`
      SELECT
        f.*,
        (SELECT COUNT(*) FROM profiles WHERE family_id = f.id AND type = 'parent') as parent_count,
        (SELECT COUNT(*) FROM profiles WHERE family_id = f.id AND type = 'child') as child_count,
        (SELECT GROUP_CONCAT(name, ', ') FROM profiles WHERE family_id = f.id AND type = 'parent') as parent_names
      FROM families f
      ORDER BY f.name ASC
    `).all();

    res.json(families);
  } catch (error: any) {
    console.error('[Families] Get all error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get single family with all members (admin only)
router.get('/:id', authenticate, adminOnly, (req: AuthRequest, res: Response) => {
  try {
    const familyId = parseInt(req.params.id, 10);

    const family: any = db.prepare(`
      SELECT * FROM families WHERE id = ?
    `).get(familyId);

    if (!family) {
      return res.status(404).json({ error: 'Family not found' });
    }

    // Get all members of this family
    const members = db.prepare(`
      SELECT id, name, type, age, gender, avatar, username, created_at
      FROM profiles
      WHERE family_id = ?
      ORDER BY type DESC, name ASC
    `).all(familyId);

    res.json({ ...family, members });
  } catch (error: any) {
    console.error('[Families] Get single error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Create a new family (admin only)
router.post('/', authenticate, adminOnly, (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    const adminId = req.profile!.id;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Family name is required' });
    }

    const result = db.prepare(`
      INSERT INTO families (name, description, created_by)
      VALUES (?, ?, ?)
    `).run(name.trim(), description || null, adminId);

    const newFamily = db.prepare('SELECT * FROM families WHERE id = ?').get(result.lastInsertRowid);

    console.log(`[Families] Admin ${adminId} created family "${name}" (ID: ${result.lastInsertRowid})`);
    res.status(201).json(newFamily);
  } catch (error: any) {
    console.error('[Families] Create error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Update family (admin only)
router.put('/:id', authenticate, adminOnly, (req: AuthRequest, res: Response) => {
  try {
    const familyId = parseInt(req.params.id, 10);
    const { name, description, status } = req.body;

    const family: any = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);
    if (!family) {
      return res.status(404).json({ error: 'Family not found' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (status !== undefined) {
      if (!['active', 'inactive', 'suspended'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be: active, inactive, or suspended' });
      }
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(familyId);

    db.prepare(`UPDATE families SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updatedFamily = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);
    console.log(`[Families] Admin updated family ${familyId}`);
    res.json(updatedFamily);
  } catch (error: any) {
    console.error('[Families] Update error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Delete family (admin only) - will unassign all members, not delete them
router.delete('/:id', authenticate, adminOnly, (req: AuthRequest, res: Response) => {
  try {
    const familyId = parseInt(req.params.id, 10);

    const family: any = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);
    if (!family) {
      return res.status(404).json({ error: 'Family not found' });
    }

    // Unassign all members from this family (don't delete profiles)
    db.prepare('UPDATE profiles SET family_id = NULL WHERE family_id = ?').run(familyId);

    // Delete the family
    db.prepare('DELETE FROM families WHERE id = ?').run(familyId);

    console.log(`[Families] Admin deleted family ${familyId} ("${family.name}")`);
    res.json({ message: 'Family deleted successfully', unassignedMembers: true });
  } catch (error: any) {
    console.error('[Families] Delete error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== MEMBER MANAGEMENT ====================

// Assign a profile to a family (admin only)
router.post('/:id/members', authenticate, adminOnly, (req: AuthRequest, res: Response) => {
  try {
    const familyId = parseInt(req.params.id, 10);
    const { profileId } = req.body;

    const family: any = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);
    if (!family) {
      return res.status(404).json({ error: 'Family not found' });
    }

    const profile: any = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (profile.type === 'admin') {
      return res.status(400).json({ error: 'Admin profiles cannot be assigned to families' });
    }

    // Update profile's family_id
    db.prepare('UPDATE profiles SET family_id = ? WHERE id = ?').run(familyId, profileId);

    // If this is a child, also update parent_id to the first parent in the family
    if (profile.type === 'child') {
      const firstParent: any = db.prepare(`
        SELECT id FROM profiles WHERE family_id = ? AND type = 'parent' LIMIT 1
      `).get(familyId);

      if (firstParent) {
        db.prepare('UPDATE profiles SET parent_id = ? WHERE id = ?').run(firstParent.id, profileId);

        // Also add guardian_students entry
        db.prepare(`
          INSERT OR IGNORE INTO guardian_students (guardian_id, student_id, relationship)
          VALUES (?, ?, 'parent')
        `).run(firstParent.id, profileId);
      }
    }

    // If this is a parent, link them to all existing children in the family
    if (profile.type === 'parent') {
      const existingChildren: any[] = db.prepare(`
        SELECT id FROM profiles WHERE family_id = ? AND type = 'child'
      `).all(familyId);

      for (const child of existingChildren) {
        db.prepare(`
          INSERT OR IGNORE INTO guardian_students (guardian_id, student_id, relationship)
          VALUES (?, ?, 'parent')
        `).run(profileId, child.id);
      }
    }

    console.log(`[Families] Admin added profile ${profileId} to family ${familyId}`);
    res.json({ message: 'Profile assigned to family successfully' });
  } catch (error: any) {
    console.error('[Families] Add member error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Remove a profile from a family (admin only)
router.delete('/:id/members/:profileId', authenticate, adminOnly, (req: AuthRequest, res: Response) => {
  try {
    const familyId = parseInt(req.params.id, 10);
    const profileId = parseInt(req.params.profileId, 10);

    const profile: any = db.prepare('SELECT * FROM profiles WHERE id = ? AND family_id = ?').get(profileId, familyId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found in this family' });
    }

    // Unassign from family
    db.prepare('UPDATE profiles SET family_id = NULL, parent_id = NULL WHERE id = ?').run(profileId);

    // Remove guardian_students entries
    db.prepare('DELETE FROM guardian_students WHERE guardian_id = ? OR student_id = ?').run(profileId, profileId);

    console.log(`[Families] Admin removed profile ${profileId} from family ${familyId}`);
    res.json({ message: 'Profile removed from family successfully' });
  } catch (error: any) {
    console.error('[Families] Remove member error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get unassigned profiles (not in any family) - admin only
router.get('/unassigned/profiles', authenticate, adminOnly, (req: AuthRequest, res: Response) => {
  try {
    const profiles = db.prepare(`
      SELECT id, name, type, age, gender, avatar, username, created_at
      FROM profiles
      WHERE family_id IS NULL AND type != 'admin'
      ORDER BY type DESC, name ASC
    `).all();

    res.json(profiles);
  } catch (error: any) {
    console.error('[Families] Get unassigned error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== FAMILY FEATURE CONTROL (ADMIN) ====================

// Get family features (admin only)
router.get('/:id/features', authenticate, adminOnly, (req: AuthRequest, res: Response) => {
  try {
    const familyId = parseInt(req.params.id, 10);

    const family: any = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);
    if (!family) {
      return res.status(404).json({ error: 'Family not found' });
    }

    // Get the primary parent of this family
    const primaryParent: any = db.prepare(`
      SELECT id FROM profiles WHERE family_id = ? AND type = 'parent' ORDER BY created_at ASC LIMIT 1
    `).get(familyId);

    if (!primaryParent) {
      return res.json({ features: {}, message: 'No parent in this family yet' });
    }

    // Get family features from family_features table
    const featureRows: any[] = db.prepare(`
      SELECT feature_key, enabled FROM family_features WHERE parent_id = ?
    `).all(primaryParent.id);

    const features: Record<string, boolean> = {};
    for (const row of featureRows) {
      features[row.feature_key] = row.enabled === 1;
    }

    res.json({ features, parentId: primaryParent.id });
  } catch (error: any) {
    console.error('[Families] Get features error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Update family features (admin only)
router.put('/:id/features', authenticate, adminOnly, (req: AuthRequest, res: Response) => {
  try {
    const familyId = parseInt(req.params.id, 10);
    const { features } = req.body;
    const adminId = req.profile!.id;

    const family: any = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);
    if (!family) {
      return res.status(404).json({ error: 'Family not found' });
    }

    // Get the primary parent of this family
    const primaryParent: any = db.prepare(`
      SELECT id FROM profiles WHERE family_id = ? AND type = 'parent' ORDER BY created_at ASC LIMIT 1
    `).get(familyId);

    if (!primaryParent) {
      return res.status(400).json({ error: 'Cannot set features: no parent in this family' });
    }

    // Update features
    const upsertFeature = db.prepare(`
      INSERT INTO family_features (parent_id, feature_key, enabled, updated_by)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(parent_id, feature_key) DO UPDATE SET
        enabled = excluded.enabled,
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `);

    for (const [featureKey, enabled] of Object.entries(features)) {
      upsertFeature.run(primaryParent.id, featureKey, enabled ? 1 : 0, adminId);
    }

    console.log(`[Families] Admin ${adminId} updated features for family ${familyId}`);
    res.json({ message: 'Family features updated successfully' });
  } catch (error: any) {
    console.error('[Families] Update features error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== PARENT: ADD ADULT TO FAMILY ====================

// Parents can add another adult (co-parent) to their own family
router.post('/my-family/add-adult', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const userProfile = req.profile!;

    if (userProfile.type !== 'parent') {
      return res.status(403).json({ error: 'Only parents can add adults to their family' });
    }

    if (!userProfile.family_id) {
      return res.status(400).json({ error: 'You are not assigned to a family. Contact admin.' });
    }

    // Check if admin has disabled parent creation
    const allowParentSetting: any = db.prepare("SELECT value FROM settings WHERE key = 'allow_parent_creation'").get();
    if (allowParentSetting?.value === 'false') {
      return res.status(403).json({ error: 'Parent/co-parent creation has been disabled by the administrator.' });
    }

    // Check max parents per family limit
    const maxParentsSetting: any = db.prepare("SELECT value FROM settings WHERE key = 'max_parents_per_family'").get();
    const maxParents = parseInt(maxParentsSetting?.value || '4', 10);

    const currentParentCount: any = db.prepare(`
      SELECT COUNT(*) as count FROM profiles WHERE family_id = ? AND type = 'parent'
    `).get(userProfile.family_id);

    if (currentParentCount.count >= maxParents) {
      return res.status(400).json({
        error: `Maximum number of parents (${maxParents}) reached for this family. Contact admin to increase the limit.`
      });
    }

    const { name, username, password, gender } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    // Generate username if not provided
    const finalUsername = username?.trim().toLowerCase().replace(/\s+/g, '') ||
                          name.trim().toLowerCase().replace(/\s+/g, '');

    // Check username uniqueness
    const existingUser: any = db.prepare('SELECT id FROM profiles WHERE username = ?').get(finalUsername);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Create the new parent profile in the same family
    const result = db.prepare(`
      INSERT INTO profiles (name, type, gender, username, password, family_id, parent_id)
      VALUES (?, 'parent', ?, ?, ?, ?, NULL)
    `).run(name.trim(), gender || null, finalUsername, hashedPassword, userProfile.family_id);

    const newParentId = result.lastInsertRowid;

    // Link new parent to all existing children in the family
    const existingChildren: any[] = db.prepare(`
      SELECT id FROM profiles WHERE family_id = ? AND type = 'child'
    `).all(userProfile.family_id);

    for (const child of existingChildren) {
      db.prepare(`
        INSERT OR IGNORE INTO guardian_students (guardian_id, student_id, relationship)
        VALUES (?, ?, 'parent')
      `).run(newParentId, child.id);
    }

    const newProfile: any = db.prepare('SELECT id, name, type, username, family_id FROM profiles WHERE id = ?').get(newParentId);

    // Audit log for co-parent creation (security tracking)
    try {
      // Get actor name for audit log
      const actorProfile: any = db.prepare('SELECT name FROM profiles WHERE id = ?').get(userProfile.id);

      db.prepare(`
        INSERT INTO audit_logs (action, entity_type, entity_id, actor_id, actor_type, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'COPARENT_CREATED',
        'profile',
        newParentId,
        userProfile.id,
        'parent',
        JSON.stringify({
          created_parent_name: newProfile.name,
          created_parent_username: newProfile.username,
          family_id: userProfile.family_id,
          created_by_name: actorProfile?.name || 'Unknown',
          linked_children_count: existingChildren.length
        })
      );
      console.log(`[Audit] Co-parent ${newProfile.name} created by parent ${actorProfile?.name}`);
    } catch (auditError: any) {
      console.error('[Audit] Failed to log co-parent creation:', auditError.message);
    }

    console.log(`[Families] Parent ${userProfile.id} added co-parent ${newParentId} to family ${userProfile.family_id}`);
    res.status(201).json(newProfile);
  } catch (error: any) {
    console.error('[Families] Add adult error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get my family info (for parents/children)
router.get('/my-family', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const userProfile = req.profile!;

    if (!userProfile.family_id) {
      return res.json({ family: null, message: 'You are not assigned to a family' });
    }

    const family: any = db.prepare('SELECT * FROM families WHERE id = ?').get(userProfile.family_id);

    const members = db.prepare(`
      SELECT id, name, type, age, gender, avatar, username
      FROM profiles
      WHERE family_id = ?
      ORDER BY type DESC, name ASC
    `).all(userProfile.family_id);

    res.json({ family, members });
  } catch (error: any) {
    console.error('[Families] Get my family error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
