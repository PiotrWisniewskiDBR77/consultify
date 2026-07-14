// @ts-nocheck
/**
 * Assessment RBAC Middleware
 * Role-based access control for assessment operations
 * Extended for multi-framework assessments (SIRI, ADMA, CMMI, LEAN)
 */

import { FrameworkRBACService } from '../services/frameworkRBACService.js';
import logger from '../utils/Logger.js';

// Validation constants
const MAX_FRAMEWORK_KEY_LEN = 64;
const MAX_ID_LEN = 128;
const MAX_STATUS_LEN = 128;

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

  // Normalize role: trim whitespace, uppercase; blank/missing → VIEWER
  const rawRole = user.role;
  let normalizedRole: string;
  if (rawRole === undefined || rawRole === null) {
    normalizedRole = 'VIEWER';
  } else {
    const trimmed = String(rawRole).trim();
    normalizedRole = trimmed === '' ? 'VIEWER' : trimmed.toUpperCase();
  }

  const userPermissions = permissions[normalizedRole] || permissions['VIEWER'] || [];

  // Super admin has all permissions
  if (userPermissions.includes('*')) return true;

  // Check specific permission
  return userPermissions.includes(`${resource}:${action}`);
};

// Original RBAC middleware
const assessmentRBAC = (action) => {
  return (req, res, next) => {
    if (!req.user) {
      if (res.headersSent) return;
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!hasPermission(req.user, action, 'assessment')) {
      if (res.headersSent) return;
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: `assessment:${action}`,
        userRole: req.user.role,
      });
    }

    next();
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
    // Guard: user accessor might throw
    let user: any;
    try {
      user = req.user;
    } catch (_e) {
      if (!res.headersSent) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      return;
    }

    if (!user) {
      if (!res.headersSent) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      return;
    }

    // Get framework from params/query/body — any accessor might throw
    let framework: string | undefined;
    try {
      framework = req.params.framework || req.query.framework || req.body?.framework;
    } catch (_e) {
      // Accessor failed — treat as no framework, fall back to general allow
      if (!res.headersSent) {
        if (!hasPermission(user, action, 'assessment')) {
          return res.status(403).json({
            error: 'Insufficient permissions',
            required: `assessment:${action}`,
            userRole: user.role,
          });
        }
        return next();
      }
      return;
    }

    // Validate framework key length
    if (framework && framework.length > MAX_FRAMEWORK_KEY_LEN) {
      if (!res.headersSent) {
        return res.status(400).json({ error: 'Invalid framework identifier' });
      }
      return;
    }

    // If no framework specified, fall back to general assessment RBAC
    if (!framework) {
      if (res.headersSent) return;
      if (!hasPermission(user, action, 'assessment')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: `assessment:${action}`,
          userRole: user.role,
        });
      }
      return next();
    }

    // Validate projectId length
    let projectId: string | undefined;
    try {
      projectId = req.params.projectId;
    } catch (_e) {
      projectId = undefined;
    }

    if (projectId !== undefined && projectId !== null && String(projectId).length > MAX_ID_LEN) {
      if (!res.headersSent) {
        return res.status(400).json({ error: 'Invalid project or organization identifier' });
      }
      return;
    }

    // Resolve organizationId — organization_id accessor might throw
    let organizationId: string | undefined;
    try {
      organizationId = user.organization_id;
    } catch (_e) {
      try {
        organizationId = user.organizationId;
      } catch (_e2) {
        organizationId = undefined;
      }
    }

    // Coerce user id to string
    const userId = user.id !== undefined && user.id !== null ? String(user.id) : user.id;

    try {
      // Check framework-specific permissions
      const hasFrameworkPerm = await FrameworkRBACService.hasPermission(
        userId,
        framework.toUpperCase(),
        action,
        {
          organizationId,
          projectId: projectId !== undefined ? projectId : undefined,
        }
      );

      if (!hasFrameworkPerm) {
        // Fall back to general permissions
        if (!hasPermission(user, action, 'assessment')) {
          if (!res.headersSent) {
            return res.status(403).json({
              error: 'Insufficient permissions',
              required: `${framework.toLowerCase()}:${action}`,
              userRole: user.role,
              framework,
            });
          }
          return;
        }
      }

      if (!res.headersSent) {
        next();
      }
    } catch (error) {
      logger.error('[MultiFrameworkRBAC] Error:', error.message);
      // Fall back to general permissions on error
      if (!res.headersSent) {
        if (!hasPermission(user, action, 'assessment')) {
          return res.status(403).json({
            error: 'Insufficient permissions',
            required: `assessment:${action}`,
            userRole: user.role,
          });
        }
        next();
      }
    }
  };
};

/**
 * Check if user can approve specific framework
 */
const requireFrameworkApprover = (framework) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Resolve the framework to use
    let resolvedFramework: string | undefined;
    try {
      resolvedFramework = framework || req.params.framework || req.query.framework;
    } catch (_e) {
      resolvedFramework = framework;
    }

    // Validate framework key length
    if (resolvedFramework && resolvedFramework.length > MAX_FRAMEWORK_KEY_LEN) {
      return res.status(400).json({ error: 'Invalid framework identifier' });
    }

    try {
      const canApprove = await FrameworkRBACService.canApprove(req.user.id, resolvedFramework);

      if (!canApprove) {
        return res.status(403).json({
          error: 'Approval permission denied',
          message: `User is not authorized to approve ${resolvedFramework} assessments`,
          framework: resolvedFramework,
        });
      }

      next();
    } catch (error) {
      logger.error('[RequireFrameworkApprover] Error:', error.message);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
};

/**
 * Check if user can certify (for official certifications like CMMI)
 */
const requireFrameworkCertifier = (framework) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Resolve the framework to use
    let resolvedFramework: string | undefined;
    try {
      resolvedFramework = framework || req.params.framework || req.query.framework;
    } catch (_e) {
      resolvedFramework = framework;
    }

    // Validate framework key length
    if (resolvedFramework && resolvedFramework.length > MAX_FRAMEWORK_KEY_LEN) {
      return res.status(400).json({ error: 'Invalid framework identifier' });
    }

    try {
      const canCertify = await FrameworkRBACService.canCertify(req.user.id, resolvedFramework);

      if (!canCertify) {
        return res.status(403).json({
          error: 'Certification permission denied',
          message: `User is not authorized to certify ${resolvedFramework} assessments. Official certification requires a certified appraiser.`,
          framework: resolvedFramework,
        });
      }

      next();
    } catch (error) {
      logger.error('[RequireFrameworkCertifier] Error:', error.message);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
};

/**
 * Validate workflow transition
 */
const validateWorkflowTransition = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Body accessor might throw — if so, skip validation
  let fromStatus: string | undefined;
  let toStatus: string | undefined;
  let framework: string | undefined;

  try {
    fromStatus = req.body?.fromStatus;
    toStatus = req.body?.toStatus;
  } catch (_e) {
    // Can't read body — skip validation
    return next();
  }

  try {
    framework = req.params?.framework || req.query?.framework || req.body?.framework;
  } catch (_e) {
    framework = undefined;
  }

  // Validate framework key length
  if (framework && framework.length > MAX_FRAMEWORK_KEY_LEN) {
    return res.status(400).json({ error: 'Invalid framework identifier' });
  }

  // Validate fromStatus/toStatus length
  if (fromStatus && String(fromStatus).length > MAX_STATUS_LEN) {
    return res.status(400).json({ error: 'Invalid status value' });
  }
  if (toStatus && String(toStatus).length > MAX_STATUS_LEN) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  if (!fromStatus || !toStatus) {
    return next(); // Skip validation if statuses not provided
  }

  try {
    const validation = await FrameworkRBACService.validateWorkflowTransition(
      req.user.id,
      framework ? framework.toUpperCase() : framework,
      fromStatus,
      toStatus
    );

    if (!validation.allowed) {
      return res.status(403).json({
        error: 'Workflow transition denied',
        message: validation.reason,
        fromStatus,
        toStatus,
        framework,
      });
    }

    next();
  } catch (error) {
    logger.error('[ValidateWorkflowTransition] Error:', error.message);
    return res.status(500).json({ error: 'Workflow validation failed' });
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
