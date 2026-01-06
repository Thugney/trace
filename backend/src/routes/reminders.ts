import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getReminderPreferences, setReminderPreferences } from '../services/scheduler';

const router = express.Router();

// Get reminder preferences for a profile
router.get('/:profileId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profileId = parseInt(req.params.profileId);

    // Only allow users to see their own preferences or parents to see their children's
    const requesterId = req.profile!.id;
    const requesterType = req.profile!.type;

    if (requesterId !== profileId && requesterType !== 'parent' && requesterType !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to view these preferences' });
    }

    const preferences = getReminderPreferences(profileId);

    // Return defaults if no preferences set
    if (!preferences) {
      return res.json({
        profile_id: profileId,
        morning_reminder_time: '07:30',
        reminder_enabled: true
      });
    }

    res.json({
      profile_id: preferences.profile_id,
      morning_reminder_time: preferences.morning_reminder_time,
      reminder_enabled: preferences.reminder_enabled === 1
    });
  } catch (error: any) {
    console.error('[Reminders] Error getting preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update reminder preferences
router.put('/:profileId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const profileId = parseInt(req.params.profileId);
    const { enabled, time } = req.body;

    // Only allow users to update their own preferences or parents/admins
    const requesterId = req.profile!.id;
    const requesterType = req.profile!.type;

    if (requesterId !== profileId && requesterType !== 'parent' && requesterType !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to update these preferences' });
    }

    // Validate time format (HH:MM)
    if (time && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      return res.status(400).json({ error: 'Invalid time format. Use HH:MM' });
    }

    const preferences = setReminderPreferences(
      profileId,
      enabled !== undefined ? enabled : true,
      time
    );

    res.json({
      profile_id: preferences.profile_id,
      morning_reminder_time: preferences.morning_reminder_time,
      reminder_enabled: preferences.reminder_enabled === 1,
      message: 'Reminder preferences updated'
    });
  } catch (error: any) {
    console.error('[Reminders] Error updating preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test reminder (for debugging - admin only)
router.post('/test/:profileId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (req.profile!.type !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const profileId = parseInt(req.params.profileId);

    // Import sendPushNotification dynamically to avoid circular deps
    const { sendPushNotification } = await import('../services/notifications');

    await sendPushNotification(profileId, {
      type: 'reminder',
      title: 'Test Reminder 🔔',
      message: 'This is a test reminder from the scheduler!',
      icon: '🔔',
      url: '/tasks'
    });

    res.json({ message: 'Test reminder sent', profileId });
  } catch (error: any) {
    console.error('[Reminders] Error sending test:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
