import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
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
  const [currentProfile, setCurrentProfileState] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const previousProfileIdRef = useRef<number | null>(null);

  // Wrapper to set profile AND localStorage IMMEDIATELY (not in useEffect)
  // This prevents race conditions where child components make API calls before localStorage is set
  const setCurrentProfile = (profile: Profile | null) => {
    if (profile) {
      localStorage.setItem('currentProfileId', profile.id.toString());
    } else {
      localStorage.removeItem('currentProfileId');
    }
    setCurrentProfileState(profile);
  };

  const refreshProfiles = useCallback(async () => {
    // Check if user is authenticated
    const authToken = localStorage.getItem('family_auth');

    try {
      if (authToken) {
        // Authenticated: use full profiles endpoint
        const response = await profilesAPI.getAll();
        setProfiles(response.data);
      } else {
        // Not authenticated: use public selector endpoint
        const response = await profilesAPI.getForSelector();
        setProfiles(response.data);
      }
    } catch (error: any) {
      // 401 errors are expected when auth is stale - silently fall back to public endpoint
      const isAuthError = error?.response?.status === 401;
      if (!isAuthError) {
        console.error('Failed to fetch profiles:', error);
      }
      // Fallback to public selector if auth fails
      try {
        const response = await profilesAPI.getForSelector();
        setProfiles(response.data);
      } catch (fallbackError) {
        console.error('Failed to fetch profiles from selector:', fallbackError);
      }
    }
  }, []);

  const refreshCurrentProfile = useCallback(async (profileId?: number) => {
    const activeProfileId = profileId ?? currentProfile?.id;

    if (!activeProfileId) {
      return;
    }

    try {
      const response = await profilesAPI.getOne(activeProfileId);
      const refreshedProfile = response.data;

      setCurrentProfileState(prev => {
        if (!prev || prev.id !== activeProfileId) {
          return prev;
        }
        return refreshedProfile;
      });

      setProfiles(prev => {
        if (!prev.some(profile => profile.id === refreshedProfile.id)) {
          return prev;
        }

        return prev.map(profile =>
          profile.id === refreshedProfile.id
            ? { ...profile, ...refreshedProfile }
            : profile
        );
      });
    } catch (error: any) {
      const statusCode = error?.response?.status;
      if (statusCode !== 401 && statusCode !== 403) {
        console.error('Failed to refresh active profile:', error);
      }
    }
  }, [currentProfile?.id]);

  // Load profiles on mount (always load - use public endpoint if not authenticated)
  useEffect(() => {
    const loadProfiles = async () => {
      setIsLoading(true);
      await refreshProfiles();
      setIsLoading(false);
    };

    loadProfiles();
  }, [refreshProfiles]);

  useEffect(() => {
    const refreshSessionState = () => {
      if (currentProfile) {
        refreshCurrentProfile(currentProfile.id);
      }

      if (localStorage.getItem('family_auth') === 'true') {
        refreshProfiles();
      }
    };

    const intervalId = setInterval(refreshSessionState, 5 * 60 * 1000);
    const handleFocus = () => refreshSessionState();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshSessionState();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [currentProfile, refreshCurrentProfile, refreshProfiles]);

  // Restore saved profile when profiles are loaded OR update current profile when profiles change.
  // Runs only when profiles change: a profile selected elsewhere must not be reverted to the
  // list entry. The selected id is unchanged here, so localStorage is already correct.
  useEffect(() => {
    if (profiles.length > 0) {
      setCurrentProfileState(currentProfile => {
        if (!currentProfile) {
          // Restore from localStorage if no profile selected
          const savedProfileId = localStorage.getItem('currentProfileId');
          if (savedProfileId) {
            const profile = profiles.find(p => p.id === parseInt(savedProfileId));
            if (profile) {
              return profile;
            }
          }
          return currentProfile;
        }

        // CRITICAL: Always update current profile with fresh data from profiles array
        // This ensures attributes like ai_enabled are always up-to-date
        const updatedProfile = profiles.find(p => p.id === currentProfile.id);
        if (updatedProfile) {
          // Check if any key attributes have changed
          const hasChanges =
            updatedProfile.ai_enabled !== currentProfile.ai_enabled ||
            updatedProfile.diet_enabled !== currentProfile.diet_enabled ||
            updatedProfile.pin !== currentProfile.pin ||
            updatedProfile.name !== currentProfile.name ||
            updatedProfile.avatar !== currentProfile.avatar;

          if (hasChanges) {
            // Profile data refreshed - settings may have changed
            return updatedProfile;
          }
        }
        return currentProfile;
      });
    }
  }, [profiles]);

  useEffect(() => {
    // Refresh profiles when user logs in or switches profiles
    // This ensures we get the correct role-based filtered data from the backend
    // Note: localStorage is set synchronously in setCurrentProfile wrapper
    if (currentProfile) {
      if (previousProfileIdRef.current !== currentProfile.id) {
        previousProfileIdRef.current = currentProfile.id;
        refreshProfiles();
        refreshCurrentProfile(currentProfile.id);
      }
    } else {
      previousProfileIdRef.current = null;
    }
  }, [currentProfile, refreshCurrentProfile, refreshProfiles]);

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
