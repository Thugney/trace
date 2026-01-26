import { useState } from 'react';
import { X, Home, Loader2, Info } from 'lucide-react';

interface CreateFamilyModalProps {
  onClose: () => void;
  onSubmit: (name: string, description?: string, familyType?: 'A' | 'B') => Promise<void>;
  editingFamily?: { name: string; description?: string; family_type?: 'A' | 'B' } | null;
}

export default function CreateFamilyModal({
  onClose,
  onSubmit,
  editingFamily
}: CreateFamilyModalProps) {
  const [name, setName] = useState(editingFamily?.name || '');
  const [description, setDescription] = useState(editingFamily?.description || '');
  const [familyType, setFamilyType] = useState<'A' | 'B'>(editingFamily?.family_type || 'A');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await onSubmit(name.trim(), description.trim() || undefined, familyType);
      onClose();
    } catch (error) {
      console.error('Failed to save family:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="min-h-full flex items-center justify-center p-2 sm:p-4">
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl my-4">
          {/* Header */}
          <div className="bg-gradient-to-r from-pink-500 to-rose-600 p-4 sm:p-5 text-white rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-white/20 rounded-lg sm:rounded-xl">
                <Home size={18} className="sm:w-[22px] sm:h-[22px]" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold">
                  {editingFamily ? 'Edit Family' : 'Create Family'}
                </h2>
                <p className="text-xs sm:text-sm text-white/80 hidden sm:block">
                  {editingFamily ? 'Update family details' : 'Add a new family group'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X size={18} className="sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-3 sm:space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1 sm:mb-2">
              Family Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm sm:text-base"
              placeholder="e.g., Smith Family"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1 sm:mb-2">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-pink-500/20 focus:border-pink-500 transition-all text-sm sm:text-base"
              placeholder="Optional description"
            />
          </div>

          {/* Family Type Selector */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1 sm:mb-2">
              Family Type *
            </label>
            <div className="space-y-2">
              <label
                className={`flex items-start gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 cursor-pointer transition-all ${
                  familyType === 'A'
                    ? 'border-pink-500 bg-pink-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="familyType"
                  value="A"
                  checked={familyType === 'A'}
                  onChange={() => setFamilyType('A')}
                  className="mt-0.5 sm:mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                    <span className="font-semibold text-slate-800 text-sm sm:text-base">Type A - Full Access</span>
                    <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">Recommended</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1">
                    Full core app access. Church school access when child enrolled.
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 cursor-pointer transition-all ${
                  familyType === 'B'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="familyType"
                  value="B"
                  checked={familyType === 'B'}
                  onChange={() => setFamilyType('B')}
                  className="mt-0.5 sm:mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-800 text-sm sm:text-base">Type B - Church School Only</div>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1">
                    Church school only. No core app features.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex items-start gap-2 mt-2 sm:mt-3 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-slate-100">
              <Info size={14} className="sm:w-4 sm:h-4 text-slate-500 mt-0.5 flex-shrink-0" />
              <p className="text-[10px] sm:text-xs text-slate-600">
                Changing family type updates permissions for all members.
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-100 text-slate-700 font-semibold rounded-lg sm:rounded-xl hover:bg-slate-200 transition-all text-sm sm:text-base"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white font-semibold rounded-lg sm:rounded-xl hover:from-pink-600 hover:to-rose-700 transition-all disabled:opacity-50 shadow-lg text-sm sm:text-base"
            >
              {loading ? <Loader2 size={16} className="sm:w-[18px] sm:h-[18px] animate-spin" /> : null}
              {editingFamily ? 'Update Family' : 'Create Family'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
