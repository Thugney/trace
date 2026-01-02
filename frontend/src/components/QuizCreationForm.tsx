import React, { useState } from 'react';
import { schoolAPI } from '../services/api';
import type { QuizQuestion } from '../types/school';
import { X, Plus, Save } from 'lucide-react';

interface QuizCreationFormProps {
  assignmentId: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function QuizCreationForm({ assignmentId, onSuccess, onCancel }: QuizCreationFormProps) {
  const [questions, setQuestions] = useState<Omit<QuizQuestion, 'id' | 'assignment_id' | 'created_at'>[]>([
    { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'a' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addQuestion = () => {
    setQuestions([...questions, { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'a' }]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const updateQuestion = (index: number, field: keyof Omit<QuizQuestion, 'id' | 'assignment_id' | 'created_at'>, value: string) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], [field]: value };
    setQuestions(newQuestions);
  };

  const updateCorrectAnswer = (index: number, correct_answer: 'a' | 'b' | 'c' | 'd') => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], correct_answer };
    setQuestions(newQuestions);
  };

  const validateQuestions = () => {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim() || !q.option_a.trim() || !q.option_b.trim()) {
        return `Question ${i + 1} is incomplete. At least questions and options A and B are required.`;
      }
    }
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateQuestions();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await schoolAPI.createQuiz(assignmentId, questions);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError('Failed to create quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Create Quiz</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        {questions.map((question, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Question {index + 1}</h3>
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeQuestion(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X size={20} />
                </button>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
              <textarea
                value={question.question_text}
                onChange={(e) => updateQuestion(index, 'question_text', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Enter the question here..."
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['option_a', 'option_b', 'option_c', 'option_d'] as const).map((option) => (
                <div key={option}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Option {option.split('_')[1].toUpperCase()}{option === 'option_a' || option === 'option_b' ? ' *' : ''}
                  </label>
                  <input
                    type="text"
                    value={question[option] || ''}
                    onChange={(e) => updateQuestion(index, option, e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Enter option ${option.split('_')[1].toUpperCase()}...`}
                    required={option === 'option_a' || option === 'option_b'}
                  />
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correct Answer</label>
              <div className="flex space-x-4">
                {(['a', 'b', 'c', 'd'] as const).map((opt) => (
                  <label key={opt} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      value={opt}
                      checked={question.correct_answer === opt}
                      onChange={() => updateCorrectAnswer(index, opt)}
                      className="rounded"
                      required
                    />
                    <span>{opt.toUpperCase()}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ))}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={addQuestion}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
          >
            <Plus size={20} />
            <span>Add Question</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          <Save size={20} />
          <span>{loading ? 'Creating...' : 'Create Quiz'}</span>
        </button>
      </form>
    </div>
  );
}
