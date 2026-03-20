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
    gradient: 'from-violet-500 to-purple-600',
    lightBg: 'bg-violet-50',
    badge: 'bg-violet-100 text-violet-700',
    ring: 'ring-violet-200'
  },
  parent: {
    icon: Users,
    gradient: 'from-blue-500 to-indigo-600',
    lightBg: 'bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
    ring: 'ring-blue-200'
  },
  child: {
    icon: Baby,
    gradient: 'from-emerald-500 to-teal-500',
    lightBg: 'bg-emerald-50',
    badge: 'bg-emerald-100 text-emerald-700',
    ring: 'ring-emerald-200'
  },
  teacher: {
    icon: Shield,
    gradient: 'from-amber-500 to-orange-500',
    lightBg: 'bg-amber-50',
    badge: 'bg-amber-100 text-amber-700',
    ring: 'ring-amber-200'
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
        className="w-full p-4 border-2 border-dashed border-slate-300 rounded-2xl text-slate-500 hover:border-pink-400 hover:text-pink-600 hover:bg-pink-50 transition-all flex items-center justify-center gap-2 group"
      >
        <div className="p-2 bg-slate-100 group-hover:bg-pink-100 rounded-xl transition-colors">
          <Plus size={20} />
        </div>
        <span className="font-semibold">Add Family Member</span>
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
              className={`relative overflow-hidden rounded-2xl transition-all hover:shadow-lg ${
                isCurrentUser
                  ? `bg-gradient-to-br ${config.gradient} p-[2px]`
                  : 'bg-white border border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className={`h-full ${isCurrentUser ? 'bg-white rounded-[14px]' : ''} p-5`}>
                {/* Current User Indicator */}
                {isCurrentUser && (
                  <div className="absolute top-3 right-3">
                    <span className={`flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r ${config.gradient} text-white text-xs font-bold rounded-full shadow-lg`}>
                      <Star size={12} fill="currentColor" />
                      You
                    </span>
                  </div>
                )}

                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="relative">
                    <div className={`w-16 h-16 rounded-2xl overflow-hidden ring-2 ${config.ring} shadow-lg flex items-center justify-center bg-gradient-to-br ${config.gradient}`}>
                      <Avatar avatar={profile.avatar} size="lg" alt={profile.name} />
                    </div>
                    {profile.pin && (
                      <div className="absolute -bottom-1 -right-1 p-1.5 bg-amber-400 rounded-lg shadow-md">
                        <Lock className="text-white" size={10} />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 pt-1">
                    <h3 className="font-bold text-slate-900 truncate text-lg">
                      {profile.name}
                    </h3>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg ${config.badge}`}>
                        <Icon size={12} />
                        {profile.type.charAt(0).toUpperCase() + profile.type.slice(1)}
                      </span>
                      {profile.age && (
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                          {profile.age} years
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                {(canEdit || canResetPin) && (
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                    {canResetPin && (
                      <button
                        onClick={() => {
                          setSelectedProfile(profile);
                          setShowResetPinModal(true);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold text-amber-700 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors"
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
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold text-blue-700 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
                        >
                          <Edit2 size={14} />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteProfile(profile)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold text-red-700 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {profiles.length === 0 && (
        <div className="text-center py-16 bg-slate-50 rounded-2xl">
          <div className="w-20 h-20 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
            <UserCog size={32} className="text-slate-400" />
          </div>
          <p className="font-bold text-slate-700 text-lg">No profiles yet</p>
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
