import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Languages, Minus, Plus, Quote, SpellCheck } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { getPsalm } from '../content/psalms';

type TextSize = 'comfortable' | 'large' | 'extra-large';

const textSizeClasses: Record<TextSize, string> = {
  comfortable: 'text-2xl sm:text-3xl',
  large: 'text-3xl sm:text-4xl',
  'extra-large': 'text-4xl sm:text-5xl'
};

const textSizeOrder: TextSize[] = ['comfortable', 'large', 'extra-large'];

const readStoredVerse = (key: string, verseCount: number) => {
  try {
    const stored = Number(localStorage.getItem(key));
    return Number.isInteger(stored) && stored >= 0 && stored < verseCount ? stored : 0;
  } catch {
    return 0;
  }
};

export default function PsalmReader() {
  const { psalmNumber } = useParams<{ psalmNumber: string }>();
  const navigate = useNavigate();
  const { currentProfile } = useProfile();
  const psalm = getPsalm(Number(psalmNumber));
  const progressKey = `bible_progress:v1:${currentProfile?.id ?? 'guest'}:${psalm?.number ?? 'unknown'}`;
  const [currentVerseIndex, setCurrentVerseIndex] = useState(() => readStoredVerse(progressKey, psalm?.verses.length ?? 0));
  const [showEnglish, setShowEnglish] = useState(true);
  const [showPronunciation, setShowPronunciation] = useState(true);
  const [textSize, setTextSize] = useState<TextSize>('large');

  useEffect(() => {
    try {
      localStorage.setItem(progressKey, String(currentVerseIndex));
    } catch {
      // Reading continues even if this browser blocks local storage.
    }
  }, [currentVerseIndex, progressKey]);

  if (!psalm || !psalm.available || psalm.verses.length === 0) {
    return <Navigate to="/bible" replace />;
  }

  const verse = psalm.verses[currentVerseIndex];
  const isFirstVerse = currentVerseIndex === 0;
  const isLastVerse = currentVerseIndex === psalm.verses.length - 1;
  const progress = ((currentVerseIndex + 1) / psalm.verses.length) * 100;

  const changeTextSize = (direction: -1 | 1) => {
    const currentIndex = textSizeOrder.indexOf(textSize);
    const nextIndex = Math.min(textSizeOrder.length - 1, Math.max(0, currentIndex + direction));
    setTextSize(textSizeOrder[nextIndex]);
  };

  return (
    <div className="mx-auto max-w-5xl pb-12">
      <button
        type="button"
        onClick={() => navigate('/bible')}
        className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 font-semibold text-slate-600 transition-colors hover:bg-white hover:text-[#17324d]"
      >
        <ArrowLeft size={19} aria-hidden="true" />
        All Psalms
      </button>

      <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5">
        <div className="bg-[#17324d] px-5 py-6 text-white sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-ethiopic text-3xl font-semibold text-[#f2cf7d]" lang="ti">{psalm.tigrinyaTitle}</p>
              <h1 className="mt-1 text-2xl font-bold">{psalm.englishTitle}</h1>
              <p className="mt-1 text-sm text-slate-300">{psalm.theme}</p>
            </div>
            <p className="text-sm font-semibold text-[#f8dda1]">Verse {currentVerseIndex + 1} of {psalm.verses.length}</p>
          </div>
        </div>
        <div className="h-2 bg-slate-100" aria-label={`${Math.round(progress)} percent complete`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <div className="h-full bg-[#c99636] transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={showEnglish}
            onClick={() => setShowEnglish((visible) => !visible)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${showEnglish ? 'bg-[#e8f3ef] text-[#1d5a4d]' : 'bg-slate-100 text-slate-500'}`}
          >
            <Languages size={18} aria-hidden="true" />
            English meaning
          </button>
          <button
            type="button"
            aria-pressed={showPronunciation}
            onClick={() => setShowPronunciation((visible) => !visible)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${showPronunciation ? 'bg-[#fff2d5] text-[#805515]' : 'bg-slate-100 text-slate-500'}`}
          >
            <SpellCheck size={18} aria-hidden="true" />
            Pronunciation
          </button>
        </div>

        <div className="flex items-center gap-1 self-start rounded-xl bg-slate-100 p-1 sm:self-auto" aria-label="Tigrinya text size">
          <button
            type="button"
            onClick={() => changeTextSize(-1)}
            disabled={textSize === 'comfortable'}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Make Tigrinya text smaller"
          >
            <Minus size={17} aria-hidden="true" />
          </button>
          <span className="px-2 text-xs font-semibold text-slate-500">Text size</span>
          <button
            type="button"
            onClick={() => changeTextSize(1)}
            disabled={textSize === 'extra-large'}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Make Tigrinya text larger"
          >
            <Plus size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      <main className="mt-5 space-y-4" aria-live="polite">
        <section className="relative overflow-hidden rounded-3xl border border-[#b9cfc7] bg-[#f4faf7] p-6 sm:p-8" aria-labelledby="tigrinya-label">
          <span className="absolute right-5 top-3 font-ethiopic text-7xl text-[#246557]/5" aria-hidden="true">ዐ</span>
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#246557] text-sm font-bold text-white">1</span>
            <h2 id="tigrinya-label" className="text-sm font-bold uppercase tracking-[0.16em] text-[#246557]">Tigrinya</h2>
          </div>
          <p className={`font-ethiopic mt-6 max-w-4xl font-semibold leading-[1.8] text-[#17324d] ${textSizeClasses[textSize]}`} lang="ti">
            <span className="mr-3 text-lg text-[#a36c16]">{verse.number}</span>
            {verse.scriptText}
          </p>
        </section>

        {showEnglish ? (
          <section className="rounded-3xl border border-[#c8d4e0] bg-[#f7faff] p-6 sm:p-8" aria-labelledby="english-label">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#315d83] text-sm font-bold text-white">2</span>
              <h2 id="english-label" className="text-sm font-bold uppercase tracking-[0.16em] text-[#315d83]">English meaning</h2>
            </div>
            <div className="mt-5 flex gap-3 text-lg leading-8 text-slate-700 sm:text-xl">
              <Quote className="mt-1 shrink-0 text-[#7895ad]" size={21} aria-hidden="true" />
              <p>{verse.englishText}</p>
            </div>
          </section>
        ) : null}

        {showPronunciation ? (
          <section className="rounded-3xl border border-[#e0c58c] bg-[#fffaf0] p-6 sm:p-8" aria-labelledby="pronunciation-label">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#b47a20] text-sm font-bold text-white">3</span>
              <h2 id="pronunciation-label" className="text-sm font-bold uppercase tracking-[0.16em] text-[#8a5a12]">How to say it</h2>
            </div>
            <p className="mt-5 text-xl font-medium leading-8 tracking-wide text-[#573d19] sm:text-2xl">{verse.pronunciation}</p>
            <p className="mt-4 text-xs leading-5 text-[#836b45]">Easy-reading family pronunciation guide. Please confirm the wording with a fluent Tigrinya speaker.</p>
          </section>
        ) : null}
      </main>

      <nav className="mt-6 grid grid-cols-2 gap-3" aria-label="Verse navigation">
        <button
          type="button"
          disabled={isFirstVerse}
          onClick={() => setCurrentVerseIndex((index) => Math.max(0, index - 1))}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={21} aria-hidden="true" />
          Previous
        </button>
        <button
          type="button"
          disabled={isLastVerse}
          onClick={() => setCurrentVerseIndex((index) => Math.min(psalm.verses.length - 1, index + 1))}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#17324d] px-4 font-semibold text-white shadow-md transition-colors hover:bg-[#244765] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next verse
          <ChevronRight size={21} aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}
