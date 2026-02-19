import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

const toastConfig: Record<ToastType, { icon: typeof CheckCircle; bgClass: string; iconClass: string }> = {
  success: {
    icon: CheckCircle,
    bgClass: 'bg-emerald-50 border-emerald-200',
    iconClass: 'text-emerald-500'
  },
  error: {
    icon: XCircle,
    bgClass: 'bg-red-50 border-red-200',
    iconClass: 'text-red-500'
  },
  warning: {
    icon: AlertTriangle,
    bgClass: 'bg-amber-50 border-amber-200',
    iconClass: 'text-amber-500'
  },
  info: {
    icon: Info,
    bgClass: 'bg-sky-50 border-sky-200',
    iconClass: 'text-sky-500'
  }
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [isExiting, setIsExiting] = useState(false);
  const config = toastConfig[toast.type];
  const Icon = config.icon;

  const handleRemove = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 200);
  }, [toast.id, onRemove]);

  // Auto-remove after duration
  useState(() => {
    const timer = setTimeout(handleRemove, toast.duration || 4000);
    return () => clearTimeout(timer);
  });

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg
        ${config.bgClass}
        ${isExiting ? 'animate-toast-exit' : 'animate-toast-enter'}
      `}
    >
      <Icon size={20} className={config.iconClass} />
      <p className="flex-1 text-sm font-medium text-slate-700">{toast.message}</p>
      <button
        onClick={handleRemove}
        className="p-1 rounded-lg hover:bg-white/50 transition-colors"
      >
        <X size={16} className="text-slate-400" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const success = useCallback((message: string) => showToast(message, 'success'), [showToast]);
  const error = useCallback((message: string) => showToast(message, 'error', 6000), [showToast]);
  const warning = useCallback((message: string) => showToast(message, 'warning'), [showToast]);
  const info = useCallback((message: string) => showToast(message, 'info'), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}

      {/* Toast container - fixed position */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export default ToastProvider;
