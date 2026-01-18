# Claude Workflow for Family Learning Hub

This document describes the proper workflow for Claude to follow when adding features or fixing bugs in this codebase.

## CRITICAL: Branch Workflow

**BEFORE making any changes:**

1. **ASK the user which branch they are actively working on**
   - The user may be working on a feature branch that is ahead of the main branch
   - Never assume `claude/family-management-pwa-FWMSG` or `main` is the correct base
   - Example: "Which branch are you currently working on? I want to make sure I build on top of your latest code."

2. **Switch to the user's working branch**
   ```bash
   git fetch origin
   git checkout origin/<user's-branch>
   ```

3. **Create a feature/fix branch FROM the user's working branch**
   ```bash
   git checkout -b feature/<feature-name>
   # OR
   git checkout -b fix/<bug-name>
   ```

## Why This Matters

On 2025-01-18, a critical mistake was made:
- I created a branch from `claude/family-management-pwa-FWMSG` (the default/main branch)
- The user was actually working on `feature/gemini-book-creation` which had many more features
- My changes overwrote the user's working code, breaking the app completely
- Menus/navs disappeared, users couldn't login

**NEVER make this mistake again.** Always verify the user's active branch first.

## Feature Implementation Workflow

### 1. Understand the Request
- Ask clarifying questions if needed
- Understand what the user wants to achieve
- Check if similar functionality already exists

### 2. Explore the Existing Codebase
- Use `Task` tool with `Explore` agent for broad searches
- Check existing infrastructure before building new
- This app already has:
  - Push notification system (`backend/src/services/notifications.ts`)
  - Scheduler for reminders (`backend/src/services/scheduler.ts`)
  - Comprehensive sound effects (`frontend/src/utils/sounds.ts`)
  - Economy controls (`backend/src/services/economyControl.ts`)
  - Photo proof system for tasks
  - Timer system for tasks

### 3. Plan the Implementation
- Use `TodoWrite` to create a task list
- Break complex features into small steps
- Update todos as you progress

### 4. Implement Backend First
- Database migrations in `backend/src/database/init.ts`
- New routes in `backend/src/routes/`
- Services in `backend/src/services/`
- Follow existing patterns (authenticate middleware, response formats)

### 5. Implement Frontend
- Types in `frontend/src/types/index.ts`
- API calls in `frontend/src/services/api.ts`
- Components in `frontend/src/components/`
- Pages in `frontend/src/pages/`

### 6. Test Before Committing
- Build both frontend and backend
- Check for TypeScript errors
- Verify Docker builds if applicable

## Project Structure Quick Reference

```
trace/
├── backend/
│   ├── src/
│   │   ├── database/
│   │   │   └── init.ts        # Database schema & migrations
│   │   ├── routes/            # API endpoints
│   │   ├── services/          # Business logic
│   │   │   ├── notifications.ts   # Push notifications
│   │   │   ├── scheduler.ts       # Cron jobs for reminders
│   │   │   └── economyControl.ts  # Points/rewards anti-abuse
│   │   └── middleware/        # Auth, feature access
├── frontend/
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Page components
│   │   ├── services/
│   │   │   └── api.ts         # API client
│   │   ├── types/
│   │   │   └── index.ts       # TypeScript interfaces
│   │   └── utils/
│   │       └── sounds.ts      # Audio feedback
```

## Existing Feature Infrastructure

### Notifications
- `backend/src/services/notifications.ts` - Full push notification service
- `backend/src/routes/notifications.ts` - Subscribe/unsubscribe endpoints
- `frontend/src/components/NotificationBell.tsx` - UI with sound support
- `frontend/src/hooks/usePushNotifications.ts` - Push subscription hook

### Task Scheduler
- `backend/src/services/scheduler.ts` - Runs every minute
- Profile-based morning reminders (default 7:30 AM)
- Task-specific scheduled_time reminders
- Evening reminders (6 PM)
- Weekly summaries (Sunday 10 AM)

### Sound Effects
- `frontend/src/utils/sounds.ts` - Web Audio API sounds
- `playSounds.reminder()` - Task reminder sound
- `playSounds.taskComplete()` - Completion celebration
- `playSounds.notification()` - General notification
- All sounds respect user preference (localStorage)

## Database Migration Pattern

Add new columns using the try/catch pattern in `init.ts`:

```typescript
try {
  const columns = db.prepare('PRAGMA table_info(tasks)').all() as any[];
  const hasNewColumn = columns.some((col: any) => col.name === 'new_column');

  if (!hasNewColumn) {
    console.log('🔄 Migrating tasks table: adding new_column...');
    db.prepare('ALTER TABLE tasks ADD COLUMN new_column TEXT DEFAULT NULL').run();
    console.log('✅ Added new_column column to tasks');
  }
} catch (error: any) {
  console.error('Migration error:', error.message);
}
```

## Git Commit Guidelines

- Use conventional commits: `feat:`, `fix:`, `docs:`
- Never force push to main/master
- Always verify changes don't break existing functionality
- Include co-author tag when appropriate

---

**Remember:** When in doubt, ASK the user. It's better to ask a clarifying question than to make assumptions that break their app.
