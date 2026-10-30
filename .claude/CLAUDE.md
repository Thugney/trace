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

## Authentication (since FamilyHub Learn, 2026-10)

- Requests authenticate with `Authorization: Bearer <session token>` from `POST /api/profiles/login`.
  The legacy `x-profile-id` header and `?profile_id=` query are ignored.
- EventSource/H5P iframe requests use a short-lived stream token (`POST /api/profiles/session/stream-token`, `?access_token=`).
- In backend tests use `authHeaders(profileId)` from `src/test/helpers.ts`.
- Object-level access for quizzes/activities/H5P lives in `backend/src/services/resourceAccess.ts`.
- See `docs/familyhub-learn-implementation.md` for Learn, deploy and rollback notes.

## Git Commit Guidelines

- Use conventional commits: `feat:`, `fix:`, `docs:`
- Never force push to main/master
- Always verify changes don't break existing functionality
- Include co-author tag when appropriate

---

## CRITICAL: Common Issues & Solutions (Learned 2026-01-19)

### 1. Route Ordering in Express
**Problem:** Generic routes like `/:id` will match before specific routes like `/media/:filename`.

**Solution:** Always declare specific routes BEFORE generic parameter routes:
```typescript
// CORRECT ORDER:
router.get('/media/:filename', ...);    // Specific route FIRST
router.get('/categories', ...);          // Specific route
router.get('/:id', ...);                 // Generic route LAST
```

### 2. Public Routes for Static Assets (Images, Media)
**Problem:** `<img>` tags don't send authentication headers, so protected routes fail to load images.

**Solution:** Place media/asset routes BEFORE the `router.use(authenticate)` middleware:
```typescript
const router = Router();

// PUBLIC ROUTE - Must be before auth middleware
router.get('/media/:filename', (req, res) => {
  // Serve static files
});

// Auth middleware applies to all routes BELOW this line
router.use(authenticate, requireFeature('feature_name'));

// Protected routes go here
router.get('/data', ...);
```

### 3. Feature Access Middleware
**Problem:** `requireFeature` middleware needs `req.profile` to work, which is set by `authenticate`.

**Solution:** Always use BOTH middlewares together:
```typescript
// WRONG:
router.use(requireFeature('books'));  // req.profile is undefined!

// CORRECT:
router.use(authenticate, requireFeature('books'));
```

### 4. Database Tables Missing on Production
**Problem:** New tables from `init.ts` may not exist on production if database file pre-exists.

**Solution:** Run a fix script via Docker:
```bash
# Create a fix script (e.g., backend/fix-something.js)
# Then run it with cat pipe (avoids terminal line-break issues):
cat backend/fix-something.js | sudo docker-compose exec -T backend node
```

### 5. Profile Settings Storage
Profile-specific settings are stored as JSON in `profiles.settings` column:
```typescript
// Reading settings
const profile = db.prepare('SELECT settings FROM profiles WHERE id = ?').get(id);
const settings = JSON.parse(profile.settings || '{}');

// Writing settings
settings.can_create_shopping_lists = true;
db.prepare('UPDATE profiles SET settings = ? WHERE id = ?').run(JSON.stringify(settings), id);
```

---

## Feature Documentation

### Shopping Permission System
Parents can enable/disable shopping list creation for individual children:

**Backend:** `backend/src/routes/shopping.ts`
- `GET /shopping/permissions/:parentId` - Get child permissions
- `PUT /shopping/permissions/:childId` - Toggle permission
- `GET /shopping/can-create-lists` - Check if current user can create lists

**Frontend:**
- `ShoppingList.tsx` - Settings tab for parents to toggle permissions
- `ShoppingHelper.tsx` - Create List button for permitted kids

**How it works:**
1. Permission stored in `profiles.settings.can_create_shopping_lists`
2. Kids with permission can create lists via ShoppingHelper page
3. Lists created by kids use their parent's ID for association
4. Parents still control trip creation and helper assignment

### Book Reading Tracker
Located in `BookLibrary.tsx` with tabs:
- **Library** - All books (AI-generated and physical)
- **Currently Reading** - Books with active reading progress
- **Books I've Read** - Completed books
- **Kids' Reading History** - Parent view of children's reading (uses Avatar component)

**Avatar Display Rules:**
- Use `Avatar` component for proper image/emoji rendering
- In `<option>` elements, use `getDisplayAvatar()` helper (emoji only, no URLs)

### Learn Lesson Notes (specs/003-learn-lesson-notes)
Sticky notes written beside a Learn lesson are ordinary `notes` rows with `learn_lesson_id`/`learn_topic_id` set, so they also show on `/notes`.

- **Backend:** `services/learn/lessonNotes.ts`; Learn routes `POST /learn/lessons/:id/notes`, `PUT|DELETE /learn/lesson-notes/:id` (owner only), `GET /learn/me/assignment-notes`, `GET /learn/children/:id/notes` (parent/admin, admin audited). The lesson payload carries `notes`.
- **Test lock:** while the owner has a mock exam or review paper open (`getOpenAssessment`), lesson notes and parent assignment notes are withheld everywhere, including `/api/notes`, and changes return 423.
- **Parent notes** come from `learn_assignments.note` (never copied); cancelled assignments drop out.
- `/api/notes` authorizes every route with `canAccessOwnOrManagedChild`.
- **Frontend:** `components/learn/LessonNotesPanel.tsx` (Read tab), lesson chip + "Fra forelder" strip on `Notes.tsx`, "Leksjonsnotater" in `LearnParent.tsx`.

### Book Media Serving
Book cover images and page images stored in `/app/data/book-media/`
- Route: `GET /api/books/media/:filename` (public, no auth required)
- Files named: `book-ai-{timestamp}-{random}.png`

### Ollama Integration (Local AI)
Ollama provides free, local AI text generation for books and quizzes.

**Configuration:**
```bash
# In .env file:
OLLAMA_URL=http://192.168.1.230:11434/api/chat  # Your Ollama server
OLLAMA_MODEL=llama3.2                            # Optional, defaults to llama3.2
```

Or configure via database settings table (`ollama_url`, `ollama_model` keys).

**Provider Priority (Text Generation):**
1. **Ollama** (local, $0) - tried first if configured
2. **Gemini** - cloud fallback
3. **Grok** - cloud fallback
4. **OpenAI** - cloud fallback

**Image Generation:** Always uses Grok or OpenAI (Ollama can't generate images)

**Backend Files:**
- `backend/src/routes/books.ts` - Ollama for book text generation
- `backend/src/routes/family-quizzes.ts` - Ollama for quiz text generation
- `backend/src/routes/settings.ts` - Ollama management endpoints
- `backend/src/services/aiUsageControl.ts` - Cost tracking ($0 for Ollama)

**Management Endpoints:**
- `GET /settings/ollama/status` - Check connectivity, list models
- `POST /settings/ollama/test` - Test a specific model
- `POST /settings/ollama/configure` - Update URL/model settings
- `POST /settings/ollama/pull` - Pull a new model

**Frontend:**
- `Settings.tsx` - Ollama configuration UI (Admin only)
- `api.ts` - `settingsAPI.getOllamaStatus()`, `testOllama()`, `configureOllama()`

**Recommended Models for Children's Books:**
- `gemma3:12b` - Good balance of speed/quality
- `mistral-nemo:latest` - Great for creative writing (12B)
- `llama3.1:latest` - Solid all-rounder (8B)
- `llama3.2:latest` - Fast but smaller (3B)

**Custom Instructions:** Parent's custom instructions are passed to ALL providers including Ollama. Stored in `profiles.settings.book_generation_instructions`.

---

**Remember:** When in doubt, ASK the user. It's better to ask a clarifying question than to make assumptions that break their app.
