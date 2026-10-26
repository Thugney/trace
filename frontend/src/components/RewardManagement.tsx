import { useState, useEffect, useCallback } from 'react';
import { Gift, Plus, Edit2, Trash2, Check, X, Clock, Star, Save, Users, User, Tag } from 'lucide-react';
import { rewardsAPI, Reward, RewardClaim, RewardCategory } from '../services/api';
import playSounds from '../utils/sounds';
import { useToast } from './Toast';
import Avatar from './Avatar';

interface ChildInfo {
  id: number;
  name: string;
  avatar: string;
  age: number;
}

interface RewardManagementProps {
  parentId: number;
}

function dedupeRewardCategories(items: RewardCategory[]) {
  const unique = new Map<string, RewardCategory>();

  for (const item of items) {
    const key = (item.name || item.display_name).trim().toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, item);
    }
  }

  return Array.from(unique.values());
}

export default function RewardManagement({ parentId }: RewardManagementProps) {
  const toast = useToast();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [pendingClaims, setPendingClaims] = useState<RewardClaim[]>([]);
  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [categories, setCategories] = useState<RewardCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [activeTab, setActiveTab] = useState<'rewards' | 'claims' | 'categories'>('rewards');
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    pointsRequired: 100,
    icon: '🎁',
    stock: -1, // -1 = unlimited
    targetChild: 'all' as 'all' | number, // 'all' or specific child ID
    category: 'general' // NEW: category selection
  });

  // Category form state
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    displayName: '',
    icon: '🎁',
    description: '',
    color: '#9333ea'
  });
  const visibleCategories = dedupeRewardCategories(categories);

  // The toast context object is rebuilt each render, but its methods are stable.
  const toastError = toast.error;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [rewardsRes, claimsRes, childrenRes, categoriesRes] = await Promise.all([
        rewardsAPI.getAll(parentId),
        rewardsAPI.getPending(parentId),
        rewardsAPI.getParentChildren(parentId),
        rewardsAPI.getCategories(parentId)
      ]);
      setRewards(rewardsRes.data);
      setPendingClaims(claimsRes.data);
      setChildren(childrenRes.data);
      setCategories(categoriesRes.data);
    } catch (error: any) {
      console.error('Failed to load rewards data:', error);
      toastError('Failed to load rewards');
    } finally {
      setLoading(false);
    }
  }, [parentId, toastError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      const isForAllChildren = formData.targetChild === 'all';
      const targetProfileId: number | null = isForAllChildren ? null : (formData.targetChild as number);

      if (editingReward) {
        await rewardsAPI.update(editingReward.id, {
          title: formData.title,
          description: formData.description,
          points_required: formData.pointsRequired,
          icon: formData.icon,
          stock: formData.stock,
          available_for_all: isForAllChildren,
          profile_id: targetProfileId,
          category: formData.category
        });
        toast.success('Reward updated!');
      } else {
        await rewardsAPI.create({
          title: formData.title,
          description: formData.description,
          pointsRequired: formData.pointsRequired,
          icon: formData.icon,
          stock: formData.stock,
          createdBy: parentId,
          availableForAll: isForAllChildren,
          profileId: targetProfileId,
          category: formData.category
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
    setFormData({ title: '', description: '', pointsRequired: 100, icon: '🎁', stock: -1, targetChild: 'all', category: 'general' });
    setEditingReward(null);
    setShowForm(false);
  };

  const startEdit = (reward: Reward) => {
    setFormData({
      title: reward.title,
      description: reward.description || '',
      pointsRequired: reward.points_required,
      icon: reward.icon || '🎁',
      stock: reward.stock ?? -1,
      targetChild: reward.available_for_all ? 'all' : (reward.profile_id || 'all'),
      category: reward.category || 'general'
    });
    setEditingReward(reward);
    setShowForm(true);
  };

  // Category management functions
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryFormData.displayName.trim()) {
      toast.error('Please enter a category name');
      return;
    }

    setSaving(true);
    try {
      await rewardsAPI.createCategory({
        name: categoryFormData.displayName.toLowerCase().replace(/\s+/g, '_'),
        displayName: categoryFormData.displayName,
        icon: categoryFormData.icon,
        description: categoryFormData.description,
        color: categoryFormData.color
      });
      toast.success('Category created!');
      playSounds.achievement();
      setCategoryFormData({ name: '', displayName: '', icon: '🎁', description: '', color: '#9333ea' });
      setShowCategoryForm(false);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create category');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    if (!confirm('Delete this category? Rewards using it will be moved to General.')) return;
    try {
      await rewardsAPI.deleteCategory(categoryId);
      toast.success('Category deleted');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete category');
    }
  };

  // Helper to get child name from ID
  const getChildName = (childId: number | null | undefined): string => {
    if (!childId) return 'All Children';
    const child = children.find(c => c.id === childId);
    return child?.name || `Child #${childId}`;
  };

  const commonIcons = ['🎁', '🎮', '🍦', '🎬', '📱', '🎨', '⚽', '🎵', '📚', '🧸', '🎪', '🏆'];

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
          Pending ({pendingClaims.length})
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'categories' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-600'
          }`}
        >
          <Tag className="w-4 h-4 inline mr-2" />
          Categories
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Icon</label>
              <div className="flex flex-wrap gap-2">
                {commonIcons.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon })}
                    className={`w-10 h-10 text-xl rounded-lg border-2 transition-all ${
                      formData.icon === icon
                        ? 'border-purple-500 bg-purple-100'
                        : 'border-slate-200 hover:border-purple-300'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                {visibleCategories.map(cat => (
                  <option key={cat.id} value={cat.name}>
                    {cat.icon} {cat.display_name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Categorize rewards for easier browsing
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Available For</label>
              <select
                value={formData.targetChild}
                onChange={e => setFormData({ ...formData, targetChild: e.target.value === 'all' ? 'all' : parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All My Children</option>
                {children.map(child => (
                  <option key={child.id} value={child.id}>
                    {child.name} only
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                {formData.targetChild === 'all'
                  ? 'All your children can claim this reward'
                  : `Only ${getChildName(formData.targetChild as number)} can see and claim this reward`
                }
              </p>
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
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-sm text-purple-600 font-medium">
                      <Star size={14} className="fill-current" />
                      {reward.points_required} pts
                    </span>
                    <span className="text-sm text-slate-400">
                      Stock: {reward.stock === -1 ? '∞' : reward.stock}
                    </span>
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                      reward.available_for_all
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {reward.available_for_all ? (
                        <>
                          <Users size={12} />
                          All children
                        </>
                      ) : (
                        <>
                          <User size={12} />
                          {(reward as any).target_child_name || getChildName(reward.profile_id)}
                        </>
                      )}
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
                <div className="relative">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-100 to-orange-100 flex items-center justify-center text-3xl">
                    {claim.icon || '🎁'}
                  </div>
                  {/* Child avatar overlay */}
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-2 border-white shadow-sm overflow-hidden bg-slate-100">
                    <Avatar avatar={(claim as any).child_avatar} size="sm" alt={(claim as any).child_name} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800">{claim.title}</h3>
                  <p className="text-sm text-slate-600">
                    <span className="font-medium text-amber-700">{(claim as any).child_name || `Child #${claim.profile_id}`}</span>
                    {' '}wants this reward
                  </p>
                  <p className="text-sm text-purple-600 font-medium">
                    {claim.points_spent} points spent
                  </p>
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
                    title="Reject claim (refunds points)"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Categories Management Tab */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          {/* Add Category Form */}
          {showCategoryForm ? (
            <form onSubmit={handleCreateCategory} className="bg-indigo-50 rounded-xl p-4 space-y-4 border border-indigo-200">
              <h3 className="font-semibold text-indigo-800">Create Custom Category</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category Name</label>
                  <input
                    type="text"
                    value={categoryFormData.displayName}
                    onChange={e => setCategoryFormData({ ...categoryFormData, displayName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., Special Treats"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={categoryFormData.description}
                    onChange={e => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., Extra special rewards"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Icon</label>
                  <div className="flex flex-wrap gap-2">
                    {commonIcons.map(icon => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setCategoryFormData({ ...categoryFormData, icon })}
                        className={`w-10 h-10 text-xl rounded-lg border-2 transition-all ${
                          categoryFormData.icon === icon
                            ? 'border-indigo-500 bg-indigo-100'
                            : 'border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={categoryFormData.color}
                      onChange={e => setCategoryFormData({ ...categoryFormData, color: e.target.value })}
                      className="w-12 h-12 rounded-lg border border-slate-300 cursor-pointer"
                    />
                    <div
                      className="flex-1 h-12 rounded-lg flex items-center justify-center text-white font-medium"
                      style={{ backgroundColor: categoryFormData.color }}
                    >
                      {categoryFormData.icon} {categoryFormData.displayName || 'Preview'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Creating...' : <><Save size={18} /> Create Category</>}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryForm(false);
                    setCategoryFormData({ name: '', displayName: '', icon: '🎁', description: '', color: '#9333ea' });
                  }}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowCategoryForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus size={18} />
              Add Custom Category
            </button>
          )}

          {/* Categories List */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide">Default Categories</h3>
            {visibleCategories.filter(c => c.is_default).map(cat => (
              <div
                key={cat.id}
                className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl text-white"
                  style={{ backgroundColor: cat.color }}
                >
                  {cat.icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-800">{cat.display_name}</h4>
                  <p className="text-sm text-slate-500">{cat.description}</p>
                </div>
                <span className="px-2 py-1 bg-slate-100 text-slate-500 text-xs rounded">Default</span>
              </div>
            ))}

            {visibleCategories.filter(c => !c.is_default).length > 0 && (
              <>
                <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide mt-6">Your Custom Categories</h3>
                {visibleCategories.filter(c => !c.is_default).map(cat => (
                  <div
                    key={cat.id}
                    className="flex items-center gap-4 p-4 bg-white rounded-xl border border-indigo-200"
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl text-white"
                      style={{ backgroundColor: cat.color }}
                    >
                      {cat.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-800">{cat.display_name}</h4>
                      <p className="text-sm text-slate-500">{cat.description}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete category"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
