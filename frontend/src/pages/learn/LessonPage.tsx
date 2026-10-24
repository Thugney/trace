import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, ListChecks, Timer } from 'lucide-react';
import { learnAPI } from '../../services/api';
import type { LearnLesson, LearnMockExamSummary, WorkedExample } from '../../types/learn';
import { learnCopy, learnSurface, subjectStyle } from '../../components/learn/learnCopy';
import GoalPanel from '../../components/learn/GoalPanel';
import LessonPractice from '../../components/learn/LessonPractice';
import LessonFlashcards from '../../components/learn/LessonFlashcards';
import TutorPanel from '../../components/learn/TutorPanel';

type Tab = 'read' | 'practice' | 'cards' | 'tutor' | 'exam';
const TABS: Tab[] = ['read', 'practice', 'cards', 'tutor', 'exam'];

function WorkedExampleCard({ example, locale }: { example: WorkedExample; locale: LearnLesson['locale'] }) {
  const copy = learnCopy(locale);
  const [shown, setShown] = useState(0);
  const allShown = shown >= example.steps.length;

  return (
    <li className={learnSurface.subtle}>
      <h4 className="font-semibold">{example.title}</h4>
      <p className="mt-1">{example.problem}</p>
      <ol className="mt-3 list-decimal space-y-1 pl-5" aria-live="polite">
        {example.steps.slice(0, shown).map((step, index) => <li key={index}>{step}</li>)}
      </ol>
      {allShown ? (
        <p className="mt-3 rounded-lg bg-emerald-100 px-3 py-2 font-semibold text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100">{example.answer}</p>
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

  const load = async () => {
    try {
      const response = await learnAPI.getLesson(id);
      setLesson(response.data);
      const catalog = await learnAPI.getCatalog(8);
      const topic = catalog.data.subjects.flatMap((subject) => subject.topics).find((item) => item.id === response.data.topic_id);
      setExams(topic?.mock_exams || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || learnCopy('nb').error);
    }
  };

  useEffect(() => {
    if (Number.isInteger(id)) {
      load();
      // Opening the article counts as starting to read; never a score
      learnAPI.markRead(id).catch(() => undefined);
    }
  }, [id]);

  if (error) {
    return <div className={learnSurface.page}><p role="alert" className="text-red-700 dark:text-red-300">{error}</p></div>;
  }

  if (!lesson) {
    return <div className={learnSurface.page}><p className={learnSurface.muted} role="status">{learnCopy('nb').loading}</p></div>;
  }

  const copy = learnCopy(lesson.locale);
  const style = subjectStyle(lesson.topic.subject_slug);

  // Arrow-key navigation between tabs (WAI-ARIA tabs pattern)
  const onTabKeyDown = (event: React.KeyboardEvent, current: Tab) => {
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!offset) return;
    event.preventDefault();
    const nextTab = TABS[(TABS.indexOf(current) + offset + TABS.length) % TABS.length];
    setTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  return (
    <div className={learnSurface.page} lang={lesson.locale === 'en' ? 'en' : 'nb'}>
      <Link to="/learn" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {copy.backToLearn}
      </Link>

      <header className="mb-4">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {style.emoji} {lesson.topic.subject_title} · {copy.grade8} · {lesson.topic.title}
        </p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{lesson.title}</h1>
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

      <div role="tablist" aria-label={lesson.title} className="mb-4 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        {TABS.map((item) => (
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
            <article className={clsx(learnSurface.card, 'space-y-6 leading-relaxed')}>
              <p className="text-lg">{lesson.body.intro}</p>
              {lesson.body.sections.map((section) => (
                <section key={section.heading}>
                  <h2 className="text-xl font-semibold">{section.heading}</h2>
                  {section.paragraphs.map((paragraph, index) => <p key={index} className="mt-2">{paragraph}</p>)}
                  {section.bullets && (
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {section.bullets.map((bullet, index) => <li key={index}>{bullet}</li>)}
                    </ul>
                  )}
                </section>
              ))}
              <section>
                <h2 className="text-xl font-semibold">{copy.workedExamples}</h2>
                <ul className="mt-3 space-y-3">
                  {lesson.body.workedExamples.map((example) => (
                    <WorkedExampleCard key={example.title} example={example} locale={lesson.locale} />
                  ))}
                </ul>
              </section>
            </article>

            <aside className="space-y-4">
              <GoalPanel goals={lesson.topic.goals} udirCode={lesson.topic.udir_code} locale={lesson.locale} />
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
          <LessonPractice lessonId={lesson.id} locale={lesson.locale} result={lesson.practice_result} onCompleted={load} />
        )}

        {tab === 'cards' && <LessonFlashcards lessonId={lesson.id} locale={lesson.locale} />}

        {tab === 'tutor' && <TutorPanel lessonId={lesson.id} locale={lesson.locale} />}

        {tab === 'exam' && (
          <div className={learnSurface.card}>
            <p className={learnSurface.muted}>{copy.examIntro}</p>
            <ul className="mt-4 space-y-2">
              {exams.map((exam) => (
                <li key={exam.id}>
                  <Link to={`/learn/exams/${exam.id}`} className={learnSurface.primaryButton}>
                    <Timer className="h-4 w-4" aria-hidden="true" /> {exam.title} · {exam.time_limit_minutes} {copy.minutes}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
