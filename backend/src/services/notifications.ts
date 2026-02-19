import db from '../database/init';

export interface CreateNotificationParams {
  recipient_id: number;
  sender_id?: number;
  type: string;
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, any>;
}

/**
 * Create a notification and attempt to send push notification if subscribed.
 */
export function createNotification(params: CreateNotificationParams) {
  const { recipient_id, sender_id, type, title, body, icon, data } = params;

  const result = db.prepare(`
    INSERT INTO notifications (recipient_id, sender_id, type, title, body, icon, data)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    recipient_id,
    sender_id || null,
    type,
    title,
    body,
    icon || null,
    JSON.stringify(data || {})
  );

  const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(result.lastInsertRowid);

  // Try sending push notification
  sendPushToProfile(recipient_id, { title, body, icon, data: data || {} });

  return notification;
}

/**
 * Create notifications for all children of a parent.
 */
export function notifyChildren(parent_id: number, params: Omit<CreateNotificationParams, 'recipient_id'>) {
  const children: any[] = db.prepare(
    'SELECT id FROM profiles WHERE parent_id = ? AND type = ?'
  ).all(parent_id, 'child');

  return children.map(child =>
    createNotification({ ...params, recipient_id: child.id })
  );
}

/**
 * Notify the parent(s) of a given child.
 */
export function notifyParentOfChild(child_id: number, params: Omit<CreateNotificationParams, 'recipient_id'>) {
  const child: any = db.prepare('SELECT parent_id FROM profiles WHERE id = ?').get(child_id);
  if (!child?.parent_id) {
    // Fallback: notify all parents
    const parents: any[] = db.prepare("SELECT id FROM profiles WHERE type IN ('parent', 'admin')").all();
    return parents.map(p => createNotification({ ...params, recipient_id: p.id }));
  }
  return [createNotification({ ...params, recipient_id: child.parent_id })];
}

/**
 * Send push notification to all subscriptions for a profile.
 */
async function sendPushToProfile(profileId: number, payload: { title: string; body: string; icon?: string; data?: any }) {
  try {
    const webpush = await getWebPush();
    if (!webpush) return;

    const subscriptions: any[] = db.prepare(
      'SELECT * FROM push_subscriptions WHERE profile_id = ?'
    ).all(profileId);

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          JSON.stringify(payload)
        );
      } catch (err: any) {
        // Remove invalid/expired subscriptions
        if (err.statusCode === 404 || err.statusCode === 410) {
          db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
        }
        console.error(`Push failed for subscription ${sub.id}:`, err.message);
      }
    }
  } catch (err) {
    // web-push not available, skip silently
  }
}

let _webpush: any = null;

async function getWebPush() {
  if (_webpush) return _webpush;
  try {
    _webpush = await import('web-push');

    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@familyhub.local';

    if (vapidPublic && vapidPrivate) {
      _webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);
      return _webpush;
    }

    console.log('VAPID keys not configured. Push notifications disabled. Run: npx web-push generate-vapid-keys');
    _webpush = null;
    return null;
  } catch {
    return null;
  }
}
