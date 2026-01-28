/**
 * Assessment RBAC Middleware
 * Role-based access control for assessment operations
 * Extended for multi-framework assessments (SIRI, ADMA, CMMI, LEAN)
 */

import { FrameworkRBACService } from '../services/frameworkRBACService.js';

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

  const userRole = user.role === undefined || user.role === null ? 'VIEWER' : user.role;
  const userPermissions = permissions[userRole] || [];

  // Super admin has all permissions
  if (userPermissions.includes('*')) return true;

  // Check specific permission
  return userPermissions.includes(`${resource}:${action}`);
};

// Original RBAC middleware
const assessmentRBAC = (action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!hasPermission(req.user, action, 'assessment')) {
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
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get framework from params, query, or body
    const framework = req.params.framework || req.query.framework || req.body.framework;

    // If no framework specified, fall back to general assessment RBAC
    if (!framework) {
      if (!hasPermission(req.user, action, 'assessment')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: `assessment:${action}`,
          userRole: req.user.role,
        });
      }
      return next();
    }

    try {
      // Check framework-specific permissions
      const hasFrameworkPerm = await FrameworkRBACService.hasPermission(
        req.user.id,
        framework.toUpperCase(),
        action,
        {
          organizationId: req.user.organization_id,
          projectId: req.params.projectId,
        }
      );

      if (!hasFrameworkPerm) {
        // Fall back to general permissions
        if (!hasPermission(req.user, action, 'assessment')) {
          return res.status(403).json({
            error: 'Insufficient permissions',
            required: `${framework.toLowerCase()}:${action}`,
            userRole: req.user.role,
            framework,
          });
        }
      }

      next();
    } catch (error) {
      console.error('[MultiFrameworkRBAC] Error:', error.message);
      // Fall back to general permissions on error
      if (!hasPermission(req.user, action, 'assessment')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: `assessment:${action}`,
          userRole: req.user.role,
        });
      }
      next();
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

    try {
      const canApprove = await FrameworkRBACService.canApprove(
        req.user.id,
        framework || req.params.framework || req.query.framework
      );

      if (!canApprove) {
        return res.status(403).json({
          error: 'Approval permission denied',
          message: `User is not authorized to approve ${framework} assessments`,
          framework,
        });
      }

      next();
    } catch (error) {
      console.error('[RequireFrameworkApprover] Error:', error.message);
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

    try {
      const canCertify = await FrameworkRBACService.canCertify(
        req.user.id,
        framework || req.params.framework || req.query.framework
      );

      if (!canCertify) {
        return res.status(403).json({
          error: 'Certification permission denied',
          message: `User is not authorized to certify ${framework} assessments. Official certification requires a certified appraiser.`,
          framework,
        });
      }

      next();
    } catch (error) {
      console.error('[RequireFrameworkCertifier] Error:', error.message);
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

  const { fromStatus, toStatus } = req.body;
  const framework = req.params.framework || req.query.framework || req.body.framework;

  if (!fromStatus || !toStatus) {
    return next(); // Skip validation if statuses not provided
  }

  try {
    const validation = await FrameworkRBACService.validateWorkflowTransition(
      req.user.id,
      framework,
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
    console.error('[ValidateWorkflowTransition] Error:', error.message);
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
