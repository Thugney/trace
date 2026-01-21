import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { useAge } from '../context/AgeContext';
import { useFeatureFlags } from '../context/FeatureFlagsContext';
import { useProfileFeatures } from '../context/ProfileFeaturesContext';
import { tasksAPI } from '../services/api';
import { profilesAPI, gamificationAPI, goalsAPI, aiGamificationAPI, remindersAPI, notificationsAPI, GoalWithMilestones, CustomChallenge, EconomySettings } from '../services/api';
import { ProfileStats, Task } from '../types';
import {
  Star, Target, Zap, CheckCircle, Lock, X, Gift, ChevronRight,
  Flame, Trophy, AlertTriangle, Calendar, Clock, Settings, Bell, Droplets,
  Gamepad2, ShoppingBag, Brain, ListTodo, Home
} from 'lucide-react';
import CountdownChallengeCard from '../components/CountdownChallengeCard';
import SpinWheel from '../components/SpinWheel';
import HiddenAchievements from '../components/HiddenAchievements';
import Avatar from '../components/Avatar';
import ChallengeTimerCard from '../components/ChallengeTimerCard';
import playSounds from '../utils/sounds';
import ReminderWidget from '../components/kids/ReminderWidget';
import { SimpleTaskGrid } from '../components/SimpleTaskCard';
import {
  ActiveMissionCard,
  TodaysMissions,
  CompletedToday,
  OverdueMissions,
  ComingUpMissions,
  MissionCompleteModal
} from '../components/MissionControl';

// Goal type display helper
const GOAL_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  'kroner': { label: 'Money', emoji: '💰' },
  'money': { label: 'Money', emoji: '💰' },
  'movie-night': { label: 'Movie Night', emoji: '🎬' },
  'treat': { label: 'Special Treat', emoji: '🍪' },
  'toy': { label: 'Toy or Gift', emoji: '🎁' },
  'activity': { label: 'Fun Activity', emoji: '🎡' },
  'game': { label: 'Game Time', emoji: '🎮' },
  'outing': { label: 'Fun Outing', emoji: '🚌' },
  'other': { label: 'Special Reward', emoji: '🎉' }
};

const getGoalTypeDisplay = (goalType: string | undefined) => {
  if (!goalType) return { label: 'Reward', emoji: '🎯' };
  const display = GOAL_TYPE_LABELS[goalType.toLowerCase()];
  return display || { label: goalType, emoji: '🎉' };
};

// Avatar categories with emojis
const AVATAR_CATEGORIES = [
  {
    name: 'Superheroes',
    avatars: [
      { emoji: '🕷️', label: 'Spiderman', minLevel: 1 },
      { emoji: '🦇', label: 'Batman', minLevel: 1 },
      { emoji: '🐆', label: 'Black Panther', minLevel: 1 },
      { emoji: '🟢', label: 'Hulk', minLevel: 1 },
      { emoji: '🦸', label: 'Superhero', minLevel: 1 },
      { emoji: '🦸‍♂️', label: 'Hero Boy', minLevel: 1 },
      { emoji: '⚡', label: 'Flash', minLevel: 1 },
      { emoji: '🛡️', label: 'Captain', minLevel: 1 },
      { emoji: '🔨', label: 'Thor', minLevel: 2 },
      { emoji: '🥷', label: 'Ninja', minLevel: 2 },
      { emoji: '🦹', label: 'Super Villain', minLevel: 2 },
      { emoji: '⭐', label: 'Star Power', minLevel: 3 },
    ]
  },
  {
    name: 'Strong Animals',
    avatars: [
      { emoji: '🦍', label: 'Gorilla', minLevel: 1 },
      { emoji: '🦁', label: 'Lion', minLevel: 1 },
      { emoji: '🐻', label: 'Bear', minLevel: 1 },
      { emoji: '🐯', label: 'Tiger', minLevel: 1 },
      { emoji: '🐺', label: 'Wolf', minLevel: 1 },
      { emoji: '🦈', label: 'Shark', minLevel: 1 },
      { emoji: '🐊', label: 'Crocodile', minLevel: 2 },
      { emoji: '🦅', label: 'Eagle', minLevel: 2 },
      { emoji: '🐘', label: 'Elephant', minLevel: 2 },
      { emoji: '🦏', label: 'Rhino', minLevel: 3 },
      { emoji: '🐉', label: 'Dragon', minLevel: 4 },
      { emoji: '🦖', label: 'T-Rex', minLevel: 4 },
    ]
  },
  {
    name: 'Cool Characters',
    avatars: [
      { emoji: '🧒', label: 'Boy', minLevel: 1 },
      { emoji: '👧', label: 'Girl', minLevel: 1 },
      { emoji: '🧑', label: 'Kid', minLevel: 1 },
      { emoji: '🧙', label: 'Wizard', minLevel: 2 },
      { emoji: '🧚', label: 'Fairy', minLevel: 2 },
      { emoji: '🧝', label: 'Elf', minLevel: 3 },
      { emoji: '🤴', label: 'Prince', minLevel: 3 },
      { emoji: '👸', label: 'Princess', minLevel: 3 },
      { emoji: '🧛', label: 'Vampire', minLevel: 4 },
      { emoji: '🧜', label: 'Mermaid', minLevel: 4 },
      { emoji: '👑', label: 'King', minLevel: 5 },
      { emoji: '🦄', label: 'Unicorn', minLevel: 5 },
    ]
  },
  {
    name: 'Fun Stuff',
    avatars: [
      { emoji: '⚽', label: 'Soccer', minLevel: 1 },
      { emoji: '🏀', label: 'Basketball', minLevel: 1 },
      { emoji: '🎮', label: 'Gaming', minLevel: 1 },
      { emoji: '🚀', label: 'Rocket', minLevel: 2 },
      { emoji: '🔥', label: 'Fire', minLevel: 2 },
      { emoji: '💎', label: 'Diamond', minLevel: 3 },
      { emoji: '🏆', label: 'Trophy', minLevel: 4 },
      { emoji: '👽', label: 'Alien', minLevel: 3 },
      { emoji: '🤖', label: 'Robot', minLevel: 3 },
      { emoji: '🎸', label: 'Guitar', minLevel: 2 },
      { emoji: '🎨', label: 'Art', minLevel: 1 },
      { emoji: '⭐', label: 'Gold Star', minLevel: 1 },
    ]
  }
];

interface DailyChallenge {
  id: number;
  challenge_type: string;
  description: string;
  target_value: number;
  bonus_points: number;
  completed: number;
  current_progress: number;
}

// Dashboard tabs
type DashboardTab = 'home' | 'tasks' | 'challenges' | 'rewards';

export default function ChildDashboard() {
  const { currentProfile } = useProfile();
  const { isYoungChild, settings } = useAge();
  useFeatureFlags(); // Hook called for context subscription
  const { isFeatureEnabled } = useProfileFeatures();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>('home');

  // Tasks with due date info
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [otherTasks, setOtherTasks] = useState<Task[]>([]);

  // Water & streaks
  const [waterData, setWaterData] = useState<{ total_ml: number; goal_ml: number }>({ total_ml: 0, goal_ml: 2000 });
  const [streaks, setStreaks] = useState<Record<string, { current: number; longest: number }>>({});
  const [, setAchievements] = useState<{ earned: any[]; total_count: number }>({ earned: [], total_count: 0 });

  // Challenges
  const [challenges, setChallenges] = useState<DailyChallenge[]>([]);
  const [customChallenges, setCustomChallenges] = useState<CustomChallenge[]>([]);

  // Goals
  const [activeGoals, setActiveGoals] = useState<GoalWithMilestones[]>([]);

  // UI state
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(0);
  const [prevLevel, setPrevLevel] = useState<number | null>(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Reminder state
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('07:30');
  const [savingReminder, setSavingReminder] = useState(false);

  // Economy limits state
  const [, setEconomyData] = useState<{
    settings: EconomySettings;
    dailyRemaining: number;
    weeklyRemaining: number;
    todayEarned: number;
  } | null>(null);

  // Daily Login Bonus state
  const [showLoginBonus, setShowLoginBonus] = useState(false);
  const [loginBonusData, setLoginBonusData] = useState<{
    claimed: boolean;
    consecutive_days: number;
    points_to_earn?: number;
    points_earned?: number;
  } | null>(null);
  const [claimingBonus, setClaimingBonus] = useState(false);
  const [bonusClaimed, setBonusClaimed] = useState(false);

  // Streak freeze state
  const [, setStreakFreezeData] = useState<{
    can_freeze: boolean;
    freeze_cost: number;
    freezes_used_this_week: number;
  } | null>(null);

  // Surprise Bonus Popup state
  const [showSurpriseBonus, setShowSurpriseBonus] = useState(false);
  const [surpriseBonusData, setSurpriseBonusData] = useState<{
    id: number;
    points: number;
    stars: number;
    reason: string;
    awardedBy: string;
  } | null>(null);

  // Mission Control state
  const [activeMission, setActiveMission] = useState<Task | null>(null);
  const [completedTodayTasks, setCompletedTodayTasks] = useState<Task[]>([]);
  const [showMissionComplete, setShowMissionComplete] = useState(false);
  const [missionCompleteData, setMissionCompleteData] = useState<{
    task: Task;
    pointsEarned: number;
    starsEarned: number;
    timeSpent: number;
  } | null>(null);

  // Load all data
  useEffect(() => {
    if (!currentProfile) return;

    const loadStats = async () => {
      try {
        setLoading(true);
        const [statsRes, waterRes, gamificationRes, achievementsRes, challengesRes, activeGoalsRes, customChallengesRes, economyRes] = await Promise.all([
          profilesAPI.getStats(currentProfile.id),
          gamificationAPI.getWater(currentProfile.id),
          gamificationAPI.getStats(currentProfile.id),
          gamificationAPI.getProfileAchievements(currentProfile.id),
          gamificationAPI.getChallenges(currentProfile.id),
          goalsAPI.getActive(currentProfile.id),
          aiGamificationAPI.getChallenges(currentProfile.id).catch(() => ({ data: [] })),
          gamificationAPI.getEconomySettings(currentProfile.id).catch(() => ({ data: null }))
        ]);
        setStats(statsRes.data);
        setWaterData({ total_ml: waterRes.data?.total_ml || 0, goal_ml: waterRes.data?.goal_ml || 2000 });
        setStreaks(gamificationRes.data?.streaks || {});
        setAchievements({ earned: achievementsRes.data?.earned || [], total_count: achievementsRes.data?.total_count || 0 });
        setChallenges(challengesRes.data || []);
        setActiveGoals(activeGoalsRes.data || []);
        setCustomChallenges(customChallengesRes.data || []);
        if (economyRes.data) {
          setEconomyData({
            settings: economyRes.data.settings,
            dailyRemaining: economyRes.data.earnings?.dailyRemaining || 0,
            weeklyRemaining: economyRes.data.earnings?.weeklyRemaining || 0,
            todayEarned: economyRes.data.earnings?.today?.points_earned || 0
          });
        }
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [currentProfile]);

  // Load tasks with due date categorization
  useEffect(() => {
    if (!currentProfile) return;

    const loadTasks = async () => {
      try {
        const res = await tasksAPI.getByProfile(currentProfile.id);
        const allTasksData = res.data as Task[];

        // Filter for incomplete tasks
        const incompleteTasks = allTasksData.filter((t: Task) => !t.completed);
        setAllTasks(incompleteTasks);

        // Filter for tasks completed today
        const todayStr = new Date().toISOString().split('T')[0];
        const completedToday = allTasksData.filter((t: Task) => {
          if (!t.completed || !t.completed_at) return false;
          const completedDate = t.completed_at.split('T')[0];
          return completedDate === todayStr;
        });
        setCompletedTodayTasks(completedToday);

        // Categorize tasks by due date
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const weekFromNow = new Date(now);
        weekFromNow.setDate(weekFromNow.getDate() + 7);

        const overdue: Task[] = [];
        const today: Task[] = [];
        const upcoming: Task[] = [];
        const other: Task[] = [];

        for (const task of incompleteTasks) {
          if (task.due_date) {
            const dueDate = new Date(task.due_date);
            dueDate.setHours(0, 0, 0, 0);

            if (dueDate < now) {
              overdue.push(task);
            } else if (dueDate.getTime() === now.getTime()) {
              today.push(task);
            } else if (dueDate <= weekFromNow) {
              upcoming.push(task);
            } else {
              other.push(task);
            }
          } else {
            other.push(task);
          }
        }

        // Sort by due date
        overdue.sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
        upcoming.sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());

        setOverdueTasks(overdue);
        setTodayTasks(today);
        setUpcomingTasks(upcoming);
        setOtherTasks(other);
      } catch (e) {
        console.error('Failed to load tasks:', e);
      }
    };

    loadTasks();
  }, [currentProfile]);

  // Load reminder preferences
  useEffect(() => {
    if (!currentProfile?.id) return;

    const loadReminderPrefs = async () => {
      try {
        const response = await remindersAPI.getPreferences(currentProfile.id);
        setReminderEnabled(response.data.reminder_enabled);
        setReminderTime(response.data.morning_reminder_time || '07:30');
      } catch {
        setReminderEnabled(false);
        setReminderTime('07:30');
      }
    };

    loadReminderPrefs();
  }, [currentProfile?.id]);

  // Level up detection
  useEffect(() => {
    if (stats?.progress?.level && prevLevel !== null && stats.progress.level > prevLevel) {
      setNewLevel(stats.progress.level);
      setShowLevelUp(true);
      playSounds.levelUp();
      setTimeout(() => setShowLevelUp(false), 5000);
    }
    if (stats?.progress?.level) {
      setPrevLevel(stats.progress.level);
    }
  }, [stats?.progress?.level, prevLevel]);

  // Check for daily login bonus
  useEffect(() => {
    if (!currentProfile || loading) return;

    const checkLoginBonus = async () => {
      try {
        const [bonusRes, freezeRes] = await Promise.all([
          gamificationAPI.getLoginBonus(currentProfile.id),
          gamificationAPI.getStreakFreeze(currentProfile.id)
        ]);
        setLoginBonusData(bonusRes.data);
        setStreakFreezeData(freezeRes.data);

        const today = new Date().toLocaleDateString('en-CA');
        const popupKey = `loginBonusPopup_${currentProfile.id}`;
        const lastShown = localStorage.getItem(popupKey);

        if (!bonusRes.data.claimed && lastShown !== today) {
          setShowLoginBonus(true);
          localStorage.setItem(popupKey, today);
        }
      } catch (error) {
        console.error('Failed to check login bonus:', error);
      }
    };

    checkLoginBonus();
  }, [currentProfile, loading]);

  // Check for surprise bonus
  useEffect(() => {
    if (!currentProfile || loading) return;

    const checkSurpriseBonus = async () => {
      try {
        const response = await notificationsAPI.getNotifications(10, true);
        const bonusNotification = response.data.notifications.find(
          (n: any) => n.type === 'achievement' && !n.is_read && n.data
        );

        if (bonusNotification) {
          try {
            const data = typeof bonusNotification.data === 'string'
              ? JSON.parse(bonusNotification.data)
              : bonusNotification.data;

            if (data.bonusId) {
              setSurpriseBonusData({
                id: bonusNotification.id,
                points: data.points || 0,
                stars: data.stars || 0,
                reason: data.reason || '',
                awardedBy: data.awardedBy || 'Parent'
              });
              setTimeout(() => {
                setShowSurpriseBonus(true);
                playSounds.levelUp();
              }, showLoginBonus ? 4000 : 500);
            }
          } catch (e) {
            console.error('Failed to parse bonus data:', e);
          }
        }
      } catch (error) {
        console.error('Failed to check for surprise bonus:', error);
      }
    };

    const timer = setTimeout(checkSurpriseBonus, 1000);
    return () => clearTimeout(timer);
  }, [currentProfile, loading, showLoginBonus]);

  // Handlers
  const toggleReminder = async () => {
    if (!currentProfile?.id || savingReminder) return;
    setSavingReminder(true);
    try {
      const newEnabled = !reminderEnabled;
      await remindersAPI.updatePreferences(currentProfile.id, {
        enabled: newEnabled,
        time: reminderTime
      });
      setReminderEnabled(newEnabled);
      playSounds.click();
    } catch (error) {
      console.error('Failed to update reminder:', error);
    } finally {
      setSavingReminder(false);
    }
  };

  const handleReminderTimeChange = async (time: string) => {
    if (!currentProfile?.id) return;
    setSavingReminder(true);
    try {
      await remindersAPI.updatePreferences(currentProfile.id, {
        enabled: reminderEnabled,
        time: time
      });
      setReminderTime(time);
    } catch (error) {
      console.error('Failed to update reminder time:', error);
    } finally {
      setSavingReminder(false);
    }
  };

  const claimLoginBonus = async () => {
    if (!currentProfile || claimingBonus) return;
    try {
      setClaimingBonus(true);
      const res = await gamificationAPI.claimLoginBonus(currentProfile.id);
      setLoginBonusData({
        claimed: true,
        consecutive_days: res.data.consecutive_days,
        points_earned: res.data.points_earned
      });
      setBonusClaimed(true);
      playSounds.bonusClaimed();

      const statsRes = await profilesAPI.getStats(currentProfile.id);
      setStats(statsRes.data);

      setTimeout(() => {
        setShowLoginBonus(false);
        setBonusClaimed(false);
      }, 3000);
    } catch (error) {
      console.error('Failed to claim login bonus:', error);
    } finally {
      setClaimingBonus(false);
    }
  };

  const acknowledgeSurpriseBonus = async () => {
    if (surpriseBonusData?.id) {
      try {
        await notificationsAPI.markAsRead(surpriseBonusData.id);
      } catch (e) {
        console.error('Failed to mark notification as read:', e);
      }
    }
    setShowSurpriseBonus(false);
    setSurpriseBonusData(null);
    if (currentProfile) {
      const statsRes = await profilesAPI.getStats(currentProfile.id);
      setStats(statsRes.data);
    }
  };

  const handleTaskComplete = async (taskId: number) => {
    try {
      await tasksAPI.complete(taskId);
      playSounds.taskComplete();

      // Find the completed task to add to completedToday
      const completedTask = allTasks.find(t => t.id === taskId);
      if (completedTask) {
        setCompletedTodayTasks(prev => [{ ...completedTask, completed: true, completed_at: new Date().toISOString() }, ...prev]);
      }

      // Remove from all lists
      setAllTasks(prev => prev.filter(t => t.id !== taskId));
      setOverdueTasks(prev => prev.filter(t => t.id !== taskId));
      setTodayTasks(prev => prev.filter(t => t.id !== taskId));
      setUpcomingTasks(prev => prev.filter(t => t.id !== taskId));
      setOtherTasks(prev => prev.filter(t => t.id !== taskId));

      if (currentProfile) {
        const statsRes = await profilesAPI.getStats(currentProfile.id);
        setStats(statsRes.data);
      }
    } catch (e: any) {
      console.error('Failed to complete task:', e);
    }
  };

  // Mission Control handlers
  const handleStartMission = (task: Task) => {
    // Only start if task requires timer
    const hasTimer = task.requires_timer === 1 || task.requires_timer === true;
    if (hasTimer) {
      setActiveMission(task);
    } else {
      // For non-timer tasks, complete directly
      handleTaskComplete(task.id);
    }
  };

  const handleMissionComplete = async (taskId: number, pointsEarned: number, starsEarned: number, timeSpent: number) => {
    // Find the task before removing it
    const completedTask = activeMission || allTasks.find(t => t.id === taskId);

    if (completedTask) {
      // Show celebration modal
      setMissionCompleteData({
        task: completedTask,
        pointsEarned,
        starsEarned,
        timeSpent
      });
      setShowMissionComplete(true);

      // Add to completed today list
      setCompletedTodayTasks(prev => [{
        ...completedTask,
        completed: true,
        completed_at: new Date().toISOString()
      }, ...prev]);
    }

    // Remove from all lists
    setAllTasks(prev => prev.filter(t => t.id !== taskId));
    setOverdueTasks(prev => prev.filter(t => t.id !== taskId));
    setTodayTasks(prev => prev.filter(t => t.id !== taskId));
    setUpcomingTasks(prev => prev.filter(t => t.id !== taskId));
    setOtherTasks(prev => prev.filter(t => t.id !== taskId));

    // Clear active mission
    setActiveMission(null);

    // Refresh stats
    if (currentProfile) {
      const statsRes = await profilesAPI.getStats(currentProfile.id);
      setStats(statsRes.data);
    }
  };

  const handleCloseMissionComplete = () => {
    setShowMissionComplete(false);
    setMissionCompleteData(null);
  };

  const handleCancelMission = () => {
    setActiveMission(null);
  };

  const logWater = async (amount: number) => {
    if (!currentProfile) return;
    try {
      await gamificationAPI.logWater(currentProfile.id, amount);
      playSounds.waterLogged();
      const waterRes = await gamificationAPI.getWater(currentProfile.id);
      setWaterData({ total_ml: waterRes.data.total_ml, goal_ml: waterRes.data.goal_ml });
      const challengesRes = await gamificationAPI.getChallenges(currentProfile.id);
      setChallenges(challengesRes.data);
    } catch (error) {
      console.error('Failed to log water:', error);
    }
  };

  const claimChallenge = async (challengeId: number) => {
    try {
      await gamificationAPI.completeChallenge(challengeId);
      playSounds.challengeComplete();
      if (currentProfile) {
        const [challengesRes, statsRes] = await Promise.all([
          gamificationAPI.getChallenges(currentProfile.id),
          profilesAPI.getStats(currentProfile.id)
        ]);
        setChallenges(challengesRes.data);
        setStats(statsRes.data);
      }
    } catch (error) {
      console.error('Failed to claim challenge:', error);
    }
  };

  const updateCustomChallengeProgress = async (challengeId: number) => {
    try {
      const result = await aiGamificationAPI.updateChallengeProgress(challengeId);
      if (result.data.just_completed) {
        playSounds.challengeComplete();
      } else {
        playSounds.pointsEarned();
      }
      await refreshCustomChallenges();
    } catch (error) {
      console.error('Failed to update custom challenge:', error);
    }
  };

  const refreshCustomChallenges = async () => {
    if (!currentProfile) return;
    try {
      const [challengesRes, statsRes] = await Promise.all([
        aiGamificationAPI.getChallenges(currentProfile.id).catch(() => ({ data: [] })),
        profilesAPI.getStats(currentProfile.id)
      ]);
      setCustomChallenges(challengesRes.data || []);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to refresh custom challenges:', error);
    }
  };

  const updateAvatar = async (emoji: string) => {
    if (!currentProfile || savingAvatar) return;
    setSavingAvatar(true);
    try {
      await profilesAPI.update(currentProfile.id, { avatar: emoji });
      window.location.reload();
    } catch (error) {
      console.error('Failed to update avatar:', error);
    } finally {
      setSavingAvatar(false);
    }
  };

  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  const level = stats?.progress?.level || 1;
  const totalPoints = stats?.progress?.total_points || 0;
  const totalStars = stats?.progress?.total_stars || 0;
  const completedTasks = stats?.tasks?.completed_tasks || 0;
  const totalOverdue = overdueTasks.length;
  const pendingChallenges = challenges.filter(c => c.completed !== 1).length + customChallenges.filter(c => !c.completed).length;

  // ============================================
  // YOUNG CHILD VIEW (Ages 5-6) - Keep Simple
  // ============================================
  if (isYoungChild) {
    return (
      <YoungChildDashboard
        currentProfile={currentProfile}
        settings={settings}
        stats={stats}
        totalStars={totalStars}
        level={level}
        completedTasks={completedTasks}
        allTasks={[...todayTasks, ...otherTasks].slice(0, 4)}
        onTaskComplete={handleTaskComplete}
        showLevelUp={showLevelUp}
        newLevel={newLevel}
        setShowLevelUp={setShowLevelUp}
        showLoginBonus={showLoginBonus}
        loginBonusData={loginBonusData}
        bonusClaimed={bonusClaimed}
        claimingBonus={claimingBonus}
        claimLoginBonus={claimLoginBonus}
        setShowLoginBonus={setShowLoginBonus}
        showSurpriseBonus={showSurpriseBonus}
        surpriseBonusData={surpriseBonusData}
        acknowledgeSurpriseBonus={acknowledgeSurpriseBonus}
        showAvatarPicker={showAvatarPicker}
        setShowAvatarPicker={setShowAvatarPicker}
        updateAvatar={updateAvatar}
        savingAvatar={savingAvatar}
        reminderEnabled={reminderEnabled}
        reminderTime={reminderTime}
        toggleReminder={toggleReminder}
        handleReminderTimeChange={handleReminderTimeChange}
        savingReminder={savingReminder}
      />
    );
  }

  // ============================================
  // REGULAR VIEW (Ages 7+) - Clean Tabbed Layout
  // ============================================
  return (
    <div className={`max-w-4xl mx-auto px-4 pb-10 ${settings.themeClass}`}>
      {/* === MODALS === */}
      {showLevelUp && <LevelUpModal level={newLevel} onClose={() => setShowLevelUp(false)} />}

      {showLoginBonus && loginBonusData && (
        <LoginBonusModal
          data={loginBonusData}
          claimed={bonusClaimed}
          claiming={claimingBonus}
          onClaim={claimLoginBonus}
          onClose={() => setShowLoginBonus(false)}
        />
      )}

      {showSurpriseBonus && surpriseBonusData && (
        <SurpriseBonusModal data={surpriseBonusData} onClose={acknowledgeSurpriseBonus} />
      )}

      {showAvatarPicker && (
        <AvatarPickerModal
          level={level}
          currentAvatar={currentProfile?.avatar}
          onSelect={updateAvatar}
          onClose={() => setShowAvatarPicker(false)}
          saving={savingAvatar}
        />
      )}

      {showSettings && (
        <SettingsModal
          reminderEnabled={reminderEnabled}
          reminderTime={reminderTime}
          onToggleReminder={toggleReminder}
          onTimeChange={handleReminderTimeChange}
          saving={savingReminder}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Mission Complete Modal */}
      {showMissionComplete && missionCompleteData && (
        <MissionCompleteModal
          task={missionCompleteData.task}
          pointsEarned={missionCompleteData.pointsEarned}
          starsEarned={missionCompleteData.starsEarned}
          timeSpent={missionCompleteData.timeSpent}
          onClose={handleCloseMissionComplete}
        />
      )}

      {/* === HEADER === */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowAvatarPicker(true)}
            className="relative group"
          >
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center ring-4 ring-purple-200 overflow-hidden group-hover:ring-purple-300 transition-all">
              <Avatar avatar={currentProfile?.avatar} size="lg" alt={currentProfile?.name || ''} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {level}
            </div>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Hey {currentProfile?.name?.split(' ')[0]}! 👋</h1>
            <p className="text-sm text-gray-500">Level {level} • {totalPoints} pts</p>
          </div>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <Settings size={22} className="text-gray-500" />
        </button>
      </div>

      {/* === ALERT BANNER === */}
      {totalOverdue > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-red-800">{totalOverdue} task{totalOverdue > 1 ? 's' : ''} overdue!</p>
            <p className="text-sm text-red-600">Complete them to keep your streak!</p>
          </div>
          <button
            onClick={() => setActiveTab('tasks')}
            className="text-sm font-medium text-red-700 hover:text-red-800 flex items-center gap-1"
          >
            View <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* === QUICK STATS === */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-3 text-center border border-amber-100">
          <Star className="w-5 h-5 text-amber-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-amber-700">{totalStars}</p>
          <p className="text-xs text-amber-600">Stars</p>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-3 text-center border border-orange-100">
          <Flame className="w-5 h-5 text-orange-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-orange-700">{streaks?.tasks?.current || 0}</p>
          <p className="text-xs text-orange-600">Streak</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-3 text-center border border-green-100">
          <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-green-700">{completedTasks}</p>
          <p className="text-xs text-green-600">Done</p>
        </div>
        <div className="bg-gradient-to-br from-sky-50 to-blue-50 rounded-xl p-3 text-center border border-sky-100">
          <Droplets className="w-5 h-5 text-sky-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-sky-700">{Math.round((waterData.total_ml / waterData.goal_ml) * 100)}%</p>
          <p className="text-xs text-sky-600">Water</p>
        </div>
      </div>

      {/* === TAB NAVIGATION === */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl">
        {[
          { id: 'home', label: 'Home', icon: Home },
          { id: 'tasks', label: 'Tasks', icon: ListTodo, badge: totalOverdue > 0 ? totalOverdue : undefined },
          { id: 'challenges', label: 'Challenges', icon: Zap, badge: pendingChallenges > 0 ? pendingChallenges : undefined },
          { id: 'rewards', label: 'Rewards', icon: Gift },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as DashboardTab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
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

      {/* === TAB CONTENT === */}
      {activeTab === 'home' && (
        <div className="space-y-4">
          {/* ACTIVE MISSION (Hero Section) */}
          {activeMission && (
            <ActiveMissionCard
              task={activeMission}
              onComplete={handleMissionComplete}
              onCancel={handleCancelMission}
            />
          )}

          {/* Mission Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Today's Missions */}
            <TodaysMissions
              tasks={[...todayTasks, ...otherTasks].filter(t => t.id !== activeMission?.id)}
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

          {/* Water Tracker */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Droplets className="w-5 h-5 text-sky-500" />
              <p className="font-bold text-gray-900">Water Today</p>
              <span className="ml-auto text-sm text-gray-500">{waterData.total_ml} / {waterData.goal_ml} ml</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full mb-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all"
                style={{ width: `${Math.min((waterData.total_ml / waterData.goal_ml) * 100, 100)}%` }}
              />
            </div>
            <div className="flex gap-2">
              {[150, 250, 500].map((amt) => (
                <button
                  key={amt}
                  onClick={() => logWater(amt)}
                  className="flex-1 py-2 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg text-sm font-semibold text-sky-700 transition-colors"
                >
                  +{amt}ml
                </button>
              ))}
            </div>
          </div>

          {/* Quick Actions - filtered by feature access */}
          <div className="grid grid-cols-4 gap-3">
            {isFeatureEnabled('tasks') && (
              <Link to="/tasks" className="bg-gradient-to-br from-blue-100 to-cyan-100 hover:from-blue-200 hover:to-cyan-200 rounded-xl p-3 text-center transition-all">
                <ListTodo className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                <p className="text-xs font-semibold text-gray-700">Tasks</p>
              </Link>
            )}
            {isFeatureEnabled('quizzes') && (
              <Link to="/quizzes" className="bg-gradient-to-br from-violet-100 to-purple-100 hover:from-violet-200 hover:to-purple-200 rounded-xl p-3 text-center transition-all">
                <Gamepad2 className="w-6 h-6 text-violet-600 mx-auto mb-1" />
                <p className="text-xs font-semibold text-gray-700">Quizzes</p>
              </Link>
            )}
            {isFeatureEnabled('rewards') && (
              <Link to="/shop" className="bg-gradient-to-br from-green-100 to-emerald-100 hover:from-green-200 hover:to-emerald-200 rounded-xl p-3 text-center transition-all">
                <ShoppingBag className="w-6 h-6 text-green-600 mx-auto mb-1" />
                <p className="text-xs font-semibold text-gray-700">Shop</p>
              </Link>
            )}
            {isFeatureEnabled('ai') && currentProfile?.ai_enabled === 1 && (
              <Link to="/ai" className="bg-gradient-to-br from-indigo-100 to-blue-100 hover:from-indigo-200 hover:to-blue-200 rounded-xl p-3 text-center transition-all">
                <Brain className="w-6 h-6 text-indigo-600 mx-auto mb-1" />
                <p className="text-xs font-semibold text-gray-700">AI Help</p>
              </Link>
            )}
          </div>

          {/* Top Goal Preview */}
          {activeGoals.length > 0 && (
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border border-violet-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{activeGoals[0].reward_image || getGoalTypeDisplay(activeGoals[0].goal_type).emoji}</span>
                  <div>
                    <p className="font-bold text-gray-900">{activeGoals[0].goal_description}</p>
                    <p className="text-sm text-gray-500">{activeGoals[0].current_points || 0} / {activeGoals[0].goal_points} pts</p>
                  </div>
                </div>
                <button onClick={() => setActiveTab('rewards')} className="text-sm text-violet-600 font-medium">View all</button>
              </div>
              <div className="h-2 bg-violet-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all"
                  style={{ width: `${Math.min(((activeGoals[0].current_points || 0) / activeGoals[0].goal_points) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {/* Overdue Tasks */}
          {overdueTasks.length > 0 && (
            <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
              <div className="p-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="font-bold text-red-800">Overdue ({overdueTasks.length})</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {overdueTasks.map(task => (
                  <TaskCard key={task.id} task={task} onComplete={handleTaskComplete} formatDueDate={formatDueDate} isOverdue />
                ))}
              </div>
            </div>
          )}

          {/* Today's Tasks */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="p-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-amber-800">Due Today ({todayTasks.length})</h3>
            </div>
            {todayTasks.length === 0 ? (
              <div className="p-6 text-center">
                <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                <p className="text-gray-500">Nothing due today!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {todayTasks.map(task => (
                  <TaskCard key={task.id} task={task} onComplete={handleTaskComplete} formatDueDate={formatDueDate} />
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Tasks */}
          {upcomingTasks.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="p-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                <h3 className="font-bold text-blue-800">Coming Up ({upcomingTasks.length})</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {upcomingTasks.map(task => (
                  <TaskCard key={task.id} task={task} onComplete={handleTaskComplete} formatDueDate={formatDueDate} />
                ))}
              </div>
            </div>
          )}

          {/* Other Tasks */}
          {otherTasks.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="p-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-gray-500" />
                <h3 className="font-bold text-gray-800">Other Tasks ({otherTasks.length})</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {otherTasks.map(task => (
                  <TaskCard key={task.id} task={task} onComplete={handleTaskComplete} formatDueDate={formatDueDate} />
                ))}
              </div>
            </div>
          )}

          {allTasks.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
              <p className="text-lg font-semibold text-gray-900">All tasks completed!</p>
              <p className="text-gray-500">Great job! Check back later for more.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'challenges' && (
        <div className="space-y-4">
          {/* Daily Challenges */}
          {challenges.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="p-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-amber-800">Daily Challenges</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {challenges.map((challenge) => (
                  <ChallengeCard
                    key={challenge.id}
                    challenge={challenge}
                    onClaim={() => claimChallenge(challenge.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* AI Challenges */}
          {customChallenges.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="p-3 bg-purple-50 border-b border-purple-100 flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-500" />
                <h3 className="font-bold text-purple-800">Special Challenges</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {customChallenges.map((challenge, index) => {
                  const requiresTimer = challenge.requires_timer === true || challenge.requires_timer === 1;
                  if (requiresTimer) {
                    return (
                      <div key={challenge.id} className="p-4">
                        <ChallengeTimerCard
                          challenge={challenge}
                          onUpdate={refreshCustomChallenges}
                          index={index}
                        />
                      </div>
                    );
                  }
                  return (
                    <CustomChallengeCard
                      key={challenge.id}
                      challenge={challenge}
                      onProgress={() => updateCustomChallengeProgress(challenge.id)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Boosters */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="p-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
              <Star className="w-5 h-5 text-gray-500" />
              <h3 className="font-bold text-gray-800">Bonus Games</h3>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <CountdownChallengeCard
                profileId={currentProfile?.id || 0}
                onChallengeComplete={() => {
                  if (currentProfile) {
                    profilesAPI.getStats(currentProfile.id).then(res => setStats(res.data));
                  }
                }}
              />
              <SpinWheel
                profileId={currentProfile?.id || 0}
                onSpinComplete={() => {
                  if (currentProfile) {
                    profilesAPI.getStats(currentProfile.id).then(res => setStats(res.data));
                  }
                }}
              />
            </div>
          </div>

          {challenges.length === 0 && customChallenges.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <Zap className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No challenges right now. Check back later!</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'rewards' && (
        <div className="space-y-4">
          {/* Active Goals */}
          {activeGoals.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="p-3 bg-violet-50 border-b border-violet-100 flex items-center gap-2">
                <Target className="w-5 h-5 text-violet-500" />
                <h3 className="font-bold text-violet-800">My Goals</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {activeGoals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} />
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
              <Target className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No active goals. Ask your parent to set one!</p>
            </div>
          )}

          {/* Shop Link - only if rewards feature enabled */}
          {isFeatureEnabled('rewards') && (
            <Link to="/shop" className="block bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-xl">
                  <ShoppingBag className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-900">Reward Shop</p>
                  <p className="text-sm text-gray-500">Spend your points on cool rewards!</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </Link>
          )}

          {/* Achievements */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="p-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-amber-800">Achievements</h3>
            </div>
            <div className="p-4">
              <HiddenAchievements profileId={currentProfile?.id || 0} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// COMPONENT: Task Card
// ============================================
function TaskCard({ task, onComplete, formatDueDate, isOverdue = false }: {
  task: Task;
  onComplete: (id: number) => void;
  formatDueDate: (date: string) => string;
  isOverdue?: boolean;
}) {
  const hasTimer = task.requires_timer === 1 || task.requires_timer === true;

  return (
    <div className={`p-3 hover:bg-gray-50 transition-colors ${isOverdue ? 'bg-red-50/50' : ''}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => !hasTimer && onComplete(task.id)}
          disabled={hasTimer}
          className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
            hasTimer
              ? 'border-gray-300 bg-gray-100 cursor-not-allowed'
              : 'border-gray-300 hover:border-green-500 hover:bg-green-50'
          }`}
        >
          {hasTimer && <Clock size={12} className="text-gray-400" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900">{task.title}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{task.category}</span>
            <span className="text-xs text-amber-600 font-medium">+{task.points} pts</span>
            {task.due_date && (
              <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-blue-600'}`}>
                {formatDueDate(task.due_date)}
              </span>
            )}
            {hasTimer && (
              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full flex items-center gap-1">
                <Clock size={10} /> Timer required
              </span>
            )}
          </div>
        </div>
        {hasTimer && (
          <Link to="/tasks" className="text-sm text-purple-600 font-medium">
            Start
          </Link>
        )}
      </div>
    </div>
  );
}

// ============================================
// COMPONENT: Challenge Card
// ============================================
function ChallengeCard({ challenge, onClaim }: { challenge: DailyChallenge; onClaim: () => void }) {
  const progress = Math.min(100, (challenge.current_progress / challenge.target_value) * 100);
  const isComplete = challenge.current_progress >= challenge.target_value;
  const isClaimed = challenge.completed === 1;

  return (
    <div className={`p-4 ${isClaimed ? 'bg-green-50' : isComplete ? 'bg-amber-50' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className={`font-medium ${isClaimed ? 'text-green-700' : 'text-gray-900'}`}>
            {isClaimed && <CheckCircle size={14} className="inline mr-1 text-green-600" />}
            {challenge.description}
          </p>
          <p className="text-xs text-gray-500">+{challenge.bonus_points} bonus pts</p>
        </div>
        {isComplete && !isClaimed && (
          <button
            onClick={onClaim}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold"
          >
            Claim!
          </button>
        )}
      </div>
      {!isClaimed && (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${isComplete ? 'bg-amber-500' : 'bg-blue-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-600">{challenge.current_progress}/{challenge.target_value}</span>
        </div>
      )}
    </div>
  );
}

// ============================================
// COMPONENT: Custom Challenge Card
// ============================================
function CustomChallengeCard({ challenge, onProgress }: { challenge: CustomChallenge; onProgress: () => void }) {
  const progress = Math.min(100, (challenge.current_progress / challenge.target_value) * 100);
  const isComplete = challenge.current_progress >= challenge.target_value;

  return (
    <div className={`p-4 ${challenge.completed ? 'bg-green-50' : isComplete ? 'bg-purple-50' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className={`font-medium ${challenge.completed ? 'text-green-700' : 'text-gray-900'}`}>
              {challenge.completed && <CheckCircle size={14} className="inline mr-1 text-green-600" />}
              {challenge.title}
            </p>
            <span className="text-xs px-1.5 py-0.5 bg-purple-200 text-purple-800 rounded">AI</span>
          </div>
          <p className="text-sm text-gray-600">{challenge.description}</p>
          <p className="text-xs text-purple-600">+{Math.round(challenge.points_reward * challenge.bonus_multiplier)} pts</p>
        </div>
        {!challenge.completed && challenge.target_value > 1 && (
          <button
            onClick={onProgress}
            className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-bold"
          >
            +1
          </button>
        )}
      </div>
      {!challenge.completed && (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-purple-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-600">{challenge.current_progress}/{challenge.target_value}</span>
        </div>
      )}
    </div>
  );
}

// ============================================
// COMPONENT: Goal Card
// ============================================
function GoalCard({ goal }: { goal: GoalWithMilestones }) {
  const progress = goal.goal_points > 0 ? Math.min(100, ((goal.current_points || 0) / goal.goal_points) * 100) : 0;

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{goal.reward_image || getGoalTypeDisplay(goal.goal_type).emoji}</span>
        <div className="flex-1">
          <p className="font-bold text-gray-900">{goal.goal_description}</p>
          <p className="text-sm text-gray-500">{goal.current_points || 0} / {goal.goal_points} pts</p>
        </div>
        <span className="text-sm font-bold text-violet-600">{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className="bg-gradient-to-r from-violet-500 to-purple-500 h-3 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ============================================
// COMPONENT: Settings Modal
// ============================================
function SettingsModal({
  reminderEnabled,
  reminderTime,
  onToggleReminder,
  onTimeChange,
  saving,
  onClose
}: {
  reminderEnabled: boolean;
  reminderTime: string;
  onToggleReminder: () => void;
  onTimeChange: (time: string) => void;
  saving: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Settings</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {/* Reminders */}
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-500" />
                <span className="font-semibold text-gray-900">Daily Reminder</span>
              </div>
              <button
                onClick={onToggleReminder}
                disabled={saving}
                className={`w-12 h-6 rounded-full transition-colors ${
                  reminderEnabled ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  reminderEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
            {reminderEnabled && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Remind me at:</span>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => onTimeChange(e.target.value)}
                  disabled={saving}
                  className="px-2 py-1 border border-amber-200 rounded-lg text-sm"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// YOUNG CHILD DASHBOARD COMPONENT
// ============================================
function YoungChildDashboard({
  currentProfile,
  settings,
  totalStars,
  level,
  completedTasks,
  allTasks,
  onTaskComplete,
  showLevelUp,
  newLevel,
  setShowLevelUp,
  showLoginBonus,
  loginBonusData,
  bonusClaimed,
  claimingBonus,
  claimLoginBonus,
  setShowLoginBonus,
  showSurpriseBonus,
  surpriseBonusData,
  acknowledgeSurpriseBonus,
  showAvatarPicker,
  setShowAvatarPicker,
  updateAvatar,
  savingAvatar,
  reminderEnabled,
  reminderTime,
  toggleReminder,
  handleReminderTimeChange,
  savingReminder
}: any) {
  return (
    <div className={`max-w-2xl mx-auto px-4 pb-8 ${settings.themeClass}`}>
      {showLevelUp && <LevelUpModal level={newLevel} onClose={() => setShowLevelUp(false)} />}

      {showLoginBonus && loginBonusData && (
        <LoginBonusModal
          data={loginBonusData}
          claimed={bonusClaimed}
          claiming={claimingBonus}
          onClaim={claimLoginBonus}
          onClose={() => setShowLoginBonus(false)}
        />
      )}

      {showSurpriseBonus && surpriseBonusData && (
        <SurpriseBonusModal data={surpriseBonusData} onClose={acknowledgeSurpriseBonus} />
      )}

      {/* Avatar with greeting */}
      <div className="text-center mb-6">
        <button
          onClick={() => setShowAvatarPicker(true)}
          className="w-20 h-20 mx-auto mb-3 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-4xl shadow-lg hover:scale-110 transition-transform ring-4 ring-yellow-300 overflow-hidden"
        >
          <Avatar avatar={currentProfile?.avatar} size="xl" alt={currentProfile?.name || 'Avatar'} />
        </button>
        <p className="text-xs text-slate-500 mb-1">Tap to change!</p>
        <h1 className="text-2xl font-bold text-slate-800">Hi {currentProfile?.name?.split(' ')[0]}! 🐯</h1>
        <p className="text-sm text-slate-600">Your hero squad is ready!</p>

        <div className="mt-3 flex justify-center gap-3">
          <div className="bg-yellow-100 px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <span className="text-xl">⭐</span>
            <span className="text-lg font-bold text-yellow-700">{totalStars}</span>
          </div>
          <div className="bg-purple-100 px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <span className="text-xl">🛡️</span>
            <span className="text-lg font-bold text-purple-700">Lv {level}</span>
          </div>
        </div>
      </div>

      {/* Reminder Widget */}
      <div className="mb-6">
        <ReminderWidget
          enabled={reminderEnabled}
          time={reminderTime}
          onToggle={toggleReminder}
          onTimeChange={handleReminderTimeChange}
          saving={savingReminder}
          compact
        />
      </div>

      {/* Today's Tasks */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-center text-slate-700 mb-4">Today's Jobs 🦸</h2>
        <SimpleTaskGrid tasks={allTasks} onComplete={onTaskComplete} />
      </div>

      {/* Completed count */}
      {completedTasks > 0 && (
        <div className="text-center py-3">
          <div className="inline-flex items-center gap-2 bg-green-100 px-5 py-2 rounded-full">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <span className="text-lg font-bold text-green-700">{completedTasks} Done!</span>
          </div>
        </div>
      )}

      {/* Avatar Picker Modal */}
      {showAvatarPicker && (
        <AvatarPickerModal
          level={level}
          currentAvatar={currentProfile?.avatar}
          onSelect={updateAvatar}
          onClose={() => setShowAvatarPicker(false)}
          saving={savingAvatar}
          isYoungChild
        />
      )}
    </div>
  );
}

// ============================================
// MODAL COMPONENTS
// ============================================

function LevelUpModal({ level, onClose }: { level: number; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative bg-gradient-to-br from-yellow-400 via-orange-500 to-pink-500 p-8 rounded-3xl shadow-2xl text-center animate-bounce-slow max-w-sm mx-4">
        <div className="text-7xl mb-4 animate-pulse">🎉</div>
        <h2 className="text-3xl font-black text-white mb-2">LEVEL UP!</h2>
        <div className="text-6xl font-black text-white mb-4">{level}</div>
        <p className="text-lg text-white/90 mb-6">Amazing work! 🚀</p>
        <button
          onClick={onClose}
          className="px-6 py-3 bg-white text-orange-600 rounded-full font-bold text-lg hover:bg-yellow-100 transition-colors"
        >
          Awesome! 🌟
        </button>
      </div>
    </div>
  );
}

function LoginBonusModal({
  data,
  claimed,
  claiming,
  onClaim,
  onClose
}: {
  data: { claimed: boolean; consecutive_days: number; points_to_earn?: number; points_earned?: number };
  claimed: boolean;
  claiming: boolean;
  onClaim: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn p-4">
      <div className="relative bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 p-6 rounded-3xl shadow-2xl text-center max-w-sm w-full">
        <button onClick={onClose} className="absolute top-3 right-3 text-white/70 hover:text-white">
          <X size={24} />
        </button>

        {claimed ? (
          <>
            <div className="text-6xl mb-4 animate-bounce">🎁</div>
            <h2 className="text-2xl font-black text-white mb-2">Bonus Claimed!</h2>
            <div className="text-3xl font-black text-yellow-200">+{data.points_earned} points</div>
            <p className="text-white/90 mt-2">Day {data.consecutive_days} streak! 🔥</p>
          </>
        ) : (
          <>
            <div className="text-5xl mb-3">🌟</div>
            <h2 className="text-2xl font-black text-white mb-1">Daily Bonus!</h2>
            <p className="text-white/80 text-sm mb-3">Day {data.consecutive_days} of 7</p>

            <div className="flex justify-center gap-1 mb-4">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <div
                  key={day}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    day < data.consecutive_days ? 'bg-yellow-400 text-yellow-900' :
                    day === data.consecutive_days ? 'bg-white text-teal-600 ring-2 ring-yellow-300' :
                    'bg-white/30 text-white/60'
                  }`}
                >
                  {day === 7 ? '🏆' : day}
                </div>
              ))}
            </div>

            <div className="bg-white/20 rounded-xl p-4 mb-4">
              <p className="text-white/80 text-sm">Today's Reward</p>
              <div className="text-3xl font-black text-yellow-200">+{data.points_to_earn} points</div>
            </div>

            <button
              onClick={onClaim}
              disabled={claiming}
              className="w-full py-3 bg-yellow-400 text-teal-800 rounded-full font-bold text-lg hover:bg-yellow-300 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {claiming ? (
                <><div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /> Claiming...</>
              ) : (
                <><Gift size={20} /> Claim Bonus!</>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SurpriseBonusModal({
  data,
  onClose
}: {
  data: { points: number; stars: number; reason: string; awardedBy: string };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn p-4">
      <div className="relative bg-gradient-to-br from-pink-400 via-purple-500 to-indigo-500 p-6 rounded-3xl shadow-2xl text-center max-w-sm w-full animate-bounce-slow">
        <div className="text-6xl mb-4 animate-bounce">🎁</div>
        <h2 className="text-2xl font-black text-white mb-2">Surprise Bonus!</h2>
        <p className="text-white/90 mb-3">{data.awardedBy} sent you a gift!</p>

        <div className="bg-white/20 rounded-xl p-4 mb-4">
          {data.points > 0 && <div className="text-3xl font-black text-yellow-200">+{data.points} points</div>}
          {data.stars > 0 && (
            <div className="text-2xl font-bold text-yellow-200 flex items-center justify-center gap-1">
              +{data.stars} <Star className="w-6 h-6 fill-current" />
            </div>
          )}
          {data.reason && <p className="text-white/80 text-sm mt-2 italic">"{data.reason}"</p>}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-yellow-400 text-purple-800 rounded-full font-bold text-lg hover:bg-yellow-300 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Gift size={20} /> Awesome! Thanks!
        </button>
      </div>
    </div>
  );
}

function AvatarPickerModal({
  level,
  currentAvatar,
  onSelect,
  onClose,
  saving,
  isYoungChild = false
}: {
  level: number;
  currentAvatar?: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  saving: boolean;
  isYoungChild?: boolean;
}) {
  const [categoryIndex, setCategoryIndex] = useState(0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-hidden">
        <div className={`p-4 ${isYoungChild ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'} text-white`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{isYoungChild ? 'Pick Your Avatar! 🎨' : 'Choose Your Avatar'}</h2>
              <p className="text-sm text-white/80">Level {level} - Unlock more!</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex border-b overflow-x-auto">
          {AVATAR_CATEGORIES.map((cat, idx) => (
            <button
              key={cat.name}
              onClick={() => setCategoryIndex(idx)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${
                categoryIndex === idx
                  ? 'border-b-2 border-purple-500 text-purple-600 bg-purple-50'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="p-4 overflow-y-auto max-h-[50vh]">
          <div className="grid grid-cols-4 gap-3">
            {AVATAR_CATEGORIES[categoryIndex].avatars.map((avatar) => {
              const isUnlocked = level >= avatar.minLevel;
              const isSelected = currentAvatar === avatar.emoji;

              return (
                <button
                  key={avatar.emoji}
                  onClick={() => isUnlocked && onSelect(avatar.emoji)}
                  disabled={!isUnlocked || saving}
                  className={`relative p-3 rounded-xl transition-all ${
                    isSelected ? 'bg-purple-100 ring-2 ring-purple-500 scale-105' :
                    isUnlocked ? 'bg-slate-50 hover:bg-slate-100 hover:scale-105' :
                    'bg-slate-100 opacity-50 cursor-not-allowed'
                  }`}
                  title={isUnlocked ? avatar.label : `Unlock at Level ${avatar.minLevel}`}
                >
                  <span className="text-3xl block">{avatar.emoji}</span>
                  {!isUnlocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 rounded-xl">
                      <div className="text-center">
                        <Lock size={12} className="text-white mx-auto" />
                        <span className="text-[10px] text-white font-bold">Lv{avatar.minLevel}</span>
                      </div>
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                      <CheckCircle size={10} className="text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t text-center">
          <p className="text-sm text-slate-600">
            {AVATAR_CATEGORIES.flatMap(c => c.avatars).filter(a => level >= a.minLevel).length} of{' '}
            {AVATAR_CATEGORIES.flatMap(c => c.avatars).length} unlocked
          </p>
        </div>
      </div>
    </div>
  );
}
