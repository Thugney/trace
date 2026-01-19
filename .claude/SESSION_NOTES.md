# Claude Session Notes - Family Learning Hub

## Session: 2026-01-19 - Comprehensive Bug Fixes & Feature Additions

**Branch:** `feature/gemini-book-creation`
**Commit:** `ece7583` - "Add AI usage controls, goal templates, quiz wizard, and competition leaderboard"

---

### Critical Bug Fixes

| Issue | Root Cause | Solution | File:Line |
|-------|-----------|----------|-----------|
| Kids losing points on task completion | Race condition - two concurrent requests read same `total_points`, both add on top | Wrapped in `db.transaction()` | `tasks.ts:382-458` |
| Login bonus claimed multiple times | No atomicity check before insert | Transaction + catch UNIQUE constraint | `gamification.ts:219-280` |
| Goal progress race condition | Non-atomic read-modify-write | Atomic updates inside transaction | `goals.ts:305-342` |

---

### New Features Implemented

#### 1. AI Usage Control System
**New File:** `backend/src/services/aiUsageControl.ts`

**Database Tables:**
- `ai_usage_logs` - Tracks every AI generation (profile, feature type, provider, cost, tokens, success)
- `ai_generation_limits` - Per-family limits (daily book/quiz/task limits, monthly cost limit)

**Key Functions:**
- `canGenerateAi(profileId, featureType, estimatedCost)` - Check if allowed
- `logAiUsage(profileId, featureType, provider, options)` - Log usage
- `estimateCost(textProvider, imageProvider, imageCount)` - Calculate cost
- `getUsageStats(parentId)` - Get usage statistics
- `updateAiLimits(parentId, updates)` - Update family limits

**Integrated Into:**
- `books.ts` - `/ai-generate` endpoint checks limits before generation
- `family-quizzes.ts` - `/ai-generate` endpoint checks limits
- `gamification.ts` - Added `/ai-limits` management endpoints for parents

**Default Limits:**
- 5 books/day, 10 quizzes/day, 20 tasks/day
- $10/month cost limit

---

#### 2. Goal Cost Templates
**Database Table:** `goal_templates` (23 pre-defined templates)

**Categories & Examples:**
| Category | Templates |
|----------|-----------|
| Family Outings | Movie Night ($50-80), Restaurant ($80-150), Theme Park ($200-400) |
| Treats & Food | Ice Cream ($10-20), Pizza Night ($30-60) |
| Toys & Games | Video Game ($40-70), LEGO Set ($30-100) |
| Screen Time | Extra Screen Time (0 cost), Movie Marathon (0 cost) |
| Pocket Money | Weekly Allowance ($5-20), Savings Bonus ($10-50) |
| Special Activities | Sleepover ($20-50), Birthday Party ($100-300) |

**API Endpoints:**
- `GET /goals/templates/all` - List all with categories
- `GET /goals/templates/:id` - Get single template
- `POST /goals/templates/:id/estimate` - Calculate cost with family size multiplier
- `POST /goals/templates` - Create custom (parents only)
- `PUT /goals/templates/:id` - Update (non-system only)
- `DELETE /goals/templates/:id` - Delete (non-system only)

**Frontend Types:** `GoalTemplate`, `GoalTemplateEstimate` in `api.ts`

---

#### 3. Custom Reward Categories
**Database Table:** `reward_categories`

**Default Categories:**
1. Education (📚) - Learning materials and books
2. Outdoor (🌳) - Outdoor activities and sports
3. Creative (🎨) - Arts, crafts, and creative activities
4. Entertainment (🎮) - Games, movies, and fun activities
5. Food & Treats (🍕) - Special snacks and meals
6. Experiences (🎢) - Trips, events, and experiences
7. Other (🎁) - Miscellaneous rewards

**API Endpoints:**
- `GET /rewards/categories` - List all categories
- `POST /rewards/categories` - Create new category
- `PUT /rewards/categories/:id` - Update category
- `DELETE /rewards/categories/:id` - Delete (non-system only)

**Frontend:** Added categories tab to `RewardManagement.tsx`

---

#### 4. Quiz Builder Wizard Flow
**File:** `frontend/src/pages/QuizBuilder.tsx`

**Changes:**
- Added `WizardStepper` component showing 3 steps (Category → Details → Questions)
- Added `wizardStep` state (1, 2, or 3)
- Split create flow into distinct steps with Back/Next navigation
- Added settings button (gear icon) in questions view header
- Added settings modal to edit quiz settings after creation

**New State Variables:**
- `wizardStep: 1 | 2 | 3`
- `showSettingsModal: boolean`

**New Functions:**
- `handleUpdateQuizSettings()` - Save quiz settings from modal

---

#### 5. Competition Mode Leaderboard
**File:** `frontend/src/pages/QuizPlayer.tsx`

**New Types:**
```typescript
interface LeaderboardEntry extends QuizAttempt {
  name: string;
  avatar: string;
}
```

**New State:**
- `leaderboard: LeaderboardEntry[]`
- `leaderboardLoading: boolean`

**New Functions:**
- `fetchLeaderboard(quizId)` - Fetch leaderboard data

**Integration:**
- Called automatically in `completeQuiz()` for competition quizzes
- Displays in results view with:
  - Rank medals (🥇🥈🥉) for top 3
  - Player avatars and names
  - Score percentages and completion times
  - Points earned
  - Current user highlighting
  - Refresh button

---

### UI Fixes

| Issue | Fix | File |
|-------|-----|------|
| Book mobile display squeezed | Changed `max-h-[75vh]` to `h-[calc(100vh-180px)]` | `BookReader.tsx` |
| TOC sidebar too wide on mobile | Made responsive: `w-[80vw] max-w-72` | `BookReader.tsx` |
| Book title truncation | Changed to `line-clamp-1` | `BookReader.tsx` |
| Quiz title/points not visible | Added borders for better visibility | `QuizPlayer.tsx` |

---

### Files Modified (13 total)

**Backend:**
- `backend/src/database/init.ts` (+163 lines) - New tables and migrations
- `backend/src/services/aiUsageControl.ts` (NEW) - AI usage tracking service
- `backend/src/routes/tasks.ts` (+254/-) - Race condition fix
- `backend/src/routes/gamification.ts` (+195/-) - Login bonus fix, AI limits endpoints
- `backend/src/routes/goals.ts` (+241/-) - Race condition fix, templates API
- `backend/src/routes/rewards.ts` (+135/-) - Categories API
- `backend/src/routes/books.ts` (+31/-) - AI usage integration
- `backend/src/routes/family-quizzes.ts` (+32/-) - AI usage integration

**Frontend:**
- `frontend/src/services/api.ts` (+76/-) - New types and API methods
- `frontend/src/pages/QuizBuilder.tsx` (+503/-) - Wizard flow
- `frontend/src/pages/QuizPlayer.tsx` (+164/-) - Leaderboard
- `frontend/src/pages/BookReader.tsx` (+28/-) - Mobile fixes
- `frontend/src/components/RewardManagement.tsx` (+267/-) - Categories UI

---

### Build Verification
- ✅ Backend TypeScript: `npm run build` passes
- ✅ Frontend TypeScript: `npm run build` passes
- ✅ Docker: `docker compose build` passes for both images

---

## Existing Feature Documentation

### Book Feedback System ✅ COMPLETE

**Status:** Fully implemented with comment field added

**Database Table:** `book_feedback`
```sql
CREATE TABLE book_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL,
  profile_id INTEGER NOT NULL,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  liked INTEGER DEFAULT 0,
  comment TEXT,  -- Now exposed in UI
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(book_id, profile_id)
)
```

**API Endpoints:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/:bookId/feedback` | POST | Kids submit rating (1-5), liked flag, optional comment |
| `/:bookId/feedback` | GET | Get all feedback + stats (avg rating, total, likes) |
| `/:bookId/my-feedback/:profileId` | GET | Get child's own feedback |
| `/feedback/profile/:profileId` | GET | Parent views all feedback from a child |

**Frontend Components:**
- **Kids:** `BookReader.tsx` - End-of-book feedback form with:
  - 5-star rating selector
  - "I loved it!" heart button
  - Comment textarea (500 char max) ← **Newly added**
  - Submit button
- **Parents:** `BookLibrary.tsx` - Feedback badge on book cards showing avg rating, modal with all reviews

---

### Quiz Timer System ✅ DOCUMENTED

**How Timer Connects to Points:**

1. **Time Bonus Formula** (when quiz is PASSED):
```javascript
remaining_time = time_limit_seconds - time_taken_seconds;
time_bonus_points = Math.round((remaining_time / time_limit_seconds) * bonus_points);
```

2. **Example Calculation:**
   - Quiz: 300 seconds (5 min), 20 bonus points
   - Finish in 100s: `(200/300) * 20 = 13 points`
   - Finish in 200s: `(100/300) * 20 = 6 points`
   - Finish in 300s: `0 points`

3. **Rules:**
   - Time bonus only awarded if quiz is **passed**
   - If no time limit set but quiz passed: full `bonus_points` awarded
   - If quiz failed: no bonus regardless of time

**Key Locations:**
- Backend calculation: `family-quizzes.ts:1752-1758`
- Timer state management: `QuizPlayer.tsx:58-61`
- Timer display: `QuizPlayer.tsx:860-931`
- Timer persistence: `timer_states` table

**Database Fields:**
- `family_quizzes.bonus_points` - Base bonus pool
- `family_quizzes.time_limit_seconds` - Optional time limit
- `family_quiz_attempts.time_bonus_points` - Calculated bonus earned
- `family_quiz_attempts.time_taken_seconds` - Total time spent

---

### AI Prompting System ✅ DOCUMENTED

**Supported Providers:**
| Provider | Text | Images | Priority |
|----------|------|--------|----------|
| Gemini | ✅ | ❌ | Primary for books |
| Grok | ✅ | ✅ | Fallback 1 |
| OpenAI | ✅ | ✅ (DALL-E 3) | Fallback 2 |

**Book Generation Prompt** (`books.ts:410-442`):
```
You are an expert children's book author. Create a complete children's book...
Request: "${prompt}"
Target age range: ${ageRange} years old
Language: ${language}
Genre: ${genre}
Number of pages: ${normalizedPageCount}

Requirements:
- Age-appropriate story with beginning, middle, end
- Educational value or moral lesson
- Simple vocabulary for young, complex for older
- Image prompts for AI image generation
```

**Quiz Generation Prompt** (`family-quizzes.ts:615-657`):
```
You are an expert children's quiz creator...
Category: ${category.display_name}
Parent prompt: "${prompt}"

Requirements:
- Exactly ${normalizedCount} questions
- 4 options per question (a, b, c, d)
- Kid-friendly language
- Optional image prompts for questions
```

**Customization Options:**
| Feature | Books | Quizzes |
|---------|-------|---------|
| Age Range | ✅ (default: 4-8) | Via category |
| Language | ✅ (default: en) | ❌ |
| Genre | ✅ (default: story) | Via category |
| Page/Question Count | ✅ (3-20) | ✅ (1-20) |
| Include Images | ✅ (default: true) | ✅ (default: true) |
| Text Provider | Auto (Gemini first) | ✅ Selectable |
| Image Provider | Auto | ✅ Selectable |

**Parental AI Controls** (`ai.ts:1540-1587`):
- `strict_mode` - Enhanced safety guidelines
- `max_messages_per_day` - Message limit
- `content_filter_level` - 'strict' | 'moderate' | 'relaxed'
- `custom_instructions` - Custom behavior appended to system prompt

**Error Handling:**
- 5 max retry attempts
- Exponential backoff: 10s, 20s, 30s, 45s, 60s + jitter
- Automatic provider switching on rate limits (429, 502, 503, 504)

---

### Shopping Gamification ✅ IMPLEMENTED

**Current Status:** Full shopping gamification system with lists, trips, and points!

**Database Tables:**
| Table | Purpose |
|-------|---------|
| `shopping_lists` | Parent-created lists with point settings |
| `shopping_items` | Items on lists with categories and bonus points |
| `shopping_trips` | Trip instances (planned → in_progress → completed) |
| `shopping_helpers` | Kids assigned to trips, tracks points earned |
| `shopping_item_completions` | Which items found by whom |
| `shopping_categories` | 11 default categories (produce, dairy, etc.) |

**Point System:**
- Base points per item found (default: 5 pts)
- Completion bonus when all items found (default: 20 pts)
- Good behavior bonus for rating ≥4 (default: 15 pts)
- Points awarded to `progress` table on trip completion

**Workflow:**
1. Parent creates shopping list with items
2. Parent creates a trip and assigns kid helpers
3. Parent starts the trip (status: in_progress)
4. Kids mark items as found in real-time
5. Parent completes trip with behavior rating
6. Points automatically awarded to all helpers

**API Endpoints:**
| Endpoint | Purpose |
|----------|---------|
| `GET /shopping/categories` | List item categories |
| `GET /shopping/lists/:parentId` | Get all lists |
| `POST /shopping/lists` | Create a list |
| `POST /shopping/lists/:id/items` | Add item to list |
| `GET /shopping/trips/active/:parentId` | Active trips |
| `GET /shopping/trips/helper/:profileId` | Kid's trips |
| `POST /shopping/trips` | Create a trip |
| `POST /shopping/trips/:id/start` | Start shopping |
| `POST /shopping/trips/:id/items/:itemId/found` | Mark item found |
| `POST /shopping/trips/:id/complete` | Complete & award points |
| `GET /shopping/stats/:profileId` | Kid's shopping stats |
| `GET /shopping/leaderboard/:parentId` | Family leaderboard |

**Frontend Components:**
- `ShoppingList.tsx` - Parent management (lists, items, trips, leaderboard)
- `ShoppingHelper.tsx` - Kid-friendly interface to help with shopping

**Navigation:**
- Parents: `/shopping` route in sidebar
- Kids: `/shopping/help` route with fun kid nav item

---

*Last Updated: 2026-01-19 (Session 3)*
