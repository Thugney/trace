# FamilyHub Learn — Codex/Claude code-only handoff

**Status (2026-10-24):** Curriculum-version research and starter content assets prepared. **Not a complete LK20 textbook, not educator-approved, not a production release.**

## Objective

Implement structured learning and free topic selection for **Grades 1–10** in the existing FamilyHub PWA, reusing the School, Learn, activity, quiz, flashcard, H5P, AI, progress and parental assignment functionality. **You (Codex/Claude) own code implementation and test integration only.** Do not perform curriculum web research, author missing factual educational content, generate new question banks, or invent Udir goal IDs. Treat content files as fixed draft input. Raise a documented content-gap flag if an item cannot be safely imported.

## Inputs — exact repo paths

| Asset | Purpose |
|---|---|
| `docs/familyhub-learn-architecture.md` | Approved feature design, authorization and testing contract |
| `docs/familyhub-learn-implementation.md` | PR #9 pilot architecture and known deployment caveats |
| `docs/learn/lk20-grades1-10-source-register.md` | 2026 official checkpoint URLs for all five subjects |
| `docs/learn/lk20-source-registry-2026.json` | 50 subject × grade official-code/goal-checkpoint mappings |
| `docs/learn/udir-2026-research-and-content-contract.md` | Research, 25 initial Grade 8 topic briefs, content and grading guardrails |
| `docs/learn/grade8-topic-map-2026.json` | Detailed topic–goal-theme mappings (local theme IDs, **not official individual aim IDs**) |
| `docs/learn/grade1-10-course-map-2026.json` | 50 guided/free-choice course sequences containing 250 stable lesson references |
| `docs/learn/content/{matematikk,norsk,engelsk,naturfag,samfunnsfag}-grades1-10.json` | Five canonical v2 draft packs: 250 short lessons, 500 practice items, 750 flashcards |
| `docs/learn/content/grade1-10-assessment-papers.json` | 50 formative review papers, 500 questions (250 repeat practice MCQs + 250 manually evaluated responses) |
| `docs/learn/research-qa-2026-10-24.json` | Machine-checked counts and explicit educational-quality gaps |

## Branch and integration safety

- This documentation branch was created from `feature/familyhub-learn` (PR #9), which is stacked on `feature/familyhub-learn-security` (PR #8).
- **No production merge or deployment is authorized.** Synology production has separate, locally diverged Psalm commits. Preserve and reconcile its exact history before application deployment.
- Implement imports in a dedicated branch based on the agreed integration baseline. Do not cherry-pick experimental fixtures into production blindly.
- Preserve existing PR #9 Grade 8 stable slugs and any reviewed/published content. Where a Grade 8 slug already exists, **retain the existing richer PR #9 lesson**; do not overwrite it with the shorter research micro-lesson. If expanded content is approved later, create a **new immutable version**.

## Engineering contract

1. Introduce a schema-versioned, read-only content-import adapter for `schema_version: 2.0.0`; reject invalid subject, grade, checkpoint, options, correct keys or duplicate IDs. Import curated lesson text, keys and flashcards without having an LLM write or reword them.
2. Seed subjects, grade-course sequences and draft lessons with additive, repeat-safe migrations/transactions; preserve historical attempts, reviewed flags, IDs and parent assignments.
3. Apply `source_registry` grade-to-checkpoint rules exactly. Grade 1 maps toward Grade 2; mathematics has official checkpoints after Grades 2–10; other subjects after 2, 4, 7 and 10. Never represent local Grade 5/8 teaching sequences as distinct official Udir checkpoints when none exists.
4. Provide navigation by school grade and subject, ordered learning paths and unrestricted topic selection. Parent assignments reuse existing authorization, monitoring and notification services.
5. Reuse existing practice, flashcard and progress engines; persist server-verified attempts, without awarding points twice. Treat the open-answer questions as **human/formative feedback only** unless an independently reviewed rubric exists.
6. Reuse the AI provider pipeline with parental limits and server-side exam lockout. The AI may explain reviewed lesson content but must never publish curricular revisions autonomously.
7. Keep all new lessons/review papers in `draft` until an authorized human approves source alignment, factual accuracy, age level, answer keys and pedagogical suitability.
8. No numerical grades for Grades 1–7. Grades 8–10 may eventually receive clearly non-official 1–6 estimates only when a separate, calibrated rubric and sufficient evidence exist. **The supplied 50 review papers are not calibrated and must not issue numeric grade estimates.**
9. Test Family A/B, child, parent, admin and school-only users and cross-family authorization, session tokens, previous quiz/H5P/School/Books paths, disabled AI, import idempotency and rollback. Keep legacy records intact.
10. Production: follow the Synology operations runbook, backup database and media, test a restored copy, retain rollback images and disable Learn by default. Do not use `docker compose down -v` or delete `data/`.

## Scope and educational completeness: explicit boundaries

**Verified as of 2026-10-24:** Official curriculum codes and 25 official checkpoint pages for the five selected subjects; structurally valid 250 short draft learning units; 50 course sequences and 50 draft formative subject reviews.

**Not yet finished:** Exhaustive *individual* official competence-goal-to-lesson crosswalk; comprehensive year-round textbooks; 500–800-word reading articles; ten distinct self-marking questions and ten editable flashcards per topic; independent calibrated mock exams; educational human sign-off; coverage of subjects beyond the five selected.

**Do not label this library as "complete LK20 curriculum" or display unpublished topics to children.** The research package is implementation-ready as a **starter seed dataset**, not ready as a finished online school.

## Engineering acceptance and handoff

- Display exact counts imported by grade, subject and review status.
- Validate all 50 official checkpoint mappings and 250 stable lesson IDs; ensure every paper reference resolves and no duplicate attempts/points.
- Demonstrate one actual full parent → child → lesson → practice → flashcard → progress path on a disposable restored database.
- Confirm draft content remains inaccessible before review, including via direct API calls.
- Submit reviewable code PR(s), automated test evidence, migration rehearsal results and tested rollback procedure.
- Report content completeness separately from code completeness. **Code PASS must not imply lesson editorial approval.**

**Manual task removed:** Codex/Claude should consume existing machine-readable research, not independently repeat Udir online discovery. If coverage is inadequate, they must surface the gap instead of generating unreviewed material or fabricating curriculum compliance.
