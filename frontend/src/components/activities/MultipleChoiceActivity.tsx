import React from 'react';
import type { LearningActivity, MultipleChoiceContent, ActivitySubmissionResult } from '../../types/activities';

interface Props {
  activity: LearningActivity;
  onResponse: (response: any) => void;
  currentResponse: any;
  disabled: boolean;
  showFeedback: boolean;
  feedbackResult: ActivitySubmissionResult | null;
  theme: any;
}

const MultipleChoiceActivity: React.FC<Props> = ({
  activity,
  onResponse,
  currentResponse,
  disabled,
  showFeedback,
  feedbackResult,
  theme: _theme
}) => {
  const content = activity.content_data as MultipleChoiceContent;
  const correctData = (feedbackResult?.correctData ?? activity.correct_data ?? {}) as { correctAnswer?: string };

  const handleSelect = (optionId: string) => {
    if (disabled) return;
    onResponse({ answer: optionId });
  };

  return (
    <div className="space-y-4">
      {/* Question */}
      <div className="text-lg font-medium text-gray-800 mb-4">
        {content.question}
      </div>

      {/* Options */}
      <div className="space-y-3">
        {content.options.map((option) => {
          const isSelected = currentResponse?.answer === option.id;
          const isCorrect = showFeedback && option.id === correctData.correctAnswer;
          const isWrong = showFeedback && isSelected && !isCorrect;

          return (
            <button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              disabled={disabled}
              className={`w-full p-4 rounded-xl text-left transition-all flex items-center gap-4 ${
                isCorrect
                  ? 'bg-green-100 border-2 border-green-500 text-green-800'
                  : isWrong
                  ? 'bg-red-100 border-2 border-red-500 text-red-800'
                  : isSelected
                  ? 'bg-purple-100 border-2 border-purple-500 text-purple-800'
                  : 'bg-gray-50 border-2 border-gray-200 hover:border-purple-300 hover:bg-purple-50'
              } ${disabled && !showFeedback ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {/* Option Letter */}
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                isCorrect
                  ? 'bg-green-500 text-white'
                  : isWrong
                  ? 'bg-red-500 text-white'
                  : isSelected
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {option.id.toUpperCase()}
              </span>

              {/* Option Content */}
              <div className="flex-1">
                {option.image && (
                  <img
                    src={option.image}
                    alt={option.text}
                    className="w-16 h-16 rounded-lg object-cover mb-2"
                  />
                )}
                <span className="text-base">{option.text}</span>
              </div>

              {/* Feedback Icon */}
              {showFeedback && isCorrect && (
                <span className="text-green-600 text-xl">✓</span>
              )}
              {showFeedback && isWrong && (
                <span className="text-red-600 text-xl">✗</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MultipleChoiceActivity;
