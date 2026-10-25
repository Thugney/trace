# FamilyHub Learn Tutor 2.0 — Issue #12

## Implementation and concurrency

Work is isolated on `feature/familyhub-learn-tutor-v2`, initially created at the required `4264510242842de35594d71ba062de3156545c55`. Integrated PR #11 commits `383993d` and `052e8ae` by fast-forwarding this checkout only. The shared checkout, Claude's branch, production data and research JSON were not edited. The stacked PR targets `feature/familyhub-learn-grades-1-10`.

## API

`POST /api/learn/tutor` retains `{ lesson_id: number, question: string }` and the existing `answer`, `source`, optional `provider` and `reason` fields. New optional fields:

| Field | Contract |
| --- | --- |
| `mode` | `explain` (default), `hint`, `guided_practice`, `check_understanding`, `next_step` |
| `locale` | `nb` or `en`; defaults to lesson locale |
| `item_key` | An existing practice key belonging to the reviewed lesson |
| `hint_level` | Integer 0–2; each level remains safe even if requested directly |
| `recovery` | Boolean; takes a smaller first-sentence/word step in every teaching mode |

Question is optional for explicit modes, bounded to 500 characters. Unknown fields, identity overrides, client grades/results and transcripts are rejected. Grade comes from the server's lesson-topic mapping. Response adds `mode`, `references` (lesson ID, section index, exact heading), `formative_only`, optional hint/item metadata and a reviewed `recommendation`.

`explain` and `check_understanding` use existing provider fallback with at most two bounded source sections and no answer keys, examples' solutions, profiles, prior answers, grades, curriculum IDs or learning history. Responses must be bounded JSON with valid section indexes and `supported=true`; malformed citations, unsupported answers, links and official-competency claims fall back to the source. No claim is made that an LLM's supported flag verifies factual correctness.

Hints use reviewed authored hints only after excluding keyed option labels/answers; otherwise a three-step reading/reasoning scaffold is used. Guided practice selects existing reviewed practice and opens the current activity engine. Neither mode calls a provider. Check-understanding feedback is formative and never writes progress or points. Recovery asks about one small part rather than repeating the explanation.

Next-step ranking is deterministic within the lesson's subject/grade: verified failed practice, submitted review-paper revision feedback, missed cards, due cards, then the first reviewed lesson without a passed practice result. All evidence is scoped to the authenticated profile. Stored mastery claims alone do not count. If everything is passed, it recommends review and asking an adult for additional material. It does not invent topics beyond the reviewed library.

## Controls and privacy

Existing authentication, global Learn switch, family/profile feature flags, AI opt-in, tutor switch and AI quotas remain in force. Tutor activates only on reviewed content, including for administrators. Existing shared assessment lock enforces 423 for open mock exams and review papers. After a provider succeeds **or fails**, assessment locks, features, parent controls and review status are checked again before returning content. A per-profile limit allows 20 requests/minute. Deterministic modes remain useful when quota is exhausted; disabled tutor access remains denied.

Conversation state is in React memory only, capped at 10 displayed exchanges, and cleared on leaving the panel or changing lessons. Only the current question is sent. Provider errors are not logged by the tutor route; usage logging contains existing aggregate accounting metadata. No transcript persistence or curriculum publication is added.

## Validation receipts (2026-10-25)

Receipts and screenshots are in `evidence/tutor-v2/`.

| Command from repository root | Result |
| --- | --- |
| `npm run build --prefix backend` | PASS, TypeScript exit 0 |
| `npm run build --prefix frontend` | PASS, TypeScript + Vite + PWA; existing bundle-size/Browserslist warnings |
| `npm test --prefix backend -- --run --reporter=dot` | 174 passed, 1 failed, 1 optional browser test skipped (176 total) |
| `TUTOR_BROWSER_TEST=1 TUTOR_PLAYWRIGHT_MODULE=<installed-playwright-path> npm test --prefix backend -- --run src/test/tutor-v2.test.ts` | 25 tutor unit/API/browser tests; see final browser receipt |
| `npm audit --prefix backend --workspaces=false --json` | 31 existing findings: 1 low, 10 moderate, 17 high, 3 critical; report retained, manifests/locks unchanged |
| `git diff --check` | PASS |

Actual browser run used PowerShell environment variables and the bundled Playwright module at `C:/Users/Editor/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`, with installed Edge headless. To reproduce elsewhere, point `TUTOR_PLAYWRIGHT_MODULE` at a local Playwright installation; install Edge or adjust the test's browser channel. This adds no production dependency.

The browser harness mounts the **real LessonPage and ProfileProvider**. Profile-selector responses alone are synthetic; Learn authentication, routes, practice submission/scoring and progress are real against the test suite's in-memory SQLite database. Provider calls are fake/offline. It demonstrates keyboard submission, source navigation/focus, approved practice, a wrong server-scored answer, progressive hints, formative feedback, next-step evidence, English scaffolding and smaller-step recovery at 1280×900/light and 390×844/dark. It checks page errors and horizontal overflow. The harness is excluded from the production entry point.

The full-suite failure is `src/test/gamification.test.ts:149`: `tasksCompleted` expected 1, received 0. The unchanged fixture inserts a task two days ago, then expects it in the current week. On Sunday 2026-10-25 the unchanged leaderboard starts its week on Sunday, excluding Friday. No gamification files were modified. This remains a baseline test issue, not a claimed green full suite.

Local dependency setup: shared installed backend dependencies lacked H5P. A locked install in this isolated checkout needed `--ignore-scripts` because the host's Node 24/Windows SDK could not rebuild SQLite. Tests reused the already-working host SQLite native binary in isolated `node_modules`; both builds and tests then ran. Dependency versions and lockfiles are unchanged.

## Manual validation / release limits

- Human review of teaching quality, language scaffolding and content sufficiency with representative approved real lessons remains necessary. The supplied research library remains draft and is not a complete full-year curriculum.
- A configured real-provider smoke test was not run; no extra credentials or paid service were requested. Provider correctness is not established by stub tests.
- Screen-reader behavior has semantic roles/live regions and keyboard/focus coverage; a human screen-reader session remains manual.
- Production migration/rollout, curriculum approval, Docker deployment and merging are outside this change. Project Init reports no registered baseline/current approval or release evidence; this PR does not claim release readiness.
