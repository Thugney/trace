import { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { settingsAPI, profilesAPI } from '../services/api';
import { Settings as SettingsIcon, Lock, Users, Shield, Save, Plus, X } from 'lucide-react';

export default function Settings() {
  const { currentProfile, isParent, profiles, refreshProfiles } = useProfile();
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [grokApiKey, setGrokApiKey] = useState('');
  const [parentPin, setParentPin] = useState('');
  const [newParentPin, setNewParentPin] = useState('');
  const [showAddProfile, setShowAddProfile] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

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

  const getAvatar = (type: string, gender: string) => {
    if (type === 'parent') {
      return gender === 'male' ? '👨' : gender === 'female' ? '👩' : '👤';
    }
    return gender === 'male' ? '👦' : gender === 'female' ? '👧' : '🧒';
  };

  if (!isParent) {
    // Kids only see limited settings
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-600 mt-1">Update your profile information</p>
        </div>

        <div className="card">
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                name="name"
                defaultValue={currentProfile?.name}
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Avatar (Emoji)
              </label>
              <input
                type="text"
                name="avatar"
                defaultValue={currentProfile?.avatar}
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

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={currentProfile?.name}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Avatar (Emoji)
                </label>
                <input
                  type="text"
                  name="avatar"
                  defaultValue={currentProfile?.avatar}
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

          {/* Grok AI Configuration */}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grok API Key
                </label>
                <input
                  type="password"
                  value={grokApiKey}
                  onChange={e => setGrokApiKey(e.target.value)}
                  className="input"
                  placeholder="Enter your Grok API key"
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

          {/* Parent PIN */}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current PIN
                  </label>
                  <input
                    type="password"
                    value={parentPin}
                    onChange={e => setParentPin(e.target.value)}
                    className="input"
                    placeholder="Enter current PIN"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {settings.parent_pin ? 'New PIN' : 'Set PIN'}
                </label>
                <input
                  type="password"
                  value={newParentPin}
                  onChange={e => setNewParentPin(e.target.value)}
                  className="input"
                  placeholder="Enter new PIN (min 4 characters)"
                  minLength={4}
                />
              </div>

              <button onClick={handleSetPin} disabled={saving} className="btn btn-primary">
                {saving ? <div className="spinner"></div> : <Save size={20} className="mr-2" />}
                {settings.parent_pin ? 'Update PIN' : 'Set PIN'}
              </button>
            </div>
          </div>

          {/* Family Profiles */}
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
                    <span className="text-3xl">{profile.avatar || '👤'}</span>
                    <div>
                      <p className="font-medium">{profile.name}</p>
                      <p className="text-sm text-gray-600">
                        {profile.type === 'parent' ? 'Parent' : `Child${profile.age ? ` (${profile.age} years)` : ''}`}
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
                  </div>
                </div>
              ))}
            </div>
          </div>

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

      {/* Add Profile Modal */}
      {showAddProfile && (
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Profile Type *
                </label>
                <select name="profileType" required className="input">
                  <option value="child">Child</option>
                  <option value="parent">Parent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  className="input"
                  placeholder="Enter name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Age
                </label>
                <input
                  type="number"
                  name="age"
                  min="1"
                  max="100"
                  className="input"
                  placeholder="Enter age"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender
                </label>
                <select name="gender" className="input">
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Create PIN *
                </label>
                <input
                  type="password"
                  name="pin"
                  required
                  minLength={4}
                  maxLength={8}
                  className="input"
                  placeholder="Enter 4-8 digit PIN"
                  pattern="[0-9]*"
                  inputMode="numeric"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This PIN will protect the profile
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm PIN *
                </label>
                <input
                  type="password"
                  name="confirmPin"
                  required
                  minLength={4}
                  maxLength={8}
                  className="input"
                  placeholder="Re-enter PIN"
                  pattern="[0-9]*"
                  inputMode="numeric"
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
    </div>
  );
}
