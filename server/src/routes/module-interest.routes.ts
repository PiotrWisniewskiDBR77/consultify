/**
 * Module Interest / Waitlist Routes
 *
 * Allows authenticated users to register interest in upcoming modules.
 * SuperAdmin can view all interest registrations.
 */

import { randomUUID } from 'crypto';
import { Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { verifySuperAdmin as requireSuperAdmin } from '../middleware/superAdmin.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

const ALLOWED_MODULES = [
  'meeting',
  'iris',
  'marketplace',
  // KIMI lanes (legacy route keys used by the frontend)
  'wordy',
  'excele',
  'prezentacje',
  // keep canonical english alias for future clients
  'presentations',
];

/**
 * POST /api/module-interest
 * Register interest in an upcoming module
 */
router.post(
  '/',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    const { moduleKey } = req.body;

    if (!moduleKey || !ALLOWED_MODULES.includes(moduleKey)) {
      return res.status(400).json({ error: 'Invalid module key' });
    }

    const userId = req.user?.id;
    const orgId = req.user?.organizationId || null;

    const existing = await dbGet(
      'SELECT id FROM module_interest WHERE user_id = $1 AND module_key = $2',
      [userId, moduleKey]
    );

    if (existing) {
      return res.json({ ok: true, alreadyRegistered: true });
    }

    const id = `mi-${randomUUID()}`;

    let userEmail = req.user?.email || null;
    let userName = null;
    let orgName = null;

    try {
      const userRow = await dbGet('SELECT email, name FROM users WHERE id = $1', [userId]);
      if (userRow) {
        userEmail = (userRow as any).email || userEmail;
        userName = (userRow as any).name || null;
      }
    } catch {
      // non-critical
    }

    if (orgId) {
      try {
        const orgRow = await dbGet('SELECT name FROM organizations WHERE id = $1', [orgId]);
        if (orgRow) {
          orgName = (orgRow as any).name || null;
        }
      } catch {
        // non-critical
      }
    }

    await dbRun(
      `INSERT INTO module_interest (id, user_id, org_id, module_key, user_email, user_name, org_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, userId, orgId, moduleKey, userEmail, userName, orgName]
    );

    logger.info('[ModuleInterest] Registered interest', { userId, moduleKey, orgId });

    return res.json({ ok: true, alreadyRegistered: false });
  })
);

/**
 * GET /api/module-interest/my
 * Check which modules the current user is interested in
 */
router.get(
  '/my',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    const rows = await dbAll('SELECT module_key FROM module_interest WHERE user_id = $1', [userId]);
    const modules = (rows as any[]).map((r: any) => r.module_key);
    return res.json({ modules });
  })
);

/**
 * DELETE /api/module-interest/:moduleKey
 * Remove interest in a module
 */
router.delete(
  '/:moduleKey',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    const { moduleKey } = req.params;
    const userId = req.user?.id;

    await dbRun('DELETE FROM module_interest WHERE user_id = $1 AND module_key = $2', [
      userId,
      moduleKey,
    ]);

    return res.json({ ok: true });
  })
);

/**
 * GET /api/module-interest/admin/all
 * List all interest registrations (SuperAdmin only)
 */
router.get(
  '/admin/all',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res) => {
    const rows = await dbAll(
      `SELECT mi.id, mi.user_id, mi.org_id, mi.module_key, mi.user_email, mi.user_name, mi.org_name, mi.created_at
       FROM module_interest mi
       ORDER BY mi.created_at DESC`,
      []
    );

    const stats = await dbAll(
      `SELECT module_key, COUNT(*)::int as count FROM module_interest GROUP BY module_key ORDER BY count DESC`,
      []
    );

    return res.json({ interests: rows, stats });
  })
);

export default router;
