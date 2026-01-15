import { useState, useEffect } from 'react';
import { Check, Clock, Sparkles, Star, Zap } from 'lucide-react';
import { getTaskIconConfig } from './FunIcon';
import confetti from 'canvas-confetti';

interface Task {
  id: number;
  title: string;
  description?: string;
  category?: string;
  points?: number;
  stars?: number;
  due_time?: string;
  completed?: boolean;
}

interface TaskCardProps {
  task: Task;
  onComplete: (taskId: number) => void;
  size?: 'sm' | 'md' | 'lg';
  showPoints?: boolean;
  index?: number;
}

// Vibrant color schemes that make tasks feel like power-ups
const POWER_UP_COLORS = [
  { bg: 'from-rose-500 via-pink-500 to-fuchsia-500', shadow: 'shadow-pink-500/40', glow: 'hover:shadow-pink-400/60' },
  { bg: 'from-blue-500 via-cyan-500 to-teal-500', shadow: 'shadow-cyan-500/40', glow: 'hover:shadow-cyan-400/60' },
  { bg: 'from-emerald-500 via-green-500 to-lime-500', shadow: 'shadow-green-500/40', glow: 'hover:shadow-green-400/60' },
  { bg: 'from-amber-500 via-orange-500 to-red-500', shadow: 'shadow-orange-500/40', glow: 'hover:shadow-orange-400/60' },
  { bg: 'from-violet-500 via-purple-500 to-indigo-500', shadow: 'shadow-purple-500/40', glow: 'hover:shadow-purple-400/60' },
  { bg: 'from-sky-500 via-blue-500 to-indigo-500', shadow: 'shadow-blue-500/40', glow: 'hover:shadow-blue-400/60' },
];

function getCardColor(index: number) {
  return POWER_UP_COLORS[index % POWER_UP_COLORS.length];
}

// Fun messages when completing tasks
const VICTORY_MESSAGES = ['Awesome!', 'Epic!', 'Wow!', 'Amazing!', 'Super!', 'Yes!', 'Boom!', 'Nice!'];

export default function TaskCard({ task, onComplete, size = 'md', showPoints = true, index = 0 }: TaskCardProps) {
  const [completing, setCompleting] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [victoryMsg, setVictoryMsg] = useState('');
  const [mounted, setMounted] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const iconConfig = getTaskIconConfig(task.category);
  const cardColor = getCardColor(task.id);

  // Staggered entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), index * 80);
    return () => clearTimeout(timer);
  }, [index]);

  const handleComplete = async () => {
    if (completing || justCompleted) return;
    setCompleting(true);

    try {
      setVictoryMsg(VICTORY_MESSAGES[Math.floor(Math.random() * VICTORY_MESSAGES.length)]);
      await onComplete(task.id);
      setJustCompleted(true);

      // Celebration confetti
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff'],
      });
    } catch {
      setCompleting(false);
    }
  };

  // Victory state - task completed
  if (justCompleted) {
    return (
      <div className={`
        bg-gradient-to-br from-emerald-400 via-green-500 to-teal-500
        rounded-2xl p-4 text-center relative overflow-hidden
        shadow-xl shadow-green-500/30
        animate-bounce-in
      `}>
        {/* Animated stars */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <Star
              key={i}
              className="absolute text-yellow-300 fill-yellow-300 animate-star-burst"
              size={16}
              style={{
                left: `${20 + Math.random() * 60}%`,
                top: `${20 + Math.random() * 60}%`,
                animationDelay: `${i * 100}ms`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10">
          <div className="text-4xl mb-1 animate-bounce">🎉</div>
          <p className="text-white font-black text-lg">{victoryMsg}</p>
          {showPoints && task.points && (
            <div className="inline-flex items-center gap-1 mt-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
              <Zap size={14} className="text-yellow-300 fill-yellow-300" />
              <span className="text-white font-bold">+{task.points} pts</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const sizeClasses = {
    sm: 'p-3 rounded-xl',
    md: 'p-4 rounded-2xl',
    lg: 'p-5 rounded-3xl',
  };

  const iconSizes = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl',
  };

  const titleSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div
      className={`
        bg-gradient-to-br ${cardColor.bg}
        ${sizeClasses[size]}
        shadow-xl ${cardColor.shadow} ${cardColor.glow}
        transition-all duration-300 ease-out
        ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
        ${isPressed ? 'scale-[0.97]' : 'hover:scale-[1.02]'}
        ${completing ? 'opacity-80' : ''}
        relative overflow-hidden group
      `}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      {/* Shine effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

      <div className="flex items-start gap-3 relative z-10">
        {/* Animated Icon */}
        <div className={`
          flex-shrink-0 transition-transform duration-300
          ${isPressed ? 'scale-90' : 'group-hover:scale-110 group-hover:rotate-12'}
        `}>
          <span className={`${iconSizes[size]} drop-shadow-lg`}>{iconConfig.emoji}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className={`font-bold ${titleSizes[size]} leading-tight truncate text-white drop-shadow-sm`}>
            {task.title}
          </h3>
          {task.description && size !== 'sm' && (
            <p className="text-white/80 text-sm mt-1 line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Points, Stars & Time */}
          {(showPoints || task.due_time) && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {showPoints && task.points && (
                <span className="inline-flex items-center gap-1 bg-white/25 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-bold text-white">
                  <Zap size={12} className="fill-yellow-300 text-yellow-300" />
                  +{task.points} pts
                </span>
              )}
              {task.stars && task.stars > 0 && (
                <span className="inline-flex items-center gap-1 bg-yellow-400/30 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-bold text-white">
                  <Star size={12} className="fill-yellow-300 text-yellow-300" />
                  +{task.stars}
                </span>
              )}
              {task.due_time && (
                <span className="inline-flex items-center gap-1 text-white/80 text-xs">
                  <Clock size={12} />
                  {task.due_time}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Complete Button - Game style */}
        <button
          onClick={handleComplete}
          onMouseDown={() => setIsPressed(true)}
          onMouseUp={() => setIsPressed(false)}
          onMouseLeave={() => setIsPressed(false)}
          onTouchStart={() => setIsPressed(true)}
          onTouchEnd={() => setIsPressed(false)}
          disabled={completing}
          className={`
            flex-shrink-0 w-12 h-12 rounded-full
            bg-white/30 backdrop-blur-sm
            border-2 border-white/50
            flex items-center justify-center
            transition-all duration-200
            ${isPressed ? 'scale-90 bg-white/50' : 'hover:scale-110 hover:bg-white/40 hover:border-white/70'}
            ${completing ? 'animate-spin' : ''}
            shadow-lg
          `}
        >
          {completing ? (
            <span className="text-xl">⏳</span>
          ) : (
            <Check className="w-6 h-6 text-white" strokeWidth={3} />
          )}
        </button>
      </div>
    </div>
  );
}

// Grid of task cards
interface TaskGridProps {
  tasks: Task[];
  onComplete: (taskId: number) => void;
  columns?: 1 | 2;
  size?: 'sm' | 'md' | 'lg';
}

export function TaskGrid({ tasks, onComplete, columns = 1, size = 'md' }: TaskGridProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-10 bg-gradient-to-br from-emerald-100 via-green-100 to-teal-100 rounded-3xl shadow-inner">
        <div className="relative inline-block">
          <div className="text-6xl mb-3 animate-bounce">🎉</div>
          <Sparkles className="absolute -top-2 -right-4 text-yellow-500 w-8 h-8 animate-pulse" />
        </div>
        <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-teal-600">
          All Done!
        </p>
        <p className="text-green-600 font-medium mt-1">Great job today! 🌟</p>
      </div>
    );
  }

  return (
    <div className={`grid gap-3 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {tasks.map((task, index) => (
        <TaskCard
          key={task.id}
          task={task}
          onComplete={onComplete}
          size={size}
          index={index}
        />
      ))}
    </div>
  );
}

// Simple big button task card for young kids
interface SimpleTaskButtonProps {
  task: Task;
  onComplete: (taskId: number) => void;
  index?: number;
}

export function SimpleTaskButton({ task, onComplete, index = 0 }: SimpleTaskButtonProps) {
  const [completing, setCompleting] = useState(false);
  const [done, setDone] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const iconConfig = getTaskIconConfig(task.category);
  const cardColor = getCardColor(task.id);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), index * 100);
    return () => clearTimeout(timer);
  }, [index]);

  const handleComplete = async () => {
    if (completing || done) return;
    setCompleting(true);
    try {
      await onComplete(task.id);
      setDone(true);

      // Celebration!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff'],
      });
    } catch {
      setCompleting(false);
    }
  };

  if (done) {
    return (
      <div className={`
        aspect-square bg-gradient-to-br from-emerald-400 via-green-500 to-teal-500
        rounded-3xl flex flex-col items-center justify-center text-white
        shadow-xl shadow-green-500/30 animate-bounce-in
        ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}
      `}>
        <span className="text-5xl mb-2 animate-bounce">✅</span>
        <span className="text-xl font-black">Done!</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleComplete}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      disabled={completing}
      className={`
        aspect-square bg-gradient-to-br ${cardColor.bg} rounded-3xl p-4
        flex flex-col items-center justify-center text-white
        shadow-xl ${cardColor.shadow} ${cardColor.glow}
        transition-all duration-300 ease-out
        ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
        ${isPressed ? 'scale-95' : 'hover:scale-105'}
        ${completing ? 'opacity-80' : ''}
        relative overflow-hidden group
      `}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      {/* Shine effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

      <span className={`
        text-5xl mb-2 relative z-10 drop-shadow-lg
        transition-transform duration-300
        ${completing ? 'animate-bounce' : ''}
        ${isPressed ? 'scale-90' : 'group-hover:scale-110 group-hover:rotate-6'}
      `}>
        {iconConfig.emoji}
      </span>
      <span className="text-base font-bold text-center leading-tight line-clamp-2 relative z-10">
        {task.title}
      </span>
      {task.points && (
        <span className="text-sm text-white/90 mt-1 relative z-10 font-semibold">+{task.points} pts</span>
      )}
    </button>
  );
}

// Grid of simple task buttons for young kids
interface SimpleTaskGridProps {
  tasks: Task[];
  onComplete: (taskId: number) => void;
}

export function SimpleTaskGrid({ tasks, onComplete }: SimpleTaskGridProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-14 bg-gradient-to-br from-emerald-100 via-green-100 to-teal-100 rounded-3xl shadow-inner">
        <div className="relative inline-block">
          <div className="text-7xl mb-4 animate-bounce">🎉</div>
          <Sparkles className="absolute -top-2 -right-4 text-yellow-500 w-10 h-10 animate-pulse" />
          <Star className="absolute -bottom-2 -left-4 text-amber-500 w-8 h-8 fill-amber-500 animate-float" />
        </div>
        <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-teal-600">
          All done!
        </p>
        <p className="text-xl text-green-600 font-medium mt-2">Great job today! 🌟</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {tasks.map((task, index) => (
        <SimpleTaskButton key={task.id} task={task} onComplete={onComplete} index={index} />
      ))}
    </div>
  );
}
