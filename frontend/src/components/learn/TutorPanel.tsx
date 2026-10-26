import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Check, Lightbulb, MessageCircle, RotateCcw, Send, ShieldCheck, Sparkles, ListChecks } from 'lucide-react';
import './TutorPanel.css';
import { learnAPI } from '../../services/api';
import type { LearnLocale, TutorMode, TutorReply } from '../../types/learn';
import { learnCopy } from './learnCopy';

interface TutorPanelProps {
  lessonId: number;
  locale: LearnLocale;
  lessonTitle: string;
  sections: { heading: string; paragraphs: string[] }[];
  practice?: { key: string; title: string }[];
  onReadSection: (index: number) => void;
  onPractice: () => void;
}
type Exchange = { question: string; reply: TutorReply; locale: LearnLocale };
const modeIcons = [BookOpen, Lightbulb, ListChecks, MessageCircle, ArrowRight];
const modes: TutorMode[] = ['explain', 'hint', 'guided_practice', 'check_understanding', 'next_step'];

/** Ephemeral only: no browser storage, transcript logging, or progress writes. */
export default function TutorPanel({ lessonId, locale, lessonTitle, sections, practice = [], onReadSection, onPractice }: TutorPanelProps) {
  const [language, setLanguage] = useState<LearnLocale>(locale);
  const en = language === 'en';
  const copy = learnCopy(language);
  const labels = en ? ['Explain', 'Give me a hint', 'Practise together', 'Check my thinking', 'What’s next?']
    : ['Forklar', 'Gi meg et hint', 'Øv med meg', 'Sjekk tankene mine', 'Hva er neste steg?'];
  const [mode, setMode] = useState<TutorMode>('explain');
  const [itemKey, setItemKey] = useState(practice[0]?.key ?? '');
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<Exchange[]>([]);
  const [hintLevel, setHintLevel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const generation = useRef(0);
  const resultRef = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  const questionRef = useRef<HTMLInputElement>(null);
  const t = (english: string, norwegian: string) => en ? english : norwegian;
  const lastReference = history[history.length - 1]?.reply.references?.find(ref => ref.lesson_id === lessonId && sections[ref.section_index]);
  const sourceIndex = lastReference?.section_index ?? 0;
  const source = sections[sourceIndex];
  useEffect(() => {
    generation.current++;
    setHistory([]); setQuestion(''); setHintLevel(0); setBusy(false); setLanguage(locale);
    setNotice(null); setMode('explain'); pending.current = false;
    return () => { generation.current++; };
  }, [lessonId, locale]);

  const revealResult = () => requestAnimationFrame(() => {
    const log = resultRef.current;
    if (log) { log.scrollTop = log.scrollHeight; log.focus(); }
  });

  const ask = async (recovery = false) => {
    if (pending.current) return;
    pending.current = true;
    const current = generation.current;
    const trimmed = question.trim();
    setBusy(true); setNotice(null);
    try {
      const response = await learnAPI.askTutor(lessonId, trimmed, { mode, locale: language,
        ...(itemKey && ['hint', 'guided_practice'].includes(mode) ? { item_key: itemKey } : {}), hint_level: hintLevel, recovery });
      if (current !== generation.current) return;
      setHistory(previous => [...previous.slice(-9), { question: trimmed || (recovery ? (en ? 'I don’t understand' : 'Jeg forstår ikke') : labels[modes.indexOf(mode)]), reply: response.data, locale: language }]);
      if (mode === 'hint') setHintLevel(level => Math.min(2, level + 1));
      setQuestion('');
      revealResult();
    } catch (err: any) {
      if (current !== generation.current) return;
      const code = err?.response?.data?.code;
      setNotice(code === 'exam_in_progress' ? copy.tutorLocked : code === 'ai_disabled' ? copy.tutorDisabled
        : code === 'tutor_rate_limited' ? (en ? 'Please wait a minute before trying again.' : 'Vent et minutt før du prøver igjen.')
        : en ? 'Could not connect. Read the lesson or try the approved practice below.' : 'Kunne ikke koble til. Les leksjonen eller prøv den godkjente øvingen nedenfor.');
      revealResult();
    } finally { if (current === generation.current) { setBusy(false); pending.current = false; } }
  };

  return (
    <div className="tutor-shell" lang={language}>
      <div className="tutor-toolbar">
        <p>{t('A little help. Your own way of thinking.', 'Litt hjelp. Dine egne tanker.')}</p>
        <label><span className="sr-only">{t('Tutor language', 'Veilederspråk')}</span>
          <select value={language} disabled={busy} onChange={event => setLanguage(event.target.value as LearnLocale)}>
            <option value="nb">Bokmål</option><option value="en">English</option>
          </select>
        </label>
      </div>
      <div className="tutor-workspace">
        <section className="tutor-coach" aria-label={t('Lesson tutor', 'Leksjonsveileder')}>
          <div className="tutor-coachbody">
            <h2 className="tutor-smallheading">{t('How would you like to learn?', 'Hvordan vil du lære?')}</h2>
            <div className="tutor-modegrid" role="group" aria-label={t('Learning mode', 'Læringsmåte')}>
              {modes.map((value, index) => {
                const Icon = modeIcons[index];
                return <button key={value} type="button" className="tutor-mode" aria-pressed={mode === value} disabled={busy}
                  onClick={() => { setMode(value); setHintLevel(0); }}><Icon aria-hidden="true" /><span>{labels[index]}</span></button>;
              })}
            </div>
            {['hint', 'guided_practice'].includes(mode) && practice.length > 0 && <label className="tutor-practicechoice">{t('Approved practice', 'Godkjent øving')}
              <select value={itemKey} disabled={busy} onChange={event => { setItemKey(event.target.value); setHintLevel(0); }}>
                {practice.map(item => <option key={item.key} value={item.key}>{item.title}</option>)}
              </select>
            </label>}
            <div ref={resultRef} tabIndex={-1} className="tutor-conversation" role="log" aria-live="polite" aria-label={t('Tutor conversation', 'Samtale med veilederen')} aria-busy={busy}>
              {!history.length && !busy && !notice && <div className="tutor-welcome">
                <span className="tutor-guide-icon"><Sparkles aria-hidden="true" /></span>
                <h3>{t('Your thinking starts here.', 'Her er det plass til tankene dine.')}</h3>
                <p>{t('We can take this one step at a time. Start with a question, or choose a way to learn.', 'Vi tar ett steg om gangen. Still et spørsmål, eller velg hvordan du vil lære.')}</p>
                <button type="button" className="tutor-starter" disabled={busy} onClick={() => void ask()}>{t('Let’s get started', 'La oss begynne')}<ArrowRight aria-hidden="true" /></button>
              </div>}
              <ol>{history.map((exchange, index) => <li key={index}>
                <p className="tutor-request" lang={exchange.locale}>{exchange.question}</p>
                <p className="tutor-label"><span className="tutor-avatar"><Sparkles aria-hidden="true" /></span>{t('Lesson guide', 'Leksjonsveiledning')}</p>
                <div className="tutor-answer">
                  <p className="whitespace-pre-line" lang={exchange.locale}>{exchange.reply.answer}</p>
                  {(exchange.reply.references || []).map(ref => <button key={ref.section_index} type="button" onClick={() => onReadSection(ref.section_index)} className="tutor-sourcechip"><BookOpen aria-hidden="true" />{t('Read', 'Les')}: {ref.heading}</button>)}
                  {exchange.reply.recommendation && (exchange.reply.recommendation.lesson_id === lessonId
                    ? <button type="button" className="tutor-starter" disabled={busy}
                        onClick={() => exchange.reply.recommendation?.reason === 'practice_not_passed' ? onPractice() : onReadSection(0)}>
                        {exchange.reply.recommendation.title}<ArrowRight aria-hidden="true" />
                      </button>
                    : <Link to={`/learn/lessons/${exchange.reply.recommendation.lesson_id}`} className="tutor-starter">{exchange.reply.recommendation.title}<ArrowRight aria-hidden="true" /></Link>)}
                </div>
                {index === history.length - 1 && <div className="tutor-replyactions">
                  <button type="button" disabled={busy} onClick={() => void ask(true)}><RotateCcw aria-hidden="true" />{t('One smaller step', 'Et mindre steg')}</button>
                  <button type="button" onClick={onPractice}><ListChecks aria-hidden="true" />{t('Open practice', 'Åpne øving')}</button>
                </div>}
              </li>)}</ol>
              {busy && <p className="tutor-loading" role="status"><Sparkles aria-hidden="true" />{t('Thinking…', 'Tenker…')}</p>}
              {notice && <p role="alert" className="tutor-notice">{notice}</p>}
            </div>
          </div>
          <form className="tutor-composer" onSubmit={event => { event.preventDefault(); void ask(); }}>
            <div className="tutor-inputwrap">
              <label htmlFor={`tutor-${lessonId}`} className="sr-only">{copy.tutorPlaceholder}</label>
              <input ref={questionRef} id={`tutor-${lessonId}`} maxLength={500} autoComplete="off" placeholder={copy.tutorPlaceholder} value={question} disabled={busy} onChange={event => setQuestion(event.target.value)} />
              <button type="submit" disabled={busy} className="tutor-send" aria-label={copy.ask}><Send aria-hidden="true" /></button>
            </div>
            <div className="tutor-composerfoot"><span><ShieldCheck aria-hidden="true" />{t('This chat clears when you leave.', 'Samtalen slettes når du går.')}</span>
              <button type="button" disabled={busy} className="tutor-clear" onClick={() => { setHistory([]); setHintLevel(0); setQuestion(''); setNotice(null); questionRef.current?.focus(); }}>{t('Clear conversation', 'Tøm samtalen')}</button>
            </div>
            <button type="button" disabled={busy} onClick={() => void ask(true)} className="tutor-mobileRecovery"><RotateCcw aria-hidden="true" />{t('I don’t understand', 'Jeg forstår ikke')}</button>
          </form>
        </section>
        <aside>
          <section className="tutor-sourcecard" aria-label={t('Lesson source', 'Leksjonskilde')}>
            <div className="tutor-sectionlabel"><BookOpen aria-hidden="true" />{t('From your lesson', 'Fra leksjonen din')}</div>
            <h2 lang={locale}>{source?.heading || lessonTitle}</h2>
            <p lang={locale}>{source?.paragraphs[0] || t('Open the lesson to find a source section.', 'Åpne leksjonen for å finne en kildedel.')}</p>
            <button type="button" className="tutor-read" onClick={() => onReadSection(sourceIndex)}>{t('Read this part', 'Les denne delen')}<ArrowRight aria-hidden="true" /></button>
            {source && <div className="tutor-reviewed"><Check aria-hidden="true" />{t('Reviewed lesson material', 'Godkjent leksjonsinnhold')}</div>}
          </section>
          <div className="tutor-asidehelp"><h3>{t('It’s okay to take your time.', 'Du kan ta den tiden du trenger.')}</h3>
            <p>{t('Try a small step, say what you think, or ask for a hint.', 'Prøv et lite steg, si hva du tenker, eller spør om et hint.')}</p>
            <button type="button" disabled={busy} className="tutor-textbutton" onClick={() => void ask(true)}><RotateCcw aria-hidden="true" />{t('I don’t understand', 'Jeg forstår ikke')}</button>
            <button type="button" className="tutor-textbutton" onClick={onPractice}><ListChecks aria-hidden="true" />{t('Open practice', 'Åpne øving')}</button>
          </div>
        </aside>
      </div>
      <p className="tutor-footnote"><ShieldCheck aria-hidden="true" />{t('Practice feedback, not a mark. Your lesson is always the source.', 'Øvingsveiledning, ikke en karakter. Leksjonen er alltid kilden.')}</p>
    </div>
  );
}
