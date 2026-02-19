import { X } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import clsx from 'clsx';

const TYPE_COLORS: Record<string, string> = {
  task_assigned: 'border-l-blue-500',
  task_completed: 'border-l-green-500',
  task_overdue: 'border-l-red-500',
  reward_created: 'border-l-purple-500',
  reward_claimed: 'border-l-yellow-500',
  message_received: 'border-l-indigo-500',
  goal_achieved: 'border-l-emerald-500',
  general: 'border-l-gray-500'
};

export default function NotificationToast() {
  const { toasts, dismissToast } = useNotifications();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(toast => (
        <div
          key={`${toast.id}-${toast.timestamp}`}
          className={clsx(
            'pointer-events-auto bg-white rounded-lg shadow-lg border border-gray-200 border-l-4 p-3',
            'animate-slide-in-right',
            TYPE_COLORS[toast.type] || TYPE_COLORS.general
          )}
        >
          <div className="flex items-start gap-2">
            <span className="text-lg flex-shrink-0">{toast.icon || '🔔'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
              <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{toast.body}</p>
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="flex-shrink-0 p-0.5 text-gray-300 hover:text-gray-500 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
