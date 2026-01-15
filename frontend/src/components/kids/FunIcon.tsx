// Task category icons - fun emojis for different task types
export const TASK_ICONS: Record<string, { emoji: string; color: string; bgColor: string; label: string }> = {
  reading: { emoji: '📚', color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Reading' },
  homework: { emoji: '📝', color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Homework' },
  chores: { emoji: '🧹', color: 'text-green-600', bgColor: 'bg-green-100', label: 'Chores' },
  cleaning: { emoji: '✨', color: 'text-cyan-600', bgColor: 'bg-cyan-100', label: 'Cleaning' },
  exercise: { emoji: '🏃', color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'Exercise' },
  creative: { emoji: '🎨', color: 'text-pink-600', bgColor: 'bg-pink-100', label: 'Creative' },
  music: { emoji: '🎵', color: 'text-indigo-600', bgColor: 'bg-indigo-100', label: 'Music' },
  coding: { emoji: '💻', color: 'text-slate-600', bgColor: 'bg-slate-100', label: 'Coding' },
  kitchen: { emoji: '🍽️', color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Kitchen' },
  school: { emoji: '🎒', color: 'text-red-600', bgColor: 'bg-red-100', label: 'School' },
  language: { emoji: '🗣️', color: 'text-teal-600', bgColor: 'bg-teal-100', label: 'Language' },
  math: { emoji: '🔢', color: 'text-violet-600', bgColor: 'bg-violet-100', label: 'Math' },
  science: { emoji: '🔬', color: 'text-emerald-600', bgColor: 'bg-emerald-100', label: 'Science' },
  movie: { emoji: '🎬', color: 'text-rose-600', bgColor: 'bg-rose-100', label: 'Movie Time' },
  game: { emoji: '🎮', color: 'text-fuchsia-600', bgColor: 'bg-fuchsia-100', label: 'Gaming' },
  sleep: { emoji: '😴', color: 'text-indigo-600', bgColor: 'bg-indigo-100', label: 'Bedtime' },
  pet: { emoji: '🐕', color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Pet Care' },
  default: { emoji: '✅', color: 'text-emerald-600', bgColor: 'bg-emerald-100', label: 'Task' },
};

// Dashboard stat icons
export const STAT_ICONS = {
  stars: '⭐',
  points: '💎',
  coins: '🪙',
  level: '🏆',
  streak: '🔥',
  water: '💧',
  reminder: '⏰',
  challenge: '🎯',
  leaderboard: '🏅',
  done: '✅',
  todo: '📋',
  goal: '🎪',
  bonus: '🎁',
  rocket: '🚀',
  heart: '❤️',
  lightning: '⚡',
};

// Fun avatars for boys (superheroes & animals)
export const BOY_AVATARS = [
  { emoji: '🦸‍♂️', label: 'Superhero' },
  { emoji: '🦇', label: 'Batman' },
  { emoji: '🕷️', label: 'Spider' },
  { emoji: '⚡', label: 'Flash' },
  { emoji: '🛡️', label: 'Captain' },
  { emoji: '🦁', label: 'Lion' },
  { emoji: '🐺', label: 'Wolf' },
  { emoji: '🦖', label: 'T-Rex' },
  { emoji: '🐉', label: 'Dragon' },
  { emoji: '🦈', label: 'Shark' },
  { emoji: '🦍', label: 'Gorilla' },
  { emoji: '🐯', label: 'Tiger' },
  { emoji: '🥷', label: 'Ninja' },
  { emoji: '🤖', label: 'Robot' },
  { emoji: '👾', label: 'Alien' },
  { emoji: '🚀', label: 'Rocket' },
];

// Fun avatars for girls
export const GIRL_AVATARS = [
  { emoji: '👸', label: 'Princess' },
  { emoji: '🧚', label: 'Fairy' },
  { emoji: '🦄', label: 'Unicorn' },
  { emoji: '🧜‍♀️', label: 'Mermaid' },
  { emoji: '🦋', label: 'Butterfly' },
  { emoji: '🌸', label: 'Flower' },
  { emoji: '⭐', label: 'Star' },
  { emoji: '🌈', label: 'Rainbow' },
  { emoji: '🐱', label: 'Kitty' },
  { emoji: '🐰', label: 'Bunny' },
  { emoji: '🦢', label: 'Swan' },
  { emoji: '💖', label: 'Heart' },
  { emoji: '🎀', label: 'Bow' },
  { emoji: '🍭', label: 'Candy' },
  { emoji: '🌟', label: 'Sparkle' },
  { emoji: '🦩', label: 'Flamingo' },
];

// Universal fun avatars (for all)
export const UNIVERSAL_AVATARS = [
  { emoji: '🎮', label: 'Gamer' },
  { emoji: '⚽', label: 'Soccer' },
  { emoji: '🏀', label: 'Basketball' },
  { emoji: '🎸', label: 'Rockstar' },
  { emoji: '🎨', label: 'Artist' },
  { emoji: '📚', label: 'Reader' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '💎', label: 'Diamond' },
  { emoji: '🌙', label: 'Moon' },
  { emoji: '☀️', label: 'Sun' },
];

interface FunIconProps {
  icon: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  animate?: 'none' | 'bounce' | 'pulse' | 'wiggle' | 'spin';
  className?: string;
  showBg?: boolean;
  bgColor?: string;
}

const sizeClasses = {
  xs: 'text-lg',
  sm: 'text-xl',
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
  '2xl': 'text-5xl',
};

const animateClasses = {
  none: '',
  bounce: 'animate-bounce',
  pulse: 'animate-pulse',
  wiggle: 'animate-wiggle',
  spin: 'animate-spin',
};

const bgSizeClasses = {
  xs: 'w-7 h-7',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-14 h-14',
  '2xl': 'w-16 h-16',
};

export default function FunIcon({
  icon,
  size = 'md',
  animate = 'none',
  className = '',
  showBg = false,
  bgColor = 'bg-slate-100',
}: FunIconProps) {
  const content = (
    <span className={`${sizeClasses[size]} ${animateClasses[animate]} ${className}`}>
      {icon}
    </span>
  );

  if (showBg) {
    return (
      <div className={`${bgSizeClasses[size]} ${bgColor} rounded-full flex items-center justify-center`}>
        {content}
      </div>
    );
  }

  return content;
}

// Helper to get task icon config
export function getTaskIconConfig(category?: string) {
  if (!category) return TASK_ICONS.default;
  const normalizedCategory = category.toLowerCase().replace(/[^a-z]/g, '');
  return TASK_ICONS[normalizedCategory] || TASK_ICONS.default;
}

// Stat badge component
interface StatBadgeProps {
  icon: keyof typeof STAT_ICONS;
  value: number | string;
  label?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function StatBadge({ icon, value, label, color = 'bg-slate-100', size = 'md' }: StatBadgeProps) {
  const emoji = STAT_ICONS[icon];
  const textSize = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-base';
  const padding = size === 'sm' ? 'px-2 py-1' : size === 'lg' ? 'px-4 py-2' : 'px-3 py-1.5';

  return (
    <div className={`${color} ${padding} rounded-full flex items-center gap-1.5`}>
      <span className={textSize}>{emoji}</span>
      <span className={`font-bold ${textSize}`}>{value}</span>
      {label && <span className={`text-slate-600 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>{label}</span>}
    </div>
  );
}
