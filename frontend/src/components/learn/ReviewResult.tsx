import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { CheckCircle2, HelpCircle, MessageSquareText, XCircle } from 'lucide-react';
import type { LearnLocale, ReviewAttemptResult, ReviewPaperItem } from '../../types/learn';
import { learnCopy, learnSurface } from './learnCopy';

interface ReviewResultProps {
  result: ReviewAttemptResult;
  locale: LearnLocale;
  // Prompt text and option labels per item key (from the attempt or the attempt endpoint)
  prompts: Record<string, string>;
  options?: Record<string, ReviewPaperItem['options']>;
  sourceLessons: Record<string, { id: number; title: string }>;
}

/** Formative feedback for a review paper: per-item explanations and topics to revise; never a grade. */
export default function ReviewResult({ result, locale, prompts, options = {}, sourceLessons }: ReviewResultProps) {
  const copy = learnCopy(locale);
  const feedback = result.feedback;
  if (!feedback) return null;
  const lessonLink = (contentId: string) => sourceLessons[contentId];
  const optionLabel = (key: string, optionKey: string | null | undefined) =>
    options[key]?.find((option) => option.key === optionKey)?.label ?? optionKey;

  return (
    <div className="space-y-4">
      <section className={clsx(learnSurface.card, 'text-center')}>
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">{copy.noGrade}</p>
        <p className="mt-2 text-xl font-bold">{copy.objectiveSummary(feedback.objective_correct, feedback.objective_total)}</p>
        {result.points_awarded > 0 && <p className={learnSurface.muted}>{copy.pointsEarned(result.points_awarded)}</p>}
        {feedback.submitted_late && <p className={clsx('mt-1 text-sm', learnSurface.muted)}>{copy.submittedLate}</p>}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className={learnSurface.card} aria-labelledby="review-revise">
          <h2 id="review-revise" className="font-semibold">{copy.toRevise}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {feedback.topics_to_revise.length === 0 && <li className={learnSurface.muted}>—</li>}
            {feedback.topics_to_revise.map((contentId) => (
              <li key={contentId}>
                {lessonLink(contentId)
                  ? <Link to={`/learn/lessons/${lessonLink(contentId).id}`} className="font-medium text-primary-700 hover:underline dark:text-primary-300">{lessonLink(contentId).title}</Link>
                  : contentId}
              </li>
            ))}
          </ul>
        </section>
        <section className={learnSurface.card} aria-labelledby="review-secure">
          <h2 id="review-secure" className="font-semibold">{copy.secure}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {feedback.topics_secure.length === 0 && <li className={learnSurface.muted}>—</li>}
            {feedback.topics_secure.map((contentId) => <li key={contentId}>{lessonLink(contentId)?.title || contentId}</li>)}
          </ul>
        </section>
      </div>

      {result.guardian_feedback && (
        <section className="rounded-2xl bg-emerald-50 p-5 text-emerald-950 dark:bg-emerald-900/40 dark:text-emerald-50" aria-labelledby="review-guardian">
          <h2 id="review-guardian" className="flex items-center gap-2 font-semibold"><MessageSquareText className="h-4 w-4" aria-hidden="true" /> {copy.guardianFeedback}</h2>
          {result.guardian_feedback.summary && <p className="mt-1">{result.guardian_feedback.summary}</p>}
        </section>
      )}

      <section className={learnSurface.card} aria-labelledby="review-items">
        <h2 id="review-items" className="font-semibold">{copy.yourAnswers}</h2>
        <ol className="mt-3 space-y-4">
          {feedback.items.map((item, index) => (
            <li key={item.key} className="border-t border-slate-200 pt-3 first:border-0 first:pt-0 dark:border-slate-800">
              <p className="flex items-start gap-2 font-medium">
                {item.kind === 'single_select'
                  ? item.correct
                    ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-600 dark:text-emerald-400" aria-label={copy.correct} />
                    : <XCircle className="mt-0.5 h-4 w-4 flex-none text-rose-600 dark:text-rose-400" aria-label={copy.notQuite} />
                  : <HelpCircle className="mt-0.5 h-4 w-4 flex-none text-sky-600 dark:text-sky-400" aria-hidden="true" />}
                <span>{index + 1}. {prompts[item.key]}</span>
              </p>
              <p className="mt-1 text-sm"><span className="font-semibold">{copy.yourAnswer}:</span> {item.response ? optionLabel(item.key, item.response) : copy.noAnswer}</p>
              {item.kind === 'single_select' ? (
                <>
                  {!item.correct && <p className="text-sm"><span className="font-semibold">{copy.rightAnswer}:</span> {item.correct_answer}</p>}
                  {item.explanation && <p className={clsx('mt-1 text-sm', learnSurface.muted)}>{item.explanation}</p>}
                </>
              ) : (
                <>
                  {item.expected_content && <p className={clsx('mt-1 text-sm', learnSurface.muted)}><span className="font-semibold">{copy.expectedContent}:</span> {item.expected_content}</p>}
                  {result.guardian_feedback?.items?.[item.key]
                    ? <p className="mt-1 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">{result.guardian_feedback.items[item.key]}</p>
                    : item.answered && <p className={clsx('mt-1 text-xs', learnSurface.muted)}>{copy.needsAdult}</p>}
                </>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* The package only has these prompts in English, so Bokmål papers do not show them (content gap) */}
      {locale === 'en' && feedback.reflection_prompts.length > 0 && (
        <section className={learnSurface.subtle}>
          <h2 className="font-semibold">{copy.reflection}</h2>
          <ul className="mt-1 list-disc pl-5 text-sm">{feedback.reflection_prompts.map((prompt) => <li key={prompt}>{prompt}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
