import { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { familyQuizzesAPI, type FamilyQuiz, type QuizStartResponse, type QuizTheme } from '../services/api';
import { useToast } from '../components/Toast';
import confetti from 'canvas-confetti';

// Sound effects
const playSounds = {
  correct: () => {
    const audio = new Audio('/sounds/correct.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  },
  wrong: () => {
    const audio = new Audio('/sounds/wrong.mp3');
    audio.volume = 0.3;
    audio.play().catch(() => {});
  },
  complete: () => {
    const audio = new Audio('/sounds/fanfare.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  },
  click: () => {
    const audio = new Audio('/sounds/click.mp3');
    audio.volume = 0.3;
    audio.play().catch(() => {});
  }
};

// Confetti celebration
const celebrate = () => {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 }
  });
};

export default function QuizPlayer() {
  const { currentProfile } = useProfile();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState<FamilyQuiz[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [recentAttempts, setRecentAttempts] = useState<any[]>([]);

  // Quiz playing state
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'feedback' | 'results'>('menu');
  const [currentQuiz, setCurrentQuiz] = useState<QuizStartResponse | null>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [score, setScore] = useState({ correct: 0, wrong: 0, points: 0 });
  const [startTime, setStartTime] = useState<number>(0);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [showHint, setShowHint] = useState(false);
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    if (currentProfile?.id) {
      loadData();
    }
  }, [currentProfile]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [quizzesRes, statsRes, attemptsRes] = await Promise.all([
        familyQuizzesAPI.getChildQuizzes(currentProfile!.id),
        familyQuizzesAPI.getChildStats(currentProfile!.id),
        familyQuizzesAPI.getAttemptHistory(currentProfile!.id, 5)
      ]);
      setQuizzes(quizzesRes.data);
      setStats(statsRes.data);
      setRecentAttempts(attemptsRes.data);
    } catch (error) {
      console.error('Failed to load quizzes:', error);
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = async (quiz: FamilyQuiz) => {
    try {
      playSounds.click();
      const response = await familyQuizzesAPI.startQuiz(quiz.id, currentProfile!.id);
      setCurrentQuiz(response.data);
      setAttemptId(response.data.attemptId);
      setCurrentQuestionIndex(0);
      setScore({ correct: 0, wrong: 0, points: 0 });
      setStartTime(Date.now());
      setQuestionStartTime(Date.now());
      setGameState('playing');
    } catch (error) {
      console.error('Failed to start quiz:', error);
      showToast('Failed to start quiz', 'error');
    }
  };

  const handleAnswerSelect = (answerId: string) => {
    if (selectedAnswer) return; // Already answered
    playSounds.click();
    setSelectedAnswer(answerId);
  };

  const submitAnswer = async () => {
    if (!selectedAnswer || !currentQuiz || !attemptId) return;

    const question = currentQuiz.questions[currentQuestionIndex];
    const timeTaken = Math.round((Date.now() - questionStartTime) / 1000);

    try {
      const response = await familyQuizzesAPI.submitAnswer(attemptId, question.id, selectedAnswer, timeTaken);
      setIsCorrect(response.data.isCorrect);
      setExplanation(response.data.explanation || null);

      if (response.data.isCorrect) {
        playSounds.correct();
        celebrate();
        setScore(prev => ({
          ...prev,
          correct: prev.correct + 1,
          points: prev.points + response.data.points
        }));
      } else {
        playSounds.wrong();
        setScore(prev => ({ ...prev, wrong: prev.wrong + 1 }));
      }

      setGameState('feedback');
    } catch (error) {
      console.error('Failed to submit answer:', error);
      showToast('Failed to submit answer', 'error');
    }
  };

  const nextQuestion = () => {
    if (!currentQuiz) return;

    if (currentQuestionIndex + 1 >= currentQuiz.questions.length) {
      completeQuiz();
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setIsCorrect(null);
      setExplanation(null);
      setShowHint(false);
      setQuestionStartTime(Date.now());
      setGameState('playing');
    }
  };

  const completeQuiz = async () => {
    if (!attemptId) return;

    const totalTime = Math.round((Date.now() - startTime) / 1000);

    try {
      const response = await familyQuizzesAPI.completeQuiz(attemptId, totalTime);
      setResults(response.data);

      if (response.data.passed) {
        playSounds.complete();
        setTimeout(celebrate, 500);
        setTimeout(celebrate, 1000);
      }

      setGameState('results');
      loadData(); // Refresh stats
    } catch (error) {
      console.error('Failed to complete quiz:', error);
      showToast('Failed to complete quiz', 'error');
    }
  };

  const getTheme = (): QuizTheme => {
    if (currentQuiz?.theme) return currentQuiz.theme;
    // Default theme
    return {
      colors: { primary: '#8B5CF6', secondary: '#7C3AED', accent: '#FCD34D', background: 'from-purple-500 to-indigo-600' },
      mascot: '🌟',
      animations: ['bounce'],
      sounds: { correct: 'sparkle', wrong: 'soft_miss', complete: 'celebration' },
      encouragements: ['Great job!', 'Amazing!', 'Wonderful!', 'You rock!']
    };
  };

  const getEncouragement = () => {
    const theme = getTheme();
    const idx = Math.floor(Math.random() * theme.encouragements.length);
    return theme.encouragements[idx];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  // Quiz Menu
  if (gameState === 'menu') {
    const theme = {
      colors: { primary: '#8B5CF6', secondary: '#7C3AED', accent: '#FCD34D', background: 'from-purple-500 to-indigo-600' }
    };

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className={`bg-gradient-to-r ${theme.colors.background} p-6 rounded-2xl text-white`}>
          <h1 className="text-2xl font-bold mb-2">My Quizzes</h1>
          <p className="opacity-90">Learn and earn rewards!</p>
          {stats?.overall && (
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{stats.overall.quizzes_passed || 0}</div>
                <div className="text-xs opacity-80">Quizzes Passed</div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{stats.overall.total_points_earned || 0}</div>
                <div className="text-xs opacity-80">Points Earned</div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{stats.overall.first_places || 0}</div>
                <div className="text-xs opacity-80">First Places</div>
              </div>
            </div>
          )}
        </div>

        {/* Available Quizzes */}
        {quizzes.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No quizzes yet!</h3>
            <p className="text-gray-600">Ask your parents to create some fun quizzes for you.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {quizzes.map(quiz => {
              const quizTheme = quiz.theme;
              const bgGradient = quizTheme?.colors?.background || 'from-purple-500 to-indigo-600';

              return (
                <div
                  key={quiz.id}
                  className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
                  onClick={() => startQuiz(quiz)}
                >
                  <div className={`bg-gradient-to-r ${bgGradient} p-4 text-white`}>
                    <div className="flex items-center justify-between">
                      <span className="text-4xl">{quiz.category_icon}</span>
                      {quiz.is_competition === 1 && (
                        <span className="px-2 py-1 bg-yellow-400 text-yellow-900 text-xs rounded-full font-bold">
                          RACE!
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-bold mt-2">{quiz.title}</h3>
                    <p className="text-sm opacity-90">{quiz.question_count} questions</p>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between text-sm mb-3">
                      <span className="flex items-center gap-1 text-yellow-600">
                        <span>💰</span> {quiz.points_per_correct} pts each
                      </span>
                      {quiz.best_score !== null && (
                        <span className="text-green-600 font-medium">
                          Best: {quiz.best_score}%
                        </span>
                      )}
                    </div>

                    <button className={`w-full py-3 bg-gradient-to-r ${bgGradient} text-white rounded-xl font-bold text-lg shadow-md hover:shadow-lg transition-all transform hover:scale-105`}>
                      {quiz.my_attempts ? 'Play Again!' : 'Start Quiz!'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recent Attempts */}
        {recentAttempts.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Recent Attempts</h3>
            <div className="space-y-2">
              {recentAttempts.map(attempt => (
                <div key={attempt.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{attempt.category_icon}</span>
                    <div>
                      <div className="font-medium">{attempt.quiz_title}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(attempt.completed_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${attempt.passed ? 'text-green-600' : 'text-gray-500'}`}>
                      {attempt.score_percentage}%
                    </div>
                    <div className="text-xs text-yellow-600">+{attempt.points_earned} pts</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Quiz Playing / Feedback States
  if ((gameState === 'playing' || gameState === 'feedback') && currentQuiz) {
    const theme = getTheme();
    const question = currentQuiz.questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / currentQuiz.questions.length) * 100;

    return (
      <div className={`min-h-[80vh] bg-gradient-to-br ${theme.colors.background} rounded-2xl p-6 text-white`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => { setGameState('menu'); setCurrentQuiz(null); }}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="text-center">
            <div className="font-semibold">{currentQuiz.quiz.title}</div>
            <div className="text-sm opacity-80">Question {currentQuestionIndex + 1} of {currentQuiz.totalQuestions}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{theme.mascot}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-white/20 rounded-full mb-6">
          <div
            className="h-2 bg-white rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Score Display */}
        <div className="flex justify-center gap-6 mb-6">
          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 text-center">
            <div className="text-xs opacity-80">Correct</div>
            <div className="text-xl font-bold text-green-300">{score.correct}</div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 text-center">
            <div className="text-xs opacity-80">Points</div>
            <div className="text-xl font-bold text-yellow-300">{score.points}</div>
          </div>
        </div>

        {/* Question */}
        <div className="bg-white rounded-2xl p-6 text-gray-900 mb-6 shadow-xl">
          <h2 className="text-xl font-bold text-center mb-6">{question.question_text}</h2>

          {question.question_image && (
            <div className="flex justify-center mb-6">
              <img src={question.question_image} alt="Question" className="max-h-40 rounded-lg" />
            </div>
          )}

          {/* Options */}
          <div className="grid grid-cols-1 gap-3">
            {question.options.map((option) => {
              const isSelected = selectedAnswer === option.id;
              const isThisCorrect = gameState === 'feedback' && isCorrect && isSelected;
              const isThisWrong = gameState === 'feedback' && !isCorrect && isSelected;
              const showAsCorrect = gameState === 'feedback' && option.id === question.correct_answer;

              return (
                <button
                  key={option.id}
                  onClick={() => handleAnswerSelect(option.id)}
                  disabled={gameState === 'feedback'}
                  className={`w-full p-4 rounded-xl text-left font-medium transition-all transform ${
                    isThisCorrect
                      ? 'bg-green-500 text-white scale-105 shadow-lg animate-pulse'
                      : isThisWrong
                      ? 'bg-red-500 text-white'
                      : showAsCorrect
                      ? 'bg-green-100 text-green-800 border-2 border-green-500'
                      : isSelected
                      ? `bg-gradient-to-r ${theme.colors.background} text-white shadow-md`
                      : 'bg-gray-100 hover:bg-gray-200 hover:scale-102'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      isThisCorrect || showAsCorrect
                        ? 'bg-white text-green-600'
                        : isThisWrong
                        ? 'bg-white text-red-600'
                        : isSelected
                        ? 'bg-white text-purple-600'
                        : 'bg-gray-300 text-gray-600'
                    }`}>
                      {option.id.toUpperCase()}
                    </span>
                    <span className="text-lg">{option.text}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Hint Button */}
          {question.hint && gameState === 'playing' && !showHint && (
            <button
              onClick={() => setShowHint(true)}
              className="mt-4 w-full py-2 text-purple-600 hover:bg-purple-50 rounded-lg text-sm"
            >
              Need a hint? Click here
            </button>
          )}
          {showHint && question.hint && (
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg text-yellow-800 text-sm">
              <strong>Hint:</strong> {question.hint}
            </div>
          )}

          {/* Explanation (after answer) */}
          {gameState === 'feedback' && explanation && (
            <div className={`mt-4 p-3 rounded-lg text-sm ${
              isCorrect ? 'bg-green-50 text-green-800' : 'bg-blue-50 text-blue-800'
            }`}>
              <strong>Explanation:</strong> {explanation}
            </div>
          )}
        </div>

        {/* Action Button */}
        {gameState === 'playing' && selectedAnswer && (
          <button
            onClick={submitAnswer}
            className="w-full py-4 bg-white text-purple-600 rounded-xl font-bold text-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          >
            Submit Answer
          </button>
        )}

        {gameState === 'feedback' && (
          <div className="text-center">
            <div className={`text-3xl font-bold mb-4 ${isCorrect ? 'animate-bounce' : ''}`}>
              {isCorrect ? getEncouragement() : 'Not quite!'}
            </div>
            <button
              onClick={nextQuestion}
              className="w-full py-4 bg-white text-purple-600 rounded-xl font-bold text-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              {currentQuestionIndex + 1 >= currentQuiz.questions.length ? 'See Results!' : 'Next Question'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Results Screen
  if (gameState === 'results' && results) {
    const passed = results.passed;

    return (
      <div className={`min-h-[80vh] bg-gradient-to-br ${passed ? 'from-green-400 to-emerald-600' : 'from-gray-400 to-gray-600'} rounded-2xl p-6 text-white flex flex-col items-center justify-center`}>
        <div className="text-8xl mb-6 animate-bounce">
          {passed ? '🎉' : '📚'}
        </div>

        <h1 className="text-4xl font-bold mb-2">
          {passed ? 'Quiz Complete!' : 'Keep Learning!'}
        </h1>
        <p className="text-xl opacity-90 mb-6">
          {passed ? getEncouragement() : 'Practice makes perfect!'}
        </p>

        {/* Score Circle */}
        <div className="relative w-48 h-48 mb-6">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="96"
              cy="96"
              r="88"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="12"
              fill="none"
            />
            <circle
              cx="96"
              cy="96"
              r="88"
              stroke="white"
              strokeWidth="12"
              fill="none"
              strokeDasharray={553}
              strokeDashoffset={553 - (553 * results.scorePercentage / 100)}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-5xl font-bold">{results.scorePercentage}%</div>
            <div className="text-sm opacity-80">Score</div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8 w-full max-w-md">
          <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-300">{results.correctAnswers}</div>
            <div className="text-xs opacity-80">Correct</div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-yellow-300">+{results.pointsEarned}</div>
            <div className="text-xs opacity-80">Points</div>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-yellow-300">+{results.starsEarned}</div>
            <div className="text-xs opacity-80">Stars</div>
          </div>
        </div>

        {/* Competition Rank */}
        {results.competitionRank && (
          <div className="bg-yellow-400 text-yellow-900 rounded-xl px-6 py-3 mb-6">
            <div className="text-2xl font-bold flex items-center gap-2">
              {results.competitionRank === 1 && '🥇'}
              {results.competitionRank === 2 && '🥈'}
              {results.competitionRank === 3 && '🥉'}
              {results.competitionRank > 3 && '🏅'}
              #{results.competitionRank} Place!
              {results.competitionBonus > 0 && ` (+${results.competitionBonus} bonus)`}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4 w-full max-w-md">
          <button
            onClick={() => { setGameState('menu'); setCurrentQuiz(null); setResults(null); }}
            className="flex-1 py-4 bg-white/20 rounded-xl font-bold text-lg hover:bg-white/30 transition-all"
          >
            Back to Quizzes
          </button>
          <button
            onClick={() => {
              if (currentQuiz) {
                // Find the original quiz to restart
                const quiz = quizzes.find(q => q.id === currentQuiz.quiz.id);
                if (quiz) startQuiz(quiz);
              }
            }}
            className="flex-1 py-4 bg-white text-purple-600 rounded-xl font-bold text-lg hover:shadow-lg transition-all"
          >
            Play Again!
          </button>
        </div>
      </div>
    );
  }

  return null;
}
