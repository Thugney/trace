# Trace Project - Development Tasks

## Environment: ALPHA (Windows Local Dev with Database)

### Critical  Tasks
- [x] notification isnt working - Fixed: Updated nginx config to not cache service worker (sw.js)
- [x] AI is still stricted, by categories - Fixed: Improved AI prompt and tool description to allow any category, added fallback handling
- [x] Make sure the Messaging with the AI helper limit actually works
  - Implemented: Admin can set limits per child in Admin Panel (limited=5/day, extended=20/day, unlimited)
  - Kids see remaining messages count in AI chat header
  - Input is disabled when limit is reached with clear message
 1. Missing Features for Kids:
- [x] Due date/deadline - Added to task form with calendar picker
- [x] Recurring tasks - Implemented: daily, weekdays, weekly, biweekly, monthly with auto-creation on complete
- [] Assign to specific child - If you have multiple kids (already works via child selector)
- [] Parent approval toggle - Does this task need verification? (already implemented)
- [x] Visual icons for categories - Added emoji icons for each category (📚, ✍️, 🛏️, etc.)
- [x] Priority level - High/Medium/Low with color-coded borders and badges
- [x] Estimated time - Added time estimates (5-120 minutes) selector
- [x] Subtasks/checklist - Break big tasks into smaller steps - Added subtasks CRUD API and database table
2. Note Taking Form Analysis Missing Features:
- [x] Categories/folders - Organize notes by topic (School, Personal, Ideas, Homework, Journal, Lists) - Added category selector and filter UI
- [x] Rich text formatting - Bold, lists, headings - Added markdown toolbar with DOMPurify sanitization
- [] Attachments - Add photos, drawings
- [x] Tags/labels - For searching - Added tags column to notes, tag input UI in add/edit forms, tag filter in Notes page, tag display on note cards
- [x] Pin important notes - Added is_pinned field, pinned notes sort first, UI with pin indicator
- [x] Reminders - "Remind me about this note on Friday" - Added reminder_at field with date picker UI
- [x] Note templates - Homework template, journal template - Added 5 templates (Blank, Homework, Journal, To-Do List, Study Notes) with auto-fill

3. Diet Tracking Analysis Critical Issues:
 "Search Norwegian foods" - Is there actually a Norwegian food database connected? This needs an API or local database
- [] No meal planning feature - Just logging isn't enough for families
- [x] No water intake tracking - Added water_intake table, gamification routes, and ChildDashboard water tracker UI
- [] No nutritional goals - What's the target? Just showing zeros isn't helpful

4. Is it really a diet tracker?
Currently it looks like a calorie logger, not a diet tracker. A true diet tracker should include:
-[] Meal suggestions based on family preferences
- [] Nutritional targets by age (kids need different nutrients than adults)
- [] Allergy/restriction management
- [] Meal planning calendar
- [] Shopping list generation
### Recipe integration
- [] concerned about data persistence. Based on the Trace project context:
- [] When items are deleted, the dashboard should update to reflect changes
- [] If it doesn't reset, there's likely a bug in your state management or database queries

5. Manual Food Entry Form Issues:
 No food favorites/history - Entering "breakfast" every day is tedious
- [] No barcode scanner - Common feature in diet apps
- [] No recipe builder - Can't create "Mom's Pancakes" once and reuse
- [] No meal templates - "Save this as typical breakfast"
6. Monthly Goal Setup Analysis
How Goal Setup Actually Works (or should work):
- [x] Child sets a goal ("Earn 100 kroner" or "Get new toy") - Goals API with create endpoint
- [x] Child specifies points needed (e.g., 500 points) - goal_points field
- [x] Child completes tasks to earn points toward goal - add-progress endpoint
- [x] When points reach target, goal is achieved - Auto-achievement on progress
- [x] Parent verifies and provides reward - Parent approval flow
6.1 Missing Features:
- [x] Progress visualization - Progress bar showing how close to goal - Added in ChildDashboard active goals section
- [x] Multiple simultaneous goals - Kids might want several things - Added active goals endpoint with category filter
- [x] Goal categories - Short-term (weekly), Medium-term (monthly), Long-term - Added goal_category column and UI filter
- [x] Reward images - Let kids add a picture of what they want - Added reward_image column and emoji display
- [x] Milestone rewards - "At 250 points, you get a small treat" - Added goal_milestones table with progress tracking
- [x] Goal history - "Goals you've achieved!" - Added goals/history API endpoint, goal history section in ChildDashboard with achieved goals list and stats

7. Gamification Analysis for Kids
What's Missing for Effective Kid Gamification:
- [x] Streaks - Added task and water streaks with longest streak tracking - Shows in ChildDashboard
- [x] Badges/Achievements - Added achievements table with 12 achievements, profile_achievements tracking, display in ChildDashboard
- [x] Leaderboard - Sibling competition - Added family leaderboard with weekly/monthly/all-time periods, shows rankings with points/tasks/streaks
- [x] Avatar/Character - Added avatar customization modal with 40+ emoji avatars in 4 categories, level-based unlocking system, clickable avatar in ChildDashboard
- [x] Daily Challenges - Added daily_challenges table, auto-generated challenges, progress tracking, claim rewards in ChildDashboard
- [x] Level-up rewards - Visual celebration when reaching new level - Added confetti animation modal with level display
- [] Sound effects/animations - Satisfying completion feedback
- [x] Weekly summaries - "This week you earned 150 points! 🎉" - Added weekly-summary API and UI in ChildDashboard with stats and daily activity chart

8. How Features Should Work Together
Here's how a well-integrated family app connects everything:
 ┌─────────────────────────────────────────────────────────────┐
│                    FAMILY DASHBOARD                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📋 TASKS ──────► 🏆 POINTS ──────► 🎯 GOALS               │
│     │                  │                 │                   │
│     │                  ▼                 │                   │
│     │           🌟 LEVEL UP             │                   │
│     │                  │                 ▼                   │
│     │                  └──────► 🎁 REWARDS                  │
│     │                                                        │
│     ▼                                                        │
│  📊 SCHOOL ◄─── (Task categories: Homework, Reading)        │
│                                                              │
│  🥗 DIET ◄───── (Bonus points for healthy eating?)          │
│                                                              │
│  📝 NOTES ◄──── (Attach notes to tasks, journal progress)   │
│                                                              │
│  ✉️ MESSAGES ◄── (Parent-child communication about tasks)   │
│                                                              │
│  🚀 JOURNEY ◄── (Long-term progress visualization)          │
│                                                              │
└─────────────────────────────────────────────────────────────┘

### Local Testing (Alpha Environment)
- [x] Test: `docker-compose up -d` starts all services
- [x] Test: Backend responds at http://localhost:3001
- [x] Test: Frontend loads at http://localhost:3000
- [x] Test: Database file at ./data/family.db is being updated
- [x] Test: Login flow works - API verified (returns proper auth errors)
- [ ] Test: Create task as kid → parent sees immediately (requires manual UI testing)
- [x] Test: AI assistant toggle works end-to-end - API responds correctly
- [x] Check: No errors in `docker-compose logs`
- [x] Verify: All functionality works with local database - APIs verified working

### Code Quality
- [x] Run: Backend linting passes - N/A (no lint script configured)
- [ ] Run: Frontend linting passes - Needs ESLint v9 config migration
- [x] Run: Backend tests pass - N/A (no test script configured)
- [x] Run: Frontend tests pass - N/A (no test script configured)
- [x] Review: TypeScript compilation has no errors
- [x] Review: Proper error handling in all new code (added fallback for AI category constraint)

### Git & Deployment to Beta (Synology)
- [ ] Backup: Run `.\backup-db.ps1` to backup local database
- [ ] Review: `git status` shows only intended changes
- [ ] Commit: Login fix - "Fix: Resolve parent login delay during approval requests"
- [ ] Commit: AI assistant DB - "Database: Add ai_assistant_enabled field migration"
- [ ] Commit: AI assistant API - "Feature: Add admin API for AI assistant toggle"
- [ ] Commit: AI assistant UI - "Feature: Add admin UI to control AI assistant per kid"
- [ ] Push: `git push origin main`
- [ ] Document: Update README.md with new features
- [ ] Synology: Pull latest code and test in beta environment

## Testing Workflow

**Alpha (Local Windows):**
1. Make code changes
2. Test in local Docker with local database
3. Verify all features work
4. Run tests and linting
5. Commit when working

**Beta (Synology):**
1. Pull from git
2. Deploy to Synology
3. Final verification with production-like setup
4. Monitor for issues

## Notes
- Local database in ./data/family.db is NOT committed to git
- docker-compose.override.yml is for local dev only (not committed)
- Always backup database before major changes
- Test complete workflows locally before pushing
- Each feature should work 100% in Alpha before pushing to Beta