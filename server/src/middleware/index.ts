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
} from './auth.middleware';

// Admin & Security Middleware
export {
    verifyAdmin,
    checkPermission,
    setDependencies as setAdminDependencies,
} from './admin.middleware';

export {
    verifySuperAdmin,
    setDependencies as setSuperAdminDependencies,
} from './superAdmin.middleware';

export {
    requirePermission as requirePermissionPBAC,
    requireAnyPermission,
    requireAllPermissions,
    auditAction,
    setDependencies as setPermissionDependencies,
} from './permission.middleware';

export {
    requireOrgAccess,
    requireRole as requireGlobalRole,
    requireOrgMember,
    requireOrgRole,
    requireOrgRoleOrHigher,
    requireConsultantScope,
    requireOwnerOrSuperadmin,
    ORG_ROLE_HIERARCHY,
} from './rbac.middleware';

export {
    securityHeaders,
    createRateLimiter,
    rateLimitPresets,
    validateRequest,
} from './securityHeaders.middleware';

// Business Middleware
export {
    default as orgContextMiddleware,
    getUserOrganizations,
    resolveUserOrgAccess,
} from './orgContext.middleware';

export {
    checkPlanLimit,
    PLAN_LIMITS,
    setDependencies as setPlanLimitsDependencies,
} from './planLimits.middleware';

export {
    enforceTokenQuota,
    enforceStorageQuota,
    recordTokenUsageAfterResponse,
    recordStorageAfterUpload,
    setDependencies as setQuotaDependencies,
} from './quota.middleware';

export {
    enforceProjectQuota,
    setDependencies as setProjectQuotaDependencies,
} from './projectQuota.middleware';

export {
    requireFeature,
    requireAccess,
    isFeatureAccessible,
    getAccessibleFeatures,
    FEATURE_REQUIREMENTS,
} from './featureGate.middleware';

export { validateBody } from './validation.middleware';

export { upload, fileFilter } from './fileUpload.middleware';

// Specialized Middleware
export { demoGuard } from './demoGuard.middleware';

export {
    trialEntryGuard,
    requireOrgContext,
    isTrialEntryUser,
    BLOCKED_ROUTES,
    setDependencies as setTrialEntryDependencies,
} from './trialEntryGuard.middleware';

export {
    validateInitiative,
    validateTask,
    validateInitiativeStatus,
    validateTaskStatus,
    logStatusChange,
    setDependencies as setPMOValidationDependencies,
} from './pmoValidation.middleware';

export {
    attachUserState,
    requireState,
    requirePhase,
    requirePermission as requireStatePermission,
    transitionState,
    USER_STATES,
    PHASES,
    setDependencies as setUserStateDependencies,
} from './userStateGuard.middleware';

// Re-export error handler from existing location
export { default as errorHandler } from './errorHandler';


