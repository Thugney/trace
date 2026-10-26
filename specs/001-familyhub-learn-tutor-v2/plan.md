# Implementation Plan: FamilyHub Learn Tutor 2.0 recovery

## Current Factory execution amendment — 2026-10-26

Codex now orchestrates the full authorized Factory in `work/factory-final-integration`, branch `codex/factory-final-integration`, using actual current HEAD and root job reports. Original dirty Tutor work and original integrated76f2e9e remain preserved. Local commits/integration, disposable tests and local Docker builds are authorized by the user's instruction to fix all Factory blockers; remote push/PR changes/merge/deploy and production operations remain separate.

Independent work units own files according to the current shared security task ledger, including T035–T041 and necessary feedback contracts. Claude completed assigned work until an actual session limit; the user's standing fallback transfers remaining units to Codex. Current source review and actual verification, not old worker checkboxes, control integration. Routine engineering corrections proceed under the user's autonomy instruction; only genuine product, acceptance, risk or external-action decisions return to the human.

Use tested tool commit `ee954bf` with explicit `themes:["light"]`, unchanged thresholds, and supported per-checkout state/Spec Kit installation. Restore current native documents with provenance and register all combined native scope/mappings; never copy old gate receipts. Reference framing is the disclosed engineering choice in the current spec, independently checked for fidelity to unchanged approved preview bytes. No repeated light-mode or unchanged-UI approval is requested. Original Design02 archive and original Design03 human evidence remain preserved in the original Tutor checkout; current provenance points to them.

Run final exact-head source/security/semantic review and checks, record genuine existing human design approval, and measure the26light cases and separate hint/practice supplements at1280x800/390x844. Pixel discrepancies, human teaching/screen-reader/content acceptance and restored-copy migration evidence remain explicit. No visual threshold or reference substitution is used to force acceptance.

## Historical amendment — approved Design03, 2026-10-26

Resume T012/T032 in `work/issue12-factory`, branch `codex/issue12-factory`, base `b5fd046`. Earlier recovery notes below are historical. The implementation is authorized by the approved Claude design handoff and the user's instruction to perform Codex's work. Archive Design02 before replacing live design inputs; register the same native spec paths with pinned preview.14, independent review, then the recorded human approval.

Codex is the sole writer for TutorPanel.tsx/css, Tutor-only wiring in routes/learn.ts, tutorCoach.ts, types/learn.ts and tutor-v2.test.ts during this revision. No assessment, catalog, importer, schema, dependency, or other Claude-owned hunk may change. Keep the integration checkout at 76f2e9e untouched; hand the reviewed patch back to Claude for reconciliation. No commit, push or merge is implied.

Extend the existing Tutor request with a bounded practice option ID and return only formative correctness from reviewed MCQs. No key or explanation is returned, no provider receives the item, and no progress/attempt/reward write occurs. Other exercise types use existing Practice. Reuse the existing policy checks and rate limit before checking an answer. A successful quota/provider fallback stays usable; denied/rate-limited/offline requests replace the dock. Scope covers light-only desktop/mobile, including a device dark-preference invariance check.

Use approved colours, typography, owl and chat structure with real reviewed lesson sections; never copy the preview's sample curriculum. Register a new light-only visual matrix with the existing thresholds; new reference captures wait for the requested human framing decision. Design02 remains available under `.project-init/design-v2/`.

**Branch**: `feature/familyhub-learn-tutor-v2` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

## Summary

Preserve PR #14's implemented tutor. Two review findings require bounded code work: unsupported/off-topic answer acceptance and stale reviewed-version recommendations. Other incomplete work is verification, approval, dependency reconciliation or evidence triage unless testing establishes another defect. [tasks.md](tasks.md) is the sole task ledger. No workers or application changes are authorized by this planning turn.

## Technical Context

- TypeScript; Express 4 backend, React 18/Vite 6 frontend, existing SQLite/better-sqlite3.
- Reuse provider fallback, AI usage controls and Learn practice/review/flashcard engines. No new schema/service/dependency planned.
- Vitest 2/API tests; real LessonPage browser harness using installed Playwright/Edge and synthetic in-memory fixtures.
- Web/PWA, Grades 1–10, five existing subjects, `nb`/`en`; only reviewed available content.
- Existing bounds: 500-character question, two source sections, ten displayed exchanges, 20 requests/minute/profile. No new performance target invented.
- Native SQLite/dependency reproduction limitations recorded in [research.md](research.md).

## Constitution Check

Installed `.specify/memory/constitution.md` is an unratified placeholder, not adopted policy. Do not invent ratification or rewrite it. User instructions and Issue #12 govern: one native spec owner, isolated work, reviewed sources, privacy, honest evidence and no release actions. Scope conformance passes this author's document review; independent review/human baseline approval and execution provenance remain blocked. Recheck after future changes.

## Project Structure

- This native directory: spec, plan, tasks, research, data-model, contracts, quickstart and requirements checklist.
- Tutor logic: `backend/src/services/learn/tutorCoach.ts`, `tutorProgress.ts`.
- Shared wiring: `backend/src/routes/learn.ts`; existing catalog/practice/assessmentLock and activity/review routes are dependencies.
- UI: `frontend/src/components/learn/TutorPanel.tsx`, `frontend/src/pages/learn/LessonPage.tsx`, existing API/types.
- Tests: `backend/src/test/tutor-v2.test.ts`, `frontend/tests/tutor-v2.{html,tsx}`; PR11 regressions separately owned.
- Historical receipts: `evidence/tutor-v2/`; guide: `docs/familyhub-learn-tutor-v2.md`.

## Local State and Provenance

Remote heads read 2026-10-25: Tutor/PR14 **655ce2ff385a786fb434b9c83e3570faa610e2c2**; PR11 **052e8ae32dad9d567e9eab3390fbb8cf40a67de6**. Tutor worktree was clean before these planning files. PR14 remains draft targeting `feature/familyhub-learn-grades-1-10`. PR11 targets `docs/lk20-grade8-source-research-20261024`. PR13 exposes the same Tutor head against `dev`; maintainer reconciliation remains outstanding.

Shared root is on PR11's branch at `4264510`, behind remote, with unrelated tracked changes to `.claude/settings.local.json` and `.gitignore` plus untracked tooling/worktrees. Claude's `fix/learn-assessment-key-leaks` checkout is at `052e8ae`. Do not switch, clean, reset or stash these checkouts.

Spec Kit 1.2.3 uses sequential numbering. No existing native spec/plan/tasks were found in root or relevant worktrees/tooling. Recovered this directory using installed core templates and PowerShell setup workflows. Explicit selection in [quickstart.md](quickstart.md) preserves the shared feature pointer. No competing Project Init PRD/task board was created.

Project Init status/handoff and init preview at shared root report existing mode, Spec Kit ready, ECC 2.2.3, Factory installed and prerequisites ready. Config has zero checks, requirements zero mappings and UI zero screens. No baseline/review/approval/current execution. Visual report has zero cases and fails; guard fails tests/semantic/visual/execution. Root receipts are not Tutor-head acceptance.

CLI resolves through `C:/Users/Editor/AppData/Roaming/npm/project-init.ps1` to the regular installed package `node_modules/@thugney/project-init/bin/project-init.mjs`, version 2.1.0-preview.14. Available `C:/Tools/project-init` checkout is **52aaa8c478608f7d99e4763eb036fd281e01e142**, dirty in `bin/project-init.mjs`, and lacks required object **a96b1ad54f4b026594377aeefd6aa3aa4654d225**. Installed-package equivalence is unverified. Read the six required documents from that exact GitHub revision. Do not update moving main, overwrite the dirty clone or claim pinned execution.

Clients: codex-cli 0.164.0 (npm PowerShell shim), Claude Code 2.1.310 (`C:/Users/Editor/.local/bin/claude.exe`), Specify 1.2.3 (`C:/Users/Editor/.local/bin/specify.exe`). Init reports prerequisites ready; no worker was launched to prove runtime/authenticated execution. Root AGENTS.md and docs/CODEX-NAVIGATION-GUIDE.md are absent; supplied AGENTS supplement applies.

## Bounded Claude Factory Handoff

This is a later-use handoff, not a dispatched job. Installed `.claude/skills/factory/SKILL.md` defines Claude's entry: `/factory spec specs/001-familyhub-learn-tutor-v2` in the selected orchestration checkout, **after preflight/approval**. Codex follows factory-worker; it does not orchestrate Factory. Re-read installed skill for live arguments.

1. Complete T001–T003. Preserve existing PR14 head as resume source and refresh both remote heads. Planning files are uncommitted and installed tooling local: new Git worktrees do not inherit them. Arrange an explicitly approved scoped checkpoint/exact artifact transfer before dispatch without unrelated root work. Register artifacts against execution-checkout source hashes. Factory refuses tracked dirty source; never clear it destructively.
2. Derive `factory/jobs/<slug>/spec.md` solely as task routing. Record native artifact hashes, exact resume/base/dependency SHAs, `has_ui=true`, risk **HIGH**, allowlists, outputs and stop conditions. Auth/database involvement cannot be labeled LOW. Disable/skip automatic ship/new-PR behavior.
3. Assign **one Codex Tutor unit**, T010–T011 and validation: allow tutorCoach.ts, tutorProgress.ts, tutor-v2.test.ts and scoped docs/evidence. catalog.ts is read-only helper reuse. Change other UI/routes only for a demonstrated scoped defect with prior ownership update. Do not split the fixes into concurrent test-file writers.
4. Claude retains **separate PR11 remediation**, T020. Obtain reviewed commit/evidence, do not duplicate it in Tutor. If no independent Claude code unit exists in this job, skip that worker. No manufactured parallelism; reviewers must be independent of their own work.
5. Serialize T021 in a separate integration worktree. Codex owns Tutor-only learn.ts wiring hunks; Claude owns assessment/review/visibility hunks. Claude is integration coordinator and sole writer during reconciliation. Treat routes/activities.ts, assessmentLock.ts, catalog.ts, contentImport.ts, shared Learn tests, schemas and lockfiles as Claude-owned dependencies/read-only to Tutor until explicit reassignment. Shared frontend API/types/LessonPage conflicts likewise need a named sole writer. Stop on conflicts; do not overwrite protections or force-push.
6. Complete T030–T033 on integrated result. Separate read-only factory-audit plus independent code/security and UX/UI reviews; tag findings by owner. Maximum **two fix rounds**, then needs-human. Optional live-provider test needs existing configuration and approval. No fabricated actors, approvals or Codex receipts for Claude work.
7. T034 ends at maintainer decision: update existing PR14 only through explicitly approved non-destructive integration. Keep PR targets unchanged; flag PR13. Passing guard permits human release review only. No merge, Docker, live DB, curriculum publication or rollout.

## Dependencies and Rollback

See tasks.md for exact IDs/mapping. T010/T011 are the two known Tutor defects. PR11 has two current and four earlier findings needing evidence; three reported fixed regressions need rerun. Full-suite failure/audit findings remain unresolved pending reproduction/triage/maintainer decision. Missing evidence does not imply missing modes.

Inspect status/diff before rollback. Abandoning this uncommitted recovery may remove only its newly created native files, preserving all pre-existing work. Later rollback is limited to job changes in isolated worktrees via reviewed corrective commits or selective restoration from recorded base. Never reset/clean shared work, alter research JSON, drop data or rewrite remote history.

## Execution setup update — 2026-10-25

The user authorized resuming setup and Factory orchestration after this planning document. Active isolated setup checkout is J:/workspace-full/projects/trace/work/issue12-factory, branch codex/issue12-factory at Tutor655ce2f. The transferred native artifacts in this checkout are the resumed copies of this same feature, not a competing specification.

Pinned clean tool at J:/workspace-full/projects/trace/work/project-init-pinned is exactly a96b1ad54f4b026594377aeefd6aa3aa4654d225; direct invocation establishes executable provenance. Both CLI auth checks passed. Installed pinned Factory locally after conflict-free preview. Claude session42cb8c00-be67-4997-af98-cbd604ed58f2 rejected launch at usage limit (reset22:40 Europe/Oslo); no orchestration/model tools/workers ran. This is not a Codex replacement for Claude Factory. Application implementation remains unchanged.

Prepared check/requirement configuration and actual synthetic browser reference candidates locally. They remain unapproved. See evidence/tutor-v2/setup/handoff.md for current gates and resumption; no commit or remote action has occurred.

## Human-directed visual refinement — 2026-10-25

The human accepted the flows but rejected the captured existing UI. Revision02 is a modern visual-only proposal at .project-init/design-v2/index.html: visible mode buttons, clearer reading hierarchy, calm teal/neutral surfaces, focused composer and separate source card, responsive light/dark. It changes no product scope, scoring, controls or source policy. Existing candidate images remain preserved. This new design is pending approval; no application code changed.

After genuine approval, Codex owns T012 in the same Tutor work unit, sequentially with T010/T011. Scope: TutorPanel.tsx, focused LessonPage.tsx layout and Learn style/copy helpers only where necessary, frontend harness and tutor-v2.test.ts browser selectors. Preserve existing APIs, strict locks, privacy, fallback, grade adaptation, five modes and latest-visible-version semantics. Use real reviewed lesson data, no static mock fixture in product. Do not copy the review toolbar or prototype navigation dialogs into the app. Update actual screenshot capture to tutor-refresh case IDs, retaining immutable design references. Review/test the completed implementation independently before acceptance. Claude retains PR11 and serialized integration.

Design02 preview review corrections: persistent mobile back/recovery controls retained; mode switching preserves keyboard focus; pending response disables mode/language/recovery/clear and marks the live log busy. Static preview interaction checks cover these behaviors at both viewports/themes. These are design checks only; corresponding product tests must pass after T012 implementation. A full human screen-reader session remains pending.
