import { useState } from 'react';
import { X, UserPlus, Loader2, Eye, EyeOff } from 'lucide-react';
import { profilesAPI } from '../../../services/api';

interface AddProfileModalProps {
  isAdmin: boolean;
  isParent: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onRefresh: () => Promise<void>;
}

export default function AddProfileModal({
  isAdmin,
  isParent,
  onClose,
  onSuccess,
  onRefresh
}: AddProfileModalProps) {
  const [saving, setSaving] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [formData, setFormData] = useState({
    profileType: 'child',
    name: '',
    age: '',
    gender: '',
    pin: '',
    confirmPin: ''
  });

  const getAvatar = (type: string, gender: string) => {
    if (type === 'parent' || type === 'admin') {
      return gender === 'male' ? '' : gender === 'female' ? '' : '';
    }
    return gender === 'male' ? '' : gender === 'female' ? '' : '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.pin || formData.pin.length < 4) {
      alert('PIN must be at least 4 digits');
      return;
    }

    if (formData.pin !== formData.confirmPin) {
      alert('PINs do not match');
      return;
    }

    setSaving(true);
    try {
      const isAdultProfile = formData.profileType === 'parent' || formData.profileType === 'admin';

      await profilesAPI.create({
        name: formData.name,
        type: formData.profileType as any,
        age: formData.age ? parseInt(formData.age, 10) : undefined,
        gender: formData.gender as any,
        ...(isAdultProfile ? { password: formData.pin } : { pin: formData.pin }),
        avatar: getAvatar(formData.profileType, formData.gender)
      });

      const successMsg = formData.profileType === 'parent'
        ? 'Parent profile created! They can now log in and access the family.'
        : 'Profile created successfully!';

      await onRefresh();
      onSuccess(successMsg);
    } catch (error) {
      console.error('Failed to create profile:', error);
      alert('Failed to create profile');
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
            <div className="p-2 bg-primary-100 rounded-xl">
              <UserPlus className="text-primary-600" size={22} />
            </div>
            <h2 className="text-xl font-semibold text-slate-900">Add New Profile</h2>
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
              {[
                { value: 'child', label: 'Child', emoji: '' },
                ...(isParent || isAdmin ? [{ value: 'parent', label: 'Parent', emoji: '' }] : []),
                ...(isAdmin ? [{ value: 'admin', label: 'Admin', emoji: '' }] : [])
              ].map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, profileType: type.value }))}
                  className={`p-3 rounded-xl border-2 transition-all text-center ${
                    formData.profileType === type.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="text-2xl block mb-1">{type.emoji}</span>
                  <span className={`text-sm font-medium ${
                    formData.profileType === type.value
                      ? 'text-primary-700'
                      : 'text-slate-600'
                  }`}>
                    {type.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
              placeholder="Enter name"
              required
            />
          </div>

          {/* Age & Gender Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="age" className="block text-sm font-medium text-slate-700 mb-2">
                Age
              </label>
              <input
                id="age"
                type="number"
                value={formData.age}
                onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
                placeholder="Age"
                min="1"
                max="100"
              />
            </div>

            <div>
              <label htmlFor="gender" className="block text-sm font-medium text-slate-700 mb-2">
                Gender
              </label>
              <select
                id="gender"
                value={formData.gender}
                onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
              >
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* PIN/Password */}
          <div>
            <label htmlFor="pin" className="block text-sm font-medium text-slate-700 mb-2">
              {formData.profileType === 'child' ? 'PIN' : 'Password'} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="pin"
                type={showPin ? 'text' : 'password'}
                value={formData.pin}
                onChange={(e) => setFormData(prev => ({ ...prev, pin: e.target.value }))}
                className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
                placeholder={formData.profileType === 'child' ? 'Min 4 digits' : 'Min 6 characters'}
                minLength={4}
                autoComplete="new-password"
                required
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

          {/* Confirm PIN/Password */}
          <div>
            <label htmlFor="confirmPin" className="block text-sm font-medium text-slate-700 mb-2">
              Confirm {formData.profileType === 'child' ? 'PIN' : 'Password'} <span className="text-red-500">*</span>
            </label>
            <input
              id="confirmPin"
              type={showPin ? 'text' : 'password'}
              value={formData.confirmPin}
              onChange={(e) => setFormData(prev => ({ ...prev, confirmPin: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow"
              placeholder="Re-enter to confirm"
              minLength={4}
              autoComplete="new-password"
              required
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <UserPlus size={18} />
              )}
              Add Profile
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
