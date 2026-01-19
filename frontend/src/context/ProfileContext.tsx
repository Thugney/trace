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

  const refreshProfiles = async () => {
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
  };

  // Load profiles on mount (always load - use public endpoint if not authenticated)
  useEffect(() => {
    const loadProfiles = async () => {
      setIsLoading(true);
      await refreshProfiles();
      setIsLoading(false);
    };

    loadProfiles();
  }, []);

  useEffect(() => {
    const refreshIfAuthenticated = () => {
      if (localStorage.getItem('family_auth') === 'true') {
        refreshProfiles();
      }
    };

    const intervalId = setInterval(refreshIfAuthenticated, 5 * 60 * 1000);
    const handleFocus = () => refreshIfAuthenticated();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshIfAuthenticated();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshProfiles]);

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
            updatedProfile.diet_enabled !== currentProfile.diet_enabled ||
            updatedProfile.pin !== currentProfile.pin ||
            updatedProfile.name !== currentProfile.name ||
            updatedProfile.avatar !== currentProfile.avatar;

          if (hasChanges) {
            // Profile data refreshed - settings may have changed
            setCurrentProfile(updatedProfile);
          }
        }
      }
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
      }
    } else {
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
