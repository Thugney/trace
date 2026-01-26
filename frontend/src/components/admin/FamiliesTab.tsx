import { useState } from 'react';
import {
  Home,
  Plus,
  Edit2,
  Trash2,
  Shield,
  Users,
  ChevronDown,
  ChevronUp,
  UserMinus,
  UserPlus,
  Crown,
  Baby,
  GraduationCap,
  RefreshCcw,
  Loader2,
  Building2,
  Sparkles
} from 'lucide-react';
import { Profile, Family } from '../../types';
import Avatar from '../Avatar';
import clsx from 'clsx';

interface FamiliesTabProps {
  families: Family[];
  unassignedProfiles: Profile[];
  loading: boolean;
  onCreateFamily: () => void;
  onEditFamily: (family: Family) => void;
  onDeleteFamily: (family: Family) => void;
  onToggleFamilyStatus: (family: Family) => void;
  onAssignToFamily: (familyId: number, profileId: number) => void;
  onRemoveFromFamily: (familyId: number, profileId: number, profileName: string) => void;
  onLoadFamilyMembers: (familyId: number) => void;
  onRefresh: () => void;
  onCreateProfile: () => void;
  onEditProfile: (profile: Profile) => void;
  onDeleteProfile: (profile: Profile) => void;
}

export default function FamiliesTab({
  families,
  unassignedProfiles,
  loading,
  onCreateFamily,
  onEditFamily,
  onDeleteFamily,
  onToggleFamilyStatus,
  onAssignToFamily,
  onRemoveFromFamily,
  onLoadFamilyMembers,
  onRefresh,
  onCreateProfile,
  onEditProfile,
  onDeleteProfile
}: FamiliesTabProps) {
  const [expandedFamilyId, setExpandedFamilyId] = useState<number | null>(null);

  const toggleExpand = (familyId: number) => {
    if (expandedFamilyId === familyId) {
      setExpandedFamilyId(null);
    } else {
      setExpandedFamilyId(familyId);
      onLoadFamilyMembers(familyId);
    }
  };

  const getProfileIcon = (type: string) => {
    switch (type) {
      case 'admin': return <Crown className="text-violet-500" size={14} />;
      case 'parent': return <Users className="text-blue-500" size={14} />;
      case 'child': return <Baby className="text-orange-500" size={14} />;
      case 'teacher': return <GraduationCap className="text-emerald-500" size={14} />;
      default: return <Users size={14} />;
    }
  };

  const getProfileColor = (type: string) => {
    switch (type) {
      case 'admin': return 'bg-violet-100 text-violet-700 border-violet-200';
      case 'parent': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'child': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'teacher': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-pink-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading families...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Actions Bar - Stack on mobile */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
        <button
          onClick={onCreateFamily}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pink-500 to-rose-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 text-sm sm:text-base"
        >
          <Plus size={16} className="sm:w-[18px] sm:h-[18px]" />
          New Family
        </button>
        <button
          onClick={onCreateProfile}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 text-sm sm:text-base"
        >
          <UserPlus size={16} className="sm:w-[18px] sm:h-[18px]" />
          Add Profile
        </button>
        <button
          onClick={onRefresh}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-all text-sm sm:text-base"
        >
          <RefreshCcw size={16} className="sm:w-[18px] sm:h-[18px]" />
          Refresh
        </button>
      </div>

      {/* Families List */}
      {families.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border border-slate-200">
          <div className="w-20 h-20 mx-auto mb-4 bg-pink-100 rounded-full flex items-center justify-center">
            <Home size={32} className="text-pink-500" />
          </div>
          <p className="font-bold text-slate-700 text-lg">No families yet</p>
          <p className="text-sm text-slate-500 mt-1 mb-4">Create your first family to organize profiles</p>
          <button
            onClick={onCreateFamily}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white font-semibold rounded-xl shadow-lg"
          >
            <Plus size={18} />
            Create Family
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {families.map(family => (
            <div
              key={family.id}
              className={clsx(
                'rounded-2xl overflow-hidden transition-all',
                family.status === 'active'
                  ? 'bg-white border-2 border-slate-200 shadow-lg hover:shadow-xl'
                  : 'bg-slate-50 border-2 border-slate-300 opacity-75'
              )}
            >
              {/* Family Header */}
              <div
                className={clsx(
                  'p-3 sm:p-5 cursor-pointer transition-colors',
                  expandedFamilyId === family.id ? 'bg-gradient-to-r from-pink-50 to-rose-50' : 'hover:bg-slate-50'
                )}
                onClick={() => toggleExpand(family.id)}
              >
                <div className="flex items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className={clsx(
                      'w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center text-lg sm:text-2xl font-bold shadow-lg flex-shrink-0',
                      family.status === 'active'
                        ? 'bg-gradient-to-br from-pink-500 to-rose-600 text-white'
                        : 'bg-slate-300 text-slate-500'
                    )}>
                      {family.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-base sm:text-lg text-slate-900 flex flex-wrap items-center gap-1 sm:gap-2">
                        <span className="truncate">{family.name}</span>
                        {/* Family Type Badge */}
                        {family.family_type === 'B' ? (
                          <span className="inline-flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium whitespace-nowrap">
                            <Building2 size={10} className="sm:w-3 sm:h-3" />
                            <span className="hidden sm:inline">School Only</span>
                            <span className="sm:hidden">School</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 font-medium whitespace-nowrap">
                            <Sparkles size={10} className="sm:w-3 sm:h-3" />
                            <span className="hidden sm:inline">Full Access</span>
                            <span className="sm:hidden">Full</span>
                          </span>
                        )}
                        {family.status !== 'active' && (
                          <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-medium">
                            {family.status}
                          </span>
                        )}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500 truncate">
                        {family.parent_count || 0} parent{(family.parent_count || 0) !== 1 ? 's' : ''} &middot; {family.child_count || 0} child{(family.child_count || 0) !== 1 ? 'ren' : ''}
                        <span className="hidden sm:inline">{family.parent_names && ` (${family.parent_names})`}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditFamily(family); }}
                      className="p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                      title="Edit family"
                    >
                      <Edit2 size={14} className="sm:w-[18px] sm:h-[18px]" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleFamilyStatus(family); }}
                      className={clsx(
                        'p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl transition-colors',
                        family.status === 'active'
                          ? 'bg-slate-100 text-amber-600 hover:bg-amber-100'
                          : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                      )}
                      title={family.status === 'active' ? 'Suspend family' : 'Activate family'}
                    >
                      <Shield size={14} className="sm:w-[18px] sm:h-[18px]" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteFamily(family); }}
                      className="p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl bg-slate-100 text-rose-600 hover:bg-rose-100 transition-colors"
                      title="Delete family"
                    >
                      <Trash2 size={14} className="sm:w-[18px] sm:h-[18px]" />
                    </button>
                    <div className="ml-1 sm:ml-2 p-1 sm:p-2 text-slate-400">
                      {expandedFamilyId === family.id ? <ChevronUp size={16} className="sm:w-5 sm:h-5" /> : <ChevronDown size={16} className="sm:w-5 sm:h-5" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedFamilyId === family.id && (
                <div className="border-t border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 sm:p-5">
                  {/* Add Member Dropdown */}
                  {unassignedProfiles.length > 0 && (
                    <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                      <span className="text-sm font-medium text-slate-600">Add member:</span>
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            onAssignToFamily(family.id, parseInt(e.target.value));
                            e.target.value = '';
                          }
                        }}
                        className="flex-1 sm:max-w-xs rounded-xl border-2 border-slate-200 px-3 sm:px-4 py-2 sm:py-2.5 text-sm focus:border-pink-500 focus:ring-2 focus:ring-pink-200"
                        defaultValue=""
                      >
                        <option value="">Select a profile...</option>
                        {unassignedProfiles.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.type})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Members Grid */}
                  {family.members && family.members.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                      {family.members.map(member => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all"
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                            <Avatar avatar={member.avatar} size="sm" alt={member.name} className="flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 text-sm sm:text-base truncate">{member.name}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                {getProfileIcon(member.type)}
                                <span className="text-xs text-slate-500 capitalize">{member.type}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => onEditProfile(member)}
                              className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                              title="Edit profile"
                            >
                              <Edit2 size={14} className="sm:w-4 sm:h-4" />
                            </button>
                            <button
                              onClick={() => onRemoveFromFamily(family.id, member.id, member.name)}
                              className="p-1.5 sm:p-2 rounded-lg hover:bg-rose-100 text-rose-500 transition-colors"
                              title="Remove from family"
                            >
                              <UserMinus size={14} className="sm:w-4 sm:h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-slate-500 py-4 sm:py-6 text-sm">
                      No members in this family yet. Use the dropdown above to add members.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Unassigned Profiles */}
      {unassignedProfiles.length > 0 && (
        <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200">
          <h3 className="font-bold text-amber-800 mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base">
            <UserPlus size={16} className="sm:w-5 sm:h-5" />
            Unassigned Profiles ({unassignedProfiles.length})
          </h3>
          <p className="text-xs sm:text-sm text-amber-700 mb-3 sm:mb-4">
            These profiles are not assigned to any family. Expand a family above to add them.
          </p>
          <div className="flex flex-wrap gap-2">
            {unassignedProfiles.map(profile => (
              <div
                key={profile.id}
                className={clsx(
                  'inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-white border shadow-sm',
                  getProfileColor(profile.type)
                )}
              >
                <Avatar avatar={profile.avatar} size="xs" alt={profile.name} />
                <span className="font-medium text-xs sm:text-sm">{profile.name}</span>
                {getProfileIcon(profile.type)}
                <button
                  onClick={() => onEditProfile(profile)}
                  className="ml-0.5 sm:ml-1 p-1 rounded hover:bg-slate-100 text-slate-400"
                  title="Edit profile"
                >
                  <Edit2 size={12} className="sm:w-[14px] sm:h-[14px]" />
                </button>
                <button
                  onClick={() => onDeleteProfile(profile)}
                  className="p-1 rounded hover:bg-rose-100 text-rose-400"
                  title="Delete profile"
                >
                  <Trash2 size={12} className="sm:w-[14px] sm:h-[14px]" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
