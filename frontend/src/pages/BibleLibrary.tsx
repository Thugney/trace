import { ArrowRight, BookHeart, BookOpen, LockKeyhole, Languages } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PSALMS } from '../content/psalms';

export default function BibleLibrary() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      <section className="relative overflow-hidden rounded-[2rem] bg-[#17324d] px-6 py-9 text-white shadow-xl shadow-slate-900/10 sm:px-10 sm:py-12">
        <div className="absolute -right-10 -top-20 h-72 w-72 rounded-full border border-[#efc66d]/20" aria-hidden="true" />
        <div className="absolute -right-2 -top-10 h-48 w-48 rounded-full border border-[#efc66d]/30" aria-hidden="true" />
        <div className="relative max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-medium text-[#f8dda1]">
            <BookHeart size={16} aria-hidden="true" />
            Psalms for the family
          </div>
          <p className="font-ethiopic text-4xl font-semibold leading-tight text-[#f7d78e] sm:text-6xl" lang="ti">
            መዝሙር ዳዊት
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Read it. Understand it. Learn to say it.</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">
            Begin with short Psalms for prayer, repentance, comfort, and praise. Every verse is taught in three clear layers.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-3" aria-label="The three learning layers">
            {[
              ['1', 'Tigrinya', 'Read the original script'],
              ['2', 'English', 'Understand the meaning'],
              ['3', 'Pronunciation', 'Learn how to say it']
            ].map(([number, title, description]) => (
              <div key={number} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#efc66d] text-sm font-bold text-[#17324d]">{number}</span>
                  <div>
                    <p className="font-semibold text-white">{title}</p>
                    <p className="text-xs text-slate-300">{description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="psalms-heading">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#a36613]">Starting collection</p>
            <h2 id="psalms-heading" className="mt-1 text-2xl font-bold text-slate-900">Choose a Psalm</h2>
          </div>
          <p className="text-sm text-slate-500">Psalm 51 opens with the first three source verses prepared for family review.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PSALMS.map((psalm) => (
            <article
              key={psalm.number}
              className={`group relative flex min-h-64 flex-col overflow-hidden rounded-3xl border p-6 transition-all duration-200 ${
                psalm.available
                  ? 'border-[#d7b66b]/50 bg-white shadow-md shadow-slate-900/5 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10'
                  : 'border-slate-200 bg-slate-50/80'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${psalm.available ? 'bg-[#eef5f1] text-[#246557]' : 'bg-slate-200 text-slate-500'}`}>
                  {psalm.available ? <BookOpen size={24} aria-hidden="true" /> : <LockKeyhole size={21} aria-hidden="true" />}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${psalm.available ? 'bg-[#fff4d8] text-[#8a5a12]' : 'bg-slate-200 text-slate-600'}`}>
                  {psalm.available ? `${psalm.verses.length} verses ready` : 'Coming next'}
                </span>
              </div>

              <p className="font-ethiopic mt-5 text-2xl font-semibold text-[#17324d]" lang="ti">{psalm.tigrinyaTitle}</p>
              <h3 className="mt-1 text-xl font-bold text-slate-900">{psalm.englishTitle}</h3>
              <p className="mt-2 font-semibold text-[#246557]">{psalm.theme}</p>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{psalm.description}</p>

              {psalm.available ? (
                <button
                  type="button"
                  onClick={() => navigate(`/bible/psalms/${psalm.number}`)}
                  className="mt-5 inline-flex min-h-11 items-center justify-between rounded-2xl bg-[#17324d] px-4 py-3 text-left font-semibold text-white transition-colors hover:bg-[#244765] focus-visible:ring-[#d5a94c]"
                >
                  Start reading
                  <ArrowRight size={19} aria-hidden="true" />
                </button>
              ) : (
                <div className="mt-5 flex min-h-11 items-center gap-2 rounded-2xl bg-slate-200/70 px-4 py-3 text-sm font-medium text-slate-500">
                  <Languages size={18} aria-hidden="true" />
                  Translation review needed
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <aside className="rounded-2xl border border-[#d9c99e] bg-[#fffaf0] p-5 text-sm leading-6 text-[#664a1d]">
        <strong>Source note:</strong> Tigrinya scripture is credited to Geez Experience and the Bible Society of Eritrea. English meaning uses the public-domain World English Bible. Pronunciation is a family review copy and should be confirmed by a fluent speaker before more Psalms are published.
      </aside>
    </div>
  );
}
