import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Profile } from '../types';
import { profilesAPI } from '../services/api';

interface ProfileContextType {
  profiles: Profile[];
  currentProfile: Profile | null;
  setCurrentProfile: (profile: Profile | null) => void;
  refreshProfiles: () => Promise<void>;
  isParent: boolean;
  isLoading: boolean;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfiles = async () => {
    try {
      const response = await profilesAPI.getAll();
      setProfiles(response.data);
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
    }
  };

  useEffect(() => {
    const loadProfiles = async () => {
      setIsLoading(true);
      await refreshProfiles();

      // Try to restore last selected profile from localStorage
      const savedProfileId = localStorage.getItem('currentProfileId');
      if (savedProfileId) {
        const profile = profiles.find(p => p.id === parseInt(savedProfileId));
        if (profile) {
          setCurrentProfile(profile);
        }
      }

      setIsLoading(false);
    };

    loadProfiles();
  }, []);

  useEffect(() => {
    // Save current profile to localStorage
    if (currentProfile) {
      localStorage.setItem('currentProfileId', currentProfile.id.toString());
    } else {
      localStorage.removeItem('currentProfileId');
    }
  }, [currentProfile]);

  const isParent = currentProfile?.type === 'parent';

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        currentProfile,
        setCurrentProfile,
        refreshProfiles,
        isParent,
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
