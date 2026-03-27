import React, { useEffect, useState, useRef } from 'react';
import { h5pAPI, rewardsAPI } from '../services/api';
import { useProfile } from '../context/ProfileContext';
import { Loader2, AlertCircle, CheckCircle, Play, Trash2, Users, Plus, Package, Upload, Download, FolderOpen, Globe, UserPlus, Eye, X, FileText, HelpCircle, Gamepad2 } from 'lucide-react';
import H5PPlayer from '../components/H5PPlayer';

interface ChildProfile {
  id: number;
  name: string;
  avatar?: string;
  age?: number;
}

interface H5PContent {
  id: number;
  h5p_content_id: string;
  title: string;
  content_type: string;
  library_name: string;
  created_by: number;
  is_ai_generated: boolean | number;
  created_at: string;
  assignment_count?: number;
  attempt_count?: number;
  // For child view
  assignment_id?: number;
  points?: number;
  my_attempts?: number;
  best_score?: number;
  passed?: boolean | number;
}

interface H5PStatus {
  initialized: boolean;
  installedContentTypes: string[];
  contentTypesCount: number;
  runnableContentTypes?: string[];
  runnableCount?: number;
  quizReady?: boolean;
  missingForQuiz?: string[];
}

const H5PManager: React.FC = () => {
  const { currentProfile } = useProfile();
  const [status, setStatus] = useState<H5PStatus | null>(null);
  const [content, setContent] = useState<H5PContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePlayer, setActivePlayer] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);

  // Create quiz form state
  const [createForm, setCreateForm] = useState({
    title: '',
    theme: '',
    age: 8,
    questionCount: 5,
    quizType: 'mixed' as 'mixed' | 'mixed_advanced' | 'mcq_only' | 'true_false_only' | 'fill_blank' | 'drag_text' | 'mark_words',
    assignedTo: [] as number[],
    points: 20,
    provider: 'auto' as 'auto' | 'ollama' | 'gemini' | 'grok' | 'openai',
    includeImages: false,
    customInstructions: '',
    answerStyle: 'default' as 'default' | 'abcd' | 'numbered'
  });

  // Create activity form state (standalone content)
  const [activityForm, setActivityForm] = useState({
    title: '',
    theme: '',
    age: 8,
    itemCount: 8,
    contentType: 'memory_game' as 'memory_game' | 'flashcards' | 'word_search' | 'dialog_cards',
    assignedTo: [] as number[],
    points: 15,
    provider: 'auto' as 'auto' | 'ollama' | 'gemini' | 'grok' | 'openai',
    customInstructions: ''
  });

  // AI providers state
  const [aiProviders, setAiProviders] = useState<Array<{ id: string; name: string; available: boolean; model?: string }>>([]);

  // Progress view state
  const [showProgressModal, setShowProgressModal] = useState<number | null>(null);
  const [progressData, setProgressData] = useState<any[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [creating, setCreating] = useState(false);
  const [children, setChildren] = useState<ChildProfile[]>([]);

  // Quiz questions preview state
  const [showQuestionsModal, setShowQuestionsModal] = useState<number | null>(null);
  const [questionsData, setQuestionsData] = useState<any>(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Library management state
  const [showLibraryManager, setShowLibraryManager] = useState(false);
  const [downloads, setDownloads] = useState<Array<{ filename: string; size: number; downloadedAt: string }>>([]);
  const [loadingDownloads, setLoadingDownloads] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [installingFromHub, setInstallingFromHub] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Content import state
  const [importingContent, setImportingContent] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Diagnostic state
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<any>(null);
  const [loadingDiagnostic, setLoadingDiagnostic] = useState(false);

  const isParent = currentProfile?.type === 'parent' || currentProfile?.type === 'admin';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statusRes, contentRes] = await Promise.all([
        h5pAPI.getStatus(),
        h5pAPI.getContent()
      ]);

      setStatus(statusRes.data);
      setContent(contentRes.data);

      // Load children for assignment and AI providers (parents only)
      if (isParent && currentProfile?.id) {
        try {
          const [childrenRes, providersRes] = await Promise.all([
            rewardsAPI.getParentChildren(currentProfile.id),
            h5pAPI.getAIProviders()
          ]);
          setChildren(childrenRes.data || []);
          setAiProviders(providersRes.data.providers || []);
        } catch (err) {
          console.warn('Could not load children/providers for assignment');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load H5P data');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this content?')) return;

    try {
      await h5pAPI.deleteContent(id);
      setContent(content.filter(c => c.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete content');
    }
  };

  const handleCreateQuiz = async () => {
    if (!createForm.theme) {
      alert('Please fill in the theme/topic');
      return;
    }

    try {
      setCreating(true);

      // Use AI to generate the quiz
      const response = await h5pAPI.generateWithAI({
        title: createForm.title || undefined, // Let AI generate title if not provided
        theme: createForm.theme,
        age: createForm.age,
        questionCount: createForm.questionCount,
        quizType: createForm.quizType,
        assignTo: createForm.assignedTo,
        points: createForm.points,
        provider: createForm.provider,
        includeImages: createForm.includeImages,
        customInstructions: createForm.customInstructions || undefined,
        answerStyle: createForm.answerStyle
      });

      // Reload content
      await loadData();
      setShowCreateForm(false);
      setCreateForm({
        title: '',
        theme: '',
        age: 8,
        questionCount: 5,
        quizType: 'mixed',
        assignedTo: [],
        points: 20,
        provider: 'auto',
        includeImages: false,
        customInstructions: '',
        answerStyle: 'default'
      });

      const assignedCount = createForm.assignedTo.length;
      alert(`Created "${response.data.title}" with ${response.data.questionCount} AI-generated questions!${assignedCount > 0 ? ` Assigned to ${assignedCount} child${assignedCount > 1 ? 'ren' : ''}.` : ''}`);
    } catch (err: any) {
      console.error('Failed to create quiz:', err);
      alert(err.response?.data?.error || 'Failed to create quiz. Make sure AI provider is configured.');
    } finally {
      setCreating(false);
    }
  };

  // Handle creating standalone activity (Memory Game, Flashcards, Word Search, Dialog Cards)
  const handleCreateActivity = async () => {
    if (!activityForm.theme) {
      alert('Please fill in the theme/topic');
      return;
    }

    try {
      setCreating(true);

      const response = await h5pAPI.generateStandalone({
        contentType: activityForm.contentType,
        title: activityForm.title || undefined,
        theme: activityForm.theme,
        age: activityForm.age,
        itemCount: activityForm.itemCount,
        assignTo: activityForm.assignedTo,
        points: activityForm.points,
        provider: activityForm.provider,
        customInstructions: activityForm.customInstructions || undefined
      });

      // Reload content
      await loadData();
      setShowActivityForm(false);
      setActivityForm({
        title: '',
        theme: '',
        age: 8,
        itemCount: 8,
        contentType: 'memory_game',
        assignedTo: [],
        points: 15,
        provider: 'auto',
        customInstructions: ''
      });

      const activityLabels: Record<string, string> = {
        memory_game: 'Memory Game',
        flashcards: 'Flashcards',
        word_search: 'Word Search',
        dialog_cards: 'Study Cards'
      };

      const assignedCount = activityForm.assignedTo.length;
      alert(`Created "${response.data.title}" (${activityLabels[activityForm.contentType]})!${assignedCount > 0 ? ` Assigned to ${assignedCount} child${assignedCount > 1 ? 'ren' : ''}.` : ''}`);
    } catch (err: any) {
      console.error('Failed to create activity:', err);
      alert(err.response?.data?.error || 'Failed to create activity. Make sure AI provider is configured.');
    } finally {
      setCreating(false);
    }
  };

  // Load child progress for a quiz
  const loadProgress = async (contentId: number) => {
    try {
      setLoadingProgress(true);
      setShowProgressModal(contentId);
      const res = await h5pAPI.getAssignments(contentId);
      setProgressData(res.data);
    } catch (err: any) {
      console.error('Failed to load progress:', err);
      alert('Failed to load progress data');
    } finally {
      setLoadingProgress(false);
    }
  };

  // Load quiz questions for preview
  const loadQuestions = async (contentId: number) => {
    try {
      setLoadingQuestions(true);
      setShowQuestionsModal(contentId);
      const res = await h5pAPI.getQuizQuestions(contentId);
      setQuestionsData(res.data);
    } catch (err: any) {
      console.error('Failed to load questions:', err);
      alert(err.response?.data?.error || 'Failed to load quiz questions');
      setShowQuestionsModal(null);
    } finally {
      setLoadingQuestions(false);
    }
  };

  // Library management functions
  const loadDownloads = async () => {
    try {
      setLoadingDownloads(true);
      const res = await h5pAPI.getDownloads();
      setDownloads(res.data.files);
    } catch (err: any) {
      console.error('Failed to load downloads:', err);
    } finally {
      setLoadingDownloads(false);
    }
  };

  const handleOpenLibraryManager = () => {
    setShowLibraryManager(true);
    loadDownloads();
  };

  const handleInstallFromDownloads = async (filename: string) => {
    try {
      setInstalling(filename);
      const res = await h5pAPI.installFromDownloads(filename);
      if (status) {
        setStatus({
          ...status,
          installedContentTypes: res.data.installedContentTypes,
          contentTypesCount: res.data.contentTypesCount
        });
      }
      alert(`Installed "${filename}" successfully!`);
      await loadDownloads();
    } catch (err: any) {
      alert(err.response?.data?.error || `Failed to install ${filename}`);
    } finally {
      setInstalling(null);
    }
  };

  const handleInstallAllDownloads = async () => {
    if (!confirm('Install all downloaded H5P libraries?')) return;

    try {
      setInstalling('all');
      const res = await h5pAPI.installAllDownloads();

      if (status) {
        setStatus({
          ...status,
          installedContentTypes: res.data.installedContentTypes,
          contentTypesCount: res.data.contentTypesCount
        });
      }

      const successCount = res.data.installed.length;
      const errorCount = res.data.errors.length;

      if (errorCount > 0) {
        alert(`Installed ${successCount} libraries. ${errorCount} failed.`);
      } else {
        alert(`Installed ${successCount} libraries successfully!`);
      }

      await loadDownloads();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to install libraries');
    } finally {
      setInstalling(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingFile(true);
      const res = await h5pAPI.uploadLibrary(file);

      if (status) {
        setStatus({
          ...status,
          installedContentTypes: res.data.installedContentTypes,
          contentTypesCount: res.data.contentTypesCount
        });
      }

      alert(`Installed "${file.name}" successfully!`);
    } catch (err: any) {
      alert(err.response?.data?.error || `Failed to install ${file.name}`);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Import H5P content (both libraries AND content)
  const handleImportContent = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportingContent(true);
      const res = await h5pAPI.importContent(file);

      if (status) {
        setStatus({
          ...status,
          installedContentTypes: res.data.installedContentTypes,
          contentTypesCount: res.data.contentTypesCount
        });
      }

      // Reload content list if content was imported
      if (res.data.contentId) {
        await loadData();
        alert(`Imported "${res.data.title || file.name}" successfully! The activity is now available.`);
      } else {
        alert(`Installed libraries from "${file.name}". No content was found in the package.`);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || `Failed to import ${file.name}`);
    } finally {
      setImportingContent(false);
      if (importFileInputRef.current) {
        importFileInputRef.current.value = '';
      }
    }
  };

  // Run diagnostic check
  const handleRunDiagnostic = async () => {
    try {
      setLoadingDiagnostic(true);
      const res = await h5pAPI.runDiagnostic();
      setDiagnosticData(res.data);
      setShowDiagnostic(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to run diagnostic');
    } finally {
      setLoadingDiagnostic(false);
    }
  };

  const handleInstallFromHub = async () => {
    if (!confirm('Install essential H5P libraries from h5p.org? This may take a few minutes.')) return;

    try {
      setInstallingFromHub(true);
      const res = await h5pAPI.installEssentialsFromHub();

      if (status) {
        setStatus({
          ...status,
          installedContentTypes: res.data.installedContentTypes,
          contentTypesCount: res.data.contentTypesCount
        });
      }

      const successCount = res.data.results.filter((r: any) => r.success).length;
      const errorCount = res.data.results.filter((r: any) => !r.success).length;

      if (errorCount > 0) {
        alert(`Installed ${successCount} libraries. ${errorCount} failed to install.`);
      } else {
        alert(`Successfully installed ${successCount} essential H5P libraries!`);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to install libraries from H5P Hub');
    } finally {
      setInstallingFromHub(false);
    }
  };

  const totalAssignments = content.reduce((sum, item) => sum + (item.assignment_count || 0), 0);
  const totalAttempts = content.reduce((sum, item) => {
    const attempts = isParent ? (item.attempt_count || 0) : (item.my_attempts || 0);
    return sum + attempts;
  }, 0);
  const aiGeneratedCount = content.filter((item) => Boolean(item.is_ai_generated)).length;
  const availableProviderCount = aiProviders.filter((provider) => provider.available).length;
  const passedCount = content.filter((item) => Boolean(item.passed)).length;
  const startedCount = content.filter((item) => (item.my_attempts || 0) > 0).length;

  const formatContentLabel = (contentType: string) => {
    return (contentType || 'interactive_content')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  const getContentTone = (contentType: string) => {
    const normalized = (contentType || '').toLowerCase();

    if (normalized.includes('memory')) {
      return {
        surface: 'from-amber-50 via-white to-orange-50 dark:from-amber-950/25 dark:via-slate-900 dark:to-orange-950/20',
        badge: 'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
        button: 'bg-amber-600 hover:bg-amber-700'
      };
    }

    if (normalized.includes('word') || normalized.includes('dialog') || normalized.includes('flash')) {
      return {
        surface: 'from-emerald-50 via-white to-cyan-50 dark:from-emerald-950/20 dark:via-slate-900 dark:to-cyan-950/20',
        badge: 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300',
        button: 'bg-emerald-600 hover:bg-emerald-700'
      };
    }

    return {
      surface: 'from-sky-50 via-white to-violet-50 dark:from-sky-950/20 dark:via-slate-900 dark:to-violet-950/20',
      badge: 'border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300',
      button: 'bg-sky-600 hover:bg-sky-700'
    };
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="rounded-[28px] border border-slate-200 bg-white/80 px-8 py-10 text-center shadow-xl shadow-slate-200/40 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
          <Loader2 className="mx-auto h-9 w-9 animate-spin text-sky-500" />
          <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300">Loading H5P workspace...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[420px] items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-[28px] border border-red-200 bg-white p-8 text-center shadow-xl shadow-red-100/40 dark:border-red-900/50 dark:bg-slate-900">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">H5P workspace unavailable</h2>
          <p className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Retry after checking libraries, service health, or the current Synology build.
          </p>
          <button
            onClick={loadData}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
          >
            Retry load
          </button>
        </div>
      </div>
    );
  }

  if (activePlayer !== null) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-4">
        <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white shadow-2xl shadow-slate-300/30 dark:border-slate-800">
          <div className="px-6 py-6 sm:px-8">
            <button
              onClick={() => setActivePlayer(null)}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              <span aria-hidden="true">←</span>
              Back to quizzes
            </button>
            <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-sky-200/70">H5P Player</p>
                <h1 className="mt-2 text-3xl font-semibold">Focused play mode</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-300">
                  Keep the quiz front and center, then return to the library when you want to review progress or launch another activity.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                Runtime-safe H5P playback is active for this content.
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white p-3 shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900">
          <H5PPlayer
            contentId={activePlayer}
            onComplete={(result) => {
              console.log('Completed:', result);
              // Don't reload immediately - let the player show the result
              // The H5PPlayer component will display the completion banner
              // User can click "Back to List" to see updated scores
            }}
            onError={(err) => {
              console.error('Player error:', err);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-4">
      <section className={`relative overflow-hidden rounded-[34px] border shadow-2xl ${
        isParent
          ? 'border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#111827_55%,#0c4a6e_100%)] text-white shadow-slate-300/30 dark:border-slate-800'
          : 'border-slate-200 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_40%,#ecfeff_100%)] text-slate-900 shadow-slate-200/40 dark:border-slate-800 dark:bg-[linear-gradient(135deg,#0f172a_0%,#172554_45%,#083344_100%)] dark:text-white'
      }`}>
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.16)_1px,transparent_1px)] [background-size:38px_38px]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.24),transparent_34%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.18),transparent_28%)]"></div>

        <div className="relative z-10 px-6 py-8 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] ${
                isParent
                  ? 'border-white/15 bg-white/10 text-sky-100'
                  : 'border-sky-200 bg-white/70 text-sky-700 dark:border-white/15 dark:bg-white/10 dark:text-sky-100'
              }`}>
                {isParent ? 'H5P Studio' : 'H5P Quizzes'}
              </div>
              <h1 className={`mt-4 text-3xl font-semibold sm:text-4xl ${
                isParent ? 'text-white' : 'text-slate-950 dark:text-white'
              }`}>
                {isParent ? 'One calm workspace for quizzes, content, and library health' : 'Play the H5P quizzes assigned to you'}
              </h1>
              <p className={`mt-3 max-w-2xl text-sm sm:text-base ${
                isParent ? 'text-slate-200/85' : 'text-slate-600 dark:text-slate-300'
              }`}>
                {isParent
                  ? 'Create H5P quizzes, import packages, check quiz readiness, and review child progress without bouncing between multiple quiz systems.'
                  : 'Everything here is the real H5P quiz path. Open a quiz, track your best score, and come back for the next one.'}
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className={`rounded-2xl border px-4 py-3 ${
                  isParent ? 'border-white/10 bg-white/8' : 'border-slate-200 bg-white/85 dark:border-white/10 dark:bg-white/10'
                }`}>
                  <p className={`text-xs uppercase tracking-[0.22em] ${isParent ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>Content</p>
                  <p className={`mt-2 text-3xl font-semibold ${isParent ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{content.length}</p>
                  <p className={`mt-1 text-sm ${isParent ? 'text-slate-300/85' : 'text-slate-500 dark:text-slate-400'}`}>
                    {isParent ? 'Total H5P items in library' : 'Ready to open from your list'}
                  </p>
                </div>
                <div className={`rounded-2xl border px-4 py-3 ${
                  isParent ? 'border-white/10 bg-white/8' : 'border-slate-200 bg-white/85 dark:border-white/10 dark:bg-white/10'
                }`}>
                  <p className={`text-xs uppercase tracking-[0.22em] ${isParent ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                    {isParent ? 'Assignments' : 'Started'}
                  </p>
                  <p className={`mt-2 text-3xl font-semibold ${isParent ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                    {isParent ? totalAssignments : startedCount}
                  </p>
                  <p className={`mt-1 text-sm ${isParent ? 'text-slate-300/85' : 'text-slate-500 dark:text-slate-400'}`}>
                    {isParent ? 'Child assignments linked' : 'Quizzes you already touched'}
                  </p>
                </div>
                <div className={`rounded-2xl border px-4 py-3 ${
                  isParent ? 'border-white/10 bg-white/8' : 'border-slate-200 bg-white/85 dark:border-white/10 dark:bg-white/10'
                }`}>
                  <p className={`text-xs uppercase tracking-[0.22em] ${isParent ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                    {isParent ? 'AI Built' : 'Passed'}
                  </p>
                  <p className={`mt-2 text-3xl font-semibold ${isParent ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                    {isParent ? aiGeneratedCount : passedCount}
                  </p>
                  <p className={`mt-1 text-sm ${isParent ? 'text-slate-300/85' : 'text-slate-500 dark:text-slate-400'}`}>
                    {isParent ? 'Items generated by AI' : 'Quizzes already passed'}
                  </p>
                </div>
                <div className={`rounded-2xl border px-4 py-3 ${
                  isParent ? 'border-white/10 bg-white/8' : 'border-slate-200 bg-white/85 dark:border-white/10 dark:bg-white/10'
                }`}>
                  <p className={`text-xs uppercase tracking-[0.22em] ${isParent ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                    {isParent ? 'Providers' : 'Attempts'}
                  </p>
                  <p className={`mt-2 text-3xl font-semibold ${isParent ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                    {isParent ? availableProviderCount : totalAttempts}
                  </p>
                  <p className={`mt-1 text-sm ${isParent ? 'text-slate-300/85' : 'text-slate-500 dark:text-slate-400'}`}>
                    {isParent ? 'AI providers available now' : 'Attempts across your quizzes'}
                  </p>
                </div>
              </div>
            </div>

            {isParent && status && (
              <div className="w-full max-w-sm rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-sky-100/80">Quiz engine</p>
                    <h2 className="mt-2 text-xl font-semibold text-white">
                      {status.quizReady ? 'Ready for quiz generation' : 'Needs library attention'}
                    </h2>
                  </div>
                  {status.quizReady ? (
                    <CheckCircle className="h-6 w-6 text-emerald-300" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-amber-300" />
                  )}
                </div>
                <div className="mt-5 space-y-3 text-sm text-slate-200">
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                    <span>Libraries installed</span>
                    <span className="font-semibold text-white">{status.contentTypesCount}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                    <span>Runnable types</span>
                    <span className="font-semibold text-white">{status.runnableCount || 0}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                    <span>Total attempts</span>
                    <span className="font-semibold text-white">{totalAttempts}</span>
                  </div>
                </div>
                <p className="mt-4 text-sm text-slate-300/85">
                  Legacy quiz and activity routes now point here, so this page is the single family quiz surface.
                </p>
              </div>
            )}
          </div>

          {isParent && (
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                <Plus className="h-4 w-4" />
                Create quiz
              </button>
              <button
                onClick={() => setShowActivityForm(true)}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                <Gamepad2 className="h-4 w-4" />
                Create activity
              </button>
              <button
                onClick={handleOpenLibraryManager}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                <FolderOpen className="h-4 w-4" />
                Manage libraries
              </button>
            </div>
          )}
        </div>
      </section>

      {isParent && status && (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
          <div className="rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/40 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">Service health</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">H5P readiness at a glance</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                  Use this card before creating or importing content. If quiz readiness is red or missing libraries are listed, fix that first.
                </p>
              </div>
              <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                status.quizReady
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
              }`}>
                {status.quizReady ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {status.quizReady ? 'Quiz ready' : 'Needs repair'}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Service</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                  {status.initialized ? 'Running' : 'Offline'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Libraries</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{status.contentTypesCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Runnable</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{status.runnableCount || 0}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Quiz status</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                  {status.quizReady ? 'Ready' : 'Missing dependencies'}
                </p>
              </div>
            </div>

            {!status.quizReady && status.missingForQuiz && status.missingForQuiz.length > 0 && (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="font-semibold">Missing quiz libraries</p>
                <p className="mt-2">{status.missingForQuiz.join(', ')}</p>
                <p className="mt-2 text-amber-800/90 dark:text-amber-200/90">
                  Open library management and run the hub install before creating more H5P quizzes.
                </p>
              </div>
            )}

            {status.contentTypesCount === 0 && (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="font-semibold">No H5P libraries installed yet</p>
                <p className="mt-2">Install the essentials from the hub before trying to generate quizzes or activities.</p>
              </div>
            )}
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/40 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Operations</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">Maintain the quiz stack</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              These are the operational controls that matter when quiz creation or playback feels off.
            </p>

            <input
              ref={importFileInputRef}
              type="file"
              accept=".h5p"
              onChange={handleImportContent}
              className="hidden"
            />

            <div className="mt-6 space-y-3">
              <button
                onClick={() => importFileInputRef.current?.click()}
                disabled={importingContent}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-emerald-900/50 dark:hover:bg-emerald-950/20"
              >
                <span>
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white">Import .h5p package</span>
                  <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Bring in libraries and content from an uploaded package.</span>
                </span>
                {importingContent ? <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> : <Upload className="h-4 w-4 text-emerald-600" />}
              </button>

              <button
                onClick={handleOpenLibraryManager}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-sky-300 hover:bg-sky-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-sky-900/50 dark:hover:bg-sky-950/20"
              >
                <span>
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white">Library manager</span>
                  <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Install essentials, upload libraries, and inspect downloaded packages.</span>
                </span>
                <FolderOpen className="h-4 w-4 text-sky-600" />
              </button>

              <button
                onClick={handleRunDiagnostic}
                disabled={loadingDiagnostic}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-violet-300 hover:bg-violet-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-violet-900/50 dark:hover:bg-violet-950/20"
              >
                <span>
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white">Run diagnostic</span>
                  <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Check quiz health, missing libraries, and database status.</span>
                </span>
                {loadingDiagnostic ? <Loader2 className="h-4 w-4 animate-spin text-violet-600" /> : <HelpCircle className="h-4 w-4 text-violet-600" />}
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Children</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{children.length}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">AI providers</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{availableProviderCount}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 max-w-lg w-full shadow-2xl my-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
              Create H5P Quiz
            </h2>

            {/* Quiz Not Ready Warning */}
            {status && !status.quizReady && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
                <p className="text-sm text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  <strong>Warning:</strong> Required H5P libraries not installed.
                  {status.missingForQuiz && status.missingForQuiz.length > 0 && (
                    <span> Missing: {status.missingForQuiz.join(', ')}</span>
                  )}
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  Go to "Manage Libraries" and click "Install from Hub" first.
                </p>
              </div>
            )}

            <div className="space-y-4">
              {/* Theme/Topic */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Theme/Topic <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={createForm.theme}
                  onChange={(e) => setCreateForm({ ...createForm, theme: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                  placeholder="e.g., planets and space, animals, math"
                />
              </div>

              {/* Quiz Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Quiz Title <span className="text-gray-400 text-xs">(optional)</span>
                </label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                  placeholder="Leave empty for AI to generate"
                />
              </div>

              {/* Age and Questions - Responsive Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Target Age: <span className="font-bold text-blue-600 dark:text-blue-400">{createForm.age}</span>
                  </label>
                  <input
                    type="range"
                    min="4"
                    max="16"
                    value={createForm.age}
                    onChange={(e) => setCreateForm({ ...createForm, age: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>4</span>
                    <span>16</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Questions: <span className="font-bold text-blue-600 dark:text-blue-400">{createForm.questionCount}</span>
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="15"
                    value={createForm.questionCount}
                    onChange={(e) => setCreateForm({ ...createForm, questionCount: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>3</span>
                    <span>15</span>
                  </div>
                </div>
              </div>

              {/* Question Type and Answer Style - Responsive Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Question Type
                  </label>
                  <select
                    value={createForm.quizType}
                    onChange={(e) => setCreateForm({ ...createForm, quizType: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                  >
                    <option value="mixed">Mixed (MCQ + True/False)</option>
                    <option value="mixed_advanced">Mixed Advanced (All Types)</option>
                    <option value="mcq_only">Multiple Choice Only</option>
                    <option value="true_false_only">True/False Only</option>
                    <option value="fill_blank">Fill in the Blank</option>
                    <option value="drag_text">Drag the Words</option>
                    <option value="mark_words">Mark the Words</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Answer Style
                  </label>
                  <select
                    value={createForm.answerStyle}
                    onChange={(e) => setCreateForm({ ...createForm, answerStyle: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                  >
                    <option value="default">Default</option>
                    <option value="abcd">A, B, C, D Style</option>
                    <option value="numbered">1, 2, 3, 4 Style</option>
                  </select>
                </div>
              </div>

              {/* Image Generation Toggle */}
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createForm.includeImages}
                    onChange={(e) => setCreateForm({ ...createForm, includeImages: e.target.checked })}
                    className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
                      Include Images
                    </span>
                    <p className="text-xs text-purple-600 dark:text-purple-400">
                      Generate images for questions (requires Grok or OpenAI API key, adds cost)
                    </p>
                  </div>
                </label>
                {createForm.includeImages && createForm.provider === 'ollama' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    Note: Ollama cannot generate images. Images will use Grok/OpenAI.
                  </p>
                )}
              </div>

              {/* Custom Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Custom Instructions <span className="text-gray-400 text-xs">(optional)</span>
                </label>
                <textarea
                  value={createForm.customInstructions}
                  onChange={(e) => setCreateForm({ ...createForm, customInstructions: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white resize-none"
                  rows={2}
                  placeholder="e.g., Focus on addition and subtraction, include fun facts, make questions about dinosaurs..."
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Give the AI specific guidance on what to include or how to format questions
                </p>
              </div>

              {/* AI Provider Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  AI Provider
                </label>
                <select
                  value={createForm.provider}
                  onChange={(e) => setCreateForm({ ...createForm, provider: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                >
                  <option value="auto">Auto (Best Available)</option>
                  {aiProviders.map((provider) => (
                    <option key={provider.id} value={provider.id} disabled={!provider.available}>
                      {provider.name} {!provider.available && '(unavailable)'}
                    </option>
                  ))}
                </select>
                {aiProviders.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    No AI providers configured. Check Settings to add API keys.
                  </p>
                )}
              </div>

              {/* Points - Improved visibility */}
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
                <label className="block text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                  Points for Completion
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={createForm.points}
                    onChange={(e) => setCreateForm({ ...createForm, points: parseInt(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-2xl font-bold text-yellow-700 dark:text-yellow-300 min-w-[60px] text-center">
                    {createForm.points}
                  </span>
                </div>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  Points awarded when child passes the quiz
                </p>
              </div>

              {/* Assign to Children */}
              {children.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Assign to Children
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {children.map((child) => (
                      <label
                        key={child.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          createForm.assignedTo.includes(child.id)
                            ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700'
                            : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={createForm.assignedTo.includes(child.id)}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...createForm.assignedTo, child.id]
                              : createForm.assignedTo.filter(id => id !== child.id);
                            setCreateForm({ ...createForm, assignedTo: updated });
                          }}
                          className="w-4 h-4 text-blue-500"
                        />
                        {child.avatar?.startsWith('/') || child.avatar?.startsWith('http') ? (
                          <img
                            src={child.avatar}
                            alt={child.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-xl">{child.avatar || '👤'}</span>
                        )}
                        <span className="text-gray-800 dark:text-gray-200">{child.name}</span>
                        {createForm.assignedTo.includes(child.id) && (
                          <CheckCircle className="w-4 h-4 text-blue-500 ml-auto" />
                        )}
                      </label>
                    ))}
                  </div>
                  {createForm.assignedTo.length > 0 && (
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                      {createForm.assignedTo.length} child{createForm.assignedTo.length > 1 ? 'ren' : ''} selected
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateForm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateQuiz}
                disabled={creating}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Quiz'
                )}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Activity Modal (Standalone Content) */}
      {showActivityForm && (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 max-w-lg w-full shadow-2xl my-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Gamepad2 className="w-6 h-6 text-purple-500" />
              Create Activity
            </h2>

            <div className="space-y-4">
              {/* Activity Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Activity Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'memory_game', label: 'Memory Game', icon: '🧩', desc: 'Match pairs of cards' },
                    { id: 'flashcards', label: 'Flashcards', icon: '📇', desc: 'Study flip cards' },
                    { id: 'word_search', label: 'Word Search', icon: '🔍', desc: 'Find hidden words' },
                    { id: 'dialog_cards', label: 'Study Cards', icon: '📚', desc: 'Learn concepts' },
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setActivityForm({ ...activityForm, contentType: type.id as any })}
                      className={`p-3 rounded-lg text-left transition-all ${
                        activityForm.contentType === type.id
                          ? 'bg-purple-100 dark:bg-purple-900/40 border-2 border-purple-500'
                          : 'bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="text-2xl mb-1">{type.icon}</div>
                      <div className="font-medium text-sm text-gray-800 dark:text-white">{type.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{type.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme/Topic */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Theme/Topic <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={activityForm.theme}
                  onChange={(e) => setActivityForm({ ...activityForm, theme: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                  placeholder="e.g., animals, vocabulary, science facts"
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title <span className="text-gray-400 text-xs">(optional)</span>
                </label>
                <input
                  type="text"
                  value={activityForm.title}
                  onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                  placeholder="Leave empty for AI to generate"
                />
              </div>

              {/* Age and Item Count */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Target Age: <span className="font-bold text-purple-600 dark:text-purple-400">{activityForm.age}</span>
                  </label>
                  <input
                    type="range"
                    min="4"
                    max="16"
                    value={activityForm.age}
                    onChange={(e) => setActivityForm({ ...activityForm, age: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Items: <span className="font-bold text-purple-600 dark:text-purple-400">{activityForm.itemCount}</span>
                  </label>
                  <input
                    type="range"
                    min="4"
                    max="20"
                    value={activityForm.itemCount}
                    onChange={(e) => setActivityForm({ ...activityForm, itemCount: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                </div>
              </div>

              {/* Custom Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Custom Instructions <span className="text-gray-400 text-xs">(optional)</span>
                </label>
                <textarea
                  value={activityForm.customInstructions}
                  onChange={(e) => setActivityForm({ ...activityForm, customInstructions: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white resize-none"
                  rows={2}
                  placeholder="e.g., Focus on colors and shapes, use simple words..."
                />
              </div>

              {/* AI Provider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  AI Provider
                </label>
                <select
                  value={activityForm.provider}
                  onChange={(e) => setActivityForm({ ...activityForm, provider: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
                >
                  <option value="auto">Auto (Best Available)</option>
                  {aiProviders.map((provider) => (
                    <option key={provider.id} value={provider.id} disabled={!provider.available}>
                      {provider.name} {!provider.available && '(unavailable)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Points */}
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
                <label className="block text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                  Points for Completion
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    value={activityForm.points}
                    onChange={(e) => setActivityForm({ ...activityForm, points: parseInt(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-2xl font-bold text-yellow-700 dark:text-yellow-300 min-w-[60px] text-center">
                    {activityForm.points}
                  </span>
                </div>
              </div>

              {/* Assign to Children */}
              {children.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Assign to Children
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {children.map((child) => (
                      <label
                        key={child.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          activityForm.assignedTo.includes(child.id)
                            ? 'bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700'
                            : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={activityForm.assignedTo.includes(child.id)}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...activityForm.assignedTo, child.id]
                              : activityForm.assignedTo.filter(id => id !== child.id);
                            setActivityForm({ ...activityForm, assignedTo: updated });
                          }}
                          className="w-4 h-4 text-purple-500"
                        />
                        {child.avatar?.startsWith('/') || child.avatar?.startsWith('http') ? (
                          <img src={child.avatar} alt={child.name} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <span className="text-xl">{child.avatar || '👤'}</span>
                        )}
                        <span className="text-gray-800 dark:text-gray-200">{child.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowActivityForm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateActivity}
                disabled={creating || !activityForm.theme}
                className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Activity'
                )}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Library Manager Modal */}
      {showLibraryManager && (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full shadow-2xl my-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <FolderOpen className="w-6 h-6" />
                H5P Library Manager
              </h2>
              <button
                onClick={() => setShowLibraryManager(false)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            {/* Install from Hub Section - Recommended */}
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
              <h3 className="font-medium text-green-800 dark:text-green-200 mb-2 flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Install from H5P Hub (Recommended)
              </h3>
              <p className="text-sm text-green-600 dark:text-green-300 mb-3">
                Download and install essential H5P content types directly from h5p.org.
                This includes Question Sets, Multiple Choice, True/False, Fill in Blanks, Drag & Drop, Memory Game, and Flashcards.
              </p>
              <button
                onClick={handleInstallFromHub}
                disabled={installingFromHub || installing !== null}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
              >
                {installingFromHub ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Installing from Hub...
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4" />
                    Install Essential Libraries
                  </>
                )}
              </button>
            </div>

            {/* Upload Section */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload H5P Package (Advanced)
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Upload a .h5p file. Note: Downloaded example content from h5p.org contains content, not library code.
                Use the Hub install above for libraries.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".h5p"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile || installingFromHub}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 flex items-center gap-2"
              >
                {uploadingFile ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Choose .h5p File
                  </>
                )}
              </button>
            </div>

            {/* Downloads Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-800 dark:text-white flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Downloaded Libraries
                </h3>
                {downloads.length > 0 && (
                  <button
                    onClick={handleInstallAllDownloads}
                    disabled={installing !== null}
                    className="px-3 py-1 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-1"
                  >
                    {installing === 'all' ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Installing All...
                      </>
                    ) : (
                      'Install All'
                    )}
                  </button>
                )}
              </div>

              {loadingDownloads ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : downloads.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p>No downloaded .h5p files found.</p>
                  <p className="text-sm mt-1">
                    Run the download script or upload files manually.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {downloads.map((file) => (
                    <div
                      key={file.filename}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-800 dark:text-white">
                          {file.filename}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleInstallFromDownloads(file.filename)}
                        disabled={installing !== null}
                        className="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
                      >
                        {installing === file.filename ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Installing...
                          </>
                        ) : (
                          'Install'
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Installed Libraries */}
            {status && status.installedContentTypes.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Installed Libraries ({status.contentTypesCount})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {status.installedContentTypes.map((lib) => (
                    <span
                      key={lib}
                      className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm rounded"
                    >
                      {lib}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowLibraryManager(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Content List */}
      <section className="rounded-[30px] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/40 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Content library</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
              {isParent ? 'Everything families can launch from H5P' : 'Your assigned H5P quizzes'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              {isParent
                ? 'Preview content, review progress, inspect AI-generated questions, and keep the family quiz library organized from one place.'
                : 'Open a quiz, check your best score, and keep moving through the work that is assigned to you.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {content.length} item{content.length !== 1 ? 's' : ''}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {totalAttempts} attempt{totalAttempts !== 1 ? 's' : ''}
            </span>
            {isParent && (
              <span className="rounded-full bg-sky-100 px-3 py-1.5 font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                {aiGeneratedCount} AI-built
              </span>
            )}
          </div>
        </div>

        {content.length === 0 ? (
          <div className="mt-6 rounded-[28px] border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-950/40">
            <Package className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">No H5P content yet</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {isParent
                ? 'Start with a quiz or an activity, then assign it to children from the same H5P workflow.'
                : 'Your parent has not assigned any H5P quizzes yet. Check back after they publish new content.'}
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {content.map((item) => {
              const tone = getContentTone(item.content_type);
              const bestScore = item.best_score !== undefined && item.best_score !== null
                ? Math.round(item.best_score || 0)
                : null;
              const cardAttempts = isParent ? (item.attempt_count || 0) : (item.my_attempts || 0);

              return (
                <article
                  key={item.id}
                  className={`group rounded-[28px] border border-slate-200 bg-gradient-to-br ${tone.surface} p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl dark:border-slate-800`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tone.badge}`}>
                          {formatContentLabel(item.content_type)}
                        </span>
                        {item.is_ai_generated && (
                          <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300">
                            AI generated
                          </span>
                        )}
                      </div>

                      <h3 className="mt-4 truncate text-lg font-semibold text-slate-900 dark:text-white">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {item.library_name}
                      </p>
                    </div>

                    <button
                      onClick={() => setActivePlayer(item.id)}
                      className={`inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-white shadow-lg transition ${tone.button}`}
                      title={isParent ? 'Preview H5P content' : 'Open quiz'}
                    >
                      <Play className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/60 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/55">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        {isParent ? 'Assigned' : 'Attempts'}
                      </p>
                      <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
                        {isParent ? (item.assignment_count || 0) : cardAttempts}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/60 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/55">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        {isParent ? 'Attempts' : 'Best score'}
                      </p>
                      <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
                        {isParent ? (item.attempt_count || 0) : (bestScore !== null ? `${bestScore}%` : 'Not started')}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/60 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/55">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        {isParent ? 'Created' : 'Points'}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                        {isParent ? new Date(item.created_at).toLocaleDateString() : `${item.points || 0} pts`}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/60 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/55">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        {isParent ? 'Type' : 'Status'}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                        {isParent
                          ? formatContentLabel(item.content_type)
                          : item.passed
                          ? 'Passed'
                          : cardAttempts > 0
                          ? 'In progress'
                          : 'Ready'}
                      </p>
                    </div>
                  </div>

                  {!isParent && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {bestScore !== null && (
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          bestScore >= 70
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                        }`}>
                          Best score {bestScore}%
                        </span>
                      )}
                      {item.passed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Passed
                        </span>
                      ) : cardAttempts > 0 ? (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                          Keep going
                        </span>
                      ) : null}
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      onClick={() => setActivePlayer(item.id)}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition ${tone.button}`}
                    >
                      <Play className="h-4 w-4" />
                      {isParent ? 'Preview' : cardAttempts > 0 ? 'Play again' : 'Start quiz'}
                    </button>
                    {isParent && item.is_ai_generated && (
                      <button
                        onClick={() => loadQuestions(item.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-slate-950 dark:text-emerald-300 dark:hover:bg-emerald-950/20"
                      >
                        <HelpCircle className="h-4 w-4" />
                        Questions
                      </button>
                    )}
                    {isParent && (
                      <button
                        onClick={() => loadProgress(item.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 dark:border-violet-900/50 dark:bg-slate-950 dark:text-violet-300 dark:hover:bg-violet-950/20"
                      >
                        <Eye className="h-4 w-4" />
                        Progress
                      </button>
                    )}
                    {isParent && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-900/50 dark:bg-slate-950 dark:text-rose-300 dark:hover:bg-rose-950/20"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Progress Modal */}
      {showProgressModal !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-lg w-full shadow-2xl my-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Users className="w-6 h-6" />
                Child Progress
              </h2>
              <button
                onClick={() => {
                  setShowProgressModal(null);
                  setProgressData([]);
                }}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingProgress ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : progressData.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No children assigned to this quiz yet.</p>
                <p className="text-sm mt-2">Assign children when creating a quiz or use the assign feature.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary Header */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {progressData.filter((a: any) => a.passed).length}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Passed</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        {progressData.filter((a: any) => !a.passed && a.attempt_count > 0).length}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">In Progress</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-500 dark:text-gray-400">
                        {progressData.filter((a: any) => !a.attempt_count || a.attempt_count === 0).length}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Not Started</div>
                    </div>
                  </div>
                  {/* Overall Progress Bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                      <span>Overall Completion</span>
                      <span>{Math.round((progressData.filter((a: any) => a.passed).length / progressData.length) * 100)}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all"
                        style={{ width: `${(progressData.filter((a: any) => a.passed).length / progressData.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Children List */}
                {progressData.map((assignment: any) => (
                  <div
                    key={assignment.id}
                    className={`p-4 rounded-lg border ${
                      assignment.passed
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                        : assignment.attempt_count > 0
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700'
                        : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {assignment.child_avatar?.startsWith('/') || assignment.child_avatar?.startsWith('http') ? (
                        <img
                          src={assignment.child_avatar}
                          alt={assignment.child_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl">{assignment.child_avatar || '👤'}</span>
                      )}
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-800 dark:text-white">
                          {assignment.child_name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm">
                          {assignment.passed ? (
                            <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                              <CheckCircle className="w-4 h-4" />
                              Passed!
                            </span>
                          ) : assignment.attempt_count > 0 ? (
                            <span className="text-yellow-600 dark:text-yellow-400">
                              In Progress
                            </span>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400">
                              Not Started
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right min-w-[80px]">
                        {assignment.best_score !== null && assignment.best_score !== undefined && (
                          <div className="text-lg font-bold text-gray-800 dark:text-white">
                            {Math.round(assignment.best_score)}%
                          </div>
                        )}
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {assignment.attempt_count || 0} attempt{assignment.attempt_count !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    {/* Score Progress Bar */}
                    {assignment.best_score !== null && assignment.best_score !== undefined && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              assignment.best_score >= 70
                                ? 'bg-gradient-to-r from-green-400 to-green-500'
                                : 'bg-gradient-to-r from-yellow-400 to-orange-500'
                            }`}
                            style={{ width: `${Math.min(100, assignment.best_score)}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex justify-between mt-2">
                      <span>Points: {assignment.points}</span>
                      {assignment.due_date && (
                        <span>Due: {new Date(assignment.due_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  setShowProgressModal(null);
                  setProgressData([]);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Questions Preview Modal */}
      {showQuestionsModal !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full shadow-2xl my-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <HelpCircle className="w-6 h-6" />
                Quiz Questions
              </h2>
              <button
                onClick={() => {
                  setShowQuestionsModal(null);
                  setQuestionsData(null);
                }}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingQuestions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : questionsData ? (
              <div className="space-y-4">
                {/* Quiz Info */}
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <h3 className="font-semibold text-gray-800 dark:text-white">
                    {questionsData.title}
                  </h3>
                  <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {questionsData.theme && (
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                        Theme: {questionsData.theme}
                      </span>
                    )}
                    {questionsData.age && (
                      <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded">
                        Age: {questionsData.age}
                      </span>
                    )}
                    {questionsData.provider && (
                      <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded">
                        AI: {questionsData.provider}
                      </span>
                    )}
                    <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded">
                      {questionsData.questionCount} questions
                    </span>
                  </div>
                </div>

                {/* Questions List */}
                {questionsData.questions?.length > 0 ? (
                  <div className="space-y-4">
                    {questionsData.questions.map((q: any) => (
                      <div
                        key={q.index}
                        className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full font-bold">
                            {q.index}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`px-2 py-0.5 text-xs rounded ${
                                q.type === 'mcq'
                                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                                  : q.type === 'true_false'
                                  ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                              }`}>
                                {q.type === 'mcq' ? 'Multiple Choice'
                                  : q.type === 'true_false' ? 'True/False'
                                  : q.type === 'fill_blank' ? 'Fill Blank'
                                  : q.type === 'drag_text' ? 'Drag Words'
                                  : q.type === 'mark_words' ? 'Mark Words'
                                  : q.type}
                              </span>
                            </div>
                            <p className="font-medium text-gray-800 dark:text-white mb-2">
                              {q.prompt}
                            </p>

                            {/* Show choices for MCQ */}
                            {q.type === 'mcq' && q.choices && (
                              <div className="space-y-1 mb-2">
                                {q.choices.map((choice: string, idx: number) => (
                                  <div
                                    key={idx}
                                    className={`px-3 py-1.5 rounded text-sm ${
                                      idx === q.correctAnswer
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                    }`}
                                  >
                                    {String.fromCharCode(65 + idx)}. {choice}
                                    {idx === q.correctAnswer && ' ✓'}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Show answer for True/False */}
                            {q.type === 'true_false' && (
                              <div className="mb-2">
                                <span className={`px-3 py-1.5 rounded text-sm font-medium ${
                                  q.correctAnswer
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                }`}>
                                  Answer: {q.correctAnswer ? 'TRUE' : 'FALSE'}
                                </span>
                              </div>
                            )}

                            {/* Explanation */}
                            {q.explanation && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                                {q.explanation}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No questions available for this quiz.</p>
                    <p className="text-sm mt-2">This may be older content created before question storage was added.</p>
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => {
                  setShowQuestionsModal(null);
                  setQuestionsData(null);
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostic Modal */}
      {showDiagnostic && diagnosticData && (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full shadow-2xl my-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <HelpCircle className="w-6 h-6" />
                H5P Diagnostic Report
              </h2>
              <button
                onClick={() => setShowDiagnostic(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Health Status */}
            <div className={`p-4 rounded-lg mb-4 ${
              diagnosticData.healthy
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
            }`}>
              <div className="flex items-center gap-2">
                {diagnosticData.healthy ? (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-red-500" />
                )}
                <span className={`font-semibold ${
                  diagnosticData.healthy
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-red-700 dark:text-red-300'
                }`}>
                  {diagnosticData.healthy ? 'H5P System Healthy' : 'Issues Detected'}
                </span>
              </div>
            </div>

            {/* Issues */}
            {diagnosticData.issues?.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold text-red-600 dark:text-red-400 mb-2">Issues:</h3>
                <ul className="space-y-1">
                  {diagnosticData.issues.map((issue: string, i: number) => (
                    <li key={i} className="text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {diagnosticData.warnings?.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold text-yellow-600 dark:text-yellow-400 mb-2">Warnings:</h3>
                <ul className="space-y-1">
                  {diagnosticData.warnings.map((warning: string, i: number) => (
                    <li key={i} className="text-sm text-yellow-700 dark:text-yellow-300 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Libraries */}
            <div className="mb-4">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-2">Libraries:</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                  <span className="text-gray-500 dark:text-gray-400">Total:</span>
                  <span className="ml-2 font-medium">{diagnosticData.libraries?.total || 0}</span>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                  <span className="text-gray-500 dark:text-gray-400">Runnable:</span>
                  <span className="ml-2 font-medium">{diagnosticData.libraries?.runnable || 0}</span>
                </div>
                <div className={`p-2 rounded ${
                  diagnosticData.libraries?.quizReady
                    ? 'bg-green-50 dark:bg-green-900/30'
                    : 'bg-red-50 dark:bg-red-900/30'
                }`}>
                  <span className="text-gray-500 dark:text-gray-400">Quiz Ready:</span>
                  <span className={`ml-2 font-medium ${
                    diagnosticData.libraries?.quizReady
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {diagnosticData.libraries?.quizReady ? 'Yes' : 'No'}
                  </span>
                </div>
                {diagnosticData.libraries?.missingForQuiz?.length > 0 && (
                  <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded col-span-2">
                    <span className="text-gray-500 dark:text-gray-400">Missing:</span>
                    <span className="ml-2 font-medium text-red-600 dark:text-red-400">
                      {diagnosticData.libraries.missingForQuiz.join(', ')}
                    </span>
                  </div>
                )}
              </div>

              {/* Library details */}
              {diagnosticData.libraries?.details?.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Installed Libraries:</h4>
                  <div className="flex flex-wrap gap-1">
                    {diagnosticData.libraries.details.map((lib: any, i: number) => (
                      <span
                        key={i}
                        className={`px-2 py-0.5 text-xs rounded ${
                          lib.isRequiredForQuiz
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : lib.isRunnable
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {lib.name} {lib.version}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Database Stats */}
            <div className="mb-4">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-2">Database:</h3>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                  <span className="text-gray-500 dark:text-gray-400">Content:</span>
                  <span className="ml-2 font-medium">{diagnosticData.database?.content?.total_content || 0}</span>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                  <span className="text-gray-500 dark:text-gray-400">Assignments:</span>
                  <span className="ml-2 font-medium">{diagnosticData.database?.assignments?.total || 0}</span>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                  <span className="text-gray-500 dark:text-gray-400">Attempts:</span>
                  <span className="ml-2 font-medium">{diagnosticData.database?.attempts?.total_attempts || 0}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowDiagnostic(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default H5PManager;
