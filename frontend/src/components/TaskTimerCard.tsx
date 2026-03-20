import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Check, Clock, Timer, Camera } from 'lucide-react';
import { tasksAPI, TaskTimerState } from '../services/api';
import { useTaskIcon } from '../context/AgeContext';
import playSounds from '../utils/sounds';
import confetti from 'canvas-confetti';
import PhotoProof from './PhotoProof';

interface TaskTimerCardProps {
  task: {
    id: number;
    title: string;
    category: string;
    points: number;
    completed: boolean;
    description?: string;
    proof_required?: boolean | number;
    proof_photo_url?: string | null;
    requires_timer?: boolean | number;
    timer_duration_minutes?: number | null;
  };
  onComplete: (taskId: number) => void;
  index?: number;
}

// Fun encouraging messages for kids
const ENCOURAGEMENTS = [
  "You're amazing!",
  "Super star!",
  "Incredible!",
  "You rock!",
  "Fantastic!",
  "Awesome sauce!",
  "Champion!",
  "Legend!",
];

// Format seconds to MM:SS or HH:MM:SS
function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Get quest style based on points
const getQuestStyle = (points: number) => {
  if (points >= 50) return {
    border: 'border-amber-400',
    glow: 'shadow-amber-400/50',
    badge: 'from-amber-400 to-yellow-500',
    ring: 'ring-amber-300',
    label: 'EPIC',
    timerBg: 'from-amber-500 to-orange-500',
  };
  if (points >= 30) return {
    border: 'border-purple-400',
    glow: 'shadow-purple-400/40',
    badge: 'from-purple-500 to-indigo-500',
    ring: 'ring-purple-300',
    label: 'RARE',
    timerBg: 'from-purple-500 to-indigo-500',
  };
  if (points >= 15) return {
    border: 'border-blue-400',
    glow: 'shadow-blue-400/30',
    badge: 'from-blue-500 to-cyan-500',
    ring: 'ring-blue-300',
    label: 'COOL',
    timerBg: 'from-blue-500 to-cyan-500',
  };
  return {
    border: 'border-emerald-400',
    glow: 'shadow-emerald-400/30',
    badge: 'from-emerald-500 to-green-500',
    ring: 'ring-emerald-300',
    label: 'QUEST',
    timerBg: 'from-emerald-500 to-green-500',
  };
};

export default function TaskTimerCard({ task, onComplete, index = 0 }: TaskTimerCardProps) {
  const [timerState, setTimerState] = useState<TaskTimerState | null>(null);
  const [localElapsed, setLocalElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showPhotoProof, setShowPhotoProof] = useState(false);
  const [encouragement, setEncouragement] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const intervalRef = useRef<number | null>(null);
  const { emoji } = useTaskIcon(task.category);
  const questStyle = getQuestStyle(task.points);

  const proofRequired = task.proof_required === true || task.proof_required === 1;
  const hasProof = !!task.proof_photo_url;
  const requiresTimer = task.requires_timer === true || task.requires_timer === 1;
  const targetSeconds = task.timer_duration_minutes ? task.timer_duration_minutes * 60 : null;

  // Entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), index * 100);
    return () => clearTimeout(timer);
  }, [index]);

  // Load timer state
  useEffect(() => {
    const loadTimerState = async () => {
      try {
        const res = await tasksAPI.getTimer(task.id);
        setTimerState(res.data);

        if (res.data.timer_state) {
          setLocalElapsed(res.data.timer_state.elapsed_seconds);
          setIsRunning(res.data.timer_state.is_running);
          setIsPaused(res.data.timer_state.is_paused);
        }
      } catch (e) {
        console.error('Failed to load timer state:', e);
      } finally {
        setLoading(false);
      }
    };

    if (requiresTimer && !task.completed) {
      loadTimerState();
    } else {
      setLoading(false);
    }
  }, [task.id, requiresTimer, task.completed]);

  // Local timer tick when running
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

  const triggerConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3'],
      shapes: ['star', 'circle'],
      scalar: 1.2,
    });

    setTimeout(() => {
      confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#FFD700', '#FFA500', '#FF6347'] });
      confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#FFD700', '#FFA500', '#FF6347'] });
    }, 200);
  };

  const handleStart = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const response = await tasksAPI.startTimer(task.id);
      setIsRunning(true);
      setIsPaused(false);
      setLocalElapsed(response.data.timer_state.elapsed_seconds ?? 0);
      playSounds.click();
    } catch (e: any) {
      const msg = e.response?.data?.error || 'Failed to start timer';
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      const response = await tasksAPI.pauseTimer(task.id);
      setIsPaused(true);
      setIsRunning(false);
      setLocalElapsed(response.data.timer_state.elapsed_seconds ?? localElapsed);
      playSounds.click();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to pause timer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      const response = await tasksAPI.resumeTimer(task.id);
      setIsRunning(true);
      setIsPaused(false);
      setLocalElapsed(response.data.timer_state.elapsed_seconds ?? localElapsed);
      playSounds.click();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to resume timer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinish = async () => {
    // Check if proof is required
    if (proofRequired && !hasProof) {
      setShowPhotoProof(true);
      return;
    }

    setActionLoading(true);
    try {
      await tasksAPI.finishTimer(task.id);
      setEncouragement(ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]);
      setShowCelebration(true);
      playSounds.levelUp();
      triggerConfetti();

      setTimeout(() => {
        setShowCelebration(false);
        onComplete(task.id);
      }, 3000);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to complete task');
    } finally {
      setActionLoading(false);
    }
  };

  const handleProofUploaded = () => {
    setShowPhotoProof(false);
    handleFinish();
  };

  // Calculate progress percentage
  const requiredSeconds = timerState?.required_seconds ?? targetSeconds ?? 60;
  const remainingSeconds = Math.max(requiredSeconds - localElapsed, 0);
  const progressPercent = requiredSeconds ? Math.min((localElapsed / requiredSeconds) * 100, 100) : 0;
  const isTargetMet = localElapsed >= requiredSeconds;

  // Already completed today
  if (timerState?.completed_today && !task.completed) {
    return (
      <div className={`
        relative rounded-3xl overflow-hidden p-4 min-h-[200px]
        bg-gradient-to-br from-slate-200 to-slate-300
        border-4 border-slate-300
        ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}
        transition-all duration-500
      `}>
        <div className="absolute top-3 right-3">
          <Clock className="w-8 h-8 text-slate-400" />
        </div>
        <div className="flex flex-col items-center justify-center h-full text-center">
          <span className="text-5xl mb-2 opacity-50">{emoji}</span>
          <p className="font-bold text-slate-600 mb-1">{task.title}</p>
          <p className="text-sm text-slate-500">Done for today!</p>
          <p className="text-xs text-slate-400 mt-2">Come back tomorrow</p>
        </div>
      </div>
    );
  }

  // Completed state
  if (task.completed) {
    return (
      <div className={`
        relative rounded-3xl overflow-hidden p-4 min-h-[200px]
        bg-gradient-to-br from-emerald-400 via-green-500 to-teal-500
        shadow-xl shadow-emerald-500/30
        ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}
        transition-all duration-500
      `}>
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)`
          }} />
        </div>
        <div className="absolute top-3 right-3 w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg">
          <Check className="w-9 h-9 text-emerald-500" strokeWidth={3} />
        </div>
        <div className="relative h-full flex flex-col items-center justify-center text-white">
          <span className="text-6xl mb-2 opacity-60">{emoji}</span>
          <div className="flex items-center gap-2 font-black text-xl">DONE!</div>
          <p className="text-white/80 text-sm mt-1">+{task.points} points earned!</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`
        relative rounded-3xl overflow-hidden p-4 min-h-[200px]
        bg-white border-4 ${questStyle.border}
        flex items-center justify-center
        ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}
        transition-all duration-500
      `}>
        <div className="w-8 h-8 border-4 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className={`
        relative rounded-3xl overflow-hidden
        bg-white border-4 ${questStyle.border}
        shadow-xl ${questStyle.glow}
        ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
        transition-all duration-300
        min-h-[220px]
      `} style={{ transitionDelay: `${index * 100}ms` }}>
        {/* Quest label */}
        <div className={`
          absolute -top-1 -left-1 transform -rotate-12
          bg-gradient-to-r ${questStyle.badge}
          text-white text-[10px] font-black tracking-wider
          px-4 py-1 rounded-br-xl shadow-md z-10
        `}>
          {questStyle.label}
        </div>

        {/* Timer badge */}
        <div className="absolute top-2 right-2 z-10">
          <div className={`
            px-3 py-1 rounded-full bg-gradient-to-r ${questStyle.timerBg}
            text-white text-xs font-bold flex items-center gap-1 shadow-md
          `}>
            <Timer size={12} />
            {formatTime(requiredSeconds)}
          </div>
        </div>

        {/* Points badge */}
        <div className={`
          absolute top-10 right-2 z-10
          w-12 h-12 rounded-full
          bg-gradient-to-br ${questStyle.badge}
          flex items-center justify-center shadow-lg
        `}>
          <div className="text-center">
            <div className="text-white font-black text-sm leading-none">+{task.points}</div>
            <div className="text-white/80 text-[8px] font-bold">PTS</div>
          </div>
        </div>

        {/* Photo required badge */}
        {proofRequired && (
          <div className={`
            absolute top-2 left-14 z-10
            w-8 h-8 rounded-full
            bg-gradient-to-br from-pink-500 to-rose-500
            flex items-center justify-center shadow-md
          `}>
            <Camera className="w-4 h-4 text-white" />
          </div>
        )}

        {/* Content */}
        <div className="p-4 pt-8">
          {/* Task info */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-4xl">{emoji}</span>
            <div className="flex-1">
              <p className="font-bold text-slate-800 text-sm leading-tight">{task.title}</p>
              {task.description && (
                <p className="text-xs text-slate-500 line-clamp-1">{task.description}</p>
              )}
            </div>
          </div>

          {/* Timer display */}
          <div className="bg-slate-100 rounded-2xl p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 font-medium">Time</span>
              <span className={`text-2xl font-mono font-bold ${
                isRunning ? 'text-green-600' : isPaused ? 'text-amber-600' : 'text-slate-600'
              }`}>
                {formatTime(localElapsed)}
              </span>
            </div>

            {/* Progress bar */}
            {requiredSeconds > 0 && (
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-1000 ${
                    progressPercent >= 100 ? 'bg-green-500' :
                    progressPercent >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}

            {requiredSeconds > 0 && (
              <p className="text-xs text-slate-500 mt-1 text-right">
                {isTargetMet ? 'Target reached!' : `${formatTime(remainingSeconds)} remaining`}
              </p>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-2 p-2 bg-red-100 text-red-700 text-xs rounded-lg">
              {error}
            </div>
          )}

          {/* Control buttons */}
          <div className="flex gap-2">
            {!isRunning && !isPaused ? (
              // Not started - show Start button
              <button
                onClick={handleStart}
                disabled={actionLoading}
                className={`
                  flex-1 py-3 rounded-xl font-bold text-white
                  bg-gradient-to-r ${questStyle.timerBg}
                  hover:opacity-90 active:scale-95
                  transition-all flex items-center justify-center gap-2
                  disabled:opacity-50
                `}
              >
                {actionLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Play size={18} fill="currentColor" />
                    Start Timer
                  </>
                )}
              </button>
            ) : isPaused ? (
              // Paused - show Resume and Finish buttons
              <>
                <button
                  onClick={handleResume}
                  disabled={actionLoading}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Play size={18} fill="currentColor" />
                  Resume
                </button>
                {isTargetMet && (
                  <button
                    onClick={handleFinish}
                    disabled={actionLoading}
                    className="flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Check size={18} />
                    Done
                  </button>
                )}
              </>
            ) : (
              // Running - show Pause and Finish buttons
              <>
                <button
                  onClick={handlePause}
                  disabled={actionLoading}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Pause size={18} />
                  Pause
                </button>
                {isTargetMet && (
                  <button
                    onClick={handleFinish}
                    disabled={actionLoading}
                    className="flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Check size={18} />
                    Done
                  </button>
                )}
              </>
            )}
          </div>

          {/* Timer notice */}
          {(isRunning || isPaused) && !isTargetMet && (
            <p className="text-xs text-center text-slate-500 mt-2">
              Keep going. {formatTime(remainingSeconds)} left before Done unlocks.
            </p>
          )}
        </div>

        {/* Celebration overlay */}
        {showCelebration && (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 via-green-500 to-teal-500 flex flex-col items-center justify-center animate-bounce-in z-20">
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(12)].map((_, i) => (
                <span
                  key={i}
                  className="absolute text-2xl animate-star-burst"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${i * 100}ms`,
                  }}
                >
                  *
                </span>
              ))}
            </div>
            <span className="text-6xl mb-2 animate-bounce drop-shadow-lg">!!</span>
            <span className="text-2xl font-black text-white drop-shadow-md">{encouragement}</span>
            <div className="flex items-center gap-1 mt-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
              <span className="text-xl font-black text-white animate-pulse">+{task.points}</span>
              <span className="text-sm text-white/90">points!</span>
            </div>
          </div>
        )}
      </div>

      {showPhotoProof && (
        <PhotoProof
          taskId={task.id}
          taskTitle={task.title}
          onProofUploaded={handleProofUploaded}
          onCancel={() => setShowPhotoProof(false)}
          existingProofUrl={task.proof_photo_url}
        />
      )}
    </>
  );
}
