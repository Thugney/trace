import { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { profilesAPI, aiAPI, settingsAPI, familiesAPI } from '../services/api';
import { useFeatureFlags } from '../context/FeatureFlagsContext';
import { Profile, Family } from '../types';
import {
  AdminLayout,
  AdminTab,
  OverviewTab,
  FamiliesTab,
  FeaturesTab,
  AIControlsTab,
  SystemTab,
  CreateFamilyModal,
  CreateProfileModal
} from '../components/admin';

interface FamilyData {
  parent: { id: number; name: string; avatar: string; created_at: string };
  children: Array<{ id: number; name: string; avatar: string; age: number }>;
  features: Record<string, boolean>;
  childCount: number;
}

interface OllamaModel {
  name: string;
  size: number;
  parameterSize?: string;
  family?: string;
}

interface OllamaStatus {
  configured: boolean;
  connected: boolean;
  url: string | null;
  models: OllamaModel[];
  currentModel: string | null;
  message: string;
}

const featureOptions = [
  { key: 'school', label: 'Church School', description: 'Weekend school assignments and submissions' },
  { key: 'regular_school', label: 'Regular School', description: 'Homework tracking for regular school' },
  { key: 'shopping', label: 'Shopping', description: 'Shopping gamification and trips' },
  { key: 'books', label: 'AI Books', description: 'AI-generated personalized books' },
  { key: 'bible', label: 'Bible', description: 'Psalms in Tigrinya, English, and pronunciation layers' },
  { key: 'tasks', label: 'Tasks', description: 'Chores and daily missions' },
  { key: 'quizzes', label: 'Quizzes', description: 'Quiz builder and player' },
  { key: 'notes', label: 'Notes', description: 'Personal notes and reminders' },
  { key: 'calendar', label: 'Calendar', description: 'Schedules and reminders' },
  { key: 'goals', label: 'Goals', description: 'Monthly goals and progress' },
  { key: 'rewards', label: 'Rewards', description: 'Reward shop and claims' },
  { key: 'gamification', label: 'Gamification', description: 'Points, streaks, leaderboard' },
  { key: 'journey', label: 'Journey', description: 'Adventure map' },
  { key: 'leaderboard', label: 'Leaderboard', description: 'Family rankings' },
  { key: 'ai', label: 'AI Assistant', description: 'AI chat and insights' },
  { key: 'diet', label: 'Diet', description: 'Food tracking' }
];

export default function AdminPanel() {
  const { refreshProfiles } = useProfile();
  const { flags, refreshFlags } = useFeatureFlags();

  // Tab state
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Data state
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Family data (NEW system)
  const [families, setFamilies] = useState<Family[]>([]);
  const [unassignedProfiles, setUnassignedProfiles] = useState<Profile[]>([]);
  const [familiesLoading, setFamiliesLoading] = useState(false);

  // Legacy family data (for feature controls)
  const [legacyFamilies, setLegacyFamilies] = useState<FamilyData[]>([]);
  const [legacyFamiliesLoading, setLegacyFamiliesLoading] = useState(false);

  // Settings
  const [settings, setSettings] = useState<Record<string, any>>({});

  // Ollama
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [ollamaLoading, setOllamaLoading] = useState(false);

  // Modals
  const [showCreateFamilyModal, setShowCreateFamilyModal] = useState(false);
  const [editingFamily, setEditingFamily] = useState<Family | null>(null);
  const [showCreateProfileModal, setShowCreateProfileModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

  // Load data on mount
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadProfiles(),
      loadFamilies(),
      loadLegacyFamilies(),
      loadSettings(),
      loadOllamaStatus()
    ]);
    setLoading(false);
  };

  const loadProfiles = async () => {
    try {
      const response = await profilesAPI.getAll();
      setAllProfiles(response.data);
    } catch (error) {
      console.error('Failed to load profiles:', error);
    }
  };

  const loadFamilies = async () => {
    try {
      setFamiliesLoading(true);
      const [familiesRes, unassignedRes] = await Promise.all([
        familiesAPI.getAll(),
        familiesAPI.getUnassigned()
      ]);
      setFamilies(familiesRes.data);
      setUnassignedProfiles(unassignedRes.data);
    } catch (error) {
      console.error('Failed to load families:', error);
    } finally {
      setFamiliesLoading(false);
    }
  };

  const loadLegacyFamilies = async () => {
    try {
      setLegacyFamiliesLoading(true);
      const response = await profilesAPI.getAdminFamilies();
      setLegacyFamilies(response.data.families);
    } catch (error) {
      console.error('Failed to load legacy families:', error);
    } finally {
      setLegacyFamiliesLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await settingsAPI.getAll();
      // Backend returns a key-value object directly, not an array
      if (response.data && typeof response.data === 'object') {
        setSettings(response.data);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const loadOllamaStatus = async () => {
    try {
      setOllamaLoading(true);
      const response = await settingsAPI.getOllamaStatus();
      setOllamaStatus(response.data);
    } catch (error) {
      console.error('Failed to load Ollama status:', error);
      setOllamaStatus(null);
    } finally {
      setOllamaLoading(false);
    }
  };

  const loadFamilyMembers = async (familyId: number) => {
    try {
      const familyDetail = await familiesAPI.getOne(familyId);
      setFamilies(prev =>
        prev.map(f => f.id === familyId ? { ...f, members: familyDetail.data.members } : f)
      );
    } catch (error) {
      console.error('Failed to load family members:', error);
    }
  };

  // Family Actions
  const handleCreateFamily = async (name: string, description?: string, familyType?: 'A' | 'B') => {
    await familiesAPI.create({ name, description, family_type: familyType || 'A' });
    await loadFamilies();
  };

  const handleUpdateFamily = async (name: string, description?: string, familyType?: 'A' | 'B') => {
    if (!editingFamily) return;
    await familiesAPI.update(editingFamily.id, { name, description, family_type: familyType });
    setEditingFamily(null);
    await loadFamilies();
  };

  const handleDeleteFamily = async (family: Family) => {
    if (!confirm(`Are you sure you want to delete "${family.name}"? Members will be unassigned but NOT deleted.`)) {
      return;
    }
    await familiesAPI.delete(family.id);
    await loadFamilies();
  };

  const handleToggleFamilyStatus = async (family: Family) => {
    const newStatus = family.status === 'active' ? 'suspended' : 'active';
    await familiesAPI.update(family.id, { status: newStatus });
    await loadFamilies();
  };

  const handleAssignToFamily = async (familyId: number, profileId: number) => {
    await familiesAPI.addMember(familyId, profileId);
    await loadFamilies();
    await loadProfiles();
  };

  const handleRemoveFromFamily = async (familyId: number, profileId: number, profileName: string) => {
    if (!confirm(`Remove ${profileName} from this family?`)) return;
    await familiesAPI.removeMember(familyId, profileId);
    await loadFamilies();
    await loadProfiles();
  };

  // Profile Actions
  const handleCreateProfile = async (data: Partial<Profile>) => {
    await profilesAPI.create(data);
    await loadProfiles();
    await loadFamilies();
    await refreshProfiles();
  };

  const handleUpdateProfile = async (data: Partial<Profile>) => {
    if (!editingProfile) return;
    await profilesAPI.update(editingProfile.id, data);
    setEditingProfile(null);
    await loadProfiles();
    await loadFamilies();
    await refreshProfiles();
  };

  const handleDeleteProfile = async (profile: Profile) => {
    if (!confirm(`Are you sure you want to delete ${profile.name}? This action cannot be undone.`)) {
      return;
    }
    await profilesAPI.delete(profile.id);
    await loadProfiles();
    await loadFamilies();
    await refreshProfiles();
  };

  // AI Actions
  const handleToggleAI = async (profile: Profile) => {
    const newAiEnabled = profile.ai_enabled === 1 ? 0 : 1;
    await profilesAPI.update(profile.id, { ai_enabled: newAiEnabled });
    await loadProfiles();
    await refreshProfiles();
    const status = newAiEnabled === 1 ? 'enabled' : 'disabled';
    alert(`AI Assistant ${status} for ${profile.name}.\n\n${profile.name} will need to log out and log back in to see the changes.`);
  };

  const handleToggleDiet = async (profile: Profile) => {
    const newDietEnabled = (profile as any).diet_enabled === 1 ? 0 : 1;
    await profilesAPI.update(profile.id, { diet_enabled: newDietEnabled });
    if (newDietEnabled === 1) {
      await settingsAPI.set('diet_feature_enabled', 'true');
      await refreshFlags();
    }
    await loadProfiles();
    await refreshProfiles();
    const status = newDietEnabled === 1 ? 'enabled' : 'disabled';
    alert(`Diet Tracking ${status} for ${profile.name}.`);
  };

  const handleUpdateMessageLimit = async (profile: Profile, limitType: 'limited' | 'extended' | 'unlimited') => {
    await aiAPI.updateMessageLimit(profile.id, limitType);
    const limitDesc = limitType === 'limited' ? '5/day' : limitType === 'extended' ? '20/day' : 'unlimited';
    alert(`AI message limit updated for ${profile.name}.\n\nNew limit: ${limitDesc}`);
  };

  // Feature Actions
  const handleSaveFamilyFeatures = async (parentId: number, features: Record<string, boolean>) => {
    await profilesAPI.updateFamilyFeatures(parentId, features);
    await loadLegacyFamilies();
    alert('Family feature access updated successfully.');
  };

  // System Actions
  const handleToggleSchoolOnlyMode = async () => {
    const nextValue = flags.school_only_mode ? 'false' : 'true';
    await settingsAPI.set('school_only_mode', nextValue);
    await refreshFlags();
    alert(`School-only mode ${nextValue === 'true' ? 'enabled' : 'disabled'}.`);
  };

  const handleSaveGrokKey = async (key: string) => {
    await settingsAPI.set('grok_api_key', key);
    await settingsAPI.set('grok_api_enabled', 'true');
    await loadSettings();
    alert('Grok API key saved successfully!');
  };

  const handleConfigureOllama = async (url: string, model: string) => {
    await settingsAPI.configureOllama({ url, model });
    await loadOllamaStatus();
    alert('Ollama configuration saved!');
  };

  const handleTestOllama = async (model: string) => {
    try {
      await settingsAPI.testOllama(model);
      alert(`Model "${model}" is working correctly!`);
    } catch (error) {
      alert(`Failed to test model "${model}". Please check the configuration.`);
    }
  };

  const handlePullOllamaModel = async (model: string) => {
    try {
      await settingsAPI.pullOllamaModel(model);
      alert(`Started pulling model "${model}". This may take a few minutes.`);
      setTimeout(loadOllamaStatus, 5000);
    } catch (error) {
      alert(`Failed to pull model "${model}".`);
    }
  };

  // Get available parents for profile creation
  const availableParents = allProfiles.filter(p => p.type === 'parent' || p.type === 'admin');

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <OverviewTab
            profiles={allProfiles}
            families={families}
            loading={loading}
            schoolOnlyMode={flags.school_only_mode}
            onToggleSchoolOnlyMode={handleToggleSchoolOnlyMode}
            onRefresh={loadAllData}
            onCreateProfile={() => {
              setEditingProfile(null);
              setShowCreateProfileModal(true);
            }}
            onCreateFamily={() => {
              setEditingFamily(null);
              setShowCreateFamilyModal(true);
            }}
          />
        );

      case 'families':
        return (
          <FamiliesTab
            families={families}
            unassignedProfiles={unassignedProfiles}
            loading={familiesLoading}
            onCreateFamily={() => {
              setEditingFamily(null);
              setShowCreateFamilyModal(true);
            }}
            onEditFamily={(family) => {
              setEditingFamily(family);
              setShowCreateFamilyModal(true);
            }}
            onDeleteFamily={handleDeleteFamily}
            onToggleFamilyStatus={handleToggleFamilyStatus}
            onAssignToFamily={handleAssignToFamily}
            onRemoveFromFamily={handleRemoveFromFamily}
            onLoadFamilyMembers={loadFamilyMembers}
            onRefresh={loadFamilies}
            onCreateProfile={() => {
              setEditingProfile(null);
              setShowCreateProfileModal(true);
            }}
            onEditProfile={(profile) => {
              setEditingProfile(profile);
              setShowCreateProfileModal(true);
            }}
            onDeleteProfile={handleDeleteProfile}
          />
        );

      case 'features':
        return (
          <FeaturesTab
            families={legacyFamilies}
            loading={legacyFamiliesLoading}
            featureOptions={featureOptions}
            onSaveFamilyFeatures={handleSaveFamilyFeatures}
            onRefresh={loadLegacyFamilies}
          />
        );

      case 'ai-controls':
        return (
          <AIControlsTab
            profiles={allProfiles}
            loading={loading}
            onToggleAI={handleToggleAI}
            onToggleDiet={handleToggleDiet}
            onUpdateMessageLimit={handleUpdateMessageLimit}
            onRefresh={loadProfiles}
          />
        );

      case 'system':
        return (
          <SystemTab
            settings={settings}
            ollamaStatus={ollamaStatus}
            ollamaLoading={ollamaLoading}
            onSaveGrokKey={handleSaveGrokKey}
            onConfigureOllama={handleConfigureOllama}
            onTestOllama={handleTestOllama}
            onPullOllamaModel={handlePullOllamaModel}
            onRefreshOllama={loadOllamaStatus}
          />
        );

      default:
        return null;
    }
  };

  return (
    <>
      <AdminLayout
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        {renderTabContent()}
      </AdminLayout>

      {/* Modals */}
      {showCreateFamilyModal && (
        <CreateFamilyModal
          onClose={() => {
            setShowCreateFamilyModal(false);
            setEditingFamily(null);
          }}
          onSubmit={editingFamily ? handleUpdateFamily : handleCreateFamily}
          editingFamily={editingFamily ? { name: editingFamily.name, description: editingFamily.description, family_type: editingFamily.family_type } : null}
        />
      )}

      {showCreateProfileModal && (
        <CreateProfileModal
          onClose={() => {
            setShowCreateProfileModal(false);
            setEditingProfile(null);
          }}
          onSubmit={editingProfile ? handleUpdateProfile : handleCreateProfile}
          editingProfile={editingProfile}
          availableParents={availableParents}
        />
      )}
    </>
  );
}
