import { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { profilesAPI, aiAPI, settingsAPI } from '../services/api';
import { useFeatureFlags } from '../context/FeatureFlagsContext';
import { Profile } from '../types';
import { Plus, Edit2, Trash2, Shield, User, Baby, Bot, MessageSquare, RefreshCcw, SlidersHorizontal } from 'lucide-react';
import clsx from 'clsx';
import Avatar from '../components/Avatar';

export default function AdminPanel() {
  const { currentProfile, refreshProfiles } = useProfile();
  const { refreshFlags } = useFeatureFlags();
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'child' as 'admin' | 'parent' | 'child',
    age: '',
    gender: 'other' as 'male' | 'female' | 'other',
    avatar: '',
    pin: '',
    parent_id: ''
  });

  useEffect(() => {
    loadAllProfiles();
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
                onClick={loadAllProfiles}
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                <RefreshCcw size={16} /> Refresh
              </button>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">Admins</p>
              <p className="admin-mono text-3xl font-semibold mt-2">{admins.length}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">Parents</p>
              <p className="admin-mono text-3xl font-semibold mt-2">{parents.length}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">Children</p>
              <p className="admin-mono text-3xl font-semibold mt-2">{children.length}</p>
            </div>
          </div>
        </div>
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
                  onToggleAI={handleToggleAI}
                  onToggleDiet={handleToggleDiet}
                  isCurrentUser={profile.id === currentProfile?.id}
                  children={children.filter(c => c.parent_id === profile.id)}
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
    </div>
  );
}

interface ProfileRowProps {
  profile: Profile;
  onEdit: (profile: Profile) => void;
  onDelete: (profile: Profile) => void;
  onToggleAI?: (profile: Profile) => void;
  onToggleDiet?: (profile: Profile) => void;
  onUpdateMessageLimit?: (profile: Profile, limitType: 'limited' | 'extended' | 'unlimited') => void;
  isCurrentUser: boolean;
  children?: Profile[];
  parentName?: string;
}

function ProfileRow({ profile, onEdit, onDelete, onToggleAI, onToggleDiet, onUpdateMessageLimit, isCurrentUser, children, parentName }: ProfileRowProps) {
  const [showLimitDropdown, setShowLimitDropdown] = useState(false);

  const getProfileIcon = (type: string) => {
    switch (type) {
      case 'admin': return <Shield className="text-amber-500" size={18} />;
      case 'parent': return <User className="text-sky-500" size={18} />;
      case 'child': return <Baby className="text-orange-500" size={18} />;
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
