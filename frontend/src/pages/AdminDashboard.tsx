import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { profilesAPI } from '../services/api';
import { Shield, Users, Baby, GraduationCap, Activity, Settings, ArrowUpRight, Database, Cpu, Lock } from 'lucide-react';

interface SystemStats {
  totalProfiles: number;
  admins: number;
  parents: number;
  teachers: number;
  children: number;
  recentActivity: Array<{
    id: number;
    name: string;
    type: string;
    action: string;
    created_at: string;
  }>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<SystemStats>({
    totalProfiles: 0,
    admins: 0,
    parents: 0,
    teachers: 0,
    children: 0,
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSystemStats();
  }, []);

  const loadSystemStats = async () => {
    try {
      setLoading(true);
      const response = await profilesAPI.getAll();
      const profiles = response.data;

      setStats({
        totalProfiles: profiles.length,
        admins: profiles.filter((p: any) => p.type === 'admin').length,
        parents: profiles.filter((p: any) => p.type === 'parent').length,
        teachers: profiles.filter((p: any) => p.type === 'teacher').length,
        children: profiles.filter((p: any) => p.type === 'child').length,
        recentActivity: profiles
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5)
          .map((p: any) => ({
            id: p.id,
            name: p.name,
            type: p.type,
            action: 'Profile created',
            created_at: p.created_at
          }))
      });
    } catch (error) {
      console.error('Failed to load system stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 admin-shell">
        <div className="spinner"></div>
      </div>
    );
  }

  const statCards = [
    {
      key: 'admins',
      label: 'Administrators',
      value: stats.admins,
      note: 'System owners',
      icon: Shield,
      className: 'from-amber-500/20 via-amber-200/30 to-transparent border-amber-200/50 text-amber-700',
      iconClass: 'text-amber-500'
    },
    {
      key: 'parents',
      label: 'Parents',
      value: stats.parents,
      note: 'Family accounts',
      icon: Users,
      className: 'from-sky-500/20 via-sky-200/30 to-transparent border-sky-200/50 text-sky-700',
      iconClass: 'text-sky-500'
    },
    {
      key: 'teachers',
      label: 'Teachers',
      value: stats.teachers,
      note: 'School staff',
      icon: GraduationCap,
      className: 'from-emerald-500/20 via-emerald-200/30 to-transparent border-emerald-200/50 text-emerald-700',
      iconClass: 'text-emerald-500'
    },
    {
      key: 'children',
      label: 'Children',
      value: stats.children,
      note: 'Active learners',
      icon: Baby,
      className: 'from-orange-500/20 via-orange-200/30 to-transparent border-orange-200/50 text-orange-700',
      iconClass: 'text-orange-500'
    }
  ];

  return (
    <div className="admin-shell space-y-8">
      <section className="relative overflow-hidden rounded-[32px] bg-slate-900 text-white shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.35),transparent_55%)]"></div>
        <div className="absolute inset-0 bg-[linear-gradient(120deg,_rgba(251,191,36,0.18),transparent_40%)]"></div>
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.2)_1px,transparent_1px)] [background-size:40px_40px]"></div>
        <div className="relative z-10 px-6 py-10 md:px-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl border border-amber-200/40 bg-amber-300/10 p-3">
                <Shield className="text-amber-200" size={32} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-amber-200/70">Command Center</p>
                <h1 className="text-3xl md:text-4xl font-semibold mt-2">Admin Control Grid</h1>
                <p className="text-slate-200/80 mt-1">Govern access, security, and system services.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/admin"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                User Management <ArrowUpRight size={16} />
              </Link>
              <Link
                to="/settings"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Settings <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {statCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.key}
                  className={`animate-slide-up rounded-2xl border bg-gradient-to-br ${card.className} px-4 py-5 backdrop-blur-sm`}
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <span className={`rounded-xl bg-white/70 p-2 ${card.iconClass}`}>
                      <Icon size={18} />
                    </span>
                    <span className="admin-mono text-xs uppercase tracking-[0.2em] text-slate-500/80">Live</span>
                  </div>
                  <div className="mt-4 text-3xl font-semibold text-slate-900">{card.value}</div>
                  <div className="mt-1 text-sm font-medium text-slate-700">{card.label}</div>
                  <div className="text-xs text-slate-500">{card.note}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          <section className="card border border-slate-200/80 bg-white/80 p-6 shadow-lg shadow-slate-200/40 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Operational Shortcuts</h2>
                <p className="text-sm text-slate-500 mt-1">Fast routes to policy and system controls.</p>
              </div>
              <Activity className="text-slate-400" size={22} />
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <Link
                to="/admin"
                className="group rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <Users className="text-sky-600" size={22} />
                  <div>
                    <p className="font-semibold text-slate-900">User Management</p>
                    <p className="text-xs text-slate-500">Profiles, roles, access.</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center text-xs font-semibold text-sky-600">
                  Open console <ArrowUpRight size={14} className="ml-1" />
                </div>
              </Link>
              <Link
                to="/settings"
                className="group rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <Settings className="text-emerald-600" size={22} />
                  <div>
                    <p className="font-semibold text-slate-900">System Settings</p>
                    <p className="text-xs text-slate-500">AI, limits, services.</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center text-xs font-semibold text-emerald-600">
                  Configure now <ArrowUpRight size={14} className="ml-1" />
                </div>
              </Link>
              <Link
                to="/school"
                className="group rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <GraduationCap className="text-orange-600" size={22} />
                  <div>
                    <p className="font-semibold text-slate-900">School System</p>
                    <p className="text-xs text-slate-500">Classes and quizzes.</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center text-xs font-semibold text-orange-600">
                  Review activity <ArrowUpRight size={14} className="ml-1" />
                </div>
              </Link>
            </div>
          </section>

          <section className="card border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">System Health</h2>
                <p className="text-sm text-slate-500 mt-1">Realtime service flags and identity health.</p>
              </div>
              <Cpu className="text-slate-400" size={22} />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
                <div className="admin-mono text-3xl font-semibold text-slate-900">{stats.totalProfiles}</div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500 mt-2">Profiles</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
                <Database className="mx-auto text-emerald-500" size={24} />
                <div className="mt-2 text-sm font-semibold text-slate-700">Database OK</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
                <Lock className="mx-auto text-emerald-500" size={24} />
                <div className="mt-2 text-sm font-semibold text-slate-700">Auth OK</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
                <Activity className="mx-auto text-emerald-500" size={24} />
                <div className="mt-2 text-sm font-semibold text-slate-700">Services OK</div>
              </div>
            </div>
          </section>
        </div>

        <section className="card border border-slate-200/80 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Recent Activity</h2>
              <p className="text-sm text-slate-500 mt-1">Latest account changes.</p>
            </div>
            <Activity className="text-slate-400" size={20} />
          </div>
          <div className="mt-6 space-y-4">
            {stats.recentActivity.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                No recent activity
              </div>
            ) : (
              stats.recentActivity.map((activity, index) => (
                <div
                  key={activity.id}
                  className="animate-slide-up rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{activity.name}</p>
                      <p className="text-xs text-slate-500">{activity.action}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {activity.type}
                    </span>
                  </div>
                  <p className="admin-mono mt-3 text-xs text-slate-500">
                    {new Date(activity.created_at).toLocaleDateString()} {new Date(activity.created_at).toLocaleTimeString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
