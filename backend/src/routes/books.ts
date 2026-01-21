import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { db } from '../database/init';
import { sendPushNotification } from '../services/notifications';
import { authenticate } from '../middleware/auth';
import { requireFeature } from '../middleware/feature-access';
import { canGenerateAi, logAiUsage, estimateCost } from '../services/aiUsageControl';

const router = Router();

// Book media directory (needed before routes)
const BOOK_MEDIA_DIR = process.env.BOOK_MEDIA_DIR || '/app/data/book-media';

// Ensure book media directory exists
if (!fs.existsSync(BOOK_MEDIA_DIR)) {
  fs.mkdirSync(BOOK_MEDIA_DIR, { recursive: true });
  console.log(`[Book Media] Created directory: ${BOOK_MEDIA_DIR}`);
}

// PUBLIC ROUTE - Serve book media files (no auth required for img tags)
router.get('/media/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;
  // Security: only allow alphanumeric, dash, underscore, dot
  if (!/^[a-zA-Z0-9_.-]+$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const filepath = path.join(BOOK_MEDIA_DIR, filename);
  if (fs.existsSync(filepath)) {
    res.sendFile(filepath);
  } else {
    res.status(404).json({ error: 'Media file not found' });
  }
});

// Apply authentication and feature access check to all routes below
router.use(authenticate, requireFeature('books'));

// API URLs
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const GROK_IMAGE_URL = 'https://api.x.ai/v1/images/generations';
const OPENAI_IMAGE_URL = 'https://api.openai.com/v1/images/generations';
const OLLAMA_DEFAULT_URL = 'http://localhost:11434/api/chat';

// API Key getters
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

// Ollama configuration (local LLM)
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
  // Default to llama3.2 if not specified
  return model && model.trim() !== '' ? model : 'llama3.2';
};

// Helpers
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const shouldRetryAiRequest = (error: any) => {
  const status = error?.response?.status;
  const code = error?.code;
  if ([429, 502, 503, 504].includes(status)) return true;
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') return true;
  return false;
};

const stripCodeFences = (content: string) => {
  return content.replace(/```json/gi, '```').replace(/```/g, '').trim();
};

const extractJsonBlock = (content: string) => {
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
  return content.slice(firstBrace, lastBrace + 1);
};

const removeTrailingCommas = (content: string) => {
  return content.replace(/,\s*([}\]])/g, '$1');
};

const parseAiBookJson = (content: string) => {
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
  throw new Error('Failed to parse AI book JSON');
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const saveBase64ImageToBookMedia = (data: string, prefix: string) => {
  const buffer = Buffer.from(data, 'base64');
  const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const filepath = path.join(BOOK_MEDIA_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  return `/api/books/media/${filename}`;
};

const downloadImageToBookMedia = async (imageUrl: string, prefix: string) => {
  const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const ext = response.headers['content-type']?.includes('png') ? '.png' : '.jpg';
  const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const filepath = path.join(BOOK_MEDIA_DIR, filename);
  fs.writeFileSync(filepath, response.data);
  return `/api/books/media/${filename}`;
};

// AI Request functions
const requestGeminiBookContent = async (apiKey: string, promptText: string) => {
  const maxAttempts = 5;
  const backoffDelays = [10000, 20000, 30000, 45000, 60000];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.post(
        `${GEMINI_API_URL}?key=${apiKey}`,
        {
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json'
          }
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 120000 }
      );

      const geminiContent = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return { data: { choices: [{ message: { content: geminiContent } }] } };
    } catch (error: any) {
      if (attempt < maxAttempts && shouldRetryAiRequest(error)) {
        const backoffMs = backoffDelays[attempt - 1] + Math.floor(Math.random() * 2000);
        console.log(`[AI Book] Gemini attempt ${attempt}/${maxAttempts} failed, retrying in ${Math.round(backoffMs / 1000)}s...`);
        await sleep(backoffMs);
        continue;
      }
      throw error;
    }
  }
  throw new HttpError(503, 'Gemini service is busy. Please try again.');
};

const requestGrokBookContent = async (apiKey: string, promptText: string) => {
  const maxAttempts = 5;
  const backoffDelays = [10000, 20000, 30000, 45000, 60000];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await axios.post(
        GROK_API_URL,
        {
          model: 'grok-2-latest',
          messages: [
            { role: 'system', content: 'You are an expert children\'s book author. Create engaging, age-appropriate stories. Always respond with valid JSON only.' },
            { role: 'user', content: promptText }
          ],
          temperature: 0.8,
          max_tokens: 4000
        },
        { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 60000 }
      );
    } catch (error: any) {
      if (attempt < maxAttempts && shouldRetryAiRequest(error)) {
        const backoffMs = backoffDelays[attempt - 1] + Math.floor(Math.random() * 2000);
        console.log(`[AI Book] Grok attempt ${attempt}/${maxAttempts} failed, retrying in ${Math.round(backoffMs / 1000)}s...`);
        await sleep(backoffMs);
        continue;
      }
      throw error;
    }
  }
  throw new HttpError(503, 'Grok service is busy. Please try again.');
};

const requestOpenAiBookContent = async (apiKey: string, promptText: string) => {
  const maxAttempts = 5;
  const backoffDelays = [10000, 20000, 30000, 45000, 60000];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await axios.post(
        OPENAI_CHAT_URL,
        {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are an expert children\'s book author. Create engaging, age-appropriate stories. Always respond with valid JSON only.' },
            { role: 'user', content: promptText }
          ],
          temperature: 0.8,
          max_tokens: 4000,
          response_format: { type: 'json_object' }
        },
        { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 60000 }
      );
    } catch (error: any) {
      if (attempt < maxAttempts && shouldRetryAiRequest(error)) {
        const backoffMs = backoffDelays[attempt - 1] + Math.floor(Math.random() * 2000);
        console.log(`[AI Book] OpenAI attempt ${attempt}/${maxAttempts} failed, retrying in ${Math.round(backoffMs / 1000)}s...`);
        await sleep(backoffMs);
        continue;
      }
      throw error;
    }
  }
  throw new HttpError(503, 'OpenAI service is busy. Please try again.');
};

// Ollama (local LLM) request function
const requestOllamaBookContent = async (ollamaUrl: string, model: string, promptText: string) => {
  const maxAttempts = 3;
  const backoffDelays = [5000, 10000, 15000];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.post(
        ollamaUrl,
        {
          model: model,
          messages: [
            { role: 'system', content: 'You are an expert children\'s book author. Create engaging, age-appropriate stories. Always respond with valid JSON only. Do not include any text before or after the JSON.' },
            { role: 'user', content: promptText }
          ],
          stream: false,
          options: {
            temperature: 0.8,
            num_predict: 4000
          }
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 180000 } // 3 min timeout for local models
      );

      // Ollama returns { message: { content: "..." } } directly
      const content = response.data?.message?.content;
      return { data: { choices: [{ message: { content } }] } };
    } catch (error: any) {
      if (attempt < maxAttempts) {
        const backoffMs = backoffDelays[attempt - 1];
        console.log(`[AI Book] Ollama attempt ${attempt}/${maxAttempts} failed, retrying in ${Math.round(backoffMs / 1000)}s...`);
        await sleep(backoffMs);
        continue;
      }
      throw error;
    }
  }
  throw new HttpError(503, 'Ollama service is not responding. Please check if Ollama is running.');
};

// Main AI request function with fallback chain: Ollama (local) -> Gemini -> Grok -> OpenAI
const requestAiBookContent = async (promptText: string) => {
  const ollamaUrl = getOllamaUrl();
  const ollamaModel = getOllamaModel();
  const geminiApiKey = getGeminiApiKey();
  const grokApiKey = getGrokApiKey();
  const openAiApiKey = getOpenAiApiKey();

  if (!ollamaUrl && !geminiApiKey && !grokApiKey && !openAiApiKey) {
    throw new HttpError(503, 'AI service not configured. Please configure Ollama, Gemini, Grok, or OpenAI.');
  }

  // Try Ollama first (local, free)
  if (ollamaUrl) {
    try {
      console.log(`[AI Book] Using Ollama (${ollamaModel}) at ${ollamaUrl}...`);
      return { response: await requestOllamaBookContent(ollamaUrl, ollamaModel, promptText), provider: 'ollama' };
    } catch (error: any) {
      console.log(`[AI Book] Ollama failed (${error?.response?.status || error?.code || error?.message}), trying cloud fallback...`);
    }
  }

  // Fallback to Gemini (best cloud option for book generation)
  if (geminiApiKey) {
    try {
      console.log('[AI Book] Using Gemini API...');
      return { response: await requestGeminiBookContent(geminiApiKey, promptText), provider: 'gemini' };
    } catch (error: any) {
      console.log(`[AI Book] Gemini failed (${error?.response?.status || error?.code}), trying fallback...`);
    }
  }

  // Fallback to Grok
  if (grokApiKey) {
    try {
      console.log('[AI Book] Using Grok API...');
      return { response: await requestGrokBookContent(grokApiKey, promptText), provider: 'grok' };
    } catch (error: any) {
      console.log(`[AI Book] Grok failed (${error?.response?.status || error?.code}), trying OpenAI...`);
    }
  }

  // Final fallback to OpenAI
  if (openAiApiKey) {
    console.log('[AI Book] Using OpenAI API...');
    return { response: await requestOpenAiBookContent(openAiApiKey, promptText), provider: 'openai' };
  }

  throw new HttpError(503, 'All AI services failed. Please try again later.');
};

// Image generation
const generateBookImage = async (prompt: string, errors: string[], label: string) => {
  const grokApiKey = getGrokApiKey();
  const openAiApiKey = getOpenAiApiKey();

  if (!grokApiKey && !openAiApiKey) return null;

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (openAiApiKey) {
        const response = await axios.post(
          OPENAI_IMAGE_URL,
          { model: 'dall-e-3', prompt, size: '1024x1024', response_format: 'b64_json', quality: 'standard' },
          { headers: { 'Authorization': `Bearer ${openAiApiKey}`, 'Content-Type': 'application/json' }, timeout: 60000 }
        );
        const base64 = response.data?.data?.[0]?.b64_json;
        if (base64) return saveBase64ImageToBookMedia(base64, 'book-ai');
      } else if (grokApiKey) {
        const response = await axios.post(
          GROK_IMAGE_URL,
          { model: 'grok-2-image', prompt, n: 1 },
          { headers: { 'Authorization': `Bearer ${grokApiKey}`, 'Content-Type': 'application/json' }, timeout: 60000 }
        );
        const url = response.data?.data?.[0]?.url;
        if (url) return await downloadImageToBookMedia(url, 'book-ai');
      }
    } catch (error: any) {
      if (attempt === maxAttempts) {
        errors.push(`${label}: Image generation failed`);
        console.error(`[AI Book] ${label} image generation failed:`, error?.message);
        return null;
      }
      await sleep(800 * attempt);
    }
  }
  return null;
};

// Job system for async book generation
type BookJobStatus = 'queued' | 'running' | 'completed' | 'failed';
type BookJob = {
  id: string;
  status: BookJobStatus;
  createdAt: number;
  updatedAt: number;
  progress?: { current: number; total: number; message: string };
  result?: any;
  error?: string;
};

const BOOK_JOB_TTL_MS = 2 * 60 * 60 * 1000;
const bookJobs = new Map<string, BookJob>();

const pruneBookJobs = () => {
  const now = Date.now();
  for (const [id, job] of bookJobs.entries()) {
    if (now - job.updatedAt > BOOK_JOB_TTL_MS) bookJobs.delete(id);
  }
};

const createBookJobId = () => randomUUID ? randomUUID() : `book-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

type BookGeneratePayload = {
  prompt: string;
  pageCount?: number;
  createdBy: number;
  assignedTo?: number;
  ageRange?: string;
  language?: string;
  genre?: string;
  categoryIds?: number[];
  includeImages?: boolean;
  customInstructions?: string;
};

const scheduleBookJob = (jobId: string, payload: BookGeneratePayload) => {
  const runner = () => processBookJob(jobId, payload);
  if (typeof setImmediate === 'function') setImmediate(runner);
  else setTimeout(runner, 0);
};

const createBookJob = (payload: BookGeneratePayload) => {
  pruneBookJobs();
  const job: BookJob = { id: createBookJobId(), status: 'queued', createdAt: Date.now(), updatedAt: Date.now() };
  bookJobs.set(job.id, job);
  scheduleBookJob(job.id, payload);
  return job;
};

const processBookJob = async (jobId: string, payload: BookGeneratePayload) => {
  const job = bookJobs.get(jobId);
  if (!job) return;
  job.status = 'running';
  job.progress = { current: 0, total: 3, message: 'Generating story...' };
  job.updatedAt = Date.now();

  try {
    job.result = await generateBookInternal(payload, (progress) => {
      job.progress = progress;
      job.updatedAt = Date.now();
    });
    job.status = 'completed';
  } catch (error: any) {
    job.error = error?.message || 'Failed to generate book';
    job.status = 'failed';
  } finally {
    job.updatedAt = Date.now();
  }
};

const generateBookInternal = async (
  payload: BookGeneratePayload,
  onProgress?: (progress: { current: number; total: number; message: string }) => void
) => {
  const {
    prompt,
    pageCount = 8,
    createdBy,
    assignedTo,
    ageRange = '4-8',
    language = 'en',
    genre = 'story',
    categoryIds = [],
    includeImages = true,
    customInstructions = ''
  } = payload;

  if (!prompt || !createdBy) {
    throw new HttpError(400, 'Prompt and createdBy are required');
  }

  const normalizedPageCount = Math.min(Math.max(pageCount, 3), 20);

  onProgress?.({ current: 1, total: 3, message: 'Generating story content...' });

  // Build custom instructions section if provided
  const customInstructionsSection = customInstructions?.trim()
    ? `
PARENT'S CUSTOM INSTRUCTIONS (MUST FOLLOW):
${customInstructions.trim()}
`
    : '';

  // Detect if this is an educational book (alphabet, numbers, colors, shapes)
  const educationalKeywords = ['alphabet', 'abc', 'abcs', 'letters', 'numbers', 'counting', 'colors', 'shapes', '123', 'a to z', 'a-z'];
  const isEducational = educationalKeywords.some(kw => prompt.toLowerCase().includes(kw));

  const bookPrompt = `
You are an expert children's book author. Create a complete children's book that STRICTLY follows the parent's request.

CRITICAL INSTRUCTION: Follow the parent's request EXACTLY. Read it carefully and deliver what they asked for.

Parent's Request: "${prompt}"
Target age range: ${ageRange} years old
Language: ${language}
Genre: ${genre}
Number of pages: ${normalizedPageCount}
Book Type Detected: ${isEducational ? 'EDUCATIONAL (alphabet/numbers/learning)' : 'NARRATIVE STORY'}
${customInstructionsSection}

=== BOOK TYPE RULES ===

${isEducational ? `
**THIS IS AN EDUCATIONAL BOOK** - Follow these rules:
- Use simple, direct format: "A is for Apple", "B is for Ball", etc.
- Each page = ONE letter/number/concept with ONE familiar object
- Use CONCRETE objects children recognize (apple, ball, cat, dog) - NOT abstract concepts
- Keep text minimal: just the letter/word and maybe one simple sentence
- Image should show EXACTLY the object mentioned (Apple = picture of apple)
- Do NOT add characters, plot, or narrative elements
- Do NOT use "This is a..." for every page - vary the format slightly
` : `
**THIS IS A NARRATIVE STORY** - Follow these rules:
- Create actual CHARACTERS who SPEAK and ACT
- Characters must have names and personalities
- Write DIALOGUE between characters
- Build a PLOT with beginning, middle, and end
- Show actions happening, not just descriptions
- NEVER use "This is a..." format
- NEVER write like a dictionary or flashcard
- Characters should face a problem and solve it
- Include emotional moments and interactions
`}

=== WRITING QUALITY RULES ===

1. **NO STATIC LABELS**:
   - BAD: "This is a lion. Lions are big."
   - GOOD (story): "Luna the lion roared, 'Who wants to play?' Her friends came running."
   - GOOD (educational): "L is for Lion. Roar!"

2. **ACTION-ORIENTED WRITING**:
   - Characters DO things, SAY things, FEEL things
   - Use active verbs: ran, jumped, laughed, whispered, discovered
   - Show emotions through actions, not labels

3. **AGE-APPROPRIATE LANGUAGE**:
   - Ages 2-4: 5-8 word sentences max, familiar words only
   - Ages 4-6: Short sentences, simple plot, repetition ok
   - Ages 6-8: Can use dialogue, emotions, simple conflict
   - Ages 8-12: Complex emotions, internal thoughts, deeper themes

4. **IMAGE PROMPTS**:
   - For stories: Show characters in ACTION doing something
   - For educational: Show the EXACT object, clear and simple
   - Style: Colorful, cartoon, child-friendly, bright, joyful
   - NO scary, dark, violent, or complex imagery

=== OUTPUT FORMAT ===

Return ONLY valid JSON (no markdown, no extra text):
{
  "title": "Book title",
  "description": "One sentence description",
  "cover_image_prompt": "Detailed cover image description",
  "pages": [
    {
      "page_number": 1,
      "title": "Page title",
      "content": "Page text with dialogue and action",
      "image_prompt": "Detailed scene description for illustration"
    }
  ]
}
`;

  const { response, provider } = await requestAiBookContent(bookPrompt);
  const aiContent = response.data?.choices?.[0]?.message?.content;

  if (!aiContent) {
    throw new HttpError(500, 'No response from AI');
  }

  let aiBook: any;
  try {
    aiBook = parseAiBookJson(aiContent);
  } catch (error) {
    console.error('[AI Book] Failed to parse response:', aiContent);
    throw new HttpError(500, 'Failed to parse AI book JSON');
  }

  onProgress?.({ current: 2, total: 3, message: 'Saving book...' });

  // Create the book record
  const bookResult = db.prepare(`
    INSERT INTO books (title, description, created_by, assigned_to, age_range, language, genre, theme, total_pages, is_ai_generated, ai_provider)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(
    aiBook.title || 'Untitled Book',
    aiBook.description || prompt,
    createdBy,
    assignedTo || createdBy,
    ageRange,
    language,
    genre,
    prompt,
    aiBook.pages?.length || 0,
    provider
  );

  const bookId = bookResult.lastInsertRowid as number;
  const imageErrors: string[] = [];

  // Generate cover image
  let coverImage: string | null = null;
  if (includeImages && aiBook.cover_image_prompt) {
    const coverPrompt = `Children's book cover illustration: ${aiBook.cover_image_prompt}. Style: colorful, whimsical, child-friendly, high quality, no text.`;
    coverImage = await generateBookImage(coverPrompt, imageErrors, 'Cover');
    if (coverImage) {
      db.prepare('UPDATE books SET cover_image = ? WHERE id = ?').run(coverImage, bookId);
    }
  }

  onProgress?.({ current: 3, total: 3, message: 'Generating page images...' });

  // Insert pages
  const insertPage = db.prepare(`
    INSERT INTO book_pages (book_id, page_number, title, content, image_prompt, image_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const pages = Array.isArray(aiBook.pages) ? aiBook.pages : [];
  const savedPages: any[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    let pageImage: string | null = null;

    if (includeImages && page.image_prompt) {
      const pagePrompt = `Children's book illustration: ${page.image_prompt}. Style: colorful, whimsical, child-friendly, matches the story, no text.`;
      pageImage = await generateBookImage(pagePrompt, imageErrors, `Page ${i + 1}`);
    }

    const pageResult = insertPage.run(
      bookId,
      page.page_number || i + 1,
      page.title || null,
      page.content || '',
      page.image_prompt || null,
      pageImage
    );

    const saved = db.prepare('SELECT * FROM book_pages WHERE id = ?').get(pageResult.lastInsertRowid);
    savedPages.push(saved);
  }

  // Add category mappings
  if (categoryIds.length > 0) {
    const insertMapping = db.prepare('INSERT OR IGNORE INTO book_category_mapping (book_id, category_id) VALUES (?, ?)');
    for (const catId of categoryIds) {
      insertMapping.run(bookId, catId);
    }
  }

  // Get the complete book
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);

  // Send notification if assigned to someone else
  if (assignedTo && assignedTo !== createdBy) {
    sendPushNotification(assignedTo, {
      type: 'new_book' as any,
      title: 'New Book Ready!',
      message: `A new book "${aiBook.title}" is waiting for you to read!`,
      data: { bookId }
    });
  }

  return {
    book,
    pages: savedPages,
    imageErrors: imageErrors.length > 0 ? imageErrors : undefined,
    provider
  };
};

// ============ ROUTES ============
// Note: /media/:filename route is defined at the top (before auth middleware) for public access

// Get all book categories
router.get('/categories', (req: Request, res: Response) => {
  try {
    const categories = db.prepare('SELECT * FROM book_categories ORDER BY display_name').all();
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Generate AI book (async job)
router.post('/ai-generate', authenticate, async (req: Request, res: Response) => {
  try {
    const { prompt, pageCount, createdBy, assignedTo, ageRange, language, genre, categoryIds, includeImages, customInstructions } = req.body;

    if (!prompt || !createdBy) {
      return res.status(400).json({ error: 'Prompt and createdBy are required' });
    }

    // Fetch saved book generation instructions from parent's profile settings
    let savedInstructions = '';
    try {
      const profile: any = db.prepare('SELECT settings FROM profiles WHERE id = ?').get(createdBy);
      if (profile?.settings) {
        const settings = JSON.parse(profile.settings || '{}');
        savedInstructions = settings.book_generation_instructions || '';
      }
    } catch (e) {
      console.warn('[Books] Failed to load saved instructions:', e);
    }

    // Combine saved instructions with request-specific instructions
    const combinedInstructions = [savedInstructions, customInstructions].filter(Boolean).join('\n\n');

    // ===== AI USAGE CONTROL: Check if generation is allowed =====
    const imageCount = includeImages !== false ? (pageCount || 8) + 1 : 0; // +1 for cover
    // Detect which provider will be used (matches the order in requestAiBookContent)
    const textProvider = getOllamaUrl() ? 'ollama' : (getGeminiApiKey() ? 'gemini' : (getGrokApiKey() ? 'grok' : 'openai'));
    const imageProvider = getGrokApiKey() ? 'grok' : (getOpenAiApiKey() ? 'openai' : null);
    const estimatedCostValue = estimateCost(textProvider, imageProvider, imageCount);

    const usageCheck = canGenerateAi(createdBy, 'book', estimatedCostValue);
    if (!usageCheck.allowed) {
      return res.status(429).json({
        error: usageCheck.reason,
        code: 'AI_LIMIT_REACHED',
        remaining: usageCheck.remaining,
        dailyLimit: usageCheck.dailyLimit
      });
    }

    const job = createBookJob({
      prompt,
      pageCount: pageCount || 8,
      createdBy,
      assignedTo,
      ageRange: ageRange || '4-8',
      language: language || 'en',
      genre: genre || 'story',
      categoryIds: categoryIds || [],
      includeImages: includeImages !== false,
      customInstructions: combinedInstructions
    });

    // Log the AI usage (will be marked success/failure when job completes)
    logAiUsage(createdBy, 'book', textProvider, {
      estimatedCost: estimatedCostValue,
      imagesGenerated: imageCount,
      success: true // Optimistically mark as success, job may fail later
    });

    res.json({
      jobId: job.id,
      status: job.status,
      estimatedCost: estimatedCostValue,
      remaining: (usageCheck.remaining || 1) - 1
    });
  } catch (error: any) {
    console.error('[AI Book] Job creation failed:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Get AI book generation job status
router.get('/ai-generate/status/:jobId', authenticate, (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = bookJobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found or expired' });
  }

  res.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    result: job.status === 'completed' ? job.result : undefined,
    error: job.status === 'failed' ? job.error : undefined
  });
});

// Get books for a profile (created by or assigned to)
router.get('/profile/:profileId', authenticate, (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const books = db.prepare(`
      SELECT b.*,
        p.name as creator_name,
        ap.name as assigned_to_name,
        (SELECT COUNT(*) FROM book_pages WHERE book_id = b.id) as page_count,
        brp.current_page,
        brp.completed as is_read
      FROM books b
      LEFT JOIN profiles p ON b.created_by = p.id
      LEFT JOIN profiles ap ON b.assigned_to = ap.id
      LEFT JOIN book_reading_progress brp ON b.id = brp.book_id AND brp.profile_id = ?
      WHERE b.created_by = ? OR b.assigned_to = ?
      ORDER BY b.created_at DESC
    `).all(profileId, profileId, profileId);

    res.json(books);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ROUTES THAT MUST BE BEFORE /:bookId ====================

// Get book generation instructions for a profile
router.get('/generation-instructions/:profileId', authenticate, (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const profile: any = db.prepare('SELECT settings FROM profiles WHERE id = ?').get(profileId);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const settings = JSON.parse(profile.settings || '{}');
    res.json({
      instructions: settings.book_generation_instructions || ''
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Save book generation instructions for a profile
router.put('/generation-instructions/:profileId', authenticate, (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { instructions } = req.body;

    const profile: any = db.prepare('SELECT settings FROM profiles WHERE id = ?').get(profileId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const settings = JSON.parse(profile.settings || '{}');
    settings.book_generation_instructions = instructions || '';

    db.prepare('UPDATE profiles SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(JSON.stringify(settings), profileId);

    res.json({
      success: true,
      instructions: settings.book_generation_instructions
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get reading progress for a profile
router.get('/progress/:profileId', authenticate, (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const progress = db.prepare(`
      SELECT brp.*, b.title as book_title, b.cover_image
      FROM book_reading_progress brp
      JOIN books b ON brp.book_id = b.id
      WHERE brp.profile_id = ?
      ORDER BY brp.last_read_at DESC
    `).all(profileId);

    res.json(progress);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get completed books for a profile ("Books I've Read")
router.get('/completed/:profileId', authenticate, (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const books = db.prepare(`
      SELECT b.*, brp.completed_at, brp.reading_status, brp.pages_read,
             (SELECT COUNT(*) FROM book_reading_notes WHERE book_id = b.id AND profile_id = ?) as notes_count
      FROM books b
      JOIN book_reading_progress brp ON b.id = brp.book_id
      WHERE brp.profile_id = ? AND brp.completed = 1
      ORDER BY brp.completed_at DESC
    `).all(profileId, profileId);

    res.json(books);
  } catch (error: any) {
    console.error('[Books] Get completed books error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get children's reading history (for parents)
router.get('/children-history/:parentId', authenticate, (req: Request, res: Response) => {
  try {
    const { parentId } = req.params;

    // Get children linked to this parent
    const children = db.prepare(`
      SELECT id, name, avatar FROM profiles
      WHERE parent_id = ? OR id IN (
        SELECT student_id FROM guardian_students WHERE guardian_id = ?
      )
    `).all(parentId, parentId) as { id: number; name: string; avatar: string }[];

    const childIds = children.map(c => c.id);
    if (childIds.length === 0) {
      return res.json({ children: [], history: [] });
    }

    const placeholders = childIds.map(() => '?').join(',');
    const history = db.prepare(`
      SELECT brp.*, b.title, b.cover_image, b.author, b.book_source,
             p.name as child_name, p.avatar as child_avatar
      FROM book_reading_progress brp
      JOIN books b ON brp.book_id = b.id
      JOIN profiles p ON brp.profile_id = p.id
      WHERE brp.profile_id IN (${placeholders})
      ORDER BY brp.last_read_at DESC
      LIMIT 50
    `).all(...childIds);

    res.json({ children, history });
  } catch (error: any) {
    console.error('[Books] Get children history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Lookup book info by title (using Open Library API)
router.get('/lookup', authenticate, async (req: Request, res: Response) => {
  try {
    const title = req.query.title as string;
    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    // Try Open Library API first
    const searchUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=1`;
    const response = await axios.get(searchUrl, { timeout: 5000 });

    if (response.data.docs && response.data.docs.length > 0) {
      const book = response.data.docs[0];
      return res.json({
        found: true,
        book: {
          title: book.title,
          author: book.author_name?.[0] || '',
          description: book.first_sentence?.[0] || '',
          total_pages: book.number_of_pages_median || null,
          isbn: book.isbn?.[0] || ''
        }
      });
    }

    res.json({ found: false });
  } catch (error: any) {
    console.error('[Books] Lookup error:', error);
    res.json({ found: false });
  }
});

// Get all feedback from a child (for parents to see)
router.get('/feedback/profile/:profileId', authenticate, (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const feedback = db.prepare(`
      SELECT bf.*, b.title as book_title, b.cover_image
      FROM book_feedback bf
      JOIN books b ON bf.book_id = b.id
      WHERE bf.profile_id = ?
      ORDER BY bf.created_at DESC
    `).all(profileId);

    res.json(feedback);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all reading notes from children (for parents)
router.get('/notes/children/:parentId', authenticate, (req: Request, res: Response) => {
  try {
    const { parentId } = req.params;
    const bookId = req.query.book_id ? Number(req.query.book_id) : null;

    // Get children linked to this parent
    const children = db.prepare(`
      SELECT id, name, avatar FROM profiles
      WHERE parent_id = ? OR id IN (
        SELECT student_id FROM guardian_students WHERE guardian_id = ?
      )
    `).all(parentId, parentId) as { id: number; name: string; avatar: string }[];

    const childIds = children.map(c => c.id);
    if (childIds.length === 0) {
      return res.json({ children: [], notes: [] });
    }

    const placeholders = childIds.map(() => '?').join(',');
    let query = `
      SELECT brn.*,
             p.name as profile_name, p.avatar as profile_avatar,
             b.title as book_title, b.cover_image as book_cover
      FROM book_reading_notes brn
      JOIN profiles p ON brn.profile_id = p.id
      JOIN books b ON brn.book_id = b.id
      WHERE brn.profile_id IN (${placeholders})
    `;
    const params: any[] = [...childIds];

    if (bookId) {
      query += ' AND brn.book_id = ?';
      params.push(bookId);
    }

    query += ' ORDER BY brn.created_at DESC LIMIT 100';

    const notes = db.prepare(query).all(...params);

    res.json({ children, notes });
  } catch (error: any) {
    console.error('[Books] Get children notes error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== READING NOTES (must be before :bookId routes) ====================

// Update a reading note
router.put('/notes/:noteId', authenticate, (req: Request, res: Response) => {
  try {
    const noteId = Number(req.params.noteId);
    const { note_type, content, page_reference } = req.body;

    db.prepare(`
      UPDATE book_reading_notes
      SET note_type = COALESCE(?, note_type),
          content = COALESCE(?, content),
          page_reference = COALESCE(?, page_reference),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(note_type, content, page_reference, noteId);

    const note = db.prepare('SELECT * FROM book_reading_notes WHERE id = ?').get(noteId);
    res.json(note);
  } catch (error: any) {
    console.error('[Books] Update note error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a reading note
router.delete('/notes/:noteId', authenticate, (req: Request, res: Response) => {
  try {
    const noteId = Number(req.params.noteId);
    db.prepare('DELETE FROM book_reading_notes WHERE id = ?').run(noteId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Books] Delete note error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ROUTES WITH :bookId PARAM ====================

// Get single book with pages
router.get('/:bookId', authenticate, (req: Request, res: Response) => {
  try {
    const { bookId } = req.params;
    const book = db.prepare(`
      SELECT b.*,
        p.name as creator_name,
        ap.name as assigned_to_name
      FROM books b
      LEFT JOIN profiles p ON b.created_by = p.id
      LEFT JOIN profiles ap ON b.assigned_to = ap.id
      WHERE b.id = ?
    `).get(bookId);

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const pages = db.prepare('SELECT * FROM book_pages WHERE book_id = ? ORDER BY page_number').all(bookId);
    const categories = db.prepare(`
      SELECT bc.* FROM book_categories bc
      JOIN book_category_mapping bcm ON bc.id = bcm.category_id
      WHERE bcm.book_id = ?
    `).all(bookId);

    res.json({ ...book, pages, categories });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update reading progress
router.post('/:bookId/progress', authenticate, (req: Request, res: Response) => {
  try {
    const { bookId } = req.params;
    const { profileId, currentPage, completed } = req.body;

    if (!profileId) {
      return res.status(400).json({ error: 'profileId is required' });
    }

    const existing: any = db.prepare('SELECT * FROM book_reading_progress WHERE book_id = ? AND profile_id = ?').get(bookId, profileId);
    const wasAlreadyCompleted = existing?.completed === 1;

    if (existing) {
      db.prepare(`
        UPDATE book_reading_progress
        SET current_page = ?, pages_read = MAX(pages_read, ?), completed = ?,
            completed_at = CASE WHEN ? = 1 AND completed = 0 THEN CURRENT_TIMESTAMP ELSE completed_at END,
            last_read_at = CURRENT_TIMESTAMP
        WHERE book_id = ? AND profile_id = ?
      `).run(currentPage, currentPage, completed ? 1 : 0, completed ? 1 : 0, bookId, profileId);
    } else {
      db.prepare(`
        INSERT INTO book_reading_progress (book_id, profile_id, current_page, pages_read, completed, completed_at)
        VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END)
      `).run(bookId, profileId, currentPage, currentPage, completed ? 1 : 0, completed ? 1 : 0);
    }

    // Notify parent when book is completed for the first time
    if (completed && !wasAlreadyCompleted) {
      const reader: any = db.prepare('SELECT name, parent_id FROM profiles WHERE id = ?').get(profileId);
      const book: any = db.prepare('SELECT title FROM books WHERE id = ?').get(bookId);

      if (reader?.parent_id && book) {
        sendPushNotification(reader.parent_id, {
          type: 'book_completed' as any,
          title: 'Book Finished! 📖',
          message: `${reader.name} finished reading "${book.title}"!`,
          data: { bookId, profileId },
          url: '/books'
        });
      }
    }

    const progress = db.prepare('SELECT * FROM book_reading_progress WHERE book_id = ? AND profile_id = ?').get(bookId, profileId);
    res.json(progress);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a book
router.delete('/:bookId', authenticate, (req: Request, res: Response) => {
  try {
    const { bookId } = req.params;
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    db.prepare('DELETE FROM books WHERE id = ?').run(bookId);
    res.json({ success: true, message: 'Book deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create manual book (non-AI)
router.post('/', authenticate, (req: Request, res: Response) => {
  try {
    const {
      title, description, createdBy, assignedTo, ageRange, language, genre, categoryIds,
      // Physical book fields
      author, book_source, source_location, isbn, total_pages
    } = req.body;

    if (!title || !createdBy) {
      return res.status(400).json({ error: 'Title and createdBy are required' });
    }

    const result = db.prepare(`
      INSERT INTO books (title, description, created_by, assigned_to, age_range, language, genre, is_ai_generated, author, book_source, source_location, isbn, total_pages)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
    `).run(
      title,
      description,
      createdBy,
      assignedTo,
      ageRange || '4-8',
      language || 'en',
      genre || 'story',
      author || null,
      book_source || 'physical',
      source_location || null,
      isbn || null,
      total_pages || 0
    );

    const bookId = result.lastInsertRowid;

    if (categoryIds?.length > 0) {
      const insertMapping = db.prepare('INSERT OR IGNORE INTO book_category_mapping (book_id, category_id) VALUES (?, ?)');
      for (const catId of categoryIds) {
        insertMapping.run(bookId, catId);
      }
    }

    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
    res.status(201).json(book);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add page to book
router.post('/:bookId/pages', authenticate, (req: Request, res: Response) => {
  try {
    const { bookId } = req.params;
    const { pageNumber, title, content, imageUrl } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const maxPage: any = db.prepare('SELECT MAX(page_number) as max FROM book_pages WHERE book_id = ?').get(bookId);
    const newPageNumber = pageNumber || (maxPage?.max || 0) + 1;

    const result = db.prepare(`
      INSERT INTO book_pages (book_id, page_number, title, content, image_url)
      VALUES (?, ?, ?, ?, ?)
    `).run(bookId, newPageNumber, title, content, imageUrl);

    // Update total pages count
    db.prepare('UPDATE books SET total_pages = (SELECT COUNT(*) FROM book_pages WHERE book_id = ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(bookId, bookId);

    const page = db.prepare('SELECT * FROM book_pages WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(page);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== BOOK FEEDBACK/RATINGS ====================

// Submit feedback for a book (kids can rate books)
router.post('/:bookId/feedback', authenticate, (req: Request, res: Response) => {
  try {
    const { bookId } = req.params;
    const { profileId, rating, liked, comment } = req.body;

    if (!profileId || !rating) {
      return res.status(400).json({ error: 'profileId and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if feedback already exists
    const existing = db.prepare('SELECT id FROM book_feedback WHERE book_id = ? AND profile_id = ?').get(bookId, profileId);

    if (existing) {
      // Update existing feedback
      db.prepare(`
        UPDATE book_feedback
        SET rating = ?, liked = ?, comment = ?, created_at = CURRENT_TIMESTAMP
        WHERE book_id = ? AND profile_id = ?
      `).run(rating, liked ? 1 : 0, comment || null, bookId, profileId);
    } else {
      // Insert new feedback
      db.prepare(`
        INSERT INTO book_feedback (book_id, profile_id, rating, liked, comment)
        VALUES (?, ?, ?, ?, ?)
      `).run(bookId, profileId, rating, liked ? 1 : 0, comment || null);
    }

    const feedback = db.prepare('SELECT * FROM book_feedback WHERE book_id = ? AND profile_id = ?').get(bookId, profileId);
    res.json(feedback);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get feedback for a specific book
router.get('/:bookId/feedback', authenticate, (req: Request, res: Response) => {
  try {
    const { bookId } = req.params;
    const feedback = db.prepare(`
      SELECT bf.*, p.name as profile_name, p.avatar as profile_avatar
      FROM book_feedback bf
      JOIN profiles p ON bf.profile_id = p.id
      WHERE bf.book_id = ?
      ORDER BY bf.created_at DESC
    `).all(bookId);

    // Calculate average rating
    const stats: any = db.prepare(`
      SELECT
        COUNT(*) as total_reviews,
        AVG(rating) as average_rating,
        SUM(CASE WHEN liked = 1 THEN 1 ELSE 0 END) as likes_count
      FROM book_feedback WHERE book_id = ?
    `).get(bookId);

    res.json({
      feedback,
      stats: {
        totalReviews: stats.total_reviews || 0,
        averageRating: stats.average_rating ? Math.round(stats.average_rating * 10) / 10 : 0,
        likesCount: stats.likes_count || 0
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get my feedback for a specific book
router.get('/:bookId/my-feedback/:profileId', authenticate, (req: Request, res: Response) => {
  try {
    const { bookId, profileId } = req.params;
    const feedback = db.prepare('SELECT * FROM book_feedback WHERE book_id = ? AND profile_id = ?').get(bookId, profileId);
    res.json(feedback || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== READING STATUS ====================

// Update reading status
router.patch('/:bookId/reading-status', authenticate, (req: Request, res: Response) => {
  try {
    const { bookId } = req.params;
    const { profileId, reading_status } = req.body;

    if (!profileId || !reading_status) {
      return res.status(400).json({ error: 'profileId and reading_status are required' });
    }

    const validStatuses = ['reading', 'finished', 'struggling', 'paused'];
    if (!validStatuses.includes(reading_status)) {
      return res.status(400).json({ error: 'Invalid reading status' });
    }

    // Check if progress record exists
    const existing: any = db.prepare('SELECT * FROM book_reading_progress WHERE book_id = ? AND profile_id = ?').get(bookId, profileId);

    if (existing) {
      db.prepare(`
        UPDATE book_reading_progress
        SET reading_status = ?,
            completed = CASE WHEN ? = 'finished' THEN 1 ELSE completed END,
            completed_at = CASE WHEN ? = 'finished' AND completed = 0 THEN CURRENT_TIMESTAMP ELSE completed_at END,
            last_read_at = CURRENT_TIMESTAMP
        WHERE book_id = ? AND profile_id = ?
      `).run(reading_status, reading_status, reading_status, bookId, profileId);
    } else {
      db.prepare(`
        INSERT INTO book_reading_progress (book_id, profile_id, reading_status, completed, completed_at)
        VALUES (?, ?, ?, ?, CASE WHEN ? = 'finished' THEN CURRENT_TIMESTAMP ELSE NULL END)
      `).run(bookId, profileId, reading_status, reading_status === 'finished' ? 1 : 0, reading_status);
    }

    const progress = db.prepare('SELECT * FROM book_reading_progress WHERE book_id = ? AND profile_id = ?').get(bookId, profileId);
    res.json(progress);
  } catch (error: any) {
    console.error('[Books] Update reading status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== READING NOTES ====================

// Get notes for a book
router.get('/:bookId/notes', authenticate, (req: Request, res: Response) => {
  try {
    const { bookId } = req.params;
    const profileId = req.query.profile_id ? Number(req.query.profile_id) : null;

    let query = `
      SELECT brn.*, p.name as profile_name, p.avatar as profile_avatar
      FROM book_reading_notes brn
      JOIN profiles p ON brn.profile_id = p.id
      WHERE brn.book_id = ?
    `;
    const params: any[] = [bookId];

    if (profileId) {
      query += ' AND brn.profile_id = ?';
      params.push(profileId);
    }

    query += ' ORDER BY brn.created_at DESC';

    const notes = db.prepare(query).all(...params);
    res.json(notes);
  } catch (error: any) {
    console.error('[Books] Get notes error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a reading note
router.post('/:bookId/notes', authenticate, (req: Request, res: Response) => {
  try {
    const { bookId } = req.params;
    const { profileId, note_type, content, page_reference } = req.body;

    if (!profileId || !content) {
      return res.status(400).json({ error: 'profileId and content are required' });
    }

    const result = db.prepare(`
      INSERT INTO book_reading_notes (book_id, profile_id, note_type, content, page_reference)
      VALUES (?, ?, ?, ?, ?)
    `).run(bookId, profileId, note_type || 'learning', content, page_reference || null);

    const note = db.prepare(`
      SELECT brn.*, p.name as profile_name
      FROM book_reading_notes brn
      JOIN profiles p ON brn.profile_id = p.id
      WHERE brn.id = ?
    `).get(result.lastInsertRowid);

    res.json(note);
  } catch (error: any) {
    console.error('[Books] Create note error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
