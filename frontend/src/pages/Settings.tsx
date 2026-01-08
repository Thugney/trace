import { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { settingsAPI, profilesAPI, aiAPI, remindersAPI, ReminderPreferences } from '../services/api';
import { Settings as SettingsIcon, Lock, Users, Shield, Save, Plus, X, Brain, AlertTriangle, Camera, Bell, Clock } from 'lucide-react';
import Avatar from '../components/Avatar';

export default function Settings() {
  const { currentProfile, isParent, isAdmin, profiles, refreshProfiles } = useProfile();
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
      alert('Please enter a valid Grok API key');
      return;
    }

    setSaving(true);
    try {
      await settingsAPI.set('grok_api_key', grokApiKey);
      await settingsAPI.set('grok_api_enabled', 'true');
      alert('Grok API key saved successfully!');
      setGrokApiKey('');
      await loadSettings();
    } catch (error) {
      console.error('Failed to save API key:', error);
      alert('Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  const handleSetPin = async () => {
    if (!newParentPin || newParentPin.length < 4) {
      alert('PIN must be at least 4 characters');
      return;
    }

    setSaving(true);
    try {
      await settingsAPI.setPIN(newParentPin, parentPin || undefined);
      alert('Parent PIN updated successfully!');
      setParentPin('');
      setNewParentPin('');
      await loadSettings();
    } catch (error: any) {
      console.error('Failed to set PIN:', error);
      alert(error.response?.data?.error || 'Failed to set PIN');
    } finally {
      setSaving(false);
    }
  };

  const handleSetPassword = async () => {
    if (!currentProfile) return;

    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
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
      alert(error.response?.data?.error || 'Failed to set password');
    } finally {
      setSaving(false);
    }
  };

  const handleResetChildPin = async () => {
    if (!currentProfile || !resetPinProfile) return;

    if (!resetPin || resetPin.length < 4) {
      alert('PIN must be at least 4 digits');
      return;
    }

    if (resetPin !== confirmResetPin) {
      alert('PINs do not match');
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
      alert(error.response?.data?.error || 'Failed to reset PIN');
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

      alert('Profile updated successfully!');
      await refreshProfiles();
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile');
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
      alert('PIN must be at least 4 digits');
      return;
    }

    if (pin !== confirmPin) {
      alert('PINs do not match');
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

      alert('Profile created successfully!');
      await refreshProfiles();
      setShowAddProfile(false);
      e.currentTarget.reset();
    } catch (error) {
      console.error('Failed to create profile:', error);
      alert('Failed to create profile');
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
        alert('PIN must be at least 4 digits');
        return;
      }
      if (newPin !== confirmNewPin) {
        alert('PINs do not match');
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
      alert(error.response?.data?.error || 'Failed to update profile');
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
      alert('File is too large. Maximum size is 5MB.');
      return;
    }

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      alert('Invalid file type. Please upload JPEG, PNG, GIF, or WebP.');
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
      alert(`Upload failed: ${errorMsg}`);
    } finally {
      setUploadingAvatar(false);
      // Clear the file input
      e.target.value = '';
    }
  };

  const handleChildPinChange = async () => {
    if (!currentProfile) return;

    if (!childNewPin || childNewPin.length < 4) {
      alert('PIN must be at least 4 digits');
      return;
    }

    if (childNewPin !== childConfirmPin) {
      alert('PINs do not match');
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
      alert(error.response?.data?.error || 'Failed to change PIN');
    } finally {
      setSaving(false);
    }
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

        {/* Reminder Settings */}
        <div className="card mt-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Bell className="mr-2 text-blue-600" size={20} />
            Task Reminders
          </h2>

          <p className="text-sm text-gray-600 mb-4">
            Get daily reminders about your tasks!
          </p>

          {reminderPrefs && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-800">Morning Reminders</p>
                  <p className="text-sm text-gray-500">Get reminded about today's tasks</p>
                </div>
                <button
                  onClick={handleReminderToggle}
                  disabled={savingReminders}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    reminderPrefs.reminder_enabled ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      reminderPrefs.reminder_enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {reminderPrefs.reminder_enabled && (
                <div className="flex items-center gap-4">
                  <Clock size={20} className="text-gray-500" />
                  <label className="text-sm text-gray-700">Remind me at:</label>
                  <input
                    type="time"
                    value={reminderPrefs.morning_reminder_time}
                    onChange={(e) => handleReminderTimeChange(e.target.value)}
                    className="input w-32"
                    disabled={savingReminders}
                  />
                </div>
              )}
            </div>
          )}
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
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <SettingsIcon className="mr-3 text-primary-600" />
          Settings
        </h1>
        <p className="text-gray-600 mt-1">Manage app settings and configurations</p>
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

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Profile Settings */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Users className="mr-2" size={20} />
              Profile Settings
            </h2>

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
                    onChange={(e) => currentProfile && handleAvatarUpload(e, currentProfile.id)}
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
                <label htmlFor="parent-name" className="block text-sm font-medium text-gray-700 mb-1">
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
                <label htmlFor="parent-avatar" className="block text-sm font-medium text-gray-700 mb-1">
                  Avatar (Emoji) - or upload a photo above
                </label>
                <input
                  id="parent-avatar"
                  type="text"
                  name="avatar"
                  defaultValue={currentProfile?.avatar?.startsWith('/api/') ? '' : currentProfile?.avatar}
                  className="input"
                  placeholder="👨‍👩‍👧‍👦"
                />
              </div>

              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? <div className="spinner"></div> : <Save size={20} className="mr-2" />}
                Save Profile
              </button>
            </form>
          </div>

          {/* Password Management - Parents and Admin */}
          {(isParent || isAdmin) && (
          <div className="card">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Lock className="mr-2 text-orange-600" size={20} />
              Password Management
            </h2>

            <p className="text-sm text-gray-600 mb-4">
              Set or change your password for secure account access.
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">
                  New Password *
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
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password *
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
                {saving ? <div className="spinner"></div> : <Save size={20} className="mr-2" />}
                Set Password
              </button>

              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  <Shield className="inline mr-1" size={14} />
                  Password will be securely hashed and stored. Use it to log in instead of PIN.
                </p>
              </div>
            </div>
          </div>
          )}

          {/* Grok AI Configuration - Admin only */}
          {isAdmin && (
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Grok AI Configuration</h2>

            <div className="mb-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium">API Status:</span>
                <span
                  className={`badge ${
                    settings.grok_api_enabled === 'true' ? 'badge-success' : 'badge-warning'
                  }`}
                >
                  {settings.grok_api_enabled === 'true' ? 'Enabled' : 'Not Configured'}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="grok-api-key" className="block text-sm font-medium text-gray-700 mb-1">
                  Grok API Key
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
                <p className="text-xs text-gray-500 mt-1">
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
                {saving ? <div className="spinner"></div> : <Save size={20} className="mr-2" />}
                Save API Key
              </button>
            </div>
          </div>
          )}

          {/* AI Parental Controls - Admin only */}
          {isAdmin && (
          <div className="card">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Brain className="mr-2 text-purple-600" size={20} />
              AI Controls (Admin Only)
            </h2>

            <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-start">
                <AlertTriangle className="text-purple-600 mr-3 mt-0.5 flex-shrink-0" size={20} />
                <div className="text-sm text-purple-800">
                  <p className="font-semibold mb-1">Admin-only: Control AI behavior for each child</p>
                  <p>Set strict mode, message limits, and content filtering to ensure safe and educational AI interactions.</p>
                </div>
              </div>
            </div>

            {profiles.filter(p => p.type === 'child').length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No child profiles yet. Add a child profile to configure AI controls.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {profiles.filter(p => p.type === 'child').map(profile => {
                  const settings = aiSettings[profile.id];
                  const isExpanded = expandedAIProfile === profile.id;

                  return (
                    <div key={profile.id} className="border rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedAIProfile(isExpanded ? null : profile.id)}
                        className="w-full p-4 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3">
                          <Avatar avatar={profile.avatar} size="md" alt={profile.name} />
                          <div className="text-left">
                            <p className="font-semibold">{profile.name}</p>
                            <p className="text-xs text-gray-600">
                              {settings?.strict_mode ? '🛡️ Strict Mode ON' : '⚠️ Strict Mode OFF'} •
                              {settings?.max_messages_per_day || 20} msgs/day
                            </p>
                          </div>
                        </div>
                        <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
                      </button>

                      {isExpanded && settings && (
                        <div className="p-4 space-y-4 bg-white">
                          {/* Strict Mode Toggle */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="font-medium text-gray-900">Strict Mode</label>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={settings.strict_mode}
                                  onChange={(e) => handleUpdateAISettings(profile.id, {
                                    strict_mode: e.target.checked
                                  })}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                              </label>
                            </div>
                            <p className="text-xs text-gray-600">
                              {settings.strict_mode
                                ? '✅ Age-appropriate language, blocks inappropriate topics, educational focus'
                                : '⚠️ Less restrictive but still age-appropriate'}
                            </p>
                          </div>

                          {/* Daily Message Limit */}
                          <div>
                            <label className="font-medium text-gray-900 block mb-2">
                              Daily Message Limit
                            </label>
                            <div className="flex items-center space-x-4">
                              <input
                                type="range"
                                min="5"
                                max="100"
                                value={settings.max_messages_per_day}
                                onChange={(e) => handleUpdateAISettings(profile.id, {
                                  max_messages_per_day: parseInt(e.target.value)
                                })}
                                className="flex-1"
                              />
                              <span className="font-semibold text-purple-600 min-w-[60px]">
                                {settings.max_messages_per_day} msgs
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                              Prevents excessive AI usage
                            </p>
                          </div>

                          {/* Content Filter Level */}
                          <div>
                            <label className="font-medium text-gray-900 block mb-2">
                              Content Filter Level
                            </label>
                            <select
                              value={settings.content_filter_level}
                              onChange={(e) => handleUpdateAISettings(profile.id, {
                                content_filter_level: e.target.value
                              })}
                              className="input w-full"
                            >
                              <option value="strict">🛡️ Strict (Recommended for kids)</option>
                              <option value="moderate">⚖️ Moderate</option>
                              <option value="relaxed">🔓 Relaxed (Teens only)</option>
                            </select>
                            <p className="text-xs text-gray-600 mt-1">
                              Controls how strictly the AI filters responses
                            </p>
                          </div>

                          {/* Custom Instructions */}
                          <div className="border-t pt-4">
                            <label className="font-medium text-gray-900 block mb-2">
                              Custom Instructions (Optional)
                            </label>
                            <textarea
                              value={settings.custom_instructions || ''}
                              onChange={(e) => handleUpdateAISettings(profile.id, {
                                custom_instructions: e.target.value
                              })}
                              onBlur={(e) => handleUpdateAISettings(profile.id, {
                                custom_instructions: e.target.value
                              })}
                              className="input w-full min-h-[120px] font-mono text-sm"
                              placeholder="Add your own instructions for the AI...&#10;&#10;Examples:&#10;- Always remind about bedtime at 8pm&#10;- Encourage outdoor activities&#10;- Help with Norwegian language homework&#10;- Focus on math practice"
                            />
                            <p className="text-xs text-gray-600 mt-1">
                              💡 These instructions are added to the AI's system prompt. Be specific about behavior, tone, or focus areas.
                            </p>
                          </div>

                          {/* System Prompt Preview */}
                          <div className="border-t pt-4">
                            <details>
                              <summary className="font-medium text-gray-900 cursor-pointer hover:text-purple-600">
                                View AI System Prompt
                              </summary>
                              <div className="mt-2 p-3 bg-gray-50 rounded text-xs font-mono text-gray-700 overflow-x-auto">
                                {settings.strict_mode ? (
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}

          {/* Parent PIN - Parent and admin only */}
          {(isParent || isAdmin) && (
          <div className="card">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Lock className="mr-2" size={20} />
              Parent PIN Protection
            </h2>

            <p className="text-sm text-gray-600 mb-4">
              Set a PIN to protect settings and parent-only features.
            </p>

            <div className="space-y-4">
              {settings.parent_pin && (
                <div>
                  <label htmlFor="current-pin" className="block text-sm font-medium text-gray-700 mb-1">
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
                <label htmlFor="new-pin" className="block text-sm font-medium text-gray-700 mb-1">
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

              <button onClick={handleSetPin} disabled={saving} className="btn btn-primary">
                {saving ? <div className="spinner"></div> : <Save size={20} className="mr-2" />}
                {settings.parent_pin ? 'Update PIN' : 'Set PIN'}
              </button>
            </div>
          </div>
          )}

          {/* Family Profiles - Parent and admin only */}
          {(isParent || isAdmin) && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Family Profiles</h2>
              <button
                onClick={() => setShowAddProfile(true)}
                className="btn btn-primary btn-sm"
              >
                <Plus size={16} className="mr-1" />
                Add Profile
              </button>
            </div>

            <div className="space-y-3">
              {profiles.map(profile => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <Avatar avatar={profile.avatar} size="lg" alt={profile.name} />
                    <div>
                      <p className="font-medium">{profile.name}</p>
                      <p className="text-sm text-gray-600">
                        {profile.type === 'parent' ? 'Parent' : profile.type === 'admin' ? 'Admin' : `Child${profile.age ? ` (${profile.age} years)` : ''}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {profile.pin && (
                      <span className="text-xs text-gray-400 flex items-center">
                        <Lock size={12} className="mr-1" />
                        Protected
                      </span>
                    )}
                    <span className="badge badge-primary">{profile.type}</span>

                    {/* Parent can reset their children's PINs */}
                    {isParent && profile.type === 'child' && profile.parent_id === currentProfile?.id && (
                      <button
                        onClick={() => {
                          setResetPinProfile(profile);
                          setShowResetPinModal(true);
                        }}
                        className="btn btn-sm btn-secondary text-xs"
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
                          className="btn btn-sm btn-secondary text-xs"
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
                                alert(error.response?.data?.error || 'Failed to delete profile');
                              }
                            }
                          }}
                          className="btn btn-sm bg-red-500 hover:bg-red-600 text-white text-xs"
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
          </div>
          )}

          {/* About */}
          <div className="card bg-primary-50 border border-primary-200">
            <h2 className="text-xl font-semibold mb-2 text-primary-900">
              About Family Management PWA
            </h2>
            <p className="text-sm text-primary-800 mb-2">
              Version 1.0.0 • Powered by React, TypeScript, and Grok AI
            </p>
            <p className="text-xs text-primary-700">
              A comprehensive family management solution for diet tracking, task management, and
              AI-powered assistance.
            </p>
          </div>
        </div>
      )}

      {/* Add Profile Modal - Parent and admin only */}
      {showAddProfile && (isParent || isAdmin) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto">
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
