import { useState, useEffect } from 'react';
import { schoolAPI } from '../services/api';
import type { QuizQuestion, QuizSubmission } from '../types/school';
import { X, Send } from 'lucide-react';

interface StudentQuizViewProps {
  assignmentId: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function StudentQuizView({ assignmentId, onSuccess, onCancel }: StudentQuizViewProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, 'A' | 'B' | 'C' | 'D' | ''>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
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
      const initialAnswers: Record<number, 'A' | 'B' | 'C' | 'D' | ''> = {};
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

  const updateAnswer = (questionId: number, option: 'A' | 'B' | 'C' | 'D') => {
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
        student_id: parseInt(localStorage.getItem('currentProfileId') || '0'), // Assume profile ID in localStorage
        answers: questions.filter((q: QuizQuestion) => answers[q.id] !== '').map((q: QuizQuestion) => ({ question_id: q.id, selected_option: answers[q.id] }))
      };
      await schoolAPI.submitQuiz(submission);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError('Failed to submit quiz. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>;
  }

  if (error) {
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
            <p className="text-gray-700 mb-4">{question.question}</p>
            <div className="space-y-2">
              {(['A', 'B', 'C', 'D'] as const).map((option) => {
                const optionText = question[`option_${option.toLowerCase()}` as keyof QuizQuestion] as string;
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
                    <span className="text-sm">{option}. {optionText}</span>
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