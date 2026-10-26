# Plan: serialized reconciliation for FamilyHub Learn Grades 1-10

Companion to `spec.md`. The authoritative specification remains
`docs/learn/GRADES1-10-CODEX-CLAUDE-IMPORT-CONTRACT.md`.

## Workspaces

| Owner | Workspace | Branch | Head |
| --- | --- | --- | --- |
| Claude, PR11 and coordination | J:/workspace-full/projects/trace | feature/familyhub-learn-grades-1-10 | 052e8ae |
| Claude, PR15 fix | .claude/worktrees/new-session-f4a430 | fix/learn-assessment-key-leaks | cbc31b4 |
| Claude, PR16 fix | .claude/worktrees/elastic-goldberg-0b25fa | fix/learn-numeric-grade-gate-for-younger-pupils | 56be260 |
| Codex, Tutor | work/issue12-factory | codex/issue12-factory | 0eaee93 |
| reserved for integration | work/tutor-grade-reconcile | integration/tutor-v2-and-grade-gate | 9b5c55a |

`work/tutor-v2` sits one commit behind at 655ce2f and is historical; the pushed Tutor head is
0eaee93 in `work/issue12-factory`. Do not take 655ce2f for the current Tutor state.

## Shared files, one writer at a time

These paths carry fixes from more than one pull request and must never be edited by two workers at
once:

- backend/src/routes/learn.ts
- backend/src/services/learn/assessmentLock.ts
- backend/src/services/learn/contentImport.ts
- backend/src/services/learn/catalog.ts
- backend/src/test/learn-grades.test.ts
- backend/src/test/learn.test.ts
- frontend/src/types/learn.ts
- dependency manifests and lockfiles

The integration owner is Claude. Codex supplies Tutor commits and does not edit these paths
outside its own Tutor files. On a conflict, work stops and the conflict is named rather than
resolved by whoever happens to hold the file.

## Integration order

Reconciliation is serialized, in this order, into `work/tutor-grade-reconcile`:

1. PR11 remediation completes on `feature/familyhub-learn-grades-1-10` (the base the other three
   share).
2. PR15 at cbc31b4 and PR16 at 56be260 reconcile onto that base. Both touch the assessment lock
   and Learn routes; PR15's fixes are reused as they stand and are never rebuilt or overwritten.
3. Tutor at 0eaee93 reconciles last. The Tutor head has not integrated PR15 and does not touch
   PR15's routes, assessment lock, importer or shared tests.
4. Integrated verification reruns on the single reconciled head, under one recorded environment
   and clock.

Each step refreshes remote heads first. No step merges, pushes, retargets or deploys; every
pull request keeps the target recorded in `spec.md`.

## Evidence rules carried into integration

- Any source, spec or baseline change invalidates the evidence that covered it and requires a
  rerun, not a restated receipt.
- Receipts from a previous head are labelled with the head they came from.
- Reviewed-existing-code evidence is labelled as such and never presented as an implementation run.
- Human approval stays human approval: screenshot coverage, test names and mapping tables do not
  substitute for it.
