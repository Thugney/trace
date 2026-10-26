import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { expect } from 'vitest';
import request from 'supertest';
import { authHeaders } from './helpers';

const sha = (value: Buffer | string) => crypto.createHash('sha256').update(value).digest('hex');
const names: Record<string, string> = { explain: 'Forklar enklere', hint: 'Gi meg et hint', practice: 'La meg øve', understanding: 'Sjekk om jeg forstår', next: 'Hva gjør jeg nå?' };

/** Optional evidence extension of the real disposable API+Vite journey. No fake UI or source mutation. */
export async function captureTutorVisualMatrix({ browser, app, port, db, lesson, fake, createChild, evidence, planPath }: any) {
  const root = path.resolve(__dirname, '../../..');
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  expect(plan.cases).toHaveLength(26);
  const out = path.join(evidence, 'actual-matrix'); fs.mkdirSync(out, { recursive: true });
  const records: any[] = [], pageErrors: string[] = [];
  const sourceFiles = ['frontend/src/components/learn/TutorPanel.tsx', 'frontend/src/components/learn/TutorPanel.css', 'frontend/src/pages/learn/LessonPage.tsx', 'backend/src/routes/learn.ts', 'backend/src/services/learn/tutorCoach.ts'];
  const source = Object.fromEntries(sourceFiles.map(file => [file, sha(fs.readFileSync(path.join(root, file)))]));
  const fixtureBody = {
    intro: 'En brøk viser en del av noe helt.',
    sections: [{ heading: 'Hva er en brøk?', paragraphs: ['En brøk viser en del av noe helt. Tenk på en pizza delt i 4 like store biter. Har du 3 av bitene, har du 3/4 av pizzaen.'] },
      { heading: 'Tallet under streken', paragraphs: ['Tallet under streken forteller hvor mange like biter det hele er delt i.'] }],
    workedExamples: [], keyTerms: [], checkYourself: []
  };
  const fixturePractice = [{ key: 'fractions-capture', title: 'Brøker i en pizza', type: 'multiple_choice',
    content: { question: 'En pizza er delt i 8 like biter. Du spiser 2. Hvor stor del av pizzaen har du spist?', options: [{ id: 'a', text: '1/8' }, { id: 'b', text: '2/8' }] },
    correct: { correctAnswer: 'b' }, hints: ['Se på tallet under streken. Hvor mange like biter er pizzaen delt i?'], explanation: 'PRIVATE_CAPTURE_KEY' }];
  // This is the existing isolated in-memory lesson, not production/research content.
  db.prepare("UPDATE learn_lessons SET title = 'Brøker i hverdagen', locale = 'nb', body = ?, practice = ?, authored_by = 'Synthetic visual fixture; not approved teaching material', review_status = 'reviewed' WHERE id = ?")
    .run(JSON.stringify(fixtureBody), JSON.stringify(fixturePractice), lesson.id);
  db.prepare('UPDATE learn_topics SET grade = 4 WHERE id = ?').run(lesson.topic_id);
  fake.generate.mockReset().mockRejectedValue(new Error('synthetic provider outage'));
  fake.quota.mockReset().mockReturnValue({ allowed: true });

  for (const c of plan.cases) {
    expect(c.theme).toBe('light');
    expect([c.width, c.height]).toEqual(c.viewport === 'desktop' ? [1280, 800] : [390, 844]);
    const profile = createChild();
    const context = await browser.newContext({ viewport: { width: c.width, height: c.height }, colorScheme: 'light', reducedMotion: 'reduce', locale: 'nb-NO', deviceScaleFactor: 1 });
    const page = await context.newPage(); page.setDefaultTimeout(12_000);
    page.on('pageerror', (error: Error) => pageErrors.push(`${c.id}: ${error.message}`));
    const token = authHeaders(profile.id).Authorization.slice(7);
    await page.addInitScript((value: any) => { const storage = (globalThis as any).localStorage; storage.setItem('auth_token', value.token); storage.setItem('family_auth', 'true'); storage.setItem('currentProfileId', value.id); }, { token, id: String(profile.id) });
    const caseResponses: any[] = [];
    const kind = c.id.replace(`tutor-chat-03-${c.viewport}-light-`, '');
    let releaseProvider: (() => void) | undefined;
    const realRequest = async (button: any) => {
      const responsePromise = page.waitForResponse((r: any) => r.url().endsWith('/api/learn/tutor') && r.request().method() === 'POST');
      await button.click();
      const response = await responsePromise, body = await response.json();
      caseResponses.push({ status: response.status(), source: body.source ?? null, reason: body.reason ?? null, code: body.code ?? null, mode: body.mode ?? null, hint_level: body.hint_level ?? null, practice_feedback: body.practice_feedback ?? null });
      if (response.ok()) await page.getByRole('log').locator('.tutor-answer > p').last().waitFor();
      else await page.getByRole('alert').waitFor();
      await page.waitForFunction("document.querySelector('[role=log]')?.getAttribute('aria-busy') === 'false'");
      return { status: response.status(), body };
    };
    const chip = (name: string) => page.getByRole('group', { name: 'Hva vil du gjøre?' }).getByRole('button', { name: names[name], exact: true });
    const capture = async (variant: string | null, meaning: string, target?: any) => {
      const responseState = ['explain', 'hint', 'practice', 'understanding', 'next-step', 'recovery'].includes(kind);
      // DOM text alone is not screenshot evidence: inspect the actual defining
      // paragraph (or initial exercise) through every scroll/overflow clip.
      const definingTarget = responseState
        ? page.getByRole('log').locator(kind === 'practice' && !variant ? '.tutor-exercise' : '.tutor-answer > p').last()
        : target;
      // Let the app's scheduled reply-reveal scroll finish before a reader scroll.
      await page.evaluate(async () => {
        const runtime = globalThis as any;
        await new Promise<void>(resolve => runtime.requestAnimationFrame(() => runtime.requestAnimationFrame(resolve)));
      });
      // A whole exchange may exceed the log height. Naturally center its defining
      // text instead of letting a bottom-aligned oversized bubble hide the state.
      await definingTarget.evaluate((element: any) => element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
      await page.mouse.move(c.width - 1, 0);
      await page.evaluate(async () => {
        const runtime = globalThis as any;
        runtime.document.activeElement?.blur();
        await new Promise<void>(resolve => runtime.requestAnimationFrame(() => runtime.requestAnimationFrame(resolve)));
      });
      const definingContent = await definingTarget.evaluate((element: any) => {
        const { innerWidth, innerHeight, getComputedStyle } = globalThis as any;
        const inspect = (node: any) => {
          const box = node.getBoundingClientRect();
          const clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
          const clippingAncestors: any[] = [];
          for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
            const style = getComputedStyle(ancestor), bounds = ancestor.getBoundingClientRect();
            const clipsX = /^(auto|scroll|hidden|clip)$/.test(style.overflowX);
            const clipsY = /^(auto|scroll|hidden|clip)$/.test(style.overflowY);
            if (!clipsX && !clipsY) continue;
            const left = bounds.left + ancestor.clientLeft, top = bounds.top + ancestor.clientTop;
            const right = left + ancestor.clientWidth, bottom = top + ancestor.clientHeight;
            clippingAncestors.push({ tag: ancestor.tagName, className: ancestor.className, role: ancestor.getAttribute('role'), clipsX, clipsY, left, top, right, bottom });
            if (clipsX) { clip.left = Math.max(clip.left, left); clip.right = Math.min(clip.right, right); }
            if (clipsY) { clip.top = Math.max(clip.top, top); clip.bottom = Math.min(clip.bottom, bottom); }
          }
          const visibleWidth = Math.max(0, Math.min(box.right, clip.right) - Math.max(box.left, clip.left));
          const visibleHeight = Math.max(0, Math.min(box.bottom, clip.bottom) - Math.max(box.top, clip.top));
          const tolerance = 1; // Browser subpixel rounding, not a visual-comparison threshold.
          return {
            text: node.textContent, tag: node.tagName, className: node.className,
            bounds: { x: box.x, y: box.y, width: box.width, height: box.height }, clip, clippingAncestors,
            visibleWidth, visibleHeight, intersects: visibleWidth > 0 && visibleHeight > 0,
            fits: box.width <= clip.right - clip.left + tolerance && box.height <= clip.bottom - clip.top + tolerance,
            fullyVisible: box.left >= clip.left - tolerance && box.right <= clip.right + tolerance && box.top >= clip.top - tolerance && box.bottom <= clip.bottom + tolerance
          };
        };
        const heading = element.parentElement?.querySelector(':scope > .tutor-hintlabel');
        return [inspect(element), ...(heading ? [inspect(heading)] : [])];
      });
      for (const content of definingContent) {
        expect(content.intersects, `${c.id}/${variant || 'principal'} defining content is clipped: ${JSON.stringify(content)}`).toBe(true);
        if (content.fits) expect(content.fullyVisible, `${c.id}/${variant || 'principal'} fitting defining content must be fully visible: ${JSON.stringify(content)}`).toBe(true);
      }
      const layout = await page.evaluate(() => {
        const { document, innerWidth, innerHeight, scrollX, scrollY, getComputedStyle } = globalThis as any;
        const rect = (selector: string, last = false) => { const elements = document.querySelectorAll(selector); const e = elements[last ? elements.length - 1 : 0]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
        const shell = document.querySelector('.tutor-shell')!, log = document.querySelector('[role=log]')!;
        return { viewport: { width: innerWidth, height: innerHeight }, documentScroll: { x: scrollX, y: scrollY }, horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
          shell: rect('.tutor-shell'), dock: rect('.tutor-dock'), conversation: rect('[role=log]'), alert: rect('[role=alert]'), lastAnswer: rect('.tutor-answer', true),
          background: getComputedStyle(shell).backgroundColor, colorScheme: getComputedStyle(shell).getPropertyValue('color-scheme'),
          locale: document.querySelector('label select')?.value,
          busy: log.getAttribute('aria-busy'), replyCount: log.querySelectorAll('li').length,
          conversationScroll: { top: log.scrollTop, height: log.scrollHeight, viewport: log.clientHeight },
          renderedText: shell.textContent };
      });
      expect(layout.horizontalOverflow).toBe(false); expect(layout.background).toBe('rgb(251, 248, 242)'); expect(layout.colorScheme).toBe('light');
      expect(layout.renderedText).not.toContain('PRIVATE_CAPTURE_KEY');
      const filename = `${c.id}${variant ? `-${variant}` : ''}.png`, file = path.join(out, filename);
      await page.screenshot({ path: file, fullPage: false, animations: 'disabled', scale: 'css' });
      const bytes = fs.readFileSync(file);
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([c.width, c.height]);
      records.push({ id: c.id, declaredState: c.state, variant, meaning, file: filename, width: c.width, height: c.height, sha256: sha(bytes), responses: [...caseResponses], definingContent, layout, classification: 'actual disposable-app screenshot; not a comparison or approval receipt' });
    };
    try {
      await page.goto(`http://127.0.0.1:${port}/tests/tutor-v2.html?lesson=${lesson.id}`, { timeout: 30_000 });
      await page.getByRole('tab', { name: 'Spør veilederen' }).click();
      await page.getByRole('group', { name: 'Hva vil du gjøre?' }).waitFor();
      expect(await page.getByLabel('Veilederspråk').inputValue()).toBe('nb');
      if (kind === 'greeting' || kind === 'default') {
        expect(await page.getByRole('log').locator('li').count()).toBe(0);
        await capture(null, 'Actual initial greeting with normal app chrome; Default and Greeting intentionally coincide.', page.locator('.tutor-intro'));
      } else if (kind === 'loading') {
        fake.generate.mockImplementationOnce(() => new Promise((_resolve: any, reject: any) => { releaseProvider = () => reject(new Error('synthetic provider outage')); }));
        await chip('explain').click(); await page.getByRole('status').waitFor();
        expect(await page.getByRole('textbox').isDisabled()).toBe(true);
        expect(await page.getByRole('group', { name: 'Hva vil du gjøre?' }).locator('button:disabled').count()).toBe(5);
        await capture(null, 'Actual pending API/provider request with disabled controls; provider promise is released in finally.', page.getByRole('status'));
        expect(releaseProvider).toBeDefined(); releaseProvider!(); releaseProvider = undefined;
        await page.getByRole('log').getByText('Fra den godkjente leksjonen', { exact: false }).waitFor();
      } else if (kind === 'explain') {
        const r = await realRequest(chip('explain')); expect(r.status).toBe(200); expect(r.body.source).toBe('lesson_fallback');
        await capture(null, 'Actual reviewed-source fallback explanation and quote for the synthetic Grade4 fractions lesson.', page.getByRole('log').locator('li').last());
      } else if (kind === 'hint') {
        for (let level = 0; level < 3; level++) {
          const r = await realRequest(level === 0 ? chip('hint') : page.getByRole('button', { name: 'Vis neste hint', exact: true }));
          expect(r.body.hint_level).toBe(level);
          await capture(level ? `hint${level + 1}` : null, `Actual hint ${level + 1} of3 via real API; only latest follow-up controls remain.`, page.getByRole('log').locator('li').last());
        }
        expect(await page.getByRole('button', { name: 'Vis neste hint', exact: true }).count()).toBe(0);
        await capture('exhausted', 'Actual exhausted-hint UI: Hint3 remains and next-hint action is absent. The app does not invent the prototype fourth response.', page.getByRole('log').locator('li').last());
      } else if (kind === 'practice') {
        const before = db.prepare('SELECT * FROM learn_progress WHERE profile_id = ?').all(profile.id);
        const providerBefore = fake.generate.mock.calls.length;
        await realRequest(chip('practice'));
        await capture(null, 'Actual server-provided MCQ with two choices; prototype uses typed answers, a documented interaction difference.', page.getByRole('group', { name: 'Øvingssvar' }));
        const wrong = await realRequest(page.getByRole('group', { name: 'Øvingssvar' }).getByRole('button', { name: '1/8', exact: true }));
        expect(wrong.body.practice_feedback).toBe('try_again'); expect(wrong.body.formative_only).toBe(true);
        await capture('tryAgain', 'Actual server-checked wrong choice with retained choices.', page.getByRole('log').locator('li').last());
        const right = await realRequest(page.getByRole('group', { name: 'Øvingssvar' }).getByRole('button', { name: '2/8', exact: true }));
        expect(right.body.practice_feedback).toBe('correct'); expect(right.body.formative_only).toBe(true);
        expect(await page.getByRole('group', { name: 'Øvingssvar' }).count()).toBe(0);
        expect(db.prepare('SELECT * FROM learn_progress WHERE profile_id = ?').all(profile.id)).toEqual(before);
        expect(fake.generate.mock.calls.length).toBe(providerBefore);
        await capture('right', 'Actual server-checked correct choice; options removed, no progress/provider call created.', page.getByRole('log').locator('li').last());
      } else if (kind === 'understanding' || kind === 'next-step' || kind === 'recovery') {
        const r = await realRequest(chip(kind === 'next-step' ? 'next' : kind === 'recovery' ? 'explain' : 'understanding'));
        expect(r.status).toBe(200);
        if (kind === 'recovery') {
          const recovery = await realRequest(page.getByRole('button', { name: 'Jeg forstår ikke', exact: true })); expect(recovery.body.reason).toBe('recovery');
        }
        if (kind === 'next-step') expect(r.body.reason).toBe('verified_progress');
        await capture(null, `Actual ${kind} response from existing route and deterministic tutor; no response fixture.`, page.getByRole('log').locator('li').last());
      } else if (kind === 'quota' || kind === 'disabled' || kind === 'locked') {
        if (kind === 'quota') for (let i = 0; i < 20; i++) {
          const r = await request(app).post('/learn/tutor').set(authHeaders(profile.id)).send({ lesson_id: lesson.id, mode: 'hint', hint_level: 0, locale: 'nb' }); expect(r.status).toBe(200);
        }
        if (kind === 'disabled') db.prepare('UPDATE profiles SET ai_enabled = 0 WHERE id = ?').run(profile.id);
        if (kind === 'locked') {
          const exam = db.prepare('SELECT id FROM learn_mock_exams LIMIT 1').get();
          db.prepare("INSERT INTO learn_mock_attempts (exam_id, profile_id, rubric_version, started_at, expires_at) VALUES (?, ?, 1, datetime('now'), ?)").run(exam.id, profile.id, new Date(Date.now() + 60_000).toISOString());
        }
        const r = await realRequest(chip('explain'));
        expect(r.body.code).toBe(kind === 'quota' ? 'tutor_rate_limited' : kind === 'disabled' ? 'ai_disabled' : 'exam_in_progress');
        expect(await page.locator('.tutor-chips').count()).toBe(0); expect(await page.getByRole('textbox').count()).toBe(0);
        await capture(null, kind === 'quota' ? 'Actual 21st-request rate-limit denial (429). AI provider quota fallback is separate and remains usable.' : `Actual ${kind} policy denial enforced by server after the page loaded; no response stub.`, page.getByRole('alert'));
      } else if (kind === 'unavailable') {
        await page.route('**/api/learn/tutor', (route: any) => route.abort('internetdisconnected'));
        await chip('explain').click(); await page.getByRole('alert').getByText('Fikk ikke kontakt', { exact: true }).waitFor();
        expect(await page.locator('.tutor-chips').count()).toBe(0);
        await capture(null, 'Actual client network-failure recovery card from aborted request, not a forged API response.', page.getByRole('alert'));
        await page.unroute('**/api/learn/tutor');
        await realRequest(page.getByRole('button', { name: 'Prøv igjen', exact: true }));
        expect(await page.getByRole('textbox').count()).toBe(1);
      } else throw new Error(`Unmapped declared state: ${c.id}`);
    } finally {
      releaseProvider?.(); db.prepare('DELETE FROM learn_mock_attempts WHERE profile_id = ?').run(profile.id);
      fake.quota.mockReturnValue({ allowed: true }); await context.close();
    }
  }
  expect(pageErrors).toEqual([]);
  expect(records.filter(r => !r.variant)).toHaveLength(26); expect(records.filter(r => r.variant)).toHaveLength(10);
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const manifest = { at: new Date().toISOString(), head, source, plan: { path: path.resolve(planPath), sha256: sha(fs.readFileSync(planPath)) }, browser: browser.version(), records,
    fixture: { classification: 'Disposable in-memory synthetic reviewed fixture; not approved teaching material', grade: 4, locale: 'nb', title: 'Brøker i hverdagen', body: fixtureBody, practiceQuestion: fixturePractice[0].content.question },
    limitations: ['Normal app chrome/layout remains; only natural scrolling is used and recorded. No CSS or app DOM is rewritten.', 'Actual response copy, surrounding chrome and MCQ interactions differ from the approved static prototype.', 'Hint exhaustion shows absence of a next-hint action, not the prototype extra message.', 'Screenshots are exact viewport images, not full-page or resized.', 'No strict pixel comparison, baseline registration, human teaching/accessibility approval or live-provider acceptance is claimed.'], pageErrors };
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
}
