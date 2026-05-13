// @ts-nocheck
/**
 * Assessment RBAC Middleware
 * Role-based access control for assessment operations
 * Extended for multi-framework assessments (SIRI, ADMA, CMMI, LEAN)
 */

import { FrameworkRBACService } from '../services/frameworkRBACService.js';
import logger from '../utils/Logger.js';

const safeRead = (reader, fallback) => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

const normalizeOptionalString = (value) => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};
const MAX_FRAMEWORK_KEY_CHARS = 64;
const MAX_WORKFLOW_STATUS_CHARS = 128;
const MAX_CONTEXT_ID_CHARS = 128;
const sendJson = (res, statusCode, payload) => {
  if (safeRead(() => res.headersSent, false)) return false;
  try {
    res.status(statusCode).json(payload);
    return true;
  } catch {
    return false;
  }
};
const normalizeFrameworkKey = (value) => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return undefined;
  if (normalized.length > MAX_FRAMEWORK_KEY_CHARS) return null;
  return normalized;
};
const normalizeWorkflowStatus = (value) => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return undefined;
  if (normalized.length > MAX_WORKFLOW_STATUS_CHARS) return null;
  return normalized;
};
const normalizeContextId = (value) => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return undefined;
  if (normalized.length > MAX_CONTEXT_ID_CHARS) return null;
  return normalized;
};
const invokeNext = (res, next) => {
  if (safeRead(() => res.headersSent, false)) return;
  if (typeof next !== 'function') return;
  next();
};

const normalizeRoleKeyForPermissions = (role) => {
  if (role === undefined || role === null) return 'VIEWER';
  if (typeof role !== 'string') return 'VIEWER';
  const trimmed = role.trim();
  if (!trimmed) return 'VIEWER';
  return trimmed.toUpperCase();
};

const getUser = (req) => safeRead(() => req.user, undefined);
const getUserId = (req) => {
  const rawId = safeRead(() => getUser(req)?.id, undefined);
  if (typeof rawId === 'number' && Number.isInteger(rawId)) {
    return String(rawId);
  }
  return normalizeOptionalString(rawId);
};
const getUserRole = (req) =>
  normalizeOptionalString(safeRead(() => getUser(req)?.role, undefined)) || 'VIEWER';
const getOrganizationId = (req) =>
  normalizeContextId(safeRead(() => getUser(req)?.organization_id, undefined)) ??
  normalizeContextId(safeRead(() => getUser(req)?.organizationId, undefined));
const getProjectId = (req) =>
  normalizeContextId(safeRead(() => req.params?.projectId, undefined));
const getFrameworkFromRequest = (req) =>
  normalizeOptionalString(
    safeRead(() => req.params?.framework, undefined) ||
      safeRead(() => req.query?.framework, undefined) ||
      safeRead(() => req.body?.framework, undefined)
  );

// Base permissions for general roles
const hasPermission = (user, action, resource) => {
  const permissions = {
    SUPER_ADMIN: ['*'],
    ORG_ADMIN: [
      'assessment:create',
      'assessment:read',
      'assessment:update',
      'assessment:delete',
      'assessment:export',
    ],
    PROJECT_MANAGER: [
      'assessment:create',
      'assessment:read',
      'assessment:update',
      'assessment:export',
    ],
    CONSULTANT: ['assessment:create', 'assessment:read', 'assessment:export'],
    VIEWER: ['assessment:read'],
  };

  const userRole = normalizeRoleKeyForPermissions(user.role);
  const userPermissions = permissions[userRole] || [];

  // Super admin has all permissions
  if (userPermissions.includes('*')) return true;

  // Check specific permission
  return userPermissions.includes(`${resource}:${action}`);
};

// Original RBAC middleware
const assessmentRBAC = (action) => {
  return (req, res, next) => {
    const user = getUser(req);
    if (!user) {
      sendJson(res, 401, { error: 'Authentication required' });
      return;
    }

    if (!hasPermission(user, action, 'assessment')) {
      sendJson(res, 403, {
        error: 'Insufficient permissions',
        required: `assessment:${action}`,
        userRole: getUserRole(req),
      });
      return;
    }

    invokeNext(res, next);
  };
};

// ============================================
// MULTI-FRAMEWORK RBAC
// ============================================

/**
 * Multi-framework RBAC middleware
 * Checks both general permissions and framework-specific permissions
 */
const multiFrameworkRBAC = (action) => {
  return async (req, res, next) => {
    const user = getUser(req);
    const userId = getUserId(req);
    if (!user || !userId) {
      sendJson(res, 401, { error: 'Authentication required' });
      return;
    }

    // Get framework from params, query, or body
    const framework = normalizeFrameworkKey(getFrameworkFromRequest(req));
    if (framework === null) {
      sendJson(res, 400, { error: 'Invalid framework identifier' });
      return;
    }

    // If no framework specified, fall back to general assessment RBAC
    if (!framework) {
      if (!hasPermission(user, action, 'assessment')) {
        sendJson(res, 403, {
          error: 'Insufficient permissions',
          required: `assessment:${action}`,
          userRole: getUserRole(req),
        });
        return;
      }
      invokeNext(res, next);
      return;
    }
    const organizationId = getOrganizationId(req);
    const projectId = getProjectId(req);
    if (organizationId === null || projectId === null) {
      sendJson(res, 400, { error: 'Invalid project or organization identifier' });
      return;
    }

    try {
      // Check framework-specific permissions
      const hasFrameworkPerm = await FrameworkRBACService.hasPermission(
        userId,
        framework.toUpperCase(),
        action,
        {
          organizationId,
          projectId,
        }
      );

      if (!hasFrameworkPerm) {
        // Fall back to general permissions
        if (!hasPermission(user, action, 'assessment')) {
          sendJson(res, 403, {
            error: 'Insufficient permissions',
            required: `${framework.toLowerCase()}:${action}`,
            userRole: getUserRole(req),
            framework,
          });
          return;
        }
      }

      invokeNext(res, next);
    } catch (error) {
      logger.error('[MultiFrameworkRBAC] Error:', error?.message || String(error));
      // Fall back to general permissions on error
      if (!hasPermission(user, action, 'assessment')) {
        sendJson(res, 403, {
          error: 'Insufficient permissions',
          required: `assessment:${action}`,
          userRole: getUserRole(req),
        });
        return;
      }
      invokeNext(res, next);
    }
  };
};

/**
 * Check if user can approve specific framework
 */
const requireFrameworkApprover = (framework) => {
  return async (req, res, next) => {
    const userId = getUserId(req);
    if (!getUser(req) || !userId) {
      sendJson(res, 401, { error: 'Authentication required' });
      return;
    }
    const resolvedFramework = normalizeFrameworkKey(framework || getFrameworkFromRequest(req));
    if (resolvedFramework === null) {
      sendJson(res, 400, { error: 'Invalid framework identifier' });
      return;
    }

    try {
      const canApprove = await FrameworkRBACService.canApprove(
        userId,
        resolvedFramework
      );

      if (!canApprove) {
        sendJson(res, 403, {
          error: 'Approval permission denied',
          message: `User is not authorized to approve ${resolvedFramework} assessments`,
          framework: resolvedFramework,
        });
        return;
      }

      invokeNext(res, next);
    } catch (error) {
      logger.error('[RequireFrameworkApprover] Error:', error?.message || String(error));
      sendJson(res, 500, { error: 'Permission check failed' });
      return;
    }
  };
};

/**
 * Check if user can certify (for official certifications like CMMI)
 */
const requireFrameworkCertifier = (framework) => {
  return async (req, res, next) => {
    const userId = getUserId(req);
    if (!getUser(req) || !userId) {
      sendJson(res, 401, { error: 'Authentication required' });
      return;
    }
    const resolvedFramework = normalizeFrameworkKey(framework || getFrameworkFromRequest(req));
    if (resolvedFramework === null) {
      sendJson(res, 400, { error: 'Invalid framework identifier' });
      return;
    }

    try {
      const canCertify = await FrameworkRBACService.canCertify(
        userId,
        resolvedFramework
      );

      if (!canCertify) {
        sendJson(res, 403, {
          error: 'Certification permission denied',
          message: `User is not authorized to certify ${resolvedFramework} assessments. Official certification requires a certified appraiser.`,
          framework: resolvedFramework,
        });
        return;
      }

      invokeNext(res, next);
    } catch (error) {
      logger.error('[RequireFrameworkCertifier] Error:', error?.message || String(error));
      sendJson(res, 500, { error: 'Permission check failed' });
      return;
    }
  };
};

/**
 * Validate workflow transition
 */
const validateWorkflowTransition = async (req, res, next) => {
  const userId = getUserId(req);
  if (!getUser(req) || !userId) {
    sendJson(res, 401, { error: 'Authentication required' });
    return;
  }

  const fromStatus = normalizeWorkflowStatus(safeRead(() => req.body?.fromStatus, undefined));
  const toStatus = normalizeWorkflowStatus(safeRead(() => req.body?.toStatus, undefined));
  if (fromStatus === null || toStatus === null) {
    sendJson(res, 400, { error: 'Invalid workflow status value' });
    return;
  }
  const framework = normalizeFrameworkKey(getFrameworkFromRequest(req));
  if (framework === null) {
    sendJson(res, 400, { error: 'Invalid framework identifier' });
    return;
  }

  if (!fromStatus || !toStatus) {
    invokeNext(res, next); // Skip validation if statuses not provided
    return;
  }

  try {
    const validation = await FrameworkRBACService.validateWorkflowTransition(
      userId,
      framework ? framework.toUpperCase() : undefined,
      fromStatus,
      toStatus
    );

    if (!validation.allowed) {
      sendJson(res, 403, {
        error: 'Workflow transition denied',
        message: validation.reason,
        fromStatus,
        toStatus,
        framework,
      });
      return;
    }

    invokeNext(res, next);
  } catch (error) {
    logger.error('[ValidateWorkflowTransition] Error:', error?.message || String(error));
    sendJson(res, 500, { error: 'Workflow validation failed' });
    return;
  }
};

export {
  assessmentRBAC,
  hasPermission,
  multiFrameworkRBAC,
  requireFrameworkApprover,
  requireFrameworkCertifier,
  validateWorkflowTransition,
};
