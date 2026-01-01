import { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { User, Lock, LogOut } from 'lucide-react';
import { profilesAPI } from '../services/api';
import { Profile } from '../types';
import Onboarding from './Onboarding';
import clsx from 'clsx';

interface ProfileSelectorProps {
  parentProfile?: any;
}

export default function ProfileSelector({ parentProfile }: ProfileSelectorProps) {
  const { profiles, setCurrentProfile, refreshProfiles } = useProfile();
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(profiles.length === 0);

  // Update showOnboarding when profiles change
  useEffect(() => {
    setShowOnboarding(profiles.length === 0);
  }, [profiles]);

  // SECURITY: Only parents should see this screen
  // Kids, teachers, and admin go directly to their dashboard (handled in App.tsx)
  if (parentProfile && parentProfile.type !== 'parent' && parentProfile.type !== 'admin') {
    console.error('Security: Non-parent user should not see ProfileSelector');
    setCurrentProfile(parentProfile); // Set them directly
    return null;
  }

  // If admin is logged in, show ALL profiles
  // If parent is logged in, show only their profile and their kids
  const isAdmin = parentProfile?.type === 'admin';
  const loggedInParent = parentProfile && parentProfile.type === 'parent'
    ? profiles.find(p => p.id === parentProfile.id && p.type === 'parent')
    : null;

  // Admin sees all profiles, parent sees only their family
  const parents = isAdmin
    ? profiles.filter(p => p.type === 'parent' || p.type === 'admin')
    : parentProfile && loggedInParent
    ? [loggedInParent]
    : profiles.filter(p => p.type === 'parent');

  // SECURITY FIX: Parents ONLY see their own kids (filtered by parent_id)
  const kids = isAdmin
    ? profiles.filter(p => p.type === 'child')
    : loggedInParent
    ? profiles.filter(p => p.type === 'child' && p.parent_id === loggedInParent.id)
    : []; // If not admin and no logged in parent, show NO kids for security

  // Teachers should NEVER be shown in ProfileSelector (they don't need profile selection)
  const teachers = isAdmin ? profiles.filter(p => p.type === 'teacher') : [];

  const handleLogout = () => {
    localStorage.removeItem('family_auth');
    localStorage.removeItem('parent_profile');
    window.location.reload();
  };

  const handleProfileClick = (profile: Profile) => {
    // If clicking the already-authenticated parent profile, set directly (no PIN needed)
    if (parentProfile && profile.id === parentProfile.id) {
      setCurrentProfile(profile);
      return;
    }

    // If profile has no PIN, allow direct access (backward compatibility)
    if (!profile.pin) {
      setCurrentProfile(profile);
      return;
    }

    // Show PIN prompt for children
    setSelectedProfile(profile);
    setPin('');
    setError('');
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile) return;

    try {
      const response = await profilesAPI.verifyPIN(selectedProfile.id, pin);

      if (response.data.verified) {
        setCurrentProfile(selectedProfile);
      } else {
        setError('Incorrect PIN. Please try again.');
        setPin('');
      }
    } catch (error) {
      console.error('PIN verification failed:', error);
      setError('Failed to verify PIN. Please try again.');
      setPin('');
    }
  };

  const handleCancelPin = () => {
    setSelectedProfile(null);
    setPin('');
    setError('');
  };

  const handleOnboardingComplete = async () => {
    await refreshProfiles();
    setShowOnboarding(false);
  };

  // Show onboarding if no profiles exist
  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  // Show PIN prompt if profile selected
  if (selectedProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-purple-50 flex items-center justify-center p-4">
        <div className="card max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">{selectedProfile.avatar || '👤'}</div>
            <h2 className="text-2xl font-bold text-gray-900">{selectedProfile.name}</h2>
            <p className="text-gray-600 mt-1">Enter your PIN to continue</p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PIN
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="input text-center text-2xl tracking-widest"
                placeholder="••••"
                maxLength={8}
                autoFocus
                pattern="[0-9]*"
                inputMode="numeric"
              />
              {error && (
                <p className="text-red-600 text-sm mt-2">{error}</p>
              )}
            </div>

            <div className="flex space-x-3">
              <button type="submit" className="btn btn-primary flex-1">
                <Lock size={20} className="mr-2" />
                Unlock
              </button>
              <button
                type="button"
                onClick={handleCancelPin}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <div className="flex justify-between items-center mb-4">
            <div className="flex-1"></div>
            <h1 className="text-4xl font-bold text-gray-900 flex-1">Family Learning Hub</h1>
            <div className="flex-1 flex justify-end">
              {parentProfile && (
                <button
                  onClick={handleLogout}
                  className="btn btn-secondary flex items-center"
                  title="Logout"
                >
                  <LogOut size={20} className="mr-2" />
                  Logout
                </button>
              )}
            </div>
          </div>
          <p className="text-gray-600">
            {parentProfile ? `Welcome, ${parentProfile.name}! Select a profile to continue` : 'Select your profile to continue'}
          </p>
        </div>

        {/* Parents & Admins (only show if admin) */}
        {parents.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">
              {isAdmin ? 'Parents & Admins' : 'Your Account'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {parents.map(profile => (
                <button
                  key={profile.id}
                  onClick={() => handleProfileClick(profile)}
                  className="card hover:shadow-lg transition-shadow text-center p-8 cursor-pointer border-2 border-transparent hover:border-primary-500"
                >
                  <div className="text-6xl mb-4">{profile.avatar || '👤'}</div>
                  <h3 className="text-lg font-semibold text-gray-900">{profile.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {profile.type === 'admin' ? '🛡️ Admin' : 'Parent'}
                  </p>
                  {profile.pin && (
                    <div className="flex items-center justify-center mt-2 text-xs text-gray-400">
                      <Lock size={12} className="mr-1" />
                      PIN Protected
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Teachers (only shown to admin) */}
        {isAdmin && teachers.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Teachers</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {teachers.map(profile => (
                <button
                  key={profile.id}
                  onClick={() => handleProfileClick(profile)}
                  className="card hover:shadow-lg transition-shadow text-center p-8 cursor-pointer border-2 border-transparent hover:border-primary-500"
                >
                  <div className="text-6xl mb-4">{profile.avatar || '🎓'}</div>
                  <h3 className="text-lg font-semibold text-gray-900">{profile.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">Teacher</p>
                  {profile.pin && (
                    <div className="flex items-center justify-center mt-2 text-xs text-gray-400">
                      <Lock size={12} className="mr-1" />
                      PIN Protected
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Kids - SECURITY: Only show parent's own kids */}
        {kids.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-700 mb-4">
              {isAdmin ? 'All Children' : 'Your Children'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {kids.map(profile => (
                <button
                  key={profile.id}
                  onClick={() => handleProfileClick(profile)}
                  className={clsx(
                    'card hover:shadow-lg transition-shadow text-center p-8 cursor-pointer border-2 border-transparent hover:border-primary-500',
                    profile.age && profile.age <= 5 && 'theme-kid-5',
                    profile.age && profile.age > 5 && profile.age <= 7 && 'theme-kid-7',
                    profile.age && profile.age > 7 && 'theme-kid-12'
                  )}
                >
                  <div className="text-6xl mb-4">{profile.avatar || '👤'}</div>
                  <h3 className="text-lg font-semibold text-gray-900">{profile.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {profile.age ? `${profile.age} years old` : 'Child'}
                  </p>
                  {profile.pin && (
                    <div className="flex items-center justify-center mt-2 text-xs text-gray-400">
                      <Lock size={12} className="mr-1" />
                      PIN Protected
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {profiles.length === 0 && (
          <div className="card text-center p-12">
            <User size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Profiles Found</h3>
            <p className="text-gray-600">Please set up your family profiles first.</p>
          </div>
        )}
      </div>
    </div>
  );
}
