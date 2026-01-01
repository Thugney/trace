# Critical Security & Features Fix Plan

## Issues Identified

### 1. ❌ Authentication Headers Missing (401 Errors)
**Problem:** Admin getting 401 Unauthorized errors because authentication headers not being sent
**Impact:** Admin cannot access profiles API or settings API
**Fix:** Add axios interceptor to send x-profile-id header with every authenticated request

### 2. ❌ Password Management Missing
**Problem:** Parents cannot change from PIN to password, no UI for password management
**Impact:** Users stuck with PINs, cannot use secure passwords
**Fix:**
- Add "Change Password" section in Settings for parents and admin
- Add "Change from PIN to Password" option
- Add password strength indicator

### 3. ❌ Admin Add Profile Limited
**Problem:** Admin's "Add Profile" modal only shows Child and Parent options
**Expected:** Admin should be able to create ALL types: child, parent, teacher, admin
**Fix:**
- Conditionally show all 4 profile types when admin is adding
- Parents still only see "child" option

### 4. ❌ Admin Cannot Edit All Profiles
**Problem:** No UI for admin to edit other users' profiles (teachers, parents, kids)
**Expected:** Admin should have full edit access to all profiles
**Fix:**
- Add "Edit" button on each profile in Family Profiles section (admin only)
- Add modal to edit any profile
- Allow changing type, name, age, password, permissions

### 5. ❌ Predefined Enrollment System
**Problem:** School enrollments are predefined in database, parents cannot enroll their kids
**Expected:** Parents should dynamically enroll their kids to classes/teachers
**Fix:**
- Add "Enroll Children" section to Parent Dashboard
- Show available classes/teachers
- Let parents enroll/unenroll their kids
- Backend: Add parent authorization to enrollment endpoints

### 6. ❌ Parent Cannot Reset Kids' Passwords
**Problem:** No UI for parents to reset their children's PINs
**Expected:** Parents should be able to reset their kids' PINs for security
**Fix:**
- Add "Reset PIN" button on each child in Family Profiles
- Use existing POST /api/profiles/:id/reset-password endpoint with parentId

---

## Implementation Plan

### Phase 1: Authentication Fix (URGENT - Blocking Admin)
1. ✅ Add axios request interceptor to send x-profile-id header
2. ✅ Test admin login and settings access

### Phase 2: Password Management
1. ✅ Add "Password Management" section to Settings (parent & admin)
2. ✅ Add "Set Password" form (replaces PIN with password)
3. ✅ Add "Change Password" form (current + new)
4. ✅ Backend: Update password via PUT /api/profiles/:id

### Phase 3: Admin Capabilities
1. ✅ Fix "Add Profile" modal to show all types for admin
2. ✅ Add "Edit Profile" button for admin on all profiles
3. ✅ Add "Edit Profile" modal with full permissions
4. ✅ Add "Delete Profile" button (admin only, with confirmation)
5. ✅ Ensure admin AI controls show ALL children (not just linked)

### Phase 4: Parent Enrollment System
1. ✅ Add "Enroll Children" section to Parent Dashboard
2. ✅ GET /api/school/classes - show available classes
3. ✅ POST /api/school/enrollments - parent can enroll their kids
4. ✅ DELETE /api/school/enrollments/:id - parent can unenroll
5. ✅ Backend: Add parent authorization (can only enroll own kids)

### Phase 5: Parent Kid Management
1. ✅ Add "Reset PIN" button for each child in Family Profiles
2. ✅ Add reset PIN modal (enter new PIN twice)
3. ✅ POST /api/profiles/:id/reset-password with parentId
4. ✅ Backend: Verify parent owns this child before reset

---

## Critical Fixes Priority

### PRIORITY 1 (NOW): Fix Admin Access
- [ ] Add authentication headers to axios
- [ ] Test admin can access settings without 401 errors

### PRIORITY 2 (NEXT): Admin Full Control
- [ ] Admin can create all profile types
- [ ] Admin can edit all profiles
- [ ] Admin can delete profiles
- [ ] Admin sees all children in AI controls

### PRIORITY 3: Password Management
- [ ] Parents can set/change passwords
- [ ] Parents can reset kids' PINs
- [ ] Password strength validation

### PRIORITY 4: Parent Enrollment
- [ ] Parents can enroll kids to classes
- [ ] Parents can unenroll kids
- [ ] Parents see enrollment status

---

## Testing Checklist

### Admin Tests
- [ ] Admin login works without 401 errors
- [ ] Admin can create child, parent, teacher, admin profiles
- [ ] Admin can edit any profile
- [ ] Admin can delete any profile (except self)
- [ ] Admin sees all children in AI controls
- [ ] Admin can change any user's password/PIN

### Parent Tests
- [ ] Parent can set/change own password
- [ ] Parent can reset kids' PINs
- [ ] Parent can enroll kids to classes
- [ ] Parent can unenroll kids from classes
- [ ] Parent can only see own kids (not others)
- [ ] Parent can create new child profiles

### Security Tests
- [ ] Parent CANNOT see other families
- [ ] Parent CANNOT edit other families' kids
- [ ] Parent CANNOT create teacher/admin profiles
- [ ] Teacher CANNOT access admin features
- [ ] Children CANNOT access parent features

---

## Database Schema Considerations

### Current Tables
- profiles (id, name, type, parent_id, pin, password, ...)
- school_classes (id, name, teacher_id, ...)
- school_enrollments (id, student_id, class_id, ...)

### Enrollment Authorization
- Enrollments table should track WHO enrolled the student
- Add enrolled_by_id column (parent or admin who enrolled)
- Parent can only delete enrollments they created OR for their own kids

---

## API Endpoints to Add/Fix

### New/Modified Endpoints
1. **PUT /api/profiles/:id/password** - Set/change password (auth required)
2. **POST /api/profiles/:id/reset-pin** - Parent reset kid's PIN
3. **GET /api/school/enrollments/my-children** - Parent's kids' enrollments
4. **POST /api/school/enrollments** - With parent authorization
5. **DELETE /api/school/enrollments/:id** - With parent authorization

---

## UI Components to Add/Modify

### Settings.tsx
- [ ] Add Password Management section (parent & admin)
- [ ] Add "Reset PIN" button per child (parent only)
- [ ] Add "Edit Profile" button per profile (admin only)
- [ ] Add "Delete Profile" button (admin only)
- [ ] Fix "Add Profile" to show all types (admin)

### ParentDashboard.tsx
- [ ] Add "My Children's Enrollments" section
- [ ] Show each child with their classes
- [ ] Add "Enroll to Class" button per child
- [ ] Add "Unenroll" button per enrollment

### AdminDashboard.tsx (if exists) or Settings
- [ ] Show all users with edit/delete buttons
- [ ] Add User Management section

---

## Notes
- All changes must maintain existing security model
- Admin = sudo, can do everything
- Parent = manage self + own kids only
- Teacher = manage self + assigned classes
- Child = view self only
