import { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { dietAPI } from '../services/api';
import { FoodItem, MealLog, NutritionSummary } from '../types';
import { Search, Plus, Calendar, PlusCircle, X, Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export default function DietTracking() {
  const { currentProfile } = useProfile();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [mealLogs, setMealLogs] = useState<MealLog[]>([]);
  const [nutrition, setNutrition] = useState<NutritionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<string>('breakfast');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [editingMeal, setEditingMeal] = useState<MealLog | null>(null);

  useEffect(() => {
    if (currentProfile) {
      loadMealLogs();
      loadNutrition();
    }
  }, [currentProfile, selectedDate]);

  const loadMealLogs = async () => {
    if (!currentProfile) return;
    try {
      const response = await dietAPI.getLogs(currentProfile.id, selectedDate);
      setMealLogs(response.data);
    } catch (error) {
      console.error('Failed to load meal logs:', error);
    }
  };

  const loadNutrition = async () => {
    if (!currentProfile) return;
    try {
      const response = await dietAPI.getNutritionSummary(currentProfile.id, selectedDate);
      setNutrition(response.data);
    } catch (error) {
      console.error('Failed to load nutrition:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const response = await dietAPI.searchFoods(searchQuery);
      setSearchResults(response.data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogFood = async (food: FoodItem, portion: number) => {
    if (!currentProfile) return;

    try {
      await dietAPI.logMeal({
        profile_id: currentProfile.id,
        food_id: food.id,
        meal_type: selectedMealType,
        portion_size: portion,
        portion_unit: food.serving_unit
      });

      // Reload data
      await loadMealLogs();
      await loadNutrition();
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('Failed to log meal:', error);
      alert('Failed to log meal. Please try again.');
    }
  };

  const handleManualEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentProfile) return;

    const formData = new FormData(e.currentTarget);

    try {
      // First create the custom food item
      const foodResponse = await dietAPI.addFood({
        name: formData.get('name') as string,
        calories: parseInt(formData.get('calories') as string),
        protein: parseFloat(formData.get('protein') as string) || 0,
        carbs: parseFloat(formData.get('carbs') as string) || 0,
        fat: parseFloat(formData.get('fat') as string) || 0,
        serving_size: formData.get('serving_size') as string || '100',
        serving_unit: formData.get('serving_unit') as string || 'g',
        brand: formData.get('brand') as string || undefined
      });

      // Then log it as a meal
      await dietAPI.logMeal({
        profile_id: currentProfile.id,
        food_id: foodResponse.data.id,
        meal_type: selectedMealType,
        portion_size: parseFloat(formData.get('portion_size') as string),
        portion_unit: foodResponse.data.serving_unit
      });

      // Reload data and close modal
      setShowManualEntry(false);
      await loadMealLogs();
      await loadNutrition();
    } catch (error) {
      console.error('Failed to add manual entry:', error);
      alert('Failed to add food. Please try again.');
    }
  };

  const handleEditMeal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingMeal) return;

    const formData = new FormData(e.currentTarget);

    try {
      await dietAPI.updateMealLog(editingMeal.id, {
        meal_type: formData.get('meal_type') as string,
        portion_size: parseFloat(formData.get('portion_size') as string),
        notes: formData.get('notes') as string || undefined
      });

      setEditingMeal(null);
      await loadMealLogs();
      await loadNutrition();
    } catch (error) {
      console.error('Failed to update meal:', error);
      alert('Failed to update meal. Please try again.');
    }
  };

  const handleDeleteMeal = async (mealId: number) => {
    if (!confirm('Are you sure you want to delete this meal entry?')) return;

    try {
      await dietAPI.deleteMealLog(mealId);
      await loadMealLogs();
      await loadNutrition();
    } catch (error) {
      console.error('Failed to delete meal:', error);
      alert('Failed to delete meal. Please try again.');
    }
  };

  const totals = nutrition?.totals || {
    total_calories: 0,
    total_protein: 0,
    total_carbs: 0,
    total_fat: 0
  };

  const goals = nutrition?.goals;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Diet Tracking</h1>
          <p className="text-gray-600 mt-1">Track your meals and nutrition</p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar size={20} className="text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="input"
            />
          </div>
        </div>
      </div>

      {/* Nutrition Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <p className="text-blue-100 text-sm">Calories</p>
          <p className="text-3xl font-bold mt-1">{Math.round(totals.total_calories)}</p>
          {goals?.calories_target && (
            <p className="text-blue-100 text-xs mt-1">
              / {goals.calories_target} goal
            </p>
          )}
        </div>

        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <p className="text-green-100 text-sm">Protein</p>
          <p className="text-3xl font-bold mt-1">{Math.round(totals.total_protein)}g</p>
          {goals?.protein_target && (
            <p className="text-green-100 text-xs mt-1">
              / {goals.protein_target}g goal
            </p>
          )}
        </div>

        <div className="card bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
          <p className="text-yellow-100 text-sm">Carbs</p>
          <p className="text-3xl font-bold mt-1">{Math.round(totals.total_carbs)}g</p>
          {goals?.carbs_target && (
            <p className="text-yellow-100 text-xs mt-1">
              / {goals.carbs_target}g goal
            </p>
          )}
        </div>

        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <p className="text-purple-100 text-sm">Fat</p>
          <p className="text-3xl font-bold mt-1">{Math.round(totals.total_fat)}g</p>
          {goals?.fat_target && (
            <p className="text-purple-100 text-xs mt-1">
              / {goals.fat_target}g goal
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Food Search */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Log Food</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Meal Type
            </label>
            <select
              value={selectedMealType}
              onChange={e => setSelectedMealType(e.target.value)}
              className="input"
            >
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </div>

          <div className="flex space-x-2 mb-4">
            <input
              type="text"
              placeholder="Search Norwegian foods..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="input flex-1"
            />
            <button onClick={handleSearch} className="btn btn-primary" disabled={loading}>
              {loading ? <div className="spinner"></div> : <Search size={20} />}
            </button>
            <button
              onClick={() => setShowManualEntry(true)}
              className="btn btn-secondary"
              title="Add food manually"
            >
              <PlusCircle size={20} />
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {searchResults.map(food => (
                <div
                  key={food.id}
                  className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    const portion = prompt(`Enter portion size (${food.serving_unit}):`, food.serving_size);
                    if (portion) {
                      handleLogFood(food, parseFloat(portion));
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {food.name_no || food.name}
                        {food.brand && <span className="text-gray-500 text-sm ml-2">({food.brand})</span>}
                      </p>
                      <p className="text-sm text-gray-600">
                        {food.calories} cal • P: {food.protein}g • C: {food.carbs}g • F: {food.fat}g
                      </p>
                    </div>
                    <Plus size={20} className="text-primary-600" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Meal Log */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Today's Meals</h2>

          {mealLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No meals logged yet</p>
              <p className="text-sm mt-1">Start by searching for foods</p>
            </div>
          ) : (
            <div className="space-y-4">
              {['breakfast', 'lunch', 'dinner', 'snack'].map(mealType => {
                const mealsOfType = mealLogs.filter(m => m.meal_type === mealType);
                if (mealsOfType.length === 0) return null;

                return (
                  <div key={mealType}>
                    <h3 className="font-semibold text-gray-700 capitalize mb-2">
                      {mealType}
                    </h3>
                    <div className="space-y-2">
                      {mealsOfType.map(meal => (
                        <div key={meal.id} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium">{meal.food_name}</p>
                              <p className="text-sm text-gray-600">
                                {meal.portion_size}{meal.portion_unit} • {meal.calories_consumed} cal
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-500">
                                {format(new Date(meal.logged_at), 'HH:mm')}
                              </span>
                              <button
                                onClick={() => setEditingMeal(meal)}
                                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                title="Edit"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteMeal(meal.id)}
                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Meal Modal */}
      {editingMeal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">Edit Meal Entry</h3>
                <button
                  onClick={() => setEditingMeal(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleEditMeal} className="space-y-4">
                <div>
                  <p className="text-gray-700 font-medium mb-2">{editingMeal.food_name}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Meal Type
                  </label>
                  <select
                    name="meal_type"
                    defaultValue={editingMeal.meal_type}
                    className="input w-full"
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snack">Snack</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Portion Size ({editingMeal.portion_unit})
                  </label>
                  <input
                    type="number"
                    name="portion_size"
                    defaultValue={editingMeal.portion_size}
                    min="0"
                    step="0.1"
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    name="notes"
                    defaultValue={editingMeal.notes || ''}
                    className="input w-full"
                    rows={2}
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingMeal(null)}
                    className="btn btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary flex-1">
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {showManualEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">Add Food Manually</h3>
                <button
                  onClick={() => setShowManualEntry(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleManualEntry} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Food Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="e.g., Homemade Pizza"
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brand (optional)
                  </label>
                  <input
                    type="text"
                    name="brand"
                    placeholder="e.g., Tine, Grandiosa"
                    className="input w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Serving Size *
                    </label>
                    <input
                      type="text"
                      name="serving_size"
                      defaultValue="100"
                      required
                      placeholder="100"
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit *
                    </label>
                    <select name="serving_unit" defaultValue="g" className="input w-full">
                      <option value="g">grams (g)</option>
                      <option value="ml">milliliters (ml)</option>
                      <option value="pcs">pieces (pcs)</option>
                      <option value="slice">slice</option>
                      <option value="cup">cup</option>
                    </select>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-3">Nutrition per serving</h4>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Calories * (kcal)
                      </label>
                      <input
                        type="number"
                        name="calories"
                        required
                        min="0"
                        step="1"
                        placeholder="250"
                        className="input w-full"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Protein (g)
                        </label>
                        <input
                          type="number"
                          name="protein"
                          min="0"
                          step="0.1"
                          placeholder="10"
                          className="input w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Carbs (g)
                        </label>
                        <input
                          type="number"
                          name="carbs"
                          min="0"
                          step="0.1"
                          placeholder="30"
                          className="input w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Fat (g)
                        </label>
                        <input
                          type="number"
                          name="fat"
                          min="0"
                          step="0.1"
                          placeholder="8"
                          className="input w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Portion Size * (how much you ate)
                  </label>
                  <input
                    type="number"
                    name="portion_size"
                    required
                    min="0"
                    step="0.1"
                    defaultValue="100"
                    placeholder="150"
                    className="input w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the amount you actually consumed
                  </p>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowManualEntry(false)}
                    className="btn btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary flex-1">
                    Add Food
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
