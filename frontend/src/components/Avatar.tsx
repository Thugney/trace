import { useState, useEffect } from 'react';

interface AvatarProps {
  avatar: string | undefined | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  alt?: string;
}

const sizeClasses = {
  xs: 'w-5 h-5 text-xs',
  sm: 'w-8 h-8 text-lg',
  md: 'w-10 h-10 text-xl',
  lg: 'w-16 h-16 text-3xl',
  xl: 'w-24 h-24 text-4xl',
  '2xl': 'w-32 h-32 text-6xl'
};

// Check if the string looks like an image file/URL
const isImageAvatar = (avatar: string | undefined | null): boolean => {
  if (!avatar) return false;

  // Already a proper URL
  if (avatar.startsWith('/api/') || avatar.startsWith('http') || avatar.startsWith('/uploads/')) {
    return true;
  }

  // Check if it looks like an image filename
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const lowerAvatar = avatar.toLowerCase();
  return imageExtensions.some(ext => lowerAvatar.endsWith(ext));
};

// Get the proper image URL
const getAvatarUrl = (avatar: string): string => {
  // Already a proper URL
  if (avatar.startsWith('/api/') || avatar.startsWith('http') || avatar.startsWith('/uploads/')) {
    return avatar;
  }

  // If it's just a filename, we can't construct the full path without profile ID
  // Return as-is and let error handling deal with it
  return avatar;
};

export default function Avatar({ avatar, size = 'md', className = '', alt = 'Avatar' }: AvatarProps) {
  const sizeClass = sizeClasses[size];
  const [imageError, setImageError] = useState(false);

  // Reset error state when avatar URL changes
  useEffect(() => {
    setImageError(false);
  }, [avatar]);

  const showAsImage = isImageAvatar(avatar) && !imageError;

  if (showAsImage && avatar) {
    const imgUrl = getAvatarUrl(avatar);
    return (
      <img
        src={imgUrl}
        alt={alt}
        className={`${sizeClass} rounded-full object-cover ${className}`}
        onError={() => setImageError(true)}
      />
    );
  }

  // Fallback: show emoji or first letter
  const fallbackContent = avatar && !isImageAvatar(avatar) ? avatar : '👤';

  return (
    <div className={`${sizeClass} rounded-full bg-slate-100 flex items-center justify-center ${className}`}>
      {fallbackContent}
    </div>
  );
}
