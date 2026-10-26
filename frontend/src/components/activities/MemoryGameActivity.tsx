import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RotateCw, Trophy } from 'lucide-react';
import type { LearningActivity, MemoryGameContent, ActivitySubmissionResult } from '../../types/activities';

interface Props {
  activity: LearningActivity;
  onResponse: (response: any) => void;
  currentResponse: any;
  disabled: boolean;
  showFeedback: boolean;
  feedbackResult: ActivitySubmissionResult | null;
  theme: any;
}

interface Card {
  id: number;
  pairId: number;
  content: string;
  image?: string;
  type: 'front' | 'back';
}

const MemoryGameActivity: React.FC<Props> = ({
  activity,
  onResponse,
  currentResponse,
  disabled,
  showFeedback,
  feedbackResult: _feedbackResult,
  theme: _theme
}) => {
  const content = activity.content_data as MemoryGameContent;
  // Keyed by content, so a parent passing an equal copy of the activity keeps the board.
  const pairsSignature = JSON.stringify(content.pairs || []);
  const pairs = useMemo(
    () => JSON.parse(pairsSignature) as MemoryGameContent['pairs'],
    [pairsSignature]
  );
  const activityId = activity.id;

  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  // The last response this component reported, so its echo is not "restored".
  const reportedRef = useRef<unknown>(null);

  // Initialize and shuffle cards. A different activity starts a fresh game:
  // the parent reuses this instance, so progress must not carry over.
  useEffect(() => {
    const newCards: Card[] = [];
    pairs.forEach((pair, index) => {
      newCards.push({
        id: index * 2,
        pairId: index,
        content: pair.front,
        image: pair.frontImage,
        type: 'front'
      });
      newCards.push({
        id: index * 2 + 1,
        pairId: index,
        content: pair.back,
        image: pair.backImage,
        type: 'back'
      });
    });

    // Shuffle
    for (let i = newCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newCards[i], newCards[j]] = [newCards[j], newCards[i]];
    }

    setCards(newCards);
    setFlippedCards([]);
    setMatchedPairs([]);
    setMoves(0);
    setIsChecking(false);
  }, [activityId, pairs]);

  // Restore state from a response this component did not report itself
  useEffect(() => {
    if (currentResponse?.matchedPairs && currentResponse !== reportedRef.current) {
      setMatchedPairs(currentResponse.matchedPairs);
      setMoves(currentResponse.moves || 0);
    }
  }, [currentResponse]);

  // Report progress
  useEffect(() => {
    const response = {
      matchedPairs,
      moves,
      completed: matchedPairs.length === pairs.length
    };
    reportedRef.current = response;
    onResponse(response);
  }, [matchedPairs, moves, pairs.length, onResponse]);

  // Resolve a flipped pair. Cleanup cancels the pending check when the board
  // resets, so a previous activity's pair cannot land on the next one.
  useEffect(() => {
    if (flippedCards.length !== 2) return;

    const [firstCard, secondCard] = flippedCards.map(id => cards.find(c => c.id === id));
    const matchedPairId =
      firstCard && secondCard && firstCard.pairId === secondCard.pairId ? firstCard.pairId : null;

    // Match found: keep both cards; no match: flip back
    const timer = setTimeout(() => {
      if (matchedPairId !== null) {
        setMatchedPairs(prev => [...prev, matchedPairId]);
      }
      setFlippedCards([]);
      setIsChecking(false);
    }, matchedPairId !== null ? 500 : 1000);
    return () => clearTimeout(timer);
  }, [flippedCards, cards]);

  const handleCardClick = useCallback((cardId: number) => {
    if (disabled || isChecking) return;

    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    // Don't flip if already matched or already flipped
    if (matchedPairs.includes(card.pairId) || flippedCards.includes(cardId)) return;

    // Don't flip more than 2 cards
    if (flippedCards.length >= 2) return;

    const newFlipped = [...flippedCards, cardId];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      setIsChecking(true);
      setMoves(prev => prev + 1);
    }
  }, [cards, flippedCards, matchedPairs, disabled, isChecking]);

  const isFlipped = (cardId: number) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return false;
    return flippedCards.includes(cardId) || matchedPairs.includes(card.pairId);
  };

  const isMatched = (cardId: number) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return false;
    return matchedPairs.includes(card.pairId);
  };

  const allMatched = matchedPairs.length === pairs.length;

  // Determine grid columns based on number of cards
  const getGridCols = () => {
    const totalCards = cards.length;
    if (totalCards <= 4) return 'grid-cols-2';
    if (totalCards <= 6) return 'grid-cols-3';
    if (totalCards <= 8) return 'grid-cols-4';
    if (totalCards <= 12) return 'grid-cols-4';
    return 'grid-cols-4';
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          Pairs found: <strong>{matchedPairs.length}</strong> / {pairs.length}
        </span>
        <span className="text-gray-600">
          Moves: <strong>{moves}</strong>
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-purple-500 rounded-full h-2 transition-all"
          style={{ width: `${(matchedPairs.length / pairs.length) * 100}%` }}
        />
      </div>

      {/* Game complete message */}
      {allMatched && (
        <div className="bg-green-50 border-2 border-green-400 rounded-xl p-4 flex items-center gap-3">
          <Trophy className="w-8 h-8 text-yellow-500" />
          <div>
            <p className="font-bold text-green-800">All pairs found!</p>
            <p className="text-sm text-green-600">
              Completed in {moves} moves
            </p>
          </div>
        </div>
      )}

      {/* Card grid */}
      <div className={`grid ${getGridCols()} gap-3`}>
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => handleCardClick(card.id)}
            disabled={disabled || isChecking || isMatched(card.id)}
            className={`aspect-square rounded-xl transition-all duration-300 transform ${
              isFlipped(card.id)
                ? isMatched(card.id)
                  ? 'bg-green-100 border-2 border-green-400 scale-95'
                  : 'bg-white border-2 border-purple-400'
                : 'bg-gradient-to-br from-purple-500 to-fuchsia-500 hover:scale-105 hover:shadow-lg'
            } ${disabled && !showFeedback ? 'opacity-50' : ''}`}
            style={{
              perspective: '1000px'
            }}
          >
            {isFlipped(card.id) ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-2">
                {card.image ? (
                  <img
                    src={card.image}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover mb-1"
                  />
                ) : null}
                <span className="text-sm font-medium text-gray-800 text-center line-clamp-3">
                  {card.content}
                </span>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <RotateCw className="w-8 h-8 text-white/50" />
              </div>
            )}
          </button>
        ))}
      </div>

      {showFeedback && (
        <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-medium mb-2">Card pairs:</p>
          <ul className="space-y-1">
            {pairs.map((pair, i) => (
              <li key={i}>
                <strong>{pair.front}</strong> ↔ {pair.back}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MemoryGameActivity;
