import { ReactNode } from 'react';

export type CardTheme = 'superhero' | 'nature' | 'magical' | 'sports' | 'ocean' | 'space' | 'candy' | 'default';

interface FunCardProps {
  children: ReactNode;
  theme?: CardTheme;
  className?: string;
  onClick?: () => void;
  animate?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const themeStyles: Record<CardTheme, string> = {
  superhero: 'from-red-400 via-red-500 to-blue-600',
  nature: 'from-green-400 via-emerald-500 to-cyan-500',
  magical: 'from-purple-400 via-pink-500 to-rose-500',
  sports: 'from-orange-400 via-amber-500 to-yellow-500',
  ocean: 'from-blue-400 via-cyan-500 to-teal-500',
  space: 'from-indigo-500 via-purple-600 to-pink-600',
  candy: 'from-pink-400 via-rose-400 to-orange-400',
  default: 'from-slate-100 to-slate-200',
};

const sizeStyles = {
  sm: 'p-3 rounded-xl',
  md: 'p-4 rounded-2xl',
  lg: 'p-6 rounded-3xl',
};

export default function FunCard({
  children,
  theme = 'default',
  className = '',
  onClick,
  animate = true,
  size = 'md',
}: FunCardProps) {
  const isGradient = theme !== 'default';

  return (
    <div
      onClick={onClick}
      className={`
        bg-gradient-to-br ${themeStyles[theme]}
        ${sizeStyles[size]}
        ${isGradient ? 'text-white shadow-lg' : 'bg-white border border-slate-200 shadow-md'}
        ${onClick ? 'cursor-pointer' : ''}
        ${animate ? 'transition-all duration-300 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

// Preset card variants for common use cases
export function SuperheroCard({ children, ...props }: Omit<FunCardProps, 'theme'>) {
  return <FunCard theme="superhero" {...props}>{children}</FunCard>;
}

export function NatureCard({ children, ...props }: Omit<FunCardProps, 'theme'>) {
  return <FunCard theme="nature" {...props}>{children}</FunCard>;
}

export function MagicalCard({ children, ...props }: Omit<FunCardProps, 'theme'>) {
  return <FunCard theme="magical" {...props}>{children}</FunCard>;
}

export function SportsCard({ children, ...props }: Omit<FunCardProps, 'theme'>) {
  return <FunCard theme="sports" {...props}>{children}</FunCard>;
}

export function OceanCard({ children, ...props }: Omit<FunCardProps, 'theme'>) {
  return <FunCard theme="ocean" {...props}>{children}</FunCard>;
}

export function SpaceCard({ children, ...props }: Omit<FunCardProps, 'theme'>) {
  return <FunCard theme="space" {...props}>{children}</FunCard>;
}
