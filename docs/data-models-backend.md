# Backend Data Models

## Overview
The backend uses Better-SQLite3 as the database (file: `data/family.db`). The schema is defined in `backend/src/database/init.ts` and extended via migrations in `backend/src/database/migrations/production-ready.ts`. It's a relational schema with foreign keys enabled for integrity. WAL mode is used for concurrency.

Key features:
- **Profiles**: Central user table with roles (admin, parent, child, teacher).
- **Family Hierarchy**: Parents linked to children via `parent_id`.
- **Gamification**: Tasks, progress, rewards, goals with points/stars.
- **Diet Tracking**: Foods, meals, goals with nutritional data.
- **School Features**: Classes, assignments, quizzes, submissions, feedback.
- **AI Integration**: Conversations, settings for parental controls.
- **Notifications & Notes**: Push subscriptions, personal notes.
- **Settings**: Global app settings.

All tables have `created_at` and `updated_at` timestamps. Indexes are added for performance on common queries (e.g., by profile_id).

## Core Tables

### Profiles
**Purpose**: User accounts (family members, teachers, admins). Supports authentication (PIN for kids, password for adults), avatars, and basic info.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique profile ID |
| name | TEXT | NOT NULL | Display name |
| type | TEXT | NOT NULL, CHECK('admin', 'parent', 'child', 'teacher') | User role |
| age | INTEGER | | Age (for children) |
| gender | TEXT | CHECK('male', 'female', 'other') | Gender |
| avatar | TEXT | | File path/URL to avatar image |
| username | TEXT | UNIQUE | Login username (auto-generated from name if not provided) |
| pin | TEXT | | Hashed PIN (for children; plain compare in verify - note: security issue in code) |
| password | TEXT | | Hashed password (for adults) |
| settings | TEXT | DEFAULT '{}' | JSON settings (e.g., preferences) |
| parent_id | INTEGER | FOREIGN KEY to profiles.id | Links child to parent |
| ai_enabled | BOOLEAN | DEFAULT false | AI features enabled |
| diet_enabled | BOOLEAN | DEFAULT false | Diet tracking enabled |
| assigned_class_id | INTEGER | FOREIGN KEY to school_classes.id | For teachers |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update timestamp |

**Relationships**:
- One-to-Many: Parent → Children (via parent_id)
- One-to-Many: Profile → Tasks, Goals, Notes, Progress, etc.

**Notes**: Credentials hashed with bcrypt (SALT_ROUNDS=10). Avatars uploaded via multer to `data/avatars/`.

### Tasks
**Purpose**: Daily/weekly tasks for children, with categories, points, recurrence, and parent approval.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique task ID |
| profile_id | INTEGER | NOT NULL, FOREIGN KEY to profiles.id ON DELETE CASCADE | Assigned child |
| title | TEXT | NOT NULL | Task title |
| description | TEXT | | Details |
| category | TEXT | CHECK('read-book', 'tigrinya', 'clean-room', etc.) | Task type |
| points | INTEGER | DEFAULT 10 | Points awarded |
| difficulty | TEXT | CHECK('easy', 'medium', 'hard') DEFAULT 'easy' | Difficulty level |
| earns_points | BOOLEAN | DEFAULT true | If points are awarded |
| is_recurring | BOOLEAN | DEFAULT false | Recurring task |
| recurrence_pattern | TEXT | | e.g., 'daily', 'weekly' |
| due_date | DATETIME | | Deadline |
| completed | BOOLEAN | DEFAULT false | Completion status |
| completed_at | DATETIME | | Completion timestamp |
| parent_approved | BOOLEAN | DEFAULT false | Parent approval required |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| created_by | INTEGER | FOREIGN KEY to profiles.id | Creator (parent/admin) |

**Relationships**:
- Many-to-One: Task → Profile
- One-to-Many: Task → Subtasks, Photo Proofs, Progress Entries

**Notes**: Supports photo proofs for verification. Subtasks for breakdown.

### Progress
**Purpose**: Track points, stars, levels, achievements from tasks/goals.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique entry ID |
| profile_id | INTEGER | NOT NULL, FOREIGN KEY to profiles.id ON DELETE CASCADE | Child profile |
| task_id | INTEGER | FOREIGN KEY to tasks.id ON DELETE SET NULL | Linked task (if from task) |
| points_earned | INTEGER | DEFAULT 0 | Points from this entry |
| stars_earned | INTEGER | DEFAULT 0 | Stars awarded |
| level | INTEGER | DEFAULT 1 | Current level |
| total_points | INTEGER | DEFAULT 0 | Cumulative points |
| total_stars | INTEGER | DEFAULT 0 | Cumulative stars |
| achievements | TEXT | DEFAULT '[]' | JSON array of earned achievements |
| logged_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Timestamp |

**Relationships**:
- Many-to-One: Progress → Profile, Task

**Notes**: Updates totals on each entry. Achievements as JSON.

### Rewards
**Purpose**: Shop items purchasable with points (virtual/real rewards).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique reward ID |
| profile_id | INTEGER | FOREIGN KEY to profiles.id ON DELETE CASCADE | Creator (parent) or null for global |
| title | TEXT | NOT NULL | Reward name |
| description | TEXT | | Details |
| type | TEXT | CHECK('virtual', 'real') DEFAULT 'real' | Type |
| points_required | INTEGER | NOT NULL | Cost in points |
| icon | TEXT | | Icon name/URL |
| image_url | TEXT | | Image URL |
| category | TEXT | DEFAULT 'general' | Category (e.g., 'toy', 'time') |
| available_for_all | BOOLEAN | DEFAULT true | Global or family-specific |
| stock | INTEGER | DEFAULT -1 | Stock (-1 unlimited) |
| is_claimed | BOOLEAN | DEFAULT false | Claimed status |
| claimed_at | DATETIME | | Claim timestamp |
| created_by | INTEGER | FOREIGN KEY to profiles.id ON DELETE SET NULL | Creator |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

**Relationships**:
- Many-to-One: Reward → Profile (creator)

**Notes**: Claims require parent approval for real rewards.

### Diet Goals
**Purpose**: Nutritional targets for diet tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique goal ID |
| profile_id | INTEGER | NOT NULL, FOREIGN KEY to profiles.id ON DELETE CASCADE | Child profile |
| calories_target | INTEGER | | Daily calories |
| protein_target | INTEGER | | Protein grams |
| carbs_target | INTEGER | | Carbs grams |
| fat_target | INTEGER | | Fat grams |
| weight_goal | REAL | | Target weight |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update |

**Relationships**:
- Many-to-One: Goal → Profile

### Food Items
**Purpose**: Catalog of foods (Norwegian + custom) with nutrition.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique food ID |
| name | TEXT | NOT NULL | English name |
| name_no | TEXT | | Norwegian name |
| brand | TEXT | | Brand |
| calories | INTEGER | NOT NULL | Per serving |
| protein | REAL | DEFAULT 0 | Grams |
| carbs | REAL | DEFAULT 0 | Grams |
| fat | REAL | DEFAULT 0 | Grams |
| fiber | REAL | DEFAULT 0 | Grams |
| serving_size | TEXT | | e.g., '100g' |
| serving_unit | TEXT | DEFAULT 'g' | Unit |
| barcode | TEXT | | Barcode |
| source | TEXT | DEFAULT 'custom' | 'matvaretabellen', 'custom' |
| is_norwegian | BOOLEAN | DEFAULT false | Norwegian food |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |

**Relationships**:
- One-to-Many: Food → Meal Logs

### Meal Logs
**Purpose**: Daily food intake tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique log ID |
| profile_id | INTEGER | NOT NULL, FOREIGN KEY to profiles.id ON DELETE CASCADE | Child |
| food_id | INTEGER | NOT NULL, FOREIGN KEY to food_items.id | Food |
| meal_type | TEXT | CHECK('breakfast', 'lunch', 'dinner', 'snack') | Meal |
| portion_size | REAL | NOT NULL | Amount |
| portion_unit | TEXT | DEFAULT 'g' | Unit |
| calories_consumed | INTEGER | | Calculated |
| protein_consumed | REAL | | Calculated |
| carbs_consumed | REAL | | Calculated |
| fat_consumed | REAL | | Calculated |
| logged_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Timestamp |
| notes | TEXT | | Notes |

**Relationships**:
- Many-to-One: Log → Profile, Food

### Monthly Goals
**Purpose**: Monthly targets (e.g., read 5 books, earn 500 points).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique goal ID |
| profile_id | INTEGER | NOT NULL, FOREIGN KEY to profiles.id ON DELETE CASCADE | Child |
| month | TEXT | NOT NULL | e.g., '2026-01' |
| goal_description | TEXT | NOT NULL | Description |
| goal_points | INTEGER | NOT NULL | Target points |
| goal_type | TEXT | DEFAULT 'kroner' | 'points', 'kroner', etc. |
| achieved | BOOLEAN | DEFAULT false | Achieved? |
| reward_given | BOOLEAN | DEFAULT false | Reward issued |
| notes | TEXT | | Notes |
| parent_approved | BOOLEAN | DEFAULT false | Parent approval |
| created_by | INTEGER | FOREIGN KEY to profiles.id | Creator |
| approved_by | INTEGER | FOREIGN KEY to profiles.id | Approver |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Update |

**Relationships**:
- Many-to-One: Goal → Profile

### AI Conversations
**Purpose**: Chat history with AI assistant.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique message ID |
| profile_id | INTEGER | NOT NULL, FOREIGN KEY to profiles.id ON DELETE CASCADE | Child |
| context | TEXT | CHECK('diet', 'tasks', 'general') | Topic |
| user_message | TEXT | NOT NULL | User input |
| ai_response | TEXT | NOT NULL | AI reply |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Timestamp |

**Relationships**:
- Many-to-One: Message → Profile

### Notes
**Purpose**: Personal notes with colors.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique note ID |
| profile_id | INTEGER | NOT NULL, FOREIGN KEY to profiles.id ON DELETE CASCADE | Owner |
| title | TEXT | NOT NULL | Title |
| content | TEXT | | Body |
| color | TEXT | DEFAULT '#ffffff' | Background color |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Update |

**Relationships**:
- Many-to-One: Note → Profile

### Settings
**Purpose**: Global app settings (key-value).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique ID |
| key | TEXT | UNIQUE NOT NULL | Setting key |
| value | TEXT | | Value |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update |

**Examples**: grok_api_enabled, norwegian_food_api, parent_pin.

### AI Settings
**Purpose**: Per-profile AI controls (parental).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique ID |
| profile_id | INTEGER | FOREIGN KEY to profiles.id ON DELETE CASCADE | Child |
| strict_mode | BOOLEAN | DEFAULT true | Strict content filter |
| max_messages_per_day | INTEGER | DEFAULT 20 | Daily limit |
| allowed_contexts | TEXT | DEFAULT '["general","tasks"]' | JSON allowed topics |
| content_filter_level | TEXT | DEFAULT 'strict' | Filter level |
| custom_instructions | TEXT | DEFAULT '' | Custom prompts |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Update |

**Relationships**:
- Many-to-One: Setting → Profile

## School-Related Tables (Tigrinya Church School Integration)

### School Classes
**Purpose**: Class definitions (age groups, descriptions).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique class ID |
| name | TEXT | NOT NULL | Class name |
| description | TEXT | | Details |
| age_min | INTEGER | | Min age |
| age_max | INTEGER | | Max age |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Update |

### School Enrollments
**Purpose**: Student-class assignments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique enrollment ID |
| student_id | INTEGER | NOT NULL, FOREIGN KEY to profiles.id ON DELETE CASCADE | Child |
| class_id | INTEGER | NOT NULL, FOREIGN KEY to school_classes.id ON DELETE CASCADE | Class |
| enrolled_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Enrollment date |
| UNIQUE(student_id, class_id) | | | One class per student |

### School Assignments
**Purpose**: Homework, psalms, videos, quizzes assigned to classes.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique assignment ID |
| class_id | INTEGER | NOT NULL, FOREIGN KEY to school_classes.id ON DELETE CASCADE | Class |
| teacher_id | INTEGER | NOT NULL, FOREIGN KEY to profiles.id ON DELETE CASCADE | Teacher |
| title | TEXT | NOT NULL | Title |
| description | TEXT | | Details |
| type | TEXT | CHECK('homework', 'psalm', 'alphabet', 'video', 'quiz', 'other') DEFAULT 'homework' | Type |
| youtube_link | TEXT | | Video URL |
| attachment_url | TEXT | | File URL |
| due_date | DATE | | Deadline |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Update |

### School Submissions
**Purpose**: Student work submissions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique submission ID |
| assignment_id | INTEGER | NOT NULL, FOREIGN KEY to school_assignments.id ON DELETE CASCADE | Assignment |
| student_id | INTEGER | NOT NULL, FOREIGN KEY to profiles.id ON DELETE CASCADE | Student |
| notes | TEXT | | Student notes |
| submitted_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Submission time |
| status | TEXT | CHECK('submitted', 'approved', 'needs_revision') DEFAULT 'submitted' | Status |
| UNIQUE(assignment_id, student_id) | | | One submission per student per assignment |

### School Feedback
**Purpose**: Teacher comments on submissions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique feedback ID |
| submission_id | INTEGER | NOT NULL, FOREIGN KEY to school_submissions.id ON DELETE CASCADE | Submission |
| teacher_id | INTEGER | NOT NULL, FOREIGN KEY to profiles.id ON DELETE CASCADE | Teacher |
| comment | TEXT | NOT NULL | Feedback text |
| rating | TEXT | CHECK('excellent', 'very_good', 'good', 'needs_improvement') | Rating |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Timestamp |

### Quiz Questions
**Purpose**: Multiple-choice questions for quizzes.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique question ID |
| assignment_id | INTEGER | NOT NULL, FOREIGN KEY to school_assignments.id ON DELETE CASCADE | Quiz assignment |
| question_text | TEXT | NOT NULL | Question |
| option_a | TEXT | NOT NULL | Option A |
| option_b | TEXT | NOT NULL | Option B |
| option_c | TEXT | | Option C |
| option_d | TEXT | | Option D |
| correct_answer | TEXT | CHECK('a', 'b', 'c', 'd') NOT NULL | Correct option |
| points | INTEGER | DEFAULT 1 | Points |
| order_index | INTEGER | DEFAULT 0 | Display order |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation |

### Student Quiz Answers
**Purpose**: Student responses to questions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique answer ID |
| question_id | INTEGER | NOT NULL, FOREIGN KEY to quiz_questions.id ON DELETE CASCADE | Question |
| student_id | INTEGER | NOT NULL, FOREIGN KEY to profiles.id ON DELETE CASCADE | Student |
| assignment_id | INTEGER | NOT NULL, FOREIGN KEY to school_assignments.id ON DELETE CASCADE | Quiz |
| selected_answer | TEXT | CHECK('a', 'b', 'c', 'd') | Chosen option |
| is_correct | BOOLEAN | DEFAULT false | Correct? |
| submitted_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Timestamp |
| UNIQUE(question_id, student_id) | | | One answer per student per question |

### School Student Progress
**Purpose**: Track student performance per class (attendance, grades).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique progress ID |
| student_id | INTEGER | NOT NULL, FOREIGN KEY to profiles.id ON DELETE CASCADE | Student |
| class_id | INTEGER | NOT NULL, FOREIGN KEY to school_classes.id ON DELETE CASCADE | Class |
| attendance_percentage | REAL | DEFAULT 0 | Attendance % |
| participation_score | REAL | DEFAULT 0 | Participation score |
| overall_grade | TEXT | | Grade (A-F or %) |
| notes | TEXT | | Teacher notes |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Update |
| UNIQUE(student_id, class_id) | | | One record per student-class |

### School Achievements
**Purpose**: Badge definitions for school (quiz scores, attendance streaks).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique achievement ID |
| name | TEXT | NOT NULL UNIQUE | Name |
| description | TEXT | NOT NULL | Description |
| icon | TEXT | NOT NULL | Icon |
| category | TEXT | CHECK('quiz', 'assignment', 'attendance', 'special') DEFAULT 'assignment' | Category |
| points | INTEGER | DEFAULT 10 | Points awarded |
| requirement_type | TEXT | CHECK('quiz_score', 'assignments_completed', etc.) DEFAULT 'special' | Trigger type |
| requirement_value | INTEGER | DEFAULT 1 | Threshold (e.g., 80% score) |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation |

### Student Achievements
**Purpose**: Earned badges per student.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique earned ID |
| student_id | INTEGER | NOT NULL, FOREIGN KEY to profiles.id ON DELETE CASCADE | Student |
| achievement_id | INTEGER | NOT NULL, FOREIGN KEY to school_achievements.id ON DELETE CASCADE | Achievement |
| earned_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Earned date |
| awarded_by | INTEGER | FOREIGN KEY to profiles.id | Teacher who awarded |
| notes | TEXT | | Notes |
| UNIQUE(student_id, achievement_id) | | | No duplicates |

### Student School Points
**Purpose**: School-specific points/levels.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique ID |
| student_id | INTEGER | NOT NULL, FOREIGN KEY to profiles.id ON DELETE CASCADE | Student |
| points | INTEGER | DEFAULT 0 | Total points |
| level | INTEGER | DEFAULT 1 | Level |
| updated_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last update |
| UNIQUE(student_id) | | | One per student |

### Push Subscriptions
**Purpose**: Web push notifications.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique subscription ID |
| profile_id | INTEGER | NOT NULL, FOREIGN KEY to profiles.id ON DELETE CASCADE | User |
| endpoint | TEXT | NOT NULL | Push endpoint |
| p256dh | TEXT | NOT NULL | Public key |
| auth | TEXT | NOT NULL | Auth secret |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation |

## Relationships Summary
- **Family Tree**: Profiles (parent_id self-references for hierarchy).
- **Gamification Flow**: Tasks → Progress → Rewards (points earned buy rewards).
- **Diet Flow**: Food Items → Meal Logs → Diet Goals (track vs targets).
- **School Flow**: Classes ← Enrollments → Students; Assignments → Submissions → Feedback; Questions → Answers.
- **AI**: Profiles → AI Settings → Conversations.
- **Shared**: Most tables link to profiles.id (user ownership).

## Indexes
- By profile_id (common queries).
- By dates (logged_at, created_at).
- By parent_id, class_id for school.

## Notes
- **Security**: Hashes for PIN/password, but verify-pin uses plain compare (bug? Code shows profile.pin === pin, but insert hashes - inconsistency).
- **Migrations**: Production-ready migrations add columns like ai_enabled, diet_enabled.
- **JSON Fields**: settings, achievements (flexible storage).
- **Cascade Deletes**: ON DELETE CASCADE on profile_id to clean related data.

Generated from schema in backend/src/database/init.ts on 2026-01-09.