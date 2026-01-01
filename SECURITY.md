# Security Implementation - Family Learning Hub

## Overview
This document describes the security measures implemented in Family Learning Hub to protect user data and ensure proper authorization.

## Authentication System

### Frontend Authentication
- **LocalStorage**: Stores `currentProfileId` for session persistence
- **Auto Header Injection**: axios interceptor automatically adds `x-profile-id` header to all API requests
- **Location**: `frontend/src/services/api.ts`

```typescript
// All authenticated API requests automatically include:
headers: {
  'x-profile-id': '<currentProfileId>'
}
```

### Backend Authentication Middleware
**Location**: `backend/src/middleware/auth.ts`

#### Core Functions:

1. **`authenticate`** - Verifies profile_id from request header
   - Checks `x-profile-id` header exists
   - Validates profile exists in database
   - Attaches profile to `req.profile` for downstream use
   - Returns 401 if authentication fails

2. **`requireRole(roles)`** - Role-based access control
   - Requires specific roles: `['admin', 'parent', 'teacher', 'child']`
   - Returns 403 if user doesn't have required role
   - Example: `requireRole(['admin', 'teacher'])`

3. **`verifyParentChild(paramName)`** - Parent-child relationship validation
   - Ensures parents only access their own children's data
   - Admin bypass (can access any child)
   - Checks parent_id matches authenticated parent
   - Returns 403 for cross-family access attempts

4. **`verifyOwnership(ownerField)`** - Resource ownership validation
   - Ensures users only access their own resources
   - Parents can access their children's resources
   - Admin bypass (can access any resource)

5. **`optionalAuth`** - Optional authentication
   - Attaches profile if provided
   - Doesn't require authentication
   - Useful for public endpoints with optional personalization

### Pre-built Middleware Combinations

```typescript
// Admin only
import { adminOnly } from '../middleware/auth';
router.post('/admin/action', adminOnly, handler);

// Parent or Admin
import { parentOrAdmin } from '../middleware/auth';
router.post('/family/action', parentOrAdmin, handler);

// Teacher only
import { teacherOnly } from '../middleware/auth';
router.post('/assignments', teacherOnly, handler);
```

## Implemented Security Measures

### School Routes (`backend/src/routes/school.ts`)

| Endpoint | Method | Middleware | Protection |
|----------|---------|-----------|-----------|
| POST /enrollments | POST | parentOrAdmin + verifyParentChild | Parents can only enroll their own kids |
| POST /assignments | POST | teacherOnly | Only teachers create assignments |
| PUT /assignments/:id | PUT | teacherOnly | Only teachers edit assignments |
| DELETE /assignments/:id | DELETE | teacherOnly | Only teachers delete assignments |
| POST /submissions | POST | authenticate + requireRole(['child', 'parent']) + verifyParentChild | Students/parents submit, verified ownership |

### Messages Routes (`backend/src/routes/messages.ts`)

| Endpoint | Method | Middleware | Protection |
|----------|--------|-----------|-----------|
| POST / | POST | authenticate + requireRole(['teacher', 'parent']) | Only teachers/parents send messages |
| GET /inbox/:userId | GET | authenticate + requireRole(['teacher', 'parent']) | Only teachers/parents access inbox |
| GET /sent/:userId | GET | authenticate + requireRole(['teacher', 'parent']) | Only teachers/parents view sent |
| PUT /:id/read | PUT | authenticate + requireRole(['teacher', 'parent']) | Only teachers/parents mark as read |
| GET /unread-count/:userId | GET | authenticate + requireRole(['teacher', 'parent']) | Only teachers/parents check count |
| DELETE /:id | DELETE | authenticate + requireRole(['teacher', 'parent']) | Only teachers/parents delete messages |

## How to Secure Additional Routes

### Step 1: Import middleware

```typescript
import { authenticate, requireRole, verifyParentChild, adminOnly } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
```

### Step 2: Apply middleware to routes

```typescript
// Example: Diet tracking (parents and admin only)
router.post('/diet/meals', authenticate, requireRole(['parent', 'admin']), (req: AuthRequest, res) => {
  // req.profile is available here
  const userId = req.profile!.id;
  // ... handle request
});

// Example: Tasks (verify parent-child relationship)
router.post('/tasks', parentOrAdmin, verifyParentChild('profile_id'), (req: AuthRequest, res) => {
  // Middleware ensures parent can only create tasks for their own kids
  // ... handle request
});

// Example: Admin-only endpoint
router.delete('/profiles/:id', adminOnly, (req: AuthRequest, res) => {
  // Only admins can delete profiles
  // ... handle request
});
```

### Step 3: Update TypeScript types

```typescript
// Use AuthRequest instead of Request
router.post('/endpoint', middleware, (req: AuthRequest, res) => {
  // req.profile is now typed
});
```

## Remaining Routes to Secure

The following routes still need security middleware applied:

### Profiles Routes (`backend/src/routes/profiles.ts`)
- [ ] GET /profiles - Should require authentication
- [ ] POST /profiles - Admin only for creating new families
- [ ] PUT /profiles/:id - Verify ownership or admin
- [ ] DELETE /profiles/:id - Admin only or self-delete
- [ ] PUT /profiles/:id/password - Admin or self
- [ ] PUT /profiles/:id/ai-toggle - Admin or parent (for kids)

### Diet Routes (`backend/src/routes/diet.ts`)
- [ ] All endpoints - Require parent or admin
- [ ] Add verifyOwnership for accessing diet data
- [ ] Parents can access their kids' diet data

### Tasks Routes (`backend/src/routes/tasks.ts`)
- [ ] POST /tasks - Parent or admin only
- [ ] PUT /tasks/:id - Verify ownership
- [ ] DELETE /tasks/:id - Verify ownership
- [ ] GET /tasks/profile/:profileId - Verify ownership or parent-child

### AI Routes (`backend/src/routes/ai.ts`)
- [ ] POST /ai/chat - Verify child has ai_enabled=1
- [ ] Check parent or admin for ai_enabled toggle

### Notes Routes (`backend/src/routes/notes.ts`)
- [ ] All CRUD - Verify ownership
- [ ] Parents can access kids' notes

### Settings Routes (`backend/src/routes/settings.ts`)
- [ ] Verify ownership
- [ ] Parents can manage kids' settings

### Goals Routes (`backend/src/routes/goals.ts`)
- [ ] Verify ownership
- [ ] Parents can set goals for kids

## Security Best Practices

### 1. Always Verify Ownership
```typescript
// DON'T: Trust client-provided IDs
router.put('/resource/:id', (req, res) => {
  // Anyone can modify any resource!
  updateResource(req.params.id, req.body);
});

// DO: Verify ownership
router.put('/resource/:id', authenticate, verifyOwnership('profile_id'), (req, res) => {
  // Middleware ensures req.profile.id === resource owner
  updateResource(req.params.id, req.body);
});
```

### 2. Validate Parent-Child Relationships
```typescript
// DON'T: Trust parent_id from request
router.post('/enroll', (req, res) => {
  const { student_id, parent_id } = req.body;
  // Parent_id could be forged!
  enrollStudent(student_id, parent_id);
});

// DO: Use middleware
router.post('/enroll', parentOrAdmin, verifyParentChild('student_id'), (req, res) => {
  // Middleware verified student belongs to authenticated parent
  enrollStudent(req.body.student_id);
});
```

### 3. Use Role-Based Access Control
```typescript
// Restrict sensitive actions to specific roles
router.delete('/users/:id', adminOnly, handler);
router.post('/assignments', teacherOnly, handler);
router.post('/family-diet', parentOrAdmin, handler);
```

### 4. Defense in Depth
```typescript
// Layer multiple protections
router.post('/sensitive-action',
  authenticate,              // Step 1: Verify logged in
  requireRole(['parent']),   // Step 2: Verify role
  verifyParentChild('child_id'), // Step 3: Verify relationship
  (req, res) => {
    // Step 4: Additional validation in handler if needed
    handler(req, res);
  }
);
```

## Common Attack Vectors & Mitigations

### 1. Cross-Family Data Access
**Attack**: Parent tries to access another family's data
**Mitigation**: `verifyParentChild()` middleware checks parent_id

### 2. Privilege Escalation
**Attack**: Child tries to access admin endpoints
**Mitigation**: `requireRole()` middleware enforces role restrictions

### 3. Unauthorized Resource Modification
**Attack**: User tries to modify another user's resources
**Mitigation**: `verifyOwnership()` middleware checks resource owner

### 4. Missing Authentication
**Attack**: Unauthenticated requests to protected endpoints
**Mitigation**: `authenticate` middleware required on all protected routes

## Testing Security

### Manual Testing Checklist

```bash
# Test 1: Unauthenticated access (should fail)
curl -X POST http://localhost:3001/api/assignments \
  -H "Content-Type: application/json" \
  -d '{"title":"Test"}'
# Expected: 401 Unauthorized

# Test 2: Wrong role (should fail)
curl -X POST http://localhost:3001/api/assignments \
  -H "Content-Type: application/json" \
  -H "x-profile-id: <parent_id>" \
  -d '{"title":"Test"}'
# Expected: 403 Forbidden

# Test 3: Cross-family access (should fail)
curl -X POST http://localhost:3001/api/enrollments \
  -H "Content-Type: application/json" \
  -H "x-profile-id: <parent1_id>" \
  -d '{"student_id":"<parent2_child_id>", "class_id":"1"}'
# Expected: 403 Forbidden

# Test 4: Correct access (should succeed)
curl -X POST http://localhost:3001/api/enrollments \
  -H "Content-Type: application/json" \
  -H "x-profile-id: <parent_id>" \
  -d '{"student_id":"<own_child_id>", "class_id":"1"}'
# Expected: 201 Created
```

### Automated Testing
Consider adding integration tests:
```typescript
describe('Security Middleware', () => {
  it('should reject unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/assignments')
      .send({ title: 'Test' });
    expect(res.status).toBe(401);
  });

  it('should reject wrong role', async () => {
    const res = await request(app)
      .post('/api/assignments')
      .set('x-profile-id', parentId)
      .send({ title: 'Test' });
    expect(res.status).toBe(403);
  });

  it('should reject cross-family access', async () => {
    const res = await request(app)
      .post('/api/enrollments')
      .set('x-profile-id', parent1Id)
      .send({ student_id: parent2ChildId, class_id: 1 });
    expect(res.status).toBe(403);
  });
});
```

## Production Recommendations

### 1. Add Rate Limiting
```typescript
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', apiLimiter);
```

### 2. Implement HTTPS
- Already configured in nginx/reverse proxy
- Ensure all cookies use `secure` flag in production

### 3. Add Request Logging
```typescript
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Profile: ${req.headers['x-profile-id']}`);
  next();
});
```

### 4. Regular Security Audits
- Review new routes for proper authorization
- Test for common OWASP top 10 vulnerabilities
- Monitor logs for suspicious activity

### 5. Consider JWT Tokens
For enhanced security, consider upgrading from header-based auth to JWT:
```typescript
// Generate JWT on login
const token = jwt.sign({ profileId, type }, SECRET, { expiresIn: '24h' });

// Verify JWT in middleware
const decoded = jwt.verify(token, SECRET);
```

## Summary

✅ **Implemented:**
- Authentication middleware
- Role-based access control
- Parent-child relationship validation
- Resource ownership verification
- Protected school and messaging endpoints
- Frontend automatic header injection

⏳ **Todo:**
- Apply middleware to remaining routes (profiles, diet, tasks, ai, notes, settings, goals)
- Add rate limiting
- Add request logging
- Consider JWT token upgrade
- Add automated security tests

**Security Level:** Moderate → High (after applying to all routes)

**Estimated Time to Complete:** 2-3 hours to secure all remaining endpoints
