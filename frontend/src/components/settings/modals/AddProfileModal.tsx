import { useState } from 'react';
import { X, UserPlus, Loader2, Eye, EyeOff, Baby, Users, Crown } from 'lucide-react';
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

  // Build profile type options based on permissions
  const profileTypeOptions = [
    { value: 'child', label: 'Child', icon: Baby, color: 'orange' },
    ...(isParent || isAdmin ? [{ value: 'parent', label: 'Parent', icon: Users, color: 'blue' }] : []),
    ...(isAdmin ? [{ value: 'admin', label: 'Admin', icon: Crown, color: 'violet' }] : [])
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full my-4">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-xl">
              <UserPlus className="text-primary-600" size={20} />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Add New Profile</h2>
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
            <div className={`grid gap-2 ${profileTypeOptions.length === 3 ? 'grid-cols-3' : profileTypeOptions.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {profileTypeOptions.map(type => {
                const Icon = type.icon;
                const isSelected = formData.profileType === type.value;
                const colorClasses: Record<string, string> = {
                  orange: isSelected ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-500/20' : 'border-slate-200 hover:border-orange-300',
                  blue: isSelected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-blue-300',
                  violet: isSelected ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-500/20' : 'border-slate-200 hover:border-violet-300'
                };
                const textColors: Record<string, string> = {
                  orange: isSelected ? 'text-orange-600' : 'text-slate-500',
                  blue: isSelected ? 'text-blue-600' : 'text-slate-500',
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
          </div>

          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
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
                      ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="text-lg block">{g.emoji}</span>
                  <span className={`text-xs font-medium ${
                    formData.gender === g.value ? 'text-primary-600' : 'text-slate-600'
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
              <label htmlFor="age" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Age
              </label>
              <input
                id="age"
                type="number"
                value={formData.age}
                onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                placeholder="Enter age"
                min="1"
                max="18"
              />
            </div>
          )}

          {/* PIN/Password */}
          <div>
            <label htmlFor="pin" className="block text-sm font-semibold text-slate-700 mb-1.5">
              {formData.profileType === 'child' ? 'PIN' : 'Password'} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="pin"
                type={showPin ? 'text' : 'password'}
                value={formData.pin}
                onChange={(e) => setFormData(prev => ({ ...prev, pin: e.target.value }))}
                className="w-full px-3 py-2.5 pr-10 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
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
                {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm PIN/Password */}
          <div>
            <label htmlFor="confirmPin" className="block text-sm font-semibold text-slate-700 mb-1.5">
              Confirm {formData.profileType === 'child' ? 'PIN' : 'Password'} <span className="text-red-500">*</span>
            </label>
            <input
              id="confirmPin"
              type={showPin ? 'text' : 'password'}
              value={formData.confirmPin}
              onChange={(e) => setFormData(prev => ({ ...prev, confirmPin: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
              placeholder="Re-enter to confirm"
              minLength={4}
              autoComplete="new-password"
              required
            />
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
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 focus:ring-4 focus:ring-primary-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <UserPlus size={16} />
              )}
              Add Profile
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
