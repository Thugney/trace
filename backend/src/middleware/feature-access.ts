import db from '../database/init';
import type { AuthRequest } from './auth';
import type { FeatureKey } from '../services/feature-keys';

/**
 * Get the family head (parent) for a profile
 * - If profile is a parent, return their own id
 * - If profile is a child, return their parent_id
 */
const getFamilyHeadId = (profile: any): number | null => {
  if (profile.type === 'parent') {
    return profile.id;
  }
  if (profile.type === 'child' && profile.parent_id) {
    return profile.parent_id;
  }
  return null;
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

      // Check school-only mode
      const schoolOnly: any = db.prepare("SELECT value FROM settings WHERE key = 'school_only_mode'").get();
      if (schoolOnly?.value === 'true' && featureKey !== 'school') {
        return res.status(403).json({ error: 'Access denied: school-only mode is enabled' });
      }

      // Check family-level features FIRST (admin-controlled)
      const familyHeadId = getFamilyHeadId(req.profile);
      if (familyHeadId) {
        const familyFeature: any = db.prepare(`
          SELECT enabled FROM family_features
          WHERE parent_id = ? AND feature_key = ?
        `).get(familyHeadId, featureKey);

        // If family feature exists and is disabled, deny access
        if (familyFeature && familyFeature.enabled === 0) {
          return res.status(403).json({
            error: `Access denied: feature '${featureKey}' is disabled for your family by admin`
          });
        }
      }

      // Check profile-level features (parent-controlled)
      const feature: any = db.prepare(`
        SELECT enabled FROM profile_features
        WHERE profile_id = ? AND feature_key = ?
      `).get(req.profile.id, featureKey);

      if (!feature || feature.enabled !== 1) {
        return res.status(403).json({ error: `Access denied: feature '${featureKey}' not enabled` });
      }

      next();
    } catch (error: any) {
      console.error('[Feature Access] Error:', error.message);
      res.status(500).json({ error: 'Feature access check failed' });
    }
  };
};
