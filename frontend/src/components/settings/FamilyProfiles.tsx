import { useState } from 'react';
import { Plus, Lock, Trash2, Edit2, UserCog, Shield, Baby, Users } from 'lucide-react';
import Avatar from '../Avatar';
import { Profile } from '../../types';
import { profilesAPI } from '../../services/api';
import AddProfileModal from './modals/AddProfileModal';
import EditProfileModal from './modals/EditProfileModal';
import ResetPinModal from './modals/ResetPinModal';

interface FamilyProfilesProps {
  profiles: Profile[];
  currentProfile: Profile | null;
  isParent: boolean;
  isAdmin: boolean;
  onSuccess: (message: string) => void;
  onRefresh: () => Promise<void>;
}

export default function FamilyProfiles({
  profiles,
  currentProfile,
  isParent,
  isAdmin,
  onSuccess,
  onRefresh
}: FamilyProfilesProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPinModal, setShowResetPinModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  const handleDeleteProfile = async (profile: Profile) => {
    if (!window.confirm(`Are you sure you want to delete ${profile.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      await profilesAPI.delete(profile.id);
      onSuccess(`${profile.name} deleted successfully`);
      await onRefresh();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete profile');
    }
  };

  const getProfileIcon = (type: string) => {
    switch (type) {
      case 'admin':
        return <Shield className="text-violet-600" size={14} />;
      case 'parent':
        return <Users className="text-blue-600" size={14} />;
      case 'child':
        return <Baby className="text-green-600" size={14} />;
      default:
        return null;
    }
  };

  const getProfileBadgeColor = (type: string) => {
    switch (type) {
      case 'admin':
        return 'bg-violet-100 text-violet-700';
      case 'parent':
        return 'bg-blue-100 text-blue-700';
      case 'child':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Family Profiles</h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage family members and their access
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all"
        >
          <Plus size={18} />
          Add Member
        </button>
      </div>

      {/* Profiles Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {profiles.map(profile => {
          const isCurrentUser = profile.id === currentProfile?.id;
          const canEdit = isAdmin && !isCurrentUser;
          const canResetPin = isParent && profile.type === 'child' && profile.parent_id === currentProfile?.id;

          return (
            <div
              key={profile.id}
              className={`p-4 rounded-2xl border-2 transition-all ${
                isCurrentUser
                  ? 'bg-primary-50 border-primary-200'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="relative">
                  <Avatar avatar={profile.avatar} size="lg" alt={profile.name} />
                  {profile.pin && (
                    <div className="absolute -bottom-1 -right-1 p-1 bg-amber-100 rounded-full">
                      <Lock className="text-amber-600" size={12} />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900 truncate">
                      {profile.name}
                    </h3>
                    {isCurrentUser && (
                      <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
                        You
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${getProfileBadgeColor(profile.type)}`}>
                      {getProfileIcon(profile.type)}
                      {profile.type.charAt(0).toUpperCase() + profile.type.slice(1)}
                    </span>
                    {profile.age && (
                      <span className="text-xs text-slate-500">
                        {profile.age} years
                      </span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {(canEdit || canResetPin) && (
                    <div className="flex items-center gap-2 mt-3">
                      {canResetPin && (
                        <button
                          onClick={() => {
                            setSelectedProfile(profile);
                            setShowResetPinModal(true);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors"
                        >
                          <Lock size={12} />
                          Reset PIN
                        </button>
                      )}
                      {canEdit && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedProfile(profile);
                              setShowEditModal(true);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
                          >
                            <Edit2 size={12} />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteProfile(profile)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {profiles.length === 0 && (
        <div className="text-center py-12">
          <UserCog size={48} className="mx-auto mb-4 text-slate-300" />
          <p className="font-medium text-slate-600">No profiles yet</p>
          <p className="text-sm text-slate-500 mt-1">Add family members to get started</p>
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddProfileModal
          isAdmin={isAdmin}
          isParent={isParent}
          onClose={() => setShowAddModal(false)}
          onSuccess={(message) => {
            onSuccess(message);
            setShowAddModal(false);
          }}
          onRefresh={onRefresh}
        />
      )}

      {showEditModal && selectedProfile && (
        <EditProfileModal
          profile={selectedProfile}
          onClose={() => {
            setShowEditModal(false);
            setSelectedProfile(null);
          }}
          onSuccess={(message) => {
            onSuccess(message);
            setShowEditModal(false);
            setSelectedProfile(null);
          }}
          onRefresh={onRefresh}
        />
      )}

      {showResetPinModal && selectedProfile && currentProfile && (
        <ResetPinModal
          profile={selectedProfile}
          parentId={currentProfile.id}
          onClose={() => {
            setShowResetPinModal(false);
            setSelectedProfile(null);
          }}
          onSuccess={(message) => {
            onSuccess(message);
            setShowResetPinModal(false);
            setSelectedProfile(null);
          }}
        />
      )}
    </div>
  );
}
