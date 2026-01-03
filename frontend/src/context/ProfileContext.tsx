import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Profile } from '../types';
import { profilesAPI } from '../services/api';

interface ProfileContextType {
  profiles: Profile[];
  currentProfile: Profile | null;
  setCurrentProfile: (profile: Profile | null) => void;
  refreshProfiles: () => Promise<void>;
  isParent: boolean;
  isAdmin: boolean;
  isLoading: boolean;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const previousProfileIdRef = useRef<number | null>(null);

  const refreshProfiles = async () => {
    try {
      const response = await profilesAPI.getAll();
      setProfiles(response.data);
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
    }
  };

  // Load profiles on mount
  useEffect(() => {
    const loadProfiles = async () => {
      setIsLoading(true);
      await refreshProfiles();
      setIsLoading(false);
    };

    loadProfiles();
  }, []);

  // Restore saved profile when profiles are loaded OR update current profile when profiles change
  useEffect(() => {
    if (profiles.length > 0) {
      if (!currentProfile) {
        // Restore from localStorage if no profile selected
        const savedProfileId = localStorage.getItem('currentProfileId');
        if (savedProfileId) {
          const profile = profiles.find(p => p.id === parseInt(savedProfileId));
          if (profile) {
            setCurrentProfile(profile);
          }
        }
      } else {
        // CRITICAL: Always update current profile with fresh data from profiles array
        // This ensures attributes like ai_enabled are always up-to-date
        const updatedProfile = profiles.find(p => p.id === currentProfile.id);
        if (updatedProfile) {
          // Check if any key attributes have changed
          const hasChanges =
            updatedProfile.ai_enabled !== currentProfile.ai_enabled ||
            updatedProfile.pin !== currentProfile.pin ||
            updatedProfile.name !== currentProfile.name ||
            updatedProfile.avatar !== currentProfile.avatar;

          if (hasChanges) {
            console.log('[ProfileContext] Current profile updated with fresh data:', {
              ai_enabled: updatedProfile.ai_enabled,
              name: updatedProfile.name
            });
            setCurrentProfile(updatedProfile);
          }
        }
      }
    }
  }, [profiles]);

  useEffect(() => {
    // Save current profile to localStorage
    if (currentProfile) {
      localStorage.setItem('currentProfileId', currentProfile.id.toString());

      // CRITICAL FIX: Refresh profiles when user logs in or switches profiles
      // This ensures we get the correct role-based filtered data from the backend
      if (previousProfileIdRef.current !== currentProfile.id) {
        console.log(`[ProfileContext] Profile changed (${previousProfileIdRef.current} -> ${currentProfile.id}), refreshing profiles...`);
        previousProfileIdRef.current = currentProfile.id;
        refreshProfiles();
      }
    } else {
      localStorage.removeItem('currentProfileId');
      previousProfileIdRef.current = null;
    }
  }, [currentProfile]);

  const isParent = currentProfile?.type === 'parent';
  const isAdmin = currentProfile?.type === 'admin';

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        currentProfile,
        setCurrentProfile,
        refreshProfiles,
        isParent,
        isAdmin,
        isLoading
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
