import { useEffect, useState } from 'react';
import { useProfile } from '../context/ProfileContext';
import { profilesAPI } from '../services/api';
import { JourneyData, JourneyEvent } from '../types';
import { Calendar } from 'lucide-react';
import clsx from 'clsx';

type PeriodType = 'week' | 'month' | 'year' | 'all';

export default function MyJourney() {
  const { currentProfile } = useProfile();
  const [journeyData, setJourneyData] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('month');

  useEffect(() => {
    if (!currentProfile) return;
    loadHistory();
  }, [currentProfile, selectedPeriod]);

  const loadHistory = async () => {
    if (!currentProfile) return;

    try {
      setLoading(true);
      const response = await profilesAPI.getHistory(currentProfile.id, selectedPeriod);
      setJourneyData(response.data);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: selectedPeriod === 'year' || selectedPeriod === 'all' ? 'numeric' : undefined
    });
  };

  const getEventEmoji = (type: JourneyEvent['type'], category?: string) => {
    if (type === 'goal_achieved') return '🏆';
    switch (category) {
      case 'homework': return '📚';
      case 'chore': return '🧹';
      case 'health': return '💪';
      case 'creative': return '🎨';
      case 'social': return '👥';
      default: return '✅';
    }
  };

  const getPeriodLabel = (period: PeriodType) => {
    switch (period) {
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      case 'year': return 'This Year';
      case 'all': return 'All Time';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  const summary = journeyData?.summary || {
    total_points: 0,
    total_stars: 0,
    tasks_completed: 0,
    goals_achieved: 0,
    meals_logged: 0
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="text-6xl mb-3">🗺️</div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          My Journey
        </h1>
        <p className="text-lg text-gray-600">
          See how far you've come, {currentProfile?.name}!
        </p>
      </div>

      {/* Period Selector */}
      <div className="flex justify-center gap-2 mb-6">
        {(['week', 'month', 'year', 'all'] as PeriodType[]).map((period) => (
          <button
            key={period}
            onClick={() => setSelectedPeriod(period)}
            className={clsx(
              'px-4 py-3 rounded-xl font-bold text-sm md:text-base transition-all',
              selectedPeriod === period
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg scale-105'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {getPeriodLabel(period)}
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="rounded-2xl p-4 md:p-5 bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-lg">
          <div className="text-center">
            <div className="text-3xl md:text-4xl mb-1">✅</div>
            <p className="text-2xl md:text-3xl font-bold">{summary.tasks_completed}</p>
            <p className="text-green-100 text-sm">Tasks Done</p>
          </div>
        </div>

        <div className="rounded-2xl p-4 md:p-5 bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg">
          <div className="text-center">
            <div className="text-3xl md:text-4xl mb-1">⭐</div>
            <p className="text-2xl md:text-3xl font-bold">{summary.total_stars}</p>
            <p className="text-yellow-100 text-sm">Stars</p>
          </div>
        </div>

        <div className="rounded-2xl p-4 md:p-5 bg-gradient-to-br from-purple-400 to-pink-500 text-white shadow-lg">
          <div className="text-center">
            <div className="text-3xl md:text-4xl mb-1">🎯</div>
            <p className="text-2xl md:text-3xl font-bold">{summary.total_points}</p>
            <p className="text-purple-100 text-sm">Points</p>
          </div>
        </div>

        <div className="rounded-2xl p-4 md:p-5 bg-gradient-to-br from-blue-400 to-cyan-500 text-white shadow-lg">
          <div className="text-center">
            <div className="text-3xl md:text-4xl mb-1">🏆</div>
            <p className="text-2xl md:text-3xl font-bold">{summary.goals_achieved}</p>
            <p className="text-blue-100 text-sm">Goals</p>
          </div>
        </div>
      </div>

      {/* Achievement Banner */}
      {summary.tasks_completed >= 10 && (
        <div className="rounded-2xl p-5 bg-gradient-to-r from-yellow-100 to-orange-100 border-2 border-yellow-300 mb-6">
          <div className="flex items-center gap-4">
            <div className="text-5xl">🌟</div>
            <div>
              <h3 className="text-lg md:text-xl font-bold text-gray-900">
                Amazing Progress!
              </h3>
              <p className="text-gray-700">
                You've completed {summary.tasks_completed} tasks {getPeriodLabel(selectedPeriod).toLowerCase()}!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="rounded-2xl p-5 bg-white border-2 border-gray-200 shadow-sm">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Calendar className="text-primary-600" size={24} />
          Your Achievements
        </h2>

        {journeyData?.timeline && journeyData.timeline.length > 0 ? (
          <div className="space-y-3">
            {journeyData.timeline.map((event, index) => (
              <div
                key={index}
                className={clsx(
                  'flex items-center gap-4 p-4 rounded-xl transition-all',
                  event.type === 'goal_achieved'
                    ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200'
                    : 'bg-gray-50 hover:bg-gray-100'
                )}
              >
                <div className="text-3xl">
                  {getEventEmoji(event.type, event.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {event.title}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatDate(event.date)}
                  </p>
                </div>
                {event.points && (
                  <div className={clsx(
                    'px-3 py-1 rounded-full font-bold text-sm',
                    event.type === 'goal_achieved'
                      ? 'bg-yellow-200 text-yellow-800'
                      : 'bg-green-200 text-green-800'
                  )}>
                    +{event.points} pts
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🚀</div>
            <p className="text-lg font-semibold text-gray-900 mb-1">
              No achievements yet!
            </p>
            <p className="text-gray-600">
              Complete tasks and goals to see them here
            </p>
          </div>
        )}
      </div>

      {/* Period Info */}
      {journeyData?.period && (
        <div className="mt-4 text-center text-sm text-gray-500">
          Showing data from {journeyData.period.start} to {journeyData.period.end}
        </div>
      )}
    </div>
  );
}
