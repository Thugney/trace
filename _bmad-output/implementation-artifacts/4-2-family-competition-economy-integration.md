# Story 4.2: Family Competition & Economy Integration

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a family member,
I want optional competitions and a point economy system integrated with task completion,
so that we can have friendly family challenges and tangible rewards for our efforts.

## Acceptance Criteria

**Given** the family competition feature is enabled by parents
**When** family members complete tasks
**Then** they earn points based on task difficulty and completion quality
**And** points contribute to individual and family leaderboards

**Given** points are earned through task completion
**When** I view my point balance
**Then** I can see my current points and recent earnings
**And** I understand how points translate to rewards or privileges

**Given** parents want to create friendly competitions
**When** they set up competition periods (weekly, monthly)
**Then** family members can participate in goal-based challenges
**And** competition results are displayed in a non-punitive, encouraging way

**Given** the point economy is active
**When** kids accumulate points
**Then** they can redeem points for agreed-upon rewards (screen time, special activities, etc.)
**And** redemption requires parent approval and logging

**Given** multiple kids in a family
**When** they participate in competitions
**Then** age-appropriate adjustments are made to ensure fairness
**And** the focus remains on personal improvement rather than comparison

**Given** competitions are optional
**When** families choose not to use competition features
**Then** the point economy still functions for individual motivation
**And** no family member feels pressured to compete

**Given** the economy system integrates with existing task completion
**When** tasks are approved (from Story 1.4)
**Then** points are automatically awarded based on pre-configured values
**And** point transactions are logged for transparency

## Tasks / Subtasks

- [x] Implement point earning on task completion (AC: earn points, leaderboards)
  - [x] Extend /tasks/complete API to award points based on task difficulty/quality
  - [x] Backend calculate points (e.g., base + bonus for timer from 2.3)
  - [x] Update /gamification/leaderboard for individual/family points
- [x] Display point balance and earnings (AC: view balance)
  - [x] Add point display in MyJourney.tsx and FamilyLeaderboard.tsx
  - [x] Fetch /profiles/{id}/points for current and recent earnings
- [x] Set up competitions (AC: periods, goal-based)
  - [x] Add competition setup in Settings.tsx for parents (weekly/monthly goals)
  - [x] Backend /gamification/competitions/create to store period/goals
  - [x] Display results encouragingly in leaderboard (e.g., "Great effort!")
- [x] Reward redemption (AC: redeem points)
  - [x] Add RewardShop.tsx extension for point redemption with parent approval
  - [x] Backend /rewards/redeem API with approval workflow (notification to parent)
  - [x] Log redemptions in DB for transparency
- [x] Age-appropriate fairness (AC: adjustments)
  - [x] Scale points/goals by age in calculation (e.g., easier for younger)
  - [x] Focus UI on improvement (e.g., "Your best week yet!")
- [x] Optional competitions (AC: individual motivation)
  - [x] Toggle in settings to disable competitions, keep points
  - [x] No pressure indicators (e.g., optional join)
- [x] Integrate with task approval (AC: auto award)
  - [x] On proof approve (1.4), trigger point award via economyControl.ts
- [x] Testing (cross-cutting)
  - [x] Vitest for point calculation, redemption logic
  - [x] E2E for competition setup and leaderboard

## Dev Notes

- Relevant architecture patterns and constraints: Integrate with existing /gamification and /rewards routes. Use economyControl.ts for points. Optional toggle in profile. Fairness via age from AgeContext. Backend logging for all transactions. No real-time for competitions—poll leaderboard.
- Source tree components to touch: frontend/src/pages/FamilyLeaderboard.tsx (display), frontend/src/pages/Settings.tsx (setup), backend/src/routes/gamification.ts (competitions), backend/src/routes/rewards.ts (redeem), backend/src/services/economyControl.ts (points), frontend/src/pages/RewardShop.tsx (redemption).
- Testing standards summary: Vitest for calculations (age scaling), integration for APIs, e2e for redemption flow. Cover optional mode, fairness adjustments.

### Project Structure Notes

- Alignment with unified project structure (paths, modules, naming): Gamification routes, services for economy. UI in pages. Naming: awardCompetitionPoints, redeemReward.
- Detected conflicts or variances (with rationale): Extends existing economy; ensure optional mode doesn't break individual points.

### References

- [Source: _bmad-output/planning-artifacts/prd.md#Success Criteria]: Motivation through competitions for 70% completion.
- [Source: _bmad-output/planning-artifacts/architecture.md#Technical Constraints]: Polling for leaderboards.
- [Source: docs/api-contracts-backend.md#gamification]: Extend for competitions.
- [Source: backend/src/services/economyControl.ts]: Base for points.

## Dev Agent Record

### Agent Model Used

grok-4-fast-reasoning

### Debug Log References

### Completion Notes List

### File List

- frontend/src/pages/FamilyLeaderboard.tsx (modified)
- frontend/src/pages/Settings.tsx (modified)
- backend/src/routes/gamification.ts (modified)
- backend/src/routes/rewards.ts (modified)
- backend/src/services/economyControl.ts (modified)
- frontend/src/pages/RewardShop.tsx (modified)