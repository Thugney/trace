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

function getLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const today = getLocalDateString();

  return db.prepare(`
    SELECT id, title, due_date, profile_id
    FROM tasks
    WHERE profile_id = ?
    AND completed = 0
    AND (due_date IS NULL OR date(due_date) <= date(?))
    ORDER BY due_date ASC
    LIMIT 5
  `).all(profileId, today) as Task[];
}

// Get overdue tasks for a profile
function getOverdueTasks(profileId: number): Task[] {
  const today = getLocalDateString();

  return db.prepare(`
    SELECT id, title, due_date, profile_id
    FROM tasks
    WHERE profile_id = ?
    AND completed = 0
    AND due_date IS NOT NULL
    AND date(due_date) < date(?)
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

// Get tasks scheduled for a specific time that haven't been reminded today
interface ScheduledTask {
  id: number;
  title: string;
  profile_id: number;
  scheduled_time: string;
  points: number;
  category: string;
}

function getTasksScheduledForTime(hour: number, minute: number): ScheduledTask[] {
  const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  const today = getLocalDateString();

  return db.prepare(`
    SELECT id, title, profile_id, scheduled_time, points, category
    FROM tasks
    WHERE scheduled_time = ?
    AND completed = 0
    AND parent_approved = 1
    AND (last_reminder_sent IS NULL OR last_reminder_sent < ?)
  `).all(timeStr, today) as ScheduledTask[];
}

// Send reminder for a specific scheduled task
async function sendTaskScheduledReminder(task: ScheduledTask): Promise<void> {
  const profile: Profile | undefined = db.prepare(
    'SELECT id, name, type FROM profiles WHERE id = ?'
  ).get(task.profile_id) as Profile | undefined;

  if (!profile) return;

  // Send push notification
  await sendPushNotification(task.profile_id, {
    type: 'reminder',
    title: `Time for: ${task.title}! ⏰`,
    message: `It's ${task.scheduled_time} - time to start your task! Earn ${task.points} points when you complete it.`,
    icon: '⏰',
    url: '/tasks',
    data: { taskId: task.id, playSound: true }
  });

  // Update last_reminder_sent to today
  const today = getLocalDateString();
  db.prepare('UPDATE tasks SET last_reminder_sent = ? WHERE id = ?').run(today, task.id);

  console.log(`[Scheduler] Sent task reminder to ${profile.name}: "${task.title}" at ${task.scheduled_time}`);
}

// Process task-specific scheduled reminders
async function processScheduledTaskReminders(hour: number, minute: number): Promise<void> {
  const tasks = getTasksScheduledForTime(hour, minute);

  if (tasks.length > 0) {
    console.log(`[Scheduler] Found ${tasks.length} task(s) scheduled for ${hour}:${minute.toString().padStart(2, '0')}`);
  }

  for (const task of tasks) {
    try {
      await sendTaskScheduledReminder(task);
    } catch (error) {
      console.error(`[Scheduler] Error sending task reminder for task ${task.id}:`, error);
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

    // Process profile-based morning reminders
    await processRemindersForTime(hour, minute);

    // Process task-specific scheduled reminders
    await processScheduledTaskReminders(hour, minute);
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
  console.log('   - Task-specific reminders: Based on each task\'s scheduled_time');
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
