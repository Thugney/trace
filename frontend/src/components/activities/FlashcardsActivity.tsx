import React, { useState, useEffect } from 'react';
import { RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';
import type { LearningActivity, FlashcardsContent, ActivitySubmissionResult } from '../../types/activities';

interface Props {
  activity: LearningActivity;
  onResponse: (response: any) => void;
  currentResponse: any;
  disabled: boolean;
  showFeedback: boolean;
  feedbackResult: ActivitySubmissionResult | null;
  theme: any;
}

const FlashcardsActivity: React.FC<Props> = ({
  activity,
  onResponse,
  currentResponse: _currentResponse,
  disabled,
  showFeedback: _showFeedback,
  feedbackResult: _feedbackResult,
  theme: _theme
}) => {
  const content = activity.content_data as FlashcardsContent;
  const cards = content.cards || [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewedCards, setReviewedCards] = useState<Set<number>>(new Set());

  const currentCard = cards[currentIndex];

  useEffect(() => {
    // Report progress as response
    onResponse({ reviewedCount: reviewedCards.size });
  }, [reviewedCards.size, onResponse]);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    // Mark as reviewed when flipped to back
    if (!isFlipped) {
      setReviewedCards(prev => new Set([...prev, currentIndex]));
    }
  };

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };

  if (!currentCard) {
    return <div>No flashcards available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>Card {currentIndex + 1} of {cards.length}</span>
        <span>{reviewedCards.size} reviewed</span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-purple-500 rounded-full h-2 transition-all"
          style={{ width: `${(reviewedCards.size / cards.length) * 100}%` }}
        />
      </div>

      {/* Flashcard */}
      <div
        onClick={handleFlip}
        className={`relative w-full h-64 cursor-pointer perspective-1000 ${disabled ? 'opacity-50' : ''}`}
      >
        <div
          className={`absolute inset-0 transition-transform duration-500 preserve-3d ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 backface-hidden bg-gradient-to-br from-purple-500 to-fuchsia-500 rounded-3xl p-6 flex flex-col items-center justify-center text-white shadow-xl"
            style={{ backfaceVisibility: 'hidden' }}
          >
            {currentCard.image && (
              <img
                src={currentCard.image}
                alt="Card"
                className="w-24 h-24 rounded-xl object-cover mb-4"
              />
            )}
            <p className="text-2xl font-bold text-center">{currentCard.front}</p>
            <p className="text-sm text-white/70 mt-4 flex items-center gap-2">
              <RotateCw className="w-4 h-4" /> Tap to flip
            </p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 backface-hidden bg-white border-4 border-purple-500 rounded-3xl p-6 flex flex-col items-center justify-center shadow-xl rotate-y-180"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <p className="text-2xl font-bold text-center text-gray-800">{currentCard.back}</p>
            <p className="text-sm text-gray-500 mt-4 flex items-center gap-2">
              <RotateCw className="w-4 h-4" /> Tap to flip back
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0 || disabled}
          className={`p-3 rounded-xl transition-all ${
            currentIndex === 0
              ? 'bg-gray-100 text-gray-400'
              : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
          }`}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div className="flex gap-2">
          {cards.map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all ${
                i === currentIndex
                  ? 'bg-purple-500 scale-125'
                  : reviewedCards.has(i)
                  ? 'bg-green-400'
                  : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          disabled={currentIndex === cards.length - 1 || disabled}
          className={`p-3 rounded-xl transition-all ${
            currentIndex === cards.length - 1
              ? 'bg-gray-100 text-gray-400'
              : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
          }`}
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default FlashcardsActivity;
