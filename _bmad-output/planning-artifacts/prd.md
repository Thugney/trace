---
stepsCompleted: [step-01-init, step-02-discovery, step-03-success, step-04-journeys, step-07-project-type]
inputDocuments: 
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
workflowType: 'prd'
lastStep: 7
documentCounts:
  briefCount: 0
  researchCount: 0
  brainstormingCount: 0
  projectDocsCount: 10
---

# Product Requirements Document - Family Learning Hub

**Author:** Editor
**Date:** 2026-01-09T11:27:49Z

## Executive Summary

The Family Learning Hub is an edtech PWA for family gamification, helping parents motivate kids through tasks, goals, diet tracking, and Tigrinya church school quizzes. This PRD focuses on targeted enhancements to address usability gaps, informed by 'what if' explorations for deeper impact:

- **Vision Alignment**: Improve task verification (photo proofs visible to parents with manual family approval—no AI auto-approve). Add timers to tasks for clarity/time-tracking, gamified with streaks/competitions (if feasible without breaking app). Fix quiz UX (clear questions, dynamic AI-driven age-appropriate themes, sounds, timers) to boost engagement and understanding for kids aged 5-12, potentially with collaborative modes. Parents control quiz topics (e.g., via AI prompts in settings, ensuring relevance to child's needs).

- **Problem Solved**: Current issues—parents can't review proofs (trust gap), tasks lack time controls (vague progress), quizzes are hard to read/engaging (low completion). Enhancements create accountable, fun learning flows; 'what if' reveals opportunities like dynamic theming and parent-guided topics to prevent frustration and scale engagement.

- **Integration**: Build on existing backend routes (/tasks/proof, /family-quizzes/:id/start) and frontend (SimpleTaskCard, QuizPlayer). Use ProfileContext for age theming, sounds.ts for audio, existing API for proofs/timers. Explore AI extensions (/ai-gamification) for dynamic content without major overhauls.

### What Makes This Special
These fixes make the app a true family coach: real-time visibility for parents (manual proofs), timed challenges for kids' focus (streak-integrated), themed quizzes that feel like games (dynamic/AI-adapted, parent-controlled topics). It transforms chores/learning into shared, joyful progress—differentiating from generic task apps by blending education, gamification, and family bonding with scalable, insightful automations.

## Project Classification

**Technical Type:** web_app  
**Domain:** edtech  
**Complexity:** medium  
**Project Context:** Brownfield - extending existing system  

The enhancements prioritize UX fixes (quiz readability, proof display) and engagement (timers, themes/sounds, parent topic control), leveraging current architecture (React Context, Express routes) without major overhauls, while opening doors to AI-driven personalization.

## Success Criteria

### User Success
- **Parents**: Can view and approve/reject photo proofs in <2min via dashboard, reducing trust gaps and enabling quick feedback (e.g., 80% approval rate within 24h). Timers provide clear start/stop for tasks, helping families track time spent (e.g., kids complete 70% tasks on-time). Seamless approval flow with visual timeline, notifications for pending proofs, and edge cases like rejections with guidance.
- **Kids**: Quizzes are readable and engaging with age-appropriate themes (e.g., cartoons for 5-8yo, realistic for 9-12yo), sounds for feedback, and timers for excitement (e.g., 85% quiz completion rate, average session >5min). They feel accomplished with visible progress (timers + proofs), leading to voluntary use (e.g., 60% daily active kids). Dynamic theming adapts visuals/sounds based on age from ProfileContext; handles pauses/resumes without frustration.
- **Family**: Shared visibility fosters bonding—parents see proofs/timers, kids get timely approvals, resulting in 70% family satisfaction (via in-app feedback or retention). Parent controls for quiz topics ensure relevance (e.g., math for school, fun for chores); collaborative elements like shared streaks add joy.

### Business Success
- **Engagement**: Higher task/quiz completion rates (target 70% family average across all profiles), measured weekly via backend analytics (/gamification/stats). This drives retention (e.g., 50% weekly active families) and validates the app's motivational value.
- **Impact**: Increased user sessions (e.g., +30% time in app from timers/themes), lower churn from frustration fixes, positioning for premium features (e.g., advanced AI themes). Track family bonding via multi-profile interactions (e.g., approval rates >80%).

### Technical Success
- **Performance**: Photo proofs load <2s for parents (95% success rate); timers sync across devices (no drift >5s, handle offline via SW); quizzes render optimally on mobile (95% uptime, <1% crash rate in logs).
- **Reliability**: 100% test coverage for new features (proof display, timer logic, quiz theming); no regressions in existing flows (e.g., task completion API). Backend endpoints (e.g., /tasks/verify-proof) handle approvals without race conditions; edge cases like paused timers or rejected proofs tested.

### Measurable Outcomes
- **Short-term (MVP)**: 70% task completion rate, 80% proof approval within 24h, quiz sessions >5min average; 90% parent satisfaction on visibility (via quick surveys).
- **Long-term**: 50% weekly retention, positive NPS (>7/10) on usability (proofs/timers/quizzes), 20% increase in daily active users post-launch; family engagement metric (e.g., 60% shared sessions).

## Product Scope

### MVP - Minimum Viable Product
- **Task Enhancements**: Fix proof display in parent dashboard (integrate /tasks/pending-proofs API with image serve, handle rejections); add start/stop timers to SimpleTaskCard (log duration on complete, optional streaks, pause/resume support).
- **Quiz Fixes**: Improve readability in QuizPlayer (larger fonts, high-contrast); add dynamic themes (age-based via ProfileContext), sounds (utils/sounds.ts), and timers (CountdownChallengeCard style, with pause for thinking).
- **Parent Controls**: Manual approval for proofs (no AI auto); parent sets quiz topics via AI prompts in settings (/ai-gamification/focus, e.g., "Tigrinya alphabet for 7yo").

### Growth Features (Post-MVP)
- **Advanced Timers**: Gamify with family competitions (e.g., sibling races); integrate with economy (bonus points for under-time, shared family timers).
- **Quiz Collaboration**: Real-time parent-child modes (WebSockets for live feedback); AI-generated questions based on parent topics, with theme previews.
- **Analytics**: Dashboards for completion trends (e.g., time spent per category); A/B test themes/sounds impact on engagement.

### Vision (Future)
- Fully adaptive app: AI personalizes timers/themes per child (e.g., difficulty scales with progress); quizzes evolve with streaks (harder questions on success). Seamless family sync (shared timers, group challenges). Expand to full edtech platform with curriculum integration, multi-language support (Tigrinya focus).

## User Journeys

**Journey 1: Parent - Managing Family Progress (Approval & Oversight)**
**Opening Scene**: Sarah, a dedicated mom of two kids (ages 7 and 10), starts her day checking the Family Learning Hub app on her phone. She's concerned because last night's chore proofs from her kids weren't visible in her dashboard, leading to morning arguments about whether the tasks were really done. The lack of time tracking also makes it hard to gauge effort—did they spend 10 minutes or an hour?

**Rising Action**: Sarah opens the Parent Dashboard, where a dedicated "Pending Proofs" section now shows thumbnails of uploaded photos with overlaid timers (e.g., "Clean Room: 18min spent"). She taps to view details: the proof image loads instantly, timestamped start/stop from the kid's app, and notes like "Bed made, floor swept." For the quiz, she sees a summary with age-themed visuals (cartoon for the younger kid) and timer data showing focused sessions. No more guessing—clear evidence at her fingertips.

**Climax**: Sarah reviews a proof for her 10yo's "Tigrinya Reading" task: the timer logged 25 minutes, image shows the book open. She taps "Approve" with a quick comment ("Proud of your focus—extra points!"), which instantly notifies the kid via push. The timer data updates the family streak, and the quiz attempt shows 85% completion with fun sounds noted in the log.

**Resolution**: With approvals done in under 2 minutes, Sarah feels relieved—trust restored without nagging. The family shares breakfast discussing the progress, kids excited about their updated leaderboard. Sarah notes the app's timers and themes made the kids more consistent, turning routines into rewarding habits. No more doubt; just collaborative growth.

This journey reveals requirements for: Parent dashboard with proof/timer visibility and quick approve/reject (with comments/notifications), integration with streaks/economy, clear UI for review.

**Journey 2: Kid - Engaging in Tasks & Quizzes (Fun & Accomplishment)**
**Opening Scene**: Alex, a curious 8-year-old, grabs his tablet for morning tasks but sighs at the plain quiz interface—small text makes questions hard to read, no engaging sounds or timers to make it exciting, leading to quick frustration and incomplete sessions.

**Rising Action**: Alex opens the app and starts his "Alphabet Practice" quiz. The screen transforms with a dynamic jungle theme (vibrant animals, big bold fonts for his age), a gentle timer starts with fun chimes every minute to keep focus without pressure. For his chore task "Clean Kitchen," he hits "Start Timer"—a colorful countdown begins with encouraging sounds, tracking his effort as he works.

**Climax**: Midway through the quiz, Alex answers a question correctly—the app plays a celebratory tune, the theme's monkey character "high-fives" with animation. He finishes under time, uploads a quick photo proof of his cleaned space (easy camera button), and the timer stops automatically on complete, logging 12 minutes with a satisfying ding.

**Resolution**: Alex sees his streak grow and points awarded instantly, beaming as the app notifies "Awesome job—Mom will see your proof!" The engaging theme and sounds make him eager for the next quiz, feeling capable and proud. No more boring screens; learning feels like an adventure, and he shares his badge with his sibling, sparking friendly competition.

This journey reveals requirements for: Age-appropriate dynamic themes/sounds/timers in QuizPlayer/SimpleTaskCard, easy proof upload with immediate feedback, integration with progress/streaks/economy.

### Journey Requirements Summary
These journeys highlight capabilities for: Enhanced parent oversight (proof/timer display, approvals with notifications), kid engagement (themed quizzes/tasks with timers/sounds, easy uploads), family sync (streaks, shared progress). Focus on trust (visible proofs) and fun (adaptive themes/timers) without adding new users.

## web_app Specific Requirements

### Project-Type Overview
The Family Learning Hub is a web_app (SPA) built as a React PWA, emphasizing mobile-first design for family use on phones/tablets. Enhancements (task proofs, timers, quiz UX) will maintain the single-page architecture, leveraging existing routing and Context API for seamless navigation. Focus on browser compatibility for modern devices, with polling for updates (e.g., proof approvals) to avoid real-time complexity.

### Technical Architecture Considerations
- **Browser Matrix**: Support latest versions of Chrome (v120+), Safari (iOS 17+), Firefox (v115+). No legacy IE/Edge support; test on mobile (iOS Safari, Android Chrome). Use Vite for bundling to ensure fast loads (<3s TTI on 3G).
- **Responsive Design**: Mobile-first (Tailwind breakpoints: sm/md/lg); ensure timers/proofs/quizzes adapt to screen size (e.g., touch-friendly buttons for kids, swipe for parents). Quiz themes scale fonts/icons for small screens.
- **Performance Targets**: Page loads <2s (Core Web Vitals); proofs/timer updates <500ms latency via polling (every 30s for pending). Quiz sessions <1s per question load; aim for 95% Lighthouse score (perf/accessibility).
- **SEO Strategy**: Minimal—family app, no public search needed. Meta tags for PWA install; internal links for navigation. No sitemap/indexing required.
- **Accessibility Level**: WCAG AA compliance—ARIA labels on timers (live regions for countdown), alt text for proofs/themes, keyboard nav for quizzes (e.g., Enter to submit answer). Color contrast >4.5:1 for kid themes; screen reader support for progress.

### Implementation Considerations
- **SPA Structure**: Use React Router for routes (e.g., /dashboard → proof/timer views); Context for state (Profile for age theming). Polling via useEffect in components (e.g., ParentDashboard fetches /pending-proofs every 30s).
- **Browser Support**: Polyfill if needed (Vite handles); test on iOS Safari for PWA quirks (e.g., offline timers via SW). No MPA redirects—keep single bundle.
- **Real-Time Alternatives**: Polling sufficient for approvals (no WebSockets); use service worker for offline queue (e.g., upload proof when back online).
- **Accessibility Integration**: Add ARIA-live for timer ticks, role="timer" on countdowns; ensure themes don't break contrast (Tailwind safe defaults). Test with VoiceOver/NVDA.
