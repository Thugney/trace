import type { NextFunction, Response } from 'express';
import db from '../database/init';
import type { AuthRequest } from '../middleware/auth';
import { canAccessOwnOrManagedChild, canViewFamilyProfile, ViewerProfile } from './familyAccess';

/**
 * Object-level authorization for learning resources (quizzes, activity
 * sessions, H5P content) and the attempts made against them.
 *
 * - manage: admin, the creator, or a guardian of the assigned child
 * - play/view: anyone who can manage, plus the assigned child
 * - attempts: the learner who owns the attempt may act on it; the learner's
 *   guardians/admin may read it
 */

type OwnedResource = {
  created_by: number | null;
  assigned_to?: number | null;
};

export function canManageOwnedResource(viewer: ViewerProfile, resource: OwnedResource): boolean {
  if (viewer.type === 'admin') {
    return true;
  }

  if (resource.created_by !== null && resource.created_by !== undefined && resource.created_by === viewer.id) {
    return true;
  }

  // Co-parents and guardians of the assigned child may manage it
  if (viewer.type === 'parent' && resource.assigned_to) {
    return canAccessOwnOrManagedChild(viewer, resource.assigned_to);
  }

  // A co-parent in the same family as the creator
  if (viewer.type === 'parent' && resource.created_by) {
    return canViewFamilyProfile(viewer, resource.created_by);
  }

  return false;
}

export function canPlayOwnedResource(viewer: ViewerProfile, resource: OwnedResource): boolean {
  if (canManageOwnedResource(viewer, resource)) {
    return true;
  }

  return Boolean(resource.assigned_to && resource.assigned_to === viewer.id);
}

export function canActOnAttempt(viewer: ViewerProfile, attemptProfileId: number): boolean {
  return viewer.id === attemptProfileId;
}

export function canViewAttempt(viewer: ViewerProfile, attemptProfileId: number): boolean {
  return canAccessOwnOrManagedChild(viewer, attemptProfileId);
}

/**
 * Profile-scoped route params (`:childId`, `:profileId`): self, managed child or admin.
 */
export function canViewLearnerData(viewer: ViewerProfile, profileId: number): boolean {
  return canAccessOwnOrManagedChild(viewer, profileId);
}

/**
 * Parent-scoped route params (`:parentId`): the parent themself, a co-parent in
 * the same family, or admin.
 */
export function canViewParentScope(viewer: ViewerProfile, parentId: number): boolean {
  if (viewer.type === 'admin') {
    return true;
  }

  if (viewer.type !== 'parent') {
    return false;
  }

  return canViewFamilyProfile(viewer, parentId);
}

/**
 * Resolve an ID from the request body (e.g. createdBy, assignedTo, profileId)
 * that must refer to the viewer or a child they manage. Returns the effective
 * ID or null when access is denied. Children always act as themselves.
 */
export function resolveActingProfileId(viewer: ViewerProfile, requested: unknown): number | null {
  if (requested === undefined || requested === null || requested === '') {
    return viewer.id;
  }

  const requestedId = Number(requested);
  if (!Number.isInteger(requestedId)) {
    return null;
  }

  return canAccessOwnOrManagedChild(viewer, requestedId) ? requestedId : null;
}

type ParamGuard = (req: AuthRequest, value: string) => boolean | 'not_found';

/**
 * Express `router.param` handler that rejects requests whose path ID the
 * authenticated viewer may not access. Using route params keeps the check in
 * one place for every endpoint that names the resource.
 */
export function paramGuard(check: ParamGuard) {
  return (req: AuthRequest, res: Response, next: NextFunction, value: string) => {
    if (!req.profile) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const result = check(req, value);
      if (result === 'not_found') {
        return res.status(404).json({ error: 'Not found' });
      }
      if (!result) {
        return res.status(403).json({ error: 'Access denied' });
      }
      next();
    } catch (error: any) {
      console.error('[Access] Param guard error:', error.message);
      res.status(500).json({ error: 'Access check failed' });
    }
  };
}

export const profileParamGuard = paramGuard((req, value) => {
  const id = Number(value);
  return Number.isInteger(id) && canViewLearnerData(req.profile!, id);
});

export const parentParamGuard = paramGuard((req, value) => {
  const id = Number(value);
  return Number.isInteger(id) && canViewParentScope(req.profile!, id);
});

const isReadOnly = (req: AuthRequest) => req.method === 'GET' || req.method === 'HEAD';

/**
 * Guard for a resource table with created_by / assigned_to columns.
 * `playSuffixes` matches request paths a player (assigned child) may use;
 * every other route naming the resource requires manage access.
 */
export function ownedResourceParamGuard(options: {
  table: string;
  playSuffixes: RegExp;
  readForPlayers?: boolean;
}) {
  return paramGuard((req, value) => {
    const resource = db.prepare(`SELECT created_by, assigned_to FROM ${options.table} WHERE id = ?`)
      .get(value) as OwnedResource | undefined;
    if (!resource) {
      return 'not_found';
    }

    const isPlayRoute = options.playSuffixes.test(req.path) || (options.readForPlayers === true && isReadOnly(req));
    return isPlayRoute
      ? canPlayOwnedResource(req.profile!, resource)
      : canManageOwnedResource(req.profile!, resource);
  });
}
