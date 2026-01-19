import React, { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { activitiesAPI } from '../services/api';
import { playSounds } from '../utils/sounds';
import confetti from 'canvas-confetti';
import {
  Brain, Trophy, Star, Clock, ChevronRight, Play, CheckCircle, XCircle,
  Lightbulb, ArrowLeft, Flame, Target, Award, RotateCcw
} from 'lucide-react';
import type {
  LearningSession,
  SessionAttempt,
  ChildActivityStats,
  ActivitySubmissionResult,
  SessionCompletionResult
} from '../types/activities';

// Import activity renderers
import MultipleChoiceActivity from '../components/activities/MultipleChoiceActivity';
import TrueFalseActivity from '../components/activities/TrueFalseActivity';
import FillBlanksActivity from '../components/activities/FillBlanksActivity';
import MatchingActivity from '../components/activities/MatchingActivity';
import SortingActivity from '../components/activities/SortingActivity';
import FlashcardsActivity from '../components/activities/FlashcardsActivity';
import MemoryGameActivity from '../components/activities/MemoryGameActivity';
import ArithmeticActivity from '../components/activities/ArithmeticActivity';
import DragDropActivity from '../components/activities/DragDropActivity';
import WordSearchActivity from '../components/activities/WordSearchActivity';
import CrosswordActivity from '../components/activities/CrosswordActivity';
import ImageHotspotsActivity from '../components/activities/ImageHotspotsActivity';

type GameState = 'menu' | 'loading' | 'playing' | 'feedback' | 'results';

interface ActivityTheme {
  colors: { primary: string; secondary: string; accent: string; background: string };
  mascot: string;
  encouragements: string[];
}

const defaultTheme: ActivityTheme = {
  colors: {
    primary: '#8B5CF6',
    secondary: '#A78BFA',
    accent: '#C4B5FD',
    background: 'from-violet-500 via-purple-500 to-fuchsia-500'
  },
  mascot: '🎯',
  encouragements: ['Great job!', 'Awesome!', 'Keep it up!', 'You\'re doing amazing!', 'Fantastic!']
};

const ActivityPlayer: React.FC = () => {
  const { currentProfile } = useProfile();
  const [gameState, setGameState] = useState<GameState>('menu');
  const [sessions, setSessions] = useState<LearningSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<LearningSession | null>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);
  const [stats, setStats] = useState<ChildActivityStats | null>(null);
  const [recentAttempts, setRecentAttempts] = useState<SessionAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Activity state
  const [currentResponse, setCurrentResponse] = useState<any>(null);
  const [feedbackResult, setFeedbackResult] = useState<ActivitySubmissionResult | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [activityStartTime, setActivityStartTime] = useState<number>(0);

  // Score tracking
  const [score, setScore] = useState({ correct: 0, total: 0, points: 0 });
  const [results, setResults] = useState<SessionCompletionResult | null>(null);

  const theme = defaultTheme;

  // Load data
  useEffect(() => {
    if (currentProfile?.id) {
      loadData();
    }
  }, [currentProfile?.id]);

  const loadData = async () => {
    if (!currentProfile?.id) return;

    try {
      setLoading(true);
      setError(null);

      const [sessionsRes, statsRes, attemptsRes] = await Promise.all([
        activitiesAPI.getChildSessions(currentProfile.id),
        activitiesAPI.getChildStats(currentProfile.id),
        activitiesAPI.getAttemptHistory(currentProfile.id, 5)
      ]);

      setSessions(sessionsRes.data);
      setStats(statsRes.data);
      setRecentAttempts(attemptsRes.data);
    } catch (err: any) {
      console.error('Failed to load activities:', err);
      setError('Failed to load activities. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const startSession = async (session: LearningSession) => {
    if (!currentProfile?.id) return;

    try {
      setGameState('loading');
      setError(null);

      // Load full session with activities
      const sessionRes = await activitiesAPI.getSession(session.id);
      setSelectedSession(sessionRes.data);

      // Start attempt
      const attemptRes = await activitiesAPI.startSession(session.id, currentProfile.id);
      setAttemptId(attemptRes.data.attemptId);

      // Reset state
      setCurrentActivityIndex(0);
      setScore({ correct: 0, total: 0, points: 0 });
      setHintsUsed(0);
      setShowHint(false);
      setCurrentResponse(null);
      setActivityStartTime(Date.now());

      playSounds.quizStart();
      setGameState('playing');
    } catch (err: any) {
      console.error('Failed to start session:', err);
      setError('Failed to start session. Please try again.');
      setGameState('menu');
    }
  };

  const submitActivity = async () => {
    if (!attemptId || !selectedSession?.activities || !currentResponse) return;

    const activity = selectedSession.activities[currentActivityIndex];
    const timeTaken = Math.floor((Date.now() - activityStartTime) / 1000);

    try {
      const result = await activitiesAPI.submitActivity(attemptId, {
        activityId: activity.id,
        userResponse: currentResponse,
        timeTakenSeconds: timeTaken,
        hintsUsed
      });

      setFeedbackResult(result.data);

      // Update score
      setScore(prev => ({
        correct: prev.correct + (result.data.isCorrect ? 1 : 0),
        total: prev.total + 1,
        points: prev.points + result.data.score
      }));

      // Play sound and celebrate
      if (result.data.isCorrect) {
        playSounds.quizCorrect();
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      } else {
        playSounds.quizWrong();
      }

      setGameState('feedback');
    } catch (err: any) {
      console.error('Failed to submit activity:', err);
      setError('Failed to submit answer. Please try again.');
    }
  };

  const nextActivity = () => {
    if (!selectedSession?.activities) return;

    if (currentActivityIndex < selectedSession.activities.length - 1) {
      setCurrentActivityIndex(prev => prev + 1);
      setCurrentResponse(null);
      setFeedbackResult(null);
      setHintsUsed(0);
      setShowHint(false);
      setActivityStartTime(Date.now());
      setGameState('playing');
    } else {
      completeSession();
    }
  };

  const completeSession = async () => {
    if (!attemptId) return;

    try {
      setGameState('loading');
      const result = await activitiesAPI.completeSession(attemptId);
      setResults(result.data);

      if (result.data.passed) {
        playSounds.quizComplete();
        setTimeout(() => confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }), 500);
        setTimeout(() => confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }), 1000);
      }

      setGameState('results');
    } catch (err: any) {
      console.error('Failed to complete session:', err);
      setError('Failed to complete session. Please try again.');
    }
  };

  const useHint = () => {
    setHintsUsed(prev => prev + 1);
    setShowHint(true);
    playSounds.hintReveal();
  };

  const backToMenu = () => {
    setGameState('menu');
    setSelectedSession(null);
    setAttemptId(null);
    setResults(null);
    loadData();
  };

  const currentActivity = selectedSession?.activities?.[currentActivityIndex];

  // Render activity based on type
  const renderActivity = () => {
    if (!currentActivity) return null;

    const commonProps = {
      activity: currentActivity,
      onResponse: setCurrentResponse,
      currentResponse,
      disabled: gameState !== 'playing',
      showFeedback: gameState === 'feedback',
      feedbackResult,
      theme
    };

    switch (currentActivity.activity_type_name) {
      case 'multiple_choice':
        return <MultipleChoiceActivity {...commonProps} />;
      case 'true_false':
        return <TrueFalseActivity {...commonProps} />;
      case 'fill_blanks':
        return <FillBlanksActivity {...commonProps} />;
      case 'matching':
        return <MatchingActivity {...commonProps} />;
      case 'sorting':
        return <SortingActivity {...commonProps} />;
      case 'flashcards':
        return <FlashcardsActivity {...commonProps} />;
      case 'memory_game':
        return <MemoryGameActivity {...commonProps} />;
      case 'arithmetic':
        return <ArithmeticActivity {...commonProps} />;
      case 'drag_drop':
        return <DragDropActivity {...commonProps} />;
      case 'word_search':
        return <WordSearchActivity {...commonProps} />;
      case 'crossword':
        return <CrosswordActivity {...commonProps} />;
      case 'image_hotspots':
        return <ImageHotspotsActivity {...commonProps} />;
      default:
        return (
          <div className="text-center p-8 bg-yellow-50 rounded-xl">
            <p className="text-yellow-800">Activity type "{currentActivity.activity_type_name}" is coming soon!</p>
          </div>
        );
    }
  };

  if (loading && gameState === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-100 via-purple-50 to-fuchsia-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  // MENU STATE
  if (gameState === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-100 via-purple-50 to-fuchsia-100 p-4 pb-24">
        {/* Header */}
        <div className={`bg-gradient-to-r ${theme.colors.background} p-6 rounded-3xl text-white shadow-xl mb-6`}>
          <div className="flex items-center gap-3 mb-2">
            <Brain className="w-7 h-7" />
            <h1 className="text-3xl font-black">Learning Activities!</h1>
          </div>
          <p className="text-white/80 text-sm">Fun ways to learn new things</p>

          {stats && (
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 text-center">
                <Trophy className="w-6 h-6 mx-auto mb-1 text-yellow-300" />
                <div className="text-2xl font-black">{stats.passed_count || 0}</div>
                <div className="text-xs text-white/80">Completed</div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 text-center">
                <Target className="w-6 h-6 mx-auto mb-1 text-green-300" />
                <div className="text-2xl font-black">{Math.round(stats.avg_score || 0)}%</div>
                <div className="text-xs text-white/80">Avg Score</div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 text-center">
                <Star className="w-6 h-6 mx-auto mb-1 text-yellow-300" />
                <div className="text-2xl font-black">{stats.total_points || 0}</div>
                <div className="text-xs text-white/80">Points</div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        {/* Available Sessions */}
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Play className="w-5 h-5 text-purple-600" />
          Available Activities
        </h2>

        {sessions.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-lg">
            <div className="text-6xl mb-4">📚</div>
            <p className="text-gray-600">No activities available yet!</p>
            <p className="text-gray-400 text-sm mt-2">Ask your parent to create some learning activities for you.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map(session => (
              <div
                key={session.id}
                onClick={() => startSession(session)}
                className="bg-white rounded-3xl shadow-lg overflow-hidden transform transition-all hover:scale-[1.02] hover:shadow-xl cursor-pointer group"
              >
                <div className={`bg-gradient-to-r ${theme.colors.background} p-5 relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-white">{session.title}</h3>
                      <p className="text-white/80 text-sm">{session.topic}</p>
                    </div>
                    <span className="text-5xl drop-shadow-lg group-hover:scale-110 transition-transform">
                      {theme.mascot}
                    </span>
                  </div>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div className="flex gap-3">
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">
                      {session.activity_count || 0} activities
                    </span>
                    {session.is_competition === 1 && (
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium flex items-center gap-1">
                        <Flame className="w-3 h-3" /> Competition
                      </span>
                    )}
                    {session.best_score !== null && session.best_score !== undefined && (
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                        Best: {session.best_score}%
                      </span>
                    )}
                  </div>
                  <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-purple-600 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recent Activity */}
        {recentAttempts.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600" />
              Recent Activity
            </h2>
            <div className="space-y-2">
              {recentAttempts.map(attempt => (
                <div key={attempt.id} className="bg-white rounded-xl p-4 shadow flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{attempt.title}</p>
                    <p className="text-sm text-gray-500">{new Date(attempt.completed_at!).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${attempt.passed ? 'text-green-600' : 'text-orange-600'}`}>
                      {attempt.score_percentage}%
                    </p>
                    <p className="text-xs text-gray-500">+{attempt.points_earned} pts</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // LOADING STATE
  if (gameState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-100 via-purple-50 to-fuchsia-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-purple-700 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // PLAYING STATE
  if (gameState === 'playing' || gameState === 'feedback') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-100 via-purple-50 to-fuchsia-100 p-4 pb-24">
        {/* Header */}
        <div className={`bg-gradient-to-r ${theme.colors.background} p-4 rounded-2xl text-white mb-4`}>
          <div className="flex items-center justify-between mb-2">
            <button onClick={backToMenu} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <p className="text-sm text-white/80">{selectedSession?.title}</p>
              <p className="font-bold">{currentActivityIndex + 1} / {selectedSession?.activities?.length}</p>
            </div>
            <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
              <Star className="w-4 h-4 text-yellow-300" />
              <span className="font-bold">{score.points}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-white/30 rounded-full h-2">
            <div
              className="bg-white rounded-full h-2 transition-all duration-500"
              style={{ width: `${((currentActivityIndex + 1) / (selectedSession?.activities?.length || 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Activity Card */}
        <div className="bg-white rounded-3xl shadow-xl p-6 mb-4">
          {/* Activity Header */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{currentActivity?.activity_type_icon || '📝'}</span>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{currentActivity?.title}</h2>
              {currentActivity?.instructions && (
                <p className="text-gray-500 text-sm">{currentActivity.instructions}</p>
              )}
            </div>
          </div>

          {/* Activity Content */}
          {renderActivity()}

          {/* Hint Button */}
          {gameState === 'playing' && currentActivity?.hints && currentActivity.hints.length > 0 && (
            <div className="mt-4">
              {!showHint ? (
                <button
                  onClick={useHint}
                  className="flex items-center gap-2 text-amber-600 hover:text-amber-700 text-sm"
                >
                  <Lightbulb className="w-4 h-4" />
                  Need a hint? ({2 - hintsUsed} remaining)
                </button>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 text-sm">
                  <Lightbulb className="w-4 h-4 inline mr-2" />
                  {currentActivity.hints[Math.min(hintsUsed - 1, currentActivity.hints.length - 1)]}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {gameState === 'playing' && (
            <button
              onClick={submitActivity}
              disabled={!currentResponse}
              className={`flex-1 py-4 rounded-2xl font-bold text-lg transition-all ${
                currentResponse
                  ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-lg hover:shadow-xl'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Check Answer
            </button>
          )}

          {gameState === 'feedback' && (
            <button
              onClick={nextActivity}
              className="flex-1 py-4 rounded-2xl font-bold text-lg bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              {currentActivityIndex < (selectedSession?.activities?.length || 0) - 1 ? (
                <>Continue <ChevronRight className="w-5 h-5" /></>
              ) : (
                <>See Results <Award className="w-5 h-5" /></>
              )}
            </button>
          )}
        </div>

        {/* Feedback Overlay */}
        {gameState === 'feedback' && feedbackResult && (
          <div className={`fixed inset-x-4 top-1/3 transform -translate-y-1/2 p-6 rounded-3xl shadow-2xl z-50 ${
            feedbackResult.isCorrect ? 'bg-green-500' : 'bg-orange-500'
          } text-white text-center animate-bounce`}>
            {feedbackResult.isCorrect ? (
              <>
                <CheckCircle className="w-16 h-16 mx-auto mb-2" />
                <p className="text-2xl font-black">
                  {theme.encouragements[Math.floor(Math.random() * theme.encouragements.length)]}
                </p>
                <p className="text-lg mt-1">+{feedbackResult.score} points!</p>
              </>
            ) : (
              <>
                <XCircle className="w-16 h-16 mx-auto mb-2" />
                <p className="text-2xl font-black">Not quite!</p>
                <p className="text-sm mt-2 opacity-90">{feedbackResult.feedback}</p>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // RESULTS STATE
  if (gameState === 'results' && results) {
    const passed = results.passed;

    return (
      <div className={`min-h-screen bg-gradient-to-br ${passed ? 'from-green-400 via-emerald-500 to-teal-500' : 'from-orange-400 via-amber-500 to-yellow-500'} p-4 flex flex-col items-center justify-center`}>
        <div className="text-center text-white">
          {/* Result Icon */}
          <div className="text-8xl mb-6 animate-bounce">
            {passed ? '🎉' : '📚'}
          </div>

          <h1 className="text-4xl font-black mb-2">
            {passed ? 'Amazing Work!' : 'Good Effort!'}
          </h1>
          <p className="text-xl text-white/80 mb-8">
            {passed ? 'You passed this session!' : 'Keep practicing, you\'ll get it!'}
          </p>

          {/* Score Circle */}
          <div className="relative w-48 h-48 mx-auto mb-8">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="96" cy="96" r="88" stroke="rgba(255,255,255,0.3)" strokeWidth="12" fill="none" />
              <circle
                cx="96" cy="96" r="88"
                stroke="white" strokeWidth="12" fill="none"
                strokeDasharray={553}
                strokeDashoffset={553 - (553 * results.scorePercentage / 100)}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-5xl font-black">{results.scorePercentage}%</div>
              <div className="text-sm text-white/80">Score</div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 mb-8 max-w-md mx-auto">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
              <div className="text-3xl font-black text-green-200">{score.correct}</div>
              <div className="text-xs text-white/80">Correct</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
              <div className="text-3xl font-black text-yellow-200">+{results.pointsEarned}</div>
              <div className="text-xs text-white/80">Points</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
              <div className="text-3xl font-black text-yellow-200">+{results.starsEarned}</div>
              <div className="text-xs text-white/80">Stars</div>
            </div>
          </div>

          {/* Bonuses */}
          {results.timeBonusPoints > 0 && (
            <div className="bg-white/20 rounded-xl px-4 py-2 mb-4 inline-block">
              <Clock className="w-4 h-4 inline mr-2" />
              Speed Bonus: +{results.timeBonusPoints} points!
            </div>
          )}

          {results.competitionRank && (
            <div className="bg-yellow-400/30 rounded-xl px-4 py-2 mb-4 inline-block">
              <Trophy className="w-4 h-4 inline mr-2" />
              {results.competitionRank === 1 ? '1st Place!' : results.competitionRank === 2 ? '2nd Place!' : `${results.competitionRank}th Place`}
              {results.competitionBonus > 0 && ` (+${results.competitionBonus} bonus)`}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center mt-8">
            <button
              onClick={backToMenu}
              className="px-8 py-4 bg-white text-purple-600 rounded-2xl font-bold hover:bg-white/90 transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Menu
            </button>
            {!passed && selectedSession && (
              <button
                onClick={() => startSession(selectedSession)}
                className="px-8 py-4 bg-white/20 text-white rounded-2xl font-bold hover:bg-white/30 transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default ActivityPlayer;
