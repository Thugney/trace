import React, { useState, useEffect } from 'react';
import type { LearningActivity, FillBlanksContent, FillBlanksCorrect, ActivitySubmissionResult } from '../../types/activities';

interface Props {
  activity: LearningActivity;
  onResponse: (response: any) => void;
  currentResponse: any;
  disabled: boolean;
  showFeedback: boolean;
  feedbackResult: ActivitySubmissionResult | null;
  theme: any;
}

const FillBlanksActivity: React.FC<Props> = ({
  activity,
  onResponse,
  currentResponse,
  disabled,
  showFeedback,
  feedbackResult: _feedbackResult,
  theme: _theme
}) => {
  const content = activity.content_data as FillBlanksContent;
  const correctData = activity.correct_data as FillBlanksCorrect;
  const [answers, setAnswers] = useState<string[]>([]);

  // Count blanks in sentences
  const blankCount = (content.sentences || []).reduce((count, sentence) => {
    return count + (sentence.match(/___/g) || []).length;
  }, 0);

  useEffect(() => {
    setAnswers(prev => (prev.length !== blankCount ? new Array(blankCount).fill('') : prev));
  }, [blankCount]);

  useEffect(() => {
    if (currentResponse?.answers) {
      setAnswers(currentResponse.answers);
    }
  }, [currentResponse]);

  const handleChange = (index: number, value: string) => {
    if (disabled) return;
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
    onResponse({ answers: newAnswers });
  };

  const isBlankCorrect = (index: number): boolean | null => {
    if (!showFeedback || !correctData.blanks?.[index]) return null;
    const userAnswer = (answers[index] || '').toLowerCase().trim();
    const correctAnswer = correctData.blanks[index].answer.toLowerCase().trim();
    const alternatives = (correctData.blanks[index].acceptAlternatives || [])
      .map(a => a.toLowerCase().trim());
    return userAnswer === correctAnswer || alternatives.includes(userAnswer);
  };

  // Render sentence with input fields
  const renderSentence = (sentence: string, startIndex: number) => {
    const parts = sentence.split('___');
    let blankIndex = startIndex;

    return parts.map((part, i) => (
      <React.Fragment key={i}>
        <span>{part}</span>
        {i < parts.length - 1 && (
          <input
            type="text"
            value={answers[blankIndex] || ''}
            onChange={(e) => handleChange(blankIndex++, e.target.value)}
            disabled={disabled}
            className={`mx-1 px-3 py-1 w-32 border-b-2 text-center font-medium transition-all outline-none ${
              showFeedback
                ? isBlankCorrect(blankIndex - 1)
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-red-500 bg-red-50 text-red-700'
                : 'border-purple-400 focus:border-purple-600 bg-purple-50'
            } ${disabled && !showFeedback ? 'opacity-50' : ''}`}
            placeholder="..."
          />
        )}
      </React.Fragment>
    ));
  };

  let globalBlankIndex = 0;

  return (
    <div className="space-y-6">
      {(content.sentences || []).map((sentence, i) => {
        const blanksInSentence = (sentence.match(/___/g) || []).length;
        const startIndex = globalBlankIndex;
        globalBlankIndex += blanksInSentence;

        return (
          <div key={i} className="bg-gray-50 rounded-xl p-4 text-lg leading-relaxed">
            {renderSentence(sentence, startIndex)}
          </div>
        );
      })}

      {showFeedback && (
        <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-medium mb-2">Correct answers:</p>
          <ul className="list-disc list-inside">
            {(correctData.blanks || []).map((blank, i) => (
              <li key={i}>{blank.answer}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FillBlanksActivity;
