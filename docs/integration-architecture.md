# Integration Architecture

## Overview
This monorepo has two parts: **Frontend** (React PWA) and **Backend** (Express API with SQLite). Integration is client-server via HTTP/REST API (no GraphQL/gRPC). Frontend acts as consumer, backend as provider. No direct shared code/modules; loose coupling via API contracts.

Key integration patterns:
- **API Calls**: Axios in frontend/services/api.ts to backend (proxied in dev: http://localhost:3001/api).
- **Auth Flow**: Frontend /profiles/login → JWT token stored in localStorage → Attached to subsequent requests via interceptor.
- **Data Sync**: Real-time via push notifications (Web Push API); polling for some (e.g., unread count).
- **File Uploads**: Multer in backend for avatars/proofs; FormData in frontend.
- **PWA Offline**: Service worker caches API responses; sync on reconnect (IndexedDB for drafts? Not implemented).
- **Error Handling**: Backend returns JSON {error: msg}; frontend toasts via Toast component.

No message queues/events (node-cron for scheduled); synchronous requests.

## Data Flow
1. **Auth**: Frontend ProfileSelector → POST /api/profiles/login → Token → Set currentProfile in Context.
2. **Tasks/Goals**: Dashboard fetch GET /api/tasks/:id → Render in SimpleTaskCard → Complete PUT /api/tasks/:id/complete → Update local state + toast.
3. **Gamification**: SpinWheel POST /api/gamification/spin-wheel/:id/spin → Confetti + sound + update Progress Context.
4. **Diet**: DietTracking GET /api/diet/foods/search → Log POST /api/diet/log → Nutrition summary GET /api/diet/nutrition/:id.
5. **AI**: AIAssistant GET /api/ai/chat (SSE streaming) → Append to conversation in state.
6. **School/Quizzes**: QuizPlayer POST /api/family-quizzes/:id/start → Submit answers → Leaderboard GET /:id/leaderboard.
7. **Notifications**: NotificationBell GET /api/notifications/unread-count → POST /:id/read → Web Push subscribe POST /notifications/subscribe.
8. **Uploads**: PhotoProof POST /api/tasks/:id/proof (multipart) → Backend saves to data/ → Frontend preview via GET /:id/proof.

## Authentication & Authorization
- **Token**: JWT from login; expires? (not specified; assume session).
- **RBAC**: Backend middleware/auth.ts checks role (adminOnly, authenticate). Frontend hides UI via ProfileContext.type (e.g., no AdminPanel for child).
- **PIN/Password**: Hashed in DB; frontend inputs plain → Backend verifies.
- **CORS**: Enabled in backend; origins: localhost:3000 (dev), domain (prod).

## External Integrations
- **Push Notifications**: web-push lib in backend; VAPID keys in env. Frontend usePushNotifications hook.
- **AI (Grok)**: Backend /ai/chat proxies to Grok API (env GROK_API_KEY); streaming via EventSource.
- **Foods API**: Backend /diet/foods/search calls Matvaretabellen or OpenFoodFacts (not implemented in code; placeholder).
- **YouTube**: Embedded in school assignments (no API calls; direct links).
- **Sounds**: Local assets in utils/sounds.ts (gamification feedback).

## Deployment Integration
- **Docker**: compose.yml runs backend (3001), frontend (nginx serve dist/, 80), volumes for data/avatars and DB.
- **Env Sync**: Shared .env; frontend VITE_ prefixed for build-time.
- **CI/CD**: No pipelines; manual npm run build + docker build.

## Potential Improvements
- **WebSockets**: For real-time (e.g., task updates) instead of polling.
- **API Versioning**: /api/v1/ to allow changes.
- **Caching**: Redis for frequent queries (e.g., leaderboards).
- **Offline Sync**: Service worker queue failed API calls.

Generated on 2026-01-09 from code analysis (api.ts, auth.ts, routes/*.ts).