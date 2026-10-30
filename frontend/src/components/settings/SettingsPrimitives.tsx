import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

export const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:cursor-not-allowed disabled:opacity-50';

export const secondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-50';

export type SettingsTone = 'indigo' | 'amber' | 'emerald' | 'rose' | 'sky';

const toneClasses: Record<SettingsTone, string> = {
  indigo: 'bg-primary-50 text-primary-600',
  amber: 'bg-amber-50 text-amber-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  rose: 'bg-rose-50 text-rose-600',
  sky: 'bg-sky-50 text-sky-600'
};

interface SettingsCardProps {
  children: ReactNode;
  className?: string;
}

export function SettingsCard({ children, className = '' }: SettingsCardProps) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

interface SettingsCardHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  tone?: SettingsTone;
  action?: ReactNode;
}

export function SettingsCardHeader({
  icon: Icon,
  title,
  description,
  tone = 'indigo',
  action
}: SettingsCardHeaderProps) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className={`flex-shrink-0 rounded-xl p-2.5 ${toneClasses[tone]}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

interface StatusBadgeProps {
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  children: ReactNode;
}

const badgeClasses: Record<StatusBadgeProps['tone'], string> = {
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-rose-50 text-rose-700',
  neutral: 'bg-slate-100 text-slate-600'
};

export function StatusBadge({ tone, children }: StatusBadgeProps) {
  return (
    <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClasses[tone]}`}>
      {children}
    </span>
  );
}

interface SettingsFieldProps {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  children: ReactNode;
}

export function SettingsField({ label, htmlFor, hint, children }: SettingsFieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
