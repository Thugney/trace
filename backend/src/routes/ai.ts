import express from 'express';
import axios from 'axios';
import db from '../database/init';
import { AuthRequest, authenticate, authenticateEventSource, requireRole, verifyParentChild, verifyOwnership } from '../middleware/auth';

const router = express.Router();

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

// AI Tool definitions for function calling
const AI_TOOLS = [
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
      description: 'Create a new note for the user. Use this when the user wants to save information, reminders, or any text they want to remember.',
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
      description: 'Create a new task or chore for the user. Use this when the user wants to add something to their to-do list or needs help organizing activities.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Title of the task'
          },
          description: {
            type: 'string',
            description: 'Detailed description of the task'
          },
          category: {
            type: 'string',
            enum: ['chore', 'homework', 'health', 'creative', 'social', 'other'],
            description: 'Category of the task'
          },
          difficulty: {
            type: 'string',
            enum: ['easy', 'medium', 'hard'],
            description: 'Difficulty level'
          },
          points: {
            type: 'number',
            description: 'Points awarded for completing (5-50 based on difficulty)'
          },
          due_date: {
            type: 'string',
            description: 'Due date in YYYY-MM-DD format (optional)'
          }
        },
        required: ['title', 'category', 'difficulty', 'points']
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
      case 'add_diet_entry': {
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
        return {
          success: true,
          message: `Added "${args.food_items}" to your ${args.meal_type} log (${args.calories} calories)`,
          data: { id: result.lastInsertRowid, food_id: foodResult.lastInsertRowid, ...args }
        };
      }

      case 'create_note': {
        const result = db.prepare(`
          INSERT INTO notes (profile_id, title, content, color)
          VALUES (?, ?, ?, ?)
        `).run(
          profileId,
          args.title,
          args.content,
          args.color || 'yellow'
        );
        return {
          success: true,
          message: `Created note "${args.title}"`,
          data: { id: result.lastInsertRowid, ...args }
        };
      }

      case 'create_task': {
        const result = db.prepare(`
          INSERT INTO tasks (profile_id, title, description, category, difficulty, points, due_date)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          profileId,
          args.title,
          args.description || '',
          args.category,
          args.difficulty,
          args.points,
          args.due_date || null
        );
        return {
          success: true,
          message: `Created task "${args.title}" (${args.points} points)`,
          data: { id: result.lastInsertRowid, ...args }
        };
      }

      case 'set_monthly_goal': {
        const currentMonth = new Date().toISOString().slice(0, 7);

        // Check if goal exists for this month
        const existing: any = db.prepare(`
          SELECT id FROM monthly_goals WHERE profile_id = ? AND month = ?
        `).get(profileId, currentMonth);

        if (existing) {
          db.prepare(`
            UPDATE monthly_goals SET goal_description = ?, goal_points = ?, reward = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(args.goal_description, args.goal_points, args.reward || '', existing.id);
          return {
            success: true,
            message: `Updated your monthly goal: "${args.goal_description}" (target: ${args.goal_points} points)`,
            data: { id: existing.id, ...args, month: currentMonth }
          };
        } else {
          const result = db.prepare(`
            INSERT INTO monthly_goals (profile_id, month, goal_description, goal_points, reward)
            VALUES (?, ?, ?, ?, ?)
          `).run(profileId, currentMonth, args.goal_description, args.goal_points, args.reward || '');
          return {
            success: true,
            message: `Set your monthly goal: "${args.goal_description}" (target: ${args.goal_points} points)`,
            data: { id: result.lastInsertRowid, ...args, month: currentMonth }
          };
        }
      }

      default:
        return { success: false, message: `Unknown tool: ${toolName}` };
    }
  } catch (error: any) {
    console.error(`[AI Tool] Error executing ${toolName}:`, error);
    return { success: false, message: `Failed to execute ${toolName}: ${error.message}` };
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

  return {
    profile,
    taskStats: taskStats || { total_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    recentTasks: recentTasks || [],
    completedTasks: completedTasks || [],
    progress: progress || { total_points: 0, total_stars: 0, level: 1 },
    monthlyGoal,
    allGoals: allGoals || [],
    dietSummary: dietSummary || { total_calories: 0, total_protein: 0 },
    recentNotes: recentNotes || [],
    schoolEnrollments: schoolEnrollments || [],
    schoolAssignments: schoolAssignments || [],
    schoolProgress: schoolProgress || []
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
router.get('/chat', authenticateEventSource, requireRole(['admin', 'parent', 'child', 'teacher']), async (req: AuthRequest, res) => {
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

COMPLETE PROFILE CONTEXT (Use this to provide personalized, helpful responses):

Progress & Achievements:
- Points: ${profileContext.progress.total_points} | Stars: ${profileContext.progress.total_stars} | Level: ${profileContext.progress.level}
- Total tasks: ${profileContext.taskStats.total_tasks} (${profileContext.taskStats.completed_tasks} completed, ${profileContext.taskStats.overdue_tasks} overdue)
${profileContext.monthlyGoal ? `- Current Month Goal: ${profileContext.monthlyGoal.goal_description} (Target: ${profileContext.monthlyGoal.goal_points} pts, Achieved: ${profileContext.monthlyGoal.achieved ? 'Yes' : 'In Progress'})` : ''}

${profileContext.allGoals.length > 0 ? `Past Goals History:
${profileContext.allGoals.map((g: any) => `- ${g.month}: ${g.goal_description} (${g.achieved ? '✓ Achieved' : 'Not achieved'})`).join('\n')}` : ''}

${profileContext.recentTasks.length > 0 ? `Upcoming Tasks:
${profileContext.recentTasks.map((t: any) => `- ${t.title} (${t.category}, ${t.difficulty}, ${t.points} pts${t.due_date ? `, due: ${t.due_date}` : ''})`).join('\n')}` : ''}

${profileContext.completedTasks.length > 0 ? `Recently Completed Tasks:
${profileContext.completedTasks.map((t: any) => `- ${t.title} (+${t.points} pts, completed ${t.completed_at})`).join('\n')}` : ''}

${profileContext.schoolEnrollments.length > 0 ? `School Classes:
${profileContext.schoolEnrollments.map((e: any) => `- ${e.class_name}: ${e.description || 'No description'}`).join('\n')}` : ''}

${profileContext.schoolAssignments.length > 0 ? `School Assignments:
${profileContext.schoolAssignments.map((a: any) => `- ${a.title} (${a.class_name}, Type: ${a.type || 'homework'}${a.due_date ? `, Due: ${a.due_date}` : ''})`).join('\n')}` : ''}

${profileContext.schoolProgress.length > 0 ? `School Progress:
${profileContext.schoolProgress.map((p: any) => `- ${p.class_name}: Attendance ${p.attendance_percentage || 0}%, Participation ${p.participation_score || 0}%, Overall ${p.overall_grade || 'N/A'}`).join('\n')}` : ''}

${profileContext.recentNotes.length > 0 ? `Recent Notes:
${profileContext.recentNotes.slice(0, 5).map((n: any) => `- ${n.title}: ${n.content.substring(0, 100)}${n.content.length > 100 ? '...' : ''}`).join('\n')}` : ''}

Diet & Health:
- Today's calories: ${profileContext.dietSummary.total_calories || 0} kcal, Protein: ${profileContext.dietSummary.total_protein || 0}g

Use this information to give personalized, contextual advice and encouragement!`;
        } else {
          systemPrompt = `You are a friendly AI assistant helping ${profile.age}-year-old ${profile.name}.
Keep language age-appropriate and focus on being helpful and educational.

Profile Context:
- Points: ${profileContext.progress.total_points} | Level: ${profileContext.progress.level}
- Tasks: ${profileContext.taskStats.total_tasks} total, ${profileContext.taskStats.completed_tasks} completed
${profileContext.schoolAssignments.length > 0 ? `- School assignments: ${profileContext.schoolAssignments.length} pending` : ''}

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
      systemPrompt += `\n\nIMPORTANT - You have access to tools that can help the user:
- When the user asks for meal suggestions, recipes, or food ideas, use the add_diet_entry tool to save it to their diet log
- When the user wants to remember something or save information, use the create_note tool
- When the user wants to add a task, chore, or activity, use the create_task tool
- When the user wants to set a monthly goal, use the set_monthly_goal tool

ALWAYS use the appropriate tool when it makes sense to help the user. After using a tool, confirm what you did in your response.`;

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
        // First, call Grok API with tools (non-streaming to check for tool calls)
        const apiKey = getGrokApiKey();

        // First API call - check for tool calls
        const toolCheckResponse = await axios.post(
          GROK_API_URL,
          {
            model: 'grok-3-mini',  // Use faster model for tool detection
            messages,
            tools: AI_TOOLS,
            tool_choice: 'auto',
            temperature: 0.7,
            max_tokens: 500
          },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );

        const toolCheckMessage = toolCheckResponse.data.choices?.[0]?.message;
        let toolResults: { toolName: string; result: any }[] = [];

        // Check if the AI wants to call tools
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
        const response = await axios.post(
          GROK_API_URL,
          {
            model: 'grok-3-mini',  // Grok model
            messages,
            temperature: 0.7,
            max_tokens: 500,
            stream: true  // Enable streaming
          },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000,
            responseType: 'stream'  // Receive stream
          }
        );

        // Set up SSE (Server-Sent Events) for streaming to frontend
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        let fullResponse = '';

        // Handle streaming data from Grok
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
  res.json({
    apiConfigured: isGrokAvailable(),
    fallbackMode: !isGrokAvailable()
  });
});

export default router;
