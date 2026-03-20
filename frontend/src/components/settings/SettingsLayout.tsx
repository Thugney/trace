import { ReactNode, useState } from 'react';
import {
  User,
  Shield,
  Users,
  Settings,
  Menu,
  X,
  Info,
  ExternalLink
} from 'lucide-react';
import { APP_VERSION, APP_NAME, APP_OWNER, APP_WEBSITE } from '../../version';

export type SettingsSection =
  | 'profile'
  | 'security'
  | 'family'
  | 'about';

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
  description: string;
  icon: typeof User;
  gradient: string;
  lightBg: string;
  hideForTeacher?: boolean;
}

const navItems: NavItem[] = [
  {
    id: 'profile',
    label: 'Profile',
    description: 'Name, avatar, and account identity',
    icon: User,
    gradient: 'from-blue-500 to-indigo-600',
    lightBg: 'bg-blue-50'
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Password, PIN, and protected access',
    icon: Shield,
    gradient: 'from-orange-500 to-red-500',
    lightBg: 'bg-orange-50'
  },
  {
    id: 'family',
    label: 'Family',
    description: 'Profiles, guardians, and family setup',
    icon: Users,
    gradient: 'from-pink-500 to-rose-500',
    lightBg: 'bg-pink-50',
    hideForTeacher: true
  },
  {
    id: 'about',
    label: 'About',
    description: 'Owner, purpose, website, and version',
    icon: Info,
    gradient: 'from-sky-500 to-cyan-600',
    lightBg: 'bg-sky-50'
  }
];

export default function SettingsLayout({
  activeSection,
  onSectionChange,
  children,
  isTeacher = false
}: SettingsLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const filteredItems = navItems.filter((item) => !isTeacher || !item.hideForTeacher);
  const activeItem = filteredItems.find((item) => item.id === activeSection);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-white">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-gradient-to-br from-primary-200/30 to-violet-200/30 blur-3xl" />
        <div className="absolute top-1/2 -left-40 h-80 w-80 rounded-full bg-gradient-to-br from-blue-200/30 to-cyan-200/30 blur-3xl" />
      </div>

      <header className="relative sticky top-0 z-30 border-b border-slate-200/50 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 p-2.5 shadow-lg shadow-primary-500/30">
              <Settings className="text-white" size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Settings</h1>
              <p className="hidden text-xs text-slate-500 sm:block">
                Manage your account, family, and app details
              </p>
            </div>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-xl bg-slate-100 p-2.5 transition-colors hover:bg-slate-200 lg:hidden"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-80 bg-white p-4 pt-20 shadow-2xl animate-slide-in-right">
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
                    className={`w-full rounded-2xl p-4 text-left transition-all ${
                      isActive
                        ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg`
                        : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-white/15 p-2">
                        <Icon size={18} />
                      </div>
                      <div>
                        <div className="font-semibold">{item.label}</div>
                        <div className={`mt-1 text-xs leading-5 ${isActive ? 'text-white/80' : 'text-slate-500'}`}>
                          {item.description}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      <div className="sticky top-16 z-20 border-b border-slate-200/50 bg-white/80 backdrop-blur-lg lg:hidden">
        <div className="flex gap-2 overflow-x-auto px-3 py-3 scrollbar-hide">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-all ${
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

      <div className="relative mx-auto max-w-6xl px-4 py-6">
        <div className="flex gap-8">
          <aside className="hidden w-72 flex-shrink-0 lg:block">
            <div className="sticky top-24">
              <nav className="overflow-hidden rounded-3xl border border-white/60 bg-white/85 shadow-xl shadow-slate-200/50 backdrop-blur-xl">
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4">
                  <p className="text-sm font-semibold text-white/90">Settings</p>
                  <p className="mt-0.5 text-xs text-white/60">Choose a section to manage</p>
                </div>
                <div className="space-y-2 p-3">
                  {filteredItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;

                    return (
                      <button
                        key={item.id}
                        onClick={() => onSectionChange(item.id)}
                        className={`w-full rounded-2xl border p-3 text-left transition-all duration-200 ${
                          isActive
                            ? `border-transparent bg-gradient-to-r ${item.gradient} text-white shadow-lg`
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`rounded-xl p-2 ${
                            isActive ? 'bg-white/20' : item.lightBg
                          }`}>
                            <Icon size={18} className={isActive ? 'text-white' : ''} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-sm">{item.label}</div>
                            <div className={`mt-0.5 text-xs leading-5 ${
                              isActive ? 'text-white/80' : 'text-slate-500'
                            }`}>
                              {item.description}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </nav>

              <div className="mt-4 rounded-3xl border border-slate-200 bg-white/85 p-4 shadow-sm backdrop-blur-xl">
                <div className="flex items-center gap-2">
                  <Info size={16} className="text-sky-600" />
                  <p className="text-sm font-semibold text-slate-900">{APP_NAME}</p>
                </div>
                <p className="mt-2 text-xs text-slate-500">Version {APP_VERSION}</p>
                <p className="mt-1 text-xs text-slate-500">Owned and operated by {APP_OWNER}</p>
                <a
                  href={APP_WEBSITE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-sky-700 hover:text-sky-800"
                >
                  Visit eriteach.com
                  <ExternalLink size={12} />
                </a>
                <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2">
                  <p className="text-xs leading-5 text-slate-500">
                    Family Hub gives parents and children one place for routines, rewards, goals, and progress.
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <main className="min-w-0 flex-1">
            {activeItem && (
              <div className="mb-6 rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-lg shadow-slate-200/40 backdrop-blur-xl">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`rounded-2xl bg-gradient-to-r ${activeItem.gradient} p-3 text-white shadow-lg`}>
                      <activeItem.icon size={22} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Settings Section
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-slate-900">{activeItem.label}</h2>
                      <p className="mt-1 text-sm text-slate-600">{activeItem.description}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    <div className="font-medium text-slate-700">{APP_NAME}</div>
                    <div className="mt-1">Version {APP_VERSION}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/85 shadow-xl shadow-slate-200/50 backdrop-blur-xl">
              <div className="p-6 lg:p-8">
                {children}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white/80 p-4 text-center shadow-sm lg:hidden">
              <p className="text-sm font-semibold text-slate-900">{APP_NAME}</p>
              <p className="mt-1 text-xs text-slate-500">Version {APP_VERSION}</p>
              <p className="mt-1 text-xs text-slate-500">Owned by {APP_OWNER}</p>
              <a
                href={APP_WEBSITE}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-sky-700 hover:text-sky-800"
              >
                Visit eriteach.com
                <ExternalLink size={12} />
              </a>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
