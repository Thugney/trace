import { useState } from 'react';
import { Camera, Save, Loader2 } from 'lucide-react';
import Avatar from '../Avatar';
import { Profile } from '../../types';
import { profilesAPI } from '../../services/api';

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
    <div className="space-y-8">
      {/* Section Header */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Profile Settings</h2>
        <p className="text-sm text-slate-500 mt-1">
          Manage your personal information and avatar
        </p>
      </div>

      {/* Avatar Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-6 bg-gradient-to-r from-primary-50 to-violet-50 rounded-2xl border border-primary-100">
        <div className="relative group">
          <div className="ring-4 ring-white shadow-lg rounded-full">
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
        <div>
          <h3 className="font-semibold text-slate-900">{profile.name}</h3>
          <p className="text-sm text-slate-500 capitalize">{profile.type} Account</p>
          <p className="text-xs text-slate-400 mt-2">
            Click the camera icon to upload a custom photo
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
              Display Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
              placeholder="Enter your name"
              required
            />
          </div>

          <div>
            <label htmlFor="avatar-emoji" className="block text-sm font-medium text-slate-700 mb-2">
              Avatar Emoji
            </label>
            <input
              id="avatar-emoji"
              type="text"
              value={avatarEmoji}
              onChange={(e) => setAvatarEmoji(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
              placeholder="e.g., or leave empty for photo"
            />
            <p className="text-xs text-slate-400 mt-1">
              Leave empty if you've uploaded a photo
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
