import clsx from 'clsx';
import { Check } from 'lucide-react';
import type { CatalogOverviewGrade } from '../../types/learn';
import { learnCopy } from './learnCopy';

interface GradePickerProps {
  overview: CatalogOverviewGrade[];
  selected: number | null;
  suggested?: number | null;
  onSelect: (grade: number) => void;
  disabled?: boolean;
}

const copy = learnCopy('nb');

// Grades 1-10 as large touch targets; shows how many topics are ready (reviewed) per grade
export default function GradePicker({ overview, selected, suggested, onSelect, disabled }: GradePickerProps) {
  return (
    <div role="radiogroup" aria-label={copy.chooseGrade} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {overview.map((entry) => {
        const isSelected = selected === entry.grade;
        return (
          <button
            key={entry.grade}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onSelect(entry.grade)}
            className={clsx(
              'relative flex min-h-[72px] flex-col items-start justify-center rounded-2xl border px-3 py-2 text-left transition',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-60',
              isSelected
                ? 'border-primary-500 bg-primary-50 text-primary-900 dark:border-primary-400 dark:bg-primary-950/60 dark:text-primary-100'
                : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800'
            )}
          >
            <span className="text-lg font-bold">{copy.gradeLabel(entry.grade)}</span>
            <span className="text-xs text-slate-600 dark:text-slate-400">{copy.topicsReady(entry.topics_available, entry.topics_planned)}</span>
            {suggested === entry.grade && !isSelected && (
              <span className="absolute right-2 top-2 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
                {copy.suggested}
              </span>
            )}
            {isSelected && <Check className="absolute right-2 top-2 h-4 w-4" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
