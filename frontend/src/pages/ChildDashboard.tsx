import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { useAge } from '../context/AgeContext';
import { useFeatureFlags } from '../context/FeatureFlagsContext';
import { tasksAPI } from '../services/api';
import { profilesAPI, gamificationAPI, goalsAPI, aiGamificationAPI, remindersAPI, notificationsAPI, GoalWithMilestones, CustomChallenge, EconomySettings } from '../services/api';
import { ProfileStats } from '../types';
import { Star, Target, Zap, CheckCircle, Lock, X, Gift, ChevronRight, ChevronDown } from 'lucide-react';
import CountdownChallengeCard from '../components/CountdownChallengeCard';
import SpinWheel from '../components/SpinWheel';
import HiddenAchievements from '../components/HiddenAchievements';
import Avatar from '../components/Avatar';
import ChallengeTimerCard from '../components/ChallengeTimerCard';
import playSounds from '../utils/sounds';

// Kid-friendly components
import { HeroStats } from '../components/kids/QuickStats';
import ReminderWidget from '../components/kids/ReminderWidget';
import { SimpleTaskGrid } from '../components/SimpleTaskCard';

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


export default function ChildDashboard() {
  const { currentProfile } = useProfile();
  const { isYoungChild, settings } = useAge();
  const { flags: featureFlags } = useFeatureFlags();
  const [simpleTasks, setSimpleTasks] = useState<any[]>([]);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [waterData, setWaterData] = useState<{ total_ml: number; goal_ml: number }>({ total_ml: 0, goal_ml: 2000 });
  const [streaks, setStreaks] = useState<Record<string, { current: number; longest: number }>>({});
  const [, setAchievements] = useState<{ earned: any[]; total_count: number }>({ earned: [], total_count: 0 });
  const [challenges, setChallenges] = useState<DailyChallenge[]>([]);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(0);
  const [prevLevel, setPrevLevel] = useState<number | null>(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [activeGoals, setActiveGoals] = useState<GoalWithMilestones[]>([]);

  // Reminder state
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('07:30');
  const [savingReminder, setSavingReminder] = useState(false);

  // AI Custom Challenges state
  const [customChallenges, setCustomChallenges] = useState<CustomChallenge[]>([]);

  // Economy limits state
  const [economyData, setEconomyData] = useState<{
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

  // Collapsible sections
  const [showChallenges, setShowChallenges] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [showBoosters, setShowBoosters] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);

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
    let dayTimer: ReturnType<typeof setTimeout> | null = null;
    let dayInterval: ReturnType<typeof setInterval> | null = null;

    const scheduleNextCheck = () => {
      const now = new Date();
      const nextLocalDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        1,
        0
      );
      const delayMs = Math.max(1000, nextLocalDay.getTime() - now.getTime());
      dayTimer = setTimeout(() => {
        checkLoginBonus();
        dayInterval = setInterval(checkLoginBonus, 24 * 60 * 60 * 1000);
      }, delayMs);
    };

    scheduleNextCheck();
    return () => {
      if (dayTimer) clearTimeout(dayTimer);
      if (dayInterval) clearInterval(dayInterval);
    };
  }, [currentProfile, loading]);

  // Claim login bonus
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

  // Load simplified tasks
  useEffect(() => {
    if (!currentProfile) return;

    const loadTasks = async () => {
      try {
        const res = await tasksAPI.getByProfile(currentProfile.id);
        const incompleteTasks = res.data.filter((t: any) => !t.completed);
        setSimpleTasks(isYoungChild ? incompleteTasks.slice(0, 4) : incompleteTasks.slice(0, 6));
      } catch (e) {
        console.error('Failed to load tasks:', e);
      }
    };

    loadTasks();
  }, [currentProfile, isYoungChild]);

  // Handle task completion
  const handleTaskComplete = async (taskId: number) => {
    try {
      setSimpleTasks(prev => prev.filter(t => t.id !== taskId));
      await tasksAPI.complete(taskId);
      playSounds.taskComplete();

      if (currentProfile) {
        const [res, statsRes] = await Promise.all([
          tasksAPI.getByProfile(currentProfile.id),
          profilesAPI.getStats(currentProfile.id)
        ]);
        const incompleteTasks = res.data.filter((t: any) => !t.completed);
        setSimpleTasks(isYoungChild ? incompleteTasks.slice(0, 4) : incompleteTasks.slice(0, 6));
        setStats(statsRes.data);
      }
    } catch (e: any) {
      console.error('Failed to complete task:', e);
      if (currentProfile) {
        const res = await tasksAPI.getByProfile(currentProfile.id);
        const incompleteTasks = res.data.filter((t: any) => !t.completed);
        setSimpleTasks(isYoungChild ? incompleteTasks.slice(0, 4) : incompleteTasks.slice(0, 6));
      }
    }
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

  // ============================================
  // YOUNG CHILD VIEW (Ages 5-6) - Simple & Fun
  // ============================================
  if (isYoungChild) {
    return (
      <div className={`max-w-2xl mx-auto px-4 pb-8 ${settings.themeClass}`}>
        {/* Level Up Celebration */}
        {showLevelUp && <LevelUpModal level={newLevel} onClose={() => setShowLevelUp(false)} />}

        {/* Login Bonus */}
        {showLoginBonus && loginBonusData && (
          <LoginBonusModal
            data={loginBonusData}
            claimed={bonusClaimed}
            claiming={claimingBonus}
            onClaim={claimLoginBonus}
            onClose={() => setShowLoginBonus(false)}
          />
        )}

        {/* Surprise Bonus from Parent */}
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

          {/* Quick stats */}
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

        {/* Reminder Widget - Compact */}
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
          <SimpleTaskGrid tasks={simpleTasks} onComplete={handleTaskComplete} />
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
  // REGULAR VIEW (Ages 7+) - Clean & Organized
  // ============================================
  return (
  <div className={`max-w-5xl mx-auto px-4 pb-10 ${settings.themeClass}`}>
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

    <div className="space-y-6">
      {/* === HERO === */}
      <HeroStats
        name={currentProfile?.name?.split(' ')[0] || 'Friend'}
        avatar={<Avatar avatar={currentProfile?.avatar} size="lg" alt={currentProfile?.name || ''} />}
        level={level}
        points={totalPoints}
        pointsToNextLevel={100 - (totalPoints % 100)}
        onAvatarClick={() => setShowAvatarPicker(true)}
      />

      {/* === AT-A-GLANCE === */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 p-4">
          <p className="text-xs font-semibold text-amber-700">Points</p>
          <p className="text-2xl font-bold text-amber-900">{totalPoints}</p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-sky-100 p-4">
          <p className="text-xs font-semibold text-sky-700">Stars</p>
          <p className="text-2xl font-bold text-sky-900">{totalStars}</p>
        </div>
        <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100 p-4">
          <p className="text-xs font-semibold text-orange-700">Streak</p>
          <p className="text-2xl font-bold text-orange-900">{streaks?.tasks?.current || 0}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 p-4">
          <p className="text-xs font-semibold text-emerald-700">Today</p>
          <p className="text-lg font-bold text-emerald-900">
            {economyData ? `${economyData.todayEarned} / ${economyData.settings.daily_points_cap} pts` : `${simpleTasks.length} tasks`}
          </p>
          {economyData && (
            <div className="mt-2 h-2 rounded-full bg-emerald-200">
              <div
                className="h-2 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min((economyData.todayEarned / economyData.settings.daily_points_cap) * 100, 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* === TODAY FOCUS === */}
      <section className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-4">
        <div className="card border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="text-2xl">📝</span> Today's Tasks
            </h2>
            <Link to="/tasks" className="text-sm text-slate-500 hover:text-slate-700 font-medium flex items-center gap-1">
              See all <ChevronRight size={16} />
            </Link>
          </div>
          <SimpleTaskGrid tasks={simpleTasks} onComplete={handleTaskComplete} />
          {completedTasks > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700">
              <CheckCircle size={16} /> {completedTasks} done today
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">💧</span>
              <p className="font-semibold text-slate-800">Water</p>
            </div>
            <p className="text-sm text-slate-500 mb-2">{waterData.total_ml} / {waterData.goal_ml} ml</p>
            <div className="h-2 bg-slate-200 rounded-full mb-3">
              <div
                className="h-2 rounded-full bg-sky-500 transition-all"
                style={{ width: `${Math.min((waterData.total_ml / waterData.goal_ml) * 100, 100)}%` }}
              />
            </div>
            <div className="flex gap-2">
              {[150, 250, 500].map((amt) => (
                <button
                  key={amt}
                  onClick={() => logWater(amt)}
                  className="flex-1 rounded-xl border border-sky-200 bg-sky-50 py-1.5 text-sm font-semibold text-sky-700 hover:bg-sky-100"
                >
                  +{amt}
                </button>
              ))}
            </div>
          </div>

          <ReminderWidget
            enabled={reminderEnabled}
            time={reminderTime}
            onToggle={toggleReminder}
            onTimeChange={handleReminderTimeChange}
            saving={savingReminder}
            compact
          />

          {activeGoals.length > 0 && (
            <div className="card border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{activeGoals[0].reward_image || getGoalTypeDisplay(activeGoals[0].goal_type).emoji}</span>
                  <p className="font-semibold text-slate-800">Top Goal</p>
                </div>
                <button
                  onClick={() => setShowGoals(true)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  View all
                </button>
              </div>
              <p className="text-sm text-slate-600 mt-2">{activeGoals[0].goal_description}</p>
              <div className="mt-3 h-2 rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-violet-500 transition-all"
                  style={{
                    width: `${Math.min(((activeGoals[0].current_points || 0) / activeGoals[0].goal_points) * 100, 100)}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* === QUICK ACTIONS === */}
      <section>
        <h2 className="text-lg font-bold mb-3 text-slate-800">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Link
            to="/tasks"
            className="p-4 bg-gradient-to-br from-blue-100 to-cyan-100 hover:from-blue-200 hover:to-cyan-200 rounded-2xl transition-all text-center hover:scale-105"
          >
            <div className="text-3xl mb-1">📝</div>
            <p className="text-xs font-bold text-slate-700">Tasks</p>
          </Link>
          <Link
            to="/quizzes"
            className="p-4 bg-gradient-to-br from-violet-100 to-purple-100 hover:from-violet-200 hover:to-purple-200 rounded-2xl transition-all text-center hover:scale-105"
          >
            <div className="text-3xl mb-1">🦁</div>
            <p className="text-xs font-bold text-slate-700">Quizzes</p>
          </Link>
          <Link
            to="/shop"
            className="p-4 bg-gradient-to-br from-green-100 to-emerald-100 hover:from-green-200 hover:to-emerald-200 rounded-2xl transition-all text-center hover:scale-105"
          >
            <div className="text-3xl mb-1">🛍️</div>
            <p className="text-xs font-bold text-slate-700">Shop</p>
          </Link>
          {featureFlags.diet_enabled && currentProfile?.diet_enabled === 1 && (
            <Link
              to="/diet"
              className="p-4 bg-gradient-to-br from-amber-100 to-orange-100 hover:from-amber-200 hover:to-orange-200 rounded-2xl transition-all text-center hover:scale-105"
            >
              <div className="text-3xl mb-1">🥗</div>
              <p className="text-xs font-bold text-slate-700">Diet</p>
            </Link>
          )}
          {currentProfile?.ai_enabled === 1 ? (
            <Link
              to="/ai"
              className="p-4 bg-gradient-to-br from-indigo-100 to-blue-100 hover:from-indigo-200 hover:to-blue-200 rounded-2xl transition-all text-center hover:scale-105"
            >
              <div className="text-3xl mb-1">🤖</div>
              <p className="text-xs font-bold text-slate-700">AI Help</p>
            </Link>
          ) : (
            <div className="p-4 bg-slate-100 rounded-2xl text-center opacity-50">
              <div className="text-3xl mb-1">🤖</div>
              <p className="text-xs font-bold text-slate-400">AI Help</p>
            </div>
          )}
        </div>
      </section>

      {/* === EXPLORE MORE === */}
      <section className="space-y-3">
        {activeGoals.length > 0 && (
          <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
            <button
              onClick={() => setShowGoals(!showGoals)}
              className="w-full flex items-center justify-between text-slate-800 font-semibold"
            >
              <span className="flex items-center gap-2">
                <Target size={18} className="text-violet-500" />
                Goals & rewards
              </span>
              {showGoals ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
            {showGoals && (
              <div className="mt-3 space-y-3">
                {activeGoals.map((goal) => {
                  const progress = goal.goal_points > 0
                    ? Math.min(100, ((goal.current_points || 0) / goal.goal_points) * 100)
                    : 0;

                  return (
                    <div key={goal.id} className="bg-white rounded-xl p-4 border border-violet-200">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-3xl">{goal.reward_image || getGoalTypeDisplay(goal.goal_type).emoji}</span>
                        <div className="flex-1">
                          <p className="font-bold text-slate-800">{goal.goal_description}</p>
                          <p className="text-sm text-slate-600">
                            {goal.current_points || 0} / {goal.goal_points} pts
                          </p>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-violet-500 to-purple-500 h-3 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-2 text-right">{Math.round(progress)}% complete</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {(challenges.length > 0 || customChallenges.length > 0) && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <button
              onClick={() => setShowChallenges(!showChallenges)}
              className="w-full flex items-center justify-between text-slate-800 font-semibold"
            >
              <span className="flex items-center gap-2">
                <Zap size={18} className="text-amber-500" />
                Challenges
              </span>
              {showChallenges ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
            {showChallenges && (
              <div className="mt-3 space-y-3">
                {challenges.map((challenge) => {
                  const progress = Math.min(100, (challenge.current_progress / challenge.target_value) * 100);
                  const isComplete = challenge.current_progress >= challenge.target_value;
                  const isClaimed = challenge.completed === 1;

                  return (
                    <div
                      key={challenge.id}
                      className={`p-4 rounded-xl border ${
                        isClaimed ? 'bg-green-50 border-green-200' :
                        isComplete ? 'bg-yellow-50 border-yellow-300' :
                        'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className={`font-medium ${isClaimed ? 'text-green-700' : 'text-slate-800'}`}>
                            {isClaimed && <CheckCircle size={16} className="inline mr-1 text-green-600" />}
                            {challenge.description}
                          </p>
                          <p className="text-xs text-slate-500">+{challenge.bonus_points} bonus pts</p>
                        </div>
                        {isComplete && !isClaimed && (
                          <button
                            onClick={() => claimChallenge(challenge.id)}
                            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-bold"
                          >
                            Claim
                          </button>
                        )}
                      </div>
                      {!isClaimed && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${isComplete ? 'bg-yellow-500' : 'bg-blue-500'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-600">{challenge.current_progress}/{challenge.target_value}</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {customChallenges.map((challenge, index) => {
                  const progress = Math.min(100, (challenge.current_progress / challenge.target_value) * 100);
                  const isComplete = challenge.current_progress >= challenge.target_value;
                  const requiresTimer = challenge.requires_timer === true || challenge.requires_timer === 1;

                  if (requiresTimer) {
                    return (
                      <ChallengeTimerCard
                        key={challenge.id}
                        challenge={challenge}
                        onUpdate={refreshCustomChallenges}
                        index={index}
                      />
                    );
                  }

                  return (
                    <div
                      key={challenge.id}
                      className={`p-4 rounded-xl border ${
                        challenge.completed ? 'bg-green-50 border-green-200' :
                        isComplete ? 'bg-purple-50 border-purple-300' :
                        'bg-white border-purple-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className={`font-medium ${challenge.completed ? 'text-green-700' : 'text-slate-800'}`}>
                              {challenge.completed && <CheckCircle size={16} className="inline mr-1 text-green-600" />}
                              {challenge.title}
                            </p>
                            <span className="text-xs px-1.5 py-0.5 bg-purple-200 text-purple-800 rounded">AI</span>
                          </div>
                          <p className="text-sm text-slate-600">{challenge.description}</p>
                          <p className="text-xs text-purple-600">+{Math.round(challenge.points_reward * challenge.bonus_multiplier)} pts</p>
                        </div>
                        {!challenge.completed && challenge.target_value > 1 && (
                          <button
                            onClick={() => updateCustomChallengeProgress(challenge.id)}
                            className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-bold"
                          >
                            +1
                          </button>
                        )}
                      </div>
                      {!challenge.completed && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${isComplete ? 'bg-green-500' : 'bg-purple-500'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-600">{challenge.current_progress}/{challenge.target_value}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <button
            onClick={() => setShowBoosters(!showBoosters)}
            className="w-full flex items-center justify-between text-slate-800 font-semibold"
          >
            <span className="flex items-center gap-2">
              <Star size={18} className="text-slate-500" />
              Boosters
            </span>
            {showBoosters ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
          {showBoosters && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
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
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <button
            onClick={() => setShowAchievements(!showAchievements)}
            className="w-full flex items-center justify-between text-slate-800 font-semibold"
          >
            <span className="flex items-center gap-2">
              <Star size={18} className="text-amber-500" />
              Achievements
            </span>
            {showAchievements ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
          {showAchievements && (
            <div className="mt-3">
              <HiddenAchievements profileId={currentProfile?.id || 0} />
            </div>
          )}
        </div>
      </section>
    </div>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
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
                  <span className="text-4xl block">{avatar.emoji}</span>
                  {!isUnlocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 rounded-xl">
                      <div className="text-center">
                        <Lock size={14} className="text-white mx-auto" />
                        <span className="text-[10px] text-white font-bold">Lv{avatar.minLevel}</span>
                      </div>
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                      <CheckCircle size={12} className="text-white" />
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



