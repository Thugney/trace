import { useState, useEffect, useRef } from 'react';
import { Gift, Plus, Edit2, Trash2, Check, X, Clock, Star, Save } from 'lucide-react';
import { rewardsAPI, Reward, RewardClaim } from '../services/api';
import playSounds from '../utils/sounds';
import { useToast } from './Toast';

interface RewardManagementProps {
  parentId: number;
}

export default function RewardManagement({ parentId }: RewardManagementProps) {
  const toast = useToast();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [pendingClaims, setPendingClaims] = useState<RewardClaim[]>([]);
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [activeTab, setActiveTab] = useState<'rewards' | 'claims'>('rewards');
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const categoryInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    pointsRequired: 100,
    icon: '🎁',
    category: '',
    stock: -1 // -1 = unlimited
  });

  useEffect(() => {
    loadData();
  }, [parentId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rewardsRes, claimsRes, categoriesRes] = await Promise.all([
        rewardsAPI.getAll(),
        rewardsAPI.getPending(),
        rewardsAPI.getCategories().catch(() => ({ data: [] }))
      ]);
      setRewards(rewardsRes.data);
      setPendingClaims(claimsRes.data);
      setExistingCategories(categoriesRes.data);
    } catch (error: any) {
      console.error('Failed to load rewards data:', error);
      toast.error('Failed to load rewards');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (formData.pointsRequired < 1) {
      toast.error('Points must be at least 1');
      return;
    }

    setSaving(true);
    try {
      if (editingReward) {
        await rewardsAPI.update(editingReward.id, {
          title: formData.title,
          description: formData.description,
          points_required: formData.pointsRequired,
          icon: formData.icon,
          category: formData.category || 'general',
          stock: formData.stock
        });
        toast.success('Reward updated!');
      } else {
        await rewardsAPI.create({
          title: formData.title,
          description: formData.description,
          pointsRequired: formData.pointsRequired,
          icon: formData.icon,
          category: formData.category || 'general',
          stock: formData.stock,
          createdBy: parentId
        });
        toast.success('Reward added!');
      }
      playSounds.achievement();
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Failed to save reward:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to save reward';
      toast.error(errorMsg);
      playSounds.error();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rewardId: number) => {
    if (!confirm('Delete this reward?')) return;
    try {
      await rewardsAPI.delete(rewardId);
      loadData();
    } catch (error) {
      console.error('Failed to delete reward:', error);
    }
  };

  const handleClaimAction = async (claimId: number, status: 'approved' | 'rejected' | 'given') => {
    try {
      await rewardsAPI.updateClaimStatus(claimId, status, parentId);
      playSounds.achievement();
      loadData();
    } catch (error) {
      console.error('Failed to update claim:', error);
      playSounds.error();
    }
  };

  const resetForm = () => {
    setFormData({ title: '', description: '', pointsRequired: 100, icon: '🎁', category: '', stock: -1 });
    setEditingReward(null);
    setShowForm(false);
    setShowCategorySuggestions(false);
  };

  const startEdit = (reward: Reward) => {
    setFormData({
      title: reward.title,
      description: reward.description || '',
      pointsRequired: reward.points_required,
      icon: reward.icon || '🎁',
      category: reward.category || '',
      stock: reward.stock ?? -1
    });
    setEditingReward(reward);
    setShowForm(true);
  };

  const commonIcons = ['🎁', '🎮', '🍦', '🎬', '📱', '🎨', '⚽', '🎵', '📚', '🧸', '🎪', '🏆', '🍕', '🎯', '🎟️', '🧩', '🎸', '🏖️', '🎂', '🛍️'];

  // Filter category suggestions based on input
  const filteredCategories = existingCategories.filter(
    c => c.toLowerCase().includes(formData.category.toLowerCase()) && c.toLowerCase() !== formData.category.toLowerCase()
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Gift className="w-6 h-6 text-purple-600" />
          Reward Shop Management
        </h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus size={18} />
            Add Reward
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('rewards')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'rewards' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-600'
          }`}
        >
          <Gift className="w-4 h-4 inline mr-2" />
          Rewards ({rewards.length})
        </button>
        <button
          onClick={() => setActiveTab('claims')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'claims' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-600'
          }`}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          Pending Claims ({pendingClaims.length})
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-purple-50 rounded-xl p-4 space-y-4 border border-purple-200">
          <h3 className="font-semibold text-purple-800">
            {editingReward ? 'Edit Reward' : 'Add New Reward'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="e.g., Extra Screen Time"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Points Required</label>
              <input
                type="number"
                value={formData.pointsRequired}
                onChange={e => setFormData({ ...formData, pointsRequired: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                min="1"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
            <input
              type="text"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              placeholder="e.g., 30 minutes of extra TV or game time"
            />
          </div>

          {/* Icon picker: quick-select grid + freeform input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Icon</label>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 text-2xl rounded-xl border-2 border-purple-400 bg-purple-50 flex items-center justify-center">
                {formData.icon || '🎁'}
              </div>
              <input
                type="text"
                value={formData.icon}
                onChange={e => setFormData({ ...formData, icon: e.target.value })}
                className="w-24 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-center text-lg"
                placeholder="🎁"
                maxLength={4}
              />
              <span className="text-xs text-slate-400">Type any emoji or pick below</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {commonIcons.map(icon => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setFormData({ ...formData, icon })}
                  className={`w-9 h-9 text-lg rounded-lg border transition-all ${
                    formData.icon === icon
                      ? 'border-purple-500 bg-purple-100 scale-110'
                      : 'border-slate-200 hover:border-purple-300 hover:bg-purple-50'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category: freeform with autocomplete from existing */}
            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <input
                ref={categoryInputRef}
                type="text"
                value={formData.category}
                onChange={e => {
                  setFormData({ ...formData, category: e.target.value });
                  setShowCategorySuggestions(true);
                }}
                onFocus={() => setShowCategorySuggestions(true)}
                onBlur={() => setTimeout(() => setShowCategorySuggestions(false), 150)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="e.g., treats, activities, toys..."
              />
              {showCategorySuggestions && filteredCategories.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-32 overflow-y-auto">
                  {filteredCategories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        setFormData({ ...formData, category: cat });
                        setShowCategorySuggestions(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 transition-colors capitalize"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stock</label>
              <select
                value={formData.stock}
                onChange={e => setFormData({ ...formData, stock: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value={-1}>Unlimited</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  {editingReward ? 'Save Changes' : 'Add Reward'}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Rewards List */}
      {activeTab === 'rewards' && (
        <div className="space-y-3">
          {rewards.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-xl">
              <Gift className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No rewards yet. Add your first reward!</p>
            </div>
          ) : (
            rewards.map(reward => (
              <div
                key={reward.id}
                className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:shadow-md transition-shadow"
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center text-3xl">
                  {reward.icon || '🎁'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800">{reward.title}</h3>
                  {reward.description && (
                    <p className="text-sm text-slate-500 truncate">{reward.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-sm text-purple-600 font-medium">
                      <Star size={14} className="fill-current" />
                      {reward.points_required} pts
                    </span>
                    <span className="text-sm text-slate-400">
                      Stock: {reward.stock === -1 ? '∞' : reward.stock}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(reward)}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(reward.id)}
                    className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pending Claims */}
      {activeTab === 'claims' && (
        <div className="space-y-3">
          {pendingClaims.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-xl">
              <Check className="w-12 h-12 mx-auto text-green-300 mb-3" />
              <p className="text-slate-500">No pending claims to review!</p>
            </div>
          ) : (
            pendingClaims.map(claim => (
              <div
                key={claim.id}
                className="flex items-center gap-4 p-4 bg-white rounded-xl border border-yellow-200 shadow-sm"
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-100 to-orange-100 flex items-center justify-center text-3xl">
                  {claim.icon || '🎁'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800">{claim.title}</h3>
                  <p className="text-sm text-slate-500">
                    {(claim as any).child_name || `Profile #${claim.profile_id}`}
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-purple-600 font-medium">
                      {claim.points_spent} pts
                    </span>
                    {claim.stars_spent ? (
                      <span className="text-amber-600 font-medium">+ {claim.stars_spent} stars</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleClaimAction(claim.id, 'given')}
                    className="flex items-center gap-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                    title="Mark as given"
                  >
                    <Check size={18} />
                    Give
                  </button>
                  <button
                    onClick={() => handleClaimAction(claim.id, 'rejected')}
                    className="flex items-center gap-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                    title="Reject claim"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
