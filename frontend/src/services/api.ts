import axios from 'axios';
import type {
  Profile,
  ProfileStats,
  Family,
  SchoolClass,
  SchoolSubject,
  SchoolAssignment,
  SchoolSubmission,
  SchoolAttachment,
  SchoolFeedback,
  RegularSchoolSubject,
  RegularSchoolHomework,
  RegularSchoolStats,
  FoodItem,
  MealLog,
  NutritionSummary,
  MealPlan,
  DietGoal,
  Task,
  Progress,
  Reward,
  RewardClaim,
  AIConversation,
  Note,
  MonthlyGoal,
  JourneyData,
  Notification
} from '../types';

export type { Reward, RewardClaim };

// Use relative path for production (nginx proxy) or explicit URL for development
const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_URL ? `${API_URL}/api` : '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add profile ID to all authenticated requests
api.interceptors.request.use((config) => {
  // Get current profile ID from localStorage
  const currentProfileId = localStorage.getItem('currentProfileId');

  if (currentProfileId) {
    config.headers['x-profile-id'] = currentProfileId;
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

// Profiles
export const profilesAPI = {
  getAll: () => api.get<Profile[]>('/profiles'),
  getForSelector: () => api.get<Profile[]>('/profiles/selector'),  // Public - no auth needed
  getOne: (id: number) => api.get<Profile>(`/profiles/${id}`),
  create: (data: Partial<Profile>) => api.post<Profile>('/profiles', data),
  update: (id: number, data: Partial<Profile>) => api.put<Profile>(`/profiles/${id}`, data),
  delete: (id: number) => api.delete(`/profiles/${id}`),
  getFeatures: (id: number) => api.get<Array<{ feature_key: string; enabled: number }>>(`/profiles/${id}/features`),
  getMyFeatures: () => api.get<{ features: Record<string, boolean>; role: string }>('/profiles/me/features'),
  updateFeatures: (id: number, features: Record<string, boolean>) =>
    api.put<Array<{ feature_key: string; enabled: number }>>(`/profiles/${id}/features`, { features }),
  getStats: (id: number) => api.get<ProfileStats>(`/profiles/${id}/stats`),
  getHistory: (id: number, period: string) => api.get<JourneyData>(`/profiles/${id}/history`, { params: { period } }),
  verifyPIN: (id: number, pin: string) => api.post<{ verified: boolean }>(`/profiles/${id}/verify-pin`, { pin }),
  setPIN: (id: number, pin: string, currentPin?: string) => api.post<{ message: string }>(`/profiles/${id}/set-pin`, { pin, currentPin }),
  resetPassword: (profileId: number, newPin: string, parentId: number) => api.post<{ message: string }>(`/profiles/${profileId}/reset-password`, { newPin, parentId }),
  uploadAvatar: (id: number, file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    // Must explicitly set Content-Type to undefined to override axios default 'application/json'
    // This allows axios to auto-set 'multipart/form-data' with the correct boundary
    return api.post<{ success: boolean; avatar: string; message: string }>(
      `/profiles/${id}/avatar`,
      formData,
      { headers: { 'Content-Type': undefined } }
    );
  },
  // Admin family feature controls
  getAdminFamilies: () => api.get<{
    families: Array<{
      parent: { id: number; name: string; avatar: string; created_at: string };
      children: Array<{ id: number; name: string; avatar: string; age: number }>;
      features: Record<string, boolean>;
      childCount: number;
    }>;
    featureKeys: string[];
  }>('/profiles/admin/families'),
  getFamilyFeatures: (parentId: number) => api.get<{
    parentId: number;
    parentName: string;
    features: Record<string, boolean>;
    featureKeys: string[];
  }>(`/profiles/admin/families/${parentId}/features`),
  updateFamilyFeatures: (parentId: number, features: Record<string, boolean>) =>
    api.put<{ success: boolean; message: string }>(`/profiles/admin/families/${parentId}/features`, { features })
};

// Families (Admin management)
export const familiesAPI = {
  // Admin: Get all families
  getAll: () => api.get<Family[]>('/families'),

  // Admin: Get single family with members
  getOne: (id: number) => api.get<Family>(`/families/${id}`),

  // Admin: Create new family
  create: (data: { name: string; description?: string }) =>
    api.post<Family>('/families', data),

  // Admin: Update family
  update: (id: number, data: { name?: string; description?: string; status?: 'active' | 'inactive' | 'suspended' }) =>
    api.put<Family>(`/families/${id}`, data),

  // Admin: Delete family (unassigns members, doesn't delete them)
  delete: (id: number) => api.delete(`/families/${id}`),

  // Admin: Assign profile to family
  addMember: (familyId: number, profileId: number) =>
    api.post(`/families/${familyId}/members`, { profileId }),

  // Admin: Remove profile from family
  removeMember: (familyId: number, profileId: number) =>
    api.delete(`/families/${familyId}/members/${profileId}`),

  // Admin: Get unassigned profiles
  getUnassigned: () => api.get<Profile[]>('/families/unassigned/profiles'),

  // Admin: Get family features
  getFeatures: (familyId: number) =>
    api.get<{ features: Record<string, boolean>; parentId: number }>(`/families/${familyId}/features`),

  // Admin: Update family features
  updateFeatures: (familyId: number, features: Record<string, boolean>) =>
    api.put(`/families/${familyId}/features`, { features }),

  // Parent: Get my family info
  getMyFamily: () =>
    api.get<{ family: Family | null; members: Profile[]; message?: string }>('/families/my-family'),

  // Parent: Add co-parent to my family
  addAdult: (data: { name: string; username?: string; password: string; gender?: string }) =>
    api.post<Profile>('/families/my-family/add-adult', data)
};

// Diet
export const dietAPI = {
  searchFoods: (query: string, source?: string) =>
    api.get<FoodItem[]>('/diet/foods/search', { params: { query, source } }),
  getFood: (id: number) => api.get<FoodItem>(`/diet/foods/${id}`),
  addFood: (data: Partial<FoodItem>) => api.post<FoodItem>('/diet/foods', data),
  logMeal: (data: {
    profile_id: number;
    food_id: number | string;
    meal_type: string;
    portion_size: number;
    portion_unit?: string;
    notes?: string;
  }) => api.post<MealLog>('/diet/log', data),
  updateMealLog: (id: number, data: {
    meal_type?: string;
    portion_size?: number;
    portion_unit?: string;
    notes?: string;
  }) => api.put<MealLog>(`/diet/log/${id}`, data),
  deleteMealLog: (id: number) => api.delete(`/diet/log/${id}`),
  getLogs: (profileId: number, date?: string, meal_type?: string) =>
    api.get<MealLog[]>(`/diet/logs/${profileId}`, { params: { date, meal_type } }),
  getNutritionSummary: (profileId: number, date?: string) =>
    api.get<NutritionSummary>(`/diet/nutrition/${profileId}`, { params: { date } }),
  setGoals: (data: Partial<DietGoal>) => api.post<DietGoal>('/diet/goals', data),
  getMealPlans: (profile_id?: number, is_family_plan?: boolean) =>
    api.get<MealPlan[]>('/diet/meal-plans', { params: { profile_id, is_family_plan } }),
  createMealPlan: (data: Partial<MealPlan>) => api.post<MealPlan>('/diet/meal-plans', data)
};

// Tasks
export const tasksAPI = {
  getByProfile: (profileId: number, completed?: boolean, category?: string) =>
    api.get<Task[]>(`/tasks/${profileId}`, { params: { completed, category } }),
  getOne: (id: number) => api.get<Task>(`/tasks/task/${id}`),
  create: (data: Partial<Task>) => api.post<Task>('/tasks', data),
  update: (id: number, data: Partial<Task>) => api.put<Task>(`/tasks/${id}`, data),
  complete: (id: number) =>
    api.post<{ task: Task; progress: Progress; pointsEarned: number; starsEarned: number }>(
      `/tasks/${id}/complete`
    ),
  delete: (id: number) => api.delete(`/tasks/${id}`),
  approve: (id: number, approved_by: number) =>
    api.post<Task>(`/tasks/${id}/approve`, { approved_by }),
  reject: (id: number, rejected_by: number) =>
    api.post<{ message: string }>(`/tasks/${id}/reject`, { rejected_by }),
  getPending: (parentId: number) =>
    api.get<Task[]>(`/tasks/pending/${parentId}`),
  getPendingProofs: (parentId: number) =>
    api.get<Task[]>(`/tasks/pending-proofs/${parentId}`),
  verifyProof: (taskId: number, approved: boolean, verified_by: number) =>
    api.post<{ success: boolean; message: string; task: Task; pointsEarned?: number; starsEarned?: number }>(
      `/tasks/${taskId}/verify-proof`,
      { approved, verified_by }
    ),
  getProgress: (profileId: number, limit?: number) =>
    api.get<{
      current: Progress;
      history: Progress[];
      weekly: {
        points_this_week: number;
        stars_this_week: number;
        tasks_completed_this_week: number;
      };
    }>(`/tasks/progress/${profileId}`, { params: { limit } }),
  getRewards: (profileId: number) => api.get<Reward[]>(`/tasks/rewards/${profileId}`),
  createReward: (data: Partial<Reward>) => api.post<Reward>('/tasks/rewards', data),
  claimReward: (id: number) => api.post<Reward>(`/tasks/rewards/${id}/claim`),
  // Subtasks
  getSubtasks: (taskId: number) => api.get<any[]>(`/tasks/${taskId}/subtasks`),
  addSubtask: (taskId: number, title: string) => api.post<any>(`/tasks/${taskId}/subtasks`, { title }),
  updateSubtask: (subtaskId: number, data: { title?: string; completed?: boolean }) =>
    api.put<any>(`/tasks/subtasks/${subtaskId}`, data),
  deleteSubtask: (subtaskId: number) => api.delete(`/tasks/subtasks/${subtaskId}`),
  bulkAddSubtasks: (taskId: number, subtasks: { title: string }[]) =>
    api.post<any[]>(`/tasks/${taskId}/subtasks/bulk`, { subtasks }),
  // Timer endpoints
  getTimer: (taskId: number) =>
    api.get<TaskTimerState>(`/tasks/${taskId}/timer`),
  startTimer: (taskId: number) =>
    api.post<{ success: boolean; message: string; timer_state: TimerState }>(`/tasks/${taskId}/timer/start`),
  pauseTimer: (taskId: number) =>
    api.post<{ success: boolean; message: string; timer_state: TimerState }>(`/tasks/${taskId}/timer/pause`),
  resumeTimer: (taskId: number) =>
    api.post<{ success: boolean; message: string; timer_state: TimerState }>(`/tasks/${taskId}/timer/resume`),
  finishTimer: (taskId: number) =>
    api.post<{
      success: boolean;
      task: Task;
      progress: Progress;
      pointsEarned: number;
      starsEarned: number;
      timeSpent: number;
      nextRecurringTask?: Task;
    }>(`/tasks/${taskId}/timer/finish`)
};

// Timer types
export interface TimerState {
  id: number;
  is_running: boolean;
  is_paused: boolean;
  elapsed_seconds: number;
  start_time: string | null;
  pause_time: string | null;
}

export interface TaskTimerState {
  task_id: number;
  requires_timer: boolean;
  timer_duration_minutes: number | null;
  timer_state: {
    is_running: boolean;
    is_paused: boolean;
    elapsed_seconds: number;
    start_time: string | null;
    pause_time: string | null;
  } | null;
  can_complete: boolean;
  completed_today: boolean;
}

export interface QuizTimerState {
  attempt_id: number;
  time_limit_seconds: number | null;
  timer_state: TimerState | null;
}

export interface ChallengeTimerState {
  challenge_id: number;
  requires_timer: boolean;
  timer_duration: number | null;
  timer_state: TimerState | null;
  can_complete: boolean;
  completed: boolean;
}

// AI
export const aiAPI = {
  chat: (profile_id: number, message: string, context?: string) =>
    api.post<{ response: string; profile: { id: number; name: string; type: string }; usingFallback?: boolean }>(
      '/ai/chat',
      { profile_id, message, context }
    ),
  getMealSuggestions: (
    profile_id: number,
    preferences?: string,
    dietary_restrictions?: string,
    num_meals?: number
  ) =>
    api.post<{ meals: any[] }>('/ai/meal-suggestions', {
      profile_id,
      preferences,
      dietary_restrictions,
      num_meals
    }),
  getTaskRecommendations: (profile_id: number) =>
    api.post<{ tasks: any[]; profile: { name: string; age: number } }>(
      '/ai/task-recommendations',
      { profile_id }
    ),
  getConversations: (profileId: number, context?: string, limit?: number) =>
    api.get<AIConversation[]>(`/ai/conversations/${profileId}`, { params: { context, limit } }),
  clearConversations: (profileId: number, context?: string) =>
    api.delete(`/ai/conversations/${profileId}`, { params: { context } }),
  getStatus: () => api.get<{ apiConfigured: boolean; fallbackMode: boolean }>('/ai/status'),
  getSettings: (profileId: number) => api.get(`/ai/settings/${profileId}`),
  updateSettings: (profileId: number, settings: any) => api.put(`/ai/settings/${profileId}`, settings),
  getMessageCount: (profileId: number) => api.get<{
    messagesUsed: number;
    messagesLimit: number;
    messagesRemaining: number;
    limitType: 'limited' | 'extended' | 'unlimited';
    aiEnabled: boolean;
  }>(`/ai/message-count/${profileId}`),
  updateMessageLimit: (profileId: number, limitType: 'limited' | 'extended' | 'unlimited') =>
    api.put<{ success: boolean; limitType: string; maxMessages: number; message: string }>(
      `/ai/message-limit/${profileId}`,
      { limitType }
    ),
  // Get AI insights for parent's children (encouragement logs, mood indicators, quiz suggestions)
  getChildInsights: (parentId: number, days?: number) =>
    api.get<{
      children: Array<{
        id: number;
        name: string;
        avatar: string;
        message_count: number;
        mood_summary: {
          happy: number;
          neutral: number;
          frustrated: number;
          curious: number;
          tired: number;
        };
      }>;
      encouragements: Array<{
        child_id: number;
        child_name: string;
        child_avatar: string;
        topic: string;
        encouragement: string;
        mood: string;
        timestamp: string;
      }>;
      quiz_suggestions: Array<{
        child_id: number;
        child_name: string;
        category: string;
        reason: string;
        difficulty_hint: string;
        timestamp: string;
      }>;
      period_days: number;
    }>(`/ai/insights/${parentId}`, { params: { days: days || 7 } })
};

// Ollama types
export interface OllamaModel {
  name: string;
  size: number;
  parameterSize?: string;
  family?: string;
}

export interface OllamaStatus {
  configured: boolean;
  connected: boolean;
  url: string | null;
  baseUrl?: string;
  models: OllamaModel[];
  currentModel: string | null;
  message: string;
}

// Settings
export const settingsAPI = {
  getAll: () => api.get<Record<string, any>>('/settings'),
  getOne: (key: string) => api.get<{ key: string; value: string }>(`/settings/${key}`),
  set: (key: string, value: string) => api.post(`/settings/${key}`, { value }),
  verifyPIN: (pin: string) => api.post<{ verified: boolean }>('/settings/verify-pin', { pin }),
  setPIN: (pin: string, current_pin?: string) =>
    api.post<{ message: string }>('/settings/set-pin', { pin, current_pin }),
  getFeatureFlags: () => api.get<{ diet_enabled: boolean; school_only_mode: boolean }>('/settings/features/flags'),

  // Ollama management
  getOllamaStatus: () => api.get<OllamaStatus>('/settings/ollama/status'),
  testOllama: (model?: string) => api.post<{ success: boolean; model: string; response: string; message: string }>('/settings/ollama/test', { model }),
  configureOllama: (config: { url?: string; model?: string }) => api.post<{ success: boolean; message: string; url: string; model: string }>('/settings/ollama/configure', config),
  pullOllamaModel: (model: string) => api.post<{ success: boolean; model: string; message: string; status?: string }>('/settings/ollama/pull', { model })
};

// School
export const schoolAPI = {
  getClasses: (params?: { scope?: 'all'; student_id?: number }) => api.get<SchoolClass[]>('/school/classes', { params }),
  getAllClasses: () => api.get<SchoolClass[]>('/school/classes', { params: { scope: 'all' } }),
  createClass: (data: Partial<SchoolClass>) => api.post<SchoolClass>('/school/classes', data),
  updateClass: (classId: number, data: Partial<SchoolClass>) => api.put<SchoolClass>(`/school/classes/${classId}`, data),
  getClassStudents: (classId: number) => api.get<Profile[]>(`/school/classes/${classId}/students`),
  getClassTeachers: (classId: number) => api.get<Profile[]>(`/school/classes/${classId}/teachers`),
  assignTeacher: (classId: number, teacher_id: number) => api.post(`/school/classes/${classId}/teachers`, { teacher_id }),
  removeTeacher: (classId: number, teacherId: number) => api.delete(`/school/classes/${classId}/teachers/${teacherId}`),
  enrollStudent: (student_id: number, class_id: number) => api.post('/school/enrollments', { student_id, class_id }),
  unenrollStudent: (student_id: number, class_id: number) => api.delete('/school/enrollments', { data: { student_id, class_id } }),
  getAssignments: (params?: { class_id?: number; student_id?: number }) =>
    api.get<SchoolAssignment[]>('/school/assignments', { params }),
  createAssignment: (data: Partial<SchoolAssignment> & { class_id: number; title: string }) =>
    api.post<SchoolAssignment>('/school/assignments', data),
  updateAssignment: (assignmentId: number, data: Partial<SchoolAssignment>) =>
    api.put<SchoolAssignment>(`/school/assignments/${assignmentId}`, data),
  deleteAssignment: (assignmentId: number) => api.delete(`/school/assignments/${assignmentId}`),
  getAssignmentAttachments: (assignmentId: number, student_id?: number) =>
    api.get<SchoolAttachment[]>(`/school/assignments/${assignmentId}/attachments`, { params: { student_id } }),
  uploadAssignmentAttachment: (assignmentId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<SchoolAttachment>(
      `/school/assignments/${assignmentId}/attachments`,
      formData,
      { headers: { 'Content-Type': undefined } }
    );
  },
  getSubmissions: (params?: { assignment_id?: number; student_id?: number }) =>
    api.get<SchoolSubmission[]>('/school/submissions', { params }),
  createSubmission: (data: { assignment_id: number; student_id?: number; notes?: string }) =>
    api.post<SchoolSubmission>('/school/submissions', data),
  updateSubmissionStatus: (submissionId: number, status: string) =>
    api.patch<SchoolSubmission>(`/school/submissions/${submissionId}/status`, { status }),
  getSubmissionAttachments: (submissionId: number) =>
    api.get<SchoolAttachment[]>(`/school/submissions/${submissionId}/attachments`),
  uploadSubmissionAttachment: (submissionId: number, file: File, student_id?: number) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<SchoolAttachment>(
      `/school/submissions/${submissionId}/attachments`,
      formData,
      { params: { student_id }, headers: { 'Content-Type': undefined } }
    );
  },
  getFeedback: (params?: { submission_id?: number; student_id?: number }) =>
    api.get<SchoolFeedback[]>('/school/feedback', { params }),
  createFeedback: (data: { submission_id: number; comment: string; rating?: string; status?: string }) =>
    api.post<SchoolFeedback>('/school/feedback', data),

  // Subjects (Church School)
  getClassSubjects: (classId: number) =>
    api.get<SchoolSubject[]>(`/school/classes/${classId}/subjects`),
  createSubject: (classId: number, data: { name: string; icon?: string; color?: string; description?: string }) =>
    api.post<SchoolSubject>(`/school/classes/${classId}/subjects`, data),
  updateSubject: (subjectId: number, data: { name?: string; icon?: string; color?: string; description?: string; sort_order?: number }) =>
    api.put<SchoolSubject>(`/school/subjects/${subjectId}`, data),
  deleteSubject: (subjectId: number) =>
    api.delete(`/school/subjects/${subjectId}`),
  seedDefaultSubjects: (classId: number) =>
    api.post<SchoolSubject[]>(`/school/classes/${classId}/seed-subjects`)
};

// Regular School (Home tracking)
export const regularSchoolAPI = {
  // Subjects
  getSubjects: (student_id: number) =>
    api.get<RegularSchoolSubject[]>('/regular-school/subjects', { params: { student_id } }),
  createSubject: (data: { student_id: number; name: string; icon?: string; color?: string }) =>
    api.post<RegularSchoolSubject>('/regular-school/subjects', data),
  updateSubject: (subjectId: number, data: { name?: string; icon?: string; color?: string }) =>
    api.put<RegularSchoolSubject>(`/regular-school/subjects/${subjectId}`, data),
  deleteSubject: (subjectId: number) =>
    api.delete(`/regular-school/subjects/${subjectId}`),

  // Homework
  getHomework: (params: { student_id?: number; subject_id?: number; status?: string }) =>
    api.get<RegularSchoolHomework[]>('/regular-school/homework', { params }),
  createHomework: (data: { subject_id: number; student_id: number; title: string; description?: string; due_date?: string; points?: number }) =>
    api.post<RegularSchoolHomework>('/regular-school/homework', data),
  updateHomework: (homeworkId: number, data: { title?: string; description?: string; due_date?: string; points?: number }) =>
    api.put<RegularSchoolHomework>(`/regular-school/homework/${homeworkId}`, data),
  deleteHomework: (homeworkId: number) =>
    api.delete(`/regular-school/homework/${homeworkId}`),
  completeHomework: (homeworkId: number) =>
    api.post<{ homework: RegularSchoolHomework; points_awarded: number }>(`/regular-school/homework/${homeworkId}/complete`),

  // Stats
  getStats: (student_id: number) =>
    api.get<RegularSchoolStats>('/regular-school/stats', { params: { student_id } })
};

// Notes
export const notesAPI = {
  getByProfile: (profileId: number, category?: string, tag?: string) =>
    api.get<Note[]>(`/notes/${profileId}`, { params: { category, tag } }),
  getCategories: (profileId: number) => api.get<string[]>(`/notes/${profileId}/categories`),
  getTags: (profileId: number) => api.get<string[]>(`/notes/${profileId}/tags`),
  getReminders: (profileId: number) => api.get<Note[]>(`/notes/${profileId}/reminders`),
  getOne: (id: number) => api.get<Note>(`/notes/note/${id}`),
  create: (data: Omit<Partial<Note>, 'tags'> & { tags?: string[] }) => api.post<Note>('/notes', data),
  update: (id: number, data: Omit<Partial<Note>, 'tags'> & { tags?: string[] }) => api.put<Note>(`/notes/${id}`, data),
  delete: (id: number) => api.delete(`/notes/${id}`)
};

// Milestone type for goals
export interface GoalMilestone {
  id: number;
  goal_id: number;
  milestone_points: number;
  milestone_reward: string;
  achieved: boolean;
  achieved_at?: string;
  created_at: string;
}

// Extended MonthlyGoal with new fields
export interface GoalWithMilestones extends MonthlyGoal {
  goal_category?: 'weekly' | 'monthly' | 'long-term';
  reward_image?: string;
  current_points?: number;
  milestones?: GoalMilestone[];
  milestones_achieved?: number;
  total_milestones?: number;
}

// Goal template type for cost estimation
export interface GoalTemplate {
  id: number;
  name: string;
  description: string | null;
  category: string;
  icon: string;
  suggested_points: number;
  estimated_cost_min: number;
  estimated_cost_max: number;
  family_size_multiplier: number;
  is_system: boolean;
  is_active: boolean;
}

export interface GoalTemplateEstimate {
  template: GoalTemplate;
  familySize: number;
  estimatedCostMin: number;
  estimatedCostMax: number;
  suggestedPoints: number;
}

// Monthly Goals
export const goalsAPI = {
  getByProfile: (profileId: number, month?: string) =>
    api.get<MonthlyGoal[]>(`/goals/${profileId}`, { params: { month } }),
  getCurrent: (profileId: number) => api.get<MonthlyGoal | null>(`/goals/${profileId}/current`),
  getActive: (profileId: number, category?: string) =>
    api.get<GoalWithMilestones[]>(`/goals/${profileId}/active`, { params: { category } }),
  getHistory: (profileId: number, limit?: number) =>
    api.get<{ goals: MonthlyGoal[]; stats: { totalAchieved: number; totalPointsEarned: number; lastAchievement: string | null } }>(
      `/goals/${profileId}/history`,
      { params: { limit } }
    ),
  create: (data: Partial<GoalWithMilestones> & { milestones?: { points: number; reward: string }[] }) =>
    api.post<GoalWithMilestones>('/goals', data),
  update: (id: number, data: Partial<GoalWithMilestones>) => api.put<MonthlyGoal>(`/goals/${id}`, data),
  delete: (id: number) => api.delete(`/goals/${id}`),
  addProgress: (id: number, points: number, reason?: string) =>
    api.post<{
      goal: GoalWithMilestones;
      pointsAdded: number;
      newTotal: number;
      goalAchieved: boolean;
      milestonesAchieved: GoalMilestone[];
      reason?: string;
    }>(`/goals/${id}/add-progress`, { points, reason }),
  awardBonusPoints: (profileId: number, points: number, stars: number, reason: string, awardedBy?: number) =>
    api.post<{ message: string; progress: Progress }>(`/goals/${profileId}/bonus-points`, {
      points,
      stars,
      reason,
      awardedBy
    }),
  approve: (id: number, approved_by: number) =>
    api.post<MonthlyGoal>(`/goals/${id}/approve`, { approved_by }),
  reject: (id: number, rejected_by: number) =>
    api.post<{ message: string }>(`/goals/${id}/reject`, { rejected_by }),
  getPending: (parentId: number) =>
    api.get<MonthlyGoal[]>(`/goals/pending/${parentId}`),
  // Milestones
  getMilestones: (goalId: number) =>
    api.get<GoalMilestone[]>(`/goals/${goalId}/milestones`),
  addMilestone: (goalId: number, milestone_points: number, milestone_reward: string) =>
    api.post<GoalMilestone>(`/goals/${goalId}/milestones`, { milestone_points, milestone_reward }),
  deleteMilestone: (goalId: number, milestoneId: number) =>
    api.delete(`/goals/${goalId}/milestones/${milestoneId}`),
  // Templates (for cost estimation and quick goal creation)
  getTemplates: (category?: string) =>
    api.get<{ templates: GoalTemplate[]; categories: string[] }>('/goals/templates/all', { params: { category } }),
  getTemplate: (templateId: number) =>
    api.get<GoalTemplate>(`/goals/templates/${templateId}`),
  estimateTemplateCost: (templateId: number, familySize: number) =>
    api.post<GoalTemplateEstimate>(`/goals/templates/${templateId}/estimate`, { familySize }),
  createTemplate: (data: Partial<GoalTemplate>) =>
    api.post<GoalTemplate>('/goals/templates', data),
  updateTemplate: (templateId: number, data: Partial<GoalTemplate>) =>
    api.put<GoalTemplate>(`/goals/templates/${templateId}`, data),
  deleteTemplate: (templateId: number) =>
    api.delete(`/goals/templates/${templateId}`)
};


// Gamification API
export const gamificationAPI = {
  // Water intake
  logWater: (profile_id: number, amount_ml: number) =>
    api.post<any>('/gamification/water', { profile_id, amount_ml }),
  getWater: (profileId: number, date?: string) =>
    api.get<{ entries: any[]; total_ml: number; date: string; goal_ml: number }>(
      `/gamification/water/${profileId}`,
      { params: { date } }
    ),
  deleteWater: (id: number) => api.delete(`/gamification/water/${id}`),

  // Streaks
  getStreaks: (profileId: number) => api.get<any[]>(`/gamification/streaks/${profileId}`),

  // Achievements
  getAllAchievements: () => api.get<any[]>('/gamification/achievements'),
  getProfileAchievements: (profileId: number) =>
    api.get<{ earned: any[]; all: any[]; earned_count: number; total_count: number }>(
      `/gamification/achievements/${profileId}`
    ),

  // Stats
  getStats: (profileId: number) =>
    api.get<{
      points: number;
      stars: number;
      level: number;
      tasks_completed: number;
      goals_achieved: number;
      achievements_earned: number;
      streaks: Record<string, { current: number; longest: number }>;
      water_today_ml: number;
    }>(`/gamification/stats/${profileId}`),

  // Daily Challenges
  getChallenges: (profileId: number) =>
    api.get<{
      id: number;
      challenge_type: string;
      description: string;
      target_value: number;
      bonus_points: number;
      completed: number;
      current_progress: number;
    }[]>(`/gamification/challenges/${profileId}`),
  completeChallenge: (challengeId: number) =>
    api.post<{ message: string; bonusPoints: number }>(`/gamification/challenges/${challengeId}/complete`),

  // Weekly Summary
  getWeeklySummary: (profileId: number) =>
    api.get<{
      weekStart: string;
      weekEnd: string;
      summary: {
        tasksCompleted: number;
        pointsEarned: number;
        challengesCompleted: number;
        waterIntakeMl: number;
        achievementsEarned: number;
      };
      tasksByCategory: { category: string; count: number }[];
      dailyBreakdown: { date: string; tasks_completed: number }[];
      streaks: Record<string, { current: number; longest: number }>;
    }>(`/gamification/weekly-summary/${profileId}`),

  // Leaderboard
  getFamilyLeaderboard: (period?: 'week' | 'month' | 'all') =>
    api.get<{
      id: number;
      name: string;
      avatar: string;
      type: string;
      points: number;
      stars: number;
      level: number;
      tasksCompleted: number;
      currentStreak: number;
      longestStreak: number;
      achievementCount: number;
      recentAchievements: { name: string; icon: string }[];
      rank: number;
    }[]>('/gamification/family-leaderboard', { params: { period } }),

  getLeaderboard: (parentId: number, period?: 'week' | 'month' | 'all') =>
    api.get<{
      id: number;
      name: string;
      avatar: string;
      points: number;
      tasksCompleted: number;
      currentStreak: number;
      achievements: number;
      rank: number;
    }[]>(`/gamification/leaderboard/${parentId}`, { params: { period } }),

  // Daily Login Bonus
  getLoginBonus: (profileId: number) =>
    api.get<{
      claimed: boolean;
      consecutive_days: number;
      points_earned?: number;
      points_to_earn?: number;
      next_bonus?: number;
      streak_from_yesterday?: boolean;
    }>(`/gamification/login-bonus/${profileId}`),
  claimLoginBonus: (profileId: number) =>
    api.post<{
      success: boolean;
      points_earned: number;
      consecutive_days: number;
      total_points: number;
      next_bonus: number;
      is_week_complete: boolean;
    }>(`/gamification/login-bonus/${profileId}/claim`),

  // Mystery Rewards
  getMysteryRewards: (profileId: number) =>
    api.get<{
      recent: any[];
      total_count: number;
      total_bonus_earned: number;
    }>(`/gamification/mystery-rewards/${profileId}`),

  // Streak Freeze
  getStreakFreeze: (profileId: number) =>
    api.get<{
      freezes_used_this_week: number;
      max_freezes_per_week: number;
      can_freeze: boolean;
      freeze_cost: number;
      current_points: number;
    }>(`/gamification/streak-freeze/${profileId}`),
  useStreakFreeze: (profileId: number, streak_type: 'tasks' | 'water') =>
    api.post<{
      success: boolean;
      message: string;
      points_spent: number;
      remaining_points: number;
    }>(`/gamification/streak-freeze/${profileId}`, { streak_type }),

  // ===== NEW GAMIFICATION FEATURES =====

  // Countdown Challenges
  getCountdownChallenge: (profileId: number) =>
    api.get<{
      active: CountdownChallenge | null;
      stats: { totalCompleted: number; totalBonusEarned: number };
    }>(`/gamification/countdown/${profileId}`),
  startCountdownChallenge: (profileId: number) =>
    api.post<{ challenge: CountdownChallenge; message: string }>(`/gamification/countdown/${profileId}/start`),

  // Lucky Spin Wheel
  getSpinWheel: (profileId: number) =>
    api.get<{
      canSpin: boolean;
      tasksUntilSpin: number;
      tasksSinceLastSpin: number;
      tasksRequired: number;
      totalSpins: number;
      recentHistory: SpinWheelHistory[];
      prizes: SpinWheelPrize[];
    }>(`/gamification/spin-wheel/${profileId}`),
  spinWheel: (profileId: number) =>
    api.post<{
      success: boolean;
      prize: SpinWheelPrize & { index: number };
      pointsAwarded: number;
      starsAwarded: number;
      message: string;
    }>(`/gamification/spin-wheel/${profileId}/spin`),

  // Hidden Achievements
  getAchievementsWithHidden: (profileId: number) =>
    api.get<{
      visible: Achievement[];
      earnedHidden: Achievement[];
      hiddenStats: { totalHidden: number; earnedHidden: number; remaining: number };
    }>(`/gamification/achievements-with-hidden/${profileId}`),

  // Economy Controls (Parent Settings)
  getEconomySettings: (profileId: number) =>
    api.get<{
      settings: EconomySettings;
      earnings: {
        today: EarningTracker;
        weekTotal: number;
        dailyRemaining: number;
        weeklyRemaining: number;
      };
    }>(`/gamification/economy/${profileId}`),

  updateEconomySettings: (profileId: number, settings: Partial<EconomySettingsUpdate>) =>
    api.put<{ message: string; settings: EconomySettings }>(`/gamification/economy/${profileId}`, settings),

  getEarningHistory: (profileId: number, days?: number) =>
    api.get<{
      history: EarningHistoryEntry[];
      totals: { points: number; stars: number; tasks: number; bonuses: number };
    }>(`/gamification/economy/${profileId}/history`, { params: { days } }),

  getPricingGuide: (profileId: number) =>
    api.get<PricingGuide>(`/gamification/economy/${profileId}/pricing-guide`),

  // Points Adjustment (Parent Control)
  adjustPoints: (profileId: number, amount: number, reason: string, parentId?: number, relatedTaskId?: number) =>
    api.post<PointsAdjustmentResult>(`/gamification/points/adjust/${profileId}`, {
      amount,
      reason,
      parent_id: parentId,
      related_task_id: relatedTaskId
    }),
  getPointsHistory: (profileId: number, limit?: number) =>
    api.get<{ history: PointsAdjustmentEntry[] }>(`/gamification/points/history/${profileId}`, {
      params: { limit }
    })
};

// Economy control types
export interface EconomySettings {
  daily_points_cap: number;
  weekly_points_cap: number;
  points_multiplier: number;
  require_time_elapsed: boolean;
  min_task_duration_minutes: number;
  cooldown_seconds: number;
  bonuses_enabled: boolean;
  spin_wheel_enabled: boolean;
  countdown_challenges_enabled: boolean;
}

export interface EconomySettingsUpdate {
  dailyPointsCap?: number;
  weeklyPointsCap?: number;
  pointsMultiplier?: number;
  requireTimeElapsed?: boolean;
  minTaskDuration?: number;
  cooldownSeconds?: number;
  bonusesEnabled?: boolean;
  spinWheelEnabled?: boolean;
  countdownChallengesEnabled?: boolean;
}

export interface EarningTracker {
  points_earned: number;
  stars_earned: number;
  tasks_completed: number;
  bonuses_claimed: number;
  last_action_at: string;
}

export interface EarningHistoryEntry {
  date: string;
  points_earned: number;
  stars_earned: number;
  tasks_completed: number;
  bonuses_claimed: number;
}

export interface PricingGuide {
  earningRate: {
    dailyCap: number;
    weeklyCap: number;
    avgDailyActual: number;
    avgWeeklyProjected: number;
  };
  suggestions: {
    smallTreat: { description: string; suggestedPoints: number; daysToEarn: number };
    mediumReward: { description: string; suggestedPoints: number; daysToEarn: number };
    largeReward: { description: string; suggestedPoints: number; daysToEarn: number };
    majorReward: { description: string; suggestedPoints: number; daysToEarn: number };
  };
  tips: string[];
}

// Points Adjustment types
export interface PointsAdjustmentResult {
  success: boolean;
  adjustment: number;
  reason: string;
  previous_points: number;
  new_points: number;
  new_level: number;
  adjusted_by: string;
  related_task?: string | null;
}

export interface PointsAdjustmentEntry {
  id: number;
  profile_id: number;
  adjusted_by: number;
  adjusted_by_name: string;
  amount: number;
  reason: string;
  related_task_id?: number;
  related_task_title?: string;
  created_at: string;
}

// Types for new gamification features
export interface CountdownChallenge {
  id: number;
  profile_id: number;
  title: string;
  description: string;
  target_tasks: number;
  completed_tasks: number;
  duration_minutes: number;
  bonus_multiplier: number;
  started_at: string;
  expires_at: string;
  completed: boolean;
  completed_at: string | null;
  bonus_points_awarded: number;
}

export interface SpinWheelPrize {
  type: string;
  value?: number;
  description: string;
  color: string;
  weight?: number;
}

export interface SpinWheelHistory {
  id: number;
  reward_type: string;
  reward_value: number;
  reward_description: string;
  spun_at: string;
}

export interface Achievement {
  id: number;
  name: string;
  description: string;
  icon: string;
  points_reward: number;
  requirement_type: string;
  requirement_value: number;
  is_hidden?: boolean;
  earned?: boolean;
  earned_at?: string;
}

// AI Gamification API - Personalized AI-driven challenges
export const aiGamificationAPI = {
  // Behavior analysis
  analyzeBehavior: (profileId: number) =>
    api.get<{
      profile_id: number;
      analyzed_at: string;
      summary: {
        total_tasks: number;
        completed_tasks: number;
        pending_tasks: number;
        completion_rate: string | number;
        total_points: number;
        current_level: number;
        weekly_points: number;
        task_velocity: string;
        achievements_earned: number;
      };
      patterns: {
        avoided_categories: string[];
        loved_categories: string[];
        most_active_hour: string | null;
        most_active_day: string | null;
        avg_tasks_per_day: string;
        prefers_morning: boolean | null;
        prefers_weekends: boolean | null;
      };
      streaks: {
        task_current: number;
        task_longest: number;
        water_current: number;
        water_longest: number;
        at_risk: boolean;
      };
      goals: {
        total: number;
        achieved: number;
        active: number;
        pending_approval: number;
      };
      challenges: {
        weekly_total: number;
        weekly_completed: number;
        completion_rate: string | number;
      };
      water: {
        days_logged: number;
        avg_daily_ml: number;
        streak: number;
      };
      login: {
        consecutive_days: number;
        total_logins: number;
      };
      categories: Array<{
        category: string;
        total: number;
        completed: number;
        avg_points: number | null;
      }>;
      recent_completed: Array<{
        title: string;
        category: string;
        points: number;
        completed_at: string;
      }>;
      recent_pending: Array<{
        title: string;
        category: string;
        due_date: string | null;
        days_pending: number;
      }>;
    }>(`/ai-gamification/analyze/${profileId}`),

  // Generate AI challenges
  generateChallenges: (profileId: number, count?: number) =>
    api.post<{
      suggestions: AISuggestion[];
      behavior_summary: any;
      patterns: any;
    }>(`/ai-gamification/generate/${profileId}`, { count: count || 3 }),

  // Get pending suggestions for parent approval
  getPendingSuggestions: (parentId: number) =>
    api.get<(AISuggestion & { child_name: string })[]>(`/ai-gamification/suggestions/pending/${parentId}`),

  // Approve a suggestion
  approveSuggestion: (id: number, parentId: number, modifications?: {
    title?: string;
    description?: string;
    points_reward?: number;
    duration_days?: number;
    requires_timer?: boolean;
    timer_duration?: number;
  }) => api.post<{ message: string; challenge: CustomChallenge }>(
    `/ai-gamification/suggestions/${id}/approve`,
    { parent_id: parentId, modifications }
  ),

  // Reject a suggestion
  rejectSuggestion: (id: number, parentId: number, reason?: string) =>
    api.post<{ message: string }>(`/ai-gamification/suggestions/${id}/reject`, { parent_id: parentId, reason }),

  // Get active custom challenges for a profile
  getChallenges: (profileId: number) =>
    api.get<CustomChallenge[]>(`/ai-gamification/challenges/${profileId}`),

  // Create a custom challenge (parent-created)
  createChallenge: (data: {
    profile_id: number;
    title: string;
    description?: string;
    target_value?: number;
    points_reward?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    duration_days?: number;
    created_by: number;
    requires_timer?: boolean;
    timer_duration?: number;
  }) => api.post<CustomChallenge>('/ai-gamification/challenges', data),

  // Update challenge progress
  updateChallengeProgress: (challengeId: number, increment?: number) =>
    api.post<{
      challenge: CustomChallenge;
      just_completed: boolean;
    }>(`/ai-gamification/challenges/${challengeId}/progress`, { increment: increment || 1 }),

  // Challenge timer
  getChallengeTimer: (challengeId: number) =>
    api.get<ChallengeTimerState>(`/ai-gamification/challenges/${challengeId}/timer`),
  startChallengeTimer: (challengeId: number) =>
    api.post<{ success: boolean; message: string; timer_state: TimerState }>(
      `/ai-gamification/challenges/${challengeId}/timer/start`
    ),
  pauseChallengeTimer: (challengeId: number) =>
    api.post<{ success: boolean; message: string; timer_state: TimerState }>(
      `/ai-gamification/challenges/${challengeId}/timer/pause`
    ),
  resumeChallengeTimer: (challengeId: number) =>
    api.post<{ success: boolean; message: string; timer_state: TimerState }>(
      `/ai-gamification/challenges/${challengeId}/timer/resume`
    ),
  finishChallengeTimer: (challengeId: number) =>
    api.post<{
      success: boolean;
      challenge: CustomChallenge;
      progress: Progress;
      pointsEarned: number;
      timeSpent: number;
      just_completed: boolean;
    }>(`/ai-gamification/challenges/${challengeId}/timer/finish`),

  // Get focus areas for a child
  getFocusAreas: (profileId: number) =>
    api.get<FocusArea[]>(`/ai-gamification/focus/${profileId}`),

  // Set focus areas for a child
  setFocusAreas: (profileId: number, focusAreas: { type: string; notes?: string }[], createdBy: number) =>
    api.post<FocusArea[]>(`/ai-gamification/focus/${profileId}`, { focus_areas: focusAreas, created_by: createdBy })
};

// Types for AI Gamification
export interface AISuggestion {
  id: number;
  profile_id: number;
  suggestion_type: string;
  title: string;
  description: string;
  reasoning: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  points_reward: number;
  bonus_multiplier: number;
  target_value: number | null;
  duration_days: number;
  expires_at: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  reviewed_at: string | null;
  reviewed_by: number | null;
  parent_response: string | null;
  created_at: string;
}

export interface CustomChallenge {
  id: number;
  profile_id: number;
  title: string;
  description: string;
  challenge_type: string;
  target_value: number;
  current_progress: number;
  points_reward: number;
  bonus_multiplier: number;
  difficulty: 'easy' | 'medium' | 'hard';
  completed: boolean;
  completed_at: string | null;
  is_ai_generated: boolean;
  ai_suggestion_id: number | null;
  created_by: number;
  expires_at: string | null;
  created_at: string;
  requires_timer?: boolean | number;
  timer_duration?: number | null;
}

export interface FocusArea {
  id: number;
  profile_id: number;
  focus_type: string;
  priority: number;
  notes: string | null;
  created_by: number;
  created_at: string;
}

// Notifications API
export const notificationsAPI = {
  getVapidPublicKey: () =>
    api.get<{ publicKey: string }>('/notifications/vapid-public-key'),
  subscribe: (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    api.post('/notifications/subscribe', { subscription }),
  unsubscribe: (endpoint: string) =>
    api.post('/notifications/unsubscribe', { endpoint }),
  getNotifications: (limit?: number, unreadOnly?: boolean) =>
    api.get<{ notifications: Notification[]; unreadCount: number }>('/notifications', {
      params: { limit, unread: unreadOnly }
    }),
  getUnreadCount: () =>
    api.get<{ count: number }>('/notifications/unread-count'),
  markAsRead: (notificationId: number) =>
    api.post(`/notifications/${notificationId}/read`),
  markAllAsRead: () =>
    api.post('/notifications/read-all'),
  sendTest: () =>
    api.post('/notifications/test')
};


// Reward Shop API
export const rewardsAPI = {
  // Get rewards available in the shop for a profile
  getShop: (profileId: number) =>
    api.get<{ rewards: Reward[]; availablePoints: number; totalPoints: number }>(`/rewards/shop/${profileId}`),

  // Purchase a reward
  purchase: (rewardId: number, profileId: number) =>
    api.post<{ success: boolean; claim: RewardClaim; newBalance: number }>(`/rewards/${rewardId}/purchase`, { profileId }),

  // Get claimed rewards history
  getClaimed: (profileId: number) =>
    api.get<RewardClaim[]>(`/rewards/claimed/${profileId}`),

  // Get pending claims (for parents)
  // If parentId provided, only shows claims from that parent's children
  getPending: (parentId?: number) =>
    api.get<RewardClaim[]>(`/rewards/pending${parentId ? `?parentId=${parentId}` : ''}`),

  // Update claim status (approve/reject/given)
  updateClaimStatus: (claimId: number, status: string, approvedBy: number, notes?: string) =>
    api.put<RewardClaim>(`/rewards/claims/${claimId}/status`, { status, approvedBy, notes }),

  // Create a new reward (parent/admin)
  create: (reward: {
    title: string;
    description?: string;
    pointsRequired: number;
    icon?: string;
    imageUrl?: string;
    type?: 'virtual' | 'real';
    category?: string;
    profileId?: number | null;
    availableForAll?: boolean;
    stock?: number;
    createdBy: number;
  }) => api.post<Reward>('/rewards', reward),

  // Update a reward
  update: (rewardId: number, data: Partial<Reward>) =>
    api.put<Reward>(`/rewards/${rewardId}`, data),

  // Delete a reward
  delete: (rewardId: number) =>
    api.delete(`/rewards/${rewardId}`),

  // Get all rewards (admin view or parent-scoped)
  // If parentId provided, only shows rewards created by that parent
  getAll: (parentId?: number) =>
    api.get<Reward[]>(`/rewards/all${parentId ? `?parentId=${parentId}` : ''}`),

  // Get children for a parent (for reward targeting)
  getParentChildren: (parentId: number) =>
    api.get<Array<{ id: number; name: string; avatar: string; age: number }>>(`/rewards/parent/${parentId}/children`),

  // Reward categories
  getCategories: (parentId: number) =>
    api.get<RewardCategory[]>(`/rewards/categories/${parentId}`),

  createCategory: (data: {
    name: string;
    displayName: string;
    icon?: string;
    description?: string;
    color?: string;
    createdBy: number;
  }) => api.post<RewardCategory>('/rewards/categories', data),

  updateCategory: (categoryId: number, data: {
    displayName?: string;
    icon?: string;
    description?: string;
    color?: string;
  }) => api.put<RewardCategory>(`/rewards/categories/${categoryId}`, data),

  deleteCategory: (categoryId: number) =>
    api.delete(`/rewards/categories/${categoryId}`)
};

// Reward category type
export interface RewardCategory {
  id: number;
  name: string;
  display_name: string;
  icon: string;
  description: string;
  color: string;
  created_by: number | null;
  is_default: boolean;
  created_at: string;
}

// Reminder Preferences API
export interface ReminderPreferences {
  profile_id: number;
  morning_reminder_time: string;
  reminder_enabled: boolean;
}

export const remindersAPI = {
  // Get reminder preferences for a profile
  getPreferences: (profileId: number) =>
    api.get<ReminderPreferences>(`/reminders/${profileId}`),

  // Update reminder preferences
  updatePreferences: (profileId: number, data: { enabled?: boolean; time?: string }) =>
    api.put<ReminderPreferences & { message: string }>(`/reminders/${profileId}`, data),

  // Test reminder (admin only)
  sendTest: (profileId: number) =>
    api.post<{ message: string; profileId: number }>(`/reminders/test/${profileId}`)
};

// ==================== FAMILY QUIZ SYSTEM ====================

// Quiz Types
export interface QuizCategory {
  id: number;
  name: string;
  display_name: string;
  icon: string;
  description: string;
  theme_config: {
    boy: QuizTheme;
    girl: QuizTheme;
  };
  input_config: QuizInputConfig;
}

export interface QuizTheme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
  };
  mascot: string;
  animations: string[];
  sounds: {
    correct: string;
    wrong: string;
    complete: string;
  };
  encouragements: string[];
}

export interface QuizInputConfig {
  question_placeholder: string;
  supports_images?: boolean;
  supports_audio?: boolean;
  supports_equations?: boolean;
  supports_maps?: boolean;
  supports_dates?: boolean;
  color_picker?: boolean;
  shape_picker?: boolean;
  equation_builder?: boolean;
  operators?: string[];
  default_options_count?: number;
  option_style: 'letters' | 'numbers' | 'text' | 'visual';
}

export interface FamilyQuiz {
  id: number;
  title: string;
  description?: string;
  category_id: number;
  category_name?: string;
  category_icon?: string;
  created_by: number;
  assigned_to: number;
  assigned_to_name?: string;
  assigned_to_avatar?: string;
  assigned_to_gender?: string;
  points_per_correct: number;
  stars_per_correct: number;
  bonus_points: number;
  time_limit_seconds?: number;
  pass_threshold: number;
  schedule_type: string;
  schedule_days?: string;
  is_active: number;
  is_competition: number;
  competition_ends_at?: string;
  first_place_bonus: number;
  second_place_bonus: number;
  third_place_bonus: number;
  question_count?: number;
  attempt_count?: number;
  avg_score?: number;
  my_attempts?: number;
  best_score?: number;
  last_attempt?: string;
  last_score_percentage?: number;
  last_passed?: number;
  theme?: QuizTheme;
  created_at: string;
  updated_at: string;
}

export interface QuizQuestion {
  id: number;
  quiz_id: number;
  question_text: string;
  question_type: string;
  question_image?: string;
  question_audio?: string;
  options: QuizOption[];
  correct_answer?: string; // Only returned after answering
  hint?: string;
  explanation?: string;
  points: number;
  order_index: number;
}

export interface QuizOption {
  id: string;
  text: string;
  image?: string;
  color?: string;
  shape?: string;
}

export interface QuizAttempt {
  id: number;
  quiz_id: number;
  profile_id: number;
  started_at: string;
  completed_at?: string;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  skipped: number;
  score_percentage: number;
  points_earned: number;
  stars_earned: number;
  time_bonus_points?: number;
  time_taken_seconds?: number;
  passed: number;
  competition_rank?: number;
  bonus_awarded: number;
  quiz_title?: string;
  category_icon?: string;
}

export interface QuizStartResponse {
  attemptId: number;
  quiz: {
    id: number;
    title: string;
    description?: string;
    pointsPerCorrect: number;
    starsPerCorrect: number;
    bonusPoints: number;
    timeLimitSeconds?: number;
    passThreshold: number;
    isCompetition: boolean;
  };
  theme: QuizTheme;
  questions: QuizQuestion[];
  totalQuestions: number;
}

export interface QuizAnswerResponse {
  isCorrect: boolean;
  correctAnswer: string;
  explanation?: string;
  points: number;
}

export interface QuizCompleteResponse {
  completed: boolean;
  scorePercentage: number;
  passed: boolean;
  pointsEarned: number;
  starsEarned: number;
  correctAnswers: number;
  totalQuestions: number;
  competitionRank?: number;
  competitionBonus: number;
  timeTakenSeconds?: number;
  timeBonusPoints?: number;
}

export interface AIQuizGenerateResponse {
  quiz: FamilyQuiz;
  questions: QuizQuestion[];
  image_warnings?: string[];
}

export interface AIQuizJobStartResponse {
  jobId: string;
  status: 'queued' | 'running';
}

export interface AIQuizJobStatusResponse {
  status: 'queued' | 'running' | 'completed' | 'failed';
  result?: AIQuizGenerateResponse;
  error?: string;
}

// Family Quiz API
export const familyQuizzesAPI = {
  // Categories
  getCategories: () =>
    api.get<QuizCategory[]>('/family-quizzes/categories'),
  getCategory: (idOrName: string | number) =>
    api.get<QuizCategory>(`/family-quizzes/categories/${idOrName}`),

  // Quizzes - Parent perspective
  getParentQuizzes: (parentId: number) =>
    api.get<FamilyQuiz[]>(`/family-quizzes/parent/${parentId}`),
  getQuiz: (quizId: number) =>
    api.get<FamilyQuiz & { questions: QuizQuestion[] }>(`/family-quizzes/${quizId}`),
  generateAIQuiz: (data: {
    prompt: string;
    categoryId: number;
    questionCount: number;
    createdBy: number;
    assignedTo: number;
    includeImages?: boolean;
    imageProvider?: 'grok' | 'openai' | 'gemini';
  }) => api.post<AIQuizGenerateResponse>('/family-quizzes/ai-generate', data),
  createAIQuizJob: (data: {
    prompt: string;
    categoryId: number;
    questionCount: number;
    createdBy: number;
    assignedTo: number;
    includeImages?: boolean;
    textProvider?: 'grok' | 'openai' | 'gemini';
    imageProvider?: 'grok' | 'openai' | 'gemini';
  }) => api.post<AIQuizJobStartResponse>('/family-quizzes/ai-generate', data),
  getAIQuizJobStatus: (jobId: string) =>
    api.get<AIQuizJobStatusResponse>(`/family-quizzes/ai-generate/status/${jobId}`),
  createQuiz: (data: {
    title: string;
    description?: string;
    categoryId: number;
    createdBy: number;
    assignedTo: number;
    pointsPerCorrect?: number;
    starsPerCorrect?: number;
    bonusPoints?: number;
    timeLimitSeconds?: number;
    passThreshold?: number;
    scheduleType?: string;
    scheduleDays?: string;
    isCompetition?: boolean;
    competitionEndsAt?: string;
    firstPlaceBonus?: number;
    secondPlaceBonus?: number;
    thirdPlaceBonus?: number;
  }) => api.post<FamilyQuiz>('/family-quizzes', data),
  updateQuiz: (quizId: number, data: Partial<FamilyQuiz>) =>
    api.put<FamilyQuiz>(`/family-quizzes/${quizId}`, data),
  deleteQuiz: (quizId: number) =>
    api.delete(`/family-quizzes/${quizId}`),

  // Quizzes - Child perspective
  getChildQuizzes: (childId: number) =>
    api.get<FamilyQuiz[]>(`/family-quizzes/child/${childId}`),

  // Questions
  addQuestion: (quizId: number, data: {
    questionText: string;
    questionType?: string;
    questionImage?: string;
    questionAudio?: string;
    options: QuizOption[];
    correctAnswer: string;
    hint?: string;
    explanation?: string;
    points?: number;
  }) => api.post<QuizQuestion>(`/family-quizzes/${quizId}/questions`, data),
  updateQuestion: (questionId: number, data: Partial<{
    questionText: string;
    questionType: string;
    questionImage: string;
    questionAudio: string;
    options: QuizOption[];
    correctAnswer: string;
    hint: string;
    explanation: string;
    points: number;
    orderIndex: number;
  }>) => api.put<QuizQuestion>(`/family-quizzes/questions/${questionId}`, data),
  deleteQuestion: (questionId: number) =>
    api.delete(`/family-quizzes/questions/${questionId}`),
  reorderQuestions: (quizId: number, questionIds: number[]) =>
    api.put(`/family-quizzes/${quizId}/questions/reorder`, { questionIds }),

  // Playing quizzes
  startQuiz: (quizId: number, profileId: number) =>
    api.post<QuizStartResponse>(`/family-quizzes/${quizId}/start`, { profileId }),
  submitAnswer: (attemptId: number, questionId: number, selectedAnswer: string, timeTakenSeconds?: number) =>
    api.post<QuizAnswerResponse>(`/family-quizzes/attempts/${attemptId}/answer`, {
      questionId, selectedAnswer, timeTakenSeconds
    }),
  completeQuiz: (attemptId: number, timeTakenSeconds?: number) =>
    api.post<QuizCompleteResponse>(`/family-quizzes/attempts/${attemptId}/complete`, { timeTakenSeconds }),
  getTimer: (attemptId: number) =>
    api.get<QuizTimerState>(`/family-quizzes/attempts/${attemptId}/timer`),
  startTimer: (attemptId: number) =>
    api.post<{ success: boolean; message: string; timer_state: TimerState }>(
      `/family-quizzes/attempts/${attemptId}/timer/start`
    ),
  pauseTimer: (attemptId: number) =>
    api.post<{ success: boolean; message: string; timer_state: TimerState }>(
      `/family-quizzes/attempts/${attemptId}/timer/pause`
    ),
  resumeTimer: (attemptId: number) =>
    api.post<{ success: boolean; message: string; timer_state: TimerState }>(
      `/family-quizzes/attempts/${attemptId}/timer/resume`
    ),

  // Attempt history
  getAttemptHistory: (profileId: number, limit?: number) =>
    api.get<QuizAttempt[]>(`/family-quizzes/attempts/profile/${profileId}`, { params: { limit } }),
  getAttemptDetails: (attemptId: number) =>
    api.get<QuizAttempt & { answers: any[] }>(`/family-quizzes/attempts/${attemptId}`),

  // Competition
  getLeaderboard: (quizId: number) =>
    api.get<(QuizAttempt & { name: string; avatar: string })[]>(`/family-quizzes/${quizId}/leaderboard`),

  // Stats
  getParentStats: (parentId: number) =>
    api.get<{
      total_quizzes: number;
      total_attempts: number;
      avg_score: number;
      total_points_awarded: number;
      total_stars_awarded: number;
      passed_attempts: number;
      completed_attempts: number;
    }>(`/family-quizzes/stats/parent/${parentId}`),
  getChildStats: (childId: number) =>
    api.get<{
      overall: {
        available_quizzes: number;
        total_attempts: number;
        avg_score: number;
        total_points_earned: number;
        total_stars_earned: number;
        quizzes_passed: number;
        best_score: number;
        first_places: number;
      };
      byCategory: Array<{
        display_name: string;
        icon: string;
        attempts: number;
        avg_score: number;
        points_earned: number;
      }>;
    }>(`/family-quizzes/stats/child/${childId}`),

  // Media upload
  uploadMedia: (quizId: number, file: File) => {
    const formData = new FormData();
    formData.append('media', file);
    return api.post<{ success: boolean; url: string; filename: string }>(
      `/family-quizzes/${quizId}/media`,
      formData,
      { headers: { 'Content-Type': undefined } }
    );
  },
  getMediaUrl: (filename: string) => `/api/family-quizzes/media/${filename}`
};

// Photo Proof API
export const photoProofAPI = {
  // Upload photo proof for a task
  upload: (taskId: number, file: File) => {
    const formData = new FormData();
    formData.append('proof', file);
    return api.post<{ success: boolean; task: Task; message: string }>(
      `/tasks/${taskId}/proof`,
      formData,
      { headers: { 'Content-Type': undefined } }
    );
  },

  // Get photo proof URL for a task
  getUrl: (taskId: number) => `/api/tasks/${taskId}/proof`,

  // Delete photo proof
  delete: (taskId: number) =>
    api.delete<{ success: boolean; message: string }>(`/tasks/${taskId}/proof`)
};

// Book Types
export interface Book {
  id: number;
  title: string;
  description?: string;
  cover_image?: string;
  created_by: number;
  assigned_to?: number;
  creator_name?: string;
  assigned_to_name?: string;
  age_range: string;
  language: string;
  genre: string;
  theme?: string;
  total_pages: number;
  is_published: number;
  is_ai_generated: number;
  ai_provider?: string;
  created_at: string;
  updated_at: string;
  page_count?: number;
  current_page?: number;
  is_read?: number;
  // Physical book fields
  author?: string;
  book_source?: 'ai' | 'physical';
  source_location?: 'library' | 'home' | 'school' | 'gift' | 'borrowed' | string;
  isbn?: string;
}

export interface BookPage {
  id: number;
  book_id: number;
  page_number: number;
  title?: string;
  content: string;
  image_prompt?: string;
  image_url?: string;
  audio_url?: string;
  created_at: string;
}

export interface BookCategory {
  id: number;
  name: string;
  display_name: string;
  icon: string;
  description?: string;
  created_at: string;
}

export interface BookReadingProgress {
  id: number;
  book_id: number;
  profile_id: number;
  current_page: number;
  pages_read: number;
  completed: number;
  completed_at?: string;
  started_at: string;
  last_read_at: string;
  book_title?: string;
  cover_image?: string;
  reading_status?: 'reading' | 'finished' | 'struggling' | 'paused';
}

export interface BookReadingNote {
  id: number;
  book_id: number;
  profile_id: number;
  note_type: 'learning' | 'favorite_part' | 'question' | 'vocabulary' | 'struggle' | 'other';
  content: string;
  page_reference?: number;
  created_at: string;
  updated_at: string;
  profile_name?: string;
  profile_avatar?: string;
}

export interface BookWithPages extends Book {
  pages: BookPage[];
  categories: BookCategory[];
}

export interface BookFeedback {
  id: number;
  book_id: number;
  profile_id: number;
  rating: number;
  liked: number;
  comment?: string;
  created_at: string;
  profile_name?: string;
  profile_avatar?: string;
}

export interface BookGenerateRequest {
  prompt: string;
  pageCount?: number;
  createdBy: number;
  assignedTo?: number;
  ageRange?: string;
  language?: string;
  genre?: string;
  categoryIds?: number[];
  includeImages?: boolean;
  customInstructions?: string;
}

export interface BookJobStatus {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress?: {
    current: number;
    total: number;
    message: string;
  };
  result?: {
    book: Book;
    pages: BookPage[];
    imageErrors?: string[];
    provider: string;
  };
  error?: string;
}

// Books API
export const booksAPI = {
  // Categories
  getCategories: () => api.get<BookCategory[]>('/books/categories'),

  // AI Generation
  generateAIBook: (data: BookGenerateRequest) =>
    api.post<{ jobId: string; status: string }>('/books/ai-generate', data),

  getAIBookJobStatus: (jobId: string) =>
    api.get<BookJobStatus>(`/books/ai-generate/status/${jobId}`),

  // CRUD
  getProfileBooks: (profileId: number) =>
    api.get<Book[]>(`/books/profile/${profileId}`),

  getBook: (bookId: number) =>
    api.get<BookWithPages>(`/books/${bookId}`),

  createBook: (data: {
    title: string;
    description?: string;
    createdBy: number;
    assignedTo?: number;
    ageRange?: string;
    language?: string;
    genre?: string;
    categoryIds?: number[];
    // Physical book fields
    author?: string;
    book_source?: 'ai' | 'physical';
    source_location?: string;
    isbn?: string;
    total_pages?: number;
  }) => api.post<Book>('/books', data),

  deleteBook: (bookId: number) =>
    api.delete<{ success: boolean; message: string }>(`/books/${bookId}`),

  // Pages
  addPage: (bookId: number, data: {
    pageNumber?: number;
    title?: string;
    content: string;
    imageUrl?: string;
  }) => api.post<BookPage>(`/books/${bookId}/pages`, data),

  // Reading Progress
  updateProgress: (bookId: number, data: {
    profileId: number;
    currentPage: number;
    completed?: boolean;
  }) => api.post<BookReadingProgress>(`/books/${bookId}/progress`, data),

  getProfileProgress: (profileId: number) =>
    api.get<BookReadingProgress[]>(`/books/progress/${profileId}`),

  // Media
  getMediaUrl: (filename: string) => `/api/books/media/${filename}`,

  // Feedback/Ratings
  submitFeedback: (bookId: number, data: {
    profileId: number;
    rating: number;
    liked?: boolean;
    comment?: string;
  }) => api.post<BookFeedback>(`/books/${bookId}/feedback`, data),

  getBookFeedback: (bookId: number) =>
    api.get<{ feedback: BookFeedback[]; stats: { totalReviews: number; averageRating: number; likesCount: number } }>(`/books/${bookId}/feedback`),

  getMyFeedback: (bookId: number, profileId: number) =>
    api.get<BookFeedback | null>(`/books/${bookId}/my-feedback/${profileId}`),

  getProfileFeedback: (profileId: number) =>
    api.get<(BookFeedback & { book_title: string; cover_image?: string })[]>(`/books/feedback/profile/${profileId}`),

  // Reading Status
  updateReadingStatus: (bookId: number, data: { profileId: number; reading_status: 'reading' | 'finished' | 'struggling' | 'paused' }) =>
    api.patch<BookReadingProgress>(`/books/${bookId}/reading-status`, data),

  // Reading Notes
  getBookNotes: (bookId: number, profileId?: number) =>
    api.get<BookReadingNote[]>(`/books/${bookId}/notes`, { params: { profile_id: profileId } }),

  createBookNote: (bookId: number, data: { profileId: number; note_type?: string; content: string; page_reference?: number }) =>
    api.post<BookReadingNote>(`/books/${bookId}/notes`, data),

  updateBookNote: (noteId: number, data: { note_type?: string; content?: string; page_reference?: number }) =>
    api.put<BookReadingNote>(`/books/notes/${noteId}`, data),

  deleteBookNote: (noteId: number) =>
    api.delete(`/books/notes/${noteId}`),

  // Completed Books
  getCompletedBooks: (profileId: number) =>
    api.get<(Book & { completed_at: string; notes_count: number })[]>(`/books/completed/${profileId}`),

  // Children's Reading History (for parents)
  getChildrenReadingHistory: (parentId: number) =>
    api.get<{
      children: Array<{ id: number; name: string; avatar: string }>;
      history: Array<BookReadingProgress & { title: string; cover_image?: string; child_name: string; child_avatar: string }>;
    }>(`/books/children-history/${parentId}`),

  // Book Lookup (for physical books)
  lookupBook: (title: string) =>
    api.get<{ found: boolean; book?: Partial<Book> }>(`/books/lookup`, { params: { title } }),

  // Book Generation Instructions
  getGenerationInstructions: (profileId: number) =>
    api.get<{ instructions: string }>(`/books/generation-instructions/${profileId}`),

  saveGenerationInstructions: (profileId: number, instructions: string) =>
    api.put<{ success: boolean; instructions: string }>(`/books/generation-instructions/${profileId}`, { instructions })
};

// ==================== SHOPPING GAMIFICATION ====================

export interface ShoppingCategory {
  id: number;
  name: string;
  display_name: string;
  icon: string;
  color: string;
  sort_order: number;
  is_default: boolean;
}

export interface ShoppingList {
  id: number;
  parent_id: number;
  name: string;
  description?: string;
  store_name?: string;
  budget?: number;
  points_per_item: number;
  bonus_for_completion: number;
  bonus_for_good_behavior: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  item_count?: number;
  trip_count?: number;
  items?: ShoppingItem[];
}

export interface ShoppingItem {
  id: number;
  list_id: number;
  name: string;
  category?: string;
  category_id?: number | null;
  category_name?: string;
  category_icon?: string;
  quantity: number;
  unit?: string;
  estimated_price?: number;
  notes?: string;
  is_optional: boolean;
  points_value?: number;
  sort_order: number;
  created_at: string;
  // During trip - added when fetching trip details
  is_found?: boolean;
  // During trip - legacy
  completion_id?: number;
  found_by?: number;
  found_by_name?: string;
  actual_price?: number;
  quantity_bought?: number;
  was_substituted?: boolean;
  substitution_notes?: string;
  completed_at?: string;
}

export interface ShoppingTrip {
  id: number;
  list_id: number;
  parent_id: number;
  store_name?: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  scheduled_at?: string;
  scheduled_date?: string; // Alias for scheduled_at
  started_at?: string;
  completed_at?: string;
  total_spent?: number;
  notes?: string;
  created_at: string;
  list_name?: string;
  helper_count?: number;
  items_completed?: number;
  items_found?: number; // From query
  total_items?: number; // From query
  points_per_item?: number;
  points_earned?: number; // For child helpers
  bonus_for_completion?: number;
  bonus_for_good_behavior?: number;
  helpers?: ShoppingHelper[];
  items?: ShoppingItem[];
}

export interface ShoppingHelper {
  id: number;
  trip_id: number;
  profile_id: number;
  status: 'assigned' | 'participated' | 'completed';
  behavior_rating?: number;
  items_found: number;
  points_earned: number;
  bonus_earned: number;
  parent_notes?: string;
  created_at: string;
  completed_at?: string;
  name?: string;
  avatar?: string;
}

export interface ShoppingStats {
  total_trips: number;
  items_found: number;
  total_points: number;
  avg_behavior_rating: number | null;
}

export interface ShoppingLeaderboardEntry {
  profile_id: number;
  name: string;
  avatar?: string;
  trips_completed: number;
  items_found: number;
  total_points: number;
  avg_rating: number | null;
}

export const shoppingAPI = {
  // Categories
  getCategories: () =>
    api.get<ShoppingCategory[]>('/shopping/categories'),

  // Lists
  getLists: (parentId: number, includeItems = false) =>
    api.get<ShoppingList[]>(`/shopping/lists/${parentId}`, { params: { includeItems } }),

  getList: (listId: number) =>
    api.get<ShoppingList>(`/shopping/lists/detail/${listId}`),

  createList: (data: {
    parent_id: number;
    name: string;
    description?: string;
    store_name?: string;
    budget?: number;
    points_per_item?: number;
    bonus_for_completion?: number;
    bonus_for_good_behavior?: number;
  }) => api.post<ShoppingList>('/shopping/lists', data),

  updateList: (listId: number, data: Partial<ShoppingList>) =>
    api.put<ShoppingList>(`/shopping/lists/${listId}`, data),

  deleteList: (listId: number) =>
    api.delete(`/shopping/lists/${listId}`),

  // Items
  addItem: (listId: number, data: {
    name: string;
    category_id?: number;
    quantity?: number;
    unit?: string;
    estimated_price?: number;
    notes?: string;
    is_optional?: boolean;
    points_value?: number;
    sort_order?: number;
  }) => api.post<ShoppingItem>(`/shopping/lists/${listId}/items`, data),

  updateItem: (itemId: number, data: Partial<ShoppingItem>) =>
    api.put<ShoppingItem>(`/shopping/items/${itemId}`, data),

  deleteItem: (itemId: number) =>
    api.delete(`/shopping/items/${itemId}`),

  // Trips
  getActiveTrips: (parentId: number) =>
    api.get<ShoppingTrip[]>(`/shopping/trips/active/${parentId}`),

  getMyTrips: (profileId: number) =>
    api.get<ShoppingTrip[]>(`/shopping/trips/helper/${profileId}`),

  getTrip: (tripId: number) =>
    api.get<ShoppingTrip>(`/shopping/trips/detail/${tripId}`),

  createTrip: (data: {
    list_id: number;
    scheduled_date?: string;
  }) => api.post<ShoppingTrip>('/shopping/trips', data),

  startTrip: (tripId: number) =>
    api.post<ShoppingTrip>(`/shopping/trips/${tripId}/start`),

  markItemFound: (tripId: number, itemId: number, data: {
    found_by_profile_id: number;
    found: boolean;
  }) => api.post(`/shopping/trips/${tripId}/items/${itemId}/found`, data),

  completeTrip: (tripId: number, data: {
    behavior_rating?: number;
    notes?: string;
  }) => api.post<{
    message: string;
    total_points_awarded: number;
  }>(`/shopping/trips/${tripId}/complete`, data),

  cancelTrip: (tripId: number) =>
    api.post(`/shopping/trips/${tripId}/cancel`),

  addHelper: (tripId: number, profileId: number) =>
    api.post(`/shopping/trips/${tripId}/helpers`, { profile_id: profileId }),

  removeHelper: (tripId: number, profileId: number) =>
    api.delete(`/shopping/trips/${tripId}/helpers/${profileId}`),

  // Stats
  getStats: (profileId: number) =>
    api.get<ShoppingStats>(`/shopping/stats/${profileId}`),

  getLeaderboard: (parentId: number) =>
    api.get<ShoppingLeaderboardEntry[]>(`/shopping/leaderboard/${parentId}`),

  // Permissions
  getChildPermissions: (parentId: number) =>
    api.get<Array<{ id: number; name: string; avatar: string; can_create_shopping_lists: boolean }>>(`/shopping/permissions/${parentId}`),

  setChildPermission: (childId: number, canCreate: boolean) =>
    api.put<{ message: string; can_create_shopping_lists: boolean }>(`/shopping/permissions/${childId}`, { can_create_shopping_lists: canCreate }),

  canCreateLists: () =>
    api.get<{ canCreate: boolean; reason: string }>('/shopping/can-create-lists')
};

// ==================== LEARNING ACTIVITIES API ====================

import type {
  ActivityType,
  LearningSession,
  LearningActivity,
  SessionAttempt,
  ParentActivityStats,
  ChildActivityStats,
  AiGenerationRequest,
  AiGenerationJob,
  ActivitySubmissionResult,
  SessionCompletionResult,
  ActivityLeaderboardEntry
} from '../types/activities';

export const activitiesAPI = {
  // Activity Types
  getTypes: () =>
    api.get<ActivityType[]>('/activities/types'),

  getType: (idOrName: string | number) =>
    api.get<ActivityType>(`/activities/types/${idOrName}`),

  // Sessions
  getParentSessions: (parentId: number) =>
    api.get<LearningSession[]>(`/activities/sessions/parent/${parentId}`),

  getChildSessions: (childId: number) =>
    api.get<LearningSession[]>(`/activities/sessions/child/${childId}`),

  getSession: (sessionId: number) =>
    api.get<LearningSession>(`/activities/sessions/${sessionId}`),

  createSession: (data: {
    title: string;
    description?: string;
    topic: string;
    ageRange?: string;
    createdBy: number;
    assignedTo: number;
    pointsPerActivity?: number;
    starsPerSession?: number;
    bonusPoints?: number;
    timeLimitSeconds?: number;
    passThreshold?: number;
    isCompetition?: boolean;
    competitionEndsAt?: string;
    firstPlaceBonus?: number;
    secondPlaceBonus?: number;
    thirdPlaceBonus?: number;
  }) => api.post<{ id: number; message: string }>('/activities/sessions', data),

  updateSession: (sessionId: number, data: Partial<LearningSession>) =>
    api.put<{ message: string }>(`/activities/sessions/${sessionId}`, data),

  deleteSession: (sessionId: number) =>
    api.delete<{ message: string }>(`/activities/sessions/${sessionId}`),

  // Activities within sessions
  addActivity: (sessionId: number, data: {
    activityTypeId: number;
    title: string;
    instructions?: string;
    contentData: any;
    correctData: any;
    hints?: string[];
    explanation?: string;
    points?: number;
    timeLimitSeconds?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
  }) => api.post<{ id: number; message: string }>(`/activities/sessions/${sessionId}/activities`, data),

  updateActivity: (activityId: number, data: Partial<LearningActivity>) =>
    api.put<{ message: string }>(`/activities/activities/${activityId}`, data),

  deleteActivity: (activityId: number) =>
    api.delete<{ message: string }>(`/activities/activities/${activityId}`),

  reorderActivities: (sessionId: number, activityIds: number[]) =>
    api.put<{ message: string }>(`/activities/sessions/${sessionId}/activities/reorder`, { activityIds }),

  // Session Attempts (Playing)
  startSession: (sessionId: number, profileId: number) =>
    api.post<{ attemptId: number; totalActivities: number; maxPossibleScore: number; resumed?: boolean; message: string }>(
      `/activities/sessions/${sessionId}/start`, { profileId }
    ),

  submitActivity: (attemptId: number, data: {
    activityId: number;
    userResponse: any;
    timeTakenSeconds?: number;
    hintsUsed?: number;
  }) => api.post<ActivitySubmissionResult>(`/activities/attempts/${attemptId}/submit`, data),

  completeSession: (attemptId: number) =>
    api.post<SessionCompletionResult>(`/activities/attempts/${attemptId}/complete`),

  getAttemptHistory: (profileId: number, limit?: number) =>
    api.get<SessionAttempt[]>(`/activities/attempts/profile/${profileId}`, { params: { limit } }),

  getLeaderboard: (sessionId: number) =>
    api.get<ActivityLeaderboardEntry[]>(`/activities/sessions/${sessionId}/leaderboard`),

  // Statistics
  getParentStats: (parentId: number) =>
    api.get<ParentActivityStats>(`/activities/stats/parent/${parentId}`),

  getChildStats: (childId: number) =>
    api.get<ChildActivityStats>(`/activities/stats/child/${childId}`),

  // AI Generation
  startAiGeneration: (data: AiGenerationRequest) =>
    api.post<{ jobId: string; status: string; remaining: number }>('/activities/ai-generate', data),

  getAiGenerationStatus: (jobId: string) =>
    api.get<AiGenerationJob>(`/activities/ai-generate/status/${jobId}`),

  pollAiGeneration: (jobId: string) =>
    api.get<AiGenerationJob>(`/activities/ai-generate/status/${jobId}`),

  // Aliases for ActivityBuilder compatibility
  getCreatedSessions: (parentId: number) =>
    api.get<LearningSession[]>(`/activities/sessions/parent/${parentId}`),

  getActivityTypes: () =>
    api.get<ActivityType[]>('/activities/types'),

  duplicateSession: (sessionId: number, assignedTo: number) =>
    api.post<{ id: number; message: string }>(`/activities/sessions/${sessionId}/duplicate`, { assignedTo }),

  // Media
  uploadMedia: (sessionId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{ url: string; filename: string }>(
      `/activities/sessions/${sessionId}/media`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  }
};

// ==================== H5P API ====================

interface H5PContent {
  id: number;
  h5p_content_id: string;
  title: string;
  content_type: string;
  library_name: string;
  created_by: number;
  is_ai_generated: boolean | number;
  created_at: string;
  assignment_count?: number;
  attempt_count?: number;
  // For child view
  assignment_id?: number;
  points?: number;
  my_attempts?: number;
  best_score?: number;
  passed?: boolean | number;
}

interface H5PAssignment {
  id: number;
  h5p_content_id: number;
  assigned_to: number;
  assigned_by: number;
  points: number;
  pass_percentage: number;
  child_name?: string;
  child_avatar?: string;
  attempt_count?: number;
  best_score?: number;
  passed?: boolean | number;
}

interface H5PAttempt {
  id: number;
  assignment_id: number;
  profile_id: number;
  score: number;
  max_score: number;
  score_percentage: number;
  passed: boolean | number;
  started_at: string;
  completed_at?: string;
  profile_name?: string;
  profile_avatar?: string;
}

interface H5PPlayerData {
  content: {
    id: number;
    title: string;
    contentType: string;
  };
  player: any;
  attemptId: number | null;
  assignment: {
    points: number;
    passPercentage: number;
  } | null;
}

interface H5PStatus {
  initialized: boolean;
  installedContentTypes: string[];
  contentTypesCount: number;
}

interface H5PQuizSpec {
  title: string;
  age: number;
  theme: string;
  questions: Array<{
    type: 'mcq' | 'true_false' | 'fill_blank' | 'matching';
    prompt: string;
    choices?: string[];
    answerIndex?: number;
    correctAnswer?: boolean | string;
    explanation?: string;
  }>;
}

interface H5PXAPIResult {
  recorded: boolean;
  completed?: boolean;
  passed?: boolean;
  score?: number;
  maxScore?: number;
  scorePercentage?: number;
  pointsAwarded?: number;
}

export const h5pAPI = {
  // Get H5P service status
  getStatus: () => api.get<H5PStatus>('/h5p/status'),

  // Get all H5P content (parents see created, kids see assigned)
  getContent: () => api.get<H5PContent[]>('/h5p/content'),

  // Get single content details
  getContentById: (id: number) => api.get<H5PContent>(`/h5p/content/${id}`),

  // Get quiz questions for preview (parents only)
  getQuizQuestions: (id: number) => api.get<{
    id: number;
    title: string;
    isAiGenerated: boolean;
    provider: string;
    theme: string;
    age: number;
    questionCount: number;
    questions: Array<{
      index: number;
      type: 'mcq' | 'true_false' | 'fill_blank';
      prompt: string;
      choices: string[] | null;
      correctAnswer: number | boolean;
      explanation: string;
    }>;
  }>(`/h5p/content/${id}/questions`),

  // Create H5P content from quiz spec
  createFromQuiz: (quizSpec: H5PQuizSpec, assignTo?: number[], points?: number) =>
    api.post<{ id: number; h5pContentId: string; title: string; assignedCount: number }>(
      '/h5p/content/from-quiz',
      { quizSpec, assignTo, points }
    ),

  // Generate H5P quiz using AI
  generateWithAI: (data: {
    title?: string;
    theme: string;
    age?: number;
    questionCount?: number;
    quizType?: 'mixed' | 'mcq_only' | 'true_false_only' | 'fill_blank';
    assignTo?: number[];
    points?: number;
    provider?: 'auto' | 'ollama' | 'gemini' | 'grok' | 'openai';
    includeImages?: boolean;
    customInstructions?: string;
    answerStyle?: 'default' | 'abcd' | 'numbered';
  }) => api.post<{
    id: number;
    h5pContentId: string;
    title: string;
    questionCount: number;
    provider: string;
    assignedCount: number;
    imagesGenerated?: number;
  }>('/h5p/content/generate-ai', data),

  // Get player data for rendering H5P content
  getPlayerData: (id: number) => api.get<H5PPlayerData>(`/h5p/play/${id}`),

  // Submit xAPI event
  submitXAPI: (data: {
    attemptId: number;
    verb: string;
    objectId?: string;
    objectType?: string;
    result?: {
      score?: { raw: number; max: number };
      success?: boolean;
      completion?: boolean;
      duration?: string;
    };
    context?: any;
  }) => api.post<H5PXAPIResult>('/h5p/xapi', data),

  // Get attempts for a content
  getAttempts: (contentId: number) => api.get<H5PAttempt[]>(`/h5p/attempts/${contentId}`),

  // Delete H5P content
  deleteContent: (id: number) => api.delete(`/h5p/content/${id}`),

  // Assign content to children
  assignContent: (contentId: number, data: {
    childIds: number[];
    points?: number;
    dueDate?: string;
    isRequired?: boolean;
    maxAttempts?: number;
    passPercentage?: number;
  }) => api.post<{ assigned: number }>(`/h5p/content/${contentId}/assign`, data),

  // Get assignments for a content
  getAssignments: (contentId: number) => api.get<H5PAssignment[]>(`/h5p/content/${contentId}/assignments`),

  // Remove an assignment
  removeAssignment: (assignmentId: number) => api.delete(`/h5p/assignments/${assignmentId}`),

  // ==================== Library Management ====================

  // Get list of .h5p files in downloads folder
  getDownloads: () => api.get<{
    files: Array<{ filename: string; size: number; downloadedAt: string }>
  }>('/h5p/libraries/downloads'),

  // Install a specific .h5p file from downloads folder
  installFromDownloads: (filename: string) =>
    api.post<{
      success: boolean;
      message: string;
      installedContentTypes: string[];
      contentTypesCount: number;
    }>('/h5p/libraries/install-from-downloads', { filename }),

  // Install all .h5p files from downloads folder
  installAllDownloads: () =>
    api.post<{
      installed: string[];
      errors: Array<{ file: string; error: string }>;
      installedContentTypes: string[];
      contentTypesCount: number;
    }>('/h5p/libraries/install-all-downloads'),

  // Upload and install .h5p file
  uploadLibrary: (file: File) => {
    const formData = new FormData();
    formData.append('h5pFile', file);
    return api.post<{
      success: boolean;
      message: string;
      installedContentTypes: string[];
      contentTypesCount: number;
    }>('/h5p/libraries/upload', formData, {
      headers: { 'Content-Type': undefined }
    });
  },

  // ==================== H5P Hub (Online Installation) ====================

  // Get available content types from H5P Hub
  getHubContentTypes: () =>
    api.get<{
      contentTypes: Array<{
        id: string;
        machineName: string;
        title: string;
        summary: string;
        description: string;
        icon: string;
        categories: string[];
        isRecommended: boolean;
        installed: boolean;
        restricted: boolean;
      }>
    }>('/h5p/hub/content-types'),

  // Install a single library from H5P Hub
  installFromHub: (machineName: string) =>
    api.post<{
      success: boolean;
      message: string;
      installed: string[];
      installedContentTypes: string[];
      contentTypesCount: number;
    }>('/h5p/hub/install', { machineName }),

  // Install all essential libraries from H5P Hub
  installEssentialsFromHub: () =>
    api.post<{
      success: boolean;
      message: string;
      results: Array<{
        library: string;
        success: boolean;
        installed: string[];
        error?: string;
      }>;
      installedContentTypes: string[];
      contentTypesCount: number;
    }>('/h5p/hub/install-essentials'),

  // ==================== Content Import ====================

  // Import H5P content from .h5p file (both libraries AND content)
  importContent: (file: File) => {
    const formData = new FormData();
    formData.append('h5pFile', file);
    return api.post<{
      success: boolean;
      message: string;
      contentId: number | null;
      h5pContentId: string | null;
      title: string | null;
      installedLibraries: string[];
      installedContentTypes: string[];
      contentTypesCount: number;
    }>('/h5p/content/import', formData, {
      headers: { 'Content-Type': undefined }
    });
  },

  // ==================== Diagnostics ====================

  // Run H5P diagnostic check
  runDiagnostic: () =>
    api.get<{
      healthy: boolean;
      issues: string[];
      warnings: string[];
      libraries: {
        total: number;
        runnable: number;
        quizReady: boolean;
        missingForQuiz: string[];
        details: Array<{
          name: string;
          version: string;
          isRunnable: boolean;
          isRequiredForQuiz: boolean;
        }>;
      };
      directories: {
        exists: Record<string, boolean>;
        fileCounts: Record<string, number>;
      };
      database: {
        content: { total_content: number; ai_generated: number; imported: number };
        assignments: { total: number };
        attempts: { total_attempts: number; passed_attempts: number; completed_attempts: number };
      };
      paths: Record<string, string>;
    }>('/h5p/diagnostic'),

  // ==================== AI Providers ====================

  // Get available AI providers for quiz generation
  getAIProviders: () =>
    api.get<{
      providers: Array<{ id: string; name: string; available: boolean; model?: string }>;
      defaultProvider: string;
      hasAnyProvider: boolean;
    }>('/h5p/ai-providers')
};

export default api;
