# FAMILY HUB APP - COMPLETE ARCHITECTURE SPECIFICATION

## 📋 EXECUTIVE SUMMARY

**App Name**: Family Hub  
**Core Feature**: Multi-family management platform  
**Nested Module**: Church School (optional module within Family Hub)  
**Current State**: Almost fully developed, needs architectural refinement  

---

## 🎯 BUSINESS LOGIC OVERVIEW

### The Two-Tier Access Model

```
┌─────────────────────────────────────────────────────────────┐
│                         ADMIN                                │
│              (Controls everything)                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌───────────────┐    ┌──────────────────┐
│   FAMILY A    │    │    FAMILY B      │
│  (Full Access)│    │(Church School    │
│               │    │    Only)         │
└───────┬───────┘    └────────┬─────────┘
        │                     │
        │                     │
        ├─► Core App Features │
        │   (Calendar, etc)   │
        │                     │
        └─────────┬───────────┘
                  │
                  ▼
        ┌─────────────────────┐
        │   CHURCH SCHOOL     │
        │      MODULE         │
        │                     │
        │  - Family A (if     │
        │    kids enrolled)   │
        │  - Family B         │
        │  - Teachers         │
        │  - Students         │
        └─────────────────────┘
```

---

## 👥 USER ROLES & PERMISSIONS MATRIX

### Role 1: ADMIN
**Access Level**: GLOBAL  
**Permissions**:
- ✅ Create/Edit/Delete families (Type A and B)
- ✅ Grant Family A → Full app access
- ✅ Grant Family B → Church school access only
- ✅ Manage all app features and modules
- ✅ Override all permissions
- ✅ View all data across families

**Key Responsibilities**:
1. Onboard new families and assign type (A or B)
2. Enable/disable church school access for families
3. Manage teacher accounts
4. System-wide configuration

---

### Role 2: FAMILY A (Parents)
**Access Level**: FULL APP + CONDITIONAL CHURCH SCHOOL  
**Base Permissions**:
- ✅ Access ALL core Family Hub features:
  - Family calendar
  - Task management
  - Communication tools
  - Document sharing
  - Any other app-wide features
- ✅ Manage their own children's profiles
- ✅ Set parental controls for their kids
- ✅ View/edit family settings

**Extended Permissions** (Activated when ANY child enrolls in Church School):
- ✅ ALL base permissions above (retained)
- ✅ PLUS Church School parent features:
  - View child's assignments
  - See grades and progress
  - Read teacher feedback
  - View homework
  - Communicate with teachers
  - Track attendance

**Important Logic**:
```javascript
// Pseudo-code for Family A permission check
function getFamilyAPermissions(family) {
  let permissions = {
    coreApp: true,
    parentControls: true,
    churchSchool: false
  };
  
  // Check if any child is enrolled in church school
  if (family.children.some(child => child.enrolledInChurchSchool)) {
    permissions.churchSchool = true;
  }
  
  return permissions;
}
```

---

### Role 3: FAMILY B (Parents)
**Access Level**: CHURCH SCHOOL ONLY  
**Permissions**:
- ❌ NO access to core Family Hub features
- ✅ Church School parent features ONLY:
  - View child's assignments
  - See grades and progress
  - Read teacher feedback
  - View homework
  - Communicate with teachers
  - Track child's church school attendance

**UI Implications**:
- Family B parents should NOT see navigation to core app features
- Their dashboard shows ONLY church school module
- Login redirects directly to Church School portal

---

### Role 4: TEACHERS
**Access Level**: CHURCH SCHOOL ONLY (Teacher Portal)  
**Permissions**:
- ❌ NO access to core Family Hub features
- ❌ NO access to family management
- ✅ Church School teaching features:
  - Create/edit/delete assignments
  - Grade student work
  - Provide feedback to students
  - Mark attendance
  - Communicate with parents (Family A & B)
  - View student progress
  - Manage class roster

**Scope Limitation**:
- Teachers can ONLY see students enrolled in their classes
- Cannot see other teachers' classes or students
- Cannot access family data outside church school context

---

### Role 5: CHILDREN/STUDENTS
**Access Level**: Varies by family type and enrollment

**Family A Children** (Parents have full access):
- ✅ Access features appropriate to their age/parent settings
- ✅ Use core app features (based on parental controls)
- ✅ IF enrolled in church school:
  - View their assignments
  - Submit homework
  - See their grades
  - Receive teacher feedback

**Family B Children** (Parents have church school only):
- ❌ NO access to core app features
- ✅ Church school student features ONLY:
  - View assignments
  - Submit homework
  - See grades
  - Receive teacher feedback

---

## 🏗️ SYSTEM ARCHITECTURE

### Module Structure

```
family-hub-app/
│
├── core/                          # Core Family Hub features
│   ├── authentication/            # Shared auth for all users
│   ├── authorization/             # RBAC middleware
│   ├── family-management/         # Family A only
│   ├── calendar/                  # Family A only
│   ├── tasks/                     # Family A only
│   ├── communication/             # Family A only
│   └── settings/                  # Family A only
│
├── church-school/                 # Church School Module (Isolated)
│   ├── student-portal/
│   │   ├── assignments/
│   │   ├── homework/
│   │   ├── grades/
│   │   └── feedback/
│   │
│   ├── parent-portal/
│   │   ├── progress-tracking/
│   │   ├── teacher-communication/
│   │   ├── homework-view/
│   │   └── assignment-feedback/
│   │
│   ├── teacher-portal/
│   │   ├── class-management/
│   │   ├── assignment-creation/
│   │   ├── grading/
│   │   ├── attendance/
│   │   └── parent-communication/
│   │
│   └── enrollment/                # Manages student enrollment
│
├── admin/                         # Admin controls
│   ├── family-provisioning/       # Create families A & B
│   ├── access-control/            # Grant permissions
│   ├── teacher-management/
│   └── system-config/
│
└── shared/                        # Shared utilities
    ├── components/
    ├── hooks/
    └── utils/
```

---

## 🗄️ DATABASE SCHEMA (Refined)

### Core Tables

#### 1. `users` table
```sql
CREATE TABLE users (
    user_id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    user_type ENUM('admin', 'parent', 'teacher', 'student'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);
```

#### 2. `families` table
```sql
CREATE TABLE families (
    family_id UUID PRIMARY KEY,
    family_name VARCHAR(255),
    family_type ENUM('A', 'B') NOT NULL,
    -- A = Full Access, B = Church School Only
    created_by UUID REFERENCES users(user_id), -- Admin who created
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Indexes
CREATE INDEX idx_family_type ON families(family_type);
```

#### 3. `family_members` table
```sql
CREATE TABLE family_members (
    member_id UUID PRIMARY KEY,
    family_id UUID REFERENCES families(family_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    role ENUM('parent', 'child') NOT NULL,
    date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(family_id, user_id)
);

-- Indexes
CREATE INDEX idx_family_members_family ON family_members(family_id);
CREATE INDEX idx_family_members_user ON family_members(user_id);
```

#### 4. `permissions` table
```sql
CREATE TABLE permissions (
    permission_id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    module VARCHAR(100) NOT NULL,
    -- Possible values: 'core_app', 'church_school'
    permission_level VARCHAR(50) NOT NULL,
    -- Possible values: 'admin', 'parent', 'teacher', 'student', 'none'
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID REFERENCES users(user_id),
    UNIQUE(user_id, module)
);

-- Indexes
CREATE INDEX idx_permissions_user ON permissions(user_id);
CREATE INDEX idx_permissions_module ON permissions(module);
```

### Church School Tables

#### 5. `church_school_classes` table
```sql
CREATE TABLE church_school_classes (
    class_id UUID PRIMARY KEY,
    class_name VARCHAR(255) NOT NULL,
    teacher_id UUID REFERENCES users(user_id),
    grade_level VARCHAR(50),
    school_year VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);
```

#### 6. `church_school_enrollment` table
```sql
CREATE TABLE church_school_enrollment (
    enrollment_id UUID PRIMARY KEY,
    student_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    class_id UUID REFERENCES church_school_classes(class_id) ON DELETE CASCADE,
    family_id UUID REFERENCES families(family_id),
    enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(student_id, class_id, school_year)
);

-- This table is CRITICAL for triggering Family A extended permissions
```

#### 7. `assignments` table
```sql
CREATE TABLE assignments (
    assignment_id UUID PRIMARY KEY,
    class_id UUID REFERENCES church_school_classes(class_id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(user_id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 8. `student_submissions` table
```sql
CREATE TABLE student_submissions (
    submission_id UUID PRIMARY KEY,
    assignment_id UUID REFERENCES assignments(assignment_id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    submission_text TEXT,
    submission_file_url VARCHAR(500),
    submitted_at TIMESTAMP,
    grade DECIMAL(5,2),
    teacher_feedback TEXT,
    graded_at TIMESTAMP,
    UNIQUE(assignment_id, student_id)
);
```

#### 9. `attendance` table
```sql
CREATE TABLE attendance (
    attendance_id UUID PRIMARY KEY,
    class_id UUID REFERENCES church_school_classes(class_id),
    student_id UUID REFERENCES users(user_id),
    attendance_date DATE,
    status ENUM('present', 'absent', 'late', 'excused'),
    notes TEXT,
    recorded_by UUID REFERENCES users(user_id), -- Teacher
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(class_id, student_id, attendance_date)
);
```

---

## 🔐 AUTHORIZATION LOGIC (Critical Implementation)

### Access Control Middleware

```javascript
/**
 * CORE AUTHORIZATION MIDDLEWARE
 * This runs on EVERY request to determine user access
 */

class AuthorizationService {
  
  /**
   * Check if user has access to a specific module
   */
  async hasModuleAccess(userId, module) {
    // module can be: 'core_app', 'church_school'
    
    const user = await db.users.findById(userId);
    
    // Admin has access to everything
    if (user.user_type === 'admin') {
      return true;
    }
    
    // Teachers only have church school access
    if (user.user_type === 'teacher') {
      return module === 'church_school';
    }
    
    // For parents and students, check family type and enrollment
    if (user.user_type === 'parent' || user.user_type === 'student') {
      const familyMember = await db.family_members.findByUserId(userId);
      const family = await db.families.findById(familyMember.family_id);
      
      // Family A logic
      if (family.family_type === 'A') {
        if (module === 'core_app') {
          return true; // Family A always has core app access
        }
        
        if (module === 'church_school') {
          // Check if ANY child in family is enrolled
          const hasEnrolledChild = await this.familyHasChurchSchoolEnrollment(family.family_id);
          return hasEnrolledChild;
        }
      }
      
      // Family B logic
      if (family.family_type === 'B') {
        if (module === 'core_app') {
          return false; // Family B NEVER has core app access
        }
        
        if (module === 'church_school') {
          return true; // Family B always has church school access
        }
      }
    }
    
    return false;
  }
  
  /**
   * Check if family has any children enrolled in church school
   * CRITICAL for Family A extended permissions
   */
  async familyHasChurchSchoolEnrollment(familyId) {
    const enrollment = await db.query(`
      SELECT COUNT(*) as count
      FROM church_school_enrollment
      WHERE family_id = ? AND is_active = true
    `, [familyId]);
    
    return enrollment[0].count > 0;
  }
  
  /**
   * Get user's complete permission set
   */
  async getUserPermissions(userId) {
    const user = await db.users.findById(userId);
    const permissions = {
      coreApp: false,
      churchSchool: false,
      role: user.user_type
    };
    
    // Admin gets everything
    if (user.user_type === 'admin') {
      permissions.coreApp = true;
      permissions.churchSchool = true;
      return permissions;
    }
    
    // Teacher gets church school only
    if (user.user_type === 'teacher') {
      permissions.churchSchool = true;
      return permissions;
    }
    
    // Parents and students - check family type
    const familyMember = await db.family_members.findByUserId(userId);
    if (familyMember) {
      const family = await db.families.findById(familyMember.family_id);
      
      if (family.family_type === 'A') {
        permissions.coreApp = true;
        
        // Check for church school enrollment
        const hasEnrollment = await this.familyHasChurchSchoolEnrollment(family.family_id);
        permissions.churchSchool = hasEnrollment;
      }
      
      if (family.family_type === 'B') {
        permissions.coreApp = false;
        permissions.churchSchool = true;
      }
    }
    
    return permissions;
  }
  
  /**
   * Check if user can access specific student data
   */
  async canAccessStudentData(userId, studentId) {
    const user = await db.users.findById(userId);
    
    // Admin can access all
    if (user.user_type === 'admin') return true;
    
    // Teachers can access their students
    if (user.user_type === 'teacher') {
      const isInClass = await db.query(`
        SELECT COUNT(*) as count
        FROM church_school_enrollment e
        JOIN church_school_classes c ON e.class_id = c.class_id
        WHERE e.student_id = ? AND c.teacher_id = ? AND e.is_active = true
      `, [studentId, userId]);
      
      return isInClass[0].count > 0;
    }
    
    // Parents can access their own children
    if (user.user_type === 'parent') {
      const isParentOfStudent = await db.query(`
        SELECT COUNT(*) as count
        FROM family_members fm1
        JOIN family_members fm2 ON fm1.family_id = fm2.family_id
        WHERE fm1.user_id = ? AND fm1.role = 'parent'
          AND fm2.user_id = ? AND fm2.role = 'child'
      `, [userId, studentId]);
      
      return isParentOfStudent[0].count > 0;
    }
    
    // Students can only access their own data
    if (user.user_type === 'student') {
      return userId === studentId;
    }
    
    return false;
  }
}

module.exports = new AuthorizationService();
```

---

## 🚦 API ENDPOINTS & AUTHORIZATION

### Example: Assignment Endpoints

```javascript
/**
 * GET /api/church-school/assignments
 * Get assignments based on user role
 */
router.get('/assignments', authenticate, async (req, res) => {
  const userId = req.user.id;
  const user = await db.users.findById(userId);
  
  // Check if user has church school access
  const hasAccess = await authService.hasModuleAccess(userId, 'church_school');
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied to church school' });
  }
  
  let assignments;
  
  // Teacher: Get assignments they created
  if (user.user_type === 'teacher') {
    assignments = await db.assignments.findByTeacher(userId);
  }
  
  // Student: Get assignments for their classes
  if (user.user_type === 'student') {
    assignments = await db.assignments.findByStudent(userId);
  }
  
  // Parent: Get assignments for their children
  if (user.user_type === 'parent') {
    const children = await db.family_members.findChildren(userId);
    assignments = await db.assignments.findByStudents(children.map(c => c.user_id));
  }
  
  res.json(assignments);
});

/**
 * POST /api/church-school/assignments
 * Create new assignment (Teachers only)
 */
router.post('/assignments', authenticate, async (req, res) => {
  const userId = req.user.id;
  const user = await db.users.findById(userId);
  
  // Only teachers can create assignments
  if (user.user_type !== 'teacher') {
    return res.status(403).json({ error: 'Only teachers can create assignments' });
  }
  
  const assignment = await db.assignments.create({
    ...req.body,
    teacher_id: userId
  });
  
  res.status(201).json(assignment);
});
```

---

## 🎨 UI/UX NAVIGATION RULES

### Dynamic Navigation Based on Permissions

```javascript
/**
 * FRONTEND: Navigation Component
 */

function AppNavigation({ user, permissions }) {
  
  const navItems = [];
  
  // Admin sees everything
  if (user.user_type === 'admin') {
    navItems.push(
      { label: 'Dashboard', path: '/admin/dashboard' },
      { label: 'Families', path: '/admin/families' },
      { label: 'Church School', path: '/admin/church-school' },
      { label: 'Settings', path: '/admin/settings' }
    );
  }
  
  // Family A parents
  if (user.user_type === 'parent' && permissions.coreApp) {
    navItems.push(
      { label: 'Home', path: '/dashboard' },
      { label: 'Calendar', path: '/calendar' },
      { label: 'Tasks', path: '/tasks' },
      { label: 'Family', path: '/family' }
    );
    
    // Add church school if enrolled
    if (permissions.churchSchool) {
      navItems.push(
        { label: 'Church School', path: '/church-school' }
      );
    }
  }
  
  // Family B parents (church school only)
  if (user.user_type === 'parent' && !permissions.coreApp && permissions.churchSchool) {
    navItems.push(
      { label: 'Church School', path: '/church-school' }
    );
  }
  
  // Teachers (church school only)
  if (user.user_type === 'teacher') {
    navItems.push(
      { label: 'My Classes', path: '/church-school/classes' },
      { label: 'Assignments', path: '/church-school/assignments' },
      { label: 'Attendance', path: '/church-school/attendance' },
      { label: 'Gradebook', path: '/church-school/gradebook' }
    );
  }
  
  // Students
  if (user.user_type === 'student') {
    if (permissions.coreApp) {
      navItems.push(
        { label: 'Home', path: '/student/dashboard' }
      );
    }
    
    if (permissions.churchSchool) {
      navItems.push(
        { label: 'Assignments', path: '/church-school/my-assignments' },
        { label: 'Grades', path: '/church-school/my-grades' }
      );
    }
  }
  
  return (
    <nav>
      {navItems.map(item => (
        <NavLink key={item.path} to={item.path}>{item.label}</NavLink>
      ))}
    </nav>
  );
}
```

---

## 🔄 KEY USER FLOWS

### Flow 1: Admin Creates Family A

```
1. Admin logs in
2. Admin navigates to "Families" → "Create New Family"
3. Admin selects "Family Type: A (Full Access)"
4. Admin enters family details and creates parent account
5. System automatically grants:
   ✅ Core app access
   ✅ Parent role permissions
   ❌ Church school access (not yet - no enrollment)
6. Parent receives invitation email
7. Parent logs in and sees full app navigation
```

### Flow 2: Admin Creates Family B

```
1. Admin logs in
2. Admin navigates to "Families" → "Create New Family"
3. Admin selects "Family Type: B (Church School Only)"
4. Admin enters family details and creates parent account
5. System automatically grants:
   ❌ Core app access (denied)
   ✅ Church school access
   ✅ Parent role permissions
6. Parent receives invitation email
7. Parent logs in and is redirected DIRECTLY to Church School portal
   (No core app navigation visible)
```

### Flow 3: Family A Child Enrolls in Church School

```
1. Admin or Teacher enrolls Family A child in church school class
2. System creates record in church_school_enrollment table
3. TRIGGER: System detects Family A has enrolled child
4. System automatically extends Family A parent permissions:
   ✅ Existing core app access (unchanged)
   ✅ NEW: Church school parent access (added)
5. Next time Family A parent logs in:
   - Sees existing navigation
   - PLUS new "Church School" navigation item
6. Family A parent can now:
   - View child's assignments
   - See grades
   - Read teacher feedback
   - Track progress
   - All WHILE maintaining full app access
```

### Flow 4: Teacher Views Student Progress

```
1. Teacher logs in (redirected to Church School portal)
2. Teacher sees only "My Classes" navigation
3. Teacher selects a class
4. System shows ONLY students enrolled in THAT specific class
5. Teacher can:
   - Create assignments for class
   - Grade submissions
   - Provide feedback
   - Mark attendance
   - Message parents (both Family A and B)
6. Teacher CANNOT see:
   - Students from other teachers' classes
   - Family information outside church school context
   - Core app features
```

### Flow 5: Family B Parent Views Child's Homework

```
1. Family B parent logs in
2. System redirects to Church School dashboard (ONLY view available)
3. Parent sees navigation:
   - Assignments
   - Grades
   - Progress
   - Teacher Messages
4. Parent selects child (if multiple children)
5. System shows:
   ✅ Church school assignments
   ✅ Grades and feedback
   ✅ Teacher communications
   ❌ NO core app features visible
   ❌ NO other children's data (if not in church school)
```

---

## 🚨 CRITICAL BUSINESS RULES

### Rule 1: Family Type is Immutable Once Set
```sql
-- Family type should NOT change after creation
-- If change needed, admin must create new family and migrate data
```

### Rule 2: Church School Access is Automatic for Family B
```javascript
// When Family B is created, church_school access is IMMEDIATE
// No enrollment needed for parents to access portal
```

### Rule 3: Family A Gets Church School Access ONLY When Child Enrolls
```javascript
// TRIGGER this check whenever enrollment changes
async function checkFamilyAChurchSchoolAccess(familyId) {
  const hasEnrollment = await db.query(`
    SELECT COUNT(*) as count 
    FROM church_school_enrollment 
    WHERE family_id = ? AND is_active = true
  `, [familyId]);
  
  if (hasEnrollment[0].count > 0) {
    // Grant church school access to all Family A parents
    await grantChurchSchoolAccessToFamilyParents(familyId);
  } else {
    // Revoke church school access (no enrolled children)
    await revokeChurchSchoolAccessFromFamilyParents(familyId);
  }
}
```

### Rule 4: Teachers See Only Their Students
```javascript
// ALWAYS filter by teacher_id in class queries
const classes = await db.query(`
  SELECT * FROM church_school_classes 
  WHERE teacher_id = ? AND is_active = true
`, [teacherId]);
```

### Rule 5: Parents See Only Their Children's Data
```javascript
// ALWAYS verify parent-child relationship
async function verifyParentChildRelationship(parentId, studentId) {
  const relationship = await db.query(`
    SELECT COUNT(*) as count
    FROM family_members fm1
    JOIN family_members fm2 ON fm1.family_id = fm2.family_id
    WHERE fm1.user_id = ? AND fm1.role = 'parent'
      AND fm2.user_id = ? AND fm2.role = 'child'
  `, [parentId, studentId]);
  
  return relationship[0].count > 0;
}
```

---

## 🔧 REFACTORING CHECKLIST (For Existing App)

### ✅ Phase 1: Database Schema Audit
- [ ] Verify `families` table has `family_type` column (A/B)
- [ ] Verify `permissions` table tracks module access
- [ ] Verify `church_school_enrollment` table exists
- [ ] Add indexes for performance on family_type, user_id, family_id
- [ ] Create database triggers or app-level hooks for enrollment changes

### ✅ Phase 2: Authorization Middleware
- [ ] Implement `hasModuleAccess()` function
- [ ] Implement `getUserPermissions()` function
- [ ] Implement `canAccessStudentData()` function
- [ ] Add authorization checks to ALL API endpoints
- [ ] Test with each user role (admin, family A, family B, teacher, student)

### ✅ Phase 3: Frontend Navigation
- [ ] Create dynamic navigation component based on permissions
- [ ] Implement route guards for protected routes
- [ ] Hide/show menu items based on user role
- [ ] Add redirect logic for Family B (church school only)
- [ ] Test navigation for each user type

### ✅ Phase 4: Church School Module Isolation
- [ ] Ensure church school features are in separate directory
- [ ] Remove core app imports from church school code
- [ ] Verify teachers cannot access core app routes
- [ ] Verify Family B cannot access core app routes
- [ ] Test module isolation

### ✅ Phase 5: Family A Extended Permissions
- [ ] Implement enrollment detection logic
- [ ] Add church school navigation when child enrolls
- [ ] Test permission extension (should keep core app access)
- [ ] Test permission revocation (when no children enrolled)
- [ ] Verify parents see combined features correctly

### ✅ Phase 6: Data Scoping & Security
- [ ] Verify teachers see only their students
- [ ] Verify parents see only their children
- [ ] Verify students see only their own data
- [ ] Add database-level constraints where possible
- [ ] Implement logging for permission violations

### ✅ Phase 7: Testing
- [ ] Unit tests for authorization functions
- [ ] Integration tests for each user flow
- [ ] E2E tests for critical paths
- [ ] Security testing (privilege escalation attempts)
- [ ] Performance testing with large datasets

---

## 📝 CODE IMPLEMENTATION EXAMPLES

### Example 1: Enrollment Trigger (Backend)

```javascript
/**
 * When a student is enrolled, update Family A permissions if applicable
 */
async function enrollStudentInChurchSchool(studentId, classId) {
  // Create enrollment record
  const enrollment = await db.church_school_enrollment.create({
    student_id: studentId,
    class_id: classId,
    enrollment_date: new Date(),
    is_active: true
  });
  
  // Get student's family
  const familyMember = await db.family_members.findByUserId(studentId);
  const family = await db.families.findById(familyMember.family_id);
  
  // If Family A, grant church school access to parents
  if (family.family_type === 'A') {
    const parents = await db.family_members.findParents(family.family_id);
    
    for (const parent of parents) {
      await db.permissions.upsert({
        user_id: parent.user_id,
        module: 'church_school',
        permission_level: 'parent',
        granted_at: new Date(),
        granted_by: 'system'
      });
    }
  }
  
  return enrollment;
}
```

### Example 2: Protected Route (Frontend)

```javascript
/**
 * React Router protected route component
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

function ProtectedRoute({ children, requireModule }) {
  const { user, permissions, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  // Check if user has access to required module
  if (requireModule === 'core_app' && !permissions.coreApp) {
    return <Navigate to="/unauthorized" />;
  }
  
  if (requireModule === 'church_school' && !permissions.churchSchool) {
    return <Navigate to="/unauthorized" />;
  }
  
  return children;
}

// Usage in routes
<Routes>
  <Route path="/calendar" element={
    <ProtectedRoute requireModule="core_app">
      <CalendarPage />
    </ProtectedRoute>
  } />
  
  <Route path="/church-school/*" element={
    <ProtectedRoute requireModule="church_school">
      <ChurchSchoolRoutes />
    </ProtectedRoute>
  } />
</Routes>
```

### Example 3: Permission Check Hook (Frontend)

```javascript
/**
 * Custom React hook for permission checks
 */
import { useState, useEffect } from 'react';
import { authService } from '../services/auth';

export function usePermissions() {
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadPermissions() {
      try {
        const perms = await authService.getUserPermissions();
        setPermissions(perms);
      } catch (error) {
        console.error('Failed to load permissions:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadPermissions();
  }, []);
  
  const hasModuleAccess = (module) => {
    if (!permissions) return false;
    
    if (module === 'core_app') return permissions.coreApp;
    if (module === 'church_school') return permissions.churchSchool;
    
    return false;
  };
  
  const canAccessStudent = (studentId) => {
    // Make API call to verify access
    return authService.canAccessStudentData(studentId);
  };
  
  return {
    permissions,
    loading,
    hasModuleAccess,
    canAccessStudent,
    isAdmin: permissions?.role === 'admin',
    isTeacher: permissions?.role === 'teacher',
    isParent: permissions?.role === 'parent',
    isStudent: permissions?.role === 'student'
  };
}

// Usage in component
function ChurchSchoolDashboard() {
  const { permissions, hasModuleAccess, isTeacher } = usePermissions();
  
  if (!hasModuleAccess('church_school')) {
    return <AccessDenied />;
  }
  
  return (
    <div>
      <h1>Church School</h1>
      {isTeacher && <TeacherDashboard />}
      {!isTeacher && <ParentStudentDashboard />}
    </div>
  );
}
```

---

## 🎯 SUMMARY FOR CLAUDE CODE

### The Core Concept
1. **Family Hub** = Main app with core features
2. **Church School** = Optional module within Family Hub
3. **Family A** = Full access to everything + church school if enrolled
4. **Family B** = Church school access ONLY
5. **Teachers** = Church school access ONLY
6. **Admin** = God mode, controls everything

### The Magic Trigger
When ANY child from Family A enrolls in church school:
- Family A parents get church school access ADDED to their existing permissions
- They DON'T lose core app access
- They now have BOTH sets of features

### The Key to Implementation
**Every route, every API call, every UI element MUST check:**
1. What is the user's role? (admin/parent/teacher/student)
2. What is their family type? (A/B)
3. Does their family have church school enrollment?
4. Based on 1-3, what modules can they access?

### Database is Source of Truth
- `families.family_type` determines base access
- `church_school_enrollment` determines extended access for Family A
- `permissions` table stores computed permissions
- Check these BEFORE allowing any action

---

## 📚 NEXT STEPS FOR DEVELOPMENT

1. **Audit existing code** against this architecture
2. **Identify gaps** in authorization logic
3. **Implement missing middleware** for permission checks
4. **Refactor routes** to use authorization guards
5. **Test each user role** thoroughly
6. **Document any deviations** from this spec

---

## 🆘 TROUBLESHOOTING GUIDE

### Issue: Family A parent not seeing church school after child enrolls
**Check:**
- Is enrollment record created in `church_school_enrollment`?
- Is `is_active` set to `true`?
- Does permission record exist in `permissions` table?
- Is frontend permission hook refreshing after enrollment?

### Issue: Family B parent sees core app features
**Check:**
- Is `family_type` set to 'B' in database?
- Is authorization middleware checking family type?
- Are route guards properly implemented?
- Is navigation component checking permissions correctly?

### Issue: Teacher sees students from other classes
**Check:**
- Are queries filtering by `teacher_id`?
- Is join with `church_school_classes` correct?
- Is `is_active` flag being checked?

---

## 📄 GLOSSARY

- **Core App**: Main Family Hub features (calendar, tasks, etc.)
- **Church School Module**: Educational sub-system within Family Hub
- **Family Type A**: Families with full access to core app
- **Family Type B**: Families with church school access only
- **Extended Permissions**: Church school access granted to Family A when child enrolls
- **Module Access**: Permission to use a specific section of the app
- **Enrollment**: Student registration in a church school class
- **Scope**: The boundaries of what data a user can access

---

**END OF ARCHITECTURE DOCUMENT**

*This document should serve as the single source of truth for the Family Hub application architecture. All development decisions should align with this specification.*
