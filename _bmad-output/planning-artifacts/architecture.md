---
stepsCompleted: [step-01-init]
inputDocuments: 
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - docs/index.md
  - docs/api-contracts-backend.md
  - docs/data-models-backend.md
  - docs/ui-component-inventory-frontend.md
  - docs/source-tree-analysis.md
  - docs/development-guide.md
  - docs/integration-architecture.md
  - docs/architecture-backend.md
  - docs/architecture-frontend.md
  - docs/project-overview.md
workflowType: 'architecture'
lastStep: 1
documentCounts:
  briefCount: 0
  researchCount: 0
  uxDesignCount: 1
  projectDocsCount: 10
---

# Architecture Decision Record - Family Learning Hub

## Overview
This document captures key architectural decisions for the Family Learning Hub, a React-based PWA for family gamification in edtech. Decisions are guided by project-type requirements (web_app: SPA structure, responsive design, performance targets from PRD step-07) and non-functional requirements (NFRs: usability, reliability, engagement metrics from step-10 success criteria, e.g., <2s loads, 95% uptime, WCAG AA).

**Project Classification**: web_app (SPA, mobile-first PWA), edtech domain, medium complexity, brownfield extension.

**Guiding Principles**:
- Embrace boring, stable tech (React, Express, polling over WebSockets for simplicity).
- User journeys drive decisions (parent oversight, kid engagement).
- Scale for family use: offline support via SW, polling for sync.
- Connect to business value: boost engagement (70% completion), retention (50% weekly).

## Architectural Context
- **Existing Stack**: Frontend (React/Vite/Tailwind, Context API, PWA with SW); Backend (Express, PostgreSQL via migrations, routes for tasks/proofs/quizzes); Integrations (Push notifications, AI gamification endpoints).
- **Key Inputs**: PRD (MVP: proof approvals, timers, quiz theming); UX Spec (mobile flows); Docs (API contracts, data models).

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
The FRs center on enhancing family engagement in an edtech PWA: task proofs with manual parent approvals (extend /tasks routes for image serving and rejection handling with comments/notifications); timers in tasks/quizzes (add start/stop/pause logic in SimpleTaskCard/QuizPlayer, logging durations to backend for streaks/economy integration); quiz improvements (dynamic age-appropriate themes via ProfileContext, sounds from utils/sounds.ts, readability with larger fonts/high-contrast). Parent controls include AI prompts for topic generation (/ai-gamification). Architecturally, this implies modular SPA updates (React components with hooks for polling/offline), backend schema tweaks (e.g., timer fields in tasks table via migrations), and cross-profile data flows without introducing real-time complexity.  
ADR 1: Timer/Proof Sync - Decision: Polling + SW queuing. Rationale: Balances simplicity and offline needs for medium-scale family use.

**Non-Functional Requirements:**
NFRs from success criteria drive reliability (95% uptime, 100% test coverage, no regressions via Vitest); performance (<2s loads for proofs, <500ms updates via polling, Core Web Vitals optimization in Vite); usability (WCAG AA with ARIA-live for timers, high-contrast themes); security (RBAC for family views, secure image uploads); engagement (70% task/quiz completion, 50% weekly retention via streaks). Scalability for small family units (no high-volume needs), with offline queuing in SW to handle intermittent connectivity.  
ADR 2: Proof Handling - Decision: Cloud storage with DB fallback. Rationale: Ensures performance NFRs while maintaining reliability in brownfield DB.

**Scale & Complexity:**
Medium brownfield web_app extension: 5-7 new/enhanced components (e.g., ProofReview in ParentDashboard, ThemedQuizPlayer); integrations with existing API (polling for sync); low data volume but cross-device consistency required.  
ADR 3: Theme Personalization - Decision: Client-side via Context. Rationale: Optimizes usability/engagement without backend overhead.

- Primary domain: full-stack web (PWA frontend, RESTful backend).
- Complexity level: medium (targeted UX/performance fixes, no distributed systems).
- Estimated architectural components: 8-10 (frontend: Context/hooks/SW; backend: routes/migrations; shared: testing/offline patterns).

### Technical Constraints & Dependencies
- Brownfield constraints: Build on existing React/Express/PostgreSQL/Vite stack—no major migrations; use polling (useEffect intervals) over WebSockets for simplicity.  
Integrated from ADRs: Cloud deps (e.g., AWS S3) for proofs; no new real-time libs.
- Dependencies: ProfileContext for personalization; sounds.ts and NotificationBell for feedback; docs/api-contracts for endpoint extensions (e.g., /tasks/timer-log).
- Platform: Modern browsers (Chrome 120+, Safari iOS 17+); PWA installable, offline-first for timers/proofs.
- Tools: MUI/Tailwind for UI (hybrid with existing components); Vitest for tests.

### Cross-Cutting Concerns Identified
- Accessibility: ARIA roles for dynamic elements (timers as live regions), contrast audits for themes.  
ADR Impact: Client-side themes ensure ARIA compliance without server latency.
- Offline/Resilience: SW for queuing uploads/timer state; graceful degradation (e.g., local storage for pauses).
- Personalization: Age/profile-based adaptations affecting all UI (themes, difficulty via AI endpoints).
- Testing/Monitoring: End-to-end coverage for integrations (e.g., proof approval flows); analytics for NFR metrics (completion rates).
- Localization: Tigrinya support in quizzes (font fallbacks, RTL if needed).  
- Privacy: RBAC enforcement for cross-profile data flows to protect family boundaries (e.g., proofs visible only to parents).  
Overall ADR Rationale: These decisions prioritize "boring tech" for stability, directly tying to step-07 web_app patterns (SPA/polling) and step-10 NFRs (performance/engagement), reducing risks in brownfield extensions.

**Party Mode Insights (Mary, Sally, Amelia):**
- Requirements Verification: FRs emphasize trust-building (manual approvals, no AI auto) and engagement (timers/streaks for 70% completion); gaps in privacy for multi-profile sync—recommend explicit RBAC checks in API routes.
- UX Trade-offs: Client-side themes/sounds boost kid delight (85% quiz completion) but require SW for offline consistency; polling intervals (30s) balance battery life with approval excitement.
- Dev Feasibility: Extensions via hooks/migrations are low-risk; reinforce polling/SW for NFR reliability (95% uptime), cloud proofs for <2s loads; add Vitest for race conditions in streaks/economy.
- Overall: Balanced approach aligns business value (50% retention) with technical simplicity, flagging sync gaps for further decisions.

## Decision Log
*(Decisions will be appended here as we collaborate. Each entry: Context, Decision, Rationale, Consequences, informed by step-07/10.)*

1. **No decisions yet - starting fresh.**

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web_app (brownfield PWA frontend + REST backend) based on project requirements analysis—existing React/Vite/Tailwind stack for mobile-first SPA, Express/PostgreSQL for API/routes. No new starter CLI needed; evaluate extensions to maintain "boring tech" stability while addressing FRs (timers/proofs/themes) and NFRs (95% uptime, WCAG AA).

### Starter Options Considered

Since brownfield, considered extension patterns/best practices (researched via current docs and standards):
- **Frontend Extensions (React PWA)**: Leverage Vite (current v5.x for fast HMR/bundles) + Tailwind (v3.x for responsive themes); add Framer Motion for animations if needed (low overhead for kid delight). Alternatives like Next.js not recommended—stick to Vite for existing SPA routing.
- **Backend Extensions (Express API)**: Use existing Express (v4.x stable) with migrations for schema (timer duration, proof URLs); cloud storage (e.g., AWS S3 v3 SDK) for images to meet <2s loads. No full rewrite—modular routes (e.g., /tasks/timer-log).
- **Full-Stack Patterns**: Polling via useEffect + SW (Workbox for offline queuing); Vitest (v1.x) for 100% coverage. Considered T3 Stack but too opinionated for brownfield—current setup scores high on dev productivity.

Maintenance: All core tools (React 18.x, Express 4.x, Vite 5.x, PostgreSQL 16.x) actively maintained (per official sites, 2024-2026 updates focus on perf/security).

### Selected Starter: Existing Brownfield Stack (No New CLI)

**Rationale for Selection:**
The current stack is production-ready for medium complexity edtech PWA extensions—aligns with step-07 (SPA structure, browser matrix Chrome/Safari, responsive Tailwind) and step-10 (performance <2s via Vite/SW, reliability via tests/migrations). It embraces stable tech (no new deps like WebSockets), supports offline NFRs (SW queuing for proofs/timers), and fits intermediate skill (existing package.json). Trade-off: Minor schema tweaks needed for timers, but avoids migration risks. Business value: Quick iterations for engagement (70% completion via streaks).

**Initialization Command:**
N/A (brownfield)—next steps: `npm run dev` (frontend) + `npm start` (backend) for local; Docker-compose up for prod-like testing.

**Architectural Decisions Provided by Existing Stack:**
**Language & Runtime:**
TypeScript (strict mode in tsconfig.json) for frontend safety; JavaScript for backend simplicity—enforces types in React components (e.g., ProfileContext) without full rewrite.

**Styling Solution:**
Tailwind (postcss.config.js) + MUI hybrid (from UX spec)—responsive classes for mobile-first (sm/md breakpoints), high-contrast themes for WCAG AA; easy extension for age-adaptive colors (e.g., blues/greens per spec).

**Build Tooling:**
Vite (vite.config.ts)—fast dev server/HMR, PWA plugin for SW/manifest; optimizes Core Web Vitals (<3s TTI on 3G), bundles for modern browsers (Chrome 120+, Safari iOS 17+).

**Testing Framework:**
Vitest (vitest.config.ts)—unit/integration for new features (e.g., timer hooks, proof uploads); 100% coverage target for NFRs, with setup.ts for mocks.

**Code Organization:**
Modular: frontend/src/components (e.g., SimpleTaskCard extensions), src/services/api.ts for polling; backend/src/routes (e.g., /tasks extensions), migrations for schema. Patterns: Hooks for state (usePushNotifications), Context for personalization.

**Development Experience:**
Hot reloading via Vite; debugging with VSCode; env vars (.env.example); docs/development-guide.md for workflows. Supports intermediate level—no steep learning curve.

**Note:** Project extensions using this stack should be the first implementation stories (e.g., add timer hook to SimpleTaskCard).

**Party Mode Insights (Mary, Sally, Amelia):**
- Requirements Verification: FRs emphasize trust-building (manual approvals, no AI auto) and engagement (timers/streaks for 70% completion); gaps in privacy for multi-profile sync—recommend explicit RBAC checks in API routes.
- UX Trade-offs: Client-side themes/sounds boost kid delight (85% quiz completion) but require SW for offline consistency; polling intervals (30s) balance battery life with approval excitement.
- Dev Feasibility: Extensions via hooks/migrations are low-risk; reinforce polling/SW for NFR reliability (95% uptime), cloud proofs for <2s loads; add Vitest for race conditions in streaks/economy.
- Overall: Balanced approach aligns business value (50% retention) with technical simplicity, flagging sync gaps for further decisions.

## Status
Initialized. Ready for collaborative decision-making on enhancements (e.g., proof display, timers, dynamic themes).