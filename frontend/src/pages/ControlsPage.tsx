import { useCallback, useEffect, useState } from 'react';
import { useProfile } from '../context/ProfileContext';
import { profilesAPI } from '../services/api';
import { Profile } from '../types';
import EconomySettings from '../components/EconomySettings';
import PointsManagement from '../components/PointsManagement';
import { Shield } from 'lucide-react';

export default function ControlsPage() {
  const { currentProfile } = useProfile();
  const profileId = currentProfile?.id;
  const [children, setChildren] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const loadChildren = useCallback(async () => {
    if (!profileId) return;

    try {
      setLoading(true);
      const response = await profilesAPI.getAll();
      const myKids = response.data.filter(
        (p: Profile) => p.type === 'child'
      );
      setChildren(myKids);
    } catch (error) {
      console.error('Failed to load children:', error);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadChildren();
  }, [currentProfile, loadChildren]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="text-indigo-600" size={28} />
          <h1 className="text-2xl font-bold text-gray-900">Parental Controls</h1>
        </div>
        <p className="text-gray-600">
          Manage economy settings, earning limits, and anti-abuse protections for your children.
        </p>
      </div>

      {/* Points Management & Economy Settings */}
      {children.length > 0 ? (
        <div className="space-y-6">
          {/* Points Management - Add/Deduct Points */}
          <div className="card">
            <PointsManagement children={children} parentId={currentProfile?.id || 0} />
          </div>

          {/* Economy Settings */}
          <div className="card">
            <EconomySettings children={children} />
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center">
          <Shield size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Children Yet</h3>
          <p className="text-gray-600">
            Add your children's profiles first to configure their economy controls.
          </p>
        </div>
      )}
    </div>
  );
}
