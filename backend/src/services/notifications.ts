import webpush from 'web-push';
import db from '../database/init';

// VAPID keys for web push (must be provided via environment variables)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@familylearninghub.com';

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.warn('[Push] Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY. Push notifications disabled.');
}

// Configure web-push
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export interface NotificationPayload {
  title: string;
  message: string;
  type: 'task_created' | 'task_updated' | 'task_approved' | 'task_rejected' | 'task_completed' |
        'goal_created' | 'goal_approved' | 'goal_rejected' | 'goal_achieved' |
        'message_received' | 'reminder' | 'achievement' | 'quiz' | 'general' |
        'school_assignment' | 'school_feedback' | 'school_due_soon' | 'school_submission' | 'school_graded' |
        'new_book' | 'book_completed' | 'new_quiz' | 'quiz_assigned' | 'quiz_completed' |
        'new_task' | 'task_assigned' | 'child_completed' | 'level_up' | 'reward' |
        'points_deducted' | 'points_added';
  data?: any;
  icon?: string;
  url?: string;
}

// Get VAPID public key for frontend
export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

// Subscribe a user to push notifications
export function subscribeToPush(profileId: number, subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): boolean {
  try {
    // Check if this profile already subscribed with this endpoint
    const existing = db.prepare(
      'SELECT id FROM push_subscriptions WHERE profile_id = ? AND endpoint = ?'
    ).get(profileId, subscription.endpoint);

    if (existing) {
      // Refresh keys for this profile/device pairing
      db.prepare(`
        UPDATE push_subscriptions
        SET p256dh = ?, auth = ?
        WHERE profile_id = ? AND endpoint = ?
      `).run(subscription.keys.p256dh, subscription.keys.auth, profileId, subscription.endpoint);
    } else {
      // Create a profile-specific subscription row so shared devices can notify multiple kids
      db.prepare(`
        INSERT INTO push_subscriptions (profile_id, endpoint, p256dh, auth)
        VALUES (?, ?, ?, ?)
      `).run(profileId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth);
    }

    console.log(`[Push] Subscription saved for profile ${profileId}`);
    return true;
  } catch (error) {
    console.error('[Push] Error saving subscription:', error);
    return false;
  }
}

export function isProfileSubscribedToEndpoint(profileId: number, endpoint: string): boolean {
  const existing = db.prepare(
    'SELECT 1 FROM push_subscriptions WHERE profile_id = ? AND endpoint = ?'
  ).get(profileId, endpoint);

  return !!existing;
}

// Unsubscribe from push notifications
export function unsubscribeFromPush(profileId: number, endpoint: string): { success: boolean; endpointStillUsed: boolean } {
  try {
    db.prepare('DELETE FROM push_subscriptions WHERE profile_id = ? AND endpoint = ?').run(profileId, endpoint);

    const remaining: any = db.prepare(
      'SELECT COUNT(*) as count FROM push_subscriptions WHERE endpoint = ?'
    ).get(endpoint);

    console.log(`[Push] Subscription removed for profile ${profileId}`);
    return {
      success: true,
      endpointStillUsed: (remaining?.count || 0) > 0
    };
  } catch (error) {
    console.error('[Push] Error removing subscription:', error);
    return { success: false, endpointStillUsed: true };
  }
}

// Send push notification to a specific profile
export async function sendPushNotification(
  profileId: number,
  payload: NotificationPayload
): Promise<{ success: boolean; sent: number; failed: number }> {
  try {
    // ALWAYS save notification to database for in-app display (regardless of push subscription)
    db.prepare(`
      INSERT INTO notifications (profile_id, type, title, message, data)
      VALUES (?, ?, ?, ?, ?)
    `).run(profileId, payload.type, payload.title, payload.message, JSON.stringify(payload.data || {}));

    // Get all subscriptions for this profile
    const subscriptions: any[] = db.prepare(
      'SELECT * FROM push_subscriptions WHERE profile_id = ?'
    ).all(profileId);

    if (subscriptions.length === 0) {
      console.log(`[Push] No subscriptions for profile ${profileId}, but in-app notification saved`);
      return { success: true, sent: 0, failed: 0 };
    }

    // Prepare push payload
    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.message,
      icon: payload.icon || '/icon-192x192.png',
      badge: '/icon-72x72.png',
      data: {
        type: payload.type,
        url: payload.url || '/',
        ...payload.data
      }
    });

    let sent = 0;
    let failed = 0;

    // Send to all subscriptions
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          pushPayload
        );
        sent++;
        console.log(`[Push] Notification sent to subscription ${sub.id}`);
      } catch (error: any) {
        failed++;
        console.error(`[Push] Failed to send to subscription ${sub.id}:`, error.message);

        // Remove invalid subscriptions (410 Gone or 404 Not Found)
        if (error.statusCode === 410 || error.statusCode === 404) {
          db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
          console.log(`[Push] Removed invalid subscription endpoint for all linked profiles: ${sub.endpoint}`);
        }
      }
    }

    return { success: true, sent, failed };
  } catch (error) {
    console.error('[Push] Error sending notification:', error);
    return { success: false, sent: 0, failed: 0 };
  }
}

// Send notification to multiple profiles
export async function sendPushToProfiles(
  profileIds: number[],
  payload: NotificationPayload
): Promise<{ success: boolean; totalSent: number; totalFailed: number }> {
  let totalSent = 0;
  let totalFailed = 0;

  for (const profileId of profileIds) {
    const result = await sendPushNotification(profileId, payload);
    totalSent += result.sent;
    totalFailed += result.failed;
  }

  return { success: true, totalSent, totalFailed };
}

// Send notification to parent(s) of a child
export async function notifyParent(
  childId: number,
  payload: NotificationPayload
): Promise<void> {
  const child: any = db.prepare('SELECT parent_id FROM profiles WHERE id = ?').get(childId);

  if (child?.parent_id) {
    await sendPushNotification(child.parent_id, payload);
  }
}

// Get notifications for a profile (in-app)
export function getNotifications(profileId: number, limit = 50, unreadOnly = false): any[] {
  let query = 'SELECT * FROM notifications WHERE profile_id = ?';

  if (unreadOnly) {
    query += ' AND is_read = 0';
  }

  query += ' ORDER BY created_at DESC LIMIT ?';

  return db.prepare(query).all(profileId, limit);
}

// Get unread notification count
export function getUnreadCount(profileId: number): number {
  const result: any = db.prepare(
    'SELECT COUNT(*) as count FROM notifications WHERE profile_id = ? AND is_read = 0'
  ).get(profileId);

  return result?.count || 0;
}

// Mark notification as read
export function markAsRead(notificationId: number): boolean {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(notificationId);
    return true;
  } catch (error) {
    console.error('[Push] Error marking notification as read:', error);
    return false;
  }
}

// Mark all notifications as read for a profile
export function markAllAsRead(profileId: number): boolean {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE profile_id = ?').run(profileId);
    return true;
  } catch (error) {
    console.error('[Push] Error marking all as read:', error);
    return false;
  }
}

// Helper functions for common notification scenarios
export const NotificationHelpers = {
  // Child created a task - notify parent
  async taskCreatedByChild(childId: number, childName: string, taskTitle: string) {
    await notifyParent(childId, {
      type: 'task_created',
      title: 'New Task Request',
      message: `${childName} wants to add a new task: "${taskTitle}"`,
      icon: '📋',
      url: '/tasks'
    });
  },

  // Parent or admin updated a child's task
  async taskUpdated(childId: number, taskTitle: string, updaterName: string) {
    await sendPushNotification(childId, {
      type: 'task_updated',
      title: 'Task Updated',
      message: `${updaterName} updated "${taskTitle}". Check the latest details before you start.`,
      icon: '📝',
      url: '/tasks',
      data: {
        taskTitle,
        updaterName
      }
    });
  },

  // Parent approved a task - notify child
  async taskApproved(childId: number, taskTitle: string) {
    await sendPushNotification(childId, {
      type: 'task_approved',
      title: 'Task Approved! ✅',
      message: `Your task "${taskTitle}" has been approved. You can start working on it!`,
      icon: '✅',
      url: '/tasks'
    });
  },

  // Parent rejected a task - notify child
  async taskRejected(childId: number, taskTitle: string) {
    await sendPushNotification(childId, {
      type: 'task_rejected',
      title: 'Task Not Approved',
      message: `Your task "${taskTitle}" was not approved. Ask your parent why!`,
      icon: '❌',
      url: '/tasks'
    });
  },

  // Child completed a task - notify parent
  async taskCompleted(childId: number, childName: string, taskTitle: string, points: number) {
    await notifyParent(childId, {
      type: 'task_completed',
      title: 'Task Completed! 🎉',
      message: `${childName} completed "${taskTitle}" and earned ${points} points!`,
      icon: '🎉',
      url: '/journey'
    });
  },

  // Parent-triggered reminder for a specific task
  async taskReminder(childId: number, taskTitle: string, isOverdue: boolean, daysOverdue = 0) {
    const overdueText = daysOverdue === 1 ? '1 day' : `${daysOverdue} days`;

    await sendPushNotification(childId, {
      type: 'reminder',
      title: isOverdue ? 'Past Due Task ⏰' : 'Task Reminder ⏰',
      message: isOverdue
        ? `"${taskTitle}" is ${overdueText} past due. Do it now for half points.`
        : `Don't forget "${taskTitle}" today.`,
      icon: '⏰',
      url: '/tasks',
      data: {
        taskTitle,
        isOverdue,
        daysOverdue
      }
    });
  },

  // Child created a goal - notify parent
  async goalCreatedByChild(childId: number, childName: string, goalDescription: string) {
    await notifyParent(childId, {
      type: 'goal_created',
      title: 'New Goal Request',
      message: `${childName} wants to set a goal: "${goalDescription}"`,
      icon: '🎯',
      url: '/tasks'
    });
  },

  // Parent approved a goal - notify child
  async goalApproved(childId: number, goalDescription: string) {
    await sendPushNotification(childId, {
      type: 'goal_approved',
      title: 'Goal Approved! 🎯',
      message: `Your goal "${goalDescription}" has been approved. Start working towards it!`,
      icon: '🎯',
      url: '/tasks'
    });
  },

  // Goal achieved - notify child and parent
  async goalAchieved(childId: number, childName: string, goalDescription: string) {
    // Notify child
    await sendPushNotification(childId, {
      type: 'goal_achieved',
      title: 'Goal Achieved! 🏆',
      message: `Congratulations! You achieved your goal: "${goalDescription}"!`,
      icon: '🏆',
      url: '/journey'
    });

    // Notify parent
    await notifyParent(childId, {
      type: 'goal_achieved',
      title: 'Goal Achieved! 🏆',
      message: `${childName} achieved their goal: "${goalDescription}"!`,
      icon: '🏆',
      url: '/journey'
    });
  },

  // New message received
  async messageReceived(recipientId: number, senderName: string, subject: string) {
    await sendPushNotification(recipientId, {
      type: 'message_received',
      title: 'New Message 💬',
      message: `${senderName}: ${subject || 'New message'}`,
      icon: '💬',
      url: '/messages'
    });
  },

  // New book assigned to child
  async newBookAssigned(childId: number, bookTitle: string, assignedBy: string) {
    await sendPushNotification(childId, {
      type: 'new_book',
      title: 'New Book Ready! 📚',
      message: `${assignedBy} created a new book for you: "${bookTitle}"`,
      icon: '📚',
      url: '/books'
    });
  },

  // Book reading completed - notify parent
  async bookCompleted(childId: number, childName: string, bookTitle: string) {
    await notifyParent(childId, {
      type: 'book_completed',
      title: 'Book Finished! 📖',
      message: `${childName} finished reading "${bookTitle}"!`,
      icon: '📖',
      url: '/books'
    });
  },

  // New quiz assigned to child
  async newQuizAssigned(childId: number, quizTitle: string, assignedBy: string) {
    await sendPushNotification(childId, {
      type: 'new_quiz',
      title: 'New Quiz Ready! 🎯',
      message: `${assignedBy} created a new quiz for you: "${quizTitle}"`,
      icon: '🎯',
      url: '/quizzes'
    });
  },

  // Quiz completed - notify parent
  async quizCompleted(childId: number, childName: string, quizTitle: string, score: number, totalQuestions: number) {
    await notifyParent(childId, {
      type: 'quiz_completed',
      title: 'Quiz Completed! ✨',
      message: `${childName} scored ${score}/${totalQuestions} on "${quizTitle}"!`,
      icon: '✨',
      url: '/quizzes'
    });
  },

  // Level up notification
  async levelUp(profileId: number, newLevel: number) {
    await sendPushNotification(profileId, {
      type: 'level_up',
      title: 'Level Up! 🎉',
      message: `Congratulations! You reached Level ${newLevel}!`,
      icon: '🎉',
      url: '/journey'
    });
  },

  // Achievement unlocked
  async achievementUnlocked(profileId: number, achievementTitle: string) {
    await sendPushNotification(profileId, {
      type: 'achievement',
      title: 'Achievement Unlocked! 🏆',
      message: `You earned: "${achievementTitle}"!`,
      icon: '🏆',
      url: '/journey'
    });
  },

  // Reminder notification
  async sendReminder(profileId: number, reminderText: string) {
    await sendPushNotification(profileId, {
      type: 'reminder',
      title: 'Reminder ⏰',
      message: reminderText,
      icon: '⏰',
      url: '/'
    });
  },

  // Points deducted by parent - notify child with reason
  async pointsDeducted(childId: number, amount: number, reason: string, parentName: string, relatedTaskTitle?: string) {
    const taskInfo = relatedTaskTitle ? ` (Task: "${relatedTaskTitle}")` : '';
    await sendPushNotification(childId, {
      type: 'points_deducted',
      title: 'Points Deducted',
      message: `${parentName} deducted ${amount} points. Reason: ${reason}${taskInfo}`,
      icon: '📉',
      url: '/journey',
      data: {
        amount,
        reason,
        parentName,
        relatedTaskTitle
      }
    });
  },

  // Points added by parent - notify child with reason
  async pointsAdded(childId: number, amount: number, reason: string, parentName: string) {
    await sendPushNotification(childId, {
      type: 'points_added',
      title: 'Bonus Points!',
      message: `${parentName} added ${amount} points! Reason: ${reason}`,
      icon: '📈',
      url: '/journey',
      data: {
        amount,
        reason,
        parentName
      }
    });
  }
};

export default {
  getVapidPublicKey,
  subscribeToPush,
  isProfileSubscribedToEndpoint,
  unsubscribeFromPush,
  sendPushNotification,
  sendPushToProfiles,
  notifyParent,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  NotificationHelpers
};
