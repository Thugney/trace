import { useState } from 'react';
import { Lock, Shield } from 'lucide-react';

interface LoginProps {
  onAuthenticated: () => void;
}

export default function Login({ onAuthenticated }: LoginProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Simple PIN auth - in production, verify against backend
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // For now, accept any 4+ digit PIN to proceed to profile selection
      // In production, verify against parent PIN in settings
      if (pin.length >= 4) {
        localStorage.setItem('family_auth', 'true');
        onAuthenticated();
      } else {
        setError('PIN must be at least 4 digits');
      }
    } catch (err) {
      setError('Invalid PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 via-purple-600 to-pink-500 flex items-center justify-center p-4">
      <div className="card max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 rounded-full mb-4">
            <Shield className="text-primary-600" size={40} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Family PWA
          </h1>
          <p className="text-gray-600">
            Enter PIN to access profiles
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Family PIN
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="text-gray-400" size={20} />
              </div>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="input pl-10"
                placeholder="Enter PIN"
                autoFocus
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
              />
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || pin.length < 4}
            className="btn btn-primary w-full"
          >
            {loading ? (
              <div className="spinner mx-auto"></div>
            ) : (
              'Continue'
            )}
          </button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>First time?</strong> Enter any 4+ digit PIN to set up your family profiles.
          </p>
        </div>
      </div>
    </div>
  );
}
