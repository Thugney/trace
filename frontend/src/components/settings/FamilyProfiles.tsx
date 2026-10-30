import { useState } from 'react';
import { Plus, Lock, Trash2, Edit2, UserCog, Shield, Baby, Users, Star, Crown } from 'lucide-react';
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

const profileTypeConfig = {
  admin: {
    icon: Crown,
    tile: 'bg-violet-50 text-violet-600 ring-violet-100',
    badge: 'bg-violet-50 text-violet-700'
  },
  parent: {
    icon: Users,
    tile: 'bg-primary-50 text-primary-600 ring-primary-100',
    badge: 'bg-primary-50 text-primary-700'
  },
  child: {
    icon: Baby,
    tile: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    badge: 'bg-emerald-50 text-emerald-700'
  },
  teacher: {
    icon: Shield,
    tile: 'bg-amber-50 text-amber-600 ring-amber-100',
    badge: 'bg-amber-50 text-amber-700'
  }
};

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

  return (
    <div className="space-y-6">
      {/* Add Member Button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="group flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-4 font-semibold text-slate-600 transition-colors hover:border-primary-400 hover:bg-primary-50/40 hover:text-primary-700"
      >
        <div className="rounded-lg bg-slate-100 p-2 transition-colors group-hover:bg-primary-100">
          <Plus size={18} />
        </div>
        Add Family Member
      </button>

      {/* Profiles Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {profiles.map(profile => {
          const isCurrentUser = profile.id === currentProfile?.id;
          const canEdit = isAdmin && !isCurrentUser;
          const canResetPin = isParent && profile.type === 'child';
          const config = profileTypeConfig[profile.type as keyof typeof profileTypeConfig] || profileTypeConfig.child;
          const Icon = config.icon;

          return (
            <div
              key={profile.id}
              className={`relative flex flex-col rounded-2xl border p-5 shadow-sm transition-shadow hover:shadow-md ${
                isCurrentUser
                  ? 'border-primary-200 bg-primary-50/40'
                  : 'border-slate-200 bg-white'
              }`}
            >
              {/* Current User Indicator */}
              {isCurrentUser && (
                <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white">
                  <Star size={12} fill="currentColor" />
                  You
                </span>
              )}

              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl ring-2 ${config.tile}`}>
                    <Avatar avatar={profile.avatar} size="lg" alt={profile.name} />
                  </div>
                  {profile.pin && (
                    <div className="absolute -bottom-1 -right-1 rounded-md bg-amber-400 p-1 shadow-sm">
                      <Lock className="text-white" size={10} />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className="truncate text-lg font-bold text-slate-900">
                    {profile.name}
                  </h3>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${config.badge}`}>
                      <Icon size={12} />
                      {profile.type.charAt(0).toUpperCase() + profile.type.slice(1)}
                    </span>
                    {profile.age && (
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {profile.age} years
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {(canEdit || canResetPin) && (
                <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
                  {canResetPin && (
                    <button
                      onClick={() => {
                        setSelectedProfile(profile);
                        setShowResetPinModal(true);
                      }}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100"
                    >
                      <Lock size={14} />
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
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Edit2 size={14} />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteProfile(profile)}
                        aria-label={`Delete ${profile.name}`}
                        className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white px-3 py-2 text-rose-600 transition-colors hover:bg-rose-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {profiles.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <UserCog size={28} className="text-slate-400" />
          </div>
          <p className="text-lg font-bold text-slate-700">No profiles yet</p>
          <p className="mt-1 text-sm text-slate-500">Add family members to get started</p>
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
