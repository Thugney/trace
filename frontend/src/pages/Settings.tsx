import { useState, useEffect } from 'react';
import { useProfile } from '../context/ProfileContext';
import { settingsAPI, remindersAPI, ReminderPreferences } from '../services/api';
import { CheckCircle } from 'lucide-react';
import {
  SettingsLayout,
  ProfileSettings,
  SecuritySettings,
  FamilyProfiles,
  AboutSection,
  ChildSettings,
  SettingsSection
} from '../components/settings';

export default function Settings() {
  const { currentProfile, isParent, isAdmin, profiles, refreshProfiles } = useProfile();
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');

  // Reminder preferences for child settings
  const [reminderPrefs, setReminderPrefs] = useState<ReminderPreferences | null>(null);
  const [savingReminders, setSavingReminders] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (currentProfile?.id) {
      loadReminderPreferences();
    }
  }, [currentProfile?.id]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsAPI.getAll();
      setSettings(response.data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReminderPreferences = async () => {
    if (!currentProfile?.id) return;
    try {
      const response = await remindersAPI.getPreferences(currentProfile.id);
      setReminderPrefs(response.data);
    } catch (error) {
      console.error('Failed to load reminder preferences:', error);
    }
  };

  const handleReminderToggle = async () => {
    if (!currentProfile?.id || !reminderPrefs) return;
    setSavingReminders(true);
    try {
      const response = await remindersAPI.updatePreferences(currentProfile.id, {
        enabled: !reminderPrefs.reminder_enabled
      });
      setReminderPrefs(response.data);
      setSuccessMessage('Reminder settings updated!');
    } catch (error) {
      console.error('Failed to update reminder preferences:', error);
    } finally {
      setSavingReminders(false);
    }
  };

  const handleReminderTimeChange = async (time: string) => {
    if (!currentProfile?.id) return;
    setSavingReminders(true);
    try {
      const response = await remindersAPI.updatePreferences(currentProfile.id, { time });
      setReminderPrefs(response.data);
      setSuccessMessage('Reminder time updated!');
    } catch (error) {
      console.error('Failed to update reminder time:', error);
    } finally {
      setSavingReminders(false);
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
  };

  // Child profile view
  if (currentProfile?.type === 'child') {
    return (
      <>
        {/* Success Toast */}
        {successMessage && (
          <div className="fixed top-4 right-4 z-50 animate-fade-in">
            <div className="bg-green-500 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
              <CheckCircle size={18} />
              <span className="font-medium">{successMessage}</span>
            </div>
          </div>
        )}

        <ChildSettings
          profile={currentProfile}
          reminderPrefs={reminderPrefs}
          onSuccess={showSuccess}
          onRefresh={refreshProfiles}
          onReminderToggle={handleReminderToggle}
          onReminderTimeChange={handleReminderTimeChange}
          savingReminders={savingReminders}
        />
      </>
    );
  }

  // Parent/Admin view
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const renderSection = () => {
    if (!currentProfile) return null;

    switch (activeSection) {
      case 'profile':
        return (
          <ProfileSettings
            profile={currentProfile}
            onSuccess={showSuccess}
            onRefresh={refreshProfiles}
          />
        );
      case 'security':
        return (
          <SecuritySettings
            profile={currentProfile}
            isParent={isParent}
            isAdmin={isAdmin}
            settings={settings}
            onSuccess={showSuccess}
            onRefresh={refreshProfiles}
            onSettingsRefresh={loadSettings}
          />
        );
      case 'family':
        return (
          <FamilyProfiles
            profiles={profiles}
            currentProfile={currentProfile}
            isParent={isParent}
            isAdmin={isAdmin}
            onSuccess={showSuccess}
            onRefresh={refreshProfiles}
          />
        );
      case 'about':
        return <AboutSection />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* Success Toast */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className="bg-green-500 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
            <CheckCircle size={18} />
            <span className="font-medium">{successMessage}</span>
          </div>
        </div>
      )}

      <SettingsLayout
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        isAdmin={isAdmin}
      >
        {renderSection()}
      </SettingsLayout>
    </>
  );
}
