import React, { useState, useEffect } from 'react';
import { Calculator } from 'lucide-react';
import type { LearningActivity, ArithmeticContent, ActivitySubmissionResult } from '../../types/activities';

interface Props {
  activity: LearningActivity;
  onResponse: (response: any) => void;
  currentResponse: any;
  disabled: boolean;
  showFeedback: boolean;
  feedbackResult: ActivitySubmissionResult | null;
  theme: any;
}

const ArithmeticActivity: React.FC<Props> = ({
  activity,
  onResponse,
  currentResponse,
  disabled,
  showFeedback,
  feedbackResult: _feedbackResult,
  theme: _theme
}) => {
  const content = activity.content_data as ArithmeticContent;
  const problems = content.problems || [];
  const [answers, setAnswers] = useState<string[]>([]);

  useEffect(() => {
    setAnswers(prev => (prev.length !== problems.length ? new Array(problems.length).fill('') : prev));
  }, [problems.length]);

  useEffect(() => {
    if (currentResponse?.answers) {
      setAnswers(currentResponse.answers.map((a: any) => String(a)));
    }
  }, [currentResponse]);

  const handleChange = (index: number, value: string) => {
    if (disabled) return;
    // Only allow numbers and negative sign
    if (value !== '' && !/^-?\d*\.?\d*$/.test(value)) return;

    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
    onResponse({ answers: newAnswers });
  };

  const isCorrect = (index: number): boolean | null => {
    if (!showFeedback) return null;
    const userAnswer = parseFloat(answers[index]);
    return userAnswer === problems[index]?.answer;
  };

  return (
    <div className="space-y-6">
      {content.allowCalculator && (
        <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 px-4 py-2 rounded-lg">
          <Calculator className="w-4 h-4" />
          Calculator allowed
        </div>
      )}

      <div className="space-y-4">
        {problems.map((problem, i) => (
          <div
            key={i}
            className={`bg-gray-50 rounded-2xl p-6 flex items-center justify-between ${
              showFeedback
                ? isCorrect(i)
                  ? 'bg-green-50 border-2 border-green-300'
                  : 'bg-red-50 border-2 border-red-300'
                : ''
            }`}
          >
            {/* Expression */}
            <div className="text-3xl font-mono font-bold text-gray-800">
              {problem.expression} =
            </div>

            {/* Input */}
            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="numeric"
                value={answers[i] || ''}
                onChange={(e) => handleChange(i, e.target.value)}
                disabled={disabled}
                placeholder="?"
                className={`w-24 h-14 text-center text-2xl font-bold rounded-xl border-2 outline-none transition-all ${
                  showFeedback
                    ? isCorrect(i)
                      ? 'border-green-500 bg-green-100 text-green-700'
                      : 'border-red-500 bg-red-100 text-red-700'
                    : 'border-purple-300 focus:border-purple-500 bg-white'
                } ${disabled && !showFeedback ? 'opacity-50' : ''}`}
              />

              {showFeedback && (
                <span className={`text-2xl ${isCorrect(i) ? 'text-green-500' : 'text-red-500'}`}>
                  {isCorrect(i) ? '✓' : '✗'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {showFeedback && (
        <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-medium mb-2">Answers:</p>
          <div className="flex flex-wrap gap-3">
            {problems.map((problem, i) => (
              <span key={i} className="bg-blue-100 px-3 py-1 rounded-lg">
                {problem.expression} = <strong>{problem.answer}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ArithmeticActivity;
