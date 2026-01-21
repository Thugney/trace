# Gamification & Rewards System

This document describes how the gamification and rewards system works in the Family Learning Hub application.

## Overview

The gamification system motivates children to complete tasks through a comprehensive reward structure that includes:
- **Points** - The primary currency earned from completing tasks
- **Stars** - Bonus rewards based on task difficulty
- **Levels** - Progression milestones (every 100 points = 1 level)
- **Achievements** - Unlockable badges for reaching milestones
- **Streaks** - Consecutive day bonuses for consistent activity
- **Spin Wheel** - Chance-based rewards for completing tasks
- **Daily Challenges** - Extra tasks with bonus points
- **Countdown Challenges** - Time-limited bonus multiplier events

## Parent Economy Controls

Parents have **full control** over the gamification system through Economy Settings. All rewards and features can be configured per-child.

### Available Settings

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| `daily_points_cap` | 200 | 10+ | Maximum points earnable per day |
| `weekly_points_cap` | 1000 | 50+ | Maximum points earnable per week |
| `points_multiplier` | 1.0 | 0.1-2.0 | Base multiplier for all points |
| `require_time_elapsed` | true | bool | Require task time to pass before completion |
| `min_task_duration_minutes` | 5 | 1+ | Minimum time before a task can be completed |
| `cooldown_seconds` | 10 | 5+ | Seconds between reward actions (anti-spam) |
| `bonuses_enabled` | true | bool | Enable/disable mystery rewards |
| `spin_wheel_enabled` | true | bool | Enable/disable spin wheel feature |
| `countdown_challenges_enabled` | true | bool | Enable/disable countdown challenges |

### API Endpoint
```
GET/PUT /api/gamification/economy/:profileId
```

---

## Points System

### Earning Points

Points are earned through:

1. **Task Completion** - Base points defined per task (10-50 typical)
2. **Mystery Rewards** - 15% chance of bonus on task completion
3. **Daily Login Bonus** - 5-50 points based on consecutive days
4. **Daily Challenges** - 5-15 points per challenge
5. **Countdown Challenge Bonus** - Multiplier applied to accumulated points
6. **Spin Wheel Prizes** - 10-100+ points
7. **Achievement Unlocks** - 25-200 points

### Points Calculation Flow

```
Task Completion:
1. rawPoints = task.points (from task definition)
2. basePoints = rawPoints × economy_multiplier × power_up_multiplier
3. cappedPoints = min(basePoints, daily_remaining, weekly_remaining)
4. final = cappedPoints + mystery_bonus (also capped)
```

### Power-Up Multipliers

When a user wins a "2x Multiplier" from the spin wheel:
- Stored in `power_ups` table with 24-hour expiry
- Automatically applied during `applyPointsMultiplier()`
- Stacks multiplicatively with economy settings

---

## Stars System

Stars are awarded based on task difficulty:

| Difficulty | Stars |
|------------|-------|
| Easy | 1 |
| Medium | 2 |
| Hard | 3 |

Stars are **not** subject to daily/weekly caps.

---

## Streaks

### Types
- **Task Streak** - Consecutive days with task completion
- **Water Streak** - Consecutive days logging water intake

### Mechanics
- Streak increments when activity detected on a new day
- Streak breaks to 1 if a day is skipped
- `longest_streak` tracked separately from `current_streak`

### Streak Freeze
- Costs 50 points
- Protects streak for one day
- Limited to once per week
- If no streak exists, creates one with value 1

---

## Achievements

### Standard Achievements
Checked after task/water completion:

| Type | Examples |
|------|----------|
| `tasks_completed` | Complete 10, 50, 100 tasks |
| `total_points` | Earn 100, 500, 1000 points |
| `total_stars` | Earn 25, 100, 500 stars |
| `goals_achieved` | Achieve 5, 10 goals |
| `streak_days` | Maintain 3, 7, 14 day streak |
| `water_streak` | Maintain 3, 7 day water streak |

### Hidden Achievements
Only revealed when earned:

| Achievement | Requirement |
|------------|-------------|
| Early Bird Master | Complete 5 tasks before 8 AM |
| Weekend Warrior | Complete 10 tasks on weekends |
| Speed Demon | Complete 3 tasks in 30 minutes |
| Lucky Spinner | Win the jackpot |
| Countdown Champion | Complete 5 countdown challenges |

### Award Logic
- Uses database transaction to prevent race conditions
- UNIQUE constraint prevents duplicate awards
- Points awarded atomically with achievement

---

## Daily Challenges

### Types
1. **Complete Tasks** - Complete N tasks today (1-5)
2. **Drink Water** - Log N ml of water (500-1500)
3. **All Categories** - Complete tasks in N categories (2-3)
4. **Early Bird** - Complete a task before 10 AM
5. **Streak Keeper** - Maintain your task streak

### Generation
- 3 random challenges generated per day per profile
- Challenges from 7+ days ago automatically cleaned up
- Progress calculated in real-time

---

## Countdown Challenges

### How It Works
1. Parent/child starts a countdown challenge
2. Timer begins (e.g., 60-120 minutes)
3. Complete target number of tasks before expiry
4. Bonus multiplier (1.5x-2.5x) applied to ALL accumulated points

### Example
```
Challenge: Complete 5 tasks in 2 hours (2.0x multiplier)

Task 1: +20 pts → accumulated: 20
Task 2: +15 pts → accumulated: 35
Task 3: +25 pts → accumulated: 60
Task 4: +20 pts → accumulated: 80
Task 5: +20 pts → accumulated: 100

Challenge Complete!
Bonus: 100 × (2.0 - 1) = 100 bonus points
Total earned: 100 + 100 = 200 points
```

---

## Spin Wheel

### Earning Spins
- Complete 5 tasks = 1 spin opportunity
- Progress tracked in `spin_wheel_progress`

### Prizes

| Prize | Weight | Description |
|-------|--------|-------------|
| 10 Points | 25% | Small bonus |
| 25 Points | 20% | Medium bonus |
| 50 Points | 15% | Large bonus |
| 100 Points | 8% | Big win! |
| 2 Stars | 12% | Bonus stars |
| 5 Stars | 10% | Star bonanza |
| 2x Multiplier | 5% | 24-hour power-up |
| Jackpot | 5% | 200+ points! |

### Protections
- Rate limited (10 second cooldown)
- Points prizes capped by daily/weekly limits
- If completely capped, spin is **preserved** for tomorrow
- Stars and multipliers awarded regardless of cap

---

## Mystery Rewards

### Trigger
- 15% chance on any task completion
- Only if `bonuses_enabled = true`

### Types

| Type | Multiplier/Bonus | Weight |
|------|------------------|--------|
| Double Points | 2x | 35% |
| Bonus 25 | +25 pts | 30% |
| Bonus 50 | +50 pts | 20% |
| Triple Points | 3x | 10% |
| Jackpot | +100 pts | 5% |

---

## Database Tables

### Core Tables
- `progress` - Point/star transactions with running totals
- `economy_settings` - Per-profile economy configuration
- `earning_tracker` - Daily earning totals for cap enforcement
- `rate_limit_tracker` - Cooldown tracking

### Gamification Tables
- `streaks` - Streak tracking (type, current, longest)
- `streak_freezes` - Freeze usage history
- `achievements` - Achievement definitions
- `profile_achievements` - Earned achievements
- `daily_challenges` - Generated daily challenges
- `countdown_challenges` - Active/completed countdown challenges
- `spin_wheel_progress` - Spin eligibility tracking
- `spin_wheel_history` - Spin results log
- `power_ups` - Active multiplier power-ups
- `mystery_rewards` - Mystery reward history

---

## API Endpoints

### Economy
```
GET  /api/gamification/economy/:profileId - Get settings
PUT  /api/gamification/economy/:profileId - Update settings
GET  /api/gamification/earning-summary/:profileId - Get daily/weekly totals
```

### Streaks
```
GET  /api/gamification/streaks/:profileId - Get streak info
GET  /api/gamification/streak-freeze/:profileId - Get freeze status
POST /api/gamification/streak-freeze/:profileId - Use freeze
```

### Achievements
```
GET  /api/gamification/achievements/:profileId - Get achievements
GET  /api/gamification/achievements-with-hidden/:profileId - Include hidden
```

### Challenges
```
GET  /api/gamification/challenges/:profileId - Get daily challenges
POST /api/gamification/challenges/:id/complete - Complete challenge
GET  /api/gamification/countdown/:profileId - Get countdown status
POST /api/gamification/countdown/:profileId/start - Start countdown
```

### Spin Wheel
```
GET  /api/gamification/spin-wheel/:profileId - Get spin status
POST /api/gamification/spin-wheel/:profileId/spin - Spin the wheel
```

### Login Bonus
```
POST /api/gamification/login-bonus/:profileId - Claim daily bonus
```

---

## Anti-Abuse Measures

1. **Daily/Weekly Caps** - Hard limits on point earning
2. **Rate Limiting** - Cooldowns between actions
3. **Time Verification** - Tasks must have enough time elapsed
4. **Transaction Safety** - Atomic point operations prevent race conditions
5. **UNIQUE Constraints** - Prevent duplicate achievements/bonuses
6. **Proof Required** - Photo verification for applicable tasks

---

## Files & Locations

### Backend
- `routes/gamification.ts` - All gamification endpoints (~2100 lines)
- `services/economyControl.ts` - Economy settings and anti-abuse
- `database/init.ts` - Schema definitions

### Frontend
- `pages/Gamification.tsx` - Main gamification UI
- `components/SpinWheel.tsx` - Spin wheel component
- `services/api.ts` - gamificationAPI object

---

## Recent Fixes (2025-01-21)

1. **Power-ups now work** - Spin wheel multipliers actually apply
2. **Hidden achievements earnable** - All requirement types implemented
3. **Streak freeze reliable** - Creates streak if none exists
4. **Fair countdown multiplier** - Applies to ALL tasks, not just final
5. **Protected spins** - Won't consume spin if fully capped
6. **Auto-cleanup** - Old daily challenges removed after 7 days
7. **Race-safe achievements** - Transaction-protected awarding
