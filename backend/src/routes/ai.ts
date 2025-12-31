import express from 'express';
import axios from 'axios';
import db from '../database/init';

const router = express.Router();

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

// Helper: Get Grok API key from env or settings table
function getGrokApiKey(): string | null {
  // First check environment variable
  let apiKey = process.env.GROK_API_KEY;

  // If not in env, check settings table
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

// Helper: Get AI settings for profile
function getAISettings(profileId: number) {
  try {
    let settings: any = db.prepare(
      'SELECT * FROM ai_settings WHERE profile_id = ?'
    ).get(profileId);

    // Create default settings if none exist
    if (!settings) {
      console.log(`Creating default AI settings for profile ${profileId}`);
      db.prepare(`
        INSERT INTO ai_settings (
          profile_id,
          strict_mode,
          max_messages_per_day,
          content_filter_level,
          custom_instructions
        )
        VALUES (?, 1, 20, 'strict', '')
      `).run(profileId);

      settings = db.prepare(
        'SELECT * FROM ai_settings WHERE profile_id = ?'
      ).get(profileId);
    }

    // Ensure custom_instructions exists
    if (!settings.custom_instructions) {
      settings.custom_instructions = '';
    }

    return settings;
  } catch (error) {
    console.error(`Error getting AI settings for profile ${profileId}:`, error);
    // Return safe defaults if database fails
    return {
      profile_id: profileId,
      strict_mode: 1,
      max_messages_per_day: 20,
      content_filter_level: 'strict',
      custom_instructions: ''
    };
  }
}

// Helper: Get profile context (tasks, progress, diet, goals, notes)
function getProfileContext(profileId: number) {
  const profile: any = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId);

  // Get task stats
  const taskStats: any = db.prepare(`
    SELECT
      COUNT(*) as total_tasks,
      SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_tasks,
      SUM(CASE WHEN completed = 0 AND due_date < datetime('now') THEN 1 ELSE 0 END) as overdue_tasks
    FROM tasks
    WHERE profile_id = ?
  `).get(profileId);

  // Get recent/upcoming tasks (next 7 days, not completed)
  const recentTasks = db.prepare(`
    SELECT title, category, difficulty, due_date, points
    FROM tasks
    WHERE profile_id = ? AND completed = 0
    AND (due_date IS NULL OR due_date >= date('now'))
    ORDER BY due_date ASC
    LIMIT 5
  `).all(profileId);

  // Get progress
  const progress: any = db.prepare(`
    SELECT total_points, total_stars, level
    FROM progress
    WHERE profile_id = ?
    ORDER BY logged_at DESC
    LIMIT 1
  `).get(profileId);

  // Get monthly goal
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyGoal: any = db.prepare(`
    SELECT *
    FROM monthly_goals
    WHERE profile_id = ? AND month = ?
  `).get(profileId, currentMonth);

  // Get diet summary (today)
  const today = new Date().toISOString().split('T')[0];
  const dietSummary: any = db.prepare(`
    SELECT
      SUM(calories_consumed) as total_calories,
      SUM(protein_consumed) as total_protein
    FROM meal_logs
    WHERE profile_id = ? AND DATE(logged_at) = DATE(?)
  `).get(profileId, today);

  // Get recent notes (last 10)
  const recentNotes = db.prepare(`
    SELECT title, content, created_at
    FROM notes
    WHERE profile_id = ?
    ORDER BY created_at DESC
    LIMIT 10
  `).all(profileId);

  return {
    profile,
    taskStats: taskStats || { total_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    recentTasks: recentTasks || [],
    progress: progress || { total_points: 0, total_stars: 0, level: 1 },
    monthlyGoal,
    dietSummary: dietSummary || { total_calories: 0, total_protein: 0 },
    recentNotes: recentNotes || []
  };
}

// Helper: Generate fallback response (when no API key)
function generateFallbackResponse(message: string, profile: any, context: string): string {
  const lowerMessage = message.toLowerCase();

  // Greetings
  if (lowerMessage.match(/^(hi|hello|hey|hei)/)) {
    return `Hi ${profile.name}! 👋 I'm your AI assistant, but I'm currently in limited mode. To unlock my full potential, ask your parents to configure the AI API key in settings!`;
  }

  // Task-related
  if (lowerMessage.includes('task') || lowerMessage.includes('chore')) {
    return `Great question about tasks, ${profile.name}! In full mode, I can give you personalized task suggestions. For now, I recommend focusing on your pending tasks and working towards your monthly goal! 🎯`;
  }

  // Diet-related
  if (lowerMessage.includes('food') || lowerMessage.includes('meal') || lowerMessage.includes('eat')) {
    return `I'd love to help with meal suggestions! When the AI API is configured, I can provide personalized nutrition advice and meal ideas. For now, remember to eat balanced meals with protein, carbs, and healthy fats! 🥗`;
  }

  // Motivation
  if (lowerMessage.includes('help') || lowerMessage.includes('motivate')) {
    return `You're doing great, ${profile.name}! ${profile.type === 'child' ? 'Keep completing your tasks and earning points. Every small step counts!' : 'Keep supporting your family and managing tasks effectively!'} 🌟`;
  }

  // Default
  return `I received your message, ${profile.name}! To get full AI assistance with detailed answers and personalized advice, please ask your ${profile.type === 'child' ? 'parents' : 'administrator'} to configure the AI API key in settings. Until then, I'm here in limited mode! 🤖`;
}

// Chat with AI
router.post('/chat', async (req, res) => {
  try {
    const { profile_id, message, context = 'general' } = req.body;
    console.log(`[AI Chat] Request from profile ${profile_id}, context: ${context}`);

    if (!profile_id || !message) {
      console.error('[AI Chat] Missing required fields');
      return res.status(400).json({ error: 'profile_id and message are required' });
    }

    // Get profile context
    console.log(`[AI Chat] Getting profile context for ${profile_id}`);
    const profileContext = getProfileContext(profile_id);
    const profile = profileContext.profile;

    if (!profile) {
      console.error(`[AI Chat] Profile ${profile_id} not found`);
      return res.status(404).json({ error: 'Profile not found' });
    }

    console.log(`[AI Chat] Profile: ${profile.name} (${profile.type})`);


    // Get AI settings
    const aiSettings = getAISettings(profile_id);

    // Check daily message limit
    const today = new Date().toISOString().split('T')[0];
    const messageCount: any = db.prepare(`
      SELECT COUNT(*) as count
      FROM ai_conversations
      WHERE profile_id = ? AND DATE(created_at) = DATE(?)
    `).get(profile_id, today);

    if (messageCount.count >= aiSettings.max_messages_per_day) {
      return res.status(429).json({
        error: `Daily message limit reached (${aiSettings.max_messages_per_day} messages). Try again tomorrow!`
      });
    }

    let aiResponse: string;

    // Check if Grok API is available
    if (!isGrokAvailable()) {
      // Fallback mode
      aiResponse = generateFallbackResponse(message, profile, context);
    } else {
      // Build system prompt based on context, user type, and AI settings
      let systemPrompt = '';

      if (profile.type === 'child') {
        if (aiSettings.strict_mode) {
          systemPrompt = `You are a friendly, educational AI assistant for a ${profile.age}-year-old child named ${profile.name}.

STRICT GUIDELINES:
- Use age-appropriate language only
- Be positive, encouraging, and educational
- Never discuss inappropriate topics (violence, adult content, etc.)
- Focus on learning, creativity, and positive habits
- Encourage task completion and healthy choices
- If asked anything inappropriate, politely redirect to positive topics

Profile Context:
- Total tasks: ${profileContext.taskStats.total_tasks} (${profileContext.taskStats.completed_tasks} completed)
- Points: ${profileContext.progress.total_points} | Stars: ${profileContext.progress.total_stars} | Level: ${profileContext.progress.level}
${profileContext.monthlyGoal ? `- Monthly Goal: ${profileContext.monthlyGoal.goal_description} (${profileContext.monthlyGoal.goal_points} points target)` : ''}
- Today's calories: ${profileContext.dietSummary.total_calories || 0} kcal

${profileContext.recentTasks.length > 0 ? `Upcoming Tasks:
${profileContext.recentTasks.map((t: any) => `- ${t.title} (${t.category}, ${t.difficulty}, ${t.points} pts${t.due_date ? `, due: ${t.due_date}` : ''})`).join('\n')}` : ''}

${profileContext.recentNotes.length > 0 ? `Recent Notes:
${profileContext.recentNotes.slice(0, 5).map((n: any) => `- ${n.content.substring(0, 100)}${n.content.length > 100 ? '...' : ''}`).join('\n')}` : ''}`;
        } else {
          systemPrompt = `You are a friendly AI assistant helping ${profile.age}-year-old ${profile.name}.
Keep language age-appropriate and focus on being helpful and educational.

Profile Context:
- Points: ${profileContext.progress.total_points} | Level: ${profileContext.progress.level}
- Tasks: ${profileContext.taskStats.total_tasks} total, ${profileContext.taskStats.completed_tasks} completed

${profileContext.recentTasks.length > 0 ? `Upcoming Tasks: ${profileContext.recentTasks.map((t: any) => t.title).join(', ')}` : ''}`;
        }
      } else {
        systemPrompt = `You are a helpful AI assistant for family management, nutrition, and parenting.
Provide practical advice for ${profile.name}.

Family Context:
- Tasks managed: ${profileContext.taskStats.total_tasks}
- Today's calories logged: ${profileContext.dietSummary.total_calories || 0} kcal

${profileContext.recentNotes.length > 0 ? `Recent Notes:
${profileContext.recentNotes.slice(0, 5).map((n: any) => `- ${n.content.substring(0, 100)}${n.content.length > 100 ? '...' : ''}`).join('\n')}` : ''}`;
      }

      // Add custom instructions from parent (if any)
      if (aiSettings.custom_instructions && aiSettings.custom_instructions.trim()) {
        systemPrompt += `\n\n=== PARENT INSTRUCTIONS ===\n${aiSettings.custom_instructions}\n=== END PARENT INSTRUCTIONS ===`;
      }

      if (context === 'diet') {
        systemPrompt += `\n\nFocus on nutrition, meal planning, and healthy eating for a Norwegian family. Use Norwegian ingredients and food culture.`;
      } else if (context === 'tasks') {
        systemPrompt += `\n\nFocus on task management, productivity, and age-appropriate activities for children.`;
      }

      // Get recent conversation history
      const history = db.prepare(`
        SELECT user_message, ai_response FROM ai_conversations
        WHERE profile_id = ? AND context = ?
        ORDER BY created_at DESC
        LIMIT 5
      `).all(profile_id, context);

      // Build messages for Grok
      const messages: any[] = [
        { role: 'system', content: systemPrompt }
      ];

      // Add history (reverse for chronological order)
      history.reverse().forEach((h: any) => {
        messages.push(
          { role: 'user', content: h.user_message },
          { role: 'assistant', content: h.ai_response }
        );
      });

      // Add current message
      messages.push({ role: 'user', content: message });

      try {
        // Call Grok API
        const apiKey = getGrokApiKey();
        const response = await axios.post(
          GROK_API_URL,
          {
            model: 'grok-2-latest',  // Grok 2 latest (Grok 4.1 Fast)
            messages,
            temperature: 0.7,
            max_tokens: 500
          },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 15000
          }
        );

        aiResponse = response.data.choices[0]?.message?.content ||
          'Sorry, I could not generate a response.';
      } catch (apiError: any) {
        console.error('Grok API error:', apiError.response?.data || apiError.message);
        // Fallback to simple response on API error
        aiResponse = generateFallbackResponse(message, profile, context);
      }
    }

    // Save conversation
    console.log(`[AI Chat] Saving conversation for profile ${profile_id}`);
    try {
      db.prepare(`
        INSERT INTO ai_conversations (profile_id, context, user_message, ai_response)
        VALUES (?, ?, ?, ?)
      `).run(profile_id, context, message, aiResponse);
      console.log(`[AI Chat] Conversation saved successfully`);
    } catch (dbError: any) {
      console.error(`[AI Chat] Failed to save conversation:`, dbError);
      // Continue even if save fails
    }

    console.log(`[AI Chat] Sending response to client`);
    res.json({
      response: aiResponse,
      profile: { id: profile.id, name: profile.name, type: profile.type },
      usingFallback: !isGrokAvailable()
    });

  } catch (error: any) {
    console.error('[AI Chat] ERROR:', error);
    console.error('[AI Chat] Stack:', error.stack);
    res.status(500).json({
      error: 'Failed to process message',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get/Update AI settings for a profile
router.get('/settings/:profileId', (req, res) => {
  try {
    const settings = getAISettings(parseInt(req.params.profileId));
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/settings/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;
    const { strict_mode, max_messages_per_day, allowed_contexts, content_filter_level, custom_instructions } = req.body;

    const updates: string[] = [];
    const values: any[] = [];

    if (strict_mode !== undefined) {
      updates.push('strict_mode = ?');
      values.push(strict_mode ? 1 : 0);
    }
    if (max_messages_per_day !== undefined) {
      updates.push('max_messages_per_day = ?');
      values.push(max_messages_per_day);
    }
    if (allowed_contexts !== undefined) {
      updates.push('allowed_contexts = ?');
      values.push(JSON.stringify(allowed_contexts));
    }
    if (content_filter_level !== undefined) {
      updates.push('content_filter_level = ?');
      values.push(content_filter_level);
    }
    if (custom_instructions !== undefined) {
      updates.push('custom_instructions = ?');
      values.push(custom_instructions);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(profileId);

    db.prepare(`
      UPDATE ai_settings
      SET ${updates.join(', ')}
      WHERE profile_id = ?
    `).run(...values);

    const updated = getAISettings(parseInt(profileId));
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get conversation history
router.get('/conversations/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;
    const { context, limit = 50 } = req.query;

    let query = 'SELECT * FROM ai_conversations WHERE profile_id = ?';
    const params: any[] = [profileId];

    if (context) {
      query += ' AND context = ?';
      params.push(context);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const conversations = db.prepare(query).all(...params);
    res.json(conversations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Clear conversation history
router.delete('/conversations/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;
    const { context } = req.query;

    let query = 'DELETE FROM ai_conversations WHERE profile_id = ?';
    const params: any[] = [profileId];

    if (context) {
      query += ' AND context = ?';
      params.push(context);
    }

    const result = db.prepare(query).run(...params);

    res.json({
      message: 'Conversation history cleared',
      deletedCount: result.changes
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Check API status
router.get('/status', (req, res) => {
  res.json({
    apiConfigured: isGrokAvailable(),
    fallbackMode: !isGrokAvailable()
  });
});

export default router;
