import { useState, useEffect, useCallback, useRef } from 'react';
import { Timer, Zap, Trophy, Play, CheckCircle } from 'lucide-react';
import { gamificationAPI, CountdownChallenge } from '../services/api';
import playSounds from '../utils/sounds';

interface CountdownChallengeCardProps {
  profileId: number;
  onChallengeComplete?: () => void;
}

export default function CountdownChallengeCard({ profileId, onChallengeComplete }: CountdownChallengeCardProps) {
  const [challenge, setChallenge] = useState<CountdownChallenge | null>(null);
  const [stats, setStats] = useState({ totalCompleted: 0, totalBonusEarned: 0 });
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  // Latest committed challenge and completion callback, read by loadChallenge
  // without making it reactive: the load must only re-run for a new profile
  // (or an expiry reload), not whenever the challenge or parent callback changes.
  const challengeRef = useRef(challenge);
  const onChallengeCompleteRef = useRef(onChallengeComplete);
  useEffect(() => {
    challengeRef.current = challenge;
    onChallengeCompleteRef.current = onChallengeComplete;
  });

  const loadChallenge = useCallback(async () => {
    try {
      const res = await gamificationAPI.getCountdownChallenge(profileId);
      const newChallenge = res.data.active;
      const previous = challengeRef.current;

      // Check if challenge just completed
      if (previous && !previous.completed && newChallenge?.completed) {
        onChallengeCompleteRef.current?.();
      }

      setChallenge(newChallenge);
      setStats(res.data.stats);
    } catch (error) {
      console.error('Failed to load countdown challenge:', error);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadChallenge();
  }, [loadChallenge]);

  // Timer countdown effect
  useEffect(() => {
    if (!challenge || challenge.completed) {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(challenge.expires_at).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        loadChallenge(); // Reload to get updated status
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ hours, minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [challenge, loadChallenge]);

  const startChallenge = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const res = await gamificationAPI.startCountdownChallenge(profileId);
      setChallenge(res.data.challenge);
      playSounds.click();
    } catch (error: any) {
      console.error('Failed to start challenge:', error);
      if (error.response?.data?.active) {
        setChallenge(error.response.data.active);
      }
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl p-5 bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200 animate-pulse">
        <div className="h-6 bg-red-200 rounded w-3/4 mb-3"></div>
        <div className="h-4 bg-red-100 rounded w-1/2"></div>
      </div>
    );
  }

  // No active challenge - show start button
  if (!challenge) {
    return (
      <div className="rounded-2xl p-5 bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-200">
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
          <Timer className="text-red-500" size={24} />
          Countdown Challenge
        </h3>

        <div className="text-center py-4">
          <div className="text-5xl mb-3">⏱️</div>
          <p className="text-gray-700 mb-2">Ready for a timed challenge?</p>
          <p className="text-sm text-gray-500 mb-4">
            Complete tasks before time runs out for bonus points!
          </p>

          <button
            onClick={startChallenge}
            disabled={starting}
            className="px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl font-bold text-lg hover:from-red-600 hover:to-orange-600 transition-all shadow-lg disabled:opacity-50 flex items-center gap-2 mx-auto"
          >
            {starting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play size={20} />
                Start Challenge!
              </>
            )}
          </button>
        </div>

        {stats.totalCompleted > 0 && (
          <div className="mt-4 pt-4 border-t border-red-200 flex justify-center gap-6 text-sm">
            <div className="text-center">
              <div className="font-bold text-red-600">{stats.totalCompleted}</div>
              <div className="text-gray-500">Completed</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-orange-600">+{stats.totalBonusEarned}</div>
              <div className="text-gray-500">Bonus Points</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Challenge completed
  if (challenge.completed) {
    return (
      <div className="rounded-2xl p-5 bg-gradient-to-br from-green-100 to-emerald-100 border-2 border-green-300">
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
          <Trophy className="text-green-600" size={24} />
          Challenge Complete!
        </h3>

        <div className="text-center py-4">
          <div className="text-6xl mb-3 animate-bounce">🎉</div>
          <p className="text-xl font-bold text-green-700 mb-2">Amazing!</p>
          <p className="text-green-600">
            You earned <span className="font-bold">+{challenge.bonus_points_awarded}</span> bonus points!
          </p>
        </div>

        <button
          onClick={startChallenge}
          disabled={starting}
          className="w-full mt-4 px-4 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors"
        >
          Start New Challenge
        </button>
      </div>
    );
  }

  // Active challenge
  const progress = (challenge.completed_tasks / challenge.target_tasks) * 100;
  const isExpired = timeLeft && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0;

  return (
    <div className={`rounded-2xl p-5 border-2 ${
      isExpired
        ? 'bg-gradient-to-br from-gray-100 to-gray-200 border-gray-300'
        : 'bg-gradient-to-br from-red-50 to-orange-50 border-red-300'
    }`}>
      <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
        <Timer className={isExpired ? 'text-gray-500' : 'text-red-500'} size={24} />
        {challenge.title}
      </h3>

      {/* Timer Display */}
      {timeLeft && !isExpired && (
        <div className="flex justify-center gap-2 mb-4">
          <div className="bg-red-500 text-white px-3 py-2 rounded-lg text-center min-w-[60px]">
            <div className="text-2xl font-bold">{String(timeLeft.hours).padStart(2, '0')}</div>
            <div className="text-xs opacity-80">hrs</div>
          </div>
          <div className="text-2xl font-bold text-red-500 self-center">:</div>
          <div className="bg-red-500 text-white px-3 py-2 rounded-lg text-center min-w-[60px]">
            <div className="text-2xl font-bold">{String(timeLeft.minutes).padStart(2, '0')}</div>
            <div className="text-xs opacity-80">min</div>
          </div>
          <div className="text-2xl font-bold text-red-500 self-center">:</div>
          <div className="bg-red-500 text-white px-3 py-2 rounded-lg text-center min-w-[60px]">
            <div className="text-2xl font-bold">{String(timeLeft.seconds).padStart(2, '0')}</div>
            <div className="text-xs opacity-80">sec</div>
          </div>
        </div>
      )}

      {isExpired && (
        <div className="text-center py-4">
          <div className="text-4xl mb-2">⏰</div>
          <p className="text-gray-600 font-medium">Time's up!</p>
        </div>
      )}

      {/* Challenge Info */}
      <div className="bg-white/70 rounded-xl p-3 mb-3">
        <p className="text-sm text-gray-700 mb-2">{challenge.description}</p>
        <div className="flex items-center gap-2">
          <Zap className="text-yellow-500" size={16} />
          <span className="text-sm font-medium text-yellow-700">
            {challenge.bonus_multiplier}x points bonus on completion!
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-2">
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium">Progress</span>
          <span className="font-bold">{challenge.completed_tasks}/{challenge.target_tasks} tasks</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              isExpired ? 'bg-gray-400' : 'bg-gradient-to-r from-red-500 to-orange-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Task checkmarks */}
      <div className="flex justify-center gap-2 mt-3">
        {Array.from({ length: challenge.target_tasks }).map((_, i) => (
          <div
            key={i}
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              i < challenge.completed_tasks
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-400'
            }`}
          >
            {i < challenge.completed_tasks ? (
              <CheckCircle size={20} />
            ) : (
              <span className="font-bold">{i + 1}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
