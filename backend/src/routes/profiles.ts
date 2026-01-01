import express from 'express';
import db from '../database/init';

const router = express.Router();

// Get all profiles
router.get('/', (req, res) => {
  try {
    console.log('[DEBUG] GET /api/profiles - Fetching all profiles');
    const profiles = db.prepare('SELECT * FROM profiles ORDER BY type DESC, created_at ASC').all();
    console.log(`[DEBUG] Found ${profiles.length} profiles`);
    res.json(profiles);
  } catch (error: any) {
    console.error('[ERROR] GET /api/profiles failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get single profile
router.get('/:id', (req, res) => {
  try {
    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create profile
router.post('/', (req, res) => {
  try {
    const { name, type, age, gender, avatar, settings, pin, parent_id } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    // If creating a child, parent_id is recommended
    if (type === 'child' && !parent_id) {
      console.warn('Creating child profile without parent_id - child will not be linked to a parent');
    }

    const result = db.prepare(`
      INSERT INTO profiles (name, type, age, gender, avatar, pin, settings, parent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, type, age, gender, avatar || null, pin || null, JSON.stringify(settings || {}), parent_id || null);

    const newProfile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newProfile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update profile
router.put('/:id', (req, res) => {
  try {
    const { name, age, gender, avatar, settings, pin } = req.body;
    const { id } = req.params;

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
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
    if (settings !== undefined) {
      updates.push('settings = ?');
      values.push(JSON.stringify(settings));
    }
    if (pin !== undefined) {
      updates.push('pin = ?');
      values.push(pin || null);
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

// Delete profile
router.delete('/:id', (req, res) => {
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

// Login (username + PIN) - works for both parents and kids
router.post('/login', (req, res) => {
  try {
    const { username, pin } = req.body;

    console.log(`[DEBUG] Login attempt for username: ${username}`);

    if (!username || !pin) {
      return res.status(400).json({ error: 'Username and PIN are required' });
    }

    // Find profile by name (parent OR child)
    const profile: any = db.prepare(
      'SELECT * FROM profiles WHERE name = ?'
    ).get(username);

    if (!profile) {
      console.log(`[DEBUG] Profile not found for username: ${username}`);
      return res.status(401).json({ error: 'Invalid username or PIN' });
    }

    console.log(`[DEBUG] Profile found. Stored PIN: ${profile.pin}, Provided PIN: ${pin}`);
    console.log(`[DEBUG] PIN length - Stored: ${profile.pin?.length}, Provided: ${pin.length}`);

    // Verify PIN
    if (!profile.pin || profile.pin !== pin) {
      console.log(`[DEBUG] PIN verification failed`);
      return res.status(401).json({ error: 'Invalid username or PIN' });
    }

    // Return profile info
    res.json({
      success: true,
      profile: {
        id: profile.id,
        name: profile.name,
        type: profile.type,
        avatar: profile.avatar
      }
    });
  } catch (error: any) {
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
