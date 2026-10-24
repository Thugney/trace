import express from 'express';
import axios from 'axios';
import db from '../database/init';
import { AuthRequest, authenticate, authenticateEventSource, requireRole, verifyParentChild, verifyOwnership } from '../middleware/auth';
import { requireFeature } from '../middleware/feature-access';

const router = express.Router();

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// AI Tool definitions for function calling
const AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'suggest_quiz_practice',
      description: 'Suggest a quiz category for the child to practice based on their performance. Use when discussing learning, school, or when the child needs encouragement in a weak area.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['math', 'science', 'language', 'history', 'geography', 'art', 'general'],
            description: 'The quiz category to suggest practicing'
          },
          reason: {
            type: 'string',
            description: 'A friendly, encouraging reason for the suggestion'
          },
          difficulty_hint: {
            type: 'string',
            enum: ['start_easy', 'keep_current', 'try_harder'],
            description: 'Suggestion for difficulty level based on past performance'
          }
        },
        required: ['category', 'reason']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'log_encouragement',
      description: 'Log a special encouragement moment when the child is struggling or needs motivation. This helps parents understand when their child needs support.',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'What the child was struggling with or needed help with'
          },
          encouragement_given: {
            type: 'string',
            description: 'Summary of the encouragement/support provided'
          },
          mood_indicator: {
            type: 'string',
            enum: ['happy', 'neutral', 'frustrated', 'curious', 'tired'],
            description: 'Perceived mood of the child during interaction'
          }
        },
        required: ['topic', 'encouragement_given']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_diet_entry',
      description: 'Add a meal or food item to the user\'s diet log with nutritional information. Use this when the user asks for healthy meal suggestions, recipes, or wants to track what they eat.',
      parameters: {
        type: 'object',
        properties: {
          meal_type: {
            type: 'string',
            enum: ['breakfast', 'lunch', 'dinner', 'snack'],
            description: 'Type of meal'
          },
          food_items: {
            type: 'string',
            description: 'Description of food items eaten or recipe name'
          },
          calories: {
            type: 'number',
            description: 'Estimated calories for the meal'
          },
          protein: {
            type: 'number',
            description: 'Estimated protein in grams'
          },
          carbs: {
            type: 'number',
            description: 'Estimated carbohydrates in grams'
          },
          fat: {
            type: 'number',
            description: 'Estimated fat in grams'
          },
          notes: {
            type: 'string',
            description: 'Recipe instructions or additional notes about the meal'
          }
        },
        required: ['meal_type', 'food_items', 'calories']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_note',
      description: 'Create a new note for the user. Use this when the user wants to save information, reminders, recipes, ideas, or any text they want to remember.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Title of the note'
          },
          content: {
            type: 'string',
            description: 'Content/body of the note'
          },
          category: {
            type: 'string',
            description: 'Category for the note. Can be any descriptive category like: recipe, idea, reminder, shopping-list, journal, study-notes, health, goals, or any other appropriate category'
          },
          color: {
            type: 'string',
            description: 'Color for the note (optional)',
            enum: ['yellow', 'blue', 'green', 'pink', 'purple', 'orange']
          }
        },
        required: ['title', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new task or chore for the user. ALWAYS use this tool when the user mentions creating, adding, or wanting to do a task. Categories are COMPLETELY FLEXIBLE - use any descriptive word.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Title of the task (required)'
          },
          description: {
            type: 'string',
            description: 'Detailed description of the task (optional)'
          },
          category: {
            type: 'string',
            description: 'FREE-FORM category string. Use ANY word that describes the task type. Examples: reading, habits, self-improvement, exercise, homework, cleaning, cooking, meditation, learning, creative, health, fitness, study, music, art, chores, outdoor, indoor, mindfulness, productivity. There are NO restrictions - any category name works.'
          },
          difficulty: {
            type: 'string',
            enum: ['easy', 'medium', 'hard'],
            description: 'Difficulty level (required): easy=10pts, medium=20pts, hard=30pts'
          },
          points: {
            type: 'number',
            description: 'Points awarded for completing. If not provided, auto-calculated from difficulty.'
          },
          due_date: {
            type: 'string',
            description: 'Due date in YYYY-MM-DD format (optional)'
          }
        },
        required: ['title', 'difficulty']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_monthly_goal',
      description: 'Set or update the user\'s monthly goal. Use this when the user wants to set a goal for the current month.',
      parameters: {
        type: 'object',
        properties: {
          goal_description: {
            type: 'string',
            description: 'Description of the monthly goal'
          },
          goal_points: {
            type: 'number',
            description: 'Target points to achieve this goal (typically 100-500)'
          },
          reward: {
            type: 'string',
            description: 'Reward for achieving the goal (optional)'
          }
        },
        required: ['goal_description', 'goal_points']
      }
    }
  }
];

// Execute AI tool functions
function executeAITool(toolName: string, args: any, profileId: number): { success: boolean; message: string; data?: any } {
  try {
    switch (toolName) {
      case 'suggest_quiz_practice': {
        console.log(`[AI Tool] Suggesting quiz practice: ${args.category} for profile ${profileId}`);

        // Log the suggestion for analytics
        try {
          db.prepare(`
            INSERT INTO ai_conversations (profile_id, context, user_message, ai_response)
            VALUES (?, 'quiz_suggestion', ?, ?)
          `).run(
            profileId,
            `AI suggested ${args.category} practice`,
            JSON.stringify({ category: args.category, reason: args.reason, difficulty: args.difficulty_hint })
          );
        } catch (e) {
          // Ignore logging errors
        }

        return {
          success: true,
          message: `Great idea! I suggest practicing ${args.category} quizzes. ${args.reason}`,
          data: { category: args.category, reason: args.reason, difficulty_hint: args.difficulty_hint }
        };
      }

      case 'log_encouragement': {
        console.log(`[AI Tool] Logging encouragement for profile ${profileId}: ${args.topic}`);

        // Store encouragement interaction for parent visibility
        try {
          db.prepare(`
            INSERT INTO ai_conversations (profile_id, context, user_message, ai_response)
            VALUES (?, 'encouragement', ?, ?)
          `).run(
            profileId,
            `Child needed support with: ${args.topic}`,
            JSON.stringify({
              encouragement: args.encouragement_given,
              mood: args.mood_indicator || 'neutral',
              timestamp: new Date().toISOString()
            })
          );
        } catch (e) {
          console.error('[AI Tool] Failed to log encouragement:', e);
        }

        return {
          success: true,
          message: 'Encouragement noted',
          data: { topic: args.topic, mood: args.mood_indicator }
        };
      }

      case 'add_diet_entry': {
        console.log(`[AI Tool] Adding diet entry: "${args.food_items}" for profile ${profileId}`);
        // First, create a food item for this AI-generated meal
        const foodResult = db.prepare(`
          INSERT INTO food_items (name, calories, protein, carbs, fat, source)
          VALUES (?, ?, ?, ?, ?, 'ai_generated')
        `).run(
          args.food_items,
          args.calories || 0,
          args.protein || 0,
          args.carbs || 0,
          args.fat || 0
        );
        console.log(`[AI Tool] Food item created with id: ${foodResult.lastInsertRowid}`);

        // Now log the meal with the food_id
        const result = db.prepare(`
          INSERT INTO meal_logs (profile_id, food_id, meal_type, food_items, portion_size, calories_consumed, protein_consumed, carbs_consumed, fat_consumed, notes)
          VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
        `).run(
          profileId,
          foodResult.lastInsertRowid,
          args.meal_type,
          args.food_items,
          args.calories || 0,
          args.protein || 0,
          args.carbs || 0,
          args.fat || 0,
          args.notes || ''
        );
        console.log(`[AI Tool] Meal log created with id: ${result.lastInsertRowid}`);
        return {
          success: true,
          message: `Added "${args.food_items}" to your ${args.meal_type} log (${args.calories} calories)`,
          data: { id: result.lastInsertRowid, food_id: foodResult.lastInsertRowid, ...args }
        };
      }

      case 'create_note': {
        // Map color names to hex values
        const colorMap: Record<string, string> = {
          'yellow': '#fef08a',
          'blue': '#93c5fd',
          'green': '#86efac',
          'pink': '#f9a8d4',
          'purple': '#c4b5fd',
          'orange': '#fed7aa'
        };
        const hexColor = colorMap[args.color] || '#fef08a'; // Default to yellow
        const category = args.category || 'general';

        console.log(`[AI Tool] Creating note: "${args.title}" for profile ${profileId}`);
        const result = db.prepare(`
          INSERT INTO notes (profile_id, title, content, color, category)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          profileId,
          args.title,
          args.content,
          hexColor,
          category
        );
        console.log(`[AI Tool] Note created with id: ${result.lastInsertRowid}`);
        return {
          success: true,
          message: `Created note "${args.title}" (${category})`,
          data: { id: result.lastInsertRowid, ...args, category }
        };
      }

      case 'create_task': {
        console.log(`[AI Tool] Creating task: "${args.title}" for profile ${profileId}`);
        console.log(`[AI Tool] Task args received:`, JSON.stringify(args));

        // Validate required fields
        if (!args.title) {
          console.error('[AI Tool] create_task missing required field: title');
          return { success: false, message: 'Task title is required' };
        }
        if (!args.difficulty) {
          console.log('[AI Tool] No difficulty provided, defaulting to easy');
          args.difficulty = 'easy';
        }

        // Default category to 'other' if not provided - ANY category string is valid
        const category = args.category || 'other';
        console.log(`[AI Tool] Using category: "${category}"`);

        // Auto-calculate base points based on difficulty
        let basePoints = args.points;
        if (!basePoints) {
          const pointsMap: Record<string, number> = { easy: 10, medium: 20, hard: 30 };
          basePoints = pointsMap[args.difficulty] || 10;
        }

        // Store the same base task points as manual task creation.
        // Economy multipliers are applied later at completion time so AI-created tasks don't get boosted twice.
        let points = basePoints;

        const maxTaskPoints = 50;
        if (points > maxTaskPoints) {
          console.log(`[AI Tool] Capping points from ${points} to ${maxTaskPoints} (max task points)`);
          points = maxTaskPoints;
        }

        console.log(`[AI Tool] Task points stored as base value: ${points}`);

        try {
          const result = db.prepare(`
            INSERT INTO tasks (profile_id, title, description, category, difficulty, points, due_date, created_by, parent_approved, approved_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
          `).run(
            profileId,
            args.title,
            args.description || '',
            category,
            args.difficulty,
            points,
            args.due_date || null,
            profileId  // created_by = the child profile
          );
          console.log(`[AI Tool] Task created successfully with id: ${result.lastInsertRowid}, category: ${category}`);
          return {
            success: true,
            message: `Created task "${args.title}" (${points} points, ${category}) - awaiting parent approval`,
            data: { id: result.lastInsertRowid, ...args, category, points }
          };
        } catch (dbError: any) {
          console.error(`[AI Tool] Database error creating task:`, dbError.message);
          console.error(`[AI Tool] This might be a category constraint issue if using old database`);
          // Try with fallback category if there's a constraint error
          if (dbError.message.includes('CHECK constraint')) {
            console.log(`[AI Tool] Retrying with category 'other' due to database constraint`);
            const fallbackResult = db.prepare(`
              INSERT INTO tasks (profile_id, title, description, category, difficulty, points, due_date, created_by, parent_approved, approved_by)
              VALUES (?, ?, ?, 'other', ?, ?, ?, ?, 0, NULL)
            `).run(
              profileId,
              args.title,
              args.description || '',
              args.difficulty,
              points,
              args.due_date || null,
              profileId
            );
            console.log(`[AI Tool] Task created with fallback category 'other', id: ${fallbackResult.lastInsertRowid}`);
            return {
              success: true,
              message: `Created task "${args.title}" (${points} points) - awaiting parent approval`,
              data: { id: fallbackResult.lastInsertRowid, ...args, category: 'other', points }
            };
          }
          throw dbError;
        }
      }

      case 'set_monthly_goal': {
        const currentMonth = new Date().toISOString().slice(0, 7);
        console.log(`[AI Tool] Setting monthly goal for profile ${profileId}, month: ${currentMonth}`);

        // Check if goal exists for this month
        const existing: any = db.prepare(`
          SELECT id FROM monthly_goals WHERE profile_id = ? AND month = ?
        `).get(profileId, currentMonth);

        if (existing) {
          db.prepare(`
            UPDATE monthly_goals SET goal_description = ?, goal_points = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(args.goal_description, args.goal_points, args.reward || '', existing.id);
          console.log(`[AI Tool] Updated goal id: ${existing.id}`);
          return {
            success: true,
            message: `Updated your monthly goal: "${args.goal_description}" (target: ${args.goal_points} points)`,
            data: { id: existing.id, ...args, month: currentMonth }
          };
        } else {
          const result = db.prepare(`
            INSERT INTO monthly_goals (profile_id, month, goal_description, goal_points, notes, created_by, parent_approved, approved_by)
            VALUES (?, ?, ?, ?, ?, ?, 0, NULL)
          `).run(profileId, currentMonth, args.goal_description, args.goal_points, args.reward || '', profileId);
          console.log(`[AI Tool] Created goal with id: ${result.lastInsertRowid}`);
          return {
            success: true,
            message: `Set your monthly goal: "${args.goal_description}" (target: ${args.goal_points} points) - awaiting parent approval`,
            data: { id: result.lastInsertRowid, ...args, month: currentMonth }
          };
        }
      }

      default:
        console.error(`[AI Tool] Unknown tool: ${toolName}`);
        return { success: false, message: `Unknown tool: ${toolName}` };
    }
  } catch (error: any) {
    console.error(`[AI Tool] Error executing ${toolName}:`, error);
    console.error(`[AI Tool] Stack:`, error.stack);
    console.error(`[AI Tool] Args:`, JSON.stringify(args));
    return { success: false, message: `Tool execution failed. Please try again with different parameters.` };
  }
}

// Helper: Get AI settings for profile (includes ai_enabled from profiles table)
function getAISettings(profileId: number) {
  try {
    let settings: any = db.prepare(`
      SELECT
        ai.*,
        p.ai_enabled,
        p.type,
        p.parent_id
      FROM ai_settings ai
      LEFT JOIN profiles p ON ai.profile_id = p.id
      WHERE ai.profile_id = ?
    `).get(profileId);

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

      settings = db.prepare(`
        SELECT
          ai.*,
          p.ai_enabled,
          p.type,
          p.parent_id
        FROM ai_settings ai
        LEFT JOIN profiles p ON ai.profile_id = p.id
        WHERE ai.profile_id = ?
      `).get(profileId);
    }

    // Ensure custom_instructions exists
    if (!settings.custom_instructions) {
      settings.custom_instructions = '';
    }

    // If ai_enabled is null or 0, treat as disabled
    if (settings.ai_enabled !== 1) {
      settings.ai_enabled = 0;
    }

    return settings;
  } catch (error) {
    console.error(`Error getting AI settings for profile ${profileId}:`, error);
    // Return safe defaults if database fails (disabled)
    return {
      profile_id: profileId,
      strict_mode: 1,
      max_messages_per_day: 20,
      content_filter_level: 'strict',
      custom_instructions: '',
      ai_enabled: 0
    };
  }
}

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

// Helper: Get OpenAI API key from env or settings table
function getOpenAiApiKey(): string | null {
  let apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    try {
      const setting: any = db.prepare('SELECT value FROM settings WHERE key = ?').get('openai_api_key');
      if (setting && setting.value) {
        apiKey = setting.value;
      }
    } catch (error) {
      console.error('Failed to read openai_api_key from settings:', error);
    }
  }

  return apiKey && apiKey.trim() !== '' ? apiKey : null;
}

// Helper: Check if OpenAI API is available
function isOpenAiAvailable(): boolean {
  return !!getOpenAiApiKey();
}

// Helper: Get Gemini API key from env or settings table
function getGeminiApiKey(): string | null {
  let apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    try {
      const setting: any = db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_api_key');
      if (setting && setting.value) {
        apiKey = setting.value;
      }
    } catch (error) {
      console.error('Failed to read gemini_api_key from settings:', error);
    }
  }

  return apiKey && apiKey.trim() !== '' ? apiKey : null;
}

// Helper: Check if Gemini API is available
function isGeminiAvailable(): boolean {
  return !!getGeminiApiKey();
}

// Helper: Check if any AI API is available
function isAnyAiAvailable(): boolean {
  return isGrokAvailable() || isOpenAiAvailable() || isGeminiAvailable();
}

// Helper: Call Gemini API as fallback (non-streaming)
async function callGeminiApi(messages: { role: string; content: string }[], systemPrompt: string): Promise<string> {
  const geminiApiKey = getGeminiApiKey();
  if (!geminiApiKey) {
    throw new Error('Gemini API key not configured');
  }

  // Convert OpenAI message format to Gemini format
  // Gemini expects: { contents: [{ role: 'user'|'model', parts: [{ text: '...' }] }] }
  const contents: { role: string; parts: { text: string }[] }[] = [];

  // Add system prompt as first user message (Gemini doesn't have system role)
  contents.push({
    role: 'user',
    parts: [{ text: `System Instructions:\n${systemPrompt}\n\nNow respond to the following conversation:` }]
  });
  contents.push({
    role: 'model',
    parts: [{ text: 'I understand. I will follow those instructions.' }]
  });

  // Add conversation messages (skip system messages)
  for (const msg of messages) {
    if (msg.role === 'system') continue;

    // Skip if content is null or undefined (tool call messages)
    if (!msg.content) continue;

    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    });
  }

  console.log('[AI Chat] Calling Gemini API as fallback...');

  const response = await axios.post(
    `${GEMINI_API_URL}?key=${geminiApiKey}`,
    {
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500
      }
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    }
  );

  const geminiResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!geminiResponse) {
    throw new Error('No response from Gemini');
  }

  console.log('[AI Chat] Gemini response received successfully');
  return geminiResponse;
}



/**
 * Non-streaming text generation over the existing provider chain
 * (Grok -> OpenAI -> Gemini), for features such as the FamilyHub Learn
 * lesson tutor that must not maintain a second AI stack. Throws when no
 * provider is configured or every provider fails, so callers can fall back.
 */
export async function generateTextWithProviderFallback(
  systemPrompt: string,
  userMessage: string,
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<{ text: string; provider: 'grok' | 'openai' | 'gemini' }> {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ];
  const maxTokens = options.maxTokens ?? 400;
  const temperature = options.temperature ?? 0.4;

  const openAiCompatible: Array<{ provider: 'grok' | 'openai'; url: string; model: string; key: string | null }> = [
    { provider: 'grok', url: GROK_API_URL, model: 'grok-2-latest', key: getGrokApiKey() },
    { provider: 'openai', url: OPENAI_API_URL, model: 'gpt-4o-mini', key: getOpenAiApiKey() }
  ];

  for (const candidate of openAiCompatible) {
    if (!candidate.key) continue;
    try {
      const response = await axios.post(
        candidate.url,
        { model: candidate.model, messages, temperature, max_tokens: maxTokens },
        { headers: { Authorization: `Bearer ${candidate.key}`, 'Content-Type': 'application/json' }, timeout: 30000 }
      );
      const text = response.data?.choices?.[0]?.message?.content;
      if (typeof text === 'string' && text.trim()) {
        return { text: text.trim(), provider: candidate.provider };
      }
    } catch (error: any) {
      console.error(`[AI] ${candidate.provider} generation failed:`, error.response?.status || error.message);
    }
  }

  if (isGeminiAvailable()) {
    const text = await callGeminiApi(messages, systemPrompt);
    return { text: text.trim(), provider: 'gemini' };
  }

  throw new Error('No AI provider available');
}

export { getAISettings };

// Helper: Get comprehensive profile context (tasks, progress, diet, goals, notes, quizzes, behavior)
function getProfileContext(profileId: number) {
  const profile: any = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId);

  // Get task stats with category breakdown
  const taskStats: any = db.prepare(`
    SELECT
      COUNT(*) as total_tasks,
      SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_tasks,
      SUM(CASE WHEN completed = 0 AND due_date < datetime('now') THEN 1 ELSE 0 END) as overdue_tasks
    FROM tasks
    WHERE profile_id = ?
  `).get(profileId);

  // Get task completion by category (for behavioral insights)
  const tasksByCategory: any[] = db.prepare(`
    SELECT
      category,
      COUNT(*) as total,
      SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
      ROUND(CAST(SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100, 1) as completion_rate
    FROM tasks
    WHERE profile_id = ?
    GROUP BY category
    ORDER BY total DESC
    LIMIT 10
  `).all(profileId);

  // Identify behavioral patterns
  const avoidsCategories = tasksByCategory
    .filter(c => c.completion_rate < 30 && c.total >= 3)
    .map(c => c.category);

  const lovesCategories = tasksByCategory
    .filter(c => c.completion_rate > 70 && c.total >= 3)
    .map(c => c.category);

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

  // Get completed tasks (last 10 for learning patterns)
  const completedTasks = db.prepare(`
    SELECT title, category, points, completed_at
    FROM tasks
    WHERE profile_id = ? AND completed = 1
    ORDER BY completed_at DESC
    LIMIT 10
  `).all(profileId);

  // Get all monthly goals (last 6 months)
  const allGoals = db.prepare(`
    SELECT month, goal_description, goal_points, achieved, reward_given
    FROM monthly_goals
    WHERE profile_id = ?
    ORDER BY month DESC
    LIMIT 6
  `).all(profileId);

  // Get school enrollments
  const schoolEnrollments = db.prepare(`
    SELECT sc.name as class_name, sc.description, se.enrolled_at
    FROM school_enrollments se
    JOIN school_classes sc ON se.class_id = sc.id
    WHERE se.student_id = ?
    ORDER BY se.enrolled_at DESC
  `).all(profileId);

  // Get school assignments (upcoming and recent)
  const schoolAssignments = db.prepare(`
    SELECT sa.title, sa.description, sa.due_date, sa.type, sc.name as class_name
    FROM school_assignments sa
    JOIN school_classes sc ON sa.class_id = sc.id
    JOIN school_enrollments se ON se.class_id = sc.id
    WHERE se.student_id = ? AND (sa.due_date >= date('now') OR sa.created_at > date('now', '-7 days'))
    ORDER BY sa.due_date ASC
    LIMIT 10
  `).all(profileId);

  // Get student progress in school
  const schoolProgress = db.prepare(`
    SELECT sp.*, sc.name as class_name
    FROM school_student_progress sp
    JOIN school_classes sc ON sp.class_id = sc.id
    WHERE sp.student_id = ?
    ORDER BY sp.updated_at DESC
    LIMIT 5
  `).all(profileId);

  // Get quiz performance data
  let quizStats: any = { total_attempts: 0, avg_score: 0, quizzes_passed: 0, best_score: 0 };
  let quizByCategory: any[] = [];
  let recentQuizAttempts: any[] = [];

  try {
    quizStats = db.prepare(`
      SELECT
        COUNT(*) as total_attempts,
        ROUND(AVG(score_percentage), 1) as avg_score,
        SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as quizzes_passed,
        MAX(score_percentage) as best_score,
        SUM(points_earned) as total_quiz_points,
        SUM(stars_earned) as total_quiz_stars
      FROM quiz_attempts
      WHERE profile_id = ? AND completed_at IS NOT NULL
    `).get(profileId) || quizStats;

    quizByCategory = db.prepare(`
      SELECT
        qc.display_name as category,
        qc.icon,
        COUNT(qa.id) as attempts,
        ROUND(AVG(qa.score_percentage), 1) as avg_score,
        SUM(qa.points_earned) as points_earned
      FROM quiz_attempts qa
      JOIN family_quizzes fq ON qa.quiz_id = fq.id
      JOIN quiz_categories qc ON fq.category_id = qc.id
      WHERE qa.profile_id = ? AND qa.completed_at IS NOT NULL
      GROUP BY qc.id
      ORDER BY attempts DESC
    `).all(profileId) || [];

    recentQuizAttempts = db.prepare(`
      SELECT
        fq.title as quiz_title,
        qc.display_name as category,
        qa.score_percentage,
        qa.correct_answers,
        qa.total_questions,
        qa.passed,
        qa.completed_at
      FROM quiz_attempts qa
      JOIN family_quizzes fq ON qa.quiz_id = fq.id
      JOIN quiz_categories qc ON fq.category_id = qc.id
      WHERE qa.profile_id = ? AND qa.completed_at IS NOT NULL
      ORDER BY qa.completed_at DESC
      LIMIT 5
    `).all(profileId) || [];
  } catch (e) {
    // Quiz tables might not exist, ignore
  }

  // Identify quiz strengths and weaknesses
  const quizStrengths = quizByCategory.filter(c => c.avg_score >= 80).map(c => c.category);
  const quizWeaknesses = quizByCategory.filter(c => c.avg_score < 60 && c.attempts >= 2).map(c => c.category);

  // Get streaks data
  let streaks: any = { task_current: 0, task_longest: 0, water_current: 0, water_longest: 0 };
  try {
    const taskStreak: any = db.prepare(`
      SELECT current_streak, longest_streak FROM streaks
      WHERE profile_id = ? AND streak_type = 'tasks'
    `).get(profileId);

    const waterStreak: any = db.prepare(`
      SELECT current_streak, longest_streak FROM streaks
      WHERE profile_id = ? AND streak_type = 'water'
    `).get(profileId);

    if (taskStreak) {
      streaks.task_current = taskStreak.current_streak;
      streaks.task_longest = taskStreak.longest_streak;
    }
    if (waterStreak) {
      streaks.water_current = waterStreak.current_streak;
      streaks.water_longest = waterStreak.longest_streak;
    }
  } catch (e) {
    // Streaks table might not exist
  }

  // Get achievements
  let achievements: any[] = [];
  let achievementCount = 0;
  try {
    achievements = db.prepare(`
      SELECT a.name, a.icon, a.description, pa.earned_at
      FROM profile_achievements pa
      JOIN achievements a ON pa.achievement_id = a.id
      WHERE pa.profile_id = ?
      ORDER BY pa.earned_at DESC
      LIMIT 5
    `).all(profileId) || [];

    const countResult: any = db.prepare(`
      SELECT COUNT(*) as count FROM profile_achievements WHERE profile_id = ?
    `).get(profileId);
    achievementCount = countResult?.count || 0;
  } catch (e) {
    // Achievements table might not exist
  }

  // Get active challenges
  let activeChallenges: any[] = [];
  try {
    activeChallenges = db.prepare(`
      SELECT title, description, target_value, current_progress, points_reward, expires_at
      FROM custom_challenges
      WHERE profile_id = ? AND completed = 0 AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY created_at DESC
      LIMIT 3
    `).all(profileId) || [];
  } catch (e) {
    // Challenges table might not exist
  }

  // Get water intake today
  let waterToday = 0;
  try {
    const waterResult: any = db.prepare(`
      SELECT SUM(amount_ml) as total
      FROM water_intake
      WHERE profile_id = ? AND DATE(logged_at) = DATE('now')
    `).get(profileId);
    waterToday = waterResult?.total || 0;
  } catch (e) {
    // Water table might not exist
  }

  // Get login streak
  let loginStreak = 0;
  try {
    const loginResult: any = db.prepare(`
      SELECT consecutive_days FROM daily_login_bonus
      WHERE profile_id = ?
      ORDER BY claim_date DESC
      LIMIT 1
    `).get(profileId);
    loginStreak = loginResult?.consecutive_days || 0;
  } catch (e) {
    // Login bonus table might not exist
  }

  return {
    profile,
    taskStats: taskStats || { total_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    tasksByCategory: tasksByCategory || [],
    avoidsCategories: avoidsCategories || [],
    lovesCategories: lovesCategories || [],
    recentTasks: recentTasks || [],
    completedTasks: completedTasks || [],
    progress: progress || { total_points: 0, total_stars: 0, level: 1 },
    monthlyGoal,
    allGoals: allGoals || [],
    dietSummary: dietSummary || { total_calories: 0, total_protein: 0 },
    recentNotes: recentNotes || [],
    schoolEnrollments: schoolEnrollments || [],
    schoolAssignments: schoolAssignments || [],
    schoolProgress: schoolProgress || [],
    // New behavioral/gamification data
    quizStats,
    quizByCategory: quizByCategory || [],
    recentQuizAttempts: recentQuizAttempts || [],
    quizStrengths: quizStrengths || [],
    quizWeaknesses: quizWeaknesses || [],
    streaks,
    achievements: achievements || [],
    achievementCount,
    activeChallenges: activeChallenges || [],
    waterToday,
    loginStreak
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

// Chat with AI (GET endpoint for EventSource streaming)
router.get('/chat', authenticateEventSource, requireFeature('ai'), requireRole(['admin', 'parent', 'child']), async (req: AuthRequest, res) => {
  try {
    const profile_id = req.profile!.id;  // Use authenticated profile
    const message = req.query.message as string;
    const context = (req.query.context as string) || 'general';
    console.log(`[AI Chat GET] Request from profile ${profile_id}, context: ${context}`);

    if (!message || typeof message !== 'string') {
      console.error('[AI Chat] Missing or invalid message');
      return res.status(400).json({ error: 'Message is required' });
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

    // Check if AI is enabled for this profile
    if (aiSettings.ai_enabled !== 1) {
      console.log(`[AI Chat] AI assistant disabled for profile ${profile_id}`);
      return res.status(403).json({
        error: 'AI assistant is not enabled for this profile. Please ask an administrator to enable it.'
      });
    }

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

    // Check if any AI API is available (Grok or OpenAI)
    if (!isAnyAiAvailable()) {
      // Fallback mode - no AI API configured
      aiResponse = generateFallbackResponse(message, profile, context);
    } else {
      // Build system prompt based on context, user type, and AI settings
      let systemPrompt = '';

      if (profile.type === 'child') {
        if (aiSettings.strict_mode) {
          systemPrompt = `You are a friendly, educational AI assistant for a ${profile.age}-year-old child named ${profile.name}.
You understand their learning patterns, preferences, and behaviors to provide truly personalized support.

STRICT GUIDELINES:
- Use age-appropriate language only
- Be positive, encouraging, and educational
- Never discuss inappropriate topics (violence, adult content, etc.)
- Focus on learning, creativity, and positive habits
- Encourage task completion and healthy choices
- If asked anything inappropriate, politely redirect to positive topics
- Be proactive: notice patterns and gently encourage improvement in weak areas

═══════════════════════════════════════════════════════════
COMPLETE BEHAVIORAL PROFILE - Use this to truly understand ${profile.name}!
═══════════════════════════════════════════════════════════

📊 PROGRESS & LEVEL:
• Points: ${profileContext.progress.total_points} | Stars: ${profileContext.progress.total_stars} | Level: ${profileContext.progress.level}
• Login streak: ${profileContext.loginStreak} days | Achievements earned: ${profileContext.achievementCount}
${profileContext.monthlyGoal ? `• Current Goal: ${profileContext.monthlyGoal.goal_description} (Target: ${profileContext.monthlyGoal.goal_points} pts)` : ''}

🧠 BEHAVIORAL PATTERNS (VERY IMPORTANT - adapt your responses based on these):
${profileContext.lovesCategories.length > 0 ? `• LOVES (>70% completion): ${profileContext.lovesCategories.join(', ')} - Praise these efforts!` : '• Still discovering favorite activities'}
${profileContext.avoidsCategories.length > 0 ? `• AVOIDS (<30% completion): ${profileContext.avoidsCategories.join(', ')} - Gently encourage, make fun!` : '• No problem areas detected'}
${profileContext.tasksByCategory.length > 0 ? `• Category breakdown: ${profileContext.tasksByCategory.slice(0, 5).map((c: any) => `${c.category}: ${c.completion_rate}%`).join(', ')}` : ''}

🔥 STREAKS & MOTIVATION:
• Task streak: ${profileContext.streaks.task_current} days (best: ${profileContext.streaks.task_longest})
• Water streak: ${profileContext.streaks.water_current} days (best: ${profileContext.streaks.water_longest})
${profileContext.streaks.task_current > 0 ? `• ⚠️ Streak at risk if no task completed today! Encourage them!` : '• Encourage starting a new streak!'}

📝 TASKS:
• Total: ${profileContext.taskStats.total_tasks} | Completed: ${profileContext.taskStats.completed_tasks} | Overdue: ${profileContext.taskStats.overdue_tasks}
${profileContext.recentTasks.length > 0 ? `• Upcoming: ${profileContext.recentTasks.map((t: any) => `${t.title} (${t.category}${t.due_date ? `, due: ${t.due_date}` : ''})`).join('; ')}` : ''}

🎓 QUIZ PERFORMANCE:
${profileContext.quizStats.total_attempts > 0 ? `• Quizzes taken: ${profileContext.quizStats.total_attempts} | Average score: ${profileContext.quizStats.avg_score}% | Passed: ${profileContext.quizStats.quizzes_passed}
• Best score ever: ${profileContext.quizStats.best_score}%` : '• No quizzes taken yet - encourage them to try!'}
${profileContext.quizStrengths.length > 0 ? `• QUIZ STRENGTHS (≥80%): ${profileContext.quizStrengths.join(', ')} - Celebrate these!` : ''}
${profileContext.quizWeaknesses.length > 0 ? `• NEEDS PRACTICE (<60%): ${profileContext.quizWeaknesses.join(', ')} - Suggest practice!` : ''}
${profileContext.recentQuizAttempts.length > 0 ? `• Recent quizzes: ${profileContext.recentQuizAttempts.map((q: any) => `${q.quiz_title}: ${q.score_percentage}%${q.passed ? ' ✓' : ''}`).join('; ')}` : ''}

🏆 ACHIEVEMENTS & CHALLENGES:
${profileContext.achievements.length > 0 ? `• Recent badges: ${profileContext.achievements.map((a: any) => `${a.icon} ${a.name}`).join(', ')}` : '• Working toward first achievement!'}
${profileContext.activeChallenges.length > 0 ? `• Active challenges: ${profileContext.activeChallenges.map((c: any) => `${c.title} (${c.current_progress}/${c.target_value})`).join('; ')}` : ''}

💧 HEALTH TODAY:
• Water: ${profileContext.waterToday}ml | Calories: ${profileContext.dietSummary.total_calories || 0} kcal

${profileContext.schoolEnrollments.length > 0 ? `🏫 SCHOOL:
• Classes: ${profileContext.schoolEnrollments.map((e: any) => e.class_name).join(', ')}
${profileContext.schoolAssignments.length > 0 ? `• Assignments: ${profileContext.schoolAssignments.map((a: any) => `${a.title} (${a.class_name}${a.due_date ? `, due: ${a.due_date}` : ''})`).join('; ')}` : ''}` : ''}

${profileContext.allGoals.length > 0 ? `📅 GOAL HISTORY:
${profileContext.allGoals.map((g: any) => `• ${g.month}: ${g.goal_description} (${g.achieved ? '✓ Achieved!' : 'Not achieved'})`).join('\n')}` : ''}

═══════════════════════════════════════════════════════════
HOW TO USE THIS DATA:
1. If they ask about progress, reference specific achievements and streaks
2. If they struggle with something, check if it's in their "avoids" categories
3. Celebrate their strengths and quiz performance
4. Gently encourage improvement in weak areas with fun suggestions
5. Reference their active challenges and goals
6. Keep water and health in mind
═══════════════════════════════════════════════════════════`;
        } else {
          systemPrompt = `You are a friendly AI assistant helping ${profile.age}-year-old ${profile.name}.
Keep language age-appropriate and focus on being helpful and educational.

Profile Context:
- Points: ${profileContext.progress.total_points} | Level: ${profileContext.progress.level} | Streaks: ${profileContext.streaks.task_current} days
- Tasks: ${profileContext.taskStats.total_tasks} total, ${profileContext.taskStats.completed_tasks} completed
${profileContext.quizStats.total_attempts > 0 ? `- Quiz avg: ${profileContext.quizStats.avg_score}% (${profileContext.quizStats.total_attempts} taken)` : ''}
${profileContext.schoolAssignments.length > 0 ? `- School assignments: ${profileContext.schoolAssignments.length} pending` : ''}
${profileContext.lovesCategories.length > 0 ? `- Loves: ${profileContext.lovesCategories.join(', ')}` : ''}
${profileContext.avoidsCategories.length > 0 ? `- Needs encouragement: ${profileContext.avoidsCategories.join(', ')}` : ''}

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

      // Add tool usage instructions
      systemPrompt += `\n\nCRITICAL - TOOL USAGE INSTRUCTIONS:

You have these tools available:
- suggest_quiz_practice: Suggest quiz categories based on performance (use when discussing learning/improvement)
- log_encouragement: Log when child needs support (helps parents understand their needs)
- add_diet_entry: Log meals/food to the diet tracker
- create_note: Save notes, reminders, recipes, ideas
- create_task: Create tasks, chores, or activities
- set_monthly_goal: Set monthly goals

BEHAVIORAL AWARENESS:
- Use suggest_quiz_practice when you notice quiz weaknesses or the child mentions school/learning
- Use log_encouragement when the child seems frustrated, struggling, or needs extra motivation
- Reference their behavioral patterns (loves/avoids) when making suggestions

MANDATORY RULES FOR create_task:
1. ALWAYS use the create_task tool when user wants to add/create ANY task
2. Category is FREE-FORM TEXT - use ANY descriptive word (reading, habits, self-improvement, exercise, meditation, study, fitness, cooking, creative, etc.)
3. There are ZERO restrictions on category names - any word works
4. Do NOT refuse or say you cannot create a task due to category
5. Do NOT ask for confirmation - just create the task immediately
6. If user doesn't specify difficulty, default to "easy"

PERSONALIZATION EXAMPLES:
- If child avoids "homework" -> Gently encourage with fun framing, break into smaller parts
- If child loves "creative" -> Praise their creativity, suggest related challenges
- If quiz score <60% in "math" -> Use suggest_quiz_practice(category="math", reason="Let's make math fun together!")
- If child seems frustrated -> Use log_encouragement to note it for parents

TASK EXAMPLES:
- "Add task to read Atomic Habits" -> create_task(title="Read Atomic Habits chapter", category="reading", difficulty="easy")
- "Create task for meditation" -> create_task(title="Morning meditation session", category="meditation", difficulty="easy")
- "I want to practice piano" -> create_task(title="Practice piano", category="music", difficulty="medium")

NEVER say "I cannot create this task" or "this category is not valid" - ALL categories work!`;

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
        // Determine which API to use (prefer Grok, fallback to OpenAI)
        const grokApiKey = getGrokApiKey();
        const openAiApiKey = getOpenAiApiKey();
        let useOpenAi = !grokApiKey;
        let apiKey = grokApiKey || openAiApiKey;
        let apiUrl = useOpenAi ? OPENAI_API_URL : GROK_API_URL;
        let model = useOpenAi ? 'gpt-4o-mini' : 'grok-2-latest';

        console.log(`[AI Chat] Using ${useOpenAi ? 'OpenAI' : 'Grok'} API`);

        let toolResults: { toolName: string; result: any }[] = [];
        let toolCheckMessage: any = null;

        // Try to detect tool calls first (only with Grok, OpenAI has different format)
        if (!useOpenAi && grokApiKey) {
          try {
            console.log('[AI Chat] Checking for tool calls with grok-2-latest...');
            const toolCheckResponse = await axios.post(
              GROK_API_URL,
              {
                model: 'grok-2-latest',
                messages,
                tools: AI_TOOLS,
                tool_choice: 'auto',
                temperature: 0.7,
                max_tokens: 500
              },
              {
                headers: {
                  'Authorization': `Bearer ${grokApiKey}`,
                  'Content-Type': 'application/json'
                },
                timeout: 30000
              }
            );

            toolCheckMessage = toolCheckResponse.data.choices?.[0]?.message;
            console.log('[AI Chat] Tool check response:', JSON.stringify(toolCheckMessage, null, 2));
          } catch (toolError: any) {
            const errorStatus = toolError.response?.status;
            console.error('[AI Chat] Tool check failed:', toolError.response?.data || toolError.message);

            // If Grok rate limited (429), switch to OpenAI
            if (errorStatus === 429 && openAiApiKey) {
              console.log('[AI Chat] Grok rate limited, switching to OpenAI...');
              useOpenAi = true;
              apiKey = openAiApiKey;
              apiUrl = OPENAI_API_URL;
              model = 'gpt-4o-mini';
            }
          }
        }

        // Check if the AI wants to call tools
        console.log(`[AI Chat] Tool check message content:`, toolCheckMessage?.content || 'No content');
        console.log(`[AI Chat] Tool calls in response:`, toolCheckMessage?.tool_calls ? JSON.stringify(toolCheckMessage.tool_calls) : 'None');

        if (toolCheckMessage?.tool_calls && toolCheckMessage.tool_calls.length > 0) {
          console.log(`[AI Chat] Tool calls detected: ${toolCheckMessage.tool_calls.length}`);

          // Execute each tool call
          for (const toolCall of toolCheckMessage.tool_calls) {
            const toolName = toolCall.function.name;
            let toolArgs = {};
            try {
              toolArgs = JSON.parse(toolCall.function.arguments);
            } catch (e) {
              console.error('[AI Chat] Failed to parse tool arguments:', e);
              continue;
            }

            console.log(`[AI Chat] Executing tool: ${toolName}`, toolArgs);
            const result = executeAITool(toolName, toolArgs, profile_id);
            toolResults.push({ toolName, result });
            console.log(`[AI Chat] Tool result:`, result);
          }

          // Add tool results to messages for follow-up
          messages.push({
            role: 'assistant',
            content: null,
            tool_calls: toolCheckMessage.tool_calls
          });

          // Add tool results
          for (let i = 0; i < toolCheckMessage.tool_calls.length; i++) {
            const toolCall = toolCheckMessage.tool_calls[i];
            const result = toolResults[i]?.result || { success: false, message: 'Tool execution failed' };
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
          }
        }

        // Now make the final streaming call for the response
        // Use a helper function to handle streaming with fallback
        const makeStreamingRequest = async (url: string, modelName: string, key: string) => {
          return await axios.post(
            url,
            {
              model: modelName,
              messages,
              temperature: 0.7,
              max_tokens: 500,
              stream: true
            },
            {
              headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
              },
              timeout: 30000,
              responseType: 'stream'
            }
          );
        };

        let response;
        try {
          console.log(`[AI Chat] Making streaming request to ${useOpenAi ? 'OpenAI' : 'Grok'}...`);
          response = await makeStreamingRequest(apiUrl, model, apiKey!);
        } catch (streamError: any) {
          const errorStatus = streamError.response?.status;
          // For streaming errors, try to extract the error message
          let errorMessage = streamError.message;
          if (streamError.response?.data) {
            try {
              // If it's a stream, we can't easily read it here, just log the status
              errorMessage = `Status ${errorStatus}: ${streamError.message}`;
            } catch (e) {
              errorMessage = streamError.message;
            }
          }
          console.error(`[AI Chat] ${useOpenAi ? 'OpenAI' : 'Grok'} streaming failed (${errorStatus}):`, errorMessage);

          // If Grok failed and OpenAI is available, try OpenAI
          if (!useOpenAi && openAiApiKey && (errorStatus === 429 || errorStatus === 500 || errorStatus === 502 || errorStatus === 503)) {
            console.log('[AI Chat] Falling back to OpenAI...');
            useOpenAi = true;
            apiUrl = OPENAI_API_URL;
            model = 'gpt-4o-mini';
            apiKey = openAiApiKey;
            try {
              response = await makeStreamingRequest(OPENAI_API_URL, 'gpt-4o-mini', openAiApiKey);
            } catch (openAiError: any) {
              const openAiErrorStatus = openAiError.response?.status;
              console.error('[AI Chat] OpenAI also failed:', openAiErrorStatus, openAiError.message);

              // Try Gemini as third fallback (non-streaming)
              const geminiApiKey = getGeminiApiKey();
              if (geminiApiKey && (openAiErrorStatus === 429 || openAiErrorStatus === 500 || openAiErrorStatus === 502 || openAiErrorStatus === 503)) {
                console.log('[AI Chat] Falling back to Gemini (non-streaming)...');
                try {
                  const geminiResponse = await callGeminiApi(messages, systemPrompt);

                  // Send as non-streaming JSON response
                  db.prepare(`
                    INSERT INTO ai_conversations (profile_id, context, user_message, ai_response)
                    VALUES (?, ?, ?, ?)
                  `).run(profile_id, context, message, geminiResponse);

                  return res.json({
                    response: geminiResponse,
                    profile: { id: profile.id, name: profile.name, type: profile.type },
                    provider: 'gemini'
                  });
                } catch (geminiError: any) {
                  console.error('[AI Chat] Gemini also failed:', geminiError.message);
                  throw geminiError;
                }
              }
              throw openAiError;
            }
          } else if (errorStatus === 429 || errorStatus === 500 || errorStatus === 502 || errorStatus === 503) {
            // Grok failed, no OpenAI - try Gemini directly
            const geminiApiKey = getGeminiApiKey();
            if (geminiApiKey) {
              console.log('[AI Chat] Falling back to Gemini (no OpenAI configured)...');
              try {
                const geminiResponse = await callGeminiApi(messages, systemPrompt);

                db.prepare(`
                  INSERT INTO ai_conversations (profile_id, context, user_message, ai_response)
                  VALUES (?, ?, ?, ?)
                `).run(profile_id, context, message, geminiResponse);

                return res.json({
                  response: geminiResponse,
                  profile: { id: profile.id, name: profile.name, type: profile.type },
                  provider: 'gemini'
                });
              } catch (geminiError: any) {
                console.error('[AI Chat] Gemini also failed:', geminiError.message);
                throw geminiError;
              }
            }
            throw streamError;
          } else {
            throw streamError;
          }
        }

        // Set up SSE (Server-Sent Events) for streaming to frontend
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        let fullResponse = '';

        // Handle streaming data
        response.data.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              if (data === '[DONE]') {
                // Stream complete
                res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;

                if (content) {
                  fullResponse += content;
                  // Send token to frontend
                  res.write(`data: ${JSON.stringify({ content })}\n\n`);
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        });

        response.data.on('end', async () => {
          // Save conversation after streaming completes
          console.log(`[AI Chat] Saving conversation for profile ${profile_id}`);
          try {
            db.prepare(`
              INSERT INTO ai_conversations (profile_id, context, user_message, ai_response)
              VALUES (?, ?, ?, ?)
            `).run(profile_id, context, message, fullResponse || 'No response generated');
            console.log(`[AI Chat] Conversation saved successfully`);
          } catch (dbError: any) {
            console.error(`[AI Chat] Failed to save conversation:`, dbError);
          }

          res.end();
        });

        response.data.on('error', (error: any) => {
          console.error('[AI Chat] Stream error:', error);
          res.write(`data: ${JSON.stringify({ error: 'Stream error occurred' })}\n\n`);
          res.end();
        });

      } catch (apiError: any) {
        console.error('Grok API error:', apiError.response?.data || apiError.message);

        // If streaming fails, fall back to non-streaming response
        aiResponse = generateFallbackResponse(message, profile, context);

        // Save fallback conversation
        try {
          db.prepare(`
            INSERT INTO ai_conversations (profile_id, context, user_message, ai_response)
            VALUES (?, ?, ?, ?)
          `).run(profile_id, context, message, aiResponse);
        } catch (dbError: any) {
          console.error(`[AI Chat] Failed to save conversation:`, dbError);
        }

        res.json({
          response: aiResponse,
          profile: { id: profile.id, name: profile.name, type: profile.type },
          usingFallback: true
        });
      }
    }

    // Note: For streaming responses, save happens in the stream 'end' handler
    // For non-streaming fallback responses, save happens in the catch block above

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
  const grokAvailable = isGrokAvailable();
  const openAiAvailable = isOpenAiAvailable();
  const geminiAvailable = isGeminiAvailable();

  res.json({
    apiConfigured: grokAvailable || openAiAvailable || geminiAvailable,
    fallbackMode: !grokAvailable && (openAiAvailable || geminiAvailable),
    providers: {
      grok: grokAvailable,
      openai: openAiAvailable,
      gemini: geminiAvailable
    },
    activeProvider: grokAvailable ? 'Grok' : openAiAvailable ? 'OpenAI' : geminiAvailable ? 'Gemini' : 'None'
  });
});

// Get message count and remaining messages for a profile
router.get('/message-count/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;
    const today = new Date().toISOString().split('T')[0];

    // Get today's message count
    const messageCount: any = db.prepare(`
      SELECT COUNT(*) as count
      FROM ai_conversations
      WHERE profile_id = ? AND DATE(created_at) = DATE(?)
    `).get(profileId, today);

    // Get AI settings for this profile
    const settings = getAISettings(parseInt(profileId));
    const limit = settings.max_messages_per_day || 20;
    const used = messageCount?.count || 0;

    // Determine limit type
    let limitType: 'limited' | 'extended' | 'unlimited';
    if (limit >= 9999) {
      limitType = 'unlimited';
    } else if (limit >= 20) {
      limitType = 'extended';
    } else {
      limitType = 'limited';
    }

    res.json({
      messagesUsed: used,
      messagesLimit: limit,
      messagesRemaining: Math.max(0, limit - used),
      limitType,
      aiEnabled: settings.ai_enabled === 1
    });
  } catch (error: any) {
    console.error('[AI] Error getting message count:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update AI message limit for a profile (admin only)
router.put('/message-limit/:profileId', (req, res) => {
  try {
    const { profileId } = req.params;
    const { limitType } = req.body;

    // Map limit type to actual number
    let maxMessages: number;
    switch (limitType) {
      case 'limited':
        maxMessages = 5;
        break;
      case 'extended':
        maxMessages = 20;
        break;
      case 'unlimited':
        maxMessages = 9999;
        break;
      default:
        return res.status(400).json({ error: 'Invalid limit type. Must be: limited, extended, or unlimited' });
    }

    // Ensure AI settings exist for this profile
    const existing = db.prepare('SELECT id FROM ai_settings WHERE profile_id = ?').get(profileId);
    if (!existing) {
      db.prepare(`
        INSERT INTO ai_settings (profile_id, strict_mode, max_messages_per_day, content_filter_level)
        VALUES (?, 1, ?, 'strict')
      `).run(profileId, maxMessages);
    } else {
      db.prepare(`
        UPDATE ai_settings
        SET max_messages_per_day = ?, updated_at = CURRENT_TIMESTAMP
        WHERE profile_id = ?
      `).run(maxMessages, profileId);
    }

    console.log(`[AI] Updated message limit for profile ${profileId}: ${limitType} (${maxMessages} messages/day)`);

    res.json({
      success: true,
      limitType,
      maxMessages,
      message: `Message limit updated to ${limitType} (${maxMessages === 9999 ? 'unlimited' : maxMessages + ' per day'})`
    });
  } catch (error: any) {
    console.error('[AI] Error updating message limit:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get AI insights for a parent's children (encouragement logs, quiz suggestions, mood indicators)
router.get('/insights/:parentId', authenticate, requireFeature('ai'), requireRole(['admin', 'parent']), (req: AuthRequest, res) => {
  try {
    const { parentId } = req.params;
    const { days = 7 } = req.query;

    // Get all children for this parent
    const children: any[] = db.prepare(`
      SELECT id, name, avatar FROM profiles
      WHERE parent_id = ? AND type = 'child'
    `).all(parentId);

    if (children.length === 0) {
      return res.json({ insights: [], children: [] });
    }

    const childIds = children.map(c => c.id);
    const placeholders = childIds.map(() => '?').join(',');

    // Get encouragement logs
    const encouragementLogs: any[] = db.prepare(`
      SELECT
        ac.profile_id,
        ac.user_message as topic,
        ac.ai_response as details,
        ac.created_at,
        p.name as child_name,
        p.avatar as child_avatar
      FROM ai_conversations ac
      JOIN profiles p ON ac.profile_id = p.id
      WHERE ac.profile_id IN (${placeholders})
        AND ac.context = 'encouragement'
        AND ac.created_at >= datetime('now', '-' || ? || ' days')
      ORDER BY ac.created_at DESC
      LIMIT 20
    `).all(...childIds, days);

    // Parse the JSON details
    const parsedEncouragements = encouragementLogs.map(log => {
      let parsed = { encouragement: '', mood: 'neutral', timestamp: log.created_at };
      try {
        parsed = JSON.parse(log.details);
      } catch (e) {
        parsed.encouragement = log.details;
      }
      return {
        child_id: log.profile_id,
        child_name: log.child_name,
        child_avatar: log.child_avatar,
        topic: log.topic.replace('Child needed support with: ', ''),
        encouragement: parsed.encouragement,
        mood: parsed.mood || 'neutral',
        timestamp: parsed.timestamp || log.created_at
      };
    });

    // Get quiz suggestions
    const quizSuggestions: any[] = db.prepare(`
      SELECT
        ac.profile_id,
        ac.user_message as suggestion,
        ac.ai_response as details,
        ac.created_at,
        p.name as child_name
      FROM ai_conversations ac
      JOIN profiles p ON ac.profile_id = p.id
      WHERE ac.profile_id IN (${placeholders})
        AND ac.context = 'quiz_suggestion'
        AND ac.created_at >= datetime('now', '-' || ? || ' days')
      ORDER BY ac.created_at DESC
      LIMIT 10
    `).all(...childIds, days);

    const parsedQuizSuggestions = quizSuggestions.map(log => {
      let parsed = { category: '', reason: '', difficulty: '' };
      try {
        parsed = JSON.parse(log.details);
      } catch (e) {}
      return {
        child_id: log.profile_id,
        child_name: log.child_name,
        category: parsed.category,
        reason: parsed.reason,
        difficulty_hint: parsed.difficulty,
        timestamp: log.created_at
      };
    });

    // Get mood summary per child
    const moodSummary: Record<number, { happy: number; neutral: number; frustrated: number; curious: number; tired: number }> = {};
    parsedEncouragements.forEach(e => {
      if (!moodSummary[e.child_id]) {
        moodSummary[e.child_id] = { happy: 0, neutral: 0, frustrated: 0, curious: 0, tired: 0 };
      }
      const mood = e.mood as keyof typeof moodSummary[number];
      if (moodSummary[e.child_id][mood] !== undefined) {
        moodSummary[e.child_id][mood]++;
      }
    });

    // Get message counts per child (last 7 days)
    const messageCounts: any[] = db.prepare(`
      SELECT
        profile_id,
        COUNT(*) as message_count
      FROM ai_conversations
      WHERE profile_id IN (${placeholders})
        AND context NOT IN ('encouragement', 'quiz_suggestion')
        AND created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY profile_id
    `).all(...childIds, days);

    const messageCountMap: Record<number, number> = {};
    messageCounts.forEach(mc => {
      messageCountMap[mc.profile_id] = mc.message_count;
    });

    res.json({
      children: children.map(c => ({
        ...c,
        message_count: messageCountMap[c.id] || 0,
        mood_summary: moodSummary[c.id] || { happy: 0, neutral: 0, frustrated: 0, curious: 0, tired: 0 }
      })),
      encouragements: parsedEncouragements,
      quiz_suggestions: parsedQuizSuggestions,
      period_days: parseInt(days as string)
    });
  } catch (error: any) {
    console.error('[AI] Error getting insights:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
