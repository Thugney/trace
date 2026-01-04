import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { profilesAPI } from '../services/api';
import { ProfileStats } from '../types';
import { Star, Trophy, Target, Sparkles } from 'lucide-react';

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

      {/* Achievements */}
      {totalStars >= 10 && (
        <div className="rounded-2xl p-5 bg-gradient-to-r from-pink-100 to-purple-100 border-2 border-purple-300 mb-6">
          <div className="flex items-center gap-4">
            <Sparkles className="text-purple-600 flex-shrink-0" size={40} />
            <div>
              <h3 className="text-lg md:text-xl font-bold text-gray-900">Amazing Work! 🌟</h3>
              <p className="text-gray-700">You've earned {totalStars} stars! You're a superstar!</p>
            </div>
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
