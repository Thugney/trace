# Development Guide

## Prerequisites
- **Node.js**: v18+ (use .nvmrc if available; backend uses tsx for ESM).
- **npm/yarn/pnpm**: npm 9+ recommended (from package.json).
- **Docker**: For DB and full stack (docker-compose.yml).
- **Database**: Better-SQLite3 (file-based, no separate server; data/family.db).
- **IDE**: VS Code with TypeScript, Tailwind IntelliSense extensions.
- **Browser**: Chrome/Edge for PWA testing (DevTools for push notifications).

## Installation & Setup
1. **Clone & Root Setup**:
   ```
   git clone <repo>
   cd trace
   cp .env.example .env  # Edit DB_PATH, VAPID keys for push, API URLs
   ```

2. **Backend Setup** (`backend/`):
   ```
   cd backend
   npm install
   npm run db:init  # Creates schema (profiles, tasks, etc.)
   # Seed initial data if needed: node seed-database.js
   ```

3. **Frontend Setup** (`frontend/`):
   ```
   cd ../frontend
   npm install
   npm run generate:icons  # If icons needed
   ```

4. **Environment Vars** (shared .env):
   - `DATABASE_PATH=data/family.db` (backend)
   - `VITE_API_URL=http://localhost:3001/api` (frontend proxy)
   - `VAPID_PUBLIC_KEY=...` / `VAPID_PRIVATE_KEY=...` (push notifications)
   - `GROK_API_KEY=...` (AI features)

5. **Full Stack with Docker**:
   ```
   cd root
   docker-compose up -d  # Starts backend, frontend, (DB if configured)
   ```

## Running the App
- **Development**:
  - Backend: `cd backend && npm run dev` (tsx watch src/index.ts; port 3001)
  - Frontend: `cd frontend && npm run dev` (Vite; port 3000, proxies /api to backend)
  - Access: http://localhost:3000 (PWA installable)

- **Production Build**:
  - Backend: `cd backend && npm run build && npm start` (dist/index.js)
  - Frontend: `cd frontend && npm run build` (dist/ for static serve; nginx.conf)

- **Testing**:
  - Backend: `cd backend && npm test` (Vitest; covers auth, tasks, notes)
  - Frontend: No tests yet; add Vitest/React Testing Library.
  - E2E: Not set up; recommend Playwright/Cypress.

- **Database**:
  - Init: `npm run db:init` (creates tables/indexes)
  - Reset: `node reset-pins.js` or `node seed-database.js`
  - Check: `node src/scripts/check-database.ts`
  - Migrations: Run production-ready.ts for updates.

## Contribution Guidelines
No formal CONTRIBUTING.md, but follow:
- **Code Style**: ESLint (backend/frontend); Prettier for formatting. Run `npm run lint`.
- **Commits**: Conventional (feat:, fix:, docs:); semantic versioning.
- **PRs**: Branch from main; describe changes, test locally.
- **Testing**: Add unit tests for new routes/components; manual E2E for flows (login → task complete → reward claim).
- **Security**: Hash credentials; validate uploads (multer limits); RBAC via middleware.
- **Docs**: Update README.md for new features; use BMAD workflows for planning.

## Deployment
From DEPLOYMENT.md:
- **Docker**: `docker-compose up` (exposes ports 80/443 for prod).
- **Env**: Set NODE_ENV=production; DB backups via cron.
- **PWA**: Service worker (sw.ts) caches API; manifest in public/.
- **Monitoring**: Add logging (console.error); push notifications via web-push.
- **Scaling**: SQLite fine for family app; migrate to Postgres for multi-user.

## Troubleshooting
- **DB Locked**: WAL mode; restart if busy_timeout hits.
- **CORS**: Enabled in backend; check origins.
- **Push Fails**: Generate VAPID keys (web-push generate-vapid-keys).
- **Build Errors**: Check tsconfig; clean node_modules.
- **PWA Offline**: Test in Chrome DevTools (Application tab).

Generated on 2026-01-09 from package.json, README.md, scripts.