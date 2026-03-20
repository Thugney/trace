import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import FunCard from './FunCard';
import { usePushNotifications } from '../../hooks/usePushNotifications';

interface ReminderWidgetProps {
  enabled: boolean;
  time: string;
  onToggle: () => void;
  onTimeChange: (time: string) => void;
  saving?: boolean;
  compact?: boolean;
}

// Pre-defined time slots for easier selection
const TIME_SLOTS = [
  { time: '06:00', label: '6 AM', icon: '🌅', period: 'Early Bird' },
  { time: '06:30', label: '6:30 AM', icon: '🌅', period: 'Early Bird' },
  { time: '07:00', label: '7 AM', icon: '☀️', period: 'Morning' },
  { time: '07:30', label: '7:30 AM', icon: '☀️', period: 'Morning' },
  { time: '08:00', label: '8 AM', icon: '☀️', period: 'Morning' },
  { time: '08:30', label: '8:30 AM', icon: '☀️', period: 'Morning' },
  { time: '09:00', label: '9 AM', icon: '🌤️', period: 'Late Morning' },
  { time: '16:00', label: '4 PM', icon: '🌇', period: 'Afternoon' },
  { time: '17:00', label: '5 PM', icon: '🌇', period: 'Afternoon' },
  { time: '18:00', label: '6 PM', icon: '🌆', period: 'Evening' },
  { time: '19:00', label: '7 PM', icon: '🌙', period: 'Evening' },
  { time: '20:00', label: '8 PM', icon: '🌙', period: 'Night' },
];

// Get icon for a time
function getTimeIcon(time: string): string {
  const hour = parseInt(time.split(':')[0], 10);
  if (hour >= 5 && hour < 7) return '🌅';
  if (hour >= 7 && hour < 12) return '☀️';
  if (hour >= 12 && hour < 17) return '🌤️';
  if (hour >= 17 && hour < 20) return '🌇';
  return '🌙';
}

// Format time for display
function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

export default function ReminderWidget({
  enabled,
  time,
  onToggle,
  onTimeChange,
  saving = false,
  compact = false,
}: ReminderWidgetProps) {
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [bellRinging, setBellRinging] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const {
    isSupported,
    isSubscribed,
    hasBrowserSubscription,
    permission,
    loading: pushLoading,
    subscribe
  } = usePushNotifications();

  const isDeviceReadyForPush = isSupported && permission === 'granted' && isSubscribed;

  // Bell animation when enabled
  useEffect(() => {
    if (enabled) {
      setBellRinging(true);
      const timer = setTimeout(() => setBellRinging(false), 500);
      return () => clearTimeout(timer);
    }
  }, [enabled]);

  const handleTimeSelect = (newTime: string) => {
    onTimeChange(newTime);
    setShowTimePicker(false);
  };

  const getPushStatusMessage = () => {
    if (!isSupported) {
      return 'This browser cannot receive push notifications.';
    }

    if (permission === 'denied') {
      return 'Notifications are blocked in your browser settings.';
    }

    if (hasBrowserSubscription && !isSubscribed) {
      return 'Push is already enabled on this device, but not for this profile yet.';
    }

    if (!isSubscribed) {
      return 'This device is not connected for push notifications yet.';
    }

    return 'This device is ready for real push notifications.';
  };

  const handleEnablePush = async () => {
    setPushError(null);
    const success = await subscribe();

    if (!success) {
      if (!isSupported) {
        setPushError('This browser cannot receive push notifications.');
        return false;
      }

      if (Notification.permission === 'denied' || permission === 'denied') {
        setPushError('Notifications are blocked. Allow them in your browser settings first.');
        return false;
      }

      setPushError('Push notifications could not be enabled on this device.');
      return false;
    }

    return true;
  };

  const handleToggleClick = async () => {
    if (saving || pushLoading) {
      return;
    }

    setPushError(null);

    if (!enabled && !isDeviceReadyForPush) {
      const pushEnabled = await handleEnablePush();
      if (!pushEnabled) {
        return;
      }
    }

    await onToggle();
  };

  // Compact version for dashboard
  if (compact) {
    return (
      <FunCard theme="ocean" size="sm" className="relative overflow-hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`text-3xl ${bellRinging ? 'animate-wiggle' : ''}`}>
              {enabled ? '🔔' : '🔕'}
            </div>
            <div>
              <p className="font-bold text-white text-sm">Daily Alerts</p>
              <p className="text-white/80 text-xs">
                {enabled
                  ? isDeviceReadyForPush
                    ? `${getTimeIcon(time)} ${formatTime(time)}`
                    : 'Push not ready on this device'
                  : 'Off'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              void handleToggleClick();
            }}
            disabled={saving || pushLoading}
            className={`
              w-12 h-6 rounded-full transition-all duration-300
              ${enabled ? 'bg-green-400' : 'bg-white/30'}
              ${(saving || pushLoading) ? 'opacity-50' : ''}
            `}
          >
            <span
              className={`
                block w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300
              ${enabled ? 'translate-x-6' : 'translate-x-0.5'}
            `}
            />
          </button>
        </div>
        {enabled && !isDeviceReadyForPush && (
          <p className="mt-2 text-[11px] text-white/80">
            Turn on push on this device to get the alert here.
          </p>
        )}
      </FunCard>
    );
  }

  // Full version
  return (
    <FunCard theme="ocean" className="relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-2 right-2 text-4xl opacity-20">⏰</div>
      <div className="absolute bottom-2 left-2 text-3xl opacity-20">🌟</div>

      {/* Header */}
      <div className="text-center mb-4">
        <div className={`text-5xl mb-2 ${bellRinging ? 'animate-wiggle' : 'animate-float'}`}>
          {enabled ? '🔔' : '🔕'}
        </div>
        <h3 className="text-xl font-bold text-white">Daily Push Notifications</h3>
        <p className="text-white/80 text-sm">
          {enabled ? 'Real task notifications, not just an in-app reminder.' : 'Turn on to schedule a real task notification'}
        </p>
      </div>

      <div className="bg-white/15 rounded-2xl p-4 mb-4 text-left">
        <p className="text-white font-semibold text-sm">This device</p>
        <p className="text-white/80 text-sm mt-1">
          {getPushStatusMessage()}
        </p>
        {!isDeviceReadyForPush && isSupported && permission !== 'denied' && (
          <button
            onClick={() => {
              void handleEnablePush();
            }}
            disabled={pushLoading}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-sky-700 transition-colors hover:bg-sky-50 disabled:opacity-60"
          >
            {pushLoading ? <Loader2 size={16} className="animate-spin" /> : <span>🔔</span>}
            Enable push on this device
          </button>
        )}
      </div>

      {pushError && (
        <div className="mb-4 rounded-xl bg-rose-100/95 px-4 py-3 text-sm text-rose-700">
          {pushError}
        </div>
      )}

      {/* Toggle Switch */}
      <div className="flex justify-center mb-4">
        <button
          onClick={() => {
            void handleToggleClick();
          }}
          disabled={saving || pushLoading}
          className={`
            relative w-20 h-10 rounded-full transition-all duration-300 shadow-inner
            ${enabled ? 'bg-green-400' : 'bg-white/30'}
            ${(saving || pushLoading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <span
            className={`
              absolute top-1 block w-8 h-8 rounded-full bg-white shadow-lg
              transition-all duration-300 flex items-center justify-center text-lg
              ${enabled ? 'left-11' : 'left-1'}
            `}
          >
            {enabled ? '✅' : '❌'}
          </span>
        </button>
      </div>

      {/* Time Selection (only show when enabled) */}
      {enabled && (
        <div className="mt-4">
          <p className="text-white/90 text-center text-sm mb-2">Send the notification at:</p>

          {/* Current Time Display */}
          <button
            onClick={() => setShowTimePicker(!showTimePicker)}
            className="w-full bg-white/20 hover:bg-white/30 rounded-xl p-3 transition-colors"
          >
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl">{getTimeIcon(time)}</span>
              <span className="text-2xl font-bold text-white">{formatTime(time)}</span>
              <span className="text-white/60">▼</span>
            </div>
          </button>

          {/* Time Picker Dropdown */}
          {showTimePicker && (
            <div className="mt-2 bg-white rounded-xl shadow-lg max-h-48 overflow-y-auto">
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot.time}
                  onClick={() => handleTimeSelect(slot.time)}
                  className={`
                    w-full px-4 py-2 flex items-center gap-3 hover:bg-blue-50 transition-colors
                    ${time === slot.time ? 'bg-blue-100' : ''}
                  `}
                >
                  <span className="text-xl">{slot.icon}</span>
                  <span className="font-medium text-slate-800">{slot.label}</span>
                  <span className="text-xs text-slate-500 ml-auto">{slot.period}</span>
                </button>
              ))}

              {/* Custom time input */}
              <div className="p-3 border-t bg-slate-50">
                <label className="text-xs text-slate-500 block mb-1">Custom time:</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => handleTimeSelect(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-800"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Encouraging message */}
      <p className="text-center text-white/70 text-xs mt-4">
        {enabled
          ? isDeviceReadyForPush
            ? "Nice. You'll get a real push notification at this time. 💪"
            : 'The schedule is on, but this device still needs push enabled to receive it. 🌟'
          : 'Turn this on when you want a real push notification for your tasks. 🌟'}
      </p>
    </FunCard>
  );
}
