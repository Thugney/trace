import { useState } from 'react';
import { X, Home, Loader2 } from 'lucide-react';

interface CreateFamilyModalProps {
  onClose: () => void;
  onSubmit: (name: string, description?: string) => Promise<void>;
  editingFamily?: { name: string; description?: string } | null;
}

export default function CreateFamilyModal({
  onClose,
  onSubmit,
  editingFamily
}: CreateFamilyModalProps) {
  const [name, setName] = useState(editingFamily?.name || '');
  const [description, setDescription] = useState(editingFamily?.description || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await onSubmit(name.trim(), description.trim() || undefined);
      onClose();
    } catch (error) {
      console.error('Failed to save family:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-500 to-rose-600 p-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Home size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold">
                  {editingFamily ? 'Edit Family' : 'Create Family'}
                </h2>
                <p className="text-sm text-white/80">
                  {editingFamily ? 'Update family details' : 'Add a new family group'}
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
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Family Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
              placeholder="e.g., Smith Family"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-pink-500/20 focus:border-pink-500 transition-all"
              placeholder="Optional description"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white font-semibold rounded-xl hover:from-pink-600 hover:to-rose-700 transition-all disabled:opacity-50 shadow-lg"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {editingFamily ? 'Update Family' : 'Create Family'}
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
