import { Request, Response, NextFunction } from 'express';
import db from '../database/init';

/**
 * Extended Request interface to include authenticated profile
 */
export interface AuthRequest extends Request {
  profile?: {
    id: number;
    type: 'admin' | 'parent' | 'child' | 'teacher';
    parent_id?: number;
  };
}

/**
 * Authentication Middleware
 * Verifies that the request includes a valid profile_id
 * and attaches the profile to the request object
 */
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Get profile_id from header (sent by frontend)
    const profileId = req.headers['x-profile-id'] as string;

    if (!profileId) {
      return res.status(401).json({ error: 'Authentication required: No profile ID provided' });
    }

    // Verify profile exists in database
    const profile: any = db.prepare('SELECT id, type, parent_id FROM profiles WHERE id = ?').get(profileId);

    if (!profile) {
      return res.status(401).json({ error: 'Authentication failed: Invalid profile ID' });
    }

    // Attach profile to request for use in route handlers
    req.profile = {
      id: profile.id,
      type: profile.type,
      parent_id: profile.parent_id
    };

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
      return res.status(403).json({ error: 'Access denied: You can only access your own children' });
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
  const profileId = req.headers['x-profile-id'] as string;

  if (profileId) {
    const profile: any = db.prepare('SELECT id, type, parent_id FROM profiles WHERE id = ?').get(profileId);
    if (profile) {
      req.profile = {
        id: profile.id,
        type: profile.type,
        parent_id: profile.parent_id
      };
    }
  }

  next();
};

/**
 * EventSource-Compatible Authentication Middleware
 * Supports both header-based auth (for regular requests) and query parameter auth (for EventSource)
 * EventSource cannot send custom headers, so we need to accept profile_id from query string
 */
export const authenticateEventSource = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Try header first (for regular axios requests)
    let profileId = req.headers['x-profile-id'] as string;

    // Fall back to query parameter (for EventSource)
    if (!profileId && req.query.profile_id) {
      profileId = req.query.profile_id as string;
    }

    if (!profileId) {
      return res.status(401).json({ error: 'Authentication required: No profile ID provided' });
    }

    // Verify profile exists in database
    const profile: any = db.prepare('SELECT id, type, parent_id FROM profiles WHERE id = ?').get(profileId);

    if (!profile) {
      return res.status(401).json({ error: 'Authentication failed: Invalid profile ID' });
    }

    // Attach profile to request for use in route handlers
    req.profile = {
      id: profile.id,
      type: profile.type,
      parent_id: profile.parent_id
    };

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
 * Teacher Only Middleware
 * For teacher-specific endpoints
 */
export const teacherOnly = [
  authenticate,
  requireRole(['teacher'])
];
