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
        setError('PIN must be at least 4 digits');
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
      <div className="card max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 rounded-full mb-4">
            <Shield className="text-primary-600" size={40} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Family PWA
          </h1>
          <p className="text-gray-600">
            Enter your username and PIN to login
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="text-gray-400" size={20} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input pl-10"
                placeholder="Enter your username"
                autoFocus
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PIN
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
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || pin.length < 4}
            className="btn btn-primary w-full"
          >
            {loading ? (
              <div className="spinner mx-auto"></div>
            ) : (
              'Login'
            )}
          </button>
        </form>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>For Kids:</strong> Login with your name and PIN to access your tasks and goals.
            <br />
            <strong>For Parents:</strong> Login to manage family profiles and settings.
          </p>
        </div>
      </div>
    </div>
  );
}
