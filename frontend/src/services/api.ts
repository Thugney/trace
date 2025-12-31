import axios from 'axios';
import type {
  Profile,
  ProfileStats,
  FoodItem,
  MealLog,
  NutritionSummary,
  MealPlan,
  DietGoal,
  Task,
  Progress,
  Reward,
  AIConversation,
  Note,
  MonthlyGoal
} from '../types';
import type {
  SchoolClass,
  SchoolEnrollment,
  SchoolAssignment,
  SchoolSubmission,
  SchoolFeedback,
  StudentProgress
} from '../types/school';

// Use relative path for production (nginx proxy) or explicit URL for development
const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_URL ? `${API_URL}/api` : '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Profiles
export const profilesAPI = {
  getAll: () => api.get<Profile[]>('/profiles'),
  getOne: (id: number) => api.get<Profile>(`/profiles/${id}`),
  create: (data: Partial<Profile>) => api.post<Profile>('/profiles', data),
  update: (id: number, data: Partial<Profile>) => api.put<Profile>(`/profiles/${id}`, data),
  delete: (id: number) => api.delete(`/profiles/${id}`),
  getStats: (id: number) => api.get<ProfileStats>(`/profiles/${id}/stats`),
  verifyPIN: (id: number, pin: string) => api.post<{ verified: boolean }>(`/profiles/${id}/verify-pin`, { pin }),
  setPIN: (id: number, pin: string, currentPin?: string) => api.post<{ message: string }>(`/profiles/${id}/set-pin`, { pin, currentPin })
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
  claimReward: (id: number) => api.post<Reward>(`/tasks/rewards/${id}/claim`)
};

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
  updateSettings: (profileId: number, settings: any) => api.put(`/ai/settings/${profileId}`, settings)
};

// Settings
export const settingsAPI = {
  getAll: () => api.get<Record<string, any>>('/settings'),
  getOne: (key: string) => api.get<{ key: string; value: string }>(`/settings/${key}`),
  set: (key: string, value: string) => api.post(`/settings/${key}`, { value }),
  verifyPIN: (pin: string) => api.post<{ verified: boolean }>('/settings/verify-pin', { pin }),
  setPIN: (pin: string, current_pin?: string) =>
    api.post<{ message: string }>('/settings/set-pin', { pin, current_pin })
};

// Notes
export const notesAPI = {
  getByProfile: (profileId: number) => api.get<Note[]>(`/notes/${profileId}`),
  getOne: (id: number) => api.get<Note>(`/notes/note/${id}`),
  create: (data: Partial<Note>) => api.post<Note>('/notes', data),
  update: (id: number, data: Partial<Note>) => api.put<Note>(`/notes/${id}`, data),
  delete: (id: number) => api.delete(`/notes/${id}`)
};

// Monthly Goals
export const goalsAPI = {
  getByProfile: (profileId: number, month?: string) =>
    api.get<MonthlyGoal[]>(`/goals/${profileId}`, { params: { month } }),
  getCurrent: (profileId: number) => api.get<MonthlyGoal | null>(`/goals/${profileId}/current`),
  create: (data: Partial<MonthlyGoal>) => api.post<MonthlyGoal>('/goals', data),
  update: (id: number, data: Partial<MonthlyGoal>) => api.put<MonthlyGoal>(`/goals/${id}`, data),
  delete: (id: number) => api.delete(`/goals/${id}`),
  awardBonusPoints: (profileId: number, points: number, stars: number, reason: string) =>
    api.post<{ message: string; progress: Progress }>(`/goals/${profileId}/bonus-points`, {
      points,
      stars,
      reason
    })
};

// School (Tigrinya Church School)
export const schoolAPI = {
  // Classes
  getClasses: () => api.get<SchoolClass[]>('/school/classes'),
  getClassStudents: (classId: number) =>
    api.get<(SchoolEnrollment & { student_name: string; age: number })[]>(`/school/classes/${classId}/students`),

  // Enrollments
  enrollStudent: (student_id: number, class_id: number) =>
    api.post<SchoolEnrollment>('/school/enrollments', { student_id, class_id }),
  getStudentEnrollments: (studentId: number) =>
    api.get<(SchoolEnrollment & { class_name: string })[]>(`/school/students/${studentId}/enrollments`),

  // Assignments
  createAssignment: (data: {
    class_id: number;
    teacher_id: number;
    title: string;
    description?: string;
    type: 'homework' | 'psalm' | 'alphabet' | 'video' | 'other';
    youtube_link?: string;
    attachment_url?: string;
    due_date?: string;
  }) => api.post<SchoolAssignment>('/school/assignments', data),
  getClassAssignments: (classId: number) =>
    api.get<SchoolAssignment[]>(`/school/classes/${classId}/assignments`),
  getStudentAssignments: (studentId: number) =>
    api.get<(SchoolAssignment & { class_name: string; has_submitted: boolean; submission_status?: string })[]>(
      `/school/students/${studentId}/assignments`
    ),
  updateAssignment: (id: number, data: Partial<SchoolAssignment>) =>
    api.put<SchoolAssignment>(`/school/assignments/${id}`, data),
  deleteAssignment: (id: number) => api.delete(`/school/assignments/${id}`),

  // Submissions
  submitWork: (assignment_id: number, student_id: number, notes?: string) =>
    api.post<SchoolSubmission>('/school/submissions', { assignment_id, student_id, notes }),
  getAssignmentSubmissions: (assignmentId: number) =>
    api.get<(SchoolSubmission & { student_name: string; age: number })[]>(
      `/school/assignments/${assignmentId}/submissions`
    ),

  // Feedback
  addFeedback: (submission_id: number, teacher_id: number, comment: string, rating?: string) =>
    api.post<SchoolFeedback>('/school/feedback', { submission_id, teacher_id, comment, rating }),
  getSubmissionFeedback: (submissionId: number) =>
    api.get<(SchoolFeedback & { teacher_name: string })[]>(`/school/submissions/${submissionId}/feedback`),

  // Progress
  getStudentProgress: (studentId: number) =>
    api.get<StudentProgress>(`/school/students/${studentId}/progress`),
  getAllStudentsProgress: () =>
    api.get<StudentProgress[]>('/school/students/all/progress')
};

export default api;
