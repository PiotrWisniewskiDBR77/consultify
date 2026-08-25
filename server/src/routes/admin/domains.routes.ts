import { type NextFunction, type Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import verifyAdmin from '../../middleware/admin.middleware.js';
import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { logAdminAction } from '../../services/auditService.js';
import { verifyDomainTxt } from '../../services/domainVerificationService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';

const router = Router();
const verificationAttempts = new Map<string, number>();
const RATE_LIMIT_MS = 30_000;
const DOMAIN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*(?:\.[a-zA-Z0-9][a-zA-Z0-9-]*)+$/;

const ensureTable = () =>
  dbRun(
    `CREATE TABLE IF NOT EXISTS approved_domains (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, domain TEXT NOT NULL,
      auto_join INTEGER DEFAULT 0, verified INTEGER DEFAULT 0,
      verification_method TEXT DEFAULT 'dns', verification_token TEXT,
      added_by TEXT, added_at TEXT DEFAULT (datetime('now')), verified_at TEXT,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      UNIQUE(organization_id, domain)
    )`,
    [],
    { fallback: false }
  );

router.use(verifyToken);
router.use(
  asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const organizationId = String(req.user?.organizationId || '').trim();
    const userId = String(req.user?.id || '').trim();
    if (!organizationId || !userId)
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
    const membership = await dbGet<{ role?: string; status?: string }>(
      'SELECT role, status FROM organization_members WHERE organization_id = ? AND user_id = ? LIMIT 1',
      [organizationId, userId],
      { fallback: false }
    );
    if (!membership || String(membership.status).toUpperCase() !== 'ACTIVE')
      return res.status(403).json({ success: false, code: 'ADMIN_MEMBERSHIP_REQUIRED' });
    if (!['OWNER', 'ADMIN'].includes(String(membership.role).toUpperCase()))
      return res.status(403).json({ success: false, code: 'ADMIN_ACCESS_REQUIRED' });
    next();
  })
);
router.use(verifyAdmin);

const listDomains = async (organizationId: string) => {
  await ensureTable();
  const rows = await dbAll<any>(
    `SELECT id, domain, auto_join, verified, verified_at, verification_method,
            verification_token, added_at
       FROM approved_domains WHERE organization_id = ? ORDER BY domain`,
    [organizationId],
    { fallback: false }
  );
  return rows.map((row) => ({
    id: row.id,
    domain: row.domain,
    autoJoin: Boolean(row.auto_join),
    verified: Boolean(row.verified),
    verifiedAt: row.verified_at ?? null,
    verificationMethod: row.verification_method,
    verificationToken: row.verification_token,
    addedAt: row.added_at,
  }));
};

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) =>
    res.json({ success: true, domains: await listDomains(String(req.user?.organizationId)) })
  )
);

router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = String(req.user?.organizationId);
    const domain = String(req.body?.domain || '')
      .trim()
      .toLowerCase();
    if (!DOMAIN_PATTERN.test(domain))
      return res.status(400).json({ success: false, code: 'INVALID_DOMAIN' });
    await ensureTable();
    if (
      await dbGet('SELECT id FROM approved_domains WHERE organization_id = ? AND domain = ?', [
        organizationId,
        domain,
      ])
    )
      return res.status(409).json({ success: false, code: 'DOMAIN_EXISTS' });
    const id = uuidv4();
    const verificationToken = uuidv4().replace(/-/g, '');
    await dbRun(
      `INSERT INTO approved_domains
       (id, organization_id, domain, auto_join, added_by, verification_token)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, organizationId, domain, req.body?.autoJoin ? 1 : 0, req.user?.id, verificationToken],
      { fallback: false }
    );
    return res.status(201).json({
      success: true,
      domain: { id, domain, autoJoin: Boolean(req.body?.autoJoin), verified: false },
      instruction: {
        name: `_consultify-verification.${domain}`,
        type: 'TXT',
        value: `consultify-domain-verification=${verificationToken}`,
      },
    });
  })
);

router.put(
  '/:domainId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = String(req.user?.organizationId);
    await ensureTable();
    const found = await dbGet(
      'SELECT id FROM approved_domains WHERE id = ? AND organization_id = ?',
      [req.params.domainId, organizationId]
    );
    if (!found) return res.status(404).json({ success: false, code: 'DOMAIN_NOT_FOUND' });
    await dbRun(
      'UPDATE approved_domains SET auto_join = ? WHERE id = ? AND organization_id = ?',
      [req.body?.autoJoin ? 1 : 0, req.params.domainId, organizationId],
      { fallback: false }
    );
    return res.json({ success: true });
  })
);

router.delete(
  '/:domainId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = String(req.user?.organizationId);
    await ensureTable();
    const found = await dbGet(
      'SELECT id FROM approved_domains WHERE id = ? AND organization_id = ?',
      [req.params.domainId, organizationId]
    );
    if (!found) return res.status(404).json({ success: false, code: 'DOMAIN_NOT_FOUND' });
    await dbRun(
      'DELETE FROM approved_domains WHERE id = ? AND organization_id = ?',
      [req.params.domainId, organizationId],
      { fallback: false }
    );
    verificationAttempts.delete(`${organizationId}:${req.params.domainId}`);
    return res.status(204).send();
  })
);

router.post(
  '/:domainId/verify',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = String(req.user?.organizationId);
    await ensureTable();
    const key = `${organizationId}:${req.params.domainId}`;
    const lastAttempt = verificationAttempts.get(key) ?? 0;
    if (Date.now() - lastAttempt < RATE_LIMIT_MS)
      return res.status(429).json({ success: false, code: 'VERIFICATION_RATE_LIMITED' });
    const domain = await dbGet<{ id: string; domain: string; verification_token: string }>(
      `SELECT id, domain, verification_token FROM approved_domains
       WHERE id = ? AND organization_id = ?`,
      [req.params.domainId, organizationId],
      { fallback: false }
    );
    if (!domain) return res.status(404).json({ success: false, code: 'DOMAIN_NOT_FOUND' });
    verificationAttempts.set(key, Date.now());
    const outcome = await verifyDomainTxt(domain.domain, domain.verification_token);
    if (outcome.status === 'verified') {
      await dbRun(
        `UPDATE approved_domains SET verified = 1, verified_at = datetime('now')
         WHERE id = ? AND organization_id = ?`,
        [domain.id, organizationId],
        { fallback: false }
      );
      await logAdminAction('domain_verified', 'approved_domain', {
        actorType: 'user',
        actorId: String(req.user?.id),
        organizationId,
        resourceId: domain.id,
        resourceName: domain.domain,
        newValues: { verified: true, checkedAt: outcome.checkedAt },
        result: 'success',
      });
    }
    return res.json({ success: true, outcome });
  })
);

export const clearDomainVerificationRateLimitsForTests = () => verificationAttempts.clear();
export default router;
