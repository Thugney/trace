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

const appFacts = [
  { label: 'App', value: APP_NAME },
  { label: 'Current Version', value: APP_VERSION },
  { label: 'Owner', value: APP_OWNER },
  { label: 'Website', value: 'eriteach.com' }
];

export default function AboutSection() {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.28),_transparent_55%)]" />
        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-white/80">
            <Info size={14} />
            About This App
          </div>

          <h3 className="mt-4 text-3xl font-bold text-white">{APP_NAME}</h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
            {APP_DESCRIPTION}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white/85">
              Version {APP_VERSION}
            </span>
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-sm font-medium text-emerald-300">
              Owned by {APP_OWNER}
            </span>
            <a
              href={APP_WEBSITE}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Visit eriteach.com
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {highlights.map((highlight) => {
          const Icon = highlight.icon;
          return (
            <div
              key={highlight.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-sky-50 p-3 text-sky-700">
                  <Icon size={20} />
                </div>
                <h4 className="font-semibold text-slate-900">{highlight.title}</h4>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">{highlight.description}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
              <BadgeCheck size={20} />
            </div>
            <h4 className="font-semibold text-slate-900">What Families Use It For</h4>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-medium text-slate-900">Daily routines</p>
              <p className="mt-1 text-sm text-slate-600">Tasks, checklists, and accountability for home routines.</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-medium text-slate-900">Rewards and motivation</p>
              <p className="mt-1 text-sm text-slate-600">Points, rewards, approvals, and goal tracking with parent control.</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-medium text-slate-900">Learning and habits</p>
              <p className="mt-1 text-sm text-slate-600">Books, quizzes, habits, and structured family learning activities.</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="font-medium text-slate-900">Parent oversight</p>
              <p className="mt-1 text-sm text-slate-600">Approvals, controls, notifications, and family progress visibility.</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-50 p-3 text-amber-700">
              <Globe size={20} />
            </div>
            <h4 className="font-semibold text-slate-900">App Information</h4>
          </div>
          <dl className="mt-5 space-y-3">
            {appFacts.map((fact) => (
              <div
                key={fact.label}
                className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3"
              >
                <dt className="text-sm text-slate-500">{fact.label}</dt>
                <dd className="text-sm font-medium text-slate-900">{fact.value}</dd>
              </div>
            ))}
          </dl>
          <a
            href={APP_WEBSITE}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-800"
          >
            Open public website
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
