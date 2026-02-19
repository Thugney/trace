import express from 'express';
import db from '../database/init';
import { createNotification } from '../services/notifications';

const router = express.Router();

// Get notifications for a profile
router.get('/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;
    const { unread_only, limit = '50', offset = '0' } = req.query;

    let query = `
      SELECT n.*,
        s.name as sender_name, s.avatar as sender_avatar, s.type as sender_type
      FROM notifications n
      LEFT JOIN profiles s ON n.sender_id = s.id
      WHERE n.recipient_id = ?
    `;
    const params: any[] = [profileId];

    if (unread_only === 'true') {
      query += ' AND n.is_read = 0';
    }

    query += ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const notifications = db.prepare(query).all(...params);
    res.json(notifications);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get unread count
router.get('/:profileId/unread-count', (req, res) => {
  try {
    const { profileId } = req.params;
    const result: any = db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE recipient_id = ? AND is_read = 0'
    ).get(profileId);
    res.json({ count: result.count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mark single notification as read
router.put('/:id/read', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
    const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
    res.json(notification);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mark all notifications as read for a profile
router.put('/:profileId/read-all', (req, res) => {
  try {
    const { profileId } = req.params;
    db.prepare('UPDATE notifications SET is_read = 1 WHERE recipient_id = ? AND is_read = 0').run(profileId);
    res.json({ message: 'All notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a notification
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM notifications WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ message: 'Notification deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Register push subscription
router.post('/push/subscribe', (req, res) => {
  try {
    const { profile_id, subscription } = req.body;

    if (!profile_id || !subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ error: 'profile_id and subscription with endpoint and keys required' });
    }

    // Upsert: delete existing for this endpoint, then insert
    db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(subscription.endpoint);

    db.prepare(`
      INSERT INTO push_subscriptions (profile_id, endpoint, p256dh, auth)
      VALUES (?, ?, ?, ?)
    `).run(
      profile_id,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth
    );

    res.json({ message: 'Push subscription registered' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Unregister push subscription
router.post('/push/unsubscribe', (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'endpoint required' });
    }
    db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
    res.json({ message: 'Push subscription removed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get VAPID public key (needed by frontend to subscribe)
router.get('/push/vapid-key', (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY || '';
  res.json({ key });
});

export default router;
