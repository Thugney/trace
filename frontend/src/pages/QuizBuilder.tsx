import { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { familyQuizzesAPI, profilesAPI, type QuizCategory, type FamilyQuiz, type QuizQuestion, type QuizOption } from '../services/api';
import { useToast } from '../components/Toast';
import QuizMediaUploader from '../components/QuizMediaUploader';
import { Plus, ArrowLeft, Image, Music, Check, X, Sparkles, BookOpen, Calculator, Globe, History, Beaker, Languages, Palette, HelpCircle, Lightbulb, Upload } from 'lucide-react';

// Type for input_config
interface InputConfig {
  supports_images?: boolean;
  supports_audio?: boolean;
  option_style?: string;
  question_placeholder?: string;
  color_picker?: boolean;
  shape_picker?: boolean;
}

interface QuizWithQuestions extends FamilyQuiz {
  questions: QuizQuestion[];
  theme_config?: any;
  input_config?: any;
}

// Category icons mapping for visual appeal
const CATEGORY_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  alphabet: { icon: BookOpen, color: 'text-pink-600', bg: 'from-pink-400 to-rose-500' },
  math: { icon: Calculator, color: 'text-blue-600', bg: 'from-blue-400 to-indigo-500' },
  geography: { icon: Globe, color: 'text-green-600', bg: 'from-green-400 to-emerald-500' },
  history: { icon: History, color: 'text-amber-600', bg: 'from-amber-400 to-orange-500' },
  science: { icon: Beaker, color: 'text-purple-600', bg: 'from-purple-400 to-violet-500' },
  language: { icon: Languages, color: 'text-cyan-600', bg: 'from-cyan-400 to-teal-500' },
  colors_shapes: { icon: Palette, color: 'text-rose-600', bg: 'from-rose-400 to-pink-500' },
};

// Helper to get category display info
const getCategoryStyle = (categoryName: string) => {
  return CATEGORY_ICONS[categoryName] || { icon: HelpCircle, color: 'text-gray-600', bg: 'from-gray-400 to-slate-500' };
};

export default function QuizBuilder() {
  const { currentProfile } = useProfile();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<QuizCategory[]>([]);
  const [quizzes, setQuizzes] = useState<FamilyQuiz[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiCategoryId, setAiCategoryId] = useState(0);
  const [aiAssignedTo, setAiAssignedTo] = useState(0);
  const [aiQuestionCount, setAiQuestionCount] = useState(5);
  const [aiIncludeImages, setAiIncludeImages] = useState(true);
  const [aiImageProvider, setAiImageProvider] = useState<'grok' | 'openai' | 'gemini'>('gemini');
  const [aiGenerating, setAiGenerating] = useState(false);

  // UI State
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'questions'>('list');
  const [selectedQuiz, setSelectedQuiz] = useState<QuizWithQuestions | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<QuizCategory | null>(null);

  // Form state for new quiz
  const [quizForm, setQuizForm] = useState({
    title: '',
    description: '',
    categoryId: 0,
    assignedTo: 0,
    pointsPerCorrect: 10,
    starsPerCorrect: 0,
    bonusPoints: 20,
    timeLimitSeconds: 0,
    passThreshold: 70,
    isCompetition: false,
    firstPlaceBonus: 50,
    secondPlaceBonus: 25,
    thirdPlaceBonus: 10
  });

  // Question form state
  const [questionForm, setQuestionForm] = useState({
    questionText: '',
    questionImage: '',
    questionAudio: '',
    options: [{ id: 'a', text: '', image: '', color: '', shape: '' }, { id: 'b', text: '', image: '', color: '', shape: '' }, { id: 'c', text: '', image: '', color: '', shape: '' }, { id: 'd', text: '', image: '', color: '', shape: '' }] as QuizOption[],
    correctAnswer: '',
    hint: '',
    explanation: '',
    points: 10
  });
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);

  const hasOptionContent = (option: QuizOption) => {
    return Boolean(option.text?.trim() || option.image || option.color || option.shape);
  };

  useEffect(() => {
    if (currentProfile?.id) {
      loadData();
    }
  }, [currentProfile]);

  useEffect(() => {
    const category = categories.find(cat => cat.id === aiCategoryId);
    if (category) {
      const config = (category.input_config || {}) as InputConfig;
      if (!config.supports_images && aiIncludeImages) {
        setAiIncludeImages(false);
      }
    }
  }, [aiCategoryId, categories, aiIncludeImages]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [categoriesRes, quizzesRes, childrenRes, statsRes] = await Promise.all([
        familyQuizzesAPI.getCategories(),
        familyQuizzesAPI.getParentQuizzes(currentProfile!.id),
        profilesAPI.getAll(),
        familyQuizzesAPI.getParentStats(currentProfile!.id)
      ]);
      setCategories(categoriesRes.data);
      setQuizzes(quizzesRes.data);
      setChildren(childrenRes.data.filter((p: any) => p.type === 'child'));
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to load quiz data:', error);
      showToast('Failed to load quiz data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (category: QuizCategory) => {
    setSelectedCategory(category);
    setQuizForm(prev => ({ ...prev, categoryId: category.id }));
  };

  const handleCreateQuiz = async () => {
    if (!quizForm.title || !quizForm.categoryId || !quizForm.assignedTo) {
      showToast('Please fill in title, category, and select a child', 'error');
      return;
    }

    try {
      const response = await familyQuizzesAPI.createQuiz({
        ...quizForm,
        createdBy: currentProfile!.id,
        timeLimitSeconds: quizForm.timeLimitSeconds || undefined
      });
      showToast('Quiz created! Now add questions.', 'success');
      setSelectedQuiz({ ...response.data, questions: [] } as QuizWithQuestions);
      setView('questions');
      loadData();
    } catch (error) {
      console.error('Failed to create quiz:', error);
      showToast('Failed to create quiz', 'error');
    }
  };

  const handleEditQuiz = async (quizId: number) => {
    try {
      const response = await familyQuizzesAPI.getQuiz(quizId);
      setSelectedQuiz(response.data as QuizWithQuestions);
      const cat = categories.find(c => c.id === response.data.category_id);
      setSelectedCategory(cat || null);
      setView('questions');
    } catch (error) {
      console.error('Failed to load quiz:', error);
      showToast('Failed to load quiz', 'error');
    }
  };

  const handleDeleteQuiz = async (quizId: number) => {
    if (!confirm('Are you sure you want to delete this quiz? All questions and attempts will be lost.')) {
      return;
    }
    try {
      await familyQuizzesAPI.deleteQuiz(quizId);
      showToast('Quiz deleted', 'success');
      loadData();
    } catch (error) {
      console.error('Failed to delete quiz:', error);
      showToast('Failed to delete quiz', 'error');
    }
  };

  const handleGenerateAIQuiz = async () => {
    if (!aiPrompt.trim() || !aiCategoryId || !aiAssignedTo) {
      showToast('Please enter a prompt, select a category, and choose a child', 'error');
      return;
    }

    try {
      setAiGenerating(true);
      const startResponse = await familyQuizzesAPI.createAIQuizJob({
        prompt: aiPrompt.trim(),
        categoryId: aiCategoryId,
        questionCount: aiQuestionCount,
        createdBy: currentProfile!.id,
        assignedTo: aiAssignedTo,
        includeImages: aiIncludeImages,
        imageProvider: aiImageProvider
      });

      const jobId = startResponse.data.jobId;
      const startedAt = Date.now();
      let delayMs = 2000;
      let jobResult: any = null;

      while (true) {
        const statusResponse = await familyQuizzesAPI.getAIQuizJobStatus(jobId);
        const status = statusResponse.data.status;

        if (status === 'completed') {
          jobResult = statusResponse.data.result;
          break;
        }
        if (status === 'failed') {
          throw new Error(statusResponse.data.error || 'Failed to generate AI quiz');
        }
        if (Date.now() - startedAt > 5 * 60 * 1000) {
          throw new Error('AI quiz generation is taking too long. Please try again.');
        }

        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs = Math.min(delayMs + 500, 5000);
      }

      if (!jobResult?.quiz) {
        throw new Error('AI quiz generation did not return a quiz');
      }

      const createdQuiz = jobResult.quiz as QuizWithQuestions;
      createdQuiz.questions = jobResult.questions || [];

      const cat = categories.find(c => c.id === createdQuiz.category_id) || null;
      setSelectedCategory(cat);
      setSelectedQuiz(createdQuiz);
      setView('questions');
      showToast('AI quiz created! Review and edit questions.', 'success');
      if (jobResult.image_warnings?.length) {
        showToast('Some images could not be generated. You can upload them manually.', 'warning');
      }
      loadData();
    } catch (error: any) {
      console.error('Failed to generate AI quiz:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to generate AI quiz';
      showToast(errorMsg, 'error');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAddQuestion = async () => {
    if (!selectedQuiz) return;
    if (!questionForm.questionText || !questionForm.correctAnswer) {
      showToast('Please enter question text and select correct answer', 'error');
      return;
    }
    if (questionForm.options.some(option => !hasOptionContent(option))) {
      showToast('Please add text, image, color, or shape for every option', 'error');
      return;
    }

    try {
      if (editingQuestionId) {
        await familyQuizzesAPI.updateQuestion(editingQuestionId, questionForm);
        showToast('Question updated!', 'success');
      } else {
        await familyQuizzesAPI.addQuestion(selectedQuiz.id, questionForm);
        showToast('Question added!', 'success');
      }

      // Reload quiz
      const response = await familyQuizzesAPI.getQuiz(selectedQuiz.id);
      setSelectedQuiz(response.data as QuizWithQuestions);

      // Reset form
      setQuestionForm({
        questionText: '',
        questionImage: '',
        questionAudio: '',
        options: [{ id: 'a', text: '', image: '', color: '', shape: '' }, { id: 'b', text: '', image: '', color: '', shape: '' }, { id: 'c', text: '', image: '', color: '', shape: '' }, { id: 'd', text: '', image: '', color: '', shape: '' }],
        correctAnswer: '',
        hint: '',
        explanation: '',
        points: 10
      });
      setEditingQuestionId(null);
    } catch (error) {
      console.error('Failed to save question:', error);
      showToast('Failed to save question', 'error');
    }
  };

  const handleEditQuestion = (question: QuizQuestion) => {
    setEditingQuestionId(question.id);
    setQuestionForm({
      questionText: question.question_text,
      questionImage: question.question_image || '',
      questionAudio: question.question_audio || '',
      options: question.options.map(opt => ({
        id: opt.id,
        text: opt.text || '',
        image: opt.image || '',
        color: opt.color || '',
        shape: opt.shape || ''
      })),
      correctAnswer: question.correct_answer || '',
      hint: question.hint || '',
      explanation: question.explanation || '',
      points: question.points
    });
  };

  const handleDeleteQuestion = async (questionId: number) => {
    if (!confirm('Delete this question?')) return;
    try {
      await familyQuizzesAPI.deleteQuestion(questionId);
      const response = await familyQuizzesAPI.getQuiz(selectedQuiz!.id);
      setSelectedQuiz(response.data as QuizWithQuestions);
      showToast('Question deleted', 'success');
    } catch (error) {
      console.error('Failed to delete question:', error);
      showToast('Failed to delete question', 'error');
    }
  };

  const resetForms = () => {
    setQuizForm({
      title: '',
      description: '',
      categoryId: 0,
      assignedTo: 0,
      pointsPerCorrect: 10,
      starsPerCorrect: 0,
      bonusPoints: 20,
      timeLimitSeconds: 0,
      passThreshold: 70,
      isCompetition: false,
      firstPlaceBonus: 50,
      secondPlaceBonus: 25,
      thirdPlaceBonus: 10
    });
    setQuestionForm({
      questionText: '',
      questionImage: '',
      questionAudio: '',
      options: [{ id: 'a', text: '', image: '', color: '', shape: '' }, { id: 'b', text: '', image: '', color: '', shape: '' }, { id: 'c', text: '', image: '', color: '', shape: '' }, { id: 'd', text: '', image: '', color: '', shape: '' }],
      correctAnswer: '',
      hint: '',
      explanation: '',
      points: 10
    });
    setSelectedCategory(null);
    setSelectedQuiz(null);
    setEditingQuestionId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  // Quiz List View
  if (view === 'list') {
    const aiCategory = categories.find(cat => cat.id === aiCategoryId) || null;
    const aiInputConfig: InputConfig = (aiCategory?.input_config || {}) as InputConfig;

    return (
      <div className="space-y-6">
        {/* Header with fun gradient */}
        <div className="bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="w-7 h-7" />
                Quiz Builder
              </h1>
              <p className="text-white/80 mt-1">Create fun educational quizzes for your kids!</p>
            </div>
            <button
              onClick={() => { resetForms(); setView('create'); }}
              className="px-5 py-3 bg-white text-purple-600 rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" /> Create Quiz
            </button>
          </div>
        </div>

        {/* AI Quiz Generator */}
        <div className="bg-white rounded-2xl shadow-lg border border-purple-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-6 h-6 text-purple-600" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">AI Quiz Generator</h2>
              <p className="text-sm text-gray-500">Give a prompt and let AI build the quiz.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quiz Category</label>
              <select
                value={aiCategoryId}
                onChange={(e) => setAiCategoryId(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl"
              >
                <option value={0}>Select category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.display_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Assign To</label>
              <select
                value={aiAssignedTo}
                onChange={(e) => setAiAssignedTo(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl"
              >
                <option value={0}>Select child</option>
                {children.map((child) => (
                  <option key={child.id} value={child.id}>{child.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Prompt</label>
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g., Make a fun ocean animals quiz with easy questions"
                className="w-full px-4 py-2 border border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Questions</label>
              <input
                type="number"
                min={1}
                max={20}
                value={aiQuestionCount}
                onChange={(e) => setAiQuestionCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl"
              />
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={aiIncludeImages}
                  onChange={(e) => setAiIncludeImages(e.target.checked)}
                  disabled={!aiInputConfig.supports_images}
                  className="rounded border-gray-300"
                />
                Include AI-generated images
              </label>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span>Image provider</span>
                <select
                  value={aiImageProvider}
                  onChange={(e) => setAiImageProvider(e.target.value as 'grok' | 'openai' | 'gemini')}
                  disabled={!aiIncludeImages || !aiInputConfig.supports_images}
                  className="px-3 py-1 border border-gray-200 rounded-lg"
                >
                  <option value="gemini">Gemini</option>
                  <option value="grok">Grok</option>
                  <option value="openai">OpenAI</option>
                </select>
              </div>
              {!aiInputConfig.supports_images && aiCategory && (
                <span className="text-xs text-gray-500">This category does not support images</span>
              )}
            </div>

            {/* Cost Estimate */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              <div className="font-semibold text-amber-800 mb-1">💰 Estimated Cost</div>
              {aiIncludeImages && aiInputConfig.supports_images ? (
                <div className="space-y-0.5 text-amber-700">
                  <div className="flex justify-between">
                    <span>{aiQuestionCount} question images × $0.04</span>
                    <span>${(aiQuestionCount * 0.04).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Text generation</span>
                    <span>~$0.01</span>
                  </div>
                  <div className="flex justify-between font-bold text-amber-900 border-t border-amber-300 pt-1 mt-1">
                    <span>Total</span>
                    <span>${(aiQuestionCount * 0.04 + 0.01).toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-amber-700">
                  <div className="flex justify-between">
                    <span>Text generation only</span>
                    <span>~$0.01</span>
                  </div>
                </div>
              )}
              <p className="text-xs text-amber-600 mt-1">* Based on OpenAI DALL-E 3 pricing</p>
            </div>

            <button
              onClick={handleGenerateAIQuiz}
              disabled={aiGenerating}
              className="px-5 py-2 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {aiGenerating ? 'Generating...' : 'Generate Quiz'}
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border">
              <div className="text-3xl font-bold text-purple-600">{stats.total_quizzes || 0}</div>
              <div className="text-sm text-gray-600">Total Quizzes</div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border">
              <div className="text-3xl font-bold text-blue-600">{stats.total_attempts || 0}</div>
              <div className="text-sm text-gray-600">Attempts</div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border">
              <div className="text-3xl font-bold text-green-600">{Math.round(stats.avg_score || 0)}%</div>
              <div className="text-sm text-gray-600">Avg Score</div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border">
              <div className="text-3xl font-bold text-yellow-600">{stats.total_points_awarded || 0}</div>
              <div className="text-sm text-gray-600">Points Awarded</div>
            </div>
          </div>
        )}

        {/* Quiz List */}
        {quizzes.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No quizzes yet</h3>
            <p className="text-gray-600 mb-4">Create your first quiz to start teaching!</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {quizzes.map(quiz => (
              <div key={quiz.id} className="bg-white rounded-xl shadow-sm border p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{quiz.category_icon}</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{quiz.title}</h3>
                      <p className="text-sm text-gray-500">{quiz.category_name}</p>
                    </div>
                  </div>
                  {quiz.is_competition === 1 && (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Competition</span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                  <span className="flex items-center gap-1">
                    <span>👤</span> {quiz.assigned_to_name}
                  </span>
                  <span className="text-gray-300">|</span>
                  <span>{quiz.question_count || 0} questions</span>
                  <span className="text-gray-300">|</span>
                  <span>{quiz.attempt_count || 0} attempts</span>
                </div>

                {quiz.avg_score && (
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Average Score</span>
                      <span className="font-medium">{Math.round(quiz.avg_score)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full"
                        style={{ width: `${Math.min(quiz.avg_score, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditQuiz(quiz.id)}
                    className="flex-1 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 text-sm font-medium"
                  >
                    Edit Questions
                  </button>
                  <button
                    onClick={() => handleDeleteQuiz(quiz.id)}
                    className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Create Quiz View
  if (view === 'create') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setView('list'); resetForms(); }}
              className="p-2 hover:bg-white/20 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">Create New Quiz</h1>
              <p className="text-white/80">Build an engaging quiz for your child</p>
            </div>
          </div>
        </div>

        {/* Step 1: Select Category - Now more visual! */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-purple-100">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-purple-600 font-bold">1</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Choose Quiz Category</h2>
              <p className="text-sm text-gray-500">Select what type of quiz you want to create</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map(cat => {
              const isSelected = selectedCategory?.id === cat.id;
              const style = getCategoryStyle(cat.name);
              const inputConfig: InputConfig = (cat.input_config || {}) as InputConfig;

              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat)}
                  className={`relative p-5 rounded-2xl border-2 transition-all duration-300 transform ${
                    isSelected
                      ? `border-purple-500 bg-gradient-to-br ${style.bg} text-white shadow-xl scale-105`
                      : 'border-gray-200 hover:border-purple-300 hover:shadow-lg hover:scale-102 bg-white'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}

                  <div className="flex flex-col items-center text-center">
                    <div className={`text-4xl mb-2 ${isSelected ? '' : ''}`}>{cat.icon}</div>
                    <div className={`font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                      {cat.display_name}
                    </div>
                    <div className={`text-xs mt-1 ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                      {cat.description}
                    </div>

                    {/* Show supported features */}
                    <div className="flex gap-1 mt-2">
                      {inputConfig.supports_images && (
                        <span className={`p-1 rounded ${isSelected ? 'bg-white/20' : 'bg-gray-100'}`}>
                          <Image className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                        </span>
                      )}
                      {inputConfig.supports_audio && (
                        <span className={`p-1 rounded ${isSelected ? 'bg-white/20' : 'bg-gray-100'}`}>
                          <Music className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Category-specific help text */}
          {selectedCategory && (
            <div className="mt-4 p-4 bg-purple-50 rounded-xl border border-purple-100">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-purple-800">
                  <strong>{selectedCategory.display_name} Quiz Tips:</strong>
                  {selectedCategory.name === 'alphabet' && (
                    <p className="mt-1">Upload images of letters and ask kids to identify them. You can add audio pronunciation too!</p>
                  )}
                  {selectedCategory.name === 'math' && (
                    <p className="mt-1">Create simple math problems. Kids will love solving addition, subtraction, and more!</p>
                  )}
                  {selectedCategory.name === 'geography' && (
                    <p className="mt-1">Add maps and flag images to teach about countries and capitals.</p>
                  )}
                  {selectedCategory.name === 'colors_shapes' && (
                    <p className="mt-1">Upload colorful images and use the color/shape pickers to create visual questions.</p>
                  )}
                  {selectedCategory.name === 'science' && (
                    <p className="mt-1">Add images of animals, plants, or experiments to make learning fun!</p>
                  )}
                  {selectedCategory.name === 'language' && (
                    <p className="mt-1">Create word recognition and sentence completion questions with audio support.</p>
                  )}
                  {selectedCategory.name === 'history' && (
                    <p className="mt-1">Add historical images and dates to teach about important events and people.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Quiz Details */}
        {selectedCategory && (
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-indigo-100">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                <span className="text-indigo-600 font-bold">2</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Quiz Details</h2>
                <p className="text-sm text-gray-500">Set up your quiz settings and assign to a child</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quiz Title</label>
                <input
                  type="text"
                  value={quizForm.title}
                  onChange={e => setQuizForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={`e.g., ${selectedCategory.display_name} Practice`}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  value={quizForm.description}
                  onChange={e => setQuizForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of what this quiz covers..."
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Child</label>
                <select
                  value={quizForm.assignedTo}
                  onChange={e => setQuizForm(prev => ({ ...prev, assignedTo: parseInt(e.target.value) }))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value={0}>Select a child...</option>
                  {children.map(child => (
                    <option key={child.id} value={child.id}>{child.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Points per Correct</label>
                  <input
                    type="number"
                    value={quizForm.pointsPerCorrect}
                    onChange={e => setQuizForm(prev => ({ ...prev, pointsPerCorrect: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 border rounded-lg"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stars per Correct</label>
                  <input
                    type="number"
                    value={quizForm.starsPerCorrect}
                    onChange={e => setQuizForm(prev => ({ ...prev, starsPerCorrect: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-2 border rounded-lg"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Passing Score %</label>
                  <input
                    type="number"
                    value={quizForm.passThreshold}
                    onChange={e => setQuizForm(prev => ({ ...prev, passThreshold: parseInt(e.target.value) || 70 }))}
                    className="w-full px-4 py-2 border rounded-lg"
                    min={0}
                    max={100}
                  />
                </div>
              </div>

              {/* Competition Mode */}
              <div className="border-t pt-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={quizForm.isCompetition}
                    onChange={e => setQuizForm(prev => ({ ...prev, isCompetition: e.target.checked }))}
                    className="w-5 h-5 text-purple-600 rounded"
                  />
                  <span className="font-medium">Competition Mode</span>
                  <span className="text-sm text-gray-500">- First to finish gets bonus points!</span>
                </label>

                {quizForm.isCompetition && (
                  <div className="mt-4 grid grid-cols-3 gap-4 pl-8">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">1st Place Bonus</label>
                      <input
                        type="number"
                        value={quizForm.firstPlaceBonus}
                        onChange={e => setQuizForm(prev => ({ ...prev, firstPlaceBonus: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">2nd Place Bonus</label>
                      <input
                        type="number"
                        value={quizForm.secondPlaceBonus}
                        onChange={e => setQuizForm(prev => ({ ...prev, secondPlaceBonus: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">3rd Place Bonus</label>
                      <input
                        type="number"
                        value={quizForm.thirdPlaceBonus}
                        onChange={e => setQuizForm(prev => ({ ...prev, thirdPlaceBonus: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleCreateQuiz}
              className="mt-6 w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              Create Quiz & Add Questions
            </button>
          </div>
        )}
      </div>
    );
  }

  // Question Editor View
  if (view === 'questions' && selectedQuiz) {
    const inputConfig: InputConfig = (selectedCategory?.input_config || {}) as InputConfig;
    const supportsImages = inputConfig.supports_images;
    const supportsAudio = inputConfig.supports_audio;
    const style = getCategoryStyle(selectedCategory?.name || '');

    return (
      <div className="space-y-6">
        {/* Header with category-specific gradient */}
        <div className={`bg-gradient-to-r ${style.bg} rounded-2xl p-6 text-white shadow-lg`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => { setView('list'); resetForms(); }}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold">{selectedQuiz.title}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-white/80">{selectedQuiz.questions?.length || 0} questions</span>
                  {supportsImages && (
                    <span className="flex items-center gap-1 text-white/80 text-sm bg-white/20 px-2 py-0.5 rounded-full">
                      <Image className="w-3 h-3" /> Images
                    </span>
                  )}
                  {supportsAudio && (
                    <span className="flex items-center gap-1 text-white/80 text-sm bg-white/20 px-2 py-0.5 rounded-full">
                      <Music className="w-3 h-3" /> Audio
                    </span>
                  )}
                </div>
              </div>
            </div>
            <span className="text-5xl drop-shadow-lg">{selectedQuiz.category_icon || selectedCategory?.icon}</span>
          </div>
        </div>

        {/* Add Question Form */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-indigo-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 bg-gradient-to-br ${style.bg} rounded-xl flex items-center justify-center shadow-md`}>
                <Plus className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingQuestionId ? 'Edit Question' : 'Add New Question'}
                </h2>
                <p className="text-sm text-gray-500">
                  {supportsImages && supportsAudio
                    ? 'Add text, images, and audio to your question'
                    : supportsImages
                    ? 'Add text and images to your question'
                    : 'Create your question with answer options'}
                </p>
              </div>
            </div>
            {editingQuestionId && (
              <button
                onClick={() => {
                  setEditingQuestionId(null);
                  setQuestionForm({
                    questionText: '',
                    questionImage: '',
                    questionAudio: '',
                    options: [{ id: 'a', text: '', image: '', color: '', shape: '' }, { id: 'b', text: '', image: '', color: '', shape: '' }, { id: 'c', text: '', image: '', color: '', shape: '' }, { id: 'd', text: '', image: '', color: '', shape: '' }],
                    correctAnswer: '',
                    hint: '',
                    explanation: '',
                    points: 10
                  });
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="space-y-5">
            {/* Question Text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Question Text</label>
              <input
                type="text"
                value={questionForm.questionText}
                onChange={e => setQuestionForm(prev => ({ ...prev, questionText: e.target.value }))}
                placeholder={inputConfig?.question_placeholder || 'Enter your question...'}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-lg transition-all"
              />
            </div>

            {/* PROMINENT Media Upload Section */}
            {(supportsImages || supportsAudio) && (
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-5 border-2 border-dashed border-indigo-200">
                <div className="flex items-center gap-3 mb-4">
                  <Upload className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-indigo-900">Add Media to Question</h3>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
                    {selectedCategory?.display_name} supports {supportsImages && supportsAudio ? 'images & audio' : supportsImages ? 'images' : 'audio'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {supportsImages && (
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Image className="w-5 h-5 text-pink-600" />
                        <label className="font-medium text-gray-900">Question Image</label>
                        {questionForm.questionImage && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Uploaded ✓</span>
                        )}
                      </div>
                      <QuizMediaUploader
                        quizId={selectedQuiz.id}
                        allowedTypes="image"
                        onUploadComplete={(url) => setQuestionForm(prev => ({ ...prev, questionImage: url }))}
                        existingUrl={questionForm.questionImage}
                        label={`Upload ${selectedCategory?.name === 'alphabet' ? 'letter image' : selectedCategory?.name === 'geography' ? 'map or flag' : 'image'}`}
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        {selectedCategory?.name === 'alphabet' && 'Upload an image of a letter for kids to identify'}
                        {selectedCategory?.name === 'math' && 'Add visual math problems or diagrams'}
                        {selectedCategory?.name === 'geography' && 'Upload maps, flags, or landmarks'}
                        {selectedCategory?.name === 'science' && 'Add science diagrams or photos'}
                        {selectedCategory?.name === 'colors_shapes' && 'Upload colorful images or shapes'}
                        {selectedCategory?.name === 'language' && 'Add images for word association'}
                        {selectedCategory?.name === 'history' && 'Upload historical photos or portraits'}
                      </p>
                    </div>
                  )}
                  {supportsAudio && (
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Music className="w-5 h-5 text-purple-600" />
                        <label className="font-medium text-gray-900">Question Audio</label>
                        {questionForm.questionAudio && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Uploaded ✓</span>
                        )}
                      </div>
                      <QuizMediaUploader
                        quizId={selectedQuiz.id}
                        allowedTypes="audio"
                        onUploadComplete={(url) => setQuestionForm(prev => ({ ...prev, questionAudio: url }))}
                        existingUrl={questionForm.questionAudio}
                        label={`Upload ${selectedCategory?.name === 'alphabet' ? 'pronunciation' : 'audio'}`}
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        {selectedCategory?.name === 'alphabet' && 'Add audio pronunciation of the letter'}
                        {selectedCategory?.name === 'language' && 'Add word pronunciation or sentences'}
                        {!['alphabet', 'language'].includes(selectedCategory?.name || '') && 'Add audio clues or instructions'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Answer Options Section */}
            <div className="bg-gray-50 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Check className="w-5 h-5 text-green-600" />
                <h3 className="font-bold text-gray-900">Answer Options</h3>
                <span className="text-xs text-gray-500">(Click letter to mark correct answer)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {questionForm.options.map((option, idx) => {
                  const isCorrect = questionForm.correctAnswer === option.id;
                  return (
                    <div
                      key={option.id}
                      className={`relative p-4 rounded-xl border-2 transition-all ${
                        isCorrect
                          ? 'border-green-500 bg-green-50 shadow-md'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      {/* Correct answer badge */}
                      {isCorrect && (
                        <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full shadow">
                          ✓ Correct
                        </div>
                      )}

                      <div className="flex items-start gap-3">
                        {/* Option selector button */}
                        <button
                          type="button"
                          onClick={() => setQuestionForm(prev => ({ ...prev, correctAnswer: option.id }))}
                          className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center font-bold text-lg transition-all flex-shrink-0 ${
                            isCorrect
                              ? 'bg-green-500 border-green-500 text-white shadow-lg'
                              : 'border-gray-300 text-gray-500 hover:border-green-400 hover:text-green-500 bg-white'
                          }`}
                        >
                          {option.id.toUpperCase()}
                        </button>

                        <div className="flex-1 space-y-2">
                          {/* Text input - always shown */}
                          <input
                            type="text"
                            value={option.text}
                            onChange={e => {
                              const newOptions = [...questionForm.options];
                              newOptions[idx] = { ...option, text: e.target.value };
                              setQuestionForm(prev => ({ ...prev, options: newOptions }));
                            }}
                            placeholder={`Answer ${option.id.toUpperCase()} text`}
                            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                          />

                          {/* Color picker for colors_shapes category */}
                          {inputConfig?.color_picker && (
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={option.color || '#3B82F6'}
                                onChange={e => {
                                  const newOptions = [...questionForm.options];
                                  newOptions[idx] = { ...option, color: e.target.value };
                                  setQuestionForm(prev => ({ ...prev, options: newOptions }));
                                }}
                                className="w-10 h-10 rounded-lg cursor-pointer border-2 border-gray-200"
                              />
                              <input
                                type="text"
                                value={option.color || ''}
                                onChange={e => {
                                  const newOptions = [...questionForm.options];
                                  newOptions[idx] = { ...option, color: e.target.value };
                                  setQuestionForm(prev => ({ ...prev, options: newOptions }));
                                }}
                                placeholder="Color name or hex"
                                className="flex-1 px-3 py-1 border rounded-lg text-sm"
                              />
                            </div>
                          )}

                          {/* Shape picker for colors_shapes category */}
                          {inputConfig?.shape_picker && (
                            <select
                              value={option.shape || ''}
                              onChange={e => {
                                const newOptions = [...questionForm.options];
                                newOptions[idx] = { ...option, shape: e.target.value };
                                setQuestionForm(prev => ({ ...prev, options: newOptions }));
                              }}
                              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm"
                            >
                              <option value="">Select a shape...</option>
                              <option value="circle">⬤ Circle</option>
                              <option value="square">◼ Square</option>
                              <option value="triangle">▲ Triangle</option>
                              <option value="star">★ Star</option>
                              <option value="heart">♥ Heart</option>
                              <option value="diamond">◆ Diamond</option>
                              <option value="rectangle">▬ Rectangle</option>
                              <option value="oval">⬭ Oval</option>
                            </select>
                          )}

                          {/* Image upload for option */}
                          {supportsImages && (
                            <div className="mt-2 p-2 bg-gray-100 rounded-lg">
                              <div className="flex items-center gap-1 mb-1">
                                <Image className="w-3 h-3 text-gray-500" />
                                <span className="text-xs text-gray-600">Option image</span>
                                {option.image && <span className="text-xs text-green-600">✓</span>}
                              </div>
                              <QuizMediaUploader
                                quizId={selectedQuiz.id}
                                allowedTypes="image"
                                onUploadComplete={(url) => {
                                  const newOptions = [...questionForm.options];
                                  newOptions[idx] = { ...option, image: url };
                                  setQuestionForm(prev => ({ ...prev, options: newOptions }));
                                }}
                                existingUrl={option.image}
                                label={`Add image`}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hint (optional)</label>
                <input
                  type="text"
                  value={questionForm.hint}
                  onChange={e => setQuestionForm(prev => ({ ...prev, hint: e.target.value }))}
                  placeholder="A helpful clue..."
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Explanation (optional)</label>
                <input
                  type="text"
                  value={questionForm.explanation}
                  onChange={e => setQuestionForm(prev => ({ ...prev, explanation: e.target.value }))}
                  placeholder="Why this is the answer..."
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAddQuestion}
                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
              >
                {editingQuestionId ? 'Update Question' : 'Add Question'}
              </button>
              {editingQuestionId && (
                <button
                  onClick={() => {
                    setEditingQuestionId(null);
                    setQuestionForm({
                      questionText: '',
                      questionImage: '',
                      questionAudio: '',
                      options: [{ id: 'a', text: '', image: '', color: '', shape: '' }, { id: 'b', text: '', image: '', color: '', shape: '' }, { id: 'c', text: '', image: '', color: '', shape: '' }, { id: 'd', text: '', image: '', color: '', shape: '' }],
                      correctAnswer: '',
                      hint: '',
                      explanation: '',
                      points: 10
                    });
                  }}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Existing Questions */}
        {selectedQuiz.questions && selectedQuiz.questions.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Questions ({selectedQuiz.questions.length})</h2>
            <div className="space-y-3">
              {selectedQuiz.questions.map((q, idx) => (
                <div key={q.id} className="p-4 bg-gray-50 rounded-lg border">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-bold text-sm">
                        {idx + 1}
                      </span>
                      <p className="font-medium text-gray-900">{q.question_text}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditQuestion(q)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pl-11">
                    {q.options.map(opt => (
                      <div
                        key={opt.id}
                        className={`px-3 py-1 rounded text-sm ${
                          q.correct_answer === opt.id
                            ? 'bg-green-100 text-green-800 font-medium'
                            : 'bg-white text-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{opt.id.toUpperCase()}:</span>
                          {opt.image && (
                            <img
                              src={opt.image}
                              alt={`Option ${opt.id}`}
                              className="w-8 h-8 rounded-md object-cover border"
                            />
                          )}
                          {opt.color && (
                            <span
                              className="w-4 h-4 rounded-full border"
                              style={{ backgroundColor: opt.color }}
                              title={opt.color}
                            />
                          )}
                          {opt.shape && (
                            <span className="text-xs uppercase tracking-wide text-gray-500">
                              {opt.shape}
                            </span>
                          )}
                          <span>{opt.text || (opt.image ? 'Image' : opt.color ? opt.color : opt.shape ? opt.shape : '')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Done Button */}
        <button
          onClick={() => { setView('list'); resetForms(); loadData(); }}
          className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
        >
          Done - Back to Quiz List
        </button>
      </div>
    );
  }

  return null;
}
