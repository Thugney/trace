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
  AIConversation
} from '../types';

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
    api.post<{ response: string; profile: { id: number; name: string; type: string } }>(
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
    api.delete(`/ai/conversations/${profileId}`, { params: { context } })
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

export default api;
