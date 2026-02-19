/**
 * Timer notification hook stub
 * Provides notification support for timer features
 */

interface TimerNotificationData {
  taskId: number;
  taskTitle: string;
  estimatedMinutes?: number;
  isRunning: boolean;
  isPaused: boolean;
  elapsedSeconds: number;
  formattedTime: string;
}

export function useTimerNotifications() {
  const isSupported = 'Notification' in window;
  const permission = isSupported ? Notification.permission : 'denied';

  const requestPermission = async () => {
    if (!isSupported) return 'denied';
    return await Notification.requestPermission();
  };

  const updateTimerNotification = (_data: TimerNotificationData) => {
    // Stub - notification functionality disabled
  };

  const cleanupNotifications = () => {
    // Stub - cleanup functionality
  };

  return {
    isSupported,
    permission,
    requestPermission,
    updateTimerNotification,
    cleanupNotifications,
  };
}
