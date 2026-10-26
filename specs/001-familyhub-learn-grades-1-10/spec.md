# Feature: FamilyHub Learn Grades 1-10 — coordination scope (PR11)

## Current integration amendment — 2026-10-26

The current local verification checkout is `work/factory-final-integration`, coordinated by Codex under the user's explicit Factory-wide instruction. Its actual commit and job reports supersede historical workspace/owner pointers below. Missing native documents were restored with provenance; Spec Kit was installed through its supported preserve-existing workflow. No gate approval receipt was copied.

The user settled light-only across the app. Historical requirement identifier `LK20-RESPONSIVE-DARK-MODE-SMOKE` is retained for traceability, but its current scope is light-mode responsive behavior, including no device-dark activation. This supersedes the former dark-mode demand without claiming new UI approval. Teaching/content and screen-reader acceptance remain separate.

All ten live PR13 findings were reconciled against current source: seven defects are tracked as SEC-006 through SEC-011 and T040/T041 in the shared security feature; three were already addressed. The older claim that no other open PR carried findings is retired. Its target/landing decision remains separate from these authorized local fixes.

Recorded 2026-10-26 (UTC) in the root checkout `J:/workspace-full/projects/trace`, branch
`feature/familyhub-learn-grades-1-10`.

## This file is not a new product specification

The authoritative specification for this scope is, and remains,
`docs/learn/GRADES1-10-CODEX-CLAUDE-IMPORT-CONTRACT.md`. Its section 5 preservation rules and
section 6 validation contract own the acceptance criteria, and the mapped requirement identifiers
in `.project-init/requirements.json` are derived from that document, not from this one.

This directory exists for one reason: Project Init's spec-kit feature resolution only reads a task
ledger from a native feature directory (`specs/<feature>/tasks.md`). With the scope recorded as
explicit spec paths alone, `handoff` and `prepare` report `tasks: null` and `remainingTasks: []`
with no owner, which is what hid the cross-owner coordination state. The contract is kept in the
selected scope alongside this file so that the task ledger becomes readable without replacing the
contract as the authority.

No product requirement, acceptance criterion, design decision or approval is created, widened or
restated here. Nothing in this directory authorizes merge, retarget, deployment, production writes
or lesson publication.

## Scope boundary

In scope for this feature directory:

- the cross-owner task ledger in `tasks.md`
- the shared-file serialization and integration order in `plan.md`
- ownership, workspace and evidence pointers for the open work

Out of scope here:

- Tutor 2.0, whose authoritative native feature is
  `specs/001-familyhub-learn-tutor-v2` in the Codex checkout
  `J:/workspace-full/projects/trace/work/issue12-factory`, with registered baseline
  `d62ed248cd35608e6c11d653ae982e9a8760920c7241debc21bf86653920b52a`. That baseline, its approval
  receipt, its design files and its immutable reference screenshots are unchanged by this
  directory and must stay unchanged.
- the curriculum research and source register under `docs/learn/`, which remain as published

## Owners

Codex owns Tutor (PR14) and the remaining Tutor verification, in
`work/issue12-factory` on `codex/issue12-factory`.

Claude owns PR11 remediation and coordinates serialized reconciliation, in this root checkout and
in the PR15/PR16 fix worktrees.

Neither owner edits the other's checkout, and no second writer touches a shared file while its
named owner holds it.

## Pull request targets, unchanged

| Pull request | Head | Base |
| --- | --- | --- |
| 11 | feature/familyhub-learn-grades-1-10 | docs/lk20-grade8-source-research-20261024 |
| 14 | feature/familyhub-learn-tutor-v2 | feature/familyhub-learn-grades-1-10 |
| 15 | fix/learn-assessment-key-leaks | feature/familyhub-learn-grades-1-10 |
| 16 | fix/learn-numeric-grade-gate-for-younger-pupils | feature/familyhub-learn-grades-1-10 |

Pull request 13 carries the same head as 14 against base `dev`. It is a known target mismatch,
recorded for the maintainer's explicit decision, and is not acted on here.
