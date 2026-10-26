import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Lightbulb, MessageCircle, RotateCcw, Send, ShieldCheck, ListChecks, Lock, WifiOff, Clock, Power } from 'lucide-react';
import './TutorPanel.css';
import { learnAPI } from '../../services/api';
import type { LearnLocale, TutorMode, TutorReply } from '../../types/learn';

interface TutorPanelProps {
  lessonId: number;
  locale: LearnLocale;
  lessonTitle: string;
  sections: { heading: string; paragraphs: string[] }[];
  practice?: { key: string; title: string }[];
  onReadSection: (index: number) => void;
  onPractice: () => void;
}
type Exchange = { question: string; reply: TutorReply; locale: LearnLocale; itemKey?: string };
type Ask = { mode: TutorMode; text?: string; hint?: number; recovery?: boolean; itemKey?: string; answer?: string; label?: string };
type Notice = 'locked' | 'disabled' | 'limit' | 'offline' | 'unavailable';
const modes: TutorMode[] = ['explain', 'hint', 'guided_practice', 'check_understanding', 'next_step'];
const icons = [BookOpen, Lightbulb, ListChecks, MessageCircle, ArrowRight];

/** Decorative artwork from approved Design03. Teaching content always comes from reviewed lessons. */
function Owl() {
  return <svg className="tutor-owl" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
    <circle cx="20" cy="20" r="20" fill="var(--sun-soft)" />
    <path d="M10 16Q10 9 13.5 6.5L16 11.5Q20 10 24 11.5L26.5 6.5Q30 9 30 16V24Q30 33 20 33Q10 33 10 24Z" fill="var(--teal)" />
    <circle cx="16" cy="18.5" r="4.4" fill="#fff" /><circle cx="24" cy="18.5" r="4.4" fill="#fff" />
    <circle cx="16.7" cy="19" r="2.1" fill="#1f2d2b" /><circle cx="24.7" cy="19" r="2.1" fill="#1f2d2b" />
    <path d="M18.5 23L20 25.8L21.5 23Z" fill="var(--sun)" />
  </svg>;
}

/** Ephemeral only: no browser storage, transcript logging, or progress writes. */
export default function TutorPanel({ lessonId, locale, lessonTitle, sections, practice = [], onReadSection, onPractice }: TutorPanelProps) {
  const [language, setLanguage] = useState<LearnLocale>(locale);
  const [mode, setMode] = useState<TutorMode>('explain');
  const [itemKey, setItemKey] = useState(practice[0]?.key ?? '');
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const firstItemKey = practice[0]?.key ?? '';
  const generation = useRef(0);
  const pending = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLInputElement>(null);
  const lastRequest = useRef<Ask>({ mode: 'explain' });
  const en = language === 'en';
  const t = (english: string, norwegian: string) => en ? english : norwegian;
  const labels = en ? ['Explain it simply', 'Give me a hint', 'Let me practise', 'Check if I understand', 'What do I do now?']
    : ['Forklar enklere', 'Gi meg et hint', 'La meg øve', 'Sjekk om jeg forstår', 'Hva gjør jeg nå?'];
  const last = history[history.length - 1];
  const lastReference = last?.reply.references?.find(ref => ref.lesson_id === lessonId && sections[ref.section_index]);
  const sourceIndex = lastReference?.section_index ?? 0;
  const unavailable = busy || notice !== null;

  useEffect(() => {
    // The ref object itself (a request counter, not a DOM node): cleanup must
    // bump the live counter so in-flight replies are dropped on reset/unmount.
    const requests = generation;
    requests.current++;
    setHistory([]); setQuestion(''); setBusy(false); setLanguage(locale);
    setNotice(null); setMode('explain'); setItemKey(firstItemKey); pending.current = false;
    lastRequest.current = { mode: 'explain' };
    return () => { requests.current++; };
  }, [lessonId, locale, firstItemKey]);

  const revealResult = () => requestAnimationFrame(() => {
    const log = resultRef.current;
    if (log) { log.scrollTop = log.scrollHeight; log.focus(); }
  });
  const ask = async (request: Ask) => {
    if (pending.current) return;
    pending.current = true;
    const current = generation.current;
    const selectedItem = request.itemKey ?? itemKey;
    const text = request.text?.trim() ?? '';
    lastRequest.current = request;
    setMode(request.mode); setBusy(true); setNotice(null);
    try {
      const response = await learnAPI.askTutor(lessonId, text, { mode: request.mode, locale: language,
        ...(selectedItem && ['hint', 'guided_practice'].includes(request.mode) ? { item_key: selectedItem } : {}),
        hint_level: request.hint ?? 0, recovery: request.recovery ?? false,
        ...(request.answer !== undefined ? { practice_answer: request.answer } : {}) });
      if (current !== generation.current) return;
      const label = request.label ?? (request.recovery ? t('I don’t get it', 'Jeg forstår ikke') : labels[modes.indexOf(request.mode)]);
      setHistory(previous => [...previous.slice(-9), { question: text || label, reply: response.data, locale: language, itemKey: selectedItem }]);
      setQuestion(''); revealResult();
    } catch (error: unknown) {
      if (current !== generation.current) return;
      const response = (error as { response?: { status?: number; data?: { code?: string } } })?.response;
      const code = response?.data?.code;
      setNotice(code === 'exam_in_progress' ? 'locked'
        : code === 'ai_disabled' || code === 'learn_disabled' || response?.status === 401 || response?.status === 403 ? 'disabled'
          : code === 'tutor_rate_limited' || response?.status === 429 ? 'limit'
            : code === 'lesson_unavailable' || response?.status === 404 ? 'unavailable' : 'offline');
      revealResult();
    } finally {
      if (current === generation.current) { setBusy(false); pending.current = false; }
    }
  };
  const noticeCopy = {
    locked: [t('You have a test now', 'Du har en prøve nå'), t('The guide will be back when your test is finished.', 'Veilederen kommer tilbake når prøven er ferdig.')],
    disabled: [t('The guide is turned off', 'Veilederen er av'), t('Ask an adult if you need help.', 'Spør en voksen hvis du trenger hjelp.')],
    limit: [t('A break from the guide', 'Pause fra veilederen'), t('Wait a minute before trying again. You can keep reading.', 'Vent et minutt før du prøver igjen. Du kan fortsette å lese.')],
    offline: [t('Could not connect', 'Fikk ikke kontakt'), t('Try again, or read the lesson while you wait.', 'Prøv igjen, eller les leksjonen mens du venter.')],
    unavailable: [t('This lesson is unavailable', 'Denne leksjonen er utilgjengelig'), t('Ask an adult to choose another reviewed lesson.', 'Be en voksen velge en annen godkjent leksjon.')]
  };
  const NoticeIcon = notice === 'locked' ? Lock : notice === 'limit' ? Clock : notice === 'disabled' ? Power : WifiOff;

  return <div className="tutor-shell" lang={language}>
    <div className="tutor-toolbar">
      <p>{t('A little help. Your own way of thinking.', 'Litt hjelp. Dine egne tanker.')}</p>
      <label><span className="sr-only">{t('Tutor language', 'Veilederspråk')}</span>
        <select value={language} disabled={busy} onChange={event => { setLanguage(event.target.value as LearnLocale); setQuestion(''); lastRequest.current = { mode: 'explain' }; }}>
          <option value="nb">Bokmål</option><option value="en">English</option>
        </select>
      </label>
    </div>
    <div className="tutor-workspace">
      <aside className="tutor-lesson" aria-label={t('Lesson beside the chat', 'Leksjonen ved siden av samtalen')} lang={locale}>
        <span className="tutor-sectionlabel" lang={language}><BookOpen aria-hidden="true" />{t('From your lesson', 'Fra leksjonen din')}</span>
        <h2>{lessonTitle}</h2>
        {sections.map((section, index) => <section key={index}>
          <h3>{section.heading}</h3>
          {section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
          <button type="button" className="tutor-act" lang={language} onClick={() => onReadSection(index)}>{t('Read in the lesson', 'Les i leksjonen')}<ArrowRight aria-hidden="true" /></button>
        </section>)}
      </aside>
      <section className="tutor-coach" aria-label={t('Lesson tutor', 'Leksjonsveileder')}>
        <div ref={resultRef} tabIndex={-1} className="tutor-conversation" role="log" aria-live="polite" aria-relevant="additions" aria-label={t('Chat with your guide', 'Samtale med veilederen')} aria-busy={busy}>
          <div className="tutor-intro"><Owl /><h2>{t('Your guide', 'Veilederen')}</h2><p>{t('Helps you understand the lesson', 'Hjelper deg å forstå leksjonen')}</p>
            <button type="button" className="tutor-context" onClick={() => onReadSection(sourceIndex)}><BookOpen aria-hidden="true" /><span><small>{t('We are talking about', 'Vi snakker om')}</small><span lang={locale}>{sections[sourceIndex]?.heading || lessonTitle}</span></span><ArrowRight aria-hidden="true" /></button>
          </div>
          {!history.length && <div className="tutor-message"><Owl /><p className="tutor-bubble">{t('Hi! We can take this one step at a time. What would you like help with?', 'Hei! Vi tar ett steg om gangen. Hva vil du ha hjelp med?')}</p></div>}
          <ol>{history.map((exchange, index) => {
            const latest = index === history.length - 1;
            const refs = (exchange.reply.references ?? []).filter(ref => ref.lesson_id === lessonId && sections[ref.section_index]);
            const exercise = exchange.reply.practice;
            const hint = exchange.reply.hint_level;
            return <li key={index}>
              <div className="tutor-message tutor-me"><p className="tutor-bubble" lang={exchange.locale}>{exchange.question}</p></div>
              <div className="tutor-message"><Owl /><div className="tutor-bubble tutor-answer">
                {hint !== undefined && <div className="tutor-hintlabel">{t(`Hint ${hint + 1} of 3`, `Hint ${hint + 1} av 3`)}<span aria-hidden="true">{[0, 1, 2].map(dot => <i key={dot} className={dot <= hint ? 'on' : ''} />)}</span></div>}
                <p lang={exchange.locale}>{exchange.reply.answer}</p>
                {refs.slice(0, 1).map(ref => <blockquote key={ref.section_index} lang={locale}><small lang={language}>{t('From the lesson', 'Fra leksjonen')}</small>{sections[ref.section_index].paragraphs[0]}</blockquote>)}
                {exercise && <div className="tutor-exercise" lang={locale}>
                  <p>{exercise.question}</p>
                  {latest && exchange.reply.practice_feedback !== 'correct' && <div className="tutor-options" role="group" aria-label={t('Practice answers', 'Øvingssvar')}>
                    {exercise.options.map(option => <button key={option.id} type="button" disabled={unavailable} onClick={() => void ask({ mode: 'guided_practice', itemKey: exercise.key, answer: option.id, label: option.text })}>{option.text}</button>)}
                  </div>}
                </div>}
                {latest && <div className="tutor-replyactions">
                  {hint !== undefined && hint < 2 && <button type="button" className="tutor-act" disabled={unavailable} onClick={() => void ask({ mode: 'hint', hint: hint + 1, itemKey: exchange.itemKey })}><Lightbulb aria-hidden="true" />{t('Show next hint', 'Vis neste hint')}</button>}
                  <button type="button" className="tutor-act" disabled={unavailable} onClick={() => void ask({ mode: exchange.reply.mode ?? mode, recovery: true, itemKey: exchange.itemKey })}><RotateCcw aria-hidden="true" />{t('I don’t get it', 'Jeg forstår ikke')}</button>
                  {refs.map(ref => <button key={ref.section_index} type="button" className="tutor-act tutor-sourcechip" onClick={() => onReadSection(ref.section_index)}><BookOpen aria-hidden="true" />{t('Read', 'Les')}: {ref.heading}</button>)}
                  <button type="button" className="tutor-act" disabled={unavailable} onClick={() => void ask({ mode: 'guided_practice', itemKey: exchange.itemKey })}>{t('Let me practise', 'La meg øve')}</button>
                  <button type="button" className="tutor-act" onClick={onPractice}><ListChecks aria-hidden="true" />{t('Open the practice', 'Åpne øvingen')}</button>
                  {exchange.reply.recommendation && (exchange.reply.recommendation.lesson_id === lessonId
                    ? <button type="button" className="tutor-act" onClick={() => exchange.reply.recommendation?.reason === 'practice_not_passed' ? onPractice() : onReadSection(0)}>{exchange.reply.recommendation.title}<ArrowRight aria-hidden="true" /></button>
                    : <Link className="tutor-act" to={`/learn/lessons/${exchange.reply.recommendation.lesson_id}`}>{exchange.reply.recommendation.title}<ArrowRight aria-hidden="true" /></Link>)}
                </div>}
              </div></div>
            </li>;
          })}</ol>
          {busy && <div className="tutor-message" role="status"><Owl /><p className="tutor-bubble tutor-loading"><span className="tutor-typing" aria-hidden="true"><i /><i /><i /></span>{t('Your guide is thinking …', 'Veilederen tenker …')}</p></div>}
        </div>
        <div className="tutor-dock">
          {notice ? <div className="tutor-statecard" data-tone={notice === 'locked' ? 'calm' : 'warning'} role="alert">
            <NoticeIcon aria-hidden="true" /><div><h3>{noticeCopy[notice][0]}</h3><p>{noticeCopy[notice][1]}</p>
              {['offline', 'limit'].includes(notice) && <button type="button" className="tutor-act" onClick={() => void ask(lastRequest.current)}><RotateCcw aria-hidden="true" />{t('Try again', 'Prøv igjen')}</button>}
            </div>
          </div> : <>
            {practice.length > 1 && <label className="tutor-practicechoice">{t('Practice question', 'Øvingsoppgave')}<select value={itemKey} disabled={busy} onChange={event => setItemKey(event.target.value)}>{practice.map(item => <option key={item.key} value={item.key}>{item.title}</option>)}</select></label>}
            <div className="tutor-chips" role="group" aria-label={t('What would you like to do?', 'Hva vil du gjøre?')}>
              {modes.map((value, index) => { const Icon = icons[index]; return <button key={value} type="button" disabled={busy} onClick={() => void ask({ mode: value })}><Icon aria-hidden="true" />{labels[index]}</button>; })}
            </div>
            <form className="tutor-compose" onSubmit={event => { event.preventDefault(); if (question.trim()) void ask({ mode, text: question }); }}>
              <label htmlFor={`tutor-${lessonId}`} className="sr-only">{t('Question for your guide', 'Spørsmål til veilederen')}</label>
              <input ref={questionRef} id={`tutor-${lessonId}`} maxLength={500} autoComplete="off" placeholder={t('Type a question …', 'Skriv et spørsmål …')} value={question} disabled={busy} onChange={event => setQuestion(event.target.value)} />
              <button type="submit" disabled={busy || !question.trim()} className="tutor-send" aria-label="Send"><Send aria-hidden="true" /></button>
            </form>
          </>}
          <p className="tutor-foot">{t('Your guide can make mistakes. The chat disappears when you close the page.', 'Veilederen kan ta feil. Samtalen forsvinner når du lukker siden.')}</p>
          <button type="button" disabled={busy} className="tutor-clear" onClick={() => { setHistory([]); setQuestion(''); setMode('explain'); lastRequest.current = { mode: 'explain' }; questionRef.current?.focus(); }}>{t('Clear conversation', 'Tøm samtalen')}</button>
        </div>
      </section>
    </div>
    <p className="tutor-footnote"><ShieldCheck aria-hidden="true" />{t('Practice feedback, not a mark. Your lesson is always the source.', 'Øvingsveiledning, ikke en karakter. Leksjonen er alltid kilden.')}</p>
  </div>;
}
