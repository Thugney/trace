import { useState } from 'react';
import clsx from 'clsx';
import { Lock, StickyNote, Users } from 'lucide-react';
import { learnAPI } from '../../services/api';
import type { LearnLocale, LessonNote, LessonNotesBlock } from '../../types/learn';
import { learnCopy, learnSurface } from './learnCopy';

// The Notes page palette; the server falls back to the first colour
export const NOTE_COLORS = ['#fef08a', '#fbcfe8', '#bfdbfe', '#bbf7d0', '#e9d5ff', '#fed7aa'];
const MAX_LENGTH = 2000;

// SQLite CURRENT_TIMESTAMP is UTC without a zone marker
export const noteDate = (value: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) =>
  new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`).toLocaleString('nb-NO', options);

function ColourPicker({ value, onChange, label }: { value: string; onChange: (colour: string) => void; label: string }) {
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label={label}>
      {NOTE_COLORS.map((colour) => (
        <button
          key={colour}
          type="button"
          role="radio"
          aria-checked={value === colour}
          aria-label={colour}
          onClick={() => onChange(colour)}
          className={clsx('h-7 w-7 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
            value === colour ? 'ring-2 ring-primary-600 ring-offset-2' : 'ring-1 ring-slate-300')}
          style={{ background: colour }}
        />
      ))}
    </div>
  );
}

function OwnNote({ note, locale, onChanged }: { note: LessonNote; locale: LearnLocale; onChanged: () => void }) {
  const copy = learnCopy(locale);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const [colour, setColour] = useState(note.color);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!content.trim()) return;
    setBusy(true);
    try {
      await learnAPI.updateLessonNote(note.id, { content, color: colour });
      setEditing(false);
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  const remove = async () => {
    if (!window.confirm(copy.confirmDeleteNote)) return;
    setBusy(true);
    try {
      await learnAPI.deleteLessonNote(note.id);
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  if (editing) {
    return (
      <li className="rounded-xl p-3 text-sm shadow-sm ring-1 ring-black/5" style={{ background: colour }}>
        <label className="sr-only" htmlFor={`note-edit-${note.id}`}>{copy.editNote}</label>
        <textarea id={`note-edit-${note.id}`} rows={3} maxLength={MAX_LENGTH} value={content}
          onChange={(event) => setContent(event.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white/80 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <ColourPicker value={colour} onChange={setColour} label={copy.noteColour} />
          <span className="flex gap-1">
            <button type="button" onClick={() => { setEditing(false); setContent(note.content); setColour(note.color); }}
              className="min-h-[36px] rounded-lg px-2 text-xs font-semibold text-slate-700 hover:bg-black/5">{copy.cancel}</button>
            <button type="button" onClick={save} disabled={busy || !content.trim()}
              className="min-h-[36px] rounded-lg bg-primary-600 px-3 text-xs font-semibold text-white disabled:opacity-60">{copy.saveNote}</button>
          </span>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-xl p-3 text-sm shadow-sm ring-1 ring-black/5" style={{ background: note.color }}>
      <p className="whitespace-pre-wrap break-words text-slate-900">{note.content}</p>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
        <span>{noteDate(note.updated_at)}</span>
        <span className="flex gap-1">
          <button type="button" onClick={() => setEditing(true)} className="min-h-[32px] rounded-lg px-2 hover:bg-black/5">{copy.editNote}</button>
          <button type="button" onClick={remove} disabled={busy} className="min-h-[32px] rounded-lg px-2 hover:bg-black/5">{copy.deleteNote}</button>
        </span>
      </div>
    </li>
  );
}

export default function LessonNotesPanel({ lessonId, locale, notes, onChanged }: {
  lessonId: number;
  locale: LearnLocale;
  notes: LessonNotesBlock;
  onChanged: () => void;
}) {
  const copy = learnCopy(locale);
  const [content, setContent] = useState('');
  const [colour, setColour] = useState(NOTE_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const atLimit = notes.mine.length >= notes.limit;

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!content.trim() || atLimit) return;
    setBusy(true);
    setError(null);
    try {
      await learnAPI.createLessonNote(lessonId, { content, color: colour });
      setContent('');
    } catch (err: any) {
      setError(err?.response?.data?.code === 'note_limit' ? copy.noteLimitReached : copy.error);
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  return (
    <section className={learnSurface.card} aria-labelledby="my-notes">
      <div className="flex items-center justify-between">
        <h2 id="my-notes" className="flex items-center gap-2 font-semibold">
          <StickyNote className="h-4 w-4" aria-hidden="true" /> {copy.myNotes}
        </h2>
        {!notes.locked && <span className="text-xs text-slate-500">{copy.notesCount(notes.mine.length, notes.limit)}</span>}
      </div>

      {notes.locked ? (
        <p className="mt-3 flex gap-3 rounded-xl bg-slate-100 p-4 text-sm text-slate-700" role="status">
          <Lock className="h-4 w-4 flex-none" aria-hidden="true" /> {copy.notesPaused}
        </p>
      ) : (
        <>
          {notes.from_parents.length > 0 && (
            <ul className="mt-3 space-y-2">
              {notes.from_parents.map((note) => (
                <li key={note.assignment_id} className="rounded-xl border-l-4 border-primary-400 bg-primary-50 p-3 text-sm shadow-sm">
                  <p className="flex items-center gap-1 text-xs font-semibold text-primary-800">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" /> {copy.fromParent(note.from_name)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-slate-900">{note.note}</p>
                  {note.due_at && <p className="mt-1 text-xs text-slate-500">{copy.dueOn(noteDate(note.due_at, { weekday: 'short', day: 'numeric', month: 'short' }))}</p>}
                </li>
              ))}
            </ul>
          )}

          {notes.mine.length > 0 && (
            <ul className="mt-3 space-y-3">
              {notes.mine.map((note) => <OwnNote key={note.id} note={note} locale={locale} onChanged={onChanged} />)}
            </ul>
          )}

          <form onSubmit={add} className="mt-4 space-y-2">
            <label className="sr-only" htmlFor={`new-note-${lessonId}`}>{copy.newNote}</label>
            <textarea
              id={`new-note-${lessonId}`}
              rows={3}
              maxLength={MAX_LENGTH}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              disabled={atLimit}
              placeholder={copy.notePlaceholder}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:bg-slate-100"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ColourPicker value={colour} onChange={setColour} label={copy.noteColour} />
              <button type="submit" disabled={busy || atLimit || !content.trim()} className={learnSurface.primaryButton}>
                + {copy.saveNote}
              </button>
            </div>
            {(error || atLimit) && <p className="text-xs text-rose-700" role="alert">{error || copy.noteLimitReached}</p>}
            <p className="text-xs text-slate-500">{copy.notesAlsoOnNotesPage}</p>
          </form>
        </>
      )}
    </section>
  );
}
