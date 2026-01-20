import React, { useEffect, useState, useRef } from 'react';
import { h5pAPI, rewardsAPI } from '../services/api';
import { useProfile } from '../context/ProfileContext';
import { Loader2, AlertCircle, CheckCircle, Play, Trash2, Users, Plus, Package, Upload, Download, FolderOpen, Globe, UserPlus, Eye, X, FileText, HelpCircle } from 'lucide-react';
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

  // Create form state
  const [createForm, setCreateForm] = useState({
    title: '',
    theme: '',
    age: 8,
    questionCount: 5,
    quizType: 'mixed' as 'mixed' | 'mcq_only' | 'true_false_only' | 'fill_blank',
    assignedTo: [] as number[],
    points: 20,
    provider: 'auto' as 'auto' | 'ollama' | 'gemini' | 'grok' | 'openai',
    includeImages: false,
    customInstructions: '',
    answerStyle: 'default' as 'default' | 'abcd' | 'numbered'
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-red-600 dark:text-red-400 text-center">{error}</p>
        <button
          onClick={loadData}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  // If playing content
  if (activePlayer !== null) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <button
          onClick={() => setActivePlayer(null)}
          className="mb-4 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
        >
          ← Back to List
        </button>
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
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            {isParent ? 'H5P Content Manager' : 'Interactive Quizzes'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {isParent ? 'Create and manage interactive learning content' : 'Complete quizzes to earn points!'}
          </p>
        </div>
        {isParent && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenLibraryManager}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2"
            >
              <FolderOpen className="w-5 h-5" />
              Manage Libraries
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Quiz
            </button>
          </div>
        )}
      </div>

      {/* Status Card (Parents Only) */}
      {isParent && status && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <Package className="w-5 h-5" />
              H5P Service Status
            </h2>
            <div className="flex gap-2">
              {/* Import Content Button */}
              <input
                ref={importFileInputRef}
                type="file"
                accept=".h5p"
                onChange={handleImportContent}
                className="hidden"
              />
              <button
                onClick={() => importFileInputRef.current?.click()}
                disabled={importingContent}
                className="px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-1 text-sm"
              >
                {importingContent ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
                ) : (
                  <><Upload className="w-4 h-4" /> Import .h5p</>
                )}
              </button>
              {/* Diagnostic Button */}
              <button
                onClick={handleRunDiagnostic}
                disabled={loadingDiagnostic}
                className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center gap-1 text-sm"
              >
                {loadingDiagnostic ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Checking...</>
                ) : (
                  <><HelpCircle className="w-4 h-4" /> Diagnostic</>
                )}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              {status.initialized ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
              <span className="text-gray-700 dark:text-gray-300">
                {status.initialized ? 'Service Running' : 'Not Initialized'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Libraries:</span>
              <span className="ml-2 font-medium text-gray-800 dark:text-white">
                {status.contentTypesCount}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Runnable Types:</span>
              <span className="ml-2 font-medium text-gray-800 dark:text-white">
                {status.runnableCount || 0}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {status.quizReady ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-500" />
              )}
              <span className="text-gray-700 dark:text-gray-300">
                {status.quizReady ? 'Quiz Ready' : 'Quiz Libraries Missing'}
              </span>
            </div>
          </div>
          {!status.quizReady && status.missingForQuiz && status.missingForQuiz.length > 0 && (
            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
              <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                <strong>Missing libraries for quiz generation:</strong> {status.missingForQuiz.join(', ')}
              </p>
              <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-2">
                Click "Manage Libraries" then "Install from Hub" to install required libraries.
              </p>
            </div>
          )}
          {status.contentTypesCount === 0 && (
            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
              <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                <strong>Note:</strong> No H5P libraries installed yet. Click "Manage Libraries" then "Install from Hub" to install required libraries for quiz creation.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 max-w-lg w-full shadow-2xl my-4 max-h-[90vh] overflow-y-auto">
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
                    <option value="mcq_only">Multiple Choice Only</option>
                    <option value="true_false_only">True/False Only</option>
                    <option value="fill_blank">Fill in the Blank</option>
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
      )}

      {/* Library Manager Modal */}
      {showLibraryManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full shadow-2xl max-h-[80vh] overflow-y-auto">
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
      )}

      {/* Content List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
            {isParent ? 'Your Content' : 'Available Quizzes'}
          </h2>
        </div>

        {content.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No content available yet.</p>
            {isParent && (
              <p className="mt-2 text-sm">Click "Create Quiz" to get started!</p>
            )}
          </div>
        ) : (
          <div className="divide-y dark:divide-gray-700">
            {content.map((item) => (
              <div
                key={item.id}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-between"
              >
                <div className="flex-1">
                  <h3 className="font-medium text-gray-800 dark:text-white">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                    <span>{item.content_type}</span>
                    {item.is_ai_generated && (
                      <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded text-xs">
                        AI Generated
                      </span>
                    )}
                    {isParent && (
                      <>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {item.assignment_count || 0} assigned
                        </span>
                        <span>{item.attempt_count || 0} attempts</span>
                      </>
                    )}
                    {!isParent && item.best_score !== undefined && (
                      <span>Best: {Math.round(item.best_score || 0)}%</span>
                    )}
                    {!isParent && item.passed && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActivePlayer(item.id)}
                    className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                    title="Play"
                  >
                    <Play className="w-5 h-5" />
                  </button>
                  {isParent && (
                    <>
                      {item.is_ai_generated && (
                        <button
                          onClick={() => loadQuestions(item.id)}
                          className="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                          title="View Questions"
                        >
                          <HelpCircle className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => loadProgress(item.id)}
                        className="p-2 text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg"
                        title="View Progress"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progress Modal */}
      {showProgressModal !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-lg w-full shadow-2xl max-h-[80vh] overflow-y-auto">
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
              <div className="space-y-3">
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
                      <div className="text-right">
                        {assignment.best_score !== null && (
                          <div className="text-lg font-bold text-gray-800 dark:text-white">
                            {Math.round(assignment.best_score)}%
                          </div>
                        )}
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {assignment.attempt_count || 0} attempt{assignment.attempt_count !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex justify-between">
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
      )}

      {/* Questions Preview Modal */}
      {showQuestionsModal !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full shadow-2xl max-h-[85vh] overflow-y-auto">
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
                                {q.type === 'mcq' ? 'Multiple Choice' : q.type === 'true_false' ? 'True/False' : q.type}
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
      )}

      {/* Diagnostic Modal */}
      {showDiagnostic && diagnosticData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
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
      )}
    </div>
  );
};

export default H5PManager;
