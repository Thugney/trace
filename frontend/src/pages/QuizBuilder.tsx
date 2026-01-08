import { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { familyQuizzesAPI, profilesAPI, type QuizCategory, type FamilyQuiz, type QuizQuestion, type QuizOption } from '../services/api';
import { useToast } from '../components/Toast';

interface QuizWithQuestions extends FamilyQuiz {
  questions: QuizQuestion[];
  theme_config?: any;
  input_config?: any;
}

export default function QuizBuilder() {
  const { currentProfile } = useProfile();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<QuizCategory[]>([]);
  const [quizzes, setQuizzes] = useState<FamilyQuiz[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

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
    options: [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }] as QuizOption[],
    correctAnswer: '',
    hint: '',
    explanation: '',
    points: 10
  });
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);

  useEffect(() => {
    if (currentProfile?.id) {
      loadData();
    }
  }, [currentProfile]);

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

  const handleAddQuestion = async () => {
    if (!selectedQuiz) return;
    if (!questionForm.questionText || !questionForm.correctAnswer) {
      showToast('Please enter question text and select correct answer', 'error');
      return;
    }
    if (questionForm.options.some(o => !o.text.trim())) {
      showToast('Please fill in all options', 'error');
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
        options: [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }],
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
      options: question.options,
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
      options: [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }],
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
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quiz Builder</h1>
            <p className="text-gray-600">Create educational quizzes for your kids</p>
          </div>
          <button
            onClick={() => { resetForms(); setView('create'); }}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
          >
            <span className="text-xl">+</span> Create Quiz
          </button>
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
        <div className="flex items-center gap-4">
          <button onClick={() => { setView('list'); resetForms(); }} className="p-2 hover:bg-gray-100 rounded-lg">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Create New Quiz</h1>
        </div>

        {/* Step 1: Select Category */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">1. Choose a Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {categories.map(cat => {
              const isSelected = selectedCategory?.id === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-4xl mb-2">{cat.icon}</div>
                  <div className="font-medium text-gray-900">{cat.display_name}</div>
                  <div className="text-xs text-gray-500">{cat.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Quiz Details */}
        {selectedCategory && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">2. Quiz Details</h2>

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
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => { setView('list'); resetForms(); }} className="p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{selectedQuiz.title}</h1>
              <p className="text-gray-600">{selectedQuiz.questions?.length || 0} questions</p>
            </div>
          </div>
          <span className="text-4xl">{selectedQuiz.category_icon || selectedCategory?.icon}</span>
        </div>

        {/* Add Question Form */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingQuestionId ? 'Edit Question' : 'Add New Question'}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
              <input
                type="text"
                value={questionForm.questionText}
                onChange={e => setQuestionForm(prev => ({ ...prev, questionText: e.target.value }))}
                placeholder={selectedCategory?.input_config?.question_placeholder || 'Enter your question...'}
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 text-lg"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {questionForm.options.map((option, idx) => (
                <div key={option.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuestionForm(prev => ({ ...prev, correctAnswer: option.id }))}
                    className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold transition-all ${
                      questionForm.correctAnswer === option.id
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 text-gray-500 hover:border-green-400'
                    }`}
                  >
                    {option.id.toUpperCase()}
                  </button>
                  <input
                    type="text"
                    value={option.text}
                    onChange={e => {
                      const newOptions = [...questionForm.options];
                      newOptions[idx] = { ...option, text: e.target.value };
                      setQuestionForm(prev => ({ ...prev, options: newOptions }));
                    }}
                    placeholder={`Option ${option.id.toUpperCase()}`}
                    className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-500">Click the letter circle to mark the correct answer</p>

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
                      options: [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }],
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
                        <span className="font-semibold">{opt.id.toUpperCase()}:</span> {opt.text}
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
