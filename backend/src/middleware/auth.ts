import { Request, Response, NextFunction } from 'express';
import db from '../database/init';
import { authorizationService, ModuleType, ModulePermissions } from '../services/authorization';
import { extractBearerToken, isStreamToken, resolveSessionToken, ResolvedSession } from '../services/authSessions';

/**
 * Extended Request interface to include authenticated profile
 */
export interface AuthRequest extends Request {
  profile?: {
    id: number;
    type: 'admin' | 'parent' | 'child' | 'teacher';
    parent_id?: number;
    family_id?: number;
  };
  authSession?: {
    id: number;
    principalId: number;
    principalType: 'admin' | 'parent' | 'child' | 'teacher';
  };
  permissions?: ModulePermissions;
}

const attachSession = (req: AuthRequest, session: ResolvedSession) => {
  req.profile = session.profile;
  req.authSession = {
    id: session.sessionId,
    principalId: session.principalId,
    principalType: session.principalType
  };
};

/**
 * Authentication Middleware
 * Identity is derived server-side from an opaque session token sent as
 * `Authorization: Bearer <token>`. Client-supplied profile IDs (the legacy
 * x-profile-id header) are ignored.
 */
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({ error: 'Authentication required', code: 'auth_required' });
    }

    const session = resolveSessionToken(token);

    if (!session) {
      return res.status(401).json({ error: 'Session expired or invalid', code: 'session_invalid' });
    }

    attachSession(req, session);
    next();
  } catch (error: any) {
    console.error('[AUTH] Authentication error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

/**
 * Role-Based Authorization Middleware
 * Requires specific roles to access the endpoint
 *
 * Usage: requireRole(['admin', 'parent'])
 */
export const requireRole = (allowedRoles: Array<'admin' | 'parent' | 'child' | 'teacher'>) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.profile) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.profile.type)) {
      return res.status(403).json({
        error: 'Access denied: Insufficient permissions',
        required: allowedRoles,
        current: req.profile.type
      });
    }

    next();
  };
};

/**
 * Verify Parent-Child Relationship
 * Ensures that a parent can only access their own children
 *
 * Usage: verifyParentChild('studentId') // checks req.params.studentId or req.body.student_id
 */
export const verifyParentChild = (paramName: string = 'studentId') => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.profile) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Admin can access any child
    if (req.profile.type === 'admin') {
      return next();
    }

    // Only parents need to verify parent-child relationship
    if (req.profile.type !== 'parent') {
      return next();
    }

    // Get student/child ID from params or body
    const childId = req.params[paramName] || req.body[paramName] || req.body.student_id || req.body.profile_id;

    if (!childId) {
      return res.status(400).json({ error: 'Child/Student ID required' });
    }

    // Verify the child belongs to this parent
    const child: any = db.prepare('SELECT parent_id FROM profiles WHERE id = ?').get(childId);

    if (!child) {
      return res.status(404).json({ error: 'Child profile not found' });
    }

    if (child.parent_id !== req.profile.id) {
      const guardianLink: any = db.prepare(`
        SELECT 1 FROM guardian_students WHERE guardian_id = ? AND student_id = ?
      `).get(req.profile.id, childId);

      if (!guardianLink) {
        return res.status(403).json({ error: 'Access denied: You can only access your own children' });
      }
    }

    next();
  };
};

/**
 * Verify Resource Ownership
 * Ensures user can only access their own resources
 *
 * Usage: verifyOwnership('profile_id')
 */
export const verifyOwnership = (ownerField: string = 'profile_id') => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.profile) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Admin can access any resource
    if (req.profile.type === 'admin') {
      return next();
    }

    // Get resource owner from params or body
    const ownerId = req.params[ownerField] || req.body[ownerField];

    if (!ownerId) {
      return res.status(400).json({ error: 'Resource owner ID required' });
    }

    const ownerIdNum = Number(ownerId);

    // Check if user owns the resource
    if (ownerIdNum !== req.profile.id) {
      // For parents, also check if they own the child who owns the resource
      if (req.profile.type === 'parent') {
        const child: any = db.prepare('SELECT parent_id FROM profiles WHERE id = ?').get(ownerIdNum);
        if (child && child.parent_id === req.profile.id) {
          return next(); // Parent accessing their child's resource
        }
      }

      return res.status(403).json({ error: 'Access denied: You can only access your own resources' });
    }

    next();
  };
};

/**
 * Optional Authentication Middleware
 * Attaches profile if provided, but doesn't require it
 * Useful for endpoints that work both authenticated and unauthenticated
 */
export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const session = resolveSessionToken(extractBearerToken(req.headers.authorization));

  if (session) {
    attachSession(req, session);
  }

  next();
};

/**
 * EventSource-Compatible Authentication Middleware
 * EventSource and H5P iframe requests cannot send an Authorization header, so
 * they may pass a short-lived signed stream token as `?access_token=`.
 * Stream tokens are issued by POST /api/profiles/session/stream-token and are
 * bound to the session and active profile; the session token itself is never
 * accepted in a URL.
 */
export const authenticateEventSource = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let session = resolveSessionToken(extractBearerToken(req.headers.authorization), { allowStreamToken: true });

    // Only signed stream tokens may travel in a URL, never the session token itself
    if (!session && typeof req.query.access_token === 'string' && isStreamToken(req.query.access_token)) {
      session = resolveSessionToken(req.query.access_token, { allowStreamToken: true });
    }

    if (!session) {
      return res.status(401).json({ error: 'Authentication required', code: 'auth_required' });
    }

    attachSession(req, session);
    next();
  } catch (error: any) {
    console.error('[AUTH] Authentication error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

/**
 * Admin Only Middleware
 * Shortcut for admin-only endpoints
 */
export const adminOnly = [
  authenticate,
  requireRole(['admin'])
];

/**
 * Parent or Admin Middleware
 * Common combination for family management endpoints
 */
export const parentOrAdmin = [
  authenticate,
  requireRole(['parent', 'admin'])
];

/**
 * Module Access Middleware
 * Requires access to a specific module (core_app or church_school)
 * Based on family type and enrollment status
 *
 * Usage: requireModuleAccess('core_app')
 *
 * Rules:
 * - Admin: Access to all modules
 * - Teacher: Only church_school access
 * - Family A: core_app always, church_school if enrolled
 * - Family B: Only church_school access
 */
export const requireModuleAccess = (module: ModuleType) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.profile) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const hasAccess = await authorizationService.hasModuleAccess(req.profile.id, module);

      if (!hasAccess) {
        // Get user's permissions for detailed error
        const permissions = await authorizationService.getUserPermissions(req.profile.id);

        return res.status(403).json({
          error: 'Module access denied',
          module: module,
          familyType: permissions.familyType,
          message: module === 'core_app'
            ? 'Your family does not have access to core app features'
            : 'You do not have access to church school features'
        });
      }

      // Attach permissions to request for use in route handlers
      if (!req.permissions) {
        req.permissions = await authorizationService.getUserPermissions(req.profile.id);
      }

      next();
    } catch (error: any) {
      console.error('[AUTH] Module access check error:', error);
      res.status(500).json({ error: 'Authorization error' });
    }
  };
};

/**
 * Load Permissions Middleware
 * Loads user's module permissions and attaches to request
 * Does not block access, just populates req.permissions
 *
 * Usage: router.use(loadPermissions)
 */
export const loadPermissions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.profile && !req.permissions) {
    try {
      req.permissions = await authorizationService.getUserPermissions(req.profile.id);
    } catch (error) {
      console.error('[AUTH] Error loading permissions:', error);
      // Don't fail the request, just continue without permissions
    }
  }
  next();
};

/**
 * Core App Access Middleware
 * Shortcut for routes that require core_app module access
 */
export const requireCoreApp = [
  authenticate,
  requireModuleAccess('core_app')
];

/**
 * Church School Access Middleware
 * Shortcut for routes that require church_school module access
 */
export const requireChurchSchool = [
  authenticate,
  requireModuleAccess('church_school')
];

