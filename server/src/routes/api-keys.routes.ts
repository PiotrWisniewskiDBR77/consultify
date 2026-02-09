/**
 * API Keys Routes
 * API endpoints for API key management
 */
import crypto from 'crypto';
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { verifyAdmin } from '../middleware/admin.middleware.js';
import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

function generateApiKey(): string {
  return `iris_${crypto.randomBytes(32).toString('hex')}`;
}

router.get(
  '/',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const keys = await dbAll(
      `
    SELECT id, name, key_prefix, permissions, is_active, last_used_at, 
           expires_at, created_at, created_by
    FROM api_keys WHERE organization_id = ?
    ORDER BY created_at DESC
  `,
      [orgId]
    );
    res.json(keys || []);
  })
);

router.post(
  '/',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { name, permissions, expiresInDays } = req.body;

    if (!name) return res.status(400).json({ error: 'Name is required' });

    const apiKey = generateApiKey();
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const keyPrefix = apiKey.substring(0, 12) + '...';
    const id = uuidv4();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
      : null;

    await dbRun(
      `
    INSERT INTO api_keys (id, organization_id, name, key_hash, key_prefix, permissions, 
                          is_active, expires_at, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, datetime('now'))
  `,
      [
        id,
        orgId,
        name,
        keyHash,
        keyPrefix,
        JSON.stringify(permissions || ['read']),
        expiresAt,
        userId,
      ]
    );

    logger.info(`[APIKeys] Created key: ${name} for org ${orgId}`);
    // Show full key only once at creation
    res.status(201).json({
      success: true,
      id,
      apiKey,
      name,
      keyPrefix,
      warning: 'Save this API key now. It cannot be shown again.',
    });
  })
);

router.put(
  '/:id',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    const { name, permissions, isActive } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (permissions) {
      updates.push('permissions = ?');
      params.push(JSON.stringify(permissions));
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }
    if (!updates.length) return res.status(400).json({ error: 'No updates' });
    updates.push("updated_at = datetime('now')");
    params.push(id, orgId);
    await dbRun(
      `UPDATE api_keys SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
      params
    );
    res.json({ success: true });
  })
);

router.delete(
  '/:id',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    await dbRun(
      "UPDATE api_keys SET is_active = 0, updated_at = datetime('now') WHERE id = ? AND organization_id = ?",
      [id, orgId]
    );
    logger.info(`[APIKeys] Revoked key ${id}`);
    res.json({ success: true });
  })
);

router.get(
  '/:id/usage',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const usage = await dbAll(
      `
    SELECT date, request_count, error_count FROM api_key_usage 
    WHERE api_key_id = ? ORDER BY date DESC LIMIT 30
  `,
      [id]
    );
    res.json(usage || []);
  })
);

export default router;
