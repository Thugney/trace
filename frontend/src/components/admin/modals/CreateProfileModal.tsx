import { useState } from 'react';
import { X, User, Loader2, Baby, Users, GraduationCap, Crown } from 'lucide-react';
import { Profile } from '../../../types';

interface CreateProfileModalProps {
  onClose: () => void;
  onSubmit: (data: Partial<Profile>) => Promise<void>;
  editingProfile?: Profile | null;
  availableParents: Profile[];
}

const profileTypes = [
  { value: 'child', label: 'Child', icon: Baby, color: 'orange' },
  { value: 'parent', label: 'Parent', icon: Users, color: 'blue' },
  { value: 'teacher', label: 'Teacher', icon: GraduationCap, color: 'emerald' },
  { value: 'admin', label: 'Admin', icon: Crown, color: 'violet' }
] as const;

export default function CreateProfileModal({
  onClose,
  onSubmit,
  editingProfile,
  availableParents
}: CreateProfileModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: editingProfile?.name || '',
    type: editingProfile?.type || 'child' as 'admin' | 'parent' | 'child' | 'teacher',
    age: editingProfile?.age?.toString() || '',
    gender: editingProfile?.gender || 'other' as 'male' | 'female' | 'other',
    avatar: editingProfile?.avatar || '',
    pin: '',
    parent_id: editingProfile?.parent_id?.toString() || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data: Partial<Profile> = {
      name: formData.name,
      type: formData.type,
      avatar: formData.avatar || undefined,
      gender: formData.gender,
    };

    if (formData.age) {
      data.age = parseInt(formData.age);
    }

    if (formData.type === 'child' && formData.parent_id) {
      data.parent_id = parseInt(formData.parent_id);
    }

    if (formData.pin) {
      data.pin = formData.pin;
    }

    setLoading(true);
    try {
      await onSubmit(data);
      onClose();
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl my-4">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <User size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold">
                  {editingProfile ? 'Edit Profile' : 'Create Profile'}
                </h2>
                <p className="text-xs text-white/80">
                  {editingProfile ? 'Update profile details' : 'Add a new family member'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Profile Type Selection - Visual Cards */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Profile Type *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {profileTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = formData.type === type.value;
                const colorClasses = {
                  orange: isSelected ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-500/20' : 'border-slate-200 hover:border-orange-300',
                  blue: isSelected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-blue-300',
                  emerald: isSelected ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-emerald-300',
                  violet: isSelected ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-500/20' : 'border-slate-200 hover:border-violet-300'
                };
                const textColors = {
                  orange: isSelected ? 'text-orange-600' : 'text-slate-500',
                  blue: isSelected ? 'text-blue-600' : 'text-slate-500',
                  emerald: isSelected ? 'text-emerald-600' : 'text-slate-500',
                  violet: isSelected ? 'text-violet-600' : 'text-slate-500'
                };
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: type.value as any })}
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

          {/* Name Input */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
              placeholder="Full name"
              required
              autoFocus
            />
          </div>

          {/* Gender Selection */}
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
                  onClick={() => setFormData({ ...formData, gender: g.value as any })}
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

          {/* Child-specific fields */}
          {formData.type === 'child' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Age
                </label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                  placeholder="Age"
                  min="1"
                  max="18"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Parent
                </label>
                <select
                  value={formData.parent_id}
                  onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                >
                  <option value="">Select parent</option>
                  {availableParents.map(parent => (
                    <option key={parent.id} value={parent.id}>
                      {parent.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Avatar and PIN row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Avatar (emoji)
              </label>
              <input
                type="text"
                value={formData.avatar}
                onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm text-center text-xl"
                placeholder=""
                maxLength={2}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                PIN {editingProfile && <span className="text-xs font-normal text-slate-400">(keep empty)</span>}
              </label>
              <input
                type="password"
                value={formData.pin}
                onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                placeholder="4-8 digits"
                maxLength={8}
                pattern="[0-9]*"
                inputMode="numeric"
                autoComplete="new-password"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-all text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-50 shadow-lg text-sm"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {editingProfile ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
