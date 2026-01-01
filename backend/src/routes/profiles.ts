import express, { Response } from 'express';
import db from '../database/init';
import bcrypt from 'bcrypt';
import { authenticate, adminOnly } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

const router = express.Router();
const SALT_ROUNDS = 10;

// Get all profiles - FILTERED BY USER TYPE FOR SECURITY
router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const userProfile = req.profile!;
    console.log(`[DEBUG] GET /api/profiles - User: ${userProfile.type} (ID: ${userProfile.id})`);

    let profiles: any[];

    if (userProfile.type === 'admin') {
      // Admin sees all profiles
      profiles = db.prepare('SELECT * FROM profiles ORDER BY type DESC, created_at ASC').all();
      console.log(`[DEBUG] Admin view: ${profiles.length} total profiles`);
    } else if (userProfile.type === 'parent') {
      // Parent sees only themselves and their children
      profiles = db.prepare(`
        SELECT * FROM profiles
        WHERE id = ? OR parent_id = ?
        ORDER BY type DESC, created_at ASC
      `).all(userProfile.id, userProfile.id);
      console.log(`[DEBUG] Parent view: ${profiles.length} profiles (self + children)`);
    } else if (userProfile.type === 'teacher') {
      // Teacher sees only themselves
      profiles = db.prepare('SELECT * FROM profiles WHERE id = ?').all(userProfile.id);
      console.log(`[DEBUG] Teacher view: self only`);
    } else {
      // Child sees only themselves
      profiles = db.prepare('SELECT * FROM profiles WHERE id = ?').all(userProfile.id);
      console.log(`[DEBUG] Child view: self only`);
    }

    res.json(profiles);
  } catch (error: any) {
    console.error('[ERROR] GET /api/profiles failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get single profile - with authorization check
router.get('/:id', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const userProfile = req.profile!;
    const requestedId = parseInt(req.params.id);

    const profile: any = db.prepare('SELECT * FROM profiles WHERE id = ?').get(requestedId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Authorization: admin can see anyone, parent can see self + kids, others only self
    if (userProfile.type === 'admin') {
      // Admin can see anyone
      return res.json(profile);
    } else if (userProfile.type === 'parent') {
      // Parent can see themselves or their children
      if (profile.id === userProfile.id || profile.parent_id === userProfile.id) {
        return res.json(profile);
      }
    } else {
      // Teacher/Child can only see themselves
      if (profile.id === userProfile.id) {
        return res.json(profile);
      }
    }

    return res.status(403).json({ error: 'Access denied: You can only view your own profile or your children\'s profiles' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create profile - Admin can create anyone, parents can only create children
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userProfile = req.profile!;
    const { name, type, age, gender, avatar, settings, pin, password, username, parent_id } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    // Authorization check
    if (type !== 'child' && userProfile.type !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create parent/teacher/admin profiles' });
    }

    // If parent is creating a child, link to themselves
    let finalParentId = parent_id;
    if (type === 'child') {
      if (userProfile.type === 'parent') {
        finalParentId = userProfile.id; // Link child to the parent creating it
      } else if (userProfile.type === 'admin' && !parent_id) {
        console.warn('Admin creating child profile without parent_id - child will not be linked to a parent');
      }
    }

    // Auto-generate username if not provided (lowercase name without spaces)
    const finalUsername = username || name.toLowerCase().replace(/\s+/g, '');

    // Hash PIN if provided (for kids - security: never store plain text)
    const hashedPin = pin ? await bcrypt.hash(pin, SALT_ROUNDS) : null;

    // Hash password if provided (for adults - security: never store plain text)
    const hashedPassword = password ? await bcrypt.hash(password, SALT_ROUNDS) : null;

    const result = db.prepare(`
      INSERT INTO profiles (name, type, age, gender, avatar, username, pin, password, settings, parent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, type, age, gender, avatar || null, finalUsername, hashedPin, hashedPassword, JSON.stringify(settings || {}), finalParentId || null);

    const newProfile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newProfile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update profile - with authorization check
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userProfile = req.profile!;
    const { name, age, gender, avatar, settings, pin, password, username, ai_enabled, parent_id, type } = req.body;
    const { id } = req.params;

    // Get the profile being updated
    const targetProfile: any = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);
    if (!targetProfile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Authorization: admin can update anyone, parent can update self + kids, others only self
    let canUpdate = false;
    if (userProfile.type === 'admin') {
      canUpdate = true;
    } else if (userProfile.type === 'parent') {
      canUpdate = (targetProfile.id === userProfile.id || targetProfile.parent_id === userProfile.id);
    } else {
      canUpdate = (targetProfile.id === userProfile.id);
    }

    if (!canUpdate) {
      return res.status(403).json({ error: 'Access denied: You can only update your own profile or your children\'s profiles' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (type !== undefined) {
      updates.push('type = ?');
      values.push(type);
    }
    if (age !== undefined) {
      updates.push('age = ?');
      values.push(age);
    }
    if (gender !== undefined) {
      updates.push('gender = ?');
      values.push(gender);
    }
    if (avatar !== undefined) {
      updates.push('avatar = ?');
      values.push(avatar);
    }
    if (username !== undefined) {
      updates.push('username = ?');
      values.push(username);
    }
    if (parent_id !== undefined) {
      updates.push('parent_id = ?');
      values.push(parent_id);
    }
    if (ai_enabled !== undefined) {
      updates.push('ai_enabled = ?');
      values.push(ai_enabled);
    }
    if (settings !== undefined) {
      updates.push('settings = ?');
      values.push(JSON.stringify(settings));
    }
    if (pin !== undefined) {
      // Hash PIN if provided (security: never store plain text PINs)
      const hashedPin = pin ? await bcrypt.hash(pin, SALT_ROUNDS) : null;
      updates.push('pin = ?');
      values.push(hashedPin);
    }
    if (password !== undefined) {
      // Hash password if provided (security: never store plain text passwords)
      const hashedPassword = password ? await bcrypt.hash(password, SALT_ROUNDS) : null;
      updates.push('password = ?');
      values.push(hashedPassword);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`
      UPDATE profiles
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);

    const updatedProfile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);
    res.json(updatedProfile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete profile - Admin only for now
router.delete('/:id', adminOnly, (req: AuthRequest, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM profiles WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ message: 'Profile deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Login - supports both PIN (kids) and password (adults)
router.post('/login', async (req, res) => {
  try {
    const { username, pin } = req.body;

    console.log(`[DEBUG] Login attempt for username: ${username}`);

    if (!username || !pin) {
      return res.status(400).json({ error: 'Username and password/PIN are required' });
    }

    // Find profile by username OR name (backwards compatibility)
    const profile: any = db.prepare(
      'SELECT * FROM profiles WHERE username = ? OR LOWER(name) = LOWER(?)'
    ).get(username, username);

    if (!profile) {
      console.log(`[DEBUG] Profile not found for username: ${username}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log(`[DEBUG] Profile found: ${profile.name} (${profile.type})`);

    // For children: verify PIN
    // For adults (parent/teacher/admin): verify password (if set) or PIN (backwards compat)
    let isValid = false;

    if (profile.type === 'child') {
      // Kids use PIN
      if (!profile.pin) {
        console.log(`[DEBUG] Child profile has no PIN set`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      isValid = await bcrypt.compare(pin, profile.pin);
      console.log(`[DEBUG] PIN verification for child: ${isValid}`);
    } else {
      // Adults use password (preferred) or PIN (backwards compatibility)
      if (profile.password) {
        // Password is set - use it
        isValid = await bcrypt.compare(pin, profile.password);
        console.log(`[DEBUG] Password verification for ${profile.type}: ${isValid}`);
      } else if (profile.pin) {
        // Fallback to PIN for backwards compatibility
        isValid = await bcrypt.compare(pin, profile.pin);
        console.log(`[DEBUG] PIN verification for ${profile.type} (backwards compat): ${isValid}`);
      } else {
        console.log(`[DEBUG] ${profile.type} profile has no password or PIN set`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    if (!isValid) {
      console.log(`[DEBUG] Credential verification failed`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log(`[DEBUG] Login successful for ${profile.name}!`);

    // Return profile info (exclude sensitive data)
    res.json({
      success: true,
      profile: {
        id: profile.id,
        name: profile.name,
        type: profile.type,
        avatar: profile.avatar,
        age: profile.age,
        gender: profile.gender,
        parent_id: profile.parent_id,
        ai_enabled: profile.ai_enabled,
        username: profile.username
      }
    });
  } catch (error: any) {
    console.error('[ERROR] Login failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify profile PIN
router.post('/:id/verify-pin', (req, res) => {
  try {
    const { id } = req.params;
    const { pin } = req.body;

    const profile: any = db.prepare('SELECT pin FROM profiles WHERE id = ?').get(id);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // If no PIN is set, allow access
    if (!profile.pin) {
      return res.json({ verified: true });
    }

    // Check if provided PIN matches
    const verified = profile.pin === pin;
    res.json({ verified });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Set profile PIN
router.post('/:id/set-pin', (req, res) => {
  try {
    const { id } = req.params;
    const { pin, currentPin } = req.body;

    const profile: any = db.prepare('SELECT pin FROM profiles WHERE id = ?').get(id);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // If PIN already exists, verify current PIN first
    if (profile.pin && profile.pin !== currentPin) {
      return res.status(403).json({ error: 'Current PIN is incorrect' });
    }

    // Update PIN
    db.prepare('UPDATE profiles SET pin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(pin || null, id);

    res.json({ message: 'PIN updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reset password/PIN (admin can reset anyone, parents can reset their kids)
router.post('/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword, newPin, adminId, parentId } = req.body;

    // Get the profile being reset
    const profile: any = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Authorization check
    if (adminId) {
      // Verify admin has permission
      const admin: any = db.prepare('SELECT type FROM profiles WHERE id = ?').get(adminId);
      if (!admin || admin.type !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized: Admin access required' });
      }
    } else if (parentId) {
      // Verify parent owns this child
      const parent: any = db.prepare('SELECT type FROM profiles WHERE id = ?').get(parentId);
      if (!parent || (parent.type !== 'parent' && parent.type !== 'admin')) {
        return res.status(403).json({ error: 'Unauthorized: Parent/Admin access required' });
      }
      if (profile.parent_id !== parseInt(parentId)) {
        return res.status(403).json({ error: 'Unauthorized: You can only reset your own children\'s credentials' });
      }
    } else {
      return res.status(403).json({ error: 'Unauthorized: Admin or parent ID required' });
    }

    // Reset password or PIN based on profile type
    if (profile.type === 'child' && newPin) {
      const hashedPin = await bcrypt.hash(newPin, SALT_ROUNDS);
      db.prepare('UPDATE profiles SET pin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(hashedPin, id);
      console.log(`[DEBUG] PIN reset for child ${profile.name} by ${adminId ? 'admin' : 'parent'}`);
      res.json({ message: 'PIN reset successfully' });
    } else if (profile.type !== 'child' && newPassword) {
      const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
      db.prepare('UPDATE profiles SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(hashedPassword, id);
      console.log(`[DEBUG] Password reset for ${profile.type} ${profile.name} by admin`);
      res.json({ message: 'Password reset successfully' });
    } else {
      return res.status(400).json({ error: 'Invalid reset request' });
    }
  } catch (error: any) {
    console.error('[ERROR] Password/PIN reset failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get profile statistics
router.get('/:id/stats', (req, res) => {
  try {
    const { id } = req.params;

    // Get task stats for kids
    const taskStats = db.prepare(`
      SELECT
        COUNT(*) as total_tasks,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN completed = 0 AND due_date < datetime('now') THEN 1 ELSE 0 END) as overdue_tasks
      FROM tasks
      WHERE profile_id = ?
    `).get(id);

    // Get progress stats
    const progressStats = db.prepare(`
      SELECT
        total_points,
        total_stars,
        level
      FROM progress
      WHERE profile_id = ?
      ORDER BY logged_at DESC
      LIMIT 1
    `).get(id);

    // Get diet stats
    const dietStats = db.prepare(`
      SELECT
        COUNT(*) as meals_logged,
        SUM(calories_consumed) as total_calories,
        DATE(logged_at) as log_date
      FROM meal_logs
      WHERE profile_id = ? AND DATE(logged_at) = DATE('now')
      GROUP BY DATE(logged_at)
    `).get(id);

    res.json({
      tasks: taskStats || { total_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
      progress: progressStats || { total_points: 0, total_stars: 0, level: 1 },
      diet: dietStats || { meals_logged: 0, total_calories: 0 }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
