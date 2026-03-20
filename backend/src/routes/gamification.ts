import express from 'express';
import db from '../database/init';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireFeature } from '../middleware/feature-access';
import {
  getEconomySettings,
  updateEconomySettings,
  getEarningSummary,
  checkRateLimit,
  updateRateLimit,
  canEarnPoints,
  recordEarnings,
  isSpinWheelEnabled,
  awardPoints,
  getCurrentTotalPoints
} from '../services/economyControl';
import {
  getAiLimits,
  updateAiLimits,
  getUsageStats,
  getParentIdForProfile
} from '../services/aiUsageControl';
import { NotificationHelpers } from '../services/notifications';
import {
  canAccessOwnOrManagedChild,
  canParentManageChild,
  getFamilyLeaderboardProfileIds
} from '../services/familyAccess';

const router = express.Router();
router.use(authenticate, requireFeature('gamification'));

function canAccessGamificationProfile(viewer: AuthRequest['profile'], targetProfileId: number): boolean {
  if (!viewer) {
    return false;
  }

  return canAccessOwnOrManagedChild(viewer, targetProfileId);
}

function denyGamificationAccess(res: express.Response) {
  return res.status(403).json({ error: 'Access denied: You can only access your own or your children\'s gamification data' });
}

function formatSqlLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLeaderboardPeriodStartDate(period: unknown): string | null {
  if (period !== 'week' && period !== 'month') {
    return null;
  }

  const now = new Date();

  if (period === 'week') {
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    return formatSqlLocalDate(weekStart);
  }

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return formatSqlLocalDate(monthStart);
}

// ==================== WATER INTAKE ====================

// Log water intake
router.post('/water', (req: AuthRequest, res) => {
  try {
    const { profile_id, amount_ml } = req.body;

    if (!profile_id || !amount_ml) {
      return res.status(400).json({ error: 'profile_id and amount_ml are required' });
    }

    if (!canAccessGamificationProfile(req.profile, parseInt(profile_id, 10))) {
      return denyGamificationAccess(res);
    }

    const result = db.prepare(`
      INSERT INTO water_intake (profile_id, amount_ml)
      VALUES (?, ?)
    `).run(profile_id, amount_ml);

    // Update water streak
    updateStreak(profile_id, 'water');

    // Check for achievements
    checkAchievements(profile_id);

    const entry = db.prepare('SELECT * FROM water_intake WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(entry);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get water intake for a profile (today or specific date)
router.get('/water/:profileId', (req: AuthRequest, res) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);
    const { date } = req.query;

    if (!canAccessGamificationProfile(req.profile, profileIdNum)) {
      return denyGamificationAccess(res);
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    const entries = db.prepare(`
      SELECT * FROM water_intake
      WHERE profile_id = ? AND DATE(logged_at) = DATE(?)
      ORDER BY logged_at DESC
    `).all(profileIdNum, targetDate);

    const total: any = db.prepare(`
      SELECT SUM(amount_ml) as total
      FROM water_intake
      WHERE profile_id = ? AND DATE(logged_at) = DATE(?)
    `).get(profileIdNum, targetDate);

    res.json({
      entries,
      total_ml: total?.total || 0,
      date: targetDate,
      goal_ml: 2000 // Default goal: 2L per day
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete water intake entry
router.delete('/water/:id', (req: AuthRequest, res) => {
  try {
    const entry: any = db.prepare('SELECT profile_id FROM water_intake WHERE id = ?').get(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    if (!canAccessGamificationProfile(req.profile, entry.profile_id)) {
      return denyGamificationAccess(res);
    }

    const result = db.prepare('DELETE FROM water_intake WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    res.json({ message: 'Water intake deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== STREAKS ====================

// Get streaks for a profile
router.get('/streaks/:profileId', (req: AuthRequest, res) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);

    if (!canAccessGamificationProfile(req.profile, profileIdNum)) {
      return denyGamificationAccess(res);
    }

    const streaks = db.prepare(`
      SELECT * FROM streaks WHERE profile_id = ?
    `).all(profileIdNum);

    // If no streaks exist, create default ones
    if (streaks.length === 0) {
      const types = ['tasks', 'water'];
      types.forEach(type => {
        db.prepare(`
          INSERT OR IGNORE INTO streaks (profile_id, streak_type, current_streak, longest_streak)
          VALUES (?, ?, 0, 0)
        `).run(profileIdNum, type);
      });
      return res.json(db.prepare('SELECT * FROM streaks WHERE profile_id = ?').all(profileIdNum));
    }

    res.json(streaks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ACHIEVEMENTS ====================

// Get all available achievements
router.get('/achievements', (req, res) => {
  try {
    const achievements = db.prepare('SELECT * FROM achievements ORDER BY requirement_value ASC').all();
    res.json(achievements);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get achievements earned by a profile
router.get('/achievements/:profileId', (req: AuthRequest, res) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);

    if (!canAccessGamificationProfile(req.profile, profileIdNum)) {
      return denyGamificationAccess(res);
    }

    const earned = db.prepare(`
      SELECT a.*, pa.earned_at
      FROM achievements a
      INNER JOIN profile_achievements pa ON a.id = pa.achievement_id
      WHERE pa.profile_id = ?
      ORDER BY pa.earned_at DESC
    `).all(profileIdNum);

    const all = db.prepare('SELECT * FROM achievements').all();

    res.json({
      earned,
      all,
      earned_count: earned.length,
      total_count: all.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== GAMIFICATION STATS ====================

// Get gamification summary for a profile
router.get('/stats/:profileId', (req: AuthRequest, res) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);

    if (!canAccessGamificationProfile(req.profile, profileIdNum)) {
      return denyGamificationAccess(res);
    }

    // Get progress data
    const progress: any = db.prepare(`
      SELECT total_points, total_stars, level
      FROM progress
      WHERE profile_id = ?
      ORDER BY logged_at DESC LIMIT 1
    `).get(profileIdNum);

    // Get completed tasks count
    const tasks: any = db.prepare(`
      SELECT COUNT(*) as completed
      FROM tasks
      WHERE profile_id = ? AND completed = 1
    `).get(profileIdNum);

    // Get achieved goals count
    const goals: any = db.prepare(`
      SELECT COUNT(*) as achieved
      FROM monthly_goals
      WHERE profile_id = ? AND achieved = 1
    `).get(profileIdNum);

    // Get streaks
    const streaks = db.prepare(`
      SELECT * FROM streaks WHERE profile_id = ?
    `).all(profileIdNum);

    // Get earned achievements
    const achievements: any = db.prepare(`
      SELECT COUNT(*) as count
      FROM profile_achievements
      WHERE profile_id = ?
    `).get(profileIdNum);

    // Get today's water intake
    const today = new Date().toISOString().split('T')[0];
    const water: any = db.prepare(`
      SELECT SUM(amount_ml) as total
      FROM water_intake
      WHERE profile_id = ? AND DATE(logged_at) = DATE(?)
    `).get(profileIdNum, today);

    res.json({
      points: progress?.total_points || 0,
      stars: progress?.total_stars || 0,
      level: progress?.level || 1,
      tasks_completed: tasks?.completed || 0,
      goals_achieved: goals?.achieved || 0,
      achievements_earned: achievements?.count || 0,
      streaks: streaks.reduce((acc: any, s: any) => {
        acc[s.streak_type] = { current: s.current_streak, longest: s.longest_streak };
        return acc;
      }, {}),
      water_today_ml: water?.total || 0
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== LEADERBOARD ====================

// Get family leaderboard (only members of the user's own family)
router.get('/family-leaderboard', (req: AuthRequest, res) => {
  try {
    const { period } = req.query; // 'week', 'month', 'all'
    const currentUser = req.profile!;
    const visibleIds = getFamilyLeaderboardProfileIds(currentUser);

    const profiles = visibleIds.length > 0
      ? db.prepare(`
          SELECT id, name, avatar, type
          FROM profiles
          WHERE id IN (${visibleIds.map(() => '?').join(', ')})
            AND type IN ('parent', 'child')
        `).all(...visibleIds) as any[]
      : [];

    if (profiles.length === 0) {
      return res.json([]);
    }

    const periodStartDate = getLeaderboardPeriodStartDate(period);

    // Get stats for each family member
    const leaderboard = profiles.map((profile: any) => {
      // Get current total points (most recent record)
      const currentProgress: any = db.prepare(`
        SELECT total_points, total_stars, level FROM progress
        WHERE profile_id = ? ORDER BY logged_at DESC LIMIT 1
      `).get(profile.id);

      const currentTotalPoints = currentProgress?.total_points || 0;

      let periodPoints = currentTotalPoints; // Default to all-time

      if (periodStartDate) {
        // Use local calendar boundaries so "this week" and "this month" follow the family timezone.
        const startOfPeriodProgress: any = db.prepare(`
          SELECT total_points FROM progress
          WHERE profile_id = ? AND DATE(logged_at, 'localtime') < DATE(?)
          ORDER BY logged_at DESC LIMIT 1
        `).get(profile.id, periodStartDate);

        const pointsAtPeriodStart = startOfPeriodProgress?.total_points || 0;
        periodPoints = currentTotalPoints - pointsAtPeriodStart;
      }

      // Get total progress for level/stars (always use all-time for these)
      const totalProgress: any = currentProgress;

      // Get tasks completed for period
      let tasks: any;
      if (period === 'all' || !period) {
        tasks = db.prepare(`
          SELECT COUNT(*) as count FROM tasks
          WHERE profile_id = ? AND completed = 1
        `).get(profile.id);
      } else {
        tasks = db.prepare(`
          SELECT COUNT(*) as count FROM tasks
          WHERE profile_id = ? AND completed = 1
          AND DATE(completed_at, 'localtime') >= DATE(?)
        `).get(profile.id, periodStartDate);
      }

      // Get current streak
      const streak: any = db.prepare(`
        SELECT current_streak, longest_streak FROM streaks
        WHERE profile_id = ? AND streak_type = 'tasks'
      `).get(profile.id);

      // Get achievements count
      const achievements: any = db.prepare(`
        SELECT COUNT(*) as count FROM profile_achievements WHERE profile_id = ?
      `).get(profile.id);

      // Get recent achievements (last 3)
      const recentAchievements: any[] = db.prepare(`
        SELECT a.name, a.icon FROM achievements a
        INNER JOIN profile_achievements pa ON a.id = pa.achievement_id
        WHERE pa.profile_id = ?
        ORDER BY pa.earned_at DESC LIMIT 3
      `).all(profile.id);

      return {
        id: profile.id,
        name: profile.name,
        avatar: profile.avatar || '👤',
        type: profile.type,
        points: periodPoints,
        stars: totalProgress?.total_stars || 0,
        level: totalProgress?.level || 1,
        tasksCompleted: tasks?.count || 0,
        currentStreak: streak?.current_streak || 0,
        longestStreak: streak?.longest_streak || 0,
        achievementCount: achievements?.count || 0,
        recentAchievements,
        rank: 0
      };
    });

    // Sort by points descending
    leaderboard.sort((a, b) => b.points - a.points);

    // Add rank (handle ties)
    let currentRank = 1;
    leaderboard.forEach((entry, index) => {
      if (index > 0 && entry.points < leaderboard[index - 1].points) {
        currentRank = index + 1;
      }
      entry.rank = currentRank;
    });

    res.json(leaderboard);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get family leaderboard (all kids for a parent) - legacy endpoint
router.get('/leaderboard/:parentId', (req: AuthRequest, res) => {
  try {
    const { parentId } = req.params;
    const parentIdNum = parseInt(parentId, 10);
    const viewer = req.profile!;
    const { period } = req.query; // 'week', 'month', 'all'

    if (viewer.type !== 'admin' && viewer.id !== parentIdNum) {
      return res.status(403).json({ error: 'Access denied: You can only view your own family leaderboard' });
    }

    // Get all kids for this parent
    const childIds = getFamilyLeaderboardProfileIds({ id: parentIdNum, type: 'parent' });
    const kids = childIds.length > 0
      ? db.prepare(`
          SELECT id, name, avatar
          FROM profiles
          WHERE type = 'child' AND id IN (${childIds.map(() => '?').join(', ')})
        `).all(...childIds) as any[]
      : [];

    if (kids.length === 0) {
      return res.json([]);
    }

    const periodStartDate = getLeaderboardPeriodStartDate(period);

    // Get stats for each kid
    const leaderboard = kids.map((kid: any) => {
      // Get current total points
      const currentProgress: any = db.prepare(`
        SELECT total_points FROM progress
        WHERE profile_id = ? ORDER BY logged_at DESC LIMIT 1
      `).get(kid.id);
      const currentTotalPoints = currentProgress?.total_points || 0;

      let periodPoints = currentTotalPoints;
      if (periodStartDate) {
        const startOfPeriodProgress: any = db.prepare(`
          SELECT total_points FROM progress
          WHERE profile_id = ? AND DATE(logged_at, 'localtime') < DATE(?)
          ORDER BY logged_at DESC LIMIT 1
        `).get(kid.id, periodStartDate);
        const pointsAtPeriodStart = startOfPeriodProgress?.total_points || 0;
        periodPoints = currentTotalPoints - pointsAtPeriodStart;
      }
      const points = { points: periodPoints };

      // Get tasks completed for period
      let tasks: any;
      if (period === 'all' || !periodStartDate) {
        tasks = db.prepare(`
          SELECT COUNT(*) as count FROM tasks
          WHERE profile_id = ? AND completed = 1
        `).get(kid.id);
      } else {
        tasks = db.prepare(`
          SELECT COUNT(*) as count FROM tasks
          WHERE profile_id = ? AND completed = 1
          AND DATE(completed_at, 'localtime') >= DATE(?)
        `).get(kid.id, periodStartDate);
      }

      // Get current streak
      const streak: any = db.prepare(`
        SELECT current_streak FROM streaks
        WHERE profile_id = ? AND streak_type = 'tasks'
      `).get(kid.id);

      // Get achievements count
      const achievements: any = db.prepare(`
        SELECT COUNT(*) as count FROM profile_achievements WHERE profile_id = ?
      `).get(kid.id);

      return {
        id: kid.id,
        name: kid.name,
        avatar: kid.avatar || '👤',
        points: points?.points || 0,
        tasksCompleted: tasks?.count || 0,
        currentStreak: streak?.current_streak || 0,
        achievements: achievements?.count || 0,
        rank: 0
      };
    });

    // Sort by points descending
    leaderboard.sort((a, b) => b.points - a.points);

    // Add rank
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    res.json(leaderboard);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== HELPER FUNCTIONS ====================

function updateStreak(profileId: number, streakType: string) {
  const today = new Date().toISOString().split('T')[0];

  // Get current streak info
  let streak: any = db.prepare(`
    SELECT * FROM streaks WHERE profile_id = ? AND streak_type = ?
  `).get(profileId, streakType);

  if (!streak) {
    // Create new streak
    db.prepare(`
      INSERT INTO streaks (profile_id, streak_type, current_streak, longest_streak, last_activity_date)
      VALUES (?, ?, 1, 1, ?)
    `).run(profileId, streakType, today);
    return;
  }

  const lastDate = streak.last_activity_date;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (lastDate === today) {
    // Already logged today, no change
    return;
  } else if (lastDate === yesterday) {
    // Consecutive day, increment streak
    const newStreak = streak.current_streak + 1;
    const longestStreak = Math.max(newStreak, streak.longest_streak);
    db.prepare(`
      UPDATE streaks
      SET current_streak = ?, longest_streak = ?, last_activity_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newStreak, longestStreak, today, streak.id);
  } else {
    // Streak broken, reset to 1
    db.prepare(`
      UPDATE streaks
      SET current_streak = 1, last_activity_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(today, streak.id);
  }
}

function checkAchievements(profileId: number) {
  // Get profile stats
  const progress: any = db.prepare(`
    SELECT total_points, total_stars FROM progress
    WHERE profile_id = ? ORDER BY logged_at DESC LIMIT 1
  `).get(profileId);

  const tasks: any = db.prepare(`
    SELECT COUNT(*) as count FROM tasks WHERE profile_id = ? AND completed = 1
  `).get(profileId);

  const goals: any = db.prepare(`
    SELECT COUNT(*) as count FROM monthly_goals WHERE profile_id = ? AND achieved = 1
  `).get(profileId);

  const streaks: any[] = db.prepare(`
    SELECT * FROM streaks WHERE profile_id = ?
  `).all(profileId);

  // Get all achievements not yet earned
  const unearnedAchievements: any[] = db.prepare(`
    SELECT a.* FROM achievements a
    WHERE a.id NOT IN (
      SELECT achievement_id FROM profile_achievements WHERE profile_id = ?
    )
  `).all(profileId);

  // Get additional stats for hidden achievements
  const earlyTasks: any = db.prepare(`
    SELECT COUNT(*) as count FROM tasks
    WHERE profile_id = ? AND completed = 1 AND TIME(completed_at) < '08:00:00'
  `).get(profileId);

  const weekendTasks: any = db.prepare(`
    SELECT COUNT(*) as count FROM tasks
    WHERE profile_id = ? AND completed = 1
    AND (strftime('%w', completed_at) = '0' OR strftime('%w', completed_at) = '6')
  `).get(profileId);

  const countdownsCompleted: any = db.prepare(`
    SELECT COUNT(*) as count FROM countdown_challenges WHERE profile_id = ? AND completed = 1
  `).get(profileId);

  const jackpotWins: any = db.prepare(`
    SELECT COUNT(*) as count FROM spin_wheel_history
    WHERE profile_id = ? AND reward_type = 'jackpot'
  `).get(profileId);

  // Check each achievement
  unearnedAchievements.forEach((achievement: any) => {
    let earned = false;

    switch (achievement.requirement_type) {
      case 'tasks_completed':
        earned = (tasks?.count || 0) >= achievement.requirement_value;
        break;
      case 'total_points':
        earned = (progress?.total_points || 0) >= achievement.requirement_value;
        break;
      case 'total_stars':
        earned = (progress?.total_stars || 0) >= achievement.requirement_value;
        break;
      case 'goals_achieved':
        earned = (goals?.count || 0) >= achievement.requirement_value;
        break;
      case 'streak_days':
        const taskStreak = streaks.find((s: any) => s.streak_type === 'tasks');
        earned = (taskStreak?.current_streak || 0) >= achievement.requirement_value;
        break;
      case 'water_streak':
        const waterStreak = streaks.find((s: any) => s.streak_type === 'water');
        earned = (waterStreak?.current_streak || 0) >= achievement.requirement_value;
        break;
      // Hidden achievement types
      case 'early_tasks':
        earned = (earlyTasks?.count || 0) >= achievement.requirement_value;
        break;
      case 'weekend_tasks':
        earned = (weekendTasks?.count || 0) >= achievement.requirement_value;
        break;
      case 'countdown_completed':
        earned = (countdownsCompleted?.count || 0) >= achievement.requirement_value;
        break;
      case 'jackpot_win':
        earned = (jackpotWins?.count || 0) >= achievement.requirement_value;
        break;
      // Note: speed_tasks is checked in real-time during task completion (checkHiddenAchievementsOnTaskComplete)
      // as it requires checking tasks completed within the last 30 minutes
    }

    if (earned) {
      // FIX: Use transaction to prevent race condition where achievement could be awarded twice
      // The UNIQUE constraint provides second-level protection, but transaction ensures atomic award
      const awardAchievementTransaction = db.transaction(() => {
        // Check if already earned within transaction (race condition protection)
        const alreadyEarned: any = db.prepare(`
          SELECT id FROM profile_achievements WHERE profile_id = ? AND achievement_id = ?
        `).get(profileId, achievement.id);

        if (alreadyEarned) {
          return { awarded: false };
        }

        db.prepare(`
          INSERT INTO profile_achievements (profile_id, achievement_id)
          VALUES (?, ?)
        `).run(profileId, achievement.id);

        // Award bonus points for achievement using centralized system
        if (achievement.points_reward > 0) {
          awardPoints({
            profileId,
            basePoints: achievement.points_reward,
            source: 'achievement',
            applyMultiplier: false,
            enforceRateLimit: false
          });
        }

        return { awarded: true };
      });

      try {
        const result = awardAchievementTransaction();
        if (result.awarded) {
          console.log(`[Gamification] ${profileId} earned achievement: ${achievement.name}`);
        }
      } catch (e) {
        // Transaction failed (likely UNIQUE constraint), ignore
      }
    }
  });
}

// ==================== DAILY CHALLENGES ====================

// Challenge types with their requirements
const CHALLENGE_TYPES = [
  { type: 'complete_tasks', description: 'Complete {n} tasks today', minTasks: 1, maxTasks: 5, bonusPoints: 10 },
  { type: 'drink_water', description: 'Drink {n}ml of water today', minMl: 500, maxMl: 1500, bonusPoints: 5 },
  { type: 'all_categories', description: 'Complete tasks in {n} different categories', minCats: 2, maxCats: 3, bonusPoints: 15 },
  { type: 'early_bird', description: 'Complete a task before 10 AM', bonusPoints: 10 },
  { type: 'streak_keeper', description: 'Keep your task streak going', bonusPoints: 5 }
];

// FIX: Cleanup old daily challenges to prevent database bloat
// Keeps challenges from the last 7 days for history, deletes older ones
function cleanupOldDailyChallenges(profileId: number): void {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoffDate = sevenDaysAgo.toISOString().split('T')[0];

    const result = db.prepare(`
      DELETE FROM daily_challenges
      WHERE profile_id = ? AND DATE(created_at) < DATE(?)
    `).run(profileId, cutoffDate);

    if (result.changes > 0) {
      console.log(`[Gamification] Cleaned up ${result.changes} old daily challenges for profile ${profileId}`);
    }
  } catch (error: any) {
    // Non-critical error, just log it
    console.error('[Gamification] Cleanup error:', error.message);
  }
}

// Get daily challenges for a profile
router.get('/challenges/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;
    const today = new Date().toISOString().split('T')[0];

    // FIX: Cleanup old challenges (older than 7 days) to prevent database bloat
    // This runs opportunistically when fetching challenges
    cleanupOldDailyChallenges(parseInt(profileId));

    // Check if challenges exist for today
    let challenges: any[] = db.prepare(`
      SELECT * FROM daily_challenges
      WHERE profile_id = ? AND DATE(created_at) = DATE(?)
      ORDER BY id
    `).all(profileId, today);

    // If no challenges, generate new ones
    if (challenges.length === 0) {
      challenges = generateDailyChallenges(parseInt(profileId));
    }

    // Calculate progress for each challenge
    challenges = challenges.map((challenge: any) => {
      const progress = calculateChallengeProgress(parseInt(profileId), challenge.challenge_type, challenge.target_value, today);
      return { ...challenge, current_progress: progress };
    });

    res.json(challenges);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Complete a challenge and award bonus points
router.post('/challenges/:challengeId/complete', (req, res) => {
  try {
    const { challengeId } = req.params;

    const challenge: any = db.prepare('SELECT * FROM daily_challenges WHERE id = ?').get(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    if (challenge.completed) {
      return res.status(400).json({ error: 'Challenge already completed' });
    }

    // Mark as completed
    db.prepare(`
      UPDATE daily_challenges SET completed = 1, completed_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(challengeId);

    // Award bonus points using centralized system
    const awardResult = awardPoints({
      profileId: challenge.profile_id,
      basePoints: challenge.bonus_points,
      source: 'challenge',
      applyMultiplier: false,
      enforceRateLimit: false
    });

    res.json({
      message: 'Challenge completed!',
      bonusPoints: awardResult.awarded,
      capped: awardResult.capped,
      dailyRemaining: awardResult.dailyRemaining
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function generateDailyChallenges(profileId: number): any[] {
  const today = new Date().toISOString().split('T')[0];
  const challenges: any[] = [];

  // Pick 3 random challenge types
  const shuffled = [...CHALLENGE_TYPES].sort(() => Math.random() - 0.5);
  const selectedTypes = shuffled.slice(0, 3);

  selectedTypes.forEach(challengeType => {
    let targetValue = 0;
    let description = challengeType.description;

    switch (challengeType.type) {
      case 'complete_tasks':
        targetValue = Math.floor(Math.random() * (challengeType.maxTasks! - challengeType.minTasks! + 1)) + challengeType.minTasks!;
        description = description.replace('{n}', targetValue.toString());
        break;
      case 'drink_water':
        targetValue = Math.floor((Math.random() * (challengeType.maxMl! - challengeType.minMl! + 1) + challengeType.minMl!) / 100) * 100;
        description = description.replace('{n}', targetValue.toString());
        break;
      case 'all_categories':
        targetValue = Math.floor(Math.random() * (challengeType.maxCats! - challengeType.minCats! + 1)) + challengeType.minCats!;
        description = description.replace('{n}', targetValue.toString());
        break;
      default:
        targetValue = 1;
    }

    const result = db.prepare(`
      INSERT INTO daily_challenges (profile_id, challenge_type, description, target_value, bonus_points)
      VALUES (?, ?, ?, ?, ?)
    `).run(profileId, challengeType.type, description, targetValue, challengeType.bonusPoints);

    challenges.push({
      id: result.lastInsertRowid,
      profile_id: profileId,
      challenge_type: challengeType.type,
      description,
      target_value: targetValue,
      bonus_points: challengeType.bonusPoints,
      completed: 0,
      created_at: today
    });
  });

  return challenges;
}

function calculateChallengeProgress(profileId: number, challengeType: string, targetValue: number, today: string): number {
  switch (challengeType) {
    case 'complete_tasks': {
      const result: any = db.prepare(`
        SELECT COUNT(*) as count FROM tasks
        WHERE profile_id = ? AND completed = 1 AND DATE(completed_at) = DATE(?)
      `).get(profileId, today);
      return result?.count || 0;
    }
    case 'drink_water': {
      const result: any = db.prepare(`
        SELECT SUM(amount_ml) as total FROM water_intake
        WHERE profile_id = ? AND DATE(logged_at) = DATE(?)
      `).get(profileId, today);
      return result?.total || 0;
    }
    case 'all_categories': {
      const result: any = db.prepare(`
        SELECT COUNT(DISTINCT category) as count FROM tasks
        WHERE profile_id = ? AND completed = 1 AND DATE(completed_at) = DATE(?)
      `).get(profileId, today);
      return result?.count || 0;
    }
    case 'early_bird': {
      const result: any = db.prepare(`
        SELECT COUNT(*) as count FROM tasks
        WHERE profile_id = ? AND completed = 1 AND DATE(completed_at) = DATE(?)
        AND TIME(completed_at) < '10:00:00'
      `).get(profileId, today);
      return result?.count || 0;
    }
    case 'streak_keeper': {
      const streak: any = db.prepare(`
        SELECT current_streak FROM streaks WHERE profile_id = ? AND streak_type = 'tasks'
      `).get(profileId);
      return streak?.current_streak > 0 ? 1 : 0;
    }
    default:
      return 0;
  }
}

// ==================== WEEKLY SUMMARY ====================

// Get weekly summary for a profile
router.get('/weekly-summary/:profileId', (req: AuthRequest, res) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);

    if (!canAccessGamificationProfile(req.profile, profileIdNum)) {
      return denyGamificationAccess(res);
    }

    // Calculate week start (Monday) and end (Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    // Tasks completed this week
    const tasksCompleted: any = db.prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE profile_id = ? AND completed = 1
      AND DATE(completed_at) BETWEEN DATE(?) AND DATE(?)
    `).get(profileId, weekStartStr, weekEndStr);

    // Points earned this week (use difference method for reliability)
    const weekStartProgress: any = db.prepare(`
      SELECT total_points FROM progress
      WHERE profile_id = ? AND DATE(logged_at) < DATE(?)
      ORDER BY logged_at DESC LIMIT 1
    `).get(profileId, weekStartStr);
    const currentProgress: any = db.prepare(`
      SELECT total_points FROM progress
      WHERE profile_id = ? ORDER BY logged_at DESC LIMIT 1
    `).get(profileId);
    const pointsEarned = {
      total: (currentProgress?.total_points || 0) - (weekStartProgress?.total_points || 0)
    };

    // Challenges completed this week
    const challengesCompleted: any = db.prepare(`
      SELECT COUNT(*) as count FROM daily_challenges
      WHERE profile_id = ? AND completed = 1
      AND DATE(completed_at) BETWEEN DATE(?) AND DATE(?)
    `).get(profileId, weekStartStr, weekEndStr);

    // Water intake this week
    const waterIntake: any = db.prepare(`
      SELECT SUM(amount_ml) as total FROM water_intake
      WHERE profile_id = ? AND DATE(logged_at) BETWEEN DATE(?) AND DATE(?)
    `).get(profileId, weekStartStr, weekEndStr);

    // Achievements earned this week
    const achievementsEarned: any = db.prepare(`
      SELECT COUNT(*) as count FROM profile_achievements
      WHERE profile_id = ? AND DATE(earned_at) BETWEEN DATE(?) AND DATE(?)
    `).get(profileId, weekStartStr, weekEndStr);

    // Tasks by category this week
    const tasksByCategory = db.prepare(`
      SELECT category, COUNT(*) as count FROM tasks
      WHERE profile_id = ? AND completed = 1
      AND DATE(completed_at) BETWEEN DATE(?) AND DATE(?)
      AND category IS NOT NULL
      GROUP BY category ORDER BY count DESC
    `).all(profileId, weekStartStr, weekEndStr);

    // Daily breakdown
    const dailyBreakdown = db.prepare(`
      SELECT DATE(completed_at) as date, COUNT(*) as tasks_completed
      FROM tasks
      WHERE profile_id = ? AND completed = 1
      AND DATE(completed_at) BETWEEN DATE(?) AND DATE(?)
      GROUP BY DATE(completed_at)
      ORDER BY date
    `).all(profileId, weekStartStr, weekEndStr);

    // Current streaks
    const streaks = db.prepare(`
      SELECT streak_type, current_streak, longest_streak FROM streaks WHERE profile_id = ?
    `).all(profileId);

    res.json({
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      summary: {
        tasksCompleted: tasksCompleted?.count || 0,
        pointsEarned: pointsEarned?.total || 0,
        challengesCompleted: challengesCompleted?.count || 0,
        waterIntakeMl: waterIntake?.total || 0,
        achievementsEarned: achievementsEarned?.count || 0
      },
      tasksByCategory,
      dailyBreakdown,
      streaks: streaks.reduce((acc: any, s: any) => {
        acc[s.streak_type] = { current: s.current_streak, longest: s.longest_streak };
        return acc;
      }, {})
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== DAILY LOGIN BONUS ====================

// Daily bonus structure: Day 1=5, Day 2=10, Day 3=15, Day 4=20, Day 5=25, Day 6=35, Day 7=50
const DAILY_BONUS_POINTS = [5, 10, 15, 20, 25, 35, 50];

// Check and claim daily login bonus
router.get('/login-bonus/:profileId', (req: AuthRequest, res) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);

    if (!canAccessGamificationProfile(req.profile, profileIdNum)) {
      return denyGamificationAccess(res);
    }
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Check if already claimed today
    const todayBonus: any = db.prepare(`
      SELECT * FROM login_bonuses WHERE profile_id = ? AND login_date = ?
    `).get(profileId, today);

    if (todayBonus) {
      return res.json({
        claimed: true,
        consecutive_days: todayBonus.consecutive_days,
        points_earned: todayBonus.points_earned,
        next_bonus: DAILY_BONUS_POINTS[Math.min(todayBonus.consecutive_days, 6)]
      });
    }

    // Check yesterday for streak
    const yesterdayBonus: any = db.prepare(`
      SELECT * FROM login_bonuses WHERE profile_id = ? AND login_date = ?
    `).get(profileId, yesterday);

    const consecutiveDays = yesterdayBonus ? (yesterdayBonus.consecutive_days % 7) + 1 : 1;
    const pointsToEarn = DAILY_BONUS_POINTS[consecutiveDays - 1];

    res.json({
      claimed: false,
      consecutive_days: consecutiveDays,
      points_to_earn: pointsToEarn,
      streak_from_yesterday: !!yesterdayBonus
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Claim daily login bonus - uses transaction to prevent race conditions
router.post('/login-bonus/:profileId/claim', (req: AuthRequest, res) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);

    if (!canAccessGamificationProfile(req.profile, profileIdNum)) {
      return denyGamificationAccess(res);
    }
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Use a transaction to prevent duplicate claims (race condition fix)
    const claimBonus = db.transaction(() => {
      // Check if already claimed (inside transaction for consistency)
      const existing: any = db.prepare(`
        SELECT * FROM login_bonuses WHERE profile_id = ? AND login_date = ?
      `).get(profileId, today);

      if (existing) {
        return { error: 'Already claimed today', claimed: true };
      }

      // Check streak
      const yesterdayBonus: any = db.prepare(`
        SELECT * FROM login_bonuses WHERE profile_id = ? AND login_date = ?
      `).get(profileId, yesterday);

      const consecutiveDays = yesterdayBonus ? (yesterdayBonus.consecutive_days % 7) + 1 : 1;
      const pointsToEarn = DAILY_BONUS_POINTS[consecutiveDays - 1];

      // Insert login bonus - UNIQUE constraint provides additional safety
      try {
        db.prepare(`
          INSERT INTO login_bonuses (profile_id, login_date, consecutive_days, points_earned)
          VALUES (?, ?, ?, ?)
        `).run(profileId, today, consecutiveDays, pointsToEarn);
      } catch (insertError: any) {
        // UNIQUE constraint violation means already claimed (race condition caught)
        if (insertError.code === 'SQLITE_CONSTRAINT_UNIQUE' || insertError.message?.includes('UNIQUE')) {
          return { error: 'Already claimed today', claimed: true };
        }
        throw insertError;
      }

      // Award points using centralized system (inside transaction)
      const awardResult = awardPoints({
        profileId: parseInt(profileId),
        basePoints: pointsToEarn,
        source: 'login_bonus',
        applyMultiplier: false,
        enforceRateLimit: false,
        actionType: 'bonus'
      });

      return {
        success: true,
        points_earned: awardResult.awarded,
        consecutive_days: consecutiveDays,
        total_points: awardResult.newTotal,
        next_bonus: DAILY_BONUS_POINTS[consecutiveDays % 7],
        is_week_complete: consecutiveDays === 7,
        capped: awardResult.capped,
        dailyRemaining: awardResult.dailyRemaining
      };
    });

    // Execute the transaction
    const result = claimBonus();

    if (result.error) {
      return res.status(400).json(result);
    }

    // Check achievements after awarding points (outside transaction is fine)
    checkAchievements(parseInt(profileId));

    res.json(result);
  } catch (error: any) {
    console.error('[LoginBonus] Claim error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== MYSTERY REWARDS ====================

// Check for mystery reward on task completion (call this from tasks route)
export function checkMysteryReward(profileId: number, taskId: number, basePoints: number): { multiplier: number; bonusPoints: number; rewardType: string } | null {
  // 15% chance for mystery reward
  if (Math.random() > 0.15) {
    return null;
  }

  const rewardTypes = [
    { type: 'double_points', multiplier: 2.0, bonus: 0, weight: 40 },
    { type: 'bonus_50', multiplier: 1.0, bonus: 50, weight: 25 },
    { type: 'bonus_25', multiplier: 1.0, bonus: 25, weight: 35 },
    { type: 'triple_points', multiplier: 3.0, bonus: 0, weight: 10 },
    { type: 'jackpot', multiplier: 1.0, bonus: 100, weight: 5 }
  ];

  // Weighted random selection
  const totalWeight = rewardTypes.reduce((sum, r) => sum + r.weight, 0);
  let random = Math.random() * totalWeight;
  let selectedReward = rewardTypes[0];

  for (const reward of rewardTypes) {
    random -= reward.weight;
    if (random <= 0) {
      selectedReward = reward;
      break;
    }
  }

  const bonusPoints = selectedReward.bonus + Math.floor(basePoints * (selectedReward.multiplier - 1));

  // Log the mystery reward
  db.prepare(`
    INSERT INTO mystery_rewards (profile_id, reward_type, multiplier, bonus_points, task_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(profileId, selectedReward.type, selectedReward.multiplier, bonusPoints, taskId);

  return {
    multiplier: selectedReward.multiplier,
    bonusPoints: bonusPoints,
    rewardType: selectedReward.type
  };
}

// Get recent mystery rewards for a profile
router.get('/mystery-rewards/:profileId', (req: AuthRequest, res) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);

    if (!canAccessGamificationProfile(req.profile, profileIdNum)) {
      return denyGamificationAccess(res);
    }
    const rewards = db.prepare(`
      SELECT mr.*, t.title as task_title
      FROM mystery_rewards mr
      LEFT JOIN tasks t ON mr.task_id = t.id
      WHERE mr.profile_id = ?
      ORDER BY mr.earned_at DESC
      LIMIT 10
    `).all(profileId);

    // Get totals
    const totals: any = db.prepare(`
      SELECT COUNT(*) as count, SUM(bonus_points) as total_bonus
      FROM mystery_rewards
      WHERE profile_id = ?
    `).get(profileId);

    res.json({
      recent: rewards,
      total_count: totals?.count || 0,
      total_bonus_earned: totals?.total_bonus || 0
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== STREAK PROTECTION ====================

// Get streak freeze status
router.get('/streak-freeze/:profileId', (req: AuthRequest, res) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);

    if (!canAccessGamificationProfile(req.profile, profileIdNum)) {
      return denyGamificationAccess(res);
    }

    // Check freezes used this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const usedThisWeek: any = db.prepare(`
      SELECT COUNT(*) as count FROM streak_freezes
      WHERE profile_id = ? AND freeze_date >= ?
    `).get(profileId, weekStartStr);

    // Get current points
    const progress: any = db.prepare(`
      SELECT total_points FROM progress WHERE profile_id = ? ORDER BY logged_at DESC LIMIT 1
    `).get(profileId);

    const freezeCost = 50; // Cost in points

    res.json({
      freezes_used_this_week: usedThisWeek?.count || 0,
      max_freezes_per_week: 1,
      can_freeze: (usedThisWeek?.count || 0) < 1 && (progress?.total_points || 0) >= freezeCost,
      freeze_cost: freezeCost,
      current_points: progress?.total_points || 0
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Use streak freeze
router.post('/streak-freeze/:profileId', (req: AuthRequest, res) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);
    const { streak_type } = req.body;
    const today = new Date().toISOString().split('T')[0];

    if (!canAccessGamificationProfile(req.profile, profileIdNum)) {
      return denyGamificationAccess(res);
    }

    if (!streak_type || !['tasks', 'water'].includes(streak_type)) {
      return res.status(400).json({ error: 'Invalid streak_type. Must be "tasks" or "water"' });
    }

    // Check if already used this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const usedThisWeek: any = db.prepare(`
      SELECT COUNT(*) as count FROM streak_freezes
      WHERE profile_id = ? AND freeze_date >= ?
    `).get(profileId, weekStartStr);

    if ((usedThisWeek?.count || 0) >= 1) {
      return res.status(400).json({ error: 'Already used streak freeze this week' });
    }

    // Check points and deduct using centralized system
    const freezeCost = 50;
    const currentTotal = getCurrentTotalPoints(parseInt(profileId));

    if (currentTotal < freezeCost) {
      return res.status(400).json({ error: 'Not enough points', required: freezeCost, current: currentTotal });
    }

    // Deduct points using centralized system
    const awardResult = awardPoints({
      profileId: parseInt(profileId),
      basePoints: -freezeCost,
      source: 'streak_freeze',
      bypassCaps: true,  // Deductions bypass earning caps
      enforceRateLimit: false
    });

    if (!awardResult.success) {
      return res.status(400).json({ error: awardResult.reason || 'Failed to deduct points' });
    }

    const newPoints = awardResult.newTotal;

    // Check if streak exists first
    const existingStreak: any = db.prepare(`
      SELECT * FROM streaks WHERE profile_id = ? AND streak_type = ?
    `).get(profileId, streak_type);

    if (!existingStreak) {
      // Create the streak record if it doesn't exist (user is trying to protect a non-existent streak)
      // This is a safety net - we create it with current_streak = 1 so they don't waste points
      db.prepare(`
        INSERT INTO streaks (profile_id, streak_type, current_streak, longest_streak, last_activity_date)
        VALUES (?, ?, 1, 1, ?)
      `).run(profileId, streak_type, today);
    }

    // Record the freeze
    db.prepare(`
      INSERT INTO streak_freezes (profile_id, freeze_date, streak_type)
      VALUES (?, ?, ?)
    `).run(profileId, today, streak_type);

    // Update streak last_activity_date to today (protects streak)
    db.prepare(`
      UPDATE streaks SET last_activity_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE profile_id = ? AND streak_type = ?
    `).run(today, profileId, streak_type);

    res.json({
      success: true,
      message: `${streak_type} streak protected!`,
      points_spent: freezeCost,
      remaining_points: newPoints,
      streak_created: !existingStreak // Let the client know if we created a new streak
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Export helper to be used from tasks route
export function updateTaskStreak(profileId: number) {
  updateStreak(profileId, 'tasks');
  checkAchievements(profileId);
}

// ==================== ECONOMY CONTROLS (Parent Settings) ====================

// Get economy settings for a child profile
router.get('/economy/:profileId', (req: AuthRequest, res) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);

    if (!canAccessGamificationProfile(req.profile, profileIdNum)) {
      return denyGamificationAccess(res);
    }

    const settings = getEconomySettings(profileIdNum);
    const summary = getEarningSummary(profileIdNum);

    res.json({
      settings,
      earnings: {
        today: summary.today,
        weekTotal: summary.weekTotal,
        dailyRemaining: summary.dailyRemaining,
        weeklyRemaining: summary.weeklyRemaining
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update economy settings (parent action)
router.put('/economy/:profileId', (req: AuthRequest, res) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);
    const requester = req.profile!;
    const updates = req.body;

    if (requester.type !== 'parent' && requester.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents or admins can update economy settings' });
    }

    if (requester.type === 'parent' && !canParentManageChild(requester.id, profileIdNum)) {
      return res.status(403).json({ error: 'Access denied: You can only manage settings for your own children' });
    }

    const updatedSettings = updateEconomySettings(profileIdNum, {
      daily_points_cap: updates.dailyPointsCap,
      weekly_points_cap: updates.weeklyPointsCap,
      points_multiplier: updates.pointsMultiplier,
      require_time_elapsed: updates.requireTimeElapsed,
      min_task_duration_minutes: updates.minTaskDuration,
      cooldown_seconds: updates.cooldownSeconds,
      bonuses_enabled: updates.bonusesEnabled,
      spin_wheel_enabled: updates.spinWheelEnabled,
      countdown_challenges_enabled: updates.countdownChallengesEnabled
    });

    res.json({
      message: 'Economy settings updated',
      settings: updatedSettings
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get earning history for a child (for parent dashboard)
router.get('/economy/:profileId/history', (req: AuthRequest, res) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);
    const { days = 7 } = req.query;

    if (!canAccessGamificationProfile(req.profile, profileIdNum)) {
      return denyGamificationAccess(res);
    }

    const history = db.prepare(`
      SELECT date, points_earned, stars_earned, tasks_completed, bonuses_claimed
      FROM earning_tracker
      WHERE profile_id = ?
      ORDER BY date DESC
      LIMIT ?
    `).all(profileIdNum, parseInt(days as string));

    const totals: any = db.prepare(`
      SELECT
        SUM(points_earned) as total_points,
        SUM(stars_earned) as total_stars,
        SUM(tasks_completed) as total_tasks,
        SUM(bonuses_claimed) as total_bonuses
      FROM earning_tracker
      WHERE profile_id = ?
    `).get(profileIdNum);

    res.json({
      history,
      totals: {
        points: totals?.total_points || 0,
        stars: totals?.total_stars || 0,
        tasks: totals?.total_tasks || 0,
        bonuses: totals?.total_bonuses || 0
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reward pricing calculator - helps parents set appropriate costs
router.get('/economy/:profileId/pricing-guide', (req: AuthRequest, res) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);

    if (!canAccessGamificationProfile(req.profile, profileIdNum)) {
      return denyGamificationAccess(res);
    }

    const settings = getEconomySettings(profileIdNum);
    const summary = getEarningSummary(profileIdNum);

    // Calculate average daily earnings based on history
    const avgHistory: any = db.prepare(`
      SELECT AVG(points_earned) as avg_daily
      FROM earning_tracker
      WHERE profile_id = ? AND points_earned > 0
    `).get(profileIdNum);

    const avgDailyEarnings = Math.round(avgHistory?.avg_daily || settings.daily_points_cap * 0.5);

    // Pricing suggestions based on earning rate
    const pricingGuide = {
      earningRate: {
        dailyCap: settings.daily_points_cap,
        weeklyCap: settings.weekly_points_cap,
        avgDailyActual: avgDailyEarnings,
        avgWeeklyProjected: avgDailyEarnings * 7
      },
      suggestions: {
        smallTreat: {
          description: 'Small treat, extra screen time, small toy',
          suggestedPoints: Math.round(avgDailyEarnings * 2), // ~2 days
          daysToEarn: 2
        },
        mediumReward: {
          description: 'Movie night, special outing, medium toy',
          suggestedPoints: Math.round(avgDailyEarnings * 7), // ~1 week
          daysToEarn: 7
        },
        largeReward: {
          description: 'Big toy, special event, dinner out',
          suggestedPoints: Math.round(avgDailyEarnings * 14), // ~2 weeks
          daysToEarn: 14
        },
        majorReward: {
          description: 'Gaming console, expensive item, trip',
          suggestedPoints: Math.round(avgDailyEarnings * 30), // ~1 month
          daysToEarn: 30
        }
      },
      tips: [
        'Set reward prices based on how many days of good behavior you want',
        `At current settings, a child earning max points gets ${settings.daily_points_cap}/day`,
        'Consider increasing task time requirements for higher value tasks',
        'Use proof-required tasks for bigger point values'
      ]
    };

    res.json(pricingGuide);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== POINTS ADJUSTMENT (Parent Control) ====================

// Adjust (add or deduct) points for a child - Parents only
router.post('/points/adjust/:profileId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);
    const { amount, reason, related_task_id } = req.body;

    // Validate input
    if (amount === undefined || amount === 0) {
      return res.status(400).json({ error: 'Amount is required and cannot be zero' });
    }

    if (!reason || reason.trim().length < 3) {
      return res.status(400).json({ error: 'A reason is required (minimum 3 characters)' });
    }

    // Verify parent has permission over this child
    const child: any = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileIdNum);
    if (!child) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (child.type !== 'child') {
      return res.status(400).json({ error: 'Can only adjust points for child profiles' });
    }

    // Verify the requester is a parent/admin of this child
    const parentId = req.profile?.id;
    const parent: any = db.prepare('SELECT * FROM profiles WHERE id = ?').get(parentId);
    if (!parent || (parent.type !== 'parent' && parent.type !== 'admin')) {
      return res.status(403).json({ error: 'Only parents can adjust points' });
    }

    if (parent.type === 'parent' && !canParentManageChild(parent.id, child.id)) {
      return res.status(403).json({ error: 'Access denied: You can only adjust points for your own children' });
    }

    // Get related task title if provided
    let relatedTaskTitle: string | undefined;
    if (related_task_id) {
      const task: any = db.prepare('SELECT title FROM tasks WHERE id = ?').get(related_task_id);
      relatedTaskTitle = task?.title;
    }

    // Capture current points before adjustment for response
    const currentPoints = getCurrentTotalPoints(profileIdNum);

    // Award/deduct points using centralized system
    // Parent adjustments bypass caps but still go through the central system for consistency
    const awardResult = awardPoints({
      profileId: profileIdNum,
      basePoints: amount,
      source: 'adjustment',
      bypassCaps: true,  // Parent adjustments bypass earning caps
      applyMultiplier: false,
      enforceRateLimit: false,
      reason: reason.trim()
    });

    if (!awardResult.success) {
      return res.status(400).json({
        error: awardResult.reason || 'Failed to adjust points',
        current_points: awardResult.newTotal
      });
    }

    // Log the adjustment for audit (additional record beyond what awardPoints logs)
    try {
      db.prepare(`
        INSERT INTO points_adjustments (profile_id, adjusted_by, amount, reason, related_task_id, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(profileIdNum, parentId, awardResult.awarded, reason.trim(), related_task_id || null);
    } catch (insertError: any) {
      // If related_task_id column doesn't exist, try without it
      if (insertError.message.includes('related_task_id')) {
        db.prepare(`
          INSERT INTO points_adjustments (profile_id, adjusted_by, amount, reason, created_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(profileIdNum, parentId, awardResult.awarded, reason.trim());
      } else if (!insertError.message.includes('no such table')) {
        throw insertError;
      }
    }

    const newPoints = awardResult.newTotal;
    const newLevel = awardResult.newLevel;

    // Send notification to the child
    try {
      if (amount < 0) {
        await NotificationHelpers.pointsDeducted(
          profileIdNum,
          Math.abs(amount),
          reason.trim(),
          parent.name,
          relatedTaskTitle
        );
      } else {
        await NotificationHelpers.pointsAdded(
          profileIdNum,
          amount,
          reason.trim(),
          parent.name
        );
      }
    } catch (notifError) {
      console.warn('[Points Adjust] Failed to send notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.json({
      success: true,
      adjustment: amount,
      reason: reason.trim(),
      previous_points: currentPoints,
      new_points: newPoints,
      new_level: newLevel,
      adjusted_by: parent.name,
      related_task: relatedTaskTitle || null
    });
  } catch (error: any) {
    // Handle missing table gracefully
    if (error.message.includes('no such table: points_adjustments')) {
      // Table doesn't exist yet, continue without audit log
      console.warn('points_adjustments table not found, skipping audit log');
    }
    res.status(500).json({ error: error.message });
  }
});

// Get points adjustment history for a child
router.get('/points/history/:profileId', authenticate, (req: AuthRequest, res) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);
    const { limit = 20 } = req.query;

    if (!canAccessGamificationProfile(req.profile, profileIdNum)) {
      return denyGamificationAccess(res);
    }

    // Try to get adjustment history (table may not exist in older databases)
    let history: any[] = [];
    try {
      history = db.prepare(`
        SELECT pa.*, p.name as adjusted_by_name
        FROM points_adjustments pa
        LEFT JOIN profiles p ON pa.adjusted_by = p.id
        WHERE pa.profile_id = ?
        ORDER BY pa.created_at DESC
        LIMIT ?
      `).all(profileIdNum, parseInt(limit as string));
    } catch {
      // Table doesn't exist yet
      history = [];
    }

    res.json({ history });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== COUNTDOWN CHALLENGES ====================

// Countdown challenge templates
const COUNTDOWN_TEMPLATES = [
  { target: 3, duration: 120, multiplier: 2.0, description: 'Complete 3 tasks in 2 hours for 2x points!' },
  { target: 2, duration: 60, multiplier: 1.5, description: 'Complete 2 tasks in 1 hour for 1.5x points!' },
  { target: 5, duration: 180, multiplier: 2.5, description: 'Complete 5 tasks in 3 hours for 2.5x points!' },
  { target: 4, duration: 90, multiplier: 2.0, description: 'Complete 4 tasks in 90 minutes for 2x points!' }
];

// Get active countdown challenge for a profile
router.get('/countdown/:profileId', (req: AuthRequest, res) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);
    const now = new Date().toISOString();

    if (!canAccessGamificationProfile(req.profile, profileIdNum)) {
      return denyGamificationAccess(res);
    }

    // Get active (non-expired, non-completed) countdown challenge
    const active: any = db.prepare(`
      SELECT * FROM countdown_challenges
      WHERE profile_id = ? AND completed = 0 AND expires_at > ?
      ORDER BY created_at DESC LIMIT 1
    `).get(profileId, now);

    // Get completed countdown challenges count
    const stats: any = db.prepare(`
      SELECT
        COUNT(*) as total_completed,
        SUM(bonus_points_awarded) as total_bonus_earned
      FROM countdown_challenges
      WHERE profile_id = ? AND completed = 1
    `).get(profileId);

    res.json({
      active: active || null,
      stats: {
        totalCompleted: stats?.total_completed || 0,
        totalBonusEarned: stats?.total_bonus_earned || 0
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Start a new countdown challenge
router.post('/countdown/:profileId/start', (req: AuthRequest, res) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);
    const now = new Date();
    const nowISO = now.toISOString();

    if (!canAccessGamificationProfile(req.profile, profileIdNum)) {
      return denyGamificationAccess(res);
    }

    // Check if already has an active challenge
    const existing: any = db.prepare(`
      SELECT * FROM countdown_challenges
      WHERE profile_id = ? AND completed = 0 AND expires_at > ?
    `).get(profileId, nowISO);

    if (existing) {
      return res.status(400).json({ error: 'Already have an active countdown challenge', active: existing });
    }

    // Pick a random template
    const template = COUNTDOWN_TEMPLATES[Math.floor(Math.random() * COUNTDOWN_TEMPLATES.length)];

    // Calculate expiry time
    const expiresAt = new Date(now.getTime() + template.duration * 60 * 1000);

    const result = db.prepare(`
      INSERT INTO countdown_challenges (profile_id, title, description, target_tasks, duration_minutes, bonus_multiplier, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      profileId,
      `⏱️ ${template.duration / 60 >= 1 ? `${Math.floor(template.duration / 60)}h` : ''}${template.duration % 60 > 0 ? `${template.duration % 60}m` : ''} Challenge!`,
      template.description,
      template.target,
      template.duration,
      template.multiplier,
      expiresAt.toISOString()
    );

    const challenge = db.prepare('SELECT * FROM countdown_challenges WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ challenge, message: 'Countdown challenge started!' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update countdown challenge progress (called when task is completed)
// FIX: Now accumulates ALL points earned during the challenge and applies multiplier to the total
export function updateCountdownProgress(profileId: number, pointsEarned: number): { bonusPoints: number; challengeCompleted: boolean; accumulatedPoints: number } | null {
  const now = new Date().toISOString();

  // Get active countdown challenge
  const active: any = db.prepare(`
    SELECT * FROM countdown_challenges
    WHERE profile_id = ? AND completed = 0 AND expires_at > ?
    ORDER BY created_at DESC LIMIT 1
  `).get(profileId, now);

  if (!active) {
    return null;
  }

  const newCompletedTasks = active.completed_tasks + 1;
  // Accumulate points earned during the challenge (new column: accumulated_points)
  const newAccumulatedPoints = (active.accumulated_points || 0) + pointsEarned;
  const isComplete = newCompletedTasks >= active.target_tasks;

  if (isComplete) {
    // Calculate bonus points based on ALL accumulated points, not just the final task
    // This fixes the misleading multiplier - now all tasks contribute to the bonus
    const bonusPoints = Math.round(newAccumulatedPoints * (active.bonus_multiplier - 1));

    db.prepare(`
      UPDATE countdown_challenges
      SET completed_tasks = ?, accumulated_points = ?, completed = 1, completed_at = CURRENT_TIMESTAMP, bonus_points_awarded = ?
      WHERE id = ?
    `).run(newCompletedTasks, newAccumulatedPoints, bonusPoints, active.id);

    // Award bonus points using centralized system
    const awardResult = awardPoints({
      profileId,
      basePoints: bonusPoints,
      source: 'challenge',
      applyMultiplier: false,
      enforceRateLimit: false
    });

    // Update bonusPoints to reflect any capping
    const actualBonusPoints = awardResult.awarded;

    // Check for hidden achievement
    const countdownCount: any = db.prepare(`
      SELECT COUNT(*) as count FROM countdown_challenges WHERE profile_id = ? AND completed = 1
    `).get(profileId);

    if (countdownCount?.count >= 5) {
      checkHiddenAchievement(profileId, 'countdown_completed', countdownCount.count);
    }

    return { bonusPoints, challengeCompleted: true, accumulatedPoints: newAccumulatedPoints };
  } else {
    // Update both completed tasks AND accumulated points
    db.prepare(`
      UPDATE countdown_challenges SET completed_tasks = ?, accumulated_points = ? WHERE id = ?
    `).run(newCompletedTasks, newAccumulatedPoints, active.id);

    return { bonusPoints: 0, challengeCompleted: false, accumulatedPoints: newAccumulatedPoints };
  }
}

// ==================== LUCKY SPIN WHEEL ====================

const SPIN_WHEEL_PRIZES = [
  { type: 'points', value: 10, description: '10 Bonus Points', weight: 25, color: '#22c55e' },
  { type: 'points', value: 25, description: '25 Bonus Points', weight: 20, color: '#3b82f6' },
  { type: 'points', value: 50, description: '50 Bonus Points', weight: 15, color: '#8b5cf6' },
  { type: 'points', value: 100, description: '100 Bonus Points!', weight: 8, color: '#f59e0b' },
  { type: 'stars', value: 2, description: '2 Bonus Stars', weight: 15, color: '#ec4899' },
  { type: 'stars', value: 5, description: '5 Bonus Stars!', weight: 8, color: '#ef4444' },
  { type: 'multiplier', value: 2, description: 'Next task 2x points!', weight: 6, color: '#06b6d4' },
  { type: 'jackpot', value: 200, description: '🎰 JACKPOT! 200 Points!', weight: 3, color: '#fbbf24' }
];

// Get spin wheel status for a profile
router.get('/spin-wheel/:profileId', (req: AuthRequest, res) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);

    if (!canAccessGamificationProfile(req.profile, profileIdNum)) {
      return denyGamificationAccess(res);
    }

    // Get or create spin wheel progress
    let progress: any = db.prepare(`
      SELECT * FROM spin_wheel_progress WHERE profile_id = ?
    `).get(profileId);

    if (!progress) {
      db.prepare(`
        INSERT INTO spin_wheel_progress (profile_id, tasks_since_last_spin, tasks_required_for_spin)
        VALUES (?, 0, 5)
      `).run(profileId);
      progress = db.prepare(`SELECT * FROM spin_wheel_progress WHERE profile_id = ?`).get(profileId);
    }

    // Get recent spin history
    const history = db.prepare(`
      SELECT * FROM spin_wheel_history
      WHERE profile_id = ?
      ORDER BY spun_at DESC LIMIT 5
    `).all(profileId);

    const canSpin = progress.tasks_since_last_spin >= progress.tasks_required_for_spin;

    res.json({
      canSpin,
      tasksUntilSpin: Math.max(0, progress.tasks_required_for_spin - progress.tasks_since_last_spin),
      tasksSinceLastSpin: progress.tasks_since_last_spin,
      tasksRequired: progress.tasks_required_for_spin,
      totalSpins: progress.total_spins,
      recentHistory: history,
      prizes: SPIN_WHEEL_PRIZES.map(p => ({ type: p.type, description: p.description, color: p.color }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Spin the wheel
router.post('/spin-wheel/:profileId/spin', (req: AuthRequest, res) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId);

    if (!canAccessGamificationProfile(req.profile, profileIdNum)) {
      return denyGamificationAccess(res);
    }

    // ===== ECONOMY CHECK: Is spin wheel enabled? =====
    if (!isSpinWheelEnabled(profileIdNum)) {
      return res.status(400).json({
        error: 'Spin wheel is currently disabled',
        code: 'FEATURE_DISABLED'
      });
    }

    // ===== RATE LIMIT CHECK =====
    const rateCheck = checkRateLimit(profileIdNum, 'spin');
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Please wait ${rateCheck.waitSeconds} seconds before spinning again`,
        code: 'RATE_LIMITED',
        waitSeconds: rateCheck.waitSeconds
      });
    }

    // Get progress
    const progress: any = db.prepare(`
      SELECT * FROM spin_wheel_progress WHERE profile_id = ?
    `).get(profileId);

    if (!progress) {
      return res.status(400).json({ error: 'No spin progress found' });
    }

    if (progress.tasks_since_last_spin < progress.tasks_required_for_spin) {
      return res.status(400).json({
        error: 'Not enough tasks completed',
        tasksNeeded: progress.tasks_required_for_spin - progress.tasks_since_last_spin
      });
    }

    // ===== DAILY CAP CHECK =====
    // FIX: Check if user can earn at least 1 point - if completely capped, don't consume the spin
    // This prevents users from "wasting" a spin when they'd get 0 points
    const capCheck = canEarnPoints(profileIdNum, 1);
    if (!capCheck.allowed) {
      // Completely capped - don't consume the spin, let them try tomorrow
      return res.status(400).json({
        error: 'You have reached your daily earning limit. Save your spin for tomorrow when you can earn points again!',
        code: 'EARNING_CAP_REACHED',
        spinPreserved: true // Let the client know the spin wasn't consumed
      });
    }

    // Weighted random selection
    const totalWeight = SPIN_WHEEL_PRIZES.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedPrize = SPIN_WHEEL_PRIZES[0];
    let prizeIndex = 0;

    for (let i = 0; i < SPIN_WHEEL_PRIZES.length; i++) {
      random -= SPIN_WHEEL_PRIZES[i].weight;
      if (random <= 0) {
        selectedPrize = SPIN_WHEEL_PRIZES[i];
        prizeIndex = i;
        break;
      }
    }

    // Update rate limit tracker
    updateRateLimit(profileIdNum, 'spin');

    // Log the spin
    db.prepare(`
      INSERT INTO spin_wheel_history (profile_id, reward_type, reward_value, reward_description)
      VALUES (?, ?, ?, ?)
    `).run(profileId, selectedPrize.type, selectedPrize.value, selectedPrize.description);

    // Reset progress and increment total spins
    db.prepare(`
      UPDATE spin_wheel_progress
      SET tasks_since_last_spin = 0, total_spins = total_spins + 1, last_spin_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE profile_id = ?
    `).run(profileId);

    // Award the prize (with economy caps)
    const currentProgress: any = db.prepare(`
      SELECT * FROM progress WHERE profile_id = ? ORDER BY logged_at DESC LIMIT 1
    `).get(profileId);

    let pointsAwarded = 0;
    let starsAwarded = 0;

    if (selectedPrize.type === 'points' || selectedPrize.type === 'jackpot') {
      // Award points using centralized system (handles capping)
      const awardResult = awardPoints({
        profileId: profileIdNum,
        basePoints: selectedPrize.value,
        source: 'spin_wheel',
        applyMultiplier: false,
        enforceRateLimit: false,
        actionType: 'spin'
      });
      pointsAwarded = awardResult.awarded;
    } else if (selectedPrize.type === 'stars') {
      // Award stars using centralized system
      const awardResult = awardPoints({
        profileId: profileIdNum,
        basePoints: 0,
        stars: selectedPrize.value,
        source: 'spin_wheel',
        applyMultiplier: false,
        enforceRateLimit: false,
        actionType: 'spin'
      });
      starsAwarded = selectedPrize.value;
    }
    // multiplier type is stored and applied on next task completion

    // Store multiplier as a power-up if won
    if (selectedPrize.type === 'multiplier') {
      const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      db.prepare(`
        INSERT INTO power_ups (profile_id, power_up_type, quantity, expires_at)
        VALUES (?, 'spin_multiplier', ?, ?)
      `).run(profileId, selectedPrize.value, expiry.toISOString());
    }

    // Check for jackpot hidden achievement
    if (selectedPrize.type === 'jackpot') {
      checkHiddenAchievement(parseInt(profileId), 'jackpot_win', 1);
    }

    res.json({
      success: true,
      prize: {
        ...selectedPrize,
        index: prizeIndex
      },
      pointsAwarded,
      starsAwarded,
      message: `You won: ${selectedPrize.description}`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Increment spin wheel progress (called when task is completed)
export function incrementSpinProgress(profileId: number): boolean {
  // Get or create progress
  let progress: any = db.prepare(`
    SELECT * FROM spin_wheel_progress WHERE profile_id = ?
  `).get(profileId);

  if (!progress) {
    db.prepare(`
      INSERT INTO spin_wheel_progress (profile_id, tasks_since_last_spin, tasks_required_for_spin)
      VALUES (?, 1, 5)
    `).run(profileId);
    return false;
  }

  const newCount = progress.tasks_since_last_spin + 1;
  db.prepare(`
    UPDATE spin_wheel_progress SET tasks_since_last_spin = ?, updated_at = CURRENT_TIMESTAMP WHERE profile_id = ?
  `).run(newCount, profileId);

  return newCount >= progress.tasks_required_for_spin;
}

// ==================== HIDDEN ACHIEVEMENTS ====================

// Get achievements for a profile (with hidden support)
router.get('/achievements-with-hidden/:profileId', (req: AuthRequest, res) => {
  try {
    const { profileId } = req.params;
    const profileIdNum = parseInt(profileId, 10);

    if (!canAccessGamificationProfile(req.profile, profileIdNum)) {
      return denyGamificationAccess(res);
    }

    // Get all non-hidden achievements
    const visible = db.prepare(`
      SELECT a.*,
        CASE WHEN pa.id IS NOT NULL THEN 1 ELSE 0 END as earned,
        pa.earned_at
      FROM achievements a
      LEFT JOIN profile_achievements pa ON a.id = pa.achievement_id AND pa.profile_id = ?
      WHERE a.is_hidden = 0 OR a.is_hidden IS NULL
      ORDER BY a.requirement_value ASC
    `).all(profileId);

    // Get earned hidden achievements (only show if earned)
    const earnedHidden = db.prepare(`
      SELECT a.*, 1 as earned, pa.earned_at
      FROM achievements a
      INNER JOIN profile_achievements pa ON a.id = pa.achievement_id
      WHERE pa.profile_id = ? AND a.is_hidden = 1
      ORDER BY pa.earned_at DESC
    `).all(profileId);

    // Count total hidden achievements
    const hiddenCount: any = db.prepare(`
      SELECT COUNT(*) as total FROM achievements WHERE is_hidden = 1
    `).get();

    res.json({
      visible,
      earnedHidden,
      hiddenStats: {
        totalHidden: hiddenCount?.total || 0,
        earnedHidden: earnedHidden.length,
        remaining: (hiddenCount?.total || 0) - earnedHidden.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check and award hidden achievements
export function checkHiddenAchievement(profileId: number, achievementType: string, value: number): { achieved: boolean; achievement: any } | null {
  // Find matching hidden achievement
  const achievement: any = db.prepare(`
    SELECT * FROM achievements
    WHERE requirement_type = ? AND requirement_value <= ? AND is_hidden = 1
    AND id NOT IN (SELECT achievement_id FROM profile_achievements WHERE profile_id = ?)
  `).get(achievementType, value, profileId);

  if (!achievement) {
    return null;
  }

  try {
    // Award the achievement
    db.prepare(`
      INSERT INTO profile_achievements (profile_id, achievement_id)
      VALUES (?, ?)
    `).run(profileId, achievement.id);

    // Award bonus points using centralized system
    if (achievement.points_reward > 0) {
      awardPoints({
        profileId,
        basePoints: achievement.points_reward,
        source: 'achievement',
        applyMultiplier: false,
        enforceRateLimit: false
      });
    }

    console.log(`[Hidden Achievement] ${profileId} unlocked: ${achievement.name}`);
    return { achieved: true, achievement };
  } catch (e) {
    // Already earned
    return null;
  }
}

// Check various hidden achievements on task completion
export function checkHiddenAchievementsOnTaskComplete(profileId: number, taskCompletedAt: Date) {
  const hour = taskCompletedAt.getHours();
  const dayOfWeek = taskCompletedAt.getDay(); // 0 = Sunday, 6 = Saturday

  // Early Bird Master - tasks before 8 AM
  if (hour < 8) {
    const earlyTasks: any = db.prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE profile_id = ? AND completed = 1 AND TIME(completed_at) < '08:00:00'
    `).get(profileId);
    if (earlyTasks?.count >= 5) {
      checkHiddenAchievement(profileId, 'early_tasks', earlyTasks.count);
    }
  }

  // Weekend Warrior - tasks on weekends
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    const weekendTasks: any = db.prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE profile_id = ? AND completed = 1
      AND (strftime('%w', completed_at) = '0' OR strftime('%w', completed_at) = '6')
    `).get(profileId);
    if (weekendTasks?.count >= 10) {
      checkHiddenAchievement(profileId, 'weekend_tasks', weekendTasks.count);
    }
  }

  // Speed Demon - 3 tasks in 30 minutes
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const speedTasks: any = db.prepare(`
    SELECT COUNT(*) as count FROM tasks
    WHERE profile_id = ? AND completed = 1 AND completed_at >= ?
  `).get(profileId, thirtyMinsAgo);
  if (speedTasks?.count >= 3) {
    checkHiddenAchievement(profileId, 'speed_tasks', speedTasks.count);
  }
}

// ==================== AI USAGE LIMITS ====================

// Get AI usage limits and stats for a family (by parent ID)
router.get('/ai-limits/:parentId', (req, res) => {
  try {
    const { parentId } = req.params;

    const stats = getUsageStats(parseInt(parentId));

    res.json({
      limits: stats.limits,
      today: stats.today,
      month: stats.month
    });
  } catch (error: any) {
    console.error('[AI Limits] Get error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update AI generation limits for a family
router.put('/ai-limits/:parentId', (req, res) => {
  try {
    const { parentId } = req.params;
    const updates = req.body;

    // Validate the caller is the parent or admin
    const callerProfile: any = db.prepare('SELECT type FROM profiles WHERE id = ?').get((req as any).user?.id);
    if (!callerProfile || (callerProfile.type !== 'admin' && callerProfile.type !== 'parent')) {
      return res.status(403).json({ error: 'Only parents can manage AI limits' });
    }

    const updatedLimits = updateAiLimits(parseInt(parentId), {
      daily_book_limit: updates.dailyBookLimit,
      daily_quiz_limit: updates.dailyQuizLimit,
      daily_task_limit: updates.dailyTaskLimit,
      monthly_cost_limit: updates.monthlyCostLimit,
      require_approval: updates.requireApproval,
      enabled: updates.enabled
    });

    res.json({
      message: 'AI limits updated',
      limits: updatedLimits
    });
  } catch (error: any) {
    console.error('[AI Limits] Update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get AI usage history for a family
router.get('/ai-usage/:parentId/history', (req, res) => {
  try {
    const { parentId } = req.params;
    const { days = 30, featureType } = req.query;

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days as string));

    let query = `
      SELECT
        date(created_at) as date,
        feature_type,
        COUNT(*) as count,
        SUM(estimated_cost) as total_cost,
        SUM(images_generated) as total_images
      FROM ai_usage_logs
      WHERE parent_id = ? AND created_at >= ?
    `;
    const params: any[] = [parentId, daysAgo.toISOString()];

    if (featureType) {
      query += ' AND feature_type = ?';
      params.push(featureType);
    }

    query += ' GROUP BY date(created_at), feature_type ORDER BY date DESC';

    const history = db.prepare(query).all(...params);

    res.json(history);
  } catch (error: any) {
    console.error('[AI Usage] History error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
