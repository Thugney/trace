# Backend Architecture

## Overview
The backend is a Node.js/Express API server using TypeScript for type safety. It's a monolithic REST API with SQLite (Better-SQLite3) for persistence. Focuses on family gamification: profiles, tasks, rewards, diet, AI, school quizzes. Runs on port 3001; dev with tsx watch.

**Style**: Layered (routes → services → DB). No microservices; single app.ts mounts routers. Middleware for auth/security. Cron for scheduling (reminders).

**Key Decisions**:
- **DB**: SQLite for simplicity (file-based, no server); WAL for concurrency. Migrations via SQL files.
- **Auth**: JWT (custom middleware); roles (admin/parent/child/teacher) checked per route.
- **Security**: Helmet, CORS, rate-limit, bcrypt hash, multer validation for uploads.
- **Testing**: Vitest for unit/integration (auth, tasks).
- **Deployment**: Docker; env vars for config.

## Layers

### Routes (Entry Points)
- Modular: src/routes/*.ts (e.g., profiles.ts for CRUD/auth, tasks.ts for gamification).
- Express Router per module; mounted in index.ts (/api prefix).
- Patterns: Auth middleware on sensitive; JSON responses {data, error}.
- Error Handling: Try-catch per handler; 500 on fail.

### Services (Business Logic)
- src/services/: economyControl.ts (points calc, caps), notifications.ts (VAPID push), scheduler.ts (cron jobs).
- Pure functions where possible; DB access via init.ts (prepared statements).
- Economy: Daily resets, bonuses, streak freezes.

### Database (Persistence)
- init.ts: Schema (profiles central; FK cascades). Indexes on profile_id, dates.
- Migrations: production-ready.ts runs SQL adds (e.g., ai_enabled).
- Queries: Prepared statements for security/performance.
- Models: Inferred from code (no ORM; raw SQL).

### Middleware (Cross-Cutting)
- auth.ts: JWT verify, role checks (authenticate, adminOnly).
- Compression, CORS, helmet in index.ts.

## Data Flow Example: Task Completion
1. Frontend POST /api/tasks/:id/complete {proof?}.
2. Routes/tasks.ts: Auth middleware → economyControl.verifyTime() → DB update completed=1.
3. If proof: Multer upload to data/proofs/ → Pending parent approval.
4. Services: Add progress entry (points) → Check achievements → Send push via notifications.ts.
5. Cron (scheduler.ts): Daily streak reset.

## External Dependencies
- **AI**: Proxy to Grok API (/ai/chat streams SSE).
- **Push**: web-push lib; VAPID keys.
- **Foods**: Planned Matvaretabellen integration (/diet/foods/search).
- **Cron**: node-cron for reminders/resets.

## Testing & Quality
- Vitest: src/test/*.test.ts (auth, gamification, notes, tasks).
- Coverage: Helpers/setup.ts mocks DB.
- No E2E; manual via Postman/curl.

## Scalability Notes
- SQLite limits (concurrency via WAL); migrate to Postgres for prod multi-user.
- No caching (add Redis for leaderboards).
- Rate-limit on endpoints (express-rate-limit).

Generated on 2026-01-09 from src/ structure.