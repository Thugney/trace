import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { db } from '../database/init';
import { sendPushNotification } from '../services/notifications';
import { authenticate } from '../middleware/auth';

const router = Router();

// API URLs
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const GROK_IMAGE_URL = 'https://api.x.ai/v1/images/generations';
const OPENAI_IMAGE_URL = 'https://api.openai.com/v1/images/generations';

// Book media directory
const BOOK_MEDIA_DIR = process.env.BOOK_MEDIA_DIR || '/app/data/book-media';

// Ensure book media directory exists
if (!fs.existsSync(BOOK_MEDIA_DIR)) {
  fs.mkdirSync(BOOK_MEDIA_DIR, { recursive: true });
  console.log(`[Book Media] Created directory: ${BOOK_MEDIA_DIR}`);
}

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

// Main AI request function with fallback chain: Gemini -> Grok -> OpenAI
const requestAiBookContent = async (promptText: string) => {
  const geminiApiKey = getGeminiApiKey();
  const grokApiKey = getGrokApiKey();
  const openAiApiKey = getOpenAiApiKey();

  if (!geminiApiKey && !grokApiKey && !openAiApiKey) {
    throw new HttpError(503, 'AI service not configured. Please configure a Gemini, Grok, or OpenAI API key.');
  }

  // Try Gemini first (best for book generation)
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
    includeImages = true
  } = payload;

  if (!prompt || !createdBy) {
    throw new HttpError(400, 'Prompt and createdBy are required');
  }

  const normalizedPageCount = Math.min(Math.max(pageCount, 3), 20);

  onProgress?.({ current: 1, total: 3, message: 'Generating story content...' });

  const bookPrompt = `
You are an expert children's book author. Create a complete children's book based on the following request.

Request: "${prompt}"
Target age range: ${ageRange} years old
Language: ${language}
Genre: ${genre}
Number of pages: ${normalizedPageCount}

Requirements:
- Create an engaging, age-appropriate story
- Each page should have a title, content (2-4 short paragraphs suitable for the age range), and an image description
- The story should have a clear beginning, middle, and end
- Include educational value or a moral lesson where appropriate
- Use simple vocabulary for younger ages, more complex for older
- Image descriptions should be detailed enough for AI image generation (colorful, child-friendly, no scary elements)
- Output must be strict JSON only (double quotes, no trailing commas, no markdown)

Return ONLY valid JSON in this exact format:
{
  "title": "Book title",
  "description": "Brief book description (1-2 sentences)",
  "cover_image_prompt": "Detailed image prompt for the book cover",
  "pages": [
    {
      "page_number": 1,
      "title": "Chapter/Page title",
      "content": "Page content text...",
      "image_prompt": "Detailed image description for this page"
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

// Serve book media files
router.get('/media/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;
  const filepath = path.join(BOOK_MEDIA_DIR, filename);
  if (fs.existsSync(filepath)) {
    res.sendFile(filepath);
  } else {
    res.status(404).json({ error: 'Media file not found' });
  }
});

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
    const { prompt, pageCount, createdBy, assignedTo, ageRange, language, genre, categoryIds, includeImages } = req.body;

    if (!prompt || !createdBy) {
      return res.status(400).json({ error: 'Prompt and createdBy are required' });
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
      includeImages: includeImages !== false
    });

    res.json({ jobId: job.id, status: job.status });
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

    const existing = db.prepare('SELECT * FROM book_reading_progress WHERE book_id = ? AND profile_id = ?').get(bookId, profileId);

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

    const progress = db.prepare('SELECT * FROM book_reading_progress WHERE book_id = ? AND profile_id = ?').get(bookId, profileId);
    res.json(progress);
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
    const { title, description, createdBy, assignedTo, ageRange, language, genre, categoryIds } = req.body;

    if (!title || !createdBy) {
      return res.status(400).json({ error: 'Title and createdBy are required' });
    }

    const result = db.prepare(`
      INSERT INTO books (title, description, created_by, assigned_to, age_range, language, genre, is_ai_generated)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).run(title, description, createdBy, assignedTo, ageRange || '4-8', language || 'en', genre || 'story');

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

export default router;
