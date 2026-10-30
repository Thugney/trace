# Data Model: Learn lesson notes

## notes (existing table, additive columns)

| Column | Type | Notes |
|---|---|---|
| `learn_lesson_id` | INTEGER NULL | Set when the note was created from a lesson. NULL for ordinary notes. |
| `learn_topic_id` | INTEGER NULL | The lesson's topic at creation time. Gives the subject even if the lesson is later replaced. |

Index: `idx_notes_profile_lesson ON notes(profile_id, learn_lesson_id)`.

The migration uses the try/catch `PRAGMA table_info(notes)` pattern in `init.ts`, adds each column only if it is missing, is safe to repeat, and leaves existing rows NULL.

### Lesson note values on create

- `profile_id`: the viewer (owner only)
- `title`: the lesson title, cut to 200 characters
- `content`: trimmed text, 1–2,000 characters
- `color`: one of `#fef08a #fbcfe8 #bfdbfe #bbf7d0 #e9d5ff #fed7aa` (the existing Notes palette), default `#fef08a`
- `category`: `'School'`
- `tags`, `reminder_at`, `is_pinned`: NULL / 0 (the child can still set them later on `/notes`)

### Validation

- The lesson must exist and be `reviewed`, unless the viewer is an admin.
- There can be at most 30 rows per `(profile_id, learn_lesson_id)`.
- Writes are refused with 423 while `getOpenAssessment(owner)` is non-null and the viewer is the owner.

## learn_assignments (existing, read only)

Its `note`, `state`, `target_kind`, `lesson_id`, `topic_id` and `assigned_by` (joined to `profiles.name`) are read to build parent notes; nothing is written.

## Presented shapes

```ts
type LessonNote = { id: number; content: string; color: string; created_at: string; updated_at: string };
type ParentAssignmentNote = { assignment_id: number; note: string; from_name: string; target_kind: string;
  title: string; lesson_id: number | null; due_at: string | null; state: 'assigned' | 'completed' };
type LessonNotesBlock = { locked: boolean; mine: LessonNote[]; from_parents: ParentAssignmentNote[]; limit: number };
```

The `Note` type in `frontend/src/types/index.ts` gains these optional fields: `learn_lesson_id`, `learn_topic_id`, `learn_lesson_title`, `learn_subject_title`, `learn_subject_slug` and `learn_lesson_visible`.
