import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Utensils, CheckSquare, Bot, Settings, User, LogOut } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import clsx from 'clsx';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { currentProfile, setCurrentProfile, isParent } = useProfile();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard', showForKids: true },
    { path: '/diet', icon: Utensils, label: 'Diet', showForKids: false },
    { path: '/tasks', icon: CheckSquare, label: 'Tasks', showForKids: true },
    { path: '/ai', icon: Bot, label: 'AI Assistant', showForKids: true },
    { path: '/settings', icon: Settings, label: 'Settings', showForKids: false }
  ];

  const visibleNavItems = isParent
    ? navItems
    : navItems.filter(item => item.showForKids);

  const getThemeClass = () => {
    if (!currentProfile || currentProfile.type === 'parent') return '';
    const age = currentProfile.age || 0;
    if (age <= 5) return 'theme-kid-5';
    if (age <= 7) return 'theme-kid-7';
    return 'theme-kid-12';
  };

  return (
    <div className={clsx('min-h-screen', getThemeClass())}>
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-primary-600">Family PWA</h1>
              {currentProfile && (
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-2xl">{currentProfile.avatar || '👤'}</span>
                  <span className="font-medium">{currentProfile.name}</span>
                  {currentProfile.type === 'child' && currentProfile.age && (
                    <span className="text-gray-500">({currentProfile.age} years)</span>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => setCurrentProfile(null)}
              className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"
            >
              <LogOut size={18} />
              <span>Switch Profile</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex max-w-7xl mx-auto">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-white shadow-sm min-h-[calc(100vh-4rem)] sticky top-16">
          <nav className="p-4 space-y-2">
            {visibleNavItems.map(({ path, icon: Icon, label }) => (
              <Link
                key={path}
                to={path}
                className={clsx(
                  'flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors',
                  isActive(path)
                    ? 'bg-primary-100 text-primary-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <Icon size={20} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>

          {/* Profile info for kids */}
          {!isParent && currentProfile && (
            <div className="p-4 border-t mt-4">
              <div className="bg-gradient-to-r from-primary-100 to-purple-100 rounded-lg p-4">
                <div className="text-center">
                  <div className="text-4xl mb-2">⭐</div>
                  <div className="text-sm text-gray-600">Your Level</div>
                  <div className="text-2xl font-bold text-primary-700">1</div>
                  <div className="mt-2 text-xs text-gray-500">Keep completing tasks!</div>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
