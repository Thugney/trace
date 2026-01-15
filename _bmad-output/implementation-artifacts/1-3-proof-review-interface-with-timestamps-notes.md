# Story 1.3: Proof Review Interface with Timestamps & Notes

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a parent,
I want to review proof details with full-size images, timestamps, and the ability to add notes,
so that I can make informed decisions about approval based on complete evidence.

## Acceptance Criteria

**Given** I am on the parent dashboard with pending proofs
**When** I tap on a proof thumbnail
**Then** I am taken to a detailed proof review interface
**And** the proof image loads instantly in full-size view

**Given** I am viewing a proof
**When** the interface loads
**Then** I see the task name, child's name, and upload timestamp
**And** I see start/stop timestamps if the task had timer tracking (from Epic 2)
**And** I see the total duration if timer data is available

**Given** I want to examine the proof closely
**When** I view the proof image
**Then** I can pinch-to-zoom for detailed inspection
**And** I can swipe left/right to navigate between proofs if multiple are pending

**Given** I want to add context to my review
**When** I tap the "Add Note" field
**Then** I can type notes about the proof
**And** the notes are saved temporarily as I type (auto-save)

**Given** I have added notes to a proof
**When** I navigate away from the proof review
**Then** my notes are preserved with the proof record
**And** I can see my notes when I return to this proof

**Given** the proof image fails to load
**When** I view the proof review interface
**Then** I see a fallback thumbnail and error message
**And** I have an option to retry loading the image

**Given** I want to compare proof details
**When** I view the proof review interface
**Then** I can see related task details (original description, due date, point value)
**And** I can see the child's recent proof history for similar tasks

## Tasks / Subtasks

- [x] Implement detailed proof review interface (AC: navigation and image load)
  - [x] Create new ProofReview component in frontend/src/components/ProofReview.tsx
  - [x] Integrate with ParentDashboard to route from thumbnail tap
  - [x] Load full-size image from /tasks/proof/{id} API with lazy loading for performance
- [x] Display timestamps and metadata (AC: task/child info, timers)
  - [x] Fetch proof details including timer data from backend /tasks/proof/{id}/details
  - [x] Render task name, child name, upload timestamp, start/stop durations
  - [x] Handle missing timer data gracefully (show N/A if not applicable)
- [x] Add zoom and navigation features (AC: pinch-to-zoom, swipe)
  - [x] Use react-zoom-pan-pinch or native touch events for image zoom
  - [x] Implement swipe gestures for multi-proof navigation using react-swipeable
  - [x] Fetch next/prev proofs via API for seamless browsing
- [x] Implement note-taking functionality (AC: add/save notes)
  - [x] Add textarea for notes with auto-save on blur/input via useEffect
  - [x] Extend backend /tasks/proof/{id}/notes API to save/retrieve parent notes
  - [x] Persist notes in DB with proof_id and parent_id
- [x] Handle errors and related details (AC: fallback, task history)
  - [x] Add error boundary for image load failure with retry button
  - [x] Fetch and display related task details and recent history from /tasks/{taskId}/history
  - [x] Ensure RBAC: only show history for own children
- [x] Ensure accessibility and responsive design (cross-cutting)
  - [x] Add ARIA labels for image, timestamps, notes field
  - [x] Use Tailwind for responsive layout (full-screen on mobile)

## Dev Notes

- Relevant architecture patterns and constraints: Extend existing PhotoProof component logic for review view. Use polling if needed for metadata updates. Backend: Add notes field to proofs table via migration. Ensure secure image serving with signed URLs if using cloud storage. RBAC critical for family isolation.
- Source tree components to touch: frontend/src/components/ProofReview.tsx (new), frontend/src/pages/ParentDashboard.tsx (integration), backend/src/routes/tasks.ts (extend proof details/notes API), backend/migrations/add-proof-notes.sql (new), frontend/src/services/api.ts (new endpoints).
- Testing standards summary: Vitest for component rendering (mock image/timer data), integration for API fetches, e2e for swipe/zoom flows. Cover error states (image fail, no notes), multi-proof navigation, and accessibility (screen reader announces timestamps).

### Project Structure Notes

- Alignment with unified project structure (paths, modules, naming): New component in src/components, route integration in src/pages. API extensions in src/routes/tasks.ts. Consistent naming: ProofReview for clarity.
- Detected conflicts or variances (with rationale): No conflicts; builds on dashboard without altering existing layout—add modal or full-view for review.

### References

- [Source: _bmad-output/planning-artifacts/prd.md#Success Criteria]: Parents review proofs in <2min with details for informed decisions.
- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting Concerns]: Accessibility (ARIA for dynamic content), performance (<2s image load).
- [Source: docs/api-contracts-backend.md#tasks]: Extend proof endpoint for details/notes.
- [Source: frontend/src/pages/ParentDashboard.tsx]: Integrate thumbnail navigation to new review view.

## Dev Agent Record

### Agent Model Used

grok-4-fast-reasoning

### Debug Log References

### Completion Notes List

- [AI-Review] Fixed hardcoded parent ID by integrating useProfile context
- [AI-Review] Added improved error handling with retry option for note saves
- [AI-Review] Created missing migration file: add-proof-notes.sql
- [AI-Review] Updated File List to include test file
- All HIGH and MEDIUM issues from code review have been addressed

### File List

- frontend/src/components/ProofReview.tsx (new)
- frontend/src/pages/ParentDashboard.tsx (modified)
- backend/src/routes/tasks.ts (modified)
- backend/migrations/add-proof-notes.sql (new)
- frontend/src/services/api.ts (modified)
- frontend/src/components/ProofReview.test.tsx (new)