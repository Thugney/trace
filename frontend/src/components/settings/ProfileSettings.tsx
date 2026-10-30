import { useState } from 'react';
import { Camera, Save, Loader2, User } from 'lucide-react';
import Avatar from '../Avatar';
import { Profile } from '../../types';
import { profilesAPI } from '../../services/api';
import {
  SettingsCard,
  SettingsCardHeader,
  SettingsField,
  inputClass,
  primaryButtonClass
} from './SettingsPrimitives';

interface ProfileSettingsProps {
  profile: Profile;
  onSuccess: (message: string) => void;
  onRefresh: () => Promise<void>;
}

export default function ProfileSettings({
  profile,
  onSuccess,
  onRefresh
}: ProfileSettingsProps) {
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [name, setName] = useState(profile.name);
  const [avatarEmoji, setAvatarEmoji] = useState(
    profile.avatar?.startsWith('/api/') ? '' : profile.avatar || ''
  );

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
      onSuccess('Profile updated successfully!');
      await onRefresh();
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile summary */}
      <SettingsCard>
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <div className="relative flex-shrink-0">
            <div className="h-24 w-24 overflow-hidden rounded-full bg-slate-100 ring-4 ring-slate-50">
              <Avatar avatar={profile.avatar} size="xl" alt={profile.name} />
            </div>
            <label className="absolute -bottom-1 -right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-primary-600 shadow-sm transition-colors hover:bg-primary-50">
              {uploadingAvatar ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Camera size={16} />
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

          <div className="min-w-0 text-center sm:text-left">
            <h3 className="text-xl font-bold text-slate-900">{profile.name}</h3>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold capitalize text-primary-700">
                {profile.type}
              </span>
              {profile.age && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {profile.age} years
                </span>
              )}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Use the camera button to upload a custom photo (up to 5MB)
            </p>
          </div>
        </div>
      </SettingsCard>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <SettingsCard>
          <SettingsCardHeader
            icon={User}
            title="Personal details"
            description="How your name and avatar appear across Family Hub."
          />

          <div className="space-y-5">
            <SettingsField label="Display name" htmlFor="name">
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="Enter your name"
                required
              />
            </SettingsField>

            <SettingsField
              label="Avatar emoji"
              htmlFor="avatar-emoji"
              hint="Leave empty if you've uploaded a custom photo."
            >
              <input
                id="avatar-emoji"
                type="text"
                value={avatarEmoji}
                onChange={(e) => setAvatarEmoji(e.target.value)}
                className={inputClass}
                placeholder="e.g., 👨 👩 🧑 or leave empty for photo"
              />
            </SettingsField>
          </div>

          <div className="mt-6 flex justify-end border-t border-slate-100 pt-5">
            <button type="submit" disabled={saving} className={primaryButtonClass}>
              {saving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              Save Changes
            </button>
          </div>
        </SettingsCard>
      </form>
    </div>
  );
}
