import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle, ArrowLeft, ArrowRight, ClipboardList, ListChecks, Sparkles, Timer } from 'lucide-react';
import { learnAPI } from '../../services/api';
import type { LearnLesson, LearnMockExamSummary, WorkedExample } from '../../types/learn';
import { learnCopy, learnSurface, subjectStyle } from '../../components/learn/learnCopy';
import GoalPanel from '../../components/learn/GoalPanel';
import LessonPractice from '../../components/learn/LessonPractice';
import LessonFlashcards from '../../components/learn/LessonFlashcards';
import OpenResponsePanel from '../../components/learn/OpenResponsePanel';
import TutorPanel from '../../components/learn/TutorPanel';

type Tab = 'read' | 'practice' | 'cards' | 'tutor' | 'exam';
const ALL_TABS: Tab[] = ['read', 'practice', 'cards', 'tutor', 'exam'];

function WorkedExampleCard({ example, locale }: { example: WorkedExample; locale: LearnLesson['locale'] }) {
  const copy = learnCopy(locale);
  const [shown, setShown] = useState(0);
  const allShown = shown >= example.steps.length;

  return (
    <li className={learnSurface.subtle}>
      <h4 className="font-semibold">{example.title}</h4>
      <p className="mt-1">{example.problem}</p>
      {example.steps.length > 0 && (
        <ol className="mt-3 list-decimal space-y-1 pl-5" aria-live="polite">
          {example.steps.slice(0, shown).map((step, index) => <li key={index}>{step}</li>)}
        </ol>
      )}
      {allShown ? (
        example.answer && (
          <p className="mt-3 rounded-lg bg-emerald-100 px-3 py-2 font-semibold text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100">{example.answer}</p>
        )
      ) : (
        <button type="button" onClick={() => setShown(shown + 1)} className={clsx(learnSurface.secondaryButton, 'mt-3')}>
          {shown === example.steps.length - 1 ? copy.showAnswer : copy.showNextStep}
        </button>
      )}
    </li>
  );
}

export default function LessonPage() {
  const { lessonId } = useParams();
  const id = Number(lessonId);
  const [lesson, setLesson] = useState<LearnLesson | null>(null);
  const [exams, setExams] = useState<LearnMockExamSummary[]>([]);
  const [tab, setTab] = useState<Tab>('read');
  const [error, setError] = useState<string | null>(null);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ read: null, practice: null, cards: null, tutor: null, exam: null });

  const load = useCallback(async () => {
    try {
      const response = await learnAPI.getLesson(id);
      setLesson(response.data);
      const topic = await learnAPI.getTopic(response.data.topic_id);
      setExams(topic.data.mock_exams || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || learnCopy('nb').error);
    }
  }, [id]);

  useEffect(() => {
    if (Number.isInteger(id)) {
      setTab('read');
      setLesson(null);
      load();
      // Opening the article counts as starting to read; never a score
      learnAPI.markRead(id).catch(() => undefined);
    }
  }, [id, load]);

  if (error) {
    return <div className={learnSurface.page}><p role="alert" className="text-red-700 dark:text-red-300">{error}</p></div>;
  }

  if (!lesson) {
    return <div className={learnSurface.page}><p className={learnSurface.muted} role="status">{learnCopy('nb').loading}</p></div>;
  }

  const copy = learnCopy(lesson.locale);
  const style = subjectStyle(lesson.topic.subject_slug);
  const grade = lesson.topic.grade;
  const formativeOnly = lesson.assessment_policy?.formative_only ?? grade <= 7;
  const tabs = ALL_TABS.filter((item) => item !== 'tutor' || lesson.tutor_available !== false);
  const visibleExams = formativeOnly ? [] : exams;
  const papers = lesson.review_papers || [];

  // Arrow-key navigation between tabs (WAI-ARIA tabs pattern)
  const onTabKeyDown = (event: React.KeyboardEvent, current: Tab) => {
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!offset) return;
    event.preventDefault();
    const nextTab = tabs[(tabs.indexOf(current) + offset + tabs.length) % tabs.length];
    setTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  return (
    <div className={clsx(tab === 'tutor' ? 'tutor-page min-h-full rounded-3xl p-4 sm:p-6' : learnSurface.page)} lang={lesson.locale === 'en' ? 'en' : 'nb'}>
      <Link to="/learn" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {copy.backToLearn}
      </Link>

      <header className="mb-4">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {style.emoji} {lesson.topic.subject_title} · {copy.gradeLabel(grade)}
          {lesson.course_nav && <> · {copy.stepOf(lesson.course_nav.position)}</>}
          {lesson.meta?.estimated_minutes && <> · {copy.aboutMinutes(lesson.meta.estimated_minutes)}</>}
        </p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{tab === 'tutor' ? (lesson.locale === 'en' ? "Let’s work it out together." : "Vi finner ut av det sammen.") : lesson.title}</h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          v{lesson.version} · {lesson.authored_by}
          {lesson.reviewed_at && <> · {copy.reviewedBy} {new Date(lesson.reviewed_at).toLocaleDateString('nb-NO')}</>}
        </p>
      </header>

      {lesson.review_status !== 'reviewed' && (
        <p className="mb-4 rounded-xl bg-amber-100 p-3 text-sm font-medium text-amber-900 dark:bg-amber-900/50 dark:text-amber-100" role="note">
          {copy.draftBanner}
        </p>
      )}
      {(lesson.content_warnings || []).length > 0 && (
        <ul className="mb-4 space-y-1 rounded-xl bg-rose-50 p-3 text-sm text-rose-900 dark:bg-rose-950/60 dark:text-rose-100" role="note">
          {lesson.content_warnings!.map((warning) => (
            <li key={warning} className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 flex-none" aria-hidden="true" /> {warning}</li>
          ))}
        </ul>
      )}

      <div role="tablist" aria-label={lesson.title} className="mb-4 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        {tabs.map((item) => (
          <button
            key={item}
            ref={(element) => { tabRefs.current[item] = element; }}
            role="tab"
            id={`lesson-tab-${item}`}
            aria-selected={tab === item}
            aria-controls={`lesson-panel-${item}`}
            tabIndex={tab === item ? 0 : -1}
            onClick={() => setTab(item)}
            onKeyDown={(event) => onTabKeyDown(event, item)}
            className={clsx(
              'min-h-[44px] flex-none rounded-xl px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
              tab === item ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            )}
          >
            {copy.lessonTabs[item]}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`lesson-panel-${tab}`} aria-labelledby={`lesson-tab-${tab}`} tabIndex={0} className="focus:outline-none">
        {tab === 'read' && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <article className={clsx(learnSurface.card, 'space-y-6 text-[1.05rem] leading-relaxed')}>
              <p className="text-lg">{lesson.body.intro}</p>
              {lesson.body.sections.map((section, sectionIndex) => (
                <section key={section.heading} id={`lesson-section-${sectionIndex}`} tabIndex={-1}>
                  <h2 className="text-xl font-semibold">{section.heading}</h2>
                  {section.paragraphs.map((paragraph, index) => <p key={index} className="mt-2">{paragraph}</p>)}
                  {section.bullets && (
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {section.bullets.map((bullet, index) => <li key={index}>{bullet}</li>)}
                    </ul>
                  )}
                </section>
              ))}
              {lesson.body.workedExamples.length > 0 && (
                <section>
                  <h2 className="text-xl font-semibold">{copy.workedExamples}</h2>
                  <ul className="mt-3 space-y-3">
                    {lesson.body.workedExamples.map((example) => (
                      <WorkedExampleCard key={example.title} example={example} locale={lesson.locale} />
                    ))}
                  </ul>
                </section>
              )}
              {lesson.body.keyTakeaway && (
                <aside className="flex gap-3 rounded-xl border border-primary-200 bg-primary-50 p-4 text-primary-950 dark:border-primary-800 dark:bg-primary-950/50 dark:text-primary-50">
                  <Sparkles className="h-5 w-5 flex-none text-primary-500" aria-hidden="true" />
                  <div>
                    <h2 className="font-semibold">{copy.keyTakeaway}</h2>
                    <p className="mt-1">{lesson.body.keyTakeaway}</p>
                  </div>
                </aside>
              )}
            </article>

            <aside className="space-y-4">
              <GoalPanel goals={lesson.topic.goals} udirCode={lesson.meta?.curriculum?.code || lesson.topic.udir_code} locale={lesson.locale} grade={grade} />
              {lesson.body.keyTerms.length > 0 && (
                <section className={learnSurface.card} aria-labelledby="key-terms">
                  <h2 id="key-terms" className="font-semibold">{copy.keyTerms}</h2>
                  <dl className="mt-2 space-y-2 text-sm">
                    {lesson.body.keyTerms.map((term) => (
                      <div key={term.term}>
                        <dt className="font-semibold">{term.term}</dt>
                        <dd className={learnSurface.muted}>{term.definition}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
              <section className={learnSurface.card} aria-labelledby="check-yourself">
                <h2 id="check-yourself" className="flex items-center gap-2 font-semibold">
                  <ListChecks className="h-4 w-4" aria-hidden="true" /> {copy.checkYourself}
                </h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {lesson.body.checkYourself.map((item) => <li key={item}>{item}</li>)}
                </ul>
                <button type="button" onClick={() => setTab('practice')} className={clsx(learnSurface.primaryButton, 'mt-4 w-full')}>
                  {copy.startPractice}
                </button>
              </section>
            </aside>
          </div>
        )}

        {tab === 'practice' && (
          <>
            <LessonPractice lessonId={lesson.id} locale={lesson.locale} result={lesson.practice_result} onCompleted={load} />
            <OpenResponsePanel
              lessonId={lesson.id}
              locale={lesson.locale}
              prompts={lesson.open_prompts || []}
              responses={lesson.open_responses || []}
              onSaved={load}
            />
          </>
        )}

        {tab === 'cards' && <LessonFlashcards lessonId={lesson.id} locale={lesson.locale} />}

        {tab === 'tutor' && <TutorPanel key={lesson.id} lessonId={lesson.id} locale={lesson.locale} practice={lesson.practice}
          lessonTitle={lesson.title} sections={lesson.review_status === 'reviewed' ? lesson.body.sections : []}
          onReadSection={(index) => { setTab('read'); requestAnimationFrame(() => { const section = document.getElementById(`lesson-section-${index}`); section?.scrollIntoView({ block: 'center' }); section?.focus(); }); }}
          onPractice={() => { setTab('practice'); requestAnimationFrame(() => tabRefs.current.practice?.focus()); }} />}

        {tab === 'exam' && (
          <div className={clsx(learnSurface.card, 'space-y-4')}>
            {formativeOnly && <p className="text-sm font-medium">{copy.formativeNote}</p>}
            <section>
              <h2 className="flex items-center gap-2 font-semibold"><ClipboardList className="h-4 w-4" aria-hidden="true" /> {copy.reviewPaper}</h2>
              <p className={clsx('text-sm', learnSurface.muted)}>{copy.reviewPaperIntro}</p>
              <ul className="mt-3 space-y-2">
                {papers.map((paper) => (
                  <li key={paper.id}>
                    <Link to={`/learn/papers/${paper.id}`} className={learnSurface.primaryButton}>{paper.title} · {paper.duration_minutes} {copy.minutes}</Link>
                  </li>
                ))}
              </ul>
            </section>
            {visibleExams.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 font-semibold"><Timer className="h-4 w-4" aria-hidden="true" /> {copy.mockExam}</h2>
                <p className={clsx('text-sm', learnSurface.muted)}>{copy.examIntro}</p>
                <ul className="mt-3 space-y-2">
                  {visibleExams.map((exam) => (
                    <li key={exam.id}>
                      <Link to={`/learn/exams/${exam.id}`} className={learnSurface.secondaryButton}>
                        <Timer className="h-4 w-4" aria-hidden="true" /> {exam.title} · {exam.time_limit_minutes} {copy.minutes}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {papers.length === 0 && visibleExams.length === 0 && <p className={learnSurface.muted}>{copy.noTestsYet}</p>}
          </div>
        )}
      </div>

      {lesson.course_nav && (lesson.course_nav.previous || lesson.course_nav.next) && (
        <nav aria-label={lesson.course_nav.course_title} className="mt-6 grid gap-3 sm:grid-cols-2">
          {lesson.course_nav.previous ? (
            <Link to={`/learn/lessons/${lesson.course_nav.previous.lesson_id}`} className={clsx(learnSurface.card, 'flex items-center gap-3 p-4 hover:border-primary-300')}>
              <ArrowLeft className="h-5 w-5 flex-none text-primary-500" aria-hidden="true" />
              <span><span className={clsx('block text-xs', learnSurface.muted)}>{copy.previousTopic}</span>{lesson.course_nav.previous.title}</span>
            </Link>
          ) : <span />}
          {lesson.course_nav.next && (
            <Link to={`/learn/lessons/${lesson.course_nav.next.lesson_id}`} className={clsx(learnSurface.card, 'flex items-center justify-end gap-3 p-4 text-right hover:border-primary-300')}>
              <span><span className={clsx('block text-xs', learnSurface.muted)}>{copy.nextTopic}</span>{lesson.course_nav.next.title}</span>
              <ArrowRight className="h-5 w-5 flex-none text-primary-500" aria-hidden="true" />
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
