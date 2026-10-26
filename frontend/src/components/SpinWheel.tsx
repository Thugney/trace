import { useState, useEffect, useRef, useCallback } from 'react';
import { Gift, Star, Trophy, X } from 'lucide-react';
import { gamificationAPI, SpinWheelPrize } from '../services/api';
import playSounds from '../utils/sounds';

interface SpinWheelProps {
  profileId: number;
  onSpinComplete?: () => void;
}

// Prize colors for the wheel
const PRIZE_COLORS = [
  '#22c55e', // green
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ec4899', // pink
  '#ef4444', // red
  '#06b6d4', // cyan
  '#fbbf24', // yellow
];

export default function SpinWheel({ profileId, onSpinComplete }: SpinWheelProps) {
  const [canSpin, setCanSpin] = useState(false);
  const [tasksUntilSpin, setTasksUntilSpin] = useState(5);
  const [totalSpins, setTotalSpins] = useState(0);
  const [prizes, setPrizes] = useState<SpinWheelPrize[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<{ prize: SpinWheelPrize; pointsAwarded: number; starsAwarded: number } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);

  const loadSpinWheel = useCallback(async () => {
    try {
      const res = await gamificationAPI.getSpinWheel(profileId);
      setCanSpin(res.data.canSpin);
      setTasksUntilSpin(res.data.tasksUntilSpin);
      setTotalSpins(res.data.totalSpins);
      setPrizes(res.data.prizes);
    } catch (error) {
      console.error('Failed to load spin wheel:', error);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadSpinWheel();
  }, [loadSpinWheel]);

  const spin = async () => {
    if (spinning || !canSpin) return;

    setSpinning(true);
    setShowResult(false);

    try {
      const res = await gamificationAPI.spinWheel(profileId);
      const prizeIndex = res.data.prize.index;

      // Calculate rotation to land on prize
      const sliceAngle = 360 / prizes.length;
      const targetAngle = sliceAngle * prizeIndex;
      // Add extra rotations (5 full spins) + target position
      const newRotation = rotation + 360 * 5 + (360 - targetAngle - sliceAngle / 2);

      setRotation(newRotation);
      playSounds.click();

      // Wait for spin animation to complete
      setTimeout(() => {
        setResult({
          prize: res.data.prize,
          pointsAwarded: res.data.pointsAwarded,
          starsAwarded: res.data.starsAwarded
        });
        setShowResult(true);
        setSpinning(false);
        setCanSpin(false);
        setTasksUntilSpin(5);

        if (res.data.prize.type === 'jackpot') {
          playSounds.levelUp();
        } else {
          playSounds.bonusClaimed();
        }

        onSpinComplete?.();
      }, 4000);
    } catch (error: any) {
      console.error('Spin failed:', error);
      setSpinning(false);
      if (error.response?.data?.tasksNeeded) {
        setTasksUntilSpin(error.response.data.tasksNeeded);
        setCanSpin(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl p-5 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 animate-pulse">
        <div className="h-6 bg-purple-200 rounded w-3/4 mb-3"></div>
        <div className="h-32 bg-purple-100 rounded-full w-32 mx-auto"></div>
      </div>
    );
  }

  return (
    <>
      {/* Compact Card */}
      <div className="rounded-2xl p-5 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
          <Gift className="text-purple-500" size={24} />
          Lucky Spin Wheel
        </h3>

        <div className="text-center">
          {canSpin ? (
            <>
              <div className="text-5xl mb-2 animate-bounce">🎰</div>
              <p className="text-purple-700 font-bold mb-3">Spin Ready!</p>
              <button
                onClick={() => setShowModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-bold text-lg hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg animate-pulse"
              >
                SPIN NOW!
              </button>
            </>
          ) : (
            <>
              <div className="text-4xl mb-2">🎡</div>
              <p className="text-gray-600 mb-1">Complete tasks to earn a spin!</p>
              <div className="flex items-center justify-center gap-1 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-6 h-6 rounded-full ${
                      i < (5 - tasksUntilSpin)
                        ? 'bg-purple-500'
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <p className="text-sm text-purple-600 font-medium">
                {tasksUntilSpin} tasks until spin!
              </p>
            </>
          )}
        </div>

        {totalSpins > 0 && (
          <div className="mt-4 pt-3 border-t border-purple-200 text-center">
            <span className="text-sm text-gray-500">
              Total spins: <span className="font-bold text-purple-600">{totalSpins}</span>
            </span>
          </div>
        )}
      </div>

      {/* Full Screen Spin Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
            <div className="bg-gradient-to-br from-purple-900 to-pink-900 rounded-3xl p-6 max-w-md w-full my-4 relative overflow-hidden">
            {/* Close button */}
            {!spinning && (
              <button
                onClick={() => {
                  setShowModal(false);
                  setShowResult(false);
                  loadSpinWheel();
                }}
                className="absolute top-4 right-4 text-white/70 hover:text-white z-10"
              >
                <X size={24} />
              </button>
            )}

            {/* Sparkles effect */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <Star
                  key={i}
                  className="absolute text-yellow-300 animate-pulse"
                  size={12}
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 2}s`,
                    opacity: 0.5
                  }}
                />
              ))}
            </div>

            <h2 className="text-2xl font-black text-white text-center mb-4">
              Lucky Spin Wheel!
            </h2>

            {/* Wheel Container */}
            <div className="relative w-64 h-64 mx-auto mb-6">
              {/* Pointer */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
                <div className="w-0 h-0 border-l-[15px] border-r-[15px] border-t-[25px] border-l-transparent border-r-transparent border-t-yellow-400 drop-shadow-lg" />
              </div>

              {/* Wheel */}
              <div
                ref={wheelRef}
                className="w-full h-full rounded-full border-8 border-yellow-400 shadow-2xl overflow-hidden relative"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none'
                }}
              >
                {prizes.map((prize, i) => {
                  const sliceAngle = 360 / prizes.length;
                  const rotate = sliceAngle * i;
                  return (
                    <div
                      key={i}
                      className="absolute w-1/2 h-1/2 origin-bottom-right"
                      style={{
                        transform: `rotate(${rotate}deg) skewY(${90 - sliceAngle}deg)`,
                        backgroundColor: PRIZE_COLORS[i % PRIZE_COLORS.length],
                        left: '0',
                        top: '0'
                      }}
                    >
                      <div
                        className="absolute w-full text-white text-xs font-bold flex items-center justify-center"
                        style={{
                          transform: `skewY(${-(90 - sliceAngle)}deg) rotate(${sliceAngle / 2}deg)`,
                          top: '30%',
                          left: '10%',
                          width: '80%'
                        }}
                      >
                        {prize.type === 'jackpot' ? '🎰' : prize.type === 'stars' ? '⭐' : '💰'}
                      </div>
                    </div>
                  );
                })}
                {/* Center circle */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center">
                  <span className="text-2xl">🎲</span>
                </div>
              </div>
            </div>

            {/* Result Display */}
            {showResult && result && (
              <div className="text-center mb-4 animate-fadeIn">
                <div className={`text-6xl mb-2 ${result.prize.type === 'jackpot' ? 'animate-bounce' : ''}`}>
                  {result.prize.type === 'jackpot' ? '🎰' :
                   result.prize.type === 'stars' ? '⭐' :
                   result.prize.type === 'multiplier' ? '⚡' : '💰'}
                </div>
                <p className="text-xl font-bold text-white mb-1">
                  {result.prize.description}
                </p>
                {result.pointsAwarded > 0 && (
                  <p className="text-yellow-300 font-bold">+{result.pointsAwarded} points!</p>
                )}
                {result.starsAwarded > 0 && (
                  <p className="text-yellow-300 font-bold">+{result.starsAwarded} stars!</p>
                )}
              </div>
            )}

            {/* Spin Button */}
            {!showResult && (
              <button
                onClick={spin}
                disabled={spinning || !canSpin}
                className="w-full py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-purple-900 rounded-xl font-black text-xl hover:from-yellow-300 hover:to-orange-400 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {spinning ? (
                  <>
                    <div className="w-6 h-6 border-4 border-purple-900 border-t-transparent rounded-full animate-spin" />
                    SPINNING...
                  </>
                ) : (
                  <>
                    <Trophy size={24} />
                    SPIN TO WIN!
                  </>
                )}
              </button>
            )}

            {showResult && (
              <button
                onClick={() => {
                  setShowModal(false);
                  setShowResult(false);
                  loadSpinWheel();
                }}
                className="w-full py-4 bg-white text-purple-900 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors"
              >
                Awesome!
              </button>
            )}

            {/* Prize Legend */}
            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              {prizes.slice(0, 4).map((prize, i) => (
                <div
                  key={i}
                  className="p-2 rounded-lg text-white text-xs"
                  style={{ backgroundColor: `${PRIZE_COLORS[i]}90` }}
                >
                  {prize.description.split(' ')[0]}
                </div>
              ))}
            </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
