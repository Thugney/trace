# Research: Learn lesson notes

## R1. Where lesson notes are stored

- **Decision**: Reuse `notes` with two nullable columns, `learn_lesson_id` and `learn_topic_id`, plus an index on `(profile_id, learn_lesson_id)`.
- **Rationale**: The spec requires lesson notes to be ordinary notes on `/notes` (FR-005) that can be edited in either place (FR-004). One row serves both places, so they can't drift apart.
- **Alternatives**: A separate `learn_lesson_notes` table, like `learn_personal_cards`. It was rejected because `/notes` would need a union query and two edit paths.

## R2. Assessment lock

- **Decision**: Use `getOpenAssessment(profileId)` from `services/learn/assessmentLock.ts`. When the viewer owns the notes and has a running test, Learn routes return `notes.locked = true` with empty lists and refuse writes with `423 exam_in_progress`. `/api/notes` leaves out rows with `learn_lesson_id IS NOT NULL` and refuses changing or deleting them with 423.
- **Rationale**: Practice, model answers and the Tutor already use this rule. Notes may contain worked answers, so `/notes` has to apply the same lock, or it becomes a bypass.
- **Alternatives**: Locking only on the lesson page. Rejected because `/notes` would leak the same text.
- A parent viewing a child's notes is not locked, because the parent is not the one taking the test.

## R3. Parent assignment notes

- **Decision**: Read the notes from `learn_assignments` rather than copying them. An assignment applies to a lesson when `state != 'cancelled'`, `note` is non-empty and one of these holds:
  - `target_kind = 'lesson'` and `lesson_id` matches.
  - `target_kind = 'topic'` and `topic_id` is the lesson's topic.
  - `target_kind = 'review_paper'` and `lesson_id` (the paper's anchor) matches.

  Mock-exam assignments carry no lesson, so their notes appear on `/notes` only.
- **Rationale**: Cancelling or completing an assignment needs no clean-up, and the text has one source.
- **Alternatives**: Inserting a child-owned note row when an assignment is created. Rejected because it duplicates data, and the child could edit or delete the parent's text.

## R4. Authorisation in `/api/notes`

- **Decision**: Replace the inline checks with `canAccessOwnOrManagedChild(viewer, ownerId)` from `services/familyAccess.ts` on every route: list, categories, tags, reminders, single note, create, update and delete.
- **Rationale**: The current check `!target || (viewer.type === 'parent' && target.parent_id !== viewer.id)` lets any child through for any profile id. `/note/:id`, `/categories` and `/tags` have no check at all. The shared helper already covers admin, self and managed children (including co-parent links).

## R5. Learn context on `/notes`

- **Decision**: `GET /api/notes/:profileId` LEFT JOINs `learn_lessons`, `learn_topics` and `learn_subjects` to return `learn_lesson_title`, `learn_subject_title`, `learn_subject_slug` and `learn_lesson_visible` (true only when the lesson is `reviewed`). The `learn_*` tables are created at startup by `services/learn/schema.ts`. If the join fails because they are missing, the route falls back to the plain query.
- **Rationale**: It shows the subject without the child typing it (FR-002) and never links a child to a draft.

## R6. Parent view of a child's lesson notes

- **Decision**: Add `GET /api/learn/children/:childId/notes`, open to parents of the child and to admins (audited as `learn.admin_viewed_child_notes`). It returns the notes grouped by subject, then lesson. LearnParent loads them on demand behind a "Leksjonsnotater" toggle in each child card.
- **Rationale**: It follows the access rules and audit pattern of `/children/:childId/progress`, and loading on demand keeps the parent page light.
