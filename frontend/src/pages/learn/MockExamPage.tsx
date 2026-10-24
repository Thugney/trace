import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { learnAPI } from '../../services/api';
import type { LearnLocale, MockAttemptResult, MockAttemptStart, MockExamInfo } from '../../types/learn';
import { learnCopy, learnSurface } from '../../components/learn/learnCopy';

const formatRemaining = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export default function MockExamPage() {
  const { examId } = useParams();
  const id = Number(examId);
  const [info, setInfo] = useState<MockExamInfo | null>(null);
  const [locale, setLocale] = useState<LearnLocale>('nb');
  const [attempt, setAttempt] = useState<MockAttemptStart | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<MockAttemptResult | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);
  // The auto-submit timer must see the latest answers, not those from when it was created
  const answersRef = useRef<Record<string, string>>({});
  const updateAnswer = (key: string, value: string) => {
    answersRef.current = { ...answersRef.current, [key]: value };
    setAnswers(answersRef.current);
  };
  const resultHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    learnAPI.getMockExam(id)
      .then(async (response) => {
        setInfo(response.data);
        const catalog = await learnAPI.getCatalog(8);
        const subject = catalog.data.subjects.find((item) => item.topics.some((topic) => topic.id === response.data.topic_id));
        setLocale(subject?.instruction_locale || 'nb');
      })
      .catch((err) => setError(err?.response?.data?.error || learnCopy('nb').error));
  }, [id]);

  const copy = learnCopy(locale);

  const submit = async () => {
    if (!attempt || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const response = await learnAPI.submitMockAttempt(attempt.attempt_id, answersRef.current);
      setResult(response.data);
      setTimeout(() => resultHeading.current?.focus(), 0);
    } catch (err: any) {
      submittedRef.current = false;
      setError(err?.response?.data?.error || copy.error);
    } finally {
      setSubmitting(false);
    }
  };

  // Countdown; the server is authoritative, this only drives the UI and auto-submit
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
  }, [attempt, result]);

  const start = async () => {
    setError(null);
    try {
      const response = await learnAPI.startMockExam(id);
      submittedRef.current = false;
      setAttempt(response.data);
      answersRef.current = {};
      setAnswers({});
      setResult(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || copy.error);
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

  return (
    <div className={learnSurface.page} lang={locale === 'en' ? 'en' : 'nb'}>
      <Link to="/learn" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {copy.backToLearn}
      </Link>

      <header className="mb-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">{copy.mockExam}</p>
        <h1 className="text-2xl font-bold sm:text-3xl">{info.title}</h1>
        <p className={clsx('mt-1 text-sm', learnSurface.muted)}>
          {info.item_count} {copy.questions} · {info.time_limit_minutes} {copy.minutes}
        </p>
      </header>

      {!attempt && !result && (
        <div className={clsx(learnSurface.card, 'space-y-3')}>
          <p>{copy.examIntro}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {info.criteria.map((criterion) => <li key={criterion.key}><strong>{criterion.label}:</strong> {criterion.description}</li>)}
          </ul>
          <p className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800/70">{info.disclaimer}</p>
          <p className={clsx('text-sm', learnSurface.muted)}>{copy.tutorLocked}</p>
          {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
          <button type="button" onClick={start} className={learnSurface.primaryButton}>{copy.startExam}</button>
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
                  <legend className="font-semibold">
                    <span className="mr-2 text-slate-500 dark:text-slate-400">{index + 1}.</span>{item.prompt}
                    <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">({item.points} p)</span>
                  </legend>
                  {item.type === 'multiple_choice' ? (
                    <div className="mt-3 grid gap-2">
                      {item.options?.map((option) => (
                        <label
                          key={option.id}
                          className={clsx('flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition',
                            answers[item.key] === option.id
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/50'
                              : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60')}
                        >
                          <input
                            type="radio"
                            name={item.key}
                            value={option.id}
                            checked={answers[item.key] === option.id}
                            onChange={() => updateAnswer(item.key, option.id)}
                            className="h-4 w-4 accent-primary-600"
                          />
                          {option.text}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <label className="mt-3 block">
                      <span className="sr-only">{copy.answerHere}</span>
                      <input
                        className={learnSurface.input}
                        maxLength={200}
                        autoComplete="off"
                        placeholder={copy.answerHere}
                        value={answers[item.key] || ''}
                        onChange={(event) => updateAnswer(item.key, event.target.value)}
                      />
                    </label>
                  )}
                </fieldset>
              </li>
            ))}
          </ol>

          {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
          <button type="submit" disabled={submitting} className={clsx(learnSurface.primaryButton, 'w-full sm:w-auto')}>
            {submitting ? copy.loading : copy.submitExam}
          </button>
        </form>
      )}

      {result && (
        <div className="space-y-4">
          <section className={clsx(learnSurface.card, 'text-center')} aria-labelledby="exam-result">
            <h2 id="exam-result" ref={resultHeading} tabIndex={-1} className="text-sm font-semibold uppercase tracking-wide text-slate-500 focus:outline-none dark:text-slate-400">
              {copy.results}
            </h2>
            {result.outcome === 'graded' && result.indicative_grade !== null ? (
              <>
                <p className="mt-2 text-sm font-medium">{copy.indicativeGrade}</p>
                <p className="text-6xl font-extrabold text-primary-600 dark:text-primary-300">{result.indicative_grade}</p>
                <p className="mt-1 text-sm font-semibold text-amber-800 dark:text-amber-200">{copy.notOfficial}</p>
              </>
            ) : (
              <div className="mt-3 flex flex-col items-center gap-2">
                <AlertTriangle className="h-8 w-8 text-amber-500" aria-hidden="true" />
                <p className="text-lg font-bold">{copy.insufficientEvidence}</p>
                <p className={clsx('max-w-md text-sm', learnSurface.muted)}>{copy.insufficientExplain}</p>
              </div>
            )}
            <p className="mt-3 text-sm">{result.score} / {result.max_score} ({result.percent} %)</p>
            <p className={clsx('mx-auto mt-3 max-w-xl text-xs', learnSurface.muted)}>{result.disclaimer}</p>
          </section>

          <section className={learnSurface.card} aria-labelledby="exam-evidence">
            <h2 id="exam-evidence" className="font-semibold">{copy.evidenceByCriterion}</h2>
            <ul className="mt-3 space-y-3">
              {result.criteria.map((criterion) => (
                <li key={criterion.key}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{criterion.label}</span>
                    <span>{criterion.pointsEarned}/{criterion.pointsPossible} · {criterion.answered}/{criterion.total}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="img" aria-label={`${criterion.label}: ${criterion.percent} %`}>
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${criterion.percent}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {(result.next_steps.length > 0 || result.limitations.length > 0) && (
            <section className={clsx(learnSurface.card, 'grid gap-4 sm:grid-cols-2')}>
              {result.next_steps.length > 0 && (
                <div>
                  <h2 className="font-semibold">{copy.nextSteps}</h2>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{result.next_steps.map((step) => <li key={step}>{step}</li>)}</ul>
                </div>
              )}
              <div>
                <h2 className="font-semibold">{copy.limitations}</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{result.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            </section>
          )}

          <section className={learnSurface.card} aria-labelledby="exam-review">
            <h2 id="exam-review" className="font-semibold">{copy.yourAnswers}</h2>
            <ol className="mt-3 space-y-2">
              {result.items.map((item, index) => (
                <li key={item.key} className="flex gap-3 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800/70">
                  {item.correct
                    ? <CheckCircle2 className="h-5 w-5 flex-none text-emerald-600 dark:text-emerald-400" aria-label={copy.correct} />
                    : <XCircle className="h-5 w-5 flex-none text-rose-600 dark:text-rose-400" aria-label={copy.notQuite} />}
                  <span>
                    <strong>{index + 1}.</strong> {item.correct ? '' : `${item.correctAnswer} – `}{item.explanation}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={start} className={learnSurface.secondaryButton}>{copy.startExam}</button>
            <Link to="/learn" className={learnSurface.primaryButton}>{copy.backToLearn}</Link>
          </div>
        </div>
      )}
    </div>
  );
}
