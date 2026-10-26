import { useEffect, useState } from 'react';
import { aiAPI } from '../services/api';
import { Brain, Heart, MessageCircle, Lightbulb, Frown, Smile, Meh, HelpCircle, Moon } from 'lucide-react';
import Avatar from './Avatar';
import clsx from 'clsx';
import { formatTimeAgo } from '../utils/dates';

interface ChildInsightsProps {
  parentId: number;
}

interface InsightsData {
  children: Array<{
    id: number;
    name: string;
    avatar: string;
    message_count: number;
    mood_summary: {
      happy: number;
      neutral: number;
      frustrated: number;
      curious: number;
      tired: number;
    };
  }>;
  encouragements: Array<{
    child_id: number;
    child_name: string;
    child_avatar: string;
    topic: string;
    encouragement: string;
    mood: string;
    timestamp: string;
  }>;
  quiz_suggestions: Array<{
    child_id: number;
    child_name: string;
    category: string;
    reason: string;
    difficulty_hint: string;
    timestamp: string;
  }>;
  period_days: number;
}

const moodIcons: Record<string, { icon: typeof Smile; color: string; label: string }> = {
  happy: { icon: Smile, color: 'text-green-500', label: 'Happy' },
  neutral: { icon: Meh, color: 'text-gray-500', label: 'Neutral' },
  frustrated: { icon: Frown, color: 'text-red-500', label: 'Frustrated' },
  curious: { icon: HelpCircle, color: 'text-blue-500', label: 'Curious' },
  tired: { icon: Moon, color: 'text-purple-500', label: 'Tired' }
};

export default function ChildInsights({ parentId }: ChildInsightsProps) {
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState<number | null>(null);

  useEffect(() => {
    const loadInsights = async () => {
      try {
        setLoading(true);
        const response = await aiAPI.getChildInsights(parentId, 7);
        setInsights(response.data);
        if (response.data.children.length > 0) {
          // Keep an existing selection; only default to the first child.
          setSelectedChild(prev => prev || response.data.children[0].id);
        }
      } catch (error) {
        console.error('Failed to load child insights:', error);
      } finally {
        setLoading(false);
      }
    };
    loadInsights();
  }, [parentId]);

  if (loading) {
    return (
      <div className="rounded-2xl p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-100">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="text-purple-600" size={24} />
          <h2 className="text-xl font-bold text-gray-900">AI Insights</h2>
        </div>
        <div className="flex items-center justify-center h-32">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (!insights || insights.children.length === 0) {
    return (
      <div className="rounded-2xl p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-100">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="text-purple-600" size={24} />
          <h2 className="text-xl font-bold text-gray-900">AI Insights</h2>
        </div>
        <p className="text-gray-600 text-center py-8">
          No AI interactions yet. When your children chat with the AI assistant, insights will appear here.
        </p>
      </div>
    );
  }

  const selectedChildData = insights.children.find(c => c.id === selectedChild);
  const childEncouragements = insights.encouragements.filter(e => e.child_id === selectedChild);
  const childQuizSuggestions = insights.quiz_suggestions.filter(q => q.child_id === selectedChild);

  // Calculate dominant mood
  const getDominantMood = (summary: { happy: number; neutral: number; frustrated: number; curious: number; tired: number }) => {
    const entries = Object.entries(summary) as [keyof typeof summary, number][];
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    if (sorted[0][1] === 0) return null;
    return sorted[0][0];
  };

  return (
    <div className="rounded-2xl p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Brain className="text-purple-600" size={24} />
          <h2 className="text-xl font-bold text-gray-900">AI Insights</h2>
        </div>
        <span className="text-sm text-gray-500">Last 7 days</span>
      </div>

      {/* Child Selector */}
      {insights.children.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {insights.children.map(child => (
            <button
              key={child.id}
              onClick={() => setSelectedChild(child.id)}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-xl transition-all whitespace-nowrap',
                selectedChild === child.id
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-white border border-gray-200 hover:border-purple-300'
              )}
            >
              <Avatar avatar={child.avatar} size="sm" alt={child.name} />
              <span className="font-medium">{child.name}</span>
            </button>
          ))}
        </div>
      )}

      {selectedChildData && (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-1">
                <MessageCircle className="text-blue-500" size={18} />
                <span className="text-sm text-gray-600">AI Chats</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{selectedChildData.message_count}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-1">
                <Heart className="text-red-500" size={18} />
                <span className="text-sm text-gray-600">Mood</span>
              </div>
              {getDominantMood(selectedChildData.mood_summary) ? (
                <div className="flex items-center gap-2">
                  {(() => {
                    const mood = getDominantMood(selectedChildData.mood_summary)!;
                    const MoodIcon = moodIcons[mood]?.icon || Meh;
                    return (
                      <>
                        <MoodIcon className={moodIcons[mood]?.color || 'text-gray-500'} size={24} />
                        <span className="font-medium">{moodIcons[mood]?.label || mood}</span>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <p className="text-gray-500">No data</p>
              )}
            </div>
          </div>

          {/* Encouragement Moments */}
          {childEncouragements.length > 0 && (
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Heart className="text-pink-500" size={18} />
                <span className="font-semibold text-gray-800">Support Moments</span>
              </div>
              <div className="space-y-3">
                {childEncouragements.slice(0, 3).map((enc, idx) => {
                  const MoodIcon = moodIcons[enc.mood]?.icon || Meh;
                  return (
                    <div key={idx} className="flex items-start gap-3 p-3 bg-pink-50 rounded-lg">
                      <MoodIcon className={clsx('mt-0.5', moodIcons[enc.mood]?.color || 'text-gray-500')} size={20} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{enc.topic}</p>
                        <p className="text-sm text-gray-600 mt-1">{enc.encouragement}</p>
                        <p className="text-xs text-gray-400 mt-1">{formatTimeAgo(enc.timestamp)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quiz Suggestions */}
          {childQuizSuggestions.length > 0 && (
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="text-yellow-500" size={18} />
                <span className="font-semibold text-gray-800">Quiz Suggestions</span>
              </div>
              <div className="space-y-2">
                {childQuizSuggestions.slice(0, 3).map((sug, idx) => (
                  <div key={idx} className="p-3 bg-yellow-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 capitalize">{sug.category}</span>
                      <span className="text-xs text-gray-400">{formatTimeAgo(sug.timestamp)}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{sug.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {childEncouragements.length === 0 && childQuizSuggestions.length === 0 && selectedChildData.message_count === 0 && (
            <div className="text-center py-6 text-gray-500">
              <Brain className="mx-auto mb-2 text-gray-400" size={32} />
              <p>{selectedChildData.name} hasn't chatted with the AI yet this week.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
