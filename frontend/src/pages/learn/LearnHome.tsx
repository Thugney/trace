import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CalendarClock, CheckCircle2, ClipboardCheck, GraduationCap, Route as RouteIcon, ShieldCheck, Timer } from 'lucide-react';
import clsx from 'clsx';
import { learnAPI } from '../../services/api';
import { useProfile } from '../../context/ProfileContext';
import type { LearnerProgress, LearnStatus, LearnSubject, LessonState } from '../../types/learn';
import { learnCopy, learnSurface, stateBadgeClass, subjectStyle } from '../../components/learn/learnCopy';
import LearnParent from './LearnParent';

const copy = learnCopy('nb');

export default function LearnHome() {
  const { currentProfile } = useProfile();
  const [status, setStatus] = useState<LearnStatus | null>(null);
  const [subjects, setSubjects] = useState<LearnSubject[]>([]);
  const [progress, setProgress] = useState<LearnerProgress | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const statusResponse = await learnAPI.getStatus();
      setStatus(statusResponse.data);
      if (statusResponse.data.enabled) {
        const [catalog, me] = await Promise.all([learnAPI.getCatalog(8), learnAPI.getMyProgress()]);
        setSubjects(catalog.data.subjects);
        setProgress(me.data);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || copy.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentProfile?.type !== 'parent') {
      load();
    }
  }, [currentProfile?.id]);

  const lessonState = useMemo(() => {
    const map = new Map<number, LessonState>();
    progress?.lessons.forEach((lesson) => map.set(lesson.lesson_id, lesson.state));
    return map;
  }, [progress]);

  // Course order: subjects in curriculum order, topics by sort order; next = first lesson not mastered
  const courseSteps = useMemo(() => subjects.flatMap((subject) => subject.topics.map((topic) => ({
    subject,
    topic,
    lesson: topic.lessons[0],
    state: topic.lessons[0] ? lessonState.get(topic.lessons[0].id) || 'not_started' : 'not_started'
  }))).filter((step) => step.lesson), [subjects, lessonState]);
  const nextStep = courseSteps.find((step) => step.state !== 'mastered');

  if (currentProfile?.type === 'parent') {
    return <LearnParent />;
  }

  if (loading) {
    return <div className={learnSurface.page}><p className={learnSurface.muted} role="status">{copy.loading}</p></div>;
  }

  if (error) {
    return <div className={learnSurface.page}><p role="alert" className="text-red-700 dark:text-red-300">{error}</p></div>;
  }

  if (!status?.enabled) {
    return (
      <div className={learnSurface.page}>
        <div className={clsx(learnSurface.card, 'mx-auto max-w-xl text-center')}>
          <GraduationCap className="mx-auto h-10 w-10 text-primary-500" aria-hidden="true" />
          <h1 className="mt-3 text-xl font-bold">{copy.appName}</h1>
          <p className={clsx('mt-2', learnSurface.muted)}>{copy.disabledForProfile}</p>
        </div>
      </div>
    );
  }

  const openAssignments = (progress?.assignments || []).filter((assignment) => assignment.state === 'assigned');
  const visibleSubjects = subjectFilter === 'all' ? subjects : subjects.filter((subject) => subject.slug === subjectFilter);
  const hasLessons = courseSteps.length > 0;

  return (
    <div className={learnSurface.page}>
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">{copy.grade8} · LK20</p>
          <h1 className="text-2xl font-bold sm:text-3xl">{copy.appName}</h1>
        </div>
        {status.can_review && (
          <Link to="/learn/review" className={learnSurface.secondaryButton}>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> {copy.reviewQueue}
          </Link>
        )}
      </header>

      {!hasLessons && (
        <div className={clsx(learnSurface.card, 'mb-6')} role="status">
          <p className={learnSurface.muted}>{copy.noReviewedContent}</p>
        </div>
      )}

      {openAssignments.length > 0 && (
        <section aria-labelledby="learn-assignments" className="mb-6">
          <h2 id="learn-assignments" className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <ClipboardCheck className="h-5 w-5 text-primary-500" aria-hidden="true" /> {copy.myAssignments}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {openAssignments.map((assignment) => (
              <li key={assignment.id} className={learnSurface.card}>
                <p className="font-semibold">{assignment.lesson_title || assignment.mock_exam_title}</p>
                <p className={clsx('text-sm', learnSurface.muted)}>
                  {assignment.assigned_by_name}
                  {assignment.due_at && (
                    <> · <CalendarClock className="inline h-4 w-4" aria-hidden="true" /> {copy.due} {new Date(assignment.due_at).toLocaleDateString('nb-NO')}</>
                  )}
                </p>
                {assignment.note && <p className="mt-2 text-sm">{assignment.note}</p>}
                <Link
                  to={assignment.lesson_id ? `/learn/lessons/${assignment.lesson_id}` : `/learn/exams/${assignment.mock_exam_id}`}
                  className={clsx(learnSurface.primaryButton, 'mt-3')}
                >
                  {copy.open}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasLessons && (
        <section aria-labelledby="learn-course" className={clsx(learnSurface.card, 'mb-6')}>
          <h2 id="learn-course" className="flex items-center gap-2 text-lg font-semibold">
            <RouteIcon className="h-5 w-5 text-primary-500" aria-hidden="true" /> {copy.coursePath}
          </h2>
          <p className={clsx('mb-4 text-sm', learnSurface.muted)}>{copy.coursePathHint}</p>
          <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {courseSteps.map((step, index) => {
              const style = subjectStyle(step.subject.slug);
              const isNext = nextStep?.lesson?.id === step.lesson!.id;
              return (
                <li key={step.lesson!.id} className="sm:flex-1 sm:min-w-[11rem]">
                  <Link
                    to={`/learn/lessons/${step.lesson!.id}`}
                    aria-current={isNext ? 'step' : undefined}
                    className={clsx(
                      'flex h-full items-center gap-3 rounded-xl border p-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                      isNext
                        ? 'border-primary-400 bg-primary-50 dark:border-primary-500 dark:bg-primary-950/50'
                        : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60'
                    )}
                  >
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-200 text-sm font-bold dark:bg-slate-700" aria-hidden="true">
                      {step.state === 'mastered' ? <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> : index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">{style.emoji} {step.subject.title}</span>
                      <span className="block truncate font-semibold">{step.topic.title}</span>
                      <span className={clsx('mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold', stateBadgeClass[step.state])}>
                        {copy.states[step.state]}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {hasLessons && (
        <section aria-labelledby="learn-free">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="learn-free" className="flex items-center gap-2 text-lg font-semibold">
              <BookOpen className="h-5 w-5 text-primary-500" aria-hidden="true" /> {copy.freeChoice}
            </h2>
            <div role="group" aria-label={copy.freeChoice} className="flex flex-wrap gap-2">
              {[{ slug: 'all', title: 'Alle fag' }, ...subjects].map((subject) => (
                <button
                  key={subject.slug}
                  type="button"
                  aria-pressed={subjectFilter === subject.slug}
                  onClick={() => setSubjectFilter(subject.slug)}
                  className={clsx(
                    'min-h-[36px] rounded-full px-3 py-1 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                    subjectFilter === subject.slug
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800'
                  )}
                >
                  {subject.title}
                </button>
              ))}
            </div>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleSubjects.flatMap((subject) => subject.topics.map((topic) => {
              const style = subjectStyle(subject.slug);
              const lesson = topic.lessons[0];
              const exam = topic.mock_exams[0];
              const state = lesson ? lessonState.get(lesson.id) || 'not_started' : 'not_started';
              return (
                <li key={topic.id} className={clsx(learnSurface.card, 'flex flex-col')}>
                  <div className={clsx('mb-3 h-1.5 rounded-full bg-gradient-to-r', style.accent)} aria-hidden="true" />
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{style.emoji} {subject.title} · {subject.udir_code}</p>
                  <h3 className="mt-1 text-lg font-semibold">{topic.title}</h3>
                  <p className={clsx('mt-1 flex-1 text-sm', learnSurface.muted)}>{topic.summary}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={clsx('rounded-full px-2 py-0.5 text-xs font-semibold', stateBadgeClass[state])}>{copy.states[state]}</span>
                    {lesson?.review_status === 'draft' && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">Utkast</span>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {lesson && (
                      <Link to={`/learn/lessons/${lesson.id}`} className={learnSurface.primaryButton}>
                        {state === 'not_started' ? copy.startLesson : copy.continueLesson}
                      </Link>
                    )}
                    {exam && (
                      <Link to={`/learn/exams/${exam.id}`} className={learnSurface.secondaryButton}>
                        <Timer className="h-4 w-4" aria-hidden="true" /> {copy.mockExam} · {exam.time_limit_minutes} {copy.minutes}
                      </Link>
                    )}
                  </div>
                </li>
              );
            }))}
          </ul>
        </section>
      )}
    </div>
  );
}
