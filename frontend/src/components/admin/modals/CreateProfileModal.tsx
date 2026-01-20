import { useState } from 'react';
import { X, User, Loader2 } from 'lucide-react';
import { Profile } from '../../../types';

interface CreateProfileModalProps {
  onClose: () => void;
  onSubmit: (data: Partial<Profile>) => Promise<void>;
  editingProfile?: Profile | null;
  availableParents: Profile[];
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-5 text-white sticky top-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <User size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold">
                  {editingProfile ? 'Edit Profile' : 'Create Profile'}
                </h2>
                <p className="text-sm text-white/80">
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="Full name"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Type *
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                required
              >
                <option value="child">Child</option>
                <option value="parent">Parent</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Gender
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            {formData.type === 'child' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Age
                  </label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="Age"
                    min="1"
                    max="18"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Parent
                  </label>
                  <select
                    value={formData.parent_id}
                    onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  >
                    <option value="">Select parent (optional)</option>
                    {availableParents.map(parent => (
                      <option key={parent.id} value={parent.id}>
                        {parent.name} ({parent.type})
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Avatar (emoji)
              </label>
              <input
                type="text"
                value={formData.avatar}
                onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="e.g., :)"
                maxLength={2}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                PIN {editingProfile && '(leave empty to keep)'}
              </label>
              <input
                type="password"
                value={formData.pin}
                onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="Optional PIN"
                maxLength={8}
                pattern="[0-9]*"
                inputMode="numeric"
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-50 shadow-lg"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {editingProfile ? 'Update Profile' : 'Create Profile'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
