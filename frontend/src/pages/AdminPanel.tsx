import { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { profilesAPI, aiAPI, settingsAPI } from '../services/api';
import { useFeatureFlags } from '../context/FeatureFlagsContext';
import { Profile } from '../types';
import { Plus, Edit2, Trash2, Shield, User, Baby, Bot, MessageSquare, RefreshCcw, SlidersHorizontal, GraduationCap, Users, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';
import Avatar from '../components/Avatar';

interface FamilyData {
  parent: { id: number; name: string; avatar: string; created_at: string };
  children: Array<{ id: number; name: string; avatar: string; age: number }>;
  features: Record<string, boolean>;
  childCount: number;
}

export default function AdminPanel() {
  const { currentProfile, refreshProfiles } = useProfile();
  const { flags, refreshFlags } = useFeatureFlags();
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [featureProfile, setFeatureProfile] = useState<Profile | null>(null);
  const [featureAccess, setFeatureAccess] = useState<Record<string, boolean>>({});
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [savingFeatures, setSavingFeatures] = useState(false);

  // Family feature controls (admin-level)
  const [families, setFamilies] = useState<FamilyData[]>([]);
  const [familiesLoading, setFamiliesLoading] = useState(false);
  const [expandedFamilyId, setExpandedFamilyId] = useState<number | null>(null);
  const [familyFeatures, setFamilyFeatures] = useState<Record<string, boolean>>({});
  const [savingFamilyFeatures, setSavingFamilyFeatures] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    type: 'child' as 'admin' | 'parent' | 'child' | 'teacher',
    age: '',
    gender: 'other' as 'male' | 'female' | 'other',
    avatar: '',
    pin: '',
    parent_id: ''
  });

  const featureOptions = [
    { key: 'school', label: 'School', description: 'Assignments, submissions, feedback' },
    { key: 'tasks', label: 'Tasks', description: 'Chores and daily missions' },
    { key: 'quizzes', label: 'Quizzes', description: 'Quiz builder and player' },
    { key: 'notes', label: 'Notes', description: 'Personal notes and reminders' },
    { key: 'calendar', label: 'Calendar', description: 'Schedules and reminders' },
    { key: 'goals', label: 'Goals', description: 'Monthly goals and progress' },
    { key: 'rewards', label: 'Rewards', description: 'Reward shop and claims' },
    { key: 'gamification', label: 'Gamification', description: 'Points, streaks, leaderboard' },
    { key: 'journey', label: 'Journey', description: 'Adventure map' },
    { key: 'leaderboard', label: 'Leaderboard', description: 'Family rankings' },
    { key: 'ai', label: 'AI', description: 'AI assistant and insights' },
    { key: 'diet', label: 'Diet', description: 'Food tracking' }
  ];

  useEffect(() => {
    loadAllProfiles();
    loadFamilies();
  }, []);

  const loadAllProfiles = async () => {
    try {
      setLoading(true);
      const response = await profilesAPI.getAll();
      setAllProfiles(response.data);
    } catch (error) {
      console.error('Failed to load profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFamilies = async () => {
    try {
      setFamiliesLoading(true);
      const response = await profilesAPI.getAdminFamilies();
      setFamilies(response.data.families);
    } catch (error) {
      console.error('Failed to load families:', error);
    } finally {
      setFamiliesLoading(false);
    }
  };

  const toggleFamilyExpand = async (parentId: number) => {
    if (expandedFamilyId === parentId) {
      setExpandedFamilyId(null);
      setFamilyFeatures({});
      return;
    }

    try {
      const response = await profilesAPI.getFamilyFeatures(parentId);
      const nextFeatures: Record<string, boolean> = {};
      // Default all features to enabled
      featureOptions.forEach(option => {
        nextFeatures[option.key] = true;
      });
      // Override with actual stored values
      Object.entries(response.data.features).forEach(([key, enabled]) => {
        nextFeatures[key] = enabled;
      });
      setFamilyFeatures(nextFeatures);
      setExpandedFamilyId(parentId);
    } catch (error) {
      console.error('Failed to load family features:', error);
    }
  };

  const saveFamilyFeatures = async (parentId: number) => {
    try {
      setSavingFamilyFeatures(true);
      await profilesAPI.updateFamilyFeatures(parentId, familyFeatures);
      await loadFamilies();
      alert('Family feature access updated successfully.');
    } catch (error) {
      console.error('Failed to save family features:', error);
      alert('Failed to update family features. Please try again.');
    } finally {
      setSavingFamilyFeatures(false);
    }
  };

  const openFeatureAccess = async (profile: Profile) => {
    try {
      setFeatureProfile(profile);
      setFeaturesLoading(true);
      const response = await profilesAPI.getFeatures(profile.id);
      const nextAccess: Record<string, boolean> = {};
      featureOptions.forEach(option => {
        nextAccess[option.key] = false;
      });
      response.data.forEach(entry => {
        nextAccess[entry.feature_key] = entry.enabled === 1;
      });
      setFeatureAccess(nextAccess);
    } catch (error) {
      console.error('Failed to load feature access:', error);
      alert('Failed to load feature access. Please try again.');
    } finally {
      setFeaturesLoading(false);
    }
  };

  const saveFeatureAccess = async () => {
    if (!featureProfile) return;
    try {
      setSavingFeatures(true);
      await profilesAPI.updateFeatures(featureProfile.id, featureAccess);
      alert(`Feature access updated for ${featureProfile.name}.`);
      setFeatureProfile(null);
    } catch (error) {
      console.error('Failed to update feature access:', error);
      alert('Failed to update feature access. Please try again.');
    } finally {
      setSavingFeatures(false);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data: Partial<Profile> = {
        name: formData.name,
        type: formData.type,
        avatar: formData.avatar || undefined,
        pin: formData.pin || undefined,
        gender: formData.gender,
      };

      if (formData.age) {
        data.age = parseInt(formData.age);
      }

      if (formData.type === 'child' && formData.parent_id) {
        data.parent_id = parseInt(formData.parent_id);
      }

      await profilesAPI.create(data);
      await loadAllProfiles();
      await refreshProfiles();

      setFormData({
        name: '',
        type: 'child',
        age: '',
        gender: 'other',
        avatar: '',
        pin: '',
        parent_id: ''
      });
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create profile:', error);
      alert('Failed to create profile. Please try again.');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;

    try {
      const data: Partial<Profile> = {
        name: formData.name,
        type: formData.type,
        avatar: formData.avatar || undefined,
        gender: formData.gender,
      };

      if (formData.age) {
        data.age = parseInt(formData.age);
      }

      if (formData.type === 'child' && formData.parent_id) {
        data.parent_id = parseInt(formData.parent_id);
      }

      if (formData.pin) {
        data.pin = formData.pin;
      }

      await profilesAPI.update(editingProfile.id, data);
      await loadAllProfiles();
      await refreshProfiles();

      setEditingProfile(null);
      setFormData({
        name: '',
        type: 'child',
        age: '',
        gender: 'other',
        avatar: '',
        pin: '',
        parent_id: ''
      });
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile. Please try again.');
    }
  };

  const handleDeleteProfile = async (profile: Profile) => {
    if (!confirm(`Are you sure you want to delete ${profile.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      await profilesAPI.delete(profile.id);
      await loadAllProfiles();
      await refreshProfiles();
    } catch (error) {
      console.error('Failed to delete profile:', error);
      alert('Failed to delete profile. Please try again.');
    }
  };

  const handleToggleAI = async (profile: Profile) => {
    try {
      const newAiEnabled = profile.ai_enabled === 1 ? 0 : 1;
      await profilesAPI.update(profile.id, { ai_enabled: newAiEnabled });
      await loadAllProfiles();
      await refreshProfiles();

      const status = newAiEnabled === 1 ? 'enabled' : 'disabled';
      alert(`AI Assistant ${status} for ${profile.name}.\n\n${profile.name} will need to log out and log back in to see the changes.`);
    } catch (error) {
      console.error('Failed to toggle AI access:', error);
      alert('Failed to update AI access. Please try again.');
    }
  };

  const handleToggleDiet = async (profile: Profile) => {
    try {
      const newDietEnabled = (profile as any).diet_enabled === 1 ? 0 : 1;
      await profilesAPI.update(profile.id, { diet_enabled: newDietEnabled });
      if (newDietEnabled === 1) {
        await settingsAPI.set('diet_feature_enabled', 'true');
        await refreshFlags();
      }
      await loadAllProfiles();
      await refreshProfiles();

      const status = newDietEnabled === 1 ? 'enabled' : 'disabled';
      alert(`Diet Tracking ${status} for ${profile.name}.\n\n${profile.name} will need to log out and log back in to see the changes.`);
    } catch (error) {
      console.error('Failed to toggle Diet access:', error);
      alert('Failed to update Diet access. Please try again.');
    }
  };

  const handleToggleSchoolOnlyMode = async () => {
    try {
      const nextValue = flags.school_only_mode ? 'false' : 'true';
      await settingsAPI.set('school_only_mode', nextValue);
      await refreshFlags();
      alert(`School-only mode ${nextValue === 'true' ? 'enabled' : 'disabled'}.`);
    } catch (error) {
      console.error('Failed to toggle school-only mode:', error);
      alert('Failed to update school-only mode. Please try again.');
    }
  };

  const handleUpdateMessageLimit = async (profile: Profile, limitType: 'limited' | 'extended' | 'unlimited') => {
    try {
      await aiAPI.updateMessageLimit(profile.id, limitType);

      const limitDesc = limitType === 'limited' ? '5/day' : limitType === 'extended' ? '20/day' : 'unlimited';
      alert(`AI message limit updated for ${profile.name}.\n\nNew limit: ${limitDesc}`);
    } catch (error) {
      console.error('Failed to update message limit:', error);
      alert('Failed to update message limit. Please try again.');
    }
  };

  const startEdit = (profile: Profile) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name,
      type: profile.type,
      age: profile.age?.toString() || '',
      gender: profile.gender || 'other',
      avatar: profile.avatar || '',
      pin: '',
      parent_id: profile.parent_id?.toString() || ''
    });
    setShowCreateForm(false);
  };

  const cancelEdit = () => {
    setEditingProfile(null);
    setFormData({
      name: '',
      type: 'child',
      age: '',
      gender: 'other',
      avatar: '',
      pin: '',
      parent_id: ''
    });
  };

  const admins = allProfiles.filter(p => p.type === 'admin');
  const parents = allProfiles.filter(p => p.type === 'parent');
  const teachers = allProfiles.filter(p => p.type === 'teacher');
  const children = allProfiles.filter(p => p.type === 'child');
  const availableParents = allProfiles.filter(p => p.type === 'parent' || p.type === 'admin');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 admin-shell">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-slate-500">Loading profiles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell max-w-7xl mx-auto space-y-6">
      <section className="relative overflow-hidden rounded-[28px] bg-slate-900 text-white shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.25),transparent_55%)]"></div>
        <div className="absolute inset-0 bg-[linear-gradient(135deg,_rgba(14,165,233,0.2),transparent_45%)]"></div>
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.18)_1px,transparent_1px)] [background-size:36px_36px]"></div>
        <div className="relative z-10 px-6 py-8 md:px-10 md:py-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl border border-emerald-300/40 bg-emerald-400/10 p-3">
                <Shield className="text-emerald-200" size={28} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/70">Admin Console</p>
                <h1 className="text-3xl md:text-4xl font-semibold mt-2">Identity & Access</h1>
                <p className="text-slate-200/80 mt-1">Create profiles, tune AI access, and enforce limits.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setShowCreateForm(true);
                  setEditingProfile(null);
                  cancelEdit();
                }}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5"
              >
                <Plus size={18} /> Create Profile
              </button>
              <button
                onClick={handleToggleSchoolOnlyMode}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition',
                  flags.school_only_mode
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 hover:bg-rose-600'
                    : 'border border-white/30 bg-white/10 text-white hover:bg-white/20'
                )}
              >
                <Shield size={16} />
                {flags.school_only_mode ? 'School-Only On' : 'School-Only Off'}
              </button>
              <button
                onClick={loadAllProfiles}
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                <RefreshCcw size={16} /> Refresh
              </button>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">Admins</p>
              <p className="admin-mono text-3xl font-semibold mt-2">{admins.length}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">Parents</p>
              <p className="admin-mono text-3xl font-semibold mt-2">{parents.length}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">Teachers</p>
              <p className="admin-mono text-3xl font-semibold mt-2">{teachers.length}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">Children</p>
              <p className="admin-mono text-3xl font-semibold mt-2">{children.length}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Family Feature Controls - Admin Level */}
      <section className="card border border-slate-200/80 bg-white p-6 shadow-lg">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-100 p-2">
              <Users className="text-purple-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Family Feature Controls</h2>
              <p className="text-sm text-slate-500">Control which features each family can access. This overrides individual profile settings.</p>
            </div>
          </div>
          <button
            onClick={loadFamilies}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCcw size={16} /> Refresh
          </button>
        </div>

        {familiesLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="spinner"></div>
          </div>
        ) : families.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Users className="mx-auto mb-2 text-slate-400" size={32} />
            <p>No families found. Create parent profiles to see families here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {families.map(family => (
              <div key={family.parent.id} className="rounded-2xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                <button
                  onClick={() => toggleFamilyExpand(family.parent.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-100/80 transition"
                >
                  <div className="flex items-center gap-4">
                    <Avatar avatar={family.parent.avatar} size="md" alt={family.parent.name} />
                    <div className="text-left">
                      <h3 className="font-semibold text-slate-900">{family.parent.name}'s Family</h3>
                      <p className="text-sm text-slate-500">
                        {family.childCount} {family.childCount === 1 ? 'child' : 'children'}
                        {family.children.length > 0 && ': '}
                        {family.children.map(c => c.name).join(', ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden md:flex gap-2">
                      {Object.entries(family.features).slice(0, 4).map(([key, enabled]) => (
                        <span
                          key={key}
                          className={clsx(
                            'px-2 py-1 text-xs font-medium rounded-full',
                            enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          )}
                        >
                          {key}
                        </span>
                      ))}
                      {Object.keys(family.features).length > 4 && (
                        <span className="px-2 py-1 text-xs text-slate-500">
                          +{Object.keys(family.features).length - 4} more
                        </span>
                      )}
                    </div>
                    {expandedFamilyId === family.parent.id ? (
                      <ChevronUp className="text-slate-400" size={20} />
                    ) : (
                      <ChevronDown className="text-slate-400" size={20} />
                    )}
                  </div>
                </button>

                {expandedFamilyId === family.parent.id && (
                  <div className="border-t border-slate-200 bg-white p-4">
                    <p className="text-sm text-slate-600 mb-4">
                      Toggle features on/off for this family. Disabled features will be blocked for all family members.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {featureOptions.map(option => (
                        <label
                          key={option.key}
                          className={clsx(
                            'flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition',
                            familyFeatures[option.key]
                              ? 'border-emerald-300 bg-emerald-50/50'
                              : 'border-rose-200 bg-rose-50/50'
                          )}
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-emerald-600"
                            checked={Boolean(familyFeatures[option.key])}
                            onChange={() =>
                              setFamilyFeatures(prev => ({
                                ...prev,
                                [option.key]: !prev[option.key]
                              }))
                            }
                          />
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{option.label}</p>
                            <p className="text-xs text-slate-500">{option.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="mt-4 flex gap-3">
                      <button
                        onClick={() => saveFamilyFeatures(family.parent.id)}
                        disabled={savingFamilyFeatures}
                        className="btn btn-primary"
                      >
                        {savingFamilyFeatures ? 'Saving...' : 'Save Family Features'}
                      </button>
                      <button
                        onClick={() => {
                          setExpandedFamilyId(null);
                          setFamilyFeatures({});
                        }}
                        className="btn btn-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {(showCreateForm || editingProfile) && (
        <section className="card border border-slate-200/80 bg-white p-6 shadow-lg">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{editingProfile ? 'Edit Profile' : 'Create New Profile'}</h2>
              <p className="text-sm text-slate-500">Define identity, security, and family context.</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <SlidersHorizontal size={16} />
              Required fields marked with *
            </div>
          </div>
          <form onSubmit={editingProfile ? handleUpdateProfile : handleCreateProfile} className="mt-6 space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="Full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="input"
                >
                  <option value="child">Child</option>
                  <option value="parent">Parent</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {formData.type === 'child' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Age</label>
                    <input
                      type="number"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      className="input"
                      placeholder="Age"
                      min="1"
                      max="18"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Parent</label>
                    <select
                      value={formData.parent_id}
                      onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                      className="input"
                    >
                      <option value="">Select parent (optional)</option>
                      {availableParents.map(parent => (
                        <option key={parent.id} value={parent.id}>
                          {parent.name} ({parent.type})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                  className="input"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Avatar (text)</label>
                <input
                  type="text"
                  value={formData.avatar}
                  onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                  className="input"
                  placeholder=":)"
                  maxLength={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  PIN {editingProfile && '(leave empty to keep current)'}
                </label>
                <input
                  type="password"
                  value={formData.pin}
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                  className="input"
                  placeholder="Optional 4-8 digit PIN"
                  maxLength={8}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="submit" className="btn btn-primary">
                {editingProfile ? 'Update Profile' : 'Create Profile'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  cancelEdit();
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="grid grid-cols-1 gap-6">
        {admins.length > 0 && (
          <div className="card border border-slate-200/80 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Shield className="text-amber-500" size={20} />
              Administrators ({admins.length})
            </h2>
            <div className="space-y-3">
              {admins.map(profile => (
                <ProfileRow
                  key={profile.id}
                  profile={profile}
                  onEdit={startEdit}
                  onDelete={handleDeleteProfile}
                  onManageFeatures={openFeatureAccess}
                  isCurrentUser={profile.id === currentProfile?.id}
                />
              ))}
            </div>
          </div>
        )}

        {parents.length > 0 && (
          <div className="card border border-slate-200/80 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <User className="text-sky-500" size={20} />
              Parents ({parents.length})
            </h2>
            <div className="space-y-3">
              {parents.map(profile => (
                <ProfileRow
                  key={profile.id}
                  profile={profile}
                  onEdit={startEdit}
                  onDelete={handleDeleteProfile}
                  onManageFeatures={openFeatureAccess}
                  onToggleAI={handleToggleAI}
                  onToggleDiet={handleToggleDiet}
                  isCurrentUser={profile.id === currentProfile?.id}
                  children={children.filter(c => c.parent_id === profile.id)}
                />
              ))}
            </div>
          </div>
        )}

        {teachers.length > 0 && (
          <div className="card border border-slate-200/80 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <GraduationCap className="text-emerald-500" size={20} />
              Teachers ({teachers.length})
            </h2>
            <div className="space-y-3">
              {teachers.map(profile => (
                <ProfileRow
                  key={profile.id}
                  profile={profile}
                  onEdit={startEdit}
                  onDelete={handleDeleteProfile}
                  onManageFeatures={openFeatureAccess}
                  isCurrentUser={profile.id === currentProfile?.id}
                />
              ))}
            </div>
          </div>
        )}

        {children.length > 0 && (
          <div className="card border border-slate-200/80 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Baby className="text-orange-500" size={20} />
              Children ({children.length})
            </h2>
            <div className="space-y-3">
              {children.map(profile => {
                const parent = allProfiles.find(p => p.id === profile.parent_id);
                return (
                  <ProfileRow
                    key={profile.id}
                    profile={profile}
                    onEdit={startEdit}
                    onDelete={handleDeleteProfile}
                    onManageFeatures={openFeatureAccess}
                    onToggleAI={handleToggleAI}
                    onToggleDiet={handleToggleDiet}
                    onUpdateMessageLimit={handleUpdateMessageLimit}
                    isCurrentUser={profile.id === currentProfile?.id}
                    parentName={parent?.name}
                  />
                );
              })}
            </div>
          </div>
        )}
      </section>

      {featureProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Feature Access</h2>
                <p className="text-sm text-slate-500">
                  {featureProfile.name} ({featureProfile.type})
                </p>
              </div>
              <button
                onClick={() => setFeatureProfile(null)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {featuresLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="spinner"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {featureOptions.map(option => (
                    <label
                      key={option.key}
                      className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 hover:border-indigo-300"
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={Boolean(featureAccess[option.key])}
                        onChange={() =>
                          setFeatureAccess(prev => ({
                            ...prev,
                            [option.key]: !prev[option.key]
                          }))
                        }
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{option.label}</p>
                        <p className="text-xs text-slate-500">{option.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={saveFeatureAccess}
                disabled={savingFeatures}
                className="btn btn-primary"
              >
                {savingFeatures ? 'Saving...' : 'Save Access'}
              </button>
              <button
                onClick={() => setFeatureProfile(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ProfileRowProps {
  profile: Profile;
  onEdit: (profile: Profile) => void;
  onDelete: (profile: Profile) => void;
  onManageFeatures?: (profile: Profile) => void;
  onToggleAI?: (profile: Profile) => void;
  onToggleDiet?: (profile: Profile) => void;
  onUpdateMessageLimit?: (profile: Profile, limitType: 'limited' | 'extended' | 'unlimited') => void;
  isCurrentUser: boolean;
  children?: Profile[];
  parentName?: string;
}

function ProfileRow({ profile, onEdit, onDelete, onManageFeatures, onToggleAI, onToggleDiet, onUpdateMessageLimit, isCurrentUser, children, parentName }: ProfileRowProps) {
  const [showLimitDropdown, setShowLimitDropdown] = useState(false);

  const getProfileIcon = (type: string) => {
    switch (type) {
      case 'admin': return <Shield className="text-amber-500" size={18} />;
      case 'parent': return <User className="text-sky-500" size={18} />;
      case 'child': return <Baby className="text-orange-500" size={18} />;
      case 'teacher': return <GraduationCap className="text-emerald-500" size={18} />;
      default: return <User size={18} />;
    }
  };

  return (
    <div
      className={clsx(
        'flex flex-col gap-4 rounded-2xl border bg-slate-50/80 p-4 md:flex-row md:items-center md:justify-between',
        isCurrentUser ? 'border-amber-300 bg-amber-50/70' : 'border-slate-200'
      )}
    >
      <div className="flex items-center gap-4">
        <Avatar avatar={profile.avatar} size="lg" alt={profile.name} />
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900">
              {profile.name}
              {isCurrentUser && <span className="ml-2 text-xs text-amber-700 font-normal">(You)</span>}
            </h3>
            {getProfileIcon(profile.type)}
          </div>
          <div className="text-sm text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
            {profile.age && <span>Age: {profile.age}</span>}
            {profile.gender && <span>Gender: {profile.gender}</span>}
            {parentName && <span>Parent: {parentName}</span>}
            {profile.pin && <span>PIN set</span>}
          </div>
          {children && children.length > 0 && (
            <div className="text-xs text-slate-500 mt-1">
              Children: {children.map(c => c.name).join(', ')}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {onManageFeatures && (
          <button
            onClick={() => onManageFeatures(profile)}
            className="flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-md hover:bg-indigo-700"
            title="Manage feature access"
          >
            <SlidersHorizontal size={14} />
            Access
          </button>
        )}
        {(profile.type === 'child' || profile.type === 'parent') && onToggleAI && (
          <button
            onClick={() => onToggleAI(profile)}
            className={clsx(
              'flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition',
              profile.ai_enabled === 1
                ? 'bg-slate-900 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            )}
            title={profile.ai_enabled === 1 ? 'Click to disable AI Assistant' : 'Click to enable AI Assistant'}
          >
            <Bot size={14} />
            AI Access
          </button>
        )}
        {profile.type === 'child' && profile.ai_enabled === 1 && onUpdateMessageLimit && (
          <div className="relative">
            <button
              onClick={() => setShowLimitDropdown(!showLimitDropdown)}
              className="flex items-center gap-1.5 rounded-full bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-md hover:bg-sky-700"
              title="Set AI message limit per day"
            >
              <MessageSquare size={14} />
              Limit
            </button>
            {showLimitDropdown && (
              <div className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 bg-white shadow-lg z-10">
                <button
                  onClick={() => { onUpdateMessageLimit(profile, 'limited'); setShowLimitDropdown(false); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 rounded-t-xl"
                >
                  Limited (5/day)
                </button>
                <button
                  onClick={() => { onUpdateMessageLimit(profile, 'extended'); setShowLimitDropdown(false); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Extended (20/day)
                </button>
                <button
                  onClick={() => { onUpdateMessageLimit(profile, 'unlimited'); setShowLimitDropdown(false); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 rounded-b-xl"
                >
                  Unlimited
                </button>
              </div>
            )}
          </div>
        )}
        {(profile.type === 'child' || profile.type === 'parent') && onToggleDiet && (
          <button
            onClick={() => onToggleDiet(profile)}
            className={clsx(
              'flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition',
              (profile as any).diet_enabled === 1
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            )}
            title={(profile as any).diet_enabled === 1 ? 'Click to disable Diet' : 'Click to enable Diet'}
          >
            Diet
          </button>
        )}
        <button
          onClick={() => onEdit(profile)}
          className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100"
          title="Edit profile"
        >
          <Edit2 size={16} />
        </button>
        <button
          onClick={() => onDelete(profile)}
          className="rounded-full border border-slate-200 bg-white p-2 text-rose-600 hover:bg-rose-50"
          title="Delete profile"
          disabled={isCurrentUser}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
