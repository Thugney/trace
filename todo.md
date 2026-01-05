# Trace Project - Development Tasks

## Environment: ALPHA (Windows Local Dev with Database)

### Critical  Tasks
- [x] notification isnt working - Fixed: Updated nginx config to not cache service worker (sw.js)
- [x] AI is still stricted, by categories - Fixed: Improved AI prompt and tool description to allow any category, added fallback handling

### Local Testing (Alpha Environment)
- [x] Test: `docker-compose up -d` starts all services
- [x] Test: Backend responds at http://localhost:3001
- [x] Test: Frontend loads at http://localhost:3000
- [ ] Test: Database file at ./data/family.db is being updated
- [ ] Test: Login flow works (create test users if needed)
- [ ] Test: Create task as kid → parent login immediately
- [ ] Test: AI assistant toggle works end-to-end
- [ ] Check: No errors in `docker-compose logs`
- [ ] Verify: All functionality works with local database

### Code Quality
- [ ] Run: Backend linting passes (`docker-compose exec backend npm run lint`)
- [ ] Run: Frontend linting passes (`docker-compose exec frontend npm run lint`)
- [ ] Run: Backend tests pass (`docker-compose exec backend npm test`)
- [ ] Run: Frontend tests pass (`docker-compose exec frontend npm test`)
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