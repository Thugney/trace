# Story 2.2: Quiz Timer Integration with Pause for Thinking

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a kid taking a quiz,
I want to have a timer with pause functionality during quizzes,
so that I can manage my thinking time without pressure and improve my learning experience.

## Acceptance Criteria

**Given** I am taking a quiz in the QuizPlayer
**When** the quiz question is displayed
**Then** I see a timer counting down (or up) for the current question
**And** I have a "Pause" button to temporarily stop the timer for thinking time

**Given** I need more time to think about a quiz question
**When** I tap the "Pause" button
**Then** the timer stops counting
**And** I see a "Resume" button to continue timing when ready
**And** the question remains displayed while timer is paused

**Given** the quiz timer is paused
**When** I tap "Resume"
**Then** the timer continues from where it left off
**And** my total quiz time accurately reflects only active thinking time

**Given** I am taking a timed quiz
**When** the timer reaches zero (for countdown quizzes) or I complete the question
**Then** I automatically advance to the next question
**And** the timer resets for the new question

**Given** I navigate away from the quiz while a timer is running
**When** I return to the quiz
**Then** the timer state is preserved (paused or running as appropriate)
**And** I can continue from where I left off

**Given** the quiz has audio feedback enabled (from Epic 3)
**When** timer updates occur (every second)
**Then** optional chime sounds play for timer milestones (30s warning, etc.)
**And** audio feedback is coordinated with timer events

## Tasks / Subtasks

- [x] Integrate timer display in QuizPlayer (AC: countdown/up per question)
  - [x] Add timer component to QuizPlayer.tsx with useState/useEffect for counting
  - [x] Reset timer on question change, support countdown or up mode based on quiz type
  - [x] Display in HMS format with visual indicator (e.g., progress bar)
- [x] Implement pause/resume functionality (AC: pause button, preserve time)
  - [x] Add Pause/Resume buttons with state management in local storage or Context
  - [x] Stop interval on pause, resume from elapsed time
  - [x] Ensure question doesn't advance while paused
- [x] Handle timer expiration and advancement (AC: advance on zero/complete)
  - [x] Auto-advance to next question on timer zero or answer submit
  - [x] Log per-question time for total session (integrate with Story 2.3)
  - [x] Prevent negative time or overflow
- [x] Preserve state on navigation (AC: return from away)
  - [x] Use beforeunload or visibilitychange to pause on leave
  - [x] Restore timer state on return via localStorage
  - [x] Prompt if timer was interrupted
- [x] Integrate audio chimes for milestones (AC: sounds coordination)
  - [x] Use utils/sounds.ts for chime on 30s warning, updates
  - [x] Coordinate with existing feedback sounds from Story 3.3
  - [x] Optional mute via settings
- [x] Accessibility and responsive (cross-cutting)
  - [x] ARIA-live for timer announcements
  - [x] Touch-friendly buttons, responsive layout with Tailwind

## Dev Notes

- Relevant architecture patterns and constraints: Client-side timer similar to Story 2.1, integrate with QuizPlayer existing structure. Use ProfileContext for quiz state. Audio from sounds.ts. Offline persistence via localStorage. Link to timer logging in 2.3. Age-appropriate chimes via AgeContext.
- Source tree components to touch: frontend/src/pages/QuizPlayer.tsx (timer integration), frontend/src/utils/sounds.ts (chimes), frontend/src/context/ProfileContext.tsx (quiz state), frontend/src/components/CountdownChallengeCard.tsx (reuse if applicable).
- Testing standards summary: Vitest for timer logic (mock time, pause/resume), integration for audio/question advance, e2e for navigation preservation. Cover milestone chimes, state restore.

### Project Structure Notes

- Alignment with unified project structure (paths, modules, naming): Timer in QuizPlayer page, sounds in utils. Use existing Context for state. Naming: useQuizTimer hook.
- Detected conflicts or variances (with rationale): Extends QuizPlayer without altering core quiz flow—add timer layer modularly.

### References

- [Source: _bmad-output/planning-artifacts/prd.md#Success Criteria]: Quiz sessions >5min with focused time tracking.
- [Source: _bmad-output/planning-artifacts/architecture.md#Technical Constraints]: Client-side timers, local storage.
- [Source: docs/architecture-frontend.md#State Management]: Context for quiz/timer state.
- [Source: frontend/src/pages/QuizPlayer.tsx]: Extend for timer UI.

## Dev Agent Record

### Agent Model Used

grok-4-fast-reasoning

### Debug Log References

### Completion Notes List

**Task 1: Integrate timer display in QuizPlayer** - Completed 2026-01-11
- Added timer state management with useState/useEffect hooks
- Implemented countdown and countup modes based on quiz settings
- Added timer display with HMS formatting and visual progress bar for countdown
- Added pause/resume button with SVG icons
- Implemented auto-pause on page visibility change
- Added localStorage persistence for timer state recovery
- Integrated timer sound effects (ticks, warnings, completion)
- Timer auto-advances on expiration (countdown mode) or continues counting (countup mode)

**Task 2: Implement pause/resume functionality** - Completed 2026-01-11
- Added Pause/Resume toggle button with visual feedback
- Timer interval stops when paused (useEffect dependency management)
- Timer state preserved in localStorage for recovery
- Auto-pauses when user navigates away (page visibility API)
- Question advancement prevented while timer is paused
- Sound feedback on pause/resume actions

**Task 3: Handle timer expiration and advancement** - Completed 2026-01-11
- Auto-advance to next question when timer reaches zero (countdown mode)
- Timer stops at 0 to prevent negative time
- Integration with existing answer submission flow

**Task 4: Preserve state on navigation** - Completed 2026-01-11
- Uses visibilitychange API to detect page visibility changes
- Auto-pauses timer when user navigates away
- Restores timer state from localStorage on return
- State expires after 5 minutes for security

**Task 5: Integrate audio chimes for milestones** - Completed 2026-01-11
- Added timerTick sound for countdown final 10 seconds
- Added timerWarning sound at 30s and 10s milestones
- Added timerComplete sound when timer expires
- Sounds respect user mute preferences via areSoundsEnabled()
- Integrated with existing Web Audio API sound system

**Task 6: Accessibility and responsive** - Completed 2026-01-11
- Added ARIA-live region for timer announcements
- Added role="timer" with appropriate ARIA attributes
- Touch-friendly buttons with adequate sizing
- Responsive layout using Tailwind CSS
- Screen reader support with sr-only labels

**Task 3 Update: Per-question time logging integration** - Completed 2026-01-12
- Fixed per-question time tracking to only count active thinking time (excluding paused time)
- Added `questionActiveTime` state to track active seconds per question
- Updated `lastTimerUpdate` tracking to calculate elapsed active time
- Modified `submitAnswer` to use active time instead of total elapsed time
- Ensures accurate per-question timing for analytics and streaks integration

**Task 4 Update: Interruption prompt implementation** - Completed 2026-01-12
- Added `showInterruptionPrompt` state to control prompt visibility
- Enhanced visibility change handler to show prompt when page becomes visible
- Added `handleResumeFromInterruption` function to resume timer from prompt
- Created interruption prompt UI with resume and keep paused options
- Added visual feedback with yellow background and pulse animation
- Prompt automatically appears when user returns to quiz after navigation away

**Code Review Fixes** - Completed 2026-01-12
- Fixed magic number: Replaced `300000` with `TIMER_STATE_EXPIRY_MS` constant (5 * 60 * 1000)
- Refactored complex timer effect: Extracted `handleTimerSounds` and `handleTimerExpiration` helper functions
- Added localStorage write throttling: Only save every 10 seconds or on significant state changes
- Enhanced test coverage: Added timer functionality tests for display, pause/resume, and state persistence
- Updated File List: Added `frontend/src/context/AgeContext.tsx` to documented changes

**Code Review Round 2 Fixes** - Completed 2026-01-12
- HIGH: Staged test file to git (frontend/src/pages/QuizPlayer.test.tsx)
- HIGH: Removed CountdownChallengeCard from File List (was not actually modified)
- MEDIUM: Separated active time tracking into dedicated effect for better maintainability
- MEDIUM: Moved TIMER_STATE_EXPIRY_MS and TIMER_ANNOUNCEMENT_INTERVAL to module-level constants
- MEDIUM: Enhanced localStorage error handling with validation, cleanup, and user feedback
- MEDIUM: Added periodic timer announcements every 30s for screen reader accessibility
- LOW: Enhanced test coverage with actual pause/resume behavior tests and active time tracking verification
- LOW: Added inline documentation explaining timer effect coordination and active time tracking logic

**Code Review Round 3 Fixes** - Completed 2026-01-13
- HIGH: Fixed infinite timer expiration loop - Timer now only calls handleTimerExpiration once when reaching 0
- HIGH: Added missing useEffect dependencies (handleTimerExpiration, handleTimerSounds)
- HIGH: Fixed active time tracking initialization - lastTimerUpdate now set when timer starts/resets
- MEDIUM: Fixed redundant logic in playAgeAppropriateSound function
- MEDIUM: Fixed potential memory leak in showVisualFeedback with timeout cleanup
- MEDIUM: Enhanced test verification for active time tracking
- MEDIUM: Added comprehensive validation for localStorage timer state
- MEDIUM: Fixed timerStorageKey construction to handle null/undefined values safely
- MEDIUM: Updated File List to include frontend/src/hooks/useTimer.ts
- LOW: Code quality improvements and security enhancements

### File List

- frontend/src/pages/QuizPlayer.tsx (modified) - Added timer state, effects, display, controls, per-question active time tracking, and interruption prompt
- frontend/src/pages/QuizPlayer.test.tsx (added) - Comprehensive tests for timer functionality, pause/resume, accessibility, and state persistence
- frontend/src/utils/sounds.ts (modified) - Added timer chime sounds (timerTick, timerWarning, timerComplete)
- frontend/src/context/ProfileContext.tsx (modified) - Enhanced for timer state management and personalization
- frontend/src/context/AgeContext.tsx (modified) - Age-appropriate theming for timer sounds and display
- frontend/src/hooks/useTimer.ts (modified) - Enhanced timer hook with improved state management and synchronization