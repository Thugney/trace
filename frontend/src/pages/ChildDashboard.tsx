import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { profilesAPI, gamificationAPI } from '../services/api';
import { ProfileStats } from '../types';
import { Star, Trophy, Target, Droplets, Flame, Award, Zap, CheckCircle } from 'lucide-react';

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
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [waterData, setWaterData] = useState<{ total_ml: number; goal_ml: number }>({ total_ml: 0, goal_ml: 2000 });
  const [streaks, setStreaks] = useState<Record<string, { current: number; longest: number }>>({});
  const [achievements, setAchievements] = useState<{ earned: any[]; total_count: number }>({ earned: [], total_count: 0 });
  const [waterAmount, setWaterAmount] = useState(250);
  const [challenges, setChallenges] = useState<DailyChallenge[]>([]);

  useEffect(() => {
    if (!currentProfile) return;

    const loadStats = async () => {
      try {
        setLoading(true);
        const [statsRes, waterRes, gamificationRes, achievementsRes, challengesRes] = await Promise.all([
          profilesAPI.getStats(currentProfile.id),
          gamificationAPI.getWater(currentProfile.id),
          gamificationAPI.getStats(currentProfile.id),
          gamificationAPI.getProfileAchievements(currentProfile.id),
          gamificationAPI.getChallenges(currentProfile.id)
        ]);
        setStats(statsRes.data);
        setWaterData({ total_ml: waterRes.data.total_ml, goal_ml: waterRes.data.goal_ml });
        setStreaks(gamificationRes.data.streaks);
        setAchievements({ earned: achievementsRes.data.earned, total_count: achievementsRes.data.total_count });
        setChallenges(challengesRes.data);
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

  return (
    <div className="max-w-4xl mx-auto">
      {/* Friendly Header */}
      <div className="mb-6 text-center">
        <div className="text-7xl mb-3">{currentProfile?.avatar || '👤'}</div>
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
