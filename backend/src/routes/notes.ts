import express, { Response } from 'express';
import db from '../database/init';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireFeature } from '../middleware/feature-access';
import { canAccessOwnOrManagedChild } from '../services/familyAccess';
import { notesLocked, selectNotesWithLearnContext } from '../services/learn/lessonNotes';

const router = express.Router();
router.use(authenticate, requireFeature('notes'));

// Users reach their own notes; parents their managed children's; admins all
function canAccessNotesOf(req: AuthRequest, ownerId: number): boolean {
  return Number.isInteger(ownerId) && canAccessOwnOrManagedChild(req.profile!, ownerId);
}

// A learner's own lesson notes are withheld while their mock exam or review paper runs
function hideLessonNotes(req: AuthRequest, ownerId: number): boolean {
  return req.profile!.id === ownerId && notesLocked(ownerId);
}

// Get all notes for a profile
router.get('/:profileId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const { category, tag } = req.query;
    const targetProfileId = parseInt(req.params.profileId);

    if (!canAccessNotesOf(req, targetProfileId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let where = 'n.profile_id = ?';
    const params: any[] = [targetProfileId];

    if (category && category !== 'all') {
      where += ' AND n.category = ?';
      params.push(category);
    }
    if (hideLessonNotes(req, targetProfileId)) {
      where += ' AND n.learn_lesson_id IS NULL';
    }

    let notes: any[] = selectNotesWithLearnContext(`${where} ORDER BY n.is_pinned DESC, n.updated_at DESC`, params);

    // Filter by tag if specified (done in-memory since tags are JSON)
    if (tag && tag !== 'all') {
      notes = notes.filter(note => {
        if (!note.tags) return false;
        try {
          const noteTags = JSON.parse(note.tags);
          return Array.isArray(noteTags) && noteTags.includes(tag);
        } catch {
          return false;
        }
      });
    }

    res.json(notes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all categories for a profile
router.get('/:profileId/categories', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const targetProfileId = parseInt(req.params.profileId);
    if (!canAccessNotesOf(req, targetProfileId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const categories = db.prepare(
      "SELECT DISTINCT category FROM notes WHERE profile_id = ? AND category IS NOT NULL AND category != '' ORDER BY category"
    ).all(targetProfileId);
    res.json(categories.map((c: any) => c.category));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all tags for a profile (extracted from all notes)
router.get('/:profileId/tags', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const targetProfileId = parseInt(req.params.profileId);
    if (!canAccessNotesOf(req, targetProfileId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const lessonFilter = hideLessonNotes(req, targetProfileId) ? ' AND learn_lesson_id IS NULL' : '';
    const notes: any[] = db.prepare(
      `SELECT tags FROM notes WHERE profile_id = ? AND tags IS NOT NULL AND tags != ''${lessonFilter}`
    ).all(targetProfileId);

    // Extract and deduplicate all tags
    const allTags = new Set<string>();
    for (const note of notes) {
      try {
        const tags = JSON.parse(note.tags);
        if (Array.isArray(tags)) {
          tags.forEach(tag => allTags.add(tag));
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }

    res.json(Array.from(allTags).sort());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get notes with reminders due today or upcoming
router.get('/:profileId/reminders', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const targetProfileId = parseInt(req.params.profileId);
    if (!canAccessNotesOf(req, targetProfileId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get notes with reminders that are today or in the future
    const today = new Date().toISOString().split('T')[0];
    const lessonFilter = hideLessonNotes(req, targetProfileId) ? ' AND learn_lesson_id IS NULL' : '';
    const notes = db.prepare(`
      SELECT * FROM notes
      WHERE profile_id = ?
        AND reminder_at IS NOT NULL
        AND reminder_at >= ?${lessonFilter}
      ORDER BY reminder_at ASC
    `).all(targetProfileId, today);

    res.json(notes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single note
router.get('/note/:id', (req: AuthRequest, res: Response) => {
  try {
    const note = selectNotesWithLearnContext('n.id = ?', [req.params.id])[0];
    // Unknown, foreign and test-locked notes look the same
    if (!note || !canAccessNotesOf(req, note.profile_id) || (note.learn_lesson_id && hideLessonNotes(req, note.profile_id))) {
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
    const { profile_id, title, content, color, category, reminder_at, tags } = req.body;

    if (!profile_id || !title) {
      return res.status(400).json({ error: 'Profile ID and title are required' });
    }

    // Lesson notes are only created from a lesson (Learn routes); learn_* body fields are ignored here
    if (!canAccessNotesOf(req, parseInt(profile_id))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Convert tags array to JSON string
    const tagsJson = tags && Array.isArray(tags) ? JSON.stringify(tags) : null;

    const result = db.prepare(`
      INSERT INTO notes (profile_id, title, content, color, category, reminder_at, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(profile_id, title, content || '', color || '#ffffff', category || null, reminder_at || null, tagsJson);

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
    const { id } = req.params;
    const { title, content, color, category } = req.body;

    // Check note ownership
    const note: any = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    if (!canAccessNotesOf(req, note.profile_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (note.learn_lesson_id && hideLessonNotes(req, note.profile_id)) {
      return res.status(423).json({ error: 'Lesson notes are paused during a test', code: 'exam_in_progress' });
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
    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category);
    }
    if (req.body.is_pinned !== undefined) {
      updates.push('is_pinned = ?');
      values.push(req.body.is_pinned ? 1 : 0);
    }
    if (req.body.reminder_at !== undefined) {
      updates.push('reminder_at = ?');
      values.push(req.body.reminder_at || null);
    }
    if (req.body.tags !== undefined) {
      updates.push('tags = ?');
      values.push(req.body.tags && Array.isArray(req.body.tags) ? JSON.stringify(req.body.tags) : null);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`
      UPDATE notes
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);

    const updatedNote = selectNotesWithLearnContext('n.id = ?', [id])[0];
    res.json(updatedNote);
  } catch (error: any) {
    console.error('[Notes] Update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete note
router.delete('/:id', authenticate, (req: AuthRequest, res: Response) => {
  try {
    // Check note ownership
    const note: any = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    if (!canAccessNotesOf(req, note.profile_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (note.learn_lesson_id && hideLessonNotes(req, note.profile_id)) {
      return res.status(423).json({ error: 'Lesson notes are paused during a test', code: 'exam_in_progress' });
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
