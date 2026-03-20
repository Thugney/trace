# Synology Operations Runbook

Last updated: 2026-03-20

This runbook documents the current live Trace deployment on Synology, the fixes deployed during the 2026-03-20 work session, and the safe workflow for operating or deploying the NAS copy without overwriting live-only commits.

## Current Live State

- Synology SSH host: `192.168.1.135`
- SSH port: `41`
- SSH user: `Robel`
- Live repo path: `/volume2/docker/trace`
- Live branch: `feature/school-leaderboard`
- Current live app commit: `b7a6b5d`
- Current live branch tip:
  - `b7a6b5d` `fix: harden book generator and prompt flow`
  - `e37027b` `fix: align live settings pages`
  - `dadf3ae` `feat: improve settings about experience`
  - `ce410d1` `fix: harden family controls and admin access`
  - `6955d2c` `fix: correct family leaderboard periods and scope`
  - `e2316ad` `docs: update synology operations runbook`
  - `6c97b08` `fix: restore authorization support for live branch`
  - `7567528` `fix: preserve reward shop and archived task behavior`
  - `920b64a` `fix: harden family controls and reward goal flows`
  - `d763d9f` `fix: enforce task timers and harden pwa push delivery`
- Safety backup branches created during deployment:
  - `backup/pre-deploy-20260320-1534`
  - `backup/pre-deploy-20260320-1736`
  - `backup/pre-deploy-20260320-2000`
  - `backup/pre-deploy-20260320-2123`
- Backend container: `family-learning-backend`
- Frontend container: `family-pwa-frontend`
- Backend health endpoint: `http://localhost:3001/health`
- Docker binary on Synology: `/usr/local/bin/docker`
- Docker access for this user requires `sudo`

Do not store the SSH password in git. Keep it in the user's password manager or another out-of-band secret store.

## What Was Fixed

### 1. Timed task completion

- Timed tasks now enforce the configured task duration instead of allowing completion after about 1 minute.
- Example: a task created with `15` minutes now blocks completion until `900` seconds have elapsed.
- Main code paths:
  - `backend/src/routes/tasks.ts`
  - `backend/src/services/taskTimer.ts`
  - `frontend/src/components/TaskTimerCard.tsx`

### 2. Real PWA push delivery

- Installed PWA devices now use the real push flow instead of depending only on in-app display notifications.
- Push subscriptions are tracked per `profile_id + endpoint`, which fixes shared-device cases where one child could overwrite another child's subscription.
- Unsubscribing one child from a shared device no longer removes push for another child still linked to that endpoint.
- Notification writes were aligned with the current database schema (`data` instead of the broken `metadata` path).
- Scheduler date handling was normalized so due and scheduled reminders evaluate correctly against local date logic.
- Main code paths:
  - `backend/src/services/notifications.ts`
  - `backend/src/routes/notifications.ts`
  - `backend/src/services/scheduler.ts`
  - `frontend/src/hooks/usePushNotifications.ts`
  - `frontend/src/sw.ts`

### 3. Startup/runtime fixes found during validation

- Local and deployed startup had migration/index ordering problems:
  - `tasks.parent_approved` index was being created before the column existed
  - `profiles.parent_id` index was being created before the column existed
- Those init-order bugs were corrected in `backend/src/database/init.ts`.

### 4. Goal approval visibility and family access

- Goal approval review now uses family-aware access rules instead of only the legacy direct `parent_id` check.
- Result: a parent or co-parent can receive the notification and also see the pending goal request in the approval view.
- The same family-access fix was also applied to related approval flows so parent controls stay consistent.
- Main code paths:
  - `backend/src/services/familyAccess.ts`
  - `backend/src/routes/goals.ts`
  - `backend/src/routes/tasks.ts`
  - `backend/src/routes/profiles.ts`
  - `backend/src/routes/gamification.ts`
  - `backend/src/routes/rewards.ts`

### 5. Reward categories, goal templates, and custom goal requests

- Reward categories are deduped across default and family-created entries.
- Parents can create custom reward categories without repeated values like multiple `screen_time` or `settings` entries.
- Goal templates are deduped across system and family scope.
- Kids can request goals with their own custom goal type and custom goal category instead of being limited to predefined values only.
- Parent pending-goal review correctly shows those custom child-submitted requests.
- Main code paths:
  - `backend/src/routes/rewards.ts`
  - `backend/src/routes/goals.ts`
  - `backend/src/database/init.ts`
  - `frontend/src/components/RewardManagement.tsx`
  - `frontend/src/pages/TasksManager.tsx`
  - `frontend/src/services/api.ts`

### 6. Reward shop balance, stars, stock, and task archive behavior

- Reward shop kept the live star-discount behavior while also using the corrected family-safe and spent-balance-safe backend.
- Reward purchases now:
  - calculate point cost from the latest `total_points`
  - support `stars_spent`
  - reduce stock at purchase time
  - restore stock if the claim is later rejected
- Child task deletion now archives the task instead of hard-deleting it, preserving habit and history data.
- Archived tasks are excluded from normal task lists, parent pending review, and child stats unless explicitly requested.
- Existing databases now auto-add `tasks.deleted_at` and `tasks.deleted_by` on startup.
- Main code paths:
  - `backend/src/routes/rewards.ts`
  - `backend/src/routes/tasks.ts`
  - `backend/src/routes/profiles.ts`
  - `backend/src/database/init.ts`
  - `backend/src/database/migrations/production-ready.ts`

### 7. Family leaderboard accuracy

- Family leaderboard now includes legacy child profiles correctly instead of omitting children that still rely on `parent_id`.
- `week`, `month`, and `all time` calculations were corrected so the family leaderboard reflects the intended period windows.
- The UI now makes it clear that points are period-based, while levels and stars are lifetime/current totals.
- Main code paths:
  - `backend/src/services/familyAccess.ts`
  - `backend/src/routes/gamification.ts`
  - `frontend/src/pages/FamilyLeaderboard.tsx`

### 8. Parent point management and economy control

- Parent point adjustments now validate the selected child and related task correctly.
- Point adjustments use the actual awarded amount for responses, audit data, and notifications.
- Economy settings updates are limited to valid child profiles and invalid numeric input no longer pollutes saved settings.
- Latest-progress lookups were stabilized so fast back-to-back updates do not show stale totals.
- Main code paths:
  - `backend/src/routes/gamification.ts`
  - `backend/src/services/economyControl.ts`
  - `frontend/src/components/PointsManagement.tsx`
  - `frontend/src/components/EconomySettings.tsx`

### 9. Admin feature-control reliability

- Admin and parent feature toggles are now evaluated through one shared backend path instead of multiple drifting checks.
- Startup no longer backfills feature state in a way that re-enables disabled functionality after container restart.
- Frontend feature state no longer fails open when the backend is briefly unavailable.
- The active child profile refreshes feature flags such as `ai_enabled` consistently after restart.
- Main code paths:
  - `backend/src/services/profileFeatures.ts`
  - `backend/src/middleware/feature-access.ts`
  - `backend/src/routes/profiles.ts`
  - `backend/src/database/init.ts`
  - `frontend/src/context/ProfileFeaturesContext.tsx`
  - `frontend/src/context/ProfileContext.tsx`

### 10. Settings and About experience

- Settings now exposes a real `About` section instead of leaving ownership and app purpose unclear.
- Settings navigation was cleaned up so sections read like intentional app settings instead of rough internal tabs.
- Owner, website, and version information now appear in the settings shell and child settings.
- Frontend version display now comes from the actual frontend package version instead of a hardcoded string.
- Main code paths:
  - `frontend/src/components/settings/AboutSection.tsx`
  - `frontend/src/components/settings/ChildSettings.tsx`
  - `frontend/src/components/settings/SettingsLayout.tsx`
  - `frontend/src/pages/Settings.tsx`
  - `frontend/src/version.ts`

### 11. Book generator hardening and prompt flow

- The book generator backend no longer trusts client-supplied profile IDs, book job IDs, or profile-specific settings access.
- Book generation jobs now belong to the authenticated creator, and job status cannot be polled by another profile.
- Book instructions, reading progress, notes, feedback, and book access now enforce family/profile authorization rules.
- Failed AI book jobs no longer count as successful AI usage, so book limits and cost tracking stay accurate.
- Prompt handling is more deterministic:
  - educational detection respects the selected genre instead of only keyword matching
  - prompt and instruction inputs are normalized before reaching the AI
  - the generated page list is cleaned and capped to the requested page count
- The frontend book creator now uses a guided prompt builder with:
  - concise core idea entry
  - optional character, setting, lesson, must-include, and avoid fields
  - language selection
  - a live "Prompt Sent To AI" preview
  - input length limits
- The child assignment list now uses the family-scoped profiles API response directly instead of a bad legacy filter.
- Main code paths:
  - `backend/src/routes/books.ts`
  - `backend/src/test/books.test.ts`
  - `backend/src/test/setup.ts`
  - `frontend/src/pages/BookLibrary.tsx`

## Local Source Control State

- Clean development branch: `feature/trace-timer-push-fixes`
- Pushed GitHub branch: `origin/feature/trace-timer-push-fixes`
- Relevant pushed GitHub commits:
  - `1e1f960` `fix: enforce task timers and harden pwa push delivery`
  - `5a705fb` `fix: harden family controls and reward goal flows`
  - `b7a5c4b` `fix: preserve reward shop and archived task behavior`
  - `6460349` `docs: update synology operations runbook`
  - `2c8bc9c` `fix: correct family leaderboard periods and scope`
  - `3993024` `fix: harden family controls and admin access`
  - `667c252` `feat: improve settings about experience`
  - `3e6a2ed` `fix: harden book generator and prompt flow`

## Deployment Mapping

The live Synology branch was not replaced with a normal `git pull` because it had live-only commits and branch drift. Safe deployment was done by fetching the validated feature branch and cherry-picking onto the live branch.

Source commit to deployed live commit mapping on 2026-03-20:

- `1e1f960` -> `d763d9f`
- `5a705fb` -> `920b64a`
- `b7a5c4b` -> `7567528`
- live-only compatibility commit -> `6c97b08`
- `6460349` -> `e2316ad`
- `2c8bc9c` -> `6955d2c`
- `3993024` -> `ce410d1`
- `667c252` -> `dadf3ae`
- live-only settings alignment commit -> `e37027b`
- `3e6a2ed` -> `b7a6b5d`

This preserves all live-only behavior already in use.

## SSH And Repo Operation

### Connect

```powershell
ssh -p 41 Robel@192.168.1.135
```

After connecting:

```sh
cd /volume2/docker/trace
```

Useful git commands:

```sh
git status --short
git branch --show-current
git log --oneline --decorate -5
git fetch origin
```

Known SSH note:

- User-provided port `42` was not the working SSH port.
- Actual working SSH port for this Synology host is `41`.
- Confirmed host key fingerprint:
  - `ssh-ed25519 255 SHA256:QA9zOfDa5lOGRldGrmDmEYN4kfRRq/SnvhW9nZumm5Y`

## Docker Operation On Synology

`docker` is not on the normal PATH for this user, so use `/usr/local/bin/docker` when needed.

This user also needs `sudo` to access Docker.

### Check containers

```sh
sudo /usr/local/bin/docker compose ps
```

### Rebuild and restart

```sh
sudo /usr/local/bin/docker compose up --build -d
```

### Check backend health

```sh
curl -s http://localhost:3001/health
```

### Tail logs

```sh
sudo /usr/local/bin/docker compose logs --tail=100 backend
sudo /usr/local/bin/docker compose logs --tail=100 frontend
```

## Safe Deploy Procedure

Use this when the live Synology branch has local commits and should not be replaced by a blunt `git pull`.

### 1. Check current live state

```sh
cd /volume2/docker/trace
git status --short
git log --oneline --decorate -5
```

### 2. Create a safety branch before deployment

```sh
git branch backup/pre-deploy-YYYYMMDD-HHMM
```

### 3. Fetch the fix branch from origin

```sh
git fetch origin feature/trace-timer-push-fixes
```

### 4. Cherry-pick the verified fix commit onto the live branch

```sh
git cherry-pick <commit-sha>
```

### 5. If a conflict appears

- Stop and inspect it.
- Do not hard reset the live branch.
- Prefer keeping live-only behavior if the live branch already has working production logic not present in the GitHub feature branch.
- Resolve conflicts locally when needed, then continue the cherry-pick and keep the live branch clean with a real commit.

Conflicts encountered during the 2026-03-20 deployments included:

- `frontend/src/components/NotificationSetup.tsx`
  - already deleted on the live branch and no longer referenced, so the deletion was kept
- `backend/src/routes/gamification.ts`
- `backend/src/routes/profiles.ts`
- `backend/src/routes/rewards.ts`
- `backend/src/routes/tasks.ts`
- `backend/src/services/economyControl.ts`
- `frontend/src/components/settings/SettingsLayout.tsx`
- `frontend/src/version.ts`
- `frontend/src/pages/BookLibrary.tsx`

Important live-only behavior preserved during conflict resolution:

- reward star tiers and star-discount behavior
- reward stock decrement and restore behavior
- child-task archive behavior using `deleted_at`
- live branch authorization support required by the merged profiles routes
- live settings file alignment needed for the settings/about deploy to compile cleanly on Synology

### 6. Rebuild Docker

```sh
sudo /usr/local/bin/docker compose up --build -d
```

### 7. Verify

```sh
git status --short
sudo /usr/local/bin/docker compose ps
curl -s http://localhost:3001/health
```

## Validation Completed On 2026-03-20

Validated locally before deploy:

- Docker build succeeded for frontend and backend.
- Full backend test suite passed:
  - `15` files
  - `54` tests
- Timer enforcement verified through the live API:
  - 15-minute task reported `required_seconds = 900`
  - early finish returned `MINIMUM_TIME_NOT_MET`
  - completion succeeded only after full elapsed time
- Push flow verified locally:
  - subscription saved
  - notification record stored correctly
  - shared-device endpoint remained active for child B after child A unsubscribed
- Reward and goal validation verified locally:
  - reward categories returned deduped values with no repeated `screen_time`
  - custom reward category creation worked and duplicate family category creation was rejected
  - child-created custom goal request stored the custom `goal_type` and `goal_category`
  - pending goal review showed the child request to the parent/co-parent
- Task archive validation verified locally:
  - deleting a child task returned `soft_deleted: true`
  - archived task remained in the database with `deleted_at` and `deleted_by`
- Book generator validation verified locally:
  - book route authorization tests passed
  - prompt-builder UI compiled in the frontend production build
  - guided prompt preview and language selection were included in the generated request flow

Validated on Synology after deploy:

- live branch now at `b7a6b5d`
- backend container up
- frontend container up
- `curl http://localhost:3001/health` returned `status: ok`

## Live Branch Drift Found During Deployment

The Synology branch is not a clean mirror of GitHub. During deployment, the live branch required extra compatibility or cleanup commits:

- `6c97b08` `fix: restore authorization support for live branch`
- `e37027b` `fix: align live settings pages`

Operational rule:

- if the Synology branch compiles differently from the validated GitHub branch, document the drift explicitly and keep the live branch clean with a commit instead of leaving manual server-only edits behind

## Notes For Future Work

- If push still fails on a real phone after these deployments, inspect:
  - browser notification permission on the installed PWA
  - active rows in `push_subscriptions`
  - backend logs during the reminder window
  - service worker registration/update state on the device
- Book generation quality still depends on the configured AI provider and keys. The routing, prompt handling, and authorization were validated; provider-specific output quality should still be spot-checked from a real parent device.
- Do not assume a plain `git pull` is safe on Synology unless the live branch has first been reconciled with its local-only commits.
