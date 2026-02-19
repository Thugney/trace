import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useProfile } from './ProfileContext';
import { notificationsAPI } from '../services/api';
import type { Notification } from '../types';

interface ToastNotification {
  id: number;
  title: string;
  body: string;
  icon?: string;
  type: string;
  timestamp: number;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  toasts: ToastNotification[];
  refreshNotifications: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissToast: (id: number) => void;
  isLoading: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const POLL_INTERVAL = 15000; // 15 seconds
const TOAST_DURATION = 6000; // 6 seconds

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { currentProfile } = useProfile();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const previousUnreadIdsRef = useRef<Set<number>>(new Set());
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialLoadRef = useRef(true);

  const fetchNotifications = useCallback(async () => {
    if (!currentProfile) return;

    try {
      const [notifResponse, countResponse] = await Promise.all([
        notificationsAPI.getAll(currentProfile.id),
        notificationsAPI.getUnreadCount(currentProfile.id)
      ]);

      const newNotifications = notifResponse.data;
      const newCount = countResponse.data.count;

      // Detect new notifications for toast display
      if (!initialLoadRef.current) {
        const currentUnreadIds = previousUnreadIdsRef.current;
        const newUnread = newNotifications.filter(
          n => !n.is_read && !currentUnreadIds.has(n.id)
        );

        // Show toast for genuinely new notifications
        for (const notif of newUnread) {
          showToast(notif);
        }
      }

      // Update the set of known unread IDs
      previousUnreadIdsRef.current = new Set(
        newNotifications.filter(n => !n.is_read).map(n => n.id)
      );

      initialLoadRef.current = false;
      setNotifications(newNotifications);
      setUnreadCount(newCount);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, [currentProfile]);

  const refreshNotifications = useCallback(async () => {
    setIsLoading(true);
    await fetchNotifications();
    setIsLoading(false);
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (id: number) => {
    try {
      await notificationsAPI.markAsRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!currentProfile) return;
    try {
      await notificationsAPI.markAllAsRead(currentProfile.id);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }, [currentProfile]);

  const showToast = useCallback((notification: Notification) => {
    const toast: ToastNotification = {
      id: notification.id,
      title: notification.title,
      body: notification.body,
      icon: notification.icon || undefined,
      type: notification.type,
      timestamp: Date.now()
    };
    setToasts(prev => [...prev, toast]);

    // Auto-dismiss after duration
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id));
    }, TOAST_DURATION);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Subscribe to Web Push notifications
  useEffect(() => {
    if (!currentProfile) return;

    const subscribeToPush = async () => {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

        const vapidResponse = await notificationsAPI.getVapidKey();
        const vapidKey = vapidResponse.data.key;
        if (!vapidKey) return;

        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          const convertedKey = urlBase64ToUint8Array(vapidKey);
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedKey
          });
        }

        await notificationsAPI.subscribePush(currentProfile.id, subscription.toJSON());
      } catch (err) {
        // Push not supported or denied - that's fine, in-app notifications still work
        console.log('Push notification setup skipped:', (err as Error).message);
      }
    };

    subscribeToPush();
  }, [currentProfile]);

  // Start polling
  useEffect(() => {
    if (!currentProfile) {
      setNotifications([]);
      setUnreadCount(0);
      previousUnreadIdsRef.current = new Set();
      initialLoadRef.current = true;
      return;
    }

    // Initial fetch
    fetchNotifications();

    // Set up polling interval
    pollIntervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [currentProfile, fetchNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        toasts,
        refreshNotifications,
        markAsRead,
        markAllAsRead,
        dismissToast,
        isLoading
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
