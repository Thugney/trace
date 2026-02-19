# Source Tree Analysis

## Overview
This monorepo project (`j:/Projects/New25/trace`) consists of two main parts: **Frontend** (React web app/PWA) and **Backend** (Node.js/Express API). Structure follows standard conventions: frontend uses Vite for build, backend uses TypeScript with tsx for dev.

Critical directories annotated based on project types:
- **Frontend (web)**: src/ (app code), components/ (UI), pages/ (routes), public/ (static assets), api/ (client services).
- **Backend (backend)**: src/ (app code), routes/ (API endpoints), services/ (business logic), database/ (DB init/migrations), middleware/ (auth/security).

Integration: Frontend calls backend via axios in `src/services/api.ts` (e.g., /api/profiles, /api/tasks). Shared data: Profiles link family; tasks/goals sync via API.

Excludes: node_modules, .git, dist/build (generated).

## Full Project Structure

```
trace/ (Monorepo Root)
├── README.md                  # Project overview, setup instructions
├── package.json               # Root? No, separate per part; root has scripts like rebuild.sh
├── docker-compose.yml         # Multi-container setup (frontend + backend DB)
├── .env.example               # Environment vars (DB_PATH, API keys)
├── QUICKSTART.md              # Initial setup guide
├── DEPLOYMENT.md              # Deployment (Docker, env vars)
├── PWA_SETUP.md               # PWA config (manifest, service worker)
├── RBAC_IMPLEMENTATION.md     # Role-based access (admin/parent/child)
├── SECURITY_AND_FEATURES_FIX_PLAN.md # Security fixes, feature roadmap
├── IMPLEMENTATION_STATUS.md   # Current dev status
├── _bmad/                     # BMAD tooling (workflows, agents - external)
├── _bmad-output/              # Generated artifacts (planning)
├── .claude/                   # Claude AI artifacts (external)
├── .roo/                      # Roo AI artifacts (external)
├── backend/                   # Backend API (Part: backend)
│   ├── package.json           # Dependencies: Express, Better-SQLite3, bcryptjs, multer
│   ├── tsconfig.json          # TypeScript config
│   ├── vitest.config.ts       # Testing (Vitest)
│   ├── Dockerfile             # Docker build
│   ├── src/                   # Core backend code
│   │   ├── index.ts           # App entry (Express server setup, routes mount)
│   │   ├── database/          # DB layer
│   │   │   ├── init.ts        # Schema creation (profiles, tasks, etc.), indexes
│   │   │   └── migrations/    # Schema updates (add-ai-enrolled-by.sql, production-ready.ts)
│   │   ├── middleware/        # Auth, security
│   │   │   └── auth.ts        # JWT auth, role checks (authenticate, adminOnly)
│   │   ├── routes/            # API endpoints (modular)
│   │   │   ├── profiles.ts    # User management (CRUD, login, avatar upload)
│   │   │   ├── tasks.ts       # Tasks (CRUD, complete, subtasks, photo proofs)
│   │   │   ├── goals.ts       # Monthly goals (CRUD, progress, milestones)
│   │   │   ├── notes.ts       # Personal notes (CRUD, categories, tags)
│   │   │   ├── notifications.ts # Push subs, unread count, mark read
│   │   │   ├── rewards.ts     # Reward shop (CRUD, claim, approve)
│   │   │   ├── settings.ts    # App settings (key-value, PIN verify)
│   │   │   ├── gamification.ts # Streaks, achievements, water intake, economy
│   │   │   ├── family-quizzes.ts # Quizzes (CRUD, attempts, leaderboards)
│   │   │   ├── diet.ts        # Food search, meal logs, goals, plans
│   │   │   ├── ai.ts          # AI chat (streaming), settings, conversations
│   │   │   └── ai-gamification.ts # AI analysis, challenges, suggestions
│   │   ├── services/          # Business logic
│   │   │   ├── economyControl.ts # Points calculation, daily caps, bonuses
│   │   │   ├── notifications.ts # VAPID keys, push sending
│   │   │   └── scheduler.ts   # Cron jobs (reminders, daily resets)
│   │   ├── test/              # Unit/integration tests
│   │   │   ├── auth.test.ts   # Auth middleware tests
│   │   │   ├── gamification.test.ts # Gamification logic
│   │   │   ├── notes.test.ts  # Notes CRUD
│   │   │   ├── tasks.test.ts  # Tasks flow
│   │   │   ├── setup.ts       # Test setup (DB mocks)
│   │   │   └── helpers.ts     # Test utils
│   │   └── scripts/           # Utils
│   │       ├── check-database.ts # DB integrity check
│   │       └── reset-pins.ts  # Bulk PIN reset
│   ├── data/                  # Persistent data (avatars, DB)
│   │   └── avatars/           # Uploaded images (multer)
│   └── migrations/            # SQL migrations
│       └── add-ai-enrolled-by.sql # Add AI enrollment column
├── frontend/                  # React PWA (Part: frontend)
│   ├── package.json           # Dependencies: React, Vite, Tailwind, Recharts, Lucide
│   ├── tsconfig.json          # TypeScript config
│   ├── vite.config.ts         # Vite build (PWA plugin)
│   ├── tailwind.config.js     # Tailwind themes (family colors)
│   ├── postcss.config.js      # PostCSS setup
│   ├── index.html             # Entry HTML
│   ├── src/                   # App code
│   │   ├── main.tsx           # React root (Router, Providers)
│   │   ├── App.tsx            # Routes (protected with auth)
│   │   ├── index.css          # Global styles (Tailwind @import)
│   │   ├── sw.ts              # Service Worker (PWA offline)
│   │   ├── vite-env.d.ts      # Vite types
│   │   ├── context/           # State management (Context API)
│   │   │   ├── ProfileContext.tsx # Profiles list, current selection
│   │   │   ├── AgeContext.tsx # Derived age from profile
│   │   │   └── FeatureFlagsContext.tsx # Feature toggles from settings
│   │   ├── hooks/             # Custom hooks
│   │   │   └── usePushNotifications.ts # Web push setup
│   │   ├── pages/             # Route components
│   │   │   ├── AdminPanel.tsx # Admin tools (users, settings)
│   │   │   ├── AIAssistant.tsx # AI chat interface (streaming)
│   │   │   ├── CalendarView.tsx # Task calendar
│   │   │   ├── ChildDashboard.tsx # Child view (tasks, goals)
│   │   │   ├── ControlsPage.tsx # Parental controls
│   │   │   ├── Dashboard.tsx  # Main dashboard (insights, quick actions)
│   │   │   ├── DietTracking.tsx # Meal logging, nutrition
│   │   │   ├── FamilyLeaderboard.tsx # Family rankings
│   │   │   ├── Login.tsx      # Profile selector/login
│   │   │   ├── MyJourney.tsx  # Personal history/progress
│   │   │   ├── Notes.tsx      # Note taking
│   │   │   ├── Onboarding.tsx # Initial setup
│   │   │   ├── ParentDashboard.tsx # Parent overview (children stats)
│   │   │   ├── ProfileSelector.tsx # Switch profiles
│   │   │   ├── QuizBuilder.tsx # Create quizzes
│   │   │   ├── QuizPlayer.tsx # Take quizzes
│   │   │   ├── RewardShop.tsx # Points shop
│   │   │   └── Settings.tsx   # User settings (AI, reminders)
│   │   ├── components/        # Reusable UI
│   │   │   ├── Avatar.tsx     # Profile image
│   │   │   ├── ChildInsights.tsx # Child stats charts
│   │   │   ├── CountdownChallengeCard.tsx # Timer challenges
│   │   │   ├── EconomySettings.tsx # Points config
│   │   │   ├── HiddenAchievements.tsx # Teaser badges
│   │   │   ├── Layout.tsx     # App shell (nav, header)
│   │   │   ├── NotificationBell.tsx # Unread alerts
│   │   │   ├── PhotoProof.tsx # Task proof upload
│   │   │   ├── RewardManagement.tsx # Reward editor
│   │   │   ├── SimpleTaskCard.tsx # Task display
│   │   │   ├── SpinWheel.tsx  # Reward spinner
│   │   │   └── Toast.tsx      # Notifications
│   │   ├── services/          # API clients
│   │   │   └── api.ts         # Axios instances, endpoints (profiles, tasks, etc.)
│   │   ├── types/             # TypeScript interfaces
│   │   │   └── index.ts       # Profile, Task, Goal, etc.
│   │   └── utils/             # Helpers
│   │       └── sounds.ts      # Audio effects (gamification)
│   ├── public/                # Static assets
│   │   ├── icon.svg           # Logo
│   │   ├── pwa-192x192.png    # Manifest icons
│   │   ├── pwa-512x512.png    # Manifest icons
│   │   ├── favicon-*.png      # Favicons
│   │   ├── apple-touch-icon.png # iOS icon
│   │   ├── robots.txt         # SEO
│   │   └── ICONS_README.md    # Icon guide
│   └── scripts/               # Build utils
│       └── generate-icons.js  # Icon generation
└── docs/                      # Generated docs (this project)
    ├── project-scan-report.json # Workflow state
    ├── api-contracts-backend.md # API endpoints
    ├── data-models-backend.md # DB schema
    └── ui-component-inventory-frontend.md # Components
```

## Annotations & Integration Points
- **Root**: Scripts (rebuild.sh, cleanup.sh) for dev ops. Docker for deployment (backend + frontend + DB).
- **Backend Integration**: Frontend api.ts points to localhost:3001/api (proxied in Vite). Key calls: profiles/login, tasks/:id/complete, gamification/stats.
- **Frontend Entry**: main.tsx mounts Router with Providers (Profile, Age, Features, Toast). Layout wraps routes.
- **State Flow**: ProfileContext loads on login (/profiles/selector → /login). AgeContext derives from profile.age. Features from /settings/features/flags.
- **Gamification Sync**: Tasks/Goals fetch on Dashboard; updates via API push to Progress/Rewards.
- **PWA**: sw.ts handles offline (caches API responses). Manifest in public/ for installable app.
- **School Features**: Quizzes/Assignments via family-quizzes.ts routes; UI in QuizBuilder/Player.

This tree aids navigation for extensions (e.g., add new route in backend/routes/, component in frontend/src/components/).

Generated on 2026-01-09.