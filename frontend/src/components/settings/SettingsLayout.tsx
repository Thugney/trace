import { ReactNode } from 'react';
import {
  User,
  Shield,
  Users,
  Settings,
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
  hideForTeacher?: boolean;
}

const navItems: NavItem[] = [
  {
    id: 'profile',
    label: 'Profile',
    description: 'Name, avatar, and account identity',
    icon: User
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Password, PIN, and protected access',
    icon: Shield
  },
  {
    id: 'family',
    label: 'Family',
    description: 'Profiles, guardians, and family setup',
    icon: Users,
    hideForTeacher: true
  },
  {
    id: 'about',
    label: 'About',
    description: 'Owner, purpose, website, and version',
    icon: Info
  }
];

export default function SettingsLayout({
  activeSection,
  onSectionChange,
  children,
  isTeacher = false
}: SettingsLayoutProps) {
  const filteredItems = navItems.filter((item) => !isTeacher || !item.hideForTeacher);
  const activeItem = filteredItems.find((item) => item.id === activeSection);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <div className="rounded-xl bg-primary-600 p-2 text-white shadow-sm">
            <Settings size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">Settings</h1>
            <p className="hidden text-xs text-slate-500 sm:block">
              Manage your account, family, and app details
            </p>
          </div>
        </div>
      </header>

      {/* Mobile section tabs */}
      <div className="sticky top-16 z-20 border-b border-slate-200 bg-white lg:hidden">
        <nav className="flex gap-1 overflow-x-auto px-3 py-2 scrollbar-hide" aria-label="Settings sections">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <div className="flex gap-8">
          <aside className="hidden w-64 flex-shrink-0 lg:block">
            <div className="sticky top-24 space-y-4">
              <nav className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Settings sections">
                {filteredItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => onSectionChange(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        isActive ? 'bg-primary-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className={`flex-shrink-0 rounded-lg p-2 ${
                        isActive ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className={`text-sm font-semibold ${
                          isActive ? 'text-primary-700' : 'text-slate-800'
                        }`}>
                          {item.label}
                        </div>
                        <div className="text-xs leading-5 text-slate-500">
                          {item.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </nav>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">{APP_NAME}</p>
                <p className="mt-1 text-xs text-slate-500">Version {APP_VERSION}</p>
                <p className="mt-0.5 text-xs text-slate-500">Owned and operated by {APP_OWNER}</p>
                <a
                  href={APP_WEBSITE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700"
                >
                  Visit eriteach.com
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </aside>

          <main className="min-w-0 flex-1">
            {activeItem && (
              <div className="mb-5">
                <h2 className="text-xl font-bold text-slate-900">{activeItem.label}</h2>
                <p className="mt-1 text-sm text-slate-500">{activeItem.description}</p>
              </div>
            )}

            {children}

            <footer className="mt-8 text-center text-xs text-slate-500 lg:hidden">
              <p className="font-medium text-slate-700">{APP_NAME}</p>
              <p className="mt-0.5">Version {APP_VERSION} · Owned by {APP_OWNER}</p>
              <a
                href={APP_WEBSITE}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 font-semibold text-primary-600 hover:text-primary-700"
              >
                Visit eriteach.com
                <ExternalLink size={12} />
              </a>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
