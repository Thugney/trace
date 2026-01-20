import { ReactNode, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Zap,
  Brain,
  Settings,
  Menu,
  X,
  Shield
} from 'lucide-react';

export type AdminTab = 'overview' | 'families' | 'features' | 'ai-controls' | 'system';

interface AdminLayoutProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  children: ReactNode;
}

interface TabItem {
  id: AdminTab;
  label: string;
  icon: typeof LayoutDashboard;
  gradient: string;
  description: string;
}

const tabs: TabItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    gradient: 'from-blue-500 to-indigo-600',
    description: 'System stats and quick actions'
  },
  {
    id: 'families',
    label: 'Families & Users',
    icon: Users,
    gradient: 'from-pink-500 to-rose-600',
    description: 'Manage family members and profiles'
  },
  {
    id: 'features',
    label: 'Features',
    icon: Zap,
    gradient: 'from-amber-500 to-orange-600',
    description: 'Enable or disable features per family'
  },
  {
    id: 'ai-controls',
    label: 'AI Controls',
    icon: Brain,
    gradient: 'from-purple-500 to-violet-600',
    description: 'Configure AI settings per child'
  },
  {
    id: 'system',
    label: 'System',
    icon: Settings,
    gradient: 'from-slate-600 to-slate-800',
    description: 'API keys and global settings'
  }
];

export default function AdminLayout({ activeTab, onTabChange, children }: AdminLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeTabItem = tabs.find(t => t.id === activeTab);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-white">
      {/* Decorative Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-violet-200/40 to-purple-200/40 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-40 w-96 h-96 bg-gradient-to-br from-blue-200/40 to-cyan-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-gradient-to-br from-pink-200/30 to-rose-200/30 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 text-white sticky top-0 z-30 shadow-xl">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
                <Shield className="text-white" size={22} />
              </div>
              <div>
                <h1 className="text-lg font-bold">Admin Panel</h1>
                <p className="text-xs text-white/60 hidden sm:block">System Management</p>
              </div>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Desktop Tab Navigation */}
        <div className="hidden lg:block border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4">
            <nav className="flex gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`relative flex items-center gap-2 px-5 py-4 font-medium text-sm transition-all ${
                      isActive
                        ? 'text-white'
                        : 'text-white/60 hover:text-white/90 hover:bg-white/5'
                    }`}
                  >
                    <Icon size={18} />
                    {tab.label}
                    {isActive && (
                      <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r ${tab.gradient}`} />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-80 bg-slate-900 shadow-2xl p-4 pt-20">
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      onTabChange(tab.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${
                      isActive
                        ? `bg-gradient-to-r ${tab.gradient} text-white shadow-lg`
                        : 'bg-white/5 hover:bg-white/10 text-white/80'
                    }`}
                  >
                    <Icon size={20} />
                    <div className="text-left">
                      <span className="font-semibold block">{tab.label}</span>
                      <span className="text-xs opacity-70">{tab.description}</span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Mobile Tab Bar */}
      <div className="lg:hidden sticky top-16 z-20 bg-white/90 backdrop-blur-lg border-b border-slate-200/50 shadow-sm">
        <div className="flex overflow-x-auto px-2 py-2 gap-2 scrollbar-hide">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${
                  isActive
                    ? `bg-gradient-to-r ${tab.gradient} text-white shadow-lg`
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <main className="relative max-w-7xl mx-auto px-4 py-6">
        {/* Tab Title Card */}
        {activeTabItem && (
          <div className={`mb-6 p-5 rounded-2xl bg-gradient-to-r ${activeTabItem.gradient} text-white shadow-xl`}>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
                <activeTabItem.icon size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold">{activeTabItem.label}</h2>
                <p className="text-sm text-white/80 mt-0.5">{activeTabItem.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-slate-200/50 border border-white/50 overflow-hidden">
          <div className="p-6 lg:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
