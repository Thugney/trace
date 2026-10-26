import { useState, useEffect, useRef, useCallback } from 'react';
import { useProfile } from '../context/ProfileContext';
import { familyQuizzesAPI, type FamilyQuiz, type QuizStartResponse, type QuizTheme, type QuizAttempt } from '../services/api';
import { useToast } from '../components/Toast';
import confetti from 'canvas-confetti';
import { Brain, Trophy, Zap, Star, Sparkles, Target, Clock, Play, Pause, RefreshCw, Award, Flame, Square } from 'lucide-react';
import playSounds, { areSoundsEnabled } from '../utils/sounds';

// Leaderboard entry type
interface LeaderboardEntry extends QuizAttempt {
  name: string;
  avatar: string;
}

const playQuizSound = {
  correct: () => playSounds.quizCorrect(),
  wrong: () => playSounds.quizWrong(),
  complete: () => playSounds.quizComplete(),
  start: () => playSounds.quizStart(),
  click: () => playSounds.click(),
  hint: () => playSounds.hintReveal(),
  questionAppear: () => playSounds.questionAppear(),
  timerWarning: () => playSounds.timerWarning()
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
  const profileId = currentProfile?.id;
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
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [score, setScore] = useState({ correct: 0, wrong: 0, points: 0 });
  const [startTime, setStartTime] = useState<number>(0);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [showHint, setShowHint] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const timerIntervalId = useRef<ReturnType<typeof setInterval> | null>(null);
  const [timerStatus, setTimerStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const ambientRef = useRef<{
    ctx: AudioContext;
    gain: GainNode;
    filter: BiquadFilterNode;
    intervalId?: number;
  } | null>(null);

  // Fetch leaderboard for competition quizzes
  const fetchLeaderboard = useCallback(async (quizId: number) => {
    try {
      setLeaderboardLoading(true);
      const response = await familyQuizzesAPI.getLeaderboard(quizId);
      setLeaderboard(response.data);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentQuiz?.quiz.timeLimitSeconds) {
      const remaining = Math.max(0, currentQuiz.quiz.timeLimitSeconds - timerElapsed);
      setTimeRemaining(remaining);
    }
  }, [currentQuiz?.quiz.timeLimitSeconds, timerElapsed]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [quizzesRes, statsRes, attemptsRes] = await Promise.all([
        familyQuizzesAPI.getChildQuizzes(profileId!),
        familyQuizzesAPI.getChildStats(profileId!),
        familyQuizzesAPI.getAttemptHistory(profileId!, 5)
      ]);
      setQuizzes(quizzesRes.data);
      setStats(statsRes.data);
      setRecentAttempts(attemptsRes.data);
    } catch (error) {
      console.error('Failed to load quizzes:', error);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  const stopTimer = useCallback(() => {
    if (timerIntervalId.current) {
      clearInterval(timerIntervalId.current);
      timerIntervalId.current = null;
    }
  }, []);

  const startLocalTimerTick = useCallback(() => {
    stopTimer();
    const interval = setInterval(() => {
      setTimerElapsed(prev => prev + 1);
    }, 1000);
    timerIntervalId.current = interval;
  }, [stopTimer]);

  const loadQuizTimerState = useCallback(async (attemptId: number, limitSeconds: number) => {
    try {
      const response = await familyQuizzesAPI.getTimer(attemptId);
      const timerState = response.data.timer_state;

      if (timerState) {
        const elapsed = timerState.elapsed_seconds || 0;
        setTimerElapsed(elapsed);
        setTimeRemaining(Math.max(0, limitSeconds - elapsed));

        if (timerState.is_running) {
          setTimerStatus('running');
          startLocalTimerTick();
        } else if (timerState.is_paused) {
          setTimerStatus('paused');
        } else {
          setTimerStatus('idle');
        }
      } else {
        setTimerElapsed(0);
        setTimeRemaining(limitSeconds);
        setTimerStatus('idle');
      }
    } catch (error) {
      console.error('Failed to load quiz timer state:', error);
    }
  }, [startLocalTimerTick]);

  const stopAmbient = useCallback(() => {
    const ambient = ambientRef.current;
    if (!ambient) return;
    try {
      if (ambient.intervalId) {
        clearInterval(ambient.intervalId);
      }
      ambient.filter.disconnect();
      ambient.gain.disconnect();
      ambient.ctx.close();
    } catch (error) {
      console.error('Failed to stop quiz ambient sound:', error);
    } finally {
      ambientRef.current = null;
    }
  }, []);

  const completeQuiz = useCallback(async () => {
    if (!attemptId) return;

    stopTimer();
    setTimerStatus('paused');
    const totalTime = timeRemaining !== null ? timerElapsed : Math.round((Date.now() - startTime) / 1000);

    try {
      const response = await familyQuizzesAPI.completeQuiz(attemptId, totalTime);
      setResults(response.data);

      if (response.data.passed) {
        playQuizSound.complete();
        setTimeout(celebrate, 500);
        setTimeout(celebrate, 1000);
      }

      // Fetch leaderboard for competition quizzes
      if (currentQuiz?.quiz.isCompetition) {
        fetchLeaderboard(currentQuiz.quiz.id);
      }

      setGameState('results');
      stopAmbient();
      loadData(); // Refresh stats
    } catch (error) {
      console.error('Failed to complete quiz:', error);
      showToast('Failed to complete quiz', 'error');
    }
  }, [attemptId, timeRemaining, timerElapsed, startTime, currentQuiz, fetchLeaderboard, stopTimer, stopAmbient, loadData, showToast]);

  useEffect(() => {
    if (currentProfile?.id) {
      loadData();
    }
  }, [currentProfile, loadData]);

  // Cleanup the live timer and audio handles on unmount.
  useEffect(() => {
    return () => {
      stopTimer();
      stopAmbient();
    };
  }, [stopTimer, stopAmbient]);

  // Handle timer expiration with the current attempt and elapsed time.
  useEffect(() => {
    if (timeRemaining === 0 && timerStatus === 'running' && gameState !== 'results') {
      stopTimer();
      setTimerStatus('paused');
      showToast('Time\'s up!', 'info');
      completeQuiz();
    }
  }, [timeRemaining, timerStatus, gameState, stopTimer, completeQuiz, showToast]);

  useEffect(() => {
    if (attemptId && currentQuiz?.quiz.timeLimitSeconds) {
      loadQuizTimerState(attemptId, currentQuiz.quiz.timeLimitSeconds);
    }
  }, [attemptId, currentQuiz?.quiz.timeLimitSeconds, loadQuizTimerState]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const initializeTimer = (seconds: number) => {
    stopTimer(); // Clear any existing timer
    setTimerElapsed(0);
    setTimeRemaining(seconds);
    setTimerStatus('idle');
  };

  const startCountdown = async () => {
    if (timeRemaining === null || timeRemaining <= 0 || !attemptId) return;

    try {
      const response = await familyQuizzesAPI.startTimer(attemptId);
      setTimerElapsed(response.data.timer_state.elapsed_seconds || 0);
      setTimerStatus('running');
      startLocalTimerTick();
    } catch (error) {
      console.error('Failed to start timer:', error);
      showToast('Failed to start timer', 'error');
    }
  };

  const startAmbient = async () => {
    if (!areSoundsEnabled() || ambientRef.current) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.value = 1200;
      gain.gain.value = 0.2;

      filter.connect(gain);
      gain.connect(ctx.destination);

      const playChime = (startTime: number) => {
        const notes = [523, 659, 784];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          osc.connect(noteGain);
          noteGain.connect(filter);
          const t = startTime + idx * 0.12;
          noteGain.gain.setValueAtTime(0.0001, t);
          noteGain.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
          noteGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
          osc.start(t);
          osc.stop(t + 0.28);
        });
      };

      playChime(ctx.currentTime + 0.1);
      const intervalId = window.setInterval(() => {
        playChime(ctx.currentTime + 0.05);
      }, 6000);

      ambientRef.current = { ctx, gain, filter, intervalId };
    } catch (error) {
      console.error('Failed to start quiz ambient sound:', error);
    }
  };

  const pauseTimer = async () => {
    if (!attemptId) return;
    try {
      const response = await familyQuizzesAPI.pauseTimer(attemptId);
      setTimerElapsed(response.data.timer_state.elapsed_seconds || 0);
      stopTimer();
      setTimerStatus('paused');
    } catch (error) {
      console.error('Failed to pause timer:', error);
      showToast('Failed to pause timer', 'error');
    }
  };

  const resumeTimer = async () => {
    if (timeRemaining === null || timeRemaining <= 0 || !attemptId) return;
    try {
      const response = await familyQuizzesAPI.resumeTimer(attemptId);
      setTimerElapsed(response.data.timer_state.elapsed_seconds || 0);
      setTimerStatus('running');
      startLocalTimerTick();
    } catch (error) {
      console.error('Failed to resume timer:', error);
      showToast('Failed to resume timer', 'error');
    }
  };

  const startQuiz = async (quiz: FamilyQuiz) => {
    try {
      playQuizSound.start();
      const response = await familyQuizzesAPI.startQuiz(quiz.id, currentProfile!.id);
      setCurrentQuiz(response.data);
      startAmbient();
      if (response.data.quiz.timeLimitSeconds) {
        initializeTimer(response.data.quiz.timeLimitSeconds);
      } else {
        setTimeRemaining(null);
        setTimerElapsed(0);
        setTimerStatus('idle');
      }
      setAttemptId(response.data.attemptId);
      setCurrentQuestionIndex(0);
      setScore({ correct: 0, wrong: 0, points: 0 });
      setCorrectAnswer(null);
      setStartTime(Date.now());
      setQuestionStartTime(Date.now());
      setGameState('playing');
    } catch (error) {
      console.error('Failed to start quiz:', error);
      const message = (error as any)?.response?.data?.error || 'Failed to start quiz';
      showToast(message, 'error');
    }
  };

  const handleAnswerSelect = (answerId: string) => {
    if (gameState !== 'playing') return;
    if (timeRemaining !== null && timerStatus !== 'running') {
      showToast(timerStatus === 'paused' ? 'Resume the timer to continue!' : 'Start the timer to begin!', 'info');
      return;
    }
    playQuizSound.click();
    setSelectedAnswer(answerId);
  };

  const submitAnswer = async () => {
    if (timeRemaining !== null && timerStatus !== 'running') return;
    if (!selectedAnswer || !currentQuiz || !attemptId) return;

    const question = currentQuiz.questions[currentQuestionIndex];
    const timeTaken = Math.round((Date.now() - questionStartTime) / 1000);

    try {
      const response = await familyQuizzesAPI.submitAnswer(attemptId, question.id, selectedAnswer, timeTaken);
      setIsCorrect(response.data.isCorrect);
      setExplanation(response.data.explanation || null);
      setCorrectAnswer(response.data.correctAnswer || null);

      if (response.data.isCorrect) {
        playQuizSound.correct();
        celebrate();
        setScore(prev => ({
          ...prev,
          correct: prev.correct + 1,
          points: prev.points + response.data.points
        }));
      } else {
        playQuizSound.wrong();
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
      setCorrectAnswer(null);
      setExplanation(null);
      setShowHint(false);
      setQuestionStartTime(Date.now());
      setGameState('playing');
    }
  };

  const handleExitQuiz = async () => {
    stopTimer();
    stopAmbient();
    if (attemptId && timerStatus === 'running') {
      try {
        await familyQuizzesAPI.pauseTimer(attemptId);
      } catch (error) {
        console.error('Failed to pause quiz timer:', error);
      }
    }
    setTimeRemaining(null);
    setTimerElapsed(0);
    setTimerStatus('idle');
    setAttemptId(null);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setCorrectAnswer(null);
    setExplanation(null);
    setShowHint(false);
    setGameState('menu');
    setCurrentQuiz(null);
  };

  const stopQuizEarly = () => {
    if (!attemptId) return;
    const confirmed = confirm('Stop the quiz and see your results now?');
    if (!confirmed) return;
    completeQuiz();
  };

  const getTheme = (): QuizTheme => {
    const fallback: QuizTheme = {
      colors: { primary: '#8B5CF6', secondary: '#7C3AED', accent: '#FCD34D', background: 'from-purple-500 to-indigo-600' },
      mascot: '??',
      animations: ['bounce', 'pulse', 'spin', 'wiggle', 'tada', 'jelly', 'heartbeat', 'float', 'jiggle', 'wiggle-more'],
      sounds: { correct: 'sparkle', wrong: 'soft_miss', complete: 'celebration' },
      encouragements: ['Great job!', 'Amazing!', 'Wonderful!', 'You rock!', 'Fantastic!', 'Super smart!', 'Way to go!', 'You are a star!', 'Brilliant!', 'Outstanding!']
    };
    if (!currentQuiz?.theme) return fallback;
    return {
      ...fallback,
      ...currentQuiz.theme,
      colors: { ...fallback.colors, ...(currentQuiz.theme.colors || {}) },
      sounds: { ...fallback.sounds, ...(currentQuiz.theme.sounds || {}) },
      encouragements: currentQuiz.theme.encouragements?.length
        ? currentQuiz.theme.encouragements
        : fallback.encouragements
    };
  };

  const isLightGradient = (background?: string) => {
    if (!background) return false;
    // Check for light color stops (50-400 range are typically light)
    const lightBase = /(from|to|via)-(?:white|slate|gray|neutral|zinc|stone|sky|blue|cyan|teal|emerald|green|lime|yellow|amber|orange|red|rose|pink|fuchsia|purple|violet|indigo)-(?:50|100|200|300|400)\b/;
    // Bright warm colors at 500 level that still need dark text
    const warmBright = /(from|to|via)-(?:yellow|amber|lime|cyan)-(?:500|600)\b/;
    // Explicit white backgrounds
    const whiteBackground = /(from|to|via)-white\b|bg-white/;
    return lightBase.test(background) || warmBright.test(background) || whiteBackground.test(background);
  };

  const getEncouragement = () => {
    const theme = getTheme();
    if (theme.encouragements.length === 0) {
      return 'Great job!';
    }
    const idx = Math.floor(Math.random() * theme.encouragements.length);
    return theme.encouragements[idx];
  };

  const getRandomAnimation = () => {
    const theme = getTheme();
    if (theme.animations.length === 0) {
      return 'animate-pulse';
    }
    const idx = Math.floor(Math.random() * theme.animations.length);
    return `animate-${theme.animations[idx]}`;
  };

  const renderShape = (shape?: string, color?: string) => {
    if (!shape) return null;
    const fillColor = color || '#F59E0B';
    const normalized = shape.toLowerCase();

    if (normalized === 'triangle') {
      return (
        <div
          className="w-0 h-0"
          style={{
            borderLeft: '18px solid transparent',
            borderRight: '18px solid transparent',
            borderBottom: `32px solid ${fillColor}`
          }}
          aria-label={shape}
        />
      );
    }

    if (normalized === 'diamond') {
      return (
        <div
          className="w-8 h-8 rotate-45 rounded-sm"
          style={{ backgroundColor: fillColor }}
          aria-label={shape}
        />
      );
    }

    if (normalized === 'rectangle') {
      return (
        <div
          className="w-10 h-6 rounded-sm"
          style={{ backgroundColor: fillColor }}
          aria-label={shape}
        />
      );
    }

    if (normalized === 'oval') {
      return (
        <div
          className="w-10 h-6 rounded-full"
          style={{ backgroundColor: fillColor }}
          aria-label={shape}
        />
      );
    }

    if (normalized === 'circle') {
      return (
        <div
          className="w-8 h-8 rounded-full"
          style={{ backgroundColor: fillColor }}
          aria-label={shape}
        />
      );
    }

    return (
      <div
        className="w-8 h-8 rounded-md"
        style={{ backgroundColor: fillColor }}
        aria-label={shape}
      />
    );
  };

  const renderOptionContent = (option: any) => {
    const hasText = Boolean(option.text && option.text.trim());
    const hasImage = Boolean(option.image);
    const hasColor = Boolean(option.color);
    const hasShape = Boolean(option.shape);

    return (
      <div className="flex items-center gap-3">
        {hasImage && (
          <img
            src={option.image}
            alt={hasText ? option.text : `Option ${option.id}`}
            className="w-14 h-14 rounded-lg object-cover border"
          />
        )}
        {hasShape && renderShape(option.shape, option.color)}
        {!hasShape && hasColor && (
          <span
            className="w-8 h-8 rounded-full border"
            style={{ backgroundColor: option.color }}
            title={option.color}
          />
        )}
        {hasText ? (
          <span className="text-lg">{option.text}</span>
        ) : (
          !hasImage && !hasColor && !hasShape && (
            <span className="text-sm text-gray-500">Option {option.id.toUpperCase()}</span>
          )
        )}
      </div>
    );
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
      colors: { primary: '#8B5CF6', secondary: '#7C3AED', accent: '#FCD34D', background: 'from-violet-500 via-purple-500 to-fuchsia-500' }
    };

    return (
      <div className="space-y-6">
        {/* Fun Header with Brain Icon */}
        <div className={`bg-gradient-to-r ${theme.colors.background} p-6 rounded-3xl text-white relative overflow-hidden shadow-xl`}>
          {/* Floating decorations */}
          <div className="absolute top-2 right-8 text-4xl animate-float opacity-30">🌟</div>
          <div className="absolute bottom-4 right-20 text-3xl animate-bounce opacity-30">✨</div>
          <div className="absolute top-10 right-32 text-2xl animate-pulse opacity-20">💫</div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <Brain className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black">Brain Games!</h1>
                <p className="opacity-90 text-white/80">Test your super brain powers!</p>
              </div>
            </div>

            {stats?.overall && (
              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 text-center transform hover:scale-105 transition-transform">
                  <Trophy className="w-6 h-6 mx-auto mb-1 text-yellow-300" />
                  <div className="text-2xl font-black">{stats.overall.quizzes_passed || 0}</div>
                  <div className="text-xs text-white/80 font-medium">Victories</div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 text-center transform hover:scale-105 transition-transform">
                  <Zap className="w-6 h-6 mx-auto mb-1 text-yellow-300 fill-yellow-300" />
                  <div className="text-2xl font-black">{stats.overall.total_points_earned || 0}</div>
                  <div className="text-xs text-white/80 font-medium">Points</div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 text-center transform hover:scale-105 transition-transform">
                  <Award className="w-6 h-6 mx-auto mb-1 text-amber-300" />
                  <div className="text-2xl font-black">{stats.overall.first_places || 0}</div>
                  <div className="text-xs text-white/80 font-medium">1st Place</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Available Quizzes */}
        {quizzes.length === 0 ? (
          <div className="text-center py-16 bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl border-2 border-dashed border-purple-200">
            <div className="text-7xl mb-4 animate-bounce">🧠</div>
            <h3 className="text-2xl font-black text-purple-800 mb-2">No quizzes yet!</h3>
            <p className="text-purple-600">Ask your parents to create some fun brain games for you!</p>
            <div className="mt-4 flex justify-center gap-2">
              <span className="text-2xl animate-pulse">📚</span>
              <span className="text-2xl animate-bounce" style={{ animationDelay: '0.1s' }}>✏️</span>
              <span className="text-2xl animate-pulse" style={{ animationDelay: '0.2s' }}>🎯</span>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Ready to Play!
              <span className="text-sm font-normal text-gray-500">({quizzes.length} games)</span>
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {quizzes.map((quiz, index) => {
                const quizTheme = quiz.theme;
                const bgGradient = quizTheme?.colors?.background || 'from-purple-500 to-indigo-600';
                const isLightCard = isLightGradient(bgGradient);
                const hasPlayed = (quiz.my_attempts ?? 0) > 0;
                const hasPassed = quiz.last_passed === 1 || (quiz.best_score != null && quiz.best_score >= quiz.pass_threshold);
                const canPlay = !hasPassed;

                return (
                  <div
                    key={quiz.id}
                    className={`bg-white rounded-3xl shadow-lg overflow-hidden transition-all transform group animate-quiz-enter ${
                      canPlay ? 'hover:shadow-2xl cursor-pointer hover:scale-[1.02]' : 'opacity-70 cursor-not-allowed'
                    }`}
                    style={{ animationDelay: `${index * 100}ms` }}
                    onClick={() => {
                      if (canPlay) startQuiz(quiz);
                    }}
                  >
                    <div className={`bg-gradient-to-r ${bgGradient} p-5 relative overflow-hidden ${isLightCard ? 'text-slate-900' : 'text-white'}`}>
                      {/* Shine effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

                      <div className="flex items-center justify-between relative z-10">
                        <span className="text-5xl drop-shadow-lg group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300">{quiz.category_icon}</span>
                        <div className="flex flex-col items-end gap-1">
                          {quiz.is_competition === 1 && (
                            <span className="px-3 py-1 bg-yellow-400 text-yellow-900 text-xs rounded-full font-black flex items-center gap-1 animate-pulse">
                              <Flame className="w-3 h-3" /> RACE!
                            </span>
                          )}
                          {hasPlayed && quiz.best_score !== null && (
                            <span className="px-2 py-1 bg-green-400 text-green-900 text-xs rounded-full font-bold">
                              Best: {quiz.best_score}%
                            </span>
                          )}
                          {hasPassed && (
                            <span className="px-2 py-1 bg-white/80 text-purple-700 text-xs rounded-full font-bold">
                              Completed
                            </span>
                          )}
                        </div>
                      </div>
                      <h3 className={`text-xl font-black mt-3 ${isLightCard ? 'text-slate-900' : 'text-white drop-shadow-md'}`}>{quiz.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-sm font-medium ${isLightCard ? 'text-slate-700' : 'text-white/90 drop-shadow-sm'}`}>{quiz.question_count} questions</span>
                        {quiz.time_limit_seconds && (
                          <span className={`flex items-center gap-1 text-xs ${isLightCard ? 'text-slate-600' : 'text-white/70'}`}>
                            <Clock className="w-3 h-3" /> {Math.floor(quiz.time_limit_seconds / 60)}min
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <span className="flex items-center gap-2 text-amber-600 font-bold">
                          <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
                          {quiz.points_per_correct} pts per answer
                        </span>
                        {quiz.stars_per_correct > 0 && (
                          <span className="flex items-center gap-1 text-yellow-600 font-medium text-sm">
                            <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                            +{quiz.stars_per_correct}
                          </span>
                        )}
                      </div>

                      <button
                        disabled={!canPlay}
                        className={`w-full py-4 rounded-2xl font-black text-lg shadow-lg transition-all transform flex items-center justify-center gap-2 ${
                          canPlay
                            ? isLightCard
                              ? `bg-gradient-to-r ${bgGradient} text-slate-900 ring-1 ring-slate-900/10 hover:shadow-xl hover:scale-105`
                              : `bg-gradient-to-r ${bgGradient} text-white hover:shadow-xl hover:scale-105`
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {hasPassed ? (
                          <>
                            <Trophy className="w-5 h-5" /> Completed!
                          </>
                        ) : hasPlayed ? (
                          <>
                            <RefreshCw className="w-5 h-5" /> Play Again!
                          </>
                        ) : (
                          <>
                            <Play className="w-5 h-5 fill-white" /> Start Quiz!
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Attempts - Enhanced */}
        {recentAttempts.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-5">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-500" />
              Recent Games
            </h3>
            <div className="space-y-3">
              {recentAttempts.map((attempt, index) => (
                <div
                  key={attempt.id}
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl hover:shadow-md transition-all"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{attempt.category_icon}</span>
                    <div>
                      <div className="font-bold text-gray-800">{attempt.quiz_title}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(attempt.completed_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xl font-black ${attempt.passed ? 'text-green-600' : 'text-gray-500'}`}>
                      {attempt.score_percentage}%
                      {attempt.passed && <span className="ml-1">✅</span>}
                    </div>
                    <div className="text-sm text-amber-600 font-medium flex items-center gap-1 justify-end">
                      <Zap className="w-3 h-3 fill-amber-500" />
                      +{attempt.points_earned}
                    </div>
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
    const isLightTheme = isLightGradient(theme.colors.background);
    const headerSubTextClass = isLightTheme ? 'text-slate-700' : 'text-white/80';
    const headerPillClass = isLightTheme ? 'bg-white/85 text-slate-900' : 'bg-black/30 text-white';
    const hudClass = isLightTheme ? 'bg-white/85 text-slate-900' : 'bg-white/20 text-white';
    const scoreValueClass = isLightTheme ? 'text-emerald-700' : 'text-green-300';
    const pointsValueClass = isLightTheme ? 'text-amber-700' : 'text-yellow-300';
    const feedbackTextClass = isLightTheme ? 'text-slate-900' : 'text-white';
    const progressBgClass = isLightTheme ? 'bg-slate-900/20' : 'bg-white/20';
    const progressFillClass = isLightTheme ? 'bg-slate-900' : 'bg-white';
    const question = currentQuiz.questions[currentQuestionIndex];
    const questionText = (((question as any).questionText || question.question_text || `Question ${currentQuestionIndex + 1}`) as string).toString();
    const questionImage = (question as any).questionImage || question.question_image;
    const questionAudio = (question as any).questionAudio || question.question_audio;
    const progress = ((currentQuestionIndex + 1) / currentQuiz.questions.length) * 100;
    const mascotAnimation = getRandomAnimation();
    const feedbackAnimation = getRandomAnimation();

    return (
      <div className={`min-h-[80vh] bg-gradient-to-br ${theme.colors.background} rounded-2xl p-6 ${isLightTheme ? 'text-slate-900' : 'text-white'}`}>
        {/* Header with Quiz Title - More Prominent */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleExitQuiz}
            className={`p-2 rounded-lg transition-colors ${isLightTheme ? 'hover:bg-slate-900/10' : 'hover:bg-white/20'}`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {/* Quiz Title - Enhanced visibility across all themes including Alphabet */}
          <div className={`text-center px-4 sm:px-6 py-2 sm:py-3 rounded-2xl backdrop-blur-sm shadow-lg border ${headerPillClass} ${isLightTheme ? 'border-slate-200' : 'border-white/20'}`}>
            <div className="text-base sm:text-lg md:text-xl font-black leading-tight">{currentQuiz.quiz.title}</div>
            <div className={`text-xs sm:text-sm font-medium ${headerSubTextClass}`}>Question {currentQuestionIndex + 1} of {currentQuiz.totalQuestions}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl ${mascotAnimation}`}>{theme.mascot}</span>
          </div>
        </div>

        {/* Timer Display - Enhanced */}
        {timeRemaining !== null && (
          <div className="flex flex-col items-center gap-3 mb-4">
            <div className={`px-6 py-3 rounded-xl font-bold text-xl shadow-lg ${
              timeRemaining < 30 ? 'bg-red-500/90 text-white animate-pulse' : `${hudClass} backdrop-blur-sm`
            }`}>
              <Clock className="w-5 h-5 inline-block mr-2" />
              {formatTime(timeRemaining)}
            </div>
            <div className="flex items-center gap-2">
              {timerStatus === 'idle' && (
                <button
                  onClick={startCountdown}
                  className={`px-6 py-3 rounded-full text-base font-black shadow-lg transition-all transform hover:scale-105 animate-pulse ${
                    isLightTheme ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-green-500 text-white hover:bg-green-400'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Play className="w-5 h-5 fill-white" /> START TIMER TO BEGIN!
                  </span>
                </button>
              )}
              {timerStatus === 'running' && (
                <>
                  <button
                    onClick={pauseTimer}
                    className={`px-4 py-2 rounded-full text-sm font-bold shadow-sm transition-all ${
                      isLightTheme ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-purple-600 hover:bg-white/90'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Pause className="w-4 h-4" /> Pause
                    </span>
                  </button>
                  <button
                    onClick={stopQuizEarly}
                    className={`px-4 py-2 rounded-full text-sm font-bold shadow-sm transition-all ${
                      isLightTheme ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-red-500 text-white hover:bg-red-400'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Square className="w-4 h-4" /> Stop
                    </span>
                  </button>
                </>
              )}
              {timerStatus === 'paused' && timeRemaining > 0 && (
                <>
                  <button
                    onClick={resumeTimer}
                    className={`px-4 py-2 rounded-full text-sm font-bold shadow-sm transition-all ${
                      isLightTheme ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-white text-purple-600 hover:bg-white/90'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Play className="w-4 h-4" /> Resume
                    </span>
                  </button>
                  <button
                    onClick={stopQuizEarly}
                    className={`px-4 py-2 rounded-full text-sm font-bold shadow-sm transition-all ${
                      isLightTheme ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-red-500 text-white hover:bg-red-400'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Square className="w-4 h-4" /> Stop
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className={`w-full h-2 ${progressBgClass} rounded-full mb-6`}>
          <div
            className={`h-2 ${progressFillClass} rounded-full transition-all duration-500`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Score Display - Enhanced visibility for all quiz types including Alphabet */}
        <div className="flex justify-center gap-2 sm:gap-4 mb-6 flex-wrap">
          <div className={`${hudClass} backdrop-blur-sm rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-center shadow-lg border ${isLightTheme ? 'border-slate-200' : 'border-white/20'}`}>
            <div className={`text-xs font-medium ${isLightTheme ? 'text-slate-600' : 'opacity-80'}`}>Correct</div>
            <div className={`text-xl sm:text-2xl font-black ${scoreValueClass}`}>{score.correct}</div>
          </div>
          <div className={`${hudClass} backdrop-blur-sm rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-center shadow-lg border ${isLightTheme ? 'border-slate-200' : 'border-white/20'}`}>
            <div className={`text-xs font-medium ${isLightTheme ? 'text-slate-600' : 'opacity-80'}`}>Points</div>
            <div className={`text-xl sm:text-2xl font-black ${pointsValueClass}`}>
              {score.points}
              <span className={`text-[10px] sm:text-xs font-normal ml-1 ${isLightTheme ? 'text-slate-500' : 'opacity-60'}`}>
                (+{currentQuiz.quiz.pointsPerCorrect}/ea)
              </span>
            </div>
          </div>
          {currentQuiz.quiz.starsPerCorrect > 0 && (
            <div className={`${hudClass} backdrop-blur-sm rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-center shadow-lg border ${isLightTheme ? 'border-slate-200' : 'border-white/20'}`}>
              <div className={`text-xs font-medium ${isLightTheme ? 'text-slate-600' : 'opacity-80'}`}>Stars</div>
              <div className="text-xl sm:text-2xl font-black text-yellow-500 flex items-center justify-center gap-1">
                <Star className="w-4 sm:w-5 h-4 sm:h-5 fill-yellow-400" />
                <span>+{currentQuiz.quiz.starsPerCorrect}</span>
              </div>
            </div>
          )}
        </div>

        {/* Question */}
        <div className="bg-white rounded-2xl p-6 text-slate-900 mb-6 shadow-xl">
          <h2 className="text-xl font-bold text-center mb-6 text-slate-900">{questionText}</h2>

          {questionImage && (
            <div className="flex justify-center mb-6">
              <img src={questionImage} alt="Question" className="max-h-40 rounded-lg" />
            </div>
          )}

          {questionAudio && (
            <div className="flex justify-center mb-6">
              <audio controls className="w-full max-w-md">
                <source src={questionAudio} />
                Your browser does not support audio.
              </audio>
            </div>
          )}

          {/* Options */}
          <div className="grid grid-cols-1 gap-3">
            {question.options.map((option) => {
              const isSelected = selectedAnswer === option.id;
              const isThisCorrect = gameState === 'feedback' && isCorrect && isSelected;
              const isThisWrong = gameState === 'feedback' && !isCorrect && isSelected;
              const correctAnswerId = correctAnswer || (question as any).correctAnswer || (question as any).correct_answer;
              const showAsCorrect = gameState === 'feedback' && option.id === correctAnswerId;

              const optionTextClass = isSelected
                ? isLightTheme
                  ? 'text-slate-900'
                  : 'text-white'
                : 'text-slate-900';

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
                  ? `bg-gradient-to-r ${theme.colors.background} ${isLightTheme ? 'text-slate-900' : 'text-white'} shadow-md`
                  : 'bg-gray-100 hover:bg-gray-200 hover:scale-102'
              } ${optionTextClass}`}
                >
                  <div className="flex items-center gap-3">
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
                    {renderOptionContent(option)}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Hint Button */}
          {question.hint && gameState === 'playing' && !showHint && (
            <button
              onClick={() => { playQuizSound.hint(); setShowHint(true); }}
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
            className={`w-full py-4 rounded-xl font-bold text-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 ${
              isLightTheme ? 'bg-slate-900 text-white' : 'bg-white text-purple-600'
            }`}
          >
            Submit Answer
          </button>
        )}

        {gameState === 'feedback' && (
          <div className="text-center">
            <div className={`text-3xl font-bold mb-4 ${feedbackTextClass} ${isCorrect ? feedbackAnimation : ''}`}>
              {isCorrect ? getEncouragement() : 'Not quite!'}
            </div>
            <button
              onClick={nextQuestion}
              className={`w-full py-4 rounded-xl font-bold text-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 ${
                isLightTheme ? 'bg-slate-900 text-white' : 'bg-white text-purple-600'
              }`}
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
    const resultsAnimation = getRandomAnimation();

    return (
      <div className={`min-h-[80vh] bg-gradient-to-br ${passed ? 'from-green-400 to-emerald-600' : 'from-gray-400 to-gray-600'} rounded-2xl p-6 text-white flex flex-col items-center justify-center`}>
        <div className={`text-8xl mb-6 ${resultsAnimation}`}>
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

        {results.timeTakenSeconds != null && (
          <div className="mb-6 bg-white/20 backdrop-blur-sm rounded-lg px-6 py-3">
            <div className="text-lg font-bold">Time Taken {formatTime(results.timeTakenSeconds)}</div>
            <div className="text-xs opacity-80">Great effort!</div>
          </div>
        )}

        {results.timeBonusPoints > 0 && (
          <div className="mb-6 bg-white/20 backdrop-blur-sm rounded-lg px-6 py-3">
            <div className="text-lg font-bold">Time Bonus +{results.timeBonusPoints}</div>
            <div className="text-xs opacity-80">Great speed!</div>
          </div>
        )}

        {/* Competition Rank & Leaderboard */}
        {results.competitionRank && (
          <div className="w-full max-w-md mb-6">
            {/* Your Rank */}
            <div className="bg-yellow-400 text-yellow-900 rounded-xl px-6 py-3 mb-4">
              <div className="text-2xl font-bold flex items-center justify-center gap-2">
                {results.competitionRank === 1 && '🥇'}
                {results.competitionRank === 2 && '🥈'}
                {results.competitionRank === 3 && '🥉'}
                {results.competitionRank > 3 && '🏅'}
                #{results.competitionRank} Place!
                {results.competitionBonus > 0 && ` (+${results.competitionBonus} bonus)`}
              </div>
            </div>

            {/* Leaderboard */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  Leaderboard
                </h3>
                <button
                  onClick={() => currentQuiz && fetchLeaderboard(currentQuiz.quiz.id)}
                  className="text-xs bg-white/20 px-2 py-1 rounded-lg hover:bg-white/30 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${leaderboardLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {leaderboardLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center text-white/60 py-4 text-sm">
                  No rankings yet. Be the first to complete!
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.slice(0, 5).map((entry, idx) => {
                    const isCurrentUser = entry.profile_id === currentProfile?.id;
                    const rank = entry.competition_rank || idx + 1;

                    return (
                      <div
                        key={entry.id}
                        className={`flex items-center gap-3 p-2 rounded-lg transition-all ${
                          isCurrentUser
                            ? 'bg-yellow-400/30 border border-yellow-400/50'
                            : 'bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        {/* Rank */}
                        <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${
                          rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                          rank === 2 ? 'bg-gray-300 text-gray-800' :
                          rank === 3 ? 'bg-orange-400 text-orange-900' :
                          'bg-white/20 text-white'
                        }`}>
                          {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                        </div>

                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                          {entry.avatar ? (
                            <img src={entry.avatar} alt={entry.name} className="w-full h-full object-cover" />
                          ) : (
                            entry.name?.charAt(0)?.toUpperCase()
                          )}
                        </div>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium truncate ${isCurrentUser ? 'text-yellow-200' : ''}`}>
                            {entry.name} {isCurrentUser && '(You)'}
                          </div>
                          <div className="text-xs text-white/60">
                            {entry.score_percentage}% • {Math.floor((entry.time_taken_seconds || 0) / 60)}:{String((entry.time_taken_seconds || 0) % 60).padStart(2, '0')}
                          </div>
                        </div>

                        {/* Points */}
                        <div className="text-right">
                          <div className="font-bold text-yellow-300">{entry.points_earned}</div>
                          <div className="text-xs text-white/60">pts</div>
                        </div>
                      </div>
                    );
                  })}

                  {leaderboard.length > 5 && (
                    <div className="text-center text-xs text-white/50 pt-2">
                      +{leaderboard.length - 5} more participants
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4 w-full max-w-md">
          <button
            onClick={() => {
              handleExitQuiz();
              setResults(null);
            }}
            className="flex-1 py-4 bg-white/20 rounded-xl font-bold text-lg hover:bg-white/30 transition-all"
          >
            Back to Quizzes
          </button>
          {!passed && (
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
          )}
        </div>
      </div>
    );
  }

  return null;
}
