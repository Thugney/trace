# Family Learning Hub - Feature Documentation

This document describes all implemented features, how they work, and their purpose.

---

## Table of Contents

1. [Shopping Gamification](#-shopping-gamification)
2. [Task Management](#-task-management)
3. [Family Quizzes](#-family-quizzes)
4. [AI Book Creator](#-ai-book-creator)
5. [Family Goals](#-family-goals)
6. [Rewards Shop](#-rewards-shop)
7. [AI Chat Assistant](#-ai-chat-assistant)
8. [Daily Gamification](#-daily-gamification)
9. [Points Control (Parent)](#-points-control-parent)
10. [AI Usage Controls](#-ai-usage-controls)
11. [Push Notifications](#-push-notifications)
12. [Economy Controls](#-economy-controls)
13. [Church School System](#church-school-system)
14. [Regular School Tracking](#regular-school-tracking)

---

## 🛒 Shopping Gamification

**Purpose:** Turn grocery shopping into a fun, rewarding activity for kids.

**The Problem:** Kids often get bored or misbehave during shopping trips.

**The Solution:** Parents create shopping lists, then start "shopping trips" where kids are assigned as helpers. Kids earn points by finding items on the list, behaving well, and helping complete the trip.

### How It Works

1. **Parent creates a list** (e.g., "Weekly Groceries")
   - Add items with categories (produce, dairy, meat, etc.)
   - Set point values per item (default: 5 pts)

2. **Parent starts a trip**
   - Select which list to use
   - Assign which kids are helping
   - Trip status: `planned` → `in_progress` → `completed`

3. **During shopping**
   - Kids use their phone/tablet to see the list
   - Mark items as "found" when they locate them
   - Real-time progress tracking

4. **After shopping**
   - Parent rates behavior (1-5 stars)
   - Parent completes the trip
   - Points automatically awarded to all helpers

### Point System

| Action | Points |
|--------|--------|
| Item found | 5 pts (configurable per item) |
| All items found bonus | 20 pts |
| Good behavior (4+ stars) | 15 pts |

**Example Trip:**
- Find 10 items × 5 pts = 50 pts
- All items found bonus = 20 pts
- Good behavior (4 stars) = 15 pts
- **Total: 85 points earned!**

### Categories (11 Default)

| Category | Icon | Color |
|----------|------|-------|
| Fruits & Vegetables | 🥬 | Green |
| Dairy & Eggs | 🥛 | Blue |
| Meat & Seafood | 🥩 | Red |
| Bakery & Bread | 🍞 | Amber |
| Frozen Foods | 🧊 | Cyan |
| Snacks & Candy | 🍿 | Purple |
| Drinks & Beverages | 🥤 | Pink |
| Pantry & Canned | 🥫 | Orange |
| Household Items | 🧹 | Gray |
| Personal Care | 🧴 | Teal |
| Other | 📦 | Gray |

### Navigation

- **Parents:** `/shopping` in sidebar
- **Kids:** `/shopping/help` with 🛒 icon in kid nav

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/shopping/categories` | GET | List item categories |
| `/shopping/lists/:parentId` | GET | Get all lists |
| `/shopping/lists` | POST | Create a list |
| `/shopping/lists/:id/items` | POST | Add item to list |
| `/shopping/trips/active/:parentId` | GET | Active trips |
| `/shopping/trips/helper/:profileId` | GET | Kid's trips |
| `/shopping/trips` | POST | Create a trip |
| `/shopping/trips/:id/start` | POST | Start shopping |
| `/shopping/trips/:id/items/:itemId/found` | POST | Mark item found |
| `/shopping/trips/:id/complete` | POST | Complete & award points |
| `/shopping/stats/:profileId` | GET | Kid's shopping stats |
| `/shopping/leaderboard/:parentId` | GET | Family leaderboard |

### Database Tables

- `shopping_lists` - Parent-created lists with point settings
- `shopping_items` - Items on lists with categories
- `shopping_trips` - Trip instances with status
- `shopping_helpers` - Kids assigned to trips
- `shopping_item_completions` - Which items found by whom
- `shopping_categories` - Category definitions

---

## ✅ Task Management

**Purpose:** Assign chores/responsibilities to kids and reward completion with points.

**The Problem:** Getting kids to do chores without constant nagging.

**The Solution:** Parents create tasks with point values. Kids complete tasks, optionally submit photo proof, and earn points.

### Features

- **Recurring tasks** - Daily, weekly, monthly
- **Photo proof** - Require photo evidence of completion
- **Subtasks** - Break complex chores into steps
- **Scheduled reminders** - Push notifications at specific times
- **Timer-based tasks** - Some tasks require minimum time spent
- **Difficulty levels** - Easy (10 pts), Medium (20 pts), Hard (30 pts)

### Mandatory Due Dates (NEW)

- All tasks **must** have a due date
- Tasks **cannot be completed** after due date passes
- Returns `TASK_OVERDUE` error code
- Teaches time management and responsibility

### Anti-Abuse Checks

1. Already completed today check
2. Timer required but not used check
3. **Task overdue check (NEW)**
4. Already completed check
5. Rate limiting (cooldown between completions)
6. Time elapsed for timed tasks
7. Proof required but not provided
8. Daily/weekly point caps

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/tasks/:profileId` | GET | Get tasks for a profile |
| `/tasks` | POST | Create a task |
| `/tasks/:id` | PUT | Update a task |
| `/tasks/:id` | DELETE | Delete a task |
| `/tasks/:id/complete` | POST | Complete a task |
| `/tasks/:id/proof` | POST | Upload photo proof |

---

## 🧠 Family Quizzes

**Purpose:** Make learning fun through customizable quizzes with rewards.

**The Problem:** Kids need engaging ways to learn and practice knowledge.

**The Solution:** Parents create quizzes (manually or AI-generated) on any topic. Kids earn points for correct answers and time bonuses for speed.

### Quiz Modes

| Mode | Description |
|------|-------------|
| **Practice** | Learn at your own pace, retry questions |
| **Timed** | Race against the clock for bonus points |
| **Competition** | Family members compete on same quiz (leaderboard!) |

### Point System

- Base points per correct answer
- Time bonus for faster completion
- Competition rankings with medals 🥇🥈🥉

### Timer System

**Time Bonus Formula** (when quiz is PASSED):
```
remaining_time = time_limit_seconds - time_taken_seconds
time_bonus_points = (remaining_time / time_limit_seconds) × bonus_points
```

**Example:**
- Quiz: 300 seconds (5 min), 20 bonus points
- Finish in 100s: `(200/300) × 20 = 13 points`
- Finish in 200s: `(100/300) × 20 = 6 points`
- Finish in 300s: `0 points`

### Timer Features

- Start/pause/resume functionality
- Persists if user leaves and returns
- Visual countdown display
- Auto-submit when time runs out

### AI Quiz Generation

Parents can generate quizzes using AI:
- Select category and difficulty
- Describe the topic/prompt
- AI generates questions with 4 options each
- Optional AI-generated images for questions

### Quiz Builder Wizard

3-step creation flow:
1. **Category** - Select quiz category
2. **Details** - Title, description, settings
3. **Questions** - Add/edit questions

### Competition Leaderboard

- Automatically shown after completing competition quizzes
- Medal display for top 3 (🥇🥈🥉)
- Shows score %, completion time, points earned
- Current user highlighted
- Refresh button for live updates

### Navigation

- **Kids:** "Brain Games" 🦁 (or "Quizzes" for older kids)
- **Parents:** "Quizzes" in sidebar → Quiz Builder

---

## 📖 AI Book Creator

**Purpose:** Generate personalized children's books using AI.

**The Problem:** Finding age-appropriate, engaging books on specific topics is hard.

**The Solution:** Parents describe what they want and AI generates a complete illustrated children's book.

### Features

- Age-appropriate content (adjusts vocabulary/complexity)
- Multiple languages supported
- AI-generated illustrations
- Kids can rate and review books they read
- Page-by-page reading experience

### Generation Options

| Option | Description | Default |
|--------|-------------|---------|
| Age Range | Target audience age | 4-8 years |
| Language | Book language | English |
| Genre | Story type | Story |
| Page Count | Number of pages | 3-20 |
| Include Images | AI illustrations | Yes |

### Book Feedback System

Kids can provide feedback after reading:
- 5-star rating
- "I loved it!" heart button
- Written comment (500 char max)

Parents can view:
- Average ratings on book cards
- All reviews in detail modal

### AI Providers (Priority Order)

1. **Gemini** - Primary for text
2. **Grok** - Fallback 1 (text + images)
3. **OpenAI** - Fallback 2 (text + DALL-E 3 images)

---

## 🎯 Family Goals

**Purpose:** Work together as a family toward shared rewards.

**The Problem:** Kids don't understand saving toward bigger rewards.

**The Solution:** Set family goals that everyone contributes points to. When reached, family enjoys the reward together.

### Goal Templates (23 Pre-defined)

| Category | Examples |
|----------|----------|
| Family Outings | Movie Night ($50-80), Restaurant ($80-150), Theme Park ($200-400) |
| Treats & Food | Ice Cream ($10-20), Pizza Night ($30-60) |
| Toys & Games | Video Game ($40-70), LEGO Set ($30-100) |
| Screen Time | Extra Screen Time (0 cost), Movie Marathon (0 cost) |
| Pocket Money | Weekly Allowance ($5-20), Savings Bonus ($10-50) |
| Special Activities | Sleepover ($20-50), Birthday Party ($100-300) |

### Features

- Cost estimation with family size multiplier
- Progress tracking
- Custom goal creation
- Goal completion celebrations

---

## 🎁 Rewards Shop

**Purpose:** Let kids spend their earned points on rewards.

**The Problem:** Points need to be meaningful and redeemable.

**The Solution:** Parents create a "shop" of rewards with point costs. Kids browse and redeem.

### Default Categories

| Category | Icon | Description |
|----------|------|-------------|
| Education | 📚 | Books, learning materials |
| Outdoor | 🌳 | Sports, outdoor activities |
| Creative | 🎨 | Arts & crafts |
| Entertainment | 🎮 | Games, movies |
| Food & Treats | 🍕 | Special snacks |
| Experiences | 🎢 | Trips, events |
| Other | 🎁 | Miscellaneous |

### Features

- Custom categories (parents can add more)
- Reward claiming system
- Point cost configuration
- Availability controls

---

## 🤖 AI Chat Assistant

**Purpose:** Safe, educational AI chat companion for kids.

### Parental Controls

| Setting | Description |
|---------|-------------|
| `strict_mode` | Enhanced safety guidelines |
| `max_messages_per_day` | Daily message limit |
| `content_filter_level` | 'strict' / 'moderate' / 'relaxed' |
| `custom_instructions` | Custom behavior rules |

### Features

- Age-appropriate responses
- Multi-provider support (Gemini, Grok, OpenAI)
- Conversation history
- Parent oversight

---

## 🎰 Daily Gamification

**Purpose:** Keep kids coming back daily with bonuses and mini-games.

### Login Bonus

- Points for daily app opens
- Streak multiplier (consecutive days)
- Week completion bonus

### Spin Wheel

- Unlocks after completing tasks
- Random prize amounts
- Visual spinning animation
- Configurable by parents

### Achievements

- Milestone badges
- Task completion achievements
- Streak achievements
- Collection display

### Countdown Challenges

- Time-limited task challenges
- Bonus multipliers (1.5x - 2.5x)
- Example: "Complete 3 tasks in 2 hours for 2x points!"

### Streaks

- Task completion streaks
- Water intake streaks
- Streak freeze option (costs points)

---

## 💰 Points Control (Parent)

**Purpose:** Allow parents to add or deduct points for behavior management.

**The Problem:** Kids might misbehave after earning/redeeming rewards.

**The Solution:** Parents can adjust points with a required reason for audit trail.

### Deduct Points (Negative Amount)

Use cases:
- Bad behavior after redeeming reward
- Breaking rules
- Not following through on commitments

**Safeguard:** Cannot deduct more points than child has.

### Add Bonus Points (Positive Amount)

Use cases:
- Exceptional behavior outside the app
- Special achievements
- Surprise rewards

### Audit Trail

Every adjustment is logged with:
- Who made the adjustment
- Amount (+ or -)
- Reason
- Timestamp

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/gamification/points/adjust/:profileId` | POST | Add or deduct points |
| `/gamification/points/history/:profileId` | GET | View adjustment history |

### Request Example

```json
POST /gamification/points/adjust/5
{
  "amount": -50,
  "reason": "Bad behavior after movie night reward"
}
```

### Response Example

```json
{
  "success": true,
  "adjustment": -50,
  "reason": "Bad behavior after movie night reward",
  "previous_points": 150,
  "new_points": 100,
  "new_level": 2,
  "adjusted_by": "Dad"
}
```

---

## 📊 AI Usage Controls

**Purpose:** Control and monitor AI feature usage and costs.

**The Problem:** AI features cost money and parents need oversight.

**The Solution:** Set daily/monthly limits on AI generations and track usage.

### Configurable Limits

| Limit | Default |
|-------|---------|
| Books per day | 5 |
| Quizzes per day | 10 |
| Tasks per day | 20 |
| Monthly cost limit | $10 |

### Tracking

- Every AI generation logged
- Provider used
- Estimated cost
- Success/failure status
- Token usage

### Cost Estimation

Displayed before generation so parents know approximate cost.

---

## 🔔 Push Notifications

**Purpose:** Remind kids about tasks and keep them engaged.

### Notification Types

| Type | When | Description |
|------|------|-------------|
| Morning Reminders | Configurable (default 7:30 AM) | Daily task overview |
| Task-Specific | At scheduled_time | Individual task reminders |
| Evening Reminders | 6:00 PM | Incomplete task nudge |
| Weekly Summaries | Sunday 10:00 AM | Week in review |

### Features

- Per-child reminder time preferences
- Sound effects (configurable)
- Badge counts
- Click-to-navigate

---

## ⚖️ Economy Controls

**Purpose:** Prevent point inflation and abuse.

### Settings (Per Child)

| Setting | Description | Default |
|---------|-------------|---------|
| `daily_points_cap` | Max points per day | 200 |
| `weekly_points_cap` | Max points per week | 1000 |
| `points_multiplier` | Earning multiplier | 1.0 |
| `cooldown_seconds` | Between task completions | 30 |
| `min_task_duration_minutes` | For timed tasks | 5 |
| `bonuses_enabled` | Mystery rewards on/off | true |
| `spin_wheel_enabled` | Spin wheel on/off | true |

### Anti-Abuse Features

- Rate limiting between point-earning actions
- Daily/weekly earning caps
- Time-based task verification
- Photo proof requirements
- Duplicate completion prevention

---

## Church School System

**Purpose:** Digital classroom management for church weekend education (Saturday/Sunday school).

**The Problem:** Managing church school classes, assignments, and tracking student progress manually is time-consuming and difficult to coordinate between teachers, parents, and students.

**The Solution:** A complete digital classroom system where teachers create classes and assignments, students submit their work, and parents can monitor their children's progress.

### User Roles

| Role | Capabilities |
|------|-------------|
| **Teacher** | Create classes, publish assignments, review submissions, give feedback |
| **Parent** | Enroll children in classes, view assignments, submit work on behalf of children, track progress |
| **Child** | View assignments, submit work, see teacher feedback |
| **Admin** | View all classes, teachers, and students |

### Assignment Types

| Type | Description |
|------|-------------|
| Homework | General assignments |
| Psalm | Scripture memorization |
| Alphabet | For younger children learning letters |
| Video | Watch and respond to videos |
| Quiz | Knowledge assessments |
| Other | Custom assignments |

### Features

- **Class Management**
  - Teachers create classes with age ranges
  - Students enroll in multiple classes
  - Teacher-class assignments for multi-teacher scenarios

- **Assignment Publishing**
  - Title, description, type, due date
  - Optional YouTube video links
  - File attachments

- **Submission System**
  - Students submit work with notes
  - Teachers review and provide feedback
  - Status tracking: Not submitted → Submitted → Approved/Needs Revision

- **Real-time Updates**
  - Auto-refresh every 15 seconds for teachers (new submissions)
  - Auto-refresh every 15 seconds for students (new assignments, feedback)
  - Push notifications when students submit work

- **Progress Tracking**
  - Visual progress bars showing completion status
  - Color-coded status (Approved = green, Pending = blue, Needs Revision = amber)
  - Per-class breakdown of assignments

### Notifications

| Event | Who Gets Notified |
|-------|-------------------|
| Student submits work | All teachers assigned to the class |
| Teacher gives feedback | Student and parent |
| New assignment published | Enrolled students |
| Assignment due soon | Students with pending work |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/school/classes` | GET | List classes (filtered by role) |
| `/school/classes` | POST | Create a new class |
| `/school/classes/:id/students` | GET | Get students in a class |
| `/school/enroll` | POST | Enroll a student in a class |
| `/school/assignments` | GET | Get assignments |
| `/school/assignments` | POST | Create an assignment |
| `/school/assignments/:id/attachment` | POST | Upload attachment |
| `/school/submissions` | GET | Get submissions |
| `/school/submissions` | POST | Submit work |
| `/school/feedback` | GET | Get feedback |
| `/school/feedback` | POST | Give feedback |

### Database Tables

- `school_classes` - Class definitions with age ranges
- `school_enrollments` - Student-class relationships
- `school_assignments` - Published assignments
- `school_submissions` - Student submissions
- `school_feedback` - Teacher feedback on submissions
- `teacher_class_assignments` - Teacher-class relationships

### UI Design (Redesigned)

**Teacher View:**
- Class selector as horizontal pills at the top
- Inline "New Class" form (expands on click)
- Stats row showing: Students, Assignments, Submissions, Need Review
- Tab navigation: Assignments | Students | Submissions
- Compact create assignment form with grid layout
- File upload support (PDF, DOC, images)
- Students tab: 2-column grid with progress cards
  - Color-coded: green (complete), amber (needs revision)
  - Progress bars with approved/pending/revision breakdown
  - Expandable to see each assignment status

**Parent View:**
- Child selector (if multiple children)
- Progress summary with color-coded bar
- **Class Enrollment section:**
  - Shows currently enrolled classes (green checkmark badges)
  - Hover to reveal "x" button for unenrolling (useful when kids move grades)
  - Confirmation dialog before unenrolling
  - Shows available classes to enroll (+ buttons)
  - Prevents accidental duplicate enrollment
- Assignments grouped by class
- Status badges: Approved, Pending, Revise, Todo
- **Context-aware teacher feedback display:**
  - Green (checkmark icon): "Approved by Teacher"
  - Amber (warning icon): "Revision Requested"
  - Blue (info icon): General feedback
  - Shows rating if provided
- Submit/Resubmit buttons for each assignment

**Child View:**
- Same as parent but simplified
- "My Schoolwork" header
- Can submit assignments directly

**Admin View:**
- Statistics cards: Classes, Teachers, Students
- List of all classes with age ranges
- Grid of all teachers

---

## Regular School Tracking

**Purpose:** Track regular school homework at home, gamifying completion to motivate kids.

**The Problem:** Parents receive weekly/monthly plans from their kids' regular schools and want to track homework completion at home. Kids often lack motivation to complete homework without incentives.

**The Solution:** A simple homework tracker where parents manually add subjects and homework items. Kids earn points when they complete homework, motivating them to stay on top of their schoolwork.

### How It Works

1. **Parent creates subjects** (Math, Reading, Science, etc.)
   - Each subject has a name and icon
   - Subjects are per-child (multiple children can have different subjects)

2. **Parent adds homework**
   - Select subject
   - Enter title and optional description
   - Set due date (optional)
   - Set point value (default: 10 pts)

3. **Kid completes homework**
   - Views homework list with due dates
   - Clicks "Done" when complete
   - Points automatically awarded

### Features

| Feature | Description |
|---------|-------------|
| **School Mode Toggle** | Switch between Church School and Regular School in the same UI |
| **Subject Management** | Create, delete subjects (Math, Reading, Science, Art, etc.) |
| **Homework Tracking** | Add homework with due dates and point values |
| **Visual Due Dates** | Red = overdue, Amber = due today, Normal = upcoming |
| **Points Gamification** | Kids earn points for completing homework |
| **Progress Stats** | Dashboard shows completed, pending, overdue counts |

### Point System

| Action | Points |
|--------|--------|
| Complete homework | 5-100 pts (configurable per item) |
| Default homework | 10 pts |

### UI Design

**School Mode Toggle:**
- Pills at top: "⛪ Church School" | "🏫 Regular School"
- Switches between the two tracking systems

**Parent View:**
- Subject pills with pending counts
- Add subject form (name + icon selector)
- Homework list with "Done" buttons
- Delete options for subjects and homework

**Child View:**
- Homework list organized by subject
- "Done" button to mark complete
- Visual feedback for completed items (strikethrough, green)

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/regular-school/subjects` | GET | Get subjects for a student |
| `/regular-school/subjects` | POST | Create a subject |
| `/regular-school/subjects/:id` | PUT | Update a subject |
| `/regular-school/subjects/:id` | DELETE | Delete a subject |
| `/regular-school/homework` | GET | Get homework for a student |
| `/regular-school/homework` | POST | Create homework |
| `/regular-school/homework/:id` | PUT | Update homework |
| `/regular-school/homework/:id` | DELETE | Delete homework |
| `/regular-school/homework/:id/complete` | POST | Mark homework complete |
| `/regular-school/stats` | GET | Get homework statistics |

---

## Technical Notes

### Database

- SQLite with better-sqlite3
- Automatic migrations on startup
- Transaction support for race conditions

### Authentication

- Profile-based (x-profile-id header)
- Role-based access (admin, parent, child, teacher)
- Parent-child relationship verification

### Error Codes

| Code | Meaning |
|------|---------|
| `TASK_OVERDUE` | Task past due date |
| `ALREADY_COMPLETED` | Task already done |
| `TIMER_REQUIRED` | Must use timer |
| `PROOF_REQUIRED` | Photo required |
| `RATE_LIMITED` | Too fast |
| `EARNING_CAP_REACHED` | Daily/weekly limit |

---

*Last Updated: 2026-01-19 (School UI redesign documented)*
