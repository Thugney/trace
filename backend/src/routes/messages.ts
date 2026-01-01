import express from 'express';
import db from '../database/init';
import { authenticate, requireRole } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';

const router = express.Router();

// Send a message (teacher to parent or parent to teacher)
router.post('/', authenticate, requireRole(['teacher', 'parent']), (req: AuthRequest, res) => {
  try {
    const { sender_id, recipient_id, subject, message } = req.body;

    if (!sender_id || !recipient_id || !message) {
      return res.status(400).json({ error: 'sender_id, recipient_id, and message are required' });
    }

    // Verify sender and recipient exist
    const sender: any = db.prepare('SELECT id, type FROM profiles WHERE id = ?').get(sender_id);
    const recipient: any = db.prepare('SELECT id, type FROM profiles WHERE id = ?').get(recipient_id);

    if (!sender || !recipient) {
      return res.status(404).json({ error: 'Sender or recipient not found' });
    }

    // Verify sender is teacher or parent, recipient is teacher or parent
    const validTypes = ['teacher', 'parent'];
    if (!validTypes.includes(sender.type) || !validTypes.includes(recipient.type)) {
      return res.status(403).json({ error: 'Messages can only be sent between teachers and parents' });
    }

    const result = db.prepare(`
      INSERT INTO messages (sender_id, recipient_id, subject, message)
      VALUES (?, ?, ?, ?)
    `).run(sender_id, recipient_id, subject, message);

    const newMessage = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newMessage);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get inbox (messages received by user)
router.get('/inbox/:userId', authenticate, requireRole(['teacher', 'parent']), (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const { unread_only } = req.query;

    let query = `
      SELECT m.*,
             sender.name as sender_name,
             sender.type as sender_type,
             sender.avatar as sender_avatar
      FROM messages m
      JOIN profiles sender ON m.sender_id = sender.id
      WHERE m.recipient_id = ?
    `;

    if (unread_only === 'true') {
      query += ' AND m.is_read = 0';
    }

    query += ' ORDER BY m.created_at DESC';

    const messages = db.prepare(query).all(userId);
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get sent messages
router.get('/sent/:userId', authenticate, requireRole(['teacher', 'parent']), (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;

    const messages = db.prepare(`
      SELECT m.*,
             recipient.name as recipient_name,
             recipient.type as recipient_type,
             recipient.avatar as recipient_avatar
      FROM messages m
      JOIN profiles recipient ON m.recipient_id = recipient.id
      WHERE m.sender_id = ?
      ORDER BY m.created_at DESC
    `).all(userId);

    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mark message as read
router.put('/:id/read', authenticate, requireRole(['teacher', 'parent']), (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').run(id);

    const updatedMessage = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    if (!updatedMessage) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json(updatedMessage);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get unread count for user
router.get('/unread-count/:userId', authenticate, requireRole(['teacher', 'parent']), (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;

    const result: any = db.prepare(`
      SELECT COUNT(*) as count
      FROM messages
      WHERE recipient_id = ? AND is_read = 0
    `).get(userId);

    res.json({ count: result.count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get conversation between two users
router.get('/conversation/:userId1/:userId2', (req, res) => {
  try {
    const { userId1, userId2 } = req.params;

    const messages = db.prepare(`
      SELECT m.*,
             sender.name as sender_name,
             sender.type as sender_type,
             sender.avatar as sender_avatar,
             recipient.name as recipient_name,
             recipient.type as recipient_type
      FROM messages m
      JOIN profiles sender ON m.sender_id = sender.id
      JOIN profiles recipient ON m.recipient_id = recipient.id
      WHERE (m.sender_id = ? AND m.recipient_id = ?)
         OR (m.sender_id = ? AND m.recipient_id = ?)
      ORDER BY m.created_at ASC
    `).all(userId1, userId2, userId2, userId1);

    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete message
router.delete('/:id', authenticate, requireRole(['teacher', 'parent']), (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const result = db.prepare('DELETE FROM messages WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ message: 'Message deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all parents (for teacher to select recipient)
router.get('/parents', (req, res) => {
  try {
    const parents = db.prepare(`
      SELECT id, name, avatar
      FROM profiles
      WHERE type = 'parent'
      ORDER BY name ASC
    `).all();

    res.json(parents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
