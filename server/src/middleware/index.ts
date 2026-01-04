/**
 * Middleware Index
 * Enterprise SaaS Architecture - Backend Middleware Exports
 */

// Auth Middleware
export {
    type AuthenticatedUser,
    type AuthRequest,
    type JWTPayload,
    optionalAuth,
    requireOrganization,
    requirePermission,
    requireRole,
    requireSuperAdmin,
    setDependencies,
    verifyToken,
} from './auth.middleware.js';

// Admin & Security Middleware
export { checkPermission, setDependencies as setAdminDependencies, verifyAdmin } from './admin.middleware.js';
export {
    auditAction,
    requireAllPermissions,
    requireAnyPermission,
    requirePermission as requirePermissionPBAC,
    setDependencies as setPermissionDependencies,
} from './permission.middleware.js';
export {
    ORG_ROLE_HIERARCHY,
    requireConsultantScope,
    requireRole as requireGlobalRole,
    requireOrgAccess,
    requireOrgMember,
    requireOrgRole,
    requireOrgRoleOrHigher,
    requireOwnerOrSuperadmin,
} from './rbac.middleware.js';
export { createRateLimiter, rateLimitPresets, securityHeaders, validateRequest } from './securityHeaders.middleware.js';
export { setDependencies as setSuperAdminDependencies, verifySuperAdmin } from './superAdmin.middleware.js';

// Business Middleware
export {
    FEATURE_REQUIREMENTS,
    getAccessibleFeatures,
    isFeatureAccessible,
    requireAccess,
    requireFeature,
} from './featureGate.middleware.js';
export { fileFilter, upload } from './fileUpload.middleware.js';
export {
    getUserOrganizations,
    default as orgContextMiddleware,
    resolveUserOrgAccess,
} from './orgContext.middleware.js';
export { checkPlanLimit, PLAN_LIMITS, setDependencies as setPlanLimitsDependencies } from './planLimits.middleware.js';
export { enforceProjectQuota, setDependencies as setProjectQuotaDependencies } from './projectQuota.middleware.js';
export {
    enforceStorageQuota,
    enforceTokenQuota,
    recordStorageAfterUpload,
    recordTokenUsageAfterResponse,
    setDependencies as setQuotaDependencies,
} from './quota.middleware.js';
export { validateBody } from './validation.middleware.js';

// Specialized Middleware
export { demoGuard } from './demoGuard.middleware.js';
export {
    logStatusChange,
    setDependencies as setPMOValidationDependencies,
    validateInitiative,
    validateInitiativeStatus,
    validateTask,
    validateTaskStatus,
} from './pmoValidation.middleware.js';
export {
    BLOCKED_ROUTES,
    isTrialEntryUser,
    requireOrgContext,
    setDependencies as setTrialEntryDependencies,
    trialEntryGuard,
} from './trialEntryGuard.middleware.js';
export {
    attachUserState,
    PHASES,
    requirePhase,
    requireState,
    requirePermission as requireStatePermission,
    setDependencies as setUserStateDependencies,
    transitionState,
    USER_STATES,
} from './userStateGuard.middleware.js';

// Re-export error handler from existing location
export { errorHandler } from './errorHandler.js';
