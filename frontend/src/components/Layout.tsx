import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Utensils, CheckSquare, Bot, StickyNote, Settings, LogOut, GraduationCap, Users, Mail, Map, Menu, X } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { NotificationBell } from './NotificationBell';
import clsx from 'clsx';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { currentProfile, setCurrentProfile } = useProfile();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  // Role-specific navigation items
  const getNavItems = () => {
    if (!currentProfile) return [];

    const { type } = currentProfile;

    if (type === 'admin') {
      return [
        { path: '/admin/dashboard', icon: Home, label: 'Dashboard' },
        { path: '/admin', icon: Users, label: 'User Management' },
        { path: '/school', icon: GraduationCap, label: 'School System' },
        { path: '/journey', icon: Map, label: 'My Journey' },
        { path: '/settings', icon: Settings, label: 'Settings' }
      ];
    }

    if (type === 'parent') {
      return [
        { path: '/parent/dashboard', icon: Home, label: 'Dashboard' },
        { path: '/diet', icon: Utensils, label: 'Family Diet' },
        { path: '/tasks', icon: CheckSquare, label: 'Tasks' },
        { path: '/school', icon: GraduationCap, label: 'School' },
        { path: '/journey', icon: Map, label: 'Family Journey' },
        { path: '/messages', icon: Mail, label: 'Messages' },
        { path: '/notes', icon: StickyNote, label: 'Notes' },
        { path: '/settings', icon: Settings, label: 'Settings' }
      ];
    }

    if (type === 'teacher') {
      return [
        { path: '/teacher/dashboard', icon: Home, label: 'Dashboard' },
        { path: '/school', icon: GraduationCap, label: 'My Classes' },
        { path: '/messages', icon: Mail, label: 'Messages' },
        { path: '/settings', icon: Settings, label: 'Settings' }
      ];
    }

    if (type === 'child') {
      const items = [
        { path: '/child/dashboard', icon: Home, label: 'Home' },
        { path: '/tasks', icon: CheckSquare, label: 'My Tasks' },
        { path: '/school', icon: GraduationCap, label: 'School' },
        { path: '/journey', icon: Map, label: 'My Journey' },
        { path: '/notes', icon: StickyNote, label: 'Notes' }
      ];

      // Add Diet if enabled for this child
      if (currentProfile.diet_enabled === 1) {
        items.push({ path: '/diet', icon: Utensils, label: 'My Diet' });
      }

      // Add AI if enabled for this child
      if (currentProfile.ai_enabled === 1) {
        items.push({ path: '/ai', icon: Bot, label: 'AI Helper' });
      }

      return items;
    }

    return [];
  };

  const visibleNavItems = getNavItems();

  const handleLogout = () => {
    // Clear all authentication
    localStorage.removeItem('family_auth');
    localStorage.removeItem('parent_profile');
    localStorage.removeItem('currentProfileId');
    setCurrentProfile(null);
    navigate('/');
    window.location.reload();
  };

  const handleNavClick = (path: string) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

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
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Hamburger Menu Button - Mobile Only */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                aria-label="Open menu"
              >
                <Menu size={24} />
              </button>

              <h1 className="text-lg sm:text-xl font-bold text-primary-600">Family Learning Hub</h1>
              {currentProfile && (
                <div className="hidden sm:flex items-center space-x-2 text-sm">
                  <span className="text-2xl">{currentProfile.avatar || '👤'}</span>
                  <span className="font-medium">{currentProfile.name}</span>
                  {currentProfile.type === 'child' && currentProfile.age && (
                    <span className="text-gray-500">({currentProfile.age} years)</span>
                  )}
                  {currentProfile.type === 'admin' && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded">
                      Admin
                    </span>
                  )}
                  {currentProfile.type === 'teacher' && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded">
                      Teacher
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Notifications & Sign Out */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <NotificationBell />
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm text-gray-600 hover:text-gray-900"
              >
                <LogOut size={16} className="sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Sign Out</span>
                <span className="sm:hidden">Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Slide-out Menu */}
      <div
        className={clsx(
          'fixed inset-0 z-50 md:hidden transition-opacity duration-300',
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* Overlay */}
        <div
          className={clsx(
            'absolute inset-0 bg-black/50 transition-opacity duration-300',
            mobileMenuOpen ? 'opacity-100' : 'opacity-0'
          )}
          onClick={() => setMobileMenuOpen(false)}
        />

        {/* Drawer */}
        <div
          className={clsx(
            'absolute left-0 top-0 h-full w-72 bg-white shadow-xl transform transition-transform duration-300 ease-out',
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary-500 to-primary-600">
            <div className="flex items-center space-x-3">
              <span className="text-3xl">{currentProfile?.avatar || '👤'}</span>
              <div className="text-white">
                <p className="font-semibold">{currentProfile?.name}</p>
                <p className="text-xs text-primary-100 capitalize">{currentProfile?.type}</p>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close menu"
            >
              <X size={24} />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-180px)]">
            {visibleNavItems.map(({ path, icon: Icon, label }) => (
              <button
                key={path}
                onClick={() => handleNavClick(path)}
                className={clsx(
                  'w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all text-left',
                  isActive(path)
                    ? 'bg-primary-100 text-primary-700 font-semibold shadow-sm'
                    : 'text-gray-700 hover:bg-gray-100 active:bg-gray-200'
                )}
              >
                <Icon size={22} className={isActive(path) ? 'text-primary-600' : 'text-gray-500'} />
                <span className="text-base">{label}</span>
                {isActive(path) && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-primary-500" />
                )}
              </button>
            ))}
          </nav>

          {/* Drawer Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-gray-50">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
            >
              <LogOut size={20} />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex max-w-7xl mx-auto">
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden md:block w-64 bg-white shadow-sm min-h-[calc(100vh-4rem)] sticky top-16">
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
          {currentProfile?.type === 'child' && (
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
        <main className="flex-1 p-3 sm:p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
