import { useState, useEffect } from 'react';
import { Shield, Lock, Eye, EyeOff, Save, Loader2, Key, CheckCircle, AlertCircle, Users, UserPlus, ClipboardList, GraduationCap } from 'lucide-react';
import { Profile } from '../../types';
import { profilesAPI, settingsAPI } from '../../services/api';
import {
  SettingsCard,
  SettingsCardHeader,
  SettingsField,
  StatusBadge,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass
} from './SettingsPrimitives';

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
        <SettingsCard>
          <SettingsCardHeader
            icon={Lock}
            tone="amber"
            title="Account Password"
            description="Secure login for your account"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsField label="New password" htmlFor="new-password">
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`${inputClass} pr-11`}
                  placeholder="Min 6 characters"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </SettingsField>

            <SettingsField label="Confirm password" htmlFor="confirm-password">
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder="Re-enter password"
                autoComplete="new-password"
              />
            </SettingsField>
          </div>

          <div className="mt-6 flex justify-end border-t border-slate-100 pt-5">
            <button
              onClick={handleSetPassword}
              disabled={saving || !newPassword || !confirmPassword}
              className={primaryButtonClass}
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Update Password
            </button>
          </div>
        </SettingsCard>
      )}

      {/* Teacher Role Info - Only for teachers */}
      {isTeacher && (
        <SettingsCard>
          <SettingsCardHeader
            icon={GraduationCap}
            tone="emerald"
            title="Your Role"
            description="Church School Teacher"
            action={
              <StatusBadge tone="success">
                <CheckCircle size={14} />
                Active
              </StatusBadge>
            }
          />
          <div className="rounded-xl bg-emerald-50 p-4">
            <p className="text-sm leading-6 text-emerald-800">
              As a teacher, you have access to Church School features including class management,
              assignments, grading, and attendance. You can update your profile photo and password from the settings above.
            </p>
          </div>
        </SettingsCard>
      )}

      {/* Parent PIN Protection */}
      {(isParent || isAdmin) && (
        <SettingsCard>
          <SettingsCardHeader
            icon={Shield}
            tone="indigo"
            title="Parent PIN Protection"
            description="Protect settings and parent-only features"
            action={
              settings.parent_pin && (
                <StatusBadge tone="success">
                  <CheckCircle size={14} />
                  Active
                </StatusBadge>
              )
            }
          />

          <div className="grid gap-4 sm:grid-cols-2">
            {settings.parent_pin && (
              <SettingsField label="Current PIN" htmlFor="current-pin">
                <div className="relative">
                  <input
                    id="current-pin"
                    type={showPin ? 'text' : 'password'}
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value)}
                    className={`${inputClass} pr-11`}
                    placeholder="Enter current PIN"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                  >
                    {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </SettingsField>
            )}

            <div className={settings.parent_pin ? '' : 'sm:col-span-2 sm:max-w-md'}>
              <SettingsField label={settings.parent_pin ? 'New PIN' : 'Set PIN'} htmlFor="new-pin">
                <input
                  id="new-pin"
                  type={showPin ? 'text' : 'password'}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className={inputClass}
                  placeholder="Min 4 characters"
                  minLength={4}
                  autoComplete="new-password"
                />
              </SettingsField>
            </div>
          </div>

          <div className="mt-6 flex justify-end border-t border-slate-100 pt-5">
            <button
              onClick={handleSetPin}
              disabled={saving || !newPin}
              className={primaryButtonClass}
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {settings.parent_pin ? 'Update PIN' : 'Set PIN'}
            </button>
          </div>
        </SettingsCard>
      )}

      {/* Grok AI API Key - Admin Only */}
      {isAdmin && (
        <SettingsCard>
          <SettingsCardHeader
            icon={Key}
            tone="sky"
            title="Grok AI Configuration"
            description="API key for AI-powered features"
            action={
              settings.grok_api_enabled === 'true' ? (
                <StatusBadge tone="success">
                  <CheckCircle size={14} />
                  Enabled
                </StatusBadge>
              ) : (
                <StatusBadge tone="warning">
                  <AlertCircle size={14} />
                  Not Configured
                </StatusBadge>
              )
            }
          />

          <SettingsField
            label="Grok API key"
            htmlFor="grok-api-key"
            hint={
              <>
                Get your API key from{' '}
                <a
                  href="https://x.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
                >
                  x.ai
                </a>
              </>
            }
          >
            <div className="relative">
              <input
                id="grok-api-key"
                type={showGrokKey ? 'text' : 'password'}
                value={grokApiKey}
                onChange={(e) => setGrokApiKey(e.target.value)}
                className={`${inputClass} pr-11`}
                placeholder="Enter your Grok API key"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowGrokKey(!showGrokKey)}
                aria-label={showGrokKey ? 'Hide API key' : 'Show API key'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
              >
                {showGrokKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </SettingsField>

          <div className="mt-6 flex justify-end border-t border-slate-100 pt-5">
            <button
              onClick={handleSaveGrokKey}
              disabled={saving || !grokApiKey.trim()}
              className={primaryButtonClass}
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Save API Key
            </button>
          </div>
        </SettingsCard>
      )}

      {/* Parent Profile Creation Controls - Admin Only */}
      {isAdmin && (
        <SettingsCard>
          <SettingsCardHeader
            icon={UserPlus}
            tone="emerald"
            title="Parent Profile Controls"
            description="Control who can create parent accounts"
            action={
              allowParentCreation ? (
                <StatusBadge tone="success">
                  <CheckCircle size={14} />
                  Enabled
                </StatusBadge>
              ) : (
                <StatusBadge tone="danger">
                  <AlertCircle size={14} />
                  Disabled
                </StatusBadge>
              )
            }
          />

          <div className="space-y-3">
            {/* Allow Parent Creation Toggle */}
            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">Allow parent creation</p>
                <p className="mt-0.5 text-sm text-slate-500">
                  When enabled, parents can add co-parents to their family
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={allowParentCreation}
                aria-label="Allow parent creation"
                onClick={handleParentCreationToggle}
                disabled={loadingParentSettings}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:opacity-50 ${
                  allowParentCreation ? 'bg-primary-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    allowParentCreation ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Max Parents Per Family */}
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">Max parents per family</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Limit the number of parent accounts per family
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <Users size={16} className="text-slate-400" />
                  <span className="text-lg font-bold text-primary-600">{maxParentsPerFamily}</span>
                </div>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={maxParentsPerFamily}
                onChange={(e) => handleMaxParentsChange(parseInt(e.target.value))}
                disabled={loadingParentSettings}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-primary-600 disabled:opacity-50"
              />
              <div className="mt-1 flex justify-between text-xs text-slate-400">
                <span>1</span>
                <span>10</span>
              </div>
            </div>
          </div>

          {/* Audit Logs Button */}
          <button
            onClick={loadAuditLogs}
            className={`mt-4 w-full ${secondaryButtonClass}`}
          >
            <ClipboardList size={18} />
            View Parent Creation Audit Logs
          </button>

          {/* Audit Logs Panel */}
          {showAuditLogs && (
            <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-semibold text-slate-900">Audit Logs</h4>
                <button
                  onClick={() => setShowAuditLogs(false)}
                  className="text-sm font-medium text-slate-500 hover:text-slate-700"
                >
                  Close
                </button>
              </div>
              {auditLogs.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">No audit logs found</p>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log, index) => {
                    const details = log.details ? JSON.parse(log.details) : {};
                    return (
                      <div key={index} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                            log.action === 'PARENT_CREATED' || log.action === 'COPARENT_CREATED'
                              ? 'bg-primary-50 text-primary-700'
                              : 'bg-amber-50 text-amber-700'
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
        </SettingsCard>
      )}
    </div>
  );
}
