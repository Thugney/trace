# Tasks: Learn lesson notes

**Input**: Design documents from `specs/003-learn-lesson-notes/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Required. The Factory job's done criteria include backend tests, and the suite must pass.

**Gate**: Implementation (Phase 2 onward) starts only after the user approves `mockup.html`.

## Phase 1: Setup

- [x] T001 Create the UI mockup for approval (light theme only, Bokmål) in specs/003-learn-lesson-notes/mockup.html, covering the lesson Read tab with "Mine notater" and "Fra forelder", the locked state, `/notes` cards with a lesson chip and a parent strip, and the LearnParent "Leksjonsnotater" view, at both desktop and 375 px

## Phase 2: Foundational (blocks all stories)

- [x] T002 Add an additive migration in backend/src/database/init.ts using the try/catch `PRAGMA table_info(notes)` pattern: `learn_lesson_id INTEGER DEFAULT NULL`, `learn_topic_id INTEGER DEFAULT NULL`, and `CREATE INDEX IF NOT EXISTS idx_notes_profile_lesson ON notes(profile_id, learn_lesson_id)`
- [x] T003 Create backend/src/services/learn/lessonNotes.ts with the constants (`LESSON_NOTE_MAX_LENGTH = 2000`, `LESSON_NOTES_PER_LESSON = 30`, the palette `#fef08a #fbcfe8 #bfdbfe #bbf7d0 #e9d5ff #fed7aa`, default `#fef08a`), `cleanNoteContent`, `listLessonNotes(profileId, lessonId)`, `presentLessonNote(row)`, `assignmentNotesForChild(childId, lesson?)` (non-cancelled, non-empty note; lesson match by `target_kind` per research R3), `lessonNotesBlock(profileId, lesson)` (lock-aware via `getOpenAssessment`) and `childLessonNotesBySubject(childId)`
- [x] T004 [P] Add a `createTestLessonFixture` helper (subject, topic, reviewed lesson, draft lesson) to backend/src/test/helpers.ts if no equivalent exists, reusing the existing Learn test fixtures where they exist

## Phase 3: User Story 4 — notes stay private (P1, security)

**Goal**: Only the owner, a managing parent or an admin can reach any note.

**Independent test**: Cross-child attempts on every `/api/notes` route are refused.

- [x] T005 [US4] Add failing cases to backend/src/test/notes.test.ts: a sibling child gets 403 on `GET /:id`, `/categories`, `/tags` and `/reminders` and on `POST`; 404 on `GET /note/:id`; 403 on `PUT` and `DELETE`, with the data unchanged. An unrelated parent gets 403. The existing own and managed-child cases still pass.
- [x] T006 [US4] Replace the inline checks in backend/src/routes/notes.ts with `canAccessOwnOrManagedChild(viewer, ownerId)` from backend/src/services/familyAccess.ts on all eight routes; `GET /note/:id` gives 404 when access is denied; `POST` ignores `learn_*` body fields

## Phase 4: User Story 1 — a child keeps sticky notes beside a lesson (P1) 🎯 MVP

**Goal**: Notes in the lesson Read tab, saved to the lesson and topic, shown on `/notes`, and locked during tests.

**Independent test**: Create a note in a lesson, reload, see it on `/notes` with a link back; start a review paper and see it hidden and read-only.

- [x] T007 [P] [US1] Write backend/src/test/learnNotes.test.ts for the lesson-note contract: create/edit/delete via `POST /lessons/:id/notes`, `PUT /lesson-notes/:id` and `DELETE /lesson-notes/:id`; draft lesson gives 404; empty gives 400 `note_empty`; over 2000 characters gives 400 `note_too_long`; the 31st note gives 400 `note_limit`; a bad colour falls back to `#fef08a`; another child gets 404; `GET /lessons/:id` gives `notes.mine`; with an open review attempt the payload is `locked: true` with empty lists, writes give 423 `exam_in_progress`, and `/api/notes/:self` leaves out lesson notes while `PUT` and `DELETE` there give 423
- [x] T008 [US1] In backend/src/routes/learn.ts: add `notes: lessonNotesBlock(...)` to `GET /lessons/:lessonId`; add `POST /lessons/:lessonId/notes` (title = the lesson title cut to 200 characters, `category = 'School'`, `learn_topic_id` = the lesson's topic), and `PUT` and `DELETE /lesson-notes/:noteId` (owner only, 404 otherwise, 423 during a test)
- [x] T009 [US1] In backend/src/routes/notes.ts: LEFT JOIN Learn context (`learn_lesson_title`, `learn_subject_title`, `learn_subject_slug`, `learn_lesson_visible` = `review_status = 'reviewed'`) on list and single reads; leave out lesson notes while the owner-viewer has an open assessment; 423 on `PUT` or `DELETE` of a lesson note during the owner's test
- [x] T010 [P] [US1] Add the optional Learn fields to `Note` in frontend/src/types/index.ts and the `LessonNote`, `ParentAssignmentNote` and `LessonNotesBlock` types plus `LearnLesson.notes` in frontend/src/types/learn.ts
- [x] T011 [P] [US1] Add `createLessonNote`, `updateLessonNote`, `deleteLessonNote` and `getAssignmentNotes` to `learnAPI` in frontend/src/services/api.ts
- [x] T012 [P] [US1] Add nb and en copy (`myNotes`, `addNote`, `notePlaceholder`, `saveNote`, `notesPaused`, `noNotesYet`, `fromParent`, `noteLimit`, `deleteNote`, `editNote`, `lessonNotes`, `noChildNotes`) to frontend/src/components/learn/learnCopy.ts
- [x] T013 [US1] Create frontend/src/components/learn/LessonNotesPanel.tsx: sticky-note cards in the Notes palette, a quick-add textarea (maxLength 2000) with colour dots, inline edit and delete with confirm, read-only "Fra forelder" cards first, and a locked message. Use no `dark:` classes and 44 px touch targets.
- [x] T014 [US1] Render `<LessonNotesPanel>` at the top of the Read tab aside in frontend/src/pages/learn/LessonPage.tsx; reload the lesson after changes
- [x] T015 [US1] Show a "📘 {subject} · {lesson}" chip on lesson-linked cards in frontend/src/pages/Notes.tsx, linking to `/learn/lessons/:id` only when `learn_lesson_visible`

## Phase 5: User Story 2 — parent assignment note as a sticky note (P2)

**Goal**: Assignment notes appear read-only, wherever the assignment applies.

**Independent test**: Assign with a note, see "Fra forelder" in the lesson and on `/notes`; cancel the assignment and it disappears.

- [x] T016 [US2] Extend backend/src/test/learnNotes.test.ts: a lesson assignment note shows in `notes.from_parents` with `from_name`; a topic assignment note shows on that topic's reviewed lesson; a cancelled one is hidden; an empty note is left out; `GET /me/assignment-notes` returns the list and is locked during a test
- [x] T017 [US2] Add `GET /me/assignment-notes` in backend/src/routes/learn.ts (declared before any `/me/:param` routes), returning `{ locked, notes }`, where `lesson_id` is set only for reviewed lessons
- [x] T018 [US2] Show a "Fra forelder" strip of read-only parent notes on frontend/src/pages/Notes.tsx for child viewers, using `learnAPI.getAssignmentNotes` and ignoring errors when Learn is off

## Phase 6: User Story 3 — parent reads a child's lesson notes (P3)

**Goal**: A read-only view in LearnParent, grouped by subject and lesson.

**Independent test**: The managing parent sees the grouped notes; another family's parent gets 403; an admin view is audited.

- [x] T019 [US3] Extend backend/src/test/learnNotes.test.ts: the managing parent gets the grouped subjects; an unmanaged parent and the child themself get 403; an admin gets 200 and an audit row `learn.admin_viewed_child_notes`
- [x] T020 [US3] Add `GET /children/:childId/notes` in backend/src/routes/learn.ts, with the same access rules as `/children/:childId/progress` and an audit for admins
- [x] T021 [P] [US3] Add `getChildNotes(childId)` to `learnAPI` in frontend/src/services/api.ts
- [x] T022 [US3] Add a "Leksjonsnotater" toggle per child card in frontend/src/pages/learn/LearnParent.tsx that loads on demand and shows subjects, then lessons, then read-only note cards with a date and an empty message

## Phase 7: Polish

- [x] T023 Run the backend build and `npm test` on Node 22.23.4, then the frontend build and lint, and record the actual output in factory/jobs/004-sticky-notes-integrated-into-learn/report.md (root checkout)
- [x] T024 Check there are no new `dark:` classes in the changed frontend files (`git diff` grep)
- [x] T025 Update .claude/CLAUDE.md "Feature Documentation" with a short Learn lesson notes section

## Dependencies

- T001 (mockup approval) gates T002 onward.
- T002 and T003 block every story. US4 (T005–T006) goes before US1, because US1 changes the same notes.ts routes.
- US1 → US2 (uses `lessonNotesBlock` and `LessonNotesPanel`) → US3, run in sequence in shared files (learn.ts, learnNotes.test.ts).
- [P] tasks touch distinct files: T004, T007, T010, T011, T012 and T021.

## Parallel example (US1)

T010 (types), T011 (api.ts) and T012 (copy) can be written together while T008 and T009 land in the backend.

## Implementation strategy

MVP is US4 + US1: secure notes and lesson notes with the lock. Then US2, then US3, each verified by its own tests before moving on.
