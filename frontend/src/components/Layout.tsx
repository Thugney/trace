import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, CheckSquare, Bot, StickyNote, Settings, LogOut, Users, Map, Menu, X, ChevronRight, Trophy, Gift, Calendar } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import Avatar from './Avatar';
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

  const getNavItems = () => {
    if (!currentProfile) return [];
    const { type } = currentProfile;

    if (type === 'admin') {
      return [
        { path: '/admin/dashboard', icon: Home, label: 'Dashboard' },
        { path: '/admin', icon: Users, label: 'Users' },
        { path: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
        { path: '/journey', icon: Map, label: 'Journey' },
        { path: '/settings', icon: Settings, label: 'Settings' }
      ];
    }

    if (type === 'parent') {
      return [
        { path: '/parent/dashboard', icon: Home, label: 'Dashboard' },
        { path: '/tasks', icon: CheckSquare, label: 'Tasks' },
        { path: '/calendar', icon: Calendar, label: 'Calendar' },
        { path: '/shop', icon: Gift, label: 'Shop' },
        { path: '/notes', icon: StickyNote, label: 'Notes' },
        { path: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
        { path: '/journey', icon: Map, label: 'Journey' },
        { path: '/settings', icon: Settings, label: 'Settings' }
      ];
    }

    if (type === 'child') {
      const items = [
        { path: '/child/dashboard', icon: Home, label: 'Home' },
        { path: '/tasks', icon: CheckSquare, label: 'Tasks' },
        { path: '/calendar', icon: Calendar, label: 'Calendar' },
        { path: '/shop', icon: Gift, label: 'Shop' },
        { path: '/notes', icon: StickyNote, label: 'Notes' },
        { path: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
        { path: '/journey', icon: Map, label: 'Journey' }
      ];

      if (currentProfile.ai_enabled === 1) {
        items.push({ path: '/ai', icon: Bot, label: 'AI Helper' });
      }
      items.push({ path: '/settings', icon: Settings, label: 'Settings' });
      return items;
    }

    return [];
  };

  const visibleNavItems = getNavItems();

  const handleLogout = () => {
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

  const getRoleBadge = () => {
    if (!currentProfile) return null;
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      admin: { bg: 'bg-rose-50', text: 'text-rose-600', label: 'Admin' },
      parent: { bg: 'bg-sky-50', text: 'text-sky-600', label: 'Parent' },
      child: { bg: 'bg-violet-50', text: 'text-violet-600', label: 'Child' }
    };
    const badge = badges[currentProfile.type];
    if (!badge) return null;
    return (
      <span className={`${badge.bg} ${badge.text} text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header - Clean & Minimal */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Left side */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <Menu size={22} />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">F</span>
                </div>
                <span className="hidden sm:block text-lg font-semibold text-slate-800">
                  Family Hub
                </span>
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 sm:gap-4">
              {currentProfile && (
                <div className="hidden sm:flex items-center gap-3 pr-4 border-r border-slate-100">
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-700">{currentProfile.name}</p>
                    <div className="flex items-center justify-end gap-2">
                      {getRoleBadge()}
                    </div>
                  </div>
                  <Avatar avatar={currentProfile.avatar} size="md" alt={currentProfile.name} />
                </div>
              )}

              <NotificationBell />

              <button
                onClick={handleLogout}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="Sign out"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <div
        className={clsx(
          'fixed inset-0 z-50 lg:hidden transition-all duration-300',
          mobileMenuOpen ? 'visible' : 'invisible'
        )}
      >
        <div
          className={clsx(
            'absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity duration-300',
            mobileMenuOpen ? 'opacity-100' : 'opacity-0'
          )}
          onClick={() => setMobileMenuOpen(false)}
        />

        <div
          className={clsx(
            'absolute left-0 top-0 h-full w-72 bg-white shadow-2xl transform transition-transform duration-300 ease-out',
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {/* Mobile Menu Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <Avatar avatar={currentProfile?.avatar} size="md" alt={currentProfile?.name || "User"} />
              <div>
                <p className="font-medium text-slate-800">{currentProfile?.name}</p>
                {getRoleBadge()}
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X size={20} />
            </button>
          </div>

          {/* Mobile Navigation */}
          <nav className="p-3 space-y-1">
            {visibleNavItems.map(({ path, icon: Icon, label }) => (
              <button
                key={path}
                onClick={() => handleNavClick(path)}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left group',
                  isActive(path)
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                <Icon size={20} strokeWidth={isActive(path) ? 2.5 : 2} />
                <span className={clsx('flex-1', isActive(path) && 'font-medium')}>{label}</span>
                {isActive(path) && <ChevronRight size={16} className="text-indigo-400" />}
              </button>
            ))}
          </nav>

          {/* Mobile Menu Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100">
            <button
              onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex max-w-7xl mx-auto">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-60 shrink-0">
          <div className="sticky top-16 p-4">
            <nav className="space-y-1">
              {visibleNavItems.map(({ path, icon: Icon, label }) => (
                <Link
                  key={path}
                  to={path}
                  className={clsx(
                    'flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group',
                    isActive(path)
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <Icon size={20} strokeWidth={isActive(path) ? 2.5 : 1.75} />
                  <span className={clsx('text-sm', isActive(path) && 'font-medium')}>{label}</span>
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
