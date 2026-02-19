import db from '../database/init';
import type { AuthRequest } from './auth';
import type { FeatureKey } from '../services/feature-keys';

export const requireFeature = (featureKey: FeatureKey) => {
  return (req: AuthRequest, res: any, next: any) => {
    try {
      if (!req.profile) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (req.profile.type === 'admin') {
        return next();
      }

      const schoolOnly: any = db.prepare("SELECT value FROM settings WHERE key = 'school_only_mode'").get();
      if (schoolOnly?.value === 'true' && featureKey !== 'school') {
        return res.status(403).json({ error: 'Access denied: school-only mode is enabled' });
      }

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
