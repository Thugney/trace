import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Pencil, Plus, RotateCw, Trash2 } from 'lucide-react';
import { learnAPI } from '../../services/api';
import type { LearnFlashcard, LearnLocale } from '../../types/learn';
import { learnCopy, learnSurface } from './learnCopy';

interface LessonFlashcardsProps {
  lessonId: number;
  locale: LearnLocale;
}

type Draft = { front: string; back: string; forkedFrom?: string; editingId?: number };

// Spaced-repetition review of curated cards plus the learner's own cards.
// Editing a curated card creates a personal copy; curated content never changes.
export default function LessonFlashcards({ lessonId, locale }: LessonFlashcardsProps) {
  const copy = learnCopy(locale);
  const [cards, setCards] = useState<LearnFlashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const response = await learnAPI.getFlashcards(lessonId);
      setCards(response.data.cards);
      setIndex(0);
      setFlipped(false);
    } catch (err: any) {
      setError(err?.response?.data?.error || copy.error);
    }
  };

  useEffect(() => { load(); }, [lessonId]);

  const due = cards.filter((card) => card.due);
  const current = due[index];

  const rate = async (rating: 'known' | 'missed') => {
    if (!current) return;
    try {
      await learnAPI.reviewFlashcard(lessonId, current.key, rating);
      setCards((previous) => previous.map((card) => (card.key === current.key ? { ...card, due: false, last_rating: rating } : card)));
      setFlipped(false);
    } catch (err: any) {
      setError(err?.response?.data?.error || copy.error);
    }
  };

  const saveDraft = async () => {
    if (!draft || !draft.front.trim() || !draft.back.trim()) return;
    try {
      if (draft.editingId) {
        await learnAPI.updateCard(draft.editingId, { front: draft.front, back: draft.back });
      } else {
        await learnAPI.createCard(lessonId, { front: draft.front, back: draft.back, forked_from_card_key: draft.forkedFrom });
      }
      setDraft(null);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || copy.error);
    }
  };

  const remove = async (card: LearnFlashcard) => {
    if (!card.personal_id) return;
    await learnAPI.deleteCard(card.personal_id);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className={learnSurface.card}>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400" aria-live="polite">
          {due.length} {copy.cardsDue}
        </p>

        {current ? (
          <>
            <button
              type="button"
              onClick={() => setFlipped(!flipped)}
              aria-label={`${copy.flipCard}: ${flipped ? current.back : current.front}`}
              className="mt-3 flex min-h-[10rem] w-full items-center justify-center rounded-2xl border-2 border-dashed border-primary-200 bg-primary-50 p-6 text-center text-lg font-semibold text-slate-900 transition hover:border-primary-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-primary-800 dark:bg-primary-950/40 dark:text-slate-100"
            >
              <span aria-live="polite">{flipped ? current.back : current.front}</span>
            </button>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setFlipped(!flipped)} className={learnSurface.secondaryButton}>
                <RotateCw className="h-4 w-4" aria-hidden="true" /> {copy.flipCard}
              </button>
              {flipped && (
                <>
                  <button type="button" onClick={() => rate('known')} className={learnSurface.primaryButton}>{copy.iKnewIt}</button>
                  <button type="button" onClick={() => rate('missed')} className={learnSurface.secondaryButton}>{copy.practiceMore}</button>
                </>
              )}
              {current.source === 'curated' && (
                <button
                  type="button"
                  onClick={() => setDraft({ front: current.front, back: current.back, forkedFrom: current.key })}
                  className={learnSurface.secondaryButton}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" /> {copy.editCopy}
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="mt-3 font-medium" role="status">{copy.allCardsDone}</p>
        )}
      </div>

      {draft && (
        <form
          className={clsx(learnSurface.card, 'space-y-3')}
          onSubmit={(event) => { event.preventDefault(); saveDraft(); }}
        >
          <label className="block text-sm font-medium">
            {copy.front}
            <input className={clsx(learnSurface.input, 'mt-1')} maxLength={300} value={draft.front} onChange={(event) => setDraft({ ...draft, front: event.target.value })} />
          </label>
          <label className="block text-sm font-medium">
            {copy.back}
            <textarea className={clsx(learnSurface.input, 'mt-1')} maxLength={300} rows={3} value={draft.back} onChange={(event) => setDraft({ ...draft, back: event.target.value })} />
          </label>
          <div className="flex gap-2">
            <button type="submit" className={learnSurface.primaryButton}>{copy.save}</button>
            <button type="button" onClick={() => setDraft(null)} className={learnSurface.secondaryButton}>{copy.cancel}</button>
          </div>
        </form>
      )}

      <div className={learnSurface.card}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">{copy.myCards}</h3>
          <button type="button" onClick={() => setDraft({ front: '', back: '' })} className={learnSurface.secondaryButton}>
            <Plus className="h-4 w-4" aria-hidden="true" /> {copy.addCard}
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {cards.filter((card) => card.source === 'personal').map((card) => (
            <li key={card.key} className="flex items-start justify-between gap-3 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800/70">
              <span><strong>{card.front}</strong> — {card.back}</span>
              <span className="flex flex-none gap-1">
                <button type="button" aria-label={`${copy.edit}: ${card.front}`} onClick={() => setDraft({ front: card.front, back: card.back, editingId: card.personal_id })} className="rounded-lg p-2 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-slate-700">
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" aria-label={`${copy.delete}: ${card.front}`} onClick={() => remove(card)} className="rounded-lg p-2 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-slate-700">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}
