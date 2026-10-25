# FamilyHub Learn — Implementation Notes (pilot)

Status: implemented on `feature/familyhub-learn` (from `origin/feature/quiz` @ `8067070`), not deployed.
Contract: [familyhub-learn-architecture.md](familyhub-learn-architecture.md). This file records what was built, the decisions taken, how it was validated and how to deploy or roll it back.
The Grades 1–10 extension (content importer, review papers, parent dashboard) is documented in [familyhub-learn-grades-1-10.md](familyhub-learn-grades-1-10.md).

## 1. Preflight (verified 2026-10-24)

- `git fetch --prune`. `origin/feature/quiz` @ `8067070` is the newest branch and the agreed baseline.
- Divergence that is **not** merged into this work. It must be reconciled before deployment:

| Branch | Commits not in `feature/quiz` | Notes |
|---|---|---|
| `origin/feature/school-leaderboard` (**live Synology branch**, per the runbook) | `f57e4ac` isolate H5P player / due dates, `1c75e74` repair H5P blank generation, `04a9463` harden H5P playback | 73 files differ from `feature/quiz`. Overlaps with the H5P work on `feature/quiz`. |
| `origin/feature/family-hub-settings-ux` | `561f4af` refine adult settings workspace UX | |
| `origin/codex/complete-psalm-51` | `360d56e` Tigrinya Psalm reader, `c200ac2` Psalm 51 content | Separate Bible content |

- Baseline checks on `8067070`: 65/65 backend tests pass. Backend and frontend `tsc` are clean, and `vite build` succeeds. **`npm run lint` fails on the baseline:** ESLint 9 is installed, but the repo has no `eslint.config.js`. This is unchanged here.

## 2. Delivery (commits, in dependency order)

| # | Commit | Phase |
|---|---|---|
| 1 | `fix(security): replace client-asserted profile identity with server sessions` | Security gate 1 |
| 2 | `fix(security): enforce family ownership on quizzes, activities and H5P` | Security gate 2 |
| 3 | `fix(school,features): reconcile school grading contract and gate learn feature` | Gates 3–4 |
| 4 | `fix(h5p): award assignment points once per xAPI completion` | Compatibility / idempotency |
| 5 | `feat(learn): add FamilyHub Learn catalog, lessons, practice, mock exams and tutor API` | Catalog, learning, assessment |
| 6 | `feat(learn): add FamilyHub Learn pilot UI for learners, guardians and reviewers` | UI, pilot |

The pull requests are stacked: **Security & compatibility** (1–4) → **Learn** (5–6).

## 3. Security and compatibility gate

### Authentication (gate 1)
- `authenticate` no longer trusts `x-profile-id` or `?profile_id=`. Login (`POST /api/profiles/login`) returns an opaque bearer token. Only its SHA-256 hash is stored, in `auth_sessions`, with a 30-day idle expiry, a 90-day absolute expiry and revocation (`AUTH_SESSION_IDLE_DAYS` / `AUTH_SESSION_MAX_DAYS`).
- New endpoints: `GET /api/profiles/session`, `POST /api/profiles/logout`, `POST /api/profiles/session/stream-token`.
- EventSource (AI chat) and the H5P iframe cannot send headers. They use a short-lived (4 h), HMAC-signed **stream token** in `?access_token=`. The stream token is bound to the session and the active profile and is only accepted by `authenticateEventSource`. The session token itself is never accepted in a URL. The signing key comes from `AUTH_TOKEN_SECRET`, or else a generated value persisted in `settings.auth_token_secret`.
- `verify-pin`/`set-pin` (profiles and settings) require authentication, enforce self/guardian/admin scope and use bcrypt. A guardian or admin PIN reset revokes the target's sessions.
- On startup, legacy plaintext PINs, passwords and the parent PIN are hashed once and the migration is safe to repeat. Login also upgrades a legacy value when it is used.
- `/api/settings` previously had no authentication at all. Reads now require authentication and mask credentials, `auth_token_secret` is never returned, writes are admin-only and reserved keys are blocked. Ollama management is admin-only. `GET /settings/features/flags` stays public.
- **Compatibility:** every user must sign in again once after deploy. Old browser state is cleared on load, and an expired or revoked session returns the user to the login screen.

### Ownership (gate 2)
- `services/resourceAccess.ts` provides `router.param` guards for `quizId`, `questionId`, `sessionId`, `activityId`, `attemptId`, `childId`, `profileId` and `parentId` in `family-quizzes.ts` and `activities.ts`, and for content `:id` in `h5p.ts`. Body IDs (`createdBy`, `assignedTo`, `profileId`, H5P `childIds`) are validated against the viewer's family.
- Quiz answers must belong to the attempt's quiz. Answers and completions are idempotent (409 on retry), and AI job status is visible only to its owner.
- H5P xAPI: retried or duplicated completion events no longer award points twice.

### School contract (gate 3)
- Added `GET /school/submissions/ungraded` and `POST /school/submissions/:id/grade`. Both are scoped to the teacher's classes and validated against `max_points`. They record points only on the submission and do not write to the FamilyHub economy.
- `/school/leaderboard` and `/school/students/:id/stats` are **not implemented**, deliberately. Class rankings wait for the organisation-boundary decision, so the UI hides them behind `SCHOOL_LEADERBOARD_ENABLED = false` in `School.tsx`.

### Features and school-only mode (gate 4)
- New feature key `learn`. It is **off by default** (`DEFAULT_DISABLED_FEATURES`) until a parent opts in (`PUT /api/learn/family/settings` writes `family_features`). It can also be disabled per child through the existing profile features.
- `school_only_mode` now allows a configurable list of features (setting `school_only_allowed_features`, a JSON array). The default is `["school","learn"]`. Underlying engines such as `activities` must be added explicitly.

### Data preservation (gate 5)
- All schema changes are additive: `auth_sessions` and `learn_*`. Existing quiz, H5P, school, regular-school, book and points data are untouched.
- The only in-place data change is hashing plaintext credentials (see rollback).

## 4. Learn design decisions

- **Reuse, not rebuild.** Practice is materialised once per learner as a `learning_sessions` row in the existing Learning Activity Engine. The row is owned by the guardian, so a child never owns its own answer key, and it is assigned to the learner. Delivery and scoring go through `/api/activities`, which scores on the server. Learn progress is derived only from verified `session_attempts`.
- **No point farming.** Learn practice awards economy points only for the learner's first passed attempt, and repeat completions skip the parent notification (`isRepeatLearnPracticeCompletion`).
- **Content as data, versioned.** `services/learn/curriculum.ts` holds one grade-8 topic per subject. Each has a lesson (article, worked examples, key terms), 5 practice items, 6 flashcards and a 9-item mock exam with a 3-criterion rubric. Seeding is idempotent, and lessons and exams are immutable per version.
- **Review gate.** All content ships as `draft`. Only an admin can publish it (`/learn/review`), and the real reviewer and timestamp are recorded. Learners never see drafts, and AI output never becomes curriculum without review.
- **Honest LK20 mapping.** Goal descriptions are paraphrases with a source locator and a udir.no link, and they start `unverified` with no invented official codes. Mathematics maps to goals after grade 8. The other subjects map grade-8 teaching to goals after grade 10, and the UI labels this as a local sequence.
- **Assessment.** Mock attempts are created on the server and the answer keys never leave it. Submission is scored on the server and is idempotent. The indicative 1–6 grade uses fixed bands (85/70/55/40/20). It is withheld (`insufficient_evidence`) if fewer than 80 % of items are answered or any criterion has fewer than 2 answered items, and it is always labelled non-official.
- **Tutor.** Reuses the existing provider chain (`generateTextWithProviderFallback` in `ai.ts`, Grok → OpenAI → Gemini) and the existing `ai` feature, `ai_enabled` setting and quota (`chat`). Only reviewed lesson text and the question are sent, wrapped as untrusted data. It is locked on the server while any mock attempt is open (423), and it falls back to pointers into the lesson when AI is unavailable.
- **Assignments.** Guardian → own child only, for reviewed lessons and exams. They use an idempotency key, are audited in `audit_logs`, send a notification and complete automatically from verified practice or a submitted mock. Teacher and class assignments return `organization_boundary_unresolved`.
- **Kill switch.** Setting `learn_enabled = false` turns Learn off for everyone without deleting history.
- **UI.** `/learn` (learner home, or the guardian view for parents), `/learn/parent`, `/learn/lessons/:id`, `/learn/exams/:id` and `/learn/review` (admin). The UI copy is Bokmål, and English lessons render in English. The app has no global dark mode, so Learn follows the existing H5P pages and uses Tailwind `dark:` (OS preference).

## 5. Validation

- Backend: **129/129 tests** across 23 files, `tsc` clean. New suites: `auth`, `settings-security`, `learning-access`, `school-grading`, `feature-gates`, `learn`, `learn-content`. The negative-authorisation tests were confirmed to **fail on the baseline routes** and to pass with the fixes.
- Frontend: `tsc` clean, `vite build` succeeds.
- Manual end-to-end check in the browser against a throwaway database (`seed-learn-demo.ts`), at 375 px and 1280 px, in light and dark mode:
  - admin reviews the content;
  - the parent opts in and assigns the maths lesson;
  - the child sees the assignment, reads the lesson, practises (80 %, server-scored, points once), uses the flashcards and asks the tutor (fallback; no AI keys configured);
  - the tutor returns 423 while the mock exam is open;
  - the child submits the mock exam (indicative 6, non-official; alternative notation accepted);
  - the assignment completes automatically, and a revoked session returns to login.
- Not validated: real AI provider responses (no keys in this environment), real iPad/phone hardware, H5P playback with the stream token (no H5P libraries installed locally), and ESLint (baseline config missing).

## 6. Deploying to Synology (follow the runbook; do not deploy from this document alone)

1. Reconcile `feature/school-leaderboard` (live) with this branch first, because they diverge. Do not force-push.
2. Back up `/volume2/docker/trace/data` (SQLite `family.db`, `-wal`/`-shm`), uploads, avatars and `/app/data/h5p`.
3. Optional: set `AUTH_TOKEN_SECRET` in `.env` (32+ random bytes). If it is not set, a secret is generated and stored in the database.
4. Rebuild the backend and frontend images and check `/health`. Everyone signs in again.
5. As admin, open `/learn/review`: read each lesson and mock exam, check facts and answer keys, verify the goal mapping on udir.no, then approve.
6. A parent opts in from `/learn`. Watch errors, AI costs (`ai_usage_logs`, feature `chat`) and score anomalies.

## 7. Rollback

- **Learn only:** set `settings.learn_enabled = 'false'` (admin `POST /api/settings/learn_enabled`), or let parents switch it off. History is kept.
- **Whole release:** revert to the previous application image. `auth_sessions` and `learn_*` tables stay in place and are ignored by older code. **Do not drop them.**
- **Credential caveat:** after the startup migration, PINs and passwords are bcrypt hashes. Older code verifies login PINs and passwords with bcrypt, so login keeps working. The old `/settings/verify-pin` compared the parent PIN in plaintext, so after a rollback the parent PIN must be set again, or the backup from step 2 restored.

## 8. Open items and blockers

- **Human content review:** the five lessons and five mock exams are AI-assisted drafts and stay invisible to children until an admin reviews them.
- **Goal verification:** udir.no could not be reached from the build machine. Only the Mathematics goal wording is corroborated (by several schools' grade-8 plans). All goals ship `unverified`.
- **Organisation boundary (church schools):** teacher and class assignments and class leaderboards are deferred.
- **Branch divergence:** see §1. This must be resolved before any deployment.
- Pre-existing issues seen but out of scope:
  - `GET /api/profiles/selector` is public and lists every profile's name and age (onboarding depends on it).
  - The parent PIN is a single global setting.
  - H5P scores are reported by the client (Learn does not use H5P scores).
  - The existing activity engine sends `correct_data` to the player (Learn mock exams do not).
  - ESLint config is missing.
