import { ReactNode } from 'react';

interface StatItemProps {
  emoji: string;
  value: number | string;
  label: string;
  color: string;
  onClick?: () => void;
}

function StatItem({ emoji, value, label, color, onClick }: StatItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        ${color} rounded-2xl p-3 flex flex-col items-center justify-center
        transition-all duration-300 hover:scale-105 active:scale-95
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
        min-w-[70px]
      `}
    >
      <span className="text-2xl mb-0.5">{emoji}</span>
      <span className="text-lg font-bold text-slate-800">{value}</span>
      <span className="text-xs text-slate-600">{label}</span>
    </button>
  );
}

interface QuickStatsProps {
  stars: number;
  points: number;
  level: number;
  streak?: number;
  onStarsClick?: () => void;
  onPointsClick?: () => void;
  onLevelClick?: () => void;
  onStreakClick?: () => void;
}

export default function QuickStats({
  stars,
  points,
  level,
  streak = 0,
  onStarsClick,
  onPointsClick,
  onLevelClick,
  onStreakClick,
}: QuickStatsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
      <StatItem
        emoji="⭐"
        value={stars}
        label="Stars"
        color="bg-yellow-100"
        onClick={onStarsClick}
      />
      <StatItem
        emoji="💎"
        value={points}
        label="Points"
        color="bg-purple-100"
        onClick={onPointsClick}
      />
      <StatItem
        emoji="🏆"
        value={level}
        label="Level"
        color="bg-orange-100"
        onClick={onLevelClick}
      />
      {streak > 0 && (
        <StatItem
          emoji="🔥"
          value={streak}
          label="Streak"
          color="bg-red-100"
          onClick={onStreakClick}
        />
      )}
    </div>
  );
}

// Hero stats card for the top of dashboard
interface HeroStatsProps {
  name: string;
  avatar: ReactNode;
  level: number;
  points: number;
  pointsToNextLevel: number;
  onAvatarClick?: () => void;
}

export function HeroStats({
  name,
  avatar,
  level,
  points,
  pointsToNextLevel,
  onAvatarClick,
}: HeroStatsProps) {
  const progress = Math.min(((100 - pointsToNextLevel) / 100) * 100, 100);

  return (
    <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-3xl p-5 text-white shadow-xl">
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <button
          onClick={onAvatarClick}
          className="relative group"
        >
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-4xl ring-4 ring-white/30 transition-transform group-hover:scale-110">
            {avatar}
          </div>
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-white/90 text-purple-600 text-[10px] font-bold px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            Edit
          </span>
        </button>

        {/* Name and Level */}
        <div className="flex-1">
          <h1 className="text-xl font-bold truncate">Hey {name}! 👋</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-lg">🏆</span>
            <span className="font-semibold">Level {level}</span>
            <span className="text-white/70">•</span>
            <span className="text-white/90">{points} pts</span>
          </div>
        </div>
      </div>

      {/* Progress to next level */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-white/80 mb-1">
          <span>Next level progress</span>
          <span>{pointsToNextLevel} pts to go!</span>
        </div>
        <div className="w-full bg-white/20 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-yellow-300 to-orange-400 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Compact stat pills for inline use
interface StatPillProps {
  emoji: string;
  value: number | string;
  color?: string;
}

export function StatPill({ emoji, value, color = 'bg-slate-100' }: StatPillProps) {
  return (
    <span className={`${color} px-2.5 py-1 rounded-full text-sm font-medium inline-flex items-center gap-1`}>
      <span>{emoji}</span>
      <span>{value}</span>
    </span>
  );
}
