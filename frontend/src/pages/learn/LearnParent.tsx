import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { AlertCircle, ClipboardList, GraduationCap, MessageSquareText, Send, XCircle } from 'lucide-react';
import { learnAPI } from '../../services/api';
import { useProfile } from '../../context/ProfileContext';
import Avatar from '../../components/Avatar';
import type { AssignmentTargetKind, LearnerProgress, LearnStatus, LearnSubject } from '../../types/learn';
import { learnCopy, learnSurface, newIdempotencyKey, stateBadgeClass, subjectStyle } from '../../components/learn/learnCopy';
import { assignmentTitle } from '../../components/learn/assignments';

const copy = learnCopy('nb');
const GRADE_OPTIONS = Array.from({ length: 10 }, (_, index) => index + 1);

type WorkOption = { value: string; label: string };

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-[40px] items-center gap-2 rounded-xl px-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-60"
    >
      <span className={clsx('relative h-6 w-11 rounded-full transition', checked ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-700')} aria-hidden="true">
        <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', checked ? 'left-[1.375rem]' : 'left-0.5')} />
      </span>
      {label}: {checked ? copy.on : copy.off}
    </button>
  );
}

function OpenResponseFeedback({ responseId, onSent }: { responseId: number; onSent: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await learnAPI.giveOpenResponseFeedback(responseId, text.trim());
      setText('');
      onSent();
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={send} className="mt-2 flex flex-col gap-2 sm:flex-row">
      <label className="sr-only" htmlFor={`feedback-${responseId}`}>{copy.giveFeedback}</label>
      <input
        id={`feedback-${responseId}`}
        className={learnSurface.input}
        maxLength={1000}
        placeholder={copy.feedbackPlaceholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <button type="submit" disabled={busy || !text.trim()} className={learnSurface.primaryButton}>
        <Send className="h-4 w-4" aria-hidden="true" /> {copy.sendFeedback}
      </button>
    </form>
  );
}

export default function LearnParent() {
  const { profiles } = useProfile();
  const [status, setStatus] = useState<LearnStatus | null>(null);
  const [progressByChild, setProgressByChild] = useState<Record<number, LearnerProgress>>({});
  const [showAllLessons, setShowAllLessons] = useState<Record<number, boolean>>({});
  const [childId, setChildId] = useState<number | ''>('');
  const [assignGrade, setAssignGrade] = useState<number>(8);
  const [assignSubjects, setAssignSubjects] = useState<LearnSubject[]>([]);
  const [subjectSlug, setSubjectSlug] = useState('');
  const [kind, setKind] = useState<AssignmentTargetKind>('topic');
  const [work, setWork] = useState('');
  const [note, setNote] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // One key per assignment form submission so retries cannot create duplicates
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey());

  // The profiles API is already family-scoped by the backend
  const children = useMemo(() => profiles.filter((profile) => profile.type === 'child'), [profiles]);

  const loadProgress = useCallback(async () => {
    const entries = await Promise.all(children.map(async (child) => {
      try {
        const response = await learnAPI.getChildProgress(child.id);
        return [child.id, response.data] as const;
      } catch {
        return null;
      }
    }));
    setProgressByChild(Object.fromEntries(entries.filter(Boolean) as Array<readonly [number, LearnerProgress]>));
  }, [children]);

  const load = useCallback(async () => {
    try {
      const statusResponse = await learnAPI.getStatus();
      setStatus(statusResponse.data);
      if (statusResponse.data.family_opted_in) {
        await loadProgress();
      }
    } catch (err: any) {
      setMessage({ tone: 'error', text: err?.response?.data?.error || copy.error });
    }
  }, [loadProgress]);

  useEffect(() => { load(); }, [load]);

  // Assignment catalog follows the chosen grade (parents only see reviewed content)
  useEffect(() => {
    if (!status?.family_opted_in) return;
    learnAPI.getCatalog(assignGrade)
      .then((response) => setAssignSubjects(response.data.subjects))
      .catch(() => setAssignSubjects([]));
    setWork('');
  }, [assignGrade, status?.family_opted_in]);

  const selectChild = (value: number | '') => {
    setChildId(value);
    const grade = value ? progressByChild[value]?.settings?.grade : null;
    if (grade) setAssignGrade(grade);
  };

  const toggleFamily = async () => {
    if (!status) return;
    setBusy(true);
    try {
      await learnAPI.setFamilyEnabled(!status.family_opted_in);
      await load();
    } catch (err: any) {
      setMessage({ tone: 'error', text: err?.response?.data?.error || copy.error });
    } finally {
      setBusy(false);
    }
  };

  const updateChild = async (id: number, data: { grade?: number | null; learn_enabled?: boolean; tutor_enabled?: boolean }) => {
    try {
      await learnAPI.updateChildSettings(id, data);
      await loadProgress();
    } catch (err: any) {
      setMessage({ tone: 'error', text: err?.response?.data?.error || copy.error });
    }
  };

  const subjectsForForm = subjectSlug ? assignSubjects.filter((subject) => subject.slug === subjectSlug) : assignSubjects;
  const workOptions: WorkOption[] = subjectsForForm.flatMap((subject): WorkOption[] => {
    if (kind === 'review_paper') {
      return (subject.review_papers || []).map((paper) => ({ value: `review_paper:${paper.id}`, label: paper.title }));
    }
    return subject.topics.flatMap((topic): WorkOption[] => {
      if (kind === 'topic') return topic.lessons.length ? [{ value: `topic:${topic.id}`, label: `${subject.title} – ${topic.title}` }] : [];
      if (kind === 'lesson') return topic.lessons.map((lesson) => ({ value: `lesson:${lesson.id}`, label: `${subject.title} – ${lesson.title}` }));
      return topic.mock_exams.map((exam) => ({ value: `mock_exam:${exam.id}`, label: `${subject.title} – ${exam.title}` }));
    });
  });

  const assign = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!childId || !work) return;
    const [targetKind, rawId] = work.split(':');
    const targetId = Number(rawId);
    setBusy(true);
    setMessage(null);
    try {
      await learnAPI.createAssignment({
        child_id: Number(childId),
        lesson_id: targetKind === 'lesson' ? targetId : undefined,
        topic_id: targetKind === 'topic' ? targetId : undefined,
        mock_exam_id: targetKind === 'mock_exam' ? targetId : undefined,
        review_paper_id: targetKind === 'review_paper' ? targetId : undefined,
        note: note.trim() || undefined,
        due_at: dueAt ? new Date(`${dueAt}T20:00:00`).toISOString() : undefined,
        idempotency_key: idempotencyKey
      });
      setMessage({ tone: 'ok', text: copy.assigned });
      setNote('');
      setWork('');
      setDueAt('');
      setIdempotencyKey(newIdempotencyKey());
      await loadProgress();
    } catch (err: any) {
      setMessage({ tone: 'error', text: err?.response?.data?.error || copy.error });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (assignmentId: number) => {
    await learnAPI.cancelAssignment(assignmentId);
    await loadProgress();
  };

  return (
    <div className={learnSurface.page}>
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">1.–10. trinn · LK20</p>
        <h1 className="text-2xl font-bold sm:text-3xl">{copy.parentHeading}</h1>
        <p className={clsx('mt-1 max-w-2xl', learnSurface.muted)}>{copy.parentIntro}</p>
      </header>

      <section className={clsx(learnSurface.card, 'mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between')} aria-live="polite">
        <p className="flex items-center gap-2 font-medium">
          <GraduationCap className="h-5 w-5 text-primary-500" aria-hidden="true" />
          {status?.family_opted_in ? copy.pilotOn : copy.pilotOff}
        </p>
        <button
          type="button"
          onClick={toggleFamily}
          disabled={busy || !status}
          aria-pressed={Boolean(status?.family_opted_in)}
          className={status?.family_opted_in ? learnSurface.secondaryButton : learnSurface.primaryButton}
        >
          {status?.family_opted_in ? copy.disableForFamily : copy.enableForFamily}
        </button>
      </section>

      {message && (
        <p role={message.tone === 'error' ? 'alert' : 'status'} className={clsx('mb-4 rounded-xl p-3 text-sm',
          message.tone === 'error' ? 'bg-rose-50 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100' : 'bg-emerald-50 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100')}
        >
          {message.text}
        </p>
      )}

      {status?.family_opted_in && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section aria-labelledby="children-progress">
            <h2 id="children-progress" className="mb-3 text-lg font-semibold">{copy.childrenProgress}</h2>
            {children.length === 0 && <p className={learnSurface.muted}>{copy.noChildren}</p>}
            <ul className="space-y-4">
              {children.map((child) => {
                const progress = progressByChild[child.id];
                const settings = progress?.settings;
                const assignments = (progress?.assignments || []).filter((assignment) => assignment.state !== 'cancelled');
                const pendingResponses = (progress?.open_responses || []).filter((response) => !response.feedback);
                const reviewAttempts = progress?.review_attempts || [];
                const showAll = showAllLessons[child.id];
                const lessons = (progress?.lessons || []).filter((lesson) => showAll || !settings?.grade || lesson.grade === settings.grade);
                const touched = lessons.filter((lesson) => lesson.state !== 'not_started' || lesson.practice);
                const mastered = (progress?.lessons || []).filter((lesson) => lesson.state === 'mastered').length;
                return (
                  <li key={child.id} className={learnSurface.card}>
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <Avatar avatar={child.avatar} size="md" alt={child.name} />
                      <h3 className="text-lg font-semibold">{child.name}</h3>
                      {progress && (
                        <span className={clsx('text-sm', learnSurface.muted)}>
                          {copy.states.mastered}: {mastered} · {copy.assignedWork}: {assignments.filter((a) => a.state === 'assigned').length}
                        </span>
                      )}
                    </div>
                    {!progress ? (
                      <p className={learnSurface.muted}>{copy.loading}</p>
                    ) : (
                      <>
                        <div className={clsx(learnSurface.subtle, 'mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 p-3')}>
                          <label className="flex items-center gap-2 text-sm font-medium">
                            {copy.schoolGrade}
                            <select
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                              value={settings?.grade ?? ''}
                              onChange={(event) => updateChild(child.id, { grade: event.target.value ? Number(event.target.value) : null })}
                            >
                              <option value="">{copy.notSet}</option>
                              {GRADE_OPTIONS.map((grade) => <option key={grade} value={grade}>{copy.gradeLabel(grade)}</option>)}
                            </select>
                          </label>
                          <Toggle label={copy.learnAccess} checked={Boolean(settings?.learn_enabled)} onChange={(next) => updateChild(child.id, { learn_enabled: next })} />
                          <Toggle label={copy.tutorAccess} checked={Boolean(settings?.tutor_enabled)} onChange={(next) => updateChild(child.id, { tutor_enabled: next })} />
                          {settings?.tutor_enabled && !settings.tutor_available && (
                            <span className={clsx('text-xs', learnSurface.muted)}>{copy.tutorDisabled}</span>
                          )}
                        </div>

                        {(progress.needs_practice || []).length > 0 && (
                          <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-900/40 dark:text-amber-50">
                            <p className="flex items-center gap-2 font-semibold"><AlertCircle className="h-4 w-4" aria-hidden="true" /> {copy.needsPractice}</p>
                            <ul className="mt-1 space-y-1">
                              {progress.needs_practice!.map((item) => (
                                <li key={item.lesson_id}>
                                  {item.subject_title} {copy.gradeLabel(item.grade)}: <strong>{item.lesson_title}</strong>
                                  {' – '}{item.reasons.map((reason) => copy.needsPracticeReasons[reason] || reason).join(', ')}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {pendingResponses.length > 0 && (
                          <div className="mb-4">
                            <h4 className="flex items-center gap-2 text-sm font-semibold"><MessageSquareText className="h-4 w-4" aria-hidden="true" /> {copy.awaitingFeedback}</h4>
                            <ul className="mt-2 space-y-3">
                              {pendingResponses.map((response) => (
                                <li key={response.id} className={clsx(learnSurface.subtle, 'p-3 text-sm')}>
                                  <p className={learnSurface.muted}>{response.subject_title} · {response.lesson_title}</p>
                                  {response.question && <p className="font-medium">{response.question}</p>}
                                  <p className="mt-1">“{response.response}”</p>
                                  <OpenResponseFeedback responseId={response.id} onSent={loadProgress} />
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {reviewAttempts.length > 0 && (
                          <div className="mb-4">
                            <h4 className="flex items-center gap-2 text-sm font-semibold"><ClipboardList className="h-4 w-4" aria-hidden="true" /> {copy.reviewResults}</h4>
                            <ul className="mt-2 space-y-1 text-sm">
                              {reviewAttempts.slice(0, 5).map((attempt) => (
                                <li key={attempt.id} className="flex flex-wrap items-center gap-2">
                                  <Link to={`/learn/review-attempts/${attempt.id}`} className="font-medium text-primary-700 hover:underline dark:text-primary-300">{attempt.paper_title}</Link>
                                  <span>{attempt.objective_correct}/{attempt.objective_total}</span>
                                  {attempt.topics_to_revise.length > 0 && <span className={learnSurface.muted}>· {copy.toRevise}: {attempt.topics_to_revise.join(', ')}</span>}
                                  {attempt.awaiting_feedback && (
                                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-900 dark:bg-sky-900/60 dark:text-sky-100">{copy.awaitingFeedback}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[28rem] text-left text-sm">
                            <thead className="text-xs uppercase text-slate-500 dark:text-slate-400">
                              <tr>
                                <th scope="col" className="py-2 pr-3">Tema</th>
                                <th scope="col" className="py-2 pr-3">Status</th>
                                <th scope="col" className="py-2 pr-3">Øving</th>
                                <th scope="col" className="py-2">Kort</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(showAll ? lessons : touched.length ? touched : lessons.slice(0, 5)).map((lesson) => (
                                <tr key={lesson.lesson_id} className="border-t border-slate-200 dark:border-slate-800">
                                  <th scope="row" className="py-2 pr-3 font-medium">
                                    <span aria-hidden="true">{subjectStyle(lesson.subject_slug).emoji} </span>{lesson.subject_title} {copy.gradeLabel(lesson.grade)}: {lesson.topic_title}
                                  </th>
                                  <td className="py-2 pr-3">
                                    <span className={clsx('rounded-full px-2 py-0.5 text-xs font-semibold', stateBadgeClass[lesson.state])}>{copy.states[lesson.state]}</span>
                                  </td>
                                  <td className="py-2 pr-3">
                                    {lesson.practice?.best_percent != null ? `${lesson.practice.best_percent} % · ${lesson.practice.attempts} ${copy.attempts}` : '–'}
                                  </td>
                                  <td className="py-2">{lesson.flashcards_due}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {lessons.length === 0 && <p className={clsx('py-2 text-sm', learnSurface.muted)}>{copy.noProgressYet}</p>}
                          <button
                            type="button"
                            onClick={() => setShowAllLessons({ ...showAllLessons, [child.id]: !showAll })}
                            className="mt-2 text-sm font-medium text-primary-700 hover:underline dark:text-primary-300"
                          >
                            {copy.showAll}
                          </button>
                        </div>

                        {progress.mock_attempts.length > 0 && (
                          <div className="mt-4">
                            <h4 className="text-sm font-semibold">{copy.mockExam}</h4>
                            <ul className="mt-1 space-y-1 text-sm">
                              {progress.mock_attempts.slice(0, 5).map((attempt) => (
                                <li key={attempt.id}>
                                  {attempt.exam_title}: {attempt.score}/{attempt.max_score}
                                  {attempt.outcome === 'graded' && attempt.indicative_grade !== null
                                    ? ` · ${copy.indicativeGrade.toLowerCase()} ${attempt.indicative_grade} (${copy.notOfficial.toLowerCase()})`
                                    : ` · ${copy.insufficientEvidence.toLowerCase()}`}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {assignments.length > 0 && (
                          <ul className="mt-4 space-y-2">
                            {assignments.map((assignment) => (
                              <li key={assignment.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800/70">
                                <span>
                                  <span className={learnSurface.muted}>{copy.assignmentKinds[assignment.target_kind || 'lesson']}: </span>
                                  {assignmentTitle(assignment)}
                                  {' · '}
                                  {assignment.state === 'completed'
                                    ? <span className="font-semibold text-emerald-700 dark:text-emerald-300">{copy.done}</span>
                                    : assignment.overdue
                                      ? <span className="font-semibold text-rose-700 dark:text-rose-300">{copy.overdue}</span>
                                      : assignment.due_at ? `${copy.due} ${new Date(assignment.due_at).toLocaleDateString('nb-NO')}` : ''}
                                </span>
                                {assignment.state === 'assigned' && (
                                  <button type="button" onClick={() => cancel(assignment.id)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-rose-300 dark:hover:bg-rose-900/40">
                                    <XCircle className="h-4 w-4" aria-hidden="true" /> {copy.cancelAssignment}
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="assign-work">
            <form onSubmit={assign} className={clsx(learnSurface.card, 'space-y-3 lg:sticky lg:top-4')}>
              <h2 id="assign-work" className="text-lg font-semibold">{copy.assignWork}</h2>
              <label className="block text-sm font-medium">
                {copy.chooseChild}
                <select className={clsx(learnSurface.input, 'mt-1')} value={childId} onChange={(event) => selectChild(event.target.value ? Number(event.target.value) : '')} required>
                  <option value="">—</option>
                  {children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm font-medium">
                  {copy.schoolGrade}
                  <select className={clsx(learnSurface.input, 'mt-1')} value={assignGrade} onChange={(event) => setAssignGrade(Number(event.target.value))}>
                    {GRADE_OPTIONS.map((grade) => <option key={grade} value={grade}>{copy.gradeLabel(grade)}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium">
                  {copy.chooseSubject}
                  <select className={clsx(learnSurface.input, 'mt-1')} value={subjectSlug} onChange={(event) => { setSubjectSlug(event.target.value); setWork(''); }}>
                    <option value="">{copy.allSubjects}</option>
                    {assignSubjects.map((subject) => <option key={subject.slug} value={subject.slug}>{subject.title}</option>)}
                  </select>
                </label>
              </div>
              <fieldset>
                <legend className="text-sm font-medium">{copy.workType}</legend>
                <div className="mt-1 flex flex-wrap gap-2">
                  {(['topic', 'lesson', 'review_paper', ...(assignGrade >= 8 ? ['mock_exam'] as const : [])] as AssignmentTargetKind[]).map((option) => (
                    <label key={option} className={clsx('flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm',
                      kind === option ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-950/50' : 'border-slate-200 dark:border-slate-700')}
                    >
                      <input type="radio" name="work-kind" value={option} checked={kind === option} onChange={() => { setKind(option); setWork(''); }} className="accent-primary-600" />
                      {copy.assignmentKinds[option]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="block text-sm font-medium">
                {copy.chooseWork}
                <select className={clsx(learnSurface.input, 'mt-1')} value={work} onChange={(event) => setWork(event.target.value)} required>
                  <option value="">—</option>
                  {workOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              {workOptions.length === 0 && <p className={clsx('text-sm', learnSurface.muted)}>{copy.noWorkForSelection}</p>}
              <label className="block text-sm font-medium">
                {copy.due}
                <input type="date" className={clsx(learnSurface.input, 'mt-1')} value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
              </label>
              <label className="block text-sm font-medium">
                {copy.optionalNote}
                <textarea className={clsx(learnSurface.input, 'mt-1')} rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
              <button type="submit" disabled={busy || !childId || !work} className={clsx(learnSurface.primaryButton, 'w-full')}>
                <Send className="h-4 w-4" aria-hidden="true" /> {copy.assign}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
