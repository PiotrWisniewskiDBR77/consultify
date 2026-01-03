/**
 * Middleware Index
 * Enterprise SaaS Architecture - Backend Middleware Exports
 */

export {
    verifyToken,
    optionalAuth,
    requireRole,
    requireSuperAdmin,
    requireOrganization,
    requirePermission,
    setDependencies,
    type AuthRequest,
    type AuthenticatedUser,
    type JWTPayload,
} from './auth.middleware';

// Re-export error handler from existing location
export { default as errorHandler } from './errorHandler';


