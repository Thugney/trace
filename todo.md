# Trace Project - Development Tasks

## Current Sprint - PRIORITY: Fix Critical Login Bug

### Critical Backend Tasks
- [x] Fix: Login issue - When a kid (Beti) creates a task/goal requiring parent approval, parent login becomes slow/unresponsive. Debug authentication flow and session management during approval requests.
- [x] Investigate: Check backend logs for errors during approval creation
- [x] Debug: Trace authentication middleware when approval notifications are sent
- [x] Fix: Identify and resolve bottleneck in approval notification/session handling
- [x] Test: Reproduce - create task as kid, then attempt immediate parent login
- [x] Verify: Parent can login immediately after kid creates approval-required task
- [ ] Test: Run `docker-compose exec backend npm test` after fixes

### AI Assistant Feature (Admin-Controlled)
- [x] Feature: Add AI assistant enable/disable setting per kid (admin Robel controls)
- [x] Backend: Create API endpoint PUT /api/kids/:id/ai-assistant to toggle access
- [x] Database: Add `ai_assistant_enabled` boolean field to kid user schema
- [x] Backend: Modify AI assistant endpoints to check kid's enabled status
- [x] Test: API returns 403 when disabled kid tries to access AI assistant

### Frontend Tasks
- [x] Feature: Add AI assistant toggle switch in admin settings for each kid
- [x] UI: Create settings page/modal showing list of kids with toggles
- [x] Frontend: API integration to save AI assistant enabled/disabled state
- [x] UI: Show/hide AI assistant interface based on kid's enabled status
- [ ] Fix: Test and improve login UI responsiveness during approval requests
- [ ] Test: Run `docker-compose exec frontend npm test` and ensure all tests pass
- [ ] UI: Verify responsive design works properly

### Docker & DevOps
- [ ] Verify: `docker-compose up -d` runs without errors
- [ ] Verify: All containers are healthy (`docker-compose ps`)
- [ ] Test: Backend API responds at http://localhost:3001
- [ ] Test: Frontend loads at http://localhost:3000
- [ ] Check: Database container is running and accessible

### Git & Deployment
- [ ] Pull: Ensure latest code from git is pulled (`git pull origin main`)
- [ ] Review: Check `git status` for uncommitted changes after each feature
- [ ] Commit: Login fix - "Fix: Resolve parent login delay during kid approval requests"
- [ ] Commit: AI assistant backend - "Feature: Add backend API for per-kid AI assistant control"
- [ ] Commit: AI assistant frontend - "Feature: Add admin UI to toggle AI assistant per kid"
- [ ] Document: Update README.md with AI assistant settings instructions
- [ ] Ready: Ensure code is ready for Synology deployment

## Testing Checklist (run after each feature)
- [ ] Backend unit tests pass (`docker-compose exec backend npm test`)
- [ ] Frontend builds successfully
- [ ] Docker containers start cleanly (`docker-compose ps` shows all "Up")
- [ ] No console errors in browser (check DevTools)
- [ ] API endpoints respond correctly (test with curl or Postman)
- [ ] Critical test: Kid creates task ? Parent logs in immediately (no delay)
- [ ] AI assistant: Toggle on/off for different kids works correctly

## Notes
- **START WITH**: `git pull origin main` to get latest code
- Test locally in Docker before committing
- Use descriptive commit messages
- Each completed feature should be committed separately
- Verify on Synology after pushing
- Working on Windows OS with Node and Docker
- **PRIORITY ORDER**: 1) Pull latest code, 2) Fix login issue, 3) AI assistant feature
