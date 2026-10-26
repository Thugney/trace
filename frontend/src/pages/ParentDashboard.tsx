import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { useToast } from '../components/Toast';
import { profilesAPI, aiGamificationAPI, gamificationAPI, tasksAPI, AISuggestion } from '../services/api';
import { Profile, Task } from '../types';
import {
  Baby, CheckCircle, AlertCircle, Sparkles, ThumbsUp, ThumbsDown,
  Brain, Target, Zap, RefreshCw, Trophy, BookOpen, Timer, TrendingUp,
  Flame, Calendar, Star, ChevronRight, AlertTriangle, CalendarClock,
  Users, ListTodo, Gift
} from 'lucide-react';
import Avatar from '../components/Avatar';
import RewardManagement from '../components/RewardManagement';
import ChildInsights from '../components/ChildInsights';

// Extended child progress data type
interface ChildProgress {
  id: number;
  name: string;
  avatar: string;
  age: number;
  stats: {
    tasks: { total_tasks: number; completed_tasks: number; overdue_tasks: number };
    progress: { total_points: number; total_stars: number; level: number };
  };
  streaks: { tasks: { current: number; longest: number }; water: { current: number; longest: number } };
  completionRate: number;
  weeklyActivity: { tasksCompleted: number; pointsEarned: number };
  recentActivity: string;
  achievements: number;
}

// Task with child info
interface TaskWithChild extends Task {
  childName: string;
  childAvatar: string;
}

// Dashboard tabs
type DashboardTab = 'overview' | 'tasks' | 'challenges' | 'rewards';

export default function ParentDashboard() {
  const { currentProfile } = useProfile();
  const profileId = currentProfile?.id;
  const toast = useToast();
  const [children, setChildren] = useState<Profile[]>([]);
  const [childrenProgress, setChildrenProgress] = useState<ChildProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  // Task timeline data
  const [overdueTasks, setOverdueTasks] = useState<TaskWithChild[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<TaskWithChild[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // AI Suggestions
  const [aiSuggestions, setAiSuggestions] = useState<(AISuggestion & { child_name: string })[]>([]);
  const [, setLoadingAI] = useState(false);
  const [generatingForChild, setGeneratingForChild] = useState<number | null>(null);
  const [timerSettings, setTimerSettings] = useState<Record<number, { enabled: boolean; minutes: number }>>({});

  const loadTaskTimeline = useCallback(async (kids: Profile[]) => {
    if (kids.length === 0) return;

    setLoadingTasks(true);
    try {
      const now = new Date();
      const allOverdue: TaskWithChild[] = [];
      const allUpcoming: TaskWithChild[] = [];

      for (const child of kids) {
        const tasksRes = await tasksAPI.getByProfile(child.id, false); // Get incomplete tasks
        const tasks = tasksRes.data || [];

        for (const task of tasks) {
          const taskWithChild: TaskWithChild = {
            ...task,
            childName: child.name,
            childAvatar: child.avatar || ''
          };

          if (task.due_date) {
            const dueDate = new Date(task.due_date);
            if (dueDate < now) {
              allOverdue.push(taskWithChild);
            } else {
              // Upcoming = within next 7 days
              const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
              if (dueDate <= weekFromNow) {
                allUpcoming.push(taskWithChild);
              }
            }
          }
        }
      }

      // Sort by due date
      allOverdue.sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
      allUpcoming.sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());

      setOverdueTasks(allOverdue);
      setUpcomingTasks(allUpcoming.slice(0, 10)); // Limit to 10 upcoming
    } catch (error) {
      console.error('Failed to load task timeline:', error);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  const loadFamilyData = useCallback(async () => {
    if (!profileId) return;

    try {
      setLoading(true);
      const response = await profilesAPI.getAll();
      const allProfiles = response.data;

      const myKids = allProfiles.filter(
        (p: Profile) => p.type === 'child'
      );
      setChildren(myKids);

      // Load progress data for each child
      const progressPromises = myKids.map(async (child: Profile) => {
        try {
          const [statsRes, streaksRes, weeklyRes, achievementsRes] = await Promise.all([
            profilesAPI.getStats(child.id),
            gamificationAPI.getStreaks(child.id).catch(() => ({ data: [] })),
            gamificationAPI.getWeeklySummary(child.id).catch(() => ({ data: { summary: { tasksCompleted: 0, pointsEarned: 0 } } })),
            gamificationAPI.getProfileAchievements(child.id).catch(() => ({ data: { earned_count: 0 } }))
          ]);

          const stats = statsRes.data;
          const streaksData = streaksRes.data || [];
          const weeklyData = weeklyRes.data;
          const achievementsData = achievementsRes.data;

          const taskStreak = streaksData.find((s: any) => s.streak_type === 'tasks') || { current_streak: 0, longest_streak: 0 };
          const waterStreak = streaksData.find((s: any) => s.streak_type === 'water') || { current_streak: 0, longest_streak: 0 };

          const completionRate = stats?.tasks?.total_tasks > 0
            ? Math.round((stats.tasks.completed_tasks / stats.tasks.total_tasks) * 100)
            : 0;

          let recentActivity = 'inactive';
          const tasksThisWeek = weeklyData?.summary?.tasksCompleted || 0;
          if (tasksThisWeek > 0) {
            recentActivity = tasksThisWeek >= 5 ? 'today' : tasksThisWeek >= 2 ? 'this_week' : 'yesterday';
          }

          return {
            id: child.id,
            name: child.name,
            avatar: child.avatar || '',
            age: child.age || 0,
            stats: {
              tasks: stats?.tasks || { total_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
              progress: stats?.progress || { total_points: 0, total_stars: 0, level: 1 }
            },
            streaks: {
              tasks: { current: taskStreak.current_streak || 0, longest: taskStreak.longest_streak || 0 },
              water: { current: waterStreak.current_streak || 0, longest: waterStreak.longest_streak || 0 }
            },
            completionRate,
            weeklyActivity: {
              tasksCompleted: weeklyData?.summary?.tasksCompleted || 0,
              pointsEarned: weeklyData?.summary?.pointsEarned || 0
            },
            recentActivity,
            achievements: achievementsData?.earned_count || 0
          } as ChildProgress;
        } catch (err) {
          console.error(`Failed to load progress for child ${child.id}:`, err);
          return {
            id: child.id, name: child.name, avatar: child.avatar || '', age: child.age || 0,
            stats: { tasks: { total_tasks: 0, completed_tasks: 0, overdue_tasks: 0 }, progress: { total_points: 0, total_stars: 0, level: 1 } },
            streaks: { tasks: { current: 0, longest: 0 }, water: { current: 0, longest: 0 } },
            completionRate: 0, weeklyActivity: { tasksCompleted: 0, pointsEarned: 0 },
            recentActivity: 'inactive', achievements: 0
          } as ChildProgress;
        }
      });

      const progressData = await Promise.all(progressPromises);
      setChildrenProgress(progressData);

      // Load tasks for timeline
      await loadTaskTimeline(myKids);
    } catch (error) {
      console.error('Failed to load family data:', error);
    } finally {
      setLoading(false);
    }
  }, [loadTaskTimeline, profileId]);

  const loadAISuggestions = useCallback(async () => {
    if (!profileId) return;
    try {
      setLoadingAI(true);
      const response = await aiGamificationAPI.getPendingSuggestions(profileId);
      setAiSuggestions(response.data);
    } catch (error) {
      console.error('Failed to load AI suggestions:', error);
    } finally {
      setLoadingAI(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadFamilyData();
  }, [currentProfile, loadFamilyData]);

  useEffect(() => {
    if (currentProfile?.id) {
      loadAISuggestions();
    }
  }, [currentProfile?.id, loadAISuggestions]);

  const generateChallenges = async (childId: number) => {
    if (!currentProfile) return;
    try {
      setGeneratingForChild(childId);
      await aiGamificationAPI.generateChallenges(childId, 3);
      await loadAISuggestions();
      toast.success('AI challenges generated!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to generate challenges');
    } finally {
      setGeneratingForChild(null);
    }
  };

  const approveSuggestion = async (suggestion: AISuggestion) => {
    if (!currentProfile) return;
    try {
      const settings = timerSettings[suggestion.id];
      await aiGamificationAPI.approveSuggestion(suggestion.id, currentProfile.id, {
        requires_timer: settings?.enabled ?? false,
        timer_duration: settings?.enabled ? Math.max(1, Math.round(settings?.minutes ?? 5)) * 60 : undefined
      });
      setAiSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
      toast.success(`Challenge "${suggestion.title}" approved!`);
    } catch (error) {
      toast.error('Failed to approve challenge');
    }
  };

  const rejectSuggestion = async (suggestion: AISuggestion) => {
    if (!currentProfile) return;
    try {
      await aiGamificationAPI.rejectSuggestion(suggestion.id, currentProfile.id, 'Parent rejected');
      setAiSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
      toast.info('Challenge rejected');
    } catch (error) {
      toast.error('Failed to reject challenge');
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const overdueDays = Math.abs(diffDays);
      return overdueDays === 1 ? '1 day overdue' : `${overdueDays} days overdue`;
    } else if (diffDays === 0) {
      return 'Due today';
    } else if (diffDays === 1) {
      return 'Due tomorrow';
    } else {
      return `Due in ${diffDays} days`;
    }
  };

  const updateTimerSetting = (suggestionId: number, updates: Partial<{ enabled: boolean; minutes: number }>) => {
    setTimerSettings(prev => ({
      ...prev,
      [suggestionId]: { ...(prev[suggestionId] || { enabled: false, minutes: 5 }), ...updates }
    }));
  };

  // Calculate totals
  const totalOverdue = childrenProgress.reduce((sum, c) => sum + c.stats.tasks.overdue_tasks, 0);
  const totalCompleted = childrenProgress.reduce((sum, c) => sum + c.stats.tasks.completed_tasks, 0);
  const totalTasks = childrenProgress.reduce((sum, c) => sum + c.stats.tasks.total_tasks, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {currentProfile?.name}!
        </h1>
        <p className="text-gray-500 text-sm mt-1">Here's what's happening with your family</p>
      </div>

      {/* Alert Banner - Show if there are overdue tasks */}
      {totalOverdue > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-red-800">
              {totalOverdue} task{totalOverdue > 1 ? 's' : ''} overdue
            </p>
            <p className="text-sm text-red-600">Some tasks need attention</p>
          </div>
          <button
            onClick={() => setActiveTab('tasks')}
            className="text-sm font-medium text-red-700 hover:text-red-800 flex items-center gap-1"
          >
            View Tasks <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{children.length}</p>
              <p className="text-xs text-gray-500">Children</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalCompleted}/{totalTasks}</p>
              <p className="text-xs text-gray-500">Tasks Done</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Star className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {childrenProgress.reduce((sum, c) => sum + c.stats.progress.total_stars, 0)}
              </p>
              <p className="text-xs text-gray-500">Total Stars</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Flame className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {Math.max(...childrenProgress.map(c => c.streaks.tasks.current), 0)}
              </p>
              <p className="text-xs text-gray-500">Best Streak</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl">
        {[
          { id: 'overview', label: 'Overview', icon: TrendingUp },
          { id: 'tasks', label: 'Tasks', icon: ListTodo, badge: totalOverdue > 0 ? totalOverdue : undefined },
          { id: 'challenges', label: 'Challenges', icon: Sparkles, badge: aiSuggestions.length > 0 ? aiSuggestions.length : undefined },
          { id: 'rewards', label: 'Rewards', icon: Gift },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as DashboardTab)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon size={18} />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.badge && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Children Progress Cards */}
          {children.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-gray-100">
              <Baby size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Children Yet</h3>
              <p className="text-gray-500 mb-4">Add your children's profiles to start tracking their progress</p>
              <Link to="/settings" className="btn btn-primary inline-flex items-center">
                <Baby className="mr-2" size={18} />
                Add Child
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {childrenProgress.map((child) => (
                <div key={child.id} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar avatar={child.avatar} size="lg" alt={child.name} />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{child.name}</h3>
                      <p className="text-sm text-gray-500">Level {child.stats.progress.level} • {child.age}y</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                      child.completionRate >= 80 ? 'bg-green-100 text-green-700' :
                      child.completionRate >= 50 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {child.completionRate}%
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Tasks: {child.stats.tasks.completed_tasks}/{child.stats.tasks.total_tasks}</span>
                      {child.stats.tasks.overdue_tasks > 0 && (
                        <span className="text-red-600 font-medium">{child.stats.tasks.overdue_tasks} overdue</span>
                      )}
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          child.completionRate >= 80 ? 'bg-green-500' :
                          child.completionRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${child.completionRate}%` }}
                      />
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Flame size={14} className="text-orange-500" />
                      <span>{child.streaks.tasks.current} day streak</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Star size={14} className="text-amber-500" />
                      <span>{child.stats.progress.total_stars} stars</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Trophy size={14} className="text-blue-500" />
                      <span>{child.achievements} badges</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Links */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link to="/tasks" className="bg-white rounded-xl p-4 border border-gray-100 hover:border-primary-300 hover:shadow-sm transition-all group">
              <CheckCircle className="w-6 h-6 text-primary-600 mb-2" />
              <p className="font-medium text-gray-900 group-hover:text-primary-600">Manage Tasks</p>
              <p className="text-xs text-gray-500">Create & assign</p>
            </Link>
            <Link to="/leaderboard" className="bg-white rounded-xl p-4 border border-gray-100 hover:border-amber-300 hover:shadow-sm transition-all group">
              <Trophy className="w-6 h-6 text-amber-600 mb-2" />
              <p className="font-medium text-gray-900 group-hover:text-amber-600">Leaderboard</p>
              <p className="text-xs text-gray-500">Family rankings</p>
            </Link>
            <Link to="/h5p" className="bg-white rounded-xl p-4 border border-gray-100 hover:border-purple-300 hover:shadow-sm transition-all group">
              <BookOpen className="w-6 h-6 text-purple-600 mb-2" />
              <p className="font-medium text-gray-900 group-hover:text-purple-600">Quizzes</p>
              <p className="text-xs text-gray-500">Create and manage H5P quizzes</p>
            </Link>
            <Link to="/settings" className="bg-white rounded-xl p-4 border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all group">
              <Users className="w-6 h-6 text-gray-600 mb-2" />
              <p className="font-medium text-gray-900">Family Settings</p>
              <p className="text-xs text-gray-500">Manage profiles</p>
            </Link>
          </div>

          {/* Child Insights (collapsed by default) */}
          {currentProfile && children.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <ChildInsights parentId={currentProfile.id} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="space-y-6">
          {/* Overdue Tasks */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <h3 className="font-semibold text-gray-900">Overdue Tasks</h3>
                {overdueTasks.length > 0 && (
                  <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full font-medium">
                    {overdueTasks.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => loadTaskTimeline(children)}
                disabled={loadingTasks}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <RefreshCw size={14} className={loadingTasks ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            {overdueTasks.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                <p className="text-gray-500">No overdue tasks! Great job!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {overdueTasks.map(task => (
                  <div key={task.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <Avatar avatar={task.childAvatar} size="sm" alt={task.childName} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 truncate">{task.title}</p>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{task.category}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm">
                          <span className="text-gray-500">{task.childName}</span>
                          <span className="text-red-600 font-medium">{formatDueDate(task.due_date!)}</span>
                        </div>
                      </div>
                      <Link
                        to="/tasks"
                        className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Tasks */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-blue-500" />
              <h3 className="font-semibold text-gray-900">Upcoming This Week</h3>
              {upcomingTasks.length > 0 && (
                <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full font-medium">
                  {upcomingTasks.length}
                </span>
              )}
            </div>

            {upcomingTasks.length === 0 ? (
              <div className="p-8 text-center">
                <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No upcoming tasks this week</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {upcomingTasks.map(task => (
                  <div key={task.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <Avatar avatar={task.childAvatar} size="sm" alt={task.childName} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 truncate">{task.title}</p>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{task.category}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm">
                          <span className="text-gray-500">{task.childName}</span>
                          <span className="text-blue-600">{formatDueDate(task.due_date!)}</span>
                        </div>
                      </div>
                      <span className="text-sm text-amber-600 font-medium">{task.points} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Link to full tasks page */}
          <div className="text-center">
            <Link to="/tasks" className="btn btn-primary inline-flex items-center gap-2">
              <ListTodo size={18} />
              Manage All Tasks
            </Link>
          </div>
        </div>
      )}

      {activeTab === 'challenges' && (
        <div className="space-y-6">
          {/* Generate Challenges */}
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-5 border border-purple-100">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <Brain className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-purple-900 mb-1">AI Challenges</h3>
                <p className="text-sm text-purple-700 mb-3">
                  Generate personalized challenges based on each child's patterns and progress.
                </p>
                <div className="flex flex-wrap gap-2">
                  {children.map(child => (
                    <button
                      key={child.id}
                      onClick={() => generateChallenges(child.id)}
                      disabled={generatingForChild === child.id}
                      className="btn btn-sm bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5"
                    >
                      {generatingForChild === child.id ? (
                        <><RefreshCw size={14} className="animate-spin" />Generating...</>
                      ) : (
                        <><Zap size={14} />Generate for {child.name}</>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Pending Suggestions */}
          {aiSuggestions.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <Target className="w-5 h-5 text-orange-500" />
                <h3 className="font-semibold text-gray-900">Pending Approval</h3>
                <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full font-medium">
                  {aiSuggestions.length}
                </span>
              </div>
              <div className="divide-y divide-gray-50">
                {aiSuggestions.map(suggestion => (
                  <div key={suggestion.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center flex-wrap gap-2 mb-2">
                          <span className="font-semibold text-gray-900">{suggestion.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getDifficultyColor(suggestion.difficulty)}`}>
                            {suggestion.difficulty}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                            {suggestion.points_reward} pts
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{suggestion.description}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>For: <strong>{suggestion.child_name}</strong></span>
                          <span>{suggestion.duration_days} days</span>
                        </div>

                        {/* Timer setting */}
                        <div className="mt-3 flex items-center gap-3">
                          <label className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300"
                              checked={timerSettings[suggestion.id]?.enabled || false}
                              onChange={(e) => updateTimerSetting(suggestion.id, { enabled: e.target.checked })}
                            />
                            <Timer size={14} />
                            <span>Require timer</span>
                          </label>
                          {timerSettings[suggestion.id]?.enabled && (
                            <input
                              type="number"
                              min={1}
                              max={120}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                              value={timerSettings[suggestion.id]?.minutes ?? 5}
                              onChange={(e) => updateTimerSetting(suggestion.id, { minutes: Number(e.target.value) || 1 })}
                            />
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => approveSuggestion(suggestion)}
                          className="btn btn-sm bg-green-600 hover:bg-green-700 text-white"
                        >
                          <ThumbsUp size={14} />
                        </button>
                        <button
                          onClick={() => rejectSuggestion(suggestion)}
                          className="btn btn-sm bg-gray-100 hover:bg-gray-200 text-gray-600"
                        >
                          <ThumbsDown size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <Sparkles className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 mb-1">No pending challenges</p>
              <p className="text-sm text-gray-400">Generate new challenges for your children above</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'rewards' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {currentProfile && <RewardManagement parentId={currentProfile.id} />}
        </div>
      )}
    </div>
  );
}
