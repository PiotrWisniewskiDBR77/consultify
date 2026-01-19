/**
 * Demo Mode Middleware
 *
 * Handles demo mode context switching and write protection.
 * When demo mode is enabled, user sees data from the demo organization
 * instead of their own organization.
 */
import { NextFunction, Response } from 'express';

import { get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { type AuthRequest } from './auth.middleware.js';

// ==========================================
// CONSTANTS
// ==========================================

export const DEMO_ORG_ID = 'org-demo-acme-global';
export const DEMO_ORG_NAME = 'Acme Digital Corp';

// ==========================================
// DEMO CONTEXT MIDDLEWARE
// ==========================================

/**
 * Middleware that checks if user has demo mode enabled
 * and switches their organization context to the demo organization.
 *
 * Must be applied AFTER verifyToken middleware.
 */
export const demoContextMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if demo mode is enabled via header or user preference
    const demoHeader = req.headers['x-demo-mode'];
    const isDemoMode = demoHeader === 'true' || demoHeader === '1';

    logger.debug(
      `[DemoMode] Middleware called: isDemoMode=${isDemoMode}, hasUser=${!!req.user}, userOrgId=${req.user?.organizationId}`
    );

    if (isDemoMode && req.user) {
      // Store original organization for audit trail
      const originalOrgId = req.user.organizationId;

      // Switch context to demo organization
      req.user = {
        ...req.user,
        organizationId: DEMO_ORG_ID,
        isDemo: true,
      };

      req.isDemo = true;
      req.organizationId = DEMO_ORG_ID;

      // Store original for potential rollback
      (req as any).originalOrganizationId = originalOrgId;

      logger.info(
        `[DemoMode] User ${req.user.id} switched to demo mode (original org: ${originalOrgId} -> ${DEMO_ORG_ID})`
      );
    } else if (isDemoMode) {
      logger.warn(`[DemoMode] Demo header set but no user found on request`);
    }

    next();
  } catch (error) {
    logger.error('[DemoMode] Error in demo context middleware:', error);
    next();
  }
};

// ==========================================
// DEMO WRITE PROTECTION MIDDLEWARE
// ==========================================

/**
 * Middleware that prevents write operations in demo mode.
 * Returns 403 Forbidden for POST, PUT, PATCH, DELETE when in demo mode.
 *
 * Can be configured to allow specific routes.
 */
export interface DemoWriteProtectionOptions {
  allowedRoutes?: string[];
  allowedMethods?: string[];
}

export const demoWriteProtection = (options: DemoWriteProtectionOptions = {}) => {
  const { allowedRoutes = [], allowedMethods = ['GET', 'HEAD', 'OPTIONS'] } = options;

  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    // Check if demo mode is enabled via header (primary check)
    const demoHeader = req.headers['x-demo-mode'];
    const isDemoFromHeader = demoHeader === 'true' || demoHeader === '1';

    // Also check req.isDemo set by demoContextMiddleware
    const isDemo = isDemoFromHeader || req.isDemo || req.user?.isDemo;

    // Skip if not in demo mode
    if (!isDemo) {
      next();
      return;
    }

    // Allow safe methods
    if (allowedMethods.includes(req.method.toUpperCase())) {
      next();
      return;
    }

    // Check if route is allowed
    const isAllowedRoute = allowedRoutes.some(
      (route) => req.path.startsWith(route) || req.originalUrl.startsWith(route)
    );

    if (isAllowedRoute) {
      next();
      return;
    }

    // Block write operation in demo mode
    logger.warn(`[DemoMode] Blocked ${req.method} ${req.path} - demo mode is read-only`);

    res.status(403).json({
      success: false,
      error: 'demo_mode_read_only',
      message: 'W trybie demo nie można modyfikować danych. Wyłącz tryb demo aby edytować.',
      isDemoMode: true,
      details: {
        method: req.method,
        path: req.path,
        hint: 'Dane demo są tylko do odczytu w celach szkoleniowych.',
      },
    });
  };
};

// ==========================================
// LEGACY COMPATIBILITY
// ==========================================

/**
 * Legacy demo guard - simple passthrough for backward compatibility
 * @deprecated Use demoContextMiddleware instead
 */
export const demoGuard = (req: AuthRequest, res: Response, next: NextFunction): void => {
  next();
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Check if user has demo mode enabled in their preferences
 */
export const checkUserDemoPreference = async (userId: string): Promise<boolean> => {
  try {
    const result = await dbGet<{ demo_mode_enabled: number }>(
      'SELECT demo_mode_enabled FROM user_preferences WHERE user_id = ?',
      [userId]
    );
    return result?.demo_mode_enabled === 1;
  } catch (error) {
    return false;
  }
};

/**
 * Set user demo mode preference
 */
export const setUserDemoPreference = async (userId: string, enabled: boolean): Promise<void> => {
  const { run: dbRun } = await import('../utils/DbPromise.js');

  try {
    await dbRun(
      `INSERT INTO user_preferences (user_id, demo_mode_enabled, updated_at)
             VALUES (?, ?, datetime('now'))
             ON CONFLICT(user_id) DO UPDATE SET 
                demo_mode_enabled = excluded.demo_mode_enabled,
                updated_at = datetime('now')`,
      [userId, enabled ? 1 : 0]
    );
  } catch (error) {
    logger.error('[DemoMode] Failed to set user demo preference:', error);
    throw error;
  }
};

/**
 * Get demo organization details
 */
export const getDemoOrganization = async () => {
  try {
    const org = await dbGet<{
      id: string;
      name: string;
      slug: string;
      description: string;
      settings: string;
    }>('SELECT id, name, slug, description, settings FROM organizations WHERE id = ?', [
      DEMO_ORG_ID,
    ]);

    if (!org) {
      return {
        id: DEMO_ORG_ID,
        name: DEMO_ORG_NAME,
        slug: 'acme-demo',
        description: 'Firma demonstracyjna z pełnymi danymi szkoleniowymi',
        settings: {},
      };
    }

    return {
      ...org,
      settings: org.settings ? JSON.parse(org.settings) : {},
    };
  } catch (error) {
    logger.error('[DemoMode] Failed to get demo organization:', error);
    return {
      id: DEMO_ORG_ID,
      name: DEMO_ORG_NAME,
      slug: 'acme-demo',
      description: 'Firma demonstracyjna z pełnymi danymi szkoleniowymi',
      settings: {},
    };
  }
};

/**
 * Get demo mode statistics
 */
export const getDemoStats = async () => {
  try {
    const [projects, initiatives, tasks, assessments] = await Promise.all([
      dbGet<{ count: number }>('SELECT COUNT(*) as count FROM projects WHERE organization_id = ?', [
        DEMO_ORG_ID,
      ]),
      dbGet<{ count: number }>(
        'SELECT COUNT(*) as count FROM initiatives WHERE organization_id = ?',
        [DEMO_ORG_ID]
      ),
      dbGet<{ count: number }>('SELECT COUNT(*) as count FROM tasks WHERE organization_id = ?', [
        DEMO_ORG_ID,
      ]),
      dbGet<{ count: number }>(
        'SELECT COUNT(*) as count FROM assessments WHERE organization_id = ?',
        [DEMO_ORG_ID]
      ),
    ]);

    return {
      projects: projects?.count || 0,
      initiatives: initiatives?.count || 0,
      tasks: tasks?.count || 0,
      assessments: assessments?.count || 0,
    };
  } catch (error) {
    logger.error('[DemoMode] Failed to get demo stats:', error);
    return {
      projects: 0,
      initiatives: 0,
      tasks: 0,
      assessments: 0,
    };
  }
};

export default {
  demoGuard,
  demoContextMiddleware,
  demoWriteProtection,
  checkUserDemoPreference,
  setUserDemoPreference,
  getDemoOrganization,
  getDemoStats,
  DEMO_ORG_ID,
  DEMO_ORG_NAME,
};
