import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Bot, Send } from 'lucide-react';
import { learnAPI } from '../../services/api';
import type { LearnLocale, TutorMode, TutorReply } from '../../types/learn';
import { learnCopy, learnSurface } from './learnCopy';

interface TutorPanelProps {
  lessonId: number;
  locale: LearnLocale;
  practice?: { key: string; title: string }[];
  onReadSection: (index: number) => void;
  onPractice: () => void;
}
type Exchange = { question: string; reply: TutorReply };
const modes: TutorMode[] = ['explain', 'hint', 'guided_practice', 'check_understanding', 'next_step'];

/** Ephemeral only: no browser storage, transcript logging, or progress writes. */
export default function TutorPanel({ lessonId, locale, practice = [], onReadSection, onPractice }: TutorPanelProps) {
  const [language, setLanguage] = useState<LearnLocale>(locale);
  const en = language === 'en';
  const copy = learnCopy(language);
  const labels = en ? ['Explain', 'Hint', 'Practice with me', 'Check understanding', 'What’s next?']
    : ['Forklar', 'Hint', 'Øv med meg', 'Sjekk forståelsen', 'Hva er neste steg?'];
  const [mode, setMode] = useState<TutorMode>('explain');
  const [itemKey, setItemKey] = useState(practice[0]?.key ?? '');
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<Exchange[]>([]);
  const [hintLevel, setHintLevel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const generation = useRef(0);
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    generation.current++;
    setHistory([]); setQuestion(''); setHintLevel(0); setBusy(false); setLanguage(locale);
    return () => { generation.current++; };
  }, [lessonId, locale]);

  const ask = async (recovery = false) => {
    if (busy) return;
    const current = generation.current;
    const trimmed = question.trim();
    setBusy(true); setNotice(null);
    try {
      const response = await learnAPI.askTutor(lessonId, trimmed, { mode, locale: language,
        ...(itemKey && ['hint', 'guided_practice'].includes(mode) ? { item_key: itemKey } : {}), hint_level: hintLevel, recovery });
      if (current !== generation.current) return;
      setHistory(previous => [...previous.slice(-9), { question: trimmed || (recovery ? (en ? 'I don’t understand' : 'Jeg forstår ikke') : labels[modes.indexOf(mode)]), reply: response.data }]);
      if (mode === 'hint') setHintLevel(level => Math.min(2, level + 1));
      setQuestion('');
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch (err: any) {
      if (current !== generation.current) return;
      const code = err?.response?.data?.code;
      setNotice(code === 'exam_in_progress' ? copy.tutorLocked : code === 'ai_disabled' ? copy.tutorDisabled
        : code === 'tutor_rate_limited' ? (en ? 'Please wait a minute before trying again.' : 'Vent et minutt før du prøver igjen.')
        : en ? 'Could not connect. Read the lesson or try the approved practice below.' : 'Kunne ikke koble til. Les leksjonen eller prøv den godkjente øvingen nedenfor.');
    } finally { if (current === generation.current) setBusy(false); }
  };

  return (
    <div className={learnSurface.card} lang={language}>
      <p className={clsx('flex gap-2 text-sm', learnSurface.muted)}><Bot className="h-5 w-5 flex-none text-primary-500" aria-hidden="true" />{copy.tutorIntro}</p>
      <p className={clsx('mt-2 text-xs', learnSurface.muted)}>{en ? 'Practice feedback, not a mark. Chat is cleared when you leave this panel.' : 'Øvingsveiledning, ikke en karakter. Samtalen slettes når du forlater panelet.'}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">{en ? 'Learning mode' : 'Læringsmåte'}
          <select className={clsx(learnSurface.input, 'mt-1 w-full')} value={mode} disabled={busy} onChange={event => { setMode(event.target.value as TutorMode); setHintLevel(0); }}>
            {modes.map((value, index) => <option key={value} value={value}>{labels[index]}</option>)}
          </select>
        </label>
        <label className="text-sm">{en ? 'Tutor language' : 'Veilederspråk'}
          <select className={clsx(learnSurface.input, 'mt-1 w-full')} value={language} disabled={busy} onChange={event => setLanguage(event.target.value as LearnLocale)}><option value="nb">Bokmål</option><option value="en">English</option></select>
        </label>
        {['hint', 'guided_practice'].includes(mode) && practice.length > 0 && <label className="text-sm sm:col-span-2">{en ? 'Approved practice' : 'Godkjent øving'}
          <select className={clsx(learnSurface.input, 'mt-1 w-full')} value={itemKey} disabled={busy} onChange={event => { setItemKey(event.target.value); setHintLevel(0); }}>{practice.map(item => <option key={item.key} value={item.key}>{item.title}</option>)}</select>
        </label>}
      </div>
      <div ref={resultRef} tabIndex={-1} className="focus:outline-none" role="log" aria-live="polite" aria-label={en ? 'Tutor conversation' : 'Samtale med veilederen'} aria-busy={busy}>
        <ol className="mt-4 space-y-3">{history.map((exchange, index) => <li key={index} className="space-y-2">
          <p className="ml-auto max-w-[90%] rounded-2xl bg-primary-600 px-4 py-2 text-sm text-white">{exchange.question}</p>
          <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm dark:bg-slate-800">
            {exchange.reply.source === 'lesson_fallback' && <p className="mb-1 text-xs font-semibold">{en ? 'Lesson guide' : 'Leksjonsveiledning'}</p>}
            <p className="whitespace-pre-line">{exchange.reply.answer}</p>
            {(exchange.reply.references || []).map(ref => <button key={ref.section_index} type="button" onClick={() => onReadSection(ref.section_index)} className="mt-2 block text-primary-700 underline dark:text-primary-300">{en ? 'Read' : 'Les'}: {ref.heading}</button>)}
            {exchange.reply.recommendation && <Link to={`/learn/lessons/${exchange.reply.recommendation.lesson_id}`} className="mt-3 block font-semibold text-primary-700 underline dark:text-primary-300">{exchange.reply.recommendation.title}</Link>}
            {exchange.reply.mode === 'guided_practice' && <button type="button" onClick={onPractice} className={clsx(learnSurface.secondaryButton, 'mt-3')}>{en ? 'Open practice' : 'Åpne øving'}</button>}
          </div>
        </li>)}</ol>
      </div>
      {notice && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">{notice}</p>}
      <form className="mt-4 flex gap-2" onSubmit={event => { event.preventDefault(); void ask(); }}>
        <label htmlFor={`tutor-${lessonId}`} className="sr-only">{copy.tutorPlaceholder}</label>
        <input id={`tutor-${lessonId}`} className={clsx(learnSurface.input, 'min-w-0 flex-1')} maxLength={500} placeholder={copy.tutorPlaceholder} value={question} disabled={busy} onChange={event => setQuestion(event.target.value)} />
        <button type="submit" disabled={busy} className={learnSurface.primaryButton} aria-label={copy.ask}><Send className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{copy.ask}</span></button>
      </form>
      {busy && <p role="status" className="mt-2 text-sm">{en ? 'Thinking…' : 'Tenker…'}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void ask(true)} className={learnSurface.secondaryButton}>{en ? 'I don’t understand' : 'Jeg forstår ikke'}</button>
        <button type="button" onClick={() => onReadSection(0)} className={learnSurface.secondaryButton}>{en ? 'Read lesson' : 'Les leksjonen'}</button>
        <button type="button" onClick={onPractice} className={learnSurface.secondaryButton}>{en ? 'Open practice' : 'Åpne øving'}</button>
        <button type="button" disabled={busy} onClick={() => { setHistory([]); setHintLevel(0); setQuestion(''); }} className={learnSurface.secondaryButton}>{en ? 'Clear conversation' : 'Tøm samtalen'}</button>
      </div>
    </div>
  );
}
