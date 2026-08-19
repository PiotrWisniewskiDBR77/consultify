/**
 * SSO Routes - Single Sign-On endpoints (V4-ENT-01)
 *
 * Public: /config, /saml/callback, /oidc/callback, /oidc/authorize, /saml/login
 * Authenticated: /logout/propagate
 * SuperAdmin CRUD: /configs, /google/config, /superadmin/config/:id/toggle, /superadmin/config/:id
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { verifySuperAdmin as requireSuperAdmin } from '../../middleware/superAdmin.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

// ── Table reconciliation ──

const ensureSsoTable = async () => {
  await dbRun(`CREATE TABLE IF NOT EXISTS sso_configs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    client_id TEXT,
    client_secret TEXT,
    redirect_uri TEXT,
    acs_url TEXT,
    entity_id TEXT,
    domains TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  const addCol = async (col: string, def: string) => {
    await dbRun(`ALTER TABLE sso_configs ADD COLUMN IF NOT EXISTS ${col} ${def}`);
  };
  await addCol('domain', 'TEXT');
  await addCol('sso_url', 'TEXT');
  await addCol('certificate', 'TEXT');
  await addCol('allowed_domains', 'TEXT');
};

// ── Helpers ──

// ══════════════════════════════════════════
// PUBLIC ENDPOINTS
// ══════════════════════════════════════════

// GET /config — domain-based SSO discovery
router.get(
  '/config',
  asyncHandler(async (req: Request, res: Response) => {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: 'Domain required' });
    await ensureSsoTable();
    const cfgRow = await dbGet<any>(
      `SELECT c.provider, c.entity_id, c.sso_url, c.certificate
       FROM sso_configs m
       JOIN sso_configs c
         ON c.organization_id = m.organization_id
        AND c.provider <> 'domain'
        AND c.status = 'active'
       WHERE m.provider = 'domain'
         AND m.status = 'active'
         AND m.domain = ?
       LIMIT 1`,
      [domain]
    );
    if (!cfgRow) return res.json({ ssoEnabled: false });
    res.json({ ssoEnabled: true, provider: cfgRow.provider, ssoUrl: cfgRow.sso_url });
  })
);

// ── OIDC Flow ──

router.get(
  '/oidc/authorize',
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(503).json({
      error: 'OIDC login is unavailable until token verification is configured',
      code: 'OIDC_TOKEN_VERIFICATION_UNAVAILABLE',
    });
  })
);

router.post(
  '/oidc/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Authorization code required' });
    res.status(503).json({
      error: 'OIDC callback verification is unavailable',
      code: 'OIDC_TOKEN_VERIFICATION_UNAVAILABLE',
    });
  })
);

// ── SAML Flow ──

router.get(
  '/saml/login',
  asyncHandler(async (_req: Request, res: Response) => {
    res.status(503).json({
      error: 'SAML login is unavailable until response signature verification is configured',
      code: 'SAML_SIGNATURE_VERIFICATION_UNAVAILABLE',
    });
  })
);

router.post(
  '/saml/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const { SAMLResponse } = req.body;
    if (!SAMLResponse) return res.status(400).json({ error: 'SAMLResponse required' });

    // Parsing XML is not authentication. Fail before reading/deleting state,
    // resolving a tenant, provisioning a user or issuing any token while this
    // lightweight stack has no XML signature verifier.
    res.status(503).json({
      error: 'SAML response verification is unavailable',
      code: 'SAML_SIGNATURE_VERIFICATION_UNAVAILABLE',
    });
  })
);

// ── Logout propagation ──

router.post(
  '/logout/propagate',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    await dbRun(
      `UPDATE user_sessions SET is_active = 0, revoked_at = datetime('now'), revoke_reason = 'user_logout'
       WHERE user_id = ? AND is_active = 1`,
      [userId]
    );

    const jti = `revoke-all-${userId}-${Date.now()}`;
    await dbRun(
      `INSERT OR IGNORE INTO revoked_tokens (jti, user_id, reason, expires_at)
       VALUES (?, ?, 'revoke-all', datetime('now', '+24 hours'))`,
      [jti, userId]
    );

    logger.info(`[SSO] Logout propagated for user ${userId}`);
    res.json({ success: true });
  })
);

// ══════════════════════════════════════════
// SUPERADMIN CRUD (preserved from original)
// ══════════════════════════════════════════

router.get(
  '/configs',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    await ensureSsoTable();
    const rows = await dbAll(
      `SELECT s.*, o.name as organization_name
       FROM sso_configs s
       LEFT JOIN organizations o ON o.id = s.organization_id
       ORDER BY s.created_at DESC`,
      [],
      { fallback: true }
    );
    const configs = (rows || []).map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      organizationName: r.organization_name || 'Unknown',
      providerType: r.provider,
      providerName: r.provider,
      isActive: r.status === 'active',
      isVerified: false,
      enforceSso: false,
      allowPasswordLogin: true,
      autoProvisionUsers: true,
      defaultRole: 'USER',
      createdAt: r.created_at,
      lastLoginAt: null,
      totalLogins: 0,
    }));
    res.json({ configs });
  })
);

router.post(
  '/google/config',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, clientId, clientSecret, allowedDomains } = req.body;
    if (!organizationId || !clientId) {
      return res.status(400).json({ error: 'organizationId and clientId are required' });
    }
    await ensureSsoTable();
    const id = uuidv4();
    const domainsStr = Array.isArray(allowedDomains) ? allowedDomains.join(',') : '';
    const domainsJson = Array.isArray(allowedDomains)
      ? JSON.stringify(allowedDomains)
      : JSON.stringify([]);
    const now = new Date().toISOString();
    await dbRun(
      `INSERT INTO sso_configs (
        id, organization_id, provider, status,
        client_id, client_secret,
        domain, domains, allowed_domains,
        created_at, updated_at
      )
      VALUES (?, ?, 'google', 'active', ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        organizationId,
        clientId,
        clientSecret || '',
        (Array.isArray(allowedDomains) ? allowedDomains[0] : '') || '',
        domainsJson,
        domainsStr,
        now,
        now,
      ]
    );
    logger.info(`[SSO] Google SSO config created for org ${organizationId}`);
    res.json({ success: true, id });
  })
);

router.put(
  '/superadmin/config/:id/toggle',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { isActive } = req.body;
    await ensureSsoTable();
    await dbRun(`UPDATE sso_configs SET status = ?, updated_at = datetime('now') WHERE id = ?`, [
      isActive ? 'active' : 'inactive',
      id,
    ]);
    logger.info(`[SSO] Config ${id} toggled to ${isActive ? 'active' : 'inactive'}`);
    res.json({ success: true });
  })
);

router.delete(
  '/superadmin/config/:id',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    await ensureSsoTable();
    await dbRun(`DELETE FROM sso_configs WHERE id = ?`, [id]);
    logger.info(`[SSO] Config ${id} deleted`);
    res.json({ success: true });
  })
);

router.post(
  '/saml/config',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, metadataUrl, entityId, ssoUrl, certificate } = req.body;
    if (!organizationId || !entityId || !ssoUrl) {
      return res.status(400).json({ error: 'organizationId, entityId, and ssoUrl are required' });
    }
    await ensureSsoTable();
    const id = uuidv4();
    const now = new Date().toISOString();
    await dbRun(
      `INSERT INTO sso_configs (
        id, organization_id, provider, status,
        entity_id, sso_url, certificate,
        domain, domains, allowed_domains,
        created_at, updated_at
      )
      VALUES (?, ?, 'saml', 'active', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        organizationId,
        entityId,
        ssoUrl,
        certificate || '',
        '',
        JSON.stringify([]),
        '',
        now,
        now,
      ]
    );
    logger.info(`[SSO] SAML config created for org ${organizationId}`);
    res.json({ success: true, id });
  })
);

router.post(
  '/saml/validate',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { entityId, ssoUrl, certificate } = req.body;
    const errors: string[] = [];
    if (!entityId) errors.push('Entity ID is required');
    if (!ssoUrl) errors.push('SSO URL is required');
    if (ssoUrl && !ssoUrl.startsWith('https://')) errors.push('SSO URL must use HTTPS');
    if (!certificate) errors.push('X.509 certificate is required');
    if (certificate && !certificate.includes('BEGIN CERTIFICATE'))
      errors.push('Invalid certificate format');
    if (errors.length > 0) {
      return res.json({ valid: false, errors });
    }
    res.json({ valid: true, errors: [] });
  })
);

router.post(
  '/domains',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { domain, organizationId } = req.body;
    if (!domain || !organizationId) {
      return res.status(400).json({ error: 'domain and organizationId are required' });
    }
    await ensureSsoTable();
    const existing = await dbGet('SELECT id FROM sso_configs WHERE domain = ?', [domain]);
    if (existing) {
      return res.status(409).json({ error: 'Domain already mapped' });
    }
    const id = uuidv4();
    const now = new Date().toISOString();
    await dbRun(
      `INSERT INTO sso_configs (
        id, organization_id, provider, status,
        domain, domains, allowed_domains,
        created_at, updated_at
      )
      VALUES (?, ?, 'domain', 'active', ?, ?, ?, ?, ?)`,
      [id, organizationId, domain, JSON.stringify([domain]), domain, now, now]
    );
    logger.info(`[SSO] Domain mapping created: ${domain} → org ${organizationId}`);
    res.json({ success: true, id });
  })
);

router.get(
  '/domains',
  verifyToken,
  requireSuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    await ensureSsoTable();
    const rows = await dbAll<any>(
      `SELECT s.*, o.name as organization_name
       FROM sso_configs s
       LEFT JOIN organizations o ON o.id = s.organization_id
       WHERE s.provider = 'domain'
       ORDER BY s.created_at DESC`,
      [],
      { fallback: true }
    );
    const mappings = (rows || []).map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      organizationName: r.organization_name || 'Unknown',
      domain: r.domain,
      domains: (() => {
        try {
          return Array.isArray(r.domains) ? r.domains : JSON.parse(r.domains || '[]');
        } catch {
          return [];
        }
      })(),
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    res.json({ mappings });
  })
);

export default router;
