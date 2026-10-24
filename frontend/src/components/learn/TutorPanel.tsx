import { useState } from 'react';
import clsx from 'clsx';
import { Bot, Send } from 'lucide-react';
import { learnAPI } from '../../services/api';
import type { LearnLocale, TutorReply } from '../../types/learn';
import { learnCopy, learnSurface } from './learnCopy';

interface TutorPanelProps {
  lessonId: number;
  locale: LearnLocale;
}

type Exchange = { question: string; reply: TutorReply };

export default function TutorPanel({ lessonId, locale }: TutorPanelProps) {
  const copy = learnCopy(locale);
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const ask = async () => {
    const trimmed = question.trim();
    if (!trimmed) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await learnAPI.askTutor(lessonId, trimmed);
      setHistory((previous) => [...previous, { question: trimmed, reply: response.data }]);
      setQuestion('');
    } catch (err: any) {
      const code = err?.response?.data?.code;
      setNotice(code === 'exam_in_progress' ? copy.tutorLocked : code === 'ai_disabled' ? copy.tutorDisabled : copy.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={learnSurface.card}>
      <p className={clsx('flex gap-2 text-sm', learnSurface.muted)}>
        <Bot className="h-5 w-5 flex-none text-primary-500" aria-hidden="true" /> {copy.tutorIntro}
      </p>

      <ol className="mt-4 space-y-3" aria-live="polite">
        {history.map((exchange, index) => (
          <li key={index} className="space-y-2">
            <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary-600 px-4 py-2 text-sm text-white">{exchange.question}</p>
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2 text-sm dark:bg-slate-800">
              {exchange.reply.source === 'lesson_fallback' && (
                <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{copy.tutorFallback}</p>
              )}
              <p className="whitespace-pre-line">{exchange.reply.answer}</p>
            </div>
          </li>
        ))}
      </ol>

      {notice && <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">{notice}</p>}

      <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); ask(); }}>
        <label htmlFor={`tutor-${lessonId}`} className="sr-only">{copy.tutorPlaceholder}</label>
        <input
          id={`tutor-${lessonId}`}
          className={learnSurface.input}
          maxLength={500}
          placeholder={copy.tutorPlaceholder}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button type="submit" disabled={busy || !question.trim()} className={learnSurface.primaryButton} aria-label={copy.ask}>
          <Send className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{copy.ask}</span>
        </button>
      </form>
    </div>
  );
}
