import {
  BadgeCheck,
  Building2,
  ExternalLink,
  Globe,
  Info,
  Layers3,
  ShieldCheck
} from 'lucide-react';
import {
  APP_DESCRIPTION,
  APP_NAME,
  APP_OWNER,
  APP_VERSION,
  APP_WEBSITE
} from '../../version';
import { SettingsCard, StatusBadge, secondaryButtonClass } from './SettingsPrimitives';

const highlights = [
  {
    icon: Layers3,
    title: 'What It Does',
    description: 'Family Hub helps parents and children manage tasks, rewards, goals, habits, and learning in one place.'
  },
  {
    icon: ShieldCheck,
    title: 'How It Works',
    description: 'Parents set routines and approvals. Kids complete tasks, earn points, and request rewards or goals.'
  },
  {
    icon: Building2,
    title: 'Who Runs It',
    description: 'This app is built and operated by BetiLab, with public company and product information available on Eriteach.'
  }
];

const useCases = [
  {
    title: 'Daily routines',
    description: 'Tasks, checklists, and accountability for home routines.'
  },
  {
    title: 'Rewards and motivation',
    description: 'Points, rewards, approvals, and goal tracking with parent control.'
  },
  {
    title: 'Learning and habits',
    description: 'Books, quizzes, habits, and structured family learning activities.'
  },
  {
    title: 'Parent oversight',
    description: 'Approvals, controls, notifications, and family progress visibility.'
  }
];

const appFacts = [
  { label: 'App', value: APP_NAME },
  { label: 'Current version', value: APP_VERSION },
  { label: 'Owner', value: APP_OWNER },
  { label: 'Website', value: 'eriteach.com' }
];

export default function AboutSection() {
  return (
    <div className="space-y-6">
      <SettingsCard>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              <Info size={14} />
              About this app
            </span>
            <h3 className="mt-3 text-2xl font-bold text-slate-900">{APP_NAME}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {APP_DESCRIPTION}
            </p>
          </div>

          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
            <StatusBadge tone="neutral">Version {APP_VERSION}</StatusBadge>
            <StatusBadge tone="success">Owned by {APP_OWNER}</StatusBadge>
          </div>
        </div>

        <a
          href={APP_WEBSITE}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-6 w-full sm:w-auto ${secondaryButtonClass}`}
        >
          Visit eriteach.com
          <ExternalLink size={14} />
        </a>
      </SettingsCard>

      <div className="grid gap-4 md:grid-cols-3">
        {highlights.map((highlight) => {
          const Icon = highlight.icon;
          return (
            <SettingsCard key={highlight.title} className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 rounded-xl bg-sky-50 p-2.5 text-sky-600">
                  <Icon size={18} />
                </div>
                <h4 className="font-semibold text-slate-900">{highlight.title}</h4>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{highlight.description}</p>
            </SettingsCard>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <SettingsCard>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex-shrink-0 rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
              <BadgeCheck size={18} />
            </div>
            <h4 className="font-semibold text-slate-900">What Families Use It For</h4>
          </div>
          <ul className="divide-y divide-slate-100">
            {useCases.map((useCase) => (
              <li key={useCase.title} className="py-3 first:pt-0 last:pb-0">
                <p className="font-medium text-slate-900">{useCase.title}</p>
                <p className="mt-0.5 text-sm text-slate-600">{useCase.description}</p>
              </li>
            ))}
          </ul>
        </SettingsCard>

        <SettingsCard>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex-shrink-0 rounded-xl bg-amber-50 p-2.5 text-amber-600">
              <Globe size={18} />
            </div>
            <h4 className="font-semibold text-slate-900">App Information</h4>
          </div>
          <dl className="divide-y divide-slate-100">
            {appFacts.map((fact) => (
              <div key={fact.label} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <dt className="text-sm text-slate-500">{fact.label}</dt>
                <dd className="text-right text-sm font-medium text-slate-900">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </SettingsCard>
      </div>
    </div>
  );
}
