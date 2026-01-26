import { useState } from 'react';
import { Lock, Shield, User } from 'lucide-react';
import axios from 'axios';

// Use relative path for production (nginx proxy) or explicit URL for development
const API_URL = import.meta.env.VITE_API_URL || '';

interface LoginProps {
  onAuthenticated: (parentProfile: any) => void;
}

export default function Login({ onAuthenticated }: LoginProps) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!username.trim()) {
        setError('Please enter your username');
        setLoading(false);
        return;
      }

      if (pin.length < 4) {
        setError('Password/PIN must be at least 4 characters');
        setLoading(false);
        return;
      }

      // Call parent login endpoint
      const response = await axios.post(`${API_URL}/api/profiles/login`, {
        username: username.trim(),
        pin: pin
      });

      if (response.data.success) {
        // Store authentication
        localStorage.setItem('family_auth', 'true');
        localStorage.setItem('parent_profile', JSON.stringify(response.data.profile));

        // Store permissions and family info for PermissionsContext
        if (response.data.permissions) {
          localStorage.setItem('user_permissions', JSON.stringify(response.data.permissions));
        }
        if (response.data.family) {
          localStorage.setItem('user_family', JSON.stringify(response.data.family));
        }

        // Call onAuthenticated with parent profile
        onAuthenticated(response.data.profile);
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('Invalid username or PIN. Please check and try again.');
      } else {
        setError('Login failed. Please try again.');
      }
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 via-purple-600 to-pink-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 md:p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-primary-100 to-purple-100 rounded-full mb-4">
            <span className="text-5xl">📚</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Welcome Back!
          </h1>
          <p className="text-gray-600 text-lg">
            Sign in to continue learning
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Username */}
          <div>
            <label htmlFor="username" className="block text-base font-medium text-gray-700 mb-2">
              Your Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="text-gray-400" size={22} />
              </div>
              <input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors"
                placeholder="Enter your name"
                autoFocus
                autoComplete="username"
              />
            </div>
          </div>

          {/* Password/PIN */}
          <div>
            <label htmlFor="password" className="block text-base font-medium text-gray-700 mb-2">
              Password or PIN
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="text-gray-400" size={22} />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition-colors"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
              <span className="text-2xl">😕</span>
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          )}

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading || !username.trim() || pin.length < 4}
            className="w-full py-4 px-6 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <Shield size={22} />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-100 rounded-xl">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div className="text-sm text-blue-800">
              <p className="mb-1"><strong>Kids:</strong> Use your name and PIN</p>
              <p><strong>Parents & Teachers:</strong> Use your username and password</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
