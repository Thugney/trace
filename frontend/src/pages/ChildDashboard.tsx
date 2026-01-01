import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { profilesAPI } from '../services/api';
import { ProfileStats } from '../types';
import { Star, Trophy, Target, BookOpen, Sparkles } from 'lucide-react';

export default function ChildDashboard() {
  const { currentProfile } = useProfile();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentProfile) return;

    const loadStats = async () => {
      try {
        setLoading(true);
        const response = await profilesAPI.getStats(currentProfile.id);
        setStats(response.data);
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [currentProfile]);

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
    <div>
      {/* Friendly Header */}
      <div className="mb-8 text-center">
        <div className="text-6xl mb-4">{currentProfile?.avatar || '👤'}</div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Hey {currentProfile?.name}! 🎉
        </h1>
        <p className="text-xl text-gray-600">You're doing awesome!</p>
      </div>

      {/* Level & Progress */}
      <div className="card bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 text-white mb-8">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Trophy size={40} className="text-yellow-300" />
            <h2 className="text-3xl font-bold">Level {level}</h2>
          </div>
          <p className="text-2xl font-semibold mb-4">{totalPoints} Points</p>
          <div className="w-full bg-white/20 rounded-full h-4">
            <div
              className="bg-yellow-300 h-4 rounded-full transition-all"
              style={{ width: `${Math.min((totalPoints % 100), 100)}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-white/80">
            {100 - (totalPoints % 100)} points until next level!
          </p>
        </div>
      </div>

      {/* Fun Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card bg-gradient-to-br from-yellow-400 to-orange-500 text-white">
          <div className="text-center">
            <div className="text-6xl mb-3">⭐</div>
            <p className="text-5xl font-bold">{totalStars}</p>
            <p className="text-yellow-100 mt-2">Stars Earned!</p>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-400 to-emerald-500 text-white">
          <div className="text-center">
            <div className="text-6xl mb-3">✅</div>
            <p className="text-5xl font-bold">{completedTasks}</p>
            <p className="text-green-100 mt-2">Tasks Done!</p>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-blue-400 to-cyan-500 text-white">
          <div className="text-center">
            <div className="text-6xl mb-3">🎯</div>
            <p className="text-5xl font-bold">{totalTasks - completedTasks}</p>
            <p className="text-blue-100 mt-2">Tasks Left!</p>
          </div>
        </div>
      </div>

      {/* Achievements */}
      {totalStars >= 10 && (
        <div className="card bg-gradient-to-r from-pink-100 to-purple-100 border-2 border-purple-300 mb-8">
          <div className="flex items-center space-x-4">
            <Sparkles className="text-purple-600" size={48} />
            <div>
              <h3 className="text-xl font-bold text-gray-900">Amazing Work! 🌟</h3>
              <p className="text-gray-700">You've earned {totalStars} stars! You're a superstar!</p>
            </div>
          </div>
        </div>
      )}

      {/* What's Next */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-2xl font-bold mb-4 flex items-center">
            <Target className="mr-2 text-primary-600" size={28} />
            What Should I Do?
          </h2>
          <div className="space-y-3">
            <Link
              to="/tasks"
              className="block p-5 bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 rounded-lg transition-colors border-2 border-blue-200"
            >
              <div className="flex items-center space-x-3">
                <div className="text-3xl">✅</div>
                <div>
                  <p className="text-lg font-bold text-gray-900">My Tasks</p>
                  <p className="text-sm text-gray-600">See what needs to be done</p>
                </div>
              </div>
            </Link>

            <Link
              to="/school"
              className="block p-5 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 rounded-lg transition-colors border-2 border-purple-200"
            >
              <div className="flex items-center space-x-3">
                <div className="text-3xl">📚</div>
                <div>
                  <p className="text-lg font-bold text-gray-900">School Work</p>
                  <p className="text-sm text-gray-600">Check my homework and lessons</p>
                </div>
              </div>
            </Link>

            <Link
              to="/notes"
              className="block p-5 bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 rounded-lg transition-colors border-2 border-green-200"
            >
              <div className="flex items-center space-x-3">
                <div className="text-3xl">📝</div>
                <div>
                  <p className="text-lg font-bold text-gray-900">My Notes</p>
                  <p className="text-sm text-gray-600">Write down my thoughts</p>
                </div>
              </div>
            </Link>

            {currentProfile?.ai_enabled === 1 && (
              <Link
                to="/ai"
                className="block p-5 bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 rounded-lg transition-colors border-2 border-indigo-200"
              >
                <div className="flex items-center space-x-3">
                  <div className="text-3xl">🤖</div>
                  <div>
                    <p className="text-lg font-bold text-gray-900">AI Helper</p>
                    <p className="text-sm text-gray-600">Ask questions and get help</p>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* Motivational Section */}
        <div className="card bg-gradient-to-br from-yellow-50 to-orange-50">
          <h2 className="text-2xl font-bold mb-4 flex items-center">
            <Star className="mr-2 text-yellow-600" size={28} />
            Keep It Up!
          </h2>
          <div className="space-y-4">
            {completedTasks === 0 ? (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">🚀</div>
                <p className="text-lg font-semibold text-gray-900 mb-2">
                  Ready to start your journey?
                </p>
                <p className="text-gray-600">
                  Complete your first task to earn stars and points!
                </p>
              </div>
            ) : totalStars > 0 ? (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">🌟</div>
                <p className="text-lg font-semibold text-gray-900 mb-2">
                  You're a star!
                </p>
                <p className="text-gray-600">
                  You've earned {totalStars} stars. Keep up the amazing work!
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-6xl mb-4">💪</div>
                <p className="text-lg font-semibold text-gray-900 mb-2">
                  You're doing great!
                </p>
                <p className="text-gray-600">
                  Keep completing tasks to earn more stars and level up!
                </p>
              </div>
            )}

            {/* Progress Encouragement */}
            {totalTasks > 0 && (
              <div className="p-4 bg-white rounded-lg border-2 border-yellow-300">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900">Today's Progress</span>
                  <span className="text-lg font-bold text-primary-600">
                    {Math.round((completedTasks / totalTasks) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-green-400 to-emerald-500 h-3 rounded-full transition-all"
                    style={{ width: `${(completedTasks / totalTasks) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
