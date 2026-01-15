# Frontend UI Component Inventory

## Overview
The frontend is a React app built with Vite and TypeScript. Components are in `frontend/src/components/`. No dedicated design system library (e.g., Material-UI), but uses Lucide React icons and Tailwind CSS for styling. Components focus on gamification, family tasks, diet, AI, and school features.

State management: React Context API (AgeContext, FeatureFlagsContext, ProfileContext in `src/context/`). Custom hooks like `usePushNotifications` for notifications. No Redux/MobX; lightweight for PWA.

Components are functional (TSX), with props for data (e.g., profile, task). Reusable across pages (Dashboard, TasksManager, etc.). Total: 12 main components.

## Component Categories

### Layout & Navigation (Core Structure)
- **Layout.tsx**  
  Purpose: Main app layout with header, sidebar, notification bell, and routing outlet.  
  Props: children (ReactNode).  
  Features: Responsive (mobile-first Tailwind), profile selector integration, toast notifications.  
  Dependencies: NotificationBell, ProfileContext, lucide-react icons.  
  Usage: Wraps all pages (e.g., Dashboard, Tasks).  
  Notes: Handles theme (light/dark via Tailwind), PWA offline support.

### Profile & User (Personalization)
- **Avatar.tsx**  
  Purpose: Display/edit user avatar (image or placeholder).  
  Props: src (string), alt (string), size (sm/md/lg), editable (bool).  
  Features: Upload handler (integrates with /profiles/:id/avatar API), circular crop, fallback icon.  
  Dependencies: PhotoProof (for upload), lucide-react (user icon).  
  Usage: Profile pages, cards (ChildInsights, SimpleTaskCard).  
  Notes: Stores in backend AVATAR_DIR; supports WebP/JPG/PNG.

### Insights & Analytics (Data Visualization)
- **ChildInsights.tsx**  
  Purpose: Dashboard insights for child's progress (tasks, goals, diet, school).  
  Props: profileId (number), period (week/month).  
  Features: Charts (Recharts: progress bars, pie for categories), stats cards, AI suggestions.  
  Dependencies: Recharts, api.ts (fetch /profiles/:id/stats, /goals/:id).  
  Usage: ParentDashboard, ChildDashboard.  
  Notes: Fetches from backend; color-coded by category (green for completed).

### Gamification (Engagement)
- **CountdownChallengeCard.tsx**  
  Purpose: Display active countdown challenges (e.g., "Read for 30 min").  
  Props: challenge (object: id, title, timeLeft, reward).  
  Features: Timer (setInterval), progress bar, confetti on complete (/gamification/challenges/:id/complete).  
  Dependencies: canvas-confetti, lucide-react (clock icon).  
  Usage: Dashboard, TasksManager.  
  Notes: Integrates with economy (points on complete).

- **SimpleTaskCard.tsx**  
  Purpose: Card for individual task (title, points, due date, complete button).  
  Props: task (object), onComplete (func).  
  Features: Checkbox toggle (PUT /tasks/:id), photo proof upload, subtask list.  
  Dependencies: PhotoProof, api.ts (/tasks/:id/complete).  
  Usage: TasksManager, Dashboard.  
  Notes: Parent approval flow for photo proofs.

- **SpinWheel.tsx**  
  Purpose: Gamification wheel for mystery rewards (spin on daily login).  
  Props: profileId (number), onSpin (func).  
  Features: Canvas animation, segments (rewards from /gamification/mystery-rewards), sound effects.  
  Dependencies: sounds.ts, lucide-react (gift icons).  
  Usage: Daily login bonus (/gamification/login-bonus/:id/claim).  
  Notes: Weighted random (higher chance for small rewards).

- **HiddenAchievements.tsx**  
  Purpose: Teaser for unearned achievements (reveals on earn).  
  Props: profileId (number).  
  Features: Locked cards with hints, fetch /gamification/achievements/:id.  
  Dependencies: lucide-react (lock icon).  
  Usage: Achievement page, Dashboard.  
  Notes: Motivational; integrates with progress.

- **RewardManagement.tsx**  
  Purpose: Parent view to create/edit rewards in shop.  
  Props: profileId (parent).  
  Features: Form for title, points, image upload, category filter.  
  Dependencies: api.ts (POST /rewards, PUT /:id).  
  Usage: ParentDashboard, EconomySettings.  
  Notes: Stock management (-1 unlimited).

### Notifications & UI Feedback
- **NotificationBell.tsx**  
  Purpose: Bell icon with unread count, dropdown list.  
  Props: profileId (number).  
  Features: Fetch /notifications/unread-count, mark read (POST /:id/read), push integration.  
  Dependencies: usePushNotifications hook, lucide-react (bell).  
  Usage: Layout header.  
  Notes: Real-time via Web Push (/notifications/subscribe).

- **Toast.tsx**  
  Purpose: Temporary notifications (success/error).  
  Props: message (string), type (success/error/info), duration (ms).  
  Features: Auto-dismiss, stackable, Tailwind animations.  
  Dependencies: clsx for classes.  
  Usage: Global (e.g., after API calls).  
  Notes: Non-blocking; accessible (ARIA live).

### Economy & Settings
- **EconomySettings.tsx**  
  Purpose: Parent controls for child's economy (points rate, reward limits).  
  Props: childId (number).  
  Features: Form sliders (daily cap, bonus multipliers), save to /gamification/economy/:id.  
  Dependencies: api.ts, lucide-react (coin icons).  
  Usage: ParentDashboard.  
  Notes: Prevents over-earning; pricing guide endpoint.

### Proof & Verification
- **PhotoProof.tsx**  
  Purpose: Upload/verify photo proof for tasks (e.g., cleaned room).  
  Props: taskId (number), onUpload (func).  
  Features: Camera/file upload (POST /tasks/:id/proof), preview, parent approval flow.  
  Dependencies: Multer integration via API.  
  Usage: SimpleTaskCard.  
  Notes: Stores in backend; pending verification (/tasks/pending-proofs/:parentId).

## Patterns & Best Practices
- **Props Drilling**: Minimal; uses Context for global state (Profile, Features).
- **Styling**: Tailwind classes (clsx for conditional), responsive (sm/md/lg breakpoints).
- **Accessibility**: ARIA labels on interactive (e.g., buttons, toasts); alt on images.
- **Performance**: Lazy load charts (Recharts); memo on cards.
- **Error Handling**: Try-catch in hooks; fallback UI (e.g., avatar placeholder).
- **Testing**: No inline tests; assumes Vitest (from package.json).

## Reusability
- High: Cards (TaskCard, ChallengeCard) used across pages.
- Low: Layout specific to app structure.

Generated on 2026-01-09 from frontend/src/components/. For code, see individual .tsx files.