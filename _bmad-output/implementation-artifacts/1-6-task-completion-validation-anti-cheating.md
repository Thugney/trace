# Story 1.6: Task Completion Validation & Anti-Cheating

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a parent,
I want time-based validation on morning routine task completion with parent override capability,
so that kids can't cheat by marking tasks complete during school/church hours while allowing legitimate exceptions.

## Acceptance Criteria

**Given** I have created a "Morning Routine" category task (from Story 1.2 update)
**When** a kid attempts to mark it as complete on a weekday (Monday-Friday)
**Then** completion is blocked between 8:00 AM - 2:00 PM (school hours)
**And** the kid sees a clear error: "Morning tasks can only be completed after 2:00 PM on school days"

**Given** I have created a "Morning Routine" category task
**When** a kid attempts to mark it as complete on a weekend (Saturday-Sunday)
**Then** completion is blocked before 2:00 PM (church/activity time)
**And** the kid sees a clear error: "Morning tasks can only be completed after 2:00 PM on weekends"

**Given** a kid legitimately needs to complete a morning task outside allowed hours
**When** a parent accesses the task completion interface
**Then** the parent can override the time restriction with PIN or biometric authentication
**And** the override is logged with timestamp and parent ID for audit purposes

**Given** the time validation system is active
**When** a kid attempts to complete any task
**Then** the system checks local device timezone and adjusts for daylight saving
**And** validation uses the family's local time, not server time

**Given** multiple failed completion attempts occur
**When** a parent views the task history
**Then** they can see audit logs of blocked attempts with timestamps
**And** they can see which tasks had override completions by parents

**Given** a "Timed Work" or "Checklist" category task (non-morning routine)
**When** a kid attempts to complete it
**Then** no time-based restrictions apply (unless specifically configured by parent)
**And** completion follows normal workflows for those task types

**Given** the anti-cheating system is in place
**When** kids use the app daily
**Then** they develop honest completion habits without gaming the system
**And** parents have confidence in the integrity of task completion data

## Tasks / Subtasks

- [x] Implement time-based validation for morning routine tasks (AC: weekday/weekend blocks)
  - [x] Add category check in TasksManager.tsx for "Morning Routine" tasks
  - [x] Use local timezone to block completion during restricted hours (8AM-2PM weekdays, before 2PM weekends)
  - [x] Display error message via Toast on blocked attempt
- [x] Add parent override mechanism (AC: PIN/biometric)
  - [x] Implement override button in task completion screen visible only to parents
  - [x] Integrate PIN auth from existing auth middleware or biometric via browser API
  - [x] Log override in backend /tasks/completion-override API with timestamp/parent_id
- [x] Handle timezone and daylight saving (AC: local time validation)
  - [x] Use Intl.DateTimeFormat for family timezone detection
  - [x] Backend validation on complete to confirm local time (pass timezone in request)
  - [x] Adjust for DST automatically using date-fns or native
- [x] Add audit logging for attempts and overrides (AC: history view)
  - [x] Extend /tasks/{id}/history API to include blocked attempts and overrides
  - [x] Store logs in new audit_logs table via migration
  - [x] Display in parent dashboard history section
- [x] Ensure no restrictions for other categories (AC: non-morning tasks)
  - [x] Conditional logic in completion handler: only apply to "Morning Routine"
  - [x] Allow parent config for custom restrictions if extended later
- [x] Test integrity and habits (cross-cutting, non-functional)
  - [x] Add Vitest tests for time blocking, override, timezone edge cases
  - [x] E2E for full flow including error display and logging

## Dev Notes

- Relevant architecture patterns and constraints: Client-side validation for immediate feedback, server-side confirmation on complete to prevent tampering. Use existing auth for override (middleware/auth.ts). Local time via browser, sync with family timezone from profile. RBAC: Only parents can override. Integrate with task creation from Story 1.2.
- Source tree components to touch: frontend/src/pages/TasksManager.tsx (validation logic), backend/src/routes/tasks.ts (override API and logging), backend/migrations/add-audit-logs.sql (new), frontend/src/components/Toast.tsx (error messages), backend/src/middleware/auth.ts (PIN/biometric).
- Testing standards summary: Vitest for validation logic (mock dates/timezones), integration for API logging, e2e for override flow and error handling. Cover DST transitions, multiple timezones, and non-restricted categories.

### Project Structure Notes

- Alignment with unified project structure (paths, modules, naming): Logic in TasksManager, API in src/routes/tasks.ts. Use date-fns for timezone handling if needed. Naming: validateCompletionTime, logOverride.
- Detected conflicts or variances (with rationale): Adds validation layer to existing completion; ensure backward compatibility for non-morning tasks.

### References

- [Source: _bmad-output/planning-artifacts/prd.md#Success Criteria]: Builds trust with anti-cheating for honest habits.
- [Source: _bmad-output/planning-artifacts/architecture.md#Technical Constraints]: Client-side checks with server confirmation, local timezone.
- [Source: docs/api-contracts-backend.md#tasks]: Extend completion endpoint for validation/override.
- [Source: backend/src/middleware/auth.ts]: Reuse for parent override auth.

## Dev Agent Record

### Agent Model Used

grok-4-fast-reasoning

### Debug Log References

### Completion Notes List

### File List

- frontend/src/pages/TasksManager.tsx (modified)
- backend/src/routes/tasks.ts (modified)
- backend/migrations/add-audit-logs.sql (new)
- frontend/src/components/Toast.tsx (modified)
- backend/src/middleware/auth.ts (modified)