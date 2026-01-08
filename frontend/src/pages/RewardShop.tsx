import { useEffect, useState } from 'react';
import { Gift, Star, ShoppingBag, Check, Clock, Sparkles, AlertCircle } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { useAge } from '../context/AgeContext';
import { rewardsAPI, Reward, RewardClaim } from '../services/api';
import playSounds from '../utils/sounds';
import confetti from 'canvas-confetti';

export default function RewardShop() {
  const { currentProfile } = useProfile();
  const { settings, isYoungChild } = useAge();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [claimedRewards, setClaimedRewards] = useState<RewardClaim[]>([]);
  const [availablePoints, setAvailablePoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [showClaimed, setShowClaimed] = useState(false);

  useEffect(() => {
    if (currentProfile?.id) {
      loadShop();
      loadClaimedRewards();
    }
  }, [currentProfile?.id]);

  const loadShop = async () => {
    if (!currentProfile?.id) return;
    try {
      setLoading(true);
      const response = await rewardsAPI.getShop(currentProfile.id);
      setRewards(response.data.rewards);
      setAvailablePoints(response.data.availablePoints);
    } catch (error) {
      console.error('Failed to load shop:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadClaimedRewards = async () => {
    if (!currentProfile?.id) return;
    try {
      const response = await rewardsAPI.getClaimed(currentProfile.id);
      setClaimedRewards(response.data);
    } catch (error) {
      console.error('Failed to load claimed rewards:', error);
    }
  };

  const handlePurchase = async (reward: Reward) => {
    if (!currentProfile?.id || purchasing) return;
    if (availablePoints < reward.points_required) return;

    setPurchasing(reward.id);
    try {
      const response = await rewardsAPI.purchase(reward.id, currentProfile.id);
      if (response.data.success) {
        // Celebration!
        playSounds.levelUp();
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#00CED1', '#9370DB']
        });

        setAvailablePoints(response.data.newBalance);
        loadClaimedRewards();

        // Remove from available rewards if stock depleted
        loadShop();
      }
    } catch (error: any) {
      console.error('Failed to purchase reward:', error);
      playSounds.error();
    } finally {
      setPurchasing(null);
    }
  };

  // Filter out already claimed rewards and split by affordability
  const availableRewards = rewards.filter(r => !r.user_claim_status);
  const alreadyClaimed = rewards.filter(r => r.user_claim_status);
  const canAfford = availableRewards.filter(r => r.points_required <= availablePoints);
  const saveUpFor = availableRewards.filter(r => r.points_required > availablePoints);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { color: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'Waiting' };
      case 'approved':
        return { color: 'bg-blue-100 text-blue-700', icon: Check, label: 'Approved' };
      case 'given':
        return { color: 'bg-green-100 text-green-700', icon: Gift, label: 'Received!' };
      case 'rejected':
        return { color: 'bg-red-100 text-red-700', icon: AlertCircle, label: 'Rejected' };
      default:
        return { color: 'bg-slate-100 text-slate-700', icon: Clock, label: status };
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading shop...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${settings.themeClass}`}>
      {/* Header with Points Balance */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`font-bold flex items-center gap-3 ${isYoungChild ? 'text-3xl' : 'text-2xl'}`}>
              <ShoppingBag className={isYoungChild ? 'w-10 h-10' : 'w-8 h-8'} />
              Reward Shop
            </h1>
            <p className="text-purple-100 mt-1">Spend your hard-earned points!</p>
          </div>
          <div className="text-right">
            <div className={`flex items-center gap-2 ${isYoungChild ? 'text-4xl' : 'text-3xl'} font-bold`}>
              <Star className={`${isYoungChild ? 'w-10 h-10' : 'w-8 h-8'} fill-yellow-300 text-yellow-300`} />
              {availablePoints.toLocaleString()}
            </div>
            <p className="text-purple-200 text-sm">points to spend</p>
          </div>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
        <button
          onClick={() => setShowClaimed(false)}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            !showClaimed ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <ShoppingBag className="w-4 h-4 inline mr-2" />
          Shop
        </button>
        <button
          onClick={() => setShowClaimed(true)}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            showClaimed ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <Gift className="w-4 h-4 inline mr-2" />
          My Rewards ({claimedRewards.length})
        </button>
      </div>

      {!showClaimed ? (
        <>
          {/* Can Afford Section */}
          {canAfford.length > 0 && (
            <div>
              <h2 className={`font-semibold text-slate-700 mb-4 flex items-center gap-2 ${isYoungChild ? 'text-xl' : 'text-lg'}`}>
                <Sparkles className="w-5 h-5 text-yellow-500" />
                Ready to Claim!
              </h2>
              <div className={`grid gap-4 ${isYoungChild ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
                {canAfford.map(reward => (
                  <RewardCard
                    key={reward.id}
                    reward={reward}
                    canAfford={true}
                    onPurchase={handlePurchase}
                    isPurchasing={purchasing === reward.id}
                    isYoungChild={isYoungChild}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Save Up Section */}
          {saveUpFor.length > 0 && (
            <div>
              <h2 className={`font-semibold text-slate-500 mb-4 ${isYoungChild ? 'text-xl' : 'text-lg'}`}>
                Save up for these...
              </h2>
              <div className={`grid gap-4 ${isYoungChild ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
                {saveUpFor.map(reward => (
                  <RewardCard
                    key={reward.id}
                    reward={reward}
                    canAfford={false}
                    availablePoints={availablePoints}
                    onPurchase={handlePurchase}
                    isPurchasing={false}
                    isYoungChild={isYoungChild}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Already Claimed Section */}
          {alreadyClaimed.length > 0 && (
            <div>
              <h2 className={`font-semibold text-slate-500 mb-4 flex items-center gap-2 ${isYoungChild ? 'text-xl' : 'text-lg'}`}>
                <Check className="w-5 h-5 text-green-500" />
                Already Claimed
              </h2>
              <div className={`grid gap-4 ${isYoungChild ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
                {alreadyClaimed.map(reward => (
                  <div
                    key={reward.id}
                    className="bg-white rounded-2xl border-2 border-green-200 overflow-hidden opacity-60"
                  >
                    <div className={`${isYoungChild ? 'h-32' : 'h-24'} bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center relative`}>
                      <span className={`${isYoungChild ? 'text-6xl' : 'text-4xl'}`}>{reward.icon || '🎁'}</span>
                      <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                        {reward.user_claim_status === 'pending' ? 'Pending' : 'Claimed'}
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className={`font-semibold text-slate-600 mb-1 ${isYoungChild ? 'text-lg' : 'text-base'}`}>
                        {reward.title}
                      </h3>
                      <div className="flex items-center gap-1 text-green-600 font-medium text-sm">
                        <Check className="w-4 h-4" />
                        {reward.user_claim_status === 'pending' ? 'Waiting for approval' : 'You got this!'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rewards.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
              <Gift className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No rewards available</h3>
              <p className="text-slate-500">Ask your parents to add some rewards!</p>
            </div>
          )}
        </>
      ) : (
        /* Claimed Rewards Section */
        <div>
          {claimedRewards.length > 0 ? (
            <div className="space-y-3">
              {claimedRewards.map(claim => {
                const status = getStatusBadge(claim.status);
                const StatusIcon = status.icon;
                return (
                  <div
                    key={claim.id}
                    className="bg-white rounded-xl p-4 border border-slate-200 flex items-center gap-4"
                  >
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center text-3xl">
                      {claim.icon || '🎁'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-800 truncate">{claim.title}</h3>
                      <p className="text-sm text-slate-500">{claim.points_spent} points</p>
                    </div>
                    <div className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 text-sm font-medium ${status.color}`}>
                      <StatusIcon className="w-4 h-4" />
                      {status.label}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
              <ShoppingBag className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No rewards claimed yet</h3>
              <p className="text-slate-500">Complete tasks to earn points and get rewards!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface RewardCardProps {
  reward: Reward;
  canAfford: boolean;
  availablePoints?: number;
  onPurchase: (reward: Reward) => void;
  isPurchasing: boolean;
  isYoungChild: boolean;
}

function RewardCard({ reward, canAfford, availablePoints, onPurchase, isPurchasing, isYoungChild }: RewardCardProps) {
  const pointsNeeded = availablePoints !== undefined ? reward.points_required - availablePoints : 0;

  return (
    <div
      className={`
        bg-white rounded-2xl border-2 overflow-hidden transition-all
        ${canAfford ? 'border-purple-200 hover:border-purple-400 hover:shadow-lg' : 'border-slate-200 opacity-75'}
      `}
    >
      {/* Reward Image/Icon */}
      <div className={`${isYoungChild ? 'h-32' : 'h-24'} bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center`}>
        {reward.image_url ? (
          <img src={reward.image_url} alt={reward.title} className="h-full w-full object-cover" />
        ) : (
          <span className={`${isYoungChild ? 'text-6xl' : 'text-4xl'}`}>{reward.icon || '🎁'}</span>
        )}
      </div>

      {/* Reward Info */}
      <div className="p-4">
        <h3 className={`font-semibold text-slate-800 mb-1 ${isYoungChild ? 'text-lg' : 'text-base'}`}>
          {reward.title}
        </h3>
        {reward.description && (
          <p className="text-sm text-slate-500 mb-3 line-clamp-2">{reward.description}</p>
        )}

        {/* Points and Action */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-purple-600 font-bold">
            <Star className="w-4 h-4 fill-current" />
            {reward.points_required.toLocaleString()}
          </div>

          {canAfford ? (
            <button
              onClick={() => onPurchase(reward)}
              disabled={isPurchasing}
              className={`
                px-4 py-2 rounded-xl font-medium transition-all
                ${isPurchasing
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600'
                }
              `}
            >
              {isPurchasing ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Getting...
                </span>
              ) : (
                'Get it!'
              )}
            </button>
          ) : (
            <div className="text-sm text-slate-400">
              Need {pointsNeeded.toLocaleString()} more
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
