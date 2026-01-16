import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { settingsAPI } from '../services/api';

interface FeatureFlags {
  diet_enabled: boolean;
}

interface FeatureFlagsContextType {
  flags: FeatureFlags;
  loading: boolean;
  refreshFlags: () => Promise<void>;
}

const defaultFlags: FeatureFlags = {
  diet_enabled: false
};

const FeatureFlagsContext = createContext<FeatureFlagsContextType>({
  flags: defaultFlags,
  loading: true,
  refreshFlags: async () => {}
});

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(defaultFlags);
  const [loading, setLoading] = useState(true);

  const refreshFlags = async () => {
    try {
      const response = await settingsAPI.getFeatureFlags();
      setFlags(response.data);
    } catch (error) {
      console.error('Failed to load feature flags:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshFlags();
    const intervalId = setInterval(refreshFlags, 5 * 60 * 1000);
    const handleFocus = () => refreshFlags();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshFlags();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <FeatureFlagsContext.Provider value={{ flags, loading, refreshFlags }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
