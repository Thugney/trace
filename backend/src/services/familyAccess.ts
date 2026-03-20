import db from '../database/init';

type ParentProfileRow = {
  id: number;
  type: 'admin' | 'parent' | 'child' | 'teacher';
  family_id: number | null;
  parent_id?: number | null;
};

type ChildIdRow = {
  id: number;
};

export type ViewerProfile = {
  id: number;
  type: 'admin' | 'parent' | 'child' | 'teacher';
  family_id?: number | null;
  parent_id?: number | null;
};

function getParentIdsByFamilyId(familyId: number): number[] {
  const rows = db.prepare(`
    SELECT id
    FROM profiles
    WHERE type = 'parent' AND family_id = ?
    ORDER BY id
  `).all(familyId) as ChildIdRow[];

  return rows.map((row) => row.id);
}

function filterParentIds(profileIds: number[]): number[] {
  if (profileIds.length === 0) {
    return [];
  }

  const placeholders = profileIds.map(() => '?').join(', ');
  const rows = db.prepare(`
    SELECT id
    FROM profiles
    WHERE type = 'parent' AND id IN (${placeholders})
    ORDER BY id
  `).all(...profileIds) as ChildIdRow[];

  return rows.map((row) => row.id);
}

/**
 * Returns all child profile IDs a parent can manage.
 * Supports legacy parent_id, explicit guardian links, and same-family access.
 */
export function getManagedChildIdsForParent(parentId: number): number[] {
  const parent = db.prepare(`
    SELECT id, type, family_id
    FROM profiles
    WHERE id = ?
  `).get(parentId) as ParentProfileRow | undefined;

  if (!parent || parent.type !== 'parent') {
    return [];
  }

  const rows = db.prepare(`
    SELECT DISTINCT p.id
    FROM profiles p
    LEFT JOIN profiles pp
      ON pp.id = p.parent_id
    LEFT JOIN guardian_students gs
      ON gs.student_id = p.id
     AND gs.guardian_id = ?
    WHERE p.type = 'child'
      AND (
        p.parent_id = ?
        OR gs.guardian_id IS NOT NULL
        OR (
          ? IS NOT NULL
          AND (
            p.family_id = ?
            OR pp.family_id = ?
          )
        )
      )
    ORDER BY p.id
  `).all(
    parentId,
    parentId,
    parent.family_id,
    parent.family_id,
    parent.family_id
  ) as ChildIdRow[];

  return rows.map((row) => row.id);
}

export function canParentManageChild(parentId: number, childId: number): boolean {
  return getManagedChildIdsForParent(parentId).includes(childId);
}

export function getVisibleProfileIdsForParent(parentId: number): number[] {
  const parent = db.prepare(`
    SELECT id, type, family_id
    FROM profiles
    WHERE id = ?
  `).get(parentId) as ParentProfileRow | undefined;

  if (!parent || parent.type !== 'parent') {
    return [];
  }

  const ids = new Set<number>([parentId]);

  if (parent.family_id !== null && parent.family_id !== undefined) {
    const familyParentRows = db.prepare(`
      SELECT id
      FROM profiles
      WHERE type = 'parent' AND family_id = ?
      ORDER BY id
    `).all(parent.family_id) as ChildIdRow[];

    familyParentRows.forEach((row) => ids.add(row.id));
  }

  getManagedChildIdsForParent(parentId).forEach((childId) => ids.add(childId));

  return Array.from(ids).sort((a, b) => a - b);
}

export function canParentViewFamilyProfile(parentId: number, targetProfileId: number): boolean {
  return getVisibleProfileIdsForParent(parentId).includes(targetProfileId);
}

export function canAccessOwnOrManagedChild(viewer: ViewerProfile, targetProfileId: number): boolean {
  if (viewer.type === 'admin') {
    return true;
  }

  if (viewer.id === targetProfileId) {
    return true;
  }

  if (viewer.type === 'parent') {
    return canParentManageChild(viewer.id, targetProfileId);
  }

  return false;
}

export function canViewFamilyProfile(viewer: ViewerProfile, targetProfileId: number): boolean {
  if (viewer.type === 'admin') {
    return true;
  }

  if (viewer.id === targetProfileId) {
    return true;
  }

  if (viewer.type === 'parent') {
    return canParentViewFamilyProfile(viewer.id, targetProfileId);
  }

  return false;
}

export function getFamilyLeaderboardProfileIds(viewer: ViewerProfile): number[] {
  if (viewer.type === 'admin') {
    return [];
  }

  if (viewer.family_id !== null && viewer.family_id !== undefined) {
    const rows = db.prepare(`
      SELECT id
      FROM profiles
      WHERE family_id = ? AND type IN ('parent', 'child')
      ORDER BY id
    `).all(viewer.family_id) as ChildIdRow[];

    return rows.map((row) => row.id);
  }

  if (viewer.type === 'parent') {
    return getVisibleProfileIdsForParent(viewer.id);
  }

  if (viewer.type === 'child' && viewer.parent_id) {
    return getVisibleProfileIdsForParent(viewer.parent_id);
  }

  return [viewer.id];
}

export function getAccessibleParentIds(viewer: ViewerProfile): number[] {
  if (viewer.type === 'admin') {
    const rows = db.prepare(`
      SELECT id
      FROM profiles
      WHERE type = 'parent'
      ORDER BY id
    `).all() as ChildIdRow[];

    return rows.map((row) => row.id);
  }

  if (viewer.type === 'parent') {
    if (viewer.family_id !== null && viewer.family_id !== undefined) {
      return getParentIdsByFamilyId(viewer.family_id);
    }

    return [viewer.id];
  }

  if (viewer.family_id !== null && viewer.family_id !== undefined) {
    return getParentIdsByFamilyId(viewer.family_id);
  }

  if (viewer.parent_id) {
    return filterParentIds(getVisibleProfileIdsForParent(viewer.parent_id));
  }

  return [];
}
