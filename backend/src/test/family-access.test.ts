import { describe, expect, it } from 'vitest';
import {
  canParentManageChild,
  canViewFamilyProfile,
  getFamilyLeaderboardProfileIds,
  getManagedChildIdsForParent,
  getVisibleProfileIdsForParent
} from '../services/familyAccess.js';
import { testDb } from './setup.js';
import { createTestProfile } from './helpers.js';

describe('family access helpers', () => {
  it('collects children through legacy parent links, guardian links, and same-family access', () => {
    const familyOne = Number(testDb.prepare(`
      INSERT INTO families (name, family_type)
      VALUES ('Family One', 'A')
    `).run().lastInsertRowid);

    const familyTwo = Number(testDb.prepare(`
      INSERT INTO families (name, family_type)
      VALUES ('Family Two', 'A')
    `).run().lastInsertRowid);

    const primaryParent = createTestProfile({ name: 'Primary Parent', type: 'parent', family_id: familyOne });
    const coParent = createTestProfile({ name: 'Co-Parent', type: 'parent', family_id: familyOne });
    const legacyChild = createTestProfile({ name: 'Legacy Child', type: 'child', parent_id: primaryParent.id });
    const familyChild = createTestProfile({ name: 'Family Child', type: 'child', family_id: familyOne });
    const guardianChild = createTestProfile({ name: 'Guardian Child', type: 'child', family_id: familyTwo });
    const unrelatedChild = createTestProfile({ name: 'Unrelated Child', type: 'child', family_id: familyTwo });

    testDb.prepare(`
      INSERT INTO guardian_students (guardian_id, student_id, relationship)
      VALUES (?, ?, 'guardian')
    `).run(primaryParent.id, guardianChild.id);

    expect(getManagedChildIdsForParent(primaryParent.id)).toEqual([
      legacyChild.id,
      familyChild.id,
      guardianChild.id
    ]);
    expect(getManagedChildIdsForParent(coParent.id)).toEqual([
      legacyChild.id,
      familyChild.id
    ]);
    expect(canParentManageChild(primaryParent.id, guardianChild.id)).toBe(true);
    expect(canParentManageChild(primaryParent.id, unrelatedChild.id)).toBe(false);
  });

  it('includes co-parents in the visible family profile set for parent views', () => {
    const familyId = Number(testDb.prepare(`
      INSERT INTO families (name, family_type)
      VALUES ('Family Visible', 'A')
    `).run().lastInsertRowid);

    const primaryParent = createTestProfile({ name: 'Primary Parent', type: 'parent', family_id: familyId });
    const coParent = createTestProfile({ name: 'Co-Parent', type: 'parent', family_id: familyId });
    const child = createTestProfile({ name: 'Family Child', type: 'child', family_id: familyId });
    const outsider = createTestProfile({ name: 'Outsider', type: 'parent' });

    expect(getVisibleProfileIdsForParent(primaryParent.id)).toEqual([
      primaryParent.id,
      coParent.id,
      child.id
    ]);

    expect(canViewFamilyProfile(
      { id: primaryParent.id, type: 'parent', family_id: familyId },
      coParent.id
    )).toBe(true);
    expect(canViewFamilyProfile(
      { id: primaryParent.id, type: 'parent', family_id: familyId },
      outsider.id
    )).toBe(false);
  });

  it('builds family leaderboard membership from the same family access rules', () => {
    const familyId = Number(testDb.prepare(`
      INSERT INTO families (name, family_type)
      VALUES ('Leaderboard Family', 'A')
    `).run().lastInsertRowid);

    const parent = createTestProfile({ name: 'Parent', type: 'parent', family_id: familyId });
    const coParent = createTestProfile({ name: 'Co-Parent', type: 'parent', family_id: familyId });
    const child = createTestProfile({ name: 'Child', type: 'child', family_id: familyId });

    expect(getFamilyLeaderboardProfileIds({
      id: child.id,
      type: 'child',
      family_id: familyId,
      parent_id: parent.id
    })).toEqual([
      parent.id,
      coParent.id,
      child.id
    ]);
  });

  it('keeps legacy parent-linked children on the family leaderboard for parent viewers', () => {
    const familyId = Number(testDb.prepare(`
      INSERT INTO families (name, family_type)
      VALUES ('Legacy Leaderboard Family', 'A')
    `).run().lastInsertRowid);

    const parent = createTestProfile({ name: 'Parent', type: 'parent', family_id: familyId });
    const coParent = createTestProfile({ name: 'Co-Parent', type: 'parent', family_id: familyId });
    const legacyChild = createTestProfile({ name: 'Legacy Child', type: 'child', parent_id: parent.id });

    expect(getFamilyLeaderboardProfileIds({
      id: parent.id,
      type: 'parent',
      family_id: familyId
    })).toEqual([
      parent.id,
      coParent.id,
      legacyChild.id
    ]);
  });
});
