# Synology Operations Runbook

Last updated: 2026-03-20

This runbook documents the current live Trace deployment on Synology, what was changed across the recent timer, push, family-control, reward, and goal fixes, and the safest way to operate or deploy the app without overwriting live-only commits.

## Current Live State

- Synology SSH host: `192.168.1.135`
- SSH port: `41`
- SSH user: `Robel`
- Live repo path: `/volume2/docker/trace`
- Live branch: `feature/school-leaderboard`
- Current live app commit: `6c97b08`
- Current feature commits deployed on top of the older live branch:
  - `920b64a` `fix: harden family controls and reward goal flows`
  - `7567528` `fix: preserve reward shop and archived task behavior`
  - `6c97b08` `fix: restore authorization support for live branch`
- Older timer/push deploy baseline still in branch history: `d763d9f`
- Safety backup branch created before deploy: `backup/pre-deploy-20260320-1534`
- Second safety backup branch created before reward/goal deploy: `backup/pre-deploy-20260320-1736`
- Backend container: `family-learning-backend`
- Frontend container: `family-pwa-frontend`
- Backend health endpoint: `http://localhost:3001/health`
- Docker binary on Synology: `/usr/local/bin/docker`
- Docker access for this user requires `sudo`

Do not store the SSH password in git. Keep it in the user's password manager or other out-of-band secret storage.

## What Was Fixed

### 1. Timed task completion

- Timed tasks now enforce the configured task duration instead of allowing completion after about 1 minute.
- Example: a task created with `15` minutes now blocks completion until `900` seconds have elapsed.
- Main code paths:
  - `backend/src/routes/tasks.ts`
  - `backend/src/services/taskTimer.ts`
  - `frontend/src/components/TaskTimerCard.tsx`

### 2. Real PWA push delivery

- The notification flow was hardened so installed PWA devices can receive real push notifications instead of only relying on in-app display.
- Push subscriptions are now tracked per `profile_id + endpoint`, which fixes shared-device cases where one child could overwrite another child's subscription.
- Unsubscribing one child from a shared device no longer removes push for another child still using that same endpoint.
- Notification writes were aligned with the current database schema (`data` column instead of the broken `metadata` path).
- Scheduler date handling was normalized so due/scheduled reminders evaluate against local date logic instead of UTC-only string comparisons.
- Main code paths:
  - `backend/src/services/notifications.ts`
  - `backend/src/routes/notifications.ts`
  - `backend/src/services/scheduler.ts`
  - `frontend/src/hooks/usePushNotifications.ts`
  - `frontend/src/sw.ts`

### 3. Startup/runtime fixes found during validation

- Local and deployed startup had migration/index ordering problems:
  - `tasks.parent_approved` index was being created before the column existed.
  - `profiles.parent_id` index was being created before the column existed.
- Those init-order bugs were corrected in `backend/src/database/init.ts`.

### 4. Goal approval visibility and family access

- Goal approval review now uses family-aware access rules instead of only the legacy direct `parent_id` check.
- Result: a parent or co-parent can now receive the notification and also see the pending goal request in the approval view.
- The same family-access fix was also applied to related approval flows so parent controls stay consistent.
- Main code paths:
  - `backend/src/services/familyAccess.ts`
  - `backend/src/routes/goals.ts`
  - `backend/src/routes/tasks.ts`
  - `backend/src/routes/profiles.ts`
  - `backend/src/routes/gamification.ts`
  - `backend/src/routes/rewards.ts`

### 5. Reward categories, goal templates, and custom goal requests

- Reward categories are now deduped across default and family-created entries.
- Parents can create custom reward categories without getting repeated values like multiple `screen_time` or `settings` entries.
- Goal templates are also deduped across system and family scope.
- Kids can now request goals with their own custom goal type and goal category instead of being limited to predefined values only.
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
- Child task deletion on the live branch now archives the task instead of hard-deleting it, preserving habit/history data.
- Archived tasks are excluded from normal task lists, parent pending review, and child stats unless explicitly requested.
- Existing databases now auto-add `tasks.deleted_at` and `tasks.deleted_by` on startup.
- Main code paths:
  - `backend/src/routes/rewards.ts`
  - `backend/src/routes/tasks.ts`
  - `backend/src/routes/profiles.ts`
  - `backend/src/database/init.ts`
  - `backend/src/database/migrations/production-ready.ts`

## Local Source Control State

- Clean fix branch used for development: `feature/trace-timer-push-fixes`
- Pushed GitHub branch: `origin/feature/trace-timer-push-fixes`
- Relevant pushed GitHub commits:
  - `1e1f960` `fix: enforce task timers and harden pwa push delivery`
  - `5a705fb` `fix: harden family controls and reward goal flows`
  - `b7a5c4b` `fix: preserve reward shop and archived task behavior`
- Matching live Synology branch commits created during deployment:
  - `d763d9f`
  - `920b64a`
  - `7567528`
  - `6c97b08`

The live Synology branch was not replaced with a normal pull because it had live-only commits and was:

- ahead `12`
- behind `15`

Because of that, the safe deployment method was:

1. Fetch the fix branch.
2. Cherry-pick the verified fix commit on top of the current live branch.
3. If the live branch has drift, resolve conflicts by preserving working live-only behavior.
4. Rebuild Docker.

This preserves all live-only features already in use.

## SSH And Repo Operation

### Connect

```powershell
ssh -p 41 Robel@192.168.1.135
```

After connecting:

```sh
cd /volume2/docker/trace
```

Because Synology reports git "dubious ownership" for this repo, use:

```sh
git -c safe.directory=/volume2/docker/trace status --short --branch
```

Useful git commands:

```sh
git -c safe.directory=/volume2/docker/trace log --oneline --decorate -5
git -c safe.directory=/volume2/docker/trace branch
git -c safe.directory=/volume2/docker/trace fetch origin
```

Known SSH note:

- User-provided port `42` was not the working SSH port.
- Actual working SSH port for this Synology host is `41`.
- Confirmed host key fingerprint:
  - `ssh-ed25519 255 SHA256:QA9zOfDa5lOGRldGrmDmEYN4kfRRq/SnvhW9nZumm5Y`

## Docker Operation On Synology

`docker` is not on the normal PATH for this user, so use `/usr/local/bin/docker`.

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
git -c safe.directory=/volume2/docker/trace status --short --branch
git -c safe.directory=/volume2/docker/trace log --oneline --decorate -5
```

### 2. Create a safety branch before deployment

```sh
git -c safe.directory=/volume2/docker/trace branch backup/pre-deploy-YYYYMMDD-HHMM
```

### 3. Fetch the fix branch from origin

```sh
git -c safe.directory=/volume2/docker/trace fetch origin feature/trace-timer-push-fixes
```

### 4. Cherry-pick the verified fix commit onto the live branch

```sh
git -c safe.directory=/volume2/docker/trace cherry-pick <commit-sha>
```

For the timer + push deployment done on 2026-03-20, the source commit was:

```text
1e1f960
```

For the reward/goal/family-control deployment done later on 2026-03-20, the pushed source commits were:

```text
5a705fb
b7a5c4b
```

### 5. If a conflict appears

- Stop and inspect it.
- Do not hard reset the live branch.
- Prefer keeping live-only behavior if the live branch already has working production logic not present in the GitHub feature branch.
- Resolve conflicts locally when needed, then copy the validated files back onto Synology and continue the cherry-pick.

Conflicts encountered during the 2026-03-20 deployments included:

- `frontend/src/components/NotificationSetup.tsx`
  - already deleted on the live branch and no longer referenced, so the deletion was kept
- `backend/src/routes/gamification.ts`
- `backend/src/routes/profiles.ts`
- `backend/src/routes/rewards.ts`
- `backend/src/routes/tasks.ts`
- `backend/src/services/economyControl.ts`

Important live-only behavior preserved during conflict resolution:

- reward star tiers / star discount behavior
- reward stock decrement and restore behavior
- child-task archive behavior using `deleted_at`
- live branch authorization support required by the merged profiles routes

### 6. Rebuild Docker

```sh
sudo /usr/local/bin/docker compose up --build -d
```

### 7. Verify

```sh
sudo /usr/local/bin/docker compose ps
curl -s http://localhost:3001/health
```

## Validation Completed On 2026-03-20

Validated locally before deploy:

- Docker build succeeded for frontend and backend.
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

Validated on Synology after deploy:

- `feature/school-leaderboard` now at `6c97b08`
- backend container up
- frontend container up
- `curl http://localhost:3001/health` returned `status: ok`

## Live Branch Drift Found During Deployment

The Synology branch is not a clean mirror of GitHub. During deployment, the live branch required one extra compatibility commit:

- `6c97b08` `fix: restore authorization support for live branch`

Reason:

- the live branch was missing `backend/src/services/authorization.ts`
- the merged `backend/src/routes/profiles.ts` expected the newer auth/authorization support
- `backend/src/middleware/auth.ts` also needed to match that authorization support

Operational rule:

- if the Synology branch compiles differently from the validated GitHub branch, document the drift explicitly and keep the live branch clean with a commit instead of leaving untracked/manual server-only edits behind

## Notes For Future Work

- If push still fails on a real phone after this deployment, inspect:
  - browser notification permission on the installed PWA
  - active rows in `push_subscriptions`
  - backend logs during the reminder window
  - service worker registration/update state on the device
- Do not assume a plain `git pull` is safe on Synology unless the live branch has first been reconciled with its local-only commits.
