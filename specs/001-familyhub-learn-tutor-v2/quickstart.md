# Resume and Verification Handoff

## Current Factory instructions — supersede historical instructions below

Use `J:/workspace-full/projects/trace/work/factory-final-integration`, branch `codex/factory-final-integration`, and read its actual HEAD. Codex orchestrates; Claude works in isolated assigned checkouts while quota permits. App-wide light-only and the shown Design03 UI are already approved. Original worktrees and historical evidence remain preserved.

Run the exact Node22.23.4 executable under root `work/factory-dependency-repair/.verification-runtime-node22/node_modules/node/bin/node.exe`. Windows system `npm.cmd` starts its sibling Node24 despite PATH; use this exact Node22 with `J:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js`. Root job002 `codex/run-final.py` records runtime provenance and supplies a scoped npm launcher for nested scripts.

Use the independently tested Project Init CLI at root `work/project-init-light-only/bin/project-init.mjs`, tool commit `ee954bf`, supporting explicit approved theme sets with unchanged comparison thresholds. The integration's missing Spec Kit scaffold was restored by supported preserve-existing `project-init install --version 1.2.3 --agent both --apply`; original global/pinned tools are unchanged. Never copy another checkout's gate receipts.

Actual checks are in `.project-init/config.json`; combined Tutor/Learn/security/lifecycle mappings are authored at `evidence/factory/combined-requirements-input.json`. Mappings identify intended evidence and do not claim passing results. Record exact hashes, executable versions and actual exits for builds, lint, backend APIs, mounted component/page regressions, dependency compatibility, content validation, audits and browser journeys.

For the synthetic real-API Tutor browser journey set `TUTOR_BROWSER_TEST=1`, `TUTOR_PLAYWRIGHT_MODULE` to installed Playwright, `TUTOR_VISUAL_PLAN` to the absolute case plan, and `TUTOR_BROWSER_EVIDENCE` to `.project-init/evidence/final-browser`. The checked-in evidence wrapper supplies these settings. Output under `.project-init` avoids changing source fingerprints during verification. Only disposable loopback services and a fake provider are used; this does not start the persistent authenticated preview the user declined.

Capture light only, desktop1280x800 and phone390x844:26 declared states plus separately labeled hint/practice supplements. Preserve natural viewport dimensions and immutable original-preview references; do not replace references with actual output or relax thresholds. The user's shown-UI approval does not establish pixel equality with the static prototype. Measure retained app chrome, MCQ and other actual differences honestly.

Use supported prepare/baseline/review/approve/source-review/semantic/verify/visual/guard commands with actual independent evidence and existing explicit human approval. Human content/teaching/language and screen-reader review, restored-copy migration evidence, and remaining visual acceptance stay separate. PR13 target/landing choices and any push/merge/deploy/publication remain unapproved external actions. T040/T041 track newly recovered PR13 defects; do not assume old handoff claims closed them.

## Historical handoff — retained for provenance, not current run instructions

Actual path: J:/workspace-full/projects/trace/work/tutor-v2/specs/001-familyhub-learn-tutor-v2. Git branch remains feature/familyhub-learn-tutor-v2; Spec Kit's directory-derived BRANCH output is not a branch change.

Select these artifacts with existing shared runtime without moving its feature pointer:

```powershell
$env:SPECIFY_INIT_DIR='J:/workspace-full/projects/trace'
$env:SPECIFY_FEATURE_DIRECTORY='J:/workspace-full/projects/trace/work/tutor-v2/specs/001-familyhub-learn-tutor-v2'
$env:SPECIFY_FEATURE_NO_PERSIST='1'
& "$env:SPECIFY_INIT_DIR/.specify/scripts/powershell/check-prerequisites.ps1" -Json -RequireTasks -IncludeTasks
```

Before Factory, transfer/register these same artifacts in approved orchestration/integration checkout and select that path explicitly. Do not invent another number or assume uncommitted files travel to worktrees. See plan.md handoff; no job launched here.

## Future Named Checks — Not Run Receipts

Configure actual argv in execution checkout's .project-init/config.json after provenance/baseline setup. Use npm in pinned check argv: its validator rejects npm.cmd and its Windows runner resolves npm internally; cwd integration root. Save exact commit/source hash, commands, exit codes, logs and runtime/dependency versions.

| Check | Command/purpose |
| --- | --- |
| backend-build | npm run build --prefix backend |
| frontend-build | npm run build --prefix frontend |
| tutor-api | npm test --prefix backend -- --run src/test/tutor-v2.test.ts --reporter=verbose |
| backend-suite | npm test --prefix backend -- --run --reporter=verbose |
| tutor-browser | Tutor command with TUTOR_BROWSER_TEST=1 and installed TUTOR_PLAYWRIGHT_MODULE; record Edge version and ensure browser isn't skipped |
| backend-audit | npm audit --prefix backend --workspaces=false --json; retain failure, triage reachability/severity |
| frontend-audit | npm audit --prefix frontend --workspaces=false --json; preserve/comparatively triage findings |
| diff-check | git diff --check plus reviewed integration-vs-dependency diff |

Reproduce Sunday suite failure on base/head under same environment/time zone/clock; do not change system time. Use a scoped deterministic test-clock approach if needed, recording it on both refs. No failure suppression/live data.

Browser: Grade3 Explain/source focus → wrong existing scored practice → hints → guided practice → formative understanding → verified Next Step → English/recovery. Cover disabled/quota/provider-down/assessment states. Capture both themes at1280×900 and390×844 and approved states. Human screen-reader/teaching-quality review is separate.

Use pinned baseline/review/approve, verify --execute, semantic import, visual compare, source-review, guard/status lifecycle with genuine actors/evidence; confirm syntax with pinned help. Never fabricate receipts or treat handoff as run. Optional live-provider smoke needs existing configuration and approval; skipped means unverified.
