import { useState } from 'react';
import { Camera, Save, Loader2, Sparkles, User, AtSign } from 'lucide-react';
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
      {/* Avatar Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 p-8">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative flex flex-col sm:flex-row items-center gap-6">
          {/* Avatar with upload */}
          <div className="relative group">
            <div className="w-28 h-28 rounded-full ring-4 ring-white/30 shadow-2xl overflow-hidden bg-white/20 flex items-center justify-center">
              <Avatar avatar={profile.avatar} size="xl" alt={profile.name} />
            </div>
            <label className="absolute bottom-1 right-1 p-3 bg-white text-indigo-600 rounded-full cursor-pointer shadow-xl hover:scale-110 transition-transform">
              {uploadingAvatar ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Camera size={20} />
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

          {/* Info */}
          <div className="text-center sm:text-left">
            <h3 className="text-2xl font-bold text-white">{profile.name}</h3>
            <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
              <span className="px-3 py-1 bg-white/20 backdrop-blur rounded-full text-sm text-white/90 font-medium capitalize">
                {profile.type}
              </span>
              {profile.age && (
                <span className="px-3 py-1 bg-white/20 backdrop-blur rounded-full text-sm text-white/90 font-medium">
                  {profile.age} years
                </span>
              )}
            </div>
            <p className="text-white/70 text-sm mt-3 flex items-center justify-center sm:justify-start gap-1">
              <Sparkles size={14} />
              Click the camera to upload a custom photo
            </p>
          </div>
        </div>
      </div>

      {/* Form Section */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name Input */}
        <div className="bg-slate-50 rounded-2xl p-6">
          <label htmlFor="name" className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
            <User size={16} className="text-blue-500" />
            Display Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-4 rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-lg"
            placeholder="Enter your name"
            required
          />
        </div>

        {/* Emoji Input */}
        <div className="bg-slate-50 rounded-2xl p-6">
          <label htmlFor="avatar-emoji" className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
            <AtSign size={16} className="text-purple-500" />
            Avatar Emoji
          </label>
          <input
            id="avatar-emoji"
            type="text"
            value={avatarEmoji}
            onChange={(e) => setAvatarEmoji(e.target.value)}
            className="w-full px-4 py-4 rounded-xl border-2 border-slate-200 bg-white focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-lg"
            placeholder="e.g., 👨 👩 🧑 or leave empty for photo"
          />
          <p className="text-sm text-slate-500 mt-2">
            Leave empty if you've uploaded a custom photo
          </p>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-indigo-700 focus:ring-4 focus:ring-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
        >
          {saving ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Save size={20} />
          )}
          Save Changes
        </button>
      </form>
    </div>
  );
}
