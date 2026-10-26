// ==================== ACTIVITY TYPES ====================

export interface ActivityType {
  id: number;
  name: string;
  display_name: string;
  description: string;
  icon: string;
  difficulty_base: number;
  supports_images: boolean;
  supports_audio: boolean;
  min_items: number;
  max_items: number;
  config_schema?: string;
  created_at: string;
}

export interface LearningSession {
  id: number;
  title: string;
  description?: string;
  topic: string;
  age_range?: string;
  created_by: number;
  assigned_to: number;
  assigned_to_name?: string;
  assigned_to_avatar?: string;
  points_per_activity: number;
  stars_per_session: number;
  bonus_points: number;
  time_limit_seconds?: number;
  pass_threshold: number;
  is_ai_generated: boolean | number;
  ai_prompt?: string;
  ai_provider?: string;
  schedule_type: 'anytime' | 'scheduled';
  schedule_days?: string;
  is_active: boolean | number;
  is_competition: boolean | number;
  competition_ends_at?: string;
  first_place_bonus: number;
  second_place_bonus: number;
  third_place_bonus: number;
  created_at: string;
  updated_at: string;
  activity_count?: number;
  best_score?: number;
  attempt_count?: number;
  activities?: LearningActivity[];
}

export interface LearningActivity {
  id: number;
  session_id: number;
  activity_type_id: number;
  activity_type_name?: string;
  activity_type_display?: string;
  activity_type_icon?: string;
  title: string;
  instructions?: string;
  content_data: ActivityContentData;
  correct_data?: ActivityCorrectData;
  hints: string[];
  explanation?: string;
  points: number;
  time_limit_seconds?: number;
  order_index: number;
  difficulty: 'easy' | 'medium' | 'hard';
  image_url?: string;
  audio_url?: string;
  created_at: string;
}

// ==================== CONTENT DATA TYPES ====================

export type ActivityContentData =
  | MultipleChoiceContent
  | TrueFalseContent
  | FillBlanksContent
  | MatchingContent
  | SortingContent
  | DragDropContent
  | MemoryGameContent
  | FlashcardsContent
  | ArithmeticContent
  | WordSearchContent
  | CrosswordContent
  | ImageHotspotsContent;

export type ActivityCorrectData =
  | MultipleChoiceCorrect
  | TrueFalseCorrect
  | FillBlanksCorrect
  | MatchingCorrect
  | SortingCorrect
  | DragDropCorrect
  | MemoryGameCorrect
  | ArithmeticCorrect
  | FlashcardsCorrect
  | WordSearchCorrect
  | CrosswordCorrect
  | ImageHotspotsCorrect;

// Multiple Choice
export interface MultipleChoiceContent {
  question: string;
  options: { id: string; text: string; image?: string }[];
}

export interface MultipleChoiceCorrect {
  correctAnswer: string;
}

// True/False
export interface TrueFalseContent {
  statements: { text: string; isTrue: boolean }[];
}

export interface TrueFalseCorrect {
  answers: boolean[];
}

// Fill in the Blanks
export interface FillBlanksContent {
  sentences: string[];
}

export interface FillBlanksCorrect {
  blanks: { position: number; answer: string; acceptAlternatives?: string[] }[];
}

// Matching
export interface MatchingContent {
  pairs: {
    left: string;
    right: string;
    leftImage?: string;
    rightImage?: string;
  }[];
}

export interface MatchingCorrect {
  correctPairs: Record<number, number>;
}

// Sorting
export interface SortingContent {
  items: { id: string; text: string; image?: string }[];
  instruction?: string;
}

export interface SortingCorrect {
  correctOrder: string[];
}

// Drag & Drop
export interface DragDropContent {
  instruction?: string;
  draggableItems: { id: string; text: string; image?: string }[];
  dropZones: { id: string; label: string; image?: string; maxItems?: number }[];
}

export interface DragDropCorrect {
  correctPlacements: Record<string, string[]>;
}

// Memory Game
export interface MemoryGameContent {
  pairs: { front: string; back: string; frontImage?: string; backImage?: string }[];
}

export interface MemoryGameCorrect {
  pairs: { front: string; back: string }[];
}

// Flashcards
export interface FlashcardsContent {
  cards: { front: string; back: string; image?: string; audio?: string }[];
  reviewMode: 'sequential' | 'random';
}

export interface FlashcardsCorrect {
  cards: { front: string; back: string }[];
}

// Arithmetic
export interface ArithmeticContent {
  problems: { expression: string; answer: number; showWorkingArea?: boolean }[];
  allowCalculator: boolean;
}

export interface ArithmeticCorrect {
  problems: { expression: string; answer: number }[];
}

// Word Search
export interface WordSearchContent {
  grid: string[][];
  words: string[];
}

export interface WordSearchCorrect {
  words: string[];
}

// Crossword
export interface CrosswordContent {
  grid: string[][];
  clues: {
    across: { number: number; clue: string; startRow: number; startCol: number }[];
    down: { number: number; clue: string; startRow: number; startCol: number }[];
  };
}

export interface CrosswordCorrect {
  solution: Record<string, string>;
}

// Image Hotspots
export interface ImageHotspotsContent {
  image?: string;
  hotspots: {
    id: string;
    x: number;
    y: number;
    label: string;
    description?: string;
    additionalInfo?: string;
  }[];
}

export interface ImageHotspotsCorrect {
  hotspots: { id: string }[];
}

// ==================== USER RESPONSE TYPES ====================

export type ActivityUserResponse =
  | MultipleChoiceResponse
  | TrueFalseResponse
  | FillBlanksResponse
  | MatchingResponse
  | SortingResponse
  | DragDropResponse
  | MemoryGameResponse
  | ArithmeticResponse
  | FlashcardsResponse
  | WordSearchResponse
  | CrosswordResponse
  | ImageHotspotsResponse;

export interface MultipleChoiceResponse {
  answer: string;
}

export interface TrueFalseResponse {
  answer: boolean;
}

export interface FillBlanksResponse {
  answers: string[];
}

export interface MatchingResponse {
  matches: Record<string, string>;
}

export interface SortingResponse {
  order: string[];
}

export interface DragDropResponse {
  placements: Record<string, string>;
}

export interface MemoryGameResponse {
  completed: boolean;
  moves: number;
  time: number;
}

export interface ArithmeticResponse {
  answers: (number | string)[];
}

export interface FlashcardsResponse {
  reviewedCount: number;
}

export interface WordSearchResponse {
  foundWords: string[];
}

export interface CrosswordResponse {
  answers: Record<string, string>;
}

export interface ImageHotspotsResponse {
  clickedHotspots: string[];
}

// ==================== ATTEMPT TYPES ====================

export interface SessionAttempt {
  id: number;
  session_id: number;
  profile_id: number;
  started_at: string;
  completed_at?: string;
  total_activities: number;
  completed_activities: number;
  total_score: number;
  max_possible_score: number;
  score_percentage: number;
  points_earned: number;
  stars_earned: number;
  time_bonus_points: number;
  time_taken_seconds?: number;
  passed: boolean | number;
  competition_rank?: number;
  bonus_awarded: number;
  // Joined fields
  title?: string;
  topic?: string;
  name?: string;
  avatar?: string;
}

export interface ActivityResult {
  id: number;
  attempt_id: number;
  activity_id: number;
  user_response: string;
  score: number;
  max_score: number;
  is_correct: boolean | number;
  partial_score: number;
  hints_used: number;
  time_taken_seconds?: number;
  answered_at: string;
}

// ==================== STATS TYPES ====================

export interface ParentActivityStats {
  total_sessions: number;
  total_attempts: number;
  avg_score: number;
  passed_count: number;
}

export interface ChildActivityStats {
  total_attempts: number;
  total_points: number;
  total_stars: number;
  avg_score: number;
  passed_count: number;
  best_score: number;
  byActivityType: {
    display_name: string;
    icon: string;
    count: number;
    accuracy: number;
  }[];
}

// ==================== AI GENERATION TYPES ====================

export interface AiGenerationRequest {
  topic: string;
  targetAge: number;
  activityCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
  preferredTypes?: string[];
  customInstructions?: string;
  createdBy: number;
  assignedTo: number;
  textProvider?: 'ollama' | 'gemini' | 'grok' | 'openai';
  pointsPerActivity?: number;
}

export interface AiGenerationJob {
  jobId: string;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  sessionId?: number;
  activityCount?: number;
  error?: string;
}

// ==================== SUBMISSION RESULT ====================

export interface ActivitySubmissionResult {
  score: number;
  maxScore: number;
  isCorrect: boolean;
  partialScore: number;
  feedback: string;
  explanation?: string;
  /** Authorized answer feedback returned only after server-side submission. */
  correctData?: ActivityCorrectData;
  /** A resumed answer replays its original response and adjusted result. */
  replayed?: boolean;
  userResponse?: ActivityUserResponse;
  hintsUsed?: number;
}

export interface SessionCompletionResult {
  completed: boolean;
  scorePercentage: number;
  passed: boolean;
  pointsEarned: number;
  starsEarned: number;
  timeBonusPoints: number;
  competitionRank?: number;
  competitionBonus: number;
  totalScore: number;
  maxPossibleScore: number;
}

// ==================== LEADERBOARD ====================

export interface ActivityLeaderboardEntry {
  id: number;
  session_id: number;
  profile_id: number;
  name: string;
  avatar?: string;
  score_percentage: number;
  points_earned: number;
  time_taken_seconds?: number;
  competition_rank?: number;
}
