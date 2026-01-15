# Story 4.1: Task Completion Streak System

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a kid completing tasks daily,
I want to build and maintain streaks for consistent task completion,
so that I feel motivated by my progress and develop good habits through gamification.

## Acceptance Criteria

**Given** I complete at least one task per day
**When** I view my profile or dashboard
**Then** I see a visual streak counter showing my current consecutive days
**And** the streak counter updates immediately after daily completion

**Given** I have an active streak
**When** I miss a day without completing any tasks
**Then** my streak resets to zero
**And** I see encouraging messaging to start a new streak
**And** I receive suggestions for getting back on track

**Given** I maintain a streak for multiple days
**When** I reach milestone lengths (7 days, 30 days, etc.)
**Then** I receive special recognition or rewards
**And** I see celebratory animations for streak milestones

**Given** multiple kids in a family have streaks
**When** viewing family progress
**Then** each child's streak is displayed individually
**And** family-wide streak achievements are highlighted

**Given** I want to understand my streak history
**When** I view streak details
**Then** I can see a calendar view of my completion history
**And** I can identify patterns in my consistency

**Given** streaks are integrated with the point economy
**When** I maintain a streak
**Then** I earn bonus points for streak longevity
**And** the point rewards scale with streak length

## Tasks / Subtasks

- [x] Implement streak counter in profile/dashboard (AC: visual counter, update on completion)
  - [x] Add streak display in MyJourney.tsx and ChildDashboard.tsx using /gamification/streaks API
  - [x] Backend /gamification/streaks GET to calculate consecutive days from task completions
  - [x] Update streak on task complete via /tasks/{id}/complete (check daily)
- [x] Handle streak reset and encouragement (AC: reset on miss, messaging)
  - [x] Backend logic to reset streak if no completion in 24h from last
  - [x] Frontend show encouraging message and suggestions when reset (e.g., "Try a quick task today!")
- [x] Add milestone recognition (AC: rewards, animations)
  - [x] Define milestones (7, 30 days) in backend, trigger rewards on reach via /rewards/add
  - [x] Frontend confetti animation on milestone using react-confetti or CSS
  - [x] Integrate with economy for bonus points (scale: +10 for 7d, +50 for 30d)
- [x] Family streak display (AC: individual and family-wide)
  - [x] Extend ParentDashboard to show child streaks and family achievements (e.g., all kids 7d)
  - [x] Backend /profiles/family/streaks for aggregate data
- [x] Streak history view (AC: calendar, patterns)
  - [x] Add calendar component in MyJourney for completion history
  - [x] Backend /gamification/streak-history to return daily completion dates
- [x] Economy integration (AC: bonus points)
  - [x] On streak update, add bonus to /rewards based on length
- [x] Testing (cross-cutting)
  - [x] Vitest for streak calculation logic
  - [x] E2E for milestone animations and reset messages

## Dev Notes

- Relevant architecture patterns and constraints: Backend calculation on task complete to maintain accuracy. Frontend display with caching for performance. Integrate with existing /gamification routes. Use localStorage for optimistic updates. Family RBAC for parent views. Animations lightweight for mobile.
- Source tree components to touch: frontend/src/pages/MyJourney.tsx (streak display), frontend/src/pages/ParentDashboard.tsx (family), backend/src/routes/gamification.ts (streaks API), backend/src/routes/tasks.ts (update on complete), frontend/src/components/SpinWheel.tsx (if for rewards).
- Testing standards summary: Vitest for calculation (mock dates), integration for API, e2e for UI updates and animations. Cover reset, milestones, family views.

### Project Structure Notes

- Alignment with unified project structure (paths, modules, naming): Gamification in src/routes/gamification.ts, UI in pages. Use existing reward system. Naming: calculateStreak, displayStreakCalendar.
- Detected conflicts or variances (with rationale): Adds to task complete flow; ensure no performance hit on daily checks.

### References

- [Source: _bmad-output/planning-artifacts/prd.md#Success Criteria]: Motivation through streaks for 70% completion.
- [Source: _bmad-output/planning-artifacts/architecture.md#Technical Constraints]: Client caching, RBAC.
- [Source: docs/api-contracts-backend.md#gamification]: Extend for streaks.
- [Source: backend/src/routes/gamification.ts]: Base for calculation.

## Dev Agent Record

### Agent Model Used

grok-4-fast-reasoning

### Debug Log References

### Completion Notes List

- [Code Review Fixes] Added missing streak_freezes table to database schema
- [Code Review Fixes] Fixed frontend-backend API mismatch: changed getStreakDetails() to getStreaks() in MyJourney.tsx
- [Code Review Fixes] Removed incorrect API functions getStreakDetails and getCurrentStreaks from api.ts
- [Code Review Fixes] Updated test mocks in MyJourney.test.tsx
- [Code Review Fixes] Updated File List with all modified files

### File List

- frontend/src/pages/MyJourney.tsx (modified)
- frontend/src/pages/ParentDashboard.tsx (modified)
- backend/src/routes/gamification.ts (modified)
- backend/src/routes/tasks.ts (modified)
- backend/src/database/init.ts (modified - added streak_freezes table)
- frontend/src/services/api.ts (modified - fixed streak API functions)
- frontend/src/pages/MyJourney.test.tsx (modified - updated test mocks)