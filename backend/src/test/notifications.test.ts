import { describe, expect, it } from 'vitest';
import {
  subscribeToPush,
  isProfileSubscribedToEndpoint,
  unsubscribeFromPush
} from '../services/notifications';
import { testDb } from './setup';

describe('push subscriptions', () => {
  it('keeps the same endpoint linked to multiple profiles on a shared device', () => {
    testDb.prepare(`
      INSERT INTO profiles (id, name, type)
      VALUES (1, 'Parent', 'parent'), (2, 'Kid One', 'child'), (3, 'Kid Two', 'child')
    `).run();

    const sharedSubscription = {
      endpoint: 'https://push.example.test/shared-device',
      keys: {
        p256dh: 'p256dh-key',
        auth: 'auth-key'
      }
    };

    expect(subscribeToPush(2, sharedSubscription)).toBe(true);
    expect(subscribeToPush(3, sharedSubscription)).toBe(true);

    const rows = testDb.prepare(`
      SELECT profile_id, endpoint
      FROM push_subscriptions
      WHERE endpoint = ?
      ORDER BY profile_id
    `).all(sharedSubscription.endpoint) as Array<{ profile_id: number; endpoint: string }>;

    expect(rows).toEqual([
      { profile_id: 2, endpoint: sharedSubscription.endpoint },
      { profile_id: 3, endpoint: sharedSubscription.endpoint }
    ]);
  });

  it('removes only the current profile mapping when unsubscribing from a shared device', () => {
    testDb.prepare(`
      INSERT INTO profiles (id, name, type)
      VALUES (1, 'Parent', 'parent'), (2, 'Kid One', 'child'), (3, 'Kid Two', 'child')
    `).run();

    const sharedSubscription = {
      endpoint: 'https://push.example.test/shared-device',
      keys: {
        p256dh: 'p256dh-key',
        auth: 'auth-key'
      }
    };

    subscribeToPush(2, sharedSubscription);
    subscribeToPush(3, sharedSubscription);

    const result = unsubscribeFromPush(2, sharedSubscription.endpoint);

    expect(result).toEqual({
      success: true,
      endpointStillUsed: true
    });
    expect(isProfileSubscribedToEndpoint(2, sharedSubscription.endpoint)).toBe(false);
    expect(isProfileSubscribedToEndpoint(3, sharedSubscription.endpoint)).toBe(true);
  });
});
