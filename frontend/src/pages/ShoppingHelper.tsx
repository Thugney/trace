import { useState, useEffect } from 'react';
import { ShoppingCart, Check, Star, Trophy, Package, Sparkles, Plus, X } from 'lucide-react';
import { shoppingAPI, ShoppingTrip, ShoppingStats, ShoppingCategory } from '../services/api';
import { useProfile } from '../context/ProfileContext';
import { useAge } from '../context/AgeContext';
import { useToast } from '../components/Toast';
import playSounds from '../utils/sounds';

export default function ShoppingHelper() {
  const { currentProfile } = useProfile();
  const { settings } = useAge();
  const toast = useToast();

  // Data state
  const [trips, setTrips] = useState<ShoppingTrip[]>([]);
  const [stats, setStats] = useState<ShoppingStats | null>(null);
  const [categories, setCategories] = useState<ShoppingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingItem, setMarkingItem] = useState<number | null>(null);

  // Active trip
  const [activeTrip, setActiveTrip] = useState<ShoppingTrip | null>(null);

  // List creation (for kids with permission)
  const [canCreateLists, setCanCreateLists] = useState(false);
  const [showListForm, setShowListForm] = useState(false);
  const [savingList, setSavingList] = useState(false);
  const [listForm, setListForm] = useState({
    name: '',
    description: '',
    store_name: ''
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
      const [tripsRes, statsRes, categoriesRes, canCreateRes] = await Promise.all([
        shoppingAPI.getMyTrips(currentProfile.id),
        shoppingAPI.getStats(currentProfile.id),
        shoppingAPI.getCategories(),
        shoppingAPI.canCreateLists()
      ]);
      setTrips(tripsRes.data);
      setStats(statsRes.data);
      setCategories(categoriesRes.data);
      setCanCreateLists(canCreateRes.data.canCreate);

      // Auto-select active trip if only one in progress
      const inProgress = tripsRes.data.filter((t: ShoppingTrip) => t.status === 'in_progress');
      if (inProgress.length === 1) {
        await loadTripDetails(inProgress[0].id);
      }
    } catch (error: any) {
      console.error('Failed to load shopping data:', error);
      toast.error('Failed to load shopping data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile || !listForm.name.trim()) return;

    setSavingList(true);
    try {
      await shoppingAPI.createList({
        parent_id: currentProfile.id, // Will be resolved to actual parent on backend
        name: listForm.name,
        description: listForm.description || undefined,
        store_name: listForm.store_name || undefined
      });
      toast.success('Shopping list created!');
      playSounds.taskComplete();
      setListForm({ name: '', description: '', store_name: '' });
      setShowListForm(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create list');
    } finally {
      setSavingList(false);
    }
  };

  const loadTripDetails = async (tripId: number) => {
    try {
      const tripRes = await shoppingAPI.getTrip(tripId);
      setActiveTrip(tripRes.data);
    } catch (error: any) {
      toast.error('Failed to load trip details');
    }
  };

  const handleMarkItem = async (itemId: number, found: boolean) => {
    if (!activeTrip || !currentProfile) return;

    setMarkingItem(itemId);
    try {
      await shoppingAPI.markItemFound(activeTrip.id, itemId, {
        found_by_profile_id: currentProfile.id,
        found
      });

      if (found) {
        playSounds.taskComplete();
        toast.success('Item found! Great job!');
      }

      // Reload trip details
      await loadTripDetails(activeTrip.id);
      await loadData(); // Refresh stats too
    } catch (error: any) {
      toast.error('Failed to mark item');
    } finally {
      setMarkingItem(null);
    }
  };

  const getCategoryIcon = (categoryId: number | null) => {
    if (!categoryId) return '📦';
    const cat = categories.find(c => c.id === categoryId);
    return cat?.icon || '📦';
  };

  const getCategoryName = (categoryId: number | null) => {
    if (!categoryId) return 'Other';
    const cat = categories.find(c => c.id === categoryId);
    return cat?.display_name || 'Other';
  };

  // Group items by category
  const groupedItems = activeTrip?.items?.reduce((acc, item) => {
    const catId = item.category_id || 0;
    if (!acc[catId]) {
      acc[catId] = [];
    }
    acc[catId].push(item);
    return acc;
  }, {} as Record<number, typeof activeTrip.items>) || {};

  const isYoung = settings.ageGroup === 'young';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - Kid friendly */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingCart className="w-8 h-8" />
              {isYoung ? 'Shopping Helper!' : 'Shopping Assistant'}
            </h1>
            <p className="text-white/80 mt-1">
              {isYoung ? 'Help find items and earn points!' : 'Help with shopping and earn rewards'}
            </p>
          </div>
          <div className="text-4xl animate-bounce">🛒</div>
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-white/20 backdrop-blur rounded-xl p-3 text-center">
              <p className="text-3xl font-bold">{stats.total_trips}</p>
              <p className="text-xs text-white/80">{isYoung ? 'Trips' : 'Trips Helped'}</p>
            </div>
            <div className="bg-white/20 backdrop-blur rounded-xl p-3 text-center">
              <p className="text-3xl font-bold">{stats.items_found}</p>
              <p className="text-xs text-white/80">{isYoung ? 'Found' : 'Items Found'}</p>
            </div>
            <div className="bg-white/20 backdrop-blur rounded-xl p-3 text-center">
              <p className="text-3xl font-bold">{stats.total_points}</p>
              <p className="text-xs text-white/80">{isYoung ? 'Points!' : 'Points Earned'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Active Trip */}
      {activeTrip && activeTrip.status === 'in_progress' ? (
        <div className="space-y-4">
          {/* Trip Info */}
          <div className="bg-white rounded-2xl border-2 border-emerald-200 shadow-md p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-500" />
                  {activeTrip.list_name}
                </h2>
                <p className="text-sm text-slate-500">
                  {isYoung ? 'Find all the items!' : 'Mark items as you find them'}
                </p>
              </div>
              <button
                onClick={() => setActiveTrip(null)}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                {isYoung ? 'See all trips' : 'Back to trips'}
              </button>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600 font-medium">
                  {isYoung ? 'Items Found' : 'Progress'}
                </span>
                <span className="font-bold text-emerald-600">
                  {activeTrip.items_found || 0} / {activeTrip.total_items || 0}
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-400 to-teal-500 h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                  style={{ width: `${activeTrip.total_items ? ((activeTrip.items_found || 0) / activeTrip.total_items) * 100 : 0}%` }}
                >
                  {((activeTrip.items_found || 0) / (activeTrip.total_items || 1)) >= 0.2 && (
                    <span className="text-xs text-white font-bold">
                      {Math.round(((activeTrip.items_found || 0) / (activeTrip.total_items || 1)) * 100)}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Celebration when all found */}
            {activeTrip.items_found === activeTrip.total_items && activeTrip.total_items && activeTrip.total_items > 0 && (
              <div className="bg-gradient-to-r from-yellow-100 to-orange-100 rounded-xl p-4 mb-4 text-center animate-pulse">
                <p className="text-2xl mb-1">🎉</p>
                <p className="font-bold text-orange-700">
                  {isYoung ? 'WOW! You found everything!' : 'Amazing! All items found!'}
                </p>
                <p className="text-sm text-orange-600">
                  {isYoung ? 'Wait for mom/dad to finish!' : 'Wait for parent to complete the trip'}
                </p>
              </div>
            )}
          </div>

          {/* Items by Category */}
          {Object.entries(groupedItems).map(([catId, items]) => (
            <div key={catId} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b flex items-center gap-2">
                <span className="text-xl">{getCategoryIcon(parseInt(catId) || null)}</span>
                <span className="font-semibold text-slate-700">{getCategoryName(parseInt(catId) || null)}</span>
                <span className="text-sm text-slate-500 ml-auto">
                  {items?.filter(i => i.is_found).length || 0}/{items?.length || 0}
                </span>
              </div>
              <div className="divide-y">
                {items?.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-3 transition-all ${
                      item.is_found
                        ? 'bg-emerald-50'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <button
                      onClick={() => handleMarkItem(item.id, !item.is_found)}
                      disabled={markingItem === item.id}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                        markingItem === item.id
                          ? 'bg-slate-200 animate-pulse'
                          : item.is_found
                            ? 'bg-emerald-500 text-white scale-110'
                            : 'bg-slate-100 hover:bg-emerald-100 hover:scale-105 active:scale-95'
                      }`}
                    >
                      {markingItem === item.id ? (
                        <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      ) : item.is_found ? (
                        <Check size={24} strokeWidth={3} />
                      ) : (
                        <Package size={20} className="text-slate-400" />
                      )}
                    </button>

                    <div className="flex-1">
                      <p className={`font-medium ${item.is_found ? 'text-emerald-700 line-through' : 'text-slate-800'}`}>
                        {item.name}
                      </p>
                      {(item.quantity > 1 || item.unit) && (
                        <p className="text-sm text-slate-500">
                          {item.quantity > 1 && `x${item.quantity}`} {item.unit}
                        </p>
                      )}
                    </div>

                    {item.is_found && (
                      <div className="flex items-center gap-1 text-yellow-500">
                        <Star size={16} fill="currentColor" />
                        <span className="text-sm font-bold">Found!</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Trip Selection */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">
              {isYoung ? 'Your Shopping Trips' : 'Available Shopping Trips'}
            </h2>
            {canCreateLists && (
              <button
                onClick={() => setShowListForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
              >
                <Plus size={18} />
                {isYoung ? 'Make a List!' : 'Create List'}
              </button>
            )}
          </div>

          {/* Create List Form */}
          {showListForm && (
            <form onSubmit={handleCreateList} className="bg-blue-50 rounded-2xl p-4 space-y-4 border-2 border-blue-200">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-blue-800">
                  {isYoung ? '📝 Make a Shopping List!' : 'Create Shopping List'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowListForm(false)}
                  className="text-blue-500 hover:text-blue-700"
                >
                  <X size={20} />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {isYoung ? 'What should we call it?' : 'List Name'} *
                </label>
                <input
                  type="text"
                  value={listForm.name}
                  onChange={e => setListForm({ ...listForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder={isYoung ? "e.g., My Snacks" : "e.g., Weekly Groceries"}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {isYoung ? 'What store?' : 'Store Name'} (optional)
                </label>
                <input
                  type="text"
                  value={listForm.store_name}
                  onChange={e => setListForm({ ...listForm, store_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder={isYoung ? "e.g., Supermarket" : "e.g., Local Store"}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {isYoung ? 'Any notes?' : 'Description'} (optional)
                </label>
                <input
                  type="text"
                  value={listForm.description}
                  onChange={e => setListForm({ ...listForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder={isYoung ? "e.g., Things for my lunch" : "Optional description"}
                />
              </div>

              <button
                type="submit"
                disabled={savingList || !listForm.name.trim()}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {savingList ? 'Creating...' : isYoung ? '✨ Create My List!' : 'Create List'}
              </button>

              <p className="text-xs text-blue-600 text-center">
                {isYoung ? 'Mom or Dad will add items and start the trip!' : 'A parent will review and start the shopping trip'}
              </p>
            </form>
          )}

          {trips.length === 0 && !showListForm ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
              <div className="text-6xl mb-4">🛍️</div>
              <p className="text-slate-600 font-medium">
                {isYoung ? 'No shopping trips yet!' : 'No active shopping trips'}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {canCreateLists
                  ? (isYoung ? 'Create a list above!' : 'Create a shopping list to get started')
                  : (isYoung ? 'Ask mom or dad to add you to a trip!' : 'Ask a parent to assign you as a helper')
                }
              </p>
            </div>
          ) : trips.length > 0 ? (
            <div className="space-y-3">
              {trips.map(trip => (
                <div
                  key={trip.id}
                  className={`bg-white rounded-2xl border-2 shadow-sm p-4 transition-all ${
                    trip.status === 'in_progress'
                      ? 'border-emerald-300 hover:border-emerald-400'
                      : trip.status === 'completed'
                        ? 'border-slate-200 opacity-75'
                        : 'border-blue-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                        trip.status === 'in_progress'
                          ? 'bg-emerald-100'
                          : trip.status === 'completed'
                            ? 'bg-slate-100'
                            : 'bg-blue-100'
                      }`}>
                        {trip.status === 'in_progress' ? '🛒' : trip.status === 'completed' ? '✅' : '📋'}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">{trip.list_name}</h3>
                        <p className="text-sm text-slate-500">
                          {trip.status === 'in_progress' && (
                            <span className="text-emerald-600 font-medium">
                              {isYoung ? 'Shopping now!' : 'In Progress'}
                            </span>
                          )}
                          {trip.status === 'completed' && (
                            <span className="text-slate-500">
                              {isYoung ? 'Done!' : 'Completed'}
                              {trip.points_earned !== undefined && ` • ${trip.points_earned} pts`}
                            </span>
                          )}
                          {trip.status === 'planned' && (
                            <span className="text-blue-600">
                              {isYoung ? 'Coming soon!' : 'Planned'}
                              {(trip.scheduled_date || trip.scheduled_at) && ` • ${new Date(trip.scheduled_date || trip.scheduled_at!).toLocaleDateString()}`}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {trip.status === 'in_progress' && (
                      <button
                        onClick={() => loadTripDetails(trip.id)}
                        className="px-4 py-2 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-all hover:scale-105 active:scale-95"
                      >
                        {isYoung ? 'Help!' : 'Start Helping'}
                      </button>
                    )}

                    {trip.status === 'completed' && trip.points_earned !== undefined && (
                      <div className="flex items-center gap-1 text-yellow-500">
                        <Trophy size={20} />
                        <span className="font-bold">{trip.points_earned}</span>
                      </div>
                    )}
                  </div>

                  {/* Progress for in-progress trips */}
                  {trip.status === 'in_progress' && (
                    <div className="mt-3">
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-emerald-500 h-2 rounded-full transition-all"
                          style={{ width: `${trip.total_items ? ((trip.items_found || 0) / trip.total_items) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {trip.items_found || 0} of {trip.total_items || 0} items found
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {/* Stats Card */}
          {stats && stats.total_trips > 0 && (
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-6 text-white mt-6">
              <h3 className="font-bold text-lg flex items-center gap-2 mb-3">
                <Trophy className="w-5 h-5" />
                {isYoung ? 'Your Shopping Stats!' : 'Your Shopping Statistics'}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/20 backdrop-blur rounded-xl p-3">
                  <p className="text-2xl font-bold">{stats.total_trips}</p>
                  <p className="text-sm text-white/80">{isYoung ? 'Shopping Trips' : 'Total Trips'}</p>
                </div>
                <div className="bg-white/20 backdrop-blur rounded-xl p-3">
                  <p className="text-2xl font-bold">{stats.items_found}</p>
                  <p className="text-sm text-white/80">{isYoung ? 'Items Found!' : 'Items Found'}</p>
                </div>
                <div className="bg-white/20 backdrop-blur rounded-xl p-3">
                  <p className="text-2xl font-bold">{stats.total_points}</p>
                  <p className="text-sm text-white/80">{isYoung ? 'Points Won!' : 'Points Earned'}</p>
                </div>
                <div className="bg-white/20 backdrop-blur rounded-xl p-3">
                  <p className="text-2xl font-bold flex items-center gap-1">
                    {stats.avg_behavior_rating ? stats.avg_behavior_rating.toFixed(1) : '-'}
                    <Star size={16} fill="currentColor" className="text-yellow-300" />
                  </p>
                  <p className="text-sm text-white/80">{isYoung ? 'Behavior!' : 'Avg Behavior'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
