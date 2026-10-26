# Resume and Verification Handoff

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
