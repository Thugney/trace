import { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { profilesAPI, schoolAPI } from '../services/api';
import { Profile } from '../types';
import { SchoolClass } from '../types/school';
import { Plus, Edit2, Trash2, Shield, User, GraduationCap, Baby, Bot } from 'lucide-react';
import clsx from 'clsx';

export default function AdminPanel() {
  const { currentProfile, refreshProfiles } = useProfile();
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [schoolClasses, setSchoolClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'child' as 'admin' | 'parent' | 'child' | 'teacher',
    age: '',
    gender: 'other' as 'male' | 'female' | 'other',
    avatar: '',
    pin: '',
    parent_id: '',
    assigned_class_id: ''
  });

  useEffect(() => {
    loadAllProfiles();
    loadSchoolClasses();
  }, []);

  const loadSchoolClasses = async () => {
    try {
      const response = await schoolAPI.getClasses();
      setSchoolClasses(response.data);
    } catch (error) {
      console.error('Failed to load school classes:', error);
    }
  };

  const loadAllProfiles = async () => {
    try {
      setLoading(true);
      const response = await profilesAPI.getAll();
      setAllProfiles(response.data);
    } catch (error) {
      console.error('Failed to load profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data: Partial<Profile> = {
        name: formData.name,
        type: formData.type,
        avatar: formData.avatar || undefined,
        pin: formData.pin || undefined,
        gender: formData.gender,
      };

      // Add age if provided
      if (formData.age) {
        data.age = parseInt(formData.age);
      }

      // Add parent_id if child and parent selected
      if (formData.type === 'child' && formData.parent_id) {
        data.parent_id = parseInt(formData.parent_id);
      }

      // Add assigned_class_id if teacher and class selected
      if (formData.type === 'teacher' && formData.assigned_class_id) {
        (data as any).assigned_class_id = parseInt(formData.assigned_class_id);
      }

      await profilesAPI.create(data);
      await loadAllProfiles();
      await refreshProfiles();

      // Reset form
      setFormData({
        name: '',
        type: 'child',
        age: '',
        gender: 'other',
        avatar: '',
        pin: '',
        parent_id: '',
        assigned_class_id: ''
      });
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create profile:', error);
      alert('Failed to create profile. Please try again.');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;

    try {
      const data: Partial<Profile> = {
        name: formData.name,
        type: formData.type,
        avatar: formData.avatar || undefined,
        gender: formData.gender,
      };

      // Add age if provided
      if (formData.age) {
        data.age = parseInt(formData.age);
      }

      // Add parent_id if child and parent selected
      if (formData.type === 'child' && formData.parent_id) {
        data.parent_id = parseInt(formData.parent_id);
      }

      // Add assigned_class_id if teacher
      if (formData.type === 'teacher') {
        (data as any).assigned_class_id = formData.assigned_class_id ? parseInt(formData.assigned_class_id) : null;
      }

      // Only update PIN if a new one is provided
      if (formData.pin) {
        data.pin = formData.pin;
      }

      await profilesAPI.update(editingProfile.id, data);
      await loadAllProfiles();
      await refreshProfiles();

      setEditingProfile(null);
      setFormData({
        name: '',
        type: 'child',
        age: '',
        gender: 'other',
        avatar: '',
        pin: '',
        parent_id: '',
        assigned_class_id: ''
      });
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile. Please try again.');
    }
  };

  const handleDeleteProfile = async (profile: Profile) => {
    if (!confirm(`Are you sure you want to delete ${profile.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      await profilesAPI.delete(profile.id);
      await loadAllProfiles();
      await refreshProfiles();
    } catch (error) {
      console.error('Failed to delete profile:', error);
      alert('Failed to delete profile. Please try again.');
    }
  };

  const handleToggleAI = async (profile: Profile) => {
    try {
      const newAiEnabled = profile.ai_enabled === 1 ? 0 : 1;
      await profilesAPI.update(profile.id, { ai_enabled: newAiEnabled });
      await loadAllProfiles();
      await refreshProfiles();

      // Show success message
      const status = newAiEnabled === 1 ? 'enabled' : 'disabled';
      alert(`✅ AI Assistant ${status} for ${profile.name}!\n\n${profile.name} will need to log out and log back in to see the changes.`);
    } catch (error) {
      console.error('Failed to toggle AI access:', error);
      alert('❌ Failed to update AI access. Please try again.');
    }
  };

  const handleToggleDiet = async (profile: Profile) => {
    try {
      const newDietEnabled = (profile as any).diet_enabled === 1 ? 0 : 1;
      await profilesAPI.update(profile.id, { diet_enabled: newDietEnabled });
      await loadAllProfiles();
      await refreshProfiles();

      // Show success message
      const status = newDietEnabled === 1 ? 'enabled' : 'disabled';
      alert(`✅ Diet Tracking ${status} for ${profile.name}!\n\n${profile.name} will need to log out and log back in to see the changes.`);
    } catch (error) {
      console.error('Failed to toggle Diet access:', error);
      alert('❌ Failed to update Diet access. Please try again.');
    }
  };

  const startEdit = (profile: Profile) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name,
      type: profile.type,
      age: profile.age?.toString() || '',
      gender: profile.gender || 'other',
      avatar: profile.avatar || '',
      pin: '', // Don't pre-fill PIN for security
      parent_id: profile.parent_id?.toString() || '',
      assigned_class_id: (profile as any).assigned_class_id?.toString() || ''
    });
    setShowCreateForm(false);
  };

  const cancelEdit = () => {
    setEditingProfile(null);
    setFormData({
      name: '',
      type: 'child',
      age: '',
      gender: 'other',
      avatar: '',
      pin: '',
      parent_id: '',
      assigned_class_id: ''
    });
  };

  // Group profiles by type
  const admins = allProfiles.filter(p => p.type === 'admin');
  const parents = allProfiles.filter(p => p.type === 'parent');
  const teachers = allProfiles.filter(p => p.type === 'teacher');
  const children = allProfiles.filter(p => p.type === 'child');

  // Get available parents for dropdown
  const availableParents = allProfiles.filter(p => p.type === 'parent' || p.type === 'admin');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profiles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Shield className="text-red-600" size={32} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-gray-600">Manage all system profiles</p>
          </div>
        </div>

        <button
          onClick={() => {
            setShowCreateForm(true);
            setEditingProfile(null);
            cancelEdit();
          }}
          className="btn btn-primary flex items-center"
        >
          <Plus size={20} className="mr-2" />
          Create Profile
        </button>
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingProfile) && (
        <div className="card mb-6 bg-blue-50 border-2 border-blue-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {editingProfile ? 'Edit Profile' : 'Create New Profile'}
          </h2>
          <form onSubmit={editingProfile ? handleUpdateProfile : handleCreateProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="Enter name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="input"
                >
                  <option value="child">Child</option>
                  <option value="parent">Parent</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {formData.type === 'child' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                    <input
                      type="number"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      className="input"
                      placeholder="Enter age"
                      min="1"
                      max="18"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Parent</label>
                    <select
                      value={formData.parent_id}
                      onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                      className="input"
                    >
                      <option value="">Select parent (optional)</option>
                      {availableParents.map(parent => (
                        <option key={parent.id} value={parent.id}>
                          {parent.name} ({parent.type})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {formData.type === 'teacher' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Class *</label>
                  <select
                    required
                    value={formData.assigned_class_id}
                    onChange={(e) => setFormData({ ...formData, assigned_class_id: e.target.value })}
                    className="input"
                  >
                    <option value="">Select a class</option>
                    {schoolClasses.map(cls => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} (Ages {cls.age_min}-{cls.age_max})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Teacher will only see students enrolled in this class</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                  className="input"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Avatar (emoji)</label>
                <input
                  type="text"
                  value={formData.avatar}
                  onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                  className="input"
                  placeholder="👤"
                  maxLength={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PIN {editingProfile && '(leave empty to keep current)'}
                </label>
                <input
                  type="password"
                  value={formData.pin}
                  onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                  className="input"
                  placeholder="Optional 4-8 digit PIN"
                  maxLength={8}
                  pattern="[0-9]*"
                  inputMode="numeric"
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <button type="submit" className="btn btn-primary">
                {editingProfile ? 'Update Profile' : 'Create Profile'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  cancelEdit();
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Profiles List */}
      <div className="space-y-6">
        {/* Admins */}
        {admins.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Shield className="text-red-600 mr-2" size={20} />
              Administrators ({admins.length})
            </h2>
            <div className="space-y-2">
              {admins.map(profile => (
                <ProfileRow
                  key={profile.id}
                  profile={profile}
                  onEdit={startEdit}
                  onDelete={handleDeleteProfile}
                  isCurrentUser={profile.id === currentProfile?.id}
                />
              ))}
            </div>
          </div>
        )}

        {/* Teachers */}
        {teachers.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <GraduationCap className="text-green-600 mr-2" size={20} />
              Teachers ({teachers.length})
            </h2>
            <div className="space-y-2">
              {teachers.map(profile => {
                const assignedClass = schoolClasses.find(c => c.id === (profile as any).assigned_class_id);
                return (
                  <ProfileRow
                    key={profile.id}
                    profile={profile}
                    onEdit={startEdit}
                    onDelete={handleDeleteProfile}
                    isCurrentUser={profile.id === currentProfile?.id}
                    assignedClassName={assignedClass?.name}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Parents */}
        {parents.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User className="text-blue-600 mr-2" size={20} />
              Parents ({parents.length})
            </h2>
            <div className="space-y-2">
              {parents.map(profile => (
                <ProfileRow
                  key={profile.id}
                  profile={profile}
                  onEdit={startEdit}
                  onDelete={handleDeleteProfile}
                  onToggleAI={handleToggleAI}
                  onToggleDiet={handleToggleDiet}
                  isCurrentUser={profile.id === currentProfile?.id}
                  children={children.filter(c => c.parent_id === profile.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Children */}
        {children.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Baby className="text-purple-600 mr-2" size={20} />
              Children ({children.length})
            </h2>
            <div className="space-y-2">
              {children.map(profile => {
                const parent = allProfiles.find(p => p.id === profile.parent_id);
                return (
                  <ProfileRow
                    key={profile.id}
                    profile={profile}
                    onEdit={startEdit}
                    onDelete={handleDeleteProfile}
                    onToggleAI={handleToggleAI}
                    onToggleDiet={handleToggleDiet}
                    isCurrentUser={profile.id === currentProfile?.id}
                    parentName={parent?.name}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="card mt-6 bg-gradient-to-r from-primary-50 to-purple-50">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">System Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600">{admins.length}</div>
            <div className="text-sm text-gray-600">Admins</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{parents.length}</div>
            <div className="text-sm text-gray-600">Parents</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{teachers.length}</div>
            <div className="text-sm text-gray-600">Teachers</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">{children.length}</div>
            <div className="text-sm text-gray-600">Children</div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ProfileRowProps {
  profile: Profile;
  onEdit: (profile: Profile) => void;
  onDelete: (profile: Profile) => void;
  onToggleAI?: (profile: Profile) => void;
  onToggleDiet?: (profile: Profile) => void;
  isCurrentUser: boolean;
  children?: Profile[];
  parentName?: string;
  assignedClassName?: string;
}

function ProfileRow({ profile, onEdit, onDelete, onToggleAI, onToggleDiet, isCurrentUser, children, parentName, assignedClassName }: ProfileRowProps) {
  const getProfileIcon = (type: string) => {
    switch (type) {
      case 'admin': return <Shield className="text-red-600" size={20} />;
      case 'parent': return <User className="text-blue-600" size={20} />;
      case 'teacher': return <GraduationCap className="text-green-600" size={20} />;
      case 'child': return <Baby className="text-purple-600" size={20} />;
      default: return <User size={20} />;
    }
  };

  return (
    <div
      className={clsx(
        'flex items-center justify-between p-4 rounded-lg border',
        isCurrentUser ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-200'
      )}
    >
      <div className="flex items-center space-x-4">
        <div className="text-3xl">{profile.avatar || '👤'}</div>
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold text-gray-900">
              {profile.name}
              {isCurrentUser && <span className="ml-2 text-xs text-yellow-700 font-normal">(You)</span>}
            </h3>
            {getProfileIcon(profile.type)}
          </div>
          <div className="text-sm text-gray-600 space-x-2">
            {profile.age && <span>Age: {profile.age}</span>}
            {profile.gender && <span>• {profile.gender}</span>}
            {parentName && <span>• Parent: {parentName}</span>}
            {assignedClassName && <span className="text-green-600 font-medium">• Class: {assignedClassName}</span>}
            {profile.type === 'teacher' && !assignedClassName && <span className="text-orange-500">• No class assigned</span>}
            {profile.pin && <span>• 🔒 PIN Protected</span>}
            {(profile.type === 'child' || profile.type === 'parent') && (
              <>
                <span className={profile.ai_enabled === 1 ? 'text-purple-600' : 'text-gray-400'}>
                  • 🤖 AI {profile.ai_enabled === 1 ? 'ON' : 'OFF'}
                </span>
                <span className={(profile as any).diet_enabled === 1 ? 'text-green-600' : 'text-gray-400'}>
                  • 🥗 Diet {(profile as any).diet_enabled === 1 ? 'ON' : 'OFF'}
                </span>
              </>
            )}
          </div>
          {children && children.length > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              Children: {children.map(c => c.name).join(', ')}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* AI Access Toggle (for children and parents) */}
        {(profile.type === 'child' || profile.type === 'parent') && onToggleAI && (
          <button
            onClick={() => onToggleAI(profile)}
            className={clsx(
              'flex items-center space-x-1 px-3 py-2 rounded-lg font-medium transition-all text-sm',
              profile.ai_enabled === 1
                ? 'text-white bg-purple-600 hover:bg-purple-700 shadow-md'
                : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
            )}
            title={profile.ai_enabled === 1 ? 'Click to disable AI Assistant' : 'Click to enable AI Assistant'}
          >
            <Bot size={16} />
            <span>AI</span>
          </button>
        )}
        {/* Diet Access Toggle (for children and parents) */}
        {(profile.type === 'child' || profile.type === 'parent') && onToggleDiet && (
          <button
            onClick={() => onToggleDiet(profile)}
            className={clsx(
              'flex items-center space-x-1 px-3 py-2 rounded-lg font-medium transition-all text-sm',
              (profile as any).diet_enabled === 1
                ? 'text-white bg-green-600 hover:bg-green-700 shadow-md'
                : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
            )}
            title={(profile as any).diet_enabled === 1 ? 'Click to disable Diet' : 'Click to enable Diet'}
          >
            <span>🥗</span>
            <span>Diet</span>
          </button>
        )}
        <button
          onClick={() => onEdit(profile)}
          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
          title="Edit profile"
        >
          <Edit2 size={18} />
        </button>
        <button
          onClick={() => onDelete(profile)}
          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
          title="Delete profile"
          disabled={isCurrentUser}
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}
