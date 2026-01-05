import express from 'express';
import axios from 'axios';
import db from '../database/init';
import { authenticate, requireRole } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

// Helper: Get Grok API key from env or settings table
function getGrokApiKey(): string | null {
  let apiKey = process.env.GROK_API_KEY;

  if (!apiKey || apiKey === 'your_grok_api_key_here' || apiKey.trim() === '') {
    try {
      const setting: any = db.prepare('SELECT value FROM settings WHERE key = ?').get('grok_api_key');
      if (setting && setting.value) {
        apiKey = setting.value;
      }
    } catch (error) {
      console.error('Failed to read grok_api_key from settings:', error);
    }
  }

  return apiKey && apiKey !== 'your_grok_api_key_here' && apiKey.trim() !== '' ? apiKey : null;
}

// Helper: Check if Grok API is available
function isGrokAvailable(): boolean {
  return !!getGrokApiKey();
}

// ==================== BEHAVIOR ANALYSIS ====================

// Analyze a child's behavior patterns (unrestricted - looks at everything)
router.get('/analyze/:profileId', async (req, res) => {
  try {
    const { profileId } = req.params;

    // Get comprehensive behavior data
    const behaviorData = collectBehaviorData(parseInt(profileId));

    // Store insights
    db.prepare(`
      INSERT OR REPLACE INTO behavior_insights (profile_id, insights_json, last_analyzed)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(profileId, JSON.stringify(behaviorData));

    res.json(behaviorData);
  } catch (error: any) {
    console.error('Behavior analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Collect all behavior data for a profile
function collectBehaviorData(profileId: number) {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  // Task patterns
  const allTasks: any[] = db.prepare(`
    SELECT * FROM tasks WHERE profile_id = ? ORDER BY created_at DESC
  `).all(profileId);

  const completedTasks: any[] = db.prepare(`
    SELECT * FROM tasks WHERE profile_id = ? AND completed = 1 ORDER BY completed_at DESC
  `).all(profileId);

  const recentCompletedTasks: any[] = db.prepare(`
    SELECT * FROM tasks WHERE profile_id = ? AND completed = 1 AND DATE(completed_at) >= DATE(?)
    ORDER BY completed_at DESC
  `).all(profileId, weekAgo);

  const pendingTasks: any[] = db.prepare(`
    SELECT * FROM tasks WHERE profile_id = ? AND completed = 0 ORDER BY created_at DESC
  `).all(profileId);

  // Category analysis
  const categoryStats: any[] = db.prepare(`
    SELECT
      category,
      COUNT(*) as total,
      SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
      AVG(CASE WHEN completed = 1 THEN points ELSE NULL END) as avg_points
    FROM tasks WHERE profile_id = ?
    GROUP BY category
  `).all(profileId);

  // Time patterns - when do they complete tasks?
  const hourlyPattern: any[] = db.prepare(`
    SELECT
      strftime('%H', completed_at) as hour,
      COUNT(*) as count
    FROM tasks
    WHERE profile_id = ? AND completed = 1 AND completed_at IS NOT NULL
    GROUP BY strftime('%H', completed_at)
    ORDER BY count DESC
  `).all(profileId);

  // Day of week patterns
  const weekdayPattern: any[] = db.prepare(`
    SELECT
      strftime('%w', completed_at) as weekday,
      COUNT(*) as count
    FROM tasks
    WHERE profile_id = ? AND completed = 1 AND completed_at IS NOT NULL
    GROUP BY strftime('%w', completed_at)
  `).all(profileId);

  // Streak data
  const streaks: any[] = db.prepare(`
    SELECT * FROM streaks WHERE profile_id = ?
  `).all(profileId);

  // Goals data
  const goals: any[] = db.prepare(`
    SELECT * FROM monthly_goals WHERE profile_id = ? ORDER BY created_at DESC
  `).all(profileId);

  const achievedGoals: any[] = db.prepare(`
    SELECT * FROM monthly_goals WHERE profile_id = ? AND achieved = 1
  `).all(profileId);

  // Progress/Points data
  const progress: any = db.prepare(`
    SELECT * FROM progress WHERE profile_id = ? ORDER BY logged_at DESC LIMIT 1
  `).get(profileId);

  const weeklyPoints: any = db.prepare(`
    SELECT SUM(points_earned) as total FROM progress
    WHERE profile_id = ? AND DATE(logged_at) >= DATE(?)
  `).get(profileId, weekAgo);

  // Water intake patterns
  const waterData: any[] = db.prepare(`
    SELECT DATE(logged_at) as date, SUM(amount_ml) as total
    FROM water_intake WHERE profile_id = ? AND DATE(logged_at) >= DATE(?)
    GROUP BY DATE(logged_at)
  `).all(profileId, weekAgo);

  // Challenge completion rate
  const challengeStats: any = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed
    FROM daily_challenges
    WHERE profile_id = ? AND DATE(created_at) >= DATE(?)
  `).get(profileId, weekAgo);

  // Achievements earned
  const achievements: any[] = db.prepare(`
    SELECT a.*, pa.earned_at FROM achievements a
    INNER JOIN profile_achievements pa ON a.id = pa.achievement_id
    WHERE pa.profile_id = ?
  `).all(profileId);

  // Login bonus history
  const loginHistory: any[] = db.prepare(`
    SELECT * FROM login_bonuses WHERE profile_id = ? ORDER BY login_date DESC LIMIT 14
  `).all(profileId);

  // Find patterns
  const avoidedCategories = categoryStats
    .filter(c => c.total > 0 && (c.completed / c.total) < 0.3)
    .map(c => c.category);

  const lovedCategories = categoryStats
    .filter(c => c.total > 2 && (c.completed / c.total) > 0.7)
    .map(c => c.category);

  const mostActiveHour = hourlyPattern[0]?.hour || null;
  const mostActiveDay = weekdayPattern.sort((a, b) => b.count - a.count)[0]?.weekday || null;

  // Calculate velocity (tasks per day)
  const daysActive = new Set(completedTasks.map(t => t.completed_at?.split('T')[0])).size;
  const taskVelocity = daysActive > 0 ? completedTasks.length / daysActive : 0;

  // Streak status
  const taskStreak = streaks.find(s => s.streak_type === 'tasks');
  const waterStreak = streaks.find(s => s.streak_type === 'water');

  return {
    profile_id: profileId,
    analyzed_at: new Date().toISOString(),

    // Summary stats
    summary: {
      total_tasks: allTasks.length,
      completed_tasks: completedTasks.length,
      pending_tasks: pendingTasks.length,
      completion_rate: allTasks.length > 0 ? (completedTasks.length / allTasks.length * 100).toFixed(1) : 0,
      total_points: progress?.total_points || 0,
      current_level: progress?.level || 1,
      weekly_points: weeklyPoints?.total || 0,
      task_velocity: taskVelocity.toFixed(2),
      achievements_earned: achievements.length
    },

    // Behavioral patterns
    patterns: {
      avoided_categories: avoidedCategories,
      loved_categories: lovedCategories,
      most_active_hour: mostActiveHour,
      most_active_day: mostActiveDay,
      avg_tasks_per_day: taskVelocity.toFixed(2),
      prefers_morning: mostActiveHour ? parseInt(mostActiveHour) < 12 : null,
      prefers_weekends: mostActiveDay ? ['0', '6'].includes(mostActiveDay) : null
    },

    // Streaks
    streaks: {
      task_current: taskStreak?.current_streak || 0,
      task_longest: taskStreak?.longest_streak || 0,
      water_current: waterStreak?.current_streak || 0,
      water_longest: waterStreak?.longest_streak || 0,
      at_risk: taskStreak?.current_streak > 0 && taskStreak?.last_activity_date !== today
    },

    // Goals
    goals: {
      total: goals.length,
      achieved: achievedGoals.length,
      active: goals.filter(g => !g.achieved && g.parent_approved).length,
      pending_approval: goals.filter(g => !g.parent_approved).length
    },

    // Challenges
    challenges: {
      weekly_total: challengeStats?.total || 0,
      weekly_completed: challengeStats?.completed || 0,
      completion_rate: challengeStats?.total > 0
        ? ((challengeStats.completed / challengeStats.total) * 100).toFixed(1)
        : 0
    },

    // Water
    water: {
      days_logged: waterData.length,
      avg_daily_ml: waterData.length > 0
        ? Math.round(waterData.reduce((sum, d) => sum + d.total, 0) / waterData.length)
        : 0,
      streak: waterStreak?.current_streak || 0
    },

    // Login patterns
    login: {
      consecutive_days: loginHistory[0]?.consecutive_days || 0,
      total_logins: loginHistory.length
    },

    // Category breakdown
    categories: categoryStats,

    // Recent activity (for AI context)
    recent_completed: recentCompletedTasks.slice(0, 10).map(t => ({
      title: t.title,
      category: t.category,
      points: t.points,
      completed_at: t.completed_at
    })),

    recent_pending: pendingTasks.slice(0, 10).map(t => ({
      title: t.title,
      category: t.category,
      due_date: t.due_date,
      days_pending: t.created_at
        ? Math.floor((Date.now() - new Date(t.created_at).getTime()) / 86400000)
        : 0
    }))
  };
}

// ==================== AI CHALLENGE GENERATION ====================

// Generate personalized challenges using AI (unrestricted)
router.post('/generate/:profileId', requireRole(['admin', 'parent']), async (req, res) => {
  try {
    const { profileId } = req.params;
    const { count = 3 } = req.body;

    console.log(`[AI Gamification] Generating ${count} challenges for profile ${profileId}`);

    // Get behavior data
    const behaviorData = collectBehaviorData(parseInt(profileId));

    // Get profile info
    const profile: any = db.prepare(`
      SELECT p.*, parent.name as parent_name
      FROM profiles p
      LEFT JOIN profiles parent ON p.parent_id = parent.id
      WHERE p.id = ?
    `).get(profileId);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Get parent focus areas
    const focusAreas: any[] = db.prepare(`
      SELECT * FROM parent_focus_areas WHERE profile_id = ? ORDER BY priority DESC
    `).all(profileId);

    // Build AI prompt
    const prompt = buildChallengePrompt(profile, behaviorData, focusAreas, count);

    // Check if Grok API is available
    const apiKey = getGrokApiKey();
    if (!apiKey) {
      return res.status(503).json({
        error: 'AI service not configured. Please configure the Grok API key.'
      });
    }

    // Call Grok AI API
    const response = await axios.post(
      GROK_API_URL,
      {
        model: 'grok-2-latest',
        messages: [
          { role: 'system', content: 'You are a helpful AI assistant that creates personalized gamification challenges for children. Always respond with valid JSON arrays as specified.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    // Parse AI response
    const aiContent = response.data.choices?.[0]?.message?.content;
    if (!aiContent) {
      throw new Error('No response from AI');
    }

    let suggestions;
    try {
      // Extract JSON from response
      const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON array found in response');
      }
    } catch (e) {
      console.error('Failed to parse AI response:', aiContent);
      throw new Error('Failed to parse AI suggestions');
    }

    // Store suggestions in database
    const insertStmt = db.prepare(`
      INSERT INTO ai_suggestions (
        profile_id, suggestion_type, title, description, reasoning,
        difficulty, points_reward, bonus_multiplier, target_value, duration_days, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `);

    const insertedIds: number[] = [];
    for (const suggestion of suggestions) {
      const result = insertStmt.run(
        profileId,
        suggestion.type || 'challenge',
        suggestion.title,
        suggestion.description,
        suggestion.reasoning || '',
        suggestion.difficulty || 'medium',
        suggestion.points_reward || 50,
        suggestion.bonus_multiplier || 1.0,
        suggestion.target_value || 1,
        suggestion.duration_days || 7
      );
      insertedIds.push(result.lastInsertRowid as number);
    }

    // Return created suggestions
    const createdSuggestions = db.prepare(`
      SELECT * FROM ai_suggestions WHERE id IN (${insertedIds.join(',')})
    `).all();

    res.json({
      suggestions: createdSuggestions,
      behavior_summary: behaviorData.summary,
      patterns: behaviorData.patterns
    });

  } catch (error: any) {
    console.error('[AI Gamification] Generation error:', error.message);
    if (error.response?.data) {
      console.error('[AI Gamification] API response:', error.response.data);
    }
    res.status(500).json({ error: error.message || 'Failed to generate challenges' });
  }
});

function buildChallengePrompt(
  profile: any,
  behavior: any,
  focusAreas: any[],
  count: number
): string {
  const focusText = focusAreas.length > 0
    ? `Parent focus areas: ${focusAreas.map(f => f.focus_type + (f.notes ? ` (${f.notes})` : '')).join(', ')}`
    : 'No specific focus areas set by parent.';

  return `You are an AI assistant helping create personalized challenges for a child named ${profile.name}.

CHILD PROFILE:
- Name: ${profile.name}
- Current Level: ${behavior.summary.current_level}
- Total Points: ${behavior.summary.total_points}
- Tasks Completed: ${behavior.summary.completed_tasks}

BEHAVIOR ANALYSIS:
- Completion Rate: ${behavior.summary.completion_rate}%
- Avg Tasks/Day: ${behavior.patterns.avg_tasks_per_day}
- Task Streak: ${behavior.streaks.task_current} days (longest: ${behavior.streaks.task_longest})
- Categories they AVOID: ${behavior.patterns.avoided_categories.length > 0 ? behavior.patterns.avoided_categories.join(', ') : 'None identified'}
- Categories they LOVE: ${behavior.patterns.loved_categories.length > 0 ? behavior.patterns.loved_categories.join(', ') : 'None identified'}
- Most Active Time: ${behavior.patterns.most_active_hour ? `${behavior.patterns.most_active_hour}:00` : 'Unknown'}
- Challenge Completion Rate: ${behavior.challenges.completion_rate}%
- Water Streak: ${behavior.streaks.water_current} days

RECENT COMPLETED TASKS:
${behavior.recent_completed.map((t: any) => `- ${t.title} (${t.category}, ${t.points} pts)`).join('\n') || 'No recent tasks'}

PENDING TASKS:
${behavior.recent_pending.map((t: any) => `- ${t.title} (${t.category}, pending ${t.days_pending} days)`).join('\n') || 'No pending tasks'}

${focusText}

YOUR TASK:
Create ${count} personalized challenges for this child. Be creative and specific based on their behavior patterns.

Guidelines:
1. If they AVOID certain categories, gently encourage those with bonus multipliers
2. If they have pending tasks for many days, create a challenge to clear them
3. If their streak is at risk, create a streak protection challenge
4. If they're very active, make challenges slightly harder
5. If they're struggling, make achievable quick wins
6. Consider their active times and preferences
7. Be encouraging and fun - this is for a kid!
8. You can suggest ANY type of challenge - not restricted to existing categories
9. Be specific and actionable - not generic

Return ONLY a JSON array with exactly ${count} objects in this format:
[
  {
    "type": "challenge" or "achievement",
    "title": "Fun catchy title with emoji",
    "description": "Clear description of what the child needs to do",
    "reasoning": "Why you suggested this based on their behavior",
    "difficulty": "easy", "medium", or "hard",
    "points_reward": number between 20-200,
    "bonus_multiplier": 1.0 to 3.0 (higher for avoided categories),
    "target_value": number (how many times to do something),
    "duration_days": 1-14 (how long they have)
  }
]`;
}

// ==================== PARENT APPROVAL ====================

// Get pending suggestions for parent review
router.get('/suggestions/pending/:parentId', (req, res) => {
  try {
    const { parentId } = req.params;

    // Get all kids for this parent
    const kids: any[] = db.prepare(`
      SELECT id, name FROM profiles WHERE parent_id = ?
    `).all(parentId);

    const kidIds = kids.map(k => k.id);
    if (kidIds.length === 0) {
      return res.json([]);
    }

    // Get pending suggestions for all kids
    const suggestions = db.prepare(`
      SELECT s.*, p.name as child_name
      FROM ai_suggestions s
      INNER JOIN profiles p ON s.profile_id = p.id
      WHERE s.profile_id IN (${kidIds.join(',')}) AND s.status = 'pending'
      ORDER BY s.created_at DESC
    `).all();

    res.json(suggestions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Approve a suggestion
router.post('/suggestions/:id/approve', (req, res) => {
  try {
    const { id } = req.params;
    const { parent_id, modifications } = req.body;

    const suggestion: any = db.prepare('SELECT * FROM ai_suggestions WHERE id = ?').get(id);
    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    // Update suggestion status
    db.prepare(`
      UPDATE ai_suggestions
      SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?
      WHERE id = ?
    `).run(parent_id, id);

    // Create the challenge
    const title = modifications?.title || suggestion.title;
    const description = modifications?.description || suggestion.description;
    const points = modifications?.points_reward || suggestion.points_reward;
    const duration = modifications?.duration_days || suggestion.duration_days;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + duration);

    const result = db.prepare(`
      INSERT INTO custom_challenges (
        profile_id, title, description, challenge_type, target_value,
        points_reward, bonus_multiplier, difficulty, is_ai_generated,
        ai_suggestion_id, created_by, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(
      suggestion.profile_id,
      title,
      description,
      suggestion.suggestion_type,
      suggestion.target_value,
      points,
      suggestion.bonus_multiplier,
      suggestion.difficulty,
      id,
      parent_id,
      expiresAt.toISOString()
    );

    const challenge = db.prepare('SELECT * FROM custom_challenges WHERE id = ?').get(result.lastInsertRowid);

    res.json({ message: 'Suggestion approved and challenge created', challenge });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reject a suggestion
router.post('/suggestions/:id/reject', (req, res) => {
  try {
    const { id } = req.params;
    const { parent_id, reason } = req.body;

    db.prepare(`
      UPDATE ai_suggestions
      SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP,
          reviewed_by = ?, parent_response = ?
      WHERE id = ?
    `).run(parent_id, reason || '', id);

    res.json({ message: 'Suggestion rejected' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CUSTOM CHALLENGES ====================

// Get active custom challenges for a profile
router.get('/challenges/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;

    const challenges = db.prepare(`
      SELECT * FROM custom_challenges
      WHERE profile_id = ? AND completed = 0
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      ORDER BY created_at DESC
    `).all(profileId);

    res.json(challenges);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a custom challenge (parent-created)
router.post('/challenges', (req, res) => {
  try {
    const {
      profile_id, title, description, target_value,
      points_reward, difficulty, duration_days, created_by
    } = req.body;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (duration_days || 7));

    const result = db.prepare(`
      INSERT INTO custom_challenges (
        profile_id, title, description, target_value,
        points_reward, difficulty, is_ai_generated, created_by, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      profile_id, title, description, target_value || 1,
      points_reward || 50, difficulty || 'medium', created_by,
      expiresAt.toISOString()
    );

    const challenge = db.prepare('SELECT * FROM custom_challenges WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(challenge);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update challenge progress
router.post('/challenges/:id/progress', (req, res) => {
  try {
    const { id } = req.params;
    const { increment = 1 } = req.body;

    const challenge: any = db.prepare('SELECT * FROM custom_challenges WHERE id = ?').get(id);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const newProgress = challenge.current_progress + increment;
    const completed = newProgress >= challenge.target_value;

    db.prepare(`
      UPDATE custom_challenges
      SET current_progress = ?, completed = ?, completed_at = ?
      WHERE id = ?
    `).run(newProgress, completed ? 1 : 0, completed ? new Date().toISOString() : null, id);

    // Award points if completed
    if (completed && !challenge.completed) {
      const totalReward = Math.round(challenge.points_reward * challenge.bonus_multiplier);

      const progress: any = db.prepare(`
        SELECT * FROM progress WHERE profile_id = ? ORDER BY logged_at DESC LIMIT 1
      `).get(challenge.profile_id);

      const newPoints = (progress?.total_points || 0) + totalReward;
      const newLevel = Math.floor(newPoints / 100) + 1;

      db.prepare(`
        INSERT INTO progress (profile_id, points_earned, stars_earned, level, total_points, total_stars)
        VALUES (?, ?, 1, ?, ?, ?)
      `).run(challenge.profile_id, totalReward, newLevel, newPoints, (progress?.total_stars || 0) + 1);
    }

    const updated = db.prepare('SELECT * FROM custom_challenges WHERE id = ?').get(id);
    res.json({ challenge: updated, just_completed: completed && !challenge.completed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== PARENT FOCUS AREAS ====================

// Get focus areas for a child
router.get('/focus/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;
    const focusAreas = db.prepare(`
      SELECT * FROM parent_focus_areas WHERE profile_id = ? ORDER BY priority DESC
    `).all(profileId);
    res.json(focusAreas);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Set focus areas for a child
router.post('/focus/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;
    const { focus_areas, created_by } = req.body;

    // Clear existing focus areas
    db.prepare('DELETE FROM parent_focus_areas WHERE profile_id = ?').run(profileId);

    // Insert new focus areas
    const insertStmt = db.prepare(`
      INSERT INTO parent_focus_areas (profile_id, focus_type, priority, notes, created_by)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < focus_areas.length; i++) {
      const area = focus_areas[i];
      insertStmt.run(profileId, area.type, focus_areas.length - i, area.notes || null, created_by);
    }

    const savedAreas = db.prepare(`
      SELECT * FROM parent_focus_areas WHERE profile_id = ? ORDER BY priority DESC
    `).all(profileId);

    res.json(savedAreas);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
