import { useState } from 'react';
import { X, Edit2, Loader2, Eye, EyeOff, Baby, Users, Crown, GraduationCap } from 'lucide-react';
import { Profile } from '../../../types';
import { profilesAPI } from '../../../services/api';

interface EditProfileModalProps {
  profile: Profile;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onRefresh: () => Promise<void>;
}

const profileTypes = [
  { value: 'child', label: 'Child', icon: Baby, color: 'orange' },
  { value: 'parent', label: 'Parent', icon: Users, color: 'blue' },
  { value: 'teacher', label: 'Teacher', icon: GraduationCap, color: 'emerald' },
  { value: 'admin', label: 'Admin', icon: Crown, color: 'violet' }
] as const;

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full my-4">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Edit2 className="text-blue-600" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Edit Profile</h2>
              <p className="text-xs text-slate-500">{profile.name}</p>
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
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Profile Type - Visual Cards */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Profile Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {profileTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = formData.profileType === type.value;
                const colorClasses: Record<string, string> = {
                  orange: isSelected ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-500/20' : 'border-slate-200 hover:border-orange-300',
                  blue: isSelected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-blue-300',
                  emerald: isSelected ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-emerald-300',
                  violet: isSelected ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-500/20' : 'border-slate-200 hover:border-violet-300'
                };
                const textColors: Record<string, string> = {
                  orange: isSelected ? 'text-orange-600' : 'text-slate-500',
                  blue: isSelected ? 'text-blue-600' : 'text-slate-500',
                  emerald: isSelected ? 'text-emerald-600' : 'text-slate-500',
                  violet: isSelected ? 'text-violet-600' : 'text-slate-500'
                };
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, profileType: type.value }))}
                    className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${colorClasses[type.color]}`}
                  >
                    <Icon size={22} className={textColors[type.color]} />
                    <span className={`text-sm font-medium ${isSelected ? textColors[type.color] : 'text-slate-700'}`}>
                      {type.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-amber-600 mt-2">
              Change profile type with caution
            </p>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="edit-name" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
              placeholder="Enter name"
              required
            />
          </div>

          {/* Gender Selection - Visual */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Gender
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'male', label: 'Male', emoji: '' },
                { value: 'female', label: 'Female', emoji: '' },
                { value: 'other', label: 'Other', emoji: '' }
              ].map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, gender: g.value }))}
                  className={`p-2.5 rounded-xl border-2 transition-all text-center ${
                    formData.gender === g.value
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="text-lg block">{g.emoji}</span>
                  <span className={`text-xs font-medium ${
                    formData.gender === g.value ? 'text-blue-600' : 'text-slate-600'
                  }`}>
                    {g.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Age (only for children) */}
          {formData.profileType === 'child' && (
            <div>
              <label htmlFor="edit-age" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Age
              </label>
              <input
                id="edit-age"
                type="number"
                value={formData.age}
                onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                placeholder="Enter age"
                min="1"
                max="18"
              />
            </div>
          )}

          {/* Avatar */}
          <div>
            <label htmlFor="edit-avatar" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Avatar Emoji
            </label>
            <input
              id="edit-avatar"
              type="text"
              value={formData.avatar}
              onChange={(e) => setFormData(prev => ({ ...prev, avatar: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-center text-xl"
              placeholder=""
              maxLength={2}
            />
          </div>

          {/* Change PIN Section */}
          <div className="border-t border-slate-200 pt-4">
            <p className="text-sm font-semibold text-slate-700 mb-1">Change PIN</p>
            <p className="text-xs text-slate-500 mb-3">Leave blank to keep current PIN</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-new-pin" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  New PIN
                </label>
                <div className="relative">
                  <input
                    id="edit-new-pin"
                    type={showPin ? 'text' : 'password'}
                    value={formData.newPin}
                    onChange={(e) => setFormData(prev => ({ ...prev, newPin: e.target.value }))}
                    className="w-full px-3 py-2.5 pr-10 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                    placeholder="4-8 digits"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    minLength={4}
                    maxLength={8}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="edit-confirm-pin" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Confirm PIN
                </label>
                <input
                  id="edit-confirm-pin"
                  type={showPin ? 'text' : 'password'}
                  value={formData.confirmNewPin}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmNewPin: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                  placeholder="Confirm"
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
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 text-slate-700 font-semibold bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Edit2 size={16} />
              )}
              Save Changes
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
