import { useState } from 'react';
import { Check, Star, Camera } from 'lucide-react';
import { useTaskIcon } from '../context/AgeContext';
import playSounds from '../utils/sounds';
import confetti from 'canvas-confetti';
import PhotoProof from './PhotoProof';

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
  };
  onComplete: (taskId: number) => void;
  disabled?: boolean;
}

export default function SimpleTaskCard({ task, onComplete, disabled }: SimpleTaskCardProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showPhotoProof, setShowPhotoProof] = useState(false);
  const { emoji, color } = useTaskIcon(task.category);

  const proofRequired = task.proof_required === true || task.proof_required === 1;
  const hasProof = !!task.proof_photo_url;

  const completeTask = () => {
    setIsAnimating(true);
    playSounds.click();

    setTimeout(() => {
      onComplete(task.id);
      setShowCelebration(true);
      playSounds.levelUp();

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff']
      });

      setTimeout(() => {
        setShowCelebration(false);
        setIsAnimating(false);
      }, 2000);
    }, 300);
  };

  const handleTap = async () => {
    if (task.completed || disabled || isAnimating) return;

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

  if (task.completed) {
    return (
      <div className="relative aspect-square rounded-3xl bg-gradient-to-br from-green-100 to-green-200 border-4 border-green-300 flex flex-col items-center justify-center p-4 shadow-lg">
        <div className="absolute -top-2 -right-2 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg animate-bounce">
          <Check className="w-8 h-8 text-white" strokeWidth={3} />
        </div>
        <span className="text-7xl mb-2 opacity-50">{emoji}</span>
        <div className="flex items-center gap-1 text-green-600 font-bold text-xl">
          <Star className="w-6 h-6 fill-current" />
          Done!
        </div>
        {hasProof && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
            <span className="text-xs text-green-600 flex items-center gap-1">
              <Camera size={12} /> Photo added
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
        disabled={disabled || isAnimating}
        className={`
          relative aspect-square rounded-3xl border-4
          flex flex-col items-center justify-center p-4
          shadow-xl transition-all duration-200
          ${color} border-slate-200
          ${isAnimating ? 'scale-95' : 'hover:scale-105 active:scale-95'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          focus:outline-none focus:ring-4 focus:ring-indigo-300
        `}
        style={{ minHeight: '160px', minWidth: '160px' }}
      >
        <span className={`text-7xl mb-3 ${isAnimating ? 'animate-bounce' : ''}`}>
          {emoji}
        </span>

        <div className="absolute -top-2 -right-2 w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
          <span className="text-white font-bold text-lg">+{task.points}</span>
        </div>

        {proofRequired && (
          <div className="absolute -top-2 -left-2 w-10 h-10 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full flex items-center justify-center shadow-lg">
            <Camera className="w-5 h-5 text-white" />
          </div>
        )}

        <p className="text-lg font-bold text-slate-700 text-center line-clamp-2 px-2">
          {task.title}
        </p>

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
          <span className="text-sm text-slate-400 animate-pulse">
            {proofRequired ? '📸 Take photo!' : 'Tap me!'}
          </span>
        </div>

        {showCelebration && (
          <div className="absolute inset-0 bg-green-400/90 rounded-3xl flex flex-col items-center justify-center animate-pulse">
            <span className="text-6xl mb-2">🎉</span>
            <span className="text-2xl font-bold text-white">Great job!</span>
            <span className="text-lg text-white/80">+{task.points} points!</span>
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
      <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-3xl">
        <span className="text-8xl mb-4">🌟</span>
        <h2 className="text-3xl font-bold text-indigo-600 mb-2">All done!</h2>
        <p className="text-xl text-slate-500">Great job today!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      {visibleTasks.map(task => (
        <SimpleTaskCard
          key={task.id}
          task={task}
          onComplete={onComplete}
        />
      ))}

      {incompleteTasks.length > maxTasks && (
        <div className="col-span-2 text-center py-4">
          <span className="text-lg text-slate-500">
            +{incompleteTasks.length - maxTasks} more tasks
          </span>
        </div>
      )}
    </div>
  );
}
