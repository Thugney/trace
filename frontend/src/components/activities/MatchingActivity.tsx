import React, { useState, useEffect, useMemo } from 'react';
import type { LearningActivity, MatchingContent, MatchingCorrect, ActivitySubmissionResult } from '../../types/activities';

interface Props {
  activity: LearningActivity;
  onResponse: (response: any) => void;
  currentResponse: any;
  disabled: boolean;
  showFeedback: boolean;
  feedbackResult: ActivitySubmissionResult | null;
  theme: any;
}

const MatchingActivity: React.FC<Props> = ({
  activity,
  onResponse,
  currentResponse,
  disabled,
  showFeedback,
  feedbackResult: _feedbackResult,
  theme: _theme
}) => {
  const content = activity.content_data as MatchingContent;
  const correctData = activity.correct_data as MatchingCorrect;
  // Keyed by content, so a parent passing an equal copy of the activity keeps the board.
  const pairsSignature = JSON.stringify(content.pairs || []);
  const pairs = useMemo(
    () => JSON.parse(pairsSignature) as MatchingContent['pairs'],
    [pairsSignature]
  );
  const activityId = activity.id;

  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matches, setMatches] = useState<Record<number, number>>({});
  const [shuffledRight, setShuffledRight] = useState<number[]>([]);

  // Shuffle right side items and start unmatched. A different activity starts
  // fresh: the parent reuses this instance, so matches and the selection must
  // not carry over. A saved response is restored by the effect below, which
  // runs after this one.
  useEffect(() => {
    const indices = pairs.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setShuffledRight(indices);
    setMatches({});
    setSelectedLeft(null);
  }, [activityId, pairs]);

  // Restore matches from response
  useEffect(() => {
    if (currentResponse?.matches) {
      setMatches(currentResponse.matches);
    }
  }, [currentResponse]);

  const handleLeftClick = (index: number) => {
    if (disabled) return;
    // If already matched, unselect
    if (matches[index] !== undefined) {
      const newMatches = { ...matches };
      delete newMatches[index];
      setMatches(newMatches);
      onResponse({ matches: newMatches });
      return;
    }
    setSelectedLeft(index);
  };

  const handleRightClick = (rightIndex: number) => {
    if (disabled || selectedLeft === null) return;

    // Check if this right item is already matched
    const existingMatch = Object.entries(matches).find(([_, r]) => r === rightIndex);
    if (existingMatch) {
      // Remove existing match
      const newMatches = { ...matches };
      delete newMatches[Number(existingMatch[0])];
      newMatches[selectedLeft] = rightIndex;
      setMatches(newMatches);
      onResponse({ matches: newMatches });
    } else {
      const newMatches = { ...matches, [selectedLeft]: rightIndex };
      setMatches(newMatches);
      onResponse({ matches: newMatches });
    }
    setSelectedLeft(null);
  };

  const isMatchCorrect = (leftIndex: number): boolean | null => {
    if (!showFeedback || matches[leftIndex] === undefined) return null;
    const correctPairs = correctData.correctPairs || {};
    return correctPairs[leftIndex] === matches[leftIndex];
  };

  const getMatchColor = (leftIndex: number): string => {
    const colors = [
      'bg-purple-200 border-purple-400',
      'bg-blue-200 border-blue-400',
      'bg-green-200 border-green-400',
      'bg-yellow-200 border-yellow-400',
      'bg-pink-200 border-pink-400',
      'bg-orange-200 border-orange-400',
    ];
    return colors[leftIndex % colors.length];
  };

  return (
    <div className="space-y-6">
      <p className="text-center text-gray-600 text-sm mb-4">
        Tap an item on the left, then tap its match on the right
      </p>

      <div className="grid grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-3">
          {pairs.map((pair, i) => {
            const isMatched = matches[i] !== undefined;
            const isSelected = selectedLeft === i;
            const correct = isMatchCorrect(i);

            return (
              <button
                key={`left-${i}`}
                onClick={() => handleLeftClick(i)}
                disabled={disabled}
                className={`w-full p-4 rounded-xl text-left transition-all border-2 ${
                  showFeedback && isMatched
                    ? correct
                      ? 'bg-green-100 border-green-500'
                      : 'bg-red-100 border-red-500'
                    : isMatched
                    ? getMatchColor(i)
                    : isSelected
                    ? 'bg-purple-100 border-purple-500 ring-2 ring-purple-300'
                    : 'bg-gray-50 border-gray-200 hover:border-purple-300'
                } ${disabled && !showFeedback ? 'opacity-50' : ''}`}
              >
                {pair.leftImage && (
                  <img
                    src={pair.leftImage}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover mb-2"
                  />
                )}
                <span className="font-medium">{pair.left}</span>
                {isMatched && !showFeedback && (
                  <span className="ml-2 text-xs text-gray-500">✓ matched</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right column (shuffled) */}
        <div className="space-y-3">
          {shuffledRight.map((originalIndex) => {
            const pair = pairs[originalIndex];
            // The order can still be the previous, longer activity's until the
            // reshuffle above runs
            if (!pair) return null;
            // Find if this right item is matched
            const matchedLeftIndex = Object.entries(matches).find(
              ([_, r]) => r === originalIndex
            )?.[0];
            const isMatched = matchedLeftIndex !== undefined;

            return (
              <button
                key={`right-${originalIndex}`}
                onClick={() => handleRightClick(originalIndex)}
                disabled={disabled || selectedLeft === null}
                className={`w-full p-4 rounded-xl text-left transition-all border-2 ${
                  isMatched
                    ? getMatchColor(Number(matchedLeftIndex))
                    : selectedLeft !== null
                    ? 'bg-purple-50 border-purple-300 hover:bg-purple-100'
                    : 'bg-gray-50 border-gray-200'
                } ${disabled && !showFeedback ? 'opacity-50' : ''} ${
                  selectedLeft === null && !isMatched ? 'opacity-70' : ''
                }`}
              >
                {pair.rightImage && (
                  <img
                    src={pair.rightImage}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover mb-2"
                  />
                )}
                <span className="font-medium">{pair.right}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Progress */}
      <div className="text-center text-sm text-gray-500">
        {Object.keys(matches).length} of {pairs.length} matched
      </div>

      {showFeedback && (
        <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-medium mb-2">Correct matches:</p>
          <ul className="space-y-1">
            {pairs.map((pair, i) => (
              <li key={i}>
                <strong>{pair.left}</strong> → {pair.right}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MatchingActivity;
