/**
 * Age group constants for personalization system
 */

// Age thresholds for personalization config
export const AGE_SIMPLE_MAX = 8;
export const AGE_ADVANCED_MIN = 9;

// Age thresholds for AgeContext age groups
export const AGE_YOUNG_MAX = 6;
export const AGE_MIDDLE_MAX = 10;
// Older: 11+

// Theme type constants
export const THEME_SIMPLE = 'simple' as const;
export const THEME_STANDARD = 'standard' as const;

// UI complexity constants
export const UI_COMPLEXITY_BASIC = 'basic' as const;
export const UI_COMPLEXITY_STANDARD = 'standard' as const;

// Sounds constants
export const SOUNDS_BASIC = 'basic' as const;
export const SOUNDS_STANDARD = 'standard' as const;

// Difficulty constants
export const DIFFICULTY_EASY = 'easy' as const;
export const DIFFICULTY_MEDIUM = 'medium' as const;