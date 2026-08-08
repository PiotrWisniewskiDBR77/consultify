/**
 * SSO Routes - Single Sign-On endpoints (V4-ENT-01)
 *
 * Public: /config, /saml/callback, /oidc/callback, /oidc/authorize, /saml/login
 * Authenticated: /logout/propagate
 * SuperAdmin CRUD: /configs, /google/config, /superadmin/config/:id/toggle, /superadmin/config/:id
 */
import crypto from 'crypto';
import { Request, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import config from '../../config/Config.js';
import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { verifySuperAdmin as requireSuperAdmin } from '../../middleware/superAdmin.middleware.js';
import {
  buildOIDCAuthUrl,
  buildSAMLAuthnRequest,
  decodeIdToken,
  exchangeOIDCCode,
  generateNonce,
  generateState,
  getUserInfo,
  type OIDCConfig,
  parseSAMLResponse,
  type SAMLConfig,
} from '../../services/ssoService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { setAuthCookies } from '../../utils/cookieAuth.js';
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

const ensureAuthStatesTable = async () => {
  await dbRun(`CREATE TABLE IF NOT EXISTS sso_auth_states (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    state TEXT NOT NULL UNIQUE,
    nonce TEXT,
    provider_type TEXT NOT NULL,
    redirect_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (datetime('now', '+10 minutes'))
  )`);
};

// ── Helpers ──

async function loadOIDCConfig(
  organizationId: string
): Promise<(OIDCConfig & { configId: string }) | null> {
  const row = await dbGet<any>(
    `SELECT * FROM sso_configurations
     WHERE organization_id = ? AND protocol = 'oidc' AND is_enabled = 1
     LIMIT 1`,
    [organizationId]
  );
  if (!row) return null;

  const frontendUrl = config.FRONTEND_URL || 'http://localhost:3000';
  return {
    configId: row.id,
    issuer: row.oidc_issuer,
    clientId: row.oidc_client_id,
    clientSecret: row.oidc_client_secret,
    redirectUri: `${frontendUrl}/api/sso/oidc/callback`,
    scopes: row.oidc_scopes || 'openid profile email',
    tokenEndpoint: row.oidc_token_url || undefined,
    userinfoEndpoint: row.oidc_userinfo_url || undefined,
    authorizationEndpoint: row.oidc_authorization_url || undefined,
    endSessionEndpoint: undefined,
  };
}

async function loadSAMLConfig(
  organizationId: string
): Promise<(SAMLConfig & { configId: string }) | null> {
  const row = await dbGet<any>(
    `SELECT * FROM sso_configurations
     WHERE organization_id = ? AND protocol = 'saml' AND is_enabled = 1
     LIMIT 1`,
    [organizationId]
  );
  if (!row) {
    const legacy = await dbGet<any>(
      `SELECT * FROM sso_configs
       WHERE organization_id = ? AND provider = 'saml' AND status = 'active'
       LIMIT 1`,
      [organizationId]
    );
    if (!legacy) return null;
    return {
      configId: legacy.id,
      entityId: legacy.entity_id,
      ssoUrl: legacy.sso_url,
      certificate: legacy.certificate || '',
      sloUrl: undefined,
      nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      attributeMappings: {},
    };
  }

  let mappings: Record<string, string> = {};
  try {
    mappings = JSON.parse(row.attribute_mappings || '{}');
  } catch {
    /* ignore */
  }

  return {
    configId: row.id,
    entityId: row.saml_entity_id,
    ssoUrl: row.saml_sso_url,
    certificate: row.saml_certificate || '',
    sloUrl: row.saml_slo_url || undefined,
    nameIdFormat:
      row.saml_name_id_format || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    attributeMappings: mappings,
  };
}

async function resolveOrganizationId(
  domain?: string,
  organizationId?: string
): Promise<string | null> {
  if (organizationId) return organizationId;
  if (!domain) return null;
  await ensureSsoTable();
  const row = await dbGet<any>(
    `SELECT organization_id FROM sso_configs
     WHERE provider = 'domain' AND status = 'active' AND domain = ?
     LIMIT 1`,
    [domain]
  );
  return row?.organization_id || null;
}

async function findOrCreateUser(
  email: string,
  firstName: string,
  lastName: string,
  organizationId: string,
  ssoProvider: string
): Promise<{ id: string; email: string; role: string; organization_id: string }> {
  const user = await dbGet<any>(
    'SELECT id, email, role, organization_id FROM users WHERE email = ?',
    [email.toLowerCase()]
  );

  if (user) return user;

  const userId = uuidv4();
  await dbRun(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      organizationId,
      email.toLowerCase(),
      `sso-${ssoProvider}-no-password`,
      'USER',
      'active',
      firstName,
      lastName,
    ]
  );

  return { id: userId, email: email.toLowerCase(), role: 'USER', organization_id: organizationId };
}

function issueTokens(user: { id: string; email: string; role: string; organization_id: string }): {
  accessToken: string;
  refreshToken: string;
  jti: string;
} {
  const jti = uuidv4();
  const accessToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id,
      jti,
    },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN as SignOptions['expiresIn'] }
  );
  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh', jti: uuidv4() },
    config.JWT_SECRET,
    { expiresIn: config.REFRESH_TOKEN_EXPIRES_IN as SignOptions['expiresIn'] }
  );
  return { accessToken, refreshToken, jti };
}

async function createSsoSession(
  userId: string,
  organizationId: string,
  tokenHash: string,
  provider: string,
  req: Request,
  ssoSessionId?: string
): Promise<string> {
  const sessionId = uuidv4();
  await dbRun(
    `INSERT INTO user_sessions (id, user_id, organization_id, session_token_hash, auth_method, sso_provider, ip_address, user_agent, is_active, created_at, last_activity_at, expires_at)
     VALUES (?, ?, ?, ?, 'sso', ?, ?, ?, 1, datetime('now'), datetime('now'), datetime('now', '+8 hours'))`,
    [
      sessionId,
      userId,
      organizationId,
      tokenHash,
      provider,
      req.ip || '',
      req.get('user-agent') || '',
    ]
  );
  return sessionId;
}

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
  asyncHandler(async (req: Request, res: Response) => {
    const { domain, organizationId: orgIdParam } = req.query as {
      domain?: string;
      organizationId?: string;
    };
    const orgId = await resolveOrganizationId(domain as string, orgIdParam);
    if (!orgId) return res.status(400).json({ error: 'Cannot resolve organization' });

    const oidcCfg = await loadOIDCConfig(orgId);
    if (!oidcCfg)
      return res.status(404).json({ error: 'No active OIDC configuration for this organization' });

    const state = generateState();
    const nonce = generateNonce();

    await ensureAuthStatesTable();
    await dbRun(
      `INSERT INTO sso_auth_states (id, organization_id, state, nonce, provider_type, redirect_url)
       VALUES (?, ?, ?, ?, 'oidc', ?)`,
      [uuidv4(), orgId, state, nonce, (req.query.redirect_url as string) || '']
    );

    const authUrl = buildOIDCAuthUrl(oidcCfg, state, nonce);
    logger.info(`[SSO] OIDC authorize initiated for org ${orgId}`);
    res.json({ authUrl, state });
  })
);

router.post(
  '/oidc/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const { code, state } = req.body;
    if (!code) return res.status(400).json({ error: 'Authorization code required' });
    if (!state) return res.status(400).json({ error: 'State parameter required' });

    await ensureAuthStatesTable();
    const authState = await dbGet<any>(
      `SELECT * FROM sso_auth_states WHERE state = ? AND expires_at > datetime('now')`,
      [state]
    );
    if (!authState) {
      return res.status(400).json({ error: 'Invalid or expired state' });
    }

    await dbRun('DELETE FROM sso_auth_states WHERE state = ?', [state]);

    const oidcCfg = await loadOIDCConfig(authState.organization_id);
    if (!oidcCfg) {
      return res.status(500).json({ error: 'OIDC configuration not found' });
    }

    const tokens = await exchangeOIDCCode(oidcCfg, code);
    let userInfo: Record<string, unknown>;

    if (tokens.idToken) {
      userInfo = decodeIdToken(tokens.idToken);
    } else {
      userInfo = await getUserInfo(oidcCfg, tokens.accessToken);
    }

    const email = String(userInfo.email || '');
    if (!email) return res.status(400).json({ error: 'No email in OIDC response' });

    const firstName = String(userInfo.given_name || userInfo.name || 'SSO');
    const lastName = String(userInfo.family_name || 'User');

    const user = await findOrCreateUser(
      email,
      firstName,
      lastName,
      authState.organization_id,
      'oidc'
    );
    const { accessToken, refreshToken, jti } = issueTokens(user);

    const tokenHash = crypto.createHash('sha256').update(jti).digest('hex');
    const sessionId = await createSsoSession(
      user.id,
      authState.organization_id,
      tokenHash,
      'oidc',
      req
    );

    try {
      setAuthCookies(res, accessToken, refreshToken);
    } catch {
      /* ignore */
    }

    logger.info(`[SSO] OIDC login successful for ${email} (org: ${authState.organization_id})`);
    res.json({
      success: true,
      token: accessToken,
      refreshToken,
      sessionId,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
      },
      redirectUrl: authState.redirect_url || undefined,
    });
  })
);

// ── SAML Flow ──

router.get(
  '/saml/login',
  asyncHandler(async (req: Request, res: Response) => {
    const { domain, organizationId: orgIdParam } = req.query as {
      domain?: string;
      organizationId?: string;
    };
    const orgId = await resolveOrganizationId(domain as string, orgIdParam);
    if (!orgId) return res.status(400).json({ error: 'Cannot resolve organization' });

    const samlCfg = await loadSAMLConfig(orgId);
    if (!samlCfg)
      return res.status(404).json({ error: 'No active SAML configuration for this organization' });

    const requestId = `_${uuidv4()}`;
    const frontendUrl = config.FRONTEND_URL || 'http://localhost:3000';
    const acsUrl = `${frontendUrl}/api/sso/saml/callback`;

    const authnRequest = buildSAMLAuthnRequest(samlCfg, acsUrl, requestId);
    const encodedRequest = Buffer.from(authnRequest).toString('base64');

    const state = generateState();
    await ensureAuthStatesTable();
    await dbRun(
      `INSERT INTO sso_auth_states (id, organization_id, state, nonce, provider_type, redirect_url)
       VALUES (?, ?, ?, ?, 'saml', ?)`,
      [uuidv4(), orgId, state, requestId, (req.query.redirect_url as string) || '']
    );

    const redirectUrl = `${samlCfg.ssoUrl}?SAMLRequest=${encodeURIComponent(encodedRequest)}&RelayState=${encodeURIComponent(state)}`;
    logger.info(`[SSO] SAML login initiated for org ${orgId}`);
    res.json({ redirectUrl, state });
  })
);

router.post(
  '/saml/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const { SAMLResponse, RelayState } = req.body;
    if (!SAMLResponse) return res.status(400).json({ error: 'SAMLResponse required' });

    let orgId: string | null = null;

    if (RelayState) {
      await ensureAuthStatesTable();
      const authState = await dbGet<any>(
        `SELECT * FROM sso_auth_states WHERE state = ? AND expires_at > datetime('now')`,
        [RelayState]
      );
      if (authState) {
        orgId = authState.organization_id;
        await dbRun('DELETE FROM sso_auth_states WHERE state = ?', [RelayState]);
      }
    }

    const { nameId, attributes } = parseSAMLResponse(SAMLResponse);
    if (!nameId) return res.status(400).json({ error: 'No NameID in SAML response' });

    if (!orgId) {
      const emailDomain = nameId.split('@')[1];
      if (emailDomain) {
        orgId = await resolveOrganizationId(emailDomain);
      }
    }
    if (!orgId)
      return res.status(400).json({ error: 'Cannot determine organization from SAML response' });

    const samlCfg = await loadSAMLConfig(orgId);
    const mappings = samlCfg?.attributeMappings || {};

    const firstName =
      attributes[mappings.firstName || 'firstName'] ||
      attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] ||
      attributes['givenName'] ||
      'SSO';
    const lastName =
      attributes[mappings.lastName || 'lastName'] ||
      attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'] ||
      attributes['surname'] ||
      'User';
    const email =
      attributes[mappings.email || 'email'] ||
      attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
      nameId;

    const user = await findOrCreateUser(email, firstName, lastName, orgId, 'saml');
    const { accessToken, refreshToken, jti } = issueTokens(user);

    const tokenHash = crypto.createHash('sha256').update(jti).digest('hex');
    const sessionId = await createSsoSession(user.id, orgId, tokenHash, 'saml', req);

    try {
      setAuthCookies(res, accessToken, refreshToken);
    } catch {
      /* ignore */
    }

    logger.info(`[SSO] SAML login successful for ${email} (org: ${orgId})`);
    res.json({
      success: true,
      token: accessToken,
      refreshToken,
      sessionId,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
      },
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

    let endSessionUrl: string | undefined;
    if (req.organizationId) {
      const oidcCfg = await loadOIDCConfig(req.organizationId);
      if (oidcCfg?.endSessionEndpoint) {
        endSessionUrl = oidcCfg.endSessionEndpoint;
      } else {
        const samlCfg = await loadSAMLConfig(req.organizationId);
        if (samlCfg?.sloUrl) {
          endSessionUrl = samlCfg.sloUrl;
        }
      }
    }

    logger.info(`[SSO] Logout propagated for user ${userId}`);
    res.json({ success: true, endSessionUrl });
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
