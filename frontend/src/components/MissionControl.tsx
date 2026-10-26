import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Square, Clock, Timer, Camera, AlertTriangle, Calendar, Sparkles, Trophy, Star } from 'lucide-react';
import { tasksAPI } from '../services/api';
import { useTaskIcon } from '../context/AgeContext';
import { Task } from '../types';
import playSounds from '../utils/sounds';
import confetti from 'canvas-confetti';
import PhotoProof from './PhotoProof';
import { getDateOnlyRelation } from '../utils/date-only';

// Fun encouraging messages for kids
const ENCOURAGEMENTS = [
  "You're amazing!",
  "Super star!",
  "Incredible work!",
  "You rock!",
  "Fantastic!",
  "Awesome sauce!",
  "Champion!",
  "Legend!",
  "Mission accomplished!",
  "You crushed it!",
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

// ============================================
// MISSION COMPLETE MODAL
// ============================================
interface MissionCompleteModalProps {
  task: Task;
  pointsEarned: number;
  starsEarned: number;
  timeSpent: number;
  onClose: () => void;
}

export function MissionCompleteModal({ task, pointsEarned, starsEarned, timeSpent, onClose }: MissionCompleteModalProps) {
  const encouragement = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];

  useEffect(() => {
    // Trigger confetti on mount
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

    playSounds.levelUp();

    // Auto-close after 4 seconds
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn p-4">
      <div className="relative bg-gradient-to-br from-emerald-400 via-green-500 to-teal-500 p-6 rounded-3xl shadow-2xl text-center max-w-sm w-full animate-bounce-slow">
        {/* Stars burst animation */}
        <div className="absolute inset-0 overflow-hidden rounded-3xl">
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

        <div className="relative">
          <div className="text-6xl mb-3 animate-bounce">🎉</div>
          <h2 className="text-2xl font-black text-white mb-1">MISSION COMPLETE!</h2>
          <p className="text-white/90 font-medium mb-4">{task.title}</p>

          {/* Reward display */}
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Star className="w-6 h-6 text-yellow-300 fill-yellow-300" />
                  <span className="text-3xl font-black text-yellow-200">+{pointsEarned}</span>
                </div>
                <p className="text-sm text-white/80">points</p>
              </div>
              {starsEarned > 0 && (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Trophy className="w-6 h-6 text-amber-300" />
                    <span className="text-3xl font-black text-amber-200">+{starsEarned}</span>
                  </div>
                  <p className="text-sm text-white/80">stars</p>
                </div>
              )}
            </div>
            {timeSpent > 0 && (
              <p className="text-sm text-white/70 mt-2">Time: {formatTime(timeSpent)}</p>
            )}
          </div>

          <p className="text-xl font-bold text-white mb-4">{encouragement}</p>

          <button
            onClick={onClose}
            className="w-full py-3 bg-white text-green-600 rounded-xl font-bold text-lg hover:bg-green-50 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Sparkles size={20} />
            Awesome!
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ACTIVE MISSION CARD (Hero Timer)
// ============================================
interface ActiveMissionCardProps {
  task: Task;
  onComplete: (taskId: number, pointsEarned: number, starsEarned: number, timeSpent: number) => void;
  onCancel?: () => void;
}

export function ActiveMissionCard({ task, onComplete }: ActiveMissionCardProps) {
  const [localElapsed, setLocalElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPhotoProof, setShowPhotoProof] = useState(false);

  const intervalRef = useRef<number | null>(null);
  const { emoji } = useTaskIcon(task.category);

  const proofRequired = task.proof_required === true || task.proof_required === 1;
  const hasProof = !!task.proof_photo_url;
  const targetSeconds = task.timer_duration_minutes ? task.timer_duration_minutes * 60 : 600; // Default 10 min

  const handleStart = useCallback(async () => {
    setActionLoading(true);
    setError(null);
    try {
      await tasksAPI.startTimer(task.id);
      setIsRunning(true);
      setIsPaused(false);
      setLocalElapsed(0);
      playSounds.click();
    } catch (e: any) {
      // Timer might already exist, try to get current state
      if (e.response?.data?.code === 'TIMER_EXISTS') {
        const timerState = e.response.data.timer_state;
        if (timerState) {
          setLocalElapsed(timerState.elapsed_seconds || 0);
          setIsRunning(!!timerState.is_running);
          setIsPaused(!!timerState.is_paused);
        }
      } else {
        const msg = e.response?.data?.error || 'Failed to start timer';
        setError(msg);
      }
    } finally {
      setActionLoading(false);
    }
  }, [task.id]);

  // Load timer state on mount
  useEffect(() => {
    const loadTimerState = async () => {
      try {
        const res = await tasksAPI.getTimer(task.id);

        if (res.data.timer_state) {
          setLocalElapsed(res.data.timer_state.elapsed_seconds);
          setIsRunning(res.data.timer_state.is_running);
          setIsPaused(res.data.timer_state.is_paused);
        } else {
          // Auto-start timer if not started
          await handleStart();
        }
      } catch (e) {
        console.error('Failed to load timer state:', e);
        // Try to start timer on error
        await handleStart();
      } finally {
        setLoading(false);
      }
    };

    loadTimerState();
  }, [task.id, handleStart]);

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

  const handlePause = async () => {
    setActionLoading(true);
    try {
      await tasksAPI.pauseTimer(task.id);
      setIsPaused(true);
      setIsRunning(false);
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
      await tasksAPI.resumeTimer(task.id);
      setIsRunning(true);
      setIsPaused(false);
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
      const res = await tasksAPI.finishTimer(task.id);
      onComplete(task.id, res.data.pointsEarned, res.data.starsEarned, res.data.timeSpent);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to complete mission');
    } finally {
      setActionLoading(false);
    }
  };

  const handleProofUploaded = () => {
    setShowPhotoProof(false);
    handleFinish();
  };

  // Calculate progress percentage
  const progressPercent = Math.min((localElapsed / targetSeconds) * 100, 100);
  const isMinTimeMet = localElapsed >= 60; // Minimum 1 minute
  const isTargetMet = localElapsed >= targetSeconds;
  const remainingSeconds = Math.max(0, targetSeconds - localElapsed);

  // After target time is reached, can only stop (no more pause/resume)
  const canPause = isRunning && !isTargetMet;
  const canResume = isPaused && !isTargetMet;
  const canStop = isMinTimeMet;

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-center py-8">
          <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)`
          }} />
        </div>

        <div className="relative">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Timer size={18} className="text-white" />
              </div>
              <span className="text-white/90 font-semibold text-sm uppercase tracking-wide">Active Mission</span>
            </div>
            <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              <span className="text-white font-bold text-sm">+{task.points} pts</span>
            </div>
          </div>

          {/* Task info */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">{emoji}</span>
            <div className="flex-1">
              <h3 className="text-white font-bold text-lg leading-tight">{task.title}</h3>
              {task.description && (
                <p className="text-white/70 text-sm line-clamp-1">{task.description}</p>
              )}
            </div>
          </div>

          {/* Timer display */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-white/80" />
                <span className="text-white/80 text-sm font-medium">Time</span>
              </div>
              <span className={`text-4xl font-mono font-bold ${
                isTargetMet ? 'text-green-300' : isRunning ? 'text-white' : 'text-amber-300'
              }`}>
                {formatTime(localElapsed)}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-white/20 rounded-full h-3 mb-2">
              <div
                className={`h-3 rounded-full transition-all duration-1000 ${
                  isTargetMet ? 'bg-green-400' : progressPercent >= 50 ? 'bg-blue-400' : 'bg-amber-400'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Status text */}
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-xs">
                Target: {formatTime(targetSeconds)}
              </span>
              <span className={`text-sm font-medium ${isTargetMet ? 'text-green-300' : 'text-white/80'}`}>
                {isTargetMet ? 'Target reached! Great job!' : `${formatTime(remainingSeconds)} remaining`}
              </span>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-3 p-3 bg-red-500/20 border border-red-400/30 text-red-100 text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* Control buttons */}
          <div className="flex gap-2">
            {/* Pause/Resume button - only available before target time */}
            {!isTargetMet && (
              <>
                {isRunning && canPause && (
                  <button
                    onClick={handlePause}
                    disabled={actionLoading}
                    className="flex-1 py-3 rounded-xl font-bold text-amber-900 bg-amber-400 hover:bg-amber-300 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Pause size={18} />
                        Pause
                      </>
                    )}
                  </button>
                )}
                {isPaused && canResume && (
                  <button
                    onClick={handleResume}
                    disabled={actionLoading}
                    className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-400 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Play size={18} fill="currentColor" />
                        Resume
                      </>
                    )}
                  </button>
                )}
              </>
            )}

            {/* Stop/Done button */}
            {canStop && (
              <button
                onClick={handleFinish}
                disabled={actionLoading}
                className={`flex-1 py-3 rounded-xl font-bold text-white active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${
                  isTargetMet
                    ? 'bg-green-500 hover:bg-green-400 animate-pulse'
                    : 'bg-green-600 hover:bg-green-500'
                }`}
              >
                {actionLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Square size={18} fill="currentColor" />
                    {isTargetMet ? "I'm Done!" : 'Stop Early'}
                  </>
                )}
              </button>
            )}
          </div>

          {/* Minimum time notice */}
          {!isMinTimeMet && (
            <p className="text-xs text-center text-white/60 mt-3">
              Work for at least 1 minute to complete
            </p>
          )}

          {/* Photo required indicator */}
          {proofRequired && !hasProof && (
            <div className="mt-3 flex items-center justify-center gap-2 text-white/70 text-sm">
              <Camera size={14} />
              <span>Photo proof required when done</span>
            </div>
          )}
        </div>
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

// ============================================
// TODAY'S MISSIONS LIST
// ============================================
interface TodaysMissionsProps {
  tasks: Task[];
  onStartMission: (task: Task) => void;
}

export function TodaysMissions({ tasks, onStartMission }: TodaysMissionsProps) {
  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xl">🎯</span>
          <h3 className="font-bold text-gray-900">Do Now</h3>
          <span className="text-xs text-gray-500">(0)</span>
        </div>
        <div className="text-center py-4">
          <div className="text-4xl mb-2">🎉</div>
          <p className="text-gray-600 font-medium">Nothing left in today's lane.</p>
          <p className="text-gray-400 text-sm">Great job. Check coming up or come back later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xl">🎯</span>
        <h3 className="font-bold text-gray-900">Do Now</h3>
        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">{tasks.length}</span>
      </div>
      <p className="mb-3 text-sm text-gray-500">These are the tasks that matter first, including recurring work that is due now.</p>
      <div className="space-y-2">
        {tasks.map(task => (
          <MissionListItem key={task.id} task={task} onStart={() => onStartMission(task)} />
        ))}
      </div>
    </div>
  );
}

// ============================================
// MISSION LIST ITEM
// ============================================
interface MissionListItemProps {
  task: Task;
  onStart: () => void;
}

function MissionListItem({ task, onStart }: MissionListItemProps) {
  const { emoji } = useTaskIcon(task.category);
  const hasTimer = task.requires_timer === 1 || task.requires_timer === true;
  const timerMinutes = task.timer_duration_minutes || 10;
  const isOverdue = getDateOnlyRelation(task.due_date) === 'past';

  return (
    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:border-purple-200 hover:shadow-sm transition-all group">
      <span className="text-2xl">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-amber-600 font-semibold">+{task.points} pts</span>
          {hasTimer && (
            <span className="text-xs text-purple-600 flex items-center gap-0.5">
              <Timer size={10} />
              {timerMinutes} min
            </span>
          )}
        </div>
        {isOverdue && (
          <p className="text-xs text-red-600 font-medium mt-1">Past due. Do it now for half points.</p>
        )}
      </div>
      <button
        onClick={onStart}
        className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg font-semibold text-sm hover:from-purple-600 hover:to-indigo-600 active:scale-95 transition-all flex items-center gap-1 opacity-80 group-hover:opacity-100"
      >
        <Play size={14} fill="currentColor" />
        Start
      </button>
    </div>
  );
}

// ============================================
// COMPLETED TODAY LIST
// ============================================
interface CompletedTodayProps {
  tasks: Task[];
}

export function CompletedToday({ tasks }: CompletedTodayProps) {
  if (tasks.length === 0) {
    return null; // Don't show if no completed tasks
  }

  return (
    <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xl">✨</span>
        <h3 className="font-bold text-green-800">Completed Today</h3>
        <span className="text-xs px-2 py-0.5 bg-green-200 text-green-800 rounded-full font-medium">{tasks.length}</span>
      </div>
      <p className="mb-3 text-sm text-green-700/80">Proof that today's work is already counted.</p>
      <div className="space-y-2">
        {tasks.slice(0, 5).map(task => (
          <CompletedMissionItem key={task.id} task={task} />
        ))}
        {tasks.length > 5 && (
          <p className="text-sm text-green-600 text-center pt-1">
            +{tasks.length - 5} more completed
          </p>
        )}
      </div>
    </div>
  );
}

function CompletedMissionItem({ task }: { task: Task }) {
  const { emoji } = useTaskIcon(task.category);

  return (
    <div className="flex items-center gap-3 p-2 bg-white/60 rounded-lg">
      <div className="relative">
        <span className="text-xl opacity-60">{emoji}</span>
        <Sparkles className="absolute -top-1 -right-1 w-3 h-3 text-green-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-green-800 truncate text-sm">{task.title}</p>
      </div>
      <span className="text-xs text-green-600 font-semibold">+{task.points} pts</span>
    </div>
  );
}

// ============================================
// OVERDUE MISSIONS
// ============================================
interface OverdueMissionsProps {
  tasks: Task[];
  onStartMission: (task: Task) => void;
  formatDueDate: (date: string) => string;
}

export function OverdueMissions({ tasks, onStartMission, formatDueDate }: OverdueMissionsProps) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-orange-50 p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-red-500" />
        <h3 className="font-bold text-red-800">Past Due - Do Now</h3>
        <span className="text-xs px-2 py-0.5 bg-red-200 text-red-800 rounded-full font-medium">{tasks.length}</span>
      </div>
      <p className="mb-3 text-sm text-red-700/85">These can still be completed, but they now pay reduced points because they are late.</p>
      <div className="space-y-2">
        {tasks.map(task => (
          <OverdueMissionItem
            key={task.id}
            task={task}
            onStart={() => onStartMission(task)}
            formatDueDate={formatDueDate}
          />
        ))}
      </div>
    </div>
  );
}

function OverdueMissionItem({ task, onStart, formatDueDate }: { task: Task; onStart: () => void; formatDueDate: (date: string) => string }) {
  const { emoji } = useTaskIcon(task.category);
  const hasTimer = task.requires_timer === 1 || task.requires_timer === true;

  return (
    <div className="flex items-center gap-3 p-3 bg-white/80 rounded-xl border border-red-100">
      <span className="text-2xl">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-amber-600 font-semibold">+{task.points} pts</span>
          {task.due_date && (
            <span className="text-xs text-red-600 font-medium">{formatDueDate(task.due_date)}</span>
          )}
        </div>
        <p className="text-xs text-red-600 font-medium mt-1">Past due. Do it now for half points.</p>
      </div>
      {hasTimer ? (
        <button
          onClick={onStart}
          className="px-3 py-1.5 bg-red-500 text-white rounded-lg font-semibold text-xs hover:bg-red-600 active:scale-95 transition-all flex items-center gap-1"
        >
          <Play size={12} fill="currentColor" />
          Start
        </button>
      ) : (
        <button
          onClick={onStart}
          className="px-3 py-1.5 bg-red-500 text-white rounded-lg font-semibold text-xs hover:bg-red-600 active:scale-95 transition-all"
        >
          Do Now
        </button>
      )}
    </div>
  );
}

// ============================================
// COMING UP MISSIONS
// ============================================
interface ComingUpMissionsProps {
  tasks: Task[];
  formatDueDate: (date: string) => string;
}

export function ComingUpMissions({ tasks, formatDueDate }: ComingUpMissionsProps) {
  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-blue-500" />
        <h3 className="font-bold text-blue-800">Coming Up</h3>
        <span className="text-xs px-2 py-0.5 bg-blue-200 text-blue-800 rounded-full font-medium">{tasks.length}</span>
      </div>
      <p className="mb-3 text-sm text-blue-700/80">Scheduled next so kids can see what is ahead without mixing it into today's work.</p>
      <div className="space-y-2">
        {tasks.slice(0, 3).map(task => (
          <ComingUpMissionItem key={task.id} task={task} formatDueDate={formatDueDate} />
        ))}
        {tasks.length > 3 && (
          <p className="text-sm text-blue-600 text-center pt-1">
            +{tasks.length - 3} more coming up
          </p>
        )}
      </div>
    </div>
  );
}

function ComingUpMissionItem({ task, formatDueDate }: { task: Task; formatDueDate: (date: string) => string }) {
  const { emoji } = useTaskIcon(task.category);

  return (
    <div className="flex items-center gap-3 p-2 bg-white/60 rounded-lg">
      <span className="text-xl opacity-70">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 truncate text-sm">{task.title}</p>
        <p className="text-xs text-blue-600">{task.due_date && formatDueDate(task.due_date)}</p>
      </div>
      <span className="text-xs text-gray-500 font-medium">+{task.points} pts</span>
    </div>
  );
}
