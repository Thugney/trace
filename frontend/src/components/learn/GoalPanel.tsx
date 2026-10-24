import clsx from 'clsx';
import { BadgeCheck, ExternalLink, Info } from 'lucide-react';
import type { LearnGoal, LearnLocale } from '../../types/learn';
import { learnCopy, learnSurface } from './learnCopy';

interface GoalPanelProps {
  goals: LearnGoal[];
  udirCode: string;
  locale: LearnLocale;
}

// Shows how a topic maps to LK20: goal level, paraphrase/verification status and Udir attribution
export default function GoalPanel({ goals, udirCode, locale }: GoalPanelProps) {
  const copy = learnCopy(locale);

  return (
    <section aria-labelledby="learn-goals" className={learnSurface.subtle}>
      <h2 id="learn-goals" className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        {copy.goalsHeading} · {udirCode}
      </h2>
      <ul className="mt-3 space-y-3">
        {goals.map((goal) => (
          <li key={goal.id} className="text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-800 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700">
                {copy.goalAfterGrade(goal.goal_after_grade)}
              </span>
              <span
                className={clsx(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                  goal.verification_status === 'verified'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                    : 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100'
                )}
              >
                {goal.verification_status === 'verified' && <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />}
                {goal.verification_status === 'verified' ? copy.verified : copy.unverified}
              </span>
              {goal.official_goal_ref && <span className="text-xs text-slate-500 dark:text-slate-400">{goal.official_goal_ref}</span>}
            </div>
            <p className="mt-1">{goal.description}</p>
            {goal.description_is_paraphrase && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{copy.paraphrase}</p>}
            {goal.is_local_sequence && (
              <p className="mt-1 flex gap-1 text-xs text-slate-600 dark:text-slate-300">
                <Info className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" /> {copy.localSequence}
              </p>
            )}
            <a
              href={goal.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary-700 underline-offset-2 hover:underline dark:text-primary-300"
            >
              {copy.udirSource}: {goal.source_locator} <ExternalLink className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">(åpnes i ny fane)</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
