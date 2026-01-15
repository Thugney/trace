# Story 2.5: Offline Timer Support with Service Worker Queuing

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a kid using the app in areas with poor or no internet connectivity,
I want timers to continue working offline with automatic queuing and sync,
so that I can track my time reliably regardless of network conditions.

## Acceptance Criteria

**Given** I start a timer on a Timed Work task or quiz
**When** I lose internet connectivity
**Then** the timer continues counting locally on my device
**And** I see an "Offline - Timer active" indicator

**Given** I complete a timed activity while offline
**When** I stop the timer or finish the activity
**Then** the duration data is queued locally via service worker
**And** I see a "Data queued for sync" notification

**Given** I have queued timer data from offline usage
**When** internet connectivity is restored
**Then** the service worker automatically syncs all queued data
**And** I receive confirmation that my offline data has been synchronized

**Given** I am completely offline (no connectivity)
**When** I use timer features
**Then** all timer functionality works locally
**And** I can view my offline timer history
**And** I can start/stop/pause timers as normal

**Given** I have multiple timed activities while offline
**When** connectivity is restored
**Then** all queued timer data is synced in chronological order
**And** duration logs are properly timestamped with original activity times

**Given** the app is installed as a PWA with service worker
**When** I use timer features
**Then** offline capabilities are automatically available
**And** the service worker handles all queuing and sync operations

**Given** I experience intermittent connectivity
**When** using timers
**Then** the app gracefully handles connection drops and restores
**And** no timer data is lost during connectivity fluctuations

## Tasks / Subtasks

- [x] Extend service worker for timer offline support (AC: local counting, indicator)
  - [x] Update sw.ts to handle timer state persistence and offline indicator events
  - [x] Add offline event listener in frontend to show "Offline - Timer active" via Toast
  - [x] Ensure local timer continues via requestAnimationFrame or setInterval in SW if needed
- [x] Queue duration logs offline (AC: queue on complete, pending indicator)
  - [x] Modify timer stop/complete in SimpleTaskCard/QuizPlayer to queue POST to /tasks/timer-log via SW
  - [x] Use IndexedDB in SW for queuing log entries (task_id, duration, timestamp)
  - [x] Show "Data queued for sync" notification on queue
- [x] Implement auto-sync on restore (AC: sync queued data, confirmation)
  - [x] Add online event listener to trigger SW sync of queued logs
  - [x] Backend handle batched logs from SW with retry on failure
  - [x] Show sync confirmation Toast on successful upload
- [x] Support full offline timer functionality (AC: local history, normal operations)
  - [x] Persist timer history locally in IndexedDB for offline view
  - [x] Ensure start/stop/pause work without network using local state
  - [x] Display offline history in task/quiz views until synced
- [x] Handle multiple activities and chronological sync (AC: order, timestamps)
  - [x] Queue with original timestamps to maintain order on sync
  - [x] Backend insert logs with client timestamp for accuracy
- [x] Graceful intermittent connectivity (AC: no data loss)
  - [x] Implement retry logic in SW for partial failures (exponential backoff)
  - [x] Conflict resolution if partial sync (use timestamps)
- [x] PWA and testing (cross-cutting)
  - [x] Ensure SW registration in vite.config.ts for PWA
  - [x] Vitest mocks for offline/online events, e2e for full offline flow

## Dev Notes

- Relevant architecture patterns and constraints: Build on existing sw.ts for PWA offline. Client timers from 2.1/2.2 persist locally, sync logs from 2.3. Use IndexedDB for queue (no localStorage for large data). Backend idempotent logs to handle retries. Integrate with polling from 2.4 for state.
- Source tree components to touch: frontend/src/sw.ts (queuing/sync), frontend/src/components/SimpleTaskCard.tsx (queue on stop), frontend/src/pages/QuizPlayer.tsx (queue on finish), backend/src/routes/tasks.ts (batched log API), frontend/src/services/api.ts (offline fetch handling).
- Testing standards summary: Vitest for SW mocks (offline simulation), integration for queue/sync, e2e with network throttling for intermittent. Cover multi-activity queue, timestamp order.

### Project Structure Notes

- Alignment with unified project structure (paths, modules, naming): SW in src/sw.ts, queue logic in components. API extensions in src/routes. Naming: queueTimerLog, syncQueuedLogs.
- Detected conflicts or variances (with rationale): Enhances existing SW without breaking current offline (e.g., proofs from 1.1).

### References

- [Source: _bmad-output/planning-artifacts/prd.md#Success Criteria]: Reliable tracking regardless of connectivity.
- [Source: _bmad-output/planning-artifacts/architecture.md#Technical Constraints]: Offline-first with SW queuing.
- [Source: docs/architecture-frontend.md#PWA]: Extend SW for timers.
- [Source: frontend/src/sw.ts]: Base for queuing implementation.

## Dev Agent Record

### Agent Model Used

grok-4-fast-reasoning

### Debug Log References

### Completion Notes List

### File List

- frontend/src/sw.ts (modified)
- frontend/src/components/SimpleTaskCard.tsx (modified)
- frontend/src/pages/QuizPlayer.tsx (modified)
- backend/src/routes/tasks.ts (modified)
- frontend/src/services/api.ts (modified)