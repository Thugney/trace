import { useState, useEffect } from 'react';
import { Check, Camera, Sparkles, Zap, Timer } from 'lucide-react';
import { useTaskIcon } from '../context/AgeContext';
import playSounds from '../utils/sounds';
import confetti from 'canvas-confetti';
import PhotoProof from './PhotoProof';
import TaskTimerCard from './TaskTimerCard';
import { getLocalDateKey } from '../utils/date-only';

interface SimpleTaskCardProps {
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
    last_completed_date?: string | null;
  };
  onComplete: (taskId: number) => void;
  disabled?: boolean;
  index?: number;
}

// Fun encouraging messages for kids
const ENCOURAGEMENTS = [
  "You're amazing! 🌟",
  "Super star! ⭐",
  "Incredible! 🎉",
  "You rock! 🎸",
  "Fantastic! 🦄",
  "Awesome sauce! 🔥",
  "Champion! 🏆",
  "Legend! 👑",
];

// Quest difficulty colors based on points
const getQuestStyle = (points: number) => {
  if (points >= 50) return {
    border: 'border-amber-400',
    glow: 'shadow-amber-400/50',
    badge: 'from-amber-400 to-yellow-500',
    ring: 'ring-amber-300',
    label: 'EPIC',
    labelColor: 'text-amber-600',
  };
  if (points >= 30) return {
    border: 'border-purple-400',
    glow: 'shadow-purple-400/40',
    badge: 'from-purple-500 to-indigo-500',
    ring: 'ring-purple-300',
    label: 'RARE',
    labelColor: 'text-purple-600',
  };
  if (points >= 15) return {
    border: 'border-blue-400',
    glow: 'shadow-blue-400/30',
    badge: 'from-blue-500 to-cyan-500',
    ring: 'ring-blue-300',
    label: 'COOL',
    labelColor: 'text-blue-600',
  };
  return {
    border: 'border-emerald-400',
    glow: 'shadow-emerald-400/30',
    badge: 'from-emerald-500 to-green-500',
    ring: 'ring-emerald-300',
    label: 'QUEST',
    labelColor: 'text-emerald-600',
  };
};

export default function SimpleTaskCard({ task, onComplete, disabled, index = 0 }: SimpleTaskCardProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showPhotoProof, setShowPhotoProof] = useState(false);
  const [encouragement, setEncouragement] = useState('');
  const [isPressed, setIsPressed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { emoji } = useTaskIcon(task.category);
  const questStyle = getQuestStyle(task.points);

  const proofRequired = task.proof_required === true || task.proof_required === 1;
  const hasProof = !!task.proof_photo_url;
  const requiresTimer = task.requires_timer === true || task.requires_timer === 1;

  // Check if task was already completed today
  const today = getLocalDateKey();
  const completedToday = task.last_completed_date === today;

  // Entrance animation. Must run before the timer-task early return so the
  // hook order stays stable when a timer task transitions to completed.
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), index * 100);
    return () => clearTimeout(timer);
  }, [index]);

  // If task requires timer, render the timer card instead
  if (requiresTimer && !task.completed) {
    return <TaskTimerCard task={task} onComplete={onComplete} index={index} />;
  }

  const triggerConfetti = () => {
    // Main burst
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3'],
      shapes: ['star', 'circle'],
      scalar: 1.2,
    });

    // Side bursts
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#FFD700', '#FFA500', '#FF6347'],
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#FFD700', '#FFA500', '#FF6347'],
      });
    }, 200);
  };

  const completeTask = () => {
    setIsAnimating(true);
    playSounds.click();

    setTimeout(() => {
      setEncouragement(ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]);
      onComplete(task.id);
      setShowCelebration(true);
      playSounds.levelUp();
      triggerConfetti();

      setTimeout(() => {
        setShowCelebration(false);
        setIsAnimating(false);
      }, 3000);
    }, 200);
  };

  const handleTap = async () => {
    if (task.completed || disabled || isAnimating || completedToday) return;

    if (proofRequired && !hasProof) {
      setShowPhotoProof(true);
      return;
    }

    completeTask();
  };

  const handleProofUploaded = () => {
    setShowPhotoProof(false);
    completeTask();
  };

  // Completed today state (for recurring tasks that shouldn't be done again today)
  if (completedToday && !task.completed) {
    return (
      <div className={`
        relative aspect-square rounded-3xl overflow-hidden
        bg-gradient-to-br from-slate-200 to-slate-300
        border-4 border-slate-300
        ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}
        transition-all duration-500
      `}>
        <div className="absolute top-3 right-3">
          <Timer className="w-8 h-8 text-slate-400" />
        </div>
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
          <span className="text-5xl mb-2 opacity-50">{emoji}</span>
          <p className="font-bold text-slate-600 mb-1 text-sm">{task.title}</p>
          <p className="text-sm text-slate-500">Done for today!</p>
          <p className="text-xs text-slate-400 mt-2">Come back tomorrow</p>
        </div>
      </div>
    );
  }

  // Completed state - game victory card
  if (task.completed) {
    return (
      <div className={`
        relative aspect-square rounded-3xl overflow-hidden
        bg-gradient-to-br from-emerald-400 via-green-500 to-teal-500
        shadow-xl shadow-emerald-500/30
        transform transition-all duration-500
        ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}
      `}>
        {/* Victory pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)`
          }} />
        </div>

        {/* Big check stamp */}
        <div className="absolute top-3 right-3 w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg animate-stamp">
          <Check className="w-9 h-9 text-emerald-500" strokeWidth={3} />
        </div>

        {/* Content */}
        <div className="relative h-full flex flex-col items-center justify-center p-4 text-white">
          <span className="text-6xl mb-2 opacity-60">{emoji}</span>
          <div className="flex items-center gap-2 font-black text-xl">
            <Sparkles className="w-5 h-5" />
            DONE!
            <Sparkles className="w-5 h-5" />
          </div>
          <p className="text-white/80 text-sm mt-1">+{task.points} points earned!</p>
        </div>

        {/* Photo indicator */}
        {hasProof && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
            <span className="text-xs text-white flex items-center gap-1">
              <Camera size={12} /> Photo saved
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={handleTap}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
        onTouchStart={() => setIsPressed(true)}
        onTouchEnd={() => setIsPressed(false)}
        disabled={disabled || isAnimating}
        className={`
          relative aspect-square rounded-3xl overflow-hidden
          bg-white border-4 ${questStyle.border}
          shadow-xl ${questStyle.glow}
          transition-all duration-300 ease-out
          ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
          ${isPressed ? 'scale-95 shadow-md' : 'hover:scale-[1.03] hover:shadow-2xl'}
          ${isAnimating ? 'animate-quest-complete' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer'}
          focus:outline-none focus:ring-4 ${questStyle.ring}
          group
        `}
        style={{
          minHeight: '165px',
          minWidth: '165px',
          transitionDelay: `${index * 100}ms`
        }}
      >
        {/* Animated background gradient */}
        <div className={`
          absolute inset-0 opacity-0 group-hover:opacity-100
          bg-gradient-to-br from-white via-slate-50 to-slate-100
          transition-opacity duration-300
        `} />

        {/* Quest label banner */}
        <div className={`
          absolute -top-1 -left-1 transform -rotate-12
          bg-gradient-to-r ${questStyle.badge}
          text-white text-[10px] font-black tracking-wider
          px-4 py-1 rounded-br-xl shadow-md
        `}>
          {questStyle.label}
        </div>

        {/* Points badge - animated */}
        <div className={`
          absolute -top-2 -right-2 z-10
          w-14 h-14 rounded-full
          bg-gradient-to-br ${questStyle.badge}
          flex items-center justify-center
          shadow-lg shadow-black/20
          transition-transform duration-300
          ${isPressed ? 'scale-90' : 'group-hover:scale-110 group-hover:rotate-12'}
        `}>
          <div className="text-center">
            <div className="text-white font-black text-lg leading-none">+{task.points}</div>
            <div className="text-white/80 text-[8px] font-bold">PTS</div>
          </div>
        </div>

        {/* Photo required badge */}
        {proofRequired && (
          <div className={`
            absolute -top-2 -left-2 z-10
            w-11 h-11 rounded-full
            bg-gradient-to-br from-pink-500 to-rose-500
            flex items-center justify-center
            shadow-lg shadow-pink-500/30
            transition-transform duration-300
            ${isPressed ? 'scale-90' : 'group-hover:scale-110 group-hover:-rotate-12'}
          `}>
            <Camera className="w-5 h-5 text-white" />
          </div>
        )}

        {/* Main content */}
        <div className="relative h-full flex flex-col items-center justify-center p-3 pt-6">
          {/* Big emoji */}
          <span className={`
            text-7xl mb-2
            transition-all duration-300
            ${isAnimating ? 'animate-bounce' : ''}
            ${isPressed ? 'scale-90' : 'group-hover:scale-110 group-hover:rotate-6'}
            drop-shadow-lg
          `}>
            {emoji}
          </span>

          {/* Task title */}
          <p className="text-base font-bold text-slate-700 text-center line-clamp-2 px-2 leading-tight">
            {task.title}
          </p>

          {/* Call to action - pulsing */}
          <div className={`
            absolute bottom-3 left-1/2 -translate-x-1/2
            flex items-center gap-1 px-3 py-1.5 rounded-full
            bg-gradient-to-r ${questStyle.badge}
            text-white text-xs font-bold
            animate-pulse shadow-md
            transition-transform duration-300
            ${isPressed ? 'scale-95' : 'group-hover:scale-105'}
          `}>
            <Zap size={12} className="fill-current" />
            {proofRequired ? 'Snap & Do!' : 'Tap to Do!'}
          </div>
        </div>

        {/* Celebration overlay */}
        {showCelebration && (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 via-green-500 to-teal-500 flex flex-col items-center justify-center animate-bounce-in z-20">
            {/* Stars background effect */}
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
                  ⭐
                </span>
              ))}
            </div>

            <span className="text-6xl mb-2 animate-bounce drop-shadow-lg">🎉</span>
            <span className="text-2xl font-black text-white drop-shadow-md">{encouragement}</span>
            <div className="flex items-center gap-1 mt-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
              <span className="text-xl font-black text-white animate-pulse">+{task.points}</span>
              <span className="text-sm text-white/90">points!</span>
            </div>
          </div>
        )}
      </button>

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

interface SimpleTaskGridProps {
  tasks: SimpleTaskCardProps['task'][];
  onComplete: (taskId: number) => void;
  maxTasks?: number;
}

export function SimpleTaskGrid({ tasks, onComplete, maxTasks = 4 }: SimpleTaskGridProps) {
  const incompleteTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  const visibleTasks = [
    ...incompleteTasks.slice(0, maxTasks),
    ...completedTasks.slice(0, Math.max(0, maxTasks - incompleteTasks.length))
  ];

  if (visibleTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-10 bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 rounded-3xl shadow-inner">
        <div className="relative">
          <span className="text-8xl animate-bounce drop-shadow-lg">🌟</span>
          <span className="absolute -top-2 -right-2 text-4xl animate-float">✨</span>
          <span className="absolute -bottom-1 -left-2 text-3xl animate-pulse">⭐</span>
        </div>
        <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mt-4 mb-2">
          All Done!
        </h2>
        <p className="text-lg text-slate-600 font-medium">You're a superstar today! 🎉</p>
        <div className="mt-4 px-6 py-2 bg-white/60 backdrop-blur rounded-full shadow-md">
          <p className="text-sm text-purple-600 font-semibold">Come back for more quests!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 p-2">
      {visibleTasks.map((task, index) => (
        <SimpleTaskCard
          key={task.id}
          task={task}
          onComplete={onComplete}
          index={index}
        />
      ))}

      {incompleteTasks.length > maxTasks && (
        <div className="col-span-2 text-center py-3">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-full">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span className="text-base font-bold text-purple-600">
              +{incompleteTasks.length - maxTasks} more quests waiting!
            </span>
            <Sparkles className="w-4 h-4 text-purple-500" />
          </div>
        </div>
      )}
    </div>
  );
}
