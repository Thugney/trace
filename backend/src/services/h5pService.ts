/**
 * H5P Service - Self-hosted H5P integration using Lumi libraries
 *
 * This service provides:
 * - H5P content creation and management
 * - Player rendering for activities
 * - xAPI event handling for tracking
 * - AI-generated content conversion to H5P format
 */

import {
  H5PEditor,
  H5PPlayer,
  H5PConfig,
  IUser,
  IContentMetadata,
  IPlayerModel,
  ContentId,
  fsImplementations,
  cacheImplementations
} from '@lumieducation/h5p-server';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { createWriteStream } from 'fs';
import { db } from '../database/init';

// H5P directories
const H5P_DATA_DIR = process.env.H5P_DATA_DIR || '/app/data/h5p';
const H5P_LIBRARIES_DIR = path.join(H5P_DATA_DIR, 'libraries');
const H5P_CONTENT_DIR = path.join(H5P_DATA_DIR, 'content');
const H5P_TEMP_DIR = path.join(H5P_DATA_DIR, 'temp');
const H5P_CORE_DIR = path.join(H5P_DATA_DIR, 'core');
const H5P_EDITOR_DIR = path.join(H5P_DATA_DIR, 'editor');
const H5P_CARD_IMAGES_DIR = path.join(H5P_DATA_DIR, 'card-images');

// Ensure directories exist
[H5P_DATA_DIR, H5P_LIBRARIES_DIR, H5P_CONTENT_DIR, H5P_TEMP_DIR, H5P_CORE_DIR, H5P_EDITOR_DIR, H5P_CARD_IMAGES_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[H5P] Created directory: ${dir}`);
  }
});

// Ensure config.json exists (JsonStorage requires it to exist)
const H5P_CONFIG_FILE = path.join(H5P_DATA_DIR, 'config.json');
if (!fs.existsSync(H5P_CONFIG_FILE)) {
  fs.writeFileSync(H5P_CONFIG_FILE, '{}', 'utf8');
  console.log('[H5P] Created config.json');
}

// H5P Configuration
// IMPORTANT: The URLs are relative to baseUrl, so don't include baseUrl prefix in them
const h5pConfig = new H5PConfig(
  new fsImplementations.JsonStorage(path.join(H5P_DATA_DIR, 'config.json')),
  {
    baseUrl: '/api/h5p',
    contentFilesUrl: '/content',
    coreUrl: '/core',
    downloadUrl: '/download',
    editorLibraryUrl: '/editor',
    librariesUrl: '/libraries',
    paramsUrl: '/params',
    playUrl: '/play',
    ajaxUrl: '/ajax',
    contentUserDataUrl: '/contentUserData',
    setFinishedUrl: '/setFinished',

    // Content type settings
    fetchingDisabled: 0 as any, // Allow fetching content types from H5P Hub
    uuid: 'family-learning-hub-h5p',
    siteType: 'local',
    sendUsageStatistics: false,
    hubRegistrationEndpoint: 'https://api.h5p.org/v1/sites',
    hubContentTypesEndpoint: 'https://api.h5p.org/v1/content-types/',
    contentTypeCacheRefreshInterval: 86400000, // 24 hours

    // Security
    contentWhitelist: 'json png jpg jpeg gif bmp tif tiff svg eot ttf woff woff2 otf webm mp4 ogg mp3 m4a wav txt pdf rtf doc docx xls xlsx ppt pptx odt ods odp xml csv diff patch swf md textile vtt webvtt',
    libraryWhitelist: 'js css',

    // Display options
    disableFullscreen: false,
  } as any
);

// Custom user implementation for H5P
class H5PUser implements IUser {
  constructor(
    public id: string,
    public name: string,
    public email: string = '',
    public type: 'local' = 'local'
  ) {}

  canInstallRecommended = true;
  canUpdateAndInstallLibraries = true;
  canCreateRestricted = true;
}

// Storage implementations
let libraryStorage: InstanceType<typeof fsImplementations.FileLibraryStorage>;
let contentStorage: InstanceType<typeof fsImplementations.FileContentStorage>;
let temporaryStorage: InstanceType<typeof fsImplementations.DirectoryTemporaryFileStorage>;
let h5pEditor: H5PEditor | null = null;
let h5pPlayer: H5PPlayer | null = null;

/**
 * Initialize the H5P service
 */
export async function initializeH5P(): Promise<void> {
  console.log('[H5P] Initializing H5P service...');

  try {
    // Initialize storage
    libraryStorage = new fsImplementations.FileLibraryStorage(H5P_LIBRARIES_DIR);
    contentStorage = new fsImplementations.FileContentStorage(H5P_CONTENT_DIR);
    temporaryStorage = new fsImplementations.DirectoryTemporaryFileStorage(H5P_TEMP_DIR);

    // Create H5P Editor (which includes player functionality)
    h5pEditor = new H5PEditor(
      new cacheImplementations.CachedKeyValueStorage('kvcache'),
      h5pConfig,
      libraryStorage,
      contentStorage,
      temporaryStorage
    );

    // Create H5P Player
    h5pPlayer = new H5PPlayer(
      libraryStorage,
      contentStorage,
      h5pConfig
    );

    // Set custom renderer to return raw model instead of HTML
    // This allows the frontend to load scripts/styles and initialize H5P
    h5pPlayer.setRenderer((model) => model);

    console.log('[H5P] H5P service initialized successfully');

    // Check if core libraries are installed
    await checkAndDownloadCoreLibraries();

  } catch (error) {
    console.error('[H5P] Failed to initialize H5P service:', error);
    throw error;
  }
}

/**
 * Download a file from URL
 */
function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath);

    const request = https.get(url, (response) => {
      // Handle redirect
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          fs.unlinkSync(destPath);
          downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        file.close();
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });
    });

    request.on('error', (err) => {
      file.close();
      fs.unlink(destPath, () => {}); // Delete the file on error
      reject(err);
    });
  });
}

/**
 * Extract a zip file using execFile for security (no shell injection)
 */
function extractZip(zipPath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Ensure destination exists
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Use execFile instead of exec for security - no shell injection possible
    const { execFile } = require('child_process');
    execFile('unzip', ['-o', zipPath, '-d', destDir], (error: Error | null, stdout: string, stderr: string) => {
      if (error) {
        console.error('[H5P] Unzip error:', stderr);
        reject(error);
        return;
      }
      resolve();
    });
  });
}

/**
 * Copy directory contents recursively using Node.js fs (cross-platform)
 */
function copyDirRecursive(srcDir: string, destDir: string): void {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Copy directory contents - async wrapper for recursive copy
 */
function copyDir(srcDir: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      copyDirRecursive(srcDir, destDir);
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Remove directory using execFile for security
 */
function removeDir(dirPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const { execFile } = require('child_process');
    execFile('rm', ['-rf', dirPath], (error: Error | null) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

/**
 * Download and extract H5P core files if not present
 */
async function downloadH5PCoreFiles(): Promise<void> {
  const coreMarkerFile = path.join(H5P_CORE_DIR, 'js', 'jquery.js');
  const editorMarkerFile = path.join(H5P_EDITOR_DIR, 'scripts', 'h5peditor.js');

  // Check if core files exist
  if (fs.existsSync(coreMarkerFile)) {
    console.log('[H5P] Core files already present');
  } else {
    console.log('[H5P] Downloading H5P core files...');

    const coreZipPath = path.join(H5P_TEMP_DIR, 'h5p-core.zip');
    const coreUrl = 'https://github.com/h5p/h5p-php-library/archive/refs/tags/1.27.0.zip';

    try {
      await downloadFile(coreUrl, coreZipPath);
      console.log('[H5P] Core files downloaded, extracting...');

      // Extract to temp dir first
      const extractDir = path.join(H5P_TEMP_DIR, 'core-extract');
      await extractZip(coreZipPath, extractDir);

      // Move contents from h5p-php-library-1.27.0 to core dir
      const sourceDir = path.join(extractDir, 'h5p-php-library-1.27.0');

      // Copy js, styles, fonts folders
      const jsDir = path.join(sourceDir, 'js');
      const stylesDir = path.join(sourceDir, 'styles');
      const fontsDir = path.join(sourceDir, 'fonts');

      await copyDir(jsDir, path.join(H5P_CORE_DIR, 'js'));
      await copyDir(stylesDir, path.join(H5P_CORE_DIR, 'styles'));
      await copyDir(fontsDir, path.join(H5P_CORE_DIR, 'fonts'));

      console.log('[H5P] Core files installed successfully');

      // Cleanup
      fs.unlinkSync(coreZipPath);
      await removeDir(extractDir);
    } catch (error) {
      console.error('[H5P] Failed to download core files:', error);
    }
  }

  // Check if editor files exist
  if (fs.existsSync(editorMarkerFile)) {
    console.log('[H5P] Editor files already present');
  } else {
    console.log('[H5P] Downloading H5P editor files...');

    const editorZipPath = path.join(H5P_TEMP_DIR, 'h5p-editor.zip');
    const editorUrl = 'https://github.com/h5p/h5p-editor-php-library/archive/refs/tags/1.27.0.zip';

    try {
      await downloadFile(editorUrl, editorZipPath);
      console.log('[H5P] Editor files downloaded, extracting...');

      // Extract to temp dir first
      const extractDir = path.join(H5P_TEMP_DIR, 'editor-extract');
      await extractZip(editorZipPath, extractDir);

      // Move contents from h5p-editor-php-library-1.27.0 to editor dir
      const sourceDir = path.join(extractDir, 'h5p-editor-php-library-1.27.0');

      // Copy scripts, styles, images, ckeditor, language folders
      const foldersToMove = ['scripts', 'styles', 'images', 'ckeditor', 'language'];

      for (const folder of foldersToMove) {
        const srcPath = path.join(sourceDir, folder);
        const destPath = path.join(H5P_EDITOR_DIR, folder);

        if (fs.existsSync(srcPath)) {
          await copyDir(srcPath, destPath);
        }
      }

      console.log('[H5P] Editor files installed successfully');

      // Cleanup
      fs.unlinkSync(editorZipPath);
      await removeDir(extractDir);
    } catch (error) {
      console.error('[H5P] Failed to download editor files:', error);
    }
  }
}

/**
 * Check if core H5P libraries are installed, download if needed
 */
async function checkAndDownloadCoreLibraries(): Promise<void> {
  // First, download H5P core framework files (jQuery, h5p.js, etc.)
  await downloadH5PCoreFiles();

  // Check for essential content types
  const essentialLibraries = [
    'H5P.QuestionSet',
    'H5P.MultiChoice',
    'H5P.TrueFalse',
    'H5P.Blanks',
    'H5P.DragQuestion',
    'H5P.MemoryGame',
    'H5P.Flashcards',
    'H5P.ImageHotspots',
    'H5P.MarkTheWords',
    'H5P.DragText'
  ];

  console.log('[H5P] Checking for essential libraries...');

  // This will be populated when libraries are installed
  // For now, log a message about manual installation
  const installedLibraries = await libraryStorage.getInstalledLibraryNames();

  if (installedLibraries.length === 0) {
    console.log('[H5P] No libraries installed. Please run the library setup script.');
    console.log('[H5P] Libraries can be downloaded from: https://h5p.org/content-types-and-applications');
  } else {
    console.log(`[H5P] Found ${installedLibraries.length} installed libraries`);
  }
}

/**
 * Get the H5P Editor instance
 */
export function getH5PEditor(): H5PEditor {
  if (!h5pEditor) {
    throw new Error('H5P service not initialized. Call initializeH5P() first.');
  }
  return h5pEditor;
}

/**
 * Get the H5P Player instance
 */
export function getH5PPlayer(): H5PPlayer {
  if (!h5pPlayer) {
    throw new Error('H5P service not initialized. Call initializeH5P() first.');
  }
  return h5pPlayer;
}

/**
 * Get H5P configuration
 */
export function getH5PConfig(): H5PConfig {
  return h5pConfig;
}

/**
 * Create an H5P user from a profile
 */
export function createH5PUser(profileId: number, profileName: string): H5PUser {
  return new H5PUser(
    profileId.toString(),
    profileName,
    `profile-${profileId}@familyhub.local`
  );
}

function buildH5PMetadata(
  metadata: Partial<IContentMetadata>,
  libraryName: string
): IContentMetadata {
  return {
    title: metadata.title || 'Untitled',
    license: metadata.license || 'U',
    embedTypes: metadata.embedTypes || ['div'],
    language: metadata.language || 'en',
    mainLibrary: libraryName.split(' ')[0],
    preloadedDependencies: metadata.preloadedDependencies || [],
    defaultLanguage: metadata.defaultLanguage || 'en'
  };
}

/**
 * Create H5P content from parameters
 */
export async function createH5PContent(
  libraryName: string,
  params: any,
  metadata: Partial<IContentMetadata>,
  user: H5PUser
): Promise<ContentId> {
  const editor = getH5PEditor();

  const contentId = await editor.saveOrUpdateContentReturnMetaData(
    undefined as any, // new content - cast to any to work around type issue
    params,
    buildH5PMetadata(metadata, libraryName),
    libraryName,
    user
  );

  return contentId.id;
}

/**
 * Update existing H5P content in place.
 */
export async function updateH5PContent(
  contentId: ContentId,
  libraryName: string,
  params: any,
  metadata: Partial<IContentMetadata>,
  user: H5PUser
): Promise<ContentId> {
  const editor = getH5PEditor();

  const updatedContent = await editor.saveOrUpdateContentReturnMetaData(
    contentId as any,
    params,
    buildH5PMetadata(metadata, libraryName),
    libraryName,
    user
  );

  return updatedContent.id;
}

/**
 * Get H5P content for playing
 */
export async function getH5PContentForPlay(
  contentId: ContentId,
  user: H5PUser
): Promise<IPlayerModel> {
  const player = getH5PPlayer();
  return await player.render(contentId, user);
}

/**
 * Delete H5P content
 */
export async function deleteH5PContent(
  contentId: ContentId,
  user: H5PUser
): Promise<void> {
  const editor = getH5PEditor();
  await editor.deleteContent(contentId, user);
}

/**
 * Get list of installed content types
 */
export async function getInstalledContentTypes(): Promise<string[]> {
  const libraries = await libraryStorage.getInstalledLibraryNames();
  return libraries.map(lib => `${lib.machineName} ${lib.majorVersion}.${lib.minorVersion}`);
}

/**
 * Install an H5P library from a .h5p file
 * This installs ONLY the libraries from the package, not the content
 */
export async function installLibraryFromFile(
  filePath: string,
  user: H5PUser
): Promise<{ installed: string[]; errors: string[] }> {
  const editor = getH5PEditor();

  try {
    // Use installLibrariesFromPackage which only installs libraries
    // and doesn't try to install content (which would fail if libraries are missing)
    const results = await editor.packageImporter.installLibrariesFromPackage(filePath);

    // Debug: Log all results
    console.log(`[H5P] Installation results (${results.length} total):`);
    results.forEach((r, i) => {
      console.log(`[H5P]   ${i + 1}. type=${r.type}, newVersion=${r.newVersion?.machineName || 'none'}, oldVersion=${r.oldVersion?.machineName || 'none'}`);
    });

    // Filter for new or patched libraries
    const installed = results
      .filter(r => (r.type === 'new' || r.type === 'patch') && r.newVersion)
      .map(r => `${r.newVersion!.machineName} ${r.newVersion!.majorVersion}.${r.newVersion!.minorVersion}`);

    // Also count libraries that were already up-to-date (type='none')
    const alreadyInstalled = results
      .filter(r => r.type === 'none' && r.oldVersion)
      .map(r => `${r.oldVersion!.machineName} ${r.oldVersion!.majorVersion}.${r.oldVersion!.minorVersion}`);

    console.log(`[H5P] Installed ${installed.length} new libraries from: ${filePath}`);
    if (installed.length > 0) {
      console.log('[H5P] New libraries:', installed.join(', '));
    }
    if (alreadyInstalled.length > 0) {
      console.log('[H5P] Already installed:', alreadyInstalled.join(', '));
    }

    return { installed, errors: [] };
  } catch (error: any) {
    console.error('[H5P] Error installing libraries:', error);
    throw error;
  }
}

/**
 * Install an H5P library from the official H5P Hub
 * @param machineName - The machine name of the library (e.g., "H5P.MultiChoice")
 */
export async function installLibraryFromHub(
  machineName: string,
  user: H5PUser
): Promise<{ installed: string[]; errors: string[] }> {
  const editor = getH5PEditor();

  try {
    console.log(`[H5P] Installing library from Hub: ${machineName}`);

    const results = await editor.installLibraryFromHub(machineName, user);

    const installed = results
      .filter(r => (r.type === 'new' || r.type === 'patch') && r.newVersion)
      .map(r => `${r.newVersion!.machineName} ${r.newVersion!.majorVersion}.${r.newVersion!.minorVersion}`);

    console.log(`[H5P] Installed ${installed.length} libraries from Hub`);
    if (installed.length > 0) {
      console.log('[H5P] Libraries:', installed.join(', '));
    }

    return { installed, errors: [] };
  } catch (error: any) {
    console.error(`[H5P] Error installing ${machineName} from Hub:`, error);
    return { installed: [], errors: [error.message] };
  }
}

/**
 * Get list of available content types from the H5P Hub
 */
export async function getAvailableContentTypes(): Promise<any[]> {
  const editor = getH5PEditor();

  try {
    // The contentTypeRepository has the list of available content types
    const hubInfo = await editor.contentTypeRepository.get(
      createH5PUser(0, 'system'),
      'en'
    );

    // IHubInfo has 'libraries' property, not 'contentTypes'
    return hubInfo.libraries || [];
  } catch (error: any) {
    console.error('[H5P] Error fetching content types from Hub:', error);
    return [];
  }
}

// ==================== AI TO H5P CONTENT CONVERTERS ====================

/**
 * QuizSpec interface - what AI generates
 */
export interface QuizSpec {
  title: string;
  age: number;
  theme: string;
  questions: QuizQuestion[];
}

export interface QuizQuestion {
  type: 'mcq' | 'true_false' | 'fill_blank' | 'matching' | 'drag_text' | 'mark_words';
  prompt: string;
  choices?: string[];
  answerIndex?: number;
  correctAnswer?: boolean | string | string[];
  explanation?: string;
  pairs?: { left: string; right: string }[];
  // For drag_text: text with *draggable* words marked with asterisks
  textWithDraggables?: string;
  // For mark_words: text with *correct* words marked with asterisks
  textWithMarks?: string;
}

/**
 * Clean up AI-generated text by converting Markdown asterisks to HTML bold tags.
 * This prevents asterisks from being displayed literally or misinterpreted as blanks.
 * @param text The AI-generated text that may contain *asterisk* emphasis
 * @returns Cleaned text with asterisks converted to <strong> tags
 */
function cleanAiGeneratedText(text: string): string {
  if (!text) return text;

  // Convert Markdown bold (**text** or *text*) to HTML <strong> tags
  // Handle double asterisks first: **bold** -> <strong>bold</strong>
  let cleaned = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Handle single asterisks: *emphasis* -> <strong>emphasis</strong>
  // But be careful not to match already converted tags or standalone asterisks
  cleaned = cleaned.replace(/\*([^*<>]+)\*/g, '<strong>$1</strong>');

  return cleaned;
}

/**
 * Remove all asterisks from text (for fill_blank where we need clean text before adding answer markers)
 * @param text The text to clean
 * @returns Text with all asterisks removed
 */
function stripAsterisks(text: string): string {
  if (!text) return text;
  return text.replace(/\*+/g, '');
}

const BLANK_PLACEHOLDER_PATTERN = /_{2,}/;

function hasBlankPlaceholder(text: string): boolean {
  return BLANK_PLACEHOLDER_PATTERN.test(text || '');
}

function normalizeBlankCorrectAnswer(correctAnswer: QuizQuestion['correctAnswer']): string {
  if (Array.isArray(correctAnswer)) {
    return correctAnswer
      .map(answer => stripAsterisks(String(answer || '')).trim())
      .filter(Boolean)
      .join('/');
  }

  return stripAsterisks(String(correctAnswer || '')).trim();
}

/**
 * Convert AI-generated QuizSpec to H5P Question Set params
 */
export function convertQuizSpecToH5P(quizSpec: QuizSpec): {
  library: string;
  params: any;
  metadata: Partial<IContentMetadata>;
} {
  const questions = quizSpec.questions.map((q, index) => {
    switch (q.type) {
      case 'mcq':
        return convertMCQToH5P(q, index);
      case 'true_false':
        return convertTrueFalseToH5P(q, index);
      case 'fill_blank':
        return convertFillBlankToH5P(q, index);
      case 'drag_text':
        return convertDragTextToH5P(q, index);
      case 'mark_words':
        return convertMarkWordsToH5P(q, index);
      default:
        return convertMCQToH5P(q, index); // Default to MCQ
    }
  });

  return {
    library: 'H5P.QuestionSet 1.20',
    params: {
      introPage: {
        showIntroPage: true,
        startButtonText: 'Start Quiz',
        title: quizSpec.title,
        introduction: `A fun quiz about ${quizSpec.theme} for ${quizSpec.age}-year-olds!`
      },
      progressType: 'dots',
      passPercentage: 70,
      showInstantFeedback: true,
      showResultsPage: true,
      showSolutionButton: true,
      showRetryButton: true,
      randomQuestions: false,
      endGame: {
        showResultPage: true,
        showSolutionButton: true,
        showRetryButton: true,
        message: 'Your result:',
        scoreBarLabel: 'You got @score of @total points',
        overallFeedback: [
          { from: 0, to: 50, feedback: 'Keep practicing!' },
          { from: 51, to: 80, feedback: 'Good job!' },
          { from: 81, to: 100, feedback: 'Excellent!' }
        ],
        successMessage: 'Congratulations! You passed!',
        failMessage: 'Try again to improve your score.'
      },
      questions
    },
    metadata: {
      title: quizSpec.title,
      license: 'U'
    }
  };
}

/**
 * Convert MCQ question to H5P MultiChoice format
 */
function convertMCQToH5P(q: QuizQuestion, index: number): any {
  // Clean the prompt text to convert Markdown asterisks to HTML bold
  const cleanedPrompt = cleanAiGeneratedText(q.prompt);
  const cleanedExplanation = cleanAiGeneratedText(q.explanation || '');

  const answers = (q.choices || []).map((choice, i) => ({
    correct: i === q.answerIndex,
    text: `<div>${cleanAiGeneratedText(choice)}</div>`,
    tpiMSG: i === q.answerIndex
      ? (cleanedExplanation || 'Correct!')
      : 'Try again!'
  }));

  return {
    library: 'H5P.MultiChoice 1.16',
    params: {
      question: `<p>${cleanedPrompt}</p>`,
      answers,
      behaviour: {
        enableRetry: true,
        enableSolutionsButton: true,
        enableCheckButton: true,
        type: 'auto',
        singlePoint: false,
        randomAnswers: true,
        showSolutionsRequiresInput: true,
        confirmCheckDialog: false,
        confirmRetryDialog: false,
        autoCheck: false,
        passPercentage: 100,
        showScorePoints: true
      },
      UI: {
        checkAnswerButton: 'Check',
        showSolutionButton: 'Show solution',
        tryAgainButton: 'Retry',
        tipsLabel: 'Show tip',
        scoreBarLabel: 'You got :num out of :total points',
        tipAvailable: 'Tip available',
        feedbackAvailable: 'Feedback available',
        readFeedback: 'Read feedback',
        wrongAnswer: 'Wrong answer',
        correctAnswer: 'Correct answer',
        shouldCheck: 'Should have been checked',
        shouldNotCheck: 'Should not have been checked',
        noInput: 'Please answer before viewing the solution'
      },
      confirmCheck: {
        header: 'Finish ?',
        body: 'Are you sure you wish to finish ?',
        cancelLabel: 'Cancel',
        confirmLabel: 'Finish'
      },
      confirmRetry: {
        header: 'Retry ?',
        body: 'Are you sure you wish to retry ?',
        cancelLabel: 'Cancel',
        confirmLabel: 'Confirm'
      },
      media: {
        disableImageZooming: false
      }
    },
    subContentId: `q-${index}-${Date.now()}`
  };
}

/**
 * Convert True/False question to H5P TrueFalse format
 */
function convertTrueFalseToH5P(q: QuizQuestion, index: number): any {
  // Clean the prompt text to convert Markdown asterisks to HTML bold
  const cleanedPrompt = cleanAiGeneratedText(q.prompt);
  const cleanedExplanation = cleanAiGeneratedText(q.explanation || '');

  return {
    library: 'H5P.TrueFalse 1.8',
    params: {
      question: `<p>${cleanedPrompt}</p>`,
      correct: q.correctAnswer === true ? 'true' : 'false',
      behaviour: {
        enableRetry: true,
        enableSolutionsButton: true,
        enableCheckButton: true,
        confirmCheckDialog: false,
        confirmRetryDialog: false,
        autoCheck: false
      },
      l10n: {
        trueText: 'True',
        falseText: 'False',
        score: 'You got @score of @total points',
        checkAnswer: 'Check',
        showSolutionButton: 'Show solution',
        tryAgain: 'Retry',
        wrongAnswerMessage: cleanedExplanation || 'Wrong answer',
        correctAnswerMessage: 'Correct!'
      },
      media: {
        disableImageZooming: false
      },
      confirmCheck: {
        header: 'Finish ?',
        body: 'Are you sure you wish to finish ?',
        cancelLabel: 'Cancel',
        confirmLabel: 'Finish'
      },
      confirmRetry: {
        header: 'Retry ?',
        body: 'Are you sure you wish to retry ?',
        cancelLabel: 'Cancel',
        confirmLabel: 'Confirm'
      }
    },
    subContentId: `q-${index}-${Date.now()}`
  };
}

/**
 * Convert Fill in the Blank question to H5P Blanks format
 */
function convertFillBlankToH5P(q: QuizQuestion, index: number): any {
  // Clean up the prompt and convert to H5P format
  let textWithBlanks = q.prompt;
  const correctAnswer = normalizeBlankCorrectAnswer(q.correctAnswer);

  // STEP 1: Remove off-topic content patterns FIRST (before any processing)
  // Common AI hallucination patterns that sneak into responses
  const offTopicPatterns = [
    /\.\s*Oslo\s+is\s+the\s+capital\s+of[^.]*\./gi,
    /\.\s*Example:[^.]*\./gi,
    /\.\s*For\s+instance:[^.]*\./gi,
    /\.\s*Sample:[^.]*\./gi,
    /\.\s*E\.g\.:[^.]*\./gi,
    /\.\s*For\s+example[^.]*\./gi,
  ];

  for (const pattern of offTopicPatterns) {
    const before = textWithBlanks;
    textWithBlanks = textWithBlanks.replace(pattern, '.');
    if (textWithBlanks !== before) {
      console.warn(`[H5P] Fill-blank question ${index}: Removed off-topic content`);
    }
  }

  // STEP 2: Strip ALL asterisks (AI might use *bold* for emphasis which would become extra blanks)
  textWithBlanks = textWithBlanks.replace(/\*+/g, '');

  // STEP 3: If prompt has placeholder underscores, replace the first group with *answer*
  // Accept "__", "___", "_____" etc. because AI generation is inconsistent here.
  if (hasBlankPlaceholder(textWithBlanks)) {
    textWithBlanks = textWithBlanks.replace(BLANK_PLACEHOLDER_PATTERN, `*${correctAnswer}*`);
    // If there were multiple placeholder groups, remove the extras entirely.
    textWithBlanks = textWithBlanks.replace(/_{2,}/g, '____'); // Mark extras with 4 underscores
    if (textWithBlanks.includes('____')) {
      console.warn(`[H5P] Fill-blank question ${index}: Multiple blanks detected, keeping only first`);
      // Remove extra blank patterns entirely (they would create unwanted input fields)
      textWithBlanks = textWithBlanks.replace(/\s*____\s*/g, ' ');
    }
  } else {
    // If no placeholder is present, append a single H5P blank marker as a fallback.
    console.warn(`[H5P] Fill-blank question ${index} has no underscore placeholder, using fallback`);
    textWithBlanks = `${textWithBlanks.trim().replace(/[.!?]$/, '')} *${correctAnswer}*.`;
  }

  // STEP 4: Keep only the sentence with the answer marker
  const sentences = textWithBlanks.split(/(?<=[.!?])\s+/).filter(s => s.trim());

  if (sentences.length > 1) {
    const sentenceWithAnswer = sentences.find(s => s.includes('*'));
    if (sentenceWithAnswer) {
      textWithBlanks = sentenceWithAnswer.trim();
    } else {
      textWithBlanks = sentences[0].trim();
    }
  }

  // STEP 5: Final safety check - ensure ONLY ONE *answer* pattern exists
  const asteriskPairs = textWithBlanks.match(/\*[^*]+\*/g);
  if (asteriskPairs && asteriskPairs.length > 1) {
    console.warn(`[H5P] Fill-blank question ${index}: Multiple asterisk pairs found, keeping only first`);
    // Keep only the text up to and including the first *answer* pattern
    const firstMatch = asteriskPairs[0];
    const firstMatchEnd = textWithBlanks.indexOf(firstMatch) + firstMatch.length;
    // Find the end of the sentence containing the answer
    const remainingText = textWithBlanks.slice(firstMatchEnd);
    const sentenceEnd = remainingText.search(/[.!?]/);
    if (sentenceEnd !== -1) {
      textWithBlanks = textWithBlanks.slice(0, firstMatchEnd + sentenceEnd + 1).trim();
    } else {
      textWithBlanks = textWithBlanks.slice(0, firstMatchEnd).trim() + '.';
    }
  }

  // STEP 6: Final off-topic check on the cleaned text
  const finalOffTopicCheck = [/\bOslo\b/i, /\bExample:/i, /\bFor\s+instance:/i];
  for (const pattern of finalOffTopicCheck) {
    if (pattern.test(textWithBlanks)) {
      console.warn(`[H5P] Fill-blank question ${index}: Off-topic content still present, using simple format`);
      textWithBlanks = `The answer is *${correctAnswer}*.`;
      break;
    }
  }

  return {
    library: 'H5P.Blanks 1.14',
    params: {
      text: 'Fill in the missing answer.',
      questions: [
        {
          question: `<p>${textWithBlanks}</p>`
        }
      ],
      overallFeedback: [
        { from: 0, to: 50, feedback: 'Keep practicing!' },
        { from: 51, to: 80, feedback: 'Good job!' },
        { from: 81, to: 100, feedback: 'Excellent!' }
      ],
      showSolutions: 'Show solution',
      tryAgain: 'Retry',
      checkAnswer: 'Check',
      submitAnswer: 'Submit',
      notFilledOut: 'Please fill in all blanks to view the solution',
      answerIsCorrect: 'Correct!',
      answerIsWrong: 'Wrong',
      answeredCorrectly: 'Answered correctly',
      answeredIncorrectly: 'Answered incorrectly',
      solutionLabel: 'Correct answer:',
      inputLabel: 'Blank input @num of @total',
      inputHasTipLabel: 'Tip available',
      tipLabel: 'Tip',
      behaviour: {
        enableRetry: true,
        enableSolutionsButton: true,
        enableCheckButton: true,
        autoCheck: false,
        caseSensitive: false,
        showSolutionsRequiresInput: true,
        separateLines: false,
        confirmCheckDialog: false,
        confirmRetryDialog: false,
        acceptSpellingErrors: true
      },
      scoreBarLabel: 'You got :num out of :total points',
      a11yCheck: 'Check the answers',
      a11yShowSolution: 'Show the solution',
      a11yRetry: 'Retry the task',
      a11yCheckingModeHeader: 'Checking mode'
    },
    subContentId: `q-${index}-${Date.now()}`
  };
}

export function extractQuizSpecFromAiPrompt(aiPrompt: string): QuizSpec | null {
  if (!aiPrompt) {
    return null;
  }

  try {
    const parsed = JSON.parse(aiPrompt);

    if (parsed?.quizSpec?.questions && Array.isArray(parsed.quizSpec.questions)) {
      return parsed.quizSpec as QuizSpec;
    }

    if (parsed?.questions && Array.isArray(parsed.questions)) {
      return parsed as QuizSpec;
    }
  } catch (error) {
    console.warn('[H5P] Failed to parse ai_prompt for quiz extraction:', error);
  }

  return null;
}

export function questionSetNeedsRepair(storedParams: any, quizSpec: QuizSpec): boolean {
  const storedQuestions = Array.isArray(storedParams?.questions) ? storedParams.questions : [];

  return quizSpec.questions.some((question, index) => {
    if (question.type !== 'fill_blank') {
      return false;
    }

    const expectedQuestion = convertFillBlankToH5P(question, index);
    const storedQuestion = storedQuestions[index];

    if (!storedQuestion || storedQuestion.library !== expectedQuestion.library) {
      return true;
    }

    const storedQuestionParams = storedQuestion.params || {};
    const hasStructuredQuestion =
      Array.isArray(storedQuestionParams.questions) &&
      storedQuestionParams.questions.length === 1 &&
      typeof storedQuestionParams.questions[0]?.question === 'string' &&
      storedQuestionParams.questions[0].question.trim() !== '';

    if (hasStructuredQuestion) {
      return false;
    }

    return true;
  });
}

/**
 * Convert Drag Text question to H5P DragText format
 * Text has *draggable* words marked with asterisks that get turned into blanks
 */
function convertDragTextToH5P(q: QuizQuestion, index: number): any {
  // The text should have words wrapped in *asterisks* which become draggable
  // Format: "The *capital* of France is *Paris*."
  let textContent = q.textWithDraggables || q.prompt;

  // If no asterisks in text, try to add them based on correctAnswer
  if (!textContent.includes('*') && q.correctAnswer) {
    const answers = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer as string];
    answers.forEach(answer => {
      textContent = textContent.replace(new RegExp(`\\b${answer}\\b`, 'i'), `*${answer}*`);
    });
  }

  // Clean the task description (instructions shown above the activity)
  // This should NOT have asterisks since it's just instruction text
  const cleanedPrompt = cleanAiGeneratedText(q.prompt);

  return {
    library: 'H5P.DragText 1.10',
    params: {
      taskDescription: `<p>${cleanedPrompt}</p>`,
      textField: textContent,
      overallFeedback: [
        { from: 0, to: 50, feedback: 'Keep practicing!' },
        { from: 51, to: 80, feedback: 'Good job!' },
        { from: 81, to: 100, feedback: 'Excellent!' }
      ],
      checkAnswer: 'Check',
      tryAgain: 'Retry',
      showSolution: 'Show solution',
      dropZoneIndex: 'Drop Zone @index.',
      empty: 'Drop Zone @index is empty.',
      contains: 'Drop Zone @index contains draggable @draggable.',
      ariaDraggableIndex: '@index of @count draggables.',
      tipLabel: 'Show tip',
      correctText: 'Correct!',
      incorrectText: 'Incorrect!',
      resetDropTitle: 'Reset drop',
      resetDropDescription: 'Are you sure you want to reset this drop zone?',
      grabbed: 'Draggable is grabbed.',
      cancelledDragging: 'Cancelled dragging.',
      correctAnswer: 'Correct answer:',
      feedbackHeader: 'Feedback',
      behaviour: {
        enableRetry: true,
        enableSolutionsButton: true,
        enableCheckButton: true,
        instantFeedback: false
      }
    },
    subContentId: `q-${index}-${Date.now()}`
  };
}

/**
 * Convert Mark the Words question to H5P MarkTheWords format
 * Text has *correct* words marked with asterisks that should be selected
 */
function convertMarkWordsToH5P(q: QuizQuestion, index: number): any {
  // The text should have words wrapped in *asterisks* which are the correct answers
  // Format: "Click on all the *verbs* in this sentence: The dog *runs* and *jumps*."
  let textContent = q.textWithMarks || q.prompt;

  // If no asterisks in text, try to add them based on correctAnswer
  if (!textContent.includes('*') && q.correctAnswer) {
    const answers = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer as string];
    answers.forEach(answer => {
      textContent = textContent.replace(new RegExp(`\\b${answer}\\b`, 'gi'), `*${answer}*`);
    });
  }

  // Clean the task description (instructions shown above the activity)
  // This should NOT have asterisks since it's just instruction text
  const cleanedPrompt = cleanAiGeneratedText(q.prompt);

  return {
    library: 'H5P.MarkTheWords 1.11',
    params: {
      taskDescription: `<p>${cleanedPrompt}</p>`,
      textField: textContent,
      overallFeedback: [
        { from: 0, to: 50, feedback: 'Keep practicing!' },
        { from: 51, to: 80, feedback: 'Good job!' },
        { from: 81, to: 100, feedback: 'Excellent!' }
      ],
      checkAnswerButton: 'Check',
      tryAgainButton: 'Retry',
      showSolutionButton: 'Show solution',
      behaviour: {
        enableRetry: true,
        enableSolutionsButton: true,
        enableCheckButton: true,
        showScorePoints: true
      },
      correctAnswer: 'Correct!',
      incorrectAnswer: 'Incorrect!',
      missedAnswer: 'Missed!',
      displaySolutionDescription: 'Task is updated to show the solution.'
    },
    subContentId: `q-${index}-${Date.now()}`
  };
}

// ==================== TEXT CARD IMAGE GENERATOR ====================

/**
 * Color palette for memory game cards (child-friendly colors)
 */
const CARD_COLORS = [
  { bg: '#FF6B6B', text: '#FFFFFF' }, // Red
  { bg: '#4ECDC4', text: '#FFFFFF' }, // Teal
  { bg: '#45B7D1', text: '#FFFFFF' }, // Blue
  { bg: '#96CEB4', text: '#2D3436' }, // Mint
  { bg: '#FFEAA7', text: '#2D3436' }, // Yellow
  { bg: '#DDA0DD', text: '#2D3436' }, // Plum
  { bg: '#98D8C8', text: '#2D3436' }, // Sage
  { bg: '#F7DC6F', text: '#2D3436' }, // Gold
  { bg: '#BB8FCE', text: '#FFFFFF' }, // Purple
  { bg: '#85C1E9', text: '#2D3436' }, // Light Blue
  { bg: '#F8B500', text: '#2D3436' }, // Orange
  { bg: '#58D68D', text: '#FFFFFF' }, // Green
];

/**
 * Generate an SVG image with text for memory game cards
 * @returns The filename of the generated SVG
 */
export function generateTextCardImage(
  text: string,
  colorIndex: number,
  contentId: string
): string {
  const color = CARD_COLORS[colorIndex % CARD_COLORS.length];

  // Truncate long text and split into lines
  const maxCharsPerLine = 12;
  const maxLines = 4;
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxCharsPerLine) {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word.length > maxCharsPerLine ? word.slice(0, maxCharsPerLine) : word;
    }
    if (lines.length >= maxLines) break;
  }
  if (currentLine && lines.length < maxLines) lines.push(currentLine);

  // Calculate font size based on content
  const longestLine = Math.max(...lines.map(l => l.length));
  let fontSize = 32;
  if (longestLine > 10) fontSize = 28;
  if (longestLine > 12) fontSize = 24;
  if (lines.length > 3) fontSize = Math.min(fontSize, 24);

  // Generate SVG
  const svgWidth = 200;
  const svgHeight = 200;
  const lineHeight = fontSize * 1.3;
  const totalTextHeight = lines.length * lineHeight;
  const startY = (svgHeight - totalTextHeight) / 2 + fontSize * 0.8;

  const textElements = lines.map((line, i) =>
    `<text x="${svgWidth / 2}" y="${startY + i * lineHeight}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${color.text}" text-anchor="middle">${escapeXml(line)}</text>`
  ).join('\n    ');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <rect width="${svgWidth}" height="${svgHeight}" rx="15" fill="${color.bg}"/>
  <rect x="10" y="10" width="${svgWidth - 20}" height="${svgHeight - 20}" rx="10" fill="none" stroke="${color.text}" stroke-width="3" stroke-opacity="0.3"/>
    ${textElements}
</svg>`;

  // Save to file
  const filename = `card-${contentId}-${colorIndex}-${Date.now()}.svg`;
  const filepath = path.join(H5P_CARD_IMAGES_DIR, filename);
  fs.writeFileSync(filepath, svg, 'utf8');

  console.log(`[H5P] Generated card image: ${filename}`);
  return filename;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ==================== STANDALONE CONTENT TYPE CONVERTERS ====================

/**
 * Standalone content spec interfaces
 */
export interface MemoryGameSpec {
  title: string;
  description?: string;
  pairs: Array<{ image?: string; text: string; matchingText?: string }>;
}

export interface FlashcardsSpec {
  title: string;
  description?: string;
  cards: Array<{ front: string; back: string; image?: string }>;
}

export interface FindTheWordsSpec {
  title: string;
  description?: string;
  words: string[];
  gridSize?: number;
}

export interface DialogCardsSpec {
  title: string;
  description?: string;
  cards: Array<{ front: string; back: string; tips?: string }>;
}

/**
 * Information about generated card images for memory game
 */
export interface MemoryGameCardImages {
  generatedFiles: Array<{ filename: string; filepath: string }>;
  cardParams: any[];
}

/**
 * Convert Memory Game spec to H5P format with generated card images
 * NOTE: H5P Memory Game REQUIRES images. For text-only pairs, we generate colored SVG cards.
 *
 * This function:
 * 1. Generates SVG card images for each pair
 * 2. Returns the card image info so they can be copied to the H5P content folder
 * 3. Uses relative paths like "images/card-X.svg" that H5P expects
 *
 * @param spec - The memory game specification
 * @param contentId - Unique identifier for this content (used for image filenames)
 */
export function convertMemoryGameToH5P(spec: MemoryGameSpec, contentId?: string): {
  library: string;
  params: any;
  metadata: Partial<IContentMetadata>;
  cardImages: MemoryGameCardImages;
} {
  const uniqueId = contentId || `mg-${Date.now()}`;
  const generatedFiles: Array<{ filename: string; filepath: string }> = [];

  // Generate cards - H5P Memory Game requires images
  const cards = spec.pairs.map((pair, index) => {
    // Generate image for the first card (text)
    const cardFilename = generateTextCardImage(pair.text, index * 2, uniqueId);
    const cardFilepath = path.join(H5P_CARD_IMAGES_DIR, cardFilename);
    generatedFiles.push({ filename: cardFilename, filepath: cardFilepath });

    // H5P expects relative path like "images/filename.ext"
    const cardImagePath = `images/${cardFilename}`;

    // Generate image for the matching card (matchingText)
    const matchText = pair.matchingText || pair.text;
    let matchImagePath: string | undefined;
    let matchImage: any = undefined;

    if (pair.matchingText && pair.matchingText !== pair.text) {
      // Different matching text - generate a different colored card
      const matchFilename = generateTextCardImage(matchText, index * 2 + 1, uniqueId);
      const matchFilepath = path.join(H5P_CARD_IMAGES_DIR, matchFilename);
      generatedFiles.push({ filename: matchFilename, filepath: matchFilepath });
      matchImagePath = `images/${matchFilename}`;
      matchImage = {
        path: matchImagePath,
        mime: 'image/svg+xml',
        width: 200,
        height: 200
      };
    }
    // If no matchingText, H5P will duplicate the card automatically (classic memory style)

    return {
      image: {
        path: cardImagePath,
        mime: 'image/svg+xml',
        width: 200,
        height: 200
      },
      imageAlt: pair.text,
      match: matchImage,
      matchAlt: matchText,
      description: `Match: ${pair.text}` + (pair.matchingText ? ` ↔ ${pair.matchingText}` : '')
    };
  });

  return {
    library: 'H5P.MemoryGame 1.3',
    params: {
      cards: cards.map(card => ({
        image: card.image,
        imageAlt: card.imageAlt,
        match: card.match,
        matchAlt: card.matchAlt,
        description: card.description
      })),
      behaviour: {
        useGrid: true,
        allowRetry: true
      },
      lookNFeel: {
        themeColor: '#1a73e8'
      },
      l10n: {
        cardTurns: 'Card turns',
        timeSpent: 'Time spent',
        feedback: 'Good job!',
        tryAgain: 'Try again?',
        closeLabel: 'Close',
        label: 'Memory Game. Find matching cards.'
      }
    },
    metadata: {
      title: spec.title,
      license: 'U'
    },
    cardImages: {
      generatedFiles,
      cardParams: cards
    }
  };
}

/**
 * Copy generated card images to H5P content folder
 * Must be called after H5P content is created to copy images into the content directory
 *
 * @param h5pContentId - The H5P content ID returned from createH5PContent
 * @param cardImages - The cardImages returned from convertMemoryGameToH5P
 */
export function copyCardImagesToH5PContent(
  h5pContentId: string,
  cardImages: MemoryGameCardImages
): void {
  const contentImagesDir = path.join(H5P_CONTENT_DIR, h5pContentId, 'images');

  // Create images directory in content folder
  if (!fs.existsSync(contentImagesDir)) {
    fs.mkdirSync(contentImagesDir, { recursive: true });
    console.log(`[H5P] Created content images directory: ${contentImagesDir}`);
  }

  // Copy each generated file
  for (const file of cardImages.generatedFiles) {
    const destPath = path.join(contentImagesDir, file.filename);
    try {
      fs.copyFileSync(file.filepath, destPath);
      console.log(`[H5P] Copied card image: ${file.filename}`);
    } catch (error) {
      console.error(`[H5P] Failed to copy card image ${file.filename}:`, error);
    }
  }
}

/**
 * Convert Flashcards spec to H5P format
 */
export function convertFlashcardsToH5P(spec: FlashcardsSpec): {
  library: string;
  params: any;
  metadata: Partial<IContentMetadata>;
} {
  const cards = spec.cards.map((card, index) => ({
    text: card.front,
    answer: card.back,
    image: card.image ? { path: card.image } : undefined,
    tip: ''
  }));

  return {
    library: 'H5P.Flashcards 1.7',
    params: {
      title: spec.title,
      description: spec.description || 'Study these flashcards!',
      cards,
      progressText: 'Card @card of @total',
      next: 'Next',
      previous: 'Previous',
      checkAnswerText: 'Check answer',
      showSolutionText: 'Show answer',
      resultsText: 'Results',
      answeredCorrectlyText: 'Correct!',
      answeredIncorrectlyText: 'Incorrect',
      answeredText: ':num/:total correct',
      submitText: 'Submit',
      caseSensitive: false,
      showSolutionsRequiresInput: false
    },
    metadata: {
      title: spec.title,
      license: 'U'
    }
  };
}

/**
 * Convert Find the Words (Word Search) spec to H5P format
 */
export function convertFindTheWordsToH5P(spec: FindTheWordsSpec): {
  library: string;
  params: any;
  metadata: Partial<IContentMetadata>;
} {
  const gridSize = spec.gridSize || Math.max(10, Math.ceil(Math.sqrt(spec.words.join('').length * 2)));

  return {
    library: 'H5P.FindTheWords 1.4',
    params: {
      taskDescription: spec.description || `<p>Find the hidden words: ${spec.words.join(', ')}</p>`,
      wordList: spec.words.join(','),
      behaviour: {
        enableShowSolution: true,
        enableRetry: true
      },
      l10n: {
        wordListHeader: 'Find these words',
        check: 'Check',
        tryAgain: 'Retry',
        showSolution: 'Show solution',
        found: ':found of :total found',
        score: 'You got @score of @total points',
        timeSpent: 'Time spent'
      },
      overallFeedback: [
        { from: 0, to: 50, feedback: 'Keep looking!' },
        { from: 51, to: 80, feedback: 'Good job!' },
        { from: 81, to: 100, feedback: 'Excellent! You found them all!' }
      ]
    },
    metadata: {
      title: spec.title,
      license: 'U'
    }
  };
}

/**
 * Convert Dialog Cards spec to H5P format
 */
export function convertDialogCardsToH5P(spec: DialogCardsSpec): {
  library: string;
  params: any;
  metadata: Partial<IContentMetadata>;
} {
  const cards = spec.cards.map(card => ({
    text: card.front,
    answer: card.back,
    tips: card.tips ? [card.tips] : []
  }));

  return {
    library: 'H5P.DialogCards 1.9',
    params: {
      title: spec.title,
      description: spec.description || 'Click to flip the cards!',
      dialogs: cards,
      behaviour: {
        enableRetry: true,
        disableBackwardsNavigation: false,
        scaleTextNotCard: false,
        randomCards: false
      },
      answer: 'Turn',
      next: 'Next',
      prev: 'Previous',
      retry: 'Retry',
      correctAnswer: 'I got it right!',
      incorrectAnswer: 'I got it wrong',
      round: 'Round @round',
      cardsLeft: 'Cards left: @number',
      nextRound: 'Proceed to round @round',
      startOver: 'Start over',
      showSummary: 'Final summary',
      summary: 'Summary',
      summaryCardsRight: 'Cards you got right:',
      summaryCardsWrong: 'Cards you got wrong:',
      summaryCardsNotShown: 'Cards not shown:',
      summaryOverallScore: 'Overall Score',
      summaryCardsCompleted: 'Cards you have completed learning:',
      summaryCompletedRounds: 'Completed rounds:',
      summaryAllDone: 'Well done! You completed all @cards cards!'
    },
    metadata: {
      title: spec.title,
      license: 'U'
    }
  };
}

/**
 * Validate a QuizSpec from AI
 */
export function validateQuizSpec(spec: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!spec.title || typeof spec.title !== 'string') {
    errors.push('Missing or invalid title');
  }

  if (!spec.age || typeof spec.age !== 'number' || spec.age < 3 || spec.age > 18) {
    errors.push('Age must be a number between 3 and 18');
  }

  if (!spec.theme || typeof spec.theme !== 'string') {
    errors.push('Missing or invalid theme');
  }

  if (!Array.isArray(spec.questions) || spec.questions.length === 0) {
    errors.push('Questions must be a non-empty array');
  } else {
    spec.questions.forEach((q: any, i: number) => {
      if (!q.prompt || typeof q.prompt !== 'string') {
        errors.push(`Question ${i + 1}: Missing prompt`);
      }

      if (!['mcq', 'true_false', 'fill_blank', 'matching', 'drag_text', 'mark_words'].includes(q.type)) {
        errors.push(`Question ${i + 1}: Invalid type "${q.type}"`);
      }

      if (q.type === 'mcq') {
        if (!Array.isArray(q.choices) || q.choices.length < 2) {
          errors.push(`Question ${i + 1}: MCQ needs at least 2 choices`);
        }
        if (typeof q.answerIndex !== 'number' || q.answerIndex < 0 || q.answerIndex >= (q.choices?.length || 0)) {
          errors.push(`Question ${i + 1}: Invalid answerIndex`);
        }
        // Check for duplicate choices
        const uniqueChoices = new Set(q.choices?.map((c: string) => c.toLowerCase().trim()));
        if (uniqueChoices.size !== q.choices?.length) {
          errors.push(`Question ${i + 1}: Duplicate choices detected`);
        }
      }

      if (q.type === 'true_false' && typeof q.correctAnswer !== 'boolean') {
        errors.push(`Question ${i + 1}: True/False needs boolean correctAnswer`);
      }

      if (q.type === 'fill_blank') {
        if (!q.correctAnswer) {
          errors.push(`Question ${i + 1}: Fill blank needs correctAnswer`);
        }
        // Warn if prompt doesn't have underscore placeholder format (but don't fail validation)
        if (!hasBlankPlaceholder(q.prompt || '')) {
          console.warn(`Question ${i + 1}: Fill blank prompt should contain an underscore placeholder like "__" - will use fallback`);
        }
        // Warn if prompt contains asterisks (AI formatting error)
        if (q.prompt?.includes('*')) {
          console.warn(`Question ${i + 1}: Fill blank prompt contains asterisks - will be cleaned`);
        }
      }
    });

    // Check for duplicate questions
    const prompts = spec.questions.map((q: any) => q.prompt?.toLowerCase().trim());
    const uniquePrompts = new Set(prompts);
    if (uniquePrompts.size !== prompts.length) {
      errors.push('Duplicate questions detected');
    }
  }

  return { valid: errors.length === 0, errors };
}

// Export storage paths for Express static serving
export const H5P_PATHS = {
  data: H5P_DATA_DIR,
  libraries: H5P_LIBRARIES_DIR,
  content: H5P_CONTENT_DIR,
  temp: H5P_TEMP_DIR,
  core: H5P_CORE_DIR,
  editor: H5P_EDITOR_DIR,
  downloads: path.join(H5P_DATA_DIR, 'downloads'),
  cardImages: H5P_CARD_IMAGES_DIR
};

/**
 * Get the library storage instance
 */
export function getLibraryStorage() {
  if (!libraryStorage) {
    throw new Error('H5P service not initialized. Call initializeH5P() first.');
  }
  return libraryStorage;
}

/**
 * Get the temporary storage instance
 */
export function getTemporaryStorage() {
  if (!temporaryStorage) {
    throw new Error('H5P service not initialized. Call initializeH5P() first.');
  }
  return temporaryStorage;
}

/**
 * Import H5P content from a .h5p file (both libraries AND content)
 * This is different from installLibraryFromFile which only installs libraries
 */
export async function importH5PContent(
  filePath: string,
  user: H5PUser
): Promise<{
  contentId: string | null;
  metadata: any;
  installedLibraries: string[];
  errors: string[];
}> {
  const editor = getH5PEditor();

  try {
    console.log(`[H5P] Importing content from: ${filePath}`);

    // Use uploadPackage with onlyInstallLibraries = false to import both libraries AND content
    const result = await editor.uploadPackage(filePath, user, {
      onlyInstallLibraries: false
    });

    console.log(`[H5P] Import result:`, {
      hasMetadata: !!result.metadata,
      hasParameters: !!result.parameters,
      librariesCount: result.installedLibraries?.length || 0
    });

    const installedLibraries = (result.installedLibraries || [])
      .filter((r: any) => (r.type === 'new' || r.type === 'patch') && r.newVersion)
      .map((r: any) => `${r.newVersion.machineName} ${r.newVersion.majorVersion}.${r.newVersion.minorVersion}`);

    // If we have metadata and parameters, we can create content
    let contentId: string | null = null;
    if (result.metadata && result.parameters) {
      const mainLibrary = result.metadata.mainLibrary;
      const preloaded = result.metadata.preloadedDependencies || [];
      const mainDep = preloaded.find((d: any) => d.machineName === mainLibrary);
      const libraryString = mainDep
        ? `${mainDep.machineName} ${mainDep.majorVersion}.${mainDep.minorVersion}`
        : mainLibrary;

      // Save the content
      const savedContent = await editor.saveOrUpdateContentReturnMetaData(
        undefined as any,
        result.parameters,
        result.metadata,
        libraryString,
        user
      );

      contentId = savedContent.id.toString();
      console.log(`[H5P] Created content with ID: ${contentId}`);
    }

    return {
      contentId,
      metadata: result.metadata || null,
      installedLibraries,
      errors: []
    };
  } catch (error: any) {
    console.error('[H5P] Error importing content:', error);
    return {
      contentId: null,
      metadata: null,
      installedLibraries: [],
      errors: [error.message]
    };
  }
}

/**
 * Get detailed library information for an installed content type
 */
export async function getLibraryInfo(machineName: string): Promise<any | null> {
  try {
    const libraries = await libraryStorage.getInstalledLibraryNames();
    const lib = libraries.find(l => l.machineName === machineName);
    if (!lib) return null;

    return {
      machineName: lib.machineName,
      majorVersion: lib.majorVersion,
      minorVersion: lib.minorVersion,
      fullName: `${lib.machineName} ${lib.majorVersion}.${lib.minorVersion}`
    };
  } catch (error) {
    console.error('[H5P] Error getting library info:', error);
    return null;
  }
}

/**
 * Check if required libraries for quiz generation are installed
 */
export async function checkRequiredLibraries(): Promise<{
  allInstalled: boolean;
  missing: string[];
  installed: string[];
}> {
  const requiredLibraries = [
    'H5P.QuestionSet',
    'H5P.MultiChoice',
    'H5P.TrueFalse'
  ];

  const installedLibs = await libraryStorage.getInstalledLibraryNames();
  const installedNames = installedLibs.map(l => l.machineName);

  const missing: string[] = [];
  const installed: string[] = [];

  for (const lib of requiredLibraries) {
    if (installedNames.includes(lib)) {
      const fullLib = installedLibs.find(l => l.machineName === lib);
      installed.push(`${fullLib!.machineName} ${fullLib!.majorVersion}.${fullLib!.minorVersion}`);
    } else {
      missing.push(lib);
    }
  }

  return {
    allInstalled: missing.length === 0,
    missing,
    installed
  };
}

/**
 * Get runnable content types (content types that can be created, not just dependencies)
 */
export async function getRunnableContentTypes(): Promise<string[]> {
  const libraries = await libraryStorage.getInstalledLibraryNames();

  // Filter for runnable content types (main content types, not dependencies)
  // These typically have "runnable" in their library.json
  const runnableTypes = [
    'H5P.QuestionSet',
    'H5P.MultiChoice',
    'H5P.TrueFalse',
    'H5P.Blanks',
    'H5P.DragQuestion',
    'H5P.MemoryGame',
    'H5P.Flashcards',
    'H5P.ImageHotspots',
    'H5P.InteractiveVideo',
    'H5P.CoursePresentation',
    'H5P.Column',
    'H5P.SingleChoiceSet',
    'H5P.DragText',
    'H5P.MarkTheWords',
    'H5P.Summary',
    'H5P.Accordion',
    'H5P.DialogCards',
    'H5P.Timeline',
    'H5P.Collage',
    'H5P.Chart',
    'H5P.Agamotto',
    'H5P.AudioRecorder',
    'H5P.SpeakTheWords',
    'H5P.Essay',
    'H5P.Questionnaire',
    'H5P.PersonalityQuiz',
    'H5P.ArithmeticQuiz',
    'H5P.BranchingScenario',
    'H5P.FindTheWords',
    'H5P.Crossword',
    'H5P.SortParagraphs',
    'H5P.ImageSequencing',
    'H5P.KewArCode'
  ];

  return libraries
    .filter(lib => runnableTypes.includes(lib.machineName))
    .map(lib => `${lib.machineName} ${lib.majorVersion}.${lib.minorVersion}`);
}

export { H5PUser };
