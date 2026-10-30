# API contract: Learn lesson notes

All routes require `Authorization: Bearer <session>`. Learn routes also need Learn enabled for the viewer (the existing `requireLearnEnabled`).

## Learn (`/api/learn`)

### `GET /lessons/:lessonId` (extended)
Adds `notes: LessonNotesBlock` (see data-model.md). While the viewer has a test running, this is `{ locked: true, mine: [], from_parents: [], limit: 30 }`.

### `POST /lessons/:lessonId/notes`
Body: `{ content: string, color?: string }`. Returns 201 with a `LessonNote`.
Errors:
- 400 `note_empty` / `note_too_long` / `note_limit`
- 404 if the lesson is not visible
- 423 `exam_in_progress`

### `PUT /lesson-notes/:noteId`
Body: `{ content?: string, color?: string }`. Owner only; returns 404 for anyone else (no existence leak). Returns 200 with a `LessonNote`, or 423 during a test.

### `DELETE /lesson-notes/:noteId`
Owner only (404 otherwise). Returns 200 `{ deleted: true }`, or 423 during a test.

### `GET /me/assignment-notes`
Returns 200 `{ locked: boolean, notes: ParentAssignmentNote[] }`: the viewer's non-cancelled assignments that have a note. Each note carries `lesson_id` only when it points to a reviewed lesson. While the viewer has a test running, this returns `{ locked: true, notes: [] }`.

### `GET /children/:childId/notes`
Open to a parent who manages the child, or to an admin (audited `learn.admin_viewed_child_notes`). Everyone else gets 403.
Returns 200 `{ child: {id, name}, subjects: [{ subject_slug, subject_title, lessons: [{ lesson_id, lesson_title, lesson_visible, notes: LessonNote[] }] }] }`.

## Notes (`/api/notes`), re-authorised

Every route allows only `canAccessOwnOrManagedChild(viewer, ownerId)`; everyone else gets 403 (404 for a single note id).

| Route | Change |
|---|---|
| `GET /:profileId` | Adds Learn fields. While the owner is the viewer and has a test running, rows with `learn_lesson_id` are left out. |
| `GET /:profileId/categories`, `/tags`, `/reminders` | Access check added (categories and tags had none). |
| `GET /note/:id` | Access check added. A locked lesson note gives 404. |
| `POST /` | Access check fixed. `learn_*` fields in the body are ignored. |
| `PUT /:id`, `DELETE /:id` | Access check fixed. A lesson note during the owner's test gives 423 `exam_in_progress`. |
