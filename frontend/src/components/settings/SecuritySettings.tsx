import { useState } from 'react';
import { Shield, Lock, Eye, EyeOff, Save, Loader2, Key } from 'lucide-react';
import { Profile } from '../../types';
import { profilesAPI, settingsAPI } from '../../services/api';

interface SecuritySettingsProps {
  profile: Profile;
  isParent: boolean;
  isAdmin: boolean;
  settings: Record<string, any>;
  onSuccess: (message: string) => void;
  onRefresh: () => Promise<void>;
  onSettingsRefresh: () => Promise<void>;
}

export default function SecuritySettings({
  profile,
  isParent,
  isAdmin,
  settings,
  onSuccess,
  onRefresh,
  onSettingsRefresh
}: SecuritySettingsProps) {
  const [saving, setSaving] = useState(false);

  // Password state
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // PIN state
  const [showPin, setShowPin] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');

  // Grok API state (admin only)
  const [grokApiKey, setGrokApiKey] = useState('');
  const [showGrokKey, setShowGrokKey] = useState(false);

  const handleSetPassword = async () => {
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
      await profilesAPI.update(profile.id, { password: newPassword });
      onSuccess('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
      await onRefresh();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to set password');
    } finally {
      setSaving(false);
    }
  };

  const handleSetPin = async () => {
    if (!newPin || newPin.length < 4) {
      alert('PIN must be at least 4 characters');
      return;
    }

    setSaving(true);
    try {
      await settingsAPI.setPIN(newPin, currentPin || undefined);
      onSuccess('Parent PIN updated successfully!');
      setCurrentPin('');
      setNewPin('');
      await onSettingsRefresh();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to set PIN');
    } finally {
      setSaving(false);
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
      onSuccess('Grok API key saved successfully!');
      setGrokApiKey('');
      await onSettingsRefresh();
    } catch (error) {
      alert('Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Security Settings</h2>
        <p className="text-sm text-slate-500 mt-1">
          Manage your account security and access credentials
        </p>
      </div>

      {/* Password Management */}
      {(isParent || isAdmin) && (
        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-orange-100 rounded-xl">
              <Lock className="text-orange-600" size={22} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Account Password</h3>
              <p className="text-sm text-slate-500">Secure password for your account</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <label htmlFor="new-password" className="block text-sm font-medium text-slate-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow bg-white"
                  placeholder="Min 6 characters"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700 mb-2">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow bg-white"
                placeholder="Re-enter password"
                autoComplete="new-password"
              />
            </div>

            <button
              onClick={handleSetPassword}
              disabled={saving || !newPassword || !confirmPassword}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white font-medium rounded-xl hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Update Password
            </button>
          </div>
        </div>
      )}

      {/* Parent PIN Protection */}
      {(isParent || isAdmin) && (
        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-violet-100 rounded-xl">
              <Shield className="text-violet-600" size={22} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Parent PIN Protection</h3>
              <p className="text-sm text-slate-500">Protect settings and parent-only features</p>
            </div>
          </div>

          <div className="space-y-4">
            {settings.parent_pin && (
              <div className="relative">
                <label htmlFor="current-pin" className="block text-sm font-medium text-slate-700 mb-2">
                  Current PIN
                </label>
                <div className="relative">
                  <input
                    id="current-pin"
                    type={showPin ? 'text' : 'password'}
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value)}
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow bg-white"
                    placeholder="Enter current PIN"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="new-pin" className="block text-sm font-medium text-slate-700 mb-2">
                {settings.parent_pin ? 'New PIN' : 'Set PIN'}
              </label>
              <input
                id="new-pin"
                type={showPin ? 'text' : 'password'}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow bg-white"
                placeholder="Min 4 characters"
                minLength={4}
                autoComplete="new-password"
              />
            </div>

            <button
              onClick={handleSetPin}
              disabled={saving || !newPin}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-700 focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {settings.parent_pin ? 'Update PIN' : 'Set PIN'}
            </button>
          </div>
        </div>
      )}

      {/* Grok AI API Key - Admin Only */}
      {isAdmin && (
        <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Key className="text-blue-600" size={22} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900">Grok AI Configuration</h3>
              <p className="text-sm text-slate-500">API key for AI features</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              settings.grok_api_enabled === 'true'
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {settings.grok_api_enabled === 'true' ? 'Enabled' : 'Not Configured'}
            </span>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <label htmlFor="grok-api-key" className="block text-sm font-medium text-slate-700 mb-2">
                Grok API Key
              </label>
              <div className="relative">
                <input
                  id="grok-api-key"
                  type={showGrokKey ? 'text' : 'password'}
                  value={grokApiKey}
                  onChange={(e) => setGrokApiKey(e.target.value)}
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow bg-white"
                  placeholder="Enter your Grok API key"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowGrokKey(!showGrokKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showGrokKey ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Get your API key from{' '}
                <a
                  href="https://x.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  x.ai
                </a>
              </p>
            </div>

            <button
              onClick={handleSaveGrokKey}
              disabled={saving || !grokApiKey.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Save API Key
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
