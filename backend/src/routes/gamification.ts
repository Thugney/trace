import express from 'express';
import db from '../database/init';

const router = express.Router();

// ==================== WATER INTAKE ====================

// Log water intake
router.post('/water', (req, res) => {
  try {
    const { profile_id, amount_ml } = req.body;

    if (!profile_id || !amount_ml) {
      return res.status(400).json({ error: 'profile_id and amount_ml are required' });
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
router.get('/water/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;
    const { date } = req.query;

    const targetDate = date || new Date().toISOString().split('T')[0];

    const entries = db.prepare(`
      SELECT * FROM water_intake
      WHERE profile_id = ? AND DATE(logged_at) = DATE(?)
      ORDER BY logged_at DESC
    `).all(profileId, targetDate);

    const total: any = db.prepare(`
      SELECT SUM(amount_ml) as total
      FROM water_intake
      WHERE profile_id = ? AND DATE(logged_at) = DATE(?)
    `).get(profileId, targetDate);

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
router.delete('/water/:id', (req, res) => {
  try {
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
router.get('/streaks/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;

    const streaks = db.prepare(`
      SELECT * FROM streaks WHERE profile_id = ?
    `).all(profileId);

    // If no streaks exist, create default ones
    if (streaks.length === 0) {
      const types = ['tasks', 'water'];
      types.forEach(type => {
        db.prepare(`
          INSERT OR IGNORE INTO streaks (profile_id, streak_type, current_streak, longest_streak)
          VALUES (?, ?, 0, 0)
        `).run(profileId, type);
      });
      return res.json(db.prepare('SELECT * FROM streaks WHERE profile_id = ?').all(profileId));
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
router.get('/achievements/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;

    const earned = db.prepare(`
      SELECT a.*, pa.earned_at
      FROM achievements a
      INNER JOIN profile_achievements pa ON a.id = pa.achievement_id
      WHERE pa.profile_id = ?
      ORDER BY pa.earned_at DESC
    `).all(profileId);

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
router.get('/stats/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;

    // Get progress data
    const progress: any = db.prepare(`
      SELECT total_points, total_stars, level
      FROM progress
      WHERE profile_id = ?
      ORDER BY logged_at DESC LIMIT 1
    `).get(profileId);

    // Get completed tasks count
    const tasks: any = db.prepare(`
      SELECT COUNT(*) as completed
      FROM tasks
      WHERE profile_id = ? AND completed = 1
    `).get(profileId);

    // Get achieved goals count
    const goals: any = db.prepare(`
      SELECT COUNT(*) as achieved
      FROM monthly_goals
      WHERE profile_id = ? AND achieved = 1
    `).get(profileId);

    // Get streaks
    const streaks = db.prepare(`
      SELECT * FROM streaks WHERE profile_id = ?
    `).all(profileId);

    // Get earned achievements
    const achievements: any = db.prepare(`
      SELECT COUNT(*) as count
      FROM profile_achievements
      WHERE profile_id = ?
    `).get(profileId);

    // Get today's water intake
    const today = new Date().toISOString().split('T')[0];
    const water: any = db.prepare(`
      SELECT SUM(amount_ml) as total
      FROM water_intake
      WHERE profile_id = ? AND DATE(logged_at) = DATE(?)
    `).get(profileId, today);

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

  const streaks = db.prepare(`
    SELECT * FROM streaks WHERE profile_id = ?
  `).all(profileId);

  // Get all achievements not yet earned
  const unearnedAchievements: any[] = db.prepare(`
    SELECT a.* FROM achievements a
    WHERE a.id NOT IN (
      SELECT achievement_id FROM profile_achievements WHERE profile_id = ?
    )
  `).all(profileId);

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
    }

    if (earned) {
      try {
        db.prepare(`
          INSERT INTO profile_achievements (profile_id, achievement_id)
          VALUES (?, ?)
        `).run(profileId, achievement.id);

        // Award bonus points for achievement
        if (achievement.points_reward > 0) {
          const currentProgress: any = db.prepare(`
            SELECT * FROM progress WHERE profile_id = ? ORDER BY logged_at DESC LIMIT 1
          `).get(profileId);

          if (currentProgress) {
            const newPoints = currentProgress.total_points + achievement.points_reward;
            const newLevel = Math.floor(newPoints / 100) + 1;
            db.prepare(`
              INSERT INTO progress (profile_id, points_earned, stars_earned, level, total_points, total_stars)
              VALUES (?, ?, 0, ?, ?, ?)
            `).run(profileId, achievement.points_reward, newLevel, newPoints, currentProgress.total_stars);
          }
        }

        console.log(`[Gamification] ${profileId} earned achievement: ${achievement.name}`);
      } catch (e) {
        // Already earned, ignore
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

// Get daily challenges for a profile
router.get('/challenges/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;
    const today = new Date().toISOString().split('T')[0];

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

    // Award bonus points
    const currentProgress: any = db.prepare(`
      SELECT * FROM progress WHERE profile_id = ? ORDER BY logged_at DESC LIMIT 1
    `).get(challenge.profile_id);

    if (currentProgress) {
      const newPoints = currentProgress.total_points + challenge.bonus_points;
      const newLevel = Math.floor(newPoints / 100) + 1;
      db.prepare(`
        INSERT INTO progress (profile_id, points_earned, stars_earned, level, total_points, total_stars)
        VALUES (?, ?, 0, ?, ?, ?)
      `).run(challenge.profile_id, challenge.bonus_points, newLevel, newPoints, currentProgress.total_stars);
    }

    res.json({ message: 'Challenge completed!', bonusPoints: challenge.bonus_points });
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
router.get('/weekly-summary/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;

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

    // Points earned this week
    const pointsEarned: any = db.prepare(`
      SELECT SUM(points_earned) as total FROM progress
      WHERE profile_id = ? AND DATE(logged_at) BETWEEN DATE(?) AND DATE(?)
    `).get(profileId, weekStartStr, weekEndStr);

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

// Export helper to be used from tasks route
export function updateTaskStreak(profileId: number) {
  updateStreak(profileId, 'tasks');
  checkAchievements(profileId);
}

export default router;
