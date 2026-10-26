import React, { useState, useEffect, useMemo } from 'react';
import { GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import type { LearningActivity, SortingContent, SortingCorrect, ActivitySubmissionResult } from '../../types/activities';

interface Props {
  activity: LearningActivity;
  onResponse: (response: any) => void;
  currentResponse: any;
  disabled: boolean;
  showFeedback: boolean;
  feedbackResult: ActivitySubmissionResult | null;
  theme: any;
}

const SortingActivity: React.FC<Props> = ({
  activity,
  onResponse,
  currentResponse,
  disabled,
  showFeedback,
  feedbackResult,
  theme: _theme
}) => {
  const content = activity.content_data as SortingContent;
  const correctData = (feedbackResult?.correctData ?? activity.correct_data ?? {}) as SortingCorrect;
  const originalItems = useMemo(() => content.items || [], [content.items]);
  const responseOrder: string[] | undefined = currentResponse?.order;

  const [items, setItems] = useState<typeof originalItems>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Initialize with shuffled items. Re-running for this component's own
  // reported order restores the same order, so it never reshuffles mid-play.
  useEffect(() => {
    if (responseOrder) {
      // Restore from response
      const ordered = responseOrder.map((id: string) =>
        originalItems.find(item => item.id === id)
      ).filter((item): item is (typeof originalItems)[number] => Boolean(item));
      setItems(ordered);
    } else {
      // Fresh start (mount or next activity): drop any selection from before
      setSelectedIndex(null);
      // Shuffle items
      const shuffled = [...originalItems];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      setItems(shuffled);
    }
  }, [originalItems, responseOrder]);

  const updateOrder = (newItems: typeof items) => {
    setItems(newItems);
    onResponse({ order: newItems.map(item => item.id) });
  };

  const moveUp = (index: number) => {
    if (disabled || index === 0) return;
    const newItems = [...items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    updateOrder(newItems);
  };

  const moveDown = (index: number) => {
    if (disabled || index === items.length - 1) return;
    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    updateOrder(newItems);
  };

  const handleItemClick = (index: number) => {
    if (disabled) return;

    if (selectedIndex === null) {
      setSelectedIndex(index);
    } else if (selectedIndex === index) {
      setSelectedIndex(null);
    } else {
      // Swap items
      const newItems = [...items];
      [newItems[selectedIndex], newItems[index]] = [newItems[index], newItems[selectedIndex]];
      updateOrder(newItems);
      setSelectedIndex(null);
    }
  };

  const isItemCorrect = (index: number): boolean | null => {
    if (!showFeedback) return null;
    const correctOrder = correctData.correctOrder || [];
    return items[index]?.id === correctOrder[index];
  };

  return (
    <div className="space-y-6">
      <p className="text-center text-gray-600 text-sm mb-4">
        {content.instruction || 'Arrange the items in the correct order'}
      </p>

      <div className="space-y-2">
        {items.map((item, index) => {
          const correct = isItemCorrect(index);
          const isSelected = selectedIndex === index;

          return (
            <div
              key={item.id}
              onClick={() => handleItemClick(index)}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                showFeedback
                  ? correct
                    ? 'bg-green-50 border-green-500'
                    : 'bg-red-50 border-red-500'
                  : isSelected
                  ? 'bg-purple-100 border-purple-500 ring-2 ring-purple-300'
                  : 'bg-gray-50 border-gray-200 hover:border-purple-300'
              } ${disabled && !showFeedback ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {/* Position number */}
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                showFeedback
                  ? correct
                    ? 'bg-green-500 text-white'
                    : 'bg-red-500 text-white'
                  : 'bg-purple-200 text-purple-700'
              }`}>
                {index + 1}
              </span>

              {/* Drag handle */}
              <GripVertical className="w-5 h-5 text-gray-400" />

              {/* Item content */}
              <div className="flex-1">
                {item.image && (
                  <img
                    src={item.image}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover mb-2"
                  />
                )}
                <span className="font-medium text-gray-800">{item.text}</span>
              </div>

              {/* Move buttons */}
              {!disabled && !showFeedback && (
                <div className="flex flex-col gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveUp(index);
                    }}
                    disabled={index === 0}
                    className={`p-1 rounded ${
                      index === 0
                        ? 'text-gray-300'
                        : 'text-purple-500 hover:bg-purple-100'
                    }`}
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveDown(index);
                    }}
                    disabled={index === items.length - 1}
                    className={`p-1 rounded ${
                      index === items.length - 1
                        ? 'text-gray-300'
                        : 'text-purple-500 hover:bg-purple-100'
                    }`}
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Feedback icon */}
              {showFeedback && (
                <span className={`text-xl ${correct ? 'text-green-500' : 'text-red-500'}`}>
                  {correct ? '✓' : '✗'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {selectedIndex !== null && !disabled && (
        <p className="text-center text-purple-600 text-sm">
          Tap another item to swap positions
        </p>
      )}

      {showFeedback && (
        <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-medium mb-2">Correct order:</p>
          <ol className="list-decimal list-inside space-y-1">
            {(correctData.correctOrder || []).map((id, i) => {
              const item = originalItems.find(item => item.id === id);
              return (
                <li key={i}>{item?.text || id}</li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
};

export default SortingActivity;
