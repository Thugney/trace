# FamilyHub Learn — Grades 1–10 research library

**Research date:** 2026-10-24 · **Scope:** Norwegian 1.–10. trinn, five initial subjects · **Status:** Code-import-ready research and *draft starter content*, **not** an approved or exhaustive LK20 teaching library.

## Start here

1. **[Canonical Codex/Claude implementation-only contract](GRADES1-10-CODEX-CLAUDE-IMPORT-CONTRACT.md)** — What the coding agents may build, exact schema and acceptance tests; **no additional curriculum research or authoring**.
2. [Curriculum readiness and limitations](CURRICULUM-READINESS-REPORT.md) — measured content depth, coverage gaps, human sign-off gates.
3. [Machine-checked QA report](research-qa-2026-10-24.json) — count, key, checkpoint and cross-reference verification.
4. [Machine-readable package manifest](content/library-manifest-2026.json) — dataset paths, inventory, statuses.

## Official Udir 2026 source registry

- [Official grade-checkpoint source register](lk20-grades1-10-source-register.md)
- [5 subjects × 10 grades × 25 verified checkpoint URLs](lk20-source-registry-2026.json)
- [Grade 8 topic research and source contract](udir-2026-research-and-content-contract.md) and [25 proposed topic briefs](grade8-topic-map-2026.json)

## Original student-learning drafts

- [50 course sequences covering 250 lesson IDs](grade1-10-course-map-2026.json): ordered learning and free topic selection.
- [Matematikk](content/matematikk-grades1-10.json) · [Norsk](content/norsk-grades1-10.json) · [Engelsk](content/engelsk-grades1-10.json) · [Naturfag](content/naturfag-grades1-10.json) · [Samfunnsfag](content/samfunnsfag-grades1-10.json)
- [50 draft formative review papers](content/grade1-10-assessment-papers.json), 500 items.

**Quantity:** 250 original **short** lessons (5 per grade/subject), 500 practice prompts (250 keyed MCQ + 250 open responses), 750 flashcards, 50 formative review papers.

**Limitations:** Median article prose **68 words**; this is a starter, not full grade-level textbook coverage. Each lesson has only 1 objective question, 1 open response, and 3 flashcards; review papers reuse question items. No full individual official competency crosswalk, independent mock-exam calibration, or educator approval yet. Grades 1–7 never receive numerical school grades; review papers for Grades 8–10 do not issue numeric estimates until independently approved rubric evidence is available.

## Development safety

This branch extends `feature/familyhub-learn` (PR #9) and depends on the earlier security changes in PR #8. It contains **research/data files only**. Do not overwrite the five existing Grade 8 PR #9 content records with shorter drafts, merge diverged Synology history blindly, or deploy to production from here. All newly authored content stays in **draft**.

Reference application design: [FamilyHub Learn architecture](../familyhub-learn-architecture.md).
