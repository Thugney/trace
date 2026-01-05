# Trace Project - Development Tasks

## Environment: ALPHA (Windows Local Dev with Database)

### Kid Engagement Features (Priority: Make App Addictive!)

#### 1. Daily Engagement Hooks
- [ ] Daily Login Bonus - +5 points for opening app, consecutive day bonuses (Day 7 = 50pts)
- [ ] Streak Protection - One "freeze" per week to protect streak (costs points to use)
- [ ] Countdown Challenges - "Complete 3 tasks in 2 hours for 2x points!"

#### 2. Sound & Feedback
- [ ] Sound effects - Satisfying "ding!" on task complete, celebration on level-up
- [ ] Haptic feedback - Phone vibration on achievements
- [ ] Animations - Confetti, sparkles, bouncing icons

#### 3. Mystery & Surprise Rewards
- [ ] Random bonus multiplier - 1.5x or 2x points on random task completions
- [ ] Lucky spin wheel - After completing X tasks, spin for bonus rewards
- [ ] Hidden achievements - Secret badges that unlock unexpectedly

#### 4. Power-ups System
- [ ] "2x Points" power-up for next task (earned or bought with points)
- [ ] "Streak Shield" protects streak for a day
- [ ] "Time Freeze" extends deadline on a task

#### 5. Collectibles
- [ ] Sticker collection - Earn stickers, complete sets for bonus rewards
- [ ] Rare items - Special stickers for achievements
- [ ] Trading between siblings (future feature)

#### 6. Virtual Pet/Companion (Future)
- [ ] Pet that grows with task completion
- [ ] Gets sad if no login
- [ ] Unlockable accessories with points

### Existing Features (Still TODO)
- [ ] Assign task to specific child - Multiple kids support
- [ ] Attachments for notes - Add photos, drawings
- [ ] Meal planning feature
- [ ] Nutritional goals by age
- [ ] Recipe builder - Create reusable meals
- [ ] Meal templates - "Save as typical breakfast"

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
