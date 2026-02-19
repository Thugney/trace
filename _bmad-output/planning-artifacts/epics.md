---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
---

# trace - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for trace, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Task verification with photo proofs visible to parents with manual family approval (no AI auto-approve)
FR2: Add start/stop timers to tasks for clarity and time-tracking with pause/resume support
FR3: Gamify tasks with streaks and optional competitions integrated with economy system
FR4: Fix quiz UX with clear questions, larger fonts, and high-contrast for readability
FR5: Implement dynamic age-appropriate themes for quizzes based on ProfileContext (cartoon for ages 5-8, realistic for ages 9-12)
FR6: Add sounds for quiz feedback using utils/sounds.ts (celebratory tunes for correct answers, chimes for timer updates)
FR7: Add timers to quizzes with pause functionality for thinking time
FR8: Parent dashboard with "Pending Proofs" section showing thumbnails with overlaid timers
FR9: Proof review interface showing proof images instantly with timestamped start/stop and notes
FR10: Approve/reject proofs with comments and push notifications to kids
FR11: Timer data integration with family streak system
FR12: Easy proof upload with one-tap camera access from kid interface
FR13: Timer logging on task completion with duration recording to backend
FR14: Parent control of quiz topics via AI prompts in settings (/ai-gamification/focus)
FR15: Integration of proof display in parent dashboard with /tasks/pending-proofs API for image serving
FR16: Handle proof rejections with appropriate feedback and guidance
FR17: Age-based personalization of all UI elements (themes, sounds, difficulty) via ProfileContext
FR18: Polling-based updates for proof approvals and timer sync (every 30s)
FR19: Offline support for timers and proof uploads via service worker queuing
FR20: Responsive mobile-first design with Tailwind breakpoints for all interfaces

### NonFunctional Requirements

NFR1: Performance - Photo proofs load <2s for parents (95% success rate)
NFR2: Performance - Timers sync across devices with no drift >5s
NFR3: Performance - Quizzes render optimally on mobile (95% uptime, <1% crash rate in logs)
NFR4: Performance - Page loads <2s (Core Web Vitals)
NFR5: Performance - Proofs/timer updates <500ms latency via polling
NFR6: Performance - Quiz sessions <1s per question load
NFR7: Performance - Target 95% Lighthouse score (performance/accessibility)
NFR8: Reliability - 100% test coverage for new features via Vitest
NFR9: Reliability - No regressions in existing flows
NFR10: Reliability - Backend endpoints handle approvals without race conditions
NFR11: Reliability - 95% uptime for quiz components
NFR12: Usability - WCAG AA compliance with ARIA labels on timers (live regions), alt text for proofs/themes
NFR13: Usability - Keyboard navigation support for quizzes
NFR14: Usability - Color contrast >4.5:1 for all themes including kid adaptations
NFR15: Usability - Screen reader support for progress and timer updates
NFR16: Security - RBAC enforcement for cross-profile data flows (parents only see their kids' proofs)
NFR17: Security - Secure image uploads and storage
NFR18: Compatibility - Support latest Chrome (v120+), Safari iOS 17+, Firefox (v115+)
NFR19: Compatibility - Mobile-first responsive design with Tailwind breakpoints (sm/md/lg)
NFR20: Compatibility - PWA installable with offline-first support
NFR21: Scalability - Support for family units (low data volume but cross-device consistency)
NFR22: Maintainability - Modular code organization with hooks for state management
NFR23: Measurability - Analytics tracking for completion rates (70% task completion, 80% proof approval within 24h)
NFR24: Measurability - Parent satisfaction tracking (90% target via quick surveys)

### Additional Requirements

**Technical Architecture Requirements:**
- Use polling (useEffect intervals every 30s) over WebSockets for simplicity and offline support
- Implement service worker queuing for offline timer state and proof uploads
- Local Docker Synology storage for proof images with database fallback for metadata
- Client-side theme personalization via ProfileContext (no server-side rendering)
- Build on existing brownfield stack: React/Vite/Tailwind frontend, Express/PostgreSQL backend
- Use Material-UI (MUI) as core component library with Tailwind overrides for custom styling
- Implement Vitest for 100% test coverage of new features
- Add database migrations for timer duration fields and proof URL storage
- Extend existing API routes: /tasks/pending-proofs, /tasks/timer-log, /tasks/verify-proof
- Implement RBAC checks in API routes for cross-profile data access control

**UX/Design Requirements:**
- Mobile-first PWA optimized for tablets and phones (touch-based interactions)
- Automatic theme activation based on age/profile (no manual setup required)
- Instant feedback with celebratory audio via sounds.ts for correct quiz answers
- Intuitive timer controls (tap to start/pause) with visual progress indicators
- One-tap camera access for proof uploads with immediate visual feedback
- Parent approval via swipe-to-approve or one-tap with thumbnail previews
- Color system: Warm blues (#4F46E5 to #1E40AF) for trust, greens (#10B981 to #059669) for joy
- Typography: Inter font with larger sizes for kids (18px+ body), Noto Sans Tigrinya for non-Latin
- Spacing: 8px base unit with spacious layouts for mobile (48px+ touch targets for kids)
- Design system hybrid: Playful kid elements (rounded cards, gradients) + clean parent views (structured grids)

**Cross-Cutting Requirements:**
- Full WCAG AA accessibility: ARIA live regions for timers, high-contrast themes, keyboard navigation
- Offline-first design with graceful degradation (local storage for paused timers)
- Tigrinya language support in quizzes with appropriate font fallbacks and RTL consideration
- Analytics integration for tracking NFR metrics (completion rates, approval times)
- Push notifications for proof approvals using existing NotificationBell component
- Family streak visualization with confetti animations for celebratory moments
- A/B testing capability for theme variants and engagement optimization

### FR Coverage Map

FR1: Epic 1 - Task verification with photo proofs visible to parents with manual family approval
FR2: Epic 2 - Add start/stop timers to tasks for clarity and time-tracking with pause/resume support
FR3: Epic 4 - Gamify tasks with streaks and optional competitions integrated with economy system
FR4: Epic 3 - Fix quiz UX with clear questions, larger fonts, and high-contrast for readability
FR5: Epic 3 - Implement dynamic age-appropriate themes for quizzes based on ProfileContext
FR6: Epic 3 - Add sounds for quiz feedback using utils/sounds.ts
FR7: Epic 2 - Add timers to quizzes with pause functionality for thinking time
FR8: Epic 1 - Parent dashboard with "Pending Proofs" section showing thumbnails with overlaid timers
FR9: Epic 1 - Proof review interface showing proof images instantly with timestamped start/stop and notes
FR10: Epic 1 - Approve/reject proofs with comments and push notifications to kids
FR11: Epic 4 - Timer data integration with family streak system
FR12: Epic 1 - Easy proof upload with one-tap camera access from kid interface
FR13: Epic 2 - Timer logging on task completion with duration recording to backend
FR14: Epic 3 - Parent control of quiz topics via AI prompts in settings (/ai-gamification/focus)
FR15: Epic 1 - Integration of proof display in parent dashboard with /tasks/pending-proofs API for image serving
FR16: Epic 1 - Handle proof rejections with appropriate feedback and guidance
FR17: Epic 5 - Age-based personalization of all UI elements (themes, sounds, difficulty) via ProfileContext
FR18: Epic 2 - Polling-based updates for proof approvals and timer sync (every 30s)
FR19: Epic 2 - Offline support for timers and proof uploads via service worker queuing
FR20: Epic 5 - Responsive mobile-first design with Tailwind breakpoints for all interfaces

## Epic List

### Epic 1: Family Task Oversight Foundation
Parents can review and approve kids' task proofs with manual approval, timestamp verification, and notifications.
**FRs covered:** FR1, FR8, FR9, FR10, FR12, FR15, FR16
**User value:** Parents gain visibility and control over kids' task completion, building trust through manual proof approval.

### Epic 2: Time Tracking & Sync System
Kids can track time on tasks and quizzes with reliable start/stop/pause controls, duration logging, and cross-device sync.
**FRs covered:** FR2, FR7, FR13, FR18, FR19
**User value:** Accurate time measurement for tasks and quizzes with offline support and device synchronization.

### Epic 3: Engaging Quiz Experience
Kids experience age-appropriate, themed quizzes with audio feedback, clear readability, and parent-controlled topics.
**FRs covered:** FR4, FR5, FR6, FR14
**User value:** Personalized, engaging learning that adapts to child's age and parent's educational priorities.

### Epic 4: Family Gamification & Progress
Families see shared streaks, optional competitions, and visual progress tracking integrated with task completion.
**FRs covered:** FR3, FR11
**User value:** Motivation through gamification and family bonding around shared accomplishments.

### Epic 5: Accessibility & Personalization Foundation
Universal accessibility, responsive design, age personalization, security compliance, and performance optimization for all family members.
**FRs covered:** FR17, FR20 + All NFRs (1-24) + Additional Requirements
**User value:** Reliable, accessible app that works for all family members across devices and abilities.