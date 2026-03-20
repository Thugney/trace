import db from '../database/init';
import type { AuthRequest } from './auth';
import type { FeatureKey } from '../services/feature-keys';
import { isFeatureEnabledForProfile } from '../services/profileFeatures';

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

      // Check school-only mode
      const schoolOnly: any = db.prepare("SELECT value FROM settings WHERE key = 'school_only_mode'").get();
      if (schoolOnly?.value === 'true' && featureKey !== 'school') {
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
