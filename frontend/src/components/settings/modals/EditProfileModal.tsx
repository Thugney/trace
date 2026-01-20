import { useState } from 'react';
import { X, Edit2, Loader2, Eye, EyeOff } from 'lucide-react';
import { Profile } from '../../../types';
import { profilesAPI } from '../../../services/api';

interface EditProfileModalProps {
  profile: Profile;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onRefresh: () => Promise<void>;
}

export default function EditProfileModal({
  profile,
  onClose,
  onSuccess,
  onRefresh
}: EditProfileModalProps) {
  const [saving, setSaving] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [formData, setFormData] = useState({
    profileType: profile.type,
    name: profile.name,
    age: profile.age?.toString() || '',
    gender: profile.gender || '',
    avatar: profile.avatar || '',
    newPin: '',
    confirmNewPin: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate PIN if provided
    if (formData.newPin) {
      if (formData.newPin.length < 4) {
        alert('PIN must be at least 4 digits');
        return;
      }
      if (formData.newPin !== formData.confirmNewPin) {
        alert('PINs do not match');
        return;
      }
    }

    setSaving(true);
    try {
      const updateData: any = {
        name: formData.name,
        type: formData.profileType as any,
        age: formData.age ? parseInt(formData.age, 10) : undefined,
        gender: formData.gender as any,
        avatar: formData.avatar
      };

      if (formData.newPin) {
        updateData.pin = formData.newPin;
      }

      await profilesAPI.update(profile.id, updateData);
      await onRefresh();
      onSuccess(`${formData.name} updated successfully!`);
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      alert(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Edit2 className="text-blue-600" size={22} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Edit Profile</h2>
              <p className="text-sm text-slate-500">{profile.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Profile Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Profile Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'child' as const, label: 'Child', emoji: '' },
                { value: 'parent' as const, label: 'Parent', emoji: '' },
                { value: 'admin' as const, label: 'Admin', emoji: '' }
              ]).map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, profileType: type.value }))}
                  className={`p-3 rounded-xl border-2 transition-all text-center ${
                    formData.profileType === type.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="text-2xl block mb-1">{type.emoji}</span>
                  <span className={`text-sm font-medium ${
                    formData.profileType === type.value
                      ? 'text-blue-700'
                      : 'text-slate-600'
                  }`}>
                    {type.label}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-amber-600 mt-2">
              Change profile type with caution
            </p>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="edit-name" className="block text-sm font-medium text-slate-700 mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              placeholder="Enter name"
              required
            />
          </div>

          {/* Age & Gender Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-age" className="block text-sm font-medium text-slate-700 mb-2">
                Age
              </label>
              <input
                id="edit-age"
                type="number"
                value={formData.age}
                onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                placeholder="Age"
                min="1"
                max="100"
              />
            </div>

            <div>
              <label htmlFor="edit-gender" className="block text-sm font-medium text-slate-700 mb-2">
                Gender
              </label>
              <select
                id="edit-gender"
                value={formData.gender}
                onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              >
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Avatar */}
          <div>
            <label htmlFor="edit-avatar" className="block text-sm font-medium text-slate-700 mb-2">
              Avatar Emoji
            </label>
            <input
              id="edit-avatar"
              type="text"
              value={formData.avatar}
              onChange={(e) => setFormData(prev => ({ ...prev, avatar: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              placeholder=""
            />
          </div>

          {/* Change PIN Section */}
          <div className="border-t border-slate-200 pt-5">
            <p className="text-sm font-medium text-slate-700 mb-1">Change PIN</p>
            <p className="text-xs text-slate-500 mb-4">Leave blank to keep current PIN</p>

            <div className="space-y-4">
              <div>
                <label htmlFor="edit-new-pin" className="block text-sm font-medium text-slate-700 mb-2">
                  New PIN
                </label>
                <div className="relative">
                  <input
                    id="edit-new-pin"
                    type={showPin ? 'text' : 'password'}
                    value={formData.newPin}
                    onChange={(e) => setFormData(prev => ({ ...prev, newPin: e.target.value }))}
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                    placeholder="Min 4 digits (optional)"
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
                <label htmlFor="edit-confirm-pin" className="block text-sm font-medium text-slate-700 mb-2">
                  Confirm New PIN
                </label>
                <input
                  id="edit-confirm-pin"
                  type={showPin ? 'text' : 'password'}
                  value={formData.confirmNewPin}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmNewPin: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                  placeholder="Re-enter new PIN"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  minLength={4}
                  maxLength={8}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Edit2 size={18} />
              )}
              Save Changes
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-slate-700 font-medium bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
