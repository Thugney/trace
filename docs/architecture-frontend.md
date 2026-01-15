# Frontend Architecture

## Overview
Single-Page Application (SPA) built with React 18 + TypeScript. Uses Vite for fast dev/build (HMR, ES modules). PWA-capable with vite-plugin-pwa (offline caching via service worker). Styling: Tailwind CSS (utility-first, responsive). Routing: React Router v6 (protected routes via auth guards).

**Style**: Component-based (functional components, hooks). No class components. State: Context API (lightweight; no Redux). No server-side rendering (CSR only).

**Key Decisions**:
- **Build Tool**: Vite (faster than CRA; TS/ESM native).
- **Styling**: Tailwind (no CSS-in-JS; clsx for conditional classes).
- **Icons**: Lucide React (simple, customizable).
- **Charts**: Recharts (lightweight SVG).
- **PWA**: Manifest + SW for install/offline (caches API, assets).
- **Testing**: None implemented; Vitest ready (from package.json).
- **Deployment**: Static (dist/ via nginx; dockerized).

## Layers

### Routing & Layout
- App.tsx: BrowserRouter + Routes (lazy-loaded pages). Guards: Auth via ProfileContext (redirect to Login if no profile).
- Layout.tsx: Persistent shell (header with NotificationBell, sidebar nav, main outlet). Responsive (mobile menu toggle).
- Pages: Route-based (e.g., /dashboard → Dashboard.tsx). Nested: /admin/* under AdminPanel.

### State Management
- Context API: Three providers in main.tsx (Profile, Age, FeatureFlags, Toast).
  - **ProfileContext**: Loads profiles on app start (/profiles/selector). Current profile selection; persists in localStorage.
  - **AgeContext**: Derives age from current profile (for age-gated content).
  - **FeatureFlagsContext**: Fetches /settings/features/flags; toggles UI (e.g., AI if enabled).
  - **Toast**: Global notifications (showToast func).
- Custom Hooks: usePushNotifications (registers SW, subscribes to backend /notifications/subscribe).
- Local State: useState in components (e.g., form inputs, loading).

### Components
- Reusable: src/components/ (e.g., SimpleTaskCard for tasks, SpinWheel for gamification).
- Patterns: Props drilling minimal (contexts for global); memo for perf (e.g., cards).
- UI: Tailwind classes; ARIA for accessibility (e.g., role="button").

### Services (API Layer)
- api.ts: Axios instances (one per module: tasksAPI, profilesAPI). BaseURL from VITE_API_URL (proxies to backend in dev).
- Interceptors: Auth token auto-attach; error toasts.
- Endpoints: Typed fetches (e.g., POST /tasks/:id/complete returns Task).

### Utils & Assets
- utils/sounds.ts: Audio for gamification (spin, complete).
- public/: Static (icons, manifest.json for PWA, robots.txt).
- types/index.ts: Interfaces (Profile {id, name, type, ...}, Task, Goal).

## Data Flow Example: Login → Dashboard
1. ProfileSelector: GET /profiles/selector → List profiles → User selects → POST /profiles/login {username, pin/password} → Token + profile → Set in ProfileContext.
2. Redirect to /dashboard: useEffect fetches /profiles/:id/stats, /tasks/:id, /goals/:id/active → Render ChildInsights (charts), SimpleTaskCard grid.
3. Task Complete: Button click → POST /tasks/:id/complete → On success: Update local tasks state, play sound, show Toast, confetti.
4. Push: If new task, backend cron → POST /notifications/subscribe → NotificationBell updates unread count.

## External Dependencies
- **Backend API**: All data via /api/* (auth, tasks, etc.).
- **Push**: Browser Push API; backend web-push.
- **AI Streaming**: EventSource to /ai/chat (appends to messages state).
- **Charts**: Recharts (local data from API).
- **Sounds**: Howler.js? (local files).

## PWA Features
- sw.ts: Precaches assets/API; background sync for offline logs.
- Manifest: public/manifest.json (name: "Family Learning Hub", icons, theme_color).
- Offline: Cache-first for static; network-first for API (stale-while-revalidate).

## Testing & Quality
- No tests; package.json has Vitest config. Add: @testing-library/react for components.
- Linting: ESLint (hooks, refresh rules).
- Perf: Vite analyzer; lazy routes.

## Scalability Notes
- CSR fine for family app; code-split pages.
- State: Contexts scale to ~10 users; add Zustand if complex.
- Bundle: Vite optimizes (tree-shake, minify).

Generated on 2026-01-09 from src/ structure.