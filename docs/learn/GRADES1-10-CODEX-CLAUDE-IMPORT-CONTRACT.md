# FamilyHub Learn — Implementation-only handoff for Codex and Claude

**Date:** 2026-10-24 · **Research branch:** `docs/lk20-grade8-source-research-20261024` · **Delivery:** documentation/data only; no application changes.

## 1. Engineering scope and custody

**Codex and Claude must perform software engineering only.** The curriculum source discovery, local grade mapping, original lesson snippets, answer keys and flashcard drafts have already been supplied as versioned files. Do not delegate research, educational writing, topic generation or goal-code invention to coding agents. Do not use the web to fill missing lesson text. If a required field or goal crosswalk is absent, surface the content gap and maintain `draft`/unavailable status.

Software integration only: safely import data, expose protected APIs, reuse UI/activity engines, route lessons, persist user progress, enforce authorization, test and document operations. Do not merge PRs, change Synology, deploy, or publish curricula without approval.

## 2. Authoritative files, in order

1. `docs/familyhub-learn-architecture.md` — design, role boundaries, compatibility and security constraints.
2. `docs/familyhub-learn-implementation.md` — current Grade 8 implementation in PR #9 and migrations.
3. `docs/learn/lk20-grades1-10-source-register.md` — human-readable official-source register.
4. `docs/learn/lk20-source-registry-2026.json` — 5 curricula, 25 official competence-goal checkpoint URLs, 50 grade/subject tracks.
5. `docs/learn/content/library-manifest-2026.json` — machine-readable dataset inventory/status.
6. `docs/learn/content/{matematikk,norsk,engelsk,naturfag,samfunnsfag}-grades1-10.json` — **250 original micro-lesson drafts**, each containing original reading text, short worked/example explanation, one auto-scorable question, one reflective question and three flashcards.
7. `docs/learn/content/grade1-10-assessment-papers.json` — 50 **unpublished** formative review papers, 10 questions each. These are NOT calibrated graded exams.
8. `docs/learn/grade8-topic-map-2026.json` — additional 25-topic Grade 8 planning coverage (including 5 existing PR #9 lesson identifiers).
9. `docs/learn/udir-2026-research-and-content-contract.md` — Grade 8 goal-theme/source interpretations and content quality criteria.

## 3. Canonical import schema

Each per-subject pack declares `schema_version=2.0.0`, `subject`, `curriculum_code`, `review_status` and `lessons[]`. Each lesson includes:

- `id` (stable content identifier), `subject`, `grade`, `slug`, `sort_order`, `version`, `review_status`, `locale`, `title`.
- `curriculum` with the verified `code`, `official_checkpoint_after_grade`, `competence_goal_source_url`, and **unverified individual-goal crosswalk status**.
- `article.intro`, `article.sections` (each with heading/text), `article.comprehension_check`, `article.model_answer`, `article.key_takeaway`, `article.worked_example`.
- `practice[0]`: `type=single_select`, `question`, `options` (`key` A–D + `label`), `correct_key`, `correct_answer`, `explanation`.
- `practice[1]`: `type=open_response`, `question`, `model_answer`, `grading=human_feedback_required`.
- `flashcards[]` (3 front/back cards). Student-authored/edited personal cards must be separate from curated lesson content.
- `assessment_mode`: grade1–7 formative; grade8–10 practice plus optional non-official, rubric-backed mock assessment.

The review paper dataset contains 50 `assessments[]`, each linking five lesson IDs to five correct-answer keyed items and five human-reviewed response items.

**Never expose `correct_answer`, `correct_key`, `model_answer` or rubric solutions in an active learner's exam payload.** Content source files are public GitHub artifacts; these review papers are therefore best treated as low-stakes study material, not secure summative exams.

## 4. Curriculum stage mapping (already researched)

| Subject | Curriculum | Official goal checkpoints |
|---|---|---|
| Mathematics | `MAT01-06` | 2, 3, 4, 5, 6, 7, 8, 9, 10 |
| Norwegian | `NOR01-08` | 2, 4, 7, 10 |
| English | `ENG01-06` | 2, 4, 7, 10 |
| Science | `NAT01-05` | 2, 4, 7, 10 |
| Social Studies | `SAF01-05` | 2, 4, 7, 10 |

Stage mapping is included for every lesson, **not** one official goal for every year. Grade 1 maps to Grade 2. For non-mathematics, 3→4, 5–6→7, 8–9→10. Do not invent official goal IDs for these local teaching sequences.

## 5. Preservation rules

1. Maintain existing `/learn` and `/api/learn` contracts, users, assignments and legacy content. Do not replace existing Grade 8 curated seed records in place.
2. The five *existing* Grade 8 pilot topic slugs are explicitly marked in `grade8-topic-map-2026.json`. **Only these five are existing**; the 20 additional Grade 8 topic slugs are new and should not be rejected as mismatches.
3. Additive repeat-safe SQLite migrations; stable compound identity (`subject`, `grade`, `slug`, `version`). A changed reviewed lesson creates a new version and remains draft until approved.
4. Reuse `learning_sessions`, `learning_activities`, `family_quizzes`, H5P and personal flashcard APIs. Avoid duplicate engines.
5. Reuse FamilyHub access model: child=self; guardian=managed child; teacher=authorized class only when school partition resolved; admin=audit.
6. Keep `learn` feature default off. Drafts never appear to children and no implicit review approval occurs.
7. Progress from verified backend attempts only; retries and reward credits must be idempotent. Use existing cost limits for AI; no tutor assistance during mock exams.

## 6. Validation contract

A content importer passes when:
- All **5 subjects**, **10 grades**, **50 grade/subject groups** and **250 micro-lessons** load with correct stable IDs.
- Exactly **5 topics per grade × subject** and 50 linked review papers are available in the admin draft catalog.
- The 250 MC answers match one of four distinct options, answer keys do not always occupy the same slot, and the 250 open-ended prompts require human/formative review.
- **750 flashcards** import with per-learner editable copies while shared content remains immutable.
- All 250 stages agree with the versioned source registry; no bogus individual official Udir goal IDs are created.
- Grade 1–7 never display numeric grades. Grade 8–10 review papers never automatically publish a 1–6 grade. Existing PR #9 calibrated-marking proposal must be separately validated and remains non-official.
- Draft content is hidden from children; an authenticated authorized admin can review content and publish individual approved versions.
- Family A/B role gates, cross-tenant/family ID access, teacher boundaries, denial of client-reported scores, and session expiration are tested.
- Existing books, school assignments, quiz/H5P data, tasks, rewards and prior sessions remain unchanged.
- Frontend and backend builds, migration tests on a restored **copy** of production data, and mobile/tablet/dark mode smoke tests pass.

**What this validation DOES NOT establish:** the dataset is a complete LK20 teaching syllabus, that every individual official competence goal is mapped, that answers/educational wording are human certified, or that a short review paper is an official test.

## 7. Safe execution

1. Fetch research branch and PRs #8/#9. Resolve source overlap only on a **new integration branch** from an explicitly selected verified production base. Never overwrite the existing Synology Psalm reader commits.
2. Code a versioned **draft-only data importer**, common adapter and administrator review UI; include tests. Do not implement any new lesson-generation service.
3. Import 1 grade+subject into an isolated test DB, validate, then load the other 49 configurations.
4. Migrate a restored copy of the real production database in staging. Verify rollback and existing data retention before requesting deployment approval.
5. Open a code PR with evidence. No automatic merges, live Docker updates, live data writes or student publishing.

## 8. Honest coverage boundary

This is a **complete source/checkpoint register for the five selected subjects (Grades 1–10)** plus an **initial 250 micro-lesson library**, NOT a comprehensive full-year course in each of the 50 subject-grade combinations. Articles currently average approximately 60–80 words, with one auto-gradable question and three flashcards per topic. Pedagogical editing and comprehensive official goal-by-goal crosswalk are required before claiming full curriculum coverage. Neither is work to delegate to coding agents. Further authored research packages can be added as new versioned data without changing application architecture.
