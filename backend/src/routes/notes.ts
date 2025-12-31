import express from 'express';
import db from '../database/init';

const router = express.Router();

// Get all notes for a profile
router.get('/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;
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
router.post('/', (req, res) => {
  try {
    const { profile_id, title, content, color } = req.body;

    if (!profile_id || !title) {
      return res.status(400).json({ error: 'Profile ID and title are required' });
    }

    const result = db.prepare(`
      INSERT INTO notes (profile_id, title, content, color)
      VALUES (?, ?, ?, ?)
    `).run(profile_id, title, content || '', color || '#ffffff');

    const newNote = db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newNote);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update note
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, color } = req.body;

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
    res.status(500).json({ error: error.message });
  }
});

// Delete note
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({ message: 'Note deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
