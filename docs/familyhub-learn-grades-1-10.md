# FamilyHub Learn Grades 1–10: implementation, migration and rollback

Branch: `feature/familyhub-learn-grades-1-10`. Base: `docs/lk20-grade8-source-research-20261024` (PR #10 head `e10905f`), which stacks on PR #9 and PR #8.
Contract: [GRADES1-10-CODEX-CLAUDE-IMPORT-CONTRACT.md](learn/GRADES1-10-CODEX-CLAUDE-IMPORT-CONTRACT.md). The PR #9 notes are still valid: [familyhub-learn-implementation.md](familyhub-learn-implementation.md).

**Software completeness is not curriculum completeness.** The package holds 250 short drafts, about 68 words of article text each. No lesson is reviewed or published, and no individual LK20 competence goal has been crosswalked. This work loads the content, protects it and makes it usable once a human approves it. It does not make the content a complete LK20 course.

## 1. What was built

| Area | Implementation |
|---|---|
| Content packaging | `backend/content/learn/` is a byte-identical copy of `docs/learn/` (the backend Docker context is `./backend`). Sync it with `npm run learn:sync-content`, or check it with `npm run learn:sync-content -- --check`. A test fails if the two copies drift. |
| Validator | `services/learn/contentPackage.ts` checks all 5 subjects, 10 grades, the 50 courses, 250 lesson IDs (`<subject>-g<grade>-<slug>`), 5 lessons per grade/subject, checkpoint stage and URL against the registry, `crosswalk = unverified`, 4 distinct options with the key matching its label, open prompts that need human review, 3 flashcards, 50 papers kept in sync with the lesson keys, `numeric_grade_allowed = false` and the manifest counts. Content defects become structured `notices`, not silent fixes. |
| Importer | `services/learn/contentImport.ts` is draft-only and runs in one transaction. Identity is `(content_id, version)`. A stored version is corrected in place only while it is still an unapproved draft that no learner has used (no progress, practice, cards, answers, attempts or assignments). Approved, retired or used versions are never changed: a correction to them must come as a new version, which starts as a draft. The review page lists the lessons an import skipped for this reason. It refuses to write anything if validation fails, and every run is logged in `learn_content_imports`. It runs at startup (`LEARN_CONTENT_AUTO_IMPORT=false` disables this) and is skipped when the package hash is unchanged. It is also available as a CLI and as an audited admin endpoint (dry run by default). |
| Reuse | Lessons go into the existing `learn_lessons` table, and the keyed question becomes an activity-engine `multiple_choice` item: server-scored, with points for the first pass only. Flashcards use the existing Leitner/personal-card model. The tutor uses the existing provider chain and quota. Notifications and the audit log are reused. |
| Learner UI | `/learn` has a grade picker (reviewed-topic counts per grade), subject cards, the ordered course path (prerequisites are suggestions, not locks), free topic search, resume and assignments with deadlines. The lesson page adds a key takeaway, open responses, course previous/next and review papers. `/learn/papers/:id` and `/learn/review-attempts/:id` cover review papers. |
| Parent UI | Per child: school grade, Learn on/off, AI tutor on/off, a needs-practice list (failed practice, missed flashcards, wrong review-paper items), a feedback queue for open answers, review results and assignments of a topic, lesson, review paper or (grade 8+) mock exam, with due date and overdue status. |
| Reviewer UI | Filters by grade, subject and status. Answer-key and model-answer preview, review-paper approval, package validation explained in Bokmål, and dry-run or real import. |

### Assessment policy, enforced on the server

- **Grades 1–7:** formative only. Mock exams return `409 formative_only`, and the UI shows no grades.
- **Review papers, all grades:** the multiple-choice items are scored, and open answers are kept for a parent's feedback. They give topics to revise, and their `numeric_grade` is always `null`. The source policy forbids grades and no calibrated rubric exists.
- **Grades 8–10:** only the existing PR #9 rubric-backed mock exams can show the non-official indicative 1–6.
- **During any open mock exam or review paper**, the tutor, practice set-up and model-answer reveal return `423`. Answer keys, explanations and expected content never appear in an attempt payload.
- **Points:** review papers give 5 points per correct item on the first submitted attempt only. Resubmits and retakes earn 0, and resubmits are idempotent.

### Authorization (existing PR #8 model)

A child sees only itself. A guardian sees only linked children, and an admin's access is audited. Cross-family access to progress, settings, feedback, attempts and assignments returns 403 or 404, which the tests cover. Learners cannot see draft lessons, papers or topic titles, including through direct IDs. Learn stays **off by default** (feature flag, family opt-in and the `learn_enabled` kill switch).

## 2. Database migration (additive, repeat-safe)

New tables: `learn_courses`, `learn_course_topics`, `learn_review_papers`, `learn_review_attempts`, `learn_open_responses` and `learn_content_imports`.

New nullable or defaulted columns:
- `learn_lessons.content_id`, `content_meta` and `open_prompts`, with a partial unique index on `(content_id, version)`.
- `learn_goals.goal_level`.
- `learn_assignments.target_kind`, `topic_id` and `review_paper_id`.

There are no table rebuilds, drops or data rewrites. Topic and review-paper assignments also fill `lesson_id` (the topic's lesson, or the paper's first source lesson), so the original `CHECK (lesson_id OR mock_exam_id)` still holds. The API reports the real target through `target_kind`.

The 25 Udir checkpoint pages are stored as `learn_goals` rows with `goal_level = 'checkpoint'` and `official_goal_ref = NULL`. No individual goal IDs are created.

The five PR #9 Grade 8 pilot topics are shared, not duplicated: each keeps its richer pilot lesson, listed first, and gains the micro-lesson draft as a second lesson.

### Testing on a restored production copy (not yet done; no copy was provided)

```bash
cp /backup/family.db /tmp/family-copy.db
cd backend
DATABASE_PATH=/tmp/family-copy.db npx tsx src/scripts/import-learn-content.ts          # dry run, rolled back
DATABASE_PATH=/tmp/family-copy.db npx tsx src/scripts/import-learn-content.ts --write  # import drafts
DATABASE_PATH=/tmp/family-copy.db npx tsx src/scripts/import-learn-content.ts --write  # must report 0 created
```

Before and after, compare the row counts of `books`, `school_*`, `regular_school_*`, `family_quiz_*`, `h5p_*`, `learning_sessions`, `session_attempts`, `progress`, `tasks` and the existing `learn_*` tables. Only the new tables and `learn_lessons`, `learn_topics`, `learn_goals` and `learn_topic_goals` should grow.

## 3. Rollback

- **Learn only:** set `settings.learn_enabled = 'false'`, or a parent switches it off. History is kept.
- **Skip the content import:** set `LEARN_CONTENT_AUTO_IMPORT=false`. Imported drafts stay invisible to learners.
- **Whole release:** revert to the previous image. Older code ignores the new tables and columns. **Do not drop them**: they hold learner answers and feedback. Topic and paper assignments then look like ordinary lesson assignments, which is a safe degradation.
- To withdraw approved content, set it to `retired` in `/learn/review`. Never delete rows.

## 4. Validation evidence (2026-10-25)

- Backend: 147 of 148 tests pass. The new `learn-grades.test.ts` has 19 tests covering the package, the importer (including in-place correction of unused drafts), the draft gate, the full parent → child → practice → feedback → progress loop, review papers, Grade 1–7 policy, cross-family access and per-child controls. `tsc` is clean.
- The one failure is the baseline test `gamification > family-leaderboard … period boundaries`. It also fails on the untouched PR #10 head because it depends on the date (today is a Sunday). On the baseline, `learning-access > family quizzes` also timed out once and is flaky. Neither failure comes from this work.
- Frontend: `tsc` is clean and `vite build` succeeds. ESLint still has no config, as on the baseline.
- Import into a throwaway database: 250 lessons, 50 papers, 50 courses, 245 new topics plus the 5 shared pilot topics, 25 checkpoint goals. A second run created 0 and left 250 lessons and 50 papers unchanged.
- Browser check against a throwaway database, at 375 px dark and desktop light:
  - the child picks Grade 3 and follows the Maths course;
  - reading a lesson and practising (server-scored 100 %, points once);
  - an open answer, then parent feedback;
  - a review paper, with tutor and practice returning 423 during it and no keys in the DOM, and feedback with no grade;
  - the parent assigns a topic with a deadline;
  - the admin reviews with the answer-key preview.
- Not validated: a restored production copy (none provided), real AI provider replies (no keys), real devices, and H5P.

## 5. Content awaiting human action (not a code task)

1. **All 250 lessons and 50 review papers are drafts.** Each needs editorial review and approval in `/learn/review`.
2. **Review-paper `learner_feedback` prompts exist only in English**, so they are hidden on Bokmål papers.
3. **No individual competence-goal crosswalk exists.** Topics link only to checkpoint pages, which are `unverified`.
4. **Articles are short (median 68 words)**, and each lesson has one keyed question, one open question and three flashcards.

### Data fixes applied 2026-10-25 (approved by the repository owner)

The validator reported four inconsistencies in `docs/learn`. They were fixed mechanically, without writing new educational text, and the packaged copy was re-synced. The package now validates with no warnings.

| Issue | Fix |
|---|---|
| 77 lessons had an `article.model_answer` that contradicted `practice[0]` | Set to the practice key (letter form) or the answer (text form), which also matches the review papers. |
| 20 Grade 8 lessons set `existing_grade8_slug_preserved = true` | Set to the topic map's value. Only the 5 PR #9 pilot topics are `true`. |
| The course map used `formative_with_optional_indicative_review_later` in 15 Grade 8–10 courses | Renamed to the lessons' name, `formative_plus_non_official_mock_assessment`. |
| All 50 English lessons had no `title` | Filled with the title already shown in the app: the Grade 8 topic map title, otherwise the slug's words (e.g. "Colours around us"). These are still subject to editorial review. |

The validator still detects these issues and reports them as structured `notices`. The review page explains each one in Bokmål and links every affected lesson.

## 6. Known pre-existing issues seen (out of scope)

- The activity engine sends `correct_data` to the player. Practice answer keys can therefore be read in DevTools, which is why practice is locked during tests.
- On login and logout transitions, the browser console shows React "Maximum update depth" and "setState in render" warnings from `ModuleProtectedRoute` and `AppRoutes` in `App.tsx`.
- Deployment prerequisites are unchanged: reconcile with the live Synology branch and its Psalm-reader commits, and take backups first. See `familyhub-learn-implementation.md` §6.
