/**
 * Authorization Service
 *
 * Handles module-level access control based on family type and enrollment status.
 * This is the core of the Family Hub two-tier access model:
 * - Family Type A: Full app access + church school if enrolled
 * - Family Type B: Church school access only
 * - Teachers: Church school access only
 * - Admin: Full access to everything
 */

import { db } from '../database/init';

export type ModuleType = 'core_app' | 'church_school';
export type PermissionLevel = 'admin' | 'parent' | 'teacher' | 'student' | 'none';

export interface ModulePermissions {
  coreApp: boolean;
  churchSchool: boolean;
  role: string;
  familyType?: 'A' | 'B';
  familyId?: number;
}

export interface Profile {
  id: number;
  name: string;
  type: 'admin' | 'parent' | 'child' | 'teacher';
  family_id?: number;
}

export interface Family {
  id: number;
  name: string;
  family_type: 'A' | 'B';
  status: string;
}

class AuthorizationService {
  /**
   * Get family_id for a profile, resolving through parent if needed
   * CRITICAL: Children may not have family_id set directly but should inherit from their parent
   */
  private getFamilyIdForProfile(profile: { id: number; type: string; family_id?: number; parent_id?: number }): number | null {
    // If profile has family_id, use it
    if (profile.family_id) {
      return profile.family_id;
    }

    // For children without family_id, try to inherit from parent
    if (profile.type === 'child') {
      // Get full profile with parent_id
      const fullProfile = db.prepare('SELECT parent_id FROM profiles WHERE id = ?').get(profile.id) as { parent_id?: number } | undefined;

      if (fullProfile?.parent_id) {
        const parent = db.prepare('SELECT family_id FROM profiles WHERE id = ?').get(fullProfile.parent_id) as { family_id?: number } | undefined;

        if (parent?.family_id) {
          // FIX: Update the child's family_id to match parent for future queries
          db.prepare('UPDATE profiles SET family_id = ? WHERE id = ?').run(parent.family_id, profile.id);
          console.log(`[Authorization] Fixed child ${profile.id} - set family_id to ${parent.family_id} from parent ${fullProfile.parent_id}`);
          return parent.family_id;
        }
      }
    }

    return null;
  }

  /**
   * Check if a user has access to a specific module
   */
  async hasModuleAccess(profileId: number, module: ModuleType): Promise<boolean> {
    const profile = db.prepare('SELECT id, type, family_id, parent_id FROM profiles WHERE id = ?').get(profileId) as (Profile & { parent_id?: number }) | undefined;

    if (!profile) {
      return false;
    }

    // Admin has access to everything
    if (profile.type === 'admin') {
      return true;
    }

    // Teachers only have church school access
    if (profile.type === 'teacher') {
      return module === 'church_school';
    }

    // For parents and children, check family type and enrollment
    if (profile.type === 'parent' || profile.type === 'child') {
      // Get family_id, resolving through parent if needed for children
      const familyId = this.getFamilyIdForProfile(profile);

      if (!familyId) {
        console.warn(`[Authorization] Profile ${profileId} (${profile.type}) has no family_id and could not resolve one`);
        return false;
      }

      const family = db.prepare('SELECT id, family_type FROM families WHERE id = ?').get(familyId) as Family | undefined;

      if (!family) {
        return false;
      }

      // Family A logic
      if (family.family_type === 'A') {
        if (module === 'core_app') {
          return true; // Family A always has core app access
        }

        if (module === 'church_school') {
          // Check if ANY child in family is enrolled in church school
          return this.familyHasChurchSchoolEnrollment(family.id);
        }
      }

      // Family B logic
      if (family.family_type === 'B') {
        if (module === 'core_app') {
          return false; // Family B NEVER has core app access
        }

        if (module === 'church_school') {
          return true; // Family B always has church school access
        }
      }
    }

    return false;
  }

  /**
   * Check if a family has any children enrolled in church school
   * CRITICAL for Family A extended permissions
   */
  familyHasChurchSchoolEnrollment(familyId: number): boolean {
    const enrollment = db.prepare(`
      SELECT COUNT(*) as count
      FROM school_enrollments
      WHERE family_id = ?
    `).get(familyId) as { count: number };

    return enrollment.count > 0;
  }

  /**
   * Get a user's complete permission set
   */
  async getUserPermissions(profileId: number): Promise<ModulePermissions> {
    const profile = db.prepare('SELECT id, type, family_id, parent_id FROM profiles WHERE id = ?').get(profileId) as (Profile & { parent_id?: number }) | undefined;

    const permissions: ModulePermissions = {
      coreApp: false,
      churchSchool: false,
      role: profile?.type || 'none'
    };

    if (!profile) {
      return permissions;
    }

    // Admin gets everything
    if (profile.type === 'admin') {
      permissions.coreApp = true;
      permissions.churchSchool = true;
      return permissions;
    }

    // Teacher gets church school only
    if (profile.type === 'teacher') {
      permissions.churchSchool = true;
      return permissions;
    }

    // Parents and children - check family type
    // CRITICAL: Use getFamilyIdForProfile to resolve family_id through parent if needed
    const familyId = this.getFamilyIdForProfile(profile);

    if (familyId) {
      const family = db.prepare('SELECT id, family_type FROM families WHERE id = ?').get(familyId) as Family | undefined;

      if (family) {
        permissions.familyType = family.family_type;
        permissions.familyId = family.id;

        if (family.family_type === 'A') {
          permissions.coreApp = true;

          // Check for church school enrollment
          permissions.churchSchool = this.familyHasChurchSchoolEnrollment(family.id);
        }

        if (family.family_type === 'B') {
          permissions.coreApp = false;
          permissions.churchSchool = true;
        }
      }
    } else {
      console.warn(`[Authorization] getUserPermissions: Profile ${profileId} (${profile.type}) has no family_id`);
    }

    return permissions;
  }

  /**
   * Check if a user can access a specific student's data
   */
  async canAccessStudentData(profileId: number, studentId: number): Promise<boolean> {
    const profile = db.prepare('SELECT id, type, family_id FROM profiles WHERE id = ?').get(profileId) as Profile | undefined;

    if (!profile) {
      return false;
    }

    // Admin can access all
    if (profile.type === 'admin') {
      return true;
    }

    // Teachers can access students in their classes
    if (profile.type === 'teacher') {
      const isInClass = db.prepare(`
        SELECT COUNT(*) as count
        FROM school_enrollments se
        JOIN teacher_class_assignments tca ON se.class_id = tca.class_id
        WHERE se.student_id = ? AND tca.teacher_id = ?
      `).get(studentId, profileId) as { count: number };

      return isInClass.count > 0;
    }

    // Parents can access their own children
    if (profile.type === 'parent') {
      // Check via family_id
      const studentProfile = db.prepare('SELECT family_id FROM profiles WHERE id = ?').get(studentId) as { family_id: number } | undefined;

      if (studentProfile && studentProfile.family_id === profile.family_id) {
        return true;
      }

      // Also check via guardian_students relationship
      const isGuardian = db.prepare(`
        SELECT COUNT(*) as count
        FROM guardian_students
        WHERE guardian_id = ? AND student_id = ?
      `).get(profileId, studentId) as { count: number };

      return isGuardian.count > 0;
    }

    // Students can only access their own data
    if (profile.type === 'child') {
      return profileId === studentId;
    }

    return false;
  }

  /**
   * Update module permissions when a student enrolls in church school
   * This grants church_school access to Family A parents
   */
  async updatePermissionsOnEnrollment(studentId: number, familyId: number): Promise<void> {
    // Get family type
    const family = db.prepare('SELECT family_type FROM families WHERE id = ?').get(familyId) as Family | undefined;

    if (!family || family.family_type !== 'A') {
      // Only Family A needs permission updates on enrollment
      return;
    }

    // Grant church_school access to all parents in this family
    const parents = db.prepare(`
      SELECT id FROM profiles WHERE family_id = ? AND type = 'parent'
    `).all(familyId) as { id: number }[];

    for (const parent of parents) {
      db.prepare(`
        INSERT OR REPLACE INTO module_permissions (profile_id, module, permission_level, granted_at)
        VALUES (?, 'church_school', 'parent', CURRENT_TIMESTAMP)
      `).run(parent.id);
    }

    // Grant church_school access to the enrolled student
    db.prepare(`
      INSERT OR REPLACE INTO module_permissions (profile_id, module, permission_level, granted_at)
      VALUES (?, 'church_school', 'student', CURRENT_TIMESTAMP)
    `).run(studentId);

    console.log(`✅ Updated permissions for Family ${familyId} after enrollment`);
  }

  /**
   * Update module permissions when a student unenrolls from church school
   * This may revoke church_school access from Family A parents if no children remain enrolled
   */
  async updatePermissionsOnUnenrollment(studentId: number, familyId: number): Promise<void> {
    // Get family type
    const family = db.prepare('SELECT family_type FROM families WHERE id = ?').get(familyId) as Family | undefined;

    if (!family || family.family_type !== 'A') {
      // Only Family A needs permission updates
      return;
    }

    // Check if any children are still enrolled
    const stillEnrolled = this.familyHasChurchSchoolEnrollment(familyId);

    if (!stillEnrolled) {
      // Revoke church_school access from all parents in this family
      db.prepare(`
        DELETE FROM module_permissions
        WHERE profile_id IN (SELECT id FROM profiles WHERE family_id = ? AND type = 'parent')
        AND module = 'church_school'
      `).run(familyId);

      console.log(`✅ Revoked church_school access from Family ${familyId} parents (no enrolled children)`);
    }

    // Revoke church_school access from the unenrolled student
    // (unless they have other enrollments)
    const studentStillEnrolled = db.prepare(`
      SELECT COUNT(*) as count FROM school_enrollments WHERE student_id = ?
    `).get(studentId) as { count: number };

    if (studentStillEnrolled.count === 0) {
      db.prepare(`
        DELETE FROM module_permissions
        WHERE profile_id = ? AND module = 'church_school'
      `).run(studentId);
    }
  }

  /**
   * Initialize permissions for a newly created profile
   */
  async initializePermissionsForProfile(profileId: number): Promise<void> {
    const profile = db.prepare('SELECT id, type, family_id FROM profiles WHERE id = ?').get(profileId) as Profile | undefined;

    if (!profile) {
      return;
    }

    // Admin gets everything
    if (profile.type === 'admin') {
      db.prepare(`
        INSERT OR REPLACE INTO module_permissions (profile_id, module, permission_level)
        VALUES (?, 'core_app', 'admin')
      `).run(profileId);
      db.prepare(`
        INSERT OR REPLACE INTO module_permissions (profile_id, module, permission_level)
        VALUES (?, 'church_school', 'admin')
      `).run(profileId);
      return;
    }

    // Teacher gets church_school only
    if (profile.type === 'teacher') {
      db.prepare(`
        INSERT OR REPLACE INTO module_permissions (profile_id, module, permission_level)
        VALUES (?, 'church_school', 'teacher')
      `).run(profileId);
      return;
    }

    // Parents and children - based on family type
    if (profile.family_id) {
      const family = db.prepare('SELECT family_type FROM families WHERE id = ?').get(profile.family_id) as Family | undefined;

      if (family) {
        if (family.family_type === 'A') {
          // Family A gets core_app
          const permLevel = profile.type === 'parent' ? 'parent' : 'student';
          db.prepare(`
            INSERT OR REPLACE INTO module_permissions (profile_id, module, permission_level)
            VALUES (?, 'core_app', ?)
          `).run(profileId, permLevel);

          // Check if family has enrolled children (for church_school access)
          if (this.familyHasChurchSchoolEnrollment(profile.family_id)) {
            db.prepare(`
              INSERT OR REPLACE INTO module_permissions (profile_id, module, permission_level)
              VALUES (?, 'church_school', ?)
            `).run(profileId, permLevel);
          }
        }

        if (family.family_type === 'B') {
          // Family B gets church_school only
          const permLevel = profile.type === 'parent' ? 'parent' : 'student';
          db.prepare(`
            INSERT OR REPLACE INTO module_permissions (profile_id, module, permission_level)
            VALUES (?, 'church_school', ?)
          `).run(profileId, permLevel);
        }
      }
    }
  }

  /**
   * Get all families with their type information
   */
  getAllFamilies(): (Family & { member_count: number })[] {
    return db.prepare(`
      SELECT f.*,
        (SELECT COUNT(*) FROM profiles WHERE family_id = f.id) as member_count
      FROM families f
      ORDER BY f.name
    `).all() as (Family & { member_count: number })[];
  }

  /**
   * Update a family's type (Admin only)
   */
  async updateFamilyType(familyId: number, newType: 'A' | 'B'): Promise<void> {
    // Update family type
    db.prepare('UPDATE families SET family_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newType, familyId);

    // Get all members of this family
    const members = db.prepare(`
      SELECT id, type FROM profiles WHERE family_id = ?
    `).all(familyId) as Profile[];

    // Update permissions for all family members
    for (const member of members) {
      if (member.type === 'parent' || member.type === 'child') {
        // Delete existing permissions
        db.prepare('DELETE FROM module_permissions WHERE profile_id = ?').run(member.id);

        // Re-initialize based on new family type
        await this.initializePermissionsForProfile(member.id);
      }
    }

    console.log(`✅ Updated family ${familyId} to Type ${newType} and refreshed all member permissions`);
  }
}

export const authorizationService = new AuthorizationService();
export default authorizationService;
