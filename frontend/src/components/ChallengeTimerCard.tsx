import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Check, Timer } from 'lucide-react';
import { aiGamificationAPI, ChallengeTimerState, CustomChallenge } from '../services/api';
import playSounds from '../utils/sounds';

interface ChallengeTimerCardProps {
  challenge: CustomChallenge;
  onUpdate: () => void;
  index?: number;
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function ChallengeTimerCard({ challenge, onUpdate, index = 0 }: ChallengeTimerCardProps) {
  const [timerState, setTimerState] = useState<ChallengeTimerState | null>(null);
  const [localElapsed, setLocalElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<number | null>(null);
  const requiresTimer = challenge.requires_timer === true || challenge.requires_timer === 1;
  const targetSeconds = challenge.timer_duration || null;

  useEffect(() => {
    const loadTimerState = async () => {
      try {
        const res = await aiGamificationAPI.getChallengeTimer(challenge.id);
        setTimerState(res.data);

        if (res.data.timer_state) {
          setLocalElapsed(res.data.timer_state.elapsed_seconds || 0);
          setIsRunning(res.data.timer_state.is_running);
          setIsPaused(res.data.timer_state.is_paused);
        }
      } catch (e) {
        console.error('Failed to load challenge timer state:', e);
      } finally {
        setLoading(false);
      }
    };

    if (requiresTimer && !challenge.completed) {
      loadTimerState();
    } else {
      setLoading(false);
    }
  }, [challenge.id, challenge.completed, requiresTimer]);

  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = window.setInterval(() => {
        setLocalElapsed(prev => prev + 1);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, isPaused]);

  const handleStart = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await aiGamificationAPI.startChallengeTimer(challenge.id);
      setIsRunning(true);
      setIsPaused(false);
      setLocalElapsed(res.data.timer_state.elapsed_seconds || 0);
      playSounds.click();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to start timer');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await aiGamificationAPI.pauseChallengeTimer(challenge.id);
      setIsPaused(true);
      setIsRunning(false);
      setLocalElapsed(res.data.timer_state.elapsed_seconds || 0);
      playSounds.click();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to pause timer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await aiGamificationAPI.resumeChallengeTimer(challenge.id);
      setIsRunning(true);
      setIsPaused(false);
      setLocalElapsed(res.data.timer_state.elapsed_seconds || 0);
      playSounds.click();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to resume timer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinish = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await aiGamificationAPI.finishChallengeTimer(challenge.id);
      if (res.data.just_completed) {
        playSounds.challengeComplete();
      } else {
        playSounds.pointsEarned();
      }
      await onUpdate();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to finish timer');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        className="p-4 rounded-xl border-2 border-purple-200 bg-white flex items-center justify-center min-h-[140px]"
        style={{ transitionDelay: `${index * 75}ms` }}
      >
        <div className="w-6 h-6 border-2 border-slate-300 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  const progress = Math.min(100, (challenge.current_progress / challenge.target_value) * 100);
  const isMinTimeMet = localElapsed >= 60;
  const targetProgress = targetSeconds ? Math.min((localElapsed / targetSeconds) * 100, 100) : 0;

  return (
    <div
      className={`p-4 rounded-xl border-2 ${
        challenge.current_progress >= challenge.target_value ? 'bg-green-50 border-green-200' : 'bg-white border-purple-200'
      }`}
      style={{ transitionDelay: `${index * 75}ms` }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium text-slate-800">{challenge.title}</p>
            <span className="text-xs px-1.5 py-0.5 bg-purple-200 text-purple-800 rounded">AI</span>
            <span className="text-xs px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded flex items-center gap-1">
              <Timer size={12} />
              Timer
            </span>
          </div>
          {challenge.description && (
            <p className="text-sm text-slate-600">{challenge.description}</p>
          )}
          <p className="text-xs text-purple-600">
            +{Math.round(challenge.points_reward * challenge.bonus_multiplier)} pts
          </p>
        </div>
      </div>

      <div className="bg-slate-100 rounded-lg p-3 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Timer</span>
          <span className="text-sm font-mono font-semibold text-slate-700">{formatTime(localElapsed)}</span>
        </div>
        {targetSeconds && (
          <div className="mt-2">
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-purple-500 transition-all duration-1000"
                style={{ width: `${targetProgress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1 text-right">
              {localElapsed >= targetSeconds ? 'Target reached' : `${formatTime(targetSeconds - localElapsed)} remaining`}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-2 p-2 bg-red-100 text-red-700 text-xs rounded-lg">
          {error}
        </div>
      )}

      <div className="flex gap-2 mb-2">
        {!isRunning && !isPaused ? (
          <button
            onClick={handleStart}
            disabled={actionLoading}
            className="flex-1 py-2 rounded-lg font-bold text-white bg-purple-500 hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            {actionLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Play size={16} fill="currentColor" />
                Start Timer
              </>
            )}
          </button>
        ) : isPaused ? (
          <>
            <button
              onClick={handleResume}
              disabled={actionLoading}
              className="flex-1 py-2 rounded-lg font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              <Play size={16} fill="currentColor" />
              Resume
            </button>
            {isMinTimeMet && (
              <button
                onClick={handleFinish}
                disabled={actionLoading}
                className="flex-1 py-2 rounded-lg font-bold text-white bg-green-500 hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                <Check size={16} />
                Done
              </button>
            )}
          </>
        ) : (
          <>
            <button
              onClick={handlePause}
              disabled={actionLoading}
              className="flex-1 py-2 rounded-lg font-bold text-white bg-amber-500 hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              <Pause size={16} />
              Pause
            </button>
            {isMinTimeMet && (
              <button
                onClick={handleFinish}
                disabled={actionLoading}
                className="flex-1 py-2 rounded-lg font-bold text-white bg-green-500 hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                <Check size={16} />
                Done
              </button>
            )}
          </>
        )}
      </div>

      {(isRunning || isPaused) && !isMinTimeMet && (
        <p className="text-xs text-center text-slate-500 mb-2">
          Work for at least 1 minute before finishing
        </p>
      )}

      <div className="flex items-center gap-2">
        <div className="flex-1 bg-slate-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              challenge.current_progress >= challenge.target_value ? 'bg-green-500' : 'bg-purple-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-slate-600">{challenge.current_progress}/{challenge.target_value}</span>
      </div>
      {timerState?.completed && (
        <p className="text-xs text-green-600 mt-2">Challenge completed</p>
      )}
    </div>
  );
}
