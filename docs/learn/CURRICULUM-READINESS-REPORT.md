# FamilyHub Learn — 1.–10. trinn, data readiness and quality gates

**Review date:** 2026-10-24  
**Scope:** 5 agreed core subjects, 10 grades (not all subjects on a Norwegian school timetable)  
**Repo PR:** #10 `docs/lk20-grade8-source-research-20261024` → `feature/familyhub-learn`  
**Status:** **Software import ready; curriculum-completeness and pedagogical publication NOT ready.**

## Verified structural inventory

| Metric | Verified count |
|---|---:|
| Grade × subject tracks | **50** |
| Verified Udir official competence-goal checkpoint URLs | **25** |
| Original **micro** lesson drafts | **250** |
| Distinct topic IDs | **250** |
| Keyed single-answer questions in lesson packs | **250** |
| Open-response prompts requiring feedback | **250** |
| Editable flashcard source cards | **750** |
| Subject review papers (draft, low stakes) | **50** |
| Items across review papers (reuse lesson material) | **500** |
| Published/educator-approved lessons | **0** |
| Individually completed official goal-to-lesson crosswalks | **0** |

All 50 grade/subject combinations have **5** original micro-lessons. Four option labels and keyed solutions were checked for structural consistency; review-paper answer keys were reconciled to the final lesson questions. Keys vary across A/B/C/D: {"A":70,"B":64,"C":68,"D":48}. A separate educational fact check and classroom review remain necessary.

## Content depth — transparent measurement

- matematikk: about **78 words** of explanatory article prose per micro-lesson on average.
- norsk: about **73 words** of explanatory article prose per micro-lesson on average.
- engelsk: about **62 words** of explanatory article prose per micro-lesson on average.
- naturfag: about **62 words** of explanatory article prose per micro-lesson on average.
- samfunnsfag: about **67 words** of explanatory article prose per micro-lesson on average.

This is **not** a long-form article collection or a complete year-long curriculum. The current lesson drafts support UI/course importer development and editorial review. They do **not** justify advertising full mastery or examination readiness.

## Grade 8 preservation

The five existing PR #9 topic slugs remain stable:
- `matematikk`: `primtallsfaktorisering-og-brok`
- `norsk`: `argumenterende-tekst`
- `engelsk`: `formal-and-informal-language`
- `naturfag`: `celler`
- `samfunnsfag`: `demokrati-og-medvirkning`

The other 20 Grade 8 topics are new proposals in this data pack. They must be imported without overwriting the original reviewed lesson IDs.

## Udir verification boundary

- Confirmed: current curriculum **codes**, official goal **checkpoint grade structure**, source **URLs** for all 25 checkpoints, and legally relevant grading stage.
- Research summaries and grade-wise sequencing are **local instructional choices**, not verbatim official content or certified one-to-one official competence-goal matches.
- Curriculum goal lists are larger than the 5-topic starter units. Official individual goals have **not been exhaustively crosswalked**, and no false IDs have been assigned.
- For Grades 1–7: feedback only, no numerical grades.
- For Grades 8–10: existing pilot's grading bands are unofficial and not Udir policy. These 50 short review papers do **not** authorize an indicative numeric grade until a validated subject rubric and human review are in place.

## Required before releasing to children

1. Human reviewer checks every lesson for factual/pedagogical quality, accessible wording, crosswalk to relevant current official goal, and answer validity.
2. Expanded content is authored as **new versioned data**, not invented by Codex/Claude and not overwrite existing published lessons.
3. Representative learner-read-aloud and reading-level checks per grade; language/bilingual support where appropriate.
4. Bias, safety and privacy review, including content involving vulnerable groups or children.
5. Staging importer smoke test: no duplicate IDs, repeat-safe migrations, draft hidden, per-child permissions, answer keys hidden in assessment mode.
6. Reconcile PR #8/#9 and Synology Psalm divergence without touching live production. Full tests against restored production database are mandatory.

## Engineering handoff

Follow `docs/learn/GRADES1-10-CODEX-CLAUDE-IMPORT-CONTRACT.md`. Coding agents must **not** be tasked with curriculum research or filling incomplete articles with guesses. If a source requires additional content, preserve draft status and report the gap to the curriculum author instead.
