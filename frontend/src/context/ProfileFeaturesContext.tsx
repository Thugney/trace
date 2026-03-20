import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { profilesAPI } from '../services/api';
import { useProfile } from './ProfileContext';

// Map of feature keys to nav paths
export const FEATURE_TO_PATH: Record<string, string[]> = {
  tasks: ['/tasks'],
  notes: ['/notes'],
  rewards: ['/shop'],
  calendar: ['/calendar'],
  quizzes: ['/quizzes', '/quizzes/builder'],
  goals: ['/goals'],
  gamification: ['/gamification'],
  leaderboard: ['/leaderboard'],
  journey: ['/journey'],
  reminders: ['/reminders'],
  ai: ['/ai'],
  school: ['/school'],
  regular_school: ['/regular-school'],
  shopping: ['/shopping', '/shopping/help'],
  books: ['/books', '/books/read'],
  activities: ['/activities', '/activities/builder', '/h5p', '/h5p/play'],
  diet: ['/diet'],
};

const FEATURE_CACHE_PREFIX = 'profile_features_cache:';
const KNOWN_FEATURE_KEYS = Object.keys(FEATURE_TO_PATH);

const buildFailSafeFeatures = () => {
  return KNOWN_FEATURE_KEYS.reduce((acc, featureKey) => {
    acc[featureKey] = false;
    return acc;
  }, {} as Record<string, boolean>);
};

const getFeatureCacheKey = (profileId: number) => `${FEATURE_CACHE_PREFIX}${profileId}`;

const readCachedFeatures = (profileId: number) => {
  try {
    const cached = localStorage.getItem(getFeatureCacheKey(profileId));
    if (!cached) {
      return null;
    }

    const parsed = JSON.parse(cached) as {
      features?: Record<string, boolean>;
      role?: string | null;
    };

    if (!parsed.features || typeof parsed.features !== 'object') {
      return null;
    }

    return {
      features: parsed.features,
      role: parsed.role ?? null
    };
  } catch {
    return null;
  }
};

const writeCachedFeatures = (profileId: number, features: Record<string, boolean>, role: string | null) => {
  try {
    localStorage.setItem(
      getFeatureCacheKey(profileId),
      JSON.stringify({ features, role })
    );
  } catch {
    // Ignore storage failures and keep runtime state authoritative.
  }
};

// Reverse map: path to feature key
export const PATH_TO_FEATURE: Record<string, string> = {};
Object.entries(FEATURE_TO_PATH).forEach(([feature, paths]) => {
  paths.forEach(path => {
    PATH_TO_FEATURE[path] = feature;
  });
});

interface ProfileFeaturesContextType {
  features: Record<string, boolean>;
  loading: boolean;
  role: string | null;
  isFeatureEnabled: (featureKey: string) => boolean;
  isPathEnabled: (path: string) => boolean;
  refreshFeatures: () => Promise<void>;
}

const defaultContext: ProfileFeaturesContextType = {
  features: {},
  loading: true,
  role: null,
  isFeatureEnabled: () => false,
  isPathEnabled: () => false,
  refreshFeatures: async () => {},
};

const ProfileFeaturesContext = createContext<ProfileFeaturesContextType>(defaultContext);

export function ProfileFeaturesProvider({ children }: { children: ReactNode }) {
  const { currentProfile } = useProfile();
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  const refreshFeatures = useCallback(async () => {
    if (!currentProfile) {
      setFeatures({});
      setRole(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setRole(currentProfile.type);

    try {
      const response = await profilesAPI.getMyFeatures();
      setFeatures(response.data.features);
      setRole(response.data.role);
      writeCachedFeatures(currentProfile.id, response.data.features, response.data.role);
    } catch (error) {
      console.error('Failed to load profile features:', error);
      const cached = readCachedFeatures(currentProfile.id);

      if (cached) {
        setFeatures(cached.features);
        setRole(cached.role ?? currentProfile.type);
      } else {
        setFeatures(buildFailSafeFeatures());
      }
    } finally {
      setLoading(false);
    }
  }, [currentProfile]);

  useEffect(() => {
    refreshFeatures();
  }, [refreshFeatures, currentProfile?.id]);

  const isFeatureEnabled = useCallback((featureKey: string): boolean => {
    // Admin always has access
    if (role === 'admin') return true;
    if (loading && Object.keys(features).length === 0) return false;
    return features[featureKey] === true;
  }, [features, loading, role]);

  const isPathEnabled = useCallback((path: string): boolean => {
    // Always allow settings
    if (path === '/settings') return true;
    // Always allow dashboards
    if (path.includes('dashboard')) return true;

    // Find the feature key for this path
    const featureKey = PATH_TO_FEATURE[path];
    if (!featureKey) {
      // Check partial matches for paths like /books/read/:id
      for (const [checkPath, feature] of Object.entries(PATH_TO_FEATURE)) {
        if (path.startsWith(checkPath)) {
          return isFeatureEnabled(feature);
        }
      }
      return true; // Unknown paths are allowed
    }
    return isFeatureEnabled(featureKey);
  }, [isFeatureEnabled]);

  return (
    <ProfileFeaturesContext.Provider value={{
      features,
      loading,
      role,
      isFeatureEnabled,
      isPathEnabled,
      refreshFeatures
    }}>
      {children}
    </ProfileFeaturesContext.Provider>
  );
}

export function useProfileFeatures() {
  return useContext(ProfileFeaturesContext);
}
