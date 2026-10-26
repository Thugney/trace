// Lifecycle regression tests for real components mounted by
// component-lifecycle.tsx. Self-contained: an ephemeral loopback Vite server,
// synthetic API responses, and every non-loopback request blocked. Nothing is
// written outside a temporary directory that is removed afterwards.
//
//   node tests/component-lifecycle.test.mjs        (from frontend/)
//
// PLAYWRIGHT_MODULE overrides where the playwright package is loaded from;
// CHROMIUM_EXECUTABLE optionally points at a specific Chromium build.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const playwrightModule = process.env.PLAYWRIGHT_MODULE
  || 'C:/Users/Editor/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const { chromium } = createRequire(import.meta.url)(playwrightModule);

const TIMEOUT = 5000;

// ---------------------------------------------------------------- helpers

// A synthetic API reply with an error status, for api() to return (or resolve
// to, when the test holds a response back).
class Failure {
  constructor(status, body) {
    this.status = status;
    this.body = body;
  }
}

async function openPage(browser, baseUrl, scenario, api, { initScript, allowedConsoleErrors = [] } = {}) {
  const context = await browser.newContext();
  const calls = [];
  const problems = [];
  const origin = new URL(baseUrl).origin;

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) {
      problems.push(`blocked outside request: ${request.url()}`);
      return route.abort('blockedbyclient');
    }
    if (!url.pathname.startsWith('/api/')) return route.continue();

    const call = `${request.method()} ${url.pathname.slice('/api'.length)}`;
    calls.push(call);
    const body = await api(call);
    if (body === undefined) {
      problems.push(`unmocked API call: ${call}`);
      return route.fulfill({ status: 404, json: { error: 'not mocked' } });
    }
    if (body instanceof Failure) return route.fulfill({ status: body.status, json: body.body });
    return route.fulfill({ status: 200, json: body });
  });
  if (initScript) await context.addInitScript(initScript);

  const page = await context.newPage();
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (allowedConsoleErrors.some((pattern) => pattern.test(message.text()))) return;
    problems.push(`console error: ${message.text()}`);
  });
  await page.goto(`${baseUrl}/tests/component-lifecycle.html?scenario=${scenario}`);
  return { page, context, calls, problems };
}

async function withPage(browser, baseUrl, scenario, api, run, options) {
  const session = await openPage(browser, baseUrl, scenario, api, options);
  try {
    await run(session);
    assert.equal(await session.page.getByTestId('harness-error').count(), 0, 'component threw during render');
    assert.deepEqual(session.problems, [], 'page errors, console errors or unexpected requests');
  } finally {
    await session.context.close();
  }
}

async function expectTestIdText(page, testId, expected, timeout = TIMEOUT) {
  try {
    await page.waitForFunction(
      ([id, value]) => document.querySelector(`[data-testid="${id}"]`)?.textContent === value,
      [testId, expected],
      { timeout }
    );
  } catch {
    assert.equal(await page.getByTestId(testId).textContent({ timeout: 1000 }), expected, `[${testId}] text`);
  }
}

async function expectVisible(page, text, timeout = TIMEOUT) {
  await page.getByText(text, { exact: true }).first().waitFor({ state: 'visible', timeout });
}

async function expectAbsent(page, text) {
  assert.equal(await page.getByText(text, { exact: true }).count(), 0, `"${text}" should not be shown`);
}

const responseOf = async (page) => JSON.parse(await page.getByTestId('harness-response').textContent());

// Retries an assertion until it passes or the timeout ends (effects report
// to the parent a commit after the visible change).
async function eventually(check, timeout = TIMEOUT) {
  const deadline = Date.now() + timeout;
  for (;;) {
    try {
      return await check();
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

async function expectResponse(page, expected) {
  await eventually(async () => assert.deepEqual(await responseOf(page), expected));
}

async function rerenderParent(page, times) {
  const before = Number(await page.getByTestId('harness-renders').textContent());
  for (let i = 0; i < times; i++) await page.getByTestId('harness-rerender').click();
  await expectTestIdText(page, 'harness-renders', String(before + times));
}

const countCalls = (calls, call) => calls.filter((made) => made === call).length;

const callbacksOf = (page) => page.evaluate(() => window.__harnessCallbacks);

// ---------------------------------------------------------------- tests

// A timer task completing switches SimpleTaskCard from its TaskTimerCard
// branch to its own completed card; hook order must survive that switch.
async function timerTaskCompletes(browser, baseUrl) {
  const api = (call) => {
    if (call === 'GET /tasks/41/timer') {
      return {
        task_id: 41,
        requires_timer: true,
        timer_duration_minutes: 1,
        required_seconds: 60,
        remaining_seconds: 0,
        timer_state: { is_running: false, is_paused: true, elapsed_seconds: 60, start_time: null, pause_time: null },
        can_complete: true,
        completed_today: false
      };
    }
    if (call === 'POST /tasks/41/timer/finish') {
      return { success: true, task: { id: 41 }, progress: {}, pointsEarned: 10, starsEarned: 0, timeSpent: 60 };
    }
    return undefined;
  };

  await withPage(browser, baseUrl, 'timer-task', api, async ({ page, calls }) => {
    const done = page.getByRole('button', { name: 'Done', exact: true });
    await done.waitFor({ timeout: TIMEOUT });
    await done.click();

    // TaskTimerCard reports completion after its 3 s celebration.
    await expectTestIdText(page, 'harness-completions', '1', 8000);
    await expectVisible(page, 'DONE!');
    await expectVisible(page, '+10 points earned!');
    assert.equal(await page.getByRole('button', { name: 'Done', exact: true }).count(), 0, 'timer card should be gone');
    assert.equal(countCalls(calls, 'POST /tasks/41/timer/finish'), 1);
  });
}

const memoryStats = (page) => page.evaluate(() => {
  const texts = [...document.querySelectorAll('[data-testid="activity"] span')].map((span) => span.textContent.trim());
  return { pairs: texts.find((t) => t.startsWith('Pairs found:')), moves: texts.find((t) => t.startsWith('Moves:')) };
});

async function expectMemoryStats(page, pairs, moves) {
  try {
    await page.waitForFunction(([p, m]) => {
      const texts = [...document.querySelectorAll('[data-testid="activity"] span')].map((span) => span.textContent.trim());
      return texts.includes(p) && texts.includes(m);
    }, [pairs, moves], { timeout: TIMEOUT });
  } catch {
    assert.deepEqual(await memoryStats(page), { pairs, moves });
  }
}

// The board is idle again once the flipped pair is resolved and any card can
// be clicked.
const waitForBoardIdle = (page) => page.waitForFunction(
  () => [...document.querySelectorAll('[data-testid="activity"] button')].some((button) => !button.disabled),
  undefined,
  { timeout: TIMEOUT }
);

// Progress survives parent rerenders and an equal copy of the activity, but a
// different activity with the same number of pairs starts a fresh game, even
// with a match still pending from the previous one.
async function memoryGameResetsOnlyForNewActivity(browser, baseUrl) {
  await withPage(browser, baseUrl, 'memory', () => undefined, async ({ page }) => {
    const cards = page.locator('[data-testid="activity"] button');
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="activity"] button').length === 4);

    // Find card 0's partner by playing, since the deck is shuffled.
    let partner = -1;
    for (let k = 1; k <= 3 && partner < 0; k++) {
      await cards.nth(0).click();
      await cards.nth(k).click();
      await page.getByText(`Moves: ${k}`, { exact: true }).waitFor({ timeout: TIMEOUT });
      await waitForBoardIdle(page);
      if (await cards.nth(0).isDisabled()) partner = k;
    }
    assert.notEqual(partner, -1, 'card 0 should have a partner');
    await expectMemoryStats(page, 'Pairs found: 1 / 2', `Moves: ${partner}`);
    const progress = await eventually(async () => {
      const response = await responseOf(page);
      assert.equal(response?.matchedPairs?.length, 1);
      return response;
    });
    assert.deepEqual(progress, { matchedPairs: progress.matchedPairs, moves: partner, completed: false });

    await rerenderParent(page, 3);
    await page.getByTestId('harness-clone').click();
    await expectMemoryStats(page, 'Pairs found: 1 / 2', `Moves: ${partner}`);
    assert.ok(await cards.nth(0).isDisabled(), 'matched card stays matched (no reshuffle)');
    assert.ok(await cards.nth(partner).isDisabled(), 'matched partner stays matched');
    assert.deepEqual(await responseOf(page), progress);

    // The two remaining cards are the other pair: flip them and move on
    // before the 500 ms match check fires.
    const [first, second] = [1, 2, 3].filter((index) => index !== partner);
    await cards.nth(first).click();
    await cards.nth(second).click();
    await page.getByTestId('harness-next').click();
    await page.waitForTimeout(900);

    await expectMemoryStats(page, 'Pairs found: 0 / 2', 'Moves: 0');
    await expectAbsent(page, 'All pairs found!');
    for (let i = 0; i < 4; i++) assert.ok(await cards.nth(i).isEnabled(), `card ${i} is face down and playable`);
    await expectResponse(page, { matchedPairs: [], moves: 0, completed: false });

    await cards.nth(0).click();
    const shown = (await cards.nth(0).textContent()).trim();
    assert.ok(['Cat', 'Katt', 'Dog', 'Hund'].includes(shown), `new deck is shown, got "${shown}"`);
  });
}

const SORTING_NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];
const SORTING_IDS = { Alpha: 'a1', Bravo: 'a2', Charlie: 'a3', Golf: 'c1', Hotel: 'c2' };
const sortingOrder = (page) => page.evaluate((names) =>
  [...document.querySelectorAll('[data-testid="activity"] span')]
    .map((span) => span.textContent)
    .filter((text) => names.includes(text)), SORTING_NAMES);
const SWAP_HINT = 'Tap another item to swap positions';

async function sortingKeepsOrderAndResetsOnNewActivity(browser, baseUrl) {
  await withPage(browser, baseUrl, 'sorting', () => undefined, async ({ page }) => {
    await expectVisible(page, 'Alpha');
    const initial = await sortingOrder(page);
    assert.deepEqual([...initial].sort(), ['Alpha', 'Bravo', 'Charlie']);

    // A pending selection survives parent rerenders.
    await page.getByText(initial[0], { exact: true }).click();
    await expectVisible(page, SWAP_HINT);
    await rerenderParent(page, 2);
    await expectVisible(page, SWAP_HINT);
    assert.deepEqual(await sortingOrder(page), initial);

    // Swapping reports the order, and the echo of that report keeps it.
    await page.getByText(initial[2], { exact: true }).click();
    const swapped = [initial[2], initial[1], initial[0]];
    assert.deepEqual(await sortingOrder(page), swapped);
    await expectResponse(page, { order: swapped.map((name) => SORTING_IDS[name]) });
    await rerenderParent(page, 2);
    assert.deepEqual(await sortingOrder(page), swapped);

    // Next activity with the same item count: new items, no stale selection.
    await page.getByText(swapped[0], { exact: true }).click();
    await expectVisible(page, SWAP_HINT);
    await page.getByTestId('harness-next').click();
    await expectVisible(page, 'Delta');
    assert.deepEqual([...(await sortingOrder(page))].sort(), ['Delta', 'Echo', 'Foxtrot']);
    await expectAbsent(page, SWAP_HINT);
    assert.equal(await responseOf(page), null);

    // Select the last of three, then move to a two-item activity: index 2 does
    // not exist there, so a kept selection would swap a missing item in.
    const second = await sortingOrder(page);
    await page.getByText(second[2], { exact: true }).click();
    await expectVisible(page, SWAP_HINT);
    await page.getByTestId('harness-next').click();
    await expectVisible(page, 'Golf');
    const third = await sortingOrder(page);
    assert.deepEqual([...third].sort(), ['Golf', 'Hotel']);
    await expectAbsent(page, SWAP_HINT);
    assert.equal(await responseOf(page), null);

    // The first tap selects rather than swapping; the second swaps the two.
    await page.getByText(third[0], { exact: true }).click();
    await expectVisible(page, SWAP_HINT);
    assert.deepEqual(await sortingOrder(page), third);
    await page.getByText(third[1], { exact: true }).click();
    const reversed = [third[1], third[0]];
    assert.deepEqual(await sortingOrder(page), reversed);
    await expectAbsent(page, SWAP_HINT);
    await expectResponse(page, { order: reversed.map((name) => SORTING_IDS[name]) });
  });
}

const PLACE_HINT = 'Now tap a zone below to place the item';

async function dragDropKeepsPlacementsAndResetsOnNewActivity(browser, baseUrl) {
  await withPage(browser, baseUrl, 'drag-drop', () => undefined, async ({ page }) => {
    const item = (name) => page.getByRole('button', { name, exact: true });
    const zone = (label) => page.getByText(label, { exact: true });

    await item('Apple').click();
    await expectVisible(page, PLACE_HINT);
    await zone('Fruit').click();
    await expectResponse(page, { placements: { fruit: ['apple'] } });

    // A pending selection and placed items survive parent rerenders.
    await item('Carrot').click();
    await expectVisible(page, PLACE_HINT);
    await rerenderParent(page, 3);
    await expectVisible(page, PLACE_HINT);
    assert.deepEqual(await responseOf(page), { placements: { fruit: ['apple'] } });
    await zone('Fruit').click();
    await expectResponse(page, { placements: { fruit: ['apple', 'carrot'] } });

    // Placing must not modify a response object already handed to the parent.
    const fruitCounts = await page.evaluate(() => window.__harnessResponses
      .filter((response) => response && response.placements)
      .map((response) => response.placements.fruit.length));
    assert.deepEqual(fruitCounts, [1, 2]);

    // Next activity with the same counts while an item is still selected.
    await item('Pebble').click();
    await expectVisible(page, PLACE_HINT);
    await page.getByTestId('harness-next').click();
    await item('Salmon').waitFor({ timeout: TIMEOUT });
    for (const name of ['Oak', 'Moss']) assert.equal(await item(name).count(), 1, `${name} is in the tray`);
    await expectAbsent(page, PLACE_HINT);
    assert.equal(await page.getByText('Drop items here', { exact: true }).count(), 2, 'both zones empty');

    // With nothing selected, tapping a zone places nothing.
    await zone('Fish').click();
    assert.equal(await responseOf(page), null);
    assert.equal(await page.getByText('Drop items here', { exact: true }).count(), 2);

    // Placing works on the new items, and nothing ever reported for this
    // activity names an item from the previous one.
    const reportedBefore = await page.evaluate(() => window.__harnessResponses.length);
    await item('Salmon').click();
    await expectVisible(page, PLACE_HINT);
    await zone('Fish').click();
    await expectResponse(page, { placements: { fish: ['salmon'] } });
    assert.equal(await item('Salmon').count(), 0, 'Salmon left the tray');
    const placedSince = await page.evaluate((from) => window.__harnessResponses.slice(from)
      .flatMap((response) => Object.values(response?.placements ?? {}).flat()), reportedBefore);
    assert.deepEqual(placedSince, ['salmon']);
  });
}

// Pairs are reported by index; activity 402's pairs are One/Eins, Two/Zwei,
// Three/Drei, so index i on the left belongs with index i on the right.
async function matchingKeepsMatchesAndResetsOnNewActivity(browser, baseUrl) {
  await withPage(browser, baseUrl, 'matching', () => undefined, async ({ page }) => {
    const left = (name) => page.getByRole('button', { name: new RegExp(`^${name}`) });
    const right = (name) => page.getByRole('button', { name, exact: true });
    const progress = (count) => expectVisible(page, `${count} of 3 matched`);

    await left('Red').click();
    await right('Rot').click();
    await progress(1);
    await expectResponse(page, { matches: { 0: 0 } });

    // A pending selection and the match survive rerenders and an equal copy.
    await left('Blue').click();
    assert.ok(await right('Blau').isEnabled(), 'a left item is selected');
    await rerenderParent(page, 3);
    await page.getByTestId('harness-clone').click();
    await progress(1);
    assert.ok(await right('Blau').isEnabled(), 'selection kept');
    assert.deepEqual(await responseOf(page), { matches: { 0: 0 } });

    // Next activity with the same pair count while Blue is still selected.
    await page.getByTestId('harness-next').click();
    await expectVisible(page, 'One');
    await progress(0);
    assert.equal(await page.getByText('✓ matched').count(), 0, 'no carried-over match');
    for (const name of ['Eins', 'Zwei', 'Drei']) {
      assert.ok(await right(name).isDisabled(), `${name} waits for a left selection`);
    }
    assert.equal(await responseOf(page), null);

    await left('Two').click();
    await right('Zwei').click();
    await progress(1);
    await expectResponse(page, { matches: { 1: 1 } });
    for (const name of ['Eins', 'Zwei', 'Drei']) assert.ok(await right(name).isDisabled(), 'selection consumed');

    // A stored answer from the parent still restores.
    await page.getByTestId('harness-restore').click();
    await progress(1);
    await expectResponse(page, { matches: { 2: 2 } });
    // The parent response changes before Matching's restore effect commits.
    // Wait for the actual restored labels, not the unchanged matched count.
    await eventually(async () => {
      assert.equal(await left('Three').textContent(), 'Three✓ matched');
      assert.equal(await left('Two').textContent(), 'Two');
    });

    // A shorter next activity, with Three (index 2) matched and selected-from.
    await left('One').click();
    await page.getByTestId('harness-next').click();
    await expectVisible(page, '0 of 2 matched');
    for (const name of ['Opp', 'Ned']) assert.ok(await right(name).isDisabled(), `${name} waits for a left selection`);
    await left('Down').click();
    await right('Ned').click();
    await expectVisible(page, '1 of 2 matched');
    await expectResponse(page, { matches: { 1: 1 } });
  });
}

const H5P_PLAYER = {
  content: { id: 5, title: 'Synthetic Quiz', contentType: 'H5P.MultiChoice' },
  // No H5P scripts, so the frame reports a fatal init error once it runs.
  player: { integration: {}, scripts: [], styles: [], contentId: '5' },
  attemptId: 900,
  assignment: null
};

// Every player-data load starts an attempt server-side, so parent rerenders
// with a new inline onError must not reload, and a failure must reach the
// onError of the latest render.
async function h5pPlayerLoadsOnceAndReportsToLatestOnError(browser, baseUrl) {
  let releaseFirstLoad;
  const firstLoad = new Promise((resolve) => { releaseFirstLoad = resolve; });
  let loads = 0;
  const api = (call) => {
    if (call === 'POST /profiles/session/stream-token') return { token: 'synthetic-token', expiresAt: '2099-01-01T00:00:00Z' };
    if (call !== 'GET /h5p/play/5') return undefined;
    loads++;
    return loads === 1
      ? firstLoad.then(() => new Failure(503, { error: 'Synthetic outage' }))
      : H5P_PLAYER;
  };
  const options = { allowedConsoleErrors: [/status of 503/] };

  await withPage(browser, baseUrl, 'h5p', api, async ({ page, calls }) => {
    await expectVisible(page, 'Loading activity...');
    await rerenderParent(page, 3);
    assert.equal(countCalls(calls, 'GET /h5p/play/5'), 1);
    assert.equal(countCalls(calls, 'POST /profiles/session/stream-token'), 1);

    releaseFirstLoad();
    await expectVisible(page, 'Synthetic outage');
    assert.deepEqual(await callbacksOf(page), [{ callback: 'onError', generation: 3, detail: 'Synthetic outage' }]);

    await rerenderParent(page, 3);
    await expectVisible(page, 'Synthetic outage');
    assert.equal(countCalls(calls, 'GET /h5p/play/5'), 1, 'no attempt started by rerenders');
    assert.equal((await callbacksOf(page)).length, 1);

    // Retrying is the one way to start another attempt.
    await page.getByRole('button', { name: 'Try Again' }).click();
    await expectVisible(page, 'H5P player failed to initialize');
    assert.deepEqual((await callbacksOf(page))[1], { callback: 'onError', generation: 6, detail: 'H5P player failed to initialize' });
    await rerenderParent(page, 2);
    await page.waitForTimeout(300);
    assert.equal(countCalls(calls, 'GET /h5p/play/5'), 2);
    assert.equal(countCalls(calls, 'POST /profiles/session/stream-token'), 2);
    assert.equal((await callbacksOf(page)).length, 2);
  }, options);
}

// The card reloads only on mount and at expiry; completion seen on the expiry
// reload is reported once, to the callback of the latest render.
async function countdownReportsCompletionOnceToLatestCallback(browser, baseUrl) {
  const server = { finished: false, expiresAt: null };
  const challenge = () => ({
    id: 61,
    profile_id: 3,
    title: 'Beat the clock',
    description: 'Finish 3 tasks',
    target_tasks: 3,
    completed_tasks: server.finished ? 3 : 1,
    duration_minutes: 1,
    bonus_multiplier: 2,
    started_at: '2026-01-01T00:00:00Z',
    expires_at: server.expiresAt,
    completed: server.finished,
    completed_at: server.finished ? '2026-01-01T00:01:00Z' : null,
    bonus_points_awarded: server.finished ? 15 : 0
  });
  const api = (call) => {
    if (call !== 'GET /gamification/countdown/3') return undefined;
    server.expiresAt ??= new Date(Date.now() + 3500).toISOString();
    return { active: challenge(), stats: { totalCompleted: 0, totalBonusEarned: 0 } };
  };
  const GET = 'GET /gamification/countdown/3';

  await withPage(browser, baseUrl, 'countdown', api, async ({ page, calls }) => {
    await expectVisible(page, 'Beat the clock');
    await rerenderParent(page, 4);
    assert.equal(countCalls(calls, GET), 1, 'rerenders do not refetch');
    assert.deepEqual(await callbacksOf(page), [], 'not expired yet');

    // The server completes the challenge; the card learns of it at expiry.
    server.finished = true;
    await expectVisible(page, 'Challenge Complete!', 8000);
    await expectVisible(page, '+15');
    assert.deepEqual(await callbacksOf(page), [{ callback: 'onChallengeComplete', generation: 4 }]);
    assert.equal(countCalls(calls, GET), 2);

    await rerenderParent(page, 3);
    await page.waitForTimeout(1200);
    assert.equal(countCalls(calls, GET), 2, 'no reload after completion');
    assert.equal((await callbacksOf(page)).length, 1, 'completion reported once');
  });
}

async function flashcardsLoadOncePerLesson(browser, baseUrl) {
  const api = (call) => {
    const match = /^GET \/learn\/lessons\/(\d+)\/flashcards$/.exec(call);
    if (!match) return undefined;
    const id = Number(match[1]);
    return {
      lesson_id: id,
      cards: [{ key: `l${id}-c1`, front: `Front ${id}`, back: `Back ${id}`, source: 'curated', box: 1, last_rating: null, due: true, next_due_at: null }]
    };
  };

  await withPage(browser, baseUrl, 'flashcards', api, async ({ page, calls }) => {
    await expectVisible(page, 'Front 7');
    await page.getByRole('button', { name: 'Flip card', exact: true }).click();
    await expectVisible(page, 'Back 7');

    // Rerenders neither refetch nor reset the flipped card.
    await rerenderParent(page, 3);
    await expectVisible(page, 'Back 7');
    assert.equal(countCalls(calls, 'GET /learn/lessons/7/flashcards'), 1);

    await page.getByTestId('harness-switch').click();
    await expectVisible(page, 'Front 8');
    assert.equal(countCalls(calls, 'GET /learn/lessons/7/flashcards'), 1);
    assert.equal(countCalls(calls, 'GET /learn/lessons/8/flashcards'), 1);
  });
}

async function achievementsLoadOncePerProfile(browser, baseUrl) {
  const api = (call) => {
    const match = /^GET \/gamification\/achievements-with-hidden\/(\d+)$/.exec(call);
    if (!match) return undefined;
    const id = Number(match[1]);
    return {
      visible: [{ id: 10 + id, name: `Badge ${id}`, description: 'Synthetic', icon: '*', earned: true }],
      earnedHidden: [],
      hiddenStats: { totalHidden: 0, earnedHidden: 0, remaining: 0 }
    };
  };

  await withPage(browser, baseUrl, 'achievements', api, async ({ page, calls }) => {
    await expectVisible(page, 'Badge 1');
    await rerenderParent(page, 3);
    await expectVisible(page, 'Badge 1');
    await expectVisible(page, 'Achievements (1/1)');
    assert.equal(countCalls(calls, 'GET /gamification/achievements-with-hidden/1'), 1);

    await page.getByTestId('harness-switch').click();
    await expectVisible(page, 'Badge 2');
    assert.equal(countCalls(calls, 'GET /gamification/achievements-with-hidden/1'), 1);
    assert.equal(countCalls(calls, 'GET /gamification/achievements-with-hidden/2'), 1);
  });
}

function profileApi(server) {
  const alice = { id: 1, name: 'Alice', type: 'child', avatar: 'A', age: 9, ai_enabled: false, diet_enabled: false, pin: null };
  const bob = () => ({ id: 2, name: server.renameBob ? 'Bobby' : 'Bob', type: 'child', avatar: 'B', age: 12, ai_enabled: false, diet_enabled: false, pin: null });
  return (call) => {
    if (call === 'GET /profiles/selector') return [alice, bob()];
    if (call === 'GET /profiles/1') return alice;
    if (call === 'GET /profiles/2') return bob();
    return undefined;
  };
}

const storedProfileId = (page) => page.evaluate(() => localStorage.getItem('currentProfileId'));

async function profileSelectionSticks(browser, baseUrl) {
  const server = { renameBob: false };
  await withPage(browser, baseUrl, 'profile', profileApi(server), async ({ page, calls }) => {
    await expectTestIdText(page, 'profile-loading', 'false');
    await expectTestIdText(page, 'profile-current', 'none');

    await page.getByTestId('select-1').click();
    await expectTestIdText(page, 'profile-current', '1:Alice');
    assert.equal(await storedProfileId(page), '1');

    // The server now has fresher data for Bob; selecting him must land on
    // Bob (refreshed), and the profile-list refresh must not revert it.
    server.renameBob = true;
    await page.getByTestId('select-2').click();
    await expectTestIdText(page, 'profile-current', '2:Bobby');
    assert.equal(await storedProfileId(page), '2');
    await page.waitForTimeout(300);
    assert.ok(countCalls(calls, 'GET /profiles/selector') >= 3, 'profiles refreshed after each switch');
    await expectTestIdText(page, 'profile-current', '2:Bobby');
    assert.equal(await storedProfileId(page), '2');
  });
}

async function profileRestoresSavedSelection(browser, baseUrl) {
  const server = { renameBob: false };
  await withPage(browser, baseUrl, 'profile', profileApi(server), async ({ page }) => {
    await expectTestIdText(page, 'profile-current', '2:Bob');
    await expectTestIdText(page, 'profile-loading', 'false');
    assert.equal(await storedProfileId(page), '2');
  }, { initScript: () => localStorage.setItem('currentProfileId', '2') });
}

const tests = [
  ['SimpleTaskCard: timer task switches to the completed card without a hook-order error', timerTaskCompletes],
  ['MemoryGameActivity: progress survives rerenders, resets for a same-size next activity', memoryGameResetsOnlyForNewActivity],
  ['SortingActivity: order and selection survive rerenders, reset for next activity', sortingKeepsOrderAndResetsOnNewActivity],
  ['DragDropActivity: placements survive rerenders, no stale selection or response mutation', dragDropKeepsPlacementsAndResetsOnNewActivity],
  ['MatchingActivity: matches survive rerenders, reset for a same-size next activity, saved answer restores', matchingKeepsMatchesAndResetsOnNewActivity],
  ['H5PPlayer: parent rerenders start no attempt; errors reach the latest onError', h5pPlayerLoadsOnceAndReportsToLatestOnError],
  ['CountdownChallengeCard: no refetch on rerender; completion reported once to the latest callback', countdownReportsCompletionOnceToLatestCallback],
  ['LessonFlashcards: loads once per lesson across parent rerenders', flashcardsLoadOncePerLesson],
  ['HiddenAchievements: loads once per profile across parent rerenders', achievementsLoadOncePerProfile],
  ['ProfileContext: a selected profile sticks through profile refreshes', profileSelectionSticks],
  ['ProfileContext: restores the saved profile on load', profileRestoresSavedSelection]
];

// ---------------------------------------------------------------- runner

const tempDirs = [];
let server;
let browser;
let failures = 0;
try {
  const cacheDir = mkdtempSync(path.join(tmpdir(), 'lifecycle-vite-cache-'));
  const envDir = mkdtempSync(path.join(tmpdir(), 'lifecycle-vite-env-'));
  tempDirs.push(cacheDir, envDir);

  // No project config: no PWA plugin, no /api proxy, no .env (an empty
  // envDir keeps VITE_API_URL unset), and the dependency cache kept out of
  // node_modules.
  server = await createServer({
    root,
    configFile: false,
    envDir,
    cacheDir,
    logLevel: 'warn',
    plugins: [react()],
    resolve: { alias: { '@': path.join(root, 'src') } },
    optimizeDeps: { entries: ['tests/component-lifecycle.html'] },
    server: { host: '127.0.0.1', port: 0, strictPort: true, watch: null }
  });
  await server.listen();
  const { port } = server.httpServer.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  browser = await chromium.launch(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {});

  for (const [name, run] of tests) {
    try {
      await run(browser, baseUrl);
      console.log(`ok - ${name}`);
    } catch (error) {
      failures++;
      console.log(`not ok - ${name}`);
      console.log(String(error?.stack ?? error).replace(/^/gm, '    '));
    }
  }
} finally {
  await browser?.close();
  await server?.close();
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${tests.length - failures}/${tests.length} passed`);
if (failures > 0) process.exitCode = 1;
