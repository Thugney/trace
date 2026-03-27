import { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { settingsAPI, profilesAPI, aiAPI, remindersAPI, ReminderPreferences } from '../services/api';
import clsx from 'clsx';
import {
  AlertTriangle,
  BellRing,
  Bot,
  Brain,
  Camera,
  ChevronDown,
  ChevronUp,
  KeyRound,
  LayoutGrid,
  Lock,
  Plus,
  RefreshCcw,
  Save,
  Shield,
  Users,
  X
} from 'lucide-react';
import Avatar from '../components/Avatar';
import ReminderWidget from '../components/kids/ReminderWidget';
import { useToast } from '../components/Toast';

export default function Settings() {
  const { currentProfile, isParent, isAdmin, profiles, refreshProfiles } = useProfile();
  const toast = useToast();
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [grokApiKey, setGrokApiKey] = useState('');
  const [parentPin, setParentPin] = useState('');
  const [newParentPin, setNewParentPin] = useState('');
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [aiSettings, setAiSettings] = useState<Record<number, any>>({});
  const [expandedAIProfile, setExpandedAIProfile] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Password management state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Reset PIN modal state
  const [showResetPinModal, setShowResetPinModal] = useState(false);
  const [resetPinProfile, setResetPinProfile] = useState<any>(null);
  const [resetPin, setResetPin] = useState('');
  const [confirmResetPin, setConfirmResetPin] = useState('');

  // Edit Profile modal state (Admin only)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);

  // Avatar upload state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // State for child PIN change
  const [childNewPin, setChildNewPin] = useState('');
  const [childConfirmPin, setChildConfirmPin] = useState('');

  // State for reminder preferences
  const [reminderPrefs, setReminderPrefs] = useState<ReminderPreferences | null>(null);
  const [savingReminders, setSavingReminders] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  // Load reminder preferences
  useEffect(() => {
    if (currentProfile?.id) {
      loadReminderPreferences();
    }
  }, [currentProfile?.id]);

  const loadReminderPreferences = async () => {
    if (!currentProfile?.id) return;
    try {
      const response = await remindersAPI.getPreferences(currentProfile.id);
      setReminderPrefs(response.data);
    } catch (error) {
      console.error('Failed to load reminder preferences:', error);
    }
  };

  const handleReminderToggle = async () => {
    if (!currentProfile?.id || !reminderPrefs) return;
    setSavingReminders(true);
    try {
      const response = await remindersAPI.updatePreferences(currentProfile.id, {
        enabled: !reminderPrefs.reminder_enabled
      });
      setReminderPrefs(response.data);
      setSuccessMessage('Reminder settings updated!');
    } catch (error) {
      console.error('Failed to update reminder preferences:', error);
    } finally {
      setSavingReminders(false);
    }
  };

  const handleReminderTimeChange = async (time: string) => {
    if (!currentProfile?.id) return;
    setSavingReminders(true);
    try {
      const response = await remindersAPI.updatePreferences(currentProfile.id, { time });
      setReminderPrefs(response.data);
      setSuccessMessage('Reminder time updated!');
    } catch (error) {
      console.error('Failed to update reminder time:', error);
    } finally {
      setSavingReminders(false);
    }
  };

  // Load AI settings when profiles are loaded
  useEffect(() => {
    if (profiles.length > 0) {
      loadAllAISettings();
    }
  }, [profiles]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const loadAllAISettings = async () => {
    const childProfiles = profiles.filter(p => p.type === 'child');
    const settingsMap: Record<number, any> = {};

    for (const profile of childProfiles) {
      try {
        const response = await aiAPI.getSettings(profile.id);
        settingsMap[profile.id] = response.data;
      } catch (error) {
        console.error(`Failed to load AI settings for ${profile.name}:`, error);
      }
    }

    setAiSettings(settingsMap);
  };

  const handleUpdateAISettings = async (profileId: number, updates: any) => {
    try {
      const response = await aiAPI.updateSettings(profileId, updates);
      setAiSettings(prev => ({
        ...prev,
        [profileId]: response.data
      }));
      setSuccessMessage('AI settings updated!');
    } catch (error) {
      console.error('Failed to update AI settings:', error);
      setSuccessMessage('Failed to update settings');
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsAPI.getAll();
      setSettings(response.data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGrokKey = async () => {
    if (!grokApiKey.trim()) {
      toast.error('Please enter a valid Grok API key');
      return;
    }

    setSaving(true);
    try {
      await settingsAPI.set('grok_api_key', grokApiKey);
      await settingsAPI.set('grok_api_enabled', 'true');
      setSuccessMessage('Grok API key saved successfully!');
      setGrokApiKey('');
      await loadSettings();
    } catch (error) {
      console.error('Failed to save API key:', error);
      toast.error('Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  const handleSetPin = async () => {
    if (!newParentPin || newParentPin.length < 4) {
      toast.error('PIN must be at least 4 characters');
      return;
    }

    setSaving(true);
    try {
      await settingsAPI.setPIN(newParentPin, parentPin || undefined);
      setSuccessMessage('Parent PIN updated successfully!');
      setParentPin('');
      setNewParentPin('');
      await loadSettings();
    } catch (error: any) {
      console.error('Failed to set PIN:', error);
      toast.error(error.response?.data?.error || 'Failed to set PIN');
    } finally {
      setSaving(false);
    }
  };

  const handleSetPassword = async () => {
    if (!currentProfile) return;

    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setSaving(true);
    try {
      await profilesAPI.update(currentProfile.id, { password: newPassword });
      setSuccessMessage('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
      await refreshProfiles();
    } catch (error: any) {
      console.error('Failed to set password:', error);
      toast.error(error.response?.data?.error || 'Failed to set password');
    } finally {
      setSaving(false);
    }
  };

  const handleResetChildPin = async () => {
    if (!currentProfile || !resetPinProfile) return;

    if (!resetPin || resetPin.length < 4) {
      toast.error('PIN must be at least 4 digits');
      return;
    }

    if (resetPin !== confirmResetPin) {
      toast.error('PINs do not match');
      return;
    }

    setSaving(true);
    try {
      // Use the reset-password endpoint with parentId
      await profilesAPI.resetPassword(resetPinProfile.id, resetPin, currentProfile.id);
      setSuccessMessage(`PIN reset successfully for ${resetPinProfile.name}!`);
      setShowResetPinModal(false);
      setResetPinProfile(null);
      setResetPin('');
      setConfirmResetPin('');
    } catch (error: any) {
      console.error('Failed to reset PIN:', error);
      toast.error(error.response?.data?.error || 'Failed to reset PIN');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentProfile) return;

    const formData = new FormData(e.currentTarget);

    setSaving(true);
    try {
      await profilesAPI.update(currentProfile.id, {
        name: formData.get('name') as string,
        avatar: formData.get('avatar') as string
      });

      setSuccessMessage('Profile updated successfully!');
      await refreshProfiles();
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAddProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const pin = formData.get('pin') as string;
    const confirmPin = formData.get('confirmPin') as string;
    const profileType = formData.get('profileType') as string;

    // Validate PIN
    if (!pin || pin.length < 4) {
      toast.error('PIN must be at least 4 digits');
      return;
    }

    if (pin !== confirmPin) {
      toast.error('PINs do not match');
      return;
    }

    setSaving(true);
    try {
      const age = formData.get('age') as string;
      const gender = formData.get('gender') as string;

      await profilesAPI.create({
        name: formData.get('name') as string,
        type: profileType as any,
        age: age ? parseInt(age, 10) : undefined,
        gender: gender as any,
        pin,
        avatar: getAvatar(profileType, gender)
      });

      setSuccessMessage('Profile created successfully!');
      await refreshProfiles();
      setShowAddProfile(false);
      e.currentTarget.reset();
    } catch (error) {
      console.error('Failed to create profile:', error);
      toast.error('Failed to create profile');
    } finally {
      setSaving(false);
    }
  };

  const handleEditProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProfile) return;

    const formData = new FormData(e.currentTarget);
    const newPin = formData.get('newPin') as string;
    const confirmNewPin = formData.get('confirmNewPin') as string;

    // Validate PIN if provided
    if (newPin) {
      if (newPin.length < 4) {
        toast.error('PIN must be at least 4 digits');
        return;
      }
      if (newPin !== confirmNewPin) {
        toast.error('PINs do not match');
        return;
      }
    }

    setSaving(true);
    try {
      const age = formData.get('age') as string;
      const gender = formData.get('gender') as string;
      const profileType = formData.get('profileType') as string;

      const updateData: any = {
        name: formData.get('name') as string,
        type: profileType as any,
        age: age ? parseInt(age, 10) : undefined,
        gender: gender as any,
        avatar: formData.get('avatar') as string
      };

      // Only update PIN if provided
      if (newPin) {
        updateData.pin = newPin;
      }

      await profilesAPI.update(editingProfile.id, updateData);
      setSuccessMessage(`${updateData.name} updated successfully!`);
      await refreshProfiles();
      setShowEditModal(false);
      setEditingProfile(null);
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      toast.error(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const getAvatar = (type: string, gender: string) => {
    if (type === 'parent') {
      return gender === 'male' ? '👨' : gender === 'female' ? '👩' : '👤';
    }
    return gender === 'male' ? '👦' : gender === 'female' ? '👧' : '🧒';
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>, profileId: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File is too large. Maximum size is 5MB.');
      return;
    }

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      toast.error('Invalid file type. Please upload JPEG, PNG, GIF, or WebP.');
      return;
    }

    setUploadingAvatar(true);
    try {
      await profilesAPI.uploadAvatar(profileId, file);
      setSuccessMessage('Avatar uploaded successfully!');
      await refreshProfiles();
    } catch (error: any) {
      console.error('Failed to upload avatar:', error);
      // Show detailed error message
      const errorMsg = error.response?.data?.error
        || error.message
        || 'Failed to upload avatar. Please try again.';
      toast.error(`Upload failed: ${errorMsg}`);
    } finally {
      setUploadingAvatar(false);
      // Clear the file input
      e.target.value = '';
    }
  };

  const handleChildPinChange = async () => {
    if (!currentProfile) return;

    if (!childNewPin || childNewPin.length < 4) {
      toast.error('PIN must be at least 4 digits');
      return;
    }

    if (childNewPin !== childConfirmPin) {
      toast.error('PINs do not match');
      return;
    }

    setSaving(true);
    try {
      // Verify current PIN first, then update
      await profilesAPI.update(currentProfile.id, { pin: childNewPin });
      setSuccessMessage('PIN updated successfully!');
      setChildNewPin('');
      setChildConfirmPin('');
    } catch (error: any) {
      console.error('Failed to change PIN:', error);
      toast.error(error.response?.data?.error || 'Failed to change PIN');
    } finally {
      setSaving(false);
    }
  };

  const childProfiles = profiles.filter(profile => profile.type === 'child');
  const parentProfiles = profiles.filter(profile => profile.type === 'parent');
  const adminProfiles = profiles.filter(profile => profile.type === 'admin');
  const teacherProfiles = profiles.filter(profile => profile.type === 'teacher');
  const aiEnabledChildren = childProfiles.filter(profile => profile.ai_enabled === 1);
  const protectedProfiles = profiles.filter(profile => Boolean(profile.pin)).length;
  const hasGrokConfigured = settings.grok_api_enabled === 'true';
  const hasParentPin = Boolean(settings.parent_pin);

  const getRoleBadgeClass = (type: string) => {
    switch (type) {
      case 'admin':
        return 'family-badge family-badge-admin';
      case 'parent':
        return 'family-badge family-badge-parent';
      case 'child':
        return 'family-badge family-badge-child';
      case 'teacher':
        return 'family-badge family-badge-teacher';
      default:
        return 'family-badge family-badge-neutral';
    }
  };

  const getProfileSummary = (profile: typeof profiles[number]) => {
    if (profile.type === 'child') {
      return profile.age ? `Child, ${profile.age} years old` : 'Child profile';
    }

    if (profile.type === 'parent') return 'Parent account';
    if (profile.type === 'admin') return 'Admin account';
    if (profile.type === 'teacher') return 'Teacher account';
    return 'Profile';
  };

  if (currentProfile?.type === 'child') {
    // Kids only see limited settings
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-600 mt-1">Update your profile information</p>
        </div>

        {/* Success Toast */}
        {successMessage && (
          <div className="fixed top-4 right-4 z-50 animate-fade-in">
            <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2">
              <Shield size={20} />
              <span>{successMessage}</span>
            </div>
          </div>
        )}

        {/* Reminder Settings - Kid-Friendly - PROMINENT PLACEMENT */}
        <div className="card bg-gradient-to-br from-cyan-50 to-blue-50 border-2 border-cyan-200 mb-6">
          <div className="text-center mb-4">
            <span className="text-4xl animate-bounce inline-block">🔔</span>
            <h2 className="text-xl font-bold text-cyan-800 mt-2">My Reminders</h2>
            <p className="text-sm text-cyan-600">Never forget your tasks!</p>
          </div>

          {reminderPrefs ? (
            <ReminderWidget
              enabled={reminderPrefs.reminder_enabled}
              time={reminderPrefs.morning_reminder_time}
              onToggle={handleReminderToggle}
              onTimeChange={handleReminderTimeChange}
              saving={savingReminders}
            />
          ) : (
            <div className="flex justify-center py-4">
              <div className="spinner"></div>
            </div>
          )}
        </div>

        <div className="card">
          {/* Avatar Upload Section */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              <div className="border-4 border-primary-200 rounded-full">
                <Avatar avatar={currentProfile?.avatar} size="xl" alt={currentProfile?.name || 'Avatar'} />
              </div>
              <label className="absolute bottom-0 right-0 bg-primary-600 text-white p-2 rounded-full cursor-pointer hover:bg-primary-700 transition-colors">
                <Camera size={16} />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={(e) => handleAvatarUpload(e, currentProfile.id)}
                  className="hidden"
                  disabled={uploadingAvatar}
                />
              </label>
            </div>
            {uploadingAvatar && (
              <div className="mt-2 flex items-center text-sm text-gray-600">
                <div className="spinner mr-2"></div>
                Uploading...
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">Click the camera to upload a photo</p>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label htmlFor="child-name" className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                id="child-name"
                type="text"
                name="name"
                defaultValue={currentProfile?.name}
                className="input"
                required
              />
            </div>

            <div>
              <label htmlFor="child-avatar" className="block text-sm font-medium text-gray-700 mb-1">
                Avatar (Emoji) - or upload a photo above
              </label>
              <input
                id="child-avatar"
                type="text"
                name="avatar"
                defaultValue={currentProfile?.avatar?.startsWith('/api/') ? '' : currentProfile?.avatar}
                className="input"
                placeholder="👦"
              />
            </div>

            <button type="submit" disabled={saving} className="btn btn-primary w-full">
              {saving ? <div className="spinner"></div> : <Save size={20} className="mr-2" />}
              Save Changes
            </button>
          </form>
        </div>

        {/* PIN Change Section for Kids */}
        <div className="card mt-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Lock className="mr-2 text-orange-600" size={20} />
            Change My PIN
          </h2>

          <p className="text-sm text-gray-600 mb-4">
            Change your login PIN. Make sure to remember it!
          </p>

          <div className="space-y-4">
            <div>
              <label htmlFor="child-new-pin" className="block text-sm font-medium text-gray-700 mb-1">
                New PIN *
              </label>
              <input
                id="child-new-pin"
                type="password"
                value={childNewPin}
                onChange={e => setChildNewPin(e.target.value)}
                className="input"
                placeholder="Enter new PIN (min 4 digits)"
                pattern="[0-9]*"
                inputMode="numeric"
                minLength={4}
                maxLength={8}
                autoComplete="new-password"
              />
            </div>

            <div>
              <label htmlFor="child-confirm-pin" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New PIN *
              </label>
              <input
                id="child-confirm-pin"
                type="password"
                value={childConfirmPin}
                onChange={e => setChildConfirmPin(e.target.value)}
                className="input"
                placeholder="Re-enter new PIN"
                pattern="[0-9]*"
                inputMode="numeric"
                minLength={4}
                maxLength={8}
                autoComplete="new-password"
              />
            </div>

            <button
              onClick={handleChildPinChange}
              disabled={saving || !childNewPin || !childConfirmPin}
              className="btn btn-primary w-full"
            >
              {saving ? <div className="spinner"></div> : <Save size={20} className="mr-2" />}
              Change PIN
            </button>
          </div>
        </div>

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <Shield className="inline mr-2" size={16} />
            <strong>Note:</strong> Some settings can only be changed by your parents.
          </p>
        </div>
      </div>
    );
  }

  // Parent settings - full access
  return (
    <div className="space-y-6">
      <section className="family-hero">
        <div className="relative z-10 grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
          <div>
            <p className="family-kicker !text-white/70">Family settings</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Keep identity, security, and household controls in one calm workspace.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/80 sm:text-base">
              The old settings screen stacked everything into a single long utility page. This version
              puts the important household controls first and makes the admin-only tools feel deliberate.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {(isParent || isAdmin) && (
                <button
                  onClick={() => setShowAddProfile(true)}
                  className="btn btn-lg bg-white text-slate-950 hover:bg-slate-100"
                >
                  <Plus size={18} />
                  Add profile
                </button>
              )}
              <button
                onClick={() => {
                  refreshProfiles();
                  loadSettings();
                  loadReminderPreferences();
                  loadAllAISettings();
                }}
                className="family-button-secondary"
              >
                <RefreshCcw size={16} />
                Refresh data
              </button>
              <span className="family-nav-chip">
                <LayoutGrid size={14} />
                {profiles.length} profiles
              </span>
              <span className="family-nav-chip">
                <Shield size={14} />
                {hasParentPin ? 'Protected settings' : 'PIN not set'}
              </span>
              {reminderPrefs && (
                <span className="family-nav-chip">
                  <BellRing size={14} />
                  {reminderPrefs.reminder_enabled ? 'Reminders on' : 'Reminders off'}
                </span>
              )}
            </div>
          </div>

          <div className="relative z-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[24px] border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-sm font-medium text-white/70">Profiles</p>
              <p className="mt-3 text-3xl font-semibold text-white">{profiles.length}</p>
              <p className="mt-2 text-sm text-white/70">{childProfiles.length} children, {parentProfiles.length} parents</p>
            </div>
            <div className="rounded-[24px] border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-sm font-medium text-white/70">Protected profiles</p>
              <p className="mt-3 text-3xl font-semibold text-white">{protectedProfiles}</p>
              <p className="mt-2 text-sm text-white/70">with a PIN configured</p>
            </div>
            <div className="rounded-[24px] border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-sm font-medium text-white/70">AI-enabled children</p>
              <p className="mt-3 text-3xl font-semibold text-white">{aiEnabledChildren.length}</p>
              <p className="mt-2 text-sm text-white/70">guardrails managed below</p>
            </div>
            <div className="rounded-[24px] border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-sm font-medium text-white/70">Platform AI</p>
              <p className="mt-3 text-3xl font-semibold text-white">{hasGrokConfigured ? 'Ready' : 'Setup'}</p>
              <p className="mt-2 text-sm text-white/70">{isAdmin ? 'admin owned' : 'admin managed'}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="workspace-inline-nav mt-0">
        <a href="#settings-profile" className="workspace-nav-pill">
          <Users size={14} />
          Profile
        </a>
        {(isParent || isAdmin) && (
          <a href="#settings-security" className="workspace-nav-pill">
            <Lock size={14} />
            Security
          </a>
        )}
        {isAdmin && (
          <a href="#settings-ai" className="workspace-nav-pill">
            <Brain size={14} />
            AI controls
          </a>
        )}
        {(isParent || isAdmin) && (
          <a href="#settings-family" className="workspace-nav-pill">
            <LayoutGrid size={14} />
            Family profiles
          </a>
        )}
      </div>

      {successMessage && (
        <div className="workspace-alert-success">
          <div className="flex items-center gap-2">
            <Shield size={16} />
            <span>{successMessage}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-6">
          {/* Profile Settings */}
          <section className="family-panel" id="settings-profile">
            <div className="family-section-header">
              <div>
                <p className="family-kicker">My workspace</p>
                <h2 className="family-heading mt-2 text-2xl">Profile settings</h2>
                <p className="family-subtle-text mt-2">
                  Update the name and avatar that appear across the parent and admin surfaces.
                </p>
              </div>
              <span className={getRoleBadgeClass(currentProfile?.type || '')}>{currentProfile?.type || 'profile'}</span>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[0.84fr_1.16fr]">
              <div className="family-control-card-strong text-center">
                <div className="relative mx-auto w-fit">
                  <div className="rounded-full border-4 border-white shadow-lg shadow-slate-200/70">
                    <Avatar avatar={currentProfile?.avatar} size="xl" alt={currentProfile?.name || 'Avatar'} />
                  </div>
                  <label className="absolute bottom-0 right-0 inline-flex cursor-pointer items-center justify-center rounded-full bg-slate-950 p-3 text-white transition hover:bg-slate-800">
                    <Camera size={16} />
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={(e) => currentProfile && handleAvatarUpload(e, currentProfile.id)}
                      className="hidden"
                      disabled={uploadingAvatar}
                    />
                  </label>
                </div>

                <p className="mt-5 text-lg font-semibold text-slate-950">{currentProfile?.name}</p>
                <p className="mt-1 text-sm text-slate-500">{getProfileSummary(currentProfile!)}</p>

                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <span className="family-chip">
                    <Camera size={12} />
                    Photo or emoji avatar
                  </span>
                  <span className="family-chip">
                    <Shield size={12} />
                    Visible in the family hub
                  </span>
                </div>

                {uploadingAvatar ? (
                  <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                    <div className="spinner"></div>
                    Uploading avatar...
                  </div>
                ) : (
                  <p className="mt-5 text-xs text-slate-500">Use the camera button to upload a photo, or keep an emoji fallback.</p>
                )}
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div>
                  <label htmlFor="parent-name" className="mb-2 block text-sm font-medium text-slate-700">
                    Name
                  </label>
                  <input
                    id="parent-name"
                    type="text"
                    name="name"
                    defaultValue={currentProfile?.name}
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="parent-avatar" className="mb-2 block text-sm font-medium text-slate-700">
                    Emoji avatar fallback
                  </label>
                  <input
                    id="parent-avatar"
                    type="text"
                    name="avatar"
                    defaultValue={currentProfile?.avatar?.startsWith('/api/') ? '' : currentProfile?.avatar}
                    className="input"
                    placeholder="👨‍👩‍👧‍👦"
                  />
                  <p className="mt-2 text-xs text-slate-500">Used when no uploaded photo is available.</p>
                </div>

                <div className="family-control-card">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Visibility</p>
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    Your avatar and name show up in the family hub, shared overview cards, and profile selectors.
                  </p>
                </div>

                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? <div className="spinner"></div> : <Save size={18} />}
                  Save profile
                </button>
              </form>
            </div>
          </section>

          {/* Password Management - Parents and Admin */}
          {(isParent || isAdmin) && (
          <section className="family-panel" id="settings-security">
            <div className="family-section-header">
              <div>
                <p className="family-kicker">Security</p>
                <h2 className="family-heading mt-2 text-2xl">Password access</h2>
                <p className="family-subtle-text mt-2">
                  Set or rotate the password adults use for secure account access.
                </p>
              </div>
              <span className="family-badge family-badge-neutral">
                <Lock size={12} />
                Adult login
              </span>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-slate-700">
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="input"
                  placeholder="Enter new password (min 6 characters)"
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-slate-700">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="input"
                  placeholder="Re-enter new password"
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>

              <button onClick={handleSetPassword} disabled={saving} className="btn btn-primary">
                {saving ? <div className="spinner"></div> : <Save size={18} />}
                Save password
              </button>

              <div className="rounded-[20px] border border-sky-200 bg-sky-50/90 p-4 text-sm text-sky-900">
                Passwords are securely hashed and stored. Use them for adult sign-in instead of depending on a shared family PIN.
              </div>
            </div>
          </section>
          )}

          {/* Grok AI Configuration - Admin only */}
          {isAdmin && (
          <section className="family-panel" id="settings-ai">
            <div className="family-section-header">
              <div>
                <p className="family-kicker">Admin AI controls</p>
                <h2 className="family-heading mt-2 text-2xl">Platform AI configuration</h2>
                <p className="family-subtle-text mt-2">
                  Configure the service key once so quiz generation and AI features can run reliably.
                </p>
              </div>
              <span className={clsx('family-badge', hasGrokConfigured ? 'family-badge-success' : 'family-badge-warning')}>
                <Bot size={12} />
                {hasGrokConfigured ? 'Grok connected' : 'Needs setup'}
              </span>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between rounded-[20px] border border-slate-200/80 bg-slate-50/90 p-4">
                <span className="text-sm font-medium text-slate-700">API status</span>
                <span className={clsx('family-badge', hasGrokConfigured ? 'family-badge-success' : 'family-badge-warning')}>
                  {hasGrokConfigured ? 'Enabled' : 'Not configured'}
                </span>
              </div>

              <div>
                <label htmlFor="grok-api-key" className="mb-2 block text-sm font-medium text-slate-700">
                  Grok API key
                </label>
                <input
                  id="grok-api-key"
                  type="password"
                  value={grokApiKey}
                  onChange={e => setGrokApiKey(e.target.value)}
                  className="input"
                  placeholder="Enter your Grok API key"
                  autoComplete="off"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Get your API key from{' '}
                  <a
                    href="https://x.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    x.ai
                  </a>
                </p>
              </div>

              <button onClick={handleSaveGrokKey} disabled={saving} className="btn btn-primary">
                {saving ? <div className="spinner"></div> : <Save size={18} />}
                Save API key
              </button>
            </div>
          </section>
          )}

          {/* AI Parental Controls - Admin only */}
          {isAdmin && (
          <section className="family-panel">
            <div className="family-section-header">
              <div>
                <p className="family-kicker">Child guardrails</p>
                <h2 className="family-heading mt-2 text-2xl">AI behavior per child</h2>
                <p className="family-subtle-text mt-2">
                  Set strict mode, message limits, and filtering in a review-card layout instead of a cramped settings stack.
                </p>
              </div>
              <span className="family-badge family-badge-warning">
                <Brain size={12} />
                Admin only
              </span>
            </div>

            <div className="mt-6 rounded-[24px] border border-violet-200 bg-violet-50/90 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 text-violet-700" size={18} />
                <div className="text-sm text-violet-900">
                  <p className="font-semibold">Safety boundary</p>
                  <p className="mt-1 leading-6">
                    These controls decide how much freedom each child has with AI, how many messages they can use, and how tightly responses are filtered.
                  </p>
                </div>
              </div>
            </div>

            {childProfiles.length === 0 ? (
              <div className="family-empty-state mt-6">
                <Brain size={30} className="mx-auto text-slate-400" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No child profiles yet</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Add a child profile before configuring AI controls.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {childProfiles.map(profile => {
                  const aiControl = aiSettings[profile.id];
                  const isExpanded = expandedAIProfile === profile.id;

                  return (
                    <article key={profile.id} className="family-control-card-strong">
                      <button
                        onClick={() => setExpandedAIProfile(isExpanded ? null : profile.id)}
                        className="flex w-full items-center justify-between gap-4 text-left"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar avatar={profile.avatar} size="md" alt={profile.name} />
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-slate-950">{profile.name}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className={clsx('family-badge', aiControl?.strict_mode ? 'family-badge-success' : 'family-badge-warning')}>
                                {aiControl?.strict_mode ? 'Strict mode on' : 'Strict mode off'}
                              </span>
                              <span className="family-chip">{aiControl?.max_messages_per_day || 20} msgs/day</span>
                            </div>
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                      </button>

                      {isExpanded && aiControl && (
                        <div className="family-list-divider mt-5 space-y-5">
                          <div className="family-control-card">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="text-sm font-semibold text-slate-950">Strict mode</p>
                                <p className="mt-1 text-sm text-slate-600">
                                  {aiControl.strict_mode
                                    ? 'Age-appropriate language, tighter filtering, and stronger educational framing.'
                                    : 'More flexible responses while still staying within a family-safe boundary.'}
                                </p>
                              </div>
                              <label className="relative inline-flex cursor-pointer items-center">
                                <input
                                  type="checkbox"
                                  checked={aiControl.strict_mode}
                                  onChange={(e) => handleUpdateAISettings(profile.id, {
                                    strict_mode: e.target.checked
                                  })}
                                  className="peer sr-only"
                                />
                                <div className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-violet-600 peer-checked:after:translate-x-full after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-['']"></div>
                              </label>
                            </div>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                              Daily message limit
                            </label>
                            <div className="flex items-center gap-4">
                              <input
                                type="range"
                                min="5"
                                max="100"
                                value={aiControl.max_messages_per_day}
                                onChange={(e) => handleUpdateAISettings(profile.id, {
                                  max_messages_per_day: parseInt(e.target.value)
                                })}
                                className="flex-1"
                              />
                              <span className="min-w-[72px] text-right text-sm font-semibold text-violet-700">
                                {aiControl.max_messages_per_day} msgs
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">Keeps usage purposeful instead of endless.</p>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                              Content filter level
                            </label>
                            <select
                              value={aiControl.content_filter_level}
                              onChange={(e) => handleUpdateAISettings(profile.id, {
                                content_filter_level: e.target.value
                              })}
                              className="input"
                            >
                              <option value="strict">Strict, recommended for kids</option>
                              <option value="moderate">Moderate</option>
                              <option value="relaxed">Relaxed, older teens only</option>
                            </select>
                            <p className="mt-2 text-xs text-slate-500">Controls how aggressively the assistant filters responses.</p>
                          </div>

                          <div className="border-t pt-4">
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                              Custom instructions
                            </label>
                            <textarea
                              value={aiControl.custom_instructions || ''}
                              onChange={(e) =>
                                setAiSettings(prev => ({
                                  ...prev,
                                  [profile.id]: {
                                    ...prev[profile.id],
                                    custom_instructions: e.target.value
                                  }
                                }))
                              }
                              onBlur={(e) => handleUpdateAISettings(profile.id, {
                                custom_instructions: e.target.value
                              })}
                              className="input min-h-[120px] font-mono text-sm"
                              placeholder="Examples: Encourage outdoor activities, support Norwegian homework, or remind about bedtime."
                            />
                            <p className="mt-2 text-xs text-slate-500">
                              Saved when the field loses focus so typing feels smoother.
                            </p>
                          </div>

                          <div className="border-t pt-4">
                            <details className="rounded-[20px] border border-slate-200/80 bg-slate-50/90 p-4">
                              <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                                View current system prompt preview
                              </summary>
                              <div className="mt-3 overflow-x-auto rounded-[18px] bg-slate-950 p-4 text-xs text-slate-100">
                                {aiControl.strict_mode ? (
                                  <pre className="whitespace-pre-wrap">
{`You are a friendly, educational AI assistant for ${profile.name} (${profile.age} years).

STRICT GUIDELINES:
- Use age-appropriate language only
- Be positive, encouraging, and educational
- Never discuss inappropriate topics
- Focus on learning and positive habits
- Encourage task completion
- Redirect inappropriate questions

Context: Tasks, Points, Goals, Diet tracking`}
                                  </pre>
                                ) : (
                                  <pre className="whitespace-pre-wrap">
{`You are a friendly AI assistant for ${profile.name} (${profile.age} years).

Keep language age-appropriate and be helpful.

Context: Tasks, Points, Level, Progress`}
                                  </pre>
                                )}
                              </div>
                            </details>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
          )}

          {/* Parent PIN - Parent and admin only */}
          {(isParent || isAdmin) && (
          <section className="family-panel">
            <div className="family-section-header">
              <div>
                <p className="family-kicker">Security</p>
                <h2 className="family-heading mt-2 text-2xl">Parent PIN protection</h2>
                <p className="family-subtle-text mt-2">
                  Protect settings and parent-only actions with a household PIN boundary.
                </p>
              </div>
              <span className={clsx('family-badge', hasParentPin ? 'family-badge-success' : 'family-badge-warning')}>
                <KeyRound size={12} />
                {hasParentPin ? 'Configured' : 'Not configured'}
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {settings.parent_pin && (
                <div>
                  <label htmlFor="current-pin" className="mb-2 block text-sm font-medium text-slate-700">
                    Current PIN
                  </label>
                  <input
                    id="current-pin"
                    type="password"
                    value={parentPin}
                    onChange={e => setParentPin(e.target.value)}
                    className="input"
                    placeholder="Enter current PIN"
                    autoComplete="current-password"
                  />
                </div>
              )}

              <div>
                <label htmlFor="new-pin" className="mb-2 block text-sm font-medium text-slate-700">
                  {settings.parent_pin ? 'New PIN' : 'Set PIN'}
                </label>
                <input
                  id="new-pin"
                  type="password"
                  value={newParentPin}
                  onChange={e => setNewParentPin(e.target.value)}
                  className="input"
                  placeholder="Enter new PIN (min 4 characters)"
                  minLength={4}
                  autoComplete="new-password"
                />
              </div>

              <div className="rounded-[20px] border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-900">
                {hasParentPin
                  ? 'Update this when the family access pattern changes or when a device becomes shared.'
                  : 'Set this now so kid-facing devices cannot open adult tools accidentally.'}
              </div>

              <button onClick={handleSetPin} disabled={saving} className="btn btn-primary">
                {saving ? <div className="spinner"></div> : <Save size={18} />}
                {settings.parent_pin ? 'Update PIN' : 'Set PIN'}
              </button>
            </div>
          </section>
          )}

          {/* Family Profiles - Parent and admin only */}
          {(isParent || isAdmin) && (
          <section className="family-panel" id="settings-family">
            <div className="family-section-header">
              <div>
                <p className="family-kicker">Household structure</p>
                <h2 className="family-heading mt-2 text-2xl">Family profiles</h2>
                <p className="family-subtle-text mt-2">
                  Review who is in the household, who is protected, and where admin actions are available.
                </p>
              </div>
              <button
                onClick={() => setShowAddProfile(true)}
                className="btn btn-secondary"
              >
                <Plus size={16} />
                Add Profile
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {profiles.map(profile => (
                <div
                  key={profile.id}
                  className="workspace-list-item flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <Avatar avatar={profile.avatar} size="lg" alt={profile.name} />
                    <div>
                      <p className="font-medium text-slate-900">{profile.name}</p>
                      <p className="text-sm text-slate-600">
                        {profile.type === 'parent' ? 'Parent' : profile.type === 'admin' ? 'Admin' : `Child${profile.age ? ` (${profile.age} years)` : ''}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {profile.pin && (
                      <span className="workspace-pill">
                        <Lock size={12} className="mr-1" />
                        Protected
                      </span>
                    )}
                    <span className={getRoleBadgeClass(profile.type)}>{profile.type}</span>

                    {/* Parent can reset their children's PINs */}
                    {isParent && profile.type === 'child' && profile.parent_id === currentProfile?.id && (
                      <button
                        onClick={() => {
                          setResetPinProfile(profile);
                          setShowResetPinModal(true);
                        }}
                        className="btn btn-secondary btn-sm"
                        title="Reset child's PIN"
                      >
                        Reset PIN
                      </button>
                    )}

                    {/* Admin can edit and delete all profiles (except themselves) */}
                    {isAdmin && profile.id !== currentProfile?.id && (
                      <>
                        <button
                          onClick={() => {
                            setEditingProfile(profile);
                            setShowEditModal(true);
                          }}
                          className="btn btn-secondary btn-sm"
                          title="Edit profile"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (window.confirm(`Are you sure you want to delete ${profile.name}? This action cannot be undone.`)) {
                              try {
                                await profilesAPI.delete(profile.id);
                                setSuccessMessage(`${profile.name} deleted successfully`);
                                await refreshProfiles();
                              } catch (error: any) {
                                toast.error(error.response?.data?.error || 'Failed to delete profile');
                              }
                            }
                          }}
                          className="btn btn-sm border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                          title="Delete profile"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
          )}

          {/* About */}
          <section className="family-panel bg-gradient-to-br from-slate-950 via-slate-900 to-teal-900 text-white">
            <p className="family-kicker !text-white/60">About Trace</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Family hub foundations</h2>
            <p className="mt-3 text-sm leading-6 text-white/80">
              Version 1.0.0. Built with React, TypeScript, and AI-assisted family workflows for tasks,
              learning, and household coordination.
            </p>
          </section>
        </div>

        <div className="space-y-6">
          <section className="family-side-panel">
            <p className="family-kicker">Workspace snapshot</p>
            <h2 className="family-heading mt-2 text-2xl">What is configured</h2>
            <p className="family-subtle-text mt-2">
              Sanity-check the household setup here before changing anything major.
            </p>

            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="family-summary-card">
                  <p className="family-summary-label">Admins</p>
                  <p className="family-stat-value !mt-2">{adminProfiles.length}</p>
                  <p className="family-summary-note">system owners</p>
                </div>
                <div className="family-summary-card">
                  <p className="family-summary-label">Teachers</p>
                  <p className="family-stat-value !mt-2">{teacherProfiles.length}</p>
                  <p className="family-summary-note">school staff</p>
                </div>
              </div>

              <div className="family-control-card">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Security baseline</p>
                <div className="mt-4 space-y-3 text-sm text-slate-700">
                  <div className="flex items-center justify-between gap-3">
                    <span>Parent PIN</span>
                    <span className={clsx('family-badge', hasParentPin ? 'family-badge-success' : 'family-badge-warning')}>
                      {hasParentPin ? 'Enabled' : 'Missing'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Protected profiles</span>
                    <span className="font-semibold text-slate-950">{protectedProfiles}</span>
                  </div>
                </div>
              </div>

              {reminderPrefs && (
                <div className="family-control-card-strong">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
                      <BellRing size={18} />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-slate-950">Reminders</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {reminderPrefs.reminder_enabled
                          ? `Current reminder time: ${reminderPrefs.morning_reminder_time || 'not set'}`
                          : 'Reminders are currently paused for this profile.'}
                        </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className={clsx('family-badge', reminderPrefs.reminder_enabled ? 'family-badge-success' : 'family-badge-neutral')}>
                      {reminderPrefs.reminder_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              )}

              {isAdmin && (
                <div className="family-control-card">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">AI platform</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    <div className="flex items-center justify-between gap-3">
                      <span>Grok service</span>
                      <span className={clsx('family-badge', hasGrokConfigured ? 'family-badge-success' : 'family-badge-warning')}>
                        {hasGrokConfigured ? 'Ready' : 'Needs setup'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Children with AI enabled</span>
                      <span className="font-semibold text-slate-950">{aiEnabledChildren.length}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
        </div>
      )}

      {/* Add Profile Modal - Parent and admin only */}
      {showAddProfile && (isParent || isAdmin) && (
        <div className="workspace-modal">
          <div className="workspace-modal-panel max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Add New Profile</h2>
              <button
                onClick={() => setShowAddProfile(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddProfile} className="space-y-4">
              <div>
                <label htmlFor="profile-type" className="block text-sm font-medium text-gray-700 mb-1">
                  Profile Type *
                </label>
                <select id="profile-type" name="profileType" required className="input">
                  <option value="child">Child</option>
                  {isAdmin && (
                    <>
                      <option value="parent">Parent</option>
                      <option value="admin">Admin</option>
                    </>
                  )}
                </select>
                {isAdmin && (
                  <p className="text-xs text-gray-500 mt-1">
                    Admin can create any profile type. Parents can only create children.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="profile-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  id="profile-name"
                  type="text"
                  name="name"
                  required
                  className="input"
                  placeholder="Enter name"
                />
              </div>

              <div>
                <label htmlFor="profile-age" className="block text-sm font-medium text-gray-700 mb-1">
                  Age
                </label>
                <input
                  id="profile-age"
                  type="number"
                  name="age"
                  min="1"
                  max="100"
                  className="input"
                  placeholder="Enter age"
                />
              </div>

              <div>
                <label htmlFor="profile-gender" className="block text-sm font-medium text-gray-700 mb-1">
                  Gender
                </label>
                <select id="profile-gender" name="gender" className="input">
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="profile-pin" className="block text-sm font-medium text-gray-700 mb-1">
                  Create PIN *
                </label>
                <input
                  id="profile-pin"
                  type="password"
                  name="pin"
                  required
                  minLength={4}
                  maxLength={8}
                  className="input"
                  placeholder="Enter 4-8 digit PIN"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  autoComplete="new-password"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This PIN will protect the profile
                </p>
              </div>

              <div>
                <label htmlFor="profile-confirm-pin" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm PIN *
                </label>
                <input
                  id="profile-confirm-pin"
                  type="password"
                  name="confirmPin"
                  required
                  minLength={4}
                  maxLength={8}
                  className="input"
                  placeholder="Re-enter PIN"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  autoComplete="new-password"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" disabled={saving} className="btn btn-primary flex-1">
                  {saving ? <div className="spinner"></div> : 'Add Profile'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddProfile(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Child PIN Modal - Parent only */}
      {showResetPinModal && resetPinProfile && (
        <div className="workspace-modal">
          <div className="workspace-modal-panel max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Reset PIN for {resetPinProfile.name}</h2>
              <button
                onClick={() => {
                  setShowResetPinModal(false);
                  setResetPinProfile(null);
                  setResetPin('');
                  setConfirmResetPin('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <Shield className="inline mr-1" size={14} />
                  You are resetting the PIN for your child. They will need this new PIN to log in.
                </p>
              </div>

              <div>
                <label htmlFor="reset-pin" className="block text-sm font-medium text-gray-700 mb-1">
                  New PIN *
                </label>
                <input
                  id="reset-pin"
                  type="password"
                  value={resetPin}
                  onChange={e => setResetPin(e.target.value)}
                  className="input"
                  placeholder="Enter new 4-8 digit PIN"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  minLength={4}
                  maxLength={8}
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label htmlFor="confirm-reset-pin" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm PIN *
                </label>
                <input
                  id="confirm-reset-pin"
                  type="password"
                  value={confirmResetPin}
                  onChange={e => setConfirmResetPin(e.target.value)}
                  className="input"
                  placeholder="Re-enter new PIN"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  minLength={4}
                  maxLength={8}
                  autoComplete="new-password"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleResetChildPin}
                  disabled={saving}
                  className="btn btn-primary flex-1"
                >
                  {saving ? <div className="spinner"></div> : 'Reset PIN'}
                </button>
                <button
                  onClick={() => {
                    setShowResetPinModal(false);
                    setResetPinProfile(null);
                    setResetPin('');
                    setConfirmResetPin('');
                  }}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal - Admin only */}
      {showEditModal && editingProfile && isAdmin && (
        <div className="workspace-modal">
          <div className="workspace-modal-panel max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Edit Profile: {editingProfile.name}</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingProfile(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleEditProfile} className="space-y-4">
              <div>
                <label htmlFor="edit-profile-type" className="block text-sm font-medium text-gray-700 mb-1">
                  Profile Type *
                </label>
                <select
                  id="edit-profile-type"
                  name="profileType"
                  defaultValue={editingProfile.type}
                  required
                  className="input"
                >
                  <option value="child">Child</option>
                  <option value="parent">Parent</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Change profile type (use with caution)
                </p>
              </div>

              <div>
                <label htmlFor="edit-profile-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  id="edit-profile-name"
                  type="text"
                  name="name"
                  defaultValue={editingProfile.name}
                  required
                  className="input"
                  placeholder="Enter name"
                />
              </div>

              <div>
                <label htmlFor="edit-profile-age" className="block text-sm font-medium text-gray-700 mb-1">
                  Age
                </label>
                <input
                  id="edit-profile-age"
                  type="number"
                  name="age"
                  defaultValue={editingProfile.age || ''}
                  min="1"
                  max="100"
                  className="input"
                  placeholder="Enter age"
                />
              </div>

              <div>
                <label htmlFor="edit-profile-gender" className="block text-sm font-medium text-gray-700 mb-1">
                  Gender
                </label>
                <select
                  id="edit-profile-gender"
                  name="gender"
                  defaultValue={editingProfile.gender || ''}
                  className="input"
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="edit-profile-avatar" className="block text-sm font-medium text-gray-700 mb-1">
                  Avatar (Emoji)
                </label>
                <input
                  id="edit-profile-avatar"
                  type="text"
                  name="avatar"
                  defaultValue={editingProfile.avatar || ''}
                  className="input"
                  placeholder="👤"
                />
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Change PIN (Optional)</p>
                <p className="text-xs text-gray-500 mb-3">
                  Leave blank to keep current PIN
                </p>

                <div className="space-y-3">
                  <div>
                    <label htmlFor="edit-new-pin" className="block text-sm font-medium text-gray-700 mb-1">
                      New PIN
                    </label>
                    <input
                      id="edit-new-pin"
                      type="password"
                      name="newPin"
                      minLength={4}
                      maxLength={8}
                      className="input"
                      placeholder="Enter new PIN (optional)"
                      pattern="[0-9]*"
                      inputMode="numeric"
                      autoComplete="new-password"
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-confirm-pin" className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm New PIN
                    </label>
                    <input
                      id="edit-confirm-pin"
                      type="password"
                      name="confirmNewPin"
                      minLength={4}
                      maxLength={8}
                      className="input"
                      placeholder="Re-enter new PIN"
                      pattern="[0-9]*"
                      inputMode="numeric"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" disabled={saving} className="btn btn-primary flex-1">
                  {saving ? <div className="spinner"></div> : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingProfile(null);
                  }}
                  className="btn btn-secondary flex-1"
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
