import db from '../database/init';
import type { AuthRequest } from './auth';
import { DEFAULT_SCHOOL_ONLY_FEATURES, FEATURE_KEYS, type FeatureKey } from '../services/feature-keys';
import { isFeatureEnabledForProfile } from '../services/profileFeatures';

export const isSchoolOnlyModeEnabled = (): boolean => {
  const setting: any = db.prepare("SELECT value FROM settings WHERE key = 'school_only_mode'").get();
  return setting?.value === 'true';
};

/**
 * Features that remain usable in school-only mode. Admins can set
 * `school_only_allowed_features` to a JSON array (e.g. ["school","learn","activities"]);
 * 'school' is always allowed. Unknown keys are ignored.
 */
export const getSchoolOnlyAllowedFeatures = (): FeatureKey[] => {
  const setting: any = db.prepare("SELECT value FROM settings WHERE key = 'school_only_allowed_features'").get();
  let configured: FeatureKey[] = [...DEFAULT_SCHOOL_ONLY_FEATURES];

  if (setting?.value) {
    try {
      const parsed = JSON.parse(setting.value);
      if (Array.isArray(parsed)) {
        configured = parsed.filter((key): key is FeatureKey => (FEATURE_KEYS as readonly string[]).includes(key));
      }
    } catch {
      console.error('[Feature Access] Invalid school_only_allowed_features setting; using defaults');
    }
  }

  return Array.from(new Set<FeatureKey>(['school', ...configured]));
};

export const requireFeature = (featureKey: FeatureKey) => {
  return (req: AuthRequest, res: any, next: any) => {
    try {
      if (!req.profile) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Admin bypasses all feature checks
      if (req.profile.type === 'admin') {
        return next();
      }

      // School-only mode: only the configured learning components stay available
      if (isSchoolOnlyModeEnabled() && !getSchoolOnlyAllowedFeatures().includes(featureKey)) {
        return res.status(403).json({ error: 'Access denied: school-only mode is enabled' });
      }

      if (!isFeatureEnabledForProfile(req.profile, featureKey)) {
        return res.status(403).json({
          error: `Access denied: feature '${featureKey}' is disabled for this profile`
        });
      }

      next();
    } catch (error: any) {
      console.error('[Feature Access] Error:', error.message);
      res.status(500).json({ error: 'Feature access check failed' });
    }
  };
};
