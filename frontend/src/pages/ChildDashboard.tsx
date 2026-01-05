import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { profilesAPI, gamificationAPI, goalsAPI } from '../services/api';
import { ProfileStats } from '../types';
import { Star, Trophy, Target, Droplets, Flame, Award, Zap, CheckCircle, Calendar, TrendingUp, Users, Medal, Pencil, Lock, X } from 'lucide-react';

// Avatar categories with emojis
const AVATAR_CATEGORIES = [
  {
    name: 'People',
    avatars: [
      { emoji: '👦', label: 'Boy', minLevel: 1 },
      { emoji: '👧', label: 'Girl', minLevel: 1 },
      { emoji: '🧒', label: 'Child', minLevel: 1 },
      { emoji: '👶', label: 'Baby', minLevel: 1 },
      { emoji: '🧑', label: 'Person', minLevel: 1 },
      { emoji: '👤', label: 'Silhouette', minLevel: 1 },
    ]
  },
  {
    name: 'Cool Characters',
    avatars: [
      { emoji: '🦸', label: 'Superhero', minLevel: 3 },
      { emoji: '🦹', label: 'Supervillain', minLevel: 5 },
      { emoji: '🧙', label: 'Wizard', minLevel: 4 },
      { emoji: '🧚', label: 'Fairy', minLevel: 3 },
      { emoji: '🧛', label: 'Vampire', minLevel: 6 },
      { emoji: '🧜', label: 'Merperson', minLevel: 5 },
      { emoji: '🧝', label: 'Elf', minLevel: 4 },
      { emoji: '🥷', label: 'Ninja', minLevel: 7 },
      { emoji: '🤴', label: 'Prince', minLevel: 8 },
      { emoji: '👸', label: 'Princess', minLevel: 8 },
      { emoji: '👑', label: 'Crown', minLevel: 10 },
    ]
  },
  {
    name: 'Animals',
    avatars: [
      { emoji: '🐱', label: 'Cat', minLevel: 1 },
      { emoji: '🐶', label: 'Dog', minLevel: 1 },
      { emoji: '🐰', label: 'Rabbit', minLevel: 1 },
      { emoji: '🐻', label: 'Bear', minLevel: 2 },
      { emoji: '🦊', label: 'Fox', minLevel: 2 },
      { emoji: '🐼', label: 'Panda', minLevel: 3 },
      { emoji: '🦁', label: 'Lion', minLevel: 4 },
      { emoji: '🐯', label: 'Tiger', minLevel: 4 },
      { emoji: '🦄', label: 'Unicorn', minLevel: 5 },
      { emoji: '🐉', label: 'Dragon', minLevel: 8 },
      { emoji: '🦅', label: 'Eagle', minLevel: 6 },
      { emoji: '🦋', label: 'Butterfly', minLevel: 2 },
    ]
  },
  {
    name: 'Fun & Sports',
    avatars: [
      { emoji: '⚽', label: 'Soccer', minLevel: 1 },
      { emoji: '🏀', label: 'Basketball', minLevel: 1 },
      { emoji: '🎮', label: 'Gaming', minLevel: 2 },
      { emoji: '🎸', label: 'Guitar', minLevel: 3 },
      { emoji: '🎨', label: 'Art', minLevel: 2 },
      { emoji: '🚀', label: 'Rocket', minLevel: 5 },
      { emoji: '🌟', label: 'Star', minLevel: 4 },
      { emoji: '🔥', label: 'Fire', minLevel: 6 },
      { emoji: '💎', label: 'Diamond', minLevel: 9 },
      { emoji: '🏆', label: 'Trophy', minLevel: 10 },
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

interface WeeklySummary {
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
}

interface LeaderboardEntry {
  id: number;
  name: string;
  avatar: string;
  points: number;
  tasksCompleted: number;
  currentStreak: number;
  achievements: number;
  rank: number;
}

export default function ChildDashboard() {
  const { currentProfile } = useProfile();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [waterData, setWaterData] = useState<{ total_ml: number; goal_ml: number }>({ total_ml: 0, goal_ml: 2000 });
  const [streaks, setStreaks] = useState<Record<string, { current: number; longest: number }>>({});
  const [achievements, setAchievements] = useState<{ earned: any[]; total_count: number }>({ earned: [], total_count: 0 });
  const [waterAmount, setWaterAmount] = useState(250);
  const [challenges, setChallenges] = useState<DailyChallenge[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(0);
  const [prevLevel, setPrevLevel] = useState<number | null>(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [avatarCategory, setAvatarCategory] = useState(0);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [goalHistory, setGoalHistory] = useState<{ goals: any[]; stats: { totalAchieved: number; totalPointsEarned: number } }>({ goals: [], stats: { totalAchieved: 0, totalPointsEarned: 0 } });
  const [showGoalHistory, setShowGoalHistory] = useState(false);

  useEffect(() => {
    if (!currentProfile) return;

    const loadStats = async () => {
      try {
        setLoading(true);
        const [statsRes, waterRes, gamificationRes, achievementsRes, challengesRes, weeklyRes, goalHistoryRes] = await Promise.all([
          profilesAPI.getStats(currentProfile.id),
          gamificationAPI.getWater(currentProfile.id),
          gamificationAPI.getStats(currentProfile.id),
          gamificationAPI.getProfileAchievements(currentProfile.id),
          gamificationAPI.getChallenges(currentProfile.id),
          gamificationAPI.getWeeklySummary(currentProfile.id),
          goalsAPI.getHistory(currentProfile.id, 10)
        ]);
        setStats(statsRes.data);
        setWaterData({ total_ml: waterRes.data.total_ml, goal_ml: waterRes.data.goal_ml });
        setStreaks(gamificationRes.data.streaks);
        setAchievements({ earned: achievementsRes.data.earned, total_count: achievementsRes.data.total_count });
        setChallenges(challengesRes.data);
        setWeeklySummary(weeklyRes.data);
        setGoalHistory(goalHistoryRes.data);

        // Load leaderboard if child has a parent
        if (currentProfile.parent_id) {
          try {
            const leaderboardRes = await gamificationAPI.getLeaderboard(currentProfile.parent_id, 'week');
            setLeaderboard(leaderboardRes.data);
          } catch (e) {
            console.error('Failed to load leaderboard:', e);
          }
        }
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [currentProfile]);

  const logWater = async (amount: number) => {
    if (!currentProfile) return;
    try {
      await gamificationAPI.logWater(currentProfile.id, amount);
      const waterRes = await gamificationAPI.getWater(currentProfile.id);
      setWaterData({ total_ml: waterRes.data.total_ml, goal_ml: waterRes.data.goal_ml });
      // Refresh challenges as water progress may have changed
      const challengesRes = await gamificationAPI.getChallenges(currentProfile.id);
      setChallenges(challengesRes.data);
    } catch (error) {
      console.error('Failed to log water:', error);
    }
  };

  const claimChallenge = async (challengeId: number) => {
    try {
      await gamificationAPI.completeChallenge(challengeId);
      // Refresh challenges and stats
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

  const updateAvatar = async (emoji: string) => {
    if (!currentProfile || savingAvatar) return;
    setSavingAvatar(true);
    try {
      await profilesAPI.update(currentProfile.id, { avatar: emoji });
      // Refresh profile - the context will update
      window.location.reload();
    } catch (error) {
      console.error('Failed to update avatar:', error);
      alert('Failed to update avatar. Please try again.');
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

  const level = stats?.progress.level || 1;
  const totalPoints = stats?.progress.total_points || 0;
  const totalStars = stats?.progress.total_stars || 0;
  const completedTasks = stats?.tasks.completed_tasks || 0;
  const totalTasks = stats?.tasks.total_tasks || 0;

  // Detect level up
  useEffect(() => {
    if (stats?.progress.level && prevLevel !== null && stats.progress.level > prevLevel) {
      setNewLevel(stats.progress.level);
      setShowLevelUp(true);
      // Auto-hide after 5 seconds
      setTimeout(() => setShowLevelUp(false), 5000);
    }
    if (stats?.progress.level) {
      setPrevLevel(stats.progress.level);
    }
  }, [stats?.progress.level, prevLevel]);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Level Up Celebration Modal */}
      {showLevelUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative bg-gradient-to-br from-yellow-400 via-orange-500 to-pink-500 p-8 rounded-3xl shadow-2xl text-center transform animate-bounce-slow max-w-sm mx-4">
            {/* Confetti effect */}
            <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-3 h-3 animate-confetti"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `-10%`,
                    backgroundColor: ['#ff0', '#f0f', '#0ff', '#0f0', '#f00', '#00f'][i % 6],
                    borderRadius: Math.random() > 0.5 ? '50%' : '0',
                    animationDelay: `${Math.random() * 2}s`,
                    animationDuration: `${2 + Math.random() * 2}s`
                  }}
                />
              ))}
            </div>

            <div className="text-8xl mb-4 animate-pulse">🎉</div>
            <h2 className="text-4xl font-black text-white mb-2 drop-shadow-lg">
              LEVEL UP!
            </h2>
            <div className="text-7xl font-black text-white drop-shadow-lg mb-4">
              {newLevel}
            </div>
            <p className="text-xl text-white/90 mb-6">
              Amazing work! Keep it going! 🚀
            </p>
            <button
              onClick={() => setShowLevelUp(false)}
              className="px-6 py-3 bg-white text-orange-600 rounded-full font-bold text-lg hover:bg-yellow-100 transition-colors shadow-lg"
            >
              Awesome! 🌟
            </button>
          </div>
        </div>
      )}

      {/* Avatar Picker Modal */}
      {showAvatarPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4 text-white flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Choose Your Avatar</h2>
                <p className="text-sm text-white/80">Level {level} - Unlock more at higher levels!</p>
              </div>
              <button
                onClick={() => setShowAvatarPicker(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Category Tabs */}
            <div className="flex border-b overflow-x-auto">
              {AVATAR_CATEGORIES.map((cat, idx) => (
                <button
                  key={cat.name}
                  onClick={() => setAvatarCategory(idx)}
                  className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    avatarCategory === idx
                      ? 'border-b-2 border-purple-500 text-purple-600 bg-purple-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Avatar Grid */}
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              <div className="grid grid-cols-4 gap-3">
                {AVATAR_CATEGORIES[avatarCategory].avatars.map((avatar) => {
                  const isUnlocked = level >= avatar.minLevel;
                  const isSelected = currentProfile?.avatar === avatar.emoji;
                  return (
                    <button
                      key={avatar.emoji}
                      onClick={() => isUnlocked && updateAvatar(avatar.emoji)}
                      disabled={!isUnlocked || savingAvatar}
                      className={`relative p-3 rounded-xl transition-all ${
                        isSelected
                          ? 'bg-purple-100 ring-2 ring-purple-500'
                          : isUnlocked
                          ? 'bg-gray-50 hover:bg-gray-100 hover:scale-110'
                          : 'bg-gray-100 opacity-60 cursor-not-allowed'
                      }`}
                      title={isUnlocked ? avatar.label : `Unlock at Level ${avatar.minLevel}`}
                    >
                      <span className="text-4xl block">{avatar.emoji}</span>
                      {!isUnlocked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/40 rounded-xl">
                          <div className="text-center">
                            <Lock size={16} className="text-white mx-auto" />
                            <span className="text-xs text-white font-medium">Lv{avatar.minLevel}</span>
                          </div>
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                          <CheckCircle size={14} className="text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t">
              <p className="text-center text-sm text-gray-600">
                {AVATAR_CATEGORIES.flatMap(c => c.avatars).filter(a => level >= a.minLevel).length} of{' '}
                {AVATAR_CATEGORIES.flatMap(c => c.avatars).length} avatars unlocked
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Friendly Header */}
      <div className="mb-6 text-center">
        <button
          onClick={() => setShowAvatarPicker(true)}
          className="group relative inline-block"
          title="Change your avatar"
        >
          <div className="text-7xl mb-3 transition-transform group-hover:scale-110">
            {currentProfile?.avatar || '👤'}
          </div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-purple-500 text-white px-2 py-1 rounded-full text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            <Pencil size={12} />
            Change
          </div>
        </button>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          Hey {currentProfile?.name}! 🎉
        </h1>
        <p className="text-lg md:text-xl text-gray-600">You're doing awesome!</p>
      </div>

      {/* Level & Progress */}
      <div className="rounded-2xl p-6 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 text-white mb-6 shadow-xl">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trophy size={36} className="text-yellow-300" />
            <h2 className="text-2xl md:text-3xl font-bold">Level {level}</h2>
          </div>
          <p className="text-3xl md:text-4xl font-bold mb-4">{totalPoints} Points</p>
          <div className="w-full bg-white/20 rounded-full h-5">
            <div
              className="bg-yellow-300 h-5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min((totalPoints % 100), 100)}%` }}
            />
          </div>
          <p className="mt-3 text-base text-white/90">
            {100 - (totalPoints % 100)} points until next level!
          </p>
        </div>
      </div>

      {/* Fun Stats Grid */}
      <div className="grid grid-cols-3 gap-3 md:gap-6 mb-6">
        <div className="rounded-2xl p-4 md:p-6 bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg">
          <div className="text-center">
            <div className="text-4xl md:text-6xl mb-2">⭐</div>
            <p className="text-3xl md:text-5xl font-bold">{totalStars}</p>
            <p className="text-yellow-100 mt-1 text-sm md:text-base">Stars!</p>
          </div>
        </div>

        <div className="rounded-2xl p-4 md:p-6 bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-lg">
          <div className="text-center">
            <div className="text-4xl md:text-6xl mb-2">✅</div>
            <p className="text-3xl md:text-5xl font-bold">{completedTasks}</p>
            <p className="text-green-100 mt-1 text-sm md:text-base">Done!</p>
          </div>
        </div>

        <div className="rounded-2xl p-4 md:p-6 bg-gradient-to-br from-blue-400 to-cyan-500 text-white shadow-lg">
          <div className="text-center">
            <div className="text-4xl md:text-6xl mb-2">🎯</div>
            <p className="text-3xl md:text-5xl font-bold">{totalTasks - completedTasks}</p>
            <p className="text-blue-100 mt-1 text-sm md:text-base">To Do!</p>
          </div>
        </div>
      </div>

      {/* Water Tracking & Streaks Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Water Tracker */}
        <div className="rounded-2xl p-5 bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Droplets className="text-blue-500" size={24} />
            Water Today 💧
          </h3>
          <div className="mb-3">
            <div className="flex justify-between text-sm mb-1">
              <span>{waterData.total_ml} ml</span>
              <span>{waterData.goal_ml} ml goal</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-4">
              <div
                className="bg-gradient-to-r from-blue-400 to-cyan-500 h-4 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((waterData.total_ml / waterData.goal_ml) * 100, 100)}%` }}
              />
            </div>
            {waterData.total_ml >= waterData.goal_ml && (
              <p className="text-green-600 text-sm mt-1 font-semibold">Goal reached! 🎉</p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {[150, 250, 500].map((amount) => (
              <button
                key={amount}
                onClick={() => logWater(amount)}
                className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                +{amount}ml
              </button>
            ))}
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={waterAmount}
                onChange={(e) => setWaterAmount(parseInt(e.target.value) || 0)}
                className="w-16 px-2 py-2 border rounded-lg text-sm"
                min="0"
                step="50"
              />
              <button
                onClick={() => logWater(waterAmount)}
                className="px-3 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Streaks */}
        <div className="rounded-2xl p-5 bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Flame className="text-orange-500" size={24} />
            My Streaks 🔥
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-3 rounded-xl border border-orange-200">
              <p className="text-sm text-gray-600">Tasks</p>
              <p className="text-2xl font-bold text-orange-600">
                {streaks?.tasks?.current || 0} 🔥
              </p>
              <p className="text-xs text-gray-500">Best: {streaks?.tasks?.longest || 0}</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-blue-200">
              <p className="text-sm text-gray-600">Water</p>
              <p className="text-2xl font-bold text-blue-600">
                {streaks?.water?.current || 0} 💧
              </p>
              <p className="text-xs text-gray-500">Best: {streaks?.water?.longest || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="rounded-2xl p-5 bg-gradient-to-r from-pink-100 to-purple-100 border-2 border-purple-300 mb-6">
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
          <Award className="text-purple-600" size={24} />
          Achievements ({achievements.earned.length}/{achievements.total_count})
        </h3>
        {achievements.earned.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {achievements.earned.slice(0, 6).map((achievement: any) => (
              <div
                key={achievement.id}
                className="bg-white px-3 py-2 rounded-lg border border-purple-200 flex items-center gap-2"
                title={achievement.description}
              >
                <span className="text-xl">{achievement.icon}</span>
                <span className="text-sm font-medium">{achievement.name}</span>
              </div>
            ))}
            {achievements.earned.length > 6 && (
              <div className="bg-purple-200 px-3 py-2 rounded-lg text-sm font-medium text-purple-700">
                +{achievements.earned.length - 6} more
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-600">Complete tasks and drink water to earn achievements!</p>
        )}
      </div>

      {/* Goal History */}
      <div className="rounded-2xl p-5 bg-gradient-to-r from-emerald-100 to-teal-100 border-2 border-emerald-300 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Trophy className="text-emerald-600" size={24} />
            Goals You've Achieved! ({goalHistory.stats.totalAchieved})
          </h3>
          {goalHistory.goals.length > 0 && (
            <button
              onClick={() => setShowGoalHistory(!showGoalHistory)}
              className="text-sm text-emerald-600 hover:text-emerald-800 font-medium"
            >
              {showGoalHistory ? 'Show Less' : 'View All'}
            </button>
          )}
        </div>

        {goalHistory.stats.totalAchieved > 0 && (
          <div className="flex gap-4 mb-3 text-sm">
            <div className="bg-white px-3 py-1.5 rounded-lg border border-emerald-200">
              <span className="font-bold text-emerald-700">{goalHistory.stats.totalAchieved}</span>
              <span className="text-gray-600"> goals achieved</span>
            </div>
            <div className="bg-white px-3 py-1.5 rounded-lg border border-emerald-200">
              <span className="font-bold text-emerald-700">{goalHistory.stats.totalPointsEarned}</span>
              <span className="text-gray-600"> points earned</span>
            </div>
          </div>
        )}

        {goalHistory.goals.length > 0 ? (
          <div className="space-y-2">
            {goalHistory.goals.slice(0, showGoalHistory ? undefined : 3).map((goal: any) => (
              <div
                key={goal.id}
                className="bg-white p-3 rounded-lg border border-emerald-200 flex items-center gap-3"
              >
                <div className="text-2xl">
                  {goal.goal_type === 'kroner' ? '💰' : goal.goal_type === 'toy' ? '🎁' : goal.goal_type === 'activity' ? '🎪' : '🎯'}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{goal.goal_description}</p>
                  <p className="text-xs text-gray-500">
                    {goal.goal_points} points • {new Date(goal.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-emerald-500">
                  <CheckCircle size={24} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">Keep working hard to achieve your goals!</p>
        )}
      </div>

      {/* Daily Challenges */}
      {challenges.length > 0 && (
        <div className="rounded-2xl p-5 bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-300 mb-6">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Zap className="text-yellow-600" size={24} />
            Daily Challenges ⚡
          </h3>
          <div className="space-y-3">
            {challenges.map((challenge) => {
              const progress = challenge.challenge_type === 'drink_water'
                ? Math.min(100, (challenge.current_progress / challenge.target_value) * 100)
                : Math.min(100, (challenge.current_progress / challenge.target_value) * 100);
              const isComplete = challenge.current_progress >= challenge.target_value;
              const isClaimed = challenge.completed === 1;

              return (
                <div
                  key={challenge.id}
                  className={`p-3 rounded-xl border-2 ${
                    isClaimed
                      ? 'bg-green-100 border-green-300'
                      : isComplete
                      ? 'bg-yellow-100 border-yellow-400'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <p className={`font-medium ${isClaimed ? 'text-green-700' : 'text-gray-800'}`}>
                        {isClaimed && <CheckCircle size={16} className="inline mr-1 text-green-600" />}
                        {challenge.description}
                      </p>
                      <p className="text-xs text-gray-500">+{challenge.bonus_points} bonus points</p>
                    </div>
                    {isComplete && !isClaimed && (
                      <button
                        onClick={() => claimChallenge(challenge.id)}
                        className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-bold animate-pulse"
                      >
                        Claim!
                      </button>
                    )}
                  </div>
                  {!isClaimed && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            isComplete ? 'bg-yellow-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
                        {challenge.current_progress}/{challenge.target_value}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weekly Summary */}
      {weeklySummary && (
        <div className="rounded-2xl p-5 bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-200 mb-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Calendar className="text-indigo-600" size={24} />
            This Week's Progress 📊
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <div className="bg-white p-3 rounded-xl border border-indigo-200 text-center">
              <div className="text-2xl font-bold text-green-600">{weeklySummary.summary.tasksCompleted}</div>
              <p className="text-xs text-gray-600">Tasks Done</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-indigo-200 text-center">
              <div className="text-2xl font-bold text-purple-600">{weeklySummary.summary.pointsEarned}</div>
              <p className="text-xs text-gray-600">Points</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-indigo-200 text-center">
              <div className="text-2xl font-bold text-yellow-600">{weeklySummary.summary.challengesCompleted}</div>
              <p className="text-xs text-gray-600">Challenges</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-indigo-200 text-center">
              <div className="text-2xl font-bold text-blue-600">{(weeklySummary.summary.waterIntakeMl / 1000).toFixed(1)}L</div>
              <p className="text-xs text-gray-600">Water</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-indigo-200 text-center">
              <div className="text-2xl font-bold text-pink-600">{weeklySummary.summary.achievementsEarned}</div>
              <p className="text-xs text-gray-600">Achievements</p>
            </div>
          </div>
          {/* Daily Activity Chart */}
          {weeklySummary.dailyBreakdown.length > 0 && (
            <div className="bg-white p-3 rounded-xl border border-indigo-200">
              <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                <TrendingUp size={16} className="text-indigo-500" />
                Daily Activity
              </p>
              <div className="flex items-end gap-1 h-16">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => {
                  const date = new Date(weeklySummary.weekStart);
                  date.setDate(date.getDate() + idx);
                  const dateStr = date.toISOString().split('T')[0];
                  const dayData = weeklySummary.dailyBreakdown.find(d => d.date === dateStr);
                  const count = dayData?.tasks_completed || 0;
                  const maxCount = Math.max(...weeklySummary.dailyBreakdown.map(d => d.tasks_completed), 1);
                  const height = count > 0 ? Math.max(20, (count / maxCount) * 100) : 8;

                  return (
                    <div key={day} className="flex-1 flex flex-col items-center">
                      <div
                        className={`w-full rounded-t transition-all ${count > 0 ? 'bg-indigo-500' : 'bg-gray-200'}`}
                        style={{ height: `${height}%` }}
                        title={`${day}: ${count} tasks`}
                      />
                      <span className="text-[10px] text-gray-500 mt-1">{day[0]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Family Leaderboard */}
      {leaderboard.length > 1 && (
        <div className="rounded-2xl p-5 bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 mb-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Users className="text-amber-600" size={24} />
            Family Leaderboard 🏆
          </h3>
          <div className="space-y-2">
            {leaderboard.map((entry) => {
              const isCurrentUser = entry.id === currentProfile?.id;
              const rankEmoji = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`;

              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    isCurrentUser
                      ? 'bg-amber-200 border-2 border-amber-400 shadow-md'
                      : 'bg-white border border-amber-100'
                  }`}
                >
                  <span className="text-2xl font-bold w-10 text-center">{rankEmoji}</span>
                  <span className="text-3xl">{entry.avatar}</span>
                  <div className="flex-1">
                    <p className={`font-bold ${isCurrentUser ? 'text-amber-800' : 'text-gray-800'}`}>
                      {entry.name} {isCurrentUser && '(You!)'}
                    </p>
                    <div className="flex gap-3 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <Trophy size={12} className="text-yellow-500" />
                        {entry.points} pts
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle size={12} className="text-green-500" />
                        {entry.tasksCompleted} tasks
                      </span>
                      <span className="flex items-center gap-1">
                        <Flame size={12} className="text-orange-500" />
                        {entry.currentStreak} streak
                      </span>
                    </div>
                  </div>
                  {entry.rank === 1 && (
                    <Medal className="text-yellow-500" size={28} />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-3 text-center">This week's standings</p>
        </div>
      )}

      {/* What's Next - Quick Actions */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Target className="text-primary-600" size={24} />
          What Should I Do?
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            to="/tasks"
            className="block p-4 md:p-5 bg-gradient-to-br from-blue-100 to-cyan-100 hover:from-blue-200 hover:to-cyan-200 rounded-2xl transition-all border-2 border-blue-200 hover:scale-105"
          >
            <div className="text-center">
              <div className="text-4xl md:text-5xl mb-2">✅</div>
              <p className="font-bold text-gray-900">My Tasks</p>
            </div>
          </Link>

          <Link
            to="/school"
            className="block p-4 md:p-5 bg-gradient-to-br from-purple-100 to-pink-100 hover:from-purple-200 hover:to-pink-200 rounded-2xl transition-all border-2 border-purple-200 hover:scale-105"
          >
            <div className="text-center">
              <div className="text-4xl md:text-5xl mb-2">📚</div>
              <p className="font-bold text-gray-900">School</p>
            </div>
          </Link>

          <Link
            to="/notes"
            className="block p-4 md:p-5 bg-gradient-to-br from-green-100 to-emerald-100 hover:from-green-200 hover:to-emerald-200 rounded-2xl transition-all border-2 border-green-200 hover:scale-105"
          >
            <div className="text-center">
              <div className="text-4xl md:text-5xl mb-2">📝</div>
              <p className="font-bold text-gray-900">Notes</p>
            </div>
          </Link>

          {currentProfile?.ai_enabled === 1 ? (
            <Link
              to="/ai"
              className="block p-4 md:p-5 bg-gradient-to-br from-indigo-100 to-blue-100 hover:from-indigo-200 hover:to-blue-200 rounded-2xl transition-all border-2 border-indigo-200 hover:scale-105"
            >
              <div className="text-center">
                <div className="text-4xl md:text-5xl mb-2">🤖</div>
                <p className="font-bold text-gray-900">AI Help</p>
              </div>
            </Link>
          ) : (
            <div className="block p-4 md:p-5 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl border-2 border-gray-200">
              <div className="text-center">
                <div className="text-4xl md:text-5xl mb-2 opacity-50">🤖</div>
                <p className="font-bold text-gray-400">AI Help</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Motivational Section */}
      <div className="rounded-2xl p-5 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Star className="text-yellow-600" size={24} />
          Keep It Up!
        </h2>
        <div className="space-y-4">
          {completedTasks === 0 ? (
            <div className="text-center py-6">
              <div className="text-6xl mb-3">🚀</div>
              <p className="text-lg font-semibold text-gray-900 mb-1">
                Ready to start?
              </p>
              <p className="text-gray-600">
                Complete a task to earn stars!
              </p>
            </div>
          ) : totalStars > 0 ? (
            <div className="text-center py-6">
              <div className="text-6xl mb-3">🌟</div>
              <p className="text-lg font-semibold text-gray-900 mb-1">
                You're a star!
              </p>
              <p className="text-gray-600">
                Keep up the amazing work!
              </p>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="text-6xl mb-3">💪</div>
              <p className="text-lg font-semibold text-gray-900 mb-1">
                You're doing great!
              </p>
              <p className="text-gray-600">
                Keep going to level up!
              </p>
            </div>
          )}

          {/* Progress Encouragement */}
          {totalTasks > 0 && (
            <div className="p-4 bg-white rounded-xl border-2 border-yellow-300">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-900">Progress</span>
                <span className="text-lg font-bold text-primary-600">
                  {Math.round((completedTasks / totalTasks) * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-gradient-to-r from-green-400 to-emerald-500 h-4 rounded-full transition-all duration-500"
                  style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
