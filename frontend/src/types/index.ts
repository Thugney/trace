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
  ai_enabled?: number; // 0 = disabled, 1 = enabled (controlled by admin)
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
  category: 'read-book' | 'tigrinya' | 'clean-room' | 'clean-kitchen' | 'school' | 'watch-movies' | 'other';
  points: number;
  difficulty: 'easy' | 'medium' | 'hard';
  earns_points: boolean;
  is_recurring: boolean;
  recurrence_pattern?: string;
  due_date?: string;
  completed: boolean;
  completed_at?: string;
  parent_approved: boolean;
  created_by?: number;
  approved_by?: number;
  created_at: string;
  child_name?: string;
  child_avatar?: string;
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
  profile_id: number;
  title: string;
  description?: string;
  type: 'virtual' | 'real';
  points_required: number;
  icon?: string;
  is_claimed: boolean;
  claimed_at?: string;
  created_at: string;
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

export interface Message {
  id: number;
  sender_id: number;
  recipient_id: number;
  subject?: string;
  message: string;
  is_read: boolean;
  created_at: string;
  sender_name?: string;
  sender_type?: string;
  sender_avatar?: string;
  recipient_name?: string;
  recipient_type?: string;
  recipient_avatar?: string;
}
