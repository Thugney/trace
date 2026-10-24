// FamilyHub Learn types (mirror backend/src/routes/learn.ts responses)

export type LearnLocale = 'nb' | 'en';
export type ReviewStatus = 'draft' | 'reviewed' | 'retired';
export type LessonState = 'not_started' | 'reading' | 'practiced' | 'mastered';

export interface LearnStatus {
  enabled: boolean;
  family_opted_in: boolean;
  role: 'admin' | 'parent' | 'child' | 'teacher';
  can_manage_family: boolean;
  can_review: boolean;
  blocked_by_school_only_mode: boolean;
}

export interface LearnGoal {
  id: number;
  goal_key: string;
  official_goal_ref: string | null;
  source_locator: string;
  goal_after_grade: number;
  description: string;
  description_is_paraphrase: boolean;
  verification_status: 'unverified' | 'verified';
  source_url: string;
  curriculum_revision: string;
  is_local_sequence: boolean;
}

export interface LearnLessonSummary {
  id: number;
  title: string;
  version: number;
  locale?: LearnLocale;
  review_status: ReviewStatus;
}

export interface LearnMockExamSummary {
  id: number;
  title: string;
  version: number;
  time_limit_minutes: number;
  item_count?: number;
  review_status: ReviewStatus;
}

export interface LearnTopic {
  id: number;
  slug: string;
  grade: number;
  title: string;
  summary: string;
  sort_order: number;
  prerequisite_topic_id: number | null;
  goals: LearnGoal[];
  lessons: LearnLessonSummary[];
  mock_exams: LearnMockExamSummary[];
}

export interface LearnSubject {
  id: number;
  slug: string;
  title: string;
  udir_code: string;
  instruction_locale: LearnLocale;
  topics: LearnTopic[];
}

export interface LessonSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface WorkedExample {
  title: string;
  problem: string;
  steps: string[];
  answer: string;
}

export interface LessonBody {
  intro: string;
  sections: LessonSection[];
  workedExamples: WorkedExample[];
  keyTerms: { term: string; definition: string }[];
  checkYourself: string[];
}

export interface PracticeResult {
  sessionId: number;
  attempts: number;
  bestAttemptId: number | null;
  bestPercent: number | null;
  passed: boolean;
  lastCompletedAt: string | null;
}

export interface LearnLesson {
  id: number;
  topic_id: number;
  slug: string;
  title: string;
  locale: LearnLocale;
  version: number;
  authored_by: string;
  review_status: ReviewStatus;
  reviewed_at: string | null;
  body: LessonBody;
  flashcards: { key: string; front: string; back: string }[];
  practice: { key: string; type: string; title: string }[];
  topic: Omit<LearnTopic, 'lessons' | 'mock_exams'> & {
    subject_slug: string;
    subject_title: string;
    udir_code: string;
    instruction_locale: LearnLocale;
  };
  personal_cards: { id: number; forked_from_card_key: string | null; front: string; back: string }[];
  practice_result: PracticeResult | null;
}

export interface LearnFlashcard {
  key: string;
  front: string;
  back: string;
  source: 'curated' | 'personal';
  personal_id?: number;
  box: number;
  last_rating: 'known' | 'missed' | null;
  due: boolean;
  next_due_at: string | null;
}

export interface LearnAssignment {
  id: number;
  child_id: number;
  assigned_by: number;
  assigned_by_name: string;
  lesson_id: number | null;
  lesson_title: string | null;
  mock_exam_id: number | null;
  mock_exam_title: string | null;
  due_at: string | null;
  note: string | null;
  state: 'assigned' | 'completed' | 'cancelled';
  created_at: string;
  completed_at: string | null;
}

export interface LessonProgress {
  lesson_id: number;
  lesson_title: string;
  topic_id: number;
  topic_title: string;
  subject_title: string;
  subject_slug: string;
  grade: number;
  state: LessonState;
  read_at: string | null;
  practice: { attempts: number; best_percent: number | null; passed: boolean; last_completed_at: string | null } | null;
  flashcards_due: number;
}

export interface MockAttemptSummary {
  id: number;
  exam_id: number;
  exam_title: string;
  submitted_at: string;
  score: number;
  max_score: number;
  outcome: 'graded' | 'insufficient_evidence';
  indicative_grade: number | null;
}

export interface LearnerProgress {
  learner_id: number;
  child?: { id: number; name: string };
  lessons: LessonProgress[];
  mock_attempts: MockAttemptSummary[];
  assignments: LearnAssignment[];
}

export interface MockExamInfo {
  id: number;
  topic_id: number;
  title: string;
  version: number;
  time_limit_minutes: number;
  item_count: number;
  criteria: { key: string; label: string; description: string }[];
  limitations: string[];
  disclaimer: string;
  review_status: ReviewStatus;
}

export interface MockExamItem {
  key: string;
  criterion: string;
  type: 'multiple_choice' | 'short_answer';
  prompt: string;
  options?: { id: string; text: string }[];
  points: number;
}

export interface MockAttemptStart {
  attempt_id: number;
  exam_id: number;
  title: string;
  started_at: string;
  expires_at: string;
  resumed: boolean;
  items: MockExamItem[];
  disclaimer: string;
}

export interface MockAttemptResult {
  attempt_id: number;
  exam_id: number;
  submitted_at: string;
  score: number;
  max_score: number;
  outcome: 'graded' | 'insufficient_evidence';
  indicative_grade: number | null;
  is_official_grade: false;
  percent: number;
  answered_ratio: number;
  insufficient_reasons: string[];
  criteria: { key: string; label: string; description: string; pointsEarned: number; pointsPossible: number; answered: number; total: number; percent: number }[];
  items: { key: string; criterion: string; answered: boolean; correct: boolean; pointsEarned: number; pointsPossible: number; correctAnswer: string; explanation: string }[];
  submitted_late: boolean;
  next_steps: string[];
  limitations: string[];
  disclaimer: string;
  already_submitted?: boolean;
}

export interface TutorReply {
  answer: string;
  source: 'ai' | 'lesson_fallback';
  provider?: string;
  reason?: string;
}

export interface ReviewQueue {
  lessons: { id: number; title: string; version: number; locale: LearnLocale; review_status: ReviewStatus; reviewed_at: string | null; authored_by: string; topic_title: string; subject_title: string }[];
  mock_exams: { id: number; title: string; version: number; review_status: ReviewStatus; reviewed_at: string | null; topic_title: string; subject_title: string }[];
  goals: { id: number; goal_key: string; description: string; source_locator: string; source_url: string; goal_after_grade: number; verification_status: 'unverified' | 'verified'; subject_title: string; udir_code: string }[];
}
