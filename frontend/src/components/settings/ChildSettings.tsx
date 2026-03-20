import { useState } from 'react';
import { Camera, Save, Loader2, Lock, Eye, EyeOff, Shield } from 'lucide-react';
import Avatar from '../Avatar';
import ReminderWidget from '../kids/ReminderWidget';
import { Profile } from '../../types';
import { profilesAPI, ReminderPreferences } from '../../services/api';

interface ChildSettingsProps {
  profile: Profile;
  reminderPrefs: ReminderPreferences | null;
  onSuccess: (message: string) => void;
  onRefresh: () => Promise<void>;
  onReminderToggle: () => Promise<void>;
  onReminderTimeChange: (time: string) => Promise<void>;
  savingReminders: boolean;
}

export default function ChildSettings({
  profile,
  reminderPrefs,
  onSuccess,
  onRefresh,
  onReminderToggle,
  onReminderTimeChange,
  savingReminders
}: ChildSettingsProps) {
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [name, setName] = useState(profile.name);
  const [avatarEmoji, setAvatarEmoji] = useState(
    profile.avatar?.startsWith('/api/') ? '' : profile.avatar || ''
  );
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File is too large. Maximum size is 5MB.');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      alert('Invalid file type. Please upload JPEG, PNG, GIF, or WebP.');
      return;
    }

    setUploadingAvatar(true);
    try {
      await profilesAPI.uploadAvatar(profile.id, file);
      onSuccess('Avatar uploaded successfully!');
      await onRefresh();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Failed to upload avatar.';
      alert(`Upload failed: ${errorMsg}`);
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await profilesAPI.update(profile.id, {
        name,
        avatar: avatarEmoji || undefined
      });
      onSuccess('Profile updated!');
      await onRefresh();
    } catch (error) {
      alert('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePinChange = async () => {
    if (!newPin || newPin.length < 4) {
      alert('PIN must be at least 4 digits');
      return;
    }

    if (newPin !== confirmPin) {
      alert('PINs do not match');
      return;
    }

    setSaving(true);
    try {
      await profilesAPI.update(profile.id, { pin: newPin });
      onSuccess('PIN updated successfully!');
      setNewPin('');
      setConfirmPin('');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to change PIN');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-violet-50 pb-8">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <span className="text-3xl"></span>
            My Profile
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Update your info and settings
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        {/* Reminder Card */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-cyan-200 overflow-hidden">
          <div className="bg-gradient-to-r from-cyan-100 to-blue-100 p-4 text-center">
            <span className="text-4xl animate-bounce inline-block"></span>
            <h2 className="text-lg font-bold text-cyan-800 mt-2">My Notifications</h2>
            <p className="text-xs text-cyan-600">Set up real push notifications for your tasks.</p>
          </div>
          <div className="p-4">
            {reminderPrefs ? (
              <ReminderWidget
                enabled={reminderPrefs.reminder_enabled}
                time={reminderPrefs.morning_reminder_time}
                onToggle={onReminderToggle}
                onTimeChange={onReminderTimeChange}
                saving={savingReminders}
              />
            ) : (
              <div className="flex justify-center py-4">
                <Loader2 className="animate-spin text-cyan-500" size={24} />
              </div>
            )}
          </div>
        </div>

        {/* Avatar & Profile Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative group">
              <div className="ring-4 ring-primary-100 rounded-full">
                <Avatar avatar={profile.avatar} size="xl" alt={profile.name} />
              </div>
              <label className="absolute bottom-0 right-0 p-2.5 bg-primary-600 text-white rounded-full cursor-pointer shadow-lg hover:bg-primary-700 transition-all hover:scale-110">
                {uploadingAvatar ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Camera size={18} />
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  disabled={uploadingAvatar}
                />
              </label>
            </div>
            <p className="text-xs text-slate-400 mt-3">Tap the camera to upload a photo</p>
          </div>

          {/* Profile Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="child-name" className="block text-sm font-medium text-slate-700 mb-2">
                My Name
              </label>
              <input
                id="child-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>

            <div>
              <label htmlFor="child-avatar" className="block text-sm font-medium text-slate-700 mb-2">
                Avatar Emoji
              </label>
              <input
                id="child-avatar"
                type="text"
                value={avatarEmoji}
                onChange={(e) => setAvatarEmoji(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Leave empty if using photo"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Save Changes
            </button>
          </form>
        </div>

        {/* PIN Change Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-orange-100 rounded-xl">
              <Lock className="text-orange-600" size={22} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Change My PIN</h3>
              <p className="text-xs text-slate-500">Remember to keep it secret!</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="child-new-pin" className="block text-sm font-medium text-slate-700 mb-2">
                New PIN
              </label>
              <div className="relative">
                <input
                  id="child-new-pin"
                  type={showPin ? 'text' : 'password'}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Enter new PIN (4+ digits)"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  minLength={4}
                  maxLength={8}
                  autoComplete="new-password"
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

            <div>
              <label htmlFor="child-confirm-pin" className="block text-sm font-medium text-slate-700 mb-2">
                Confirm New PIN
              </label>
              <input
                id="child-confirm-pin"
                type={showPin ? 'text' : 'password'}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Re-enter new PIN"
                pattern="[0-9]*"
                inputMode="numeric"
                minLength={4}
                maxLength={8}
                autoComplete="new-password"
              />
            </div>

            <button
              onClick={handlePinChange}
              disabled={saving || !newPin || !confirmPin}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 text-white font-medium rounded-xl hover:bg-orange-700 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
              Change PIN
            </button>
          </div>
        </div>

        {/* Info Note */}
        <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
          <div className="flex items-start gap-3">
            <Shield className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> Some settings can only be changed by your parents.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
