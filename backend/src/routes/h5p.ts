/**
 * H5P Routes - API endpoints for H5P content management and playback
 *
 * Provides:
 * - Content creation (manual and AI-generated)
 * - Content listing and management
 * - Player endpoint for rendering H5P content
 * - xAPI event handling for tracking scores
 * - Assignment management
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { requireFeature } from '../middleware/feature-access';
import { db } from '../database/init';
import {
  initializeH5P,
  getH5PEditor,
  getH5PPlayer,
  createH5PUser,
  createH5PContent,
  updateH5PContent,
  getH5PContentForPlay,
  deleteH5PContent,
  getInstalledContentTypes,
  convertQuizSpecToH5P,
  extractQuizSpecFromAiPrompt,
  questionSetNeedsRepair,
  validateQuizSpec,
  installLibraryFromFile,
  installLibraryFromHub,
  getAvailableContentTypes,
  importH5PContent,
  checkRequiredLibraries,
  getRunnableContentTypes,
  H5P_PATHS,
  QuizSpec,
  // Standalone content converters
  convertMemoryGameToH5P,
  convertFlashcardsToH5P,
  convertFindTheWordsToH5P,
  convertDialogCardsToH5P,
  copyCardImagesToH5PContent,
  MemoryGameSpec,
  FlashcardsSpec,
  FindTheWordsSpec,
  DialogCardsSpec,
  MemoryGameCardImages
} from '../services/h5pService';
import { canGenerateAi, logAiUsage, estimateCost } from '../services/aiUsageControl';
import { sendPushNotification } from '../services/notifications';
import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import axios from 'axios';

// ==================== AI PROVIDER CONFIGURATION ====================

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const getOllamaUrl = (): string | null => {
  let url = process.env.OLLAMA_URL;
  if (!url || url.trim() === '') {
    try {
      const setting: any = db.prepare('SELECT value FROM settings WHERE key = ?').get('ollama_url');
      if (setting?.value) url = setting.value;
    } catch (error) {
      console.error('Failed to read ollama_url from settings:', error);
    }
  }
  return url && url.trim() !== '' ? url : null;
};

const getOllamaModel = (): string => {
  let model = process.env.OLLAMA_MODEL;
  if (!model || model.trim() === '') {
    try {
      const setting: any = db.prepare('SELECT value FROM settings WHERE key = ?').get('ollama_model');
      if (setting?.value) model = setting.value;
    } catch (error) {
      console.error('Failed to read ollama_model from settings:', error);
    }
  }
  return model && model.trim() !== '' ? model : 'llama3.2';
};

const getGrokApiKey = (): string | null => {
  let apiKey = process.env.GROK_API_KEY;
  if (!apiKey || apiKey === 'your_grok_api_key_here' || apiKey.trim() === '') {
    try {
      const setting: any = db.prepare('SELECT value FROM settings WHERE key = ?').get('grok_api_key');
      if (setting?.value) apiKey = setting.value;
    } catch (error) {
      console.error('Failed to read grok_api_key from settings:', error);
    }
  }
  return apiKey && apiKey !== 'your_grok_api_key_here' && apiKey.trim() !== '' ? apiKey : null;
};

const getOpenAiApiKey = (): string | null => {
  let apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    try {
      const setting: any = db.prepare('SELECT value FROM settings WHERE key = ?').get('openai_api_key');
      if (setting?.value) apiKey = setting.value;
    } catch (error) {
      console.error('Failed to read openai_api_key from settings:', error);
    }
  }
  return apiKey && apiKey.trim() !== '' ? apiKey : null;
};

const getGeminiApiKey = (): string | null => {
  let apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    try {
      const setting: any = db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_api_key');
      if (setting?.value) apiKey = setting.value;
    } catch (error) {
      console.error('Failed to read gemini_api_key from settings:', error);
    }
  }
  return apiKey && apiKey.trim() !== '' ? apiKey : null;
};

// ==================== AI HELPERS ====================

const stripCodeFences = (content: string) => {
  return content.replace(/```json/gi, '```').replace(/```/g, '').trim();
};

const extractJsonBlock = (content: string) => {
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    const firstBracket = content.indexOf('[');
    const lastBracket = content.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      return content.slice(firstBracket, lastBracket + 1);
    }
    return null;
  }
  return content.slice(firstBrace, lastBrace + 1);
};

const removeTrailingCommas = (content: string) => {
  return content.replace(/,\s*([}\]])/g, '$1');
};

const parseAiJson = (content: string) => {
  const cleaned = stripCodeFences(content);
  const candidates = [extractJsonBlock(cleaned), cleaned].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        return JSON.parse(removeTrailingCommas(candidate));
      } catch {
        continue;
      }
    }
  }
  throw new Error('Failed to parse AI JSON response');
};

async function callAiProvider(provider: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const ollamaUrl = getOllamaUrl();
  const ollamaModel = getOllamaModel();
  const grokKey = getGrokApiKey();
  const openaiKey = getOpenAiApiKey();
  const geminiKey = getGeminiApiKey();

  // Try preferred provider first
  if (provider === 'ollama' && ollamaUrl) {
    return await callOllama(ollamaUrl, ollamaModel, systemPrompt, userPrompt);
  }
  if (provider === 'gemini' && geminiKey) {
    return await callGemini(geminiKey, systemPrompt, userPrompt);
  }
  if (provider === 'grok' && grokKey) {
    return await callGrok(grokKey, systemPrompt, userPrompt);
  }
  if (provider === 'openai' && openaiKey) {
    return await callOpenAi(openaiKey, systemPrompt, userPrompt);
  }

  // Fallback chain
  if (ollamaUrl) return await callOllama(ollamaUrl, ollamaModel, systemPrompt, userPrompt);
  if (geminiKey) return await callGemini(geminiKey, systemPrompt, userPrompt);
  if (grokKey) return await callGrok(grokKey, systemPrompt, userPrompt);
  if (openaiKey) return await callOpenAi(openaiKey, systemPrompt, userPrompt);

  throw new Error('No AI provider available');
}

async function callOllama(url: string, model: string, system: string, user: string): Promise<string> {
  const response = await axios.post(url, {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    stream: false
  }, { timeout: 120000 });

  return response.data?.message?.content || '';
}

async function callGemini(apiKey: string, system: string, user: string): Promise<string> {
  const response = await axios.post(
    `${GEMINI_API_URL}?key=${apiKey}`,
    {
      contents: [{
        parts: [{ text: `${system}\n\n${user}` }]
      }],
      generationConfig: { temperature: 0.7 }
    },
    { timeout: 60000 }
  );

  return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callGrok(apiKey: string, system: string, user: string): Promise<string> {
  const response = await axios.post(
    GROK_API_URL,
    {
      model: 'grok-3-latest',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.7
    },
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 60000
    }
  );

  return response.data?.choices?.[0]?.message?.content || '';
}

async function callOpenAi(apiKey: string, system: string, user: string): Promise<string> {
  const response = await axios.post(
    OPENAI_CHAT_URL,
    {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7
    },
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 60000
    }
  );

  return response.data?.choices?.[0]?.message?.content || '';
}

function getQuizGenerationPrompt(
  theme: string,
  age: number,
  questionCount: number,
  quizType: string = 'mixed',
  answerStyle: string = 'default',
  customInstructions: string = ''
): { system: string; user: string } {
  // Determine question type instructions based on quizType
  let typeInstructions = '';
  let questionTypesAllowed = '';

  if (quizType === 'mcq_only') {
    typeInstructions = 'Create ONLY multiple choice questions (mcq type).';
    questionTypesAllowed = `Question type to use:
- "mcq" (multiple choice): needs "choices" array (4 options) and "answerIndex" (0-3)`;
  } else if (quizType === 'true_false_only') {
    typeInstructions = 'Create ONLY true/false questions (true_false type).';
    questionTypesAllowed = `Question type to use:
- "true_false": needs "correctAnswer" (boolean)`;
  } else if (quizType === 'fill_blank') {
    typeInstructions = 'Create ONLY fill-in-the-blank questions (fill_blank type).';
    questionTypesAllowed = `Question type to use:
- "fill_blank": needs "prompt" with ___ where the blank is, and "correctAnswer" (the word/phrase that fills the blank)`;
  } else if (quizType === 'drag_text') {
    typeInstructions = 'Create ONLY drag-the-word questions (drag_text type).';
    questionTypesAllowed = `Question type to use:
- "drag_text": needs "prompt" with instruction, and "textWithDraggables" with *asterisks* around words to drag`;
  } else if (quizType === 'mark_words') {
    typeInstructions = 'Create ONLY mark-the-words questions (mark_words type).';
    questionTypesAllowed = `Question type to use:
- "mark_words": needs "prompt" with instruction, and "textWithMarks" with *asterisks* around correct words to click`;
  } else if (quizType === 'mixed_advanced') {
    typeInstructions = 'Create a varied mix using MCQ, True/False, Fill in the Blank, Drag Text, and Mark Words.';
    questionTypesAllowed = `Question types you can use (vary them for an engaging quiz):
- "mcq" (multiple choice): needs "choices" array (4 options) and "answerIndex" (0-3)
- "true_false": needs "correctAnswer" (boolean)
- "fill_blank": needs "prompt" with ___ and "correctAnswer" (the word)
- "drag_text": needs "textWithDraggables" with *words* to drag, and "correctAnswer" array
- "mark_words": needs "textWithMarks" with *words* to click, and "correctAnswer" array`;
  } else {
    typeInstructions = 'Create a good mix of multiple choice and true/false questions.';
    questionTypesAllowed = `Question types you can use:
- "mcq" (multiple choice): needs "choices" array (4 options) and "answerIndex" (0-3)
- "true_false": needs "correctAnswer" (boolean)`;
  }

  // Answer style instructions
  let answerStyleInstructions = '';
  if (answerStyle === 'abcd') {
    answerStyleInstructions = '\nFor multiple choice questions, prefix each choice with A), B), C), D) in the text.';
  } else if (answerStyle === 'numbered') {
    answerStyleInstructions = '\nFor multiple choice questions, prefix each choice with 1), 2), 3), 4) in the text.';
  }

  // Custom instructions section
  let customSection = '';
  if (customInstructions && customInstructions.trim()) {
    customSection = `\n\nADDITIONAL INSTRUCTIONS FROM PARENT:\n${customInstructions.trim()}`;
  }

  return {
    system: `You are an expert educational quiz creator for children. Create age-appropriate, engaging quiz questions.

CRITICAL REQUIREMENTS:
1. Return ONLY valid JSON, no explanation or markdown
2. EVERY SINGLE QUESTION must be DIRECTLY about the specific topic: "${theme}"
3. DO NOT include ANY questions about unrelated topics like capitals, countries, or general knowledge unless the theme specifically asks for it
4. If the theme is about a specific subject (e.g., "Eritrea's Past"), ALL questions must be about that exact subject

The JSON format must be:
{
  "title": "Quiz title about ${theme}",
  "theme": "${theme}",
  "age": ${age},
  "questions": [
    // ALL questions MUST be about "${theme}" - no exceptions!
  ]
}

Question formats:
- "mcq": {"type": "mcq", "prompt": "Question?", "choices": ["A", "B", "C", "D"], "answerIndex": 0, "explanation": "Why"}
- "true_false": {"type": "true_false", "prompt": "Statement", "correctAnswer": true, "explanation": "Why"}
- "fill_blank": {"type": "fill_blank", "prompt": "Sentence with ___ blank.", "correctAnswer": "answer", "explanation": "Why"}

RULES FOR FILL_BLANK QUESTIONS:
- The "prompt" MUST contain exactly three underscores (___) where the blank goes
- The prompt must be about "${theme}" - NOT generic examples
- Do NOT put the answer in the prompt - only in "correctAnswer"
- Do NOT use asterisks (*) in the prompt

${questionTypesAllowed}${answerStyleInstructions}

Guidelines for age ${age}:
${age <= 6 ? '- Use very simple words and short sentences\n- Focus on colors, animals, shapes, counting\n- Make questions fun and engaging with simple facts' : ''}
${age >= 7 && age <= 10 ? '- Use clear, straightforward language\n- Include interesting facts they can learn\n- Mix easy and medium difficulty' : ''}
${age >= 11 ? '- Can use more complex vocabulary\n- Include challenging but achievable questions\n- Cover deeper knowledge about the topic' : ''}

${typeInstructions} Create exactly ${questionCount} questions about "${theme}".${customSection}`,
    user: `Create ${questionCount} educational quiz questions SPECIFICALLY about "${theme}" for a ${age}-year-old child.

IMPORTANT: Every question must be directly related to "${theme}". Do not include any questions about other topics.`
  };
}

async function generateQuizWithAI(
  theme: string,
  age: number,
  questionCount: number,
  provider: string,
  quizType: string = 'mixed',
  answerStyle: string = 'default',
  customInstructions: string = ''
): Promise<QuizSpec> {
  const prompt = getQuizGenerationPrompt(theme, age, questionCount, quizType, answerStyle, customInstructions);
  const response = await callAiProvider(provider, prompt.system, prompt.user);
  const parsed = parseAiJson(response);

  // Validate the parsed quiz spec
  const validation = validateQuizSpec(parsed);
  if (!validation.valid) {
    console.error('[H5P AI] Generated quiz failed validation:', validation.errors);
    throw new Error(`Generated quiz is invalid: ${validation.errors.join(', ')}`);
  }

  return parsed as QuizSpec;
}

// ==================== STANDALONE CONTENT AI GENERATION ====================

function getStandaloneContentPrompt(
  contentType: 'memory_game' | 'flashcards' | 'word_search' | 'dialog_cards',
  theme: string,
  age: number,
  itemCount: number,
  customInstructions: string = ''
): { system: string; user: string } {
  const customSection = customInstructions?.trim() ? `\n\nADDITIONAL INSTRUCTIONS:\n${customInstructions}` : '';

  if (contentType === 'memory_game') {
    return {
      system: `You create memory matching games for children. Return ONLY valid JSON.

Format:
{
  "title": "Memory Game: [Theme]",
  "description": "Match the pairs!",
  "pairs": [
    { "text": "Apple", "matchingText": "A red fruit" },
    { "text": "Banana", "matchingText": "A yellow fruit" }
  ]
}

Create ${itemCount} pairs. Each pair has a "text" (main card) and "matchingText" (matching card).
For age ${age}: ${age <= 6 ? 'Use simple, familiar words' : age <= 10 ? 'Include interesting facts' : 'Can use more complex vocabulary'}.${customSection}`,
      user: `Create a memory matching game about "${theme}" for a ${age}-year-old with ${itemCount} pairs.`
    };
  }

  if (contentType === 'flashcards') {
    return {
      system: `You create educational flashcards for children. Return ONLY valid JSON.

Format:
{
  "title": "Flashcards: [Theme]",
  "description": "Learn about [theme]!",
  "cards": [
    { "front": "What is the capital of France?", "back": "Paris" },
    { "front": "How many planets in our solar system?", "back": "8 planets" }
  ]
}

Create ${itemCount} cards. Each card has "front" (question/term) and "back" (answer/definition).
For age ${age}: ${age <= 6 ? 'Use simple questions and short answers' : age <= 10 ? 'Include interesting facts' : 'Can be more detailed'}.${customSection}`,
      user: `Create flashcards about "${theme}" for a ${age}-year-old with ${itemCount} cards.`
    };
  }

  if (contentType === 'word_search') {
    return {
      system: `You create word search puzzles for children. Return ONLY valid JSON.

Format:
{
  "title": "Word Search: [Theme]",
  "description": "Find the hidden words about [theme]!",
  "words": ["APPLE", "BANANA", "ORANGE", "GRAPE", "MANGO"]
}

Create ${itemCount} words. Words should be UPPERCASE, single words (no spaces), 3-10 letters for younger kids, up to 12 for older.
For age ${age}: ${age <= 6 ? 'Use 3-5 letter simple words' : age <= 10 ? 'Use 4-8 letter words' : 'Can use longer, more complex words'}.${customSection}`,
      user: `Create a word search puzzle about "${theme}" for a ${age}-year-old with ${itemCount} words.`
    };
  }

  // dialog_cards
  return {
    system: `You create dialog/flip cards for children to study. Return ONLY valid JSON.

Format:
{
  "title": "Study Cards: [Theme]",
  "description": "Flip to learn!",
  "cards": [
    { "front": "Photosynthesis", "back": "The process by which plants make food using sunlight", "tips": "Think about what plants need to grow" },
    { "front": "Mammal", "back": "A warm-blooded animal that feeds milk to its babies" }
  ]
}

Create ${itemCount} cards. Each has "front" (term/concept), "back" (definition/explanation), and optional "tips".
For age ${age}: ${age <= 6 ? 'Use simple terms with short explanations' : age <= 10 ? 'Include helpful tips' : 'Can use academic vocabulary'}.${customSection}`,
    user: `Create study cards about "${theme}" for a ${age}-year-old with ${itemCount} cards.`
  };
}

async function generateStandaloneContentWithAI(
  contentType: 'memory_game' | 'flashcards' | 'word_search' | 'dialog_cards',
  theme: string,
  age: number,
  itemCount: number,
  provider: string,
  customInstructions: string = ''
): Promise<any> {
  const prompt = getStandaloneContentPrompt(contentType, theme, age, itemCount, customInstructions);
  const response = await callAiProvider(provider, prompt.system, prompt.user);
  const parsed = parseAiJson(response);

  // Basic validation
  if (!parsed.title) {
    throw new Error('Generated content missing title');
  }

  if (contentType === 'memory_game' && (!Array.isArray(parsed.pairs) || parsed.pairs.length === 0)) {
    throw new Error('Memory game missing pairs');
  }
  if (contentType === 'flashcards' && (!Array.isArray(parsed.cards) || parsed.cards.length === 0)) {
    throw new Error('Flashcards missing cards');
  }
  if (contentType === 'word_search' && (!Array.isArray(parsed.words) || parsed.words.length === 0)) {
    throw new Error('Word search missing words');
  }
  if (contentType === 'dialog_cards' && (!Array.isArray(parsed.cards) || parsed.cards.length === 0)) {
    throw new Error('Dialog cards missing cards');
  }

  return parsed;
}

const router = Router();

// Initialize H5P on first request (lazy loading)
let h5pInitialized = false;

async function ensureH5PInitialized(): Promise<void> {
  if (!h5pInitialized) {
    await initializeH5P();
    h5pInitialized = true;
  }
}

// ==================== PUBLIC ROUTES (for static H5P assets) ====================

// Serve H5P core files
router.use('/core', express.static(H5P_PATHS.core));

// Serve H5P editor files
router.use('/editor', express.static(H5P_PATHS.editor));

// Serve H5P libraries
router.use('/libraries', express.static(H5P_PATHS.libraries));

// Serve H5P content files (images, videos, etc.)
router.use('/content', express.static(H5P_PATHS.content));

// Serve generated card images (for Memory Game text cards)
router.use('/card-images', express.static(H5P_PATHS.cardImages, {
  setHeaders: (res, filePath) => {
    // Set correct content type for SVG files
    if (filePath.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    }
  }
}));

// ==================== AUTHENTICATED ROUTES ====================

router.use(authenticate, requireFeature('activities'));

// Get available AI providers for quiz generation
router.get('/ai-providers', async (req: Request, res: Response) => {
  try {
    const providers: Array<{ id: string; name: string; available: boolean; model?: string }> = [];

    const ollamaUrl = getOllamaUrl();
    const ollamaModel = getOllamaModel();
    if (ollamaUrl) {
      providers.push({
        id: 'ollama',
        name: `Ollama (${ollamaModel})`,
        available: true,
        model: ollamaModel
      });
    }

    if (getGeminiApiKey()) {
      providers.push({ id: 'gemini', name: 'Google Gemini', available: true });
    }

    if (getGrokApiKey()) {
      providers.push({ id: 'grok', name: 'xAI Grok', available: true });
    }

    if (getOpenAiApiKey()) {
      providers.push({ id: 'openai', name: 'OpenAI GPT-4', available: true });
    }

    res.json({
      providers,
      defaultProvider: 'auto',
      hasAnyProvider: providers.length > 0
    });
  } catch (error: any) {
    console.error('[H5P] Error getting AI providers:', error);
    res.status(500).json({ error: 'Failed to get AI providers' });
  }
});

// Configure multer for H5P file uploads
const h5pUploadDir = path.join(H5P_PATHS.data, 'uploads');
if (!fs.existsSync(h5pUploadDir)) {
  fs.mkdirSync(h5pUploadDir, { recursive: true });
}

const h5pUpload = multer({
  storage: multer.diskStorage({
    destination: h5pUploadDir,
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `h5p-${uniqueSuffix}.h5p`);
    }
  }),
  fileFilter: (req, file, cb) => {
    // Accept only .h5p files
    if (file.originalname.endsWith('.h5p') || file.mimetype === 'application/zip') {
      cb(null, true);
    } else {
      cb(new Error('Only .h5p files are allowed'));
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max
  }
});

// Upload and install an H5P library package (admin/parent only)
router.post('/libraries/upload', h5pUpload.single('h5pFile'), async (req: Request, res: Response) => {
  try {
    await ensureH5PInitialized();
    const profile = (req as any).profile;

    if (profile.type !== 'parent' && profile.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents/admins can install H5P libraries' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No H5P file uploaded' });
    }

    const filePath = req.file.path;
    const h5pUser = createH5PUser(profile.id, profile.name);

    console.log(`[H5P] Installing library from uploaded file: ${filePath}`);
    console.log(`[H5P] File size: ${req.file.size} bytes`);
    console.log(`[H5P] Original name: ${req.file.originalname}`);

    const result = await installLibraryFromFile(filePath, h5pUser);
    console.log(`[H5P] Installation result:`, result);

    // Clean up the uploaded file
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.warn('[H5P] Could not delete temp file:', e);
    }

    // Get updated content types
    const contentTypes = await getInstalledContentTypes();

    res.json({
      success: true,
      message: 'H5P library installed successfully',
      installedContentTypes: contentTypes,
      contentTypesCount: contentTypes.length
    });
  } catch (error: any) {
    console.error('[H5P] Error installing library:', error);

    // Clean up on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }

    res.status(500).json({ error: 'Failed to install H5P library', details: error.message });
  }
});

// Import H5P content (both libraries AND content) from uploaded .h5p file
router.post('/content/import', h5pUpload.single('h5pFile'), async (req: Request, res: Response) => {
  try {
    await ensureH5PInitialized();
    const profile = (req as any).profile;

    if (profile.type !== 'parent' && profile.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents/admins can import H5P content' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No H5P file uploaded' });
    }

    const filePath = req.file.path;
    const h5pUser = createH5PUser(profile.id, profile.name);

    console.log(`[H5P] Importing content from uploaded file: ${filePath}`);
    console.log(`[H5P] File size: ${req.file.size} bytes`);
    console.log(`[H5P] Original name: ${req.file.originalname}`);

    const result = await importH5PContent(filePath, h5pUser);

    // Clean up the uploaded file
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.warn('[H5P] Could not delete temp file:', e);
    }

    if (result.errors.length > 0) {
      return res.status(500).json({
        error: 'Failed to import H5P content',
        details: result.errors.join(', ')
      });
    }

    // If content was created, save it to the database
    let dbContentId: number | null = null;
    if (result.contentId && result.metadata) {
      const mainLibrary = result.metadata.mainLibrary;
      const preloaded = result.metadata.preloadedDependencies || [];
      const mainDep = preloaded.find((d: any) => d.machineName === mainLibrary);
      const libraryString = mainDep
        ? `${mainDep.machineName} ${mainDep.majorVersion}.${mainDep.minorVersion}`
        : mainLibrary;

      // Determine content type from library name
      const contentType = mainLibrary?.replace('H5P.', '') || 'Unknown';

      const insertResult = db.prepare(`
        INSERT INTO h5p_content (
          h5p_content_id, title, content_type, library_name, created_by,
          metadata, is_ai_generated
        ) VALUES (?, ?, ?, ?, ?, ?, 0)
      `).run(
        result.contentId,
        result.metadata.title || req.file.originalname.replace('.h5p', ''),
        contentType,
        libraryString,
        profile.id,
        JSON.stringify(result.metadata)
      );

      dbContentId = Number(insertResult.lastInsertRowid);
    }

    // Get updated content types
    const contentTypes = await getInstalledContentTypes();

    res.json({
      success: true,
      message: result.contentId
        ? 'H5P content imported successfully'
        : 'H5P libraries installed (no content in package)',
      contentId: dbContentId,
      h5pContentId: result.contentId,
      title: result.metadata?.title || null,
      installedLibraries: result.installedLibraries,
      installedContentTypes: contentTypes,
      contentTypesCount: contentTypes.length
    });
  } catch (error: any) {
    console.error('[H5P] Error importing content:', error);

    // Clean up on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }

    res.status(500).json({ error: 'Failed to import H5P content', details: error.message });
  }
});

// Install library from downloaded .h5p files (in downloads folder)
router.post('/libraries/install-from-downloads', async (req: Request, res: Response) => {
  try {
    await ensureH5PInitialized();
    const profile = (req as any).profile;

    if (profile.type !== 'parent' && profile.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents/admins can install H5P libraries' });
    }

    const { filename } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'filename is required' });
    }

    const downloadsDir = H5P_PATHS.downloads;
    const filePath = path.join(downloadsDir, filename);

    // Security check - ensure file is in downloads directory
    if (!filePath.startsWith(downloadsDir)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found in downloads folder' });
    }

    const h5pUser = createH5PUser(profile.id, profile.name);

    console.log(`[H5P] Installing library from downloads: ${filePath}`);

    await installLibraryFromFile(filePath, h5pUser);

    // Get updated content types
    const contentTypes = await getInstalledContentTypes();

    res.json({
      success: true,
      message: `Installed ${filename} successfully`,
      installedContentTypes: contentTypes,
      contentTypesCount: contentTypes.length
    });
  } catch (error: any) {
    console.error('[H5P] Error installing library from downloads:', error);
    res.status(500).json({ error: 'Failed to install H5P library', details: error.message });
  }
});

// List available .h5p files in downloads folder
router.get('/libraries/downloads', async (req: Request, res: Response) => {
  try {
    const profile = (req as any).profile;

    if (profile.type !== 'parent' && profile.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents/admins can view downloads' });
    }

    const downloadsDir = H5P_PATHS.downloads;

    if (!fs.existsSync(downloadsDir)) {
      return res.json({ files: [] });
    }

    const files = fs.readdirSync(downloadsDir)
      .filter(f => f.endsWith('.h5p'))
      .map(f => {
        const stats = fs.statSync(path.join(downloadsDir, f));
        return {
          filename: f,
          size: stats.size,
          downloadedAt: stats.mtime
        };
      });

    res.json({ files });
  } catch (error: any) {
    console.error('[H5P] Error listing downloads:', error);
    res.status(500).json({ error: 'Failed to list downloads', details: error.message });
  }
});

// Install all .h5p files from downloads folder
router.post('/libraries/install-all-downloads', async (req: Request, res: Response) => {
  try {
    await ensureH5PInitialized();
    const profile = (req as any).profile;

    if (profile.type !== 'parent' && profile.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents/admins can install H5P libraries' });
    }

    const downloadsDir = H5P_PATHS.downloads;

    if (!fs.existsSync(downloadsDir)) {
      return res.json({ installed: [], errors: [], message: 'No downloads folder' });
    }

    const h5pFiles = fs.readdirSync(downloadsDir).filter(f => f.endsWith('.h5p'));

    if (h5pFiles.length === 0) {
      return res.json({ installed: [], errors: [], message: 'No .h5p files in downloads' });
    }

    const h5pUser = createH5PUser(profile.id, profile.name);
    const installed: string[] = [];
    const errors: { file: string; error: string }[] = [];

    for (const filename of h5pFiles) {
      const filePath = path.join(downloadsDir, filename);
      try {
        console.log(`[H5P] Installing: ${filename}`);
        await installLibraryFromFile(filePath, h5pUser);
        installed.push(filename);
      } catch (err: any) {
        console.error(`[H5P] Error installing ${filename}:`, err);
        errors.push({ file: filename, error: err.message });
      }
    }

    // Get updated content types
    const contentTypes = await getInstalledContentTypes();

    res.json({
      installed,
      errors,
      installedContentTypes: contentTypes,
      contentTypesCount: contentTypes.length
    });
  } catch (error: any) {
    console.error('[H5P] Error installing all downloads:', error);
    res.status(500).json({ error: 'Failed to install H5P libraries', details: error.message });
  }
});

// Get available content types from H5P Hub
router.get('/hub/content-types', async (req: Request, res: Response) => {
  try {
    await ensureH5PInitialized();
    const contentTypes = await getAvailableContentTypes();

    res.json({
      contentTypes: contentTypes.map((ct: any) => ({
        id: ct.id,
        machineName: ct.id,
        title: ct.title,
        summary: ct.summary,
        description: ct.description,
        icon: ct.icon,
        categories: ct.categories,
        isRecommended: ct.isRecommended,
        installed: ct.installed,
        restricted: ct.restricted
      }))
    });
  } catch (error: any) {
    console.error('[H5P] Error fetching hub content types:', error);
    res.status(500).json({ error: 'Failed to fetch content types from Hub', details: error.message });
  }
});

// Install a library from H5P Hub
router.post('/hub/install', async (req: Request, res: Response) => {
  try {
    await ensureH5PInitialized();
    const profile = (req as any).profile;

    if (profile.type !== 'parent' && profile.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents/admins can install H5P libraries' });
    }

    const { machineName } = req.body;

    if (!machineName) {
      return res.status(400).json({ error: 'machineName is required' });
    }

    const h5pUser = createH5PUser(profile.id, profile.name);

    console.log(`[H5P] Installing ${machineName} from H5P Hub...`);

    const result = await installLibraryFromHub(machineName, h5pUser);

    if (result.errors.length > 0) {
      return res.status(500).json({
        success: false,
        error: result.errors.join(', '),
        installed: result.installed
      });
    }

    // Get updated content types
    const contentTypes = await getInstalledContentTypes();

    res.json({
      success: true,
      message: `Installed ${machineName} and dependencies`,
      installed: result.installed,
      installedContentTypes: contentTypes,
      contentTypesCount: contentTypes.length
    });
  } catch (error: any) {
    console.error('[H5P] Error installing from Hub:', error);
    res.status(500).json({ error: 'Failed to install from H5P Hub', details: error.message });
  }
});

// Install multiple essential libraries from H5P Hub
router.post('/hub/install-essentials', async (req: Request, res: Response) => {
  try {
    await ensureH5PInitialized();
    const profile = (req as any).profile;

    if (profile.type !== 'parent' && profile.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents/admins can install H5P libraries' });
    }

    const essentialLibraries = [
      'H5P.QuestionSet',
      'H5P.MultiChoice',
      'H5P.TrueFalse',
      'H5P.Blanks',
      'H5P.DragQuestion',
      'H5P.MemoryGame',
      'H5P.Flashcards'
    ];

    const h5pUser = createH5PUser(profile.id, profile.name);
    const results: { library: string; success: boolean; installed: string[]; error?: string }[] = [];

    for (const lib of essentialLibraries) {
      console.log(`[H5P] Installing ${lib}...`);
      const result = await installLibraryFromHub(lib, h5pUser);
      results.push({
        library: lib,
        success: result.errors.length === 0,
        installed: result.installed,
        error: result.errors.length > 0 ? result.errors.join(', ') : undefined
      });
    }

    const successCount = results.filter(r => r.success).length;
    const contentTypes = await getInstalledContentTypes();

    res.json({
      success: successCount > 0,
      message: `Installed ${successCount}/${essentialLibraries.length} essential libraries`,
      results,
      installedContentTypes: contentTypes,
      contentTypesCount: contentTypes.length
    });
  } catch (error: any) {
    console.error('[H5P] Error installing essentials:', error);
    res.status(500).json({ error: 'Failed to install essential libraries', details: error.message });
  }
});

// Get H5P service status and installed content types
router.get('/status', async (req: Request, res: Response) => {
  try {
    await ensureH5PInitialized();
    const contentTypes = await getInstalledContentTypes();
    const runnableTypes = await getRunnableContentTypes();
    const requiredCheck = await checkRequiredLibraries();

    res.json({
      initialized: true,
      installedContentTypes: contentTypes,
      contentTypesCount: contentTypes.length,
      runnableContentTypes: runnableTypes,
      runnableCount: runnableTypes.length,
      quizReady: requiredCheck.allInstalled,
      missingForQuiz: requiredCheck.missing,
      paths: {
        data: H5P_PATHS.data,
        libraries: H5P_PATHS.libraries,
        content: H5P_PATHS.content
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get H5P status', details: error.message });
  }
});

// Diagnostic endpoint to check H5P health and troubleshoot issues
router.get('/diagnostic', async (req: Request, res: Response) => {
  try {
    await ensureH5PInitialized();
    const profile = (req as any).profile;

    if (profile.type !== 'parent' && profile.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents/admins can run diagnostics' });
    }

    const contentTypes = await getInstalledContentTypes();
    const runnableTypes = await getRunnableContentTypes();
    const requiredCheck = await checkRequiredLibraries();

    // Check directories
    const dirChecks = {
      data: fs.existsSync(H5P_PATHS.data),
      libraries: fs.existsSync(H5P_PATHS.libraries),
      content: fs.existsSync(H5P_PATHS.content),
      core: fs.existsSync(H5P_PATHS.core),
      editor: fs.existsSync(H5P_PATHS.editor),
      downloads: fs.existsSync(H5P_PATHS.downloads)
    };

    // Count files in directories
    const fileCounts: Record<string, number> = {};
    for (const [name, dir] of Object.entries(H5P_PATHS)) {
      try {
        if (fs.existsSync(dir)) {
          fileCounts[name] = fs.readdirSync(dir).length;
        } else {
          fileCounts[name] = 0;
        }
      } catch (e) {
        fileCounts[name] = -1;
      }
    }

    // Check content in database
    const contentStats: any = db.prepare(`
      SELECT
        COUNT(*) as total_content,
        SUM(CASE WHEN is_ai_generated = 1 THEN 1 ELSE 0 END) as ai_generated,
        SUM(CASE WHEN is_ai_generated = 0 THEN 1 ELSE 0 END) as imported
      FROM h5p_content
    `).get();

    const assignmentStats: any = db.prepare(`
      SELECT COUNT(*) as total FROM h5p_assignments
    `).get();

    const attemptStats: any = db.prepare(`
      SELECT
        COUNT(*) as total_attempts,
        SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as passed_attempts,
        SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as completed_attempts
      FROM h5p_attempts
    `).get();

    // Detailed library list with versions
    const libraryDetails = contentTypes.map(ct => {
      const parts = ct.split(' ');
      return {
        name: parts[0],
        version: parts[1] || 'unknown',
        isRunnable: runnableTypes.includes(ct),
        isRequiredForQuiz: ['H5P.QuestionSet', 'H5P.MultiChoice', 'H5P.TrueFalse'].includes(parts[0])
      };
    });

    const issues: string[] = [];
    const warnings: string[] = [];

    // Check for issues
    if (!requiredCheck.allInstalled) {
      issues.push(`Missing required libraries for quiz generation: ${requiredCheck.missing.join(', ')}`);
    }
    if (!dirChecks.libraries) {
      issues.push('Libraries directory does not exist');
    }
    if (!dirChecks.core) {
      warnings.push('H5P core files directory may be missing');
    }
    if (contentTypes.length === 0) {
      issues.push('No H5P libraries installed. Click "Install from Hub" to install required libraries.');
    }
    if (fileCounts.content === 0 && (contentStats?.total_content || 0) > 0) {
      warnings.push('Database has content records but content directory is empty - content may have been deleted');
    }

    res.json({
      healthy: issues.length === 0,
      issues,
      warnings,
      libraries: {
        total: contentTypes.length,
        runnable: runnableTypes.length,
        quizReady: requiredCheck.allInstalled,
        missingForQuiz: requiredCheck.missing,
        details: libraryDetails
      },
      directories: {
        exists: dirChecks,
        fileCounts
      },
      database: {
        content: contentStats,
        assignments: assignmentStats,
        attempts: attemptStats
      },
      paths: H5P_PATHS
    });
  } catch (error: any) {
    console.error('[H5P] Diagnostic error:', error);
    res.status(500).json({ error: 'Diagnostic failed', details: error.message });
  }
});

// Get all H5P content created by the user (parents see all, kids see their assignments)
router.get('/content', async (req: Request, res: Response) => {
  try {
    await ensureH5PInitialized();
    const profile = (req as any).profile;

    let content: any[];
    if (profile.type === 'parent' || profile.type === 'admin') {
      // Parents see all content they created
      content = db.prepare(`
        SELECT c.*,
               (SELECT COUNT(*) FROM h5p_assignments WHERE h5p_content_id = c.id) as assignment_count,
               (SELECT COUNT(*) FROM h5p_attempts WHERE h5p_content_id = c.id) as attempt_count
        FROM h5p_content c
        WHERE c.created_by = ?
        ORDER BY c.created_at DESC
      `).all(profile.id);
    } else {
      // Kids see their assigned content
      content = db.prepare(`
        SELECT c.*,
               a.id as assignment_id,
               a.points,
               a.due_date,
               a.is_required,
               a.max_attempts,
               a.pass_percentage,
               (SELECT COUNT(*) FROM h5p_attempts WHERE assignment_id = a.id AND profile_id = ?) as my_attempts,
               (SELECT MAX(score_percentage) FROM h5p_attempts WHERE assignment_id = a.id AND profile_id = ?) as best_score,
               (SELECT passed FROM h5p_attempts WHERE assignment_id = a.id AND profile_id = ? ORDER BY completed_at DESC LIMIT 1) as passed
        FROM h5p_content c
        JOIN h5p_assignments a ON a.h5p_content_id = c.id
        WHERE a.assigned_to = ?
        ORDER BY a.created_at DESC
      `).all(profile.id, profile.id, profile.id, profile.id);
    }

    res.json(content);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get H5P content', details: error.message });
  }
});

// Get single H5P content details
router.get('/content/:id', async (req: Request, res: Response) => {
  try {
    await ensureH5PInitialized();
    const { id } = req.params;
    const profile = (req as any).profile;

    const content: any = db.prepare(`
      SELECT c.*
      FROM h5p_content c
      WHERE c.id = ?
    `).get(id);

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Check access
    if (profile.type !== 'parent' && profile.type !== 'admin') {
      const assignment = db.prepare(`
        SELECT id FROM h5p_assignments WHERE h5p_content_id = ? AND assigned_to = ?
      `).get(id, profile.id);

      if (!assignment) {
        return res.status(403).json({ error: 'You do not have access to this content' });
      }
    }

    res.json(content);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get content', details: error.message });
  }
});

// Get quiz questions for a content (for preview)
router.get('/content/:id/questions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const profile = (req as any).profile;

    const content: any = db.prepare(`
      SELECT id, title, is_ai_generated, ai_prompt, ai_provider
      FROM h5p_content
      WHERE id = ?
    `).get(id);

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Check access - only parents/admins can view questions (to prevent cheating)
    if (profile.type !== 'parent' && profile.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents can view quiz questions' });
    }

    // Parse the ai_prompt to get the quiz spec
    let questions: any[] = [];
    let quizInfo: any = null;

    if (content.ai_prompt) {
      try {
        const aiData = JSON.parse(content.ai_prompt);
        // Check if quizSpec is stored (new format)
        if (aiData.quizSpec?.questions) {
          questions = aiData.quizSpec.questions;
          quizInfo = {
            theme: aiData.theme || aiData.quizSpec.theme,
            age: aiData.age || aiData.quizSpec.age,
            provider: aiData.provider
          };
        } else if (aiData.questions) {
          // Old format where entire quizSpec was stored directly
          questions = aiData.questions;
          quizInfo = {
            theme: aiData.theme,
            age: aiData.age,
            provider: content.ai_provider
          };
        }
      } catch (e) {
        console.warn('[H5P] Could not parse ai_prompt for content', id);
      }
    }

    res.json({
      id: content.id,
      title: content.title,
      isAiGenerated: content.is_ai_generated,
      provider: quizInfo?.provider || content.ai_provider,
      theme: quizInfo?.theme,
      age: quizInfo?.age,
      questionCount: questions.length,
      questions: questions.map((q: any, idx: number) => ({
        index: idx + 1,
        type: q.type,
        prompt: q.prompt,
        choices: q.choices || null,
        correctAnswer: q.type === 'mcq' ? q.answerIndex : q.correctAnswer,
        explanation: q.explanation
      }))
    });
  } catch (error: any) {
    console.error('[H5P] Error getting quiz questions:', error);
    res.status(500).json({ error: 'Failed to get quiz questions', details: error.message });
  }
});

// Create H5P content from quiz spec (manual or pre-generated)
router.post('/content/from-quiz', async (req: Request, res: Response) => {
  try {
    await ensureH5PInitialized();
    const profile = (req as any).profile;

    if (profile.type !== 'parent' && profile.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents can create H5P content' });
    }

    const { quizSpec, assignTo, points = 10 } = req.body;

    if (!quizSpec) {
      return res.status(400).json({ error: 'quizSpec is required' });
    }

    // Validate the quiz spec
    const validation = validateQuizSpec(quizSpec);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid quiz spec', details: validation.errors });
    }

    // Convert to H5P format
    const h5pData = convertQuizSpecToH5P(quizSpec as QuizSpec);

    // Create H5P user
    const h5pUser = createH5PUser(profile.id, profile.name);

    // Create the H5P content
    const contentId = await createH5PContent(
      h5pData.library,
      h5pData.params,
      h5pData.metadata,
      h5pUser
    );

    // Save to database
    const result = db.prepare(`
      INSERT INTO h5p_content (
        h5p_content_id, title, content_type, library_name, created_by,
        metadata, is_ai_generated, ai_prompt
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      contentId.toString(),
      quizSpec.title,
      'QuestionSet',
      h5pData.library,
      profile.id,
      JSON.stringify(h5pData.metadata),
      JSON.stringify(quizSpec)
    );

    const dbContentId = result.lastInsertRowid;

    // Create assignments and send notifications
    if (Array.isArray(assignTo) && assignTo.length > 0) {
      const insertAssignment = db.prepare(`
        INSERT INTO h5p_assignments (
          h5p_content_id, assigned_to, assigned_by, points
        ) VALUES (?, ?, ?, ?)
      `);

      for (const childId of assignTo) {
        insertAssignment.run(dbContentId, childId, profile.id, points);

        // Send push notification to child
        sendPushNotification(childId, {
          type: 'h5p_quiz_assigned' as any,
          title: 'New Quiz Assigned! 🎯',
          message: `You have a new quiz to try: "${quizSpec.title}" (${points} points)`,
          icon: '🧩',
          data: { h5pContentId: dbContentId },
          url: '/h5p'
        });
      }
    }

    res.json({
      id: dbContentId,
      h5pContentId: contentId.toString(),
      title: quizSpec.title,
      contentType: 'QuestionSet',
      assignedCount: assignTo?.length || 0
    });
  } catch (error: any) {
    console.error('[H5P] Error creating content from quiz:', error);
    res.status(500).json({ error: 'Failed to create H5P content', details: error.message });
  }
});

// Generate H5P quiz using AI
router.post('/content/generate-ai', async (req: Request, res: Response) => {
  try {
    await ensureH5PInitialized();
    const profile = (req as any).profile;

    if (profile.type !== 'parent' && profile.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents can create H5P content' });
    }

    const {
      title,
      theme,
      age = 8,
      questionCount = 5,
      quizType = 'mixed',
      assignTo,
      points = 20,
      provider = 'auto',
      includeImages = false,
      customInstructions = '',
      answerStyle = 'default'
    } = req.body;

    if (!theme) {
      return res.status(400).json({ error: 'theme is required' });
    }

    // Check AI usage limits (using 'quiz' type for H5P quizzes)
    const aiCheck = canGenerateAi(profile.id, 'quiz');
    if (!aiCheck.allowed) {
      return res.status(429).json({
        error: aiCheck.reason || 'AI generation limit reached',
        remaining: aiCheck.remaining
      });
    }

    console.log(`[H5P AI] Generating quiz: theme="${theme}", age=${age}, questions=${questionCount}, type=${quizType}, answerStyle=${answerStyle}, images=${includeImages}`);

    // Determine provider
    let usedProvider = provider;
    if (provider === 'auto') {
      // Auto-select based on availability
      if (getOllamaUrl()) usedProvider = 'ollama';
      else if (getGeminiApiKey()) usedProvider = 'gemini';
      else if (getGrokApiKey()) usedProvider = 'grok';
      else if (getOpenAiApiKey()) usedProvider = 'openai';
      else {
        return res.status(400).json({ error: 'No AI provider configured' });
      }
    }

    // Generate quiz using AI with new options
    const quizSpec = await generateQuizWithAI(theme, age, questionCount, usedProvider, quizType, answerStyle, customInstructions);

    // Override title if provided
    if (title) {
      quizSpec.title = title;
    }

    console.log(`[H5P AI] Generated quiz: "${quizSpec.title}" with ${quizSpec.questions.length} questions`);

    // Convert to H5P format
    const h5pData = convertQuizSpecToH5P(quizSpec);

    // Create H5P user
    const h5pUser = createH5PUser(profile.id, profile.name);

    // Create the H5P content
    const contentId = await createH5PContent(
      h5pData.library,
      h5pData.params,
      h5pData.metadata,
      h5pUser
    );

    // Save to database
    const result = db.prepare(`
      INSERT INTO h5p_content (
        h5p_content_id, title, content_type, library_name, created_by,
        metadata, is_ai_generated, ai_prompt
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      contentId.toString(),
      quizSpec.title,
      'QuestionSet',
      h5pData.library,
      profile.id,
      JSON.stringify(h5pData.metadata),
      JSON.stringify({ theme, age, questionCount, provider: usedProvider, quizSpec })
    );

    const dbContentId = result.lastInsertRowid;

    // Log AI usage (no image generation for quizzes, so pass null for image provider)
    const cost = usedProvider === 'ollama' ? 0 : estimateCost(usedProvider, null, 0);
    logAiUsage(profile.id, 'quiz', usedProvider, {
      estimatedCost: cost,
      success: true
    });

    // Create assignments and send notifications
    if (Array.isArray(assignTo) && assignTo.length > 0) {
      const insertAssignment = db.prepare(`
        INSERT INTO h5p_assignments (
          h5p_content_id, assigned_to, assigned_by, points
        ) VALUES (?, ?, ?, ?)
      `);

      for (const childId of assignTo) {
        insertAssignment.run(dbContentId, childId, profile.id, points);

        // Send push notification to child
        sendPushNotification(childId, {
          type: 'h5p_quiz_assigned' as any,
          title: 'New Quiz Assigned! 🎯',
          message: `You have a new quiz to try: "${quizSpec.title}" (${points} points)`,
          icon: '🧩',
          data: { h5pContentId: dbContentId },
          url: '/h5p'
        });
      }
    }

    res.json({
      id: dbContentId,
      h5pContentId: contentId.toString(),
      title: quizSpec.title,
      contentType: 'QuestionSet',
      questionCount: quizSpec.questions.length,
      provider: usedProvider,
      assignedCount: assignTo?.length || 0
    });
  } catch (error: any) {
    console.error('[H5P AI] Error generating quiz:', error);
    res.status(500).json({ error: 'Failed to generate quiz', details: error.message });
  }
});

// Generate standalone H5P content (Memory Game, Flashcards, Word Search, Dialog Cards)
router.post('/content/generate-standalone', async (req: Request, res: Response) => {
  try {
    await ensureH5PInitialized();
    const profile = (req as any).profile;

    if (profile.type !== 'parent' && profile.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents can create H5P content' });
    }

    const {
      contentType,  // 'memory_game' | 'flashcards' | 'word_search' | 'dialog_cards'
      title,
      theme,
      age = 8,
      itemCount = 8,
      assignTo,
      points = 20,
      provider = 'auto',
      customInstructions = ''
    } = req.body;

    if (!contentType || !['memory_game', 'flashcards', 'word_search', 'dialog_cards'].includes(contentType)) {
      return res.status(400).json({ error: 'Invalid contentType. Must be: memory_game, flashcards, word_search, or dialog_cards' });
    }

    if (!theme) {
      return res.status(400).json({ error: 'theme is required' });
    }

    // Check AI usage limits
    const aiCheck = canGenerateAi(profile.id, 'quiz');
    if (!aiCheck.allowed) {
      return res.status(429).json({
        error: aiCheck.reason || 'AI generation limit reached',
        remaining: aiCheck.remaining
      });
    }

    console.log(`[H5P AI] Generating standalone content: type="${contentType}", theme="${theme}", age=${age}, items=${itemCount}`);

    // Determine provider
    let usedProvider = provider;
    if (provider === 'auto') {
      if (getOllamaUrl()) usedProvider = 'ollama';
      else if (getGeminiApiKey()) usedProvider = 'gemini';
      else if (getGrokApiKey()) usedProvider = 'grok';
      else if (getOpenAiApiKey()) usedProvider = 'openai';
      else {
        return res.status(400).json({ error: 'No AI provider configured' });
      }
    }

    // Generate content using AI
    const contentSpec = await generateStandaloneContentWithAI(
      contentType,
      theme,
      age,
      itemCount,
      usedProvider,
      customInstructions
    );

    // Override title if provided
    if (title) {
      contentSpec.title = title;
    }

    console.log(`[H5P AI] Generated ${contentType}: "${contentSpec.title}"`);

    // Generate unique ID for this content (used for card image filenames)
    const uniqueContentId = `h5p-${profile.id}-${Date.now()}`;

    // Convert to H5P format based on content type
    let h5pData: any;
    let h5pContentType: string;
    let cardImages: MemoryGameCardImages | null = null;

    switch (contentType) {
      case 'memory_game':
        // Pass uniqueContentId so card images get unique filenames
        const memoryResult = convertMemoryGameToH5P(contentSpec as MemoryGameSpec, uniqueContentId);
        h5pData = memoryResult;
        cardImages = memoryResult.cardImages;
        h5pContentType = 'MemoryGame';
        break;
      case 'flashcards':
        h5pData = convertFlashcardsToH5P(contentSpec as FlashcardsSpec);
        h5pContentType = 'Flashcards';
        break;
      case 'word_search':
        h5pData = convertFindTheWordsToH5P(contentSpec as FindTheWordsSpec);
        h5pContentType = 'FindTheWords';
        break;
      case 'dialog_cards':
        h5pData = convertDialogCardsToH5P(contentSpec as DialogCardsSpec);
        h5pContentType = 'DialogCards';
        break;
      default:
        return res.status(400).json({ error: 'Unknown content type' });
    }

    // Create H5P user
    const h5pUser = createH5PUser(profile.id, profile.name);

    // Create the H5P content
    const h5pContentId = await createH5PContent(
      h5pData.library,
      h5pData.params,
      h5pData.metadata,
      h5pUser
    );

    // For Memory Game, copy generated card images to the H5P content folder
    if (contentType === 'memory_game' && cardImages) {
      console.log(`[H5P] Copying ${cardImages.generatedFiles.length} card images to content folder...`);
      copyCardImagesToH5PContent(h5pContentId.toString(), cardImages);
    }

    // Save to database
    const result = db.prepare(`
      INSERT INTO h5p_content (
        h5p_content_id, title, content_type, library_name, created_by,
        metadata, is_ai_generated, ai_prompt
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      h5pContentId.toString(),
      contentSpec.title,
      h5pContentType,
      h5pData.library,
      profile.id,
      JSON.stringify(h5pData.metadata),
      JSON.stringify({ contentType, theme, age, itemCount, provider: usedProvider, contentSpec })
    );

    const dbContentId = result.lastInsertRowid;

    // Log AI usage
    const cost = usedProvider === 'ollama' ? 0 : estimateCost(usedProvider, null, 0);
    logAiUsage(profile.id, 'quiz', usedProvider, {
      estimatedCost: cost,
      success: true
    });

    // Create assignments and send notifications
    if (Array.isArray(assignTo) && assignTo.length > 0) {
      const insertAssignment = db.prepare(`
        INSERT INTO h5p_assignments (
          h5p_content_id, assigned_to, assigned_by, points
        ) VALUES (?, ?, ?, ?)
      `);

      const contentTypeLabels: Record<string, string> = {
        memory_game: 'Memory Game',
        flashcards: 'Flashcards',
        word_search: 'Word Search',
        dialog_cards: 'Study Cards'
      };

      for (const childId of assignTo) {
        insertAssignment.run(dbContentId, childId, profile.id, points);

        sendPushNotification(childId, {
          type: 'h5p_quiz_assigned' as any,
          title: `New ${contentTypeLabels[contentType]} Assigned! 🎮`,
          message: `You have a new activity: "${contentSpec.title}"`,
          data: { h5pContentId: dbContentId },
          url: '/h5p'
        });
      }
    }

    res.json({
      id: dbContentId,
      h5pContentId: h5pContentId.toString(),
      title: contentSpec.title,
      contentType: h5pContentType,
      itemCount: contentType === 'memory_game' ? contentSpec.pairs?.length :
                 contentType === 'word_search' ? contentSpec.words?.length :
                 contentSpec.cards?.length,
      provider: usedProvider,
      assignedCount: assignTo?.length || 0
    });
  } catch (error: any) {
    console.error('[H5P AI] Error generating standalone content:', error);
    res.status(500).json({ error: 'Failed to generate content', details: error.message });
  }
});

// Render H5P content for playing
router.get('/play/:id', async (req: Request, res: Response) => {
  try {
    await ensureH5PInitialized();
    const { id } = req.params;
    const profile = (req as any).profile;

    // Get content from database
    const content: any = db.prepare('SELECT * FROM h5p_content WHERE id = ?').get(id);

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Check access for children
    let assignment: any = null;
    if (profile.type !== 'parent' && profile.type !== 'admin') {
      assignment = db.prepare(`
        SELECT * FROM h5p_assignments WHERE h5p_content_id = ? AND assigned_to = ?
      `).get(id, profile.id);

      if (!assignment) {
        return res.status(403).json({ error: 'You do not have access to this content' });
      }

      // Check max attempts
      if (assignment.max_attempts > 0) {
        const attemptCount: any = db.prepare(`
          SELECT COUNT(*) as count FROM h5p_attempts
          WHERE assignment_id = ? AND profile_id = ?
        `).get(assignment.id, profile.id);

        if (attemptCount.count >= assignment.max_attempts) {
          return res.status(403).json({ error: 'Maximum attempts reached' });
        }
      }
    }

    // Create H5P user
    const h5pUser = createH5PUser(profile.id, profile.name);

    // Repair older AI-generated blank questions that were saved with the wrong H5P.Blanks schema.
    if (content.is_ai_generated && content.content_type === 'QuestionSet' && content.ai_prompt) {
      try {
        const quizSpec = extractQuizSpecFromAiPrompt(content.ai_prompt);
        if (quizSpec?.questions?.some((question) => question.type === 'fill_blank')) {
          const contentJsonPath = path.join(H5P_PATHS.content, String(content.h5p_content_id), 'content.json');
          let storedParams: any = null;

          if (fs.existsSync(contentJsonPath)) {
            storedParams = JSON.parse(fs.readFileSync(contentJsonPath, 'utf8'));
          }

          if (!storedParams || questionSetNeedsRepair(storedParams, quizSpec)) {
            const repairedContent = convertQuizSpecToH5P(quizSpec);
            await updateH5PContent(
              content.h5p_content_id,
              repairedContent.library,
              repairedContent.params,
              repairedContent.metadata,
              h5pUser
            );
            console.log(`[H5P] Repaired AI question set ${content.id} before play`);
          }
        }
      } catch (repairError: any) {
        console.warn(`[H5P] Failed to repair AI question set ${content.id}:`, repairError.message);
      }
    }

    // Get player model
    const player = getH5PPlayer();
    const playerModel = await player.render(content.h5p_content_id, h5pUser);

    // Create attempt record for both parents (preview) and children (assigned)
    let attemptId: number | null = null;
    if (assignment) {
      // Child with assignment - track for points
      const result = db.prepare(`
        INSERT INTO h5p_attempts (
          assignment_id, profile_id, h5p_content_id
        ) VALUES (?, ?, ?)
      `).run(assignment.id, profile.id, id);
      attemptId = Number(result.lastInsertRowid);
    } else if (profile.type === 'parent' || profile.type === 'admin') {
      // Parent preview - create a temporary assignment and attempt for tracking
      // First check if there's already a preview assignment
      let previewAssignment: any = db.prepare(`
        SELECT id FROM h5p_assignments
        WHERE h5p_content_id = ? AND assigned_to = ? AND is_required = 0
      `).get(id, profile.id);

      if (!previewAssignment) {
        // Create a preview assignment for parent
        const assignResult = db.prepare(`
          INSERT INTO h5p_assignments (
            h5p_content_id, assigned_to, assigned_by, points, pass_percentage, is_required
          ) VALUES (?, ?, ?, 0, 70, 0)
        `).run(id, profile.id, profile.id);
        previewAssignment = { id: Number(assignResult.lastInsertRowid) };
      }

      const result = db.prepare(`
        INSERT INTO h5p_attempts (
          assignment_id, profile_id, h5p_content_id
        ) VALUES (?, ?, ?)
      `).run(previewAssignment.id, profile.id, id);
      attemptId = Number(result.lastInsertRowid);
    }

    console.log(`[H5P] Playing content ${id} for profile ${profile.id} (${profile.type}), attemptId: ${attemptId}`);

    res.json({
      content: {
        id: content.id,
        title: content.title,
        contentType: content.content_type
      },
      player: playerModel,
      attemptId,
      assignment: assignment ? {
        points: assignment.points,
        passPercentage: assignment.pass_percentage
      } : null
    });
  } catch (error: any) {
    console.error('[H5P] Error rendering content:', error);
    res.status(500).json({ error: 'Failed to render H5P content', details: error.message });
  }
});

// Submit xAPI event (score, completion, etc.)
router.post('/xapi', async (req: Request, res: Response) => {
  try {
    const profile = (req as any).profile;
    const { attemptId, verb, objectId, objectType, result, context } = req.body;

    if (!attemptId || !verb) {
      return res.status(400).json({ error: 'attemptId and verb are required' });
    }

    // Get attempt
    const attempt: any = db.prepare(`
      SELECT a.*, ass.points, ass.pass_percentage
      FROM h5p_attempts a
      JOIN h5p_assignments ass ON a.assignment_id = ass.id
      WHERE a.id = ? AND a.profile_id = ?
    `).get(attemptId, profile.id);

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    // Log xAPI event
    db.prepare(`
      INSERT INTO h5p_xapi_logs (
        attempt_id, profile_id, h5p_content_id, verb, object_id, object_type,
        result_score, result_max_score, result_success, result_completion,
        result_duration, context_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      attemptId,
      profile.id,
      attempt.h5p_content_id,
      verb,
      objectId || null,
      objectType || null,
      result?.score?.raw ?? null,
      result?.score?.max ?? null,
      result?.success ? 1 : 0,
      result?.completion ? 1 : 0,
      result?.duration || null,
      context ? JSON.stringify(context) : null
    );

    // Handle completion
    if (verb === 'completed' || verb === 'answered') {
      const score = result?.score?.raw ?? 0;
      const maxScore = result?.score?.max ?? 100;
      const scorePercentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
      const passed = scorePercentage >= (attempt.pass_percentage || 70);

      // Update attempt
      db.prepare(`
        UPDATE h5p_attempts
        SET score = ?, max_score = ?, score_percentage = ?, passed = ?,
            completed_at = CURRENT_TIMESTAMP, xapi_data = ?
        WHERE id = ?
      `).run(
        score,
        maxScore,
        scorePercentage,
        passed ? 1 : 0,
        JSON.stringify(result),
        attemptId
      );

      // Award points if passed
      if (passed && attempt.points > 0) {
        // Check if already awarded for this assignment
        const alreadyAwarded: any = db.prepare(`
          SELECT id FROM h5p_attempts
          WHERE assignment_id = ? AND profile_id = ? AND passed = 1 AND id != ?
        `).get(attempt.assignment_id, profile.id, attemptId);

        if (!alreadyAwarded) {
          // Award points to child
          db.prepare(`
            UPDATE progress
            SET points_earned = points_earned + ?, total_points = total_points + ?
            WHERE profile_id = ?
          `).run(attempt.points, attempt.points, profile.id);

          return res.json({
            recorded: true,
            completed: true,
            passed,
            score,
            maxScore,
            scorePercentage,
            pointsAwarded: attempt.points
          });
        }
      }

      return res.json({
        recorded: true,
        completed: true,
        passed,
        score,
        maxScore,
        scorePercentage,
        pointsAwarded: 0
      });
    }

    res.json({ recorded: true });
  } catch (error: any) {
    console.error('[H5P] Error recording xAPI:', error);
    res.status(500).json({ error: 'Failed to record xAPI event', details: error.message });
  }
});

// Get attempt history for a content
router.get('/attempts/:contentId', async (req: Request, res: Response) => {
  try {
    const { contentId } = req.params;
    const profile = (req as any).profile;

    let attempts: any[];
    if (profile.type === 'parent' || profile.type === 'admin') {
      // Parents see all attempts for their content
      attempts = db.prepare(`
        SELECT a.*, p.name as profile_name, p.avatar as profile_avatar
        FROM h5p_attempts a
        JOIN profiles p ON a.profile_id = p.id
        JOIN h5p_content c ON a.h5p_content_id = c.id
        WHERE c.id = ? AND c.created_by = ?
        ORDER BY a.started_at DESC
      `).all(contentId, profile.id);
    } else {
      // Children see only their attempts
      attempts = db.prepare(`
        SELECT a.*
        FROM h5p_attempts a
        WHERE a.h5p_content_id = ? AND a.profile_id = ?
        ORDER BY a.started_at DESC
      `).all(contentId, profile.id);
    }

    res.json(attempts);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get attempts', details: error.message });
  }
});

// Delete H5P content (parent only)
router.delete('/content/:id', async (req: Request, res: Response) => {
  try {
    await ensureH5PInitialized();
    const { id } = req.params;
    const profile = (req as any).profile;

    if (profile.type !== 'parent' && profile.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents can delete content' });
    }

    // Get content
    const content: any = db.prepare(`
      SELECT * FROM h5p_content WHERE id = ? AND created_by = ?
    `).get(id, profile.id);

    if (!content) {
      return res.status(404).json({ error: 'Content not found or not owned by you' });
    }

    // Delete from H5P storage
    const h5pUser = createH5PUser(profile.id, profile.name);
    try {
      await deleteH5PContent(content.h5p_content_id, h5pUser);
    } catch (e) {
      console.warn('[H5P] Error deleting H5P content from storage:', e);
    }

    // Delete from database (cascades to assignments, attempts, logs)
    db.prepare('DELETE FROM h5p_content WHERE id = ?').run(id);

    res.json({ deleted: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete content', details: error.message });
  }
});

// Assign content to children
router.post('/content/:id/assign', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const profile = (req as any).profile;
    const { childIds, points = 10, dueDate, isRequired = false, maxAttempts = 0, passPercentage = 70 } = req.body;

    if (profile.type !== 'parent' && profile.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents can assign content' });
    }

    // Verify content exists and is owned by user
    const content: any = db.prepare(`
      SELECT id FROM h5p_content WHERE id = ? AND created_by = ?
    `).get(id, profile.id);

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    if (!Array.isArray(childIds) || childIds.length === 0) {
      return res.status(400).json({ error: 'childIds array is required' });
    }

    const insertAssignment = db.prepare(`
      INSERT OR REPLACE INTO h5p_assignments (
        h5p_content_id, assigned_to, assigned_by, points, due_date,
        is_required, max_attempts, pass_percentage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let assignedCount = 0;
    for (const childId of childIds) {
      try {
        insertAssignment.run(
          id,
          childId,
          profile.id,
          points,
          dueDate || null,
          isRequired ? 1 : 0,
          maxAttempts,
          passPercentage
        );
        assignedCount++;
      } catch (e) {
        console.warn(`[H5P] Could not assign to child ${childId}:`, e);
      }
    }

    res.json({ assigned: assignedCount });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to assign content', details: error.message });
  }
});

// Get assignments for a content
router.get('/content/:id/assignments', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const profile = (req as any).profile;

    if (profile.type !== 'parent' && profile.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents can view assignments' });
    }

    const assignments = db.prepare(`
      SELECT a.*, p.name as child_name, p.avatar as child_avatar,
             (SELECT COUNT(*) FROM h5p_attempts WHERE assignment_id = a.id) as attempt_count,
             (SELECT MAX(score_percentage) FROM h5p_attempts WHERE assignment_id = a.id) as best_score,
             (SELECT passed FROM h5p_attempts WHERE assignment_id = a.id ORDER BY completed_at DESC LIMIT 1) as passed
      FROM h5p_assignments a
      JOIN profiles p ON a.assigned_to = p.id
      WHERE a.h5p_content_id = ?
      ORDER BY p.name
    `).all(id);

    res.json(assignments);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get assignments', details: error.message });
  }
});

// Remove assignment
router.delete('/assignments/:assignmentId', async (req: Request, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const profile = (req as any).profile;

    if (profile.type !== 'parent' && profile.type !== 'admin') {
      return res.status(403).json({ error: 'Only parents can remove assignments' });
    }

    const result = db.prepare(`
      DELETE FROM h5p_assignments
      WHERE id = ? AND assigned_by = ?
    `).run(assignmentId, profile.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json({ deleted: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to remove assignment', details: error.message });
  }
});

export default router;
