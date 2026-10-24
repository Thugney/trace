import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { GraduationCap, Send, XCircle } from 'lucide-react';
import { learnAPI } from '../../services/api';
import { useProfile } from '../../context/ProfileContext';
import Avatar from '../../components/Avatar';
import type { LearnerProgress, LearnStatus, LearnSubject } from '../../types/learn';
import { learnCopy, learnSurface, newIdempotencyKey, stateBadgeClass } from '../../components/learn/learnCopy';

const copy = learnCopy('nb');

type WorkOption = { value: string; label: string };

export default function LearnParent() {
  const { profiles } = useProfile();
  const [status, setStatus] = useState<LearnStatus | null>(null);
  const [subjects, setSubjects] = useState<LearnSubject[]>([]);
  const [progressByChild, setProgressByChild] = useState<Record<number, LearnerProgress>>({});
  const [childId, setChildId] = useState<number | ''>('');
  const [work, setWork] = useState('');
  const [note, setNote] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // One key per assignment form submission so retries cannot create duplicates
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey());

  // The profiles API is already family-scoped by the backend
  const children = useMemo(() => profiles.filter((profile) => profile.type === 'child'), [profiles]);

  const loadProgress = async () => {
    const entries = await Promise.all(children.map(async (child) => {
      try {
        const response = await learnAPI.getChildProgress(child.id);
        return [child.id, response.data] as const;
      } catch {
        return null;
      }
    }));
    setProgressByChild(Object.fromEntries(entries.filter(Boolean) as Array<readonly [number, LearnerProgress]>));
  };

  const load = async () => {
    try {
      const statusResponse = await learnAPI.getStatus();
      setStatus(statusResponse.data);
      if (statusResponse.data.family_opted_in) {
        const catalog = await learnAPI.getCatalog(8);
        setSubjects(catalog.data.subjects);
        await loadProgress();
      }
    } catch (err: any) {
      setMessage({ tone: 'error', text: err?.response?.data?.error || copy.error });
    }
  };

  useEffect(() => { load(); }, [children.length]);

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

  const workOptions: WorkOption[] = subjects.flatMap((subject) => subject.topics.flatMap((topic) => [
    ...topic.lessons.map((lesson) => ({ value: `lesson:${lesson.id}`, label: `${subject.title} – ${lesson.title}` })),
    ...topic.mock_exams.map((exam) => ({ value: `exam:${exam.id}`, label: `${subject.title} – ${exam.title}` }))
  ]));

  const assign = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!childId || !work) return;
    const [kind, rawId] = work.split(':');
    setBusy(true);
    setMessage(null);
    try {
      await learnAPI.createAssignment({
        child_id: Number(childId),
        lesson_id: kind === 'lesson' ? Number(rawId) : undefined,
        mock_exam_id: kind === 'exam' ? Number(rawId) : undefined,
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
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">{copy.grade8} · LK20</p>
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
                const openAssignments = (progress?.assignments || []).filter((assignment) => assignment.state !== 'cancelled');
                return (
                  <li key={child.id} className={learnSurface.card}>
                    <div className="mb-3 flex items-center gap-3">
                      <Avatar avatar={child.avatar} size="md" alt={child.name} />
                      <h3 className="text-lg font-semibold">{child.name}</h3>
                    </div>
                    {!progress ? (
                      <p className={learnSurface.muted}>{copy.loading}</p>
                    ) : (
                      <>
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
                              {progress.lessons.map((lesson) => (
                                <tr key={lesson.lesson_id} className="border-t border-slate-200 dark:border-slate-800">
                                  <th scope="row" className="py-2 pr-3 font-medium">{lesson.subject_title}: {lesson.topic_title}</th>
                                  <td className="py-2 pr-3">
                                    <span className={clsx('rounded-full px-2 py-0.5 text-xs font-semibold', stateBadgeClass[lesson.state])}>{copy.states[lesson.state]}</span>
                                  </td>
                                  <td className="py-2 pr-3">{lesson.practice?.best_percent != null ? `${lesson.practice.best_percent} %` : '–'}</td>
                                  <td className="py-2">{lesson.flashcards_due}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
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
                        {openAssignments.length > 0 && (
                          <ul className="mt-4 space-y-2">
                            {openAssignments.map((assignment) => (
                              <li key={assignment.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800/70">
                                <span>
                                  {assignment.lesson_title || assignment.mock_exam_title}
                                  {' · '}
                                  {assignment.state === 'completed' ? copy.done : assignment.due_at ? `${copy.due} ${new Date(assignment.due_at).toLocaleDateString('nb-NO')}` : ''}
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
                <select className={clsx(learnSurface.input, 'mt-1')} value={childId} onChange={(event) => setChildId(event.target.value ? Number(event.target.value) : '')} required>
                  <option value="">—</option>
                  {children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium">
                {copy.chooseWork}
                <select className={clsx(learnSurface.input, 'mt-1')} value={work} onChange={(event) => setWork(event.target.value)} required>
                  <option value="">—</option>
                  {workOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
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
              {workOptions.length === 0 && <p className={clsx('text-sm', learnSurface.muted)}>{copy.noReviewedContent}</p>}
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
