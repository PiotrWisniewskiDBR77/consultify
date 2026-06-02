import { randomUUID } from 'crypto';
import { Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { verifySuperAdmin } from '../middleware/superAdmin.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

const SUPPORTED_MODULES = ['wordy', 'excele', 'prezentacje'] as const;
type SupportedModuleKey = (typeof SUPPORTED_MODULES)[number];

type ScopeType = 'organization' | 'user';

function isSupportedModuleKey(value: unknown): value is SupportedModuleKey {
  return typeof value === 'string' && SUPPORTED_MODULES.includes(value as SupportedModuleKey);
}

async function ensureSchema(): Promise<void> {
  await dbRun(
    `CREATE TABLE IF NOT EXISTS module_access_grants (
      id TEXT PRIMARY KEY,
      module_key TEXT NOT NULL,
      scope_type TEXT NOT NULL CHECK(scope_type IN ('organization', 'user')),
      organization_id TEXT,
      user_id TEXT,
      access_level TEXT NOT NULL DEFAULT 'full',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      notes TEXT,
      granted_by TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    []
  );

  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_module_access_grants_module_key
     ON module_access_grants(module_key)`,
    []
  );
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_module_access_grants_org
     ON module_access_grants(organization_id)`,
    []
  );
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_module_access_grants_user
     ON module_access_grants(user_id)`,
    []
  );
}

async function ensureDbr77Defaults(): Promise<void> {
  const org = await dbGet(
    `SELECT id, name
     FROM organizations
     WHERE LOWER(name) LIKE '%dbr77%'
     ORDER BY created_at ASC
     LIMIT 1`,
    []
  );
  if (!org || !(org as any).id) return;

  const orgId = String((org as any).id);
  for (const moduleKey of SUPPORTED_MODULES) {
    const existing = await dbGet(
      `SELECT id
       FROM module_access_grants
       WHERE module_key = $1
         AND scope_type = 'organization'
         AND organization_id = $2
         AND is_active = TRUE`,
      [moduleKey, orgId]
    );
    if (existing) continue;

    await dbRun(
      `INSERT INTO module_access_grants
       (id, module_key, scope_type, organization_id, user_id, access_level, is_active, notes, granted_by)
       VALUES ($1, $2, 'organization', $3, NULL, 'full', TRUE, $4, 'system:dbr77-bootstrap')`,
      [
        `mag-${randomUUID()}`,
        moduleKey,
        orgId,
        'Auto-granted default access for DBR77 organization',
      ]
    );
  }
}

async function resolveAccessibleModules(user: {
  id?: string;
  organizationId?: string;
  role?: string;
  email?: string;
}): Promise<string[]> {
  const userId = user.id || '';
  const organizationId = user.organizationId || '';
  const role = String(user.role || '').toUpperCase();

  if (!userId || !organizationId) return [];
  if (role === 'SUPERADMIN') return [...SUPPORTED_MODULES];

  const rows = await dbAll(
    `SELECT DISTINCT module_key
     FROM module_access_grants
     WHERE is_active = TRUE
       AND module_key IN (${SUPPORTED_MODULES.map(() => '?').join(',')})
       AND (
         (scope_type = 'organization' AND organization_id = ?)
         OR (scope_type = 'user' AND user_id = ?)
       )`,
    [...SUPPORTED_MODULES, organizationId, userId]
  );

  return (rows || [])
    .map((row: any) => String(row.module_key || '').trim())
    .filter((key: string) => SUPPORTED_MODULES.includes(key as SupportedModuleKey));
}

/**
 * GET /api/module-access/my
 * Returns effective module access for current user.
 */
router.get(
  '/my',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res) => {
    await ensureSchema();
    await ensureDbr77Defaults();

    const modules = await resolveAccessibleModules({
      id: req.user?.id,
      organizationId: req.user?.organizationId,
      role: req.user?.role,
      email: req.user?.email,
    });

    return res.json({ modules });
  })
);

/**
 * GET /api/module-access/admin/grants
 * SuperAdmin listing of grants.
 */
router.get(
  '/admin/grants',
  verifyToken,
  verifySuperAdmin,
  asyncHandler(async (_req: AuthRequest, res) => {
    await ensureSchema();
    await ensureDbr77Defaults();

    const grants = await dbAll(
      `SELECT
         g.*,
         o.name AS organization_name,
         u.email AS user_email,
         u.first_name AS user_first_name,
         u.last_name AS user_last_name
       FROM module_access_grants g
       LEFT JOIN organizations o ON o.id = g.organization_id
       LEFT JOIN users u ON u.id = g.user_id
       ORDER BY g.updated_at DESC`,
      []
    );
    return res.json({ grants: grants || [], supportedModules: SUPPORTED_MODULES });
  })
);

/**
 * POST /api/module-access/admin/grants
 * Create or upsert grant for org or user scope.
 */
router.post(
  '/admin/grants',
  verifyToken,
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res) => {
    await ensureSchema();
    await ensureDbr77Defaults();

    const moduleKey = String(req.body?.moduleKey || '').trim();
    const scopeType = String(req.body?.scopeType || '').trim() as ScopeType;
    const accessLevel = String(req.body?.accessLevel || 'full').trim() || 'full';
    const notes = req.body?.notes ? String(req.body.notes).trim() : null;
    const isActive = req.body?.isActive === false ? 0 : 1;

    if (!isSupportedModuleKey(moduleKey)) {
      return res.status(400).json({ error: 'Invalid moduleKey' });
    }
    if (scopeType !== 'organization' && scopeType !== 'user') {
      return res.status(400).json({ error: 'scopeType must be organization or user' });
    }

    let organizationId: string | null = null;
    let userId: string | null = null;

    if (scopeType === 'organization') {
      organizationId = req.body?.organizationId ? String(req.body.organizationId).trim() : null;
      if (!organizationId) return res.status(400).json({ error: 'organizationId is required' });
    } else {
      if (req.body?.userId) {
        userId = String(req.body.userId).trim();
      } else if (req.body?.userEmail) {
        const email = String(req.body.userEmail).trim().toLowerCase();
        const user = await dbGet(`SELECT id, organization_id FROM users WHERE LOWER(email) = ?`, [
          email,
        ]);
        if (!user || !(user as any).id) {
          return res.status(404).json({ error: 'User not found for provided userEmail' });
        }
        userId = String((user as any).id);
        organizationId = String((user as any).organization_id || '');
      }
      if (!userId) return res.status(400).json({ error: 'userId or userEmail is required' });
    }

    const existing = await dbGet(
      `SELECT id
       FROM module_access_grants
       WHERE module_key = $1
         AND scope_type = $2
         AND ((organization_id IS NULL AND $3 IS NULL) OR organization_id = $3)
         AND ((user_id IS NULL AND $4 IS NULL) OR user_id = $4)
       LIMIT 1`,
      [moduleKey, scopeType, organizationId, userId]
    );

    const grantId = existing ? String((existing as any).id) : `mag-${randomUUID()}`;
    if (existing) {
      await dbRun(
        `UPDATE module_access_grants
         SET access_level = $1,
             is_active = $2,
             notes = $3,
             granted_by = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [accessLevel, isActive, notes, req.user?.id || null, grantId]
      );
    } else {
      await dbRun(
        `INSERT INTO module_access_grants
         (id, module_key, scope_type, organization_id, user_id, access_level, is_active, notes, granted_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          grantId,
          moduleKey,
          scopeType,
          organizationId,
          userId,
          accessLevel,
          isActive,
          notes,
          req.user?.id || null,
        ]
      );
    }

    const saved = await dbGet(`SELECT * FROM module_access_grants WHERE id = $1`, [grantId]);
    logger.info('[ModuleAccess] Upserted grant', {
      moduleKey,
      scopeType,
      organizationId,
      userId,
      grantId,
      by: req.user?.id,
    });
    return res.json({ ok: true, grant: saved });
  })
);

/**
 * POST /api/module-access/admin/bootstrap/dbr77
 * Idempotently creates org grants for DBR77 org.
 */
router.post(
  '/admin/bootstrap/dbr77',
  verifyToken,
  verifySuperAdmin,
  asyncHandler(async (_req: AuthRequest, res) => {
    await ensureSchema();
    await ensureDbr77Defaults();
    return res.json({ ok: true });
  })
);

/**
 * POST /api/module-access/admin/grants/:id/toggle
 */
router.post(
  '/admin/grants/:id/toggle',
  verifyToken,
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res) => {
    await ensureSchema();
    const id = String(req.params.id || '').trim();
    const isActive = req.body?.isActive === false ? 0 : 1;
    if (!id) return res.status(400).json({ error: 'grant id is required' });

    await dbRun(
      `UPDATE module_access_grants
       SET is_active = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [isActive, id]
    );
    return res.json({ ok: true });
  })
);

export default router;
