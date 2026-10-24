import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, BadgeCheck, ExternalLink } from 'lucide-react';
import { learnAPI } from '../../services/api';
import type { ReviewQueue, ReviewStatus } from '../../types/learn';
import { learnCopy, learnSurface } from '../../components/learn/learnCopy';

const copy = learnCopy('nb');

const statusClass: Record<ReviewStatus, string> = {
  draft: 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100',
  reviewed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
  retired: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
};

// Admin-only: approve AI-assisted drafts before learners can see them, and verify goal mappings
export default function LearnReview() {
  const [queue, setQueue] = useState<ReviewQueue | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setQueue((await learnAPI.getReviewQueue()).data);
    } catch (err: any) {
      setError(err?.response?.data?.error || copy.error);
    }
  };

  useEffect(() => { load(); }, []);

  const act = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || copy.error);
    }
  };

  const statusButtons = (status: ReviewStatus, onChange: (next: ReviewStatus) => void) => (
    <div className="flex flex-wrap gap-2">
      {status !== 'reviewed' && <button type="button" onClick={() => onChange('reviewed')} className={learnSurface.primaryButton}>{copy.approve}</button>}
      {status !== 'draft' && <button type="button" onClick={() => onChange('draft')} className={learnSurface.secondaryButton}>{copy.backToDraft}</button>}
      {status !== 'retired' && <button type="button" onClick={() => onChange('retired')} className={learnSurface.secondaryButton}>{copy.retire}</button>}
    </div>
  );

  return (
    <div className={learnSurface.page}>
      <Link to="/learn" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {copy.backToLearn}
      </Link>
      <h1 className="mb-1 text-2xl font-bold">{copy.reviewQueue}</h1>
      <p className={clsx('mb-6 max-w-3xl text-sm', learnSurface.muted)}>
        Les hver leksjon og øvingsprøve, kontroller fakta, oppgavesvar og kobling til kompetansemål mot udir.no før du godkjenner.
        Godkjenning registreres med ditt navn og tidspunkt.
      </p>
      {error && <p role="alert" className="mb-4 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {!queue && !error && <p className={learnSurface.muted} role="status">{copy.loading}</p>}

      {queue && (
        <div className="grid gap-6 xl:grid-cols-3">
          <section aria-labelledby="review-lessons" className="space-y-3">
            <h2 id="review-lessons" className="text-lg font-semibold">Leksjoner</h2>
            {queue.lessons.map((lesson) => (
              <article key={lesson.id} className={learnSurface.card}>
                <p className="text-xs text-slate-500 dark:text-slate-400">{lesson.subject_title} · v{lesson.version} · {lesson.locale}</p>
                <h3 className="font-semibold">
                  <Link to={`/learn/lessons/${lesson.id}`} className="hover:underline">{lesson.title}</Link>
                </h3>
                <span className={clsx('mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold', statusClass[lesson.review_status])}>{lesson.review_status}</span>
                <div className="mt-3">{statusButtons(lesson.review_status, (next) => act(() => learnAPI.reviewLesson(lesson.id, next)))}</div>
              </article>
            ))}
          </section>

          <section aria-labelledby="review-exams" className="space-y-3">
            <h2 id="review-exams" className="text-lg font-semibold">Øvingsprøver</h2>
            {queue.mock_exams.map((exam) => (
              <article key={exam.id} className={learnSurface.card}>
                <p className="text-xs text-slate-500 dark:text-slate-400">{exam.subject_title} · v{exam.version}</p>
                <h3 className="font-semibold">{exam.title}</h3>
                <span className={clsx('mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold', statusClass[exam.review_status])}>{exam.review_status}</span>
                <div className="mt-3">{statusButtons(exam.review_status, (next) => act(() => learnAPI.reviewMockExam(exam.id, next)))}</div>
              </article>
            ))}
          </section>

          <section aria-labelledby="review-goals" className="space-y-3">
            <h2 id="review-goals" className="text-lg font-semibold">Kompetansemål</h2>
            {queue.goals.map((goal) => (
              <article key={goal.id} className={learnSurface.card}>
                <p className="text-xs text-slate-500 dark:text-slate-400">{goal.subject_title} · {goal.udir_code} · etter {goal.goal_after_grade}. trinn</p>
                <p className="mt-1 text-sm">{goal.description}</p>
                <a href={goal.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline dark:text-primary-300">
                  {goal.source_locator} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
                <div className="mt-3">
                  {goal.verification_status === 'verified' ? (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      <BadgeCheck className="h-4 w-4" aria-hidden="true" /> {copy.verified}
                    </span>
                  ) : (
                    <button type="button" onClick={() => act(() => learnAPI.verifyGoal(goal.id, {}))} className={learnSurface.secondaryButton}>
                      {copy.verifyGoal}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
