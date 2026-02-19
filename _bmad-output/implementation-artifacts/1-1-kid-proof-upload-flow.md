# Story 1.1: Kid Proof Upload Flow

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a kid completing a task,
I want to upload a photo proof with one-tap camera access to local Docker Synology storage,
so that I can provide visual evidence of task completion to my parents and eventually earn points/rewards upon approval.

## Acceptance Criteria

**Given** I am on the task completion screen for an assigned task
**When** I tap the "Add Photo Proof" button
**Then** the device camera opens immediately for photo capture
**And** I can take a photo or choose from gallery

**Given** I have captured or selected a photo
**When** I confirm the photo selection
**Then** the photo is uploaded to local Docker Synology storage
**And** a proof record is created in the PostgreSQL database with task ID, timestamp, and pending status
**And** I see a "Proof Uploaded Successfully" confirmation

**Given** the upload completes
**When** I return to the task list
**Then** the task shows a "Proof Pending" status indicator
**And** the proof thumbnail appears next to the task

**Given** I have poor or no internet connection
**When** I attempt to upload a proof
**Then** the proof is queued locally via service worker
**And** I see an "Uploading when connected" message
**And** the upload automatically resumes when connectivity is restored

## Tasks / Subtasks

- [x] Implement one-tap camera access in task completion screen (AC: camera/gallery selection)
  - [x] Add PhotoProof component extension for camera integration using browser API
  - [x] Handle photo capture and gallery selection with file input fallback
- [x] Upload photo to local Docker Synology storage (AC: upload and DB record)
  - [x] Extend /tasks/proof API route to handle image upload to Synology via multer or similar
  - [x] Create proof record in PostgreSQL with task_id, timestamp, status='pending', url
  - [x] Add migration for proof_url field in tasks table if not exists
- [x] Display success confirmation and update task list (AC: confirmation and status update)
  - [x] Show Toast notification on successful upload
  - [x] Update SimpleTaskCard to show 'Proof Pending' badge and thumbnail preview
  - [x] Poll for status changes in task list via useEffect (every 30s)
- [x] Implement offline queuing with service worker (AC: offline support)
  - [x] Extend sw.ts to queue proof uploads using IndexedDB or localStorage
  - [x] Add retry logic on connectivity restore in service worker
  - [x] Show offline indicator in UI during queuing

## Dev Notes

- Relevant architecture patterns and constraints: Use existing PhotoProof component in frontend/src/components/PhotoProof.tsx for camera access. Backend upload to local Docker volume (PROOF_DIR) which can be mounted to Synology NAS storage via Docker volume configuration. Ensure RBAC: kids can only upload for their tasks.
- Source tree components to touch: frontend/src/components/PhotoProof.tsx, frontend/src/pages/TasksManager.tsx (task completion screen), backend/src/routes/tasks.ts (extend proof endpoint), backend/src/database/migrations/production-ready.ts (proof columns), frontend/src/sw.ts (queuing).
- Testing standards summary: Vitest unit tests for upload logic (mock camera/file), integration tests for API endpoint, e2e for offline flow using Playwright. Cover edge cases: no camera permission, large files, network failure.

### Project Structure Notes

- Alignment with unified project structure (paths, modules, naming): Follow frontend/src/components for UI, backend/src/routes for API. Naming: camelCase for JS, snake_case for DB. Use existing api.ts for frontend calls.
- Detected conflicts or variances (with rationale): No conflicts; extends existing proof flow without breaking current task completion.

### References

- [Source: _bmad-output/planning-artifacts/prd.md#User Journeys]: Parent oversight requires visible proofs; kid engagement needs easy upload.
- [Source: _bmad-output/planning-artifacts/architecture.md#Technical Constraints]: Polling for status, SW for offline; secure uploads with RBAC.
- [Source: docs/api-contracts-backend.md#tasks]: Extend /tasks/proof with image handling.
- [Source: frontend/src/components/PhotoProof.tsx]: Existing component for base camera functionality.

## Dev Agent Record

### Agent Model Used

grok-4-fast-reasoning

### Debug Log References

### Completion Notes List

- Added MediaDevices API camera integration to PhotoProof component with one-tap camera access, video preview, and capture functionality. Maintained fallback to file input for gallery selection and browsers without camera support.
- Added camera/upload mode toggle UI to PhotoProof component for better user experience.
- Added Toast notification system integration to PhotoProof component showing success message "Proof uploaded successfully! Waiting for parent approval." on successful upload and error message on failure.
- Updated SimpleTaskCard component to show "Proof Pending" badge (yellow) for tasks with proof_status='pending' and "Photo added" badge (green) for approved proofs.
- Added thumbnail preview image (12x12) for proofs in completed task cards with proper API URL prefix handling.
- Implemented proof status polling in TasksManager component with 30-second interval using tasksAPI.getProofStatus endpoint.
- Polling system updates task proof_status, proof_photo_url, and parent_approved fields in real-time and shows toast notifications for status updates.
- Implemented offline proof upload queuing system in service worker with IndexedDB storage for pending uploads.
- Added automatic retry logic (3 attempts) when connectivity is restored with exponential backoff.
- Added offline indicator in Layout header showing when user is offline.
- PhotoProof component now handles queued uploads with appropriate user feedback and success notifications when upload completes.
- Fixed code review issues: implemented camera/upload toggle, corrected file list documentation, clarified Docker Synology storage architecture.

### File List

- frontend/src/components/PhotoProof.tsx (modified) - Added Toast notifications, offline handling, service worker message listeners, and camera/upload mode toggle
- frontend/src/components/SimpleTaskCard.tsx (modified) - Added Proof Pending badge and thumbnail preview
- frontend/src/pages/TasksManager.tsx (modified) - Added proof status polling every 30 seconds
- frontend/src/components/Layout.tsx (modified) - Added offline indicator in header
- frontend/src/sw.ts (modified) - Added offline proof upload queuing with IndexedDB and retry logic
- backend/src/routes/tasks.ts (modified) - Added proof upload endpoint with multer storage
- backend/src/database/migrations/production-ready.ts (modified) - Added proof_photo_url column to tasks table and proofs table
- frontend/src/services/api.ts (modified for polling)

## Change Log

- 2026-01-11: Implemented proof upload success notifications and real-time status updates
  - Added Toast notifications to PhotoProof component for upload success/failure
  - Updated SimpleTaskCard to show "Proof Pending" badge and thumbnail preview
  - Implemented 30-second polling for proof status changes in TasksManager
  - Proof status updates trigger real-time UI updates and notifications
- 2026-01-11: Added offline proof upload support
  - Extended service worker to queue proof uploads in IndexedDB when offline
  - Added automatic retry logic (3 attempts) when connectivity restored
  - Added offline indicator in Layout header
  - PhotoProof component handles queued uploads with user feedback
- 2026-01-11: Code review fixes and improvements
  - Added camera/upload mode toggle UI to PhotoProof component
  - Fixed File List documentation (corrected migration file reference)
  - Clarified Docker Synology storage architecture in Dev Notes
  - Updated Completion Notes with review fixes summary