import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import axios from 'axios';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../database/init';
import { sendPushNotification } from '../services/notifications';
import { authenticate } from '../middleware/auth';
import type { AuthRequest } from '../middleware/auth';
import {
  canActOnAttempt,
  canManageOwnedResource,
  canViewAttempt,
  ownedResourceParamGuard,
  paramGuard,
  parentParamGuard,
  profileParamGuard,
  resolveActingProfileId
} from '../services/resourceAccess';
import { requireFeature } from '../middleware/feature-access';
import { canGenerateAi, logAiUsage, estimateCost } from '../services/aiUsageControl';
import { awardPoints } from '../services/economyControl';

const router = Router();
const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const GROK_IMAGE_URL = 'https://api.x.ai/v1/images/generations';
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_IMAGE_URL = 'https://api.openai.com/v1/images/generations';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const OLLAMA_DEFAULT_URL = 'http://localhost:11434/api/chat';

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
  return model && model.trim() !== '' ? model : 'llama3.2';
};

// Configure multer for quiz media uploads
const QUIZ_MEDIA_DIR = process.env.QUIZ_MEDIA_DIR || '/app/data/quiz-media';

// Ensure quiz media directory exists
if (!fs.existsSync(QUIZ_MEDIA_DIR)) {
  fs.mkdirSync(QUIZ_MEDIA_DIR, { recursive: true });
  console.log(`[Quiz Media] Created directory: ${QUIZ_MEDIA_DIR}`);
}

const quizMediaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, QUIZ_MEDIA_DIR);
  },
  filename: (req, file, cb) => {
    const quizId = req.params.quizId || 'unknown';
    const questionId = req.params.questionId || 'unknown';
    const ext = path.extname(file.originalname) || '.jpg';
    const filename = `quiz-${quizId}-question-${questionId}-${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const quizMediaUpload = multer({
  storage: quizMediaStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const allowedAudioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'];
    if (allowedImageTypes.includes(file.mimetype) || allowedAudioTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image and audio files are allowed'));
    }
  }
});

const getQuizTimerState = (attemptId: string) => {
  return db.prepare(`
    SELECT * FROM timer_states
    WHERE quiz_attempt_id = ? AND timer_type = 'quiz'
    ORDER BY id DESC LIMIT 1
  `).get(attemptId) as any;
};

const computeElapsedSeconds = (timerState: any) => {
  if (!timerState) return 0;
  let elapsed = timerState.elapsed_seconds || 0;
  if (timerState.is_running && timerState.start_time) {
    const startTime = new Date(timerState.start_time).getTime();
    const runningTime = Math.floor((Date.now() - startTime) / 1000);
    elapsed += Math.max(0, runningTime);
  }
  return elapsed;
};

const getGrokApiKey = (): string | null => {
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
};

const getOpenAiApiKey = (): string | null => {
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
};

const getGeminiApiKey = (): string | null => {
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
};

const imageExtensionFromMime = (mimeType?: string) => {
  if (!mimeType) return '.jpg';
  if (mimeType.includes('png')) return '.png';
  if (mimeType.includes('gif')) return '.gif';
  if (mimeType.includes('webp')) return '.webp';
  return '.jpg';
};

const downloadImageToQuizMedia = async (imageUrl: string, prefix: string) => {
  const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const ext = imageExtensionFromMime(response.headers['content-type']);
  const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const filepath = path.join(QUIZ_MEDIA_DIR, filename);
  fs.writeFileSync(filepath, response.data);
  return `/api/family-quizzes/media/${filename}`;
};

const saveBase64ImageToQuizMedia = (data: string, prefix: string) => {
  const buffer = Buffer.from(data, 'base64');
  const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const filepath = path.join(QUIZ_MEDIA_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  return `/api/family-quizzes/media/${filename}`;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const generateImageFromPrompt = async (
  prompt: string,
  provider: 'grok' | 'openai',
  apiKey: string,
  errors: string[],
  label?: string
) => {
  if (!prompt) return null;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      if (provider === 'openai') {
        const response = await axios.post(
          OPENAI_IMAGE_URL,
          {
            model: 'gpt-image-1',
            prompt,
            size: '1024x1024',
            response_format: 'b64_json'
          },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 60000
          }
        );

        const base64 = response.data?.data?.[0]?.b64_json;
        if (!base64) {
          throw new Error('Image data missing from response');
        }
        return saveBase64ImageToQuizMedia(base64, 'quiz-ai');
      }

      const response = await axios.post(
        GROK_IMAGE_URL,
        {
          model: 'grok-2-image',
          prompt,
          n: 1
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      const url = response.data?.data?.[0]?.url || response.data?.data?.[0]?.image_url;
      if (!url) {
        throw new Error('Image URL missing from response');
      }
      return await downloadImageToQuizMedia(url, 'quiz-ai');
    } catch (error) {
      const status = (error as any)?.response?.status;
      const message = (error as any)?.response?.data?.error || (error as any)?.message || 'Image generation failed';
      const prefix = label ? `${label}: ` : '';
      if (attempt === maxAttempts) {
        errors.push(status ? `${prefix}Image generation failed (${status}): ${message}` : `${prefix}Image generation failed: ${message}`);
        console.error('[AI Quiz] Image generation failed:', error);
        return null;
      }

      const backoffMs = 800 * attempt;
      await sleep(backoffMs);
    }
  }

  return null;
};

const stripCodeFences = (content: string) => {
  return content.replace(/```json/gi, '```').replace(/```/g, '').trim();
};

const extractJsonBlock = (content: string) => {
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }
  return content.slice(firstBrace, lastBrace + 1);
};

const removeTrailingCommas = (content: string) => {
  return content.replace(/,\s*([}\]])/g, '$1');
};

const parseAiQuizJson = (content: string) => {
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

  throw new Error('Failed to parse AI quiz JSON');
};

const shouldRetryAiRequest = (error: any) => {
  const status = error?.response?.status;
  const code = error?.code;
  if ([429, 502, 503, 504].includes(status)) return true;
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') return true;
  return false;
};

const requestOpenAiQuizContent = async (apiKey: string, promptText: string) => {
  const maxAttempts = 5;
  // Longer backoffs for rate limits: 10s, 20s, 30s, 45s, 60s
  const backoffDelays = [10000, 20000, 30000, 45000, 60000];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await axios.post(
        OPENAI_CHAT_URL,
        {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a helpful AI assistant that creates quiz content. Always respond with valid JSON only.' },
            { role: 'user', content: promptText }
          ],
          temperature: 0.7,
          max_tokens: 2500,
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
    } catch (error: any) {
      if (attempt < maxAttempts && shouldRetryAiRequest(error)) {
        const backoffMs = backoffDelays[attempt - 1] + Math.floor(Math.random() * 2000);
        console.log(`[AI Quiz] OpenAI attempt ${attempt}/${maxAttempts} failed with ${error?.response?.status || error?.code}, retrying in ${Math.round(backoffMs / 1000)}s...`);
        await sleep(backoffMs);
        continue;
      }
      throw error;
    }
  }

  throw new HttpError(503, 'OpenAI service is busy. Please try again.');
};

const requestGeminiQuizContent = async (apiKey: string, promptText: string) => {
  const maxAttempts = 5;
  const backoffDelays = [10000, 20000, 30000, 45000, 60000];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.post(
        `${GEMINI_API_URL}?key=${apiKey}`,
        {
          contents: [
            {
              parts: [
                { text: `You are a helpful AI assistant that creates quiz content. Always respond with valid JSON only.\n\n${promptText}` }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json'
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      // Transform Gemini response to match OpenAI structure
      const geminiContent = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return {
        data: {
          choices: [
            {
              message: {
                content: geminiContent
              }
            }
          ]
        }
      };
    } catch (error: any) {
      if (attempt < maxAttempts && shouldRetryAiRequest(error)) {
        const backoffMs = backoffDelays[attempt - 1] + Math.floor(Math.random() * 2000);
        console.log(`[AI Quiz] Gemini attempt ${attempt}/${maxAttempts} failed with ${error?.response?.status || error?.code}, retrying in ${Math.round(backoffMs / 1000)}s...`);
        await sleep(backoffMs);
        continue;
      }
      throw error;
    }
  }

  throw new HttpError(503, 'Gemini service is busy. Please try again.');
};

// Ollama (local LLM) request function
const requestOllamaQuizContent = async (ollamaUrl: string, model: string, promptText: string) => {
  const maxAttempts = 3;
  const backoffDelays = [5000, 10000, 15000];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.post(
        ollamaUrl,
        {
          model: model,
          messages: [
            { role: 'system', content: 'You are a helpful AI assistant that creates quiz content. Always respond with valid JSON only. Do not include any text before or after the JSON.' },
            { role: 'user', content: promptText }
          ],
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 3000
          }
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 120000 } // 2 min timeout for local models
      );

      // Ollama returns { message: { content: "..." } } directly
      const content = response.data?.message?.content;
      return { data: { choices: [{ message: { content } }] } };
    } catch (error: any) {
      if (attempt < maxAttempts) {
        const backoffMs = backoffDelays[attempt - 1];
        console.log(`[AI Quiz] Ollama attempt ${attempt}/${maxAttempts} failed, retrying in ${Math.round(backoffMs / 1000)}s...`);
        await sleep(backoffMs);
        continue;
      }
      throw error;
    }
  }
  throw new HttpError(503, 'Ollama service is not responding. Please check if Ollama is running.');
};

const requestAiQuizContent = async (
  grokApiKey: string | null,
  promptText: string,
  openAiApiKey?: string | null,
  geminiApiKey?: string | null,
  textProvider?: string
) => {
  const maxAttempts = 5;
  // Longer backoffs for rate limits: 10s, 20s, 30s, 45s, 60s
  const backoffDelays = [10000, 20000, 30000, 45000, 60000];

  // Get Ollama configuration
  const ollamaUrl = getOllamaUrl();
  const ollamaModel = getOllamaModel();

  // Determine provider order based on user preference
  const normalizedTextProvider = (textProvider || 'ollama').toLowerCase();

  // Helper function to try a specific provider
  const tryProvider = async (provider: string): Promise<any | null> => {
    if (provider === 'ollama' && ollamaUrl) {
      console.log(`[AI Quiz] Using Ollama (${ollamaModel}) for text generation`);
      return await requestOllamaQuizContent(ollamaUrl, ollamaModel, promptText);
    }
    if (provider === 'gemini' && geminiApiKey) {
      console.log(`[AI Quiz] Using Gemini for text generation`);
      return await requestGeminiQuizContent(geminiApiKey, promptText);
    }
    if (provider === 'openai' && openAiApiKey) {
      console.log(`[AI Quiz] Using OpenAI for text generation`);
      return await requestOpenAiQuizContent(openAiApiKey, promptText);
    }
    if (provider === 'grok' && grokApiKey) {
      console.log(`[AI Quiz] Using Grok for text generation`);
      return await axios.post(
        GROK_API_URL,
        {
          model: 'grok-2-latest',
          messages: [
            { role: 'system', content: 'You are a helpful AI assistant that creates quiz content. Always respond with valid JSON only.' },
            { role: 'user', content: promptText }
          ],
          temperature: 0.7,
          max_tokens: 2500
        },
        {
          headers: {
            'Authorization': `Bearer ${grokApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
    }
    return null;
  };

  // Provider order based on user preference (ollama first if available, then cloud providers)
  const providerOrder = normalizedTextProvider === 'ollama' ? ['ollama', 'gemini', 'grok', 'openai'] :
                        normalizedTextProvider === 'grok' ? ['grok', 'ollama', 'openai', 'gemini'] :
                        normalizedTextProvider === 'openai' ? ['openai', 'ollama', 'grok', 'gemini'] :
                        normalizedTextProvider === 'gemini' ? ['gemini', 'ollama', 'grok', 'openai'] :
                        ['ollama', 'gemini', 'grok', 'openai'];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Try preferred provider first
      for (const provider of providerOrder) {
        const response = await tryProvider(provider);
        if (response) return response;
      }
      // No providers available
      throw new HttpError(503, 'AI service not configured. Please configure Ollama, Gemini, Grok, or OpenAI.');
    } catch (error: any) {
      const status = error?.response?.status;
      if (attempt < maxAttempts && shouldRetryAiRequest(error)) {
        const backoffMs = backoffDelays[attempt - 1] + Math.floor(Math.random() * 2000);
        console.log(`[AI Quiz] Attempt ${attempt}/${maxAttempts} failed with ${status || error?.code}, retrying in ${Math.round(backoffMs / 1000)}s...`);
        await sleep(backoffMs);
        continue;
      }
      if (status === 429) {
        console.log(`[AI Quiz] Grok rate limited after ${maxAttempts} attempts, falling back to OpenAI...`);
        if (openAiApiKey) {
          try {
            return await requestOpenAiQuizContent(openAiApiKey, promptText);
          } catch (openAiError: any) {
            if (openAiError?.response?.status === 429 && geminiApiKey) {
              console.log(`[AI Quiz] OpenAI also rate limited, falling back to Gemini...`);
              return await requestGeminiQuizContent(geminiApiKey, promptText);
            }
            throw openAiError;
          }
        }
        if (geminiApiKey) {
          console.log(`[AI Quiz] Grok rate limited, falling back to Gemini...`);
          return await requestGeminiQuizContent(geminiApiKey, promptText);
        }
        throw new HttpError(429, 'AI rate limit reached. Please wait a few minutes and try again.');
      }
      throw error;
    }
  }
  throw new HttpError(503, 'AI service is busy. Please try again.');
};

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type AiQuizPayload = {
  prompt: string;
  categoryId: number;
  questionCount?: number;
  createdBy: number;
  assignedTo?: number;
  includeImages?: boolean;
  textProvider?: string;
  imageProvider?: string;
};

type AiQuizJobStatus = 'queued' | 'running' | 'completed' | 'failed';

type AiQuizJob = {
  id: string;
  ownerId?: number;
  status: AiQuizJobStatus;
  createdAt: number;
  updatedAt: number;
  result?: any;
  error?: string;
};

const AI_QUIZ_JOB_TTL_MS = 2 * 60 * 60 * 1000;
const aiQuizJobs = new Map<string, AiQuizJob>();

const pruneAiQuizJobs = () => {
  const now = Date.now();
  for (const [id, job] of aiQuizJobs.entries()) {
    if (now - job.updatedAt > AI_QUIZ_JOB_TTL_MS) {
      aiQuizJobs.delete(id);
    }
  }
};

const createAiQuizJobId = () => {
  if (typeof randomUUID === 'function') {
    return randomUUID();
  }
  return `ai-quiz-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const scheduleAiQuizJob = (jobId: string, payload: AiQuizPayload) => {
  const runner = () => processAiQuizJob(jobId, payload);
  if (typeof setImmediate === 'function') {
    setImmediate(runner);
    return;
  }
  setTimeout(runner, 0);
};

const createAiQuizJob = (payload: AiQuizPayload) => {
  pruneAiQuizJobs();
  const job: AiQuizJob = {
    id: createAiQuizJobId(),
    ownerId: payload.createdBy,
    status: 'queued',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  aiQuizJobs.set(job.id, job);
  scheduleAiQuizJob(job.id, payload);
  return job;
};

const processAiQuizJob = async (jobId: string, payload: AiQuizPayload) => {
  const job = aiQuizJobs.get(jobId);
  if (!job) return;
  job.status = 'running';
  job.updatedAt = Date.now();
  try {
    job.result = await generateAiQuizInternal(payload);
    job.status = 'completed';
  } catch (error: any) {
    job.error = error?.message || 'Failed to generate quiz';
    job.status = 'failed';
  } finally {
    job.updatedAt = Date.now();
  }
};

const generateAiQuizInternal = async (payload: AiQuizPayload) => {
  const {
    prompt,
    categoryId,
    questionCount = 5,
    createdBy,
    assignedTo,
    includeImages = true,
    textProvider = 'gemini',
    imageProvider = 'openai'
  } = payload;

  if (!prompt || !categoryId || !createdBy) {
    throw new HttpError(400, 'Prompt, categoryId, and createdBy are required');
  }

  const category: any = db.prepare(`
      SELECT * FROM quiz_categories WHERE id = ?
    `).get(categoryId);

  if (!category) {
    throw new HttpError(404, 'Quiz category not found');
  }

  const grokApiKey = getGrokApiKey();
  const openAiApiKey = getOpenAiApiKey();
  const geminiApiKey = getGeminiApiKey();
  if (!grokApiKey && !openAiApiKey && !geminiApiKey) {
    throw new HttpError(503, 'AI service not configured. Please configure a Grok, OpenAI, or Gemini API key.');
  }

  const inputConfig = JSON.parse(category.input_config || '{}');
  const supportsImages = !!inputConfig.supports_images;
  // Normalize image provider - Gemini doesn't have image generation, so fall back to Grok/OpenAI
  const rawImageProvider = String(imageProvider || 'grok').toLowerCase();
  let normalizedImageProvider: 'grok' | 'openai' = 'grok';
  if (rawImageProvider === 'openai') {
    normalizedImageProvider = 'openai';
  } else if (rawImageProvider === 'gemini') {
    // Gemini doesn't have image generation - use Grok if available, else OpenAI
    normalizedImageProvider = grokApiKey ? 'grok' : 'openai';
  }
  const includeOptionImages = false;
  const imageApiKey = includeImages && supportsImages
    ? (normalizedImageProvider === 'openai' ? openAiApiKey : grokApiKey)
    : null;
  if (includeImages && supportsImages && !imageApiKey) {
    // If no image API available, continue without images rather than failing
    console.log('[AI Quiz] No image API available, proceeding without images');
  }
  const normalizedCount = Math.min(Math.max(parseInt(String(questionCount), 10) || 5, 1), 20);

  const parentPrompt = typeof prompt === 'string' ? prompt.trim() : '';
  const buildImagePrompt = (basePrompt: string) => {
    const theme = parentPrompt ? `Theme inspiration: ${parentPrompt}` : '';
    return `Create a bright, kid-friendly illustration for ages 4-7. ${basePrompt} ${theme} Style: colorful, clean, high contrast, centered subject, simple background, no text, no logos, no watermarks.`;
  };

  // Build prompt based on whether images are needed
  const wantsImages = includeImages && supportsImages && imageApiKey;
  const promptText = `
You are an expert children's quiz creator. Create a fun, age-appropriate multiple choice quiz.

Category: ${category.display_name} (${category.name})
Category description: ${category.description || 'N/A'}
Input config: ${JSON.stringify(inputConfig)}

Parent prompt: "${prompt}"

Requirements:
- Create exactly ${normalizedCount} questions.
- Use multiple choice only.
- Provide 4 options per question (a, b, c, d).
- Include the correct answer as a, b, c, or d.
- Do not reveal the correct answer in question_text, hint, or explanation.
- Hints should be helpful but not give away the answer.
- Keep language kid-friendly and engaging.
${wantsImages ? `- IMPORTANT: You MUST include a "question_image_prompt" for EVERY question. This is REQUIRED, not optional.
- The image prompt should describe a colorful, kid-friendly illustration that helps visualize the question.
- DO NOT include image_prompt for options (A, B, C, D) - only for the question itself.` : '- Do not include any image prompts.'}
- Output must be strict JSON only (double quotes, no trailing commas, no markdown).

Return ONLY valid JSON in this exact format:
{
  "title": "Quiz title",
  "description": "Quiz description",
  "questions": [
    {
      "question_text": "Question text",
      ${wantsImages ? '"question_image_prompt": "REQUIRED: A vivid description of a kid-friendly illustration for this question",' : ''}
      "options": [
        { "id": "a", "text": "Option A text" },
        { "id": "b", "text": "Option B text" },
        { "id": "c", "text": "Option C text" },
        { "id": "d", "text": "Option D text" }
      ],
      "correct_answer": "a",
      "hint": "Optional hint",
      "explanation": "Optional explanation"
    }
  ]
}
`;

  const response = await requestAiQuizContent(grokApiKey, promptText, openAiApiKey, geminiApiKey, textProvider);

  const aiContent = response.data?.choices?.[0]?.message?.content;
  if (!aiContent) {
    throw new HttpError(500, 'No response from AI');
  }

  let aiQuiz: any;
  try {
    aiQuiz = parseAiQuizJson(aiContent);
  } catch (error) {
    console.error('[AI Quiz] Failed to parse response:', aiContent);
    throw new HttpError(500, 'Failed to parse AI quiz JSON');
  }

  const title = aiQuiz.title || `${category.display_name} Quiz`;
  const description = aiQuiz.description || prompt;
  const assignedProfileId = assignedTo || createdBy;

  const assignedProfile = db.prepare('SELECT id FROM profiles WHERE id = ?').get(assignedProfileId);
  if (!assignedProfile) {
    throw new HttpError(404, 'Assigned profile not found');
  }

  const questions = Array.isArray(aiQuiz.questions) ? aiQuiz.questions.slice(0, normalizedCount) : [];
  const imageErrors: string[] = [];
  const questionsSummary = JSON.stringify(questions.map((q: any) => ({
    question_text: q.question_text || q.questionText || '',
    options: q.options || [],
    correct_answer: q.correct_answer || q.correctAnswer || ''
  })));

  const quizResult = db.prepare(`
      INSERT INTO family_quizzes (
        title, description, category_id, created_by, assigned_to,
        points_per_correct, stars_per_correct, bonus_points,
        time_limit_seconds, pass_threshold, questions, is_ai_generated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
    title,
    description,
    categoryId,
    createdBy,
    assignedProfileId,
    10,
    0,
    20,
    null,
    70,
    questionsSummary
  );

  const quizId = quizResult.lastInsertRowid as number;

  const insertQuestion = db.prepare(`
      INSERT INTO family_quiz_questions (
        quiz_id, question_text, question_type, question_image, question_audio,
        options, correct_answer, hint, explanation, points, order_index
      ) VALUES (?, ?, 'multiple_choice', ?, NULL, ?, ?, ?, ?, ?, ?)
    `);

  const savedQuestions: any[] = [];
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const optionsRaw = Array.isArray(question.options) ? question.options : [];

    const questionText = (question.question_text || question.questionText || `Question ${i + 1}`).toString();
    const normalizedOptions = ['a', 'b', 'c', 'd'].map((id, idx) => {
      const option = optionsRaw[idx] || optionsRaw.find((opt: any) => opt.id === id) || {};
      const optionText = typeof option === 'string' ? option : option.text;
      return {
        id,
        text: (optionText || `Option ${id.toUpperCase()}`).toString(),
        image: null as string | null,
        color: typeof option === 'object' && option ? option.color || '' : '',
        shape: typeof option === 'object' && option ? option.shape || '' : ''
      };
    });

    const rawCorrectAnswer = (question.correct_answer || question.correctAnswer || question.answer || question.correct || '').toString().trim().toLowerCase();
    let correctAnswer = ['a', 'b', 'c', 'd'].includes(rawCorrectAnswer)
      ? rawCorrectAnswer
      : 'a';
    if (!['a', 'b', 'c', 'd'].includes(rawCorrectAnswer) && rawCorrectAnswer) {
      const letterMatch = rawCorrectAnswer.match(/\b([a-d])\b/);
      if (letterMatch) {
        correctAnswer = letterMatch[1];
      }
    }
    if (!['a', 'b', 'c', 'd'].includes(rawCorrectAnswer) && rawCorrectAnswer) {
      const matched = normalizedOptions.find(opt => opt.text.trim().toLowerCase() === rawCorrectAnswer);
      if (matched) {
        correctAnswer = matched.id;
      }
    }
    const correctOption = normalizedOptions.find(opt => opt.id === correctAnswer);
    const correctOptionText = (correctOption?.text || '').trim();
    const isSingleLetter = /^[A-Za-z]$/.test(correctOptionText);

    let questionImage: string | null = null;
    const questionImagePromptRaw = question.question_image_prompt || question.image_prompt || '';
    let questionImagePrompt = questionImagePromptRaw ? buildImagePrompt(questionImagePromptRaw) : '';

    // ALWAYS create a fallback image prompt if images are enabled but AI didn't provide one
    if (!questionImagePrompt && includeImages && supportsImages && imageApiKey) {
      console.log(`[AI Quiz] Question ${i + 1} missing image prompt, generating fallback`);
      if (category.name === 'alphabet' && isSingleLetter) {
        questionImagePrompt = buildImagePrompt(
          `A bold, clear illustration of the letter "${correctOptionText}" in a fun superhero style.`
        );
      } else {
        questionImagePrompt = buildImagePrompt(
          `A playful, colorful illustration for this quiz question: "${questionText}". Show the main subject clearly.`
        );
      }
    }

    // Generate image for this question (required when images are enabled)
    if (includeImages && supportsImages && imageApiKey) {
      if (!questionImagePrompt) {
        // Final fallback - generic themed image
        questionImagePrompt = buildImagePrompt(
          `A fun, educational illustration about ${category.display_name} for children.`
        );
      }

      console.log(`[AI Quiz] Generating image for question ${i + 1}/${questions.length}`);
      questionImage = await generateImageFromPrompt(
        questionImagePrompt,
        normalizedImageProvider,
        imageApiKey,
        imageErrors,
        `Question ${i + 1}`
      );

      // If image generation failed, log but continue (don't fail entire quiz)
      if (!questionImage) {
        console.warn(`[AI Quiz] Failed to generate image for question ${i + 1}, continuing without image`);
      }
    }

    // NOTE: Option images (A/B/C/D) are intentionally disabled to reduce costs and failures
    // Only question images are generated (1 per question instead of 5 per question)

    const result = insertQuestion.run(
      quizId,
      questionText,
      questionImage,
      JSON.stringify(normalizedOptions),
      correctAnswer,
      question.hint || null,
      question.explanation || null,
      10,
      i + 1
    );

    const saved = db.prepare('SELECT * FROM family_quiz_questions WHERE id = ?').get(result.lastInsertRowid) as any;
    saved.options = JSON.parse(saved.options || '[]');
    savedQuestions.push(saved);
  }

  const quiz = db.prepare(`
      SELECT fq.*, qc.display_name as category_name, qc.icon as category_icon
      FROM family_quizzes fq
      JOIN quiz_categories qc ON fq.category_id = qc.id
      WHERE fq.id = ?
    `).get(quizId);

  if (assignedProfileId !== createdBy) {
    sendPushNotification(assignedProfileId, {
      title: 'New AI Quiz Ready!',
      message: `You have a new "${title}" quiz to try!`,
      type: 'new_quiz' as any,
      data: { quizId },
      url: '/quizzes'
    });
  }

  return { quiz, questions: savedQuestions, image_warnings: imageErrors };
};

// ==================== QUIZ MEDIA (Public) ====================

// Serve quiz media files
router.get('/media/:filename', (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(QUIZ_MEDIA_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving media:', error);
    res.status(500).json({ error: 'Failed to serve media' });
  }
});

router.use(authenticate, requireFeature('quizzes'));

// ==================== OBJECT-LEVEL ACCESS ====================
// Every route naming one of these params is scoped to the viewer's family.
router.param('parentId', parentParamGuard);
router.param('childId', profileParamGuard);
router.param('profileId', profileParamGuard);
// Assigned children may start a quiz and see its leaderboard; all else requires manage access
router.param('quizId', ownedResourceParamGuard({
  table: 'family_quizzes',
  playSuffixes: /^\/[^/]+\/(start|leaderboard)$/
}));
router.param('questionId', paramGuard((req, value) => {
  const quiz = db.prepare(`
    SELECT fq.created_by, fq.assigned_to
    FROM family_quiz_questions q
    JOIN family_quizzes fq ON fq.id = q.quiz_id
    WHERE q.id = ?
  `).get(value) as any;
  return quiz ? canManageOwnedResource(req.profile!, quiz) : 'not_found';
}));
router.param('attemptId', paramGuard((req, value) => {
  const attempt = db.prepare('SELECT profile_id FROM family_quiz_attempts WHERE id = ?').get(value) as any;
  if (!attempt) {
    return 'not_found';
  }
  return req.method === 'GET'
    ? canViewAttempt(req.profile!, attempt.profile_id)
    : canActOnAttempt(req.profile!, attempt.profile_id);
}));

// ==================== QUIZ CATEGORIES ====================

// Get all quiz categories with theme configs
router.get('/categories', (req: Request, res: Response) => {
  try {
    const categories = db.prepare(`
      SELECT * FROM quiz_categories ORDER BY display_name
    `).all();

    // Parse JSON fields
    const parsed = categories.map((cat: any) => ({
      ...cat,
      theme_config: JSON.parse(cat.theme_config || '{}'),
      input_config: JSON.parse(cat.input_config || '{}')
    }));

    res.json(parsed);
  } catch (error) {
    console.error('Error fetching quiz categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get single category by ID or name
router.get('/categories/:idOrName', (req: Request, res: Response) => {
  try {
    const { idOrName } = req.params;

    const category = db.prepare(`
      SELECT * FROM quiz_categories
      WHERE id = ? OR name = ?
    `).get(idOrName, idOrName) as any;

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({
      ...category,
      theme_config: JSON.parse(category.theme_config || '{}'),
      input_config: JSON.parse(category.input_config || '{}')
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// ==================== AI QUIZ GENERATION ====================

router.post('/ai-generate', async (req: Request, res: Response) => {
  try {
    const {
      prompt,
      categoryId,
      questionCount,
      createdBy,
      assignedTo,
      includeImages,
      textProvider,
      imageProvider
    } = req.body || {};

    if (!prompt || !categoryId || !createdBy) {
      return res.status(400).json({ error: 'Prompt, categoryId, and createdBy are required' });
    }

    const viewer = (req as AuthRequest).profile!;
    if (viewer.type !== 'admin' && Number(createdBy) !== viewer.id) {
      return res.status(403).json({ error: 'You can only create quizzes as yourself' });
    }
    if (assignedTo !== undefined && assignedTo !== null && resolveActingProfileId(viewer, assignedTo) === null) {
      return res.status(403).json({ error: 'You can only assign quizzes to your own children' });
    }

    // ===== AI USAGE CONTROL: Check if generation is allowed =====
    const normalizedQuestionCount = Math.min(Math.max(questionCount || 5, 1), 20);
    const imageCount = includeImages !== false ? normalizedQuestionCount : 0;
    const selectedTextProvider = textProvider || 'gemini';
    const selectedImageProvider = includeImages !== false ? (imageProvider || 'grok') : null;
    const estimatedCostValue = estimateCost(selectedTextProvider, selectedImageProvider, imageCount);

    const usageCheck = canGenerateAi(createdBy, 'quiz', estimatedCostValue);
    if (!usageCheck.allowed) {
      return res.status(429).json({
        error: usageCheck.reason,
        code: 'AI_LIMIT_REACHED',
        remaining: usageCheck.remaining,
        dailyLimit: usageCheck.dailyLimit
      });
    }

    const job = createAiQuizJob({
      prompt,
      categoryId,
      questionCount,
      createdBy,
      assignedTo,
      includeImages,
      textProvider,
      imageProvider
    });

    // Log the AI usage
    logAiUsage(createdBy, 'quiz', selectedTextProvider, {
      estimatedCost: estimatedCostValue,
      imagesGenerated: imageCount,
      success: true
    });

    res.status(202).json({
      jobId: job.id,
      status: job.status,
      estimatedCost: estimatedCostValue,
      remaining: (usageCheck.remaining || 1) - 1
    });
  } catch (error: any) {
    console.error('[AI Quiz] Generation error:', error);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
});

router.get('/ai-generate/status/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  pruneAiQuizJobs();
  const job = aiQuizJobs.get(jobId);
  const viewer = (req as AuthRequest).profile!;
  if (!job || (viewer.type !== 'admin' && job.ownerId !== undefined && Number(job.ownerId) !== viewer.id)) {
    return res.status(404).json({ error: 'AI generation job not found' });
  }
  res.json({
    status: job.status,
    result: job.result,
    error: job.error
  });
});

// ==================== FAMILY QUIZZES CRUD ====================

// Get quizzes for a parent (created by them)
router.get('/parent/:parentId', (req: Request, res: Response) => {
  try {
    const { parentId } = req.params;

    const quizzes = db.prepare(`
      SELECT fq.*,
             qc.display_name as category_name, qc.icon as category_icon,
             p.name as assigned_to_name, p.avatar as assigned_to_avatar, p.gender as assigned_to_gender,
             (SELECT COUNT(*) FROM family_quiz_questions WHERE quiz_id = fq.id) as question_count,
             (SELECT COUNT(*) FROM family_quiz_attempts WHERE quiz_id = fq.id) as attempt_count,
             (SELECT AVG(score_percentage) FROM family_quiz_attempts WHERE quiz_id = fq.id AND completed_at IS NOT NULL) as avg_score
      FROM family_quizzes fq
      JOIN quiz_categories qc ON fq.category_id = qc.id
      JOIN profiles p ON fq.assigned_to = p.id
      WHERE fq.created_by = ?
      ORDER BY fq.updated_at DESC
    `).all(parentId);

    res.json(quizzes);
  } catch (error) {
    console.error('Error fetching parent quizzes:', error);
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

// Get quizzes assigned to a child
router.get('/child/:childId', (req: Request, res: Response) => {
  try {
    const { childId } = req.params;

    // Get child's gender for theming
    const child = db.prepare('SELECT gender FROM profiles WHERE id = ?').get(childId) as any;
    const gender = child?.gender === 'female' ? 'girl' : 'boy';

    const quizzes = db.prepare(`
      SELECT fq.*,
             qc.display_name as category_name, qc.icon as category_icon,
             qc.theme_config, qc.input_config,
             (SELECT COUNT(*) FROM family_quiz_questions WHERE quiz_id = fq.id) as question_count,
             (SELECT COUNT(*) FROM family_quiz_attempts WHERE quiz_id = fq.id AND profile_id = ?) as my_attempts,
             (SELECT MAX(score_percentage) FROM family_quiz_attempts WHERE quiz_id = fq.id AND profile_id = ? AND completed_at IS NOT NULL) as best_score,
             (SELECT completed_at FROM family_quiz_attempts WHERE quiz_id = fq.id AND profile_id = ? ORDER BY completed_at DESC LIMIT 1) as last_attempt,
             (SELECT score_percentage FROM family_quiz_attempts WHERE quiz_id = fq.id AND profile_id = ? AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1) as last_score_percentage,
             (SELECT passed FROM family_quiz_attempts WHERE quiz_id = fq.id AND profile_id = ? AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1) as last_passed
      FROM family_quizzes fq
      JOIN quiz_categories qc ON fq.category_id = qc.id
      WHERE fq.assigned_to = ? AND fq.is_active = 1
      ORDER BY fq.created_at DESC
    `).all(childId, childId, childId, childId, childId, childId);

    // Parse theme config and apply gender-specific theme
    const parsed = quizzes.map((quiz: any) => {
      const themeConfig = JSON.parse(quiz.theme_config || '{}');
      const inputConfig = JSON.parse(quiz.input_config || '{}');

      return {
        ...quiz,
        theme: themeConfig[gender] || themeConfig.boy,
        input_config: inputConfig,
        theme_config: undefined // Don't expose full config
      };
    });

    res.json(parsed);
  } catch (error) {
    console.error('Error fetching child quizzes:', error);
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

// Get single quiz with questions (for parent editing)
router.get('/:quizId', (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;

    const quiz = db.prepare(`
      SELECT fq.*,
             qc.display_name as category_name, qc.icon as category_icon,
             qc.name as category_name_key, qc.theme_config, qc.input_config,
             p.name as assigned_to_name, p.gender as assigned_to_gender
      FROM family_quizzes fq
      JOIN quiz_categories qc ON fq.category_id = qc.id
      JOIN profiles p ON fq.assigned_to = p.id
      WHERE fq.id = ?
    `).get(quizId) as any;

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const questions = db.prepare(`
      SELECT * FROM family_quiz_questions
      WHERE quiz_id = ?
      ORDER BY order_index
    `).all(quizId);

    // Parse JSON fields
    const parsedQuestions = questions.map((q: any) => ({
      ...q,
      options: JSON.parse(q.options || '[]')
    }));

    res.json({
      ...quiz,
      theme_config: JSON.parse(quiz.theme_config || '{}'),
      input_config: JSON.parse(quiz.input_config || '{}'),
      questions: parsedQuestions
    });
  } catch (error) {
    console.error('Error fetching quiz:', error);
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

// Create a new quiz
router.post('/', (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      categoryId,
      createdBy,
      assignedTo,
      pointsPerCorrect = 10,
      starsPerCorrect = 0,
      bonusPoints = 20,
      timeLimitSeconds,
      passThreshold = 70,
      scheduleType = 'anytime',
      scheduleDays,
      isCompetition = false,
      competitionEndsAt,
      firstPlaceBonus = 50,
      secondPlaceBonus = 25,
      thirdPlaceBonus = 10,
      difficulty = 'medium',
      questions = '',
      attemptsAllowed = 3,
      isAiGenerated = false,
      aiFocusAreas,
      passingScore = passThreshold
    } = req.body;

    if (!title || !categoryId || !createdBy || !assignedTo) {
      return res.status(400).json({ error: 'Title, category, creator, and assignee required' });
    }

    const viewer = (req as AuthRequest).profile!;
    if (viewer.type !== 'admin' && Number(createdBy) !== viewer.id) {
      return res.status(403).json({ error: 'You can only create quizzes as yourself' });
    }
    if (resolveActingProfileId(viewer, assignedTo) === null) {
      return res.status(403).json({ error: 'You can only assign quizzes to your own children' });
    }

    const result = db.prepare(`
      INSERT INTO family_quizzes (
        title, description, category_id, created_by, assigned_to,
        points_per_correct, stars_per_correct, bonus_points,
        time_limit_seconds, pass_threshold, schedule_type, schedule_days,
        is_competition, competition_ends_at, first_place_bonus, second_place_bonus, third_place_bonus,
        difficulty, questions, attempts_allowed, passing_score, is_ai_generated, ai_focus_areas, is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title, description || null, categoryId, createdBy, assignedTo,
      pointsPerCorrect, starsPerCorrect, bonusPoints,
      timeLimitSeconds || null, passThreshold, scheduleType, scheduleDays || null,
      isCompetition ? 1 : 0, competitionEndsAt || null, firstPlaceBonus, secondPlaceBonus, thirdPlaceBonus,
      difficulty, questions, attemptsAllowed, passingScore, isAiGenerated ? 1 : 0, aiFocusAreas || null, 1
    );

    const quiz = db.prepare('SELECT * FROM family_quizzes WHERE id = ?').get(result.lastInsertRowid);

    // Notify the child about the new quiz
    sendPushNotification(assignedTo, {
      type: 'new_quiz' as any,
      title: 'New Quiz Available! 📝',
      message: `You have a new ${title} quiz to try!`,
      icon: '🎓',
      data: { quizId: result.lastInsertRowid },
      url: '/quizzes'
    });

    res.json(quiz);
  } catch (error) {
    console.error('Error creating quiz:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    res.status(500).json({ error: 'Failed to create quiz', details: error instanceof Error ? error.message : String(error) });
  }
});

// Update a quiz
router.put('/:quizId', (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;
    const updates = req.body;

    const reassignTo = updates.assignedTo ?? updates.assigned_to;
    if (reassignTo !== undefined && resolveActingProfileId((req as AuthRequest).profile!, reassignTo) === null) {
      return res.status(403).json({ error: 'You can only assign quizzes to your own children' });
    }

    const allowedFields = [
      'title', 'description', 'category_id', 'assigned_to',
      'points_per_correct', 'stars_per_correct', 'bonus_points',
      'time_limit_seconds', 'pass_threshold', 'schedule_type', 'schedule_days',
      'is_active', 'is_competition', 'competition_ends_at',
      'first_place_bonus', 'second_place_bonus', 'third_place_bonus',
      'difficulty', 'questions', 'attempts_allowed', 'passing_score', 'is_ai_generated', 'ai_focus_areas'
    ];

    const updateFields: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(snakeKey)) {
        updateFields.push(`${snakeKey} = ?`);
        values.push(value);
      }
    }

    if (updateFields.length === 1) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(quizId);

    db.prepare(`
      UPDATE family_quizzes SET ${updateFields.join(', ')} WHERE id = ?
    `).run(...values);

    const quiz = db.prepare('SELECT * FROM family_quizzes WHERE id = ?').get(quizId);
    res.json(quiz);
  } catch (error) {
    console.error('Error updating quiz:', error);
    res.status(500).json({ error: 'Failed to update quiz' });
  }
});

// Delete a quiz
router.delete('/:quizId', (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;

    // Questions and attempts will be deleted by CASCADE
    db.prepare('DELETE FROM family_quizzes WHERE id = ?').run(quizId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting quiz:', error);
    res.status(500).json({ error: 'Failed to delete quiz' });
  }
});

// ==================== QUIZ QUESTIONS ====================

// Add question to quiz
router.post('/:quizId/questions', (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;
    const {
      questionText,
      questionType = 'multiple_choice',
      questionImage,
      questionAudio,
      options, // array of option objects
      correctAnswer,
      hint,
      explanation,
      points = 10
    } = req.body;

    if (!questionText || !options || !correctAnswer) {
      return res.status(400).json({ error: 'Question text, options, and correct answer required' });
    }

    // Get max order_index
    const maxOrder = db.prepare(`
      SELECT COALESCE(MAX(order_index), -1) + 1 as next_order
      FROM family_quiz_questions WHERE quiz_id = ?
    `).get(quizId) as { next_order: number };

    const result = db.prepare(`
      INSERT INTO family_quiz_questions (
        quiz_id, question_text, question_type, question_image, question_audio,
        options, correct_answer, hint, explanation, points, order_index
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      quizId, questionText, questionType, questionImage || null, questionAudio || null,
      JSON.stringify(options), correctAnswer, hint || null, explanation || null,
      points, maxOrder.next_order
    );

    const question = db.prepare('SELECT * FROM family_quiz_questions WHERE id = ?').get(result.lastInsertRowid) as any;

    res.json({
      ...question,
      options: JSON.parse(question.options)
    });
  } catch (error) {
    console.error('Error adding question:', error);
    res.status(500).json({ error: 'Failed to add question' });
  }
});

// Update question
router.put('/questions/:questionId', (req: Request, res: Response) => {
  try {
    const { questionId } = req.params;
    const updates = req.body;

    const updateFields: string[] = [];
    const values: any[] = [];

    if (updates.questionText !== undefined) {
      updateFields.push('question_text = ?');
      values.push(updates.questionText);
    }
    if (updates.questionType !== undefined) {
      updateFields.push('question_type = ?');
      values.push(updates.questionType);
    }
    if (updates.questionImage !== undefined) {
      updateFields.push('question_image = ?');
      values.push(updates.questionImage);
    }
    if (updates.questionAudio !== undefined) {
      updateFields.push('question_audio = ?');
      values.push(updates.questionAudio);
    }
    if (updates.options !== undefined) {
      updateFields.push('options = ?');
      values.push(JSON.stringify(updates.options));
    }
    if (updates.correctAnswer !== undefined) {
      updateFields.push('correct_answer = ?');
      values.push(updates.correctAnswer);
    }
    if (updates.hint !== undefined) {
      updateFields.push('hint = ?');
      values.push(updates.hint);
    }
    if (updates.explanation !== undefined) {
      updateFields.push('explanation = ?');
      values.push(updates.explanation);
    }
    if (updates.points !== undefined) {
      updateFields.push('points = ?');
      values.push(updates.points);
    }
    if (updates.orderIndex !== undefined) {
      updateFields.push('order_index = ?');
      values.push(updates.orderIndex);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(questionId);

    db.prepare(`
      UPDATE family_quiz_questions SET ${updateFields.join(', ')} WHERE id = ?
    `).run(...values);

    const question = db.prepare('SELECT * FROM family_quiz_questions WHERE id = ?').get(questionId) as any;

    res.json({
      ...question,
      options: JSON.parse(question.options)
    });
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// Delete question
router.delete('/questions/:questionId', (req: Request, res: Response) => {
  try {
    const { questionId } = req.params;

    db.prepare('DELETE FROM family_quiz_questions WHERE id = ?').run(questionId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// Reorder questions
router.put('/:quizId/questions/reorder', (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;
    const { questionIds } = req.body; // array of question IDs in new order

    if (!Array.isArray(questionIds)) {
      return res.status(400).json({ error: 'questionIds array required' });
    }

    const updateOrder = db.prepare(`
      UPDATE family_quiz_questions SET order_index = ? WHERE id = ? AND quiz_id = ?
    `);

    for (let i = 0; i < questionIds.length; i++) {
      updateOrder.run(i, questionIds[i], quizId);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error reordering questions:', error);
    res.status(500).json({ error: 'Failed to reorder questions' });
  }
});

// ==================== QUIZ MEDIA UPLOAD ====================

// Upload quiz media (images/audio)
router.post('/:quizId/media', quizMediaUpload.single('media'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const fileUrl = `/family-quizzes/media/${req.file.filename}`;
    res.json({ success: true, url: fileUrl, filename: req.file.filename });
  } catch (error) {
    console.error('Error uploading media:', error);
    res.status(500).json({ error: 'Failed to upload media' });
  }
});


// ==================== QUIZ ATTEMPTS (PLAYING) ====================

// Start a quiz attempt
router.post('/:quizId/start', (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;
    const profileId = resolveActingProfileId((req as AuthRequest).profile!, req.body.profileId);

    if (profileId === null) {
      return res.status(403).json({ error: 'You can only start quizzes for yourself or your children' });
    }

    const passedAttempt = db.prepare(`
      SELECT 1
      FROM family_quiz_attempts
      WHERE quiz_id = ? AND profile_id = ? AND completed_at IS NOT NULL AND passed = 1
      LIMIT 1
    `).get(quizId, profileId) as any;

    if (passedAttempt) {
      return res.status(403).json({ error: 'Quiz already passed. Try a different quiz.' });
    }

    // Get quiz with questions
    const quiz = db.prepare(`
      SELECT fq.*, qc.theme_config, qc.input_config
      FROM family_quizzes fq
      JOIN quiz_categories qc ON fq.category_id = qc.id
      WHERE fq.id = ?
    `).get(quizId) as any;

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Get child's gender for theming
    const child = db.prepare('SELECT gender FROM profiles WHERE id = ?').get(profileId) as any;
    const gender = child?.gender === 'female' ? 'girl' : 'boy';

    const questions = db.prepare(`
      SELECT id, question_text, question_type, question_image, question_audio,
             options, hint, points, order_index
      FROM family_quiz_questions
      WHERE quiz_id = ?
      ORDER BY order_index
    `).all(quizId);

    if (questions.length === 0) {
      return res.status(400).json({ error: 'Quiz has no questions' });
    }

    // Create attempt record
    const result = db.prepare(`
      INSERT INTO family_quiz_attempts (quiz_id, profile_id, total_questions)
      VALUES (?, ?, ?)
    `).run(quizId, profileId, questions.length);

    // Parse and prepare questions (don't include correct answer!)
    const parsedQuestions = questions.map((q: any) => ({
      id: q.id,
      questionText: q.question_text,
      questionType: q.question_type,
      questionImage: q.question_image,
      questionAudio: q.question_audio,
      options: JSON.parse(q.options),
      hint: q.hint,
      points: q.points,
      orderIndex: q.order_index
    }));

    const themeConfig = JSON.parse(quiz.theme_config || '{}');

    res.json({
      attemptId: result.lastInsertRowid,
      quiz: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        pointsPerCorrect: quiz.points_per_correct,
        starsPerCorrect: quiz.stars_per_correct,
        bonusPoints: quiz.bonus_points,
        timeLimitSeconds: quiz.time_limit_seconds,
        passThreshold: quiz.pass_threshold,
        isCompetition: quiz.is_competition === 1
      },
      theme: themeConfig[gender] || themeConfig.boy,
      questions: parsedQuestions,
      totalQuestions: questions.length
    });
  } catch (error) {
    console.error('Error starting quiz:', error);
    res.status(500).json({ error: 'Failed to start quiz' });
  }
});

// Get timer state for a quiz attempt
router.get('/attempts/:attemptId/timer', (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;

    const attempt = db.prepare(`
      SELECT id, profile_id, quiz_id FROM family_quiz_attempts WHERE id = ?
    `).get(attemptId) as any;

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    const quiz = db.prepare(`
      SELECT time_limit_seconds FROM family_quizzes WHERE id = ?
    `).get(attempt.quiz_id) as any;

    const timerState = getQuizTimerState(attemptId);
    const currentElapsed = timerState ? computeElapsedSeconds(timerState) : 0;

    res.json({
      attempt_id: attempt.id,
      time_limit_seconds: quiz?.time_limit_seconds || null,
      timer_state: timerState ? {
        ...timerState,
        elapsed_seconds: currentElapsed
      } : null
    });
  } catch (error) {
    console.error('[Quiz Timer] Get timer state error:', error);
    res.status(500).json({ error: 'Failed to fetch timer state' });
  }
});

// Start timer for a quiz attempt
router.post('/attempts/:attemptId/timer/start', (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;

    const attempt = db.prepare(`
      SELECT id, profile_id FROM family_quiz_attempts WHERE id = ?
    `).get(attemptId) as any;

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    const existingTimer = getQuizTimerState(attemptId);
    if (existingTimer) {
      return res.json({
        success: true,
        message: 'Timer already started',
        timer_state: {
          ...existingTimer,
          elapsed_seconds: computeElapsedSeconds(existingTimer)
        }
      });
    }

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO timer_states (
        profile_id, quiz_attempt_id, timer_type,
        is_running, is_paused, elapsed_seconds, start_time, last_updated
      )
      VALUES (?, ?, 'quiz', 1, 0, 0, ?, ?)
    `).run(attempt.profile_id, attemptId, now, now);

    const newTimer = getQuizTimerState(attemptId);

    res.json({
      success: true,
      message: 'Timer started',
      timer_state: newTimer
    });
  } catch (error) {
    console.error('[Quiz Timer] Start timer error:', error);
    res.status(500).json({ error: 'Failed to start timer' });
  }
});

// Pause timer for a quiz attempt
router.post('/attempts/:attemptId/timer/pause', (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;

    const timerState = db.prepare(`
      SELECT * FROM timer_states
      WHERE quiz_attempt_id = ? AND timer_type = 'quiz' AND is_running = 1
      ORDER BY id DESC LIMIT 1
    `).get(attemptId) as any;

    if (!timerState) {
      return res.status(404).json({ error: 'No running timer found for this quiz' });
    }

    const now = new Date().toISOString();
    const totalElapsed = computeElapsedSeconds(timerState);

    db.prepare(`
      UPDATE timer_states
      SET is_running = 0, is_paused = 1, elapsed_seconds = ?, pause_time = ?, last_updated = ?
      WHERE id = ?
    `).run(totalElapsed, now, now, timerState.id);

    const updatedTimer = db.prepare('SELECT * FROM timer_states WHERE id = ?').get(timerState.id);

    res.json({
      success: true,
      message: 'Timer paused',
      timer_state: updatedTimer
    });
  } catch (error) {
    console.error('[Quiz Timer] Pause timer error:', error);
    res.status(500).json({ error: 'Failed to pause timer' });
  }
});

// Resume timer for a quiz attempt
router.post('/attempts/:attemptId/timer/resume', (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;

    const timerState = db.prepare(`
      SELECT * FROM timer_states
      WHERE quiz_attempt_id = ? AND timer_type = 'quiz' AND is_paused = 1
      ORDER BY id DESC LIMIT 1
    `).get(attemptId) as any;

    if (!timerState) {
      return res.status(404).json({ error: 'No paused timer found for this quiz' });
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE timer_states
      SET is_running = 1, is_paused = 0, start_time = ?, last_updated = ?
      WHERE id = ?
    `).run(now, now, timerState.id);

    const updatedTimer = db.prepare('SELECT * FROM timer_states WHERE id = ?').get(timerState.id);

    res.json({
      success: true,
      message: 'Timer resumed',
      timer_state: updatedTimer
    });
  } catch (error) {
    console.error('[Quiz Timer] Resume timer error:', error);
    res.status(500).json({ error: 'Failed to resume timer' });
  }
});

// Submit answer for a question
router.post('/attempts/:attemptId/answer', (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;
    const { questionId, selectedAnswer, timeTakenSeconds } = req.body;

    if (!questionId || selectedAnswer === undefined) {
      return res.status(400).json({ error: 'Question ID and answer required' });
    }

    const attemptRow = db.prepare('SELECT quiz_id, completed_at FROM family_quiz_attempts WHERE id = ?').get(attemptId) as any;
    if (attemptRow?.completed_at) {
      return res.status(409).json({ error: 'Attempt already completed' });
    }

    // Get the question to check answer (must belong to this attempt's quiz)
    const question = db.prepare(`
      SELECT correct_answer, explanation, points FROM family_quiz_questions WHERE id = ? AND quiz_id = ?
    `).get(questionId, attemptRow?.quiz_id) as any;

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Retries must not count the same question twice
    const existingAnswer = db.prepare(`
      SELECT is_correct FROM family_quiz_answers WHERE attempt_id = ? AND question_id = ?
    `).get(attemptId, questionId) as any;
    if (existingAnswer) {
      return res.status(409).json({ error: 'Question already answered', isCorrect: existingAnswer.is_correct === 1 });
    }

    const isCorrect = selectedAnswer === question.correct_answer;

    // Save the answer
    db.prepare(`
      INSERT INTO family_quiz_answers (attempt_id, question_id, selected_answer, is_correct, time_taken_seconds)
      VALUES (?, ?, ?, ?, ?)
    `).run(attemptId, questionId, selectedAnswer, isCorrect ? 1 : 0, timeTakenSeconds || null);

    // Update attempt stats
    if (isCorrect) {
      db.prepare(`
        UPDATE family_quiz_attempts
        SET correct_answers = correct_answers + 1
        WHERE id = ?
      `).run(attemptId);
    } else {
      db.prepare(`
        UPDATE family_quiz_attempts
        SET wrong_answers = wrong_answers + 1
        WHERE id = ?
      `).run(attemptId);
    }

    res.json({
      isCorrect,
      correctAnswer: question.correct_answer,
      explanation: question.explanation,
      points: isCorrect ? question.points : 0
    });
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});

// Complete quiz attempt
router.post('/attempts/:attemptId/complete', (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;
    const { timeTakenSeconds } = req.body;

    // Get attempt details
    const attempt = db.prepare(`
      SELECT fa.*, fq.points_per_correct, fq.stars_per_correct, fq.bonus_points,
             fq.pass_threshold, fq.is_competition, fq.first_place_bonus, fq.second_place_bonus, fq.third_place_bonus,
             fq.time_limit_seconds, fq.id as quiz_id, fq.created_by
      FROM family_quiz_attempts fa
      JOIN family_quizzes fq ON fa.quiz_id = fq.id
      WHERE fa.id = ?
    `).get(attemptId) as any;

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    // Idempotent completion: a retried request must not award points twice
    if (attempt.completed_at) {
      return res.status(409).json({
        error: 'Attempt already completed',
        attemptId: attempt.id,
        scorePercentage: attempt.score_percentage,
        passed: attempt.passed === 1,
        pointsEarned: attempt.points_earned
      });
    }

    // Calculate score
    const scorePercentage = Math.round((attempt.correct_answers / attempt.total_questions) * 100);
    const passed = scorePercentage >= attempt.pass_threshold;

    const timerState = getQuizTimerState(attemptId);
    const timerElapsed = timerState ? computeElapsedSeconds(timerState) : null;
    const finalTimeTaken = timerElapsed ?? (attempt.time_taken_seconds ?? timeTakenSeconds ?? null);

    // Calculate points earned
    let pointsEarned = attempt.correct_answers * attempt.points_per_correct;
    let starsEarned = attempt.correct_answers * attempt.stars_per_correct;
    let timeBonusPoints = 0;

    // Add bonus if passed
    if (passed) {
      if (attempt.time_limit_seconds && finalTimeTaken !== null) {
        const remaining = Math.max(0, attempt.time_limit_seconds - finalTimeTaken);
        timeBonusPoints = Math.round((remaining / attempt.time_limit_seconds) * attempt.bonus_points);
        pointsEarned += timeBonusPoints;
      } else if (!attempt.time_limit_seconds) {
        pointsEarned += attempt.bonus_points;
      }
    }

    // Handle competition ranking
    let competitionRank = null;
    let competitionBonus = 0;

    if (attempt.is_competition) {
      // Count completed attempts before this one
      const previousAttempts = db.prepare(`
        SELECT COUNT(*) as count FROM family_quiz_attempts
        WHERE quiz_id = ? AND completed_at IS NOT NULL AND passed = 1 AND id < ?
      `).get(attempt.quiz_id, attemptId) as { count: number };

      if (passed) {
        competitionRank = previousAttempts.count + 1;

        if (competitionRank === 1) {
          competitionBonus = attempt.first_place_bonus;
        } else if (competitionRank === 2) {
          competitionBonus = attempt.second_place_bonus;
        } else if (competitionRank === 3) {
          competitionBonus = attempt.third_place_bonus;
        }

        pointsEarned += competitionBonus;
      }
    }

    // Update attempt
    db.prepare(`
      UPDATE family_quiz_attempts
      SET completed_at = CURRENT_TIMESTAMP,
          score_percentage = ?,
          points_earned = ?,
          stars_earned = ?,
          time_taken_seconds = ?,
          time_bonus_points = ?,
          passed = ?,
          competition_rank = ?,
          bonus_awarded = ?
      WHERE id = ?
    `).run(scorePercentage, pointsEarned, starsEarned, finalTimeTaken,
           timeBonusPoints, passed ? 1 : 0, competitionRank, competitionBonus, attemptId);

    if (timerState) {
      db.prepare(`
        DELETE FROM timer_states WHERE quiz_attempt_id = ? AND timer_type = 'quiz'
      `).run(attemptId);
    }

    // Award points using centralized economy-controlled system
    if (pointsEarned > 0 || starsEarned > 0) {
      const awardResult = awardPoints({
        profileId: attempt.profile_id,
        basePoints: pointsEarned,
        stars: starsEarned,
        source: 'quiz',
        applyMultiplier: false,  // Quiz already calculated points based on score
        enforceRateLimit: false  // No cooldown for quizzes
      });

      // Update pointsEarned to reflect any capping
      if (awardResult.capped) {
        pointsEarned = awardResult.awarded;
      }
    }

    // Notify parent about completion
    const child = db.prepare('SELECT name FROM profiles WHERE id = ?').get(attempt.profile_id) as any;

    sendPushNotification(attempt.created_by, {
      type: 'quiz_completed' as any,
      title: passed ? 'Quiz Passed! 🎉' : 'Quiz Completed',
      message: `${child?.name || 'Your child'} scored ${scorePercentage}% on their quiz!`,
      icon: passed ? '⭐' : '📝',
      data: { attemptId, quizId: attempt.quiz_id, score: scorePercentage },
      url: '/quizzes'
    });

    res.json({
      completed: true,
      scorePercentage,
      passed,
      pointsEarned,
      starsEarned,
      correctAnswers: attempt.correct_answers,
      totalQuestions: attempt.total_questions,
      competitionRank,
      competitionBonus,
      timeTakenSeconds: finalTimeTaken,
      timeBonusPoints
    });
  } catch (error) {
    console.error('Error completing quiz:', error);
    res.status(500).json({ error: 'Failed to complete quiz' });
  }
});

// Get quiz attempt history for a profile
router.get('/attempts/profile/:profileId', (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { limit = 20 } = req.query;

    const attempts = db.prepare(`
      SELECT fa.*, fq.title as quiz_title, qc.icon as category_icon
      FROM family_quiz_attempts fa
      JOIN family_quizzes fq ON fa.quiz_id = fq.id
      JOIN quiz_categories qc ON fq.category_id = qc.id
      WHERE fa.profile_id = ?
      ORDER BY fa.started_at DESC
      LIMIT ?
    `).all(profileId, limit);

    res.json(attempts);
  } catch (error) {
    console.error('Error fetching attempts:', error);
    res.status(500).json({ error: 'Failed to fetch attempts' });
  }
});

// Get detailed attempt results
router.get('/attempts/:attemptId', (req: Request, res: Response) => {
  try {
    const { attemptId } = req.params;

    const attempt = db.prepare(`
      SELECT fa.*, fq.title as quiz_title, fq.description as quiz_description,
             qc.icon as category_icon, qc.display_name as category_name
      FROM family_quiz_attempts fa
      JOIN family_quizzes fq ON fa.quiz_id = fq.id
      JOIN quiz_categories qc ON fq.category_id = qc.id
      WHERE fa.id = ?
    `).get(attemptId) as any;

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    // Get all answers with question details
    const answers = db.prepare(`
      SELECT fqa.*, fqq.question_text, fqq.options, fqq.correct_answer, fqq.explanation
      FROM family_quiz_answers fqa
      JOIN family_quiz_questions fqq ON fqa.question_id = fqq.id
      WHERE fqa.attempt_id = ?
      ORDER BY fqq.order_index
    `).all(attemptId);

    const parsedAnswers = answers.map((a: any) => ({
      ...a,
      options: JSON.parse(a.options)
    }));

    res.json({
      ...attempt,
      answers: parsedAnswers
    });
  } catch (error) {
    console.error('Error fetching attempt details:', error);
    res.status(500).json({ error: 'Failed to fetch attempt details' });
  }
});

// ==================== COMPETITION LEADERBOARD ====================

// Get competition leaderboard for a quiz
router.get('/:quizId/leaderboard', (req: Request, res: Response) => {
  try {
    const { quizId } = req.params;

    const leaderboard = db.prepare(`
      SELECT fa.*, p.name, p.avatar
      FROM family_quiz_attempts fa
      JOIN profiles p ON fa.profile_id = p.id
      WHERE fa.quiz_id = ? AND fa.completed_at IS NOT NULL AND fa.passed = 1
      ORDER BY fa.competition_rank ASC, fa.time_taken_seconds ASC
      LIMIT 10
    `).all(quizId);

    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ==================== QUIZ STATS ====================

// Get quiz statistics for a parent
router.get('/stats/parent/:parentId', (req: Request, res: Response) => {
  try {
    const { parentId } = req.params;

    const stats = db.prepare(`
      SELECT
        COUNT(DISTINCT fq.id) as total_quizzes,
        COUNT(DISTINCT fa.id) as total_attempts,
        AVG(fa.score_percentage) as avg_score,
        SUM(fa.points_earned) as total_points_awarded,
        SUM(fa.stars_earned) as total_stars_awarded,
        COUNT(CASE WHEN fa.passed = 1 THEN 1 END) as passed_attempts,
        COUNT(CASE WHEN fa.completed_at IS NOT NULL THEN 1 END) as completed_attempts
      FROM family_quizzes fq
      LEFT JOIN family_quiz_attempts fa ON fq.id = fa.quiz_id
      WHERE fq.created_by = ?
    `).get(parentId);

    res.json(stats);
  } catch (error) {
    console.error('Error fetching parent stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get quiz statistics for a child
router.get('/stats/child/:childId', (req: Request, res: Response) => {
  try {
    const { childId } = req.params;

    const stats = db.prepare(`
      SELECT
        COUNT(DISTINCT fq.id) as available_quizzes,
        COUNT(fa.id) as total_attempts,
        AVG(fa.score_percentage) as avg_score,
        SUM(fa.points_earned) as total_points_earned,
        SUM(fa.stars_earned) as total_stars_earned,
        COUNT(CASE WHEN fa.passed = 1 THEN 1 END) as quizzes_passed,
        MAX(fa.score_percentage) as best_score,
        COUNT(CASE WHEN fa.competition_rank = 1 THEN 1 END) as first_places
      FROM family_quizzes fq
      LEFT JOIN family_quiz_attempts fa ON fq.id = fa.quiz_id AND fa.profile_id = ?
      WHERE fq.assigned_to = ? AND fq.is_active = 1
    `).get(childId, childId);

    // Get per-category breakdown
    const byCategory = db.prepare(`
      SELECT qc.display_name, qc.icon,
             COUNT(fa.id) as attempts,
             AVG(fa.score_percentage) as avg_score,
             SUM(fa.points_earned) as points_earned
      FROM quiz_categories qc
      LEFT JOIN family_quizzes fq ON qc.id = fq.category_id AND fq.assigned_to = ?
      LEFT JOIN family_quiz_attempts fa ON fq.id = fa.quiz_id AND fa.profile_id = ?
      GROUP BY qc.id
      HAVING attempts > 0
      ORDER BY attempts DESC
    `).all(childId, childId);

    res.json({ overall: stats, byCategory });
  } catch (error) {
    console.error('Error fetching child stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
