/**
 * FamilyHub Learn - grade 8 pilot catalog fixtures (Bokmål; English lessons in English).
 *
 * Source-of-truth rules (docs/familyhub-learn-architecture.md §3):
 * - Every lesson and mock exam ships as `draft`. Only a FamilyHub admin can mark
 *   it `reviewed` (POST /api/learn/lessons/:id/review), which records the real
 *   reviewer and timestamp. Learners only ever see reviewed content.
 * - Competence goal descriptions are short paraphrases with a source locator,
 *   not copies of Udir text, and start `unverified`. A reviewer must confirm
 *   the mapping against udir.no. No official goal codes are invented.
 * - Mathematics has goals after grade 8. The other subjects map grade 8
 *   teaching to goals after grade 10; the UI states this and never presents a
 *   local sequence as an official grade 8 goal.
 * - Content is original teaching text written for FamilyHub (AI-assisted
 *   draft). No third-party textbook content is copied.
 */

export type LessonSection = { heading: string; paragraphs: string[]; bullets?: string[] };
export type WorkedExample = { title: string; problem: string; steps: string[]; answer: string };
export type KeyTerm = { term: string; definition: string };

export type LessonBody = {
  intro: string;
  sections: LessonSection[];
  workedExamples: WorkedExample[];
  keyTerms: KeyTerm[];
  checkYourself: string[];
};

// Practice items use the existing Learning Activity Engine formats so they are
// delivered and server-scored by routes/activities.ts (no new quiz engine).
export type PracticeItem =
  | {
      key: string;
      type: 'multiple_choice';
      title: string;
      instructions?: string;
      content: { question: string; options: { id: string; text: string }[] };
      correct: { correctAnswer: string };
      hints: string[];
      explanation: string;
    }
  | {
      key: string;
      type: 'fill_blanks';
      title: string;
      instructions?: string;
      content: { sentences: string[] };
      correct: { blanks: { position: number; answer: string; acceptAlternatives?: string[] }[] };
      hints: string[];
      explanation: string;
    };

export type Flashcard = { key: string; front: string; back: string };

export type MockExamItem = {
  key: string;
  criterion: string;
  type: 'multiple_choice' | 'short_answer';
  prompt: string;
  options?: { id: string; text: string }[];
  answer: string;
  acceptAlternatives?: string[];
  points: number;
  explanation: string;
};

export type MockExamRubric = {
  criteria: { key: string; label: string; description: string }[];
  minItemsAnsweredPerCriterion: number;
  minAnsweredRatio: number;
  gradeBands: { minPercent: number; grade: number }[];
  limitations: string[];
  disclaimer: string;
};

export type GoalFixture = {
  key: string;
  goalAfterGrade: number;
  description: string;
  sourceLocator: string;
};

export type SubjectFixture = {
  slug: string;
  title: string;
  udirCode: string;
  instructionLocale: 'nb' | 'en';
  sortOrder: number;
  sourceUrl: string;
  goals: GoalFixture[];
  topic: {
    slug: string;
    grade: number;
    title: string;
    summary: string;
    goalKeys: string[];
    lesson: {
      slug: string;
      version: number;
      title: string;
      body: LessonBody;
      practice: PracticeItem[];
      flashcards: Flashcard[];
    };
    mockExam: {
      slug: string;
      version: number;
      title: string;
      timeLimitMinutes: number;
      rubricVersion: number;
      items: MockExamItem[];
      rubric: MockExamRubric;
    };
  };
};

export const CURRICULUM_REVISION = 'LK20';
export const AUTHORED_BY = 'FamilyHub Learn (AI-assisted draft, awaiting human review)';

// Shared, deterministic grade bands for the indicative 1-6 estimate.
const GRADE_BANDS = [
  { minPercent: 85, grade: 6 },
  { minPercent: 70, grade: 5 },
  { minPercent: 55, grade: 4 },
  { minPercent: 40, grade: 3 },
  { minPercent: 20, grade: 2 },
  { minPercent: 0, grade: 1 }
];

const NB_DISCLAIMER =
  'Dette er en indikativ karakter basert på et kort øvingsprøvesett. Den er ikke en offisiell karakter, ' +
  'og den er ikke en prognose for standpunktkarakter.';
const EN_DISCLAIMER =
  'This is an indicative grade based on a short practice set. It is not an official grade and it is not ' +
  'a prediction of your final (standpunkt) grade.';

const mc = (id: string, text: string) => ({ id, text });

export const GRADE8_PILOT: SubjectFixture[] = [
  // ---------------------------------------------------------------- Mathematics
  {
    slug: 'matematikk',
    title: 'Matematikk',
    udirCode: 'MAT01-05',
    instructionLocale: 'nb',
    sortOrder: 1,
    sourceUrl: 'https://www.udir.no/lk20/mat01-05',
    goals: [
      {
        key: 'mat-8-primtallsfaktorisering',
        goalAfterGrade: 8,
        description:
          'Utforske og beskrive primtallsfaktorisering og bruke det i brøkregning (ordlyd bekreftet i flere skolers ' +
          'årsplaner; må kontrolleres mot udir.no).',
        sourceLocator: 'MAT01-05 · Kompetansemål etter 8. trinn · tall og brøk'
      }
    ],
    topic: {
      slug: 'primtallsfaktorisering-og-brok',
      grade: 8,
      title: 'Primtallsfaktorisering og brøk',
      summary: 'Finn primtallene som bygger opp et tall, og bruk dem til å forkorte brøker og finne fellesnevner.',
      goalKeys: ['mat-8-primtallsfaktorisering'],
      lesson: {
        slug: 'primtall-og-brok',
        version: 1,
        title: 'Primtall, faktorisering og brøkregning',
        body: {
          intro:
            'Alle hele tall større enn 1 kan bygges av primtall, omtrent som et hus bygges av klosser. ' +
            'Når du kjenner klossene, blir det mye enklere å forkorte brøker og finne fellesnevner.',
          sections: [
            {
              heading: 'Primtall og sammensatte tall',
              paragraphs: [
                'Et primtall er et naturlig tall større enn 1 som bare er delelig med 1 og seg selv. ' +
                  'De første primtallene er 2, 3, 5, 7, 11, 13, 17, 19, 23 og 29.',
                'Et sammensatt tall har flere faktorer enn 1 og seg selv. 12 er sammensatt fordi 12 = 3 · 4.'
              ],
              bullets: [
                '1 er verken primtall eller sammensatt tall – det har bare én faktor.',
                '2 er det eneste partallet som er et primtall.',
                'Tips: Et tall som ender på 0, 2, 4, 6 eller 8 (og er større enn 2) er alltid sammensatt.'
              ]
            },
            {
              heading: 'Primtallsfaktorisering',
              paragraphs: [
                'Å primtallsfaktorisere betyr å skrive et tall som et produkt av bare primtall. ' +
                  'Del tallet på det minste primtallet som går opp, og fortsett med svaret til du står igjen med 1.',
                'Uansett hvilken rekkefølge du deler i, får du alltid de samme primtallene. ' +
                  'Vi skriver dem ofte i stigende rekkefølge, for eksempel 60 = 2 · 2 · 3 · 5.'
              ]
            },
            {
              heading: 'Forkorte brøker med primtall',
              paragraphs: [
                'Skriv teller og nevner som produkter av primtall. Faktorer som finnes i begge, kan du stryke. ' +
                  'Da ser du med en gang den største felles faktoren, og brøken blir forkortet så langt som mulig.'
              ]
            },
            {
              heading: 'Fellesnevner',
              paragraphs: [
                'For å legge sammen brøker trenger du en fellesnevner. Den minste fellesnevneren er det ' +
                  'minste felles multiplum (MFM) av nevnerne. Ta med hver primtallsfaktor så mange ganger ' +
                  'som den forekommer i den nevneren der den forekommer flest ganger.'
              ]
            }
          ],
          workedExamples: [
            {
              title: 'Primtallsfaktoriser 60',
              problem: 'Skriv 60 som et produkt av primtall.',
              steps: ['60 : 2 = 30', '30 : 2 = 15', '15 : 3 = 5', '5 : 5 = 1'],
              answer: '60 = 2 · 2 · 3 · 5'
            },
            {
              title: 'Forkort 18/24',
              problem: 'Forkort brøken 18/24 så langt som mulig.',
              steps: [
                '18 = 2 · 3 · 3 og 24 = 2 · 2 · 2 · 3',
                'Felles faktorer er 2 og 3, altså 2 · 3 = 6',
                '18 : 6 = 3 og 24 : 6 = 4'
              ],
              answer: '18/24 = 3/4'
            },
            {
              title: 'Legg sammen 1/6 + 3/8',
              problem: 'Finn minste fellesnevner og regn ut 1/6 + 3/8.',
              steps: [
                '6 = 2 · 3 og 8 = 2 · 2 · 2',
                'MFM: tre 2-ere (fra 8) og én 3-er (fra 6): 2 · 2 · 2 · 3 = 24',
                '1/6 = 4/24 og 3/8 = 9/24',
                '4/24 + 9/24 = 13/24'
              ],
              answer: '13/24'
            }
          ],
          keyTerms: [
            { term: 'Primtall', definition: 'Naturlig tall større enn 1 som bare er delelig med 1 og seg selv.' },
            { term: 'Sammensatt tall', definition: 'Tall større enn 1 som har flere faktorer enn 1 og seg selv.' },
            { term: 'Faktor', definition: 'Et tall som ganges med et annet tall i et produkt.' },
            { term: 'Primtallsfaktorisering', definition: 'Å skrive et tall som et produkt av bare primtall.' },
            { term: 'Minste felles multiplum (MFM)', definition: 'Det minste tallet som alle de gitte tallene går opp i.' }
          ],
          checkYourself: [
            'Kan du forklare hvorfor 1 ikke er et primtall?',
            'Kan du primtallsfaktorisere 72?',
            'Kan du forkorte 30/42 ved hjelp av primtallsfaktorer?'
          ]
        },
        practice: [
          {
            key: 'mat-p1',
            type: 'multiple_choice',
            title: 'Finn primtallet',
            content: { question: 'Hvilket av disse tallene er et primtall?', options: [mc('a', '21'), mc('b', '27'), mc('c', '29'), mc('d', '33')] },
            correct: { correctAnswer: 'c' },
            hints: ['Prøv å dele hvert tall på 3.'],
            explanation: '21 = 3 · 7, 27 = 3 · 9 og 33 = 3 · 11. Bare 29 er delelig med kun 1 og seg selv.'
          },
          {
            key: 'mat-p2',
            type: 'multiple_choice',
            title: 'Primtallsfaktoriser 36',
            content: { question: 'Hva er primtallsfaktoriseringen av 36?', options: [mc('a', '2 · 18'), mc('b', '4 · 9'), mc('c', '2 · 2 · 3 · 3'), mc('d', '6 · 6')] },
            correct: { correctAnswer: 'c' },
            hints: ['Alle faktorene må være primtall.'],
            explanation: '18, 4, 9 og 6 er ikke primtall. 36 = 2 · 2 · 3 · 3.'
          },
          {
            key: 'mat-p3',
            type: 'fill_blanks',
            title: 'Forkort brøken',
            instructions: 'Skriv svaret som en brøk, for eksempel 2/3.',
            content: { sentences: ['18/24 forkortet så langt som mulig blir ___.'] },
            correct: { blanks: [{ position: 0, answer: '3/4' }] },
            hints: ['18 = 2 · 3 · 3 og 24 = 2 · 2 · 2 · 3.'],
            explanation: 'Felles faktor er 2 · 3 = 6. 18 : 6 = 3 og 24 : 6 = 4.'
          },
          {
            key: 'mat-p4',
            type: 'multiple_choice',
            title: 'Minste fellesnevner',
            content: { question: 'Hva er minste fellesnevner for 1/6 og 3/8?', options: [mc('a', '12'), mc('b', '14'), mc('c', '24'), mc('d', '48')] },
            correct: { correctAnswer: 'c' },
            hints: ['Primtallsfaktoriser 6 og 8.'],
            explanation: '6 = 2 · 3 og 8 = 2 · 2 · 2. MFM = 2 · 2 · 2 · 3 = 24.'
          },
          {
            key: 'mat-p5',
            type: 'fill_blanks',
            title: 'Legg sammen brøker',
            instructions: 'Skriv svaret som en forkortet brøk.',
            content: { sentences: ['1/6 + 3/8 = ___'] },
            correct: { blanks: [{ position: 0, answer: '13/24' }] },
            hints: ['Gjør om begge brøkene til 24-deler.'],
            explanation: '1/6 = 4/24 og 3/8 = 9/24, så summen er 13/24.'
          }
        ],
        flashcards: [
          { key: 'mat-f1', front: 'Primtall', back: 'Naturlig tall større enn 1 som bare er delelig med 1 og seg selv (2, 3, 5, 7, 11 ...).' },
          { key: 'mat-f2', front: 'Er 1 et primtall?', back: 'Nei. 1 har bare én faktor.' },
          { key: 'mat-f3', front: 'Primtallsfaktoriser 60', back: '60 = 2 · 2 · 3 · 5' },
          { key: 'mat-f4', front: 'Minste felles multiplum (MFM)', back: 'Det minste tallet som alle tallene går opp i. Brukes som minste fellesnevner.' },
          { key: 'mat-f5', front: 'Hvordan forkorte med primtall?', back: 'Faktoriser teller og nevner og stryk faktorene som finnes i begge.' },
          { key: 'mat-f6', front: 'Eneste partall som er primtall', back: '2' }
        ]
      },
      mockExam: {
        slug: 'primtall-og-brok-provesett',
        version: 1,
        title: 'Øvingsprøve: Primtall og brøk',
        timeLimitMinutes: 30,
        rubricVersion: 1,
        items: [
          {
            key: 'c1', criterion: 'begreper', type: 'multiple_choice', points: 2,
            prompt: 'Hva er et primtall?',
            options: [mc('a', 'Et tall som bare kan deles på 2'), mc('b', 'Et naturlig tall større enn 1 som bare er delelig med 1 og seg selv'), mc('c', 'Et oddetall'), mc('d', 'Et tall med mange faktorer')],
            answer: 'b', explanation: 'Definisjonen av primtall.'
          },
          {
            key: 'c2', criterion: 'begreper', type: 'multiple_choice', points: 2,
            prompt: 'Er 1 et primtall?',
            options: [mc('a', 'Ja'), mc('b', 'Nei, fordi 1 bare har én faktor'), mc('c', 'Nei, fordi 1 er et partall')],
            answer: 'b', explanation: '1 har bare faktoren 1 og er derfor ikke et primtall.'
          },
          {
            key: 'c3', criterion: 'begreper', type: 'multiple_choice', points: 2,
            prompt: 'Hvilket tall er et sammensatt tall?',
            options: [mc('a', '13'), mc('b', '17'), mc('c', '19'), mc('d', '51')],
            answer: 'd', explanation: '51 = 3 · 17.'
          },
          {
            key: 'f1', criterion: 'faktorisering', type: 'short_answer', points: 2,
            prompt: 'Primtallsfaktoriser 84. Skriv faktorene i stigende rekkefølge med · mellom, for eksempel 2·3·5.',
            answer: '2·2·3·7', acceptAlternatives: ['2*2*3*7', '2x2x3x7', '2^2·3·7', '2²·3·7', '2^2*3*7'],
            explanation: '84 : 2 = 42, 42 : 2 = 21, 21 : 3 = 7, 7 : 7 = 1.'
          },
          {
            key: 'f2', criterion: 'faktorisering', type: 'short_answer', points: 2,
            prompt: 'Hva er det største primtallet i primtallsfaktoriseringen av 90?',
            answer: '5', explanation: '90 = 2 · 3 · 3 · 5.'
          },
          {
            key: 'f3', criterion: 'faktorisering', type: 'multiple_choice', points: 2,
            prompt: '2 · 3 · 3 · 5 · 7 er primtallsfaktoriseringen av hvilket tall?',
            options: [mc('a', '105'), mc('b', '210'), mc('c', '315'), mc('d', '630')],
            answer: 'd', explanation: '2 · 3 = 6, 6 · 3 = 18, 18 · 5 = 90, 90 · 7 = 630.'
          },
          {
            key: 'b1', criterion: 'brokregning', type: 'short_answer', points: 2,
            prompt: 'Forkort 42/56 så langt som mulig.',
            answer: '3/4', explanation: '42 = 2 · 3 · 7 og 56 = 2 · 2 · 2 · 7. Felles faktor 14 gir 3/4.'
          },
          {
            key: 'b2', criterion: 'brokregning', type: 'short_answer', points: 2,
            prompt: 'Hva er minste fellesnevner for 5/12 og 7/18?',
            answer: '36', explanation: '12 = 2 · 2 · 3 og 18 = 2 · 3 · 3. MFM = 2 · 2 · 3 · 3 = 36.'
          },
          {
            key: 'b3', criterion: 'brokregning', type: 'short_answer', points: 2,
            prompt: 'Regn ut 5/12 + 7/18. Skriv svaret som en forkortet brøk.',
            answer: '29/36', explanation: '5/12 = 15/36 og 7/18 = 14/36. Summen er 29/36.'
          }
        ],
        rubric: {
          criteria: [
            { key: 'begreper', label: 'Begreper', description: 'Forklarer og kjenner igjen primtall og sammensatte tall.' },
            { key: 'faktorisering', label: 'Primtallsfaktorisering', description: 'Faktoriserer tall korrekt og tolker faktoriseringer.' },
            { key: 'brokregning', label: 'Brøkregning', description: 'Bruker primtallsfaktorer til å forkorte og finne fellesnevner.' }
          ],
          minItemsAnsweredPerCriterion: 2,
          minAnsweredRatio: 0.8,
          gradeBands: GRADE_BANDS,
          limitations: [
            'Prøvesettet dekker bare ett tema og har 9 oppgaver.',
            'Muntlige ferdigheter, utforsking og begrunnelser vurderes ikke automatisk.'
          ],
          disclaimer: NB_DISCLAIMER
        }
      }
    }
  },

  // ---------------------------------------------------------------- Norwegian
  {
    slug: 'norsk',
    title: 'Norsk',
    udirCode: 'NOR01-06',
    instructionLocale: 'nb',
    sortOrder: 2,
    sourceUrl: 'https://www.udir.no/lk20/nor01-06',
    goals: [
      {
        key: 'nor-10-argumentasjon',
        goalAfterGrade: 10,
        description:
          'Parafrase: skrive argumenterende tekster med tydelig påstand, begrunnelser og motargumenter, tilpasset ' +
          'mottaker og formål. Må kontrolleres mot ordlyden på udir.no.',
        sourceLocator: 'NOR01-06 · Kompetansemål etter 10. trinn · skriving og argumentasjon'
      },
      {
        key: 'nor-10-retorikk',
        goalAfterGrade: 10,
        description:
          'Parafrase: lese og vurdere argumentasjon og retoriske virkemidler i tekster. Må kontrolleres mot udir.no.',
        sourceLocator: 'NOR01-06 · Kompetansemål etter 10. trinn · lesing og retorikk'
      }
    ],
    topic: {
      slug: 'argumenterende-tekst',
      grade: 8,
      title: 'Argumenterende tekst',
      summary: 'Lær å bygge opp en påstand med argumenter og belegg, møte motargumenter og kjenne igjen appellformer.',
      goalKeys: ['nor-10-argumentasjon', 'nor-10-retorikk'],
      lesson: {
        slug: 'argumentasjon',
        version: 1,
        title: 'Slik argumenterer du overbevisende',
        body: {
          intro:
            'I en argumenterende tekst prøver du å overbevise leseren om at du har rett. ' +
            'Det gjør du ikke ved å gjenta meningen din høyere, men ved å begrunne den godt.',
          sections: [
            {
              heading: 'Påstand, argument og belegg',
              paragraphs: [
                'Påstanden er meningen du vil få leseren med på, for eksempel «Skoledagen bør starte klokka ni».',
                'Et argument er en grunn til at påstanden er riktig. Belegg er det som støtter argumentet: ' +
                  'fakta, eksempler, tall eller erfaringer.'
              ],
              bullets: [
                'Påstand: hva mener du?',
                'Argument: hvorfor mener du det?',
                'Belegg: hvordan kan du vise at argumentet holder?'
              ]
            },
            {
              heading: 'Motargumenter',
              paragraphs: [
                'Et motargument er et argument mot din egen påstand. Når du tar med et motargument og svarer på det ' +
                  '(tilbakeviser det), viser du at du har tenkt grundig. Det gjør teksten mer troverdig.'
              ]
            },
            {
              heading: 'Oppbygning',
              paragraphs: [
                'Innledningen presenterer saken og påstanden din. Hoveddelen har ett avsnitt per argument, ' +
                  'og gjerne et avsnitt der du møter et motargument. Avslutningen oppsummerer og gjentar påstanden ' +
                  'kort – her kommer det ikke nye argumenter.'
              ]
            },
            {
              heading: 'Appellformer: etos, patos og logos',
              paragraphs: [
                'Etos handler om troverdighet: hvorfor skal leseren stole på avsenderen? ' +
                  'Patos spiller på følelser. Logos bruker fornuft, fakta og logiske resonnementer.',
                'En god argumenterende tekst bruker ofte alle tre, men logos bør bære hovedtyngden.'
              ]
            }
          ],
          workedExamples: [
            {
              title: 'Bygg et argumentavsnitt',
              problem: 'Påstand: «Skoledagen bør starte klokka ni.» Lag et avsnitt med argument og belegg.',
              steps: [
                'Argument: Ungdom trenger mye søvn for å konsentrere seg.',
                'Belegg: Mange søvnforskere anbefaler 8–10 timer søvn for tenåringer, og mange får mindre enn det.',
                'Kobling til påstanden: En senere start gir flere elever mulighet til å sove nok.'
              ],
              answer:
                'Ungdom trenger mye søvn for å kunne konsentrere seg på skolen. Mange søvnforskere anbefaler 8–10 timer ' +
                'for tenåringer, og mange får mindre enn det. Starter skoledagen klokka ni, får flere elever mulighet ' +
                'til å sove nok.'
            },
            {
              title: 'Kjenn igjen appellformen',
              problem: '«Som lege med tjue års erfaring vet jeg at søvn er viktig.» Hvilken appellform er dette?',
              steps: ['Avsenderen viser til egen kompetanse og erfaring.', 'Det handler om troverdighet.'],
              answer: 'Etos'
            }
          ],
          keyTerms: [
            { term: 'Påstand', definition: 'Meningen du vil overbevise leseren om.' },
            { term: 'Argument', definition: 'En begrunnelse for at påstanden er riktig.' },
            { term: 'Belegg', definition: 'Fakta, eksempler eller erfaringer som støtter argumentet.' },
            { term: 'Motargument', definition: 'Et argument mot din egen påstand.' },
            { term: 'Etos, patos, logos', definition: 'Appell til troverdighet, følelser og fornuft.' }
          ],
          checkYourself: [
            'Kan du forklare forskjellen på argument og belegg?',
            'Hvorfor kan det styrke teksten å ta med et motargument?',
            'Hva hører hjemme i avslutningen – og hva gjør ikke det?'
          ]
        },
        practice: [
          {
            key: 'nor-p1',
            type: 'multiple_choice',
            title: 'Finn påstanden',
            content: {
              question: 'Hvilken setning er en påstand?',
              options: [mc('a', 'Mange elever sykler til skolen.'), mc('b', 'Kommunen bør bygge flere sykkelveier.'), mc('c', 'I fjor ble det bygd to nye veier.'), mc('d', 'Sykkelen ble oppfunnet på 1800-tallet.')]
            },
            correct: { correctAnswer: 'b' },
            hints: ['En påstand er en mening noen kan være uenig i.'],
            explanation: 'De andre setningene er fakta. «Kommunen bør ...» er en mening som må begrunnes.'
          },
          {
            key: 'nor-p2',
            type: 'multiple_choice',
            title: 'Appellform',
            content: {
              question: '«Tenk på alle dyrene som mister hjemmet sitt når skogen hugges.» Hvilken appellform brukes mest?',
              options: [mc('a', 'Etos'), mc('b', 'Patos'), mc('c', 'Logos')]
            },
            correct: { correctAnswer: 'b' },
            hints: ['Prøver setningen å vekke en følelse?'],
            explanation: 'Setningen spiller på medfølelse, altså patos.'
          },
          {
            key: 'nor-p3',
            type: 'fill_blanks',
            title: 'Begreper',
            content: { sentences: ['Et ___ er et argument mot din egen påstand.'] },
            correct: { blanks: [{ position: 0, answer: 'motargument' }] },
            hints: ['Ordet begynner på «mot».'],
            explanation: 'Et motargument er et argument mot påstanden din.'
          },
          {
            key: 'nor-p4',
            type: 'multiple_choice',
            title: 'Avslutningen',
            content: {
              question: 'Hva bør du IKKE gjøre i avslutningen av en argumenterende tekst?',
              options: [mc('a', 'Oppsummere argumentene'), mc('b', 'Gjenta påstanden kort'), mc('c', 'Komme med et helt nytt argument')]
            },
            correct: { correctAnswer: 'c' },
            hints: ['Avslutningen skal runde av.'],
            explanation: 'Nye argumenter hører hjemme i hoveddelen.'
          },
          {
            key: 'nor-p5',
            type: 'multiple_choice',
            title: 'Logos',
            content: {
              question: 'Hvilken setning bruker mest logos?',
              options: [mc('a', 'Alle vet jo at dette er dumt.'), mc('b', 'Hvis vi sparer 50 kroner i uka, har vi 2600 kroner etter et år.'), mc('c', 'Jeg blir så lei meg når jeg tenker på det.')]
            },
            correct: { correctAnswer: 'b' },
            hints: ['Logos bruker tall og fornuft.'],
            explanation: 'Utregningen er et logisk resonnement: 50 · 52 = 2600.'
          }
        ],
        flashcards: [
          { key: 'nor-f1', front: 'Påstand', back: 'Meningen du vil overbevise leseren om.' },
          { key: 'nor-f2', front: 'Belegg', back: 'Fakta, eksempler, tall eller erfaringer som støtter et argument.' },
          { key: 'nor-f3', front: 'Motargument', back: 'Et argument mot din egen påstand – møt det og tilbakevis det.' },
          { key: 'nor-f4', front: 'Etos', back: 'Appell til avsenderens troverdighet.' },
          { key: 'nor-f5', front: 'Patos', back: 'Appell til følelser.' },
          { key: 'nor-f6', front: 'Logos', back: 'Appell til fornuft, fakta og logikk.' }
        ]
      },
      mockExam: {
        slug: 'argumentasjon-provesett',
        version: 1,
        title: 'Øvingsprøve: Argumenterende tekst',
        timeLimitMinutes: 25,
        rubricVersion: 1,
        items: [
          {
            key: 'b1', criterion: 'begreper', type: 'multiple_choice', points: 2,
            prompt: 'Hva er belegg i en argumenterende tekst?',
            options: [mc('a', 'Meningen din'), mc('b', 'Det som støtter et argument, for eksempel fakta eller eksempler'), mc('c', 'Overskriften')],
            answer: 'b', explanation: 'Belegg støtter argumentet.'
          },
          {
            key: 'b2', criterion: 'begreper', type: 'short_answer', points: 2,
            prompt: 'Hva kalles et argument mot din egen påstand? (ett ord)',
            answer: 'motargument', acceptAlternatives: ['et motargument', 'motargumentet'],
            explanation: 'Et motargument.'
          },
          {
            key: 'b3', criterion: 'begreper', type: 'multiple_choice', points: 2,
            prompt: 'Hvilken setning er et argument for påstanden «Skolen bør ha lengre friminutt»?',
            options: [mc('a', 'Friminuttet er nå 15 minutter.'), mc('b', 'Fysisk aktivitet i pausene kan gjøre det lettere å konsentrere seg etterpå.'), mc('c', 'Skolen har to skolegårder.')],
            answer: 'b', explanation: 'Bare b gir en grunn til at påstanden er riktig.'
          },
          {
            key: 'a1', criterion: 'appellformer', type: 'multiple_choice', points: 2,
            prompt: '«Som trener i tolv år har jeg sett hvor mye laget betyr for barna.» Hvilken appellform?',
            options: [mc('a', 'Etos'), mc('b', 'Patos'), mc('c', 'Logos')],
            answer: 'a', explanation: 'Avsenderen bygger troverdighet med erfaring.'
          },
          {
            key: 'a2', criterion: 'appellformer', type: 'multiple_choice', points: 2,
            prompt: '«Undersøkelsen viser at 7 av 10 elever ønsker dette.» Hvilken appellform?',
            options: [mc('a', 'Etos'), mc('b', 'Patos'), mc('c', 'Logos')],
            answer: 'c', explanation: 'Tall og fakta er logos.'
          },
          {
            key: 'a3', criterion: 'appellformer', type: 'short_answer', points: 2,
            prompt: 'Hvilken appellform spiller på følelser? (ett ord)',
            answer: 'patos', explanation: 'Patos.'
          },
          {
            key: 'o1', criterion: 'oppbygning', type: 'multiple_choice', points: 2,
            prompt: 'Hvor presenterer du vanligvis påstanden din første gang?',
            options: [mc('a', 'I innledningen'), mc('b', 'Bare i avslutningen'), mc('c', 'I kildelista')],
            answer: 'a', explanation: 'Innledningen presenterer saken og påstanden.'
          },
          {
            key: 'o2', criterion: 'oppbygning', type: 'multiple_choice', points: 2,
            prompt: 'Hvordan er hoveddelen ofte bygd opp?',
            options: [mc('a', 'Ett avsnitt per argument'), mc('b', 'Én lang setning'), mc('c', 'Bare spørsmål')],
            answer: 'a', explanation: 'Ett argument per avsnitt gir tydelig struktur.'
          },
          {
            key: 'o3', criterion: 'oppbygning', type: 'multiple_choice', points: 2,
            prompt: 'Hva er lurt å gjøre etter at du har presentert et motargument?',
            options: [mc('a', 'Ignorere det'), mc('b', 'Svare på det og vise hvorfor påstanden din likevel holder'), mc('c', 'Bytte påstand')],
            answer: 'b', explanation: 'Å tilbakevise motargumentet styrker teksten.'
          }
        ],
        rubric: {
          criteria: [
            { key: 'begreper', label: 'Begreper', description: 'Skiller mellom påstand, argument, belegg og motargument.' },
            { key: 'appellformer', label: 'Appellformer', description: 'Kjenner igjen etos, patos og logos.' },
            { key: 'oppbygning', label: 'Oppbygning', description: 'Vet hvordan en argumenterende tekst er bygd opp.' }
          ],
          minItemsAnsweredPerCriterion: 2,
          minAnsweredRatio: 0.8,
          gradeBands: GRADE_BANDS,
          limitations: [
            'Prøven måler kunnskap om argumentasjon, ikke skriveferdighet. Egen skriving må vurderes av en voksen eller lærer.',
            'Kort prøvesett med 9 oppgaver.'
          ],
          disclaimer: NB_DISCLAIMER
        }
      }
    }
  },

  // ---------------------------------------------------------------- English
  {
    slug: 'engelsk',
    title: 'English',
    udirCode: 'ENG01-04',
    instructionLocale: 'en',
    sortOrder: 3,
    sourceUrl: 'https://www.udir.no/lk20/eng01-04',
    goals: [
      {
        key: 'eng-10-adapted-texts',
        goalAfterGrade: 10,
        description:
          'Paraphrase: write formal and informal texts adapted to purpose, recipient and situation. ' +
          'Verify the wording on udir.no.',
        sourceLocator: 'ENG01-04 · Competence aims after Year 10 · written communication'
      }
    ],
    topic: {
      slug: 'formal-and-informal-language',
      grade: 8,
      title: 'Formal and informal language',
      summary: 'Choose the right register and write a polite, well-structured formal email.',
      goalKeys: ['eng-10-adapted-texts'],
      lesson: {
        slug: 'formal-email',
        version: 1,
        title: 'Writing a formal email',
        body: {
          intro:
            'You do not talk to a head teacher the same way you talk to your best friend. ' +
            'Choosing the right style – the register – is part of writing good English.',
          sections: [
            {
              heading: 'What is register?',
              paragraphs: [
                'Register is how formal or informal your language is. Informal language is relaxed and personal. ' +
                  'Formal language is polite, clear and more neutral.'
              ],
              bullets: [
                'Informal: "Hey! Can\'t come tomorrow, sorry :)"',
                'Formal: "Dear Mr Berg, Unfortunately, I am unable to attend tomorrow."'
              ]
            },
            {
              heading: 'The parts of a formal email',
              paragraphs: [
                'A formal email has a clear subject line, a greeting, a short body and a closing.'
              ],
              bullets: [
                'Subject line: "Question about the school trip on 12 May"',
                'Greeting: "Dear Ms Hansen," (or "Dear Sir or Madam," if you do not know the name)',
                'Body: say why you are writing in the first sentence, then add details',
                'Closing: "Kind regards," or "Best regards," followed by your full name'
              ]
            },
            {
              heading: 'Polite and formal language',
              paragraphs: [
                'Avoid contractions such as "don\'t" and "can\'t" – write "do not" and "cannot". ' +
                  'Avoid slang and emojis. Make polite requests with "Could you ...?" or "I would like to ...".'
              ]
            }
          ],
          workedExamples: [
            {
              title: 'Make it formal',
              problem: 'Rewrite: "Hi! Wanna know when the bus leaves for the trip. Thx!"',
              steps: [
                'Add a formal greeting: "Dear Mr Olsen,"',
                'Replace slang ("wanna", "Thx") with full, polite phrases.',
                'Use a polite request: "Could you please tell me ...?"',
                'Add a formal closing with your full name.'
              ],
              answer:
                'Dear Mr Olsen, Could you please tell me what time the bus leaves for the school trip? ' +
                'Thank you in advance. Kind regards, Ola Nordmann'
            },
            {
              title: 'Spot the contraction',
              problem: 'Make this sentence formal: "I can\'t attend the meeting."',
              steps: ['"can\'t" is a contraction of "cannot".'],
              answer: 'I cannot attend the meeting.'
            }
          ],
          keyTerms: [
            { term: 'Register', definition: 'How formal or informal your language is.' },
            { term: 'Contraction', definition: 'A short form such as "don\'t" (do not) or "I\'m" (I am).' },
            { term: 'Subject line', definition: 'A short line that tells the reader what the email is about.' },
            { term: 'Closing', definition: 'The polite ending before your name, e.g. "Kind regards,".' }
          ],
          checkYourself: [
            'Can you list the four parts of a formal email?',
            'Can you rewrite three contractions in full?',
            'Which greeting do you use if you do not know the name of the person?'
          ]
        },
        practice: [
          {
            key: 'eng-p1',
            type: 'multiple_choice',
            title: 'Formal greeting',
            content: { question: 'Which greeting is the most formal?', options: [mc('a', 'Hey there!'), mc('b', 'Dear Ms Hansen,'), mc('c', 'Yo!'), mc('d', 'Hi guys,')] },
            correct: { correctAnswer: 'b' },
            hints: ['Formal emails often start with "Dear".'],
            explanation: '"Dear Ms Hansen," is the standard formal greeting.'
          },
          {
            key: 'eng-p2',
            type: 'fill_blanks',
            title: 'Polite request',
            content: { sentences: ['I ___ like to ask about the school trip.'] },
            correct: { blanks: [{ position: 0, answer: 'would' }] },
            hints: ['A polite way of saying "I want".'],
            explanation: '"I would like to ..." is a polite, formal phrase.'
          },
          {
            key: 'eng-p3',
            type: 'multiple_choice',
            title: 'Formal closing',
            content: { question: 'Which closing fits a formal email?', options: [mc('a', 'Love ya'), mc('b', 'Cheers mate'), mc('c', 'Kind regards,'), mc('d', 'xoxo')] },
            correct: { correctAnswer: 'c' },
            hints: ['Look for the neutral, polite option.'],
            explanation: '"Kind regards," is a common formal closing.'
          },
          {
            key: 'eng-p4',
            type: 'fill_blanks',
            title: 'No contractions',
            instructions: 'Write the full form.',
            content: { sentences: ['"don\'t" in formal writing becomes ___.'] },
            correct: { blanks: [{ position: 0, answer: 'do not' }] },
            hints: ['Split the contraction into two words.'],
            explanation: '"don\'t" is short for "do not".'
          },
          {
            key: 'eng-p5',
            type: 'multiple_choice',
            title: 'Subject line',
            content: {
              question: 'Which is the best subject line for a formal email?',
              options: [mc('a', 'hiii'), mc('b', 'Question about the school trip on 12 May'), mc('c', '???'), mc('d', 'Important!!!!!')]
            },
            correct: { correctAnswer: 'b' },
            hints: ['A good subject line tells the reader what the email is about.'],
            explanation: 'It is short, clear and specific.'
          }
        ],
        flashcards: [
          { key: 'eng-f1', front: 'Register', back: 'How formal or informal your language is.' },
          { key: 'eng-f2', front: 'Formal greeting (name unknown)', back: 'Dear Sir or Madam,' },
          { key: 'eng-f3', front: 'can\'t (formal)', back: 'cannot' },
          { key: 'eng-f4', front: 'Polite request', back: 'Could you please ...? / I would like to ...' },
          { key: 'eng-f5', front: 'Formal closing', back: 'Kind regards, / Best regards, + full name' },
          { key: 'eng-f6', front: 'Subject line', back: 'A short, specific line saying what the email is about.' }
        ]
      },
      mockExam: {
        slug: 'formal-email-practice-test',
        version: 1,
        title: 'Practice test: Formal and informal language',
        timeLimitMinutes: 20,
        rubricVersion: 1,
        items: [
          {
            key: 'r1', criterion: 'register', type: 'multiple_choice', points: 2,
            prompt: 'Which sentence is informal?',
            options: [mc('a', 'I am writing to ask about the timetable.'), mc('b', 'Gonna be late, sorry!'), mc('c', 'Thank you for your reply.')],
            answer: 'b', explanation: '"Gonna" is informal.'
          },
          {
            key: 'r2', criterion: 'register', type: 'multiple_choice', points: 2,
            prompt: 'Who would you most likely write a formal email to?',
            options: [mc('a', 'Your best friend'), mc('b', 'Your cousin'), mc('c', 'A company you want a summer job from')],
            answer: 'c', explanation: 'Formal language suits people you do not know well, in official situations.'
          },
          {
            key: 'r3', criterion: 'register', type: 'short_answer', points: 2,
            prompt: 'What is the word for how formal or informal your language is? (one word)',
            answer: 'register', explanation: 'Register.'
          },
          {
            key: 'c1', criterion: 'conventions', type: 'multiple_choice', points: 2,
            prompt: 'You do not know the name of the person you are writing to. Which greeting do you use?',
            options: [mc('a', 'Dear Sir or Madam,'), mc('b', 'Hi you,'), mc('c', 'To whom it may concern!!!')],
            answer: 'a', explanation: '"Dear Sir or Madam," is the standard choice.'
          },
          {
            key: 'c2', criterion: 'conventions', type: 'multiple_choice', points: 2,
            prompt: 'What should come right after the closing "Kind regards,"?',
            options: [mc('a', 'An emoji'), mc('b', 'Your full name'), mc('c', 'A new question')],
            answer: 'b', explanation: 'Sign with your full name.'
          },
          {
            key: 'c3', criterion: 'conventions', type: 'multiple_choice', points: 2,
            prompt: 'Where should you say why you are writing?',
            options: [mc('a', 'In the first sentence of the body'), mc('b', 'In the last line'), mc('c', 'Nowhere')],
            answer: 'a', explanation: 'State your purpose early.'
          },
          {
            key: 'l1', criterion: 'language', type: 'short_answer', points: 2,
            prompt: 'Write the full form of "won\'t".',
            answer: 'will not', explanation: '"won\'t" = "will not".'
          },
          {
            key: 'l2', criterion: 'language', type: 'multiple_choice', points: 2,
            prompt: 'Which request is the most polite?',
            options: [mc('a', 'Send me the form.'), mc('b', 'Could you please send me the form?'), mc('c', 'Form. Now.')],
            answer: 'b', explanation: '"Could you please ...?" is polite.'
          },
          {
            key: 'l3', criterion: 'language', type: 'short_answer', points: 2,
            prompt: 'Complete the polite phrase: "I would ___ to apply for the job." (one word)',
            answer: 'like', explanation: '"I would like to ...".'
          }
        ],
        rubric: {
          criteria: [
            { key: 'register', label: 'Register', description: 'Recognises formal and informal language and when to use it.' },
            { key: 'conventions', label: 'Email conventions', description: 'Knows greetings, closings and structure.' },
            { key: 'language', label: 'Polite language', description: 'Uses full forms and polite requests.' }
          ],
          minItemsAnsweredPerCriterion: 2,
          minAnsweredRatio: 0.8,
          gradeBands: GRADE_BANDS,
          limitations: [
            'The test checks knowledge of register and conventions, not free writing. Your own emails should be read by an adult or teacher.',
            'Short practice set with 9 questions.'
          ],
          disclaimer: EN_DISCLAIMER
        }
      }
    }
  },

  // ---------------------------------------------------------------- Science
  {
    slug: 'naturfag',
    title: 'Naturfag',
    udirCode: 'NAT01-04',
    instructionLocale: 'nb',
    sortOrder: 4,
    sourceUrl: 'https://www.udir.no/lk20/nat01-04',
    goals: [
      {
        key: 'nat-10-celler',
        goalAfterGrade: 10,
        description:
          'Parafrase: forklare hvordan celler er bygd opp og hvordan de fungerer, og sammenligne plante- og dyreceller. ' +
          'Må kontrolleres mot ordlyden på udir.no.',
        sourceLocator: 'NAT01-04 · Kompetansemål etter 10. trinn · kropp, helse og levende organismer'
      }
    ],
    topic: {
      slug: 'celler',
      grade: 8,
      title: 'Celler – livets byggesteiner',
      summary: 'Bli kjent med cellens deler, forskjellen på plante- og dyreceller og hvordan vi ser celler i mikroskop.',
      goalKeys: ['nat-10-celler'],
      lesson: {
        slug: 'cellens-oppbygning',
        version: 1,
        title: 'Cellens oppbygning',
        body: {
          intro:
            'Alt levende er bygd opp av celler – fra bakterier med én celle til mennesker med mange tusen milliarder. ' +
            'Nye celler blir alltid til ved at andre celler deler seg.',
          sections: [
            {
              heading: 'Cellens viktigste deler',
              paragraphs: ['De fleste celler i planter og dyr har de samme hoveddelene:'],
              bullets: [
                'Cellemembran: tynn hinne som styrer hva som slipper inn og ut av cellen.',
                'Cytoplasma: geléaktig væske der mange av cellens prosesser foregår.',
                'Cellekjerne: inneholder arvestoffet (DNA) og styrer cellen.',
                'Mitokondrier: frigjør energi fra næring gjennom celleånding.',
                'Ribosomer: lager proteiner.'
              ]
            },
            {
              heading: 'Plantecelle og dyrecelle',
              paragraphs: [
                'Planteceller har i tillegg en stiv cellevegg av cellulose, grønnkorn (kloroplaster) der fotosyntesen ' +
                  'skjer, og ofte en stor vakuole fylt med cellesaft. Dyreceller har ikke cellevegg eller grønnkorn.'
              ]
            },
            {
              heading: 'Celler med og uten kjerne',
              paragraphs: [
                'Bakterier er encellede organismer uten cellekjerne – arvestoffet ligger fritt i cytoplasmaet. ' +
                  'Planter, dyr og sopp har celler med cellekjerne.'
              ]
            },
            {
              heading: 'Å se celler i mikroskop',
              paragraphs: [
                'Celler er for små til å se med det blotte øyet. I et lysmikroskop finner du forstørrelsen ved å ' +
                  'gange forstørrelsen i okularet med forstørrelsen i objektivet.'
              ]
            }
          ],
          workedExamples: [
            {
              title: 'Regn ut forstørrelsen',
              problem: 'Okularet forstørrer 10 ganger og objektivet 40 ganger. Hvor mye forstørres cellen?',
              steps: ['Total forstørrelse = okular · objektiv', '10 · 40 = 400'],
              answer: '400 ganger'
            },
            {
              title: 'Plante eller dyr?',
              problem: 'En celle har cellevegg og grønnkorn. Er det en plantecelle eller en dyrecelle?',
              steps: ['Cellevegg og grønnkorn finnes i planteceller.', 'Dyreceller har ingen av delene.'],
              answer: 'En plantecelle'
            }
          ],
          keyTerms: [
            { term: 'Cellemembran', definition: 'Hinne som styrer hva som går inn og ut av cellen.' },
            { term: 'Cellekjerne', definition: 'Inneholder DNA og styrer cellen.' },
            { term: 'Mitokondrie', definition: 'Frigjør energi fra næring (celleånding).' },
            { term: 'Grønnkorn (kloroplast)', definition: 'Der fotosyntesen skjer i planteceller.' },
            { term: 'Cellevegg', definition: 'Stiv vegg av cellulose rundt planteceller.' }
          ],
          checkYourself: [
            'Kan du nevne tre deler som både plante- og dyreceller har?',
            'Hvilke deler har bare planteceller?',
            'Hvordan regner du ut forstørrelsen i et mikroskop?'
          ]
        },
        practice: [
          {
            key: 'nat-p1',
            type: 'multiple_choice',
            title: 'Cellens styringssenter',
            content: { question: 'Hvilken del av cellen inneholder arvestoffet (DNA)?', options: [mc('a', 'Cellemembranen'), mc('b', 'Cellekjernen'), mc('c', 'Vakuolen'), mc('d', 'Celleveggen')] },
            correct: { correctAnswer: 'b' },
            hints: ['Det er cellens «styringssenter».'],
            explanation: 'Cellekjernen inneholder DNA og styrer cellen.'
          },
          {
            key: 'nat-p2',
            type: 'multiple_choice',
            title: 'Bare i planter',
            content: { question: 'Hvilken del finnes i planteceller, men ikke i dyreceller?', options: [mc('a', 'Mitokondrier'), mc('b', 'Cellemembran'), mc('c', 'Grønnkorn'), mc('d', 'Ribosomer')] },
            correct: { correctAnswer: 'c' },
            hints: ['Tenk på fotosyntesen.'],
            explanation: 'Grønnkorn (kloroplaster) finnes bare i planteceller.'
          },
          {
            key: 'nat-p3',
            type: 'fill_blanks',
            title: 'Energi',
            content: { sentences: ['Celleåndingen, som frigjør energi, skjer i ___.'] },
            correct: { blanks: [{ position: 0, answer: 'mitokondriene', acceptAlternatives: ['mitokondrier', 'mitokondriene.', 'mitokondrien'] }] },
            hints: ['Ofte kalt cellens «kraftverk».'],
            explanation: 'Mitokondriene frigjør energi fra næring.'
          },
          {
            key: 'nat-p4',
            type: 'fill_blanks',
            title: 'Forstørrelse',
            instructions: 'Skriv bare tallet.',
            content: { sentences: ['Okular 10× og objektiv 10× gir en forstørrelse på ___ ganger.'] },
            correct: { blanks: [{ position: 0, answer: '100' }] },
            hints: ['Gang de to tallene.'],
            explanation: '10 · 10 = 100.'
          },
          {
            key: 'nat-p5',
            type: 'multiple_choice',
            title: 'Uten kjerne',
            content: { question: 'Hvilken organisme har celler uten cellekjerne?', options: [mc('a', 'Bakterier'), mc('b', 'Sopp'), mc('c', 'Mennesker'), mc('d', 'Trær')] },
            correct: { correctAnswer: 'a' },
            hints: ['Det er encellede organismer.'],
            explanation: 'Bakterier har arvestoffet fritt i cytoplasmaet.'
          }
        ],
        flashcards: [
          { key: 'nat-f1', front: 'Cellemembran', back: 'Hinne som styrer hva som slipper inn og ut av cellen.' },
          { key: 'nat-f2', front: 'Cellekjerne', back: 'Inneholder DNA og styrer cellen.' },
          { key: 'nat-f3', front: 'Mitokondrie', back: 'Frigjør energi fra næring gjennom celleånding.' },
          { key: 'nat-f4', front: 'Grønnkorn', back: 'Kloroplast – der fotosyntesen skjer (bare planteceller).' },
          { key: 'nat-f5', front: 'Cellevegg', back: 'Stiv vegg av cellulose rundt planteceller.' },
          { key: 'nat-f6', front: 'Forstørrelse i mikroskop', back: 'Okular · objektiv, f.eks. 10 · 40 = 400 ganger.' }
        ]
      },
      mockExam: {
        slug: 'celler-provesett',
        version: 1,
        title: 'Øvingsprøve: Celler',
        timeLimitMinutes: 25,
        rubricVersion: 1,
        items: [
          {
            key: 'o1', criterion: 'organeller', type: 'multiple_choice', points: 2,
            prompt: 'Hva er cellemembranens oppgave?',
            options: [mc('a', 'Lage proteiner'), mc('b', 'Styre hva som går inn og ut av cellen'), mc('c', 'Drive fotosyntese')],
            answer: 'b', explanation: 'Cellemembranen styrer transport inn og ut.'
          },
          {
            key: 'o2', criterion: 'organeller', type: 'multiple_choice', points: 2,
            prompt: 'Hvilken del av cellen lager proteiner?',
            options: [mc('a', 'Ribosomene'), mc('b', 'Vakuolen'), mc('c', 'Celleveggen')],
            answer: 'a', explanation: 'Ribosomene lager proteiner.'
          },
          {
            key: 'o3', criterion: 'organeller', type: 'short_answer', points: 2,
            prompt: 'Hvilken del av cellen inneholder DNA? (ett ord)',
            answer: 'cellekjernen', acceptAlternatives: ['cellekjerne', 'kjernen', 'kjerne'],
            explanation: 'Cellekjernen.'
          },
          {
            key: 'p1', criterion: 'plante_dyr', type: 'multiple_choice', points: 2,
            prompt: 'Hva har planteceller som dyreceller IKKE har?',
            options: [mc('a', 'Cellekjerne og cellemembran'), mc('b', 'Cellevegg og grønnkorn'), mc('c', 'Mitokondrier og ribosomer')],
            answer: 'b', explanation: 'Cellevegg og grønnkorn finnes bare i planteceller.'
          },
          {
            key: 'p2', criterion: 'plante_dyr', type: 'short_answer', points: 2,
            prompt: 'Hva er celleveggen i planteceller laget av? (ett ord)',
            answer: 'cellulose', explanation: 'Cellulose.'
          },
          {
            key: 'p3', criterion: 'plante_dyr', type: 'multiple_choice', points: 2,
            prompt: 'Hvor skjer fotosyntesen?',
            options: [mc('a', 'I grønnkornene'), mc('b', 'I cellekjernen'), mc('c', 'I cellemembranen')],
            answer: 'a', explanation: 'Fotosyntesen skjer i grønnkornene.'
          },
          {
            key: 'm1', criterion: 'metode', type: 'short_answer', points: 2,
            prompt: 'Okularet forstørrer 10 ganger og objektivet 40 ganger. Hvor mange ganger forstørres det du ser? (bare tallet)',
            answer: '400', explanation: '10 · 40 = 400.'
          },
          {
            key: 'm2', criterion: 'metode', type: 'multiple_choice', points: 2,
            prompt: 'Hvorfor trenger vi mikroskop for å se de fleste celler?',
            options: [mc('a', 'De er gjennomsiktige og for små til å se med det blotte øyet'), mc('b', 'De finnes bare om natta'), mc('c', 'De beveger seg for fort')],
            answer: 'a', explanation: 'De fleste celler er for små til å se uten forstørrelse.'
          },
          {
            key: 'm3', criterion: 'metode', type: 'short_answer', points: 2,
            prompt: 'Total forstørrelse er 100 ganger og okularet forstørrer 10 ganger. Hvor mye forstørrer objektivet? (bare tallet)',
            answer: '10', explanation: '100 : 10 = 10.'
          }
        ],
        rubric: {
          criteria: [
            { key: 'organeller', label: 'Cellens deler', description: 'Kjenner cellens deler og hva de gjør.' },
            { key: 'plante_dyr', label: 'Plante- og dyreceller', description: 'Sammenligner plante- og dyreceller.' },
            { key: 'metode', label: 'Mikroskop', description: 'Forstår og regner med forstørrelse.' }
          ],
          minItemsAnsweredPerCriterion: 2,
          minAnsweredRatio: 0.8,
          gradeBands: GRADE_BANDS,
          limitations: [
            'Praktisk arbeid med mikroskop og forsøk vurderes ikke.',
            'Kort prøvesett med 9 oppgaver.'
          ],
          disclaimer: NB_DISCLAIMER
        }
      }
    }
  },

  // ---------------------------------------------------------------- Social studies
  {
    slug: 'samfunnsfag',
    title: 'Samfunnsfag',
    udirCode: 'SAF01-04',
    instructionLocale: 'nb',
    sortOrder: 5,
    sourceUrl: 'https://www.udir.no/lk20/saf01-04',
    goals: [
      {
        key: 'saf-10-demokrati',
        goalAfterGrade: 10,
        description:
          'Parafrase: forklare hvordan demokratiet i Norge fungerer, og drøfte hvordan innbyggere kan påvirke og ' +
          'delta i samfunnet. Må kontrolleres mot ordlyden på udir.no.',
        sourceLocator: 'SAF01-04 · Kompetansemål etter 10. trinn · demokrati og medborgerskap'
      }
    ],
    topic: {
      slug: 'demokrati-og-medvirkning',
      grade: 8,
      title: 'Demokrati og medvirkning',
      summary: 'Hvordan styres Norge, hvordan fordeles makten, og hvordan kan du selv være med og påvirke?',
      goalKeys: ['saf-10-demokrati'],
      lesson: {
        slug: 'demokrati-i-norge',
        version: 1,
        title: 'Demokratiet i Norge',
        body: {
          intro:
            'Demokrati betyr folkestyre. I Norge velger vi representanter som styrer på våre vegne, ' +
            'og makten er delt slik at ingen får bestemme alt alene.',
          sections: [
            {
              heading: 'Direkte og indirekte demokrati',
              paragraphs: [
                'I et direkte demokrati stemmer innbyggerne selv over sakene, for eksempel i en folkeavstemning. ' +
                  'I et indirekte (representativt) demokrati velger vi representanter som tar avgjørelsene. ' +
                  'Norge er i hovedsak et representativt demokrati.'
              ]
            },
            {
              heading: 'Maktfordeling',
              paragraphs: [
                'Grunnloven fra 1814 deler statsmakten i tre:'
              ],
              bullets: [
                'Stortinget er den lovgivende makten: vedtar lover og statsbudsjettet. Det har 169 representanter.',
                'Regjeringen er den utøvende makten: setter vedtakene ut i livet.',
                'Domstolene er den dømmende makten: avgjør om lovene er brutt.'
              ]
            },
            {
              heading: 'Valg',
              paragraphs: [
                'Stortingsvalg holdes hvert fjerde år. Kommunestyre- og fylkestingsvalg holdes også hvert fjerde år, ' +
                  'to år etter stortingsvalget. For å stemme må du være norsk statsborger (ved stortingsvalg) og fylle 18 år ' +
                  'senest i valgåret.'
              ]
            },
            {
              heading: 'Slik kan du påvirke',
              paragraphs: ['Du trenger ikke være 18 år for å delta i demokratiet:'],
              bullets: [
                'Elevrådet på skolen',
                'Ungdomsrådet i kommunen',
                'Organisasjoner og politiske ungdomspartier',
                'Ytringer: skrive leserinnlegg, delta i debatter eller demonstrere fredelig'
              ]
            }
          ],
          workedExamples: [
            {
              title: 'Hvilken makt?',
              problem: 'En domstol avgjør at en person har brutt loven. Hvilken statsmakt er dette?',
              steps: ['Domstolene tolker lovene og avgjør saker.', 'Det er den dømmende makten.'],
              answer: 'Den dømmende makten (domstolene)'
            },
            {
              title: 'Når er neste valg?',
              problem: 'Det var stortingsvalg i 2025. Når er neste stortingsvalg, og når er kommunevalget mellom dem?',
              steps: ['Stortingsvalg hvert fjerde år: 2025 + 4 = 2029.', 'Kommunevalg to år etter: 2025 + 2 = 2027.'],
              answer: 'Stortingsvalg i 2029, kommunevalg i 2027'
            }
          ],
          keyTerms: [
            { term: 'Demokrati', definition: 'Folkestyre – folket har makten.' },
            { term: 'Representativt demokrati', definition: 'Innbyggerne velger representanter som styrer.' },
            { term: 'Maktfordeling', definition: 'Statsmakten er delt mellom Storting, regjering og domstoler.' },
            { term: 'Grunnloven', definition: 'Norges viktigste lov, vedtatt i 1814.' }
          ],
          checkYourself: [
            'Kan du forklare forskjellen på direkte og indirekte demokrati?',
            'Hva gjør Stortinget, regjeringen og domstolene?',
            'Nevn to måter du kan påvirke før du er 18 år.'
          ]
        },
        practice: [
          {
            key: 'saf-p1',
            type: 'multiple_choice',
            title: 'Lovgivende makt',
            content: { question: 'Hvem har den lovgivende makten i Norge?', options: [mc('a', 'Regjeringen'), mc('b', 'Stortinget'), mc('c', 'Domstolene'), mc('d', 'Kongen alene')] },
            correct: { correctAnswer: 'b' },
            hints: ['Hvem vedtar lovene?'],
            explanation: 'Stortinget vedtar lover og budsjett.'
          },
          {
            key: 'saf-p2',
            type: 'fill_blanks',
            title: 'Grunnloven',
            instructions: 'Skriv årstallet.',
            content: { sentences: ['Grunnloven ble vedtatt i ___.'] },
            correct: { blanks: [{ position: 0, answer: '1814' }] },
            hints: ['Vi feirer den 17. mai.'],
            explanation: 'Grunnloven ble vedtatt i 1814.'
          },
          {
            key: 'saf-p3',
            type: 'multiple_choice',
            title: 'Direkte demokrati',
            content: { question: 'Hvilket eksempel er direkte demokrati?', options: [mc('a', 'Stortinget vedtar en lov'), mc('b', 'En folkeavstemning'), mc('c', 'Regjeringen legger fram et budsjett')] },
            correct: { correctAnswer: 'b' },
            hints: ['Hvor stemmer innbyggerne over selve saken?'],
            explanation: 'I en folkeavstemning bestemmer innbyggerne direkte.'
          },
          {
            key: 'saf-p4',
            type: 'fill_blanks',
            title: 'Stortinget',
            instructions: 'Skriv bare tallet.',
            content: { sentences: ['Stortinget har ___ representanter.'] },
            correct: { blanks: [{ position: 0, answer: '169' }] },
            hints: ['Et tall mellom 150 og 180.'],
            explanation: 'Stortinget har 169 representanter.'
          },
          {
            key: 'saf-p5',
            type: 'multiple_choice',
            title: 'Påvirkning',
            content: { question: 'Hvilken måte å påvirke på kan en 13-åring bruke?', options: [mc('a', 'Stemme ved stortingsvalg'), mc('b', 'Sitte i elevrådet'), mc('c', 'Bli statsminister')] },
            correct: { correctAnswer: 'b' },
            hints: ['Stemmerett får du ved 18 år.'],
            explanation: 'Elevrådet er åpent for elever i alle aldre.'
          }
        ],
        flashcards: [
          { key: 'saf-f1', front: 'Demokrati', back: 'Folkestyre.' },
          { key: 'saf-f2', front: 'Lovgivende makt', back: 'Stortinget.' },
          { key: 'saf-f3', front: 'Utøvende makt', back: 'Regjeringen.' },
          { key: 'saf-f4', front: 'Dømmende makt', back: 'Domstolene.' },
          { key: 'saf-f5', front: 'Hvor ofte er det stortingsvalg?', back: 'Hvert fjerde år.' },
          { key: 'saf-f6', front: 'Representativt demokrati', back: 'Vi velger representanter som tar avgjørelsene.' }
        ]
      },
      mockExam: {
        slug: 'demokrati-provesett',
        version: 1,
        title: 'Øvingsprøve: Demokrati og medvirkning',
        timeLimitMinutes: 20,
        rubricVersion: 1,
        items: [
          {
            key: 'm1', criterion: 'maktfordeling', type: 'multiple_choice', points: 2,
            prompt: 'Hvilken statsmakt setter vedtakene ut i livet?',
            options: [mc('a', 'Den lovgivende'), mc('b', 'Den utøvende'), mc('c', 'Den dømmende')],
            answer: 'b', explanation: 'Regjeringen er den utøvende makten.'
          },
          {
            key: 'm2', criterion: 'maktfordeling', type: 'multiple_choice', points: 2,
            prompt: 'Hvorfor er makten fordelt på tre?',
            options: [mc('a', 'For at ingen skal få for mye makt alene'), mc('b', 'For at det skal gå raskere'), mc('c', 'For at det skal bli flere valg')],
            answer: 'a', explanation: 'Maktfordeling hindrer maktmisbruk.'
          },
          {
            key: 'm3', criterion: 'maktfordeling', type: 'short_answer', points: 2,
            prompt: 'Hvem har den dømmende makten? (ett ord)',
            answer: 'domstolene', acceptAlternatives: ['domstolen', 'domstoler'],
            explanation: 'Domstolene.'
          },
          {
            key: 'v1', criterion: 'valg', type: 'short_answer', points: 2,
            prompt: 'Hvor mange år er det mellom hvert stortingsvalg? (bare tallet)',
            answer: '4', acceptAlternatives: ['fire'],
            explanation: 'Hvert fjerde år.'
          },
          {
            key: 'v2', criterion: 'valg', type: 'short_answer', points: 2,
            prompt: 'Hvor gammel må du være (senest i valgåret) for å stemme ved stortingsvalg? (bare tallet)',
            answer: '18', explanation: '18 år.'
          },
          {
            key: 'v3', criterion: 'valg', type: 'multiple_choice', points: 2,
            prompt: 'Det var stortingsvalg i 2025. Når er det kommunestyre- og fylkestingsvalg?',
            options: [mc('a', '2026'), mc('b', '2027'), mc('c', '2029')],
            answer: 'b', explanation: 'To år etter stortingsvalget: 2027.'
          },
          {
            key: 'd1', criterion: 'medvirkning', type: 'multiple_choice', points: 2,
            prompt: 'Hva er et eksempel på representativt demokrati på skolen?',
            options: [mc('a', 'Elevene velger representanter til elevrådet'), mc('b', 'Rektor bestemmer alt'), mc('c', 'Ingen bestemmer noe')],
            answer: 'a', explanation: 'Elevene velger representanter som taler deres sak.'
          },
          {
            key: 'd2', criterion: 'medvirkning', type: 'multiple_choice', points: 2,
            prompt: 'Hvilken handling er en lovlig måte å påvirke på?',
            options: [mc('a', 'Skrive et leserinnlegg i lokalavisa'), mc('b', 'Ødelegge en bussholdeplass'), mc('c', 'Stemme flere ganger')],
            answer: 'a', explanation: 'Ytringsfrihet gir rett til å si og skrive meningen sin.'
          },
          {
            key: 'd3', criterion: 'medvirkning', type: 'short_answer', points: 2,
            prompt: 'Hva heter rådet der ungdom kan gi råd til kommunen? (ett ord)',
            answer: 'ungdomsrådet', acceptAlternatives: ['ungdomsråd', 'ungdomsrådet.'],
            explanation: 'Ungdomsrådet.'
          }
        ],
        rubric: {
          criteria: [
            { key: 'maktfordeling', label: 'Maktfordeling', description: 'Forklarer de tre statsmaktene.' },
            { key: 'valg', label: 'Valg', description: 'Kjenner valgordningen i Norge.' },
            { key: 'medvirkning', label: 'Medvirkning', description: 'Vet hvordan unge kan påvirke.' }
          ],
          minItemsAnsweredPerCriterion: 2,
          minAnsweredRatio: 0.8,
          gradeBands: GRADE_BANDS,
          limitations: [
            'Prøven måler faktakunnskap. Drøfting og egne refleksjoner må vurderes av en voksen eller lærer.',
            'Kort prøvesett med 9 oppgaver.'
          ],
          disclaimer: NB_DISCLAIMER
        }
      }
    }
  }
];
