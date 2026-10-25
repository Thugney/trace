import { useState } from 'react';
import clsx from 'clsx';
import { MessageSquareText, Send } from 'lucide-react';
import { learnAPI } from '../../services/api';
import type { LearnLocale, OpenResponse } from '../../types/learn';
import { learnCopy, learnSurface } from './learnCopy';

interface OpenResponsePanelProps {
  lessonId: number;
  locale: LearnLocale;
  prompts: { key: string; question: string }[];
  responses: OpenResponse[];
  onSaved: () => void;
}

/**
 * Open (human-reviewed) practice prompts. The learner writes an answer, then sees an
 * example answer to compare with; a guardian gives feedback, which locks the answer.
 */
export default function OpenResponsePanel({ lessonId, locale, prompts, responses, onSaved }: OpenResponsePanelProps) {
  const copy = learnCopy(locale);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ key: string; tone: 'ok' | 'error'; text: string } | null>(null);

  if (prompts.length === 0) return null;

  const save = async (key: string) => {
    const text = (drafts[key] ?? responses.find((row) => row.item_key === key)?.response ?? '').trim();
    if (!text) return;
    setBusy(key);
    setMessage(null);
    try {
      await learnAPI.submitOpenResponse(lessonId, key, text);
      setMessage({ key, tone: 'ok', text: copy.answerSaved });
      onSaved();
    } catch (err: any) {
      const code = err?.response?.data?.code;
      setMessage({ key, tone: 'error', text: code === 'exam_in_progress' ? copy.lockedDuringTest : err?.response?.data?.error || copy.error });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="open-responses" className={clsx(learnSurface.card, 'mt-4')}>
      <h3 id="open-responses" className="flex items-center gap-2 text-lg font-semibold">
        <MessageSquareText className="h-5 w-5 text-primary-500" aria-hidden="true" /> {copy.openResponseHeading}
      </h3>
      <p className={clsx('text-sm', learnSurface.muted)}>{copy.openResponseIntro}</p>
      <ul className="mt-4 space-y-6">
        {prompts.map((prompt) => {
          const saved = responses.find((row) => row.item_key === prompt.key);
          const locked = Boolean(saved?.feedback);
          const value = drafts[prompt.key] ?? saved?.response ?? '';
          const inputId = `open-${prompt.key}`;
          return (
            <li key={prompt.key}>
              <label htmlFor={inputId} className="block font-medium">{prompt.question}</label>
              <textarea
                id={inputId}
                className={clsx(learnSurface.input, 'mt-2')}
                rows={4}
                maxLength={2000}
                value={value}
                readOnly={locked}
                onChange={(event) => setDrafts({ ...drafts, [prompt.key]: event.target.value })}
              />
              {!locked && (
                <button type="button" onClick={() => save(prompt.key)} disabled={busy === prompt.key || !value.trim()} className={clsx(learnSurface.primaryButton, 'mt-2')}>
                  <Send className="h-4 w-4" aria-hidden="true" /> {saved ? copy.updateAnswer : copy.sendAnswer}
                </button>
              )}
              <div aria-live="polite">
                {message?.key === prompt.key && (
                  <p role={message.tone === 'error' ? 'alert' : 'status'} className={clsx('mt-2 text-sm', message.tone === 'error' ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300')}>
                    {message.text}
                  </p>
                )}
              </div>
              {saved?.model_answer && (
                <details className={clsx(learnSurface.subtle, 'mt-3 text-sm')}>
                  <summary className="cursor-pointer font-semibold">{copy.compareWith}</summary>
                  <p className="mt-2">{saved.model_answer}</p>
                </details>
              )}
              {saved && (
                saved.feedback ? (
                  <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">
                    <p className="font-semibold">{copy.feedbackFrom(saved.feedback_by_name)}</p>
                    <p className="mt-1">{saved.feedback}</p>
                  </div>
                ) : (
                  <p className={clsx('mt-2 text-xs', learnSurface.muted)}>{copy.waitingFeedback}</p>
                )
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
