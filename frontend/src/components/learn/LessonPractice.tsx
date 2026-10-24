import { useState } from 'react';
import clsx from 'clsx';
import { CheckCircle2, Lightbulb, RotateCcw, XCircle } from 'lucide-react';
import { activitiesAPI, learnAPI } from '../../services/api';
import { useProfile } from '../../context/ProfileContext';
import { playSounds } from '../../utils/sounds';
import type { ActivitySubmissionResult, LearningActivity, LearningSession, SessionCompletionResult } from '../../types/activities';
import type { LearnLocale, PracticeResult } from '../../types/learn';
import MultipleChoiceActivity from '../activities/MultipleChoiceActivity';
import FillBlanksActivity from '../activities/FillBlanksActivity';
import TrueFalseActivity from '../activities/TrueFalseActivity';
import MatchingActivity from '../activities/MatchingActivity';
import SortingActivity from '../activities/SortingActivity';
import FlashcardsActivity from '../activities/FlashcardsActivity';
import { learnCopy, learnSurface } from './learnCopy';

interface LessonPracticeProps {
  lessonId: number;
  locale: LearnLocale;
  result: PracticeResult | null;
  onCompleted: () => void;
}

type Phase = 'idle' | 'loading' | 'playing' | 'feedback' | 'done';

const theme = { colors: { primary: '#4f46e5', secondary: '#818cf8', accent: '#c7d2fe', background: '' } };

/**
 * Plays a lesson's practice set through the existing Learning Activity Engine:
 * the session comes from POST /learn/lessons/:id/practice, and every answer is
 * scored server-side by /api/activities. This component only renders.
 */
export default function LessonPractice({ lessonId, locale, result, onCompleted }: LessonPracticeProps) {
  const copy = learnCopy(locale);
  const { currentProfile } = useProfile();
  const [phase, setPhase] = useState<Phase>('idle');
  const [session, setSession] = useState<LearningSession | null>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [response, setResponse] = useState<any>(null);
  const [feedback, setFeedback] = useState<ActivitySubmissionResult | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [completion, setCompletion] = useState<SessionCompletionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(Date.now());

  const activities: LearningActivity[] = session?.activities || [];
  const activity = activities[index];

  const start = async () => {
    if (!currentProfile) return;
    setPhase('loading');
    setError(null);
    try {
      const prepared = await learnAPI.preparePractice(lessonId);
      const [sessionResponse, attempt] = await Promise.all([
        activitiesAPI.getSession(prepared.data.session_id),
        activitiesAPI.startSession(prepared.data.session_id, currentProfile.id)
      ]);
      setSession(sessionResponse.data);
      setAttemptId(attempt.data.attemptId);
      setIndex(0);
      setResponse(null);
      setFeedback(null);
      setCompletion(null);
      setHintsUsed(0);
      setShowHint(false);
      setStartedAt(Date.now());
      setPhase('playing');
    } catch (err: any) {
      setError(err?.response?.data?.error || copy.error);
      setPhase('idle');
    }
  };

  const check = async () => {
    if (!attemptId || !activity) return;
    try {
      const submitted = await activitiesAPI.submitActivity(attemptId, {
        activityId: activity.id,
        userResponse: response ?? {},
        timeTakenSeconds: Math.round((Date.now() - startedAt) / 1000),
        hintsUsed
      });
      setFeedback(submitted.data);
      if (submitted.data.isCorrect) playSounds.quizCorrect(); else playSounds.quizWrong();
      setPhase('feedback');
    } catch (err: any) {
      // Already answered (e.g. after a retry): move on without double counting
      if (err?.response?.status === 400) {
        setPhase('feedback');
      } else {
        setError(err?.response?.data?.error || copy.error);
      }
    }
  };

  const next = async () => {
    if (index < activities.length - 1) {
      setIndex(index + 1);
      setResponse(null);
      setFeedback(null);
      setHintsUsed(0);
      setShowHint(false);
      setStartedAt(Date.now());
      setPhase('playing');
      return;
    }

    if (!attemptId) return;
    try {
      const completed = await activitiesAPI.completeSession(attemptId);
      setCompletion(completed.data);
      if (completed.data.passed) playSounds.quizComplete();
    } catch (err: any) {
      if (err?.response?.status !== 400) {
        setError(err?.response?.data?.error || copy.error);
      }
    }
    setPhase('done');
    onCompleted();
  };

  const renderActivity = () => {
    if (!activity) return null;
    const props = {
      activity,
      onResponse: setResponse,
      currentResponse: response,
      disabled: phase !== 'playing',
      showFeedback: phase === 'feedback',
      feedbackResult: feedback,
      theme
    };
    switch (activity.activity_type_name) {
      case 'multiple_choice': return <MultipleChoiceActivity {...props} />;
      case 'fill_blanks': return <FillBlanksActivity {...props} />;
      case 'true_false': return <TrueFalseActivity {...props} />;
      case 'matching': return <MatchingActivity {...props} />;
      case 'sorting': return <SortingActivity {...props} />;
      case 'flashcards': return <FlashcardsActivity {...props} />;
      default: return <p className={learnSurface.muted}>{activity.title}</p>;
    }
  };

  if (phase === 'idle' || phase === 'loading') {
    return (
      <div className={learnSurface.card}>
        <p className={learnSurface.muted}>{copy.practiceIntro}</p>
        {result && result.attempts > 0 && (
          <p className="mt-3 text-sm font-medium">
            {copy.bestScore}: {result.bestPercent ?? 0} % · {result.attempts} {copy.attempts}
          </p>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
        <button type="button" onClick={start} disabled={phase === 'loading'} className={clsx(learnSurface.primaryButton, 'mt-4')}>
          {phase === 'loading' ? copy.loading : result && result.attempts > 0 ? copy.practiceAgain : copy.startPractice}
        </button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className={clsx(learnSurface.card, 'text-center')} role="status">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" aria-hidden="true" />
        <p className="mt-2 text-xl font-bold">{completion ? copy.practiceDone(completion.scorePercentage) : copy.done}</p>
        {completion && completion.pointsEarned > 0 && <p className={learnSurface.muted}>+{completion.pointsEarned} poeng</p>}
        <button type="button" onClick={start} className={clsx(learnSurface.secondaryButton, 'mt-4')}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> {copy.practiceAgain}
        </button>
      </div>
    );
  }

  return (
    <div className={learnSurface.card}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{index + 1} / {activities.length}</p>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden="true">
          <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${((index + (phase === 'feedback' ? 1 : 0)) / activities.length) * 100}%` }} />
        </div>
      </div>

      <h3 className="mb-1 font-semibold">{activity?.title}</h3>
      {activity?.instructions && <p className={clsx('mb-3 text-sm', learnSurface.muted)}>{activity.instructions}</p>}

      {/* Existing activity renderers are light-themed; keep them on a light panel in dark mode for contrast */}
      <div className="rounded-xl bg-white p-3 text-slate-900">{renderActivity()}</div>

      {showHint && activity?.hints?.[Math.max(0, hintsUsed - 1)] && (
        <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
          <Lightbulb className="h-4 w-4 flex-none" aria-hidden="true" /> {activity.hints[Math.max(0, hintsUsed - 1)]}
        </p>
      )}

      <div aria-live="polite">
        {phase === 'feedback' && feedback && (
          <div className={clsx('mt-4 rounded-xl p-3 text-sm', feedback.isCorrect
            ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100'
            : 'bg-rose-50 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100')}
          >
            <p className="flex items-center gap-2 font-semibold">
              {feedback.isCorrect ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}
              {feedback.isCorrect ? copy.correct : copy.notQuite}
            </p>
            {/* The engine's generic feedback is English and id-based; Learn shows the reviewed lesson explanation */}
            {feedback.explanation && <p className="mt-1">{feedback.explanation}</p>}
          </div>
        )}
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {phase === 'playing' && (
          <>
            <button type="button" onClick={check} disabled={response === null} className={learnSurface.primaryButton}>{copy.check}</button>
            {activity?.hints && hintsUsed < activity.hints.length && (
              <button
                type="button"
                onClick={() => { setHintsUsed(hintsUsed + 1); setShowHint(true); playSounds.hintReveal(); }}
                className={learnSurface.secondaryButton}
              >
                <Lightbulb className="h-4 w-4" aria-hidden="true" /> {copy.hint}
              </button>
            )}
          </>
        )}
        {phase === 'feedback' && (
          <button type="button" onClick={next} className={learnSurface.primaryButton}>
            {index < activities.length - 1 ? copy.next : copy.finish}
          </button>
        )}
      </div>
    </div>
  );
}
