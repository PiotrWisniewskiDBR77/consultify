// @ts-nocheck
/**
 * API Keys Routes
 * Enterprise SaaS Architecture - API Management
 *
 * Endpoints for managing API keys:
 * - Create, list, revoke API keys
 * - Rotate keys with grace periods
 * - View key usage statistics
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import orgContextMiddleware from '../middleware/orgContext.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { requireOrgAccess, requireOrgRole } from '../middleware/rbac.middleware.js';
import adminAuditService from '../services/adminAuditService.js';
import { API_KEY_PERMISSIONS, ApiKeyService } from '../services/apiKeyService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Emit an admin audit entry for API-key lifecycle events. Fail-safe: audit
 * persistence errors are swallowed inside adminAuditService and must never
 * block the key operation.
 */
async function auditApiKey(
  actorId: string,
  orgId: string,
  actionType: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    await adminAuditService.logAction({
      adminId: actorId,
      organizationId: orgId,
      actionType,
      resourceType: 'api_key',
      details: { orgId, isSensitive: true, ...details },
    });
  } catch {
    /* best-effort */
  }
}

// Apply rate limiting
const router = Router();

// All routes require authentication and org context
router.use(verifyToken);
router.use(orgContextMiddleware({ strictWrite: false }));

// ==========================================
// ROUTES
// ==========================================

/**
 * GET /api/organizations/:orgId/api-keys
 * List all API keys for the organization
 */
router.get(
  '/',
  requireOrgAccess(),
  requireOrgRole('owner', 'administrator'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.params.orgId || (req as any).org?.id;

    const keys = await ApiKeyService.listKeys(orgId);

    return res.json({
      keys,
      permissions: Object.values(API_KEY_PERMISSIONS),
    });
  })
);

/**
 * POST /api/organizations/:orgId/api-keys
 * Create a new API key
 */
router.post(
  '/',
  requireOrgRole('owner', 'administrator'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.params.orgId || (req as any).org?.id;
    const { name, permissions, ipWhitelist, rateLimit, expiresInDays } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Validate permissions
    if (permissions) {
      const validPermissions = Object.values(API_KEY_PERMISSIONS);
      const invalidPerms = permissions.filter((p: string) => !validPermissions.includes(p as any));
      if (invalidPerms.length > 0) {
        return res.status(400).json({
          error: 'Invalid permissions',
          invalidPermissions: invalidPerms,
          validPermissions,
        });
      }
    }

    const { key, plainTextKey } = await ApiKeyService.createKey({
      organizationId: orgId,
      name,
      permissions,
      ipWhitelist,
      rateLimit,
      expiresInDays,
      createdBy: req.user!.id,
    });

    await auditApiKey(req.user!.id, orgId, 'generate_api_key', {
      keyId: key.id,
      keyName: key.name,
      keyPrefix: key.keyPrefix,
    });

    // Return key info with full key ONCE
    return res.status(201).json({
      message: 'API key created successfully',
      warning: 'Store this key securely. It cannot be retrieved again.',
      key: {
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        permissions: key.permissions,
        rateLimit: key.rateLimit,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
      },
      plainTextKey, // Only returned once!
    });
  })
);

/**
 * POST /api/organizations/:orgId/api-keys/:keyId/rotate
 * Rotate an API key
 */
router.post(
  '/:keyId/rotate',
  requireOrgRole('owner', 'administrator'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { keyId } = req.params;
    const { gracePeriodHours } = req.body;

    const { newKey, plainTextKey } = await ApiKeyService.rotateKey({
      keyId,
      gracePeriodHours,
      userId: req.user!.id,
    });

    await auditApiKey(req.user!.id, req.params.orgId || (req as any).org?.id, 'rotate_api_key', {
      keyId,
      newKeyId: newKey.id,
      gracePeriodHours: gracePeriodHours || 24,
    });

    return res.json({
      message: 'API key rotated successfully',
      warning: 'Store the new key securely. Old key will expire after grace period.',
      gracePeriodHours: gracePeriodHours || 24,
      newKey: {
        id: newKey.id,
        name: newKey.name,
        keyPrefix: newKey.keyPrefix,
        permissions: newKey.permissions,
        rateLimit: newKey.rateLimit,
        expiresAt: newKey.expiresAt,
      },
      plainTextKey,
    });
  })
);

/**
 * DELETE /api/organizations/:orgId/api-keys/:keyId
 * Revoke an API key
 */
router.delete(
  '/:keyId',
  requireOrgRole('owner', 'administrator'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { keyId } = req.params;

    await ApiKeyService.revokeKey(keyId, req.user!.id);

    await auditApiKey(req.user!.id, req.params.orgId || (req as any).org?.id, 'revoke_api_key', {
      keyId,
    });

    return res.json({
      message: 'API key revoked successfully',
      keyId,
    });
  })
);

/**
 * GET /api/api-keys/permissions
 * List available API key permissions
 */
router.get(
  '/permissions',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return res.json({
      permissions: Object.entries(API_KEY_PERMISSIONS).map(([name, value]) => ({
        name,
        value,
        description: getPermissionDescription(value),
      })),
    });
  })
);

// ==========================================
// HELPERS
// ==========================================

function getPermissionDescription(permission: string): string {
  const descriptions: Record<string, string> = {
    'read:projects': 'Read project data',
    'write:projects': 'Create and modify projects',
    'read:tasks': 'Read task data',
    'write:tasks': 'Create and modify tasks',
    'read:calendar': 'Read calendar sources and items',
    'write:calendar': 'Create and modify calendar sources and items',
    'read:integrations': 'Read integration connections and health',
    'write:integrations': 'Create and modify integration connections',
    'read:reports': 'Read reports and analytics',
    'write:reports': 'Generate and export reports',
    'ai:execute': 'Execute AI actions',
    'ai:read': 'Read AI insights and recommendations',
    'webhooks:manage': 'Manage webhook configurations',
    'full:access': 'Full API access (all permissions)',
  };
  return descriptions[permission] || permission;
}

export default router;
