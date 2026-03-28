import { useState, useEffect, useRef } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { notificationsAPI } from '../services/api';
import { playSounds } from '../utils/sounds';
import { formatTimeAgo } from '../utils/dates';
import type { Notification } from '../types';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const lastUnreadCountRef = useRef(0);

  const {
    isSupported,
    isSubscribed,
    permission,
    loading: pushLoading,
    subscribe,
    unsubscribe
  } = usePushNotifications();

  // Auto-prompt for notification permission if not set
  useEffect(() => {
    const hasSeenPrompt = localStorage.getItem('notification_prompt_shown');
    if (isSupported && permission === 'default' && !hasSeenPrompt && !pushLoading) {
      // Show the permission prompt after a short delay
      const timer = setTimeout(() => {
        setShowPermissionPrompt(true);
        localStorage.setItem('notification_prompt_shown', 'true');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isSupported, permission, pushLoading]);

  // Load notifications and unread count
  const loadNotifications = async () => {
    try {
      const { data } = await notificationsAPI.getNotifications(20);
      const newNotifications = data.notifications || [];
      const newUnreadCount = data.unreadCount || 0;

      // Play sound if there are new unread notifications
      if (newUnreadCount > lastUnreadCountRef.current && lastUnreadCountRef.current >= 0) {
        // Find the newest unread notification to determine which sound to play
        const newestUnread = newNotifications.find((n: Notification) => !n.is_read);
        if (newestUnread) {
          // Play appropriate sound based on notification type
          if (newestUnread.type === 'reminder') {
            playSounds.reminder();
          } else if (newestUnread.type === 'task_completed' || newestUnread.type === 'goal_achieved') {
            playSounds.taskComplete();
          } else if (newestUnread.type === 'achievement') {
            playSounds.achievement();
          } else {
            playSounds.notification();
          }
        }
      }

      lastUnreadCountRef.current = newUnreadCount;
      setNotifications(newNotifications);
      setUnreadCount(newUnreadCount);
    } catch (error) {
      console.error('[Notifications] Failed to load:', error);
    }
  };

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      try {
        await notificationsAPI.markAsRead(notification.id);
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('[Notifications] Failed to mark as read:', error);
      }
    }
    setIsOpen(false);
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('[Notifications] Failed to mark all read:', error);
    }
  };

  // Toggle push notifications
  const handleTogglePush = async () => {
    setLoading(true);
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
    setLoading(false);
  };

  // Handle permission prompt response
  const handleEnableNotifications = async () => {
    setShowPermissionPrompt(false);
    setLoading(true);
    await subscribe();
    setLoading(false);
  };

  const handleDismissPrompt = () => {
    setShowPermissionPrompt(false);
  };

  // Get notification icon/emoji based on type
  const getNotificationIcon = (type: string) => {
    const icons: Record<string, string> = {
      task_created: '📋',
      task_updated: '📝',
      task_approved: '✅',
      task_rejected: '❌',
      task_completed: '🎉',
      goal_created: '🎯',
      goal_approved: '🎯',
      goal_rejected: '❌',
      goal_achieved: '🏆',
      message_received: '💬',
      reminder: '⏰',
      achievement: '🌟',
      general: '🔔'
    };
    return icons[type] || '🔔';
  };

  return (
    <>
      {/* Permission Prompt Banner */}
      {showPermissionPrompt && (
        <div className="fixed top-16 left-0 right-0 z-50 mx-auto max-w-lg px-4">
          <div className="bg-indigo-600 text-white rounded-lg shadow-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BellRing className="w-6 h-6 animate-bounce" />
              <div>
                <p className="font-semibold">Enable Notifications?</p>
                <p className="text-sm text-indigo-200">Get alerts for tasks, goals, and messages</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleEnableNotifications}
                disabled={loading}
                className="px-4 py-2 bg-white text-indigo-600 rounded-lg font-medium hover:bg-indigo-50 transition-colors"
              >
                Enable
              </button>
              <button
                onClick={handleDismissPrompt}
                className="px-3 py-2 text-indigo-200 hover:text-white transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative" ref={dropdownRef}>
        {/* Bell Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <h3 className="font-semibold text-gray-800">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-indigo-600 hover:text-indigo-800"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Push Notification Toggle */}
          <div className="p-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isSubscribed ? (
                  <Bell className="w-4 h-4 text-green-600" />
                ) : (
                  <BellOff className="w-4 h-4 text-gray-400" />
                )}
                <span className="text-sm text-gray-700">
                  Push notifications
                </span>
              </div>
              {isSupported ? (
                <button
                  onClick={handleTogglePush}
                  disabled={pushLoading || loading}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    isSubscribed
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  } ${(pushLoading || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {pushLoading || loading ? '...' : isSubscribed ? 'On' : 'Off'}
                </button>
              ) : (
                <span className="text-xs text-gray-400">Not supported</span>
              )}
            </div>
            {permission === 'denied' && (
              <p className="text-xs text-red-500 mt-1">
                Notifications blocked. Enable in browser settings.
              </p>
            )}
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full p-3 text-left hover:bg-gray-50 transition-colors ${
                      !notification.is_read ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <span className="text-xl">
                        {getNotificationIcon(notification.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!notification.is_read ? 'font-semibold' : ''} text-gray-800`}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-600 truncate">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTimeAgo(notification.created_at)}
                        </p>
                      </div>
                      {!notification.is_read && (
                        <span className="w-2 h-2 bg-indigo-500 rounded-full mt-2" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </>
  );
}

export default NotificationBell;
