import { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Trash2, X, Play, Flag, Star, Users, Package, ChevronDown, ChevronRight, Edit2, Trophy, Settings, ToggleLeft, ToggleRight } from 'lucide-react';
import { shoppingAPI, ShoppingList as ShoppingListType, ShoppingTrip, ShoppingCategory, ShoppingLeaderboardEntry, profilesAPI } from '../services/api';
import { useProfile } from '../context/ProfileContext';
import { useToast } from '../components/Toast';
import Avatar from '../components/Avatar';
import playSounds from '../utils/sounds';

interface ChildPermission {
  id: number;
  name: string;
  avatar: string;
  can_create_shopping_lists: boolean;
}

interface ChildInfo {
  id: number;
  name: string;
  avatar?: string;
}

export default function ShoppingList() {
  const { currentProfile, isParent, isAdmin } = useProfile();
  const toast = useToast();

  // Data state
  const [lists, setLists] = useState<ShoppingListType[]>([]);
  const [categories, setCategories] = useState<ShoppingCategory[]>([]);
  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [activeTrips, setActiveTrips] = useState<ShoppingTrip[]>([]);
  const [leaderboard, setLeaderboard] = useState<ShoppingLeaderboardEntry[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'lists' | 'trips' | 'leaderboard' | 'settings'>('lists');
  const [childPermissions, setChildPermissions] = useState<ChildPermission[]>([]);
  const [togglingPermission, setTogglingPermission] = useState<number | null>(null);
  const [expandedList, setExpandedList] = useState<number | null>(null);
  const [showListForm, setShowListForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState<number | null>(null);
  const [showTripModal, setShowTripModal] = useState<ShoppingListType | null>(null);
  const [showCompleteTripModal, setShowCompleteTripModal] = useState<ShoppingTrip | null>(null);
  const [editingList, setEditingList] = useState<ShoppingListType | null>(null);

  // Form state
  const [listForm, setListForm] = useState({
    name: '',
    description: '',
    store_name: '',
    budget: 0,
    points_per_item: 5,
    bonus_for_completion: 20,
    bonus_for_good_behavior: 15
  });

  const [itemForm, setItemForm] = useState({
    name: '',
    quantity: 1,
    unit: '',
    category_id: 0,
    notes: '',
    points_value: 0
  });

  const [tripForm, setTripForm] = useState({
    scheduled_date: '',
    helper_ids: [] as number[]
  });

  const [completeTripForm, setCompleteTripForm] = useState({
    behavior_rating: 5,
    notes: ''
  });

  useEffect(() => {
    if (currentProfile?.id) {
      loadData();
    }
  }, [currentProfile?.id]);

  const loadData = async () => {
    if (!currentProfile) return;
    try {
      setLoading(true);
      const [listsRes, categoriesRes, childrenRes, tripsRes, leaderboardRes, permissionsRes] = await Promise.all([
        shoppingAPI.getLists(currentProfile.id, true),
        shoppingAPI.getCategories(),
        profilesAPI.getAll().then(res => res.data.filter((p: any) => p.type === 'child' && p.parent_id === currentProfile.id).map((p: any) => ({ id: p.id, name: p.name, avatar: p.avatar }))),
        shoppingAPI.getActiveTrips(currentProfile.id),
        shoppingAPI.getLeaderboard(currentProfile.id),
        shoppingAPI.getChildPermissions(currentProfile.id)
      ]);
      setLists(listsRes.data);
      setCategories(categoriesRes.data);
      setChildren(childrenRes as ChildInfo[]);
      setActiveTrips(tripsRes.data);
      setLeaderboard(leaderboardRes.data);
      setChildPermissions(permissionsRes.data);
    } catch (error: any) {
      console.error('Failed to load shopping data:', error);
      toast.error('Failed to load shopping data');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePermission = async (childId: number, currentValue: boolean) => {
    setTogglingPermission(childId);
    try {
      await shoppingAPI.setChildPermission(childId, !currentValue);
      setChildPermissions(prev => prev.map(p =>
        p.id === childId ? { ...p, can_create_shopping_lists: !currentValue } : p
      ));
      toast.success(!currentValue ? 'Shopping list creation enabled' : 'Shopping list creation disabled');
      playSounds.notification();
    } catch (error: any) {
      toast.error('Failed to update permission');
    } finally {
      setTogglingPermission(null);
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile || !listForm.name.trim()) return;

    setSaving(true);
    try {
      if (editingList) {
        await shoppingAPI.updateList(editingList.id, listForm);
        toast.success('List updated!');
      } else {
        await shoppingAPI.createList({
          ...listForm,
          parent_id: currentProfile.id
        });
        toast.success('List created!');
        playSounds.achievement();
      }
      resetListForm();
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save list');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteList = async (listId: number) => {
    if (!confirm('Delete this shopping list?')) return;
    try {
      await shoppingAPI.deleteList(listId);
      toast.success('List deleted');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete list');
    }
  };

  const handleAddItem = async (e: React.FormEvent, listId: number) => {
    e.preventDefault();
    if (!itemForm.name.trim()) return;

    setSaving(true);
    try {
      await shoppingAPI.addItem(listId, {
        ...itemForm,
        category_id: itemForm.category_id || undefined
      });
      toast.success('Item added!');
      setItemForm({ name: '', quantity: 1, unit: '', category_id: 0, notes: '', points_value: 0 });
      setShowItemForm(null);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to add item');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    try {
      await shoppingAPI.deleteItem(itemId);
      loadData();
    } catch (error: any) {
      toast.error('Failed to delete item');
    }
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showTripModal || tripForm.helper_ids.length === 0) {
      toast.error('Please select at least one helper');
      return;
    }

    setSaving(true);
    try {
      const tripRes = await shoppingAPI.createTrip({
        list_id: showTripModal.id,
        scheduled_date: tripForm.scheduled_date || undefined
      });

      // Add helpers
      for (const helperId of tripForm.helper_ids) {
        await shoppingAPI.addHelper(tripRes.data.id, helperId);
      }

      toast.success('Shopping trip created!');
      playSounds.achievement();
      setShowTripModal(null);
      setTripForm({ scheduled_date: '', helper_ids: [] });
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create trip');
    } finally {
      setSaving(false);
    }
  };

  const handleStartTrip = async (tripId: number) => {
    try {
      await shoppingAPI.startTrip(tripId);
      toast.success('Trip started! Kids can now mark items.');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to start trip');
    }
  };

  const handleCompleteTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCompleteTripModal) return;

    setSaving(true);
    try {
      const result = await shoppingAPI.completeTrip(showCompleteTripModal.id, {
        behavior_rating: completeTripForm.behavior_rating,
        notes: completeTripForm.notes || undefined
      });

      toast.success(`Trip completed! ${result.data.total_points_awarded} points awarded!`);
      playSounds.taskComplete();
      setShowCompleteTripModal(null);
      setCompleteTripForm({ behavior_rating: 5, notes: '' });
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to complete trip');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelTrip = async (tripId: number) => {
    if (!confirm('Cancel this shopping trip?')) return;
    try {
      await shoppingAPI.cancelTrip(tripId);
      toast.success('Trip cancelled');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to cancel trip');
    }
  };

  const resetListForm = () => {
    setListForm({
      name: '',
      description: '',
      store_name: '',
      budget: 0,
      points_per_item: 5,
      bonus_for_completion: 20,
      bonus_for_good_behavior: 15
    });
    setEditingList(null);
    setShowListForm(false);
  };

  const startEditList = (list: ShoppingListType) => {
    setListForm({
      name: list.name,
      description: list.description || '',
      store_name: list.store_name || '',
      budget: list.budget || 0,
      points_per_item: list.points_per_item,
      bonus_for_completion: list.bonus_for_completion,
      bonus_for_good_behavior: list.bonus_for_good_behavior
    });
    setEditingList(list);
    setShowListForm(true);
  };

  const toggleHelperSelection = (helperId: number) => {
    setTripForm(prev => ({
      ...prev,
      helper_ids: prev.helper_ids.includes(helperId)
        ? prev.helper_ids.filter(id => id !== helperId)
        : [...prev.helper_ids, helperId]
    }));
  };

  const getCategoryName = (categoryId: number | null | undefined) => {
    if (!categoryId) return 'Other';
    const cat = categories.find(c => c.id === categoryId);
    return cat ? `${cat.icon} ${cat.display_name}` : 'Other';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ShoppingCart className="w-7 h-7 text-emerald-600" />
          Shopping Gamification
        </h1>
        {activeTab === 'lists' && !showListForm && (
          <button
            onClick={() => setShowListForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus size={18} />
            New List
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('lists')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'lists' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600'
          }`}
        >
          <Package className="w-4 h-4 inline mr-2" />
          Lists ({lists.length})
        </button>
        <button
          onClick={() => setActiveTab('trips')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'trips' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600'
          }`}
        >
          <ShoppingCart className="w-4 h-4 inline mr-2" />
          Active Trips ({activeTrips.length})
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'leaderboard' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600'
          }`}
        >
          <Trophy className="w-4 h-4 inline mr-2" />
          Leaderboard
        </button>
        {(isParent || isAdmin) && (
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'settings' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Settings
          </button>
        )}
      </div>

      {/* List Form */}
      {showListForm && (
        <form onSubmit={handleCreateList} className="bg-emerald-50 rounded-xl p-4 space-y-4 border border-emerald-200">
          <h3 className="font-semibold text-emerald-800">
            {editingList ? 'Edit Shopping List' : 'Create Shopping List'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">List Name *</label>
              <input
                type="text"
                value={listForm.name}
                onChange={e => setListForm({ ...listForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g., Weekly Groceries"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Store Name</label>
              <input
                type="text"
                value={listForm.store_name}
                onChange={e => setListForm({ ...listForm, store_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g., Supermarket"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <input
              type="text"
              value={listForm.description}
              onChange={e => setListForm({ ...listForm, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              placeholder="Optional description"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Budget ($)</label>
              <input
                type="number"
                value={listForm.budget}
                onChange={e => setListForm({ ...listForm, budget: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Points/Item</label>
              <input
                type="number"
                value={listForm.points_per_item}
                onChange={e => setListForm({ ...listForm, points_per_item: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Completion Bonus</label>
              <input
                type="number"
                value={listForm.bonus_for_completion}
                onChange={e => setListForm({ ...listForm, bonus_for_completion: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Behavior Bonus</label>
              <input
                type="number"
                value={listForm.bonus_for_good_behavior}
                onChange={e => setListForm({ ...listForm, bonus_for_good_behavior: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                min="0"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingList ? 'Update List' : 'Create List'}
            </button>
            <button
              type="button"
              onClick={resetListForm}
              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Lists Tab */}
      {activeTab === 'lists' && (
        <div className="space-y-4">
          {lists.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border">
              <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No shopping lists yet. Create one to get started!</p>
            </div>
          ) : (
            lists.map(list => (
              <div key={list.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                {/* List Header */}
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                  onClick={() => setExpandedList(expandedList === list.id ? null : list.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${expandedList === list.id ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                      <ShoppingCart className={`w-5 h-5 ${expandedList === list.id ? 'text-emerald-600' : 'text-slate-500'}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">{list.name}</h3>
                      <p className="text-sm text-slate-500">
                        {list.store_name && `${list.store_name} • `}
                        {list.items?.length || 0} items
                        {list.budget ? ` • $${list.budget} budget` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                      {list.points_per_item} pts/item
                    </span>
                    {expandedList === list.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedList === list.id && (
                  <div className="border-t p-4 space-y-4">
                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setShowTripModal(list)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"
                      >
                        <Play size={14} />
                        Start Trip
                      </button>
                      <button
                        onClick={() => setShowItemForm(list.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                      >
                        <Plus size={14} />
                        Add Item
                      </button>
                      <button
                        onClick={() => startEditList(list)}
                        className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 text-sm rounded-lg hover:bg-slate-50"
                      >
                        <Edit2 size={14} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteList(list.id)}
                        className="flex items-center gap-1 px-3 py-1.5 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>

                    {/* Add Item Form */}
                    {showItemForm === list.id && (
                      <form onSubmit={(e) => handleAddItem(e, list.id)} className="bg-blue-50 rounded-lg p-3 space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="col-span-2">
                            <input
                              type="text"
                              value={itemForm.name}
                              onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                              placeholder="Item name *"
                              required
                            />
                          </div>
                          <div>
                            <input
                              type="number"
                              value={itemForm.quantity}
                              onChange={e => setItemForm({ ...itemForm, quantity: parseInt(e.target.value) || 1 })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                              placeholder="Qty"
                              min="1"
                            />
                          </div>
                          <div>
                            <input
                              type="text"
                              value={itemForm.unit}
                              onChange={e => setItemForm({ ...itemForm, unit: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                              placeholder="Unit (kg, pcs)"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          <select
                            value={itemForm.category_id}
                            onChange={e => setItemForm({ ...itemForm, category_id: parseInt(e.target.value) || 0 })}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          >
                            <option value={0}>Select Category</option>
                            {categories.map(cat => (
                              <option key={cat.id} value={cat.id}>{cat.icon} {cat.display_name}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            value={itemForm.points_value}
                            onChange={e => setItemForm({ ...itemForm, points_value: parseInt(e.target.value) || 0 })}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            placeholder="Bonus points (0 = default)"
                            min="0"
                          />
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={saving}
                              className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowItemForm(null)}
                              className="px-3 py-2 border border-slate-300 text-sm rounded-lg hover:bg-slate-50"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      </form>
                    )}

                    {/* Items List */}
                    {list.items && list.items.length > 0 ? (
                      <div className="space-y-2">
                        {list.items.map(item => (
                          <div key={item.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <span className="text-sm">{getCategoryName(item.category_id)}</span>
                              <span className="font-medium">{item.name}</span>
                              {item.quantity > 1 && (
                                <span className="text-sm text-slate-500">x{item.quantity} {item.unit}</span>
                              )}
                              {(item.points_value ?? 0) > 0 && (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                                  +{item.points_value} bonus
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-4">No items in this list yet.</p>
                    )}

                    {/* Point Summary */}
                    <div className="bg-emerald-50 rounded-lg p-3 text-sm">
                      <p className="font-medium text-emerald-800 mb-1">Points Breakdown:</p>
                      <div className="grid grid-cols-3 gap-2 text-emerald-700">
                        <div>{list.points_per_item} pts per item</div>
                        <div>{list.bonus_for_completion} pts completion</div>
                        <div>{list.bonus_for_good_behavior} pts good behavior</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Trips Tab */}
      {activeTab === 'trips' && (
        <div className="space-y-4">
          {activeTrips.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border">
              <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No active shopping trips. Start one from a list!</p>
            </div>
          ) : (
            activeTrips.map(trip => (
              <div key={trip.id} className="bg-white rounded-xl border shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-800">{trip.list_name}</h3>
                    <p className="text-sm text-slate-500">
                      Status: <span className={`font-medium ${trip.status === 'in_progress' ? 'text-orange-600' : 'text-blue-600'}`}>
                        {trip.status === 'in_progress' ? 'In Progress' : 'Planned'}
                      </span>
                      {(trip.scheduled_date || trip.scheduled_at) && ` • Scheduled: ${new Date(trip.scheduled_date || trip.scheduled_at!).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {trip.status === 'planned' && (
                      <button
                        onClick={() => handleStartTrip(trip.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700"
                      >
                        <Play size={14} />
                        Start
                      </button>
                    )}
                    {trip.status === 'in_progress' && (
                      <button
                        onClick={() => setShowCompleteTripModal(trip)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                      >
                        <Flag size={14} />
                        Complete
                      </button>
                    )}
                    <button
                      onClick={() => handleCancelTrip(trip.id)}
                      className="flex items-center gap-1 px-3 py-1.5 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50"
                    >
                      <X size={14} />
                      Cancel
                    </button>
                  </div>
                </div>

                {/* Progress */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">Progress</span>
                    <span className="font-medium">{trip.items_found || 0} / {trip.total_items || 0} items</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all"
                      style={{ width: `${trip.total_items ? ((trip.items_found || 0) / trip.total_items) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Helpers */}
                {trip.helpers && trip.helpers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-slate-400" />
                    <span className="text-sm text-slate-600">Helpers:</span>
                    <div className="flex -space-x-2">
                      {trip.helpers.map(helper => (
                        <div key={helper.profile_id} title={helper.name}>
                          <Avatar avatar={helper.avatar || ''} size="sm" alt={helper.name || 'Helper'} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Shopping Helpers Leaderboard
            </h3>
            <p className="text-sm text-white/80">Who's the best shopping helper?</p>
          </div>

          {leaderboard.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500">No shopping trips completed yet.</p>
            </div>
          ) : (
            <div className="divide-y">
              {leaderboard.map((entry, index) => (
                <div key={entry.profile_id} className="flex items-center justify-between p-4 hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' :
                      index === 1 ? 'bg-slate-100 text-slate-600' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-slate-50 text-slate-500'
                    }`}>
                      {index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
                    </div>
                    <Avatar avatar={entry.avatar || ''} size="md" alt={entry.name} />
                    <div>
                      <p className="font-medium text-slate-800">{entry.name}</p>
                      <p className="text-sm text-slate-500">{entry.trips_completed} trips completed</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">{entry.total_points} pts</p>
                    <p className="text-xs text-slate-500">{entry.items_found} items found</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings Tab - Parents only */}
      {activeTab === 'settings' && (isParent || isAdmin) && (
        <div className="space-y-6">
          {/* Child Permissions */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Users className="w-5 h-5" />
                Child Permissions
              </h3>
              <p className="text-sm text-white/80">Allow children to create their own shopping lists</p>
            </div>

            {childPermissions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500">No children found in your family.</p>
              </div>
            ) : (
              <div className="divide-y">
                {childPermissions.map(child => (
                  <div key={child.id} className="flex items-center justify-between p-4 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <Avatar avatar={child.avatar || ''} size="md" alt={child.name} />
                      <div>
                        <p className="font-medium text-slate-800">{child.name}</p>
                        <p className="text-sm text-slate-500">
                          {child.can_create_shopping_lists ? (
                            <span className="text-emerald-600">Can create shopping lists</span>
                          ) : (
                            <span className="text-slate-400">Cannot create shopping lists</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleTogglePermission(child.id, child.can_create_shopping_lists)}
                      disabled={togglingPermission === child.id}
                      className={`p-2 rounded-lg transition-colors ${
                        child.can_create_shopping_lists
                          ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {togglingPermission === child.id ? (
                        <div className="w-6 h-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : child.can_create_shopping_lists ? (
                        <ToggleRight className="w-6 h-6" />
                      ) : (
                        <ToggleLeft className="w-6 h-6" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <h4 className="font-medium text-blue-800 mb-2">How it works</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• When enabled, children can create their own shopping lists</li>
              <li>• Lists created by children appear in your shopping lists</li>
              <li>• You still control when trips start and who helps</li>
              <li>• Points are awarded as usual during shopping trips</li>
            </ul>
          </div>
        </div>
      )}

      {/* Create Trip Modal */}
      {showTripModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="font-bold text-lg mb-4">Start Shopping Trip</h3>
            <p className="text-slate-600 mb-4">
              List: <span className="font-medium">{showTripModal.name}</span>
            </p>

            <form onSubmit={handleCreateTrip} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Scheduled Date (optional)</label>
                <input
                  type="date"
                  value={tripForm.scheduled_date}
                  onChange={e => setTripForm({ ...tripForm, scheduled_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Helpers *</label>
                <div className="space-y-2">
                  {children.length === 0 ? (
                    <p className="text-sm text-slate-500">No children found in your family.</p>
                  ) : (
                    children.map(child => (
                      <label key={child.id} className="flex items-center gap-3 p-2 rounded-lg border cursor-pointer hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={tripForm.helper_ids.includes(child.id)}
                          onChange={() => toggleHelperSelection(child.id)}
                          className="w-4 h-4 text-emerald-600"
                        />
                        <Avatar avatar={child.avatar} size="sm" alt={child.name} />
                        <span className="font-medium">{child.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving || tripForm.helper_ids.length === 0}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Trip'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTripModal(null);
                    setTripForm({ scheduled_date: '', helper_ids: [] });
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Trip Modal */}
      {showCompleteTripModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="font-bold text-lg mb-4">Complete Shopping Trip</h3>
            <p className="text-slate-600 mb-4">
              List: <span className="font-medium">{showCompleteTripModal.list_name}</span>
            </p>

            <form onSubmit={handleCompleteTrip} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Behavior Rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setCompleteTripForm({ ...completeTripForm, behavior_rating: star })}
                      className={`p-2 rounded-lg transition-all ${
                        star <= completeTripForm.behavior_rating
                          ? 'text-yellow-500 scale-110'
                          : 'text-slate-300 hover:text-yellow-400'
                      }`}
                    >
                      <Star size={24} fill={star <= completeTripForm.behavior_rating ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  {completeTripForm.behavior_rating >= 4 ? 'Great behavior! Bonus points will be awarded.' : 'Rate 4+ stars for behavior bonus.'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
                <textarea
                  value={completeTripForm.notes}
                  onChange={e => setCompleteTripForm({ ...completeTripForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  rows={2}
                  placeholder="How did the shopping trip go?"
                />
              </div>

              {/* Points Preview */}
              <div className="bg-emerald-50 rounded-lg p-3">
                <p className="font-medium text-emerald-800 mb-1">Points to be awarded:</p>
                <div className="text-sm text-emerald-700 space-y-1">
                  <div className="flex justify-between">
                    <span>Items found ({showCompleteTripModal.items_found || 0})</span>
                    <span>~points</span>
                  </div>
                  {(showCompleteTripModal.items_found || 0) >= (showCompleteTripModal.total_items || 0) && showCompleteTripModal.total_items && (
                    <div className="flex justify-between">
                      <span>All items bonus</span>
                      <span>+bonus</span>
                    </div>
                  )}
                  {completeTripForm.behavior_rating >= 4 && (
                    <div className="flex justify-between">
                      <span>Good behavior bonus</span>
                      <span>+bonus</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Completing...' : 'Complete Trip'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCompleteTripModal(null);
                    setCompleteTripForm({ behavior_rating: 5, notes: '' });
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
