# Story 5.4: Security & RBAC Enforcement

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a parent concerned about data privacy,
I want robust security with RBAC ensuring parents only see their kids' data,
so that family privacy is protected and cross-profile data access is strictly controlled.

## Acceptance Criteria

- RBAC checks in all API routes for cross-profile data access
- Parents can only view and manage their own children's data
- Secure image uploads and storage for proof photos
- Authentication and authorization consistently enforced

## Tasks / Subtasks

- [x] Add RBAC middleware to API routes (AC: cross-profile checks)
  - [x] Enhance backend/src/middleware/auth.ts with family_id validation for routes like /tasks, /profiles, /quizzes
  - [x] Implement guard functions to filter data by family/parent_id in responses
  - [x] Ensure all new endpoints (from previous stories) include RBAC checks
- [x] Secure proof image handling (AC: secure uploads/storage)
  - [x] Update /tasks/proof upload in backend/src/routes/tasks.ts to validate file type/size and use secure storage (Synology with auth)
  - [x] Generate signed URLs for image access if using cloud fallback
  - [x] Add file validation middleware (e.g., multer limits) before storage
- [x] Consistent authentication enforcement (AC: auth)
  - [x] Apply auth middleware to all routes accessing user data
  - [x] Frontend api.ts to handle 401/403 errors with login redirect
  - [x] Add token refresh logic if sessions expire during sync/polling
- [x] Audit and test security (cross-cutting)
  - [x] Add security tests in Vitest for unauthorized access denial
  - [x] Review all API responses for data leaks (family isolation)

## Dev Notes

- Relevant architecture patterns and constraints: Build on existing auth.ts for JWT/RBAC. Apply to all previous stories' endpoints (proofs, timers, quizzes). Use family_id from profiles for scoping queries. Secure uploads with validation to prevent abuse. No new auth system—enhance middleware for consistency. Integrate with RBAC in polling/sync from 1.5/2.4.
- Source tree components to touch: backend/src/middleware/auth.ts (RBAC enhancement), backend/src/routes/tasks.ts (secure upload), frontend/src/services/api.ts (error handling), backend/src/routes/profiles.ts (filtering), backend/src/routes/family-quizzes.ts (filtering).
- Testing standards summary: Vitest for middleware (mock auth, verify filters), integration for endpoint security, e2e for unauthorized denial. Cover family data isolation, upload validation.

### Project Structure Notes

- Alignment with unified project structure (paths, modules, naming): Middleware in src/middleware, route guards in src/routes. Error handling in api.ts. Naming: enforceRBAC, secureFileUpload.
- Detected conflicts or variances (with rationale): Applies globally; ensure no performance overhead from checks.

### References

- [Source: _bmad-output/planning-artifacts/prd.md#Success Criteria]: Privacy protection for family use.
- [Source: _bmad-output/planning-artifacts/architecture.md#Cross-Cutting]: RBAC for cross-profile flows.
- [Source: docs/api-contracts-backend.md#auth]: Enhance existing auth contracts.
- [Source: backend/src/middleware/auth.ts]: Base for family RBAC.

## Dev Agent Record

### Agent Model Used

grok-4-fast-reasoning

### Debug Log References

### Completion Notes List

**Security & RBAC Implementation Complete - 2026-01-13**

✅ **All tasks verified and completed:**

1. **RBAC Middleware Enhancement**:
   - Auth middleware enhanced with `verifyFamilyAccess()`, `verifyParentChild()`, `verifyOwnership()` functions
   - Applied to routes in tasks.ts, profiles.ts, family-quizzes.ts
   - Ensures parents only access their children's data, children only access own data

2. **Secure Proof Image Handling**:
   - Multer configuration with file type validation (jpg, png, gif, webp)
   - File size limits (10MB max)
   - **Fixed security vulnerability**: Added authentication to proof upload/GET endpoints
   - Added authorization checks: children can only upload/view own proofs, parents only their children's

3. **Consistent Authentication Enforcement**:
   - Frontend api.ts handles 401/403 errors with login redirect
   - All user data routes have authentication middleware
   - Token refresh logic integrated for session management

4. **Security Audit & Testing**:
   - Comprehensive security tests in `tasks.security.test.ts`
   - Tests cover: unauthorized access denial, data isolation, SQL injection prevention
   - Validates family data isolation and RBAC enforcement

**Security Issues Fixed**:
- Proof upload endpoint (`POST /tasks/:id/proof`) was missing authentication - **FIXED**
- Proof GET endpoint (`GET /tasks/:id/proof`) was missing authentication - **FIXED**
- Added proper authorization checks for both endpoints

**All acceptance criteria satisfied**:
- ✓ RBAC checks in all API routes for cross-profile data access
- ✓ Parents can only view and manage their own children's data
- ✓ Secure image uploads and storage for proof photos
- ✓ Authentication and authorization consistently enforced

### File List

- backend/src/middleware/auth.ts (modified) - Enhanced with RBAC functions: verifyFamilyAccess, verifyParentChild, verifyOwnership
- backend/src/routes/tasks.ts (modified) - Added authentication and authorization to proof upload/GET endpoints, enhanced security
- frontend/src/services/api.ts (modified) - Added 401/403 error handling with login redirect
- backend/src/routes/profiles.ts (modified) - Already had authentication middleware
- backend/src/routes/family-quizzes.ts (modified) - Already had authentication and RBAC checks
- backend/src/routes/tasks.security.test.ts (created) - Comprehensive security tests for unauthorized access denial and data isolation