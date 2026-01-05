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
  const timeLeft = 0; // Optional timer, set to 0 if no timer

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
    return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>;
  }

  if (error && questions.length === 0) {
    return <div className="text-red-600 text-center p-4">{error}</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Take Quiz</h2>
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
          <X size={24} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        {questions.map((question, index) => (
          <div key={question.id} className="border border-gray-200 rounded-lg p-4 space-y-4">
            <h3 className="font-semibold text-gray-900">Question {index + 1}</h3>
            <p className="text-gray-700 mb-4">{question.question_text}</p>
            <div className="space-y-2">
              {(['a', 'b', 'c', 'd'] as const).map((option) => {
                const optionKey = `option_${option}` as keyof QuizQuestion;
                const optionText = question[optionKey] as string | null;

                if (!optionText) return null;

                return (
                  <label key={option} className="flex items-center space-x-3 p-3 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={option}
                      checked={answers[question.id] === option}
                      onChange={() => updateAnswer(question.id, option)}
                      className="rounded"
                      required
                    />
                    <span className="text-sm">{option.toUpperCase()}. {optionText}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Send size={20} />
            <span>{submitting ? 'Submitting...' : 'Submit Quiz'}</span>
          </button>
        </div>
      </form>
      {timeLeft > 0 && (
        <div className="mt-4 text-center text-sm text-gray-500">
          Time left: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </div>
      )}
    </div>
  );
}