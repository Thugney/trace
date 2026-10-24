import express, { Response, NextFunction } from 'express';
import db from '../database/init';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, adminOnly, loadPermissions } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import { FEATURE_KEYS } from '../services/feature-keys';
import { authorizationService } from '../services/authorization';
import { getEffectiveFeaturesForProfile } from '../services/profileFeatures';
import {
  createSession,
  createStreamToken,
  extractBearerToken,
  resolveSessionToken,
  revokeSession,
  revokeSessionsForProfile
} from '../services/authSessions';
import { hashSecret, verifySecret } from '../services/credentials';
import {
  canAccessOwnOrManagedChild,
  canViewFamilyProfile,
  getManagedChildIdsForParent,
  getVisibleProfileIdsForParent
} from '../services/familyAccess';

const router = express.Router();
const SALT_ROUNDS = 10;

const getChildProgressSnapshot = (childId: number) => {
  const taskStats = db.prepare(`
    SELECT
      COUNT(*) as total_tasks,
      SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_tasks,
      SUM(CASE WHEN completed = 0 AND due_date IS NOT NULL AND due_date < datetime('now') THEN 1 ELSE 0 END) as overdue_tasks
    FROM tasks
    WHERE profile_id = ? AND deleted_at IS NULL
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

// Authenticated: current session identity (derived server-side from the token)
router.get('/session', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profile: any = db.prepare(`
      SELECT id, name, type, avatar, age, gender, parent_id, family_id, ai_enabled, diet_enabled, username
      FROM profiles WHERE id = ?
    `).get(req.profile!.id);

    res.json({ profile, session: { id: req.authSession!.id } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Authenticated: end the current session
router.post('/logout', authenticate, (req: AuthRequest, res: Response) => {
  try {
    revokeSession(req.authSession!.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Authenticated: short-lived token for EventSource / H5P iframe requests that cannot send headers
router.post('/session/stream-token', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const session = resolveSessionToken(extractBearerToken(req.headers.authorization));
    if (!session) {
      return res.status(401).json({ error: 'Session expired or invalid', code: 'session_invalid' });
    }

    res.json(createStreamToken(session));
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

    let children: any[] = [];
    if (userProfile.type === 'admin') {
      children = db.prepare(`
        SELECT id, name, avatar, age
        FROM profiles
        WHERE type = 'child'
        ORDER BY name ASC
      `).all() as any[];
    } else {
      const childIds = getManagedChildIdsForParent(userProfile.id);
      if (childIds.length > 0) {
        const placeholders = childIds.map(() => '?').join(', ');
        children = db.prepare(`
          SELECT id, name, avatar, age
          FROM profiles
          WHERE type = 'child' AND id IN (${placeholders})
          ORDER BY name ASC
        `).all(...childIds) as any[];
      }
    }

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

// Legacy: Get family progress by parent ID
router.get('/:parentId/progress', authenticate, (req: AuthRequest, res) => {
  try {
    const parentId = parseInt(req.params.parentId);
    const viewer = req.profile!;
    const parent = db.prepare('SELECT id, type FROM profiles WHERE id = ?').get(parentId) as any;

    if (!parent || parent.type !== 'parent') {
      return res.status(404).json({ error: 'Parent not found' });
    }

    if (viewer.type !== 'admin' && viewer.id !== parentId) {
      return res.status(403).json({ error: 'Access denied: You can only view your own family progress' });
    }

    const childIds = getManagedChildIdsForParent(parentId);
    const children = childIds.length > 0
      ? db.prepare(`
          SELECT id, name, avatar, age
          FROM profiles
          WHERE type = 'child' AND id IN (${childIds.map(() => '?').join(', ')})
          ORDER BY name ASC
        `).all(...childIds) as any[]
      : [];

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

// ==================== MODULE PERMISSIONS ENDPOINTS ====================
// CRITICAL: These routes MUST be before /:id to avoid being caught by the generic parameter route

// Get current user's module permissions
router.get('/permissions', authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.profile) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const permissions = await authorizationService.getUserPermissions(req.profile.id);

    // Get family info - use familyId from permissions which handles inheritance for children
    let familyInfo = null;
    const familyId = permissions.familyId || req.profile.family_id;

    if (familyId) {
      const family: any = db.prepare('SELECT id, name, family_type, status FROM families WHERE id = ?').get(familyId);
      if (family) {
        familyInfo = {
          id: family.id,
          name: family.name,
          type: family.family_type,
          status: family.status
        };
      }
    }

    res.json({
      permissions: {
        coreApp: permissions.coreApp,
        churchSchool: permissions.churchSchool,
        role: permissions.role,
        familyType: permissions.familyType
      },
      family: familyInfo
    });
  } catch (error: any) {
    console.error('[Permissions] Get permissions error:', error.message);
    res.status(500).json({ error: 'Failed to get permissions' });
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
      const visibleIds = getVisibleProfileIdsForParent(userProfile.id);
      if (visibleIds.length === 0) {
        profiles = [];
      } else {
        profiles = db.prepare(`
          SELECT * FROM profiles
          WHERE id IN (${visibleIds.map(() => '?').join(', ')})
          ORDER BY type DESC, created_at ASC
        `).all(...visibleIds);
      }
      console.log(`[DEBUG] Parent view: ${profiles.length} profiles (family-visible set)`);
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

    if (canViewFamilyProfile(userProfile, requestedId)) {
      return res.json(profile);
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
    // Parents can create children OR other parents (spouse/co-parent) - subject to admin settings
    // Only admins can create teacher/admin profiles
    if (type !== 'child' && type !== 'parent' && userProfile.type !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create teacher/admin profiles' });
    }

    // Non-admins cannot create admin profiles
    if (type === 'admin' && userProfile.type !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create admin profiles' });
    }

    // Check admin setting if a parent is trying to create another parent (co-parent)
    if (type === 'parent' && userProfile.type === 'parent') {
      const allowParentSetting: any = db.prepare("SELECT value FROM settings WHERE key = 'allow_parent_creation'").get();
      if (allowParentSetting?.value === 'false') {
        return res.status(403).json({ error: 'Parent/co-parent creation has been disabled by the administrator.' });
      }

      // Check max parents per family limit
      if (userProfile.family_id) {
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
      }
    }

    // If parent is creating a child, link to themselves and their family
    let finalParentId = parent_id;
    let finalFamilyId = null;
    if (type === 'child') {
      if (userProfile.type === 'parent') {
        finalParentId = userProfile.id; // Link child to the parent creating it
        finalFamilyId = userProfile.family_id; // Assign child to parent's family
      } else if (userProfile.type === 'admin') {
        // Admin creating child - if parent_id is specified, inherit family from that parent
        if (parent_id) {
          const selectedParent: any = db.prepare('SELECT family_id FROM profiles WHERE id = ? AND type = ?').get(parent_id, 'parent');
          if (selectedParent && selectedParent.family_id) {
            finalFamilyId = selectedParent.family_id;
            console.log(`[Profile] Admin creating child under parent ${parent_id}, inheriting family_id: ${finalFamilyId}`);
          } else {
            console.warn(`[Profile] Admin creating child with parent_id ${parent_id}, but parent has no family_id`);
          }
        } else {
          console.warn('[Profile] Admin creating child profile without parent_id - child will not be linked to a parent/family');
        }
      }
    }
    // If parent is creating another parent (co-parent), assign to same family
    if (type === 'parent' && userProfile.type === 'parent') {
      finalFamilyId = userProfile.family_id;
    }

    // Auto-generate username if not provided (lowercase name without spaces)
    const finalUsername = username || name.toLowerCase().replace(/\s+/g, '');

    // Validate username uniqueness (FIX: was missing from admin create path)
    const existingUser: any = db.prepare('SELECT id FROM profiles WHERE username = ?').get(finalUsername);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists. Please choose a different username.' });
    }

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
      INSERT INTO profiles (name, type, age, gender, avatar, username, pin, password, settings, parent_id, family_id, assigned_class_id, ai_enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(name, type, age, gender, avatar || null, finalUsername, hashedPin, hashedPassword, JSON.stringify(settings || {}), finalParentId || null, finalFamilyId, finalAssignedClassId);

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

    // Link child to ALL parents in the same family (not just the creating parent)
    if (type === 'child' && finalFamilyId) {
      const familyParents: any[] = db.prepare(`
        SELECT id FROM profiles WHERE family_id = ? AND type = 'parent'
      `).all(finalFamilyId);

      familyParents.forEach((parent: any) => {
        db.prepare(`
          INSERT OR IGNORE INTO guardian_students (guardian_id, student_id, relationship)
          VALUES (?, ?, 'parent')
        `).run(parent.id, newProfile.id);
      });

      console.log(`[Profile] Linked child ${newProfile.name} to ${familyParents.length} parents in family ${finalFamilyId}`);
    } else if (type === 'child' && finalParentId) {
      // Fallback for legacy case (no family_id)
      db.prepare(`
        INSERT OR IGNORE INTO guardian_students (guardian_id, student_id, relationship)
        VALUES (?, ?, 'parent')
      `).run(finalParentId, newProfile.id);
    }

    // If a parent created another parent (spouse/co-parent), link the new parent to all existing children in the family
    if (type === 'parent' && userProfile.type === 'parent' && finalFamilyId) {
      const existingChildren: any[] = db.prepare(`
        SELECT id FROM profiles WHERE family_id = ? AND type = 'child'
      `).all(finalFamilyId);

      existingChildren.forEach((child: any) => {
        db.prepare(`
          INSERT OR IGNORE INTO guardian_students (guardian_id, student_id, relationship)
          VALUES (?, ?, 'parent')
        `).run(newProfile.id, child.id);
      });

      console.log(`[Profile] Linked new parent ${newProfile.name} to ${existingChildren.length} existing children in family ${finalFamilyId}`);
    }

    // Audit log for parent profile creation (security tracking)
    if (type === 'parent') {
      try {
        // Get actor name for audit log
        const actorProfile: any = db.prepare('SELECT name FROM profiles WHERE id = ?').get(userProfile.id);
        const linkedChildCount: any = userProfile.type === 'parent' && finalFamilyId
          ? db.prepare(`SELECT COUNT(*) as count FROM profiles WHERE family_id = ? AND type = 'child'`).get(finalFamilyId)
          : { count: 0 };

        db.prepare(`
          INSERT INTO audit_logs (action, entity_type, entity_id, actor_id, actor_type, details)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          'PARENT_CREATED',
          'profile',
          newProfile.id,
          userProfile.id,
          userProfile.type,
          JSON.stringify({
            created_parent_name: newProfile.name,
            created_parent_username: newProfile.username,
            family_id: finalFamilyId,
            created_by_name: actorProfile?.name || 'Unknown',
            linked_children_count: linkedChildCount?.count || 0
          })
        );
        console.log(`[Audit] Parent profile ${newProfile.name} created by ${actorProfile?.name} (${userProfile.type})`);
      } catch (auditError: any) {
        console.error('[Audit] Failed to log parent creation:', auditError.message);
      }
    }

    if (type === 'teacher' && finalAssignedClassId) {
      db.prepare(`
        INSERT OR IGNORE INTO teacher_class_assignments (teacher_id, class_id)
        VALUES (?, ?)
      `).run(newProfile.id, finalAssignedClassId);
    }

    // Initialize module permissions based on family type (core_app vs church_school)
    try {
      await authorizationService.initializePermissionsForProfile(newProfile.id);
      console.log(`[Profile] Initialized module permissions for ${newProfile.name} (ID: ${newProfile.id})`);
    } catch (permError: any) {
      console.error('[Profile] Failed to initialize module permissions:', permError.message);
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
    const effectiveFeatures = getEffectiveFeaturesForProfile(profile);
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
    const canUpdate = canAccessOwnOrManagedChild(userProfile, targetProfile.id);

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
      isValid = await verifySecret(String(pin), profile.pin, (hash) => {
        db.prepare('UPDATE profiles SET pin = ? WHERE id = ?').run(hash, profile.id);
      });
      console.log(`[DEBUG] PIN verification for child: ${isValid}`);
    } else {
      // Adults use password (preferred) or PIN (backwards compatibility)
      if (profile.password) {
        // Password is set - use it
        isValid = await verifySecret(String(pin), profile.password, (hash) => {
          db.prepare('UPDATE profiles SET password = ? WHERE id = ?').run(hash, profile.id);
        });
        console.log(`[DEBUG] Password verification for ${profile.type}: ${isValid}`);
      } else if (profile.pin) {
        // Fallback to PIN for backwards compatibility
        isValid = await verifySecret(String(pin), profile.pin, (hash) => {
          db.prepare('UPDATE profiles SET pin = ? WHERE id = ?').run(hash, profile.id);
        });
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

    // Get user's module permissions
    const permissions = await authorizationService.getUserPermissions(profile.id);

    // Get family info if user belongs to a family
    let familyInfo = null;
    if (profile.family_id) {
      const family: any = db.prepare('SELECT id, name, family_type, status FROM families WHERE id = ?').get(profile.family_id);
      if (family) {
        familyInfo = {
          id: family.id,
          name: family.name,
          type: family.family_type,
          status: family.status
        };
      }
    }

    const session = createSession(profile.id, req.get('user-agent'));

    // Return profile info (exclude sensitive data)
    res.json({
      success: true,
      token: session.token,
      expires_at: session.expiresAt,
      profile: {
        id: profile.id,
        name: profile.name,
        type: profile.type,
        avatar: profile.avatar,
        age: profile.age,
        gender: profile.gender,
        parent_id: profile.parent_id,
        family_id: profile.family_id,
        ai_enabled: profile.ai_enabled,
        diet_enabled: profile.diet_enabled,
        username: profile.username
      },
      permissions: {
        coreApp: permissions.coreApp,
        churchSchool: permissions.churchSchool,
        role: permissions.role,
        familyType: permissions.familyType
      },
      family: familyInfo
    });
  } catch (error: any) {
    console.error('[ERROR] Login failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify profile PIN (self, managing guardian or admin only)
router.post('/:id/verify-pin', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const targetId = Number(req.params.id);
    const { pin } = req.body;

    if (!Number.isInteger(targetId) || !canAccessOwnOrManagedChild(req.profile!, targetId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const profile: any = db.prepare('SELECT pin FROM profiles WHERE id = ?').get(targetId);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // A profile without a PIN cannot be verified by PIN
    if (!profile.pin) {
      return res.json({ verified: false, pin_set: false });
    }

    const verified = await verifySecret(String(pin ?? ''), profile.pin, (hash) => {
      db.prepare('UPDATE profiles SET pin = ? WHERE id = ?').run(hash, targetId);
    });
    res.json({ verified });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Set profile PIN (self with current PIN, or managing guardian/admin)
router.post('/:id/set-pin', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const targetId = Number(req.params.id);
    const { pin, currentPin } = req.body;
    const requester = req.profile!;

    if (!Number.isInteger(targetId) || !canAccessOwnOrManagedChild(requester, targetId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!pin || String(pin).length < 4) {
      return res.status(400).json({ error: 'PIN must be at least 4 characters' });
    }

    const profile: any = db.prepare('SELECT pin FROM profiles WHERE id = ?').get(targetId);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Changing your own existing PIN requires the current PIN
    if (requester.id === targetId && profile.pin) {
      const currentValid = await verifySecret(String(currentPin ?? ''), profile.pin);
      if (!currentValid) {
        return res.status(403).json({ error: 'Current PIN is incorrect' });
      }
    }

    db.prepare('UPDATE profiles SET pin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(await hashSecret(String(pin)), targetId);

    if (requester.id !== targetId) {
      revokeSessionsForProfile(targetId);
    }

    res.json({ message: 'PIN updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reset password/PIN (admin can reset anyone, parents can reset their kids)
router.post('/:id/reset-password', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { newPassword, newPin } = req.body;
    const requester = req.profile!;

    // Get the profile being reset
    const profile: any = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (requester.type === 'admin') {
      // Admin can reset any profile
    } else if (requester.type === 'parent') {
      if (profile.type !== 'child' || !canAccessOwnOrManagedChild(requester, profile.id)) {
        return res.status(403).json({ error: 'Unauthorized: You can only reset your own children\'s credentials' });
      }
    } else {
      return res.status(403).json({ error: 'Unauthorized: Parent or admin access required' });
    }

    // Reset password or PIN based on profile type
    if (profile.type === 'child' && newPin) {
      const hashedPin = await bcrypt.hash(newPin, SALT_ROUNDS);
      db.prepare('UPDATE profiles SET pin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(hashedPin, id);
      revokeSessionsForProfile(profile.id);
      console.log(`[DEBUG] PIN reset for child ${profile.name} by ${requester.type}`);
      res.json({ message: 'PIN reset successfully' });
    } else if (profile.type !== 'child' && newPassword) {
      if (requester.type !== 'admin') {
        return res.status(403).json({ error: 'Only admins can reset parent, teacher, or admin passwords' });
      }
      const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
      db.prepare('UPDATE profiles SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(hashedPassword, id);
      revokeSessionsForProfile(profile.id);
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
router.get('/:id/stats', authenticate, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const requestedId = parseInt(id, 10);

    if (!canAccessOwnOrManagedChild(req.profile!, requestedId)) {
      return res.status(403).json({ error: 'Access denied: You can only view your own or your children\'s statistics' });
    }

    // Get task stats for kids
    const taskStats = db.prepare(`
      SELECT
        COUNT(*) as total_tasks,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN completed = 0 AND due_date IS NOT NULL AND due_date < datetime('now') THEN 1 ELSE 0 END) as overdue_tasks
      FROM tasks
      WHERE profile_id = ? AND deleted_at IS NULL
    `).get(requestedId);

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
    `).get(requestedId);

    // Get diet stats
    const dietStats = db.prepare(`
      SELECT
        COUNT(*) as meals_logged,
        SUM(calories_consumed) as total_calories,
        DATE(logged_at) as log_date
      FROM meal_logs
      WHERE profile_id = ? AND DATE(logged_at) = DATE('now')
      GROUP BY DATE(logged_at)
    `).get(requestedId);

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
    if (!canAccessOwnOrManagedChild(userProfile, requestedId)) {
      return res.status(403).json({ error: 'Access denied: You can only view your own or your children\'s journey' });
    }

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
    `).all(requestedId, startDate, endDate);

    // Get progress/points earned in period
    const progressEntries: any[] = db.prepare(`
      SELECT id, points_earned, stars_earned, logged_at as date
      FROM progress
      WHERE profile_id = ?
        AND logged_at >= ? AND logged_at <= ?
      ORDER BY logged_at DESC
    `).all(requestedId, startDate, endDate);

    // Get achieved goals in period
    const achievedGoals: any[] = db.prepare(`
      SELECT id, goal_description as title, goal_points as points, month, updated_at as date
      FROM monthly_goals
      WHERE profile_id = ? AND achieved = 1
        AND updated_at >= ? AND updated_at <= ?
      ORDER BY updated_at DESC
    `).all(requestedId, startDate, endDate);

    // Get meals logged in period
    const mealsLogged: any[] = db.prepare(`
      SELECT id, meal_type, food_items, calories_consumed, logged_at as date
      FROM meal_logs
      WHERE profile_id = ?
        AND logged_at >= ? AND logged_at <= ?
      ORDER BY logged_at DESC
    `).all(requestedId, startDate, endDate);

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

// Get permissions for a specific profile (admin only)
// NOTE: The main /permissions endpoint is defined earlier in the file before /:id route
router.get('/:id/permissions', ...adminOnly, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const profileId = parseInt(id);

    const profile: any = db.prepare('SELECT id, name, type, family_id FROM profiles WHERE id = ?').get(profileId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const permissions = await authorizationService.getUserPermissions(profileId);

    // Get family info if user belongs to a family
    let familyInfo = null;
    if (profile.family_id) {
      const family: any = db.prepare('SELECT id, name, family_type, status FROM families WHERE id = ?').get(profile.family_id);
      if (family) {
        familyInfo = {
          id: family.id,
          name: family.name,
          type: family.family_type,
          status: family.status
        };
      }
    }

    res.json({
      profile: {
        id: profile.id,
        name: profile.name,
        type: profile.type
      },
      permissions: {
        coreApp: permissions.coreApp,
        churchSchool: permissions.churchSchool,
        role: permissions.role,
        familyType: permissions.familyType
      },
      family: familyInfo
    });
  } catch (error: any) {
    console.error('[Permissions] Get profile permissions error:', error.message);
    res.status(500).json({ error: 'Failed to get profile permissions' });
  }
});

export default router;
