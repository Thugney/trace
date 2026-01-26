import { useState, useEffect } from 'react';
import { Shield, Lock, Eye, EyeOff, Save, Loader2, Key, CheckCircle, AlertCircle, Users, UserPlus, ClipboardList, GraduationCap } from 'lucide-react';
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

  // Parent creation controls (admin only)
  const [allowParentCreation, setAllowParentCreation] = useState(true);
  const [maxParentsPerFamily, setMaxParentsPerFamily] = useState(4);
  const [loadingParentSettings, setLoadingParentSettings] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [showAuditLogs, setShowAuditLogs] = useState(false);

  // Load parent creation settings on mount (admin only)
  useEffect(() => {
    if (isAdmin) {
      loadParentCreationSettings();
    }
  }, [isAdmin]);

  const loadParentCreationSettings = async () => {
    try {
      const response = await settingsAPI.getParentCreationSettings();
      setAllowParentCreation(response.data.allow_parent_creation);
      setMaxParentsPerFamily(response.data.max_parents_per_family);
    } catch (error) {
      console.error('Failed to load parent creation settings:', error);
    }
  };

  const handleParentCreationToggle = async () => {
    setLoadingParentSettings(true);
    try {
      await settingsAPI.updateParentCreationSettings({
        allow_parent_creation: !allowParentCreation
      });
      setAllowParentCreation(!allowParentCreation);
      onSuccess(`Parent creation ${!allowParentCreation ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to update parent creation setting:', error);
      alert('Failed to update setting');
    } finally {
      setLoadingParentSettings(false);
    }
  };

  const handleMaxParentsChange = async (value: number) => {
    setLoadingParentSettings(true);
    try {
      await settingsAPI.updateParentCreationSettings({
        max_parents_per_family: value
      });
      setMaxParentsPerFamily(value);
      onSuccess(`Max parents per family set to ${value}`);
    } catch (error) {
      console.error('Failed to update max parents setting:', error);
      alert('Failed to update setting');
    } finally {
      setLoadingParentSettings(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const response = await settingsAPI.getParentCreationAuditLogs();
      setAuditLogs(response.data.logs || []);
      setShowAuditLogs(true);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
      alert('Failed to load audit logs');
    }
  };

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

  // Teachers need password access too
  const isTeacher = profile.type === 'teacher';

  return (
    <div className="space-y-6">
      {/* Password Management - Available for parents, admins, and teachers */}
      {(isParent || isAdmin || isTeacher) && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 p-[2px]">
          <div className="bg-white rounded-[14px] p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl shadow-lg shadow-orange-500/25">
                <Lock className="text-white" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Account Password</h3>
                <p className="text-sm text-slate-500">Secure login for your account</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="new-password" className="block text-sm font-semibold text-slate-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3.5 pr-12 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all bg-slate-50"
                    placeholder="Min 6 characters"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-semibold text-slate-700 mb-2">
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all bg-slate-50"
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button
              onClick={handleSetPassword}
              disabled={saving || !newPassword || !confirmPassword}
              className="mt-4 w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-red-600 focus:ring-4 focus:ring-orange-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/25"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Update Password
            </button>
          </div>
        </div>
      )}

      {/* Teacher Role Info - Only for teachers */}
      {isTeacher && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-[2px]">
          <div className="bg-white rounded-[14px] p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/25">
                <GraduationCap className="text-white" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">Your Role</h3>
                <p className="text-sm text-slate-500">Church School Teacher</p>
              </div>
              <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full flex items-center gap-1">
                <CheckCircle size={14} />
                Active
              </span>
            </div>
            <div className="mt-4 p-4 bg-emerald-50 rounded-xl">
              <p className="text-sm text-emerald-800">
                As a teacher, you have access to Church School features including class management,
                assignments, grading, and attendance. You can update your profile photo and password from the settings above.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Parent PIN Protection */}
      {(isParent || isAdmin) && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 p-[2px]">
          <div className="bg-white rounded-[14px] p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25">
                <Shield className="text-white" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">Parent PIN Protection</h3>
                <p className="text-sm text-slate-500">Protect settings and parent-only features</p>
              </div>
              {settings.parent_pin && (
                <span className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex items-center gap-1">
                  <CheckCircle size={14} />
                  Active
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {settings.parent_pin && (
                <div>
                  <label htmlFor="current-pin" className="block text-sm font-semibold text-slate-700 mb-2">
                    Current PIN
                  </label>
                  <div className="relative">
                    <input
                      id="current-pin"
                      type={showPin ? 'text' : 'password'}
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value)}
                      className="w-full px-4 py-3.5 pr-12 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-violet-500/20 focus:border-violet-500 transition-all bg-slate-50"
                      placeholder="Enter current PIN"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
              )}

              <div className={settings.parent_pin ? '' : 'sm:col-span-2 sm:max-w-md'}>
                <label htmlFor="new-pin" className="block text-sm font-semibold text-slate-700 mb-2">
                  {settings.parent_pin ? 'New PIN' : 'Set PIN'}
                </label>
                <input
                  id="new-pin"
                  type={showPin ? 'text' : 'password'}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-violet-500/20 focus:border-violet-500 transition-all bg-slate-50"
                  placeholder="Min 4 characters"
                  minLength={4}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button
              onClick={handleSetPin}
              disabled={saving || !newPin}
              className="mt-4 w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-600 hover:to-purple-700 focus:ring-4 focus:ring-violet-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/25"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {settings.parent_pin ? 'Update PIN' : 'Set PIN'}
            </button>
          </div>
        </div>
      )}

      {/* Grok AI API Key - Admin Only */}
      {isAdmin && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-[2px]">
          <div className="bg-white rounded-[14px] p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25">
                <Key className="text-white" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">Grok AI Configuration</h3>
                <p className="text-sm text-slate-500">API key for AI-powered features</p>
              </div>
              <span className={`px-3 py-1.5 text-xs font-semibold rounded-full flex items-center gap-1 ${
                settings.grok_api_enabled === 'true'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {settings.grok_api_enabled === 'true' ? (
                  <>
                    <CheckCircle size={14} />
                    Enabled
                  </>
                ) : (
                  <>
                    <AlertCircle size={14} />
                    Not Configured
                  </>
                )}
              </span>
            </div>

            <div>
              <label htmlFor="grok-api-key" className="block text-sm font-semibold text-slate-700 mb-2">
                Grok API Key
              </label>
              <div className="relative">
                <input
                  id="grok-api-key"
                  type={showGrokKey ? 'text' : 'password'}
                  value={grokApiKey}
                  onChange={(e) => setGrokApiKey(e.target.value)}
                  className="w-full px-4 py-3.5 pr-12 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50"
                  placeholder="Enter your Grok API key"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowGrokKey(!showGrokKey)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showGrokKey ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <p className="text-sm text-slate-500 mt-2">
                Get your API key from{' '}
                <a
                  href="https://x.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
                >
                  x.ai
                </a>
              </p>
            </div>

            <button
              onClick={handleSaveGrokKey}
              disabled={saving || !grokApiKey.trim()}
              className="mt-4 w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-indigo-700 focus:ring-4 focus:ring-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Save API Key
            </button>
          </div>
        </div>
      )}

      {/* Parent Profile Creation Controls - Admin Only */}
      {isAdmin && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-[2px]">
          <div className="bg-white rounded-[14px] p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/25">
                <UserPlus className="text-white" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">Parent Profile Controls</h3>
                <p className="text-sm text-slate-500">Control who can create parent accounts</p>
              </div>
              <span className={`px-3 py-1.5 text-xs font-semibold rounded-full flex items-center gap-1 ${
                allowParentCreation
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {allowParentCreation ? (
                  <>
                    <CheckCircle size={14} />
                    Enabled
                  </>
                ) : (
                  <>
                    <AlertCircle size={14} />
                    Disabled
                  </>
                )}
              </span>
            </div>

            {/* Allow Parent Creation Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl mb-4">
              <div>
                <p className="font-semibold text-slate-900">Allow Parent Creation</p>
                <p className="text-sm text-slate-500">
                  When enabled, parents can add co-parents to their family
                </p>
              </div>
              <button
                onClick={handleParentCreationToggle}
                disabled={loadingParentSettings}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-4 focus:ring-emerald-500/30 ${
                  allowParentCreation ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${
                    allowParentCreation ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Max Parents Per Family */}
            <div className="p-4 bg-slate-50 rounded-xl mb-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-slate-900">Max Parents Per Family</p>
                  <p className="text-sm text-slate-500">
                    Limit the number of parent accounts per family
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-slate-400" />
                  <span className="font-bold text-lg text-emerald-600">{maxParentsPerFamily}</span>
                </div>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={maxParentsPerFamily}
                onChange={(e) => handleMaxParentsChange(parseInt(e.target.value))}
                disabled={loadingParentSettings}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>1</span>
                <span>10</span>
              </div>
            </div>

            {/* Audit Logs Button */}
            <button
              onClick={loadAuditLogs}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 font-semibold rounded-xl hover:from-slate-200 hover:to-slate-300 focus:ring-4 focus:ring-slate-500/20 transition-all"
            >
              <ClipboardList size={18} />
              View Parent Creation Audit Logs
            </button>

            {/* Audit Logs Panel */}
            {showAuditLogs && (
              <div className="mt-4 bg-slate-50 rounded-xl p-4 max-h-64 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-900">Audit Logs</h4>
                  <button
                    onClick={() => setShowAuditLogs(false)}
                    className="text-slate-400 hover:text-slate-600 text-sm"
                  >
                    Close
                  </button>
                </div>
                {auditLogs.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">No audit logs found</p>
                ) : (
                  <div className="space-y-2">
                    {auditLogs.map((log, index) => {
                      const details = log.details ? JSON.parse(log.details) : {};
                      return (
                        <div key={index} className="p-3 bg-white rounded-lg border border-slate-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                              log.action === 'PARENT_CREATED' || log.action === 'COPARENT_CREATED'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {log.action.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs text-slate-400">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700">
                            {log.action === 'PARENT_CREATED' || log.action === 'COPARENT_CREATED' ? (
                              <>
                                <strong>{details.created_parent_name}</strong> created by{' '}
                                <span className="text-slate-500">{details.created_by_name || log.actor_name}</span>
                                {details.linked_children_count > 0 && (
                                  <span className="text-slate-400">
                                    {' '}({details.linked_children_count} children linked)
                                  </span>
                                )}
                              </>
                            ) : (
                              <>Settings changed by <strong>{log.actor_name}</strong></>
                            )}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
