export interface Profile {
  id: number;
  name: string;
  type: 'admin' | 'parent' | 'child' | 'teacher';
  username?: string; // For login (adults)
  age?: number;
  gender?: 'male' | 'female' | 'other';
  avatar?: string;
  pin?: string; // For kids (4-6 digits)
  password?: string; // For adults (secure password)
  settings?: string;
  created_at: string;
  updated_at: string;
  parent_id?: number;
  family_id?: number; // Family this profile belongs to
  ai_enabled?: number; // 0 = disabled, 1 = enabled (controlled by admin)
  diet_enabled?: number; // 0 = disabled, 1 = enabled (hidden feature)
}

export interface Family {
  id: number;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'suspended';
  family_type: 'A' | 'B'; // A = Full Access, B = Church School Only
  created_by?: number;
  created_at: string;
  updated_at: string;
  // Computed fields from API
  parent_count?: number;
  child_count?: number;
  parent_names?: string;
  members?: Profile[];
}

// Module permissions based on family type
export interface ModulePermissions {
  coreApp: boolean;       // Access to core app features (tasks, rewards, books, etc.)
  churchSchool: boolean;  // Access to church school features
  role: string;           // User's role (admin, parent, teacher, student)
  familyType?: 'A' | 'B'; // Family type if user belongs to a family
}

// Family info returned with permissions
export interface FamilyInfo {
  id: number;
  name: string;
  type: 'A' | 'B';
  status: string;
}

// Login response with permissions
export interface LoginResponse {
  success: boolean;
  profile: Profile;
  permissions: ModulePermissions;
  family?: FamilyInfo | null;
}

export interface SchoolClass {
  id: number;
  name: string;
  description?: string;
  age_min?: number;
  age_max?: number;
  created_at: string;
  updated_at: string;
}

export interface SchoolSubject {
  id: number;
  class_id: number;
  name: string;
  icon: string;
  color: string;
  description?: string;
  sort_order: number;
  is_active: number;
  created_by: number;
  created_at: string;
  updated_at: string;
  assignment_count?: number;
}

export interface SchoolAssignment {
  id: number;
  class_id: number;
  teacher_id: number;
  subject_id?: number | null;
  title: string;
  description?: string;
  type: 'homework' | 'psalm' | 'alphabet' | 'video' | 'quiz' | 'other';
  youtube_link?: string;
  attachment_url?: string;
  linked_quiz_id?: number | null;
  due_date?: string | null;
  max_points?: number;
  created_at: string;
  updated_at: string;
  class_name?: string;
  teacher_name?: string;
  subject_name?: string;
  subject_icon?: string;
  subject_color?: string;
  submission_status?: string;
  submitted_at?: string;
}

export interface SchoolSubmission {
  id: number;
  assignment_id: number;
  student_id: number;
  notes?: string;
  submitted_at: string;
  status: 'submitted' | 'approved' | 'needs_revision';
  points_earned?: number | null;
  points_possible?: number | null;
  on_time_bonus?: number;
  graded_at?: string | null;
  graded_by?: number | null;
  student_name?: string;
  assignment_title?: string;
}

export interface SchoolAttachment {
  id: number;
  assignment_id?: number;
  submission_id?: number;
  uploaded_by?: number;
  file_url: string;
  file_name?: string;
  file_type?: string;
  created_at: string;
}

export interface SchoolFeedback {
  id: number;
  submission_id: number;
  teacher_id: number;
  comment: string;
  rating?: 'excellent' | 'very_good' | 'good' | 'needs_improvement';
  created_at: string;
  teacher_name?: string;
}

// Regular School (Home tracking)
export interface RegularSchoolSubject {
  id: number;
  student_id: number;
  name: string;
  icon: string;
  color: string;
  created_by: number;
  created_at: string;
  pending_count?: number;
  completed_count?: number;
}

export interface RegularSchoolHomework {
  id: number;
  subject_id: number;
  student_id: number;
  title: string;
  description?: string;
  due_date?: string;
  points: number;
  status: 'pending' | 'completed';
  completed_at?: string;
  created_by: number;
  created_at: string;
  subject_name?: string;
  subject_icon?: string;
  subject_color?: string;
}

export interface RegularSchoolStats {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  due_today: number;
  points_earned: number;
  subject_count: number;
}

export interface DietGoal {
  id: number;
  profile_id: number;
  calories_target?: number;
  protein_target?: number;
  carbs_target?: number;
  fat_target?: number;
  weight_goal?: number;
  created_at: string;
  updated_at: string;
}

export interface FoodItem {
  id: number | string;
  name: string;
  name_no?: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  serving_size: string;
  serving_unit: string;
  barcode?: string;
  source: string;
  is_norwegian?: boolean;
}

export interface MealLog {
  id: number;
  profile_id: number;
  food_id: number;
  food_name?: string;
  name_no?: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  portion_size: number;
  portion_unit: string;
  calories_consumed: number;
  protein_consumed: number;
  carbs_consumed: number;
  fat_consumed: number;
  logged_at: string;
  notes?: string;
}

export interface MealPlan {
  id: number;
  profile_id?: number;
  name: string;
  description?: string;
  day_of_week?: number;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  recipe_data?: any;
  is_family_plan: boolean;
  created_at: string;
}

export interface Task {
  id: number;
  profile_id: number;
  title: string;
  description?: string;
  category: 'read-book' | 'tigrinya' | 'clean-room' | 'clean-kitchen' | 'school' | 'watch-movies' | 'homework' | 'exercise' | 'chore' | 'other';
  points: number;
  difficulty: 'easy' | 'medium' | 'hard';
  earns_points: boolean;
  is_recurring: boolean | number;
  recurrence_pattern?: 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly' | string; // string allows custom patterns like 'specific_days:mon,wed,fri'
  due_date?: string | null;
  completed: boolean;
  completed_at?: string;
  last_completed_date?: string | null;
  parent_approved: boolean;
  created_by?: number;
  approved_by?: number;
  created_at: string;
  child_name?: string;
  child_avatar?: string;
  priority?: 'high' | 'medium' | 'low';
  estimated_minutes?: number;
  // Photo proof fields
  proof_required?: boolean | number;
  proof_photo_url?: string | null;
  // Timer fields
  requires_timer?: boolean | number;
  timer_duration_minutes?: number | null;
  // Task-specific reminder (HH:MM format)
  scheduled_time?: string | null;
  last_reminder_sent?: string | null;
}

export interface Progress {
  id: number;
  profile_id: number;
  task_id?: number;
  points_earned: number;
  stars_earned: number;
  level: number;
  total_points: number;
  total_stars: number;
  achievements?: string;
  logged_at: string;
}

export interface Reward {
  id: number;
  profile_id: number | null;
  title: string;
  description?: string;
  type: 'virtual' | 'real';
  points_required: number;
  icon?: string;
  image_url?: string;
  category?: string;
  available_for_all?: boolean;
  stock?: number;
  is_claimed?: boolean;
  claimed_at?: string;
  created_by?: number;
  created_at: string;
  user_claim_status?: 'pending' | 'approved' | null; // If user already claimed this reward
}

export interface RewardClaim {
  id: number;
  reward_id: number;
  profile_id: number;
  status: 'pending' | 'approved' | 'given' | 'rejected';
  points_spent: number;
  claimed_at: string;
  approved_by?: number;
  approved_at?: string;
  notes?: string;
  // Joined from reward
  title?: string;
  icon?: string;
  image_url?: string;
}

export interface AIConversation {
  id: number;
  profile_id: number;
  context: 'diet' | 'tasks' | 'general';
  user_message: string;
  ai_response: string;
  created_at: string;
}

export interface Note {
  id: number;
  profile_id: number;
  title: string;
  content: string;
  color: string;
  category?: string;
  is_pinned?: boolean | number;
  reminder_at?: string;
  tags?: string; // JSON array string
  created_at: string;
  updated_at: string;
}

export interface MonthlyGoal {
  id: number;
  profile_id: number;
  month: string;
  goal_description: string;
  goal_points: number;
  goal_type: string;
  goal_category?: string;
  reward_image?: string;
  current_points?: number;
  achieved: boolean;
  reward_given: boolean;
  notes?: string;
  parent_approved: boolean;
  created_by?: number;
  approved_by?: number;
  created_at: string;
  updated_at: string;
  child_name?: string;
  child_avatar?: string;
}

export interface ProfileStats {
  tasks: {
    total_tasks: number;
    completed_tasks: number;
    overdue_tasks: number;
  };
  progress: {
    total_points: number;
    total_stars: number;
    level: number;
  };
  diet: {
    meals_logged: number;
    total_calories: number;
  };
}

export interface NutritionSummary {
  date: string;
  summary: Array<{
    meal_type: string;
    total_calories: number;
    total_protein: number;
    total_carbs: number;
    total_fat: number;
    meals_logged: number;
  }>;
  totals: {
    total_calories: number;
    total_protein: number;
    total_carbs: number;
    total_fat: number;
  };
  goals?: DietGoal | null;
}


// My Journey types
export interface JourneyEvent {
  type: 'task_completed' | 'goal_achieved';
  title: string;
  points?: number;
  category?: string;
  date: string;
}

export interface JourneyData {
  summary: {
    total_points: number;
    total_stars: number;
    tasks_completed: number;
    goals_achieved: number;
    meals_logged: number;
  };
  timeline: JourneyEvent[];
  period: {
    start: string;
    end: string;
    type: string;
  };
}

// Push Notification types
export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface Notification {
  id: number;
  profile_id: number;
  type: 'task_created' | 'task_approved' | 'task_rejected' | 'task_completed' |
        'goal_created' | 'goal_approved' | 'goal_rejected' | 'goal_achieved' |
        'message_received' | 'reminder' | 'achievement' | 'general';
  title: string;
  message: string;
  data?: any;
  is_read: boolean;
  created_at: string;
}

// ==================== H5P Types ====================

export interface H5PContent {
  id: number;
  h5p_content_id: string;
  title: string;
  content_type: string;
  library_name: string;
  created_by: number;
  metadata?: string;
  is_ai_generated: boolean | number;
  ai_prompt?: string;
  ai_provider?: string;
  created_at: string;
  updated_at: string;
  // Joined fields for lists
  assignment_count?: number;
  attempt_count?: number;
  assignment_id?: number;
  points?: number;
  due_date?: string;
  is_required?: boolean | number;
  max_attempts?: number;
  pass_percentage?: number;
  my_attempts?: number;
  best_score?: number;
  passed?: boolean | number;
}

export interface H5PAssignment {
  id: number;
  h5p_content_id: number;
  assigned_to: number;
  assigned_by: number;
  points: number;
  due_date?: string;
  is_required: boolean | number;
  max_attempts: number;
  pass_percentage: number;
  created_at: string;
  // Joined fields
  child_name?: string;
  child_avatar?: string;
  attempt_count?: number;
  best_score?: number;
  passed?: boolean | number;
}

export interface H5PAttempt {
  id: number;
  assignment_id: number;
  profile_id: number;
  h5p_content_id: number;
  score: number;
  max_score: number;
  score_percentage: number;
  passed: boolean | number;
  time_spent_seconds: number;
  started_at: string;
  completed_at?: string;
  xapi_data?: string;
  // Joined fields
  profile_name?: string;
  profile_avatar?: string;
}

export interface H5PPlayerData {
  content: {
    id: number;
    title: string;
    contentType: string;
  };
  player: {
    integration: any;
    scripts: string[];
    styles: string[];
    contentId: string;
  };
  attemptId: number | null;
  assignment: {
    points: number;
    passPercentage: number;
  } | null;
}

export interface H5PStatus {
  initialized: boolean;
  installedContentTypes: string[];
  contentTypesCount: number;
  paths: {
    data: string;
    libraries: string;
    content: string;
  };
}

export interface H5PQuizSpec {
  title: string;
  age: number;
  theme: string;
  questions: H5PQuizQuestion[];
}

export interface H5PQuizQuestion {
  type: 'mcq' | 'true_false' | 'fill_blank' | 'matching';
  prompt: string;
  choices?: string[];
  answerIndex?: number;
  correctAnswer?: boolean | string;
  explanation?: string;
  pairs?: { left: string; right: string }[];
}
