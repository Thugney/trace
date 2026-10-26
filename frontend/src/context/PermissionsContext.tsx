import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { ModulePermissions, FamilyInfo } from '../types';
import { profilesAPI } from '../services/api';
import { useProfile } from './ProfileContext';

interface PermissionsContextType {
  permissions: ModulePermissions | null;
  family: FamilyInfo | null;
  isLoading: boolean;
  hasCoreAppAccess: boolean;
  hasChurchSchoolAccess: boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

// Get cached profile ID that the permissions were stored for
function getCachedPermissionsProfileId(): number | null {
  try {
    const stored = localStorage.getItem('user_permissions_profile_id');
    if (stored) {
      return parseInt(stored, 10);
    }
  } catch (e) {
    // Ignore
  }
  return null;
}

// Initialize state from localStorage synchronously to avoid flash of wrong UI
// CRITICAL: Only use cached permissions if they match the current profile!
function getInitialPermissions(currentProfileId: number | null): ModulePermissions | null {
  try {
    const cachedProfileId = getCachedPermissionsProfileId();
    // Only use cache if it was stored for this profile
    if (cachedProfileId && currentProfileId && cachedProfileId === currentProfileId) {
      const stored = localStorage.getItem('user_permissions');
      if (stored) {
        return JSON.parse(stored);
      }
    }
  } catch (e) {
    // Ignore invalid JSON
  }
  return null;
}

function getInitialFamily(currentProfileId: number | null): FamilyInfo | null {
  try {
    const cachedProfileId = getCachedPermissionsProfileId();
    // Only use cache if it was stored for this profile
    if (cachedProfileId && currentProfileId && cachedProfileId === currentProfileId) {
      const stored = localStorage.getItem('user_family');
      if (stored) {
        return JSON.parse(stored);
      }
    }
  } catch (e) {
    // Ignore invalid JSON
  }
  return null;
}

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { currentProfile } = useProfile();

  // Get current profile ID for cache validation
  const currentProfileId = currentProfile?.id || null;

  // Initialize from localStorage synchronously to avoid flash
  // CRITICAL: Pass currentProfileId to validate cache belongs to this profile
  const [permissions, setPermissions] = useState<ModulePermissions | null>(() =>
    getInitialPermissions(currentProfileId)
  );
  const [family, setFamily] = useState<FamilyInfo | null>(() =>
    getInitialFamily(currentProfileId)
  );
  // Track which profile the current permissions belong to (used internally for cache management)
  const [, setPermissionsProfileId] = useState<number | null>(
    getCachedPermissionsProfileId
  );
  // Start as loading if we don't have valid cached permissions for current profile
  const [isLoading, setIsLoading] = useState(() => {
    const cached = getInitialPermissions(currentProfileId);
    return !cached;
  });

  const refreshPermissions = useCallback(async () => {
    if (!currentProfile) {
      setPermissions(null);
      setFamily(null);
      setPermissionsProfileId(null);
      setIsLoading(false);
      return;
    }

    try {
      // Always fetch fresh permissions when profile changes
      setIsLoading(true);
      const response = await profilesAPI.getPermissions();
      const newPermissions = response.data.permissions;
      const newFamily = response.data.family || null;

      // Update state
      setPermissions(newPermissions);
      setFamily(newFamily);
      setPermissionsProfileId(currentProfile.id);

      // Update localStorage for next load - CRITICAL: also save the profile ID
      localStorage.setItem('user_permissions', JSON.stringify(newPermissions));
      localStorage.setItem('user_permissions_profile_id', String(currentProfile.id));
      if (newFamily) {
        localStorage.setItem('user_family', JSON.stringify(newFamily));
      } else {
        localStorage.removeItem('user_family');
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
      // Set default permissions based on profile type
      const defaultPerms: ModulePermissions = {
        coreApp: currentProfile.type === 'admin',
        churchSchool: true, // Everyone gets church school by default
        role: currentProfile.type
      };
      setPermissions(defaultPerms);
      setPermissionsProfileId(currentProfile.id);
    } finally {
      setIsLoading(false);
    }
  }, [currentProfile]);

  // Fetch permissions when profile changes
  useEffect(() => {
    if (currentProfile) {
      const cachedProfileId = getCachedPermissionsProfileId();

      // CRITICAL: Check if cached permissions are for THIS profile
      const cacheIsValid = cachedProfileId === currentProfile.id;

      console.log('[Permissions] Profile changed to:', currentProfile.id,
        'cached for:', cachedProfileId,
        'cache valid:', cacheIsValid);

      if (cacheIsValid) {
        // Read cached permissions for this profile
        const cachedPerms = getInitialPermissions(currentProfile.id);
        const cachedFamily = getInitialFamily(currentProfile.id);

        if (cachedPerms) {
          console.log('[Permissions] Using cached permissions for profile', currentProfile.id);
          setPermissions(cachedPerms);
          setFamily(cachedFamily);
          setPermissionsProfileId(currentProfile.id);
          setIsLoading(false);
          return;
        }
      }

      // Cache is stale or missing - fetch fresh permissions from server
      console.log('[Permissions] Cache invalid or missing, fetching from server');
      setIsLoading(true); // Show loading while fetching
      refreshPermissions();
    } else {
      // Clear permissions on logout
      setPermissions(null);
      setFamily(null);
      setPermissionsProfileId(null);
      setIsLoading(false);
      localStorage.removeItem('user_permissions');
      localStorage.removeItem('user_permissions_profile_id');
      localStorage.removeItem('user_family');
    }
  }, [currentProfile, refreshPermissions]);

  // Computed access flags
  const hasCoreAppAccess = permissions?.coreApp ?? false;
  const hasChurchSchoolAccess = permissions?.churchSchool ?? false;

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        family,
        isLoading,
        hasCoreAppAccess,
        hasChurchSchoolAccess,
        refreshPermissions
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}

/**
 * Hook to check if user has access to a specific module
 */
export function useModuleAccess(module: 'core_app' | 'church_school'): boolean {
  const { permissions } = usePermissions();

  if (!permissions) return false;

  if (module === 'core_app') {
    return permissions.coreApp;
  }

  if (module === 'church_school') {
    return permissions.churchSchool;
  }

  return false;
}

/**
 * Hook to get family type
 */
export function useFamilyType(): 'A' | 'B' | null {
  const { permissions, family } = usePermissions();

  if (family?.type) {
    return family.type;
  }

  return permissions?.familyType ?? null;
}
