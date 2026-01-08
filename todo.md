# Trace Project - Development Tasks

## Environment: ALPHA (Windows Local Dev with Database)

### Kid Engagement Features (Priority: Make App Addictive!)

#### 1. Daily Engagement Hooks
- [x] Daily Login Bonus - +5 points for opening app, consecutive day bonuses (Day 7 = 50pts)
- [x] Streak Protection - One "freeze" per week to protect streak (costs points to use)
- [x] Countdown Challenges - "Complete 3 tasks in 2 hours for 2x points!"

#### 2. Sound & Feedback
- [x] Sound effects - Satisfying sounds on task complete, level-up, achievements, bonus claims
- [ ] Haptic feedback - Phone vibration on achievements
- [x] Animations - Level-up celebration modal with confetti

#### 3. Mystery & Surprise Rewards
- [x] Random bonus multiplier - AI-generated challenges with 1.5x-2x bonus multipliers
- [x] Lucky spin wheel - After completing X tasks, spin for bonus rewards
- [x] Hidden achievements - Secret badges that unlock unexpectedly

#### 4. Power-ups System
- [x] "2x Points" power-up via AI challenges (bonus multipliers)
- [x] "Streak Shield" - Streak freeze protects streak for a day
- [ ] "Time Freeze" extends deadline on a task

#### 5. Collectibles
- [ ] Sticker collection - Earn stickers, complete sets for bonus rewards
- [ ] Rare items - Special stickers for achievements
- [ ] Trading between siblings (future feature)

#### 6. Virtual Pet/Companion (Future)
- [ ] Pet that grows with task completion
- [ ] Gets sad if no login
- [ ] Unlockable accessories with points

### AI-Powered Personalization (NEW!)
- [x] Behavior analysis API - Tracks patterns, strengths, areas to improve
- [x] AI challenge generator - Creates personalized challenges based on behavior
- [x] Parent approval workflow - Parents review/approve AI suggestions
- [x] Custom challenges display - Kids see "Special Challenges For You" section
- [x] Bonus multipliers for avoided categories - Encourages variety
- [x] Focus areas - Parents can set priorities for AI to focus on

### School/Teacher Features
- [x] Teacher dashboard with class management
- [x] Student progress tracking with responsive design
- [x] Assignment creation and management
- [x] Quiz system with multiple choice questions
- [x] Submission review and feedback system
- [x] Student enrollment management

### Existing Features (Still TODO)
- [ ] Assign task to specific child - Multiple kids support
- [ ] Attachments for notes - Add photos, drawings
- [ ] Meal planning feature
- [ ] Nutritional goals by age
- [ ] Recipe builder - Create reusable meals
- [ ] Meal templates - "Save as typical breakfast"

### UI/UX Polish (TODO)
- [ ] Modern design system - Consistent spacing, typography, shadows
- [ ] Premium feel - Subtle gradients, micro-interactions
- [ ] Dark mode support
- [ ] Improved mobile navigation
- [ ] Loading skeletons instead of spinners
- [ ] Toast notifications instead of alerts

### Completed Features
- [x] Notifications (PWA push)
- [x] AI assistant with limits per child
- [x] Due dates & recurring tasks
- [x] Task priorities & time estimates
- [x] Subtasks/checklists
- [x] Note categories, tags, templates, rich text, pinning, reminders
- [x] Water intake tracking
- [x] Goal system with milestones, categories, progress bars
- [x] Streaks (task & water)
- [x] Achievements/badges (12 types)
- [x] Family leaderboard
- [x] Avatar customization (40+ avatars, level-locked)
- [x] Daily challenges
- [x] Level-up celebrations with confetti
- [x] Weekly summaries with charts
- [x] Kid-friendly goal type labels with emojis
- [x] Responsive note creation modal
- [x] AI personalized gamification system
- [x] Teacher dashboard responsive design
- [x] Countdown Challenges with timer and bonus multipliers
- [x] Lucky Spin Wheel (earn spins by completing tasks)
- [x] Hidden/Secret Achievements (10 secret badges)

### Local Testing (Alpha Environment)
- [x] Docker services start correctly
- [x] Backend responds at http://localhost:3001
- [x] Frontend loads at http://localhost:3000
- [x] Database persistence working
- [x] Login flow verified
- [x] AI assistant toggle works

### Deployment Notes
- Local database: ./data/family.db (NOT in git)
- Test locally before pushing
- On Synology: `git pull && docker-compose build && docker-compose up -d`
