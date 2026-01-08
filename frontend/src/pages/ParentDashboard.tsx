import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { useToast } from '../components/Toast';
import { profilesAPI, aiGamificationAPI, AISuggestion } from '../services/api';
import { Profile } from '../types';
import { Baby, CheckCircle, AlertCircle, Award, Sparkles, ThumbsUp, ThumbsDown, Brain, Target, Zap, RefreshCw, Trophy, BookOpen } from 'lucide-react';
import Avatar from '../components/Avatar';
import RewardManagement from '../components/RewardManagement';
import ChildInsights from '../components/ChildInsights';

export default function ParentDashboard() {
  const { currentProfile } = useProfile();
  const toast = useToast();
  const [children, setChildren] = useState<Profile[]>([]);
  const [childrenStats, setChildrenStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiSuggestions, setAiSuggestions] = useState<(AISuggestion & { child_name: string })[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [generatingForChild, setGeneratingForChild] = useState<number | null>(null);

  useEffect(() => {
    loadFamilyData();
  }, [currentProfile]);

  useEffect(() => {
    if (currentProfile?.id) {
      loadAISuggestions();
    }
  }, [currentProfile?.id]);

  const loadFamilyData = async () => {
    if (!currentProfile) return;

    try {
      setLoading(true);
      // Get all profiles
      const response = await profilesAPI.getAll();
      const allProfiles = response.data;

      // Filter children that belong to this parent
      const myKids = allProfiles.filter(
        (p: Profile) => p.type === 'child' && p.parent_id === currentProfile.id
      );
      setChildren(myKids);

      // Load stats for each child
      const statsPromises = myKids.map((child: Profile) =>
        profilesAPI.getStats(child.id).then((res) => ({
          ...child,
          stats: res.data
        }))
      );
      const stats = await Promise.all(statsPromises);
      setChildrenStats(stats);
    } catch (error) {
      console.error('Failed to load family data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAISuggestions = async () => {
    if (!currentProfile) return;
    try {
      setLoadingAI(true);
      const response = await aiGamificationAPI.getPendingSuggestions(currentProfile.id);
      setAiSuggestions(response.data);
    } catch (error) {
      console.error('Failed to load AI suggestions:', error);
    } finally {
      setLoadingAI(false);
    }
  };

  const generateChallenges = async (childId: number) => {
    if (!currentProfile) return;
    try {
      setGeneratingForChild(childId);
      await aiGamificationAPI.generateChallenges(childId, 3);
      await loadAISuggestions();
      toast.success('AI challenges generated! Review them below.');
    } catch (error: any) {
      console.error('Failed to generate challenges:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to generate challenges';
      toast.error(errorMsg);
    } finally {
      setGeneratingForChild(null);
    }
  };

  const approveSuggestion = async (suggestion: AISuggestion) => {
    if (!currentProfile) return;
    try {
      await aiGamificationAPI.approveSuggestion(suggestion.id, currentProfile.id);
      setAiSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
      toast.success(`Challenge "${suggestion.title}" approved!`);
    } catch (error) {
      console.error('Failed to approve suggestion:', error);
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
      console.error('Failed to reject suggestion:', error);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {currentProfile?.name}! 👋
        </h1>
        <p className="text-gray-600 mt-2">Manage your family's learning and progress</p>
      </div>

      {/* Family Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Your Children</p>
              <p className="text-4xl font-bold mt-1">{children.length}</p>
              <p className="text-purple-100 text-xs mt-1">Active learners</p>
            </div>
            <Baby size={48} className="opacity-80" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Tasks</p>
              <p className="text-4xl font-bold mt-1">
                {childrenStats.reduce((sum, child) => sum + (child.stats?.tasks?.total_tasks || 0), 0)}
              </p>
              <p className="text-blue-100 text-xs mt-1">Across all children</p>
            </div>
            <CheckCircle size={48} className="opacity-80" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Completed</p>
              <p className="text-4xl font-bold mt-1">
                {childrenStats.reduce((sum, child) => sum + (child.stats?.tasks?.completed_tasks || 0), 0)}
              </p>
              <p className="text-green-100 text-xs mt-1">Tasks finished</p>
            </div>
            <Award size={48} className="opacity-80" />
          </div>
        </div>
      </div>

      {/* Children Overview */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Your Children</h2>
        {children.length === 0 ? (
          <div className="card p-8 text-center">
            <Baby size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Children Yet</h3>
            <p className="text-gray-600 mb-4">
              Add your children's profiles to start tracking their progress
            </p>
            <Link to="/settings" className="btn btn-primary inline-flex items-center">
              <Baby className="mr-2" size={20} />
              Add Child Profile
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {childrenStats.map((child) => (
              <div key={child.id} className="card">
                <div className="flex items-center space-x-4 mb-4">
                  <Avatar avatar={child.avatar} size="xl" alt={child.name} />
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900">{child.name}</h3>
                    <p className="text-sm text-gray-600">{child.age} years old</p>
                  </div>
                </div>

                {/* Child Stats */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="text-blue-600" size={20} />
                      <span className="text-sm font-medium text-gray-900">Tasks</span>
                    </div>
                    <span className="text-sm font-semibold text-blue-600">
                      {child.stats?.tasks?.completed_tasks || 0}/{child.stats?.tasks?.total_tasks || 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Award className="text-purple-600" size={20} />
                      <span className="text-sm font-medium text-gray-900">Level</span>
                    </div>
                    <span className="text-sm font-semibold text-purple-600">
                      Level {child.stats?.progress?.level || 1}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className="text-yellow-600 text-lg">⭐</div>
                      <span className="text-sm font-medium text-gray-900">Stars</span>
                    </div>
                    <span className="text-sm font-semibold text-yellow-600">
                      {child.stats?.progress?.total_stars || 0} stars
                    </span>
                  </div>

                  {child.stats?.tasks?.overdue_tasks > 0 && (
                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="text-red-600" size={20} />
                        <span className="text-sm font-medium text-gray-900">Overdue</span>
                      </div>
                      <span className="text-sm font-semibold text-red-600">
                        {child.stats?.tasks?.overdue_tasks} tasks
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              to="/tasks"
              className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="flex items-center space-x-3">
                <CheckCircle className="text-primary-600" size={20} />
                <div>
                  <p className="font-medium">Manage Tasks</p>
                  <p className="text-sm text-gray-600">Create and assign tasks to children</p>
                </div>
              </div>
            </Link>

            <Link
              to="/leaderboard"
              className="block p-4 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border-2 border-amber-200"
            >
              <div className="flex items-center space-x-3">
                <Trophy className="text-amber-600" size={20} />
                <div>
                  <p className="font-medium text-amber-900">Family Leaderboard</p>
                  <p className="text-sm text-amber-700">See who's winning!</p>
                </div>
              </div>
            </Link>

            <Link
              to="/quizzes/builder"
              className="block p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border-2 border-purple-200"
            >
              <div className="flex items-center space-x-3">
                <BookOpen className="text-purple-600" size={20} />
                <div>
                  <p className="font-medium text-purple-900">Quiz Builder</p>
                  <p className="text-sm text-purple-700">Create educational quizzes for your kids</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Family Progress */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Family Progress</h2>
          <div className="space-y-4">
            {children.length > 0 ? (
              children.map((child) => {
                const childStats = childrenStats.find((c) => c.id === child.id);
                const completionRate = childStats?.stats?.tasks?.total_tasks > 0
                  ? Math.round((childStats.stats.tasks.completed_tasks / childStats.stats.tasks.total_tasks) * 100)
                  : 0;

                return (
                  <div key={child.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Avatar avatar={child.avatar} size="sm" alt={child.name} />
                        <span className="font-medium text-gray-900">{child.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-primary-600">{completionRate}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-600 text-center py-8">
                Add children to see their progress
              </p>
            )}
          </div>
        </div>
      </div>

      {/* AI-Generated Challenges */}
      {children.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Sparkles className="text-purple-600" size={24} />
              <h2 className="text-2xl font-bold text-gray-900">AI Personalized Challenges</h2>
            </div>
            <button
              onClick={loadAISuggestions}
              disabled={loadingAI}
              className="btn btn-sm btn-secondary flex items-center space-x-1"
            >
              <RefreshCw size={16} className={loadingAI ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Generate Challenges for Children */}
          <div className="card mb-4 bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
            <div className="flex items-start space-x-3">
              <Brain className="text-purple-600 flex-shrink-0 mt-1" size={24} />
              <div className="flex-1">
                <h3 className="font-semibold text-purple-900 mb-1">Generate AI Challenges</h3>
                <p className="text-sm text-purple-700 mb-3">
                  AI analyzes each child's behavior patterns, strengths, and areas to improve to create personalized challenges.
                </p>
                <div className="flex flex-wrap gap-2">
                  {children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => generateChallenges(child.id)}
                      disabled={generatingForChild === child.id}
                      className="btn btn-sm bg-purple-600 hover:bg-purple-700 text-white flex items-center space-x-1"
                    >
                      {generatingForChild === child.id ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <Zap size={14} />
                          <span>Generate for {child.name}</span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Pending AI Suggestions */}
          {aiSuggestions.length > 0 ? (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
                <Target size={18} className="text-orange-500" />
                <span>Pending Approval ({aiSuggestions.length})</span>
              </h3>
              {aiSuggestions.map((suggestion) => (
                <div key={suggestion.id} className="card border-l-4 border-l-purple-500">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-lg font-semibold text-gray-900">{suggestion.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getDifficultyColor(suggestion.difficulty)}`}>
                          {suggestion.difficulty}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                          {suggestion.points_reward} pts
                        </span>
                        {suggestion.bonus_multiplier > 1 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
                            {suggestion.bonus_multiplier}x bonus
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{suggestion.description}</p>
                      {suggestion.reasoning && (
                        <p className="text-xs text-purple-600 italic mb-2">
                          <Brain size={12} className="inline mr-1" />
                          AI reasoning: {suggestion.reasoning}
                        </p>
                      )}
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>For: <strong>{suggestion.child_name}</strong></span>
                        <span>Duration: {suggestion.duration_days} days</span>
                        {suggestion.target_value && suggestion.target_value > 1 && (
                          <span>Target: {suggestion.target_value}x</span>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => approveSuggestion(suggestion)}
                        className="btn btn-sm bg-green-600 hover:bg-green-700 text-white flex items-center space-x-1"
                      >
                        <ThumbsUp size={14} />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => rejectSuggestion(suggestion)}
                        className="btn btn-sm bg-red-100 hover:bg-red-200 text-red-700 flex items-center space-x-1"
                      >
                        <ThumbsDown size={14} />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card bg-gray-50 text-center py-8">
              <Sparkles size={32} className="mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600 mb-2">No pending AI suggestions</p>
              <p className="text-sm text-gray-500">
                Click "Generate" above to create personalized challenges for your children
              </p>
            </div>
          )}
        </div>
      )}

      {/* AI Child Insights - Shows encouragement moments and mood tracking */}
      {currentProfile && children.length > 0 && (
        <div className="mt-6">
          <ChildInsights parentId={currentProfile.id} />
        </div>
      )}

      {/* Reward Shop Management */}
      {currentProfile && (
        <div className="mt-6 card">
          <RewardManagement parentId={currentProfile.id} />
        </div>
      )}
    </div>
  );
}
