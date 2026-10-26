import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = mkdtempSync(path.join(tmpdir(), 'practice-feedback-'));
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Editor/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let server, browser;
try {
  server = await createServer({ root, configFile: false, envDir: temporary, cacheDir: path.join(temporary, 'cache'), plugins: [react()], logLevel: 'error', optimizeDeps: { entries: ['tests/practice-feedback.html'] }, server: { host: '127.0.0.1', port: 0, strictPort: true, watch: null } });
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(`${origin}/tests/practice-feedback.html`);
  await page.getByTestId('mcq').waitFor();
  assert.equal(await page.getByTestId('error').count(), 0, 'safe pre-answer activities render');
  const blanks = page.getByTestId('blanks').locator('input');
  await blanks.nth(1).fill('wrong');
  await blanks.nth(1).fill('four');
  assert.equal(await blanks.nth(0).inputValue(), 'two', 'editing the second blank never mutates the first');
  for (const id of ['mcq', 'blanks', 'matching', 'sorting', 'drag', 'crossword']) {
    const section = page.getByTestId(id);
    await section.getByRole('button', { name: 'Show submitted feedback' }).click();
    assert.equal(await section.getByTestId('error').count(), 0, `${id}: feedback uses server reply without preloaded key`);
  }
  assert.match(await page.getByTestId('mcq').getByRole('button', { name: /Two/ }).getAttribute('class'), /green/);
  for (let i = 0; i < 2; i++) assert.match(await blanks.nth(i).getAttribute('class'), /green/, 'correct blank feedback');
  assert.match(await page.getByTestId('blanks').innerText(), /Correct answers:[\s\S]*two/);
  for (const id of ['matching', 'sorting', 'drag', 'crossword']) {
    assert.ok(await page.getByTestId(id).locator('[class*="green"]').count() > 0, `${id}: correct submitted feedback is visible`);
  }
  assert.deepEqual(errors, []);
  await page.goto(`${origin}/tests/practice-feedback.html?wrong=true`);
  await page.getByTestId('mcq').waitFor();
  assert.equal(await page.getByTestId('error').count(), 0);
  for (const id of ['mcq', 'blanks']) await page.getByTestId(id).getByRole('button', { name: 'Show submitted feedback' }).click();
  assert.match(await page.getByTestId('mcq').getByRole('button', { name: /Three/ }).getAttribute('class'), /red/, 'wrong selected answer');
  assert.match(await page.getByTestId('mcq').getByRole('button', { name: /Two/ }).getAttribute('class'), /green/, 'submitted correct answer feedback');
  for (let i = 0; i < 2; i++) assert.match(await page.getByTestId('blanks').locator('input').nth(i).getAttribute('class'), /red/, 'wrong blank feedback');
  assert.equal(await page.getByTestId('error').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: six real renderers accept safe questions and show authorized correct feedback; MCQ and multiple blanks also show wrong/try-again feedback, without missing-key errors.');
} finally {
  await browser?.close();
  await server?.close();
  rmSync(temporary, { recursive: true, force: true });
}
