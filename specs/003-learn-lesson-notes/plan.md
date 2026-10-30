# Implementation Plan: Learn lesson notes

**Branch**: `feature/learn-notes` | **Date**: 2026-10-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-learn-lesson-notes/spec.md`

## Summary

Link the existing sticky notes to Learn lessons. Two nullable columns on `notes` (`learn_lesson_id`, `learn_topic_id`) turn an ordinary note into a lesson note, so lesson notes show on `/notes` without a second store. Learn gets owner-only lesson-note routes, a lesson payload `notes` block (own notes + active parent assignment notes), a parent read-only child-notes route, and an assignment-notes route for `/notes`. Every child-facing path applies the existing `getOpenAssessment` lock. The `/api/notes` router is re-authorised with `canAccessOwnOrManagedChild` and the same lock.

## Technical Context

**Language/Version**: TypeScript; backend Node 22.23.4 (`better-sqlite3` does not load on Node 24); frontend React 18 + Vite

**Primary Dependencies**: Express, better-sqlite3, React Router, Tailwind (light theme only), lucide-react, DOMPurify (already used by Notes)

**Storage**: SQLite; additive migration in `backend/src/database/init.ts` (try/catch `PRAGMA table_info` pattern)

**Testing**: Vitest + supertest in `backend/src/test`, `authHeaders(profileId)` from `src/test/helpers.ts`

**Target Platform**: Synology NAS Docker deployment; PWA in phone and desktop browsers

**Project Type**: Web application (`backend/` + `frontend/`)

**Performance Goals**: Lesson load adds two indexed queries; no measurable change

**Constraints**: No `dark:` classes in new code; Bokmål copy (English for English lessons); drafts never visible to children; Tutor untouched

**Scale/Scope**: One family; at most 30 notes per child per lesson

## Constitution Check

`.specify/memory/constitution.md` is still the unfilled template, so there are no ratified gates. The project rules in `.claude/CLAUDE.md` and the Learn release apply instead, and the design meets them:

- Bearer-session identity only; object access checked against the viewer (child = self, parent = managed children, admin = audited). ✅
- Additive, repeat-safe migration. ✅
- Children never see drafts: lesson notes can only be created on reviewed lessons, and links back are hidden for lessons no longer reviewed. ✅
- Assessment lock covers every new child-facing read and write. ✅
- Light theme only, Bokmål copy. ✅

Re-checked after Phase 1: no violations.

## Project Structure

### Documentation (this feature)

```text
specs/003-learn-lesson-notes/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/api.md
├── mockup.html          # UI mockup for approval (light theme)
└── tasks.md
```

### Source Code

```text
backend/src/
├── database/init.ts                 # notes.learn_lesson_id, notes.learn_topic_id + index
├── services/learn/lessonNotes.ts    # NEW: queries, lock-aware presentation, assignment-note matching
├── routes/learn.ts                  # lesson payload notes, lesson-note CRUD, child notes, assignment notes
├── routes/notes.ts                  # canAccessOwnOrManagedChild everywhere, lock filter, Learn context fields
└── test/
    ├── learnNotes.test.ts           # NEW
    └── notes.test.ts                # new cross-child and lock cases

frontend/src/
├── types/index.ts, types/learn.ts   # Note Learn fields, LessonNotes types
├── services/api.ts                  # learnAPI lesson-note calls
├── components/learn/LessonNotesPanel.tsx   # NEW: "Mine notater" panel
├── components/learn/learnCopy.ts    # nb/en copy
├── pages/learn/LessonPage.tsx       # panel in the Read aside
├── pages/learn/LearnParent.tsx      # per-child "Leksjonsnotater" read-only view
└── pages/Notes.tsx                  # lesson chip + "Fra forelder" strip
```

**Structure Decision**: Existing web-app layout. The new backend logic lives in one service module that both routers import, so the lock and ownership rules exist in one place.

## Complexity Tracking

None.
