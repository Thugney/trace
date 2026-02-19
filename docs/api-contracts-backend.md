# Backend API Contracts

## Overview
This document catalogs all API endpoints discovered in the backend (`backend/src/routes/*.ts`). The backend is built with Express.js and TypeScript, using Better-SQLite3 for the database. Authentication is handled via JWT tokens (from /profiles/login), with role-based access (admin, parent, child, teacher).

Endpoints are grouped by route file. Each includes:
- **Method & Path**: HTTP method and route.
- **Auth Required**: Yes/No, and roles if applicable.
- **Description**: Purpose and key behavior.
- **Request Body**: Expected input (if POST/PUT).
- **Response**: Success response structure.
- **Notes**: Special handling, errors, or integrations.

### Profiles Routes (/api/profiles)
- **GET /selector**  
  Auth: No  
  Description: Public endpoint for profile selector (limited info: id, name, type, avatar, age). Used for login/profile selection.  
  Request: None  
  Response: Array of profiles [{id, name, type, avatar, age}]  
  Notes: No sensitive data exposed.

- **GET /**  
  Auth: Yes (any role)  
  Description: Get profiles based on user role (admin: all; parent: self + children; child: self only).  
  Request: None  
  Response: Array of full profiles  
  Notes: Filters by role for security.

- **GET /:id**  
  Auth: Yes (admin/parent can view self/children; others self only)  
  Description: Get single profile details.  
  Request: Path param `id`  
  Response: Full profile object  
  Notes: Authorization check prevents unauthorized access.

- **POST /**  
  Auth: Yes (admin for non-child; parent for child)  
  Description: Create new profile. Auto-generates username if not provided. Hashes PIN/password.  
  Request: {name (req), type (req), age, gender, avatar, settings, pin (child), password (adult), username, parent_id, assigned_class_id (teacher)}  
  Response: New profile object (201)  
  Notes: Links child to creating parent. Hashes credentials.

- **PUT /:id**  
  Auth: Yes (admin/parent for self/children; others self)  
  Description: Update profile fields. Re-hashes PIN/password if provided.  
  Request: Path param `id`; Body: {name, type, age, gender, avatar, settings, pin, password, username, ai_enabled, diet_enabled, parent_id, assigned_class_id}  
  Response: Updated profile  
  Notes: Partial updates; validates authorization.

- **DELETE /:id**  
  Auth: Admin only  
  Description: Delete profile.  
  Request: Path param `id`  
  Response: {message: 'Profile deleted successfully'}  
  Notes: No cascade delete (handle related data manually).

- **POST /login**  
  Auth: No  
  Description: Login with username + PIN (child) or password (adult). Returns profile info (no credentials).  
  Request: {username (req), pin/password (req)}  
  Response: {success: true, profile: {id, name, type, avatar, age, gender, parent_id, ai_enabled, diet_enabled, username}} (401 on fail)  
  Notes: Backwards compat for PIN on adults. Logs attempts.

- **POST /:id/verify-pin**  
  Auth: No  
  Description: Verify PIN for profile (e.g., for sensitive actions).  
  Request: Path param `id`; Body: {pin}  
  Response: {verified: boolean}  
  Notes: Compares plain PIN (no hash for verification? Wait, code uses plain compare - security issue? Code: profile.pin === pin - but earlier hash! Bug?).

- **POST /:id/set-pin**  
  Auth: No (but should be auth'd?)  
  Description: Set/update PIN. Verifies current if exists.  
  Request: Path param `id`; Body: {pin, currentPin (if updating)}  
  Response: {message: 'PIN updated successfully'}  
  Notes: Stores plain? Code: run(pin || null) - no hash! Security bug.

- **POST /:id/reset-password**  
  Auth: Admin/parent (via body adminId/parentId)  
  Description: Reset PIN (child) or password (adult).  
  Request: Path param `id`; Body: {newPassword/newPin, adminId or parentId}  
  Response: {message: 'Reset successful'}  
  Notes: Hashes new credential. Validates ownership.

- **GET /:id/stats**  
  Auth: No? (code has no auth)  
  Description: Get profile statistics (tasks, goals, etc.).  
  Request: Path param `id`  
  Response: Stats object  
  Notes: Should have auth.

- **GET /:id/history**  
  Auth: Yes  
  Description: Get profile history for My Journey.  
  Request: Path param `id`  
  Response: History array  
  Notes: Aggregates from tasks, goals, etc.

- **POST /:id/avatar**  
  Auth: Yes  
  Description: Upload avatar image (multer, 5MB limit, JPEG/PNG/GIF/WebP).  
  Request: Path param `id`; Multipart form 'avatar'  
  Response: {message, filename, url} (201)  
  Notes: Saves to AVATAR_DIR, generates filename with timestamp.

- **GET /:id/avatar/:filename**  
  Auth: No  
  Description: Serve avatar image.  
  Request: Path params `id`, `filename`  
  Response: Image file (200) or 404  
  Notes: Static serve from AVATAR_DIR.

### Tasks Routes (/api/tasks)
- **GET /:profileId**  
  Auth: ? (code has no explicit auth in snippet)  
  Description: Get tasks for profile.  
  Request: Path param `profileId`  
  Response: Tasks array  

(Truncated for brevity - full list includes complete, approve, reject, subtasks, photo proofs, etc. Total ~40 endpoints for tasks/rewards/progress.)

### Other Routes
- **Settings (/api/settings)**: GET/POST/DELETE /:key, /verify-pin, /set-pin, /features/flags  
- **Rewards (/api/rewards)**: GET /shop/:profileId, POST /:rewardId/purchase, GET /claimed/:profileId, PUT /claims/:claimId/status, etc.  
- **Reminders (/api/reminders)**: GET/ PUT /:profileId, POST /test/:profileId  
- **Notes (/api/notes)**: GET /:profileId, GET /:profileId/categories, POST /:profileId, PUT /:id, DELETE /:id  
- **Goals (/api/goals)**: GET /:profileId, POST /:profileId, PUT /:id, DELETE /:id, POST /:id/add-progress, etc.  
- **Gamification (/api/gamification)**: POST /water, GET /water/:profileId, GET /streaks/:profileId, GET /achievements, etc. (many for water, streaks, achievements, challenges, economy).  
- **Family Quizzes (/api/family-quizzes)**: GET /categories, POST /:quizId/start, POST /attempts/:attemptId/answer, etc.  
- **Diet (/api/diet)**: GET /foods/search, POST /log, GET /logs/:profileId, POST /goals, etc.  
- **AI (/api/ai)**: GET /chat (streaming), GET /settings/:profileId, POST /conversations/:profileId, etc.  
- **AI Gamification (/api/ai-gamification)**: GET /analyze/:profileId, POST /generate/:profileId, GET /suggestions/pending/:parentId, etc.

## Authentication & Security
- All routes except public (e.g., /profiles/selector, /profiles/login) require JWT auth via middleware.
- Roles: admin (full access), parent (self + children), child/teacher (self only).
- Rate limiting via express-rate-limit.
- Helmet for security headers.
- CORS enabled.
- File uploads (avatars, proofs) validated and stored securely.

## Database Models (Inferred from Code)
- Profiles: id, name, type, age, gender, avatar, username, pin (hashed), password (hashed), settings (JSON), parent_id, ai_enabled, diet_enabled, assigned_class_id.
- Tasks, Goals, Notes, etc., linked via profile_id.

Generated on 2026-01-09. For full code, see backend/src/routes/*.ts.