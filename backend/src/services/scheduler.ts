import cron from 'node-cron';
import db from '../database/init';
import { sendPushNotification } from './notifications';

interface ReminderPreference {
  id: number;
  profile_id: number;
  morning_reminder_time: string;
  reminder_enabled: number;
}

interface Task {
  id: number;
  title: string;
  due_date: string;
  profile_id: number;
}

interface Profile {
  id: number;
  name: string;
  type: string;
}

// Parse time string (HH:MM) to hours and minutes
function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours: hours || 7, minutes: minutes || 30 };
}

// Get profiles that should receive reminders at the given time
function getProfilesForReminder(hour: number, minute: number): number[] {
  const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

  // Get profiles with reminders enabled at this time
  const prefs: ReminderPreference[] = db.prepare(`
    SELECT rp.profile_id FROM reminder_preferences rp
    JOIN profiles p ON p.id = rp.profile_id
    WHERE rp.reminder_enabled = 1
    AND rp.morning_reminder_time = ?
    AND p.type = 'child'
  `).all(timeStr) as ReminderPreference[];

  // Also include children without explicit preferences (use default 07:30)
  if (timeStr === '07:30') {
    const defaultProfiles: Profile[] = db.prepare(`
      SELECT p.id FROM profiles p
      LEFT JOIN reminder_preferences rp ON p.id = rp.profile_id
      WHERE p.type = 'child'
      AND (rp.id IS NULL OR (rp.reminder_enabled = 1 AND rp.morning_reminder_time IS NULL))
    `).all() as Profile[];

    const profileIds = new Set([...prefs.map(p => p.profile_id), ...defaultProfiles.map(p => p.id)]);
    return Array.from(profileIds);
  }

  return prefs.map(p => p.profile_id);
}

// Get pending tasks for a profile
function getPendingTasks(profileId: number): Task[] {
  const today = new Date().toISOString().split('T')[0];

  return db.prepare(`
    SELECT id, title, due_date, profile_id
    FROM tasks
    WHERE profile_id = ?
    AND completed = 0
    AND (due_date IS NULL OR due_date <= ?)
    ORDER BY due_date ASC
    LIMIT 5
  `).all(profileId, today) as Task[];
}

// Get overdue tasks for a profile
function getOverdueTasks(profileId: number): Task[] {
  const today = new Date().toISOString().split('T')[0];

  return db.prepare(`
    SELECT id, title, due_date, profile_id
    FROM tasks
    WHERE profile_id = ?
    AND completed = 0
    AND due_date < ?
    ORDER BY due_date ASC
    LIMIT 5
  `).all(profileId, today) as Task[];
}

// Send morning reminder to a profile
async function sendMorningReminder(profileId: number): Promise<void> {
  const profile: Profile | undefined = db.prepare(
    'SELECT id, name, type FROM profiles WHERE id = ?'
  ).get(profileId) as Profile | undefined;

  if (!profile) return;

  const pendingTasks = getPendingTasks(profileId);
  const overdueTasks = getOverdueTasks(profileId);

  if (pendingTasks.length === 0 && overdueTasks.length === 0) {
    // No tasks to remind about - send encouraging message
    await sendPushNotification(profileId, {
      type: 'reminder',
      title: 'Good Morning! ☀️',
      message: `Great job ${profile.name}! You have no pending tasks. Enjoy your day!`,
      icon: '🌟',
      url: '/child/dashboard'
    });
    return;
  }

  // Build reminder message
  let message = '';
  if (overdueTasks.length > 0) {
    message = `You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}! `;
  }

  if (pendingTasks.length > 0) {
    const taskNames = pendingTasks.slice(0, 3).map(t => t.title).join(', ');
    message += `Today's tasks: ${taskNames}`;
    if (pendingTasks.length > 3) {
      message += ` and ${pendingTasks.length - 3} more`;
    }
  }

  const title = overdueTasks.length > 0
    ? `Hey ${profile.name}! Don't forget! ⏰`
    : `Good Morning ${profile.name}! ☀️`;

  await sendPushNotification(profileId, {
    type: 'reminder',
    title,
    message,
    icon: overdueTasks.length > 0 ? '⏰' : '📋',
    url: '/tasks'
  });

  console.log(`[Scheduler] Sent morning reminder to ${profile.name} (${pendingTasks.length} tasks, ${overdueTasks.length} overdue)`);
}

// Process reminders for a specific time
async function processRemindersForTime(hour: number, minute: number): Promise<void> {
  const profileIds = getProfilesForReminder(hour, minute);

  console.log(`[Scheduler] Processing reminders for ${hour}:${minute.toString().padStart(2, '0')} - ${profileIds.length} profiles`);

  for (const profileId of profileIds) {
    try {
      await sendMorningReminder(profileId);
    } catch (error) {
      console.error(`[Scheduler] Error sending reminder to profile ${profileId}:`, error);
    }
  }
}

// Initialize the scheduler
export function initScheduler(): void {
  console.log('🕐 Initializing task reminder scheduler...');

  // Run every minute to check for reminders at specific times
  // This allows different profiles to have different reminder times
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    // Only process on the exact minute (not every minute polling)
    await processRemindersForTime(hour, minute);
  });

  // Evening reminder at 6 PM for incomplete tasks
  cron.schedule('0 18 * * *', async () => {
    console.log('[Scheduler] Running evening reminder check...');

    const children: Profile[] = db.prepare(
      "SELECT id, name FROM profiles WHERE type = 'child'"
    ).all() as Profile[];

    for (const child of children) {
      const pendingTasks = getPendingTasks(child.id);

      if (pendingTasks.length > 0) {
        await sendPushNotification(child.id, {
          type: 'reminder',
          title: `Almost bedtime ${child.name}! 🌙`,
          message: `You still have ${pendingTasks.length} task${pendingTasks.length > 1 ? 's' : ''} to complete today!`,
          icon: '🌙',
          url: '/tasks'
        });

        console.log(`[Scheduler] Sent evening reminder to ${child.name}`);
      }
    }
  });

  // Weekly summary on Sunday at 10 AM
  cron.schedule('0 10 * * 0', async () => {
    console.log('[Scheduler] Sending weekly summaries...');

    const children: Profile[] = db.prepare(
      "SELECT id, name FROM profiles WHERE type = 'child'"
    ).all() as Profile[];

    for (const child of children) {
      // Get this week's completed tasks
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);

      const stats: { count: number; points: number } | undefined = db.prepare(`
        SELECT
          COUNT(*) as count,
          COALESCE(SUM(points), 0) as points
        FROM tasks
        WHERE profile_id = ?
        AND completed = 1
        AND completed_at >= ?
      `).get(child.id, weekStart.toISOString()) as { count: number; points: number } | undefined;

      if (stats && stats.count > 0) {
        await sendPushNotification(child.id, {
          type: 'achievement',
          title: `Amazing week ${child.name}! 🎉`,
          message: `You completed ${stats.count} task${stats.count > 1 ? 's' : ''} and earned ${stats.points} points this week!`,
          icon: '🏆',
          url: '/journey'
        });

        // Also notify parent
        const parentResult = db.prepare('SELECT parent_id FROM profiles WHERE id = ?').get(child.id) as { parent_id: number } | undefined;
        if (parentResult?.parent_id) {
          await sendPushNotification(parentResult.parent_id, {
            type: 'achievement',
            title: `${child.name}'s Weekly Summary 📊`,
            message: `${child.name} completed ${stats.count} task${stats.count > 1 ? 's' : ''} and earned ${stats.points} points this week!`,
            icon: '📊',
            url: '/journey'
          });
        }
      }
    }
  });

  console.log('✅ Task reminder scheduler initialized');
  console.log('   - Morning reminders: Based on individual preferences (default 7:30 AM)');
  console.log('   - Evening reminders: 6:00 PM daily');
  console.log('   - Weekly summaries: Sunday 10:00 AM');
}

// API functions for managing reminder preferences
export function getReminderPreferences(profileId: number): ReminderPreference | null {
  const pref = db.prepare(
    'SELECT * FROM reminder_preferences WHERE profile_id = ?'
  ).get(profileId) as ReminderPreference | undefined;

  return pref || null;
}

export function setReminderPreferences(
  profileId: number,
  enabled: boolean,
  time?: string
): ReminderPreference {
  const existing = getReminderPreferences(profileId);

  if (existing) {
    db.prepare(`
      UPDATE reminder_preferences
      SET reminder_enabled = ?, morning_reminder_time = ?
      WHERE profile_id = ?
    `).run(enabled ? 1 : 0, time || existing.morning_reminder_time, profileId);
  } else {
    db.prepare(`
      INSERT INTO reminder_preferences (profile_id, reminder_enabled, morning_reminder_time)
      VALUES (?, ?, ?)
    `).run(profileId, enabled ? 1 : 0, time || '07:30');
  }

  return getReminderPreferences(profileId)!;
}

export default {
  initScheduler,
  getReminderPreferences,
  setReminderPreferences
};
