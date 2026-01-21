import express, { Response } from 'express';
import axios from 'axios';
import db from '../database/init';
import { authenticate, adminOnly } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

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

// ===== ADMIN: PARENT CREATION CONTROLS =====

// Get parent creation settings (admin only)
router.get('/admin/parent-creation', authenticate, adminOnly, (req: AuthRequest, res: Response) => {
  try {
    const allowParentSetting: any = db.prepare("SELECT value FROM settings WHERE key = 'allow_parent_creation'").get();
    const maxParentsSetting: any = db.prepare("SELECT value FROM settings WHERE key = 'max_parents_per_family'").get();

    res.json({
      allow_parent_creation: allowParentSetting?.value === 'true',
      max_parents_per_family: parseInt(maxParentsSetting?.value || '4', 10)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update parent creation settings (admin only)
router.put('/admin/parent-creation', authenticate, adminOnly, (req: AuthRequest, res: Response) => {
  try {
    const { allow_parent_creation, max_parents_per_family } = req.body;

    if (allow_parent_creation !== undefined) {
      db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES ('allow_parent_creation', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
      `).run(allow_parent_creation ? 'true' : 'false');
    }

    if (max_parents_per_family !== undefined) {
      const maxVal = Math.max(1, Math.min(10, parseInt(max_parents_per_family, 10) || 4));
      db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES ('max_parents_per_family', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
      `).run(String(maxVal));
    }

    // Log the admin action
    try {
      db.prepare(`
        INSERT INTO audit_logs (action, entity_type, entity_id, actor_id, actor_type, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'PARENT_CREATION_SETTINGS_CHANGED',
        'settings',
        null,
        req.profile?.id,
        'admin',
        JSON.stringify({
          allow_parent_creation,
          max_parents_per_family,
          changed_by: req.profile?.id
        })
      );
    } catch (auditError: any) {
      console.error('[Audit] Failed to log settings change:', auditError.message);
    }

    console.log(`[Settings] Admin ${req.profile?.id} updated parent creation settings:`, {
      allow_parent_creation,
      max_parents_per_family
    });

    res.json({
      success: true,
      message: 'Parent creation settings updated',
      allow_parent_creation: allow_parent_creation !== undefined ? allow_parent_creation : undefined,
      max_parents_per_family: max_parents_per_family !== undefined ? max_parents_per_family : undefined
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ===== ADMIN: AUDIT LOGS =====

// Get audit logs (admin only)
router.get('/admin/audit-logs', authenticate, adminOnly, (req: AuthRequest, res: Response) => {
  try {
    const { action, entity_type, limit: queryLimit, offset: queryOffset } = req.query;

    let query = `
      SELECT
        al.*,
        p.name as actor_name
      FROM audit_logs al
      LEFT JOIN profiles p ON al.actor_id = p.id
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    if (action) {
      conditions.push('al.action = ?');
      params.push(action);
    }

    if (entity_type) {
      conditions.push('al.entity_type = ?');
      params.push(entity_type);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY al.created_at DESC';

    const limitNum = Math.min(100, parseInt(queryLimit as string, 10) || 50);
    const offsetNum = parseInt(queryOffset as string, 10) || 0;

    query += ` LIMIT ${limitNum} OFFSET ${offsetNum}`;

    const logs = db.prepare(query).all(...params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM audit_logs al';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }
    const countResult: any = db.prepare(countQuery).get(...params);

    res.json({
      logs,
      pagination: {
        total: countResult.total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < countResult.total
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get parent creation audit logs specifically (admin only)
router.get('/admin/audit-logs/parent-creation', authenticate, adminOnly, (req: AuthRequest, res: Response) => {
  try {
    const logs = db.prepare(`
      SELECT
        al.*,
        p.name as actor_name
      FROM audit_logs al
      LEFT JOIN profiles p ON al.actor_id = p.id
      WHERE al.action IN ('PARENT_CREATED', 'COPARENT_CREATED', 'PARENT_CREATION_SETTINGS_CHANGED')
      ORDER BY al.created_at DESC
      LIMIT 100
    `).all();

    res.json({ logs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ===== OLLAMA MANAGEMENT ENDPOINTS =====

const getOllamaUrl = (): string | null => {
  let url = process.env.OLLAMA_URL;
  if (!url || url.trim() === '') {
    try {
      const setting: any = db.prepare('SELECT value FROM settings WHERE key = ?').get('ollama_url');
      if (setting?.value) url = setting.value;
    } catch (error) {
      console.error('Failed to read ollama_url from settings:', error);
    }
  }
  return url && url.trim() !== '' ? url : null;
};

// Get Ollama status and available models
router.get('/ollama/status', async (req, res) => {
  try {
    const ollamaUrl = getOllamaUrl();

    if (!ollamaUrl) {
      return res.json({
        configured: false,
        connected: false,
        url: null,
        models: [],
        currentModel: process.env.OLLAMA_MODEL || null,
        message: 'Ollama URL not configured. Set OLLAMA_URL in environment or database settings.'
      });
    }

    // Extract base URL (remove /api/chat if present)
    const baseUrl = ollamaUrl.replace(/\/api\/chat\/?$/, '').replace(/\/api\/?$/, '');

    try {
      const response = await axios.get(`${baseUrl}/api/tags`, { timeout: 5000 });
      const models = response.data?.models || [];

      // Get current model setting
      let currentModel = process.env.OLLAMA_MODEL;
      if (!currentModel || currentModel.trim() === '') {
        const setting: any = db.prepare('SELECT value FROM settings WHERE key = ?').get('ollama_model');
        currentModel = setting?.value || 'llama3.2';
      }

      return res.json({
        configured: true,
        connected: true,
        url: ollamaUrl,
        baseUrl: baseUrl,
        models: models.map((m: any) => ({
          name: m.name,
          size: m.size,
          parameterSize: m.details?.parameter_size,
          family: m.details?.family
        })),
        currentModel,
        message: `Connected to Ollama at ${baseUrl}`
      });
    } catch (connError: any) {
      return res.json({
        configured: true,
        connected: false,
        url: ollamaUrl,
        models: [],
        currentModel: process.env.OLLAMA_MODEL || null,
        message: `Cannot connect to Ollama at ${baseUrl}: ${connError.message}`
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Test Ollama with a specific model
router.post('/ollama/test', async (req, res) => {
  try {
    const { model } = req.body;
    const ollamaUrl = getOllamaUrl();

    if (!ollamaUrl) {
      return res.status(400).json({
        success: false,
        error: 'Ollama URL not configured'
      });
    }

    const testModel = model || process.env.OLLAMA_MODEL || 'llama3.2';

    const response = await axios.post(
      ollamaUrl,
      {
        model: testModel,
        messages: [
          { role: 'user', content: 'Say "Hello! Ollama is working!" in exactly those words.' }
        ],
        stream: false,
        options: { num_predict: 20 }
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
    );

    const content = response.data?.message?.content;

    res.json({
      success: true,
      model: testModel,
      response: content,
      message: `Successfully tested ${testModel}`
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.response?.data?.error || error.message
    });
  }
});

// Update Ollama settings (URL and model)
router.post('/ollama/configure', async (req, res) => {
  try {
    const { url, model } = req.body;

    if (url !== undefined) {
      db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES ('ollama_url', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
      `).run(url);
    }

    if (model !== undefined) {
      db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES ('ollama_model', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
      `).run(model);
    }

    res.json({
      success: true,
      message: 'Ollama configuration updated',
      url: url || getOllamaUrl(),
      model: model || process.env.OLLAMA_MODEL || 'llama3.2'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Pull a new model (this can take a long time)
router.post('/ollama/pull', async (req, res) => {
  try {
    const { model } = req.body;
    const ollamaUrl = getOllamaUrl();

    if (!ollamaUrl) {
      return res.status(400).json({
        success: false,
        error: 'Ollama URL not configured'
      });
    }

    if (!model) {
      return res.status(400).json({
        success: false,
        error: 'Model name is required'
      });
    }

    // Extract base URL
    const baseUrl = ollamaUrl.replace(/\/api\/chat\/?$/, '').replace(/\/api\/?$/, '');

    // Start the pull (this is a long-running operation)
    // Note: This endpoint just initiates the pull - actual progress would need streaming
    const response = await axios.post(
      `${baseUrl}/api/pull`,
      { name: model, stream: false },
      { headers: { 'Content-Type': 'application/json' }, timeout: 600000 } // 10 min timeout
    );

    res.json({
      success: true,
      model,
      message: `Model ${model} pulled successfully`,
      status: response.data?.status
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.response?.data?.error || error.message
    });
  }
});

export default router;
