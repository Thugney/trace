# Synology Operations Runbook

Last updated: 2026-03-20

This runbook documents the current live Trace deployment on Synology, what was changed for the timer and PWA push fix, and the safest way to operate or deploy the app without overwriting live-only commits.

## Current Live State

- Synology SSH host: `192.168.1.135`
- SSH port: `41`
- SSH user: `Robel`
- Live repo path: `/volume2/docker/trace`
- Live branch: `feature/school-leaderboard`
- Live deployed commit after timer/push fix: `d763d9f`
- Safety backup branch created before deploy: `backup/pre-deploy-20260320-1534`
- Backend container: `family-learning-backend`
- Frontend container: `family-pwa-frontend`
- Backend health endpoint: `http://localhost:3001/health`

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

## Local Source Control State

- Clean fix branch used for development: `feature/trace-timer-push-fixes`
- Pushed GitHub branch: `origin/feature/trace-timer-push-fixes`
- Source commit pushed to GitHub: `1e1f960`
- Commit applied onto live Synology branch: `d763d9f`

The live Synology branch was not replaced with a normal pull because it had live-only commits and was:

- ahead `8`
- behind `15`

Because of that, the safe deployment method was:

1. Fetch the fix branch.
2. Cherry-pick the verified fix commit on top of the current live branch.
3. Rebuild Docker.

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

### 5. If a conflict appears

- Stop and inspect it.
- Do not hard reset the live branch.
- Prefer keeping live-only deletions if the deleted file is no longer referenced.

During the 2026-03-20 deploy, the only conflict was:

- `frontend/src/components/NotificationSetup.tsx`

The live branch had already deleted it, and there were no remaining references, so the deletion was kept and the cherry-pick continued.

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

Validated on Synology after deploy:

- `feature/school-leaderboard` now at `d763d9f`
- backend container up
- frontend container up
- `curl http://localhost:3001/health` returned `status: ok`

## Notes For Future Work

- If push still fails on a real phone after this deployment, inspect:
  - browser notification permission on the installed PWA
  - active rows in `push_subscriptions`
  - backend logs during the reminder window
  - service worker registration/update state on the device
- Do not assume a plain `git pull` is safe on Synology unless the live branch has first been reconciled with its local-only commits.
