import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = mkdtempSync(path.join(tmpdir(), 'practice-resume-'));
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Editor/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let server, browser;
try {
  server = await createServer({ root, configFile: false, envDir: temporary, cacheDir: path.join(temporary, 'cache'), plugins: [react()], logLevel: 'error', optimizeDeps: { entries: ['tests/practice-feedback.html'] }, server: { host: '127.0.0.1', port: 0, strictPort: true, watch: null } });
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: 'msedge' });
  for (const kind of ['multiple_choice', 'fill_blanks']) {
    const context = await browser.newContext();
    await context.addInitScript(() => localStorage.setItem('currentProfileId', '2'));
    const page = await context.newPage();
    const errors = [];
    let storedResponse, submissions = 0;
    const content = kind === 'multiple_choice' ? { question: 'One plus one?', options: [{ id: 'a', text: 'Two' }, { id: 'b', text: 'Three' }] } : { sentences: ['One plus one is ___.'] };
    const correctData = kind === 'multiple_choice' ? { correctAnswer: 'a' } : { blanks: [{ position: 0, answer: 'two' }] };
    const question = { id: 1, session_id: 1, activity_type_id: 1, activity_type_name: kind, title: 'Reviewed question', content_data: content, hints: [], points: 20, order_index: 0 };
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.origin !== origin) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      let reply;
      if (url.pathname === '/api/profiles/selector') reply = [{ id: 2, name: 'Synthetic learner', type: 'child', parent_id: 1 }];
      else if (url.pathname === '/api/profiles/2') reply = { id: 2, name: 'Synthetic learner', type: 'child', parent_id: 1 };
      else if (url.pathname === '/api/learn/lessons/1/practice') reply = { session_id: 1, result: null };
      else if (url.pathname === '/api/activities/sessions/1') reply = { id: 1, activities: [question, { ...question, id: 2, title: 'Unanswered question' }] };
      else if (url.pathname === '/api/activities/sessions/1/start') reply = { attemptId: 10, resumed: Boolean(storedResponse) };
      else if (url.pathname === '/api/activities/attempts/10/submit') {
        const body = req.postDataJSON();
        const replayed = Boolean(storedResponse);
        if (!replayed) storedResponse = body.userResponse;
        submissions++;
        reply = { score: 20, maxScore: 20, isCorrect: true, partialScore: 1, feedback: 'Correct', correctData, explanation: 'One plus one is two.', replayed, ...(replayed ? { userResponse: storedResponse, hintsUsed: 0 } : {}) };
      } else {
        errors.push(`Unexpected API: ${req.method()} ${url.pathname}`);
        return route.fulfill({ status: 404, json: { error: 'Unexpected test API' } });
      }
      return route.fulfill({ status: 200, json: reply });
    });
    await page.goto(`${origin}/tests/practice-feedback.html?resume=${kind}`);
    await page.waitForFunction(() => document.querySelector('[data-testid="profile-ready"]')?.textContent === '2');
    await page.getByRole('button', { name: 'Start practice', exact: true }).click();
    if (kind === 'multiple_choice') await page.getByRole('button', { name: /Two/ }).click();
    else await page.locator('input').fill('two');
    await page.getByRole('button', { name: 'Check answer' }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Remount practice' }).click();
    await page.getByRole('button', { name: 'Start practice', exact: true }).click();
    if (kind === 'multiple_choice') await page.getByRole('button', { name: /Three/ }).click();
    else await page.locator('input').fill('wrong replacement');
    await page.getByRole('button', { name: 'Check answer' }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).waitFor();
    if (kind === 'multiple_choice') {
      assert.doesNotMatch(await page.getByRole('button', { name: /Three/ }).getAttribute('class'), /red/, 'replay must restore original selected answer');
      assert.match(await page.getByRole('button', { name: /Two/ }).getAttribute('class'), /green/);
    } else {
      assert.equal(await page.locator('input').inputValue(), 'two', 'replay restores persisted blank response');
      assert.match(await page.locator('input').getAttribute('class'), /green/);
    }
    assert.equal(submissions, 2);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('heading', { name: 'Unanswered question' }).waitFor();
    assert.equal(await page.getByText('Correct answers:').count(), 0, 'next unanswered question has no prior key feedback');
    assert.deepEqual(errors, []);
    assert.equal(await page.getByTestId('error').count(), 0);
    await context.close();
    console.log(`PASS: mounted LessonPractice resumes ${kind}, restores original answer/feedback and advances without leaking feedback into unanswered question.`);
  }
} finally {
  await browser?.close(); await server?.close(); rmSync(temporary, { recursive: true, force: true });
}
