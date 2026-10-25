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
  grade: number | null;
  suggested_grade: number | null;
  tutor_available: boolean;
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
  goal_level?: 'goal' | 'checkpoint';
  is_local_sequence: boolean;
}

export interface LearnLessonSummary {
  id: number;
  title: string;
  version: number;
  locale?: LearnLocale;
  content_id?: string | null;
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
  course_position?: number | null;
  prerequisite_topic_id: number | null;
  optional_challenge?: boolean;
  estimated_minutes?: number | null;
  goals: LearnGoal[];
  lessons: LearnLessonSummary[];
  mock_exams: LearnMockExamSummary[];
}

export interface LearnCourse {
  id: number;
  course_key: string;
  title: string;
  curriculum_code: string;
  checkpoint_after_grade: number;
  checkpoint_url: string;
  checkpoint_is_this_grade: boolean;
  track_type: string;
  assessment_mode: string;
  grading_mode: string;
  locale: LearnLocale;
}

export interface ReviewPaperSummary {
  id: number;
  content_id: string;
  version: number;
  title: string;
  duration_minutes: number;
  mode?: string;
  item_count?: number;
  review_status: ReviewStatus;
}

export interface LearnSubject {
  id: number;
  slug: string;
  title: string;
  udir_code: string;
  instruction_locale: LearnLocale;
  course?: LearnCourse | null;
  topics: LearnTopic[];
  review_papers?: ReviewPaperSummary[];
  content_gap?: { topics_planned: number; topics_available: number };
}

export interface AssessmentPolicy {
  formative_only: boolean;
  numeric_grades_allowed: 'rubric_backed_mock_exams_only' | 'never';
  review_papers_numeric_grade: false;
}

export interface LearnCatalog {
  grade: number;
  // The learner's own school year, which may differ from the grade being browsed;
  // assessment_policy always follows the learner, never the browsed grade
  learner_grade?: number | null;
  assessment_policy?: AssessmentPolicy;
  subjects: LearnSubject[];
}

export interface CatalogOverviewGrade {
  grade: number;
  assessment_policy: AssessmentPolicy;
  topics_planned: number;
  topics_available: number;
  subjects: { slug: string; title: string; topics_planned: number; topics_available: number; review_papers_available: number }[];
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
  keyTakeaway?: string;
}

export interface PracticeResult {
  sessionId: number;
  attempts: number;
  bestAttemptId: number | null;
  bestPercent: number | null;
  passed: boolean;
  lastCompletedAt: string | null;
}

export interface CourseNavStep {
  topic_id: number;
  position: number;
  title: string;
  lesson_id: number;
}

export interface CourseNav {
  course_key: string;
  course_title: string;
  position: number;
  previous: CourseNavStep | null;
  next: CourseNavStep | null;
}

export interface OpenResponse {
  id: number;
  item_key: string;
  response: string;
  submitted_at: string;
  updated_at: string;
  feedback: string | null;
  feedback_at: string | null;
  feedback_by_name: string | null;
  model_answer: string | null;
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
  content_id?: string | null;
  meta?: {
    curriculum: { code: string; official_checkpoint_after_grade: number; competence_goal_source_url: string; topic_sequence_type: string } | null;
    assessment_mode: string | null;
    estimated_minutes: number | null;
    source_locale: string | null;
  };
  body: LessonBody;
  flashcards: { key: string; front: string; back: string }[];
  practice: { key: string; type: string; title: string }[];
  open_prompts?: { key: string; question: string }[];
  topic: Omit<LearnTopic, 'lessons' | 'mock_exams'> & {
    subject_slug: string;
    subject_title: string;
    udir_code: string;
    instruction_locale: LearnLocale;
  };
  assessment_policy?: AssessmentPolicy;
  course_nav?: CourseNav | null;
  review_papers?: ReviewPaperSummary[];
  personal_cards: { id: number; forked_from_card_key: string | null; front: string; back: string }[];
  open_responses?: OpenResponse[];
  practice_result: PracticeResult | null;
  tutor_available?: boolean;
  content_warnings?: string[];
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

export type AssignmentTargetKind = 'lesson' | 'topic' | 'mock_exam' | 'review_paper';

export interface LearnAssignment {
  id: number;
  child_id: number;
  assigned_by: number;
  assigned_by_name: string;
  lesson_id: number | null;
  lesson_title: string | null;
  mock_exam_id: number | null;
  mock_exam_title: string | null;
  topic_id?: number | null;
  topic_title?: string | null;
  review_paper_id?: number | null;
  review_paper_title?: string | null;
  target_kind?: AssignmentTargetKind;
  title?: string | null;
  overdue?: boolean;
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
  content_id?: string | null;
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

export interface LearnerSettings {
  grade: number | null;
  suggested_grade: number | null;
  tutor_enabled: boolean;
  learn_enabled: boolean;
  tutor_available: boolean;
}

export interface ReviewAttemptSummary {
  id: number;
  paper_id: number;
  paper_title: string;
  subject_title: string;
  grade: number;
  submitted_at: string;
  objective_correct: number;
  objective_total: number;
  open_answered: number;
  awaiting_feedback: boolean;
  guardian_feedback_at: string | null;
  topics_to_revise: string[];
}

export interface OpenResponseSummary {
  id: number;
  lesson_id: number;
  lesson_title: string;
  subject_title: string;
  grade: number;
  item_key: string;
  question: string | null;
  response: string;
  submitted_at: string;
  updated_at: string;
  feedback: string | null;
  feedback_at: string | null;
  feedback_by_name: string | null;
}

export type NeedsPracticeReason = 'practice_not_passed' | 'flashcards_missed' | 'review_paper_missed';

export interface LearnerProgress {
  learner_id: number;
  child?: { id: number; name: string };
  settings?: LearnerSettings;
  lessons: LessonProgress[];
  mock_attempts: MockAttemptSummary[];
  review_attempts?: ReviewAttemptSummary[];
  open_responses?: OpenResponseSummary[];
  needs_practice?: { lesson_id: number; lesson_title: string; subject_title: string; grade: number; reasons: NeedsPracticeReason[] }[];
  assignments: LearnAssignment[];
}

export interface MockExamInfo {
  id: number;
  topic_id: number;
  grade?: number;
  locale?: LearnLocale;
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

export interface ReviewPaperInfo {
  id: number;
  content_id: string;
  title: string;
  version: number;
  mode: string;
  duration_minutes: number;
  instructions: string;
  item_count: number;
  grade: number;
  subject_slug: string;
  subject_title: string;
  locale: LearnLocale;
  curriculum_code: string;
  numeric_grade_allowed: false;
  policy_reason: string;
  source_lessons: { id: number; content_id: string; title: string }[];
  review_status: ReviewStatus;
  previous_attempts: { id: number; submitted_at: string; objective_correct: number; objective_total: number }[];
}

export interface ReviewPaperItem {
  key: string;
  kind: 'single_select' | 'open_response';
  prompt: string;
  source_lesson_id: string;
  options?: { key: string; label: string }[];
  requires_human_review: boolean;
}

export interface ReviewAttemptStart {
  attempt_id: number;
  paper_id: number;
  title: string;
  instructions: string;
  started_at: string;
  expires_at: string;
  resumed: boolean;
  items: ReviewPaperItem[];
}

export interface ReviewItemFeedback {
  key: string;
  kind: 'single_select' | 'open_response';
  source_lesson_id: string;
  answered: boolean;
  response: string | null;
  correct: boolean | null;
  correct_key?: string;
  correct_answer?: string;
  explanation?: string;
  expected_content?: string;
  requires_human_review: boolean;
}

export interface ReviewAttemptResult {
  attempt_id: number;
  paper_id: number;
  profile_id: number;
  started_at: string;
  expires_at: string;
  submitted_at: string;
  objective_correct: number;
  objective_total: number;
  points_awarded: number;
  // Review papers never carry a numerical grade
  numeric_grade: null;
  is_official_grade: false;
  feedback: {
    items: ReviewItemFeedback[];
    objective_correct: number;
    objective_total: number;
    open_answered: number;
    open_total: number;
    topics_to_revise: string[];
    topics_secure: string[];
    reflection_prompts: string[];
    submitted_late?: boolean;
  } | null;
  guardian_feedback: { summary: string; items: Record<string, string> } | null;
  guardian_feedback_at: string | null;
  already_submitted?: boolean;
  paper?: { id: number; title: string; locale: LearnLocale; grade: number };
  prompts?: Record<string, string>;
  options?: Record<string, { key: string; label: string }[] | undefined>;
  source_lessons?: Record<string, { id: number; title: string }>;
}

export type TutorMode = 'explain' | 'hint' | 'guided_practice' | 'check_understanding' | 'next_step';
export interface TutorOptions {
  mode?: TutorMode;
  locale?: LearnLocale;
  item_key?: string;
  hint_level?: number;
  recovery?: boolean;
}
export interface TutorReply {
  answer: string;
  source: 'ai' | 'lesson_fallback';
  provider?: string;
  reason?: string;
  mode?: TutorMode;
  references?: { lesson_id: number; section_index: number; heading: string }[];
  recommendation?: { lesson_id: number; title: string; reason: string } | null;
  hint_level?: number;
  practice_item_key?: string;
  formative_only?: boolean;
}

export interface ReviewQueue {
  lessons: {
    id: number; title: string; version: number; locale: LearnLocale; review_status: ReviewStatus; reviewed_at: string | null;
    authored_by: string; topic_title: string; subject_title: string; subject_slug?: string; grade?: number;
    content_id?: string | null; content_warnings?: string[];
  }[];
  mock_exams: { id: number; title: string; version: number; review_status: ReviewStatus; reviewed_at: string | null; topic_title: string; subject_title: string; grade?: number }[];
  review_papers?: {
    id: number; content_id: string; title: string; version: number; mode: string; duration_minutes: number;
    review_status: ReviewStatus; reviewed_at: string | null; grade: number; subject_title: string; subject_slug: string;
  }[];
  goals: {
    id: number; goal_key: string; description: string; source_locator: string; source_url: string; goal_after_grade: number;
    goal_level?: 'goal' | 'checkpoint'; curriculum_revision?: string; verification_status: 'unverified' | 'verified';
    subject_title: string; udir_code: string;
  }[];
  totals?: { kind: 'lessons' | 'mock_exams' | 'review_papers'; review_status: ReviewStatus; n: number }[];
}

export interface ReviewLessonDetail extends Omit<LearnLesson, 'open_prompts'> {
  practice_items: Array<{
    key: string; type: string; title: string; explanation: string; hints: string[];
    content: { question?: string; options?: { id: string; text: string }[]; sentences?: string[] };
    correct: { correctAnswer?: string; blanks?: { position: number; answer: string }[] };
  }>;
  open_prompts: { key: string; question: string; model_answer: string }[];
  content_meta: { content_warnings?: string[]; title_source?: string; source?: { file: string; content_id: string; package: string } };
  review_notes: string | null;
}

export interface ReviewPaperDetail {
  id: number;
  content_id: string;
  title: string;
  version: number;
  instructions: string;
  review_status: ReviewStatus;
  items: Array<{
    id: string; kind: 'single_select' | 'open_response'; prompt: string; source_lesson_id: string;
    options?: { key: string; label: string }[]; correct_key?: string; correct_answer?: string; explanation?: string; expected_content?: string;
  }>;
  score_policy: { numeric_grade_allowed: boolean; reason: string };
  source_lessons: { id: number; content_id: string; title: string; review_status: ReviewStatus }[];
}

export interface ContentImportRun {
  id: number;
  package: string;
  source_hash: string;
  dry_run: number;
  status: 'ok' | 'failed';
  created_at: string;
  summary: { stats?: Record<string, unknown>; created?: Record<string, number>; unchanged?: Record<string, number>; skipped?: string[] };
  errors: string[];
  warnings: string[];
}

export interface ContentImportStatus {
  runs: ContentImportRun[];
  validation: {
    ok: boolean;
    errors: string[];
    warnings: string[];
    notices?: { code: string; count: number; examples: string[] }[];
    lesson_links?: Record<string, number>;
    stats?: Record<string, unknown>;
    source_hash?: string;
  } | null;
}
