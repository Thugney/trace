import React, { useState, useEffect, useRef } from 'react';
import type { LearningActivity, CrosswordContent, CrosswordCorrect, ActivitySubmissionResult } from '../../types/activities';

interface Props {
  activity: LearningActivity;
  onResponse: (response: any) => void;
  currentResponse: any;
  disabled: boolean;
  showFeedback: boolean;
  feedbackResult: ActivitySubmissionResult | null;
  theme: any;
}

const CrosswordActivity: React.FC<Props> = ({
  activity,
  onResponse,
  currentResponse,
  disabled,
  showFeedback,
  feedbackResult: _feedbackResult,
  theme: _theme
}) => {
  const content = activity.content_data as CrosswordContent;
  const correctData = activity.correct_data as CrosswordCorrect;

  const grid = content.grid || [];
  const clues = content.clues || { across: [], down: [] };

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [direction, setDirection] = useState<'across' | 'down'>('across');
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const cellKey = (row: number, col: number) => `${row}-${col}`;

  // Initialize answers from response
  useEffect(() => {
    if (currentResponse?.answers) {
      setAnswers(currentResponse.answers);
    }
  }, [currentResponse]);

  const handleCellClick = (row: number, col: number) => {
    if (disabled) return;
    const cell = grid[row]?.[col];
    if (!cell || cell === '#') return;

    if (selectedCell?.row === row && selectedCell?.col === col) {
      // Toggle direction on same cell click
      setDirection(direction === 'across' ? 'down' : 'across');
    } else {
      setSelectedCell({ row, col });
    }

    // Focus the input
    const key = cellKey(row, col);
    inputRefs.current[key]?.focus();
  };

  const handleInput = (row: number, col: number, value: string) => {
    if (disabled) return;

    const letter = value.toUpperCase().replace(/[^A-Z]/g, '').slice(-1);
    const key = cellKey(row, col);

    const newAnswers = { ...answers, [key]: letter };
    setAnswers(newAnswers);
    onResponse({ answers: newAnswers });

    // Move to next cell
    if (letter) {
      moveToNextCell(row, col);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, row: number, col: number) => {
    if (disabled) return;

    if (e.key === 'Backspace') {
      const key = cellKey(row, col);
      if (!answers[key]) {
        // Move to previous cell if current is empty
        moveToPrevCell(row, col);
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setDirection('across');
      moveToNextCell(row, col);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setDirection('across');
      moveToPrevCell(row, col);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDirection('down');
      moveToNextCell(row, col);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDirection('down');
      moveToPrevCell(row, col);
    }
  };

  const moveToNextCell = (row: number, col: number) => {
    let nextRow = row;
    let nextCol = col;

    if (direction === 'across') {
      nextCol++;
    } else {
      nextRow++;
    }

    // Find next non-blank cell
    while (nextRow < grid.length && nextCol < (grid[0]?.length || 0)) {
      const cell = grid[nextRow]?.[nextCol];
      if (cell && cell !== '#') {
        setSelectedCell({ row: nextRow, col: nextCol });
        inputRefs.current[cellKey(nextRow, nextCol)]?.focus();
        return;
      }
      if (direction === 'across') {
        nextCol++;
      } else {
        nextRow++;
      }
    }
  };

  const moveToPrevCell = (row: number, col: number) => {
    let prevRow = row;
    let prevCol = col;

    if (direction === 'across') {
      prevCol--;
    } else {
      prevRow--;
    }

    // Find previous non-blank cell
    while (prevRow >= 0 && prevCol >= 0) {
      const cell = grid[prevRow]?.[prevCol];
      if (cell && cell !== '#') {
        setSelectedCell({ row: prevRow, col: prevCol });
        inputRefs.current[cellKey(prevRow, prevCol)]?.focus();
        return;
      }
      if (direction === 'across') {
        prevCol--;
      } else {
        prevRow--;
      }
    }
  };

  const isCellCorrect = (row: number, col: number): boolean | null => {
    if (!showFeedback) return null;
    const key = cellKey(row, col);
    const userAnswer = answers[key]?.toUpperCase();
    const correctAnswer = correctData.solution?.[key]?.toUpperCase();
    if (!correctAnswer) return null;
    return userAnswer === correctAnswer;
  };

  const isInSelectedWord = (row: number, col: number): boolean => {
    if (!selectedCell) return false;

    if (direction === 'across') {
      if (row !== selectedCell.row) return false;
      // Find word boundaries
      let start = selectedCell.col;
      while (start > 0 && grid[row][start - 1] !== '#') start--;
      let end = selectedCell.col;
      while (end < (grid[0]?.length || 0) - 1 && grid[row][end + 1] !== '#') end++;
      return col >= start && col <= end;
    } else {
      if (col !== selectedCell.col) return false;
      // Find word boundaries
      let start = selectedCell.row;
      while (start > 0 && grid[start - 1]?.[col] !== '#') start--;
      let end = selectedCell.row;
      while (end < grid.length - 1 && grid[end + 1]?.[col] !== '#') end++;
      return row >= start && row <= end;
    }
  };

  // Calculate cell numbers for clues
  const getCellNumber = (row: number, col: number): number | undefined => {
    const across = clues.across.find(c => c.startRow === row && c.startCol === col);
    const down = clues.down.find(c => c.startRow === row && c.startCol === col);
    return across?.number || down?.number;
  };

  return (
    <div className="space-y-6">
      {/* Grid */}
      <div className="bg-gray-100 rounded-xl p-4 overflow-x-auto">
        <div
          className="grid gap-0.5 mx-auto w-fit"
          style={{
            gridTemplateColumns: `repeat(${grid[0]?.length || 0}, minmax(0, 1fr))`
          }}
        >
          {grid.map((row, rowIndex) =>
            row.map((cell, colIndex) => {
              if (cell === '#') {
                return (
                  <div
                    key={cellKey(rowIndex, colIndex)}
                    className="w-9 h-9 bg-gray-800 rounded-sm"
                  />
                );
              }

              const key = cellKey(rowIndex, colIndex);
              const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
              const inWord = isInSelectedWord(rowIndex, colIndex);
              const correct = isCellCorrect(rowIndex, colIndex);
              const number = getCellNumber(rowIndex, colIndex);

              return (
                <div
                  key={key}
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                  className={`w-9 h-9 relative border transition-all ${
                    showFeedback
                      ? correct === true
                        ? 'bg-green-100 border-green-400'
                        : correct === false
                        ? 'bg-red-100 border-red-400'
                        : 'bg-white border-gray-300'
                      : isSelected
                      ? 'bg-yellow-200 border-purple-500 border-2'
                      : inWord
                      ? 'bg-purple-100 border-purple-300'
                      : 'bg-white border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {number && (
                    <span className="absolute top-0 left-0.5 text-[8px] text-gray-500 font-medium">
                      {number}
                    </span>
                  )}
                  <input
                    ref={(el) => { inputRefs.current[key] = el; }}
                    type="text"
                    value={answers[key] || ''}
                    onChange={(e) => handleInput(rowIndex, colIndex, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                    disabled={disabled}
                    maxLength={1}
                    className={`w-full h-full text-center font-bold text-lg uppercase bg-transparent outline-none ${
                      disabled ? 'cursor-not-allowed' : 'cursor-text'
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Direction indicator */}
      <div className="flex justify-center gap-4">
        <button
          onClick={() => setDirection('across')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            direction === 'across'
              ? 'bg-purple-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          → Across
        </button>
        <button
          onClick={() => setDirection('down')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            direction === 'down'
              ? 'bg-purple-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          ↓ Down
        </button>
      </div>

      {/* Clues */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Across clues */}
        <div className="bg-gray-50 rounded-xl p-4">
          <h4 className="font-bold text-gray-700 mb-2">Across</h4>
          <ul className="space-y-1 text-sm">
            {clues.across.map((clue) => (
              <li
                key={`across-${clue.number}`}
                onClick={() => {
                  setDirection('across');
                  setSelectedCell({ row: clue.startRow, col: clue.startCol });
                  inputRefs.current[cellKey(clue.startRow, clue.startCol)]?.focus();
                }}
                className="cursor-pointer hover:bg-purple-100 p-1 rounded"
              >
                <strong>{clue.number}.</strong> {clue.clue}
              </li>
            ))}
          </ul>
        </div>

        {/* Down clues */}
        <div className="bg-gray-50 rounded-xl p-4">
          <h4 className="font-bold text-gray-700 mb-2">Down</h4>
          <ul className="space-y-1 text-sm">
            {clues.down.map((clue) => (
              <li
                key={`down-${clue.number}`}
                onClick={() => {
                  setDirection('down');
                  setSelectedCell({ row: clue.startRow, col: clue.startCol });
                  inputRefs.current[cellKey(clue.startRow, clue.startCol)]?.focus();
                }}
                className="cursor-pointer hover:bg-purple-100 p-1 rounded"
              >
                <strong>{clue.number}.</strong> {clue.clue}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {showFeedback && correctData.solution && (
        <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-medium">Solution available - check the grid for correct/incorrect cells</p>
        </div>
      )}
    </div>
  );
};

export default CrosswordActivity;
