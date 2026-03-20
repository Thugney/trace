import { useState, useEffect, useCallback } from 'react';
import { notificationsAPI } from '../services/api';
import { useProfile } from '../context/ProfileContext';

interface PushNotificationState {
  isSupported: boolean;
  isSubscribed: boolean;
  hasBrowserSubscription: boolean;
  permission: NotificationPermission;
  loading: boolean;
  error: string | null;
}

export function usePushNotifications() {
  const { currentProfile } = useProfile();
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isSubscribed: false,
    hasBrowserSubscription: false,
    permission: 'default',
    loading: true,
    error: null
  });

  const refreshSubscriptionState = useCallback(async () => {
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;

    if (!isSupported) {
      setState(prev => ({
        ...prev,
        isSupported: false,
        isSubscribed: false,
        hasBrowserSubscription: false,
        loading: false
      }));
      return;
    }

    try {
      const permission = Notification.permission;
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      let isSubscribed = false;

      if (subscription && currentProfile) {
        const { data } = await notificationsAPI.getSubscriptionStatus(subscription.endpoint);
        isSubscribed = data.isSubscribed;
      }

      setState(prev => ({
        ...prev,
        isSupported: true,
        isSubscribed,
        hasBrowserSubscription: !!subscription,
        permission,
        loading: false,
        error: null
      }));
    } catch (error) {
      console.error('[Push] Error checking support:', error);
      setState(prev => ({
        ...prev,
        isSupported,
        hasBrowserSubscription: false,
        loading: false,
        error: 'Failed to check notification status'
      }));
    }
  }, [currentProfile]);

  // Check if push notifications are supported
  useEffect(() => {
    refreshSubscriptionState();
  }, [refreshSubscriptionState]);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!state.isSupported) {
      setState(prev => ({ ...prev, error: 'Push notifications not supported' }));
      return false;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Request permission
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        setState(prev => ({
          ...prev,
          permission,
          loading: false,
          error: 'Notification permission denied'
        }));
        return false;
      }

      // Wait for the PWA service worker to be ready
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      // Get VAPID public key from server
      const { data: { publicKey } } = await notificationsAPI.getVapidPublicKey();

      // Convert VAPID key to Uint8Array
      const applicationServerKey = urlBase64ToArrayBuffer(publicKey);

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
      }

      // Send subscription to server
      const subscriptionJson = subscription.toJSON();
      await notificationsAPI.subscribe({
        endpoint: subscriptionJson.endpoint!,
        keys: {
          p256dh: subscriptionJson.keys!.p256dh,
          auth: subscriptionJson.keys!.auth
        }
      });

      await refreshSubscriptionState();

      console.log('[Push] Successfully subscribed');
      return true;
    } catch (error: any) {
      console.error('[Push] Subscribe error:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to subscribe to notifications'
      }));
      return false;
    }
  }, [state.isSupported]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const { data } = await notificationsAPI.unsubscribe(subscription.endpoint);

        // Only remove the browser subscription when no other profile on this device still uses it
        if (!data.endpointStillUsed) {
          await subscription.unsubscribe();
        }
      }

      await refreshSubscriptionState();

      console.log('[Push] Successfully unsubscribed');
      return true;
    } catch (error: any) {
      console.error('[Push] Unsubscribe error:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to unsubscribe'
      }));
      return false;
    }
  }, [refreshSubscriptionState]);

  // Send test notification
  const sendTest = useCallback(async () => {
    try {
      await notificationsAPI.sendTest();
      return true;
    } catch (error: any) {
      console.error('[Push] Test notification error:', error);
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to send test notification'
      }));
      return false;
    }
  }, []);

  return {
    ...state,
    refreshSubscriptionState,
    subscribe,
    unsubscribe,
    sendTest
  };
}

// Helper function to convert VAPID key
function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return buffer;
}
