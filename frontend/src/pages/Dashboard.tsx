import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { profilesAPI } from '../services/api';
import { ProfileStats } from '../types';
import { TrendingUp, CheckCircle, Award, Utensils } from 'lucide-react';

export default function Dashboard() {
  const { currentProfile, isParent } = useProfile();
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {currentProfile?.name}! 👋
        </h1>
        <p className="text-gray-600 mt-2">Here's your overview for today</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Level/Points (Kids) or Diet (Parents) */}
        {!isParent ? (
          <div className="card bg-gradient-to-br from-purple-500 to-primary-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Your Level</p>
                <p className="text-3xl font-bold mt-1">{stats?.progress.level || 1}</p>
                <p className="text-purple-100 text-xs mt-1">
                  {stats?.progress.total_points || 0} points
                </p>
              </div>
              <Award size={48} className="opacity-80" />
            </div>
          </div>
        ) : (
          <div className="card bg-gradient-to-br from-green-500 to-emerald-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Meals Today</p>
                <p className="text-3xl font-bold mt-1">{stats?.diet.meals_logged || 0}</p>
                <p className="text-green-100 text-xs mt-1">
                  {stats?.diet.total_calories || 0} cal
                </p>
              </div>
              <Utensils size={48} className="opacity-80" />
            </div>
          </div>
        )}

        {/* Tasks */}
        <div className="card bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Tasks Completed</p>
              <p className="text-3xl font-bold mt-1">
                {stats?.tasks.completed_tasks || 0}/{stats?.tasks.total_tasks || 0}
              </p>
              <p className="text-blue-100 text-xs mt-1">
                {stats?.tasks.overdue_tasks || 0} overdue
              </p>
            </div>
            <CheckCircle size={48} className="opacity-80" />
          </div>
        </div>

        {/* Stars (Kids) */}
        {!isParent && (
          <div className="card bg-gradient-to-br from-yellow-400 to-orange-500 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-sm">Stars Earned</p>
                <p className="text-3xl font-bold mt-1">{stats?.progress.total_stars || 0}</p>
                <p className="text-yellow-100 text-xs mt-1">Keep going!</p>
              </div>
              <div className="text-5xl">⭐</div>
            </div>
          </div>
        )}

        {/* Progress */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Weekly Progress</p>
              <p className="text-2xl font-bold mt-1 text-primary-600">
                {isParent ? 'On Track' : 'Great Job!'}
              </p>
              <p className="text-gray-500 text-xs mt-1">Keep up the good work</p>
            </div>
            <TrendingUp size={40} className="text-primary-600" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              to="/diet"
              className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="flex items-center space-x-3">
                <Utensils className="text-primary-600" />
                <div>
                  <p className="font-medium">Log a Meal</p>
                  <p className="text-sm text-gray-600">Track your food intake</p>
                </div>
              </div>
            </Link>
            <Link
              to="/tasks"
              className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="flex items-center space-x-3">
                <CheckCircle className="text-primary-600" />
                <div>
                  <p className="font-medium">{isParent ? 'Manage Tasks' : 'View My Tasks'}</p>
                  <p className="text-sm text-gray-600">
                    {isParent ? 'Create and assign tasks' : 'See what needs to be done'}
                  </p>
                </div>
              </div>
            </Link>
            <Link
              to="/ai"
              className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="flex items-center space-x-3">
                <Award className="text-primary-600" />
                <div>
                  <p className="font-medium">AI Assistant</p>
                  <p className="text-sm text-gray-600">Get personalized suggestions</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold mb-4">
            {isParent ? 'Family Overview' : 'Recent Achievements'}
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="text-2xl">🎉</div>
                <div>
                  <p className="font-medium text-gray-900">
                    {isParent ? 'All kids on track!' : 'Completed 3 tasks today!'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {isParent ? 'Great family progress' : 'Earned 30 points'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="text-2xl">📚</div>
                <div>
                  <p className="font-medium text-gray-900">
                    {isParent ? 'Meal plan active' : 'Homework completed'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {isParent ? 'Weekly plan in progress' : 'Math homework done!'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
