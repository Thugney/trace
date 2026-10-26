import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Check } from 'lucide-react';
import type { LearningActivity, WordSearchContent, ActivitySubmissionResult } from '../../types/activities';

interface Props {
  activity: LearningActivity;
  onResponse: (response: any) => void;
  currentResponse: any;
  disabled: boolean;
  showFeedback: boolean;
  feedbackResult: ActivitySubmissionResult | null;
  theme: any;
}

interface Cell {
  row: number;
  col: number;
}

const WordSearchActivity: React.FC<Props> = ({
  activity,
  onResponse,
  currentResponse,
  disabled,
  showFeedback,
  feedbackResult: _feedbackResult,
  theme: _theme
}) => {
  const content = activity.content_data as WordSearchContent;
  const grid = useMemo(() => content.grid || [], [content.grid]);
  const words = useMemo(() => content.words || [], [content.words]);

  const [selectedCells, setSelectedCells] = useState<Cell[]>([]);
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [foundCells, setFoundCells] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);

  // Restore from response
  useEffect(() => {
    if (currentResponse?.foundWords) {
      setFoundWords(currentResponse.foundWords);
      setFoundCells(new Set(currentResponse.foundCells || []));
    }
  }, [currentResponse]);

  const cellKey = (row: number, col: number) => `${row}-${col}`;

  const getSelectedWord = useCallback(() => {
    return selectedCells.map(cell => grid[cell.row]?.[cell.col] || '').join('');
  }, [selectedCells, grid]);

  const isValidSelection = useCallback((newCell: Cell): boolean => {
    if (selectedCells.length === 0) return true;

    const lastCell = selectedCells[selectedCells.length - 1];

    // Must be adjacent (including diagonal)
    const rowDiff = Math.abs(newCell.row - lastCell.row);
    const colDiff = Math.abs(newCell.col - lastCell.col);

    if (rowDiff > 1 || colDiff > 1) return false;

    // Must follow same direction if we have 2+ cells
    if (selectedCells.length >= 2) {
      const firstCell = selectedCells[0];
      const direction = {
        row: lastCell.row - firstCell.row,
        col: lastCell.col - firstCell.col
      };

      // Normalize direction
      const length = selectedCells.length - 1;
      const unitRow = direction.row / length;
      const unitCol = direction.col / length;

      const expectedRow = lastCell.row + unitRow;
      const expectedCol = lastCell.col + unitCol;

      if (Math.round(expectedRow) !== newCell.row || Math.round(expectedCol) !== newCell.col) {
        return false;
      }
    }

    // Can't select already selected cell
    if (selectedCells.some(c => c.row === newCell.row && c.col === newCell.col)) {
      return false;
    }

    return true;
  }, [selectedCells]);

  const handleCellClick = (row: number, col: number) => {
    if (disabled) return;

    const cell = { row, col };

    if (!isSelecting) {
      // Start new selection
      setSelectedCells([cell]);
      setIsSelecting(true);
    } else {
      // Check if valid continuation
      if (isValidSelection(cell)) {
        setSelectedCells([...selectedCells, cell]);
      } else {
        // End selection and check word
        checkWord();
      }
    }
  };

  const checkWord = useCallback(() => {
    const word = getSelectedWord().toUpperCase();
    const reverseWord = word.split('').reverse().join('');

    const matchedWord = words.find(
      w => w.toUpperCase() === word || w.toUpperCase() === reverseWord
    );

    if (matchedWord && !foundWords.includes(matchedWord.toUpperCase())) {
      const newFoundWords = [...foundWords, matchedWord.toUpperCase()];
      const newFoundCells = new Set(foundCells);
      selectedCells.forEach(cell => newFoundCells.add(cellKey(cell.row, cell.col)));

      setFoundWords(newFoundWords);
      setFoundCells(newFoundCells);

      onResponse({
        foundWords: newFoundWords,
        foundCells: Array.from(newFoundCells)
      });
    }

    setSelectedCells([]);
    setIsSelecting(false);
  }, [getSelectedWord, selectedCells, foundWords, foundCells, words, onResponse]);

  // Double tap or click outside to confirm selection
  const handleConfirm = () => {
    if (isSelecting && selectedCells.length > 0) {
      checkWord();
    }
  };

  const isCellSelected = (row: number, col: number) => {
    return selectedCells.some(c => c.row === row && c.col === col);
  };

  const isCellFound = (row: number, col: number) => {
    return foundCells.has(cellKey(row, col));
  };

  const allFound = foundWords.length === words.length;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          Found: <strong>{foundWords.length}</strong> / {words.length}
        </span>
        {isSelecting && (
          <button
            onClick={handleConfirm}
            className="px-3 py-1 bg-purple-500 text-white rounded-lg text-sm"
          >
            Check Word
          </button>
        )}
      </div>

      {/* Words to find */}
      <div className="flex flex-wrap gap-2">
        {words.map((word, i) => {
          const isFound = foundWords.includes(word.toUpperCase());
          return (
            <span
              key={i}
              className={`px-3 py-1 rounded-lg text-sm font-medium ${
                isFound
                  ? 'bg-green-100 text-green-700 line-through'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {isFound && <Check className="w-3 h-3 inline mr-1" />}
              {word}
            </span>
          );
        })}
      </div>

      {allFound && (
        <div className="bg-green-50 border-2 border-green-400 rounded-xl p-3 text-center">
          <p className="font-bold text-green-800">🎉 All words found!</p>
        </div>
      )}

      {/* Grid */}
      <div
        className="bg-gray-50 rounded-xl p-4 overflow-x-auto"
        onClick={(e) => {
          // Click on background ends selection
          if (e.target === e.currentTarget) {
            handleConfirm();
          }
        }}
      >
        <div
          className="grid gap-1 mx-auto w-fit"
          style={{
            gridTemplateColumns: `repeat(${grid[0]?.length || 0}, minmax(0, 1fr))`
          }}
        >
          {grid.map((row, rowIndex) =>
            row.map((letter, colIndex) => {
              const selected = isCellSelected(rowIndex, colIndex);
              const found = isCellFound(rowIndex, colIndex);

              return (
                <button
                  key={cellKey(rowIndex, colIndex)}
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                  disabled={disabled}
                  className={`w-9 h-9 rounded-lg font-bold text-lg uppercase flex items-center justify-center transition-all ${
                    found
                      ? 'bg-green-400 text-white'
                      : selected
                      ? 'bg-purple-500 text-white ring-2 ring-purple-300'
                      : 'bg-white border border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                  } ${disabled ? 'opacity-50' : ''}`}
                >
                  {letter}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Current selection */}
      {isSelecting && selectedCells.length > 0 && (
        <div className="text-center">
          <span className="px-4 py-2 bg-purple-100 rounded-lg text-purple-700 font-bold text-lg">
            {getSelectedWord().toUpperCase() || '...'}
          </span>
        </div>
      )}

      {showFeedback && (
        <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-medium mb-2">Words to find:</p>
          <div className="flex flex-wrap gap-2">
            {words.map((word, i) => (
              <span key={i} className="bg-blue-100 px-2 py-1 rounded">
                {word}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WordSearchActivity;
