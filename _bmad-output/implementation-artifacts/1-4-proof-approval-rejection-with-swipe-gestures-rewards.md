# Story 1.4: Proof Approval/Rejection with Swipe Gestures & Rewards

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a parent,
I want to approve or reject proofs with swipe gestures, add comments, and award points/rewards upon approval,
so that I can provide feedback, maintain accountability, and motivate my kids through the reward system.

## Acceptance Criteria

**Given** I am reviewing a proof in the proof review interface
**When** I want to approve the proof
**Then** I can swipe right or tap an "Approve" button
**And** I have the option to add an approving comment before confirming

**Given** I am reviewing a proof in the proof review interface
**When** I want to reject the proof
**Then** I can swipe left or tap a "Reject" button
**And** I am required to provide constructive feedback explaining the rejection

**Given** I have approved a proof
**When** I confirm the approval
**Then** the proof status changes to "Approved" in the database
**And** the child receives the task's point value in their reward balance
**And** the child gets a push notification about the approval and points earned
**And** the task is marked as completed in the child's task list

**Given** I have rejected a proof
**When** I confirm the rejection with feedback
**Then** the proof status changes to "Rejected" in the database
**And** my feedback is saved with the proof record
**And** the child receives a push notification with my feedback
**And** the task remains in the child's task list with "Needs Revision" status

**Given** I want to provide detailed feedback
**When** I approve or reject a proof
**Then** I can type comments in a text field
**And** I can use preset feedback templates for common situations
**And** my comments are saved with the approval/rejection decision

**Given** a proof has been approved or rejected
**When** I return to the parent dashboard
**Then** the proof is removed from the "Pending Proofs" section
**And** the child's progress metrics update to reflect the completion

**Given** multiple proofs are pending for the same child
**When** I use swipe gestures to approve/reject proofs
**Then** I can quickly process multiple proofs in sequence
**And** after each decision, I automatically advance to the next pending proof

**Given** I accidentally approve or reject a proof
**When** I realize my mistake immediately
**Then** I have a brief undo period (5 seconds) to reverse the decision
**And** I can correct my decision without the child being notified

## Tasks / Subtasks

- [x] Implement approve/reject UI with swipe gestures (AC: swipe/tap actions)
  - [x] Extend ProofReview component with react-swipeable for left/right swipes
  - [x] Add Approve/Reject buttons with confirmation modal for comments
  - [x] Integrate preset templates in comment field (dropdown select)
- [x] Handle approval backend and rewards (AC: status change, points, notification)
  - [x] Updated /tasks/{id}/verify-proof API to handle approval, add points via progress table
  - [x] Trigger push notification on approval using NotificationHelpers.taskCompleted()
  - [x] Update task status to completed (sets completed = 1)
- [x] Handle rejection backend and feedback (AC: status change, notification)
  - [x] Updated /tasks/{id}/verify-proof API to handle rejection, save comments/feedback
  - [x] Send rejection notification with feedback using NotificationHelpers.taskRejected()
  - [x] Set task status to "Needs Revision" (sets needs_revision = 1)
- [x] Update dashboard on decision (AC: remove from pending, metrics update)
  - [x] Trigger dashboard refresh/polling after decision to remove proof (dashboard fetches on mount)
  - [x] Update progress metrics in ParentDashboard via API call (dashboard fetches progress)
- [x] Implement multi-proof processing and undo (AC: sequence, undo period)
  - [x] Add navigation logic to advance to next/prev proof after decision (ProofReview handles navigation)
  - [x] Implement 5s undo timer with snackbar/Toast for reversal (ProofDecisionModal has undo)
  - [x] Ensure undo doesn't send notification until confirmed (notifications sent after undo period)
- [x] Ensure accessibility and edge cases (cross-cutting)
  - [x] Add ARIA labels for swipe areas and buttons (added to ProofDecisionModal)
  - [x] Handle no comments on approve, required on reject (already implemented)

## Dev Notes

- Relevant architecture patterns and constraints: Integrate with existing ProofReview from Story 1.3. Use economyControl.ts for points addition. Notifications via existing hooks/usePushNotifications.ts. Backend: Update proofs table with status/comments via migration. RBAC: Parents can only approve/reject own family proofs. Polling in dashboard to reflect changes.
- Source tree components to touch: frontend/src/components/ProofReview.tsx (modified for actions), backend/src/routes/tasks.ts (extend approve/reject APIs), backend/src/services/economyControl.ts (add points), backend/migrations/add-proof-comments.sql (new), frontend/src/components/Toast.tsx (for undo).
- Testing standards summary: Vitest for gesture handling (mock swipes), integration for API calls (mock economy/notifications), e2e for full flow (approve sequence, undo). Cover required feedback validation, multi-proof navigation, and no notification on undo.

### Project Structure Notes

- Alignment with unified project structure (paths, modules, naming): Actions in ProofReview component, API in src/routes/tasks.ts. Use existing Toast for UI feedback. Naming: approveProof, rejectProof functions.
- Detected conflicts or variances (with rationale): Builds on 1.3 review interface; add actions modularly without altering view logic.

### References

- [Source: _bmad-output/planning-artifacts/prd.md#Success Criteria]: 80% approval within 24h via quick feedback.
- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting Concerns]: Notifications, RBAC for family data.
- [Source: docs/api-contracts-backend.md#tasks]: Extend proof endpoints for approve/reject.
- [Source: frontend/src/components/Toast.tsx]: Use for undo feedback.

## Dev Agent Record

### Agent Model Used

grok-4-fast-reasoning

### Debug Log References

### Completion Notes List

**Task 1: Implement approve/reject UI with swipe gestures**
- Installed react-swipeable package
- Extended ProofReview component with dual swipe handlers:
  - Navigation swipes (left/right) for moving between proofs
  - Decision swipes (left/right) on image for approve/reject gestures
- Created ProofDecisionModal component with:
  - Approve/Reject buttons with confirmation modals
  - Preset feedback templates for common scenarios
  - Comment field with template dropdown
  - 5-second undo functionality
  - Integrated navigation controls
- Updated backend verify-proof endpoint to accept and save comments
- Created migration for proof comments table
- Updated API service to support comment parameter

### File List

- frontend/src/components/ProofReview.tsx (modified) - Added swipe gestures and ProofDecisionModal integration
- frontend/src/components/ProofDecisionModal.tsx (new) - Approve/reject modal with comment templates
- frontend/src/services/api.ts (modified) - Updated verifyProof to accept comments
- backend/src/routes/tasks.ts (modified) - Updated verify-proof endpoint to save comments
- backend/src/database/migrations/production-ready.ts (modified) - Added needs_revision field to tasks table
- backend/migrations/add-proof-comments.sql (new) - Migration for proof comments
- frontend/package.json (modified) - Added react-swipeable dependency
- frontend/src/components/ProofDecisionModal.test.tsx (new) - Unit tests for ProofDecisionModal
- frontend/src/components/ProofReview.test.tsx (new) - Unit tests for ProofReview

## Change Log

**2026-01-11** - Story implementation completed
- Added notification sending for proof approval (taskCompleted) and rejection (taskRejected)
- Added `needs_revision` field to tasks table via migration
- Updated `/verify-proof` endpoint to set `needs_revision = 1` for rejected proofs
- Added ARIA labels for accessibility in ProofDecisionModal
- Fixed navigation to advance to next proof for both approval and rejection
- All story tasks marked as completed

**2026-01-11** - Code review fixes applied
- Added unit tests: `ProofDecisionModal.test.tsx` and `ProofReview.test.tsx`
- Added missing migration file to File List: `backend/src/database/migrations/production-ready.ts`
- Extracted hardcoded undo duration to constant `UNDO_DURATION_MS`
- Implemented optimistic updates for pending proofs list
- Updated story File List with test files

## Dev Agent Record

### Agent Model Used

deepseek-reasoning

### Completion Notes List

**Task 1: Implement approve/reject UI with swipe gestures**
- Installed react-swipeable package
- Extended ProofReview component with dual swipe handlers:
  - Navigation swipes (left/right) for moving between proofs
  - Decision swipes (left/right) on image for approve/reject gestures
- Created ProofDecisionModal component with:
  - Approve/Reject buttons with confirmation modals
  - Preset feedback templates for common scenarios
  - Comment field with template dropdown
  - 5-second undo functionality
  - Integrated navigation controls
- Updated backend verify-proof endpoint to accept and save comments
- Created migration for proof comments table
- Updated API service to support comment parameter

**Task 2: Handle approval backend and rewards**
- Updated `/tasks/{id}/verify-proof` API to send notification on approval using `NotificationHelpers.taskCompleted()`
- Points awarded via progress table (existing implementation)
- Task status set to completed (`completed = 1`)

**Task 3: Handle rejection backend and feedback**
- Updated `/tasks/{id}/verify-proof` API to send notification on rejection using `NotificationHelpers.taskRejected()`
- Added `needs_revision` field to tasks table via migration
- Set `needs_revision = 1` when proof is rejected
- Comments saved with proof record

**Task 4: Update dashboard on decision**
- ProofReview refreshes pending proofs list after decision
- Navigates to next proof or back to dashboard
- ParentDashboard fetches fresh data on mount

**Task 5: Implement multi-proof processing and undo**
- ProofDecisionModal has 5-second undo timer
- ProofReview handles navigation to next proof
- Notifications sent after undo period (correct implementation)

**Task 6: Ensure accessibility and edge cases**
- Added ARIA labels to ProofDecisionModal:
  - Swipe area: "Proof photo - swipe left to reject, right to approve"
  - Buttons: "Approve proof", "Reject proof", "Close proof review"
  - Template buttons: "Use template: ..."
- Comment validation: reject requires comment, approve doesn't