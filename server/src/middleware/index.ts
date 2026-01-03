/**
 * Middleware Index
 * Enterprise SaaS Architecture - Backend Middleware Exports
 */

// Auth Middleware
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
} from './auth.middleware.js';

// Admin & Security Middleware
export {
    verifyAdmin,
    checkPermission,
    setDependencies as setAdminDependencies,
} from './admin.middleware.js';

export {
    verifySuperAdmin,
    setDependencies as setSuperAdminDependencies,
} from './superAdmin.middleware.js';

export {
    requirePermission as requirePermissionPBAC,
    requireAnyPermission,
    requireAllPermissions,
    auditAction,
    setDependencies as setPermissionDependencies,
} from './permission.middleware.js';

export {
    requireOrgAccess,
    requireRole as requireGlobalRole,
    requireOrgMember,
    requireOrgRole,
    requireOrgRoleOrHigher,
    requireConsultantScope,
    requireOwnerOrSuperadmin,
    ORG_ROLE_HIERARCHY,
} from './rbac.middleware.js';

export {
    securityHeaders,
    createRateLimiter,
    rateLimitPresets,
    validateRequest,
} from './securityHeaders.middleware.js';

// Business Middleware
export {
    default as orgContextMiddleware,
    getUserOrganizations,
    resolveUserOrgAccess,
} from './orgContext.middleware.js';

export {
    checkPlanLimit,
    PLAN_LIMITS,
    setDependencies as setPlanLimitsDependencies,
} from './planLimits.middleware.js';

export {
    enforceTokenQuota,
    enforceStorageQuota,
    recordTokenUsageAfterResponse,
    recordStorageAfterUpload,
    setDependencies as setQuotaDependencies,
} from './quota.middleware.js';

export {
    enforceProjectQuota,
    setDependencies as setProjectQuotaDependencies,
} from './projectQuota.middleware.js';

export {
    requireFeature,
    requireAccess,
    isFeatureAccessible,
    getAccessibleFeatures,
    FEATURE_REQUIREMENTS,
} from './featureGate.middleware.js';

export { validateBody } from './validation.middleware.js';

export { upload, fileFilter } from './fileUpload.middleware.js';

// Specialized Middleware
export { demoGuard } from './demoGuard.middleware.js';

export {
    trialEntryGuard,
    requireOrgContext,
    isTrialEntryUser,
    BLOCKED_ROUTES,
    setDependencies as setTrialEntryDependencies,
} from './trialEntryGuard.middleware.js';

export {
    validateInitiative,
    validateTask,
    validateInitiativeStatus,
    validateTaskStatus,
    logStatusChange,
    setDependencies as setPMOValidationDependencies,
} from './pmoValidation.middleware.js';

export {
    attachUserState,
    requireState,
    requirePhase,
    requirePermission as requireStatePermission,
    transitionState,
    USER_STATES,
    PHASES,
    setDependencies as setUserStateDependencies,
} from './userStateGuard.middleware.js';

// Re-export error handler from existing location
export { errorHandler } from './errorHandler.js';


