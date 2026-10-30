# Quickstart: validating Learn lesson notes

## Prerequisites

- Node 22.23.4 (`work/factory-dependency-repair/.verification-runtime-node22/node_modules/node/bin/node.exe` in the root checkout); Node 24 cannot load `better-sqlite3`.
- `npm ci` in `backend/` and `frontend/`.

## Automated

```bash
cd backend && npm run build && npx vitest run src/test/notes.test.ts src/test/learnNotes.test.ts
cd backend && npm test
cd frontend && npm run build && npm run lint
```

What the tests should show (contract: [contracts/api.md](contracts/api.md)):

1. Child creates, edits and deletes a note on a reviewed lesson, and `GET /lessons/:id` returns it under `notes.mine`.
2. A note on a draft lesson gives 404; empty text gives 400; the 31st note gives 400.
3. Another child gets 404 on PUT/DELETE of that note and 403 on `/api/notes/:otherId`, `/categories`, `/tags` and `/reminders`, and 404 on `/note/:id`.
4. While a review paper is running, the lesson payload is locked, `/api/notes/:self` leaves out lesson notes, and every write gives 423. After submitting, the notes are back.
5. A parent's assignment with a note shows in `notes.from_parents` for the lesson (and for every reviewed lesson of an assigned topic). After the assignment is cancelled, it is gone.
6. A parent gets the child's notes grouped by subject; another family's parent gets 403; an admin view writes `learn.admin_viewed_child_notes`.
7. The migration runs twice without error on an existing database, and old notes keep `learn_lesson_id = NULL`.

## Manual (browser, light theme)

1. As a child, open a lesson's **Les** tab and add two notes in **Mine notater**. Reload, and both are still there.
2. Open `/notes`. The notes carry a "📘 Fag · Leksjon" chip, and clicking it returns to the lesson.
3. As the parent, assign the lesson with a note. The child sees **Fra forelder** in the lesson and on `/notes`.
4. Start a review paper as the child. The lesson panel shows the pause message, and `/notes` hides the lesson notes.
5. In **Learn for foreldre**, open **Leksjonsnotater** for the child. The notes are grouped by subject and have no edit buttons.
6. At phone width (375 px), the panel sits below the lesson text with no horizontal scroll.
