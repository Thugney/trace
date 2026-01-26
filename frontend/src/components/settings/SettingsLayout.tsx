import { ReactNode, useState } from 'react';
import {
  User,
  Shield,
  Users,
  Settings,
  Menu,
  X,
  Info
} from 'lucide-react';
import { APP_VERSION, APP_NAME } from '../../version';

export type SettingsSection =
  | 'profile'
  | 'security'
  | 'family';

interface SettingsLayoutProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  children: ReactNode;
  isAdmin?: boolean;
  isTeacher?: boolean;
}

interface NavItem {
  id: SettingsSection;
  label: string;
  icon: typeof User;
  gradient: string;
  lightBg: string;
  hideForTeacher?: boolean;
}

const navItems: NavItem[] = [
  {
    id: 'profile',
    label: 'Profile',
    icon: User,
    gradient: 'from-blue-500 to-indigo-600',
    lightBg: 'bg-blue-50'
  },
  {
    id: 'security',
    label: 'Security',
    icon: Shield,
    gradient: 'from-orange-500 to-red-500',
    lightBg: 'bg-orange-50'
  },
  {
    id: 'family',
    label: 'Family',
    icon: Users,
    gradient: 'from-pink-500 to-rose-500',
    lightBg: 'bg-pink-50',
    hideForTeacher: true
  }
];

export default function SettingsLayout({
  activeSection,
  onSectionChange,
  children,
  isTeacher = false
}: SettingsLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Teachers only see Profile and Security, not Family
  const filteredItems = navItems.filter(item => !isTeacher || !item.hideForTeacher);
  const activeItem = filteredItems.find(item => item.id === activeSection);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-white">
      {/* Decorative Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-primary-200/30 to-violet-200/30 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-gradient-to-br from-blue-200/30 to-cyan-200/30 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative bg-white/70 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-lg shadow-primary-500/30">
                <Settings className="text-white" size={22} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">Settings</h1>
                <p className="text-xs text-slate-500 hidden sm:block">Manage your preferences</p>
              </div>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 bg-white shadow-2xl p-4 pt-20 animate-slide-in-right">
            <nav className="space-y-2">
              {filteredItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSectionChange(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${
                      isActive
                        ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg`
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="font-semibold">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Mobile Tab Bar */}
      <div className="lg:hidden sticky top-16 z-20 bg-white/80 backdrop-blur-lg border-b border-slate-200/50">
        <div className="flex overflow-x-auto px-2 py-2 gap-2 scrollbar-hide">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${
                  isActive
                    ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg shadow-slate-300/50`
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24">
              <nav className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-slate-200/50 border border-white/50 overflow-hidden">
                <div className="p-4 bg-gradient-to-r from-slate-800 to-slate-900">
                  <p className="text-white/90 text-sm font-semibold">Settings</p>
                  <p className="text-white/60 text-xs mt-0.5">Choose a section</p>
                </div>
                <div className="p-2 space-y-1">
                  {filteredItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onSectionChange(item.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                          isActive
                            ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg`
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${
                          isActive
                            ? 'bg-white/20'
                            : item.lightBg
                        }`}>
                          <Icon size={18} className={isActive ? 'text-white' : ''} />
                        </div>
                        <span className="font-medium text-sm">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </nav>

              {/* Version Info Card */}
              <div className="mt-4 p-4 bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Info size={16} className="text-white/80" />
                  <p className="text-sm font-semibold">{APP_NAME}</p>
                </div>
                <p className="text-xs text-white/60">
                  Version {APP_VERSION}
                </p>
                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-xs text-white/50">
                    Multi-family management platform
                  </p>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Section Title Card */}
            {activeItem && (
              <div className={`mb-6 p-5 rounded-2xl bg-gradient-to-r ${activeItem.gradient} text-white shadow-xl`}>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                    <activeItem.icon size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{activeItem.label}</h2>
                    <p className="text-sm text-white/80 mt-0.5">
                      {activeItem.id === 'profile' && 'Manage your personal information and avatar'}
                      {activeItem.id === 'security' && 'Password, PIN, and security settings'}
                      {activeItem.id === 'family' && 'Manage family members and profiles'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Content Card */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-slate-200/50 border border-white/50 overflow-hidden">
              <div className="p-6 lg:p-8">
                {children}
              </div>
            </div>

            {/* Mobile Version Info */}
            <div className="lg:hidden mt-6 text-center">
              <p className="text-xs text-slate-400">
                {APP_NAME} v{APP_VERSION}
              </p>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
