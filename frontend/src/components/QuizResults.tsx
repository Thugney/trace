import { useState, useEffect } from 'react';
import { schoolAPI } from '../services/api';
import type { QuizResult } from '../types/school';
import { X, CheckCircle, XCircle, Award } from 'lucide-react';

interface QuizResultsProps {
  assignmentId: number;
  studentId: number;
  onClose?: () => void;
}

export default function QuizResults({ assignmentId, studentId, onClose }: QuizResultsProps) {
  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadResults();
  }, [assignmentId, studentId]);

  const loadResults = async () => {
    try {
      setLoading(true);
      const response = await schoolAPI.getQuizResults(assignmentId, studentId);
      setResult(response.data);
    } catch (err) {
      setError('Failed to load quiz results. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="spinner"></div></div>;
  }

  if (error || !result) {
    return <div className="text-red-600 text-center p-4">{error || 'No results found.'}</div>;
  }

  const scorePercentage = Math.round(result.score_percentage);
  const passThreshold = 70; // Assume 70% to pass

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Quiz Results</h2>
        {onClose && (
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        )}
      </div>
      <div className="text-center mb-8">
        <div className="inline-flex items-center space-x-2 mb-2">
          <Award size={48} className={scorePercentage >= passThreshold ? 'text-green-600' : 'text-yellow-600'} />
          <span className="text-5xl font-bold">{scorePercentage}%</span>
        </div>
        <p className="text-gray-600">
          {scorePercentage >= passThreshold ? 'Great job! You passed.' : 'Keep studying! You can do better.'}
        </p>
        <p className="text-sm text-gray-500">
          {result.correct_answers} / {result.total_questions} correct
        </p>
      </div>
      <div className="space-y-4">
        {result.answers.map((answer, index) => (
          <div key={answer.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold">Question {index + 1}</h3>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  answer.is_correct ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {answer.is_correct ? 'Correct' : 'Incorrect'}
                </span>
                {answer.is_correct ? (
                  <CheckCircle size={20} className="text-green-600" />
                ) : (
                  <XCircle size={20} className="text-red-600" />
                )}
              </div>
            </div>
            <p className="text-gray-700 mb-3">{answer.question.question}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div>
                <strong>Your Answer:</strong> {answer.selected_option}
              </div>
              <div>
                <strong>Correct Answer:</strong> {answer.question.correct_option}
              </div>
            </div>
            {!answer.is_correct && (
              <div className="mt-3 p-3 bg-yellow-50 rounded border-l-4 border-yellow-400">
                <p className="text-sm text-yellow-800">
                  Explanation: The correct answer is {answer.question.correct_option}. {answer.question[`option_${answer.question.correct_option.toLowerCase()}` as keyof typeof answer.question]}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}