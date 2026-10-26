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
  'reminders',
  'learn'             // FamilyHub Learn (LK20 lessons) - pilot, opt-in per family
] as const;

export type FeatureKey = typeof FEATURE_KEYS[number];

// Features that stay off unless a family explicitly opts in (family_features row)
export const DEFAULT_DISABLED_FEATURES: ReadonlySet<FeatureKey> = new Set<FeatureKey>(['learn']);

export const getFeatureDefault = (featureKey: FeatureKey): boolean => !DEFAULT_DISABLED_FEATURES.has(featureKey);

// Features usable while school_only_mode is on, unless the admin configures
// the `school_only_allowed_features` setting (JSON array of feature keys).
export const DEFAULT_SCHOOL_ONLY_FEATURES: readonly FeatureKey[] = ['school', 'learn'];
