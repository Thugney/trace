# Evidence Reconciliation and Decisions

Date: 2026-10-25. Sources: Issue12 current contract; PR14 body/review at 655ce2f; PR11 threads through 052e8ae; local guide/receipts/source/tooling. Engineering reconciliation, not curriculum research.

| Decision | Evidence/reason | Alternative rejected |
| --- | --- | --- |
| Preserve implementation | Five modes, parsing, fallback, grades/locales, controls, ranking, real-page harness exist | Rebuild because approvals/native docs are missing |
| Fail closed on unrelated questions | PR14: zero-score sections still selected; supported=true and valid index accept fabricated content | Model support flag as semantic verification |
| Reuse visible-version semantics | catalog.ts:getVisibleLessons filters visibility before latest per slug/locale; Tutor queries all reviewed rows | Duplicated visibility logic/stale version ranking |
| Separate PR11 dependency | Claude owns assessment/import/catalog fixes | Editing Claude's branch or assuming resolution |
| Recover native documents | Spec Kit installed, no feature artifacts found; user permits recovery | Another PRD or fresh scope |
| Block pinned execution | Checkout SHA differs, required object absent, CLI equivalence unverified | Version string as source-SHA proof |

## Historical Evidence, Not Current Acceptance

evidence/tutor-v2/backend-build.log and frontend-build.log report successful builds. tutor-browser-tests.log: 25 passing Tutor cases including browser. backend-full-tests.log: 174 passed, 1 failed, 1 optional browser skipped (176). gamification.test.ts:149 expected one weekly task, got zero on Sunday2026-10-25. Original explanation attributes this to a Friday fixture outside a Sunday-start week. Matched base/head reruns have **not** established it; baseline-only is not PASS/risk acceptance.

backend-audit.json: 31 findings (3 critical,17 high,10 moderate,1 low), historically inherited; current comparison/reachability/severity remain untriaged. No blanket upgrades or inferred acceptance.

desktop-light.png1280×900 and mobile-dark.png390×844 are candidate screenshots. Missing desktop-dark/mobile-light, approved state matrix, human screen-reader and teaching-quality review. Fake providers were exercised, not live correctness. Reviewed synthetic fixtures demonstrate plumbing, not full curriculum coverage/publication approval.

Original locked backend install used --ignore-scripts because Node24/Windows SDK could not build SQLite; reused existing host native binary. Frontend used a shared dependency junction. Record/resolve reproducibility limitations before current verification. Manifests/locks were unchanged.

## PR11 Evidence Checklist — Claude Owner

- Current: expired first submission exposes answers during another active attempt; draft refresh overwrites published topic title/summary.
- Earlier, not presumed resolved: current curriculum-code consistency across restart/catalog/topic; direct-topic draft disclosure; import dry-run side effects; atomic/idempotent rewards and late-submission policy.
- Reported fixed in 383993d, rerun after integration: existing activity-session answer/start/submit lock; prior-attempt feedback/submitted-retry lock; source links with newer draft/retired versions.

PR14 independent review requests changes. It is not an all-pass security/UX audit. This planning turn claims no fresh CI or application test execution.
