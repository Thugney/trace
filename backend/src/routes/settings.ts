import express from 'express';
import db from '../database/init';

const router = express.Router();

// Get all settings
router.get('/', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings').all();

    // Convert to key-value object
    const settingsObj: Record<string, any> = {};
    settings.forEach((setting: any) => {
      settingsObj[setting.key] = setting.value;
    });

    res.json(settingsObj);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single setting
router.get('/:key', (req, res) => {
  try {
    const setting: any = db.prepare('SELECT * FROM settings WHERE key = ?').get(req.params.key);

    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({ key: setting.key, value: setting.value });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update or create setting
router.post('/:key', (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'value is required' });
    }

    // Upsert setting
    db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `).run(key, value);

    const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);
    res.json(setting);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Verify parent PIN
router.post('/verify-pin', (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({ error: 'PIN is required' });
    }

    const setting: any = db.prepare('SELECT value FROM settings WHERE key = ?').get('parent_pin');

    // If no PIN is set, reject
    if (!setting || !setting.value) {
      return res.status(401).json({ error: 'Parent PIN not configured', verified: false });
    }

    const verified = setting.value === pin;

    res.json({ verified });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Set parent PIN
router.post('/set-pin', (req, res) => {
  try {
    const { pin, current_pin } = req.body;

    if (!pin) {
      return res.status(400).json({ error: 'New PIN is required' });
    }

    // Check if PIN already exists
    const existingSetting: any = db.prepare('SELECT value FROM settings WHERE key = ?').get('parent_pin');

    // If PIN exists, verify current PIN
    if (existingSetting && existingSetting.value) {
      if (!current_pin || current_pin !== existingSetting.value) {
        return res.status(401).json({ error: 'Current PIN is incorrect' });
      }
    }

    // Set new PIN
    db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES ('parent_pin', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `).run(pin);

    res.json({ message: 'PIN updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete setting
router.delete('/:key', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM settings WHERE key = ?').run(req.params.key);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({ message: 'Setting deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get feature flags - public endpoint for UI configuration
router.get('/features/flags', (req, res) => {
  try {
    // Diet feature is hidden by default (can be enabled in settings later)
    const dietSetting: any = db.prepare("SELECT value FROM settings WHERE key = 'diet_feature_enabled'").get();
    const schoolOnlySetting: any = db.prepare("SELECT value FROM settings WHERE key = 'school_only_mode'").get();

    res.json({
      diet_enabled: dietSetting?.value === 'true',
      school_only_mode: schoolOnlySetting?.value === 'true'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
