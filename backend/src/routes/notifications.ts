import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import notifications from '../services/notifications';

const router = express.Router();

// Get VAPID public key for frontend
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: notifications.getVapidPublicKey() });
});

// Subscribe to push notifications
router.post('/subscribe', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profileId = req.profile!.id;
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }

    const success = notifications.subscribeToPush(profileId, subscription);

    if (success) {
      res.json({ message: 'Subscribed to push notifications' });
    } else {
      res.status(500).json({ error: 'Failed to subscribe' });
    }
  } catch (error: any) {
    console.error('[Notifications] Subscribe error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check whether the current profile is linked to a browser subscription endpoint
router.post('/subscription-status', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profileId = req.profile!.id;
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint is required' });
    }

    const isSubscribed = notifications.isProfileSubscribedToEndpoint(profileId, endpoint);

    res.json({ isSubscribed });
  } catch (error: any) {
    console.error('[Notifications] Subscription status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profileId = req.profile!.id;
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint is required' });
    }

    const result = notifications.unsubscribeFromPush(profileId, endpoint);

    if (result.success) {
      res.json({
        message: 'Unsubscribed from push notifications',
        endpointStillUsed: result.endpointStillUsed
      });
    } else {
      res.status(500).json({ error: 'Failed to unsubscribe' });
    }
  } catch (error: any) {
    console.error('[Notifications] Unsubscribe error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get notifications for current user (in-app)
router.get('/', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profileId = req.profile!.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const unreadOnly = req.query.unread === 'true';

    const notificationsList = notifications.getNotifications(profileId, limit, unreadOnly);
    const unreadCount = notifications.getUnreadCount(profileId);

    res.json({
      notifications: notificationsList,
      unreadCount
    });
  } catch (error: any) {
    console.error('[Notifications] Get error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get unread count only
router.get('/unread-count', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profileId = req.profile!.id;
    const count = notifications.getUnreadCount(profileId);
    res.json({ count });
  } catch (error: any) {
    console.error('[Notifications] Unread count error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark notification as read
router.post('/:id/read', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const notificationId = parseInt(req.params.id);
    const success = notifications.markAsRead(notificationId);

    if (success) {
      res.json({ message: 'Notification marked as read' });
    } else {
      res.status(500).json({ error: 'Failed to mark as read' });
    }
  } catch (error: any) {
    console.error('[Notifications] Mark read error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark all notifications as read
router.post('/read-all', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profileId = req.profile!.id;
    const success = notifications.markAllAsRead(profileId);

    if (success) {
      res.json({ message: 'All notifications marked as read' });
    } else {
      res.status(500).json({ error: 'Failed to mark all as read' });
    }
  } catch (error: any) {
    console.error('[Notifications] Mark all read error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test notification (for development/testing)
router.post('/test', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const profileId = req.profile!.id;

    const result = await notifications.sendPushNotification(profileId, {
      type: 'general',
      title: 'Test Notification 🔔',
      message: 'This is a test notification from Family Learning Hub!',
      icon: '🔔',
      url: '/'
    });

    res.json({
      message: 'Test notification sent',
      ...result
    });
  } catch (error: any) {
    console.error('[Notifications] Test error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
