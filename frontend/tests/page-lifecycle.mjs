// Mounted React regressions. No server, credentials, or production API is used.
// Run with Node 22; LIFECYCLE_DEPENDENCIES and PLAYWRIGHT_MODULE may point to
// existing isolated dependency installations. LIFECYCLE_SOURCE selects a checkout
// for the same tests (including the pre-fix control).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = process.env.LIFECYCLE_SOURCE || frontend;
const require = createRequire(path.join(process.env.LIFECYCLE_DEPENDENCIES || frontend, 'package.json'));
const { build } = require('esbuild');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const mockProfile = `
  import React, { createContext, useContext, useState } from 'react';
  const Context = createContext(null);
  export function Provider({ children }) {
    const [profiles, setProfiles] = useState([{ id: 2, name: 'Child Two', type: 'child', avatar: '' }]);
    const [currentProfile, setCurrentProfile] = useState({ id: 1, name: 'Parent', type: 'parent' });
    window.fixture.setProfiles = setProfiles;
    window.fixture.setCurrentProfile = setCurrentProfile;
    return <Context.Provider value={{ profiles, currentProfile, isParent: true }}>{children}</Context.Provider>;
  }
  export const useProfile = () => useContext(Context);
`;
const mockAPI = `
  const api = (group) => new Proxy({}, { get: (_, method) => (...args) => {
    const name = group + '.' + method;
    window.fixture.calls.push({ name, args });
    const handler = window.fixture.handlers[name];
    if (!handler) throw new Error('Unexpected API call: ' + name);
    return Promise.resolve(handler(...args));
  }});
  export const learnAPI = api('learn');
  export const familyQuizzesAPI = api('quiz');
  export const activitiesAPI = api('activities');
  export const rewardsAPI = api('rewards');
  export const booksAPI = api('books');
  export const profilesAPI = api('profiles');
`;
const result = await build({
  stdin: {
    contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { MemoryRouter, Routes, Route } from 'react-router-dom';
      import { Provider } from 'fixture-profile';
      import LearnParent from './src/pages/learn/LearnParent';
      import MockExamPage from './src/pages/learn/MockExamPage';
      import ReviewPaperPage from './src/pages/learn/ReviewPaperPage';
      import QuizPlayer from './src/pages/QuizPlayer';
      import ActivityBuilder from './src/pages/ActivityBuilder';
      import BookReader from './src/pages/BookReader';
      import BookLibrary from './src/pages/BookLibrary';
      let root;
      window.fixture.mount = (name) => {
        root?.unmount();
        root = createRoot(document.getElementById('root'));
        const page = { parent: <LearnParent />, mock: <MockExamPage />, review: <ReviewPaperPage />,
          quiz: <QuizPlayer />, activity: <ActivityBuilder />, reader: <BookReader />, library: <BookLibrary /> }[name];
        root.render(<Provider><MemoryRouter initialEntries={['/1']}><Routes>
          <Route path={name === 'mock' ? '/:examId' : name === 'review' ? '/:paperId' : name === 'reader' ? '/:bookId' : '/:id'} element={page} />
        </Routes></MemoryRouter></Provider>);
      };
      window.fixture.unmount = () => root?.unmount();
    `,
    resolveDir: source,
    loader: 'tsx'
  },
  bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  nodePaths: [path.join(process.env.LIFECYCLE_DEPENDENCIES || frontend, 'node_modules')],
  define: { 'process.env.NODE_ENV': '"test"' },
  plugins: [{ name: 'fixture-boundaries', setup(builder) {
    if (process.env.LIFECYCLE_BASELINE_REF) {
      builder.onLoad({ filter: /[/\\]src[/\\]pages[/\\].*\.tsx$/ }, ({ path: filename }) => ({
        contents: execFileSync('git', ['show', `${process.env.LIFECYCLE_BASELINE_REF}:frontend/${path.relative(source, filename).replaceAll('\\', '/')}`],
          { cwd: source, encoding: 'utf8' }),
        loader: 'tsx', resolveDir: path.dirname(filename)
      }));
    }
    builder.onResolve({ filter: /fixture-profile|context\/ProfileContext$/ }, () => ({ path: 'profile', namespace: 'fixture' }));
    builder.onResolve({ filter: /services\/api$/ }, () => ({ path: 'api', namespace: 'fixture' }));
    builder.onResolve({ filter: /components\/Toast$/ }, () => ({ path: 'toast', namespace: 'fixture' }));
    builder.onResolve({ filter: /utils\/sounds$/ }, () => ({ path: 'sounds', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: name }) => ({
      contents: name === 'profile' ? mockProfile : name === 'api' ? mockAPI : name === 'toast'
        ? 'const showToast = () => {}; export const useToast = () => ({ showToast });'
        : 'export const areSoundsEnabled = () => false; export default new Proxy({}, { get: () => () => {} });',
      loader: 'tsx', resolveDir: source
    }));
  }}]
});

const browser = await chromium.launch({ headless: true, ...(process.env.LIFECYCLE_BROWSER ? { executablePath: process.env.LIFECYCLE_BROWSER } : {}) });
const failures = [];
async function test(name, run) {
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.abort());
  try {
    await page.setContent('<div id="root"></div>');
    await page.evaluate(() => {
      const intervals = new Map();
      let sequence = 0;
      let now = Date.now();
      Date.now = () => now;
      window.setInterval = (callback, delay) => {
        const id = ++sequence;
        intervals.set(id, { callback, delay });
        return id;
      };
      window.clearInterval = id => intervals.delete(id);
      window.fixture = {
        calls: [], handlers: {}, intervals,
        advance(ms) {
          now += ms;
          for (const { callback } of [...intervals.values()]) callback();
        }
      };
    });
    await page.addScriptTag({ content: result.outputFiles[0].text });
    await run(page);
    assert.deepEqual(errors, [], 'page must not throw during rendering');
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`FAIL ${name}: ${error.message}`);
    if (errors.length) console.error(errors.join('\n'));
  } finally { await page.close(); }
}

await test('parent reloads a replaced child with the same family size, without fetch loops', async page => {
  await page.evaluate(() => {
    Object.assign(window.fixture.handlers, {
      'learn.getStatus': () => ({ data: { family_opted_in: true } }),
      'learn.getCatalog': () => ({ data: { subjects: [] } }),
      'learn.getChildProgress': id => ({ data: { settings: { grade: id, learn_enabled: true }, lessons: [], mock_attempts: [] } })
    });
    window.fixture.mount('parent');
  });
  await page.waitForFunction(() => window.fixture.calls.some(call => call.name === 'learn.getChildProgress' && call.args[0] === 2));
  await page.evaluate(() => window.fixture.setProfiles([{ id: 3, name: 'Child Three', type: 'child', avatar: '' }]));
  await page.waitForFunction(() => window.fixture.calls.some(call => call.name === 'learn.getChildProgress' && call.args[0] === 3), null, { timeout: 3000 });
  await page.getByRole('heading', { name: 'Child Three' }).waitFor();
  await page.waitForTimeout(100);
  assert.deepEqual(await page.evaluate(() => window.fixture.calls.filter(call => call.name === 'learn.getChildProgress').map(call => call.args[0])), [2, 3]);
});

for (const kind of ['mock', 'review']) {
  await test(`${kind} timer submits latest answers once and clears on unmount`, async page => {
    await page.evaluate(kind => {
      const fixture = window.fixture;
      const get = kind === 'mock' ? 'getMockExam' : 'getReviewPaper';
      const start = kind === 'mock' ? 'startMockExam' : 'startReviewPaper';
      const submit = kind === 'mock' ? 'submitMockAttempt' : 'submitReviewAttempt';
      fixture.handlers['learn.' + get] = () => ({ data: {
        title: 'Lifecycle paper', locale: 'nb', grade: 8, item_count: 1,
        duration_minutes: 1, criteria: [], review_status: 'reviewed', previous_attempts: [], source_lessons: []
      } });
      fixture.handlers['learn.' + start] = () => ({ data: {
        attempt_id: 71, expires_at: new Date(Date.now() + 2000).toISOString(),
        items: [{ key: 'q1', prompt: 'Your answer', type: 'short_answer', kind: 'open', points: 1 }]
      } });
      // Keep submission pending to expose duplicate timer requests.
      fixture.handlers['learn.' + submit] = () => new Promise(() => {});
      fixture.mount(kind);
    }, kind);
    await page.getByRole('button').click();
    const input = page.locator('input:not([type=radio]), textarea').first();
    await input.fill('first answer');
    await input.fill('latest answer');
    assert.equal(await page.evaluate(() => window.fixture.intervals.size), 1);
    await page.evaluate(() => window.fixture.advance(3000));
    await page.waitForFunction(() => window.fixture.calls.some(call => /submit.*Attempt/.test(call.name)));
    await page.evaluate(() => window.fixture.advance(1000));
    const submissions = await page.evaluate(() => window.fixture.calls.filter(call => /submit.*Attempt/.test(call.name)));
    assert.deepEqual(submissions.map(call => call.args), [[71, { q1: 'latest answer' }]]);
    await page.evaluate(() => window.fixture.unmount());
    assert.equal(await page.evaluate(() => window.fixture.intervals.size), 0);
  });
}

await test('quiz timer survives state renders and clears the active handle on unmount', async page => {
  await page.evaluate(() => {
    Object.assign(window.fixture.handlers, {
      'quiz.getChildQuizzes': () => ({ data: [{ id: 1, title: 'Lifecycle quiz', pass_threshold: 70, question_count: 1 }] }),
      'quiz.getChildStats': () => ({ data: {} }),
      'quiz.getAttemptHistory': () => ({ data: [] }),
      'quiz.startQuiz': () => ({ data: { attemptId: 51, quiz: { id: 1, title: 'Lifecycle quiz', timeLimitSeconds: 60 },
        questions: [{ id: 1, question: 'Pick one', options: [{ id: 'a', text: 'Answer A' }] }] } }),
      'quiz.getTimer': () => ({ data: { timer_state: { elapsed_seconds: 0, is_running: true } } })
    });
    window.fixture.mount('quiz');
  });
  await page.getByRole('heading', { name: 'Lifecycle quiz' }).click();
  await page.waitForFunction(() => window.fixture.intervals.size === 1);
  await page.evaluate(() => window.fixture.advance(1000));
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => window.fixture.calls.filter(call => call.name === 'quiz.getTimer').length), 1);
  assert.equal(await page.evaluate(() => window.fixture.intervals.size), 1);
  await page.evaluate(() => window.fixture.unmount());
  assert.equal(await page.evaluate(() => window.fixture.intervals.size), 0);
});

await test('activity polling stops after completion and on unmount', async page => {
  await page.evaluate(() => {
    Object.assign(window.fixture.handlers, {
      'activities.getCreatedSessions': () => ({ data: [] }),
      'activities.getActivityTypes': () => ({ data: [] }),
      'rewards.getParentChildren': () => ({ data: [{ id: 2, name: 'Child Two' }] }),
      'activities.startAiGeneration': () => ({ data: { jobId: 'fixture-job' } }),
      'activities.pollAiGeneration': () => ({ data: { status: 'completed' } })
    });
    window.fixture.mount('activity');
  });
  const start = async () => {
    await page.getByText('AI Generate', { exact: true }).click();
    await page.getByPlaceholder('e.g., Dinosaurs, Solar System, Fractions...').fill('Fractions');
    await page.getByRole('checkbox').first().check();
    await page.getByRole('button', { name: 'Generate Activities' }).click();
    await page.waitForFunction(() => window.fixture.intervals.size === 1);
  };
  await start();
  await page.evaluate(() => window.fixture.advance(2000));
  await page.getByText('AI Generate', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.fixture.intervals.size), 0);
  await start();
  await page.evaluate(() => window.fixture.unmount());
  assert.equal(await page.evaluate(() => window.fixture.intervals.size), 0);
});

await test('reader preserves position on same-id profile refresh and loads a new profile', async page => {
  await page.evaluate(() => {
    Object.assign(window.fixture.handlers, {
      'books.getBook': () => ({ data: { id: 1, title: 'Lifecycle book', pages: [{ title: 'Page One', content: 'One' }, { title: 'Page Two', content: 'Two' }] } }),
      'books.getProfileProgress': () => ({ data: [{ book_id: 1, current_page: 1 }] }),
      'books.getMyFeedback': () => ({ data: null }),
      'books.updateProgress': () => ({ data: {} })
    });
    window.fixture.mount('reader');
  });
  await page.getByRole('heading', { name: 'Page One' }).waitFor();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('heading', { name: 'Page Two' }).waitFor();
  await page.evaluate(() => window.fixture.setCurrentProfile({ id: 1, name: 'Renamed Parent', type: 'parent' }));
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.fixture.calls.filter(call => call.name === 'books.getBook').length), 1);
  await page.getByRole('heading', { name: 'Page Two' }).waitFor();
  await page.evaluate(() => window.fixture.setCurrentProfile({ id: 4, name: 'Other Parent', type: 'parent' }));
  await page.waitForFunction(() => window.fixture.calls.some(call => call.name === 'books.getProfileProgress' && call.args[0] === 4));
  await page.getByRole('heading', { name: 'Page One' }).waitFor();
});

await test('library preserves an unsaved instructions draft during same-id profile refresh', async page => {
  await page.evaluate(() => {
    Object.assign(window.fixture.handlers, {
      'books.getProfileBooks': () => ({ data: [] }),
      'books.getCategories': () => ({ data: [] }),
      'profiles.getAll': () => ({ data: [] }),
      'books.getGenerationInstructions': () => ({ data: { instructions: 'Saved instructions' } })
    });
    window.fixture.mount('library');
  });
  await page.getByRole('button', { name: 'Create AI Book', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Saved', exact: true }).click();
  const draft = page.getByPlaceholder('Enter your instructions here.', { exact: false });
  await draft.fill('Unsaved instructions');
  await page.evaluate(() => window.fixture.setCurrentProfile({ id: 1, name: 'Renamed Parent', type: 'parent' }));
  await page.waitForTimeout(100);
  assert.equal(await draft.inputValue(), 'Unsaved instructions');
  assert.equal(await page.evaluate(() => window.fixture.calls.filter(call => call.name === 'books.getGenerationInstructions').length), 1);
});

await browser.close();
console.log(`${7 - failures.length}/7 lifecycle regressions passed`);
if (failures.length) process.exitCode = 1;
