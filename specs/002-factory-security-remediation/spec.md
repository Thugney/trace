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

Use isolated Git worktrees from the reviewed committed base. No production data, secrets, live-provider calls, changes to PRs, push, merge to user branches or deployment. Code/lockfile integration occurs only after independent review. Do not copy Project Init approval/state files; use its supported commands and genuine source/human evidence. Keep all root and Tutor dirty files untouched.
