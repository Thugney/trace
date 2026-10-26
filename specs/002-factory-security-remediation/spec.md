# Shared security repairs for the existing Factory

This bounded implementation scope belongs to existing root Factory job `002-learn-grades-1-10-remediation-and`, resolving T031 findings from Tutor job001. The human explicitly directed Codex on 2026-10-26 to continue the Factory, fix blockers with Claude, and complete all Factory tasks without routine confirmation. This authorizes local implementation and verification; it does not accept unresolved risk or authorize remote publication or deployment.

No UI changes are in this feature. FamilyHub's app-wide light-only decision remains fixed. The separately approved Design03 source and existing integration checkout are preserved.

## Requirements

- **SEC-001** H5P library upload and content import must reject a non-parent/non-admin before multipart parsing, file creation, or H5P initialization; preserve login and activities-feature authorization.
- **SEC-002** Allowed H5P uploads must have bounded file/field/part counts and cleanup on success, rejection, initialization/import failure, and aborted/malformed uploads. Preserve the existing accepted 100 MB file size and parent/admin workflows.
- **SEC-003** Resolve reachable HTTP parser/compression/upload dependency advisories using supported compatible versions and exact lockfile evidence. No forced blanket upgrades, disabled checks, or unexplained package removals.
- **SEC-004** Preserve authorization, proxy-aware rate limits, Learn/Tutor behavior and existing upload workflows. Verify meaningful regressions and both backend/frontend builds where affected.
- **SEC-005** Record fresh full/production audit results, exact source/dependency identity, independent review and any residual conditional exposure. No remaining risk is implicitly accepted.

- **QUAL-001** The already-configured frontend lint command must execute under ESLint9 with real compiler-aligned correctness and React Hooks checks. Fix reported lifecycle/dependency defects while preserving intended fetch, reset, poll, timer and submission behavior. No empty config, source exclusion, broad suppression, relaxed warning threshold or new unrelated style policy.

## Boundaries

## PR13 findings recovered during T034 reconciliation

The live PR13 review read on 2026-10-26 disproved the old handoff's claim that only PR11 carried findings. Independent current-source triage identifies these remaining defects. Repairing them is covered by the human's instruction to fix all Factory blockers; it does not authorize changing PR13's target or remote state.

- **SEC-006** A learner's practice-session response must omit correct answers and answer explanations until authorized submission/feedback. Preserve teacher/parent management access and assessment locks.
- **SEC-007** Feature enforcement must preserve intended Learn practice for school/Learn-enabled users and the existing consolidated quizzes entry point for quizzes-enabled users, while keeping unrelated activities inaccessible when disabled. Object ownership, role checks and H5P upload restrictions remain mandatory.
- **SEC-008** A child updating their own task must not remove or weaken parent-set completion requirements, timer/proof policy or other protected task fields. Preserve the intended child completion workflow and parent/admin editing.
- **SEC-009** Failed Learn practice must not repeatedly award points. Rewards remain tied to the documented passing condition and idempotent once-only successful credit.
- **SEC-010** Assignment completion must compare actual submission/assignment timestamps chronologically, including SQLite space-separated and ISO T-separated representations on the same day, for review papers and mock exams.
- **SEC-011** Visible lessons select the highest reviewed/published version for each slug/locale before presentation sorting. A newer version's changed sort_order must not cause an older lesson and its practice history to win.

## Boundaries (continued)

Use isolated Git worktrees from the reviewed committed base. No production data, secrets, live-provider calls, changes to PRs, push, merge to user branches or deployment. Code/lockfile integration occurs only after independent review. Do not copy Project Init approval/state files; use its supported commands and genuine source/human evidence. Keep all root and Tutor dirty files untouched.
