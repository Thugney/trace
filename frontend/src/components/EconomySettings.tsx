import { useState, useEffect } from 'react';
import { gamificationAPI, EconomySettings as EconomySettingsType } from '../services/api';
import { Profile } from '../types';
import { Shield, Clock, Zap, Gift, ChevronDown, ChevronUp, Save, AlertCircle, DollarSign, Info } from 'lucide-react';
import Avatar from './Avatar';

interface Props {
  children: Profile[];
}

interface ChildEconomy {
  profileId: number;
  name: string;
  avatar: string;
  settings: EconomySettingsType;
  earnings: {
    todayEarned: number;
    weekTotal: number;
    dailyRemaining: number;
    weeklyRemaining: number;
  };
  pricingGuide?: any;
}

export default function EconomySettings({ children }: Props) {
  const [economies, setEconomies] = useState<ChildEconomy[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedChild, setExpandedChild] = useState<number | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [editedSettings, setEditedSettings] = useState<Record<number, Partial<EconomySettingsType>>>({});
  const [showPricingGuide, setShowPricingGuide] = useState<number | null>(null);

  useEffect(() => {
    loadEconomyData();
  }, [children]);

  const loadEconomyData = async () => {
    if (children.length === 0) return;

    setLoading(true);
    try {
      const results = await Promise.all(
        children.map(async (child) => {
          try {
            const [economyRes, pricingRes] = await Promise.all([
              gamificationAPI.getEconomySettings(child.id),
              gamificationAPI.getPricingGuide(child.id).catch(() => ({ data: null }))
            ]);
            return {
              profileId: child.id,
              name: child.name,
              avatar: child.avatar || '👤',
              settings: economyRes.data.settings,
              earnings: {
                todayEarned: economyRes.data.earnings?.today?.points_earned || 0,
                weekTotal: economyRes.data.earnings?.weekTotal || 0,
                dailyRemaining: economyRes.data.earnings?.dailyRemaining || 0,
                weeklyRemaining: economyRes.data.earnings?.weeklyRemaining || 0
              },
              pricingGuide: pricingRes.data
            };
          } catch (error) {
            console.error(`Failed to load economy for ${child.name}:`, error);
            return null;
          }
        })
      );
      setEconomies(results.filter(Boolean) as ChildEconomy[]);
    } catch (error) {
      console.error('Failed to load economy data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (profileId: number, key: keyof EconomySettingsType, value: any) => {
    setEditedSettings(prev => ({
      ...prev,
      [profileId]: {
        ...prev[profileId],
        [key]: value
      }
    }));
  };

  const saveSettings = async (profileId: number) => {
    const changes = editedSettings[profileId];
    if (!changes || Object.keys(changes).length === 0) return;

    setSaving(profileId);
    try {
      // Convert snake_case to camelCase for API
      const apiChanges: Record<string, any> = {};
      if (changes.daily_points_cap !== undefined) apiChanges.dailyPointsCap = changes.daily_points_cap;
      if (changes.weekly_points_cap !== undefined) apiChanges.weeklyPointsCap = changes.weekly_points_cap;
      if (changes.points_multiplier !== undefined) apiChanges.pointsMultiplier = changes.points_multiplier;
      if (changes.require_time_elapsed !== undefined) apiChanges.requireTimeElapsed = changes.require_time_elapsed;
      if (changes.min_task_duration_minutes !== undefined) apiChanges.minTaskDuration = changes.min_task_duration_minutes;
      if (changes.cooldown_seconds !== undefined) apiChanges.cooldownSeconds = changes.cooldown_seconds;
      if (changes.bonuses_enabled !== undefined) apiChanges.bonusesEnabled = changes.bonuses_enabled;
      if (changes.spin_wheel_enabled !== undefined) apiChanges.spinWheelEnabled = changes.spin_wheel_enabled;
      if (changes.countdown_challenges_enabled !== undefined) apiChanges.countdownChallengesEnabled = changes.countdown_challenges_enabled;

      await gamificationAPI.updateEconomySettings(profileId, apiChanges);
      // Clear edited settings and reload
      setEditedSettings(prev => {
        const next = { ...prev };
        delete next[profileId];
        return next;
      });
      await loadEconomyData();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(null);
    }
  };

  const getEffectiveValue = (profileId: number, key: keyof EconomySettingsType, original: any) => {
    return editedSettings[profileId]?.[key] ?? original;
  };

  const hasChanges = (profileId: number) => {
    return editedSettings[profileId] && Object.keys(editedSettings[profileId]).length > 0;
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="spinner mx-auto mb-2"></div>
        <p className="text-gray-500">Loading economy settings...</p>
      </div>
    );
  }

  if (economies.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        <Shield size={32} className="mx-auto mb-2 opacity-50" />
        <p>No children to configure</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Shield className="text-indigo-600" size={24} />
          <h2 className="text-xl font-bold text-gray-900">Economy Controls</h2>
        </div>
        <span className="text-sm text-gray-500">Prevent point farming abuse</span>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-start space-x-2">
        <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800">
          These settings help prevent kids from rapidly completing tasks to farm points.
          Set daily/weekly caps based on realistic expectations for your family.
        </p>
      </div>

      <div className="space-y-3">
        {economies.map((economy) => (
          <div key={economy.profileId} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Child Header - Click to expand */}
            <button
              onClick={() => setExpandedChild(expandedChild === economy.profileId ? null : economy.profileId)}
              className="w-full p-4 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center space-x-3">
                <Avatar avatar={economy.avatar} size="md" alt={economy.name} />
                <div className="text-left">
                  <p className="font-semibold text-gray-900">{economy.name}</p>
                  <p className="text-sm text-gray-500">
                    Today: {economy.earnings.todayEarned}/{economy.settings.daily_points_cap} pts
                    {economy.earnings.dailyRemaining === 0 && (
                      <span className="ml-2 text-amber-600">(limit reached)</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {hasChanges(economy.profileId) && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                    Unsaved changes
                  </span>
                )}
                {expandedChild === economy.profileId ? (
                  <ChevronUp className="text-gray-400" size={20} />
                ) : (
                  <ChevronDown className="text-gray-400" size={20} />
                )}
              </div>
            </button>

            {/* Expanded Settings */}
            {expandedChild === economy.profileId && (
              <div className="p-4 border-t border-gray-200 bg-white">
                {/* Current Earnings Status */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-emerald-50 p-3 rounded-lg">
                    <p className="text-xs text-emerald-600 font-medium">Today's Points</p>
                    <p className="text-xl font-bold text-emerald-700">
                      {economy.earnings.todayEarned} / {economy.settings.daily_points_cap}
                    </p>
                    <div className="w-full bg-emerald-200 rounded-full h-1.5 mt-1">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min((economy.earnings.todayEarned / economy.settings.daily_points_cap) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-xs text-blue-600 font-medium">This Week</p>
                    <p className="text-xl font-bold text-blue-700">
                      {economy.earnings.weekTotal} / {economy.settings.weekly_points_cap}
                    </p>
                    <div className="w-full bg-blue-200 rounded-full h-1.5 mt-1">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full"
                        style={{ width: `${Math.min((economy.earnings.weekTotal / economy.settings.weekly_points_cap) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Settings Grid */}
                <div className="space-y-4">
                  {/* Earning Caps */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                        <DollarSign size={14} className="mr-1 text-gray-400" />
                        Daily Points Cap
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="1000"
                        value={getEffectiveValue(economy.profileId, 'daily_points_cap', economy.settings.daily_points_cap)}
                        onChange={(e) => handleSettingChange(economy.profileId, 'daily_points_cap', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Max points per day</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                        <DollarSign size={14} className="mr-1 text-gray-400" />
                        Weekly Points Cap
                      </label>
                      <input
                        type="number"
                        min="50"
                        max="5000"
                        value={getEffectiveValue(economy.profileId, 'weekly_points_cap', economy.settings.weekly_points_cap)}
                        onChange={(e) => handleSettingChange(economy.profileId, 'weekly_points_cap', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Max points per week</p>
                    </div>
                  </div>

                  {/* Time Controls */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                        <Clock size={14} className="mr-1 text-gray-400" />
                        Cooldown (seconds)
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="300"
                        value={getEffectiveValue(economy.profileId, 'cooldown_seconds', economy.settings.cooldown_seconds)}
                        onChange={(e) => handleSettingChange(economy.profileId, 'cooldown_seconds', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Wait between tasks</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                        <Clock size={14} className="mr-1 text-gray-400" />
                        Min Task Duration (min)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={getEffectiveValue(economy.profileId, 'min_task_duration_minutes', economy.settings.min_task_duration_minutes)}
                        onChange={(e) => handleSettingChange(economy.profileId, 'min_task_duration_minutes', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">For timed tasks</p>
                    </div>
                  </div>

                  {/* Multiplier */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                      <Zap size={14} className="mr-1 text-gray-400" />
                      Points Multiplier: {getEffectiveValue(economy.profileId, 'points_multiplier', economy.settings.points_multiplier)}x
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={getEffectiveValue(economy.profileId, 'points_multiplier', economy.settings.points_multiplier)}
                      onChange={(e) => handleSettingChange(economy.profileId, 'points_multiplier', parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0.5x (harder)</span>
                      <span>1.0x (normal)</span>
                      <span>2.0x (easier)</span>
                    </div>
                  </div>

                  {/* Toggle Features */}
                  <div className="space-y-2">
                    <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                      <div className="flex items-center space-x-2">
                        <Clock size={18} className="text-gray-500" />
                        <div>
                          <p className="font-medium text-gray-900">Require Time Elapsed</p>
                          <p className="text-xs text-gray-500">Tasks must take their estimated time</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={getEffectiveValue(economy.profileId, 'require_time_elapsed', economy.settings.require_time_elapsed)}
                        onChange={(e) => handleSettingChange(economy.profileId, 'require_time_elapsed', e.target.checked)}
                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                      <div className="flex items-center space-x-2">
                        <Gift size={18} className="text-gray-500" />
                        <div>
                          <p className="font-medium text-gray-900">Bonuses Enabled</p>
                          <p className="text-xs text-gray-500">Login bonuses, streaks, etc.</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={getEffectiveValue(economy.profileId, 'bonuses_enabled', economy.settings.bonuses_enabled)}
                        onChange={(e) => handleSettingChange(economy.profileId, 'bonuses_enabled', e.target.checked)}
                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                      <div className="flex items-center space-x-2">
                        <Zap size={18} className="text-gray-500" />
                        <div>
                          <p className="font-medium text-gray-900">Spin Wheel Enabled</p>
                          <p className="text-xs text-gray-500">Lucky wheel after task streaks</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={getEffectiveValue(economy.profileId, 'spin_wheel_enabled', economy.settings.spin_wheel_enabled)}
                        onChange={(e) => handleSettingChange(economy.profileId, 'spin_wheel_enabled', e.target.checked)}
                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                    </label>
                  </div>

                  {/* Pricing Guide */}
                  {economy.pricingGuide && (
                    <div>
                      <button
                        onClick={() => setShowPricingGuide(showPricingGuide === economy.profileId ? null : economy.profileId)}
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
                      >
                        <Info size={14} className="mr-1" />
                        {showPricingGuide === economy.profileId ? 'Hide' : 'Show'} Reward Pricing Guide
                      </button>

                      {showPricingGuide === economy.profileId && (
                        <div className="mt-2 p-3 bg-indigo-50 rounded-lg text-sm">
                          <p className="font-medium text-indigo-900 mb-2">Suggested Reward Pricing</p>
                          <div className="space-y-1 text-indigo-800">
                            {economy.pricingGuide.suggestions && Object.entries(economy.pricingGuide.suggestions).map(([key, val]: [string, any]) => (
                              <div key={key} className="flex justify-between">
                                <span>{val.description}</span>
                                <span className="font-medium">{val.suggestedPoints} pts (~{val.daysToEarn} days)</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Save Button */}
                {hasChanges(economy.profileId) && (
                  <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="flex items-center text-amber-600">
                      <AlertCircle size={16} className="mr-1" />
                      <span className="text-sm">You have unsaved changes</span>
                    </div>
                    <button
                      onClick={() => saveSettings(economy.profileId)}
                      disabled={saving === economy.profileId}
                      className="btn btn-primary flex items-center space-x-2"
                    >
                      {saving === economy.profileId ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
