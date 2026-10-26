import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle, ArrowLeft, BadgeCheck, CheckCircle2, ExternalLink, FileSearch, KeyRound } from 'lucide-react';
import { learnAPI } from '../../services/api';
import type { ContentImportStatus, ReviewLessonDetail, ReviewPaperDetail, ReviewQueue, ReviewStatus } from '../../types/learn';
import { learnCopy, learnSurface, SUBJECT_STYLE } from '../../components/learn/learnCopy';

const copy = learnCopy('nb');
const GRADES = Array.from({ length: 10 }, (_, index) => index + 1);

const statusClass: Record<ReviewStatus, string> = {
  draft: 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100',
  reviewed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
  retired: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
};

const WARNING_TEXT: Record<string, string> = {
  article_model_answer_disagrees_with_practice_key: 'Artikkelens modellsvar stemmer ikke med fasiten i øvingen (fasiten brukes).',
  title_missing_in_source_used_slug: 'Tittel mangler i kilden – tittelen er laget av sluggen. Bekreft den.',
  title_missing_in_source_used_grade8_topic_map: 'Tittel mangler i kilden – tittelen er hentet fra 8.-trinns temakartet. Bekreft den.'
};

function LessonAnswerKey({ lessonId }: { lessonId: number }) {
  const [detail, setDetail] = useState<ReviewLessonDetail | null>(null);
  useEffect(() => { learnAPI.getReviewLessonDetail(lessonId).then((response) => setDetail(response.data)); }, [lessonId]);
  if (!detail) return <p className={clsx('mt-2 text-sm', learnSurface.muted)}>{copy.loading}</p>;
  return (
    <div className="mt-3 space-y-3 text-sm">
      {detail.practice_items.map((item) => (
        <div key={item.key} className={learnSurface.subtle}>
          <p className="font-semibold">{item.content.question}</p>
          <ul className="mt-1 space-y-0.5">
            {(item.content.options || []).map((option) => (
              <li key={option.id} className={clsx(option.id === item.correct.correctAnswer && 'font-semibold text-emerald-700 dark:text-emerald-300')}>
                {option.id}. {option.text} {option.id === item.correct.correctAnswer && <CheckCircle2 className="inline h-4 w-4" aria-label="fasit" />}
              </li>
            ))}
          </ul>
          <p className={clsx('mt-1', learnSurface.muted)}>Forklaring: {item.explanation}</p>
        </div>
      ))}
      {detail.open_prompts.map((prompt) => (
        <div key={prompt.key} className={learnSurface.subtle}>
          <p className="font-semibold">{prompt.question}</p>
          <p className={clsx('mt-1', learnSurface.muted)}>Modellsvar: {prompt.model_answer}</p>
        </div>
      ))}
      <div className={learnSurface.subtle}>
        <p className="font-semibold">Kort</p>
        <ul className="mt-1 list-disc pl-5">{detail.flashcards.map((card) => <li key={card.key}>{card.front} → {card.back}</li>)}</ul>
      </div>
      {detail.content_meta.source && (
        <p className={clsx('text-xs', learnSurface.muted)}>Kilde: {detail.content_meta.source.file} · {detail.content_meta.source.content_id}</p>
      )}
    </div>
  );
}

function PaperAnswerKey({ paperId }: { paperId: number }) {
  const [detail, setDetail] = useState<ReviewPaperDetail | null>(null);
  useEffect(() => { learnAPI.getReviewPaperDetail(paperId).then((response) => setDetail(response.data)); }, [paperId]);
  if (!detail) return <p className={clsx('mt-2 text-sm', learnSurface.muted)}>{copy.loading}</p>;
  return (
    <div className="mt-3 space-y-2 text-sm">
      <p>{detail.instructions}</p>
      <p className={learnSurface.muted}>Karakter: {detail.score_policy.numeric_grade_allowed ? 'tillatt' : 'ikke tillatt'} – {detail.score_policy.reason}</p>
      <ol className="list-decimal space-y-2 pl-5">
        {detail.items.map((item) => (
          <li key={item.id}>
            <p className="font-medium">{item.prompt}</p>
            {item.kind === 'single_select'
              ? <p className="text-emerald-700 dark:text-emerald-300">Fasit: {item.correct_key} – {item.correct_answer}</p>
              : <p className={learnSurface.muted}>Forventet innhold: {item.expected_content}</p>}
          </li>
        ))}
      </ol>
      <p className={clsx('text-xs', learnSurface.muted)}>
        Kildeleksjoner: {detail.source_lessons.map((lesson) => `${lesson.title} (${lesson.review_status})`).join(', ')}
      </p>
    </div>
  );
}

// Package validation notices, explained for the reviewer. They describe the source data
// (docs/learn) and need an editorial fix there; none of them blocks import or reaches learners.
const NOTICE_TEXT: Record<string, { title: (count: number) => string; detail: string }> = {
  untitled_lessons: {
    title: (count) => `${count} leksjoner mangler tittel i kildefilene`,
    detail: 'Alle engelsk-leksjonene mangler feltet «title». Visningstittelen hentes fra temakartet for 8. trinn eller lages av sluggen (f.eks. «colours-around-us» → «Colours around us»). Bekreft eller rett tittelen før godkjenning.'
  },
  article_model_answer_mismatch: {
    title: (count) => `${count} leksjoner har et modellsvar i artikkelen som ikke stemmer med fasiten`,
    detail: 'Feltet article.model_answer peker på et annet svar enn øvingsoppgavens fasit. Fasiten i øvingen (som også stemmer med repetisjonsprøvene) brukes, og det motstridende feltet vises aldri for elever. Kildefilen bør rettes.'
  },
  grade8_preserve_flag_mismatch: {
    title: (count) => `${count} leksjoner på 8. trinn er feilmerket som eksisterende pilottemaer`,
    detail: 'Leksjonene sier at de bevarer et eksisterende tema fra pilot (PR #9), men temakartet sier at bare fem temaer gjør det. Temakartet følges, så pilotleksjonene beholdes og de nye legges til som egne temaer.'
  },
  assessment_mode_naming: {
    title: () => 'Vurderingsformen for 8.–10. trinn har to ulike navn',
    detail: 'Kurskartet og leksjonene bruker forskjellige navn på samme regel: formativ øving, og bare ikke-offisielle resultater. Begge behandles likt, og repetisjonsprøvene gir aldri karakter.'
  },
  answer_key_skew: {
    title: (count) => `Fasiten står på samme bokstav i ${count} oppgaver`,
    detail: 'Over halvparten av fasitene står på samme svaralternativ. Vurder å bytte rekkefølgen på alternativene i kilden.'
  }
};

// Admin-only: approve research-package drafts before learners can see them, and verify goal mappings
export default function LearnReview() {
  const [queue, setQueue] = useState<ReviewQueue | null>(null);
  const [imports, setImports] = useState<ContentImportStatus | null>(null);
  const [grade, setGrade] = useState<number | ''>(1);
  const [subject, setSubject] = useState('');
  const [status, setStatus] = useState<ReviewStatus | ''>('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const filters = { grade: grade || undefined, subject: subject || undefined, status: status || undefined };
      setQueue((await learnAPI.getReviewQueue(filters)).data);
    } catch (err: any) {
      setError(err?.response?.data?.error || copy.error);
    }
  }, [grade, subject, status]);

  useEffect(() => { load(); }, [grade, subject, status, load]);

  const loadImports = async () => {
    try {
      setImports((await learnAPI.getContentImport()).data);
    } catch {
      setImports(null);
    }
  };

  useEffect(() => { loadImports(); }, []);

  const act = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || copy.error);
    }
  };

  const runImport = async (dryRun: boolean) => {
    if (!dryRun && !window.confirm('Importere pakken som utkast? Eksisterende og godkjent innhold endres ikke.')) return;
    setNotice(null);
    try {
      const response: any = await learnAPI.runContentImport(dryRun);
      const created = response.data.summary?.created || {};
      const refreshed = response.data.summary?.refreshed || {};
      const skipped = response.data.summary?.skipped?.length ?? 0;
      setNotice(
        `${dryRun ? 'Tørrkjøring' : 'Import'} OK – nye leksjoner: ${created.lessons ?? 0}, nye repetisjonsprøver: ${created.review_papers ?? 0}, ` +
        `rettede utkast: ${(refreshed.lessons ?? 0) + (refreshed.review_papers ?? 0)}, hoppet over (godkjent eller i bruk): ${skipped}.`
      );
      await Promise.all([loadImports(), load()]);
    } catch (err: any) {
      setError(err?.response?.data?.validation?.errors?.[0] || err?.response?.data?.error || copy.error);
    }
  };

  const statusButtons = (current: ReviewStatus, onChange: (next: ReviewStatus) => void) => (
    <div className="flex flex-wrap gap-2">
      {current !== 'reviewed' && <button type="button" onClick={() => onChange('reviewed')} className={learnSurface.primaryButton}>{copy.approve}</button>}
      {current !== 'draft' && <button type="button" onClick={() => onChange('draft')} className={learnSurface.secondaryButton}>{copy.backToDraft}</button>}
      {current !== 'retired' && <button type="button" onClick={() => onChange('retired')} className={learnSurface.secondaryButton}>{copy.retire}</button>}
    </div>
  );

  const toggle = (key: string) => setExpanded(expanded === key ? null : key);
  const totals = (kind: string) => (queue?.totals || []).filter((row) => row.kind === kind)
    .map((row) => `${row.review_status}: ${row.n}`).join(' · ');
  const latestRun = imports?.runs.find((run) => !run.dry_run);

  return (
    <div className={learnSurface.page}>
      <Link to="/learn" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {copy.backToLearn}
      </Link>
      <h1 className="mb-1 text-2xl font-bold">{copy.reviewQueue}</h1>
      <p className={clsx('mb-6 max-w-3xl text-sm', learnSurface.muted)}>
        Les hver leksjon og repetisjonsprøve, kontroller fakta, fasit og kobling til kompetansemål mot udir.no før du godkjenner.
        Godkjenning registreres med ditt navn og tidspunkt, og gjelder bare den versjonen du godkjenner.
      </p>
      {error && <p role="alert" className="mb-4 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">{notice}</p>}

      <section aria-labelledby="import-status" className={clsx(learnSurface.card, 'mb-6')}>
        <h2 id="import-status" className="flex items-center gap-2 text-lg font-semibold"><FileSearch className="h-5 w-5" aria-hidden="true" /> Innholdspakke (1.–10. trinn)</h2>
        {!imports ? <p className={learnSurface.muted}>{copy.loading}</p> : (
          <>
            <p className="mt-1 text-sm">
              Validering: <strong className={imports.validation?.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}>
                {imports.validation?.ok ? 'bestått' : 'feilet'}
              </strong>
              {latestRun && <> · Sist importert {new Date(latestRun.created_at).toLocaleString('nb-NO')}</>}
            </p>
            {(imports.validation?.errors || []).slice(0, 5).map((item) => <p key={item} className="text-sm text-rose-700 dark:text-rose-300">{item}</p>)}
            {(latestRun?.summary?.skipped || []).length > 0 && (
              <details className="mt-3 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800/70">
                <summary className="cursor-pointer font-semibold">
                  {latestRun!.summary.skipped!.length} godkjente eller brukte leksjoner er eldre enn kildefilene
                </summary>
                <p className={clsx('mt-1', learnSurface.muted)}>
                  Disse ble ikke endret, fordi de er godkjent eller allerede brukt av et barn. Rettelsen må komme som en ny versjon
                  (øk «version» i kildefilen), som så må godkjennes.
                </p>
                <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
                  {latestRun!.summary.skipped!.map((item) => {
                    const contentId = item.split(' ')[0];
                    const lessonId = imports.validation?.lesson_links?.[contentId];
                    return (
                      <li key={item}>
                        {lessonId ? <Link to={`/learn/lessons/${lessonId}`} className="text-primary-700 hover:underline dark:text-primary-300">{contentId}</Link> : contentId}
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}
            {imports.validation?.ok && (imports.validation.notices || []).length === 0 && (
              <p className="mt-2 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Ingen avvik i kildedataene.
              </p>
            )}
            {(imports.validation?.notices || []).length > 0 && (
              <>
                <p className={clsx('mt-3 text-sm', learnSurface.muted)}>
                  Pakken er importert, men kildedataene har disse avvikene. De stopper ikke importen og vises ikke for elever.
                  Rett dem i kildefilene (docs/learn), kjør <code>npm run learn:sync-content</code> og importer på nytt:
                  utkast som ingen har brukt, oppdateres da automatisk.
                </p>
                <ul className="mt-2 space-y-2 text-sm">
                  {imports.validation!.notices!.map((notice) => {
                    const text = NOTICE_TEXT[notice.code];
                    return (
                      <li key={notice.code} className="flex gap-2 rounded-xl bg-amber-50 p-3 text-amber-950 dark:bg-amber-900/30 dark:text-amber-50">
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-600" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="font-semibold">{text ? text.title(notice.count) : notice.code}</p>
                          {text && <p className="mt-0.5">{text.detail}</p>}
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs font-medium">Vis berørte leksjoner ({notice.examples.length})</summary>
                            <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
                              {notice.examples.map((example) => {
                                const lessonId = imports.validation?.lesson_links?.[example];
                                return (
                                  <li key={example}>
                                    {lessonId
                                      ? <Link to={`/learn/lessons/${lessonId}`} className="text-primary-700 underline-offset-2 hover:underline dark:text-primary-300">{example}</Link>
                                      : example}
                                  </li>
                                );
                              })}
                            </ul>
                          </details>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => runImport(true)} className={learnSurface.secondaryButton}>Tørrkjør import</button>
              <button type="button" onClick={() => runImport(false)} className={learnSurface.secondaryButton} disabled={!imports.validation?.ok}>Importer som utkast</button>
            </div>
          </>
        )}
      </section>

      <div className="mb-4 flex flex-wrap gap-3">
        <label className="text-sm font-medium">
          {copy.schoolGrade}
          <select className={clsx(learnSurface.input, 'mt-1 w-40')} value={grade} onChange={(event) => setGrade(event.target.value ? Number(event.target.value) : '')}>
            <option value="">Alle</option>
            {GRADES.map((value) => <option key={value} value={value}>{copy.gradeLabel(value)}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">
          {copy.chooseSubject}
          <select className={clsx(learnSurface.input, 'mt-1 w-44')} value={subject} onChange={(event) => setSubject(event.target.value)}>
            <option value="">{copy.allSubjects}</option>
            {Object.keys(SUBJECT_STYLE).map((slug) => <option key={slug} value={slug}>{SUBJECT_STYLE[slug].emoji} {slug}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">
          Status
          <select className={clsx(learnSurface.input, 'mt-1 w-40')} value={status} onChange={(event) => setStatus(event.target.value as ReviewStatus | '')}>
            <option value="">Alle</option>
            <option value="draft">draft</option>
            <option value="reviewed">reviewed</option>
            <option value="retired">retired</option>
          </select>
        </label>
      </div>

      {!queue && !error && <p className={learnSurface.muted} role="status">{copy.loading}</p>}

      {queue && (
        <div className="grid gap-6 xl:grid-cols-3">
          <section aria-labelledby="review-lessons" className="space-y-3">
            <h2 id="review-lessons" className="text-lg font-semibold">Leksjoner ({queue.lessons.length})</h2>
            <p className={clsx('text-xs', learnSurface.muted)}>Totalt · {totals('lessons')}</p>
            {queue.lessons.map((lesson) => (
              <article key={lesson.id} className={learnSurface.card}>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lesson.subject_title} · {lesson.grade ? copy.gradeLabel(lesson.grade) : ''} · v{lesson.version} · {lesson.locale}
                  {!lesson.content_id && ' · pilot (PR #9)'}
                </p>
                <h3 className="font-semibold"><Link to={`/learn/lessons/${lesson.id}`} className="hover:underline">{lesson.title}</Link></h3>
                <span className={clsx('mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold', statusClass[lesson.review_status])}>{lesson.review_status}</span>
                {(lesson.content_warnings || []).map((warning) => (
                  <p key={warning} className="mt-2 flex gap-1 text-xs text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="h-3.5 w-3.5 flex-none" aria-hidden="true" /> {WARNING_TEXT[warning] || warning}
                  </p>
                ))}
                <button type="button" onClick={() => toggle(`lesson-${lesson.id}`)} aria-expanded={expanded === `lesson-${lesson.id}`} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">
                  <KeyRound className="h-4 w-4" aria-hidden="true" /> Fasit og kort
                </button>
                {expanded === `lesson-${lesson.id}` && <LessonAnswerKey lessonId={lesson.id} />}
                <div className="mt-3">{statusButtons(lesson.review_status, (next) => act(() => learnAPI.reviewLesson(lesson.id, next)))}</div>
              </article>
            ))}
          </section>

          <section aria-labelledby="review-papers" className="space-y-3">
            <h2 id="review-papers" className="text-lg font-semibold">Repetisjonsprøver ({queue.review_papers?.length ?? 0})</h2>
            <p className={clsx('text-xs', learnSurface.muted)}>Totalt · {totals('review_papers')}</p>
            {(queue.review_papers || []).map((paper) => (
              <article key={paper.id} className={learnSurface.card}>
                <p className="text-xs text-slate-500 dark:text-slate-400">{paper.subject_title} · {copy.gradeLabel(paper.grade)} · v{paper.version} · {paper.duration_minutes} min</p>
                <h3 className="font-semibold"><Link to={`/learn/papers/${paper.id}`} className="hover:underline">{paper.title}</Link></h3>
                <span className={clsx('mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold', statusClass[paper.review_status])}>{paper.review_status}</span>
                <button type="button" onClick={() => toggle(`paper-${paper.id}`)} aria-expanded={expanded === `paper-${paper.id}`} className="mt-2 flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">
                  <KeyRound className="h-4 w-4" aria-hidden="true" /> Oppgaver og fasit
                </button>
                {expanded === `paper-${paper.id}` && <PaperAnswerKey paperId={paper.id} />}
                <div className="mt-3">{statusButtons(paper.review_status, (next) => act(() => learnAPI.reviewPaper(paper.id, next)))}</div>
              </article>
            ))}

            {queue.mock_exams.length > 0 && <h2 className="pt-4 text-lg font-semibold">Øvingsprøver (8. trinn, pilot)</h2>}
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
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {goal.subject_title} · {goal.curriculum_revision || goal.udir_code} · etter {goal.goal_after_grade}. trinn
                  {goal.goal_level === 'checkpoint' && ' · trinnside'}
                </p>
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
