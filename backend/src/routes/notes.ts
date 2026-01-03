import express, { Response } from 'express';
import db from '../database/init';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get all notes for a profile
router.get('/:profileId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { profileId } = req.params;
    const userProfile = req.profile!;

    // Authorization: users can only access their own notes (or admin/parent can access kids' notes)
    const targetProfileId = parseInt(profileId);
    if (userProfile.type !== 'admin' && userProfile.id !== targetProfileId) {
      const targetProfile: any = db.prepare('SELECT parent_id FROM profiles WHERE id = ?').get(targetProfileId);
      if (!targetProfile || (userProfile.type === 'parent' && targetProfile.parent_id !== userProfile.id)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const notes = db.prepare(
      'SELECT * FROM notes WHERE profile_id = ? ORDER BY updated_at DESC'
    ).all(profileId);
    res.json(notes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single note
router.get('/note/:id', (req, res) => {
  try {
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(note);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create note
router.post('/', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const userProfile = req.profile!;
    const { profile_id, title, content, color } = req.body;

    if (!profile_id || !title) {
      return res.status(400).json({ error: 'Profile ID and title are required' });
    }

    // Authorization: users can only create notes for themselves (or admin/parent for kids)
    const targetProfileId = parseInt(profile_id);
    if (userProfile.type !== 'admin' && userProfile.id !== targetProfileId) {
      const targetProfile: any = db.prepare('SELECT parent_id FROM profiles WHERE id = ?').get(targetProfileId);
      if (!targetProfile || (userProfile.type === 'parent' && targetProfile.parent_id !== userProfile.id)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const result = db.prepare(`
      INSERT INTO notes (profile_id, title, content, color)
      VALUES (?, ?, ?, ?)
    `).run(profile_id, title, content || '', color || '#ffffff');

    const newNote = db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newNote);
  } catch (error: any) {
    console.error('[Notes] Create error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update note
router.put('/:id', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const userProfile = req.profile!;
    const { id } = req.params;
    const { title, content, color } = req.body;

    // Check note ownership
    const note: any = db.prepare('SELECT profile_id FROM notes WHERE id = ?').get(id);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Authorization
    if (userProfile.type !== 'admin' && userProfile.id !== note.profile_id) {
      const targetProfile: any = db.prepare('SELECT parent_id FROM profiles WHERE id = ?').get(note.profile_id);
      if (!targetProfile || (userProfile.type === 'parent' && targetProfile.parent_id !== userProfile.id)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (content !== undefined) {
      updates.push('content = ?');
      values.push(content);
    }
    if (color !== undefined) {
      updates.push('color = ?');
      values.push(color);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`
      UPDATE notes
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);

    const updatedNote = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    res.json(updatedNote);
  } catch (error: any) {
    console.error('[Notes] Update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete note
router.delete('/:id', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const userProfile = req.profile!;

    // Check note ownership
    const note: any = db.prepare('SELECT profile_id FROM notes WHERE id = ?').get(req.params.id);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Authorization
    if (userProfile.type !== 'admin' && userProfile.id !== note.profile_id) {
      const targetProfile: any = db.prepare('SELECT parent_id FROM profiles WHERE id = ?').get(note.profile_id);
      if (!targetProfile || (userProfile.type === 'parent' && targetProfile.parent_id !== userProfile.id)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const result = db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({ message: 'Note deleted successfully' });
  } catch (error: any) {
    console.error('[Notes] Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
