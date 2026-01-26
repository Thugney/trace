import { useState } from 'react';
import { X, Lock, Loader2, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { Profile } from '../../../types';
import { profilesAPI } from '../../../services/api';

interface ResetPinModalProps {
  profile: Profile;
  parentId: number;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export default function ResetPinModal({
  profile,
  parentId,
  onClose,
  onSuccess
}: ResetPinModalProps) {
  const [saving, setSaving] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPin || newPin.length < 4) {
      alert('PIN must be at least 4 digits');
      return;
    }

    if (newPin !== confirmPin) {
      alert('PINs do not match');
      return;
    }

    setSaving(true);
    try {
      await profilesAPI.resetPassword(profile.id, newPin, parentId);
      onSuccess(`PIN reset successfully for ${profile.name}!`);
    } catch (error: any) {
      console.error('Failed to reset PIN:', error);
      alert(error.response?.data?.error || 'Failed to reset PIN');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl">
              <Lock className="text-amber-600" size={22} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Reset PIN</h2>
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
          {/* Warning */}
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
            <div className="flex gap-3">
              <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Important</p>
                <p className="mt-1 text-amber-700">
                  You are resetting the PIN for your child. They will need this new PIN to log in.
                </p>
              </div>
            </div>
          </div>

          {/* New PIN */}
          <div>
            <label htmlFor="reset-pin" className="block text-sm font-medium text-slate-700 mb-2">
              New PIN <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="reset-pin"
                type={showPin ? 'text' : 'password'}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow"
                placeholder="Enter 4-8 digit PIN"
                pattern="[0-9]*"
                inputMode="numeric"
                minLength={4}
                maxLength={8}
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

          {/* Confirm PIN */}
          <div>
            <label htmlFor="confirm-reset-pin" className="block text-sm font-medium text-slate-700 mb-2">
              Confirm PIN <span className="text-red-500">*</span>
            </label>
            <input
              id="confirm-reset-pin"
              type={showPin ? 'text' : 'password'}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow"
              placeholder="Re-enter PIN"
              pattern="[0-9]*"
              inputMode="numeric"
              minLength={4}
              maxLength={8}
              autoComplete="new-password"
              required
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 text-white font-medium rounded-xl hover:bg-amber-700 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Lock size={18} />
              )}
              Reset PIN
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
    </div>
  );
}
