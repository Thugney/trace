# Family Hub Architecture Implementation Plan

## Overview
Implementing FAMILY_HUB_ARCHITECTURE.md - Two-tier access model (Family Type A/B) with Church School module isolation.

**Workflow:** Code -> Build -> Test -> Docker Build -> Mark [x] -> Next Task

---

## Phase 1: Database Schema Updates
### 1.1 Add Family Type Column
- [x] Add `family_type` column ('A' or 'B') to families table
- [x] Add index on family_type column
- [x] Migrate existing families to Type 'A' (full access default)

### 1.2 Add Module Permissions Table
- [x] Create `module_permissions` table (profile_id, module, permission_level, granted_at, granted_by)
- [x] Add indexes on profile_id and module columns

### 1.3 Church School Enrollment Enhancement
- [x] Verify `school_enrollments` table has family_id reference
- [x] Add family_id column with backfill migration

---

## Phase 2: Authorization Service (Backend)
### 2.1 Create Authorization Service
- [x] Create `backend/src/services/authorization.ts`
- [x] Implement `hasModuleAccess(profileId, module)` function
- [x] Implement `getUserPermissions(profileId)` function
- [x] Implement `familyHasChurchSchoolEnrollment(familyId)` function
- [x] Implement `canAccessStudentData(userId, studentId)` function

### 2.2 Create Module Access Middleware
- [x] Create `requireModuleAccess(module)` middleware in auth.ts
- [x] Module types: 'core_app', 'church_school'
- [x] Integrate with existing authenticate middleware

### 2.3 Enrollment Permission Trigger
- [x] Create function `updatePermissionsOnEnrollment(studentId, familyId)`
- [x] Grant church_school access to Family A parents when child enrolls
- [x] Revoke when no active enrollments remain

---

## Phase 3: API Routes & Endpoints
### 3.1 Permissions Endpoints
- [x] Add `GET /api/profiles/permissions` endpoint
- [x] Add `GET /api/profiles/:id/permissions` (admin only)
- [x] Return permissions in login response

### 3.2 Family Type Management
- [x] Update `POST /api/families` to accept family_type parameter
- [x] Update `PUT /api/families/:id` to handle family_type change
- [x] Auto-update member permissions when family type changes

---

## Phase 4: Frontend Implementation
### 4.1 Update TypeScript Types
- [x] Add `family_type: 'A' | 'B'` to Family interface
- [x] Add `ModulePermissions` interface
- [x] Add `LoginResponse` interface with permissions

### 4.2 Create Permissions Context
- [x] Create `frontend/src/context/PermissionsContext.tsx`
- [x] Implement `usePermissions()` hook
- [x] Implement `useModuleAccess(module)` hook
- [x] Implement `useFamilyType()` hook

### 4.3 Update API Service
- [x] Add `profilesAPI.getPermissions()` method
- [x] Add `profilesAPI.getProfilePermissions(id)` method
- [x] Update `familiesAPI.create()` with family_type
- [x] Update `familiesAPI.update()` with family_type

---

## Phase 5: Frontend Navigation
### 5.1 Dynamic Navigation Component
- [x] Update `Layout.tsx` to import usePermissions
- [x] Add module access check to isNavPathEnabled
- [x] Family B users only see church school navigation
- [x] Family A users see full navigation (with church school if enrolled)

### 5.2 Kid Nav Items
- [x] Update getKidNavItems to respect module permissions
- [x] Family B children only see church school items

---

## Phase 6: Build & Testing
- [x] Backend build successful
- [x] Frontend build successful
- [x] Docker build successful

---

## Remaining Work (Future Phases)

### Phase 7: Route Protection in App.tsx
- [x] Create ModuleProtectedRoute component
- [x] Protect core app routes with core_app module access
- [x] Protect church school routes with church_school access
- [x] Redirect Family B users to /school on unauthorized routes

### Phase 8: Admin Family Management UI
- [x] Add family type selector in admin family creation form
- [x] Add family type indicator in family list
- [x] Add family type change confirmation dialog (info box in modal)

### Phase 9: Church School Enrollment Hooks
- [x] Update school enrollment route to trigger permission updates
- [x] Update school unenrollment to check/revoke permissions
- [x] Add visual indicator when Family A gains church school access (via navigation showing School item)

### Phase 10: Testing & Validation
- [ ] Test Family A creation and full access
- [ ] Test Family B creation and church school only access
- [ ] Test Family A child enrollment grants church school to parents
- [ ] Test teacher access (church school only)
- [ ] Test admin access (full access)

---

## Architecture Summary

### Family Type A (Full Access)
- Core App: YES
- Church School: IF any child enrolled

### Family Type B (Church School Only)
- Core App: NO
- Church School: YES

### Teacher
- Core App: NO
- Church School: YES

### Admin
- Core App: YES
- Church School: YES

---

## Files Modified

### Backend
- `backend/src/database/init.ts` - Added family_type column, module_permissions table
- `backend/src/services/authorization.ts` - NEW - Authorization service
- `backend/src/middleware/auth.ts` - Added requireModuleAccess middleware
- `backend/src/routes/profiles.ts` - Added permissions endpoints, updated login
- `backend/src/routes/families.ts` - Added family_type support in create/update

### Frontend
- `frontend/src/types/index.ts` - Added ModulePermissions, FamilyInfo, LoginResponse
- `frontend/src/context/PermissionsContext.tsx` - NEW - Permissions context
- `frontend/src/services/api.ts` - Added permissions API methods
- `frontend/src/components/Layout.tsx` - Updated navigation with module access
- `frontend/src/App.tsx` - Added PermissionsProvider

---

## Current Status
**Phase:** 9 - Church School Enrollment Hooks
**Status:** COMPLETE

School enrollment triggers permission updates (grants church_school to Family A parents). School unenrollment checks and revokes church_school when no children remain enrolled. Visual indicator is the School navigation item appearing/disappearing based on permissions.
