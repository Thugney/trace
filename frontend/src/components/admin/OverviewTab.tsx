import {
  Users,
  Baby,
  Shield,
  GraduationCap,
  Home,
  Plus,
  RefreshCcw,
  TrendingUp,
  Activity
} from 'lucide-react';
import { Profile, Family } from '../../types';

interface OverviewTabProps {
  profiles: Profile[];
  families: Family[];
  loading: boolean;
  schoolOnlyMode: boolean;
  onToggleSchoolOnlyMode: () => void;
  onRefresh: () => void;
  onCreateProfile: () => void;
  onCreateFamily: () => void;
}

export default function OverviewTab({
  profiles,
  families,
  loading,
  schoolOnlyMode,
  onToggleSchoolOnlyMode,
  onRefresh,
  onCreateProfile,
  onCreateFamily
}: OverviewTabProps) {
  const admins = profiles.filter(p => p.type === 'admin');
  const parents = profiles.filter(p => p.type === 'parent');
  const teachers = profiles.filter(p => p.type === 'teacher');
  const children = profiles.filter(p => p.type === 'child');
  const activeFamilies = families.filter(f => f.status === 'active');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">Loading overview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Activity size={20} className="text-violet-500" />
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={onCreateProfile}
            className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
          >
            <Plus size={24} />
            <span className="font-semibold text-sm">Add Profile</span>
          </button>
          <button
            onClick={onCreateFamily}
            className="flex flex-col items-center gap-2 p-4 bg-gradient-to-br from-pink-500 to-rose-600 text-white rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
          >
            <Home size={24} />
            <span className="font-semibold text-sm">New Family</span>
          </button>
          <button
            onClick={onToggleSchoolOnlyMode}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 ${
              schoolOnlyMode
                ? 'bg-gradient-to-br from-rose-500 to-red-600 text-white'
                : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-rose-300'
            }`}
          >
            <Shield size={24} />
            <span className="font-semibold text-sm">
              {schoolOnlyMode ? 'School Mode ON' : 'School Mode'}
            </span>
          </button>
          <button
            onClick={onRefresh}
            className="flex flex-col items-center gap-2 p-4 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl shadow hover:shadow-lg transition-all hover:-translate-y-0.5 hover:border-slate-300"
          >
            <RefreshCcw size={24} />
            <span className="font-semibold text-sm">Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <TrendingUp size={20} className="text-emerald-500" />
          System Overview
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            icon={<Home className="text-pink-500" size={24} />}
            label="Families"
            value={activeFamilies.length}
            total={families.length}
            gradient="from-pink-50 to-rose-50"
            border="border-pink-200"
          />
          <StatCard
            icon={<Shield className="text-amber-500" size={24} />}
            label="Admins"
            value={admins.length}
            gradient="from-amber-50 to-orange-50"
            border="border-amber-200"
          />
          <StatCard
            icon={<Users className="text-blue-500" size={24} />}
            label="Parents"
            value={parents.length}
            gradient="from-blue-50 to-indigo-50"
            border="border-blue-200"
          />
          <StatCard
            icon={<GraduationCap className="text-emerald-500" size={24} />}
            label="Teachers"
            value={teachers.length}
            gradient="from-emerald-50 to-teal-50"
            border="border-emerald-200"
          />
          <StatCard
            icon={<Baby className="text-orange-500" size={24} />}
            label="Children"
            value={children.length}
            gradient="from-orange-50 to-amber-50"
            border="border-orange-200"
          />
        </div>
      </div>

      {/* Recent Activity or Summary */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 border border-slate-200">
          <h4 className="font-bold text-slate-900 mb-4">Family Summary</h4>
          {families.length === 0 ? (
            <p className="text-slate-500 text-sm">No families created yet.</p>
          ) : (
            <div className="space-y-3">
              {families.slice(0, 5).map(family => (
                <div key={family.id} className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold ${
                      family.status === 'active'
                        ? 'bg-pink-100 text-pink-600'
                        : 'bg-slate-100 text-slate-400'
                    }`}>
                      {family.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{family.name}</p>
                      <p className="text-xs text-slate-500">
                        {family.parent_count || 0} parents, {family.child_count || 0} children
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    family.status === 'active'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {family.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-6 border border-violet-200">
          <h4 className="font-bold text-slate-900 mb-4">AI Access Summary</h4>
          <div className="space-y-3">
            {(() => {
              const withAI = profiles.filter(p => p.ai_enabled === 1);
              const withoutAI = profiles.filter(p => p.ai_enabled !== 1);
              return (
                <>
                  <div className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm">
                    <span className="font-medium text-slate-700">AI Enabled</span>
                    <span className="text-lg font-bold text-violet-600">{withAI.length}</span>
                  </div>
                  <div className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm">
                    <span className="font-medium text-slate-700">AI Disabled</span>
                    <span className="text-lg font-bold text-slate-500">{withoutAI.length}</span>
                  </div>
                  <div className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm">
                    <span className="font-medium text-slate-700">Total Profiles</span>
                    <span className="text-lg font-bold text-slate-800">{profiles.length}</span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  total?: number;
  gradient: string;
  border: string;
}

function StatCard({ icon, label, value, total, gradient, border }: StatCardProps) {
  return (
    <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-5 border ${border}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-white rounded-xl shadow-sm">
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-900">
        {value}
        {total !== undefined && total !== value && (
          <span className="text-lg text-slate-400 font-normal">/{total}</span>
        )}
      </p>
      <p className="text-sm font-medium text-slate-600 mt-1">{label}</p>
    </div>
  );
}
