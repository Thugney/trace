import { useProfile } from '../context/ProfileContext';
import { User } from 'lucide-react';
import clsx from 'clsx';

export default function ProfileSelector() {
  const { profiles, setCurrentProfile } = useProfile();

  const parents = profiles.filter(p => p.type === 'parent');
  const kids = profiles.filter(p => p.type === 'child');

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Family PWA</h1>
          <p className="text-gray-600">Select your profile to continue</p>
        </div>

        {/* Parents */}
        {parents.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Parents</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {parents.map(profile => (
                <button
                  key={profile.id}
                  onClick={() => setCurrentProfile(profile)}
                  className="card hover:shadow-lg transition-shadow text-center p-8 cursor-pointer border-2 border-transparent hover:border-primary-500"
                >
                  <div className="text-6xl mb-4">{profile.avatar || '👤'}</div>
                  <h3 className="text-lg font-semibold text-gray-900">{profile.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">Parent</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Kids */}
        {kids.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Kids</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {kids.map(profile => (
                <button
                  key={profile.id}
                  onClick={() => setCurrentProfile(profile)}
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
