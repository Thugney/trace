import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { settingsAPI } from '../services/api';

interface FeatureFlags {
  diet_enabled: boolean;
}

interface FeatureFlagsContextType {
  flags: FeatureFlags;
  loading: boolean;
}

const defaultFlags: FeatureFlags = {
  diet_enabled: false
};

const FeatureFlagsContext = createContext<FeatureFlagsContextType>({
  flags: defaultFlags,
  loading: true
});

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(defaultFlags);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFlags = async () => {
      try {
        const response = await settingsAPI.getFeatureFlags();
        setFlags(response.data);
      } catch (error) {
        console.error('Failed to load feature flags:', error);
        // Keep default flags on error
      } finally {
        setLoading(false);
      }
    };

    loadFlags();
  }, []);

  return (
    <FeatureFlagsContext.Provider value={{ flags, loading }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
