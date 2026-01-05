import { useState, useEffect } from 'react';
import { schoolAPI } from '../services/api';
import type { QuizQuestion, QuizSubmission } from '../types/school';
import { X, Send, Star, Award } from 'lucide-react';

interface QuizResult {
  score: number;
  correct: number;
  total: number;
  points_awarded?: number;
  new_achievements?: Array<{ name: string; icon: string; points: number }>;
}

interface StudentQuizViewProps {
  assignmentId: number;
  studentId: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function StudentQuizView({ assignmentId, studentId, onSuccess, onCancel }: StudentQuizViewProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, 'a' | 'b' | 'c' | 'd' | ''>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);

  useEffect(() => {
    loadQuiz();
  }, [assignmentId]);

  const loadQuiz = async () => {
    try {
      setLoading(true);
      const response = await schoolAPI.getQuiz(assignmentId);
      setQuestions(response.data);
      // Initialize answers
      const initialAnswers: Record<number, 'a' | 'b' | 'c' | 'd' | ''> = {};
      response.data.forEach((q: QuizQuestion) => {
        initialAnswers[q.id] = '';
      });
      setAnswers(initialAnswers);
    } catch (err) {
      setError('Failed to load quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateAnswer = (questionId: number, option: 'a' | 'b' | 'c' | 'd') => {
    setAnswers({ ...answers, [questionId]: option });
  };

  const validateAnswers = () => {
    for (const q of questions) {
      if (!answers[q.id]) {
        return `Please answer question ${questions.indexOf(q) + 1}.`;
      }
    }
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateAnswers();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const submission: QuizSubmission = {
        assignment_id: assignmentId,
        student_id: studentId,
        answers: questions.filter((q: QuizQuestion) => answers[q.id] !== '').map((q: QuizQuestion) => ({
          question_id: q.id,
          selected_answer: answers[q.id] as 'a' | 'b' | 'c' | 'd'
        }))
      };
      const response = await schoolAPI.submitQuiz(submission);
      setQuizResult(response.data as QuizResult);
    } catch (err) {
      setError('Failed to submit quiz. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Results screen after quiz submission
  if (quizResult) {
    const isPerfect = quizResult.score === 100;
    const isGreat = quizResult.score >= 80;
    const isGood = quizResult.score >= 60;

    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg mx-auto text-center">
        {/* Score Display */}
        <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center mb-6 ${
          isPerfect ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
          isGreat ? 'bg-gradient-to-br from-green-400 to-emerald-500' :
          isGood ? 'bg-gradient-to-br from-blue-400 to-indigo-500' :
          'bg-gradient-to-br from-gray-400 to-slate-500'
        }`}>
          <div className="text-white">
            <div className="text-4xl font-bold">{quizResult.score}%</div>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-2">
          {isPerfect ? '🎉 Perfect Score!' :
           isGreat ? '🌟 Great Job!' :
           isGood ? '👍 Good Work!' :
           '💪 Keep Practicing!'}
        </h2>

        <p className="text-gray-600 mb-6">
          You got {quizResult.correct} out of {quizResult.total} questions correct
        </p>

        {/* Points Awarded */}
        {quizResult.points_awarded && quizResult.points_awarded > 0 && (
          <div className="bg-indigo-50 rounded-xl p-4 mb-4 flex items-center justify-center gap-3">
            <Star className="text-indigo-600" size={24} />
            <span className="text-lg font-semibold text-indigo-700">
              +{quizResult.points_awarded} Points Earned!
            </span>
          </div>
        )}

        {/* New Achievements */}
        {quizResult.new_achievements && quizResult.new_achievements.length > 0 && (
          <div className="bg-amber-50 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Award className="text-amber-600" size={24} />
              <span className="font-semibold text-amber-700">New Achievement{quizResult.new_achievements.length > 1 ? 's' : ''}!</span>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {quizResult.new_achievements.map((ach, idx) => (
                <div key={idx} className="bg-white rounded-lg px-3 py-2 shadow-sm flex items-center gap-2">
                  <span className="text-2xl">{ach.icon}</span>
                  <div className="text-left">
                    <div className="font-medium text-sm">{ach.name}</div>
                    <div className="text-xs text-amber-600">+{ach.points} pts</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onSuccess}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-colors"
        >
          Continue
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl">
        <div className="spinner mb-4"></div>
        <p className="text-indigo-600 font-medium">Loading your quiz...</p>
      </div>
    );
  }

  if (error && questions.length === 0) {
    return (
      <div className="bg-red-50 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-4">😕</div>
        <p className="text-red-600 font-medium">{error}</p>
        <button onClick={onCancel} className="mt-4 text-red-500 hover:text-red-700">Go Back</button>
      </div>
    );
  }

  // Calculate progress
  const answeredCount = Object.values(answers).filter(a => a !== '').length;
  const progressPercent = (answeredCount / questions.length) * 100;

  // Option colors for visual variety
  const optionColors = {
    a: { bg: 'bg-blue-50 hover:bg-blue-100 border-blue-200', selected: 'bg-blue-500 border-blue-500 text-white', ring: 'ring-blue-500' },
    b: { bg: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200', selected: 'bg-emerald-500 border-emerald-500 text-white', ring: 'ring-emerald-500' },
    c: { bg: 'bg-amber-50 hover:bg-amber-100 border-amber-200', selected: 'bg-amber-500 border-amber-500 text-white', ring: 'ring-amber-500' },
    d: { bg: 'bg-purple-50 hover:bg-purple-100 border-purple-200', selected: 'bg-purple-500 border-purple-500 text-white', ring: 'ring-purple-500' }
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 to-indigo-50 rounded-2xl shadow-xl overflow-hidden max-w-3xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📝</span>
            <h2 className="text-2xl font-bold">Quiz Time!</h2>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{answeredCount} of {questions.length} answered</span>
          </div>
          <div className="h-3 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Questions */}
      <form onSubmit={handleSubmit} className="p-6 space-y-8">
        {questions.map((question, index) => (
          <div
            key={question.id}
            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100"
          >
            {/* Question header */}
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
                {index + 1}
              </div>
              <p className="text-lg text-slate-800 font-medium leading-relaxed pt-1">
                {question.question_text}
              </p>
            </div>

            {/* Answer options */}
            <div className="grid gap-3 sm:grid-cols-2">
              {(['a', 'b', 'c', 'd'] as const).map((option) => {
                const optionKey = `option_${option}` as keyof QuizQuestion;
                const optionText = question[optionKey] as string | null;
                const isSelected = answers[question.id] === option;
                const colors = optionColors[option];

                if (!optionText) return null;

                return (
                  <label
                    key={option}
                    className={`
                      relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer
                      transition-all duration-200 transform hover:scale-[1.02]
                      ${isSelected ? colors.selected : colors.bg}
                      ${isSelected ? 'ring-2 ring-offset-2 ' + colors.ring : ''}
                    `}
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={option}
                      checked={isSelected}
                      onChange={() => updateAnswer(question.id, option)}
                      className="sr-only"
                      required
                    />
                    <span className={`
                      w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0
                      ${isSelected ? 'bg-white/30' : 'bg-white border-2 border-current'}
                    `}>
                      {option.toUpperCase()}
                    </span>
                    <span className="font-medium">{optionText}</span>
                    {isSelected && (
                      <span className="absolute right-3 text-xl">✓</span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        ))}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-4 px-6 text-slate-600 hover:text-slate-800 bg-white border-2 border-slate-200 hover:border-slate-300 rounded-xl font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || answeredCount < questions.length}
            className={`
              flex-1 py-4 px-6 rounded-xl font-bold text-lg transition-all
              flex items-center justify-center gap-3
              ${answeredCount === questions.length
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/30'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }
            `}
          >
            {submitting ? (
              <>
                <div className="spinner !w-5 !h-5 !border-white !border-t-transparent"></div>
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Send size={22} />
                <span>Submit Quiz</span>
              </>
            )}
          </button>
        </div>

        {answeredCount < questions.length && (
          <p className="text-center text-sm text-slate-500">
            Answer all questions to submit ({questions.length - answeredCount} remaining)
          </p>
        )}
      </form>
    </div>
  );
}