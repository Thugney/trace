interface AvatarProps {
  avatar: string | undefined | null;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  alt?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-lg',
  md: 'w-10 h-10 text-xl',
  lg: 'w-16 h-16 text-3xl',
  xl: 'w-24 h-24 text-4xl',
  '2xl': 'w-32 h-32 text-6xl'
};

export default function Avatar({ avatar, size = 'md', className = '', alt = 'Avatar' }: AvatarProps) {
  const sizeClass = sizeClasses[size];
  const isImageUrl = avatar?.startsWith('/api/') || avatar?.startsWith('http');

  if (isImageUrl && avatar) {
    return (
      <img
        src={avatar}
        alt={alt}
        className={`${sizeClass} rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div className={`${sizeClass} rounded-full bg-slate-100 flex items-center justify-center ${className}`}>
      {avatar || '👤'}
    </div>
  );
}
