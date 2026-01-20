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

// Ensure directories exist
[H5P_DATA_DIR, H5P_LIBRARIES_DIR, H5P_CONTENT_DIR, H5P_TEMP_DIR, H5P_CORE_DIR, H5P_EDITOR_DIR].forEach(dir => {
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

  // Build full metadata with required fields
  const fullMetadata: IContentMetadata = {
    title: metadata.title || 'Untitled',
    license: metadata.license || 'U',
    embedTypes: metadata.embedTypes || ['div'],
    language: metadata.language || 'en',
    mainLibrary: libraryName.split(' ')[0],
    preloadedDependencies: metadata.preloadedDependencies || [],
    defaultLanguage: metadata.defaultLanguage || 'en'
  };

  const contentId = await editor.saveOrUpdateContentReturnMetaData(
    undefined as any, // new content - cast to any to work around type issue
    params,
    fullMetadata,
    libraryName,
    user
  );

  return contentId.id;
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
  type: 'mcq' | 'true_false' | 'fill_blank' | 'matching';
  prompt: string;
  choices?: string[];
  answerIndex?: number;
  correctAnswer?: boolean | string;
  explanation?: string;
  pairs?: { left: string; right: string }[];
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
  const answers = (q.choices || []).map((choice, i) => ({
    correct: i === q.answerIndex,
    text: `<div>${choice}</div>`,
    tpiMSG: i === q.answerIndex
      ? (q.explanation || 'Correct!')
      : 'Try again!'
  }));

  return {
    library: 'H5P.MultiChoice 1.16',
    params: {
      question: `<p>${q.prompt}</p>`,
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
  return {
    library: 'H5P.TrueFalse 1.8',
    params: {
      question: `<p>${q.prompt}</p>`,
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
        wrongAnswerMessage: q.explanation || 'Wrong answer',
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
  // Convert prompt with blanks marked as *answer*
  const textWithBlanks = q.prompt.replace(/___+/g, `*${q.correctAnswer}*`);

  return {
    library: 'H5P.Blanks 1.14',
    params: {
      text: `<p>${textWithBlanks}</p>`,
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

      if (!['mcq', 'true_false', 'fill_blank', 'matching'].includes(q.type)) {
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

      if (q.type === 'fill_blank' && !q.correctAnswer) {
        errors.push(`Question ${i + 1}: Fill blank needs correctAnswer`);
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
  downloads: path.join(H5P_DATA_DIR, 'downloads')
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
