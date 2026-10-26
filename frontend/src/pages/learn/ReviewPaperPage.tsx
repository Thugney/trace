import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, Clock } from 'lucide-react';
import { learnAPI } from '../../services/api';
import type { ReviewAttemptResult, ReviewAttemptStart, ReviewPaperInfo } from '../../types/learn';
import { learnCopy, learnSurface } from '../../components/learn/learnCopy';
import ReviewResult from '../../components/learn/ReviewResult';

const formatRemaining = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

// Formative review paper: server-created attempt, server-scored, feedback only (no grade)
export default function ReviewPaperPage() {
  const { paperId } = useParams();
  const id = Number(paperId);
  const [info, setInfo] = useState<ReviewPaperInfo | null>(null);
  const [attempt, setAttempt] = useState<ReviewAttemptStart | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ReviewAttemptResult | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);
  // The auto-submit timer must see the latest answers
  const answersRef = useRef<Record<string, string>>({});
  const resultHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    learnAPI.getReviewPaper(id)
      .then((response) => setInfo(response.data))
      .catch((err) => setError(err?.response?.data?.error || learnCopy('nb').error));
  }, [id]);

  const copy = learnCopy(info?.locale);

  const updateAnswer = (key: string, value: string) => {
    answersRef.current = { ...answersRef.current, [key]: value };
    setAnswers(answersRef.current);
  };

  const submit = useCallback(async () => {
    if (!attempt || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const response = await learnAPI.submitReviewAttempt(attempt.attempt_id, answersRef.current);
      setResult(response.data);
      setTimeout(() => resultHeading.current?.focus(), 0);
    } catch (err: any) {
      submittedRef.current = false;
      setError(err?.response?.data?.error || copy.error);
    } finally {
      setSubmitting(false);
    }
  }, [attempt, copy.error]);

  // Countdown drives the UI only; the server records lateness
  useEffect(() => {
    if (!attempt || result) return;
    const tick = () => {
      const left = Date.parse(attempt.expires_at) - Date.now();
      setRemaining(left);
      if (left <= 0) submit();
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [attempt, result, submit]);

  const start = async () => {
    setError(null);
    try {
      const response = await learnAPI.startReviewPaper(id);
      submittedRef.current = false;
      answersRef.current = {};
      setAnswers({});
      setResult(null);
      setAttempt(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.code === 'exam_in_progress' ? copy.lockedDuringTest : err?.response?.data?.error || copy.error);
    }
  };

  if (error && !info) {
    return <div className={learnSurface.page}><p role="alert" className="text-red-700 dark:text-red-300">{error}</p></div>;
  }
  if (!info) {
    return <div className={learnSurface.page}><p className={learnSurface.muted} role="status">{copy.loading}</p></div>;
  }

  const answeredCount = Object.values(answers).filter((value) => value.trim()).length;
  const lowTime = remaining > 0 && remaining < 60 * 1000;
  const sourceLessons = Object.fromEntries(info.source_lessons.map((lesson) => [lesson.content_id, { id: lesson.id, title: lesson.title }]));

  return (
    <div className={learnSurface.page} lang={info.locale === 'en' ? 'en' : 'nb'}>
      <Link to="/learn" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {copy.backToLearn}
      </Link>

      <header className="mb-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">
          {copy.reviewPaper} · {copy.gradeLabel(info.grade)}
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">{info.title}</h1>
        <p className={clsx('mt-1 text-sm', learnSurface.muted)}>{info.item_count} {copy.questions} · {info.duration_minutes} {copy.minutes}</p>
      </header>

      {info.review_status !== 'reviewed' && (
        <p className="mb-4 rounded-xl bg-amber-100 p-3 text-sm font-medium text-amber-900 dark:bg-amber-900/50 dark:text-amber-100" role="note">{copy.draftBanner}</p>
      )}

      {!attempt && !result && (
        <div className={clsx(learnSurface.card, 'space-y-3')}>
          <p>{info.instructions}</p>
          <p className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800/70">{copy.reviewPaperIntro}</p>
          <p className={clsx('text-sm', learnSurface.muted)}>{copy.tutorLocked}</p>
          {info.previous_attempts.length > 0 && (
            <div className="text-sm">
              <p className="font-semibold">{copy.previousAttempts}</p>
              <ul className="mt-1 space-y-1">
                {info.previous_attempts.map((previous) => (
                  <li key={previous.id}>
                    <Link to={`/learn/review-attempts/${previous.id}`} className="text-primary-700 hover:underline dark:text-primary-300">
                      {new Date(previous.submitted_at).toLocaleDateString('nb-NO')} · {copy.objectiveSummary(previous.objective_correct, previous.objective_total)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
          <button type="button" onClick={start} className={learnSurface.primaryButton}>{copy.startReview}</button>
        </div>
      )}

      {attempt && !result && (
        <form onSubmit={(event) => { event.preventDefault(); submit(); }} className="space-y-4">
          <div
            className={clsx('sticky top-[5.25rem] z-30 flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm',
              lowTime ? 'bg-rose-600 text-white' : 'bg-white text-slate-800 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-800')}
          >
            <span className="flex items-center gap-2" role="timer" aria-live={lowTime ? 'assertive' : 'off'}>
              <Clock className="h-4 w-4" aria-hidden="true" /> {copy.timeLeft}: {formatRemaining(remaining)}
            </span>
            <span>{answeredCount} / {attempt.items.length}</span>
          </div>

          <ol className="space-y-4">
            {attempt.items.map((item, index) => (
              <li key={item.key} className={learnSurface.card}>
                <fieldset>
                  <legend className="font-semibold">{index + 1}. {item.prompt}</legend>
                  {item.kind === 'single_select' ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {item.options!.map((option) => (
                        <label
                          key={option.key}
                          className={clsx('flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2',
                            answers[item.key] === option.key
                              ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-950/50'
                              : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800')}
                        >
                          <input
                            type="radio"
                            name={item.key}
                            value={option.key}
                            checked={answers[item.key] === option.key}
                            onChange={() => updateAnswer(item.key, option.key)}
                            className="h-4 w-4 accent-primary-600"
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <>
                      <label className="sr-only" htmlFor={`answer-${item.key}`}>{copy.answerHere}</label>
                      <textarea
                        id={`answer-${item.key}`}
                        rows={4}
                        maxLength={2000}
                        placeholder={copy.answerHere}
                        value={answers[item.key] || ''}
                        onChange={(event) => updateAnswer(item.key, event.target.value)}
                        className={clsx(learnSurface.input, 'mt-3')}
                      />
                      <p className={clsx('mt-1 text-xs', learnSurface.muted)}>{copy.needsAdult}</p>
                    </>
                  )}
                </fieldset>
              </li>
            ))}
          </ol>
          {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
          <button type="submit" disabled={submitting} className={clsx(learnSurface.primaryButton, 'w-full sm:w-auto')}>{copy.submitExam}</button>
        </form>
      )}

      {result && attempt && (
        <div>
          <h2 ref={resultHeading} tabIndex={-1} className="mb-3 text-xl font-bold focus:outline-none">{copy.reviewResultHeading}</h2>
          <ReviewResult
            result={result}
            locale={info.locale}
            prompts={Object.fromEntries(attempt.items.map((item) => [item.key, item.prompt]))}
            options={Object.fromEntries(attempt.items.map((item) => [item.key, item.options]))}
            sourceLessons={sourceLessons}
          />
          <button type="button" onClick={start} className={clsx(learnSurface.secondaryButton, 'mt-4')}>{copy.startReview}</button>
        </div>
      )}
    </div>
  );
}
