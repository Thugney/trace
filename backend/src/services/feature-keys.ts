export const FEATURE_KEYS = [
  'school',
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
