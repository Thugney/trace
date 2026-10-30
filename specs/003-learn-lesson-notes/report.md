# Job 004 report: Sticky notes integrated into Learn

This is the job report for Factory job `004-sticky-notes-integrated-into-learn` (root board). It lives on the branch because the session's worktree guard blocks writes to the root's `factory/jobs/`.

- **Branch**: `feature/learn-notes`, cut from `origin/release/familyhub-learn-20261030` (b6e848d). Feature commit 4891a2b.
- **Approvals**: scope chosen by the user in chat on 2026-10-30. The mockup was approved in chat on 2026-10-30 ("Approve, build it").
- **Not done**: nothing pushed, merged or deployed. Project Init baseline, review and guard were not run, because this worktree has no Project Init state of its own. No independent Factory reviewers have run yet.

## What changed

- **Migration**: `backend/src/database/noteLearnLink.ts` adds `notes.learn_lesson_id`, `notes.learn_topic_id` and `idx_notes_profile_lesson`. It is additive and uses PRAGMA guards. It is called from `init.ts` and from `ensureLearnSchema()`.
- **Service**: `backend/src/services/learn/lessonNotes.ts` handles lesson notes, parent assignment notes (read from `learn_assignments`), the lock via `getOpenAssessment`, and Learn context for `/api/notes`.
- **Learn routes**: the lesson payload gains `notes`. New routes: `POST /lessons/:id/notes`, `PUT|DELETE /lesson-notes/:id` (owner only), `GET /me/assignment-notes`, and `GET /children/:id/notes` (parent or admin, admin audited).
- **`/api/notes`**: every route now uses `canAccessOwnOrManagedChild`, which fixes a child reaching another profile's notes and unchecked `/note/:id`, `/categories` and `/tags`. During the owner's test, lesson notes are withheld and changes return 423.
- **Pre-existing bug fixed**: `/categories` and `/tags` used `""` string literals, which this SQLite build reads as identifiers, so both routes returned 500.
- **Frontend**: `LessonNotesPanel` in the Read tab, the lesson chip and "Fra forelder" strip on `/notes`, and "Leksjonsnotater" in LearnParent. No new `dark:` classes (diff grep count 0).

## Receipts (Node 22.23.4 from `work/factory-dependency-repair/.verification-runtime-node22`)

| Check | Result |
|---|---|
| backend `tsc` | exit 0 |
| backend `vitest run` (full) | exit 0: 33 files, 341 passed, 1 skipped (existing conditional browser demo in tutor-v2.test.ts) |
| `notes.test.ts` + `learnNotes.test.ts` | 19 passed |
| new US4 ownership tests run against the **old** `notes.ts` | 3 failed (the bug is real); pass on the new code |
| frontend `tsc && vite build` | exit 0 |
| frontend `eslint --max-warnings 0` | exit 0 |

The first full run had 5 failures: Learn test files without the notes columns got a 500 from the lesson endpoint. Making `ensureLearnSchema()` run the migration fixed them; the rerun is the one shown above.

## Not verified

- No browser smoke test of the new UI against a running app at desktop or 375 px width.
- The migration has not been run on a restored copy of the NAS database.
