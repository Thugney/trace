import express from 'express';
import axios from 'axios';
import db from '../database/init';

const router = express.Router();

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

// Middleware to check if Grok API is enabled
function checkGrokEnabled(req: express.Request, res: express.Response, next: express.NextFunction) {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey || apiKey === 'your_grok_api_key_here') {
    return res.status(503).json({
      error: 'Grok AI is not configured. Please set GROK_API_KEY in your environment variables.'
    });
  }
  next();
}

// Chat with AI
router.post('/chat', checkGrokEnabled, async (req, res) => {
  try {
    const { profile_id, message, context = 'general' } = req.body;

    if (!profile_id || !message) {
      return res.status(400).json({ error: 'profile_id and message are required' });
    }

    // Get profile to understand user type (parent or child)
    const profile: any = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profile_id);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Build system prompt based on context and user type
    let systemPrompt = '';

    if (profile.type === 'child') {
      systemPrompt = `You are a friendly and encouraging AI assistant helping a ${profile.age}-year-old child named ${profile.name}.
Keep your language age-appropriate, positive, and educational. Focus on helping with tasks, learning, and positive habits.
Be supportive and motivating. Use simple language and examples.`;
    } else {
      systemPrompt = `You are a helpful AI assistant for family management, nutrition, and parenting.
Provide practical advice about diet, meal planning, task management for kids, and family organization.
Be informative, supportive, and family-oriented.`;
    }

    if (context === 'diet') {
      systemPrompt += `\nContext: Focus on nutrition, meal planning, and healthy eating habits for a Norwegian family.
Consider Norwegian food culture and locally available ingredients.`;
    } else if (context === 'tasks') {
      systemPrompt += `\nContext: Focus on task management, productivity, and age-appropriate chores/activities for children.`;
    }

    // Get recent conversation history
    const history = db.prepare(`
      SELECT user_message, ai_response FROM ai_conversations
      WHERE profile_id = ? AND context = ?
      ORDER BY created_at DESC
      LIMIT 5
    `).all(profile_id, context);

    // Build messages array for Grok
    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Add history (reverse order for chronological)
    history.reverse().forEach((h: any) => {
      messages.push(
        { role: 'user', content: h.user_message },
        { role: 'assistant', content: h.ai_response }
      );
    });

    // Add current message
    messages.push({ role: 'user', content: message });

    // Call Grok API
    const response = await axios.post(
      GROK_API_URL,
      {
        model: 'grok-beta',
        messages,
        temperature: 0.7,
        max_tokens: 500
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiResponse = response.data.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    // Save conversation
    db.prepare(`
      INSERT INTO ai_conversations (profile_id, context, user_message, ai_response)
      VALUES (?, ?, ?, ?)
    `).run(profile_id, context, message, aiResponse);

    res.json({
      response: aiResponse,
      profile: { id: profile.id, name: profile.name, type: profile.type }
    });

  } catch (error: any) {
    console.error('Grok API error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to get AI response',
      details: error.response?.data?.error?.message || error.message
    });
  }
});

// Get meal suggestions using AI
router.post('/meal-suggestions', checkGrokEnabled, async (req, res) => {
  try {
    const { profile_id, preferences, dietary_restrictions, num_meals = 3 } = req.body;

    if (!profile_id) {
      return res.status(400).json({ error: 'profile_id is required' });
    }

    const profile: any = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profile_id);

    const prompt = `Suggest ${num_meals} healthy meal ideas for a Norwegian family.
${preferences ? `Preferences: ${preferences}` : ''}
${dietary_restrictions ? `Dietary restrictions: ${dietary_restrictions}` : ''}

Please provide meals that:
- Use ingredients commonly available in Norwegian supermarkets
- Are healthy and balanced
- Include estimated calories and main macros
- Are practical to prepare

Format the response as a JSON array with this structure:
[
  {
    "name": "Meal name",
    "description": "Brief description",
    "calories": 500,
    "protein": 30,
    "carbs": 50,
    "fat": 15,
    "ingredients": ["ingredient 1", "ingredient 2"],
    "meal_type": "breakfast/lunch/dinner"
  }
]`;

    const response = await axios.post(
      GROK_API_URL,
      {
        model: 'grok-beta',
        messages: [
          {
            role: 'system',
            content: 'You are a nutrition expert specializing in Norwegian cuisine and family meal planning.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiResponse = response.data.choices[0]?.message?.content || '[]';

    // Try to parse JSON response
    let meals = [];
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        meals = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // If parsing fails, return raw response
      meals = [{ name: 'AI Suggestion', description: aiResponse }];
    }

    res.json({ meals });

  } catch (error: any) {
    console.error('Grok API error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to get meal suggestions',
      details: error.response?.data?.error?.message || error.message
    });
  }
});

// Get task recommendations using AI
router.post('/task-recommendations', checkGrokEnabled, async (req, res) => {
  try {
    const { profile_id } = req.body;

    if (!profile_id) {
      return res.status(400).json({ error: 'profile_id is required' });
    }

    const profile: any = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profile_id);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (profile.type !== 'child') {
      return res.status(400).json({ error: 'Task recommendations are only for child profiles' });
    }

    const prompt = `Suggest 5 age-appropriate tasks/chores for a ${profile.age}-year-old child named ${profile.name}.

Consider:
- Age-appropriate difficulty
- Educational value
- Life skills development
- Fun and engagement

Format response as JSON array:
[
  {
    "title": "Task title",
    "description": "Brief description",
    "category": "chore/homework/activity/habit",
    "difficulty": "easy/medium/hard",
    "points": 10-30,
    "educational_value": "What the child learns"
  }
]`;

    const response = await axios.post(
      GROK_API_URL,
      {
        model: 'grok-beta',
        messages: [
          {
            role: 'system',
            content: 'You are a child development expert specializing in age-appropriate tasks and activities.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 800
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiResponse = response.data.choices[0]?.message?.content || '[]';

    let tasks = [];
    try {
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        tasks = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      tasks = [{ title: 'AI Suggestion', description: aiResponse }];
    }

    res.json({ tasks, profile: { name: profile.name, age: profile.age } });

  } catch (error: any) {
    console.error('Grok API error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to get task recommendations',
      details: error.response?.data?.error?.message || error.message
    });
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

export default router;
