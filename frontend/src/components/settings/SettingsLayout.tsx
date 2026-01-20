import { ReactNode } from 'react';
import {
  User,
  Shield,
  Brain,
  Server,
  Users,
  Info,
  ChevronRight
} from 'lucide-react';

export type SettingsSection =
  | 'profile'
  | 'security'
  | 'ai-controls'
  | 'ollama'
  | 'family'
  | 'about';

interface SettingsLayoutProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  children: ReactNode;
  isAdmin: boolean;
}

interface NavItem {
  id: SettingsSection;
  label: string;
  icon: ReactNode;
  description: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  {
    id: 'profile',
    label: 'Profile',
    icon: <User size={20} />,
    description: 'Your personal information'
  },
  {
    id: 'security',
    label: 'Security',
    icon: <Shield size={20} />,
    description: 'Password and PIN settings'
  },
  {
    id: 'ai-controls',
    label: 'AI Controls',
    icon: <Brain size={20} />,
    description: 'Manage AI for children',
    adminOnly: true
  },
  {
    id: 'ollama',
    label: 'Local AI',
    icon: <Server size={20} />,
    description: 'Ollama configuration',
    adminOnly: true
  },
  {
    id: 'family',
    label: 'Family',
    icon: <Users size={20} />,
    description: 'Manage family profiles'
  },
  {
    id: 'about',
    label: 'About',
    icon: <Info size={20} />,
    description: 'App information'
  }
];

export default function SettingsLayout({
  activeSection,
  onSectionChange,
  children,
  isAdmin
}: SettingsLayoutProps) {
  const filteredItems = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage your account and app preferences
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <nav className="lg:w-72 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-2">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSectionChange(item.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 group ${
                      activeSection === item.id
                        ? 'bg-primary-50 text-primary-700'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg transition-colors ${
                        activeSection === item.id
                          ? 'bg-primary-100 text-primary-600'
                          : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                      }`}>
                        {item.icon}
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-sm">{item.label}</p>
                        <p className={`text-xs ${
                          activeSection === item.id
                            ? 'text-primary-500'
                            : 'text-slate-400'
                        }`}>
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <ChevronRight
                      size={16}
                      className={`transition-transform ${
                        activeSection === item.id
                          ? 'text-primary-500'
                          : 'text-slate-300 group-hover:translate-x-1'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
