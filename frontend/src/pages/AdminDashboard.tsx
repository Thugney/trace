import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { profilesAPI } from '../services/api';
import { Shield, Users, Baby, GraduationCap, Activity, Settings } from 'lucide-react';

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
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <Shield className="text-red-600" size={32} />
          <h1 className="text-3xl font-bold text-gray-900">
            Admin Dashboard
          </h1>
        </div>
        <p className="text-gray-600">System overview and management</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">Administrators</p>
              <p className="text-4xl font-bold mt-1">{stats.admins}</p>
              <p className="text-red-100 text-xs mt-1">System managers</p>
            </div>
            <Shield size={48} className="opacity-80" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Parents</p>
              <p className="text-4xl font-bold mt-1">{stats.parents}</p>
              <p className="text-blue-100 text-xs mt-1">Family accounts</p>
            </div>
            <Users size={48} className="opacity-80" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Teachers</p>
              <p className="text-4xl font-bold mt-1">{stats.teachers}</p>
              <p className="text-green-100 text-xs mt-1">School staff</p>
            </div>
            <GraduationCap size={48} className="opacity-80" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Children</p>
              <p className="text-4xl font-bold mt-1">{stats.children}</p>
              <p className="text-purple-100 text-xs mt-1">Active students</p>
            </div>
            <Baby size={48} className="opacity-80" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Activity className="mr-2 text-primary-600" size={24} />
            Quick Actions
          </h2>
          <div className="space-y-3">
            <Link
              to="/admin"
              className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="flex items-center space-x-3">
                <Users className="text-primary-600" size={20} />
                <div>
                  <p className="font-medium">User Management</p>
                  <p className="text-sm text-gray-600">Create, edit, and delete profiles</p>
                </div>
              </div>
            </Link>

            <Link
              to="/settings"
              className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="flex items-center space-x-3">
                <Settings className="text-primary-600" size={20} />
                <div>
                  <p className="font-medium">System Settings</p>
                  <p className="text-sm text-gray-600">Configure app settings and preferences</p>
                </div>
              </div>
            </Link>

            <Link
              to="/school"
              className="block p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="flex items-center space-x-3">
                <GraduationCap className="text-primary-600" size={20} />
                <div>
                  <p className="font-medium">School System</p>
                  <p className="text-sm text-gray-600">Manage classes and assignments</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Activity className="mr-2 text-primary-600" size={24} />
            Recent Activity
          </h2>
          <div className="space-y-4">
            {stats.recentActivity.length === 0 ? (
              <p className="text-gray-600 text-center py-8">No recent activity</p>
            ) : (
              stats.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl">
                    {activity.type === 'admin' && '🛡️'}
                    {activity.type === 'parent' && '👨‍👩‍👧'}
                    {activity.type === 'teacher' && '🎓'}
                    {activity.type === 'child' && '👶'}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{activity.name}</p>
                    <p className="text-sm text-gray-600">{activity.action}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(activity.created_at).toLocaleDateString()} {new Date(activity.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* System Health */}
      <div className="card bg-gradient-to-r from-primary-50 to-purple-50">
        <h2 className="text-xl font-semibold mb-4">System Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary-600">{stats.totalProfiles}</div>
            <div className="text-sm text-gray-600 mt-1">Total Profiles</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">✓</div>
            <div className="text-sm text-gray-600 mt-1">Database OK</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">✓</div>
            <div className="text-sm text-gray-600 mt-1">Auth System</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">✓</div>
            <div className="text-sm text-gray-600 mt-1">All Systems</div>
          </div>
        </div>
      </div>
    </div>
  );
}
