export const FEATURE_KEYS = [
  'school',           // Church School
  'regular_school',   // Regular School homework tracking
  'shopping',         // Shopping Gamification
  'books',            // AI Book Creator
  'activities',       // Learning Activity Engine (H5P-inspired)
  'tasks',
  'diet',
  'ai',
  'notes',
  'rewards',
  'calendar',
  'quizzes',
  'goals',
  'gamification',
  'leaderboard',
  'journey',
  'reminders'
] as const;

export type FeatureKey = typeof FEATURE_KEYS[number];
