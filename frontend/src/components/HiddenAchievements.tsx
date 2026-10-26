import { useState, useEffect } from 'react';
import { Award, Lock, Sparkles, Eye, EyeOff, HelpCircle, X } from 'lucide-react';
import { gamificationAPI, Achievement } from '../services/api';
import playSounds from '../utils/sounds';

interface HiddenAchievementsProps {
  profileId: number;
  showAll?: boolean;
}

export default function HiddenAchievements({ profileId, showAll = false }: HiddenAchievementsProps) {
  const [visible, setVisible] = useState<Achievement[]>([]);
  const [earnedHidden, setEarnedHidden] = useState<Achievement[]>([]);
  const [hiddenStats, setHiddenStats] = useState({ totalHidden: 0, earnedHidden: 0, remaining: 0 });
  const [loading, setLoading] = useState(true);
  const [showHiddenSection, setShowHiddenSection] = useState(false);
  const [newlyUnlocked, setNewlyUnlocked] = useState<Achievement | null>(null);
  const [showUnlockModal, setShowUnlockModal] = useState(false);

  useEffect(() => {
    const loadAchievements = async () => {
      try {
        const res = await gamificationAPI.getAchievementsWithHidden(profileId);
        setVisible(res.data.visible);
        setEarnedHidden(res.data.earnedHidden);
        setHiddenStats(res.data.hiddenStats);
      } catch (error) {
        console.error('Failed to load achievements:', error);
      } finally {
        setLoading(false);
      }
    };
    loadAchievements();
  }, [profileId]);

  // Check for newly unlocked hidden achievements
  useEffect(() => {
    const checkNewUnlocks = () => {
      const lastCheck = localStorage.getItem(`lastHiddenAchievementCheck_${profileId}`);
      const lastEarnedIds = lastCheck ? JSON.parse(lastCheck) : [];

      const newUnlocks = earnedHidden.filter(a => !lastEarnedIds.includes(a.id));

      if (newUnlocks.length > 0 && !loading) {
        setNewlyUnlocked(newUnlocks[0]);
        setShowUnlockModal(true);
        playSounds.levelUp();

        // Update stored IDs
        localStorage.setItem(
          `lastHiddenAchievementCheck_${profileId}`,
          JSON.stringify(earnedHidden.map(a => a.id))
        );
      }
    };

    if (earnedHidden.length > 0) {
      checkNewUnlocks();
    }
  }, [earnedHidden, profileId, loading]);

  if (loading) {
    return (
      <div className="rounded-2xl p-5 bg-gradient-to-r from-pink-100 to-purple-100 border-2 border-purple-300 animate-pulse">
        <div className="h-6 bg-purple-200 rounded w-1/2 mb-4"></div>
        <div className="flex gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 w-24 bg-purple-100 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  const earnedVisible = visible.filter(a => a.earned);
  const totalEarned = earnedVisible.length + earnedHidden.length;
  const totalCount = visible.length + hiddenStats.totalHidden;

  const displayAchievements = showAll ? visible : earnedVisible.slice(0, 6);

  return (
    <>
      <div className="rounded-2xl p-5 bg-gradient-to-r from-pink-100 to-purple-100 border-2 border-purple-300">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Award className="text-purple-600" size={24} />
            Achievements ({totalEarned}/{totalCount})
          </h3>

          {hiddenStats.totalHidden > 0 && (
            <button
              onClick={() => setShowHiddenSection(!showHiddenSection)}
              className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800 transition-colors"
            >
              {showHiddenSection ? <EyeOff size={16} /> : <Eye size={16} />}
              <span>{hiddenStats.remaining} Secret</span>
            </button>
          )}
        </div>

        {/* Earned Achievements */}
        {displayAchievements.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-3">
            {displayAchievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`px-3 py-2 rounded-lg border flex items-center gap-2 transition-all ${
                  achievement.earned
                    ? 'bg-white border-purple-200'
                    : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
                title={achievement.description}
              >
                <span className="text-xl">{achievement.icon}</span>
                <span className={`text-sm font-medium ${achievement.earned ? 'text-gray-800' : 'text-gray-500'}`}>
                  {achievement.name}
                </span>
                {!achievement.earned && <Lock size={12} className="text-gray-400" />}
              </div>
            ))}
            {earnedVisible.length > 6 && !showAll && (
              <div className="bg-purple-200 px-3 py-2 rounded-lg text-sm font-medium text-purple-700">
                +{earnedVisible.length - 6} more
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-600 mb-3">Complete tasks and drink water to earn achievements!</p>
        )}

        {/* Unlocked Hidden Achievements Section */}
        {earnedHidden.length > 0 && (
          <div className="mb-3 pt-3 border-t border-purple-200">
            <h4 className="text-sm font-bold text-purple-700 mb-2 flex items-center gap-1">
              <Sparkles size={14} className="text-yellow-500" />
              Secret Achievements Unlocked!
            </h4>
            <div className="flex flex-wrap gap-2">
              {earnedHidden.map((achievement) => (
                <div
                  key={achievement.id}
                  className="px-3 py-2 rounded-lg bg-gradient-to-r from-yellow-100 to-amber-100 border border-yellow-300 flex items-center gap-2"
                  title={`${achievement.description} - Earned!`}
                >
                  <span className="text-xl">{achievement.icon}</span>
                  <span className="text-sm font-medium text-yellow-800">{achievement.name}</span>
                  <Sparkles size={12} className="text-yellow-600" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hidden Achievements Hints */}
        {showHiddenSection && hiddenStats.remaining > 0 && (
          <div className="pt-3 border-t border-purple-200">
            <h4 className="text-sm font-bold text-gray-600 mb-2 flex items-center gap-1">
              <HelpCircle size={14} />
              Secret Achievements ({hiddenStats.remaining} remaining)
            </h4>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: Math.min(hiddenStats.remaining, 5) }).map((_, i) => (
                <div
                  key={i}
                  className="px-3 py-2 rounded-lg bg-gray-100 border border-dashed border-gray-300 flex items-center gap-2"
                >
                  <span className="text-xl opacity-50">❓</span>
                  <span className="text-sm text-gray-400 italic">???</span>
                  <Lock size={12} className="text-gray-300" />
                </div>
              ))}
              {hiddenStats.remaining > 5 && (
                <div className="px-3 py-2 rounded-lg bg-gray-50 text-sm text-gray-500">
                  +{hiddenStats.remaining - 5} more secrets...
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2 italic">
              Hint: Try completing tasks at different times, on weekends, or in quick succession!
            </p>
          </div>
        )}
      </div>

      {/* Secret Achievement Unlocked Modal */}
      {showUnlockModal && newlyUnlocked && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
            <div className="relative bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 p-8 rounded-3xl shadow-2xl text-center max-w-sm w-full my-4 overflow-hidden">
            {/* Sparkle effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(15)].map((_, i) => (
                <Sparkles
                  key={i}
                  className="absolute text-white animate-pulse"
                  size={16}
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 2}s`
                  }}
                />
              ))}
            </div>

            <button
              onClick={() => {
                setShowUnlockModal(false);
                setNewlyUnlocked(null);
              }}
              className="absolute top-4 right-4 text-white/70 hover:text-white"
            >
              <X size={24} />
            </button>

            <div className="text-8xl mb-4 animate-bounce drop-shadow-lg">
              {newlyUnlocked.icon}
            </div>

            <div className="bg-white/20 px-4 py-1 rounded-full inline-block mb-3">
              <span className="text-white text-sm font-bold flex items-center gap-1">
                <Sparkles size={14} /> SECRET UNLOCKED! <Sparkles size={14} />
              </span>
            </div>

            <h2 className="text-2xl font-black text-white mb-2 drop-shadow-lg">
              {newlyUnlocked.name}
            </h2>

            <p className="text-white/90 mb-4">
              {newlyUnlocked.description}
            </p>

            {newlyUnlocked.points_reward > 0 && (
              <div className="bg-white/30 rounded-xl p-3 mb-4">
                <p className="text-white text-lg font-bold">
                  +{newlyUnlocked.points_reward} Bonus Points!
                </p>
              </div>
            )}

            <button
              onClick={() => {
                setShowUnlockModal(false);
                setNewlyUnlocked(null);
              }}
              className="w-full py-3 bg-white text-amber-600 rounded-xl font-bold text-lg hover:bg-amber-50 transition-colors shadow-lg"
            >
              Amazing!
            </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
