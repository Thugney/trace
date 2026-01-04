import { useState, useEffect, useCallback } from 'react';
import { notificationsAPI } from '../services/api';

interface PushNotificationState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission;
  loading: boolean;
  error: string | null;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isSubscribed: false,
    permission: 'default',
    loading: true,
    error: null
  });

  // Check if push notifications are supported
  useEffect(() => {
    const checkSupport = async () => {
      const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;

      if (!isSupported) {
        setState(prev => ({ ...prev, isSupported: false, loading: false }));
        return;
      }

      try {
        const permission = Notification.permission;

        // Check if already subscribed
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        setState(prev => ({
          ...prev,
          isSupported: true,
          isSubscribed: !!subscription,
          permission,
          loading: false
        }));
      } catch (error) {
        console.error('[Push] Error checking support:', error);
        setState(prev => ({
          ...prev,
          isSupported,
          loading: false,
          error: 'Failed to check notification status'
        }));
      }
    };

    checkSupport();
  }, []);

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

      // Get VAPID public key from server
      const { data: { publicKey } } = await notificationsAPI.getVapidPublicKey();

      // Convert VAPID key to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer
      });

      // Send subscription to server
      const subscriptionJson = subscription.toJSON();
      await notificationsAPI.subscribe({
        endpoint: subscriptionJson.endpoint!,
        keys: {
          p256dh: subscriptionJson.keys!.p256dh,
          auth: subscriptionJson.keys!.auth
        }
      });

      setState(prev => ({
        ...prev,
        isSubscribed: true,
        permission: 'granted',
        loading: false
      }));

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
        // Unsubscribe from browser
        await subscription.unsubscribe();

        // Remove from server
        await notificationsAPI.unsubscribe(subscription.endpoint);
      }

      setState(prev => ({
        ...prev,
        isSubscribed: false,
        loading: false
      }));

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
  }, []);

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
    subscribe,
    unsubscribe,
    sendTest
  };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
