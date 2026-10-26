# Plan

Base source is integrated commit `76f2e9e84e67835750b017fc96700af72be193c9`. Commit this authorized native repair contract before worker branches are created.

Claude owns T035: `backend/src/routes/h5p.ts` and focused H5P route tests. Codex owns T036: backend/frontend manifests and lockfiles, compatible dependency update validation and targeted boundary tests in separate files. Neither worker edits the other's owned source. Any needed overlap is reported to Codex orchestrator before modification.

Use the actual declared production dependency graph. Distinguish runtime packages from `@types` declarations, and distinguish source-observed exposure from demonstrated exploits. Do not remove a dependency based solely on a single search. Do not install into shared/junctioned node_modules.

First run meaningful failing H5P authorization/cleanup regressions, then implement the fix and rerun. Dependency work verifies available registry versions and compatibility before updates, repeats scoped audits, and tests supported flows. Do not perform hostile load tests or weaken timeouts.

Workers return real process logs, diff, test receipts and exact commit IDs to the existing root Factory job report directories. Independent review precedes local integration and final-head checks. The repaired tool and Design03 integration remain separately scoped under T002/T012/T030/T032/T033.
