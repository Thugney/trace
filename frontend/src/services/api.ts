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
  MonthlyGoal,
  Message,
  JourneyData,
  Notification
} from '../types';
import type {
  SchoolClass,
  SchoolEnrollment,
  SchoolAssignment,
  SchoolSubmission,
  SchoolFeedback,
  StudentProgress,
  QuizQuestion,
  QuizAnswer,
  QuizSubmission,
  QuizResult
} from '../types/school';

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
  getOne: (id: number) => api.get<Profile>(`/profiles/${id}`),
  create: (data: Partial<Profile>) => api.post<Profile>('/profiles', data),
  update: (id: number, data: Partial<Profile>) => api.put<Profile>(`/profiles/${id}`, data),
  delete: (id: number) => api.delete(`/profiles/${id}`),
  getStats: (id: number) => api.get<ProfileStats>(`/profiles/${id}/stats`),
  getHistory: (id: number, period: string) => api.get<JourneyData>(`/profiles/${id}/history`, { params: { period } }),
  verifyPIN: (id: number, pin: string) => api.post<{ verified: boolean }>(`/profiles/${id}/verify-pin`, { pin }),
  setPIN: (id: number, pin: string, currentPin?: string) => api.post<{ message: string }>(`/profiles/${id}/set-pin`, { pin, currentPin }),
  resetPassword: (profileId: number, newPin: string, parentId: number) => api.post<{ message: string }>(`/profiles/${profileId}/reset-password`, { newPin, parentId }),
  uploadAvatar: (id: number, file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.post<{ success: boolean; avatar: string; message: string }>(`/profiles/${id}/avatar`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
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
    api.post<any[]>(`/tasks/${taskId}/subtasks/bulk`, { subtasks })
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
    )
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
  awardBonusPoints: (profileId: number, points: number, stars: number, reason: string) =>
    api.post<{ message: string; progress: Progress }>(`/goals/${profileId}/bonus-points`, {
      points,
      stars,
      reason
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
    api.delete(`/goals/${goalId}/milestones/${milestoneId}`)
};

// School (Tigrinya Church School)
export const schoolAPI = {
  // Classes
  getClasses: () => api.get<SchoolClass[]>('/school/classes'),
  getClassStudents: (classId: number) =>
    api.get<(SchoolEnrollment & { student_name: string; age: number })[]>(`/school/classes/${classId}/students`),

  // Enrollments
  getParentChildren: (parentId: number) =>
    api.get<any[]>(`/school/parents/${parentId}/children`),
  enrollStudent: (student_id: number, class_id: number, parent_id?: number) =>
    api.post<SchoolEnrollment>('/school/enrollments', { student_id, class_id, parent_id }),
  unenrollStudent: (studentId: number, classId: number) =>
    api.delete(`/school/enrollments/${studentId}/${classId}`),
  getStudentEnrollments: (studentId: number) =>
    api.get<(SchoolEnrollment & { class_name: string })[]>(`/school/students/${studentId}/enrollments`),

  // Assignments
  createAssignment: (data: {
    class_id: number;
    teacher_id: number;
    title: string;
    description?: string;
    type: 'homework' | 'psalm' | 'alphabet' | 'video' | 'quiz' | 'other';
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
    api.get<StudentProgress[]>('/school/students/all/progress'),

  // Quiz
  createQuiz: (assignmentId: number, questions: Omit<QuizQuestion, 'id' | 'assignment_id' | 'created_at'>[]) =>
    api.post(`/school/assignments/${assignmentId}/quiz`, { questions }),

  getQuiz: (assignmentId: number) =>
    api.get<QuizQuestion[]>(`/school/assignments/${assignmentId}/quiz`),

  submitQuiz: (submission: QuizSubmission) =>
    api.post<QuizAnswer[]>(`/school/quiz/submit`, submission),

  getQuizResults: (assignmentId: number, studentId: number) =>
    api.get<QuizResult>(`/school/assignments/${assignmentId}/quiz/results/${studentId}`),

  getAllQuizResults: (studentId: number) =>
    api.get<any[]>(`/school/students/${studentId}/quiz-results`),

  // Gamification - Achievements
  getAchievements: () =>
    api.get<any[]>('/school/achievements'),
  getStudentAchievements: (studentId: number) =>
    api.get<any[]>(`/school/students/${studentId}/achievements`),
  awardAchievement: (student_id: number, achievement_id: number, notes?: string) =>
    api.post('/school/achievements/award', { student_id, achievement_id, notes }),

  // Gamification - Points
  getStudentPoints: (studentId: number) =>
    api.get<{ points: number; level: number; level_name: string; points_to_next_level: number }>(
      `/school/students/${studentId}/points`
    ),
  addStudentPoints: (studentId: number, points: number, reason?: string) =>
    api.post(`/school/students/${studentId}/points`, { points, reason }),

  // Leaderboard
  getLeaderboard: (limit?: number) =>
    api.get<any[]>(`/school/leaderboard${limit ? `?limit=${limit}` : ''}`),

  // Teacher class management
  getTeacherClass: () =>
    api.get<{ class_id: number; class_name: string; description: string; age_min: number; age_max: number }>('/school/teacher/my-class'),
  getTeacherStudents: () =>
    api.get<any[]>('/school/teacher/students'),

  // Admin: Teacher assignments
  getTeachers: () =>
    api.get<any[]>('/school/teachers'),
  assignTeacherToClass: (teacherId: number, classId: number | null) =>
    api.post(`/school/teachers/${teacherId}/assign-class`, { class_id: classId })
};

// Messages API
export const messagesAPI = {
  sendMessage: (sender_id: number, recipient_id: number, message: string, subject?: string) =>
    api.post<Message>('/messages', { sender_id, recipient_id, message, subject }),
  getInbox: (userId: number, unreadOnly = false) =>
    api.get<Message[]>(`/messages/inbox/${userId}${unreadOnly ? '?unread_only=true' : ''}`),
  getSent: (userId: number) =>
    api.get<Message[]>(`/messages/sent/${userId}`),
  markAsRead: (messageId: number) =>
    api.put<Message>(`/messages/${messageId}/read`, {}),
  getUnreadCount: (userId: number) =>
    api.get<{ count: number }>(`/messages/unread-count/${userId}`),
  getConversation: (userId1: number, userId2: number) =>
    api.get<Message[]>(`/messages/conversation/${userId1}/${userId2}`),
  deleteMessage: (messageId: number) =>
    api.delete(`/messages/${messageId}`),
  getParents: () =>
    api.get<Profile[]>('/messages/parents')
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
    }[]>(`/gamification/leaderboard/${parentId}`, { params: { period } })
};

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

export default api;
