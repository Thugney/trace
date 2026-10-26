# Plan

Base source is integrated commit `76f2e9e84e67835750b017fc96700af72be193c9`. Commit this authorized native repair contract before worker branches are created.

Claude owns T035: `backend/src/routes/h5p.ts` and focused H5P route tests. Codex owns T036: backend/frontend manifests and lockfiles, compatible dependency update validation and targeted boundary tests in separate files. Neither worker edits the other's owned source. Any needed overlap is reported to Codex orchestrator before modification.

Use the actual declared production dependency graph. Distinguish runtime packages from `@types` declarations, and distinguish source-observed exposure from demonstrated exploits. Do not remove a dependency based solely on a single search. Do not install into shared/junctioned node_modules.

First run meaningful failing H5P authorization/cleanup regressions, then implement the fix and rerun. Dependency work verifies available registry versions and compatibility before updates, repeats scoped audits, and tests supported flows. Do not perform hostile load tests or weaken timeouts.

Workers return real process logs, diff, test receipts and exact commit IDs to the existing root Factory job report directories. Independent review precedes local integration and final-head checks. The repaired tool and Design03 integration remain separately scoped under T002/T012/T030/T032/T033.

## T036 compatibility adjustments, authorized by the orchestrator

Use patched Vitest 4.1.12 with Vite 6.4.5, minimizing test-runner migration changes. The first verification matched the old Docker Node 20 runtime, but the independent orchestrator correctly identified that Node 20 is now EOL. Node 20 results remain historical compatibility evidence only. Modernize both Node Docker stages to the verified official Node 22.23.4 Alpine tag/digest and align the root engine floor to 22.23.4. Clean-install and retest with an isolated Node 22.23.4 runtime, including native SQLite. Verify node-cron 4's unchanged scheduled-callback API and sharp 0.35's actual SVG-to-PNG pipeline. React Router 7.18.4 retains the app's declarative API; validate type/build output plus navigation/links rather than assuming success from installation. The browser integration journey is still an orchestrator check.

The unused h5p-express adapter is removed after a repository-wide usage search; the app imports h5p-server directly and keeps its custom routes. H5P's image-size v1 dependency is replaced by a transparently named local compatibility adapter in `backend/vendor/image-size-compat`, delegating parsing to genuine patched image-size 2.0.4. Preserve synchronous buffers and bounded file-path reads. The backend Dockerfile copies the adapter before npm ci. Test actual H5P dependency resolution, malformed input and descriptor cleanup. Scoped JSONPath/Underscore patch override preserves its major API.

Two Axios header consumers (`backend/src/routes/books.ts` and `family-quizzes.ts`) explicitly narrow Content-Type to string, retaining their existing JPEG fallback. No route, authorization or provider behavior is widened. Express declarations match the actual Express 4 runtime rather than the previously mismatched major 5 types. These additional owned paths and narrow changes were explicitly authorized by the Codex orchestrator before edits.

Declare frontend `@eslint/js` 9.39.5 and `globals` 14 as direct development dependencies for the separately owned T038 ESLint 9 flat configuration. These match the existing resolved packages; the dependency worker owns only their manifest/lock declarations, and the lint worker owns configuration/source repairs.

## T040 quota takeover and necessary feedback contract

Claude's actual T040 process hit its session usage limit before source edits (reset1am Europe/Oslo). The user's explicit standing fallback transfers this work to Codex in `work/factory-pr13-authorization`; no further Claude retries before reset. Original process evidence and takeover record remain in the root job.

Independent current-source inspection shows activity renderers consume `activity.correct_data` when displaying feedback. SEC-006 therefore requires a coordinated narrow frontend companion: `frontend/src/types/activities.ts` and the actual MultipleChoice/FillBlanks/Matching/Sorting activity renderers (another renderer only if the same traced dependency exists), plus rendered feedback regressions. Learner session payloads omit keys/explanations before submission; submitted, authorized feedback carries the necessary correct-answer data. Preserve authoring/admin access and do not crash the feedback UI when pre-submit keys are absent.

The T040 worker first incorporates reviewed T038 component commit8528de0 and T041 learning commitb99072f, then owns these companion files exclusively. No parallel writer may alter them. Final combined tests must prove pre-submit secrecy, post-submit correct/try-again rendering, assessment locks, first-pass once-only rewards and ordinary unrelated activity behavior. These are necessary correctness changes within the existing security requirement, not new product scope.
