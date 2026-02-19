import { useState, useEffect } from 'react';
import FunCard from './FunCard';

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

  // Compact version for dashboard
  if (compact) {
    return (
      <FunCard theme="ocean" size="sm" className="relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`text-3xl ${bellRinging ? 'animate-wiggle' : ''}`}>
              {enabled ? '🔔' : '🔕'}
            </div>
            <div>
              <p className="font-bold text-white text-sm">Reminders</p>
              <p className="text-white/80 text-xs">
                {enabled ? `${getTimeIcon(time)} ${formatTime(time)}` : 'Off'}
              </p>
            </div>
          </div>
          <button
            onClick={onToggle}
            disabled={saving}
            className={`
              w-12 h-6 rounded-full transition-all duration-300
              ${enabled ? 'bg-green-400' : 'bg-white/30'}
              ${saving ? 'opacity-50' : ''}
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
        <h3 className="text-xl font-bold text-white">Daily Reminders</h3>
        <p className="text-white/80 text-sm">
          {enabled ? "I'll remind you about your tasks!" : 'Turn on to get reminders'}
        </p>
      </div>

      {/* Toggle Switch */}
      <div className="flex justify-center mb-4">
        <button
          onClick={onToggle}
          disabled={saving}
          className={`
            relative w-20 h-10 rounded-full transition-all duration-300 shadow-inner
            ${enabled ? 'bg-green-400' : 'bg-white/30'}
            ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
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
          <p className="text-white/90 text-center text-sm mb-2">Remind me at:</p>

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
          ? "Great! I'll help you remember your tasks! 💪"
          : 'Turn on reminders so you never forget! 🌟'}
      </p>
    </FunCard>
  );
}
