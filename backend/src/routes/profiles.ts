import express, { Response, NextFunction } from 'express';
import db from '../database/init';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, adminOnly } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { FEATURE_KEYS } from '../services/feature-keys';

const router = express.Router();
const SALT_ROUNDS = 10;

const getChildProgressSnapshot = (childId: number) => {
  const taskStats = db.prepare(`
    SELECT
      COUNT(*) as total_tasks,
      SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_tasks,
      SUM(CASE WHEN completed = 0 AND due_date IS NOT NULL AND due_date < datetime('now') THEN 1 ELSE 0 END) as overdue_tasks
    FROM tasks
    WHERE profile_id = ?
  `).get(childId) as any;

  const progressStats = db.prepare(`
    SELECT total_points, total_stars, level
    FROM progress
    WHERE profile_id = ?
    ORDER BY logged_at DESC
    LIMIT 1
  `).get(childId) as any;

  const streakStats = db.prepare(`
    SELECT current_streak
    FROM streaks
    WHERE profile_id = ? AND streak_type = 'tasks'
    ORDER BY updated_at DESC
    LIMIT 1
  `).get(childId) as any;

  const totalTasks = taskStats?.total_tasks || 0;
  const completedTasks = taskStats?.completed_tasks || 0;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    tasks: {
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      overdue_tasks: taskStats?.overdue_tasks || 0
    },
    progress: progressStats || { total_points: 0, total_stars: 0, level: 1 },
    completionRate,
    currentStreak: streakStats?.current_streak || 0
  };
};

// Configure multer for avatar uploads
const AVATAR_DIR = process.env.AVATAR_DIR || path.join(__dirname, '../../data/avatars');

// Ensure avatar directory exists
try {
  if (!fs.existsSync(AVATAR_DIR)) {
    fs.mkdirSync(AVATAR_DIR, { recursive: true });
    console.log(`[Avatar] Created avatar directory: ${AVATAR_DIR}`);
  } else {
    console.log(`[Avatar] Avatar directory exists: ${AVATAR_DIR}`);
  }
  // Test write permissions
  const testFile = path.join(AVATAR_DIR, '.write-test');
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);
  console.log(`[Avatar] Directory is writable`);
} catch (err: any) {
  console.error(`[Avatar] ERROR: Cannot create/write to avatar directory: ${AVATAR_DIR}`, err.message);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, AVATAR_DIR);
  },
  filename: (req, file, cb) => {
    const profileId = req.params.id;
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `avatar-${profileId}-${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  }
});

// PUBLIC: Get profiles for selector (limited info - no sensitive data)
router.get('/selector', (req, res) => {
  try {
    const profiles = db.prepare(`
      SELECT id, name, type, avatar, age
      FROM profiles
      ORDER BY type DESC, name ASC
    `).all();

    res.json(profiles);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Authenticated: Get family progress for logged-in parent
router.get('/family/progress', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const userProfile = req.profile!;
    if (userProfile.type !== 'parent' && userProfile.type !== 'admin') {
      return res.status(403).json({ error: 'Access denied: Parent access required' });
    }

    const children = db.prepare(`
      SELECT id, name, avatar, age
      FROM profiles
      WHERE parent_id = ? AND type = 'child'
      ORDER BY name ASC
    `).all(userProfile.id) as any[];

    const childrenWithProgress = children.map(child => ({
      ...child,
      ...getChildProgressSnapshot(child.id)
    }));

    const summary = childrenWithProgress.reduce(
      (acc, child) => ({
        total_tasks: acc.total_tasks + child.tasks.total_tasks,
        completed_tasks: acc.completed_tasks + child.tasks.completed_tasks,
        total_points: acc.total_points + (child.progress.total_points || 0),
        total_stars: acc.total_stars + (child.progress.total_stars || 0)
      }),
      { total_tasks: 0, completed_tasks: 0, total_points: 0, total_stars: 0 }
    );

    res.json({ children: childrenWithProgress, summary });
  } catch (error: any) {
    console.error('[ERROR] Get family progress failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Public: Get family progress by parent ID
router.get('/:parentId/progress', (req, res) => {
  try {
    const parentId = parseInt(req.params.parentId);
    const parent = db.prepare('SELECT id, type FROM profiles WHERE id = ?').get(parentId) as any;

    if (!parent || parent.type !== 'parent') {
      return res.status(404).json({ error: 'Parent not found' });
    }

    const children = db.prepare(`
      SELECT id, name, avatar, age
      FROM profiles
      WHERE parent_id = ? AND type = 'child'
      ORDER BY name ASC
    `).all(parentId) as any[];

    const childrenWithProgress = children.map(child => ({
      ...child,
      ...getChildProgressSnapshot(child.id)
    }));

    const summary = childrenWithProgress.reduce(
      (acc, child) => ({
        total_tasks: acc.total_tasks + child.tasks.total_tasks,
        completed_tasks: acc.completed_tasks + child.tasks.completed_tasks,
        total_points: acc.total_points + (child.progress.total_points || 0),
        total_stars: acc.total_stars + (child.progress.total_stars || 0)
      }),
      { total_tasks: 0, completed_tasks: 0, total_points: 0, total_stars: 0 }
    );

    res.json({ children: childrenWithProgress, summary });
  } catch (error: any) {
    console.error('[ERROR] Get family progress failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

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
      // Parent sees only themselves and their linked children (guardian_students + legacy parent_id)
      profiles = db.prepare(`
        SELECT * FROM profiles
        WHERE id = ?
           OR parent_id = ?
           OR id IN (SELECT student_id FROM guardian_students WHERE guardian_id = ?)
        ORDER BY type DESC, created_at ASC
      `).all(userProfile.id, userProfile.id, userProfile.id);
      console.log(`[DEBUG] Parent view: ${profiles.length} profiles (self + children)`);
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
      // Parent can see themselves or their children (guardian_students + legacy parent_id)
      if (profile.id === userProfile.id || profile.parent_id === userProfile.id) {
        return res.json(profile);
      }

      const guardianLink = db.prepare('SELECT 1 FROM guardian_students WHERE guardian_id = ? AND student_id = ?').get(userProfile.id, profile.id);
      if (guardianLink) {
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
    const { name, type, age, gender, avatar, settings, pin, password, username, parent_id, assigned_class_id } = req.body;

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

    // For teachers, validate assigned_class_id
    let finalAssignedClassId = null;
    if (type === 'teacher' && assigned_class_id) {
      finalAssignedClassId = assigned_class_id;
    }

    const result = db.prepare(`
      INSERT INTO profiles (name, type, age, gender, avatar, username, pin, password, settings, parent_id, assigned_class_id, ai_enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(name, type, age, gender, avatar || null, finalUsername, hashedPin, hashedPassword, JSON.stringify(settings || {}), finalParentId || null, finalAssignedClassId);

    const newProfile: any = db.prepare('SELECT * FROM profiles WHERE id = ?').get(result.lastInsertRowid);

    try {
      // Enable all features for all profile types (parents, children, teachers, admins)
      // This ensures AI and other features work out of the box
      const insertFeature = db.prepare(`
        INSERT INTO profile_features (profile_id, feature_key, enabled)
        VALUES (?, ?, ?)
      `);
      FEATURE_KEYS.forEach(featureKey => {
        insertFeature.run(newProfile.id, featureKey, 1);
      });
    } catch (featureError: any) {
      console.error('[Profile] Feature initialization failed:', featureError.message);
    }

    if (type === 'child' && finalParentId) {
      db.prepare(`
        INSERT OR IGNORE INTO guardian_students (guardian_id, student_id, relationship)
        VALUES (?, ?, 'parent')
      `).run(finalParentId, newProfile.id);
    }

    if (type === 'teacher' && finalAssignedClassId) {
      db.prepare(`
        INSERT OR IGNORE INTO teacher_class_assignments (teacher_id, class_id)
        VALUES (?, ?)
      `).run(newProfile.id, finalAssignedClassId);
    }
    res.status(201).json(newProfile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get my effective feature access (any authenticated user)
router.get('/me/features', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile!;

    // Admin has all features
    if (profile.type === 'admin') {
      const allFeatures: Record<string, boolean> = {};
      FEATURE_KEYS.forEach(key => { allFeatures[key] = true; });
      return res.json({ features: allFeatures, role: 'admin' });
    }

    // Get family-level features (from parent)
    let parentId = profile.type === 'parent' ? profile.id : profile.parent_id;
    const familyFeatures: Record<string, boolean> = {};
    FEATURE_KEYS.forEach(key => { familyFeatures[key] = true; }); // Default all enabled

    if (parentId) {
      const familyRows: any[] = db.prepare(`
        SELECT feature_key, enabled FROM family_features WHERE parent_id = ?
      `).all(parentId);
      familyRows.forEach(row => {
        familyFeatures[row.feature_key] = row.enabled === 1;
      });
    }

    // Get profile-level features
    const profileRows: any[] = db.prepare(`
      SELECT feature_key, enabled FROM profile_features WHERE profile_id = ?
    `).all(profile.id);

    // Merge: profile features override family, but disabled family features can't be enabled at profile level
    const effectiveFeatures: Record<string, boolean> = {};
    FEATURE_KEYS.forEach(key => {
      const familyEnabled = familyFeatures[key];
      const profileRow = profileRows.find(r => r.feature_key === key);
      const profileEnabled = profileRow ? profileRow.enabled === 1 : true;
      // Feature is only enabled if both family AND profile allow it
      effectiveFeatures[key] = familyEnabled && profileEnabled;
    });

    res.json({ features: effectiveFeatures, role: profile.type });
  } catch (error: any) {
    console.error('[Profiles] Get my features error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get profile feature access (admin only)
router.get('/:id/features', adminOnly, (req: AuthRequest, res: Response) => {
  try {
    const profileId = parseInt(req.params.id, 10);
    const profile: any = db.prepare('SELECT id FROM profiles WHERE id = ?').get(profileId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const features = db.prepare(`
      SELECT feature_key, enabled, updated_at
      FROM profile_features
      WHERE profile_id = ?
      ORDER BY feature_key
    `).all(profileId);

    res.json(features);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update profile feature access (admin only)
router.put('/:id/features', adminOnly, (req: AuthRequest, res: Response) => {
  try {
    const profileId = parseInt(req.params.id, 10);
    const profile: any = db.prepare('SELECT id FROM profiles WHERE id = ?').get(profileId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const { features } = req.body;
    if (!features) {
      return res.status(400).json({ error: 'features is required' });
    }

    const upsert = db.prepare(`
      INSERT INTO profile_features (profile_id, feature_key, enabled, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(profile_id, feature_key) DO UPDATE SET
        enabled = excluded.enabled,
        updated_at = CURRENT_TIMESTAMP
    `);

    const normalized = Array.isArray(features)
      ? features
      : Object.entries(features).map(([feature_key, enabled]) => ({ feature_key, enabled }));

    normalized.forEach((item: any) => {
      if (!FEATURE_KEYS.includes(item.feature_key)) {
        return;
      }
      const enabledValue = item.enabled === true || item.enabled === 1 ? 1 : 0;
      upsert.run(profileId, item.feature_key, enabledValue);
    });

    const updated = db.prepare(`
      SELECT feature_key, enabled, updated_at
      FROM profile_features
      WHERE profile_id = ?
      ORDER BY feature_key
    `).all(profileId);

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update profile - with authorization check
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userProfile = req.profile!;
    const { name, age, gender, avatar, settings, pin, password, username, ai_enabled, parent_id, type, assigned_class_id } = req.body;
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
    if ((req.body as any).diet_enabled !== undefined) {
      updates.push('diet_enabled = ?');
      values.push((req.body as any).diet_enabled);
    }
    if (assigned_class_id !== undefined) {
      updates.push('assigned_class_id = ?');
      values.push(assigned_class_id);
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

    const updatedProfile: any = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);

    if (updatedProfile?.type === 'child' && parent_id) {
      db.prepare(`
        INSERT OR IGNORE INTO guardian_students (guardian_id, student_id, relationship)
        VALUES (?, ?, 'parent')
      `).run(parent_id, updatedProfile.id);
    }

    if (assigned_class_id && updatedProfile?.type === 'teacher') {
      db.prepare(`
        INSERT OR IGNORE INTO teacher_class_assignments (teacher_id, class_id)
        VALUES (?, ?)
      `).run(updatedProfile.id, assigned_class_id);
    }

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
        diet_enabled: profile.diet_enabled,
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

// Get profile history (My Journey)
router.get('/:id/history', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const userProfile = req.profile!;
    const { id } = req.params;
    const requestedId = parseInt(id);
    const { period } = req.query; // week, month, year, all

    // Authorization: children can only see their own history
    // Parents can see their own + their children's history
    // Admins can see anyone's history
    if (userProfile.type === 'child') {
      // Children can ONLY see their own journey
      if (userProfile.id !== requestedId) {
        return res.status(403).json({ error: 'Access denied: You can only view your own journey' });
      }
    } else if (userProfile.type === 'parent') {
      // Parents can see their own or their children's journey
      if (userProfile.id !== requestedId) {
        const targetProfile: any = db.prepare('SELECT parent_id FROM profiles WHERE id = ?').get(requestedId);
        if (!targetProfile || targetProfile.parent_id !== userProfile.id) {
          return res.status(403).json({ error: 'Access denied: You can only view your own or your children\'s journey' });
        }
      }
    }
    // Admins can view anyone's history (no restriction)

    // Calculate date range based on period
    let startDate: string;
    let endDate: string = new Date().toISOString();

    const now = new Date();
    switch (period) {
      case 'week':
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        startDate = weekAgo.toISOString();
        break;
      case 'month':
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        startDate = monthAgo.toISOString();
        break;
      case 'year':
        const yearAgo = new Date(now);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        startDate = yearAgo.toISOString();
        break;
      case 'all':
      default:
        startDate = '2000-01-01T00:00:00.000Z'; // Far past date
        break;
    }

    // Get completed tasks in period
    const completedTasks: any[] = db.prepare(`
      SELECT id, title, category, points, completed_at as date
      FROM tasks
      WHERE profile_id = ? AND completed = 1
        AND completed_at >= ? AND completed_at <= ?
      ORDER BY completed_at DESC
    `).all(id, startDate, endDate);

    // Get progress/points earned in period
    const progressEntries: any[] = db.prepare(`
      SELECT id, points_earned, stars_earned, logged_at as date
      FROM progress
      WHERE profile_id = ?
        AND logged_at >= ? AND logged_at <= ?
      ORDER BY logged_at DESC
    `).all(id, startDate, endDate);

    // Get achieved goals in period
    const achievedGoals: any[] = db.prepare(`
      SELECT id, goal_description as title, goal_points as points, month, updated_at as date
      FROM monthly_goals
      WHERE profile_id = ? AND achieved = 1
        AND updated_at >= ? AND updated_at <= ?
      ORDER BY updated_at DESC
    `).all(id, startDate, endDate);

    // Get meals logged in period
    const mealsLogged: any[] = db.prepare(`
      SELECT id, meal_type, food_items, calories_consumed, logged_at as date
      FROM meal_logs
      WHERE profile_id = ?
        AND logged_at >= ? AND logged_at <= ?
      ORDER BY logged_at DESC
    `).all(id, startDate, endDate);

    // Calculate summary stats
    const totalPoints = progressEntries.reduce((sum, p) => sum + (p.points_earned || 0), 0);
    const totalStars = progressEntries.reduce((sum, p) => sum + (p.stars_earned || 0), 0);
    const tasksCompleted = completedTasks.length;
    const goalsAchieved = achievedGoals.length;
    const mealsCount = mealsLogged.length;

    // Build timeline (combine all events, sort by date)
    const timeline: any[] = [];

    completedTasks.forEach(task => {
      timeline.push({
        type: 'task_completed',
        title: task.title,
        points: task.points,
        category: task.category,
        date: task.date
      });
    });

    achievedGoals.forEach(goal => {
      timeline.push({
        type: 'goal_achieved',
        title: goal.title,
        points: goal.points,
        date: goal.date
      });
    });

    // Sort timeline by date (newest first)
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({
      summary: {
        total_points: totalPoints,
        total_stars: totalStars,
        tasks_completed: tasksCompleted,
        goals_achieved: goalsAchieved,
        meals_logged: mealsCount
      },
      timeline: timeline.slice(0, 50), // Limit to 50 most recent events
      period: {
        start: startDate.split('T')[0],
        end: endDate.split('T')[0],
        type: period || 'all'
      }
    });
  } catch (error: any) {
    console.error('[ERROR] Get history failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload avatar with multer error handling
router.post('/:id/avatar', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
  upload.single('avatar')(req, res, (err: any) => {
    if (err) {
      console.error('[Avatar] Multer error:', err.message);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
      }
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }
    next();
  });
}, async (req: AuthRequest, res: Response) => {
  try {
    console.log(`[Avatar] Upload request received for profile ${req.params.id}`);
    console.log(`[Avatar] File received:`, req.file ? { filename: req.file.filename, size: req.file.size } : 'No file');

    const userProfile = req.profile!;
    const { id } = req.params;
    const targetId = parseInt(id);

    // Authorization: admin can update anyone, parent can update self + kids, others only self
    const targetProfile: any = db.prepare('SELECT * FROM profiles WHERE id = ?').get(targetId);
    if (!targetProfile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    let canUpdate = false;
    if (userProfile.type === 'admin') {
      canUpdate = true;
    } else if (userProfile.type === 'parent') {
      canUpdate = (targetProfile.id === userProfile.id || targetProfile.parent_id === userProfile.id);
    } else {
      canUpdate = (targetProfile.id === userProfile.id);
    }

    if (!canUpdate) {
      return res.status(403).json({ error: 'Access denied: You can only update your own avatar or your children\'s avatars' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Delete old avatar file if it exists
    if (targetProfile.avatar && targetProfile.avatar.startsWith('/api/profiles/')) {
      const oldFilename = targetProfile.avatar.split('/').pop();
      const oldFilePath = path.join(AVATAR_DIR, oldFilename || '');
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Update profile with new avatar URL
    const avatarUrl = `/api/profiles/${targetId}/avatar/${req.file.filename}`;
    db.prepare('UPDATE profiles SET avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(avatarUrl, targetId);

    console.log(`[Avatar] Uploaded avatar for profile ${targetId}: ${req.file.filename}`);

    res.json({
      success: true,
      avatar: avatarUrl,
      message: 'Avatar uploaded successfully'
    });
  } catch (error: any) {
    console.error('[ERROR] Avatar upload failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve avatar images
router.get('/:id/avatar/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(AVATAR_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Avatar not found' });
    }

    // Set cache headers
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
    res.sendFile(filePath);
  } catch (error: any) {
    console.error('[ERROR] Serve avatar failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ADMIN FAMILY FEATURE CONTROLS ====================

// Get all families with their feature access (admin only)
router.get('/admin/families', authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    // Get all parents (family heads)
    const parents: any[] = db.prepare(`
      SELECT id, name, avatar, created_at
      FROM profiles
      WHERE type = 'parent'
      ORDER BY name
    `).all();

    // For each parent, get their children and family features
    const families = parents.map(parent => {
      const children: any[] = db.prepare(`
        SELECT id, name, avatar, age
        FROM profiles
        WHERE parent_id = ? AND type = 'child'
      `).all(parent.id);

      const features: any[] = db.prepare(`
        SELECT feature_key, enabled, updated_at
        FROM family_features
        WHERE parent_id = ?
      `).all(parent.id);

      // Build features map (default to enabled if not set)
      const featuresMap: Record<string, boolean> = {};
      FEATURE_KEYS.forEach(key => {
        const feature = features.find(f => f.feature_key === key);
        featuresMap[key] = feature ? feature.enabled === 1 : true;
      });

      return {
        parent,
        children,
        features: featuresMap,
        childCount: children.length
      };
    });

    res.json({ families, featureKeys: FEATURE_KEYS });
  } catch (error: any) {
    console.error('[Admin] Get families error:', error.message);
    res.status(500).json({ error: 'Failed to get families' });
  }
});

// Update family feature access (admin only)
router.put('/admin/families/:parentId/features', authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { parentId } = req.params;
    const { features } = req.body; // { featureKey: boolean, ... }

    if (!features || typeof features !== 'object') {
      return res.status(400).json({ error: 'Features object required' });
    }

    // Verify parent exists
    const parent: any = db.prepare('SELECT id, name, type FROM profiles WHERE id = ? AND type = ?').get(parentId, 'parent');
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    // Update each feature
    const upsertFeature = db.prepare(`
      INSERT INTO family_features (parent_id, feature_key, enabled, updated_by, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(parent_id, feature_key) DO UPDATE SET
        enabled = excluded.enabled,
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `);

    let updatedCount = 0;
    for (const [featureKey, enabled] of Object.entries(features)) {
      if (FEATURE_KEYS.includes(featureKey as any)) {
        upsertFeature.run(parentId, featureKey, enabled ? 1 : 0, req.profile?.id);
        updatedCount++;
      }
    }

    console.log(`[Admin] Updated ${updatedCount} family features for parent ${parent.name} (ID: ${parentId})`);

    res.json({
      success: true,
      message: `Updated ${updatedCount} features for ${parent.name}'s family`,
      parentId: parseInt(parentId),
      features
    });
  } catch (error: any) {
    console.error('[Admin] Update family features error:', error.message);
    res.status(500).json({ error: 'Failed to update family features' });
  }
});

// Get single family's features (admin only)
router.get('/admin/families/:parentId/features', authenticate, adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { parentId } = req.params;

    const parent: any = db.prepare('SELECT id, name FROM profiles WHERE id = ? AND type = ?').get(parentId, 'parent');
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    const features: any[] = db.prepare(`
      SELECT feature_key, enabled, updated_at
      FROM family_features
      WHERE parent_id = ?
    `).all(parentId);

    const featuresMap: Record<string, boolean> = {};
    FEATURE_KEYS.forEach(key => {
      const feature = features.find(f => f.feature_key === key);
      featuresMap[key] = feature ? feature.enabled === 1 : true;
    });

    res.json({
      parentId: parseInt(parentId),
      parentName: parent.name,
      features: featuresMap,
      featureKeys: FEATURE_KEYS
    });
  } catch (error: any) {
    console.error('[Admin] Get family features error:', error.message);
    res.status(500).json({ error: 'Failed to get family features' });
  }
});

export default router;
