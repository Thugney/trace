import { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { useAge } from '../context/AgeContext';
import { tasksAPI, goalsAPI } from '../services/api';
import { Task, MonthlyGoal } from '../types';
import { Plus, Check, Star, Trophy, Gift, Target, Award, Edit2, Trash2, Repeat, Clock, AlertTriangle, Calendar, Camera, Timer, Bell, CheckCircle } from 'lucide-react';
import clsx from 'clsx';
import PhotoProof from '../components/PhotoProof';
import Avatar from '../components/Avatar';
import TaskTimerCard from '../components/TaskTimerCard';
import { extractDateOnly, formatDateOnlyForDisplay, getDateOnlyRelation, getLocalDateKey, parseDateOnly } from '../utils/date-only';
import {
  ActiveMissionCard,
  TodaysMissions,
  CompletedToday,
  OverdueMissions,
  ComingUpMissions,
  MissionCompleteModal
} from '../components/MissionControl';

// Category icons map
const categoryIcons: Record<string, string> = {
  'read-book': '📚',
  'tigrinya': '✍️',
  'clean-room': '🛏️',
  'clean-kitchen': '🍽️',
  'school': '🎒',
  'homework': '📝',
  'exercise': '🏃',
  'chore': '🧹',
  'other': '📌'
};

// Categories that require a timer
const TIMED_CATEGORIES = ['read-book', 'tigrinya', 'clean-room', 'clean-kitchen', 'school'];

// Priority colors
const priorityColors: Record<string, string> = {
  high: 'text-red-600 bg-red-100',
  medium: 'text-yellow-600 bg-yellow-100',
  low: 'text-green-600 bg-green-100'
};

// Goal type labels for kid-friendly display
const goalTypeLabels: Record<string, string> = {
  'kroner': '💰 Money',
  'money': '💰 Money',
  'movie-night': '🎬 Movie Night',
  'treat': '🍭 Special Treat',
  'toy': '🎁 Toy or Gift',
  'game': '🎮 Game Time',
  'outing': '🚗 Fun Outing',
  'activity': '🎪 Fun Activity',
  'other': '🎯 Reward'
};

const getGoalTypeLabel = (type: string | undefined): string => {
  if (!type) return '🎯 Reward';
  return goalTypeLabels[type.toLowerCase()] || `🎯 ${type}`;
};

const GOAL_TYPE_OPTIONS = [
  { value: 'kroner', label: '💰 Money (Kroner)' },
  { value: 'movie-night', label: '🎬 Movie Night' },
  { value: 'treat', label: '🍭 Special Treat' },
  { value: 'toy', label: '🎁 Toy or Gift' },
  { value: 'game', label: '🎮 Game Time' },
  { value: 'outing', label: '🚗 Fun Outing' },
  { value: 'other', label: '🎯 Other Reward' }
];

const GOAL_CATEGORY_OPTIONS = [
  { value: 'monthly', label: '📅 Monthly Goal' },
  { value: 'long_term', label: '🚀 Long-Term Goal' },
  { value: 'screen_time', label: '📱 Screen Time' },
  { value: 'treats', label: '🍭 Treats' },
  { value: 'toys', label: '🧸 Toys & Games' },
  { value: 'activities', label: '🎪 Activities' },
  { value: 'family_outing', label: '🚌 Family Outing' },
  { value: 'money', label: '💰 Money' },
  { value: 'other', label: '🎯 Other' }
];

const isPresetGoalType = (value?: string) =>
  !!value && GOAL_TYPE_OPTIONS.some((option) => option.value === value);

const isPresetGoalCategory = (value?: string) =>
  !!value && GOAL_CATEGORY_OPTIONS.some((option) => option.value === value);

// Page title based on age group
const getPageTitle = (ageGroup: string, isParent: boolean): { title: string; emoji: string; subtitle: string } => {
  if (isParent) {
    return { title: 'Task Management', emoji: '📋', subtitle: 'Manage tasks for your kids' };
  }
  switch (ageGroup) {
    case 'young':
      return { title: 'My Jobs', emoji: '🦸', subtitle: 'Do your jobs to earn stars!' };
    case 'middle':
      return { title: 'Missions', emoji: '🦹', subtitle: 'Complete missions to earn points!' };
    default:
      return { title: 'Tasks', emoji: '📝', subtitle: 'Complete tasks to earn points and stars' };
  }
};

export default function TasksManager() {
  const { currentProfile, isParent, profiles } = useProfile();
  const { settings } = useAge();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [progress, setProgress] = useState<any>(null);
  const [monthlyGoal, setMonthlyGoal] = useState<MonthlyGoal | null>(null);
  const [allGoals, setAllGoals] = useState<MonthlyGoal[]>([]);
  const [pendingGoals, setPendingGoals] = useState<MonthlyGoal[]>([]);
  const [pendingTaskApprovals, setPendingTaskApprovals] = useState<Task[]>([]);
  const [pendingPhotoProofs, setPendingPhotoProofs] = useState<Task[]>([]);
  const [selectedChild, setSelectedChild] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showBonusPoints, setShowBonusPoints] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingGoal, setEditingGoal] = useState<MonthlyGoal | null>(null);
  const [showPhotoProof, setShowPhotoProof] = useState(false);
  const [photoProofTask, setPhotoProofTask] = useState<Task | null>(null);

  // Mission Control state for kids
  const [activeMission, setActiveMission] = useState<Task | null>(null);
  const [showMissionComplete, setShowMissionComplete] = useState(false);
  const [missionCompleteData, setMissionCompleteData] = useState<{
    task: Task;
    pointsEarned: number;
    starsEarned: number;
    timeSpent: number;
  } | null>(null);

  // Get page title based on age
  const pageInfo = getPageTitle(settings.ageGroup, isParent);

  const displayProfileId = isParent ? selectedChild || currentProfile?.id : currentProfile?.id;
  const children = profiles.filter(p => p.type === 'child');
  const allIncompleteTasks = tasks.filter(t => !t.completed);
  const incompleteTasks = isParent
    ? allIncompleteTasks
    : allIncompleteTasks.filter(t => getDateOnlyRelation(t.due_date) !== 'future');
  const futureTasks = isParent
    ? []
    : allIncompleteTasks.filter(t => getDateOnlyRelation(t.due_date) === 'future');
  const completedTasks = tasks.filter(t => t.completed);

  useEffect(() => {
    if (displayProfileId) {
      loadTasks();
      loadProgress();
      loadMonthlyGoal();
      loadAllGoals();
    }
  }, [displayProfileId]);

  useEffect(() => {
    if (isParent && currentProfile) {
      loadPendingGoals();
      loadPendingTaskApprovals();
      loadPendingPhotoProofs();
    }
  }, [isParent, currentProfile]);

  const loadTasks = async () => {
    if (!displayProfileId) return;

    try {
      setLoading(true);
      const response = await tasksAPI.getByProfile(displayProfileId);
      // Show all tasks to everyone - unapproved ones will have a "Pending Approval" badge
      setTasks(response.data);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = async () => {
    if (!displayProfileId) return;

    try {
      const response = await tasksAPI.getProgress(displayProfileId);
      setProgress(response.data);
    } catch (error) {
      console.error('Failed to load progress:', error);
    }
  };

  const loadMonthlyGoal = async () => {
    if (!displayProfileId) return;

    try {
      const response = await goalsAPI.getCurrent(displayProfileId);
      // Show all goals - pending ones will have a badge
      setMonthlyGoal(response.data);
    } catch (error) {
      console.error('Failed to load monthly goal:', error);
    }
  };

  const loadAllGoals = async () => {
    if (!displayProfileId) return;
    try {
      const response = await goalsAPI.getByProfile(displayProfileId);
      // Show all goals - pending ones will have a badge
      setAllGoals(response.data);
    } catch (error) {
      console.error('Failed to load all goals:', error);
    }
  };

  const loadPendingGoals = async () => {
    if (!currentProfile?.id) return;

    try {
      const response = await goalsAPI.getPending(currentProfile.id);
      setPendingGoals(response.data);
    } catch (error) {
      console.error('Failed to load pending goals:', error);
    }
  };

  const loadPendingTaskApprovals = async () => {
    if (!currentProfile?.id) return;

    try {
      const response = await tasksAPI.getPending(currentProfile.id);
      setPendingTaskApprovals(response.data);
    } catch (error) {
      console.error('Failed to load pending task approvals:', error);
    }
  };

  const loadPendingPhotoProofs = async () => {
    if (!currentProfile?.id) return;

    try {
      const response = await tasksAPI.getPendingProofs(currentProfile.id);
      setPendingPhotoProofs(response.data);
    } catch (error) {
      console.error('Failed to load pending photo proofs:', error);
    }
  };

  const handleVerifyProof = async (taskId: number, approved: boolean) => {
    if (!currentProfile?.id) return;

    try {
      const response = await tasksAPI.verifyProof(taskId, approved, currentProfile.id);
      await loadPendingPhotoProofs();
      await loadTasks();

      if (approved) {
        const lateNotice = response.data.latePenaltyApplied ? ' Late task, so points were reduced.' : '';
        alert(`✅ Photo approved! Task completed. ${response.data.pointsEarned} points awarded.${lateNotice}`);
      } else {
        alert('❌ Photo rejected. Child can upload a new photo.');
      }
    } catch (error: any) {
      console.error('Failed to verify proof:', error);
      alert(error.response?.data?.error || 'Failed to verify photo');
    }
  };

  const handleCompleteTask = async (taskId: number, task?: Task) => {
    // Check if task requires photo proof
    const taskData = task || tasks.find(t => t.id === taskId);
    const proofRequired = taskData?.proof_required === true || taskData?.proof_required === 1;
    const hasProof = !!taskData?.proof_photo_url;

    // If photo proof is required and not yet uploaded, show the photo modal
    if (proofRequired && !hasProof) {
      setPhotoProofTask(taskData || null);
      setShowPhotoProof(true);
      return;
    }

    try {
      const response = await tasksAPI.complete(taskId);
      await loadTasks();
      await loadProgress();

      // Show celebration for kids
      if (!isParent) {
        const lateNotice = response.data.latePenaltyApplied ? ' Late task, so points were reduced.' : '';
        alert(`🎉 Great job! You earned ${response.data.pointsEarned} points and ${response.data.starsEarned} stars!${lateNotice}`);
      }
    } catch (error: any) {
      console.error('Failed to complete task:', error);
      alert(error.response?.data?.error || 'Failed to complete task');
    }
  };

  // Handle photo proof uploaded - DON'T auto-complete, wait for parent verification
  const handlePhotoProofUploaded = async () => {
    if (!photoProofTask) return;

    setShowPhotoProof(false);
    await loadTasks();

    // Show message that parent needs to verify
    if (!isParent) {
      alert('📸 Photo uploaded! Your parent will review and approve it.');
    }

    setPhotoProofTask(null);
  };

  const handleAddTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const category = formData.get('category') as string;
    const isRecurring = formData.get('is_recurring') === 'on';
    const estimatedMinutes = formData.get('estimated_minutes') as string;
    const scheduledTime = formData.get('scheduled_time') as string;

    try {
      await tasksAPI.create({
        profile_id: displayProfileId!,
        title: formData.get('title') as string,
        description: formData.get('description') as string,
        category: category as any,
        difficulty: formData.get('difficulty') as any,
        earns_points: true,
        created_by: currentProfile?.id,
        priority: (formData.get('priority') as 'high' | 'medium' | 'low') || 'medium',
        is_recurring: isRecurring,
        recurrence_pattern: isRecurring ? (formData.get('recurrence_pattern') as 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly') : undefined,
        due_date: (formData.get('due_date') as string) || getLocalDateKey(),
        estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : undefined,
        scheduled_time: scheduledTime || undefined,
        // Timer is automatically set by backend based on category
      });

      await loadTasks();
      if (isParent) {
        await loadPendingTaskApprovals();
      }
      setShowAddTask(false);

      // Show message to kids that their task needs parent approval
      if (!isParent) {
        alert('✅ Task created! It will appear once your parent approves it.');
      }
    } catch (error) {
      console.error('Failed to create task:', error);
      alert('Failed to create task');
    }
  };

  const handleAddGoal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const customType = (formData.get('custom_type') as string | null)?.trim();
    const customCategory = (formData.get('custom_category') as string | null)?.trim();
    const goalType = customType || (formData.get('type') as string) || 'kroner';
    const goalCategory = customCategory || (formData.get('category') as string) || 'monthly';

    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      await goalsAPI.create({
        profile_id: displayProfileId!,
        month: currentMonth,
        goal_description: (formData.get('description') as string).trim(),
        goal_points: parseInt(formData.get('points') as string, 10),
        goal_type: goalType,
        goal_category: goalCategory,
        created_by: currentProfile?.id
      });

      await loadMonthlyGoal();
      await loadAllGoals();
      if (isParent) {
        await loadPendingGoals();
      }
      setShowAddGoal(false);

      // Show message to kids that their goal needs parent approval
      if (!isParent) {
        alert('✅ Goal created! It will appear once your parent approves it.');
      }
    } catch (error) {
      console.error('Failed to create goal:', error);
      alert('Failed to create goal');
    }
  };

  const handleAwardBonus = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      await goalsAPI.awardBonusPoints(
        displayProfileId!,
        parseInt(formData.get('points') as string, 10) || 0,
        parseInt(formData.get('stars') as string, 10) || 0,
        formData.get('reason') as string,
        currentProfile?.id // Pass the parent's ID who is awarding
      );

      await loadProgress();
      setShowBonusPoints(false);
      alert('Bonus points awarded! 🎉 The child will see a surprise notification!');
    } catch (error) {
      console.error('Failed to award bonus:', error);
      alert('Failed to award bonus points');
    }
  };

  const handleMarkGoalAchieved = async () => {
    if (!monthlyGoal) return;

    try {
      await goalsAPI.update(monthlyGoal.id, { achieved: true, reward_given: true });
      await loadMonthlyGoal();
      alert('Goal marked as achieved! 🎉');
    } catch (error) {
      console.error('Failed to update goal:', error);
      alert('Failed to update goal');
    }
  };

  const handleApproveGoal = async (goalId: number) => {
    if (!currentProfile?.id) return;

    try {
      await goalsAPI.approve(goalId, currentProfile.id);
      await loadPendingGoals();
      await loadAllGoals();
      await loadMonthlyGoal();
      alert('✅ Goal approved!');
    } catch (error) {
      console.error('Failed to approve goal:', error);
      alert('Failed to approve goal');
    }
  };

  const handleRejectGoal = async (goalId: number) => {
    if (!currentProfile?.id) return;

    if (!confirm('Are you sure you want to reject this goal?')) return;

    try {
      await goalsAPI.reject(goalId, currentProfile.id);
      await loadPendingGoals();
      alert('Goal rejected');
    } catch (error) {
      console.error('Failed to reject goal:', error);
      alert('Failed to reject goal');
    }
  };

  const handleApproveTask = async (taskId: number) => {
    if (!currentProfile?.id) return;

    try {
      await tasksAPI.approve(taskId, currentProfile.id);
      await loadPendingTaskApprovals();
      await loadTasks();
      alert('✅ Task approved!');
    } catch (error) {
      console.error('Failed to approve task:', error);
      alert('Failed to approve task');
    }
  };

  const handleRejectTask = async (taskId: number) => {
    if (!currentProfile?.id) return;

    if (!confirm('Are you sure you want to reject this task?')) return;

    try {
      await tasksAPI.reject(taskId, currentProfile.id);
      await loadPendingTaskApprovals();
      alert('Task rejected');
    } catch (error) {
      console.error('Failed to reject task:', error);
      alert('Failed to reject task');
    }
  };

  const handleEditTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTask) return;

    const formData = new FormData(e.currentTarget);
    const category = formData.get('category') as string;

    try {
      await tasksAPI.update(editingTask.id, {
        title: formData.get('title') as string,
        description: formData.get('description') as string,
        category: category as any,
        difficulty: formData.get('difficulty') as any,
        earns_points: true,
        due_date: (formData.get('due_date') as string) || getLocalDateKey()
      });

      await loadTasks();
      setEditingTask(null);
      alert('✅ Task updated!');
    } catch (error) {
      console.error('Failed to update task:', error);
      alert('Failed to update task');
    }
  };

  const handleEditGoal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingGoal) return;

    const formData = new FormData(e.currentTarget);
    const customType = (formData.get('custom_type') as string | null)?.trim();
    const customCategory = (formData.get('custom_category') as string | null)?.trim();
    const goalType = customType || (formData.get('type') as string) || 'kroner';
    const goalCategory = customCategory || (formData.get('category') as string) || 'monthly';

    try {
      await goalsAPI.update(editingGoal.id, {
        goal_description: (formData.get('description') as string).trim(),
        goal_points: parseInt(formData.get('points') as string, 10),
        goal_type: goalType,
        goal_category: goalCategory
      });

      await loadMonthlyGoal();
      await loadAllGoals();
      setEditingGoal(null);
      alert('✅ Goal updated!');
    } catch (error) {
      console.error('Failed to update goal:', error);
      alert('Failed to update goal');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      await tasksAPI.delete(taskId);
      await loadTasks();
      alert('Task deleted');
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert('Failed to delete task');
    }
  };

  const handleDeleteGoal = async (goalId: number) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;

    try {
      await goalsAPI.delete(goalId);
      await loadMonthlyGoal();
      await loadAllGoals();
      alert('Goal deleted');
    } catch (error) {
      console.error('Failed to delete goal:', error);
      alert('Failed to delete goal');
    }
  };

  const handleSendTaskReminder = async (task: Task) => {
    try {
      const response = await tasksAPI.remind(task.id);
      alert(response.data.message || 'Reminder sent');
    } catch (error: any) {
      console.error('Failed to send task reminder:', error);
      alert(error.response?.data?.error || 'Failed to send reminder');
    }
  };

  if (!currentProfile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please select a profile first</p>
      </div>
    );
  }

  const goalProgress = monthlyGoal && progress
    ? Math.min(100, (progress.current.total_points / monthlyGoal.goal_points) * 100)
    : 0;

  // Categorize tasks for kid view
  const today = parseDateOnly(getLocalDateKey())!;
  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);
  const isRecurringTask = (task: Task) => task.is_recurring === true || task.is_recurring === 1;

  const overdueTasks = incompleteTasks.filter(t => {
    if (!t.due_date || !t.parent_approved) return false;
    const dueDate = parseDateOnly(t.due_date);
    if (!dueDate) return false;
    return dueDate < today && !isRecurringTask(t);
  });

  const todayTasks = incompleteTasks.filter(t => {
    if (!t.parent_approved || !t.due_date) return false;
    const dueDate = parseDateOnly(t.due_date);
    if (!dueDate) return false;

    if (isRecurringTask(t) && dueDate <= today) {
      return true;
    }

    return dueDate.getTime() === today.getTime();
  });

  const upcomingTasks = incompleteTasks.filter(t => {
    if (!t.due_date || !t.parent_approved) return false;
    const dueDate = parseDateOnly(t.due_date);
    if (!dueDate) return false;
    return dueDate > today && dueDate <= weekFromNow;
  });

  const otherApprovedTasks = incompleteTasks.filter(t => {
    if (!t.parent_approved) return false;
    if (!t.due_date) return true;
    const dueDate = parseDateOnly(t.due_date);
    if (!dueDate) return false;
    return dueDate > weekFromNow;
  });

  const todayStr = getLocalDateKey();
  const completedTodayTasks = completedTasks.filter(t => {
    if (!t.completed_at) return false;
    return extractDateOnly(t.completed_at) === todayStr;
  });

  const formatDueDate = (dateStr: string) => {
    const date = parseDateOnly(dateStr);
    if (!date) return '';
    const now = parseDateOnly(getLocalDateKey())!;
    const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const overdueDays = Math.abs(diffDays);
      return overdueDays === 1 ? '1 day late!' : `${overdueDays} days late!`;
    } else if (diffDays === 0) {
      return 'Due today';
    } else if (diffDays === 1) {
      return 'Due tomorrow';
    } else {
      return `Due in ${diffDays} days`;
    }
  };

  // Mission control handlers for kids
  const handleStartMission = (task: Task) => {
    const hasTimer = task.requires_timer === 1 || task.requires_timer === true;
    if (hasTimer) {
      setActiveMission(task);
    } else {
      handleCompleteTask(task.id, task);
    }
  };

  const handleMissionComplete = async (taskId: number, pointsEarned: number, starsEarned: number, timeSpent: number) => {
    const completedTask = activeMission || tasks.find(t => t.id === taskId);

    if (completedTask) {
      setMissionCompleteData({
        task: completedTask,
        pointsEarned,
        starsEarned,
        timeSpent
      });
      setShowMissionComplete(true);
    }

    setActiveMission(null);
    await loadTasks();
    await loadProgress();
  };

  // Check if we should show kid-friendly Mission Control UI
  const showMissionControlUI = !isParent && currentProfile?.type === 'child';

  return (
    <div className={clsx("max-w-7xl mx-auto", showMissionControlUI && settings.themeClass)}>
      {/* Mission Complete Modal for Kids */}
      {showMissionComplete && missionCompleteData && (
        <MissionCompleteModal
          task={missionCompleteData.task}
          pointsEarned={missionCompleteData.pointsEarned}
          starsEarned={missionCompleteData.starsEarned}
          timeSpent={missionCompleteData.timeSpent}
          onClose={() => {
            setShowMissionComplete(false);
            setMissionCompleteData(null);
          }}
        />
      )}

      {/* Header - Kid-friendly or Parent view */}
      {showMissionControlUI ? (
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">{pageInfo.emoji}</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{pageInfo.title}</h1>
                <p className="text-sm text-gray-500">{pageInfo.subtitle}</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddTask(true)}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold text-sm hover:from-purple-600 hover:to-pink-600 active:scale-95 transition-all flex items-center gap-2 shadow-md"
            >
              <Plus size={18} />
              Add {settings.ageGroup === 'young' ? 'Job' : settings.ageGroup === 'middle' ? 'Mission' : 'Task'}
            </button>
          </div>

          {/* Quick Stats for Kids */}
          {progress && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-3 text-center border border-amber-100">
                <Star className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-amber-700">{progress.current.total_stars}</p>
                <p className="text-xs text-amber-600">Stars</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-3 text-center border border-purple-100">
                <Gift className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-purple-700">{progress.current.total_points}</p>
                <p className="text-xs text-purple-600">Points</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-3 text-center border border-green-100">
                <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-green-700">{completedTasks.length}</p>
                <p className="text-xs text-green-600">Done</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{pageInfo.title}</h1>
            <p className="text-gray-600 mt-1">{pageInfo.subtitle}</p>
          </div>

          <div className="flex space-x-2">
            {isParent && displayProfileId && (
              <button onClick={() => setShowBonusPoints(true)} className="btn btn-secondary">
                <Award size={20} className="mr-2" />
                Award Bonus
              </button>
            )}
            <button onClick={() => setShowAddTask(true)} className="btn btn-primary">
              <Plus size={20} className="mr-2" />
              Add Task
            </button>
          </div>
        </div>
      )}

      {/* Child Selector for Parents */}
      {isParent && children.length > 0 && (
        <div className="card mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Child
          </label>
          <div className="flex flex-wrap gap-2">
            {children.map(child => (
              <button
                key={child.id}
                onClick={() => setSelectedChild(child.id)}
                className={clsx(
                  'px-4 py-2 rounded-lg font-medium transition-colors',
                  selectedChild === child.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                )}
              >
<Avatar avatar={child.avatar} size="sm" alt={child.name} className="inline-block mr-1" /> {child.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pending Goals for Parents to Review */}
      {isParent && pendingGoals.length > 0 && (
        <div className="card mb-6 bg-yellow-50 border-2 border-yellow-300">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Trophy className="mr-2 text-yellow-600" size={24} />
            Pending Goal Approvals
          </h3>
          <div className="space-y-3">
            {pendingGoals.map(goal => (
              <div key={goal.id} className="bg-white p-4 rounded-lg border border-yellow-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <Avatar avatar={goal.child_avatar} size="sm" alt={goal.child_name || 'Child'} className="mr-2" />
                      <div>
                        <p className="font-semibold text-gray-900">{goal.child_name}</p>
                        <p className="text-sm text-gray-600">wants to set a goal</p>
                      </div>
                    </div>
                    <p className="text-gray-800 mb-2">{goal.goal_description}</p>
                    <div className="flex items-center text-sm text-gray-600">
                      <Star className="mr-1" size={16} />
                      <span>{goal.goal_points} points • {getGoalTypeLabel(goal.goal_type)}</span>
                    </div>
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handleApproveGoal(goal.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => handleRejectGoal(goal.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
                    >
                      ✗ Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Tasks for Parents to Review */}
      {isParent && pendingTaskApprovals.length > 0 && (
        <div className="card mb-6 bg-blue-50 border-2 border-blue-300">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Check className="mr-2 text-blue-600" size={24} />
            Pending Task Approvals
          </h3>
          <div className="space-y-3">
            {pendingTaskApprovals.map(task => (
              <div key={task.id} className="bg-white p-4 rounded-lg border border-blue-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <Avatar avatar={task.child_avatar} size="sm" alt={task.child_name || 'Child'} className="mr-2" />
                      <div>
                        <p className="font-semibold text-gray-900">{task.child_name}</p>
                        <p className="text-sm text-gray-600">created a task</p>
                      </div>
                    </div>
                    <h4 className="text-gray-900 font-bold mb-1">{task.title}</h4>
                    {task.description && (
                      <p className="text-gray-700 mb-2 text-sm">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="badge badge-primary">{task.points} pts</span>
                      <span className="badge badge-warning">{task.difficulty}</span>
                      <span className="text-gray-600">• {task.category}</span>
                      {task.due_date && (
                        <span className="text-gray-600">• Due: {formatDateOnlyForDisplay(task.due_date)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handleApproveTask(task.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => handleRejectTask(task.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
                    >
                      ✗ Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Photo Proofs for Parents to Verify */}
      {isParent && pendingPhotoProofs.length > 0 && (
        <div className="card mb-6 bg-purple-50 border-2 border-purple-300">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Camera className="mr-2 text-purple-600" size={24} />
            Photo Proofs to Verify ({pendingPhotoProofs.length})
          </h3>
          <div className="space-y-4">
            {pendingPhotoProofs.map(task => (
              <div key={task.id} className="bg-white p-4 rounded-lg border border-purple-200">
                <div className="flex items-start gap-4">
                  {/* Photo Preview */}
                  <div className="flex-shrink-0">
                    <img
                      src={task.proof_photo_url ? `/api${task.proof_photo_url}` : ''}
                      alt="Photo proof"
                      className="w-32 h-32 object-cover rounded-lg border-2 border-purple-300 cursor-pointer hover:opacity-80"
                      onClick={() => task.proof_photo_url && window.open(`/api${task.proof_photo_url}`, '_blank')}
                      title="Click to view full size"
                    />
                    <p className="text-xs text-gray-500 mt-1 text-center">Click to enlarge</p>
                  </div>

                  {/* Task Details */}
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <Avatar avatar={task.child_avatar} size="sm" alt={task.child_name || 'Child'} className="mr-2" />
                      <div>
                        <p className="font-semibold text-gray-900">{task.child_name}</p>
                        <p className="text-sm text-gray-600">uploaded proof for task</p>
                      </div>
                    </div>
                    <h4 className="text-gray-900 font-bold mb-1">{task.title}</h4>
                    {task.description && (
                      <p className="text-gray-700 mb-2 text-sm">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-sm mb-3">
                      <span className="badge badge-primary">{task.points} pts</span>
                      <span className="badge badge-warning">{task.difficulty}</span>
                    </div>

                    {/* Approve/Reject Buttons */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleVerifyProof(task.id, true)}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium flex items-center"
                      >
                        <Check size={16} className="mr-1" />
                        Approve & Complete
                      </button>
                      <button
                        onClick={() => handleVerifyProof(task.id, false)}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
                      >
                        ✗ Reject Photo
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Goal Card */}
      {!isParent && (
        <div className="card bg-gradient-to-r from-green-500 to-teal-600 text-white mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center">
              <Target size={32} className="mr-3" />
              <div>
                <h3 className="text-xl font-bold">Monthly Goal</h3>
                <p className="text-green-100 text-sm">
                  {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
            {!monthlyGoal && (
              <button
                onClick={() => setShowAddGoal(true)}
                className="btn bg-white text-green-600 hover:bg-green-50 btn-sm"
              >
                <Plus size={16} className="mr-1" />
                Set Goal
              </button>
            )}
          </div>

          {monthlyGoal ? (
            <>
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span>🎯 {monthlyGoal.goal_description}</span>
                  <span className="font-bold">
                    {progress?.current.total_points || 0} / {monthlyGoal.goal_points} points
                  </span>
                </div>
                <div className="w-full bg-green-700 rounded-full h-4">
                  <div
                    className="bg-white rounded-full h-4 transition-all duration-500"
                    style={{ width: `${goalProgress}%` }}
                  />
                </div>
              </div>
              {monthlyGoal.achieved ? (
                <div className="bg-white text-green-600 px-4 py-2 rounded-lg font-bold text-center">
                  🎉 Goal Achieved! Reward: {getGoalTypeLabel(monthlyGoal.goal_type)}
                </div>
              ) : goalProgress >= 100 ? (
                <div className="bg-yellow-400 text-yellow-900 px-4 py-2 rounded-lg font-bold text-center">
                  ⭐ Goal Reached! Ask parent for reward!
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-center py-4 text-green-100">
              <p>No goal set for this month</p>
              <p className="text-sm mt-1">Set a goal to work towards!</p>
            </div>
          )}
        </div>
      )}

      {/* All Approved Goals */}
      {allGoals.length > 0 && (
        <div className="card mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Trophy className="mr-2 text-yellow-600" size={24} />
            {isParent ? 'All Goals' : 'My Goals'}
            <span className="ml-2 text-sm font-normal text-gray-600">({allGoals.length} total)</span>
          </h3>
          <div className="space-y-3">
            {allGoals.map((goal) => {
              const goalProgress = progress && goal.parent_approved
                ? Math.min(100, (progress.current.total_points / goal.goal_points) * 100)
                : 0;

              return (
                <div key={goal.id} className={clsx(
                  'p-4 rounded-lg border-2',
                  goal.achieved ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'
                )}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <p className="font-semibold text-gray-900">{goal.goal_description}</p>
                        {goal.achieved && <span className="text-green-600 text-xl">✅</span>}
                        {!goal.parent_approved && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Pending Approval</span>}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>📅 {new Date(goal.created_at).toLocaleDateString()}</span>
                        <span>🎯 {goal.goal_points} points</span>
                        <span>{getGoalTypeLabel(goal.goal_type)}</span>
                      </div>
                    </div>
                    {!goal.achieved && (
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => setEditingGoal(goal)}
                          className="btn btn-secondary btn-sm"
                          title="Edit goal"
                        >
                          <Edit2 size={16} />
                        </button>
                        {isParent && (
                          <button
                            onClick={() => handleDeleteGoal(goal.id)}
                            className="btn btn-secondary btn-sm text-red-600 hover:bg-red-100"
                            title="Delete goal"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {goal.parent_approved && !goal.achieved && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>{Math.round(goalProgress)}%</span>
                      </div>
                      <div className="w-full bg-gray-300 rounded-full h-2">
                        <div
                          className={clsx(
                            'rounded-full h-2 transition-all',
                            goalProgress >= 100 ? 'bg-green-500' : 'bg-blue-500'
                          )}
                          style={{ width: `${goalProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {goal.achieved && (
                    <div className="mt-2 text-sm text-green-700 font-medium">
                      🎉 Achieved! Reward given: {goal.reward_given ? 'Yes' : 'Pending'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Parent View: Monthly Goal Management */}
      {isParent && selectedChild && monthlyGoal && (
        <div className="card bg-blue-50 border-2 border-blue-200 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-bold text-blue-900">
                {profiles.find(p => p.id === selectedChild)?.name}'s Goal
              </h3>
              <p className="text-blue-700">
                {monthlyGoal.goal_description} • {progress?.current.total_points || 0} / {monthlyGoal.goal_points} points
              </p>
              <div className="w-full bg-blue-200 rounded-full h-3 mt-2">
                <div
                  className="bg-blue-600 rounded-full h-3"
                  style={{ width: `${goalProgress}%` }}
                />
              </div>
            </div>
            {!monthlyGoal.achieved && goalProgress >= 100 && (
              <button
                onClick={handleMarkGoalAchieved}
                className="btn btn-success ml-4"
              >
                Mark Achieved
              </button>
            )}
            {monthlyGoal.achieved && (
              <span className="ml-4 px-4 py-2 bg-green-100 text-green-700 rounded-lg font-bold">
                ✅ Achieved!
              </span>
            )}
          </div>
        </div>
      )}

      {/* ======================= */}
      {/* KID-FRIENDLY MISSION VIEW */}
      {/* ======================= */}
      {showMissionControlUI && (
        <div className="space-y-4">
          {/* Active Mission (Hero Section) */}
          {activeMission && (
            <ActiveMissionCard
              task={activeMission}
              onComplete={handleMissionComplete}
              onCancel={() => setActiveMission(null)}
            />
          )}

          {/* Mission Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Today's Missions */}
            <TodaysMissions
              tasks={[...todayTasks, ...otherApprovedTasks].filter(t => t.id !== activeMission?.id)}
              onStartMission={handleStartMission}
            />

            {/* Completed Today */}
            <CompletedToday tasks={completedTodayTasks} />
          </div>

          {/* Overdue & Coming Up Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <OverdueMissions
              tasks={overdueTasks.filter(t => t.id !== activeMission?.id)}
              onStartMission={handleStartMission}
              formatDueDate={formatDueDate}
            />
            <ComingUpMissions
              tasks={upcomingTasks}
              formatDueDate={formatDueDate}
            />
          </div>

          {/* Pending Tasks (unapproved) */}
          {incompleteTasks.filter(t => !t.parent_approved).length > 0 && (
            <div className="bg-white rounded-xl border border-orange-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-orange-500" />
                <h3 className="font-bold text-orange-800">Waiting for Approval</h3>
                <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">
                  {incompleteTasks.filter(t => !t.parent_approved).length}
                </span>
              </div>
              <div className="space-y-2">
                {incompleteTasks.filter(t => !t.parent_approved).slice(0, 5).map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-2 bg-orange-50 rounded-lg">
                    <span className="text-xl opacity-60">{categoryIcons[task.category] || '📌'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-orange-800 truncate text-sm">{task.title}</p>
                      <p className="text-xs text-orange-600">Ask your parent to approve</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All done state */}
          {incompleteTasks.filter(t => t.parent_approved).length === 0 && !loading && (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <div className="text-5xl mb-3">🎉</div>
              <p className="text-lg font-semibold text-gray-900">All {settings.ageGroup === 'young' ? 'jobs' : settings.ageGroup === 'middle' ? 'missions' : 'tasks'} done!</p>
              {!isParent && futureTasks.length > 0 && (
                <p className="text-sm mt-2 text-blue-600">
                  {futureTasks.length} scheduled task{futureTasks.length === 1 ? '' : 's'} will appear on the due date.
                </p>
              )}
              <p className="text-gray-500">Great job! Check back later for more.</p>
            </div>
          )}

          {/* Monthly Goal for Kids */}
          {monthlyGoal && (
            <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl border border-violet-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-violet-600" />
                <h3 className="font-bold text-violet-800">My Goal</h3>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-700">{monthlyGoal.goal_description}</span>
                <span className="text-sm font-medium text-violet-600">
                  {progress?.current.total_points || 0} / {monthlyGoal.goal_points} pts
                </span>
              </div>
              <div className="h-2 bg-violet-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all"
                  style={{ width: `${goalProgress}%` }}
                />
              </div>
              {goalProgress >= 100 && !monthlyGoal.achieved && (
                <p className="text-sm text-green-600 font-medium mt-2">Goal reached! Ask your parent for your reward!</p>
              )}
              {monthlyGoal.achieved && (
                <p className="text-sm text-green-600 font-medium mt-2">Goal achieved! {getGoalTypeLabel(monthlyGoal.goal_type)}</p>
              )}
            </div>
          )}

          {/* Add new goal button */}
          {!monthlyGoal && (
            <button
              onClick={() => setShowAddGoal(true)}
              className="w-full py-4 bg-gradient-to-r from-violet-100 to-purple-100 rounded-xl border-2 border-dashed border-violet-300 text-violet-700 font-semibold hover:from-violet-200 hover:to-purple-200 transition-all flex items-center justify-center gap-2"
            >
              <Target size={20} />
              Set a Goal
            </button>
          )}
        </div>
      )}

      {/* ======================= */}
      {/* PARENT / ADMIN VIEW */}
      {/* ======================= */}
      {!showMissionControlUI && (
        <>
          {/* Progress Card */}
          {progress && !isParent && (
            <div className="card bg-gradient-to-r from-primary-500 to-purple-600 text-white mb-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <Trophy size={32} className="mx-auto mb-2" />
                  <p className="text-2xl font-bold">{progress.current.level}</p>
                  <p className="text-sm text-primary-100">Level</p>
                </div>
                <div>
                  <Star size={32} className="mx-auto mb-2" />
                  <p className="text-2xl font-bold">{progress.current.total_stars}</p>
                  <p className="text-sm text-primary-100">Stars</p>
                </div>
                <div>
                  <Gift size={32} className="mx-auto mb-2" />
                  <p className="text-2xl font-bold">{progress.current.total_points}</p>
                  <p className="text-sm text-primary-100">Points</p>
                </div>
              </div>

              {progress.weekly && (
                <div className="mt-4 pt-4 border-t border-primary-400">
                  <p className="text-sm text-primary-100">This Week</p>
                  <p className="text-lg font-semibold">
                    {progress.weekly.tasks_completed_this_week} tasks • {progress.weekly.points_this_week} points
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tasks List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incomplete Tasks */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">
            Pending Tasks ({incompleteTasks.length})
          </h2>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="spinner"></div>
            </div>
          ) : incompleteTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No pending tasks</p>
              <p className="text-sm mt-1">
                {isParent ? 'Add tasks for your kids' : 'All caught up! 🎉'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {incompleteTasks.map((task, index) => {
                const requiresTimer = task.requires_timer === true || task.requires_timer === 1;
                const dueRelation = getDateOnlyRelation(task.due_date);
                const canSendReminder = isParent && task.parent_approved && !task.completed && !!task.due_date && dueRelation !== 'future';

                // For tasks requiring timer (and approved), show the timer card
                if (requiresTimer && task.parent_approved && !isParent) {
                  return (
                    <TaskTimerCard
                      key={task.id}
                      task={task}
                      onComplete={(taskId) => handleCompleteTask(taskId, task)}
                      index={index}
                    />
                  );
                }

                // Regular task card
                return (
                  <div
                    key={task.id}
                    className={clsx(
                      'p-4 border-2 rounded-lg transition-all',
                      !task.parent_approved && 'border-orange-300 bg-orange-50 opacity-75',
                      task.parent_approved && task.priority === 'high' && 'border-red-300 bg-red-50',
                      task.parent_approved && task.priority === 'medium' && 'border-yellow-300 bg-yellow-50',
                      task.parent_approved && task.priority === 'low' && 'border-green-300 bg-green-50',
                      task.parent_approved && !task.priority && task.earns_points && task.difficulty === 'hard' && 'border-red-300 bg-red-50',
                      task.parent_approved && !task.priority && task.earns_points && task.difficulty === 'medium' && 'border-yellow-300 bg-yellow-50',
                      task.parent_approved && !task.priority && task.earns_points && task.difficulty === 'easy' && 'border-green-300 bg-green-50',
                      task.parent_approved && !task.earns_points && 'border-gray-300 bg-gray-50'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{categoryIcons[task.category] || '📌'}</span>
                          <h3 className="font-semibold text-gray-900">{task.title}</h3>
                          {requiresTimer && (
                            <span title="Timer required" className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                              <Timer size={12} /> Timer
                            </span>
                          )}
                          {task.is_recurring === 1 && (
                            <span title="Recurring task"><Repeat size={14} className="text-blue-600" /></span>
                          )}
                          {!task.parent_approved && (
                            <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full font-medium">
                              ⏳ Pending Approval
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                        )}
                        <div className="flex flex-wrap items-center mt-2 gap-2">
                          {task.earns_points ? (
                            <>
                              <span className="badge badge-primary">{task.points} pts</span>
                              <span className="badge badge-warning">
                                {task.difficulty}
                              </span>
                            </>
                          ) : (
                            <span className="badge bg-gray-500 text-white">
                              📍 Tracking Only
                            </span>
                          )}
                          {task.priority && task.priority !== 'medium' && (
                            <span className={clsx('badge', priorityColors[task.priority])}>
                              {task.priority === 'high' ? '🔴 High' : '🟢 Low'}
                            </span>
                          )}
                          {task.due_date && (
                            <span className="text-xs text-gray-600 flex items-center">
                              <Calendar size={12} className="mr-1" />
                              {formatDateOnlyForDisplay(task.due_date)}
                            </span>
                          )}
                          {task.estimated_minutes && (
                            <span className="text-xs text-gray-600 flex items-center">
                              <Clock size={12} className="mr-1" />
                              {task.estimated_minutes} min
                            </span>
                          )}
                          {task.scheduled_time && (
                            <span className="text-xs text-orange-600 flex items-center font-medium">
                              <Bell size={12} className="mr-1" />
                              {task.scheduled_time}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        {(isParent || task.parent_approved) && (
                          <button
                            onClick={() => setEditingTask(task)}
                            className="btn btn-secondary btn-sm"
                            title="Edit task"
                          >
                            <Edit2 size={16} />
                          </button>
                        )}
                        {canSendReminder && (
                          <button
                            onClick={() => handleSendTaskReminder(task)}
                            className="btn btn-secondary btn-sm text-orange-600 hover:bg-orange-100"
                            title="Send reminder"
                          >
                            <Bell size={16} />
                          </button>
                        )}
                        {isParent && (
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="btn btn-secondary btn-sm text-red-600 hover:bg-red-100"
                            title="Delete task"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        {task.parent_approved ? (
                          <button
                            onClick={() => handleCompleteTask(task.id, task)}
                            className="btn btn-success btn-sm"
                            title={task.proof_required ? 'Complete with photo proof' : 'Mark as complete'}
                          >
                            {task.proof_required ? <Camera size={16} /> : <Check size={16} />}
                          </button>
                        ) : (
                          <span className="text-xs text-orange-600 italic">
                            Needs parent approval
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Completed Tasks */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">
            Completed Tasks ({completedTasks.length})
          </h2>

          {completedTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No completed tasks yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {completedTasks.slice(0, 10).map(task => (
                <div key={task.id} className="p-4 bg-gray-50 rounded-lg opacity-60">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 line-through">{task.title}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Completed {new Date(task.completed_at!).toLocaleDateString()}
                      </p>
                    </div>
                    <Check size={20} className="text-green-600" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
        </>
      )}

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
            <div className="card max-w-2xl w-full my-4">
            <h2 className="text-2xl font-bold mb-4">Add New Task</h2>

            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  className="input"
                  placeholder="Task title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  className="input"
                  placeholder="Task description"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <select
                  name="category"
                  required
                  className="input"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">Select category</option>
                  <option value="read-book">📚 Read Book (Timer Required)</option>
                  <option value="tigrinya">✍️ Tigrinya Practice (Timer Required)</option>
                  <option value="clean-room">🛏️ Clean Room (Timer Required)</option>
                  <option value="clean-kitchen">🍽️ Clean Kitchen (Timer Required)</option>
                  <option value="school">🎒 School Work (Timer Required)</option>
                  <option value="other">📌 Other</option>
                </select>
                {TIMED_CATEGORIES.includes(selectedCategory) && (
                  <p className="text-xs text-blue-600 mt-1 flex items-center">
                    <Clock size={12} className="mr-1" />
                    This task requires a timer. Kids must start and complete the timer to earn points.
                  </p>
                )}
              </div>

              {/* Difficulty selection */}
              {selectedCategory && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Difficulty * (affects points earned)
                  </label>
                  <select name="difficulty" required className="input">
                    <option value="easy">Easy (10 pts)</option>
                    <option value="medium">Medium (20 pts)</option>
                    <option value="hard">Hard (30 pts)</option>
                  </select>
                </div>
              )}

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <AlertTriangle size={16} className="inline mr-1" />
                  Priority
                </label>
                <select name="priority" className="input" defaultValue="medium">
                  <option value="high">🔴 High - Do first!</option>
                  <option value="medium">🟡 Medium - Normal</option>
                  <option value="low">🟢 Low - When you have time</option>
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar size={16} className="inline mr-1" />
                  Due Date *
                </label>
                <input
                  type="date"
                  id="due_date"
                  name="due_date"
                  className="input"
                  required
                  defaultValue={getLocalDateKey()}
                />
              </div>

              {/* Estimated Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Clock size={16} className="inline mr-1" />
                  Estimated Time (minutes)
                </label>
                <select name="estimated_minutes" className="input">
                  <option value="">Not set</option>
                  <option value="5">5 minutes</option>
                  <option value="10">10 minutes</option>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                </select>
              </div>

              {/* Scheduled Time - Task-specific reminder */}
              <div className="p-4 bg-orange-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Bell size={16} className="inline mr-1 text-orange-600" />
                  Scheduled Reminder Time
                </label>
                <input
                  type="time"
                  name="scheduled_time"
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Set a time to receive a reminder notification for this task (plays sound)
                </p>
              </div>

              {/* Recurring Task */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" name="is_recurring" className="w-5 h-5 rounded" />
                  <Repeat size={16} className="text-blue-600" />
                  <span className="font-medium text-gray-700">Make this a recurring task</span>
                </label>
                <div className="mt-3">
                  <select name="recurrence_pattern" className="input">
                    <option value="daily">Daily</option>
                    <option value="weekdays">Weekdays only</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every 2 weeks</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Recurring tasks automatically create a new copy when completed
                  </p>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  Add Task
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddTask(false);
                    setSelectedCategory('');
                  }}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Goal Modal */}
      {showAddGoal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
            <div className="card max-w-lg w-full my-4">
            <h2 className="text-2xl font-bold mb-4">Set Monthly Goal</h2>

            <form onSubmit={handleAddGoal} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What do you want to earn? *
                </label>
                <input
                  type="text"
                  name="description"
                  required
                  className="input"
                  placeholder="e.g., 100 kroner, Movie night, New toy"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What reward do you want? 🎁
                </label>
                <select name="type" className="input">
                  {GOAL_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  name="custom_type"
                  className="input mt-2"
                  placeholder="Or type your own reward, e.g. Roblox gift card"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Goal category
                </label>
                <select name="category" className="input" defaultValue="monthly">
                  {GOAL_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  name="custom_category"
                  className="input mt-2"
                  placeholder="Or type your own category, e.g. school trip"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  How many points do you need? *
                </label>
                <input
                  type="number"
                  name="points"
                  required
                  min="10"
                  className="input"
                  placeholder="e.g., 500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Complete tasks and earn bonus points for good behavior to reach your goal!
                </p>
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  <Target size={20} className="mr-2" />
                  Set Goal
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddGoal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Award Bonus Points Modal */}
      {showBonusPoints && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
            <div className="card max-w-lg w-full my-4">
            <h2 className="text-2xl font-bold mb-4">Award Bonus Points</h2>
            <p className="text-gray-600 mb-4">
              Reward good behavior (sammearbeid/cooperation) with bonus points!
            </p>

            <form onSubmit={handleAwardBonus} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Bonus *
                </label>
                <input
                  type="text"
                  name="reason"
                  required
                  className="input"
                  placeholder="e.g., Helped sibling, Great teamwork"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bonus Points
                  </label>
                  <input
                    type="number"
                    name="points"
                    min="0"
                    defaultValue="10"
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bonus Stars
                  </label>
                  <input
                    type="number"
                    name="stars"
                    min="0"
                    defaultValue="1"
                    className="input"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  <Award size={20} className="mr-2" />
                  Award Bonus
                </button>
                <button
                  type="button"
                  onClick={() => setShowBonusPoints(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
            <div className="card max-w-2xl w-full my-4">
            <h2 className="text-2xl font-bold mb-4">Edit Task</h2>

            <form onSubmit={handleEditTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  className="input"
                  defaultValue={editingTask.title}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  className="input"
                  rows={3}
                  defaultValue={editingTask.description || ''}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <select
                  name="category"
                  required
                  className="input"
                  defaultValue={editingTask.category}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">Select category</option>
                  <option value="read-book">📚 Read Book (Timer Required)</option>
                  <option value="tigrinya">✍️ Tigrinya Practice (Timer Required)</option>
                  <option value="clean-room">🛏️ Clean Room (Timer Required)</option>
                  <option value="clean-kitchen">🍽️ Clean Kitchen (Timer Required)</option>
                  <option value="school">🎒 School Work (Timer Required)</option>
                  <option value="other">📌 Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Difficulty * (affects points earned)
                </label>
                <select name="difficulty" required className="input" defaultValue={editingTask.difficulty}>
                  <option value="easy">Easy (10 pts)</option>
                  <option value="medium">Medium (20 pts)</option>
                  <option value="hard">Hard (30 pts)</option>
                </select>
              </div>

              <div>
                <label htmlFor="edit_due_date" className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date *
                </label>
                <input
                  type="date"
                  id="edit_due_date"
                  name="due_date"
                  className="input"
                  required
                  defaultValue={extractDateOnly(editingTask.due_date) || getLocalDateKey(new Date())}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  <Edit2 size={20} className="mr-2" />
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTask(null);
                    setSelectedCategory('');
                  }}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Goal Modal */}
      {editingGoal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
            <div className="card max-w-lg w-full my-4">
            <h2 className="text-2xl font-bold mb-4">Edit Goal</h2>

            <form onSubmit={handleEditGoal} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What do you want to earn? *
                </label>
                <input
                  type="text"
                  name="description"
                  required
                  className="input"
                  defaultValue={editingGoal.goal_description}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What reward do you want? 🎁
                </label>
                <select
                  name="type"
                  className="input"
                  defaultValue={isPresetGoalType(editingGoal.goal_type) ? editingGoal.goal_type : 'other'}
                >
                  {GOAL_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  name="custom_type"
                  className="input mt-2"
                  defaultValue={isPresetGoalType(editingGoal.goal_type) ? '' : editingGoal.goal_type}
                  placeholder="Or type your own reward"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Goal category
                </label>
                <select
                  name="category"
                  className="input"
                  defaultValue={isPresetGoalCategory(editingGoal.goal_category) ? editingGoal.goal_category : 'monthly'}
                >
                  {GOAL_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  name="custom_category"
                  className="input mt-2"
                  defaultValue={editingGoal.goal_category && !isPresetGoalCategory(editingGoal.goal_category) ? editingGoal.goal_category : ''}
                  placeholder="Or type your own category"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  How many points do you need? *
                </label>
                <input
                  type="number"
                  name="points"
                  required
                  min="10"
                  className="input"
                  defaultValue={editingGoal.goal_points}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn btn-primary flex-1">
                  <Edit2 size={20} className="mr-2" />
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingGoal(null)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Photo Proof Modal */}
      {showPhotoProof && photoProofTask && (
        <PhotoProof
          taskId={photoProofTask.id}
          taskTitle={photoProofTask.title}
          onProofUploaded={handlePhotoProofUploaded}
          onCancel={() => {
            setShowPhotoProof(false);
            setPhotoProofTask(null);
          }}
        />
      )}
    </div>
  );
}
