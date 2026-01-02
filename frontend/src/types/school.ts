// School system types

export interface SchoolClass {
  id: number;
  name: string;
  description: string | null;
  age_min: number | null;
  age_max: number | null;
  created_at: string;
  updated_at: string;
}

export interface SchoolEnrollment {
  id: number;
  student_id: number;
  class_id: number;
  enrolled_at: string;
  student_name?: string;
  class_name?: string;
}

export type AssignmentType = 'homework' | 'psalm' | 'alphabet' | 'video' | 'quiz' | 'other';

export interface SchoolAssignment {
  id: number;
  class_id: number;
  teacher_id: number;
  title: string;
  description: string | null;
  type: AssignmentType;
  youtube_link: string | null;
  attachment_url: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  class_name?: string;
  teacher_name?: string;
}

export type SubmissionStatus = 'submitted' | 'approved' | 'needs_revision';

export interface SchoolSubmission {
  id: number;
  assignment_id: number;
  student_id: number;
  notes: string | null;
  submitted_at: string;
  status: SubmissionStatus;
  student_name?: string;
  assignment_title?: string;
}

export type FeedbackRating = 'excellent' | 'very_good' | 'good' | 'needs_improvement';

export interface SchoolFeedback {
  id: number;
  submission_id: number;
  teacher_id: number;
  comment: string;
  rating: FeedbackRating | null;
  created_at: string;
  teacher_name?: string;
}

export interface StudentProgress {
  student_id: number;
  student_name: string;
  total_assignments: number;
  submitted_count: number;
  approved_count: number;
  needs_revision_count: number;
  pending_count: number;
  completion_rate: number;
}

export interface QuizQuestion {
  id: number;
  assignment_id: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  created_at: string;
  updated_at: string;
}

export interface QuizAnswer {
  id: number;
  question_id: number;
  student_id: number;
  selected_option: 'A' | 'B' | 'C' | 'D' | null;
  is_correct: boolean;
  score: number;
  submitted_at: string;
}

export interface QuizSubmission {
  assignment_id: number;
  student_id: number;
  answers: {
    question_id: number;
    selected_option: 'A' | 'B' | 'C' | 'D';
  }[];
}

export interface QuizResult {
  assignment_id: number;
  student_id: number;
  score_percentage: number;
  total_questions: number;
  correct_answers: number;
  answers: (QuizAnswer & { question: QuizQuestion })[];
}
