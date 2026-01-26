import { ReactNode } from 'react';
import {
  LayoutDashboard,
  Users,
  Zap,
  Brain,
  Settings
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
  const activeTabItem = tabs.find(t => t.id === activeTab);

  return (
    <div className="space-y-4">
      {/* Tab Title Card - Compact on mobile */}
      {activeTabItem && (
        <div className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-r ${activeTabItem.gradient} text-white shadow-xl`}>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 bg-white/20 backdrop-blur rounded-xl">
              <activeTabItem.icon size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold">{activeTabItem.label}</h2>
              <p className="text-xs sm:text-sm text-white/80 mt-0.5 hidden sm:block">{activeTabItem.description}</p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Tab Bar - Scrollable horizontal tabs */}
      <div className="overflow-x-auto -mx-4 px-4 pb-2 scrollbar-hide">
        <div className="flex gap-2 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-semibold text-xs sm:text-sm whitespace-nowrap transition-all ${
                  isActive
                    ? `bg-gradient-to-r ${tab.gradient} text-white shadow-lg`
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon size={14} className="sm:w-4 sm:h-4" />
                <span className="hidden xs:inline sm:inline">{tab.label}</span>
                <span className="xs:hidden sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area - No extra padding wrapper */}
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl shadow-slate-200/50 border border-white/50 overflow-hidden">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
