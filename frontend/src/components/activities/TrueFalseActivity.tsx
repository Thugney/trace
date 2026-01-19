import React from 'react';
import { Check, X } from 'lucide-react';
import type { LearningActivity, TrueFalseContent, ActivitySubmissionResult } from '../../types/activities';

interface Props {
  activity: LearningActivity;
  onResponse: (response: any) => void;
  currentResponse: any;
  disabled: boolean;
  showFeedback: boolean;
  feedbackResult: ActivitySubmissionResult | null;
  theme: any;
}

const TrueFalseActivity: React.FC<Props> = ({
  activity,
  onResponse,
  currentResponse,
  disabled,
  showFeedback,
  feedbackResult: _feedbackResult,
  theme: _theme
}) => {
  const content = activity.content_data as TrueFalseContent;
  const statement = content.statements?.[0];

  if (!statement) {
    return <div>No statement available</div>;
  }

  const handleSelect = (answer: boolean) => {
    if (disabled) return;
    onResponse({ answer });
  };

  return (
    <div className="space-y-6">
      {/* Statement */}
      <div className="bg-gray-50 rounded-2xl p-6 text-center">
        <p className="text-xl font-medium text-gray-800">{statement.text}</p>
      </div>

      {/* True/False Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => handleSelect(true)}
          disabled={disabled}
          className={`p-6 rounded-2xl flex flex-col items-center gap-2 transition-all ${
            showFeedback && statement.isTrue
              ? 'bg-green-100 border-2 border-green-500'
              : showFeedback && currentResponse?.answer === true && !statement.isTrue
              ? 'bg-red-100 border-2 border-red-500'
              : currentResponse?.answer === true
              ? 'bg-green-100 border-2 border-green-400'
              : 'bg-gray-50 border-2 border-gray-200 hover:border-green-300 hover:bg-green-50'
          } ${disabled && !showFeedback ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            showFeedback && statement.isTrue
              ? 'bg-green-500'
              : currentResponse?.answer === true
              ? 'bg-green-400'
              : 'bg-green-200'
          }`}>
            <Check className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-lg text-gray-700">TRUE</span>
        </button>

        <button
          onClick={() => handleSelect(false)}
          disabled={disabled}
          className={`p-6 rounded-2xl flex flex-col items-center gap-2 transition-all ${
            showFeedback && !statement.isTrue
              ? 'bg-green-100 border-2 border-green-500'
              : showFeedback && currentResponse?.answer === false && statement.isTrue
              ? 'bg-red-100 border-2 border-red-500'
              : currentResponse?.answer === false
              ? 'bg-red-100 border-2 border-red-400'
              : 'bg-gray-50 border-2 border-gray-200 hover:border-red-300 hover:bg-red-50'
          } ${disabled && !showFeedback ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            showFeedback && !statement.isTrue
              ? 'bg-green-500'
              : currentResponse?.answer === false
              ? 'bg-red-400'
              : 'bg-red-200'
          }`}>
            <X className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-lg text-gray-700">FALSE</span>
        </button>
      </div>
    </div>
  );
};

export default TrueFalseActivity;
