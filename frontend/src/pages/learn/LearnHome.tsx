import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, CalendarClock, CheckCircle2, ClipboardCheck, ClipboardList, GraduationCap, Info, PlayCircle,
  Route as RouteIcon, Search, ShieldCheck, Timer
} from 'lucide-react';
import clsx from 'clsx';
import { learnAPI } from '../../services/api';
import { useProfile } from '../../context/ProfileContext';
import type {
  AssessmentPolicy, CatalogOverviewGrade, LearnerProgress, LearnStatus, LearnSubject, LearnTopic, LessonState
} from '../../types/learn';
import { learnCopy, learnSurface, stateBadgeClass, subjectStyle } from '../../components/learn/learnCopy';
import { assignmentLink, assignmentTitle } from '../../components/learn/assignments';
import GradePicker from '../../components/learn/GradePicker';
import LearnParent from './LearnParent';

const copy = learnCopy('nb');

export default function LearnHome() {
  const { currentProfile } = useProfile();
  const [status, setStatus] = useState<LearnStatus | null>(null);
  const [overview, setOverview] = useState<CatalogOverviewGrade[]>([]);
  const [grade, setGrade] = useState<number | null>(null);
  const [policy, setPolicy] = useState<AssessmentPolicy | null>(null);
  const [subjects, setSubjects] = useState<LearnSubject[]>([]);
  const [progress, setProgress] = useState<LearnerProgress | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [pickingGrade, setPickingGrade] = useState(false);
  const [savingGrade, setSavingGrade] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCatalog = async (forGrade?: number) => {
    const catalog = await learnAPI.getCatalog(forGrade);
    setSubjects(catalog.data.subjects);
    setGrade(catalog.data.grade);
    setPolicy(catalog.data.assessment_policy || null);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const statusResponse = await learnAPI.getStatus();
      setStatus(statusResponse.data);
      if (statusResponse.data.enabled) {
        const [overviewResponse, me] = await Promise.all([learnAPI.getCatalogOverview(), learnAPI.getMyProgress(), loadCatalog()]);
        setOverview(overviewResponse.data.grades);
        setProgress(me.data);
        setPickingGrade(!statusResponse.data.grade && statusResponse.data.role !== 'admin');
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

  const chooseGrade = async (next: number) => {
    setSavingGrade(true);
    setError(null);
    try {
      // The school grade is a guardian control: children and admins browse
      // other years without saving one
      if (status?.role === 'parent') await learnAPI.setMyGrade(next);
      await loadCatalog(next);
      setSubjectFilter('all');
      setPickingGrade(false);
    } catch (err: any) {
      setError(err?.response?.data?.error || copy.error);
    } finally {
      setSavingGrade(false);
    }
  };

  const lessonState = useMemo(() => {
    const map = new Map<number, LessonState>();
    progress?.lessons.forEach((lesson) => map.set(lesson.lesson_id, lesson.state));
    return map;
  }, [progress]);

  const topicState = (topic: LearnTopic): LessonState =>
    topic.lessons[0] ? lessonState.get(topic.lessons[0].id) || 'not_started' : 'not_started';

  // Resume: the most recently opened lesson of this grade that is not mastered yet
  const resume = useMemo(() => (progress?.lessons || [])
    .filter((lesson) => lesson.grade === grade && lesson.read_at && lesson.state !== 'mastered')
    .sort((a, b) => (b.read_at || '').localeCompare(a.read_at || ''))[0], [progress, grade]);

  if (currentProfile?.type === 'parent') {
    return <LearnParent />;
  }

  if (loading) {
    return <div className={learnSurface.page}><p className={learnSurface.muted} role="status">{copy.loading}</p></div>;
  }

  if (error && !status) {
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
  const selectedSubject = subjects.find((subject) => subject.slug === subjectFilter) || null;
  const hasLessons = subjects.some((subject) => subject.topics.some((topic) => topic.lessons.length > 0));
  const normalizedQuery = query.trim().toLowerCase();
  const searchResults = normalizedQuery
    ? subjects.flatMap((subject) => subject.topics
      .filter((topic) => topic.lessons[0] && `${topic.title} ${topic.summary}`.toLowerCase().includes(normalizedQuery))
      .map((topic) => ({ subject, topic })))
    : [];

  return (
    <div className={learnSurface.page}>
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">
            {grade ? copy.gradeLabel(grade) : copy.chooseGrade} · LK20
          </p>
          <h1 className="text-2xl font-bold sm:text-3xl">{copy.appName}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {!pickingGrade && (
            <button type="button" onClick={() => setPickingGrade(true)} className={learnSurface.secondaryButton}>
              <GraduationCap className="h-4 w-4" aria-hidden="true" /> {copy.changeGrade}
            </button>
          )}
          {status.can_review && (
            <Link to="/learn/review" className={learnSurface.secondaryButton}>
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> {copy.reviewQueue}
            </Link>
          )}
        </div>
      </header>

      {error && <p role="alert" className="mb-4 text-sm text-red-700 dark:text-red-300">{error}</p>}

      {pickingGrade && (
        <section aria-labelledby="learn-grade" className={clsx(learnSurface.card, 'mb-6')}>
          <h2 id="learn-grade" className="text-lg font-semibold">{copy.chooseGrade}</h2>
          <p className={clsx('mb-4 text-sm', learnSurface.muted)}>{copy.chooseGradeIntro}</p>
          <GradePicker overview={overview} selected={grade} suggested={status.suggested_grade} onSelect={chooseGrade} disabled={savingGrade} />
        </section>
      )}

      {policy?.formative_only && (
        <p className="mb-6 flex items-center gap-2 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:bg-sky-950/60 dark:text-sky-100">
          <Info className="h-4 w-4 flex-none" aria-hidden="true" /> {copy.formativeNote}
        </p>
      )}

      {openAssignments.length > 0 && (
        <section aria-labelledby="learn-assignments" className="mb-6">
          <h2 id="learn-assignments" className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <ClipboardCheck className="h-5 w-5 text-primary-500" aria-hidden="true" /> {copy.myAssignments}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {openAssignments.map((assignment) => (
              <li key={assignment.id} className={clsx(learnSurface.card, assignment.overdue && 'border-rose-300 dark:border-rose-800')}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {copy.assignmentKinds[assignment.target_kind || 'lesson']}
                </p>
                <p className="font-semibold">{assignmentTitle(assignment)}</p>
                <p className={clsx('text-sm', learnSurface.muted)}>
                  {assignment.assigned_by_name}
                  {assignment.due_at && (
                    <> · <CalendarClock className="inline h-4 w-4" aria-hidden="true" /> {copy.due} {new Date(assignment.due_at).toLocaleDateString('nb-NO')}</>
                  )}
                </p>
                {assignment.overdue && <p className="mt-1 text-sm font-semibold text-rose-700 dark:text-rose-300">{copy.overdue}</p>}
                {assignment.note && <p className="mt-2 text-sm">{assignment.note}</p>}
                <Link to={assignmentLink(assignment)} className={clsx(learnSurface.primaryButton, 'mt-3')}>{copy.open}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {resume && (
        <Link
          to={`/learn/lessons/${resume.lesson_id}`}
          className={clsx(learnSurface.card, 'mb-6 flex items-center gap-4 transition hover:border-primary-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500')}
        >
          <PlayCircle className="h-10 w-10 flex-none text-primary-500" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-sm text-slate-500 dark:text-slate-400">{copy.continueLesson} · {resume.subject_title}</span>
            <span className="block truncate text-lg font-semibold">{resume.topic_title}</span>
          </span>
        </Link>
      )}

      {!hasLessons && !pickingGrade && (
        <div className={clsx(learnSurface.card, 'mb-6')} role="status">
          <p className={learnSurface.muted}>{copy.noReviewedForGrade}</p>
        </div>
      )}

      {subjects.length > 0 && (
        <div role="group" aria-label={copy.chooseSubject} className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {[{ slug: 'all', title: copy.allSubjects }, ...subjects].map((subject) => (
            <button
              key={subject.slug}
              type="button"
              aria-pressed={subjectFilter === subject.slug}
              onClick={() => setSubjectFilter(subject.slug)}
              className={clsx(
                'min-h-[40px] flex-none rounded-full px-4 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                subjectFilter === subject.slug
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800'
              )}
            >
              {subject.slug !== 'all' && <span aria-hidden="true">{subjectStyle(subject.slug).emoji} </span>}{subject.title}
            </button>
          ))}
        </div>
      )}

      {!selectedSubject && subjects.length > 0 && (
        <>
          {hasLessons && (
            <section aria-labelledby="learn-free" className="mb-6">
              <h2 id="learn-free" className="mb-2 flex items-center gap-2 text-lg font-semibold">
                <Search className="h-5 w-5 text-primary-500" aria-hidden="true" /> {copy.freeChoice}
              </h2>
              <label className="sr-only" htmlFor="learn-topic-search">{copy.freeChoice}</label>
              <input
                id="learn-topic-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.searchTopics}
                className={learnSurface.input}
              />
              {normalizedQuery && (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {searchResults.map(({ subject, topic }) => (
                    <li key={topic.id}>
                      <Link to={`/learn/lessons/${topic.lessons[0].id}`} className={clsx(learnSurface.card, 'block p-4 hover:border-primary-300')}>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{subjectStyle(subject.slug).emoji} {subject.title}</span>
                        <span className="block font-semibold">{topic.title}</span>
                      </Link>
                    </li>
                  ))}
                  {searchResults.length === 0 && <li className={learnSurface.muted}>{copy.noWorkForSelection}</li>}
                </ul>
              )}
            </section>
          )}

          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {subjects.map((subject) => {
              const style = subjectStyle(subject.slug);
              const available = subject.topics.filter((topic) => topic.lessons.length > 0);
              const mastered = available.filter((topic) => topicState(topic) === 'mastered').length;
              const next = available.find((topic) => topicState(topic) !== 'mastered');
              const planned = subject.content_gap?.topics_planned ?? available.length;
              return (
                <li key={subject.slug} className={clsx(learnSurface.card, 'flex flex-col')}>
                  <div className={clsx('mb-3 h-1.5 rounded-full bg-gradient-to-r', style.accent)} aria-hidden="true" />
                  <h3 className="text-lg font-semibold"><span aria-hidden="true">{style.emoji}</span> {subject.title}</h3>
                  {subject.course && (
                    <p className={clsx('text-xs', learnSurface.muted)}>
                      {subject.course.curriculum_code} · {subject.course.checkpoint_is_this_grade
                        ? copy.atCheckpoint(subject.course.checkpoint_after_grade)
                        : copy.towardsCheckpoint(subject.course.checkpoint_after_grade)}
                    </p>
                  )}
                  <div className="mt-3" aria-label={`${mastered} / ${available.length}`}>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${available.length ? (mastered / available.length) * 100 : 0}%` }} />
                    </div>
                    <p className={clsx('mt-1 text-xs', learnSurface.muted)}>
                      {copy.states.mastered}: {mastered} / {available.length} · {copy.topicsReady(available.length, planned)}
                    </p>
                  </div>
                  {planned > available.length && (
                    <p className={clsx('mt-2 text-xs', learnSurface.muted)}>{copy.contentGap(planned - available.length)}</p>
                  )}
                  <div className="mt-4 flex flex-1 flex-wrap items-end gap-2">
                    {next?.lessons[0] && (
                      <Link to={`/learn/lessons/${next.lessons[0].id}`} className={learnSurface.primaryButton}>
                        {topicState(next) === 'not_started' ? copy.startLesson : copy.continueLesson}
                      </Link>
                    )}
                    <button type="button" onClick={() => setSubjectFilter(subject.slug)} className={learnSurface.secondaryButton}>
                      <RouteIcon className="h-4 w-4" aria-hidden="true" /> {copy.coursePath}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {selectedSubject && (
        <SubjectCourse subject={selectedSubject} topicState={topicState} formativeOnly={Boolean(policy?.formative_only)} />
      )}
    </div>
  );
}

function SubjectCourse({ subject, topicState, formativeOnly }: {
  subject: LearnSubject;
  topicState: (topic: LearnTopic) => LessonState;
  formativeOnly: boolean;
}) {
  const style = subjectStyle(subject.slug);
  const topics = subject.topics.filter((topic) => topic.lessons.length > 0 || topic.mock_exams.length > 0);
  const nextTopic = topics.find((topic) => topic.lessons[0] && topicState(topic) !== 'mastered');
  const planned = subject.content_gap?.topics_planned ?? topics.length;
  const papers = subject.review_papers || [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section aria-labelledby="learn-course" className={learnSurface.card}>
        <h2 id="learn-course" className="flex items-center gap-2 text-lg font-semibold">
          <RouteIcon className="h-5 w-5 text-primary-500" aria-hidden="true" /> {style.emoji} {subject.course?.title || subject.title}
        </h2>
        <p className={clsx('mb-4 text-sm', learnSurface.muted)}>{copy.coursePathHint}</p>
        {topics.length === 0 && <p className={learnSurface.muted}>{copy.noReviewedForGrade}</p>}
        <ol className="space-y-2">
          {topics.map((topic, index) => {
            const state = topicState(topic);
            const lesson = topic.lessons[0];
            const isNext = nextTopic?.id === topic.id;
            const body = (
              <>
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-slate-200 text-sm font-bold dark:bg-slate-700" aria-hidden="true">
                  {state === 'mastered' ? <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> : topic.course_position ?? index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{topic.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className={clsx('rounded-full px-2 py-0.5 font-semibold', stateBadgeClass[state])}>{copy.states[state]}</span>
                    {topic.estimated_minutes && <span className={learnSurface.muted}><Timer className="inline h-3 w-3" aria-hidden="true" /> {copy.aboutMinutes(topic.estimated_minutes)}</span>}
                    {topic.optional_challenge && <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-800 dark:bg-violet-900/60 dark:text-violet-200">{copy.challenge}</span>}
                    {lesson?.review_status === 'draft' && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">Utkast</span>}
                  </span>
                </span>
              </>
            );
            const itemClass = clsx(
              'flex items-center gap-3 rounded-xl border p-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
              isNext ? 'border-primary-400 bg-primary-50 dark:border-primary-500 dark:bg-primary-950/50' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60'
            );
            return (
              <li key={topic.id}>
                {lesson ? (
                  <Link to={`/learn/lessons/${lesson.id}`} aria-current={isNext ? 'step' : undefined} className={itemClass}>{body}</Link>
                ) : (
                  <div className={itemClass}>{body}</div>
                )}
                {!formativeOnly && topic.mock_exams.map((exam) => (
                  <Link key={exam.id} to={`/learn/exams/${exam.id}`} className="ml-12 mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">
                    <Timer className="h-4 w-4" aria-hidden="true" /> {copy.mockExam} · {exam.time_limit_minutes} {copy.minutes}
                  </Link>
                ))}
              </li>
            );
          })}
        </ol>
        {planned > topics.length && <p className={clsx('mt-4 text-sm', learnSurface.muted)}>{copy.contentGap(planned - topics.length)}</p>}
      </section>

      <aside className="space-y-4">
        <section aria-labelledby="learn-papers" className={learnSurface.card}>
          <h2 id="learn-papers" className="flex items-center gap-2 font-semibold">
            <ClipboardList className="h-5 w-5 text-primary-500" aria-hidden="true" /> {copy.reviewPapers}
          </h2>
          <p className={clsx('mt-1 text-sm', learnSurface.muted)}>{copy.reviewPaperIntro}</p>
          {papers.length === 0 ? (
            <p className={clsx('mt-3 text-sm', learnSurface.muted)}>{copy.noTestsYet}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {papers.map((paper) => (
                <li key={paper.id}>
                  <Link to={`/learn/papers/${paper.id}`} className={clsx(learnSurface.secondaryButton, 'w-full justify-start')}>
                    <BookOpen className="h-4 w-4" aria-hidden="true" /> {paper.title} · {paper.duration_minutes} {copy.minutes}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        {subject.course && (
          <section className={learnSurface.subtle}>
            <p className="text-sm font-semibold">{subject.course.curriculum_code}</p>
            <p className={clsx('text-sm', learnSurface.muted)}>
              {subject.course.checkpoint_is_this_grade
                ? copy.atCheckpoint(subject.course.checkpoint_after_grade)
                : copy.towardsCheckpoint(subject.course.checkpoint_after_grade)}
            </p>
            <a href={subject.course.checkpoint_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-medium text-primary-700 hover:underline dark:text-primary-300">
              {copy.udirSource}
            </a>
          </section>
        )}
      </aside>
    </div>
  );
}
