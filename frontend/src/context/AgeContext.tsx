import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useProfile } from './ProfileContext';

type AgeGroup = 'young' | 'middle' | 'older' | 'adult';

interface AgeSettings {
  ageGroup: AgeGroup;
  simplifiedMode: boolean;
  fontSize: 'normal' | 'large' | 'extra-large';
  iconSize: 'normal' | 'large' | 'extra-large';
  themeClass: string;
  maxTasksPerView: number;
  showTextLabels: boolean;
  useLargeButtons: boolean;
  celebrationIntensity: 'subtle' | 'medium' | 'high';
}

interface AgeContextType {
  age: number | null;
  settings: AgeSettings;
  isYoungChild: boolean;
  isMiddleChild: boolean;
  isOlderChild: boolean;
  isAdult: boolean;
}

const defaultSettings: AgeSettings = {
  ageGroup: 'adult',
  simplifiedMode: false,
  fontSize: 'normal',
  iconSize: 'normal',
  themeClass: '',
  maxTasksPerView: 20,
  showTextLabels: true,
  useLargeButtons: false,
  celebrationIntensity: 'subtle'
};

const AgeContext = createContext<AgeContextType>({
  age: null,
  settings: defaultSettings,
  isYoungChild: false,
  isMiddleChild: false,
  isOlderChild: false,
  isAdult: true
});

export function AgeProvider({ children }: { children: ReactNode }) {
  const { currentProfile } = useProfile();

  const contextValue = useMemo(() => {
    const age = currentProfile?.age || null;
    const profileType = currentProfile?.type || 'parent';

    // Determine age group
    let ageGroup: AgeGroup = 'adult';
    if (profileType === 'child' && age !== null) {
      if (age <= 6) {
        ageGroup = 'young';
      } else if (age <= 10) {
        ageGroup = 'middle';
      } else {
        ageGroup = 'older';
      }
    }

    // Configure settings based on age group
    let settings: AgeSettings;

    switch (ageGroup) {
      case 'young':
        // 5-6 year olds: Picture-based, minimal text, large everything
        settings = {
          ageGroup: 'young',
          simplifiedMode: true,
          fontSize: 'extra-large',
          iconSize: 'extra-large',
          themeClass: 'theme-kid-5',
          maxTasksPerView: 4, // Only show 4 tasks at a time
          showTextLabels: false, // Use pictures/emojis instead
          useLargeButtons: true,
          celebrationIntensity: 'high' // Big celebrations!
        };
        break;

      case 'middle':
        // 7-10 year olds: Engaging visuals, readable text
        settings = {
          ageGroup: 'middle',
          simplifiedMode: false,
          fontSize: 'large',
          iconSize: 'large',
          themeClass: 'theme-kid-7',
          maxTasksPerView: 8,
          showTextLabels: true,
          useLargeButtons: true,
          celebrationIntensity: 'medium'
        };
        break;

      case 'older':
        // 11+ year olds: Full features, more mature UI
        settings = {
          ageGroup: 'older',
          simplifiedMode: false,
          fontSize: 'normal',
          iconSize: 'normal',
          themeClass: 'theme-kid-12',
          maxTasksPerView: 15,
          showTextLabels: true,
          useLargeButtons: false,
          celebrationIntensity: 'subtle'
        };
        break;

      default:
        // Adults: Standard interface
        settings = defaultSettings;
    }

    return {
      age,
      settings,
      isYoungChild: ageGroup === 'young',
      isMiddleChild: ageGroup === 'middle',
      isOlderChild: ageGroup === 'older',
      isAdult: ageGroup === 'adult'
    };
  }, [currentProfile]);

  return (
    <AgeContext.Provider value={contextValue}>
      {children}
    </AgeContext.Provider>
  );
}

export function useAge() {
  return useContext(AgeContext);
}

// Helper hook to get task icon/emoji based on category
export function useTaskIcon(category: string): { emoji: string; color: string } {
  const icons: Record<string, { emoji: string; color: string }> = {
    'read-book': { emoji: '📚', color: 'bg-blue-100' },
    'tigrinya': { emoji: '🇪🇷', color: 'bg-purple-100' },
    'clean-room': { emoji: '🧹', color: 'bg-green-100' },
    'clean-kitchen': { emoji: '🍽️', color: 'bg-yellow-100' },
    'school': { emoji: '🎒', color: 'bg-orange-100' },
    'watch-movies': { emoji: '🎬', color: 'bg-pink-100' },
    'homework': { emoji: '📝', color: 'bg-indigo-100' },
    'exercise': { emoji: '🏃', color: 'bg-red-100' },
    'music': { emoji: '🎵', color: 'bg-teal-100' },
    'art': { emoji: '🎨', color: 'bg-rose-100' },
    'chores': { emoji: '🏠', color: 'bg-amber-100' },
    'other': { emoji: '✨', color: 'bg-slate-100' }
  };

  return icons[category] || icons['other'];
}
