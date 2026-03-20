import db from '../database/init';
import { FEATURE_KEYS, type FeatureKey } from './feature-keys';

export interface FeatureScopedProfile {
  id: number;
  type: 'admin' | 'parent' | 'child' | 'teacher';
  parent_id?: number | null;
}

const getFamilyHeadId = (profile: FeatureScopedProfile): number | null => {
  if (profile.type === 'parent') {
    return profile.id;
  }

  if (profile.type === 'child' && profile.parent_id) {
    return profile.parent_id;
  }

  return null;
};

const buildDefaultFeatureMap = () => {
  return FEATURE_KEYS.reduce((acc, featureKey) => {
    acc[featureKey] = true;
    return acc;
  }, {} as Record<FeatureKey, boolean>);
};

export function getEffectiveFeaturesForProfile(profile: FeatureScopedProfile): Record<FeatureKey, boolean> {
  if (profile.type === 'admin') {
    return buildDefaultFeatureMap();
  }

  const effectiveFeatures = buildDefaultFeatureMap();
  const familyHeadId = getFamilyHeadId(profile);

  if (familyHeadId) {
    const familyRows = db.prepare(`
      SELECT feature_key, enabled
      FROM family_features
      WHERE parent_id = ?
    `).all(familyHeadId) as Array<{ feature_key: FeatureKey; enabled: number }>;

    for (const row of familyRows) {
      effectiveFeatures[row.feature_key] = row.enabled === 1;
    }
  }

  const profileRows = db.prepare(`
    SELECT feature_key, enabled
    FROM profile_features
    WHERE profile_id = ?
  `).all(profile.id) as Array<{ feature_key: FeatureKey; enabled: number }>;

  const profileOverrides = new Map<FeatureKey, boolean>();
  for (const row of profileRows) {
    profileOverrides.set(row.feature_key, row.enabled === 1);
  }

  for (const featureKey of FEATURE_KEYS) {
    const familyEnabled = effectiveFeatures[featureKey];
    const profileEnabled = profileOverrides.has(featureKey)
      ? profileOverrides.get(featureKey)!
      : true;

    effectiveFeatures[featureKey] = familyEnabled && profileEnabled;
  }

  return effectiveFeatures;
}

export function isFeatureEnabledForProfile(profile: FeatureScopedProfile, featureKey: FeatureKey): boolean {
  return getEffectiveFeaturesForProfile(profile)[featureKey] !== false;
}
