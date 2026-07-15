/**
 * HP-24 — SSO self-service (org-admin configures own org's SAML/OIDC).
 *
 * Before this build, org admins could only flip an `ssoEnabled` boolean and
 * name a provider (readSecuritySettings/writeSecuritySettings in
 * adminP32.routes.ts) — the actual IdP metadata (SAML entity ID/SSO URL/
 * certificate, OIDC issuer/client id/secret) could only be written by
 * superadmin (views/superadmin/SSOConfigurationView.tsx →
 * server/src/routes/sso.routes.ts /saml/config, /google/config). The real
 * login flow (routes/integrations/sso.routes.ts loadOIDCConfig/
 * loadSAMLConfig) reads from `sso_configurations`, which self-service never
 * touched. GET/PUT /api/admin/sso-self + POST /api/admin/sso-self/validate
 * close that gap.
 *
 * This suite follows the exact mocking pattern of
 * tests/integration/admin/adminP32-cross-org-idor.test.ts (no real DB — all
 * calls stubbed) and asserts:
 *   Story A — an org-alpha admin can never read/write org-beta's SSO config
 *             (getAdminActor's cross-org guard, shared choke point).
 *   Story B — the write path is genuinely org-scoped in SQL (organization_id
 *             appears in the UPDATE/INSERT bind params, always the caller's
 *             own org — never trusts a body/query organizationId).
 *   Story C — enabling SSO without required IdP fields is rejected (400),
 *             so a half-configured org can't silently "enable" broken SSO.
 */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const dbGetMock = vi.hoisted(() => vi.fn());
const dbAllMock = vi.hoisted(() => vi.fn());
const dbRunMock = vi.hoisted(() => vi.fn());

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => dbAllMock(...args),
  get: (...args: unknown[]) => dbGetMock(...args),
  run: (...args: unknown[]) => dbRunMock(...args),
}));

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  authRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  createLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  validateParams: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  validateQuery: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/services/adminAuditService.js', () => ({
  default: { logAction: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../../server/src/utils/pgFlags.js', () => ({
  flagOn: vi.fn().mockReturnValue(false),
  parseMaybeJson: vi.fn((v: unknown) => v),
}));

vi.mock('../../../server/src/utils/ErrorHandler.js', () => ({
  AppError: class AppError extends Error {
    constructor(
      message: string,
      public statusCode = 500
    ) {
      super(message);
    }
  },
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: unknown, next: () => void) => next(),
  requireRole: (..._roles: string[]) => (req: any, res: any, next: () => void) => {
    const role = req.user?.role ?? '';
    const allowed = ['super_admin', 'admin', 'owner', 'administrator'];
    if (!allowed.includes(role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  },
}));

vi.mock('../../../server/src/middleware/requestAccess.js', () => ({
  isRequestSuperAdmin: (req: any) => req.user?.isSuperAdmin === true,
  getRequestAccessRole: (req: any) => {
    if (req.user?.isSuperAdmin) return 'superadmin';
    const role = String(req.user?.role ?? '').toLowerCase();
    if (role === 'owner') return 'owner';
    if (role === 'admin' || role === 'administrator') return 'admin';
    return 'member';
  },
  getSettingsActorRole: (req: any) => {
    const role = String(req.user?.role ?? '').toLowerCase();
    if (role === 'owner') return 'owner';
    if (role === 'admin' || role === 'administrator') return 'admin';
    return 'member';
  },
}));

// ── Constants ────────────────────────────────────────────────────────────────

const ORG_A = 'org-alpha';
const ORG_B = 'org-beta';
const ADMIN_A_USER = { id: 'user-admin-a', organizationId: ORG_A, role: 'admin' };

const VALID_SAML_PAYLOAD = {
  protocol: 'saml',
  providerName: 'Okta',
  providerType: 'okta',
  isEnabled: true,
  domains: ['acme.com'],
  saml: {
    entityId: 'urn:okta:acme',
    ssoUrl: 'https://acme.okta.com/sso/saml',
    certificate: '-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----',
  },
};

async function buildApp(user: Record<string, unknown>) {
  vi.resetModules();
  vi.resetAllMocks();
  dbGetMock.mockResolvedValue({ role: 'ADMIN' });
  dbAllMock.mockResolvedValue([]);
  dbRunMock.mockResolvedValue({ success: true, changes: 1 });

  const adminP32Router = (await import('../../../server/src/routes/adminP32.routes.js')).default;

  const app = express();
  app.use(express.json());
  app.use((req: any, _res: unknown, next: () => void) => {
    req.user = user;
    req.userRole = user.role;
    next();
  });
  app.use('/api/admin', adminP32Router);
  return app;
}

describe('HP-24 Story A — /api/admin/sso-self is org-scoped (cross-org IDOR)', () => {
  it('GET /sso-self?orgId=org-beta returns 403 ADMIN_BOUNDARY_VIOLATION for an org-alpha admin', async () => {
    const app = await buildApp(ADMIN_A_USER);
    const res = await request(app).get(`/api/admin/sso-self?orgId=${ORG_B}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ADMIN_BOUNDARY_VIOLATION');
  });

  it('PUT /sso-self?orgId=org-beta returns 403 ADMIN_BOUNDARY_VIOLATION for an org-alpha admin', async () => {
    const app = await buildApp(ADMIN_A_USER);
    const res = await request(app)
      .put(`/api/admin/sso-self?orgId=${ORG_B}`)
      .send(VALID_SAML_PAYLOAD);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ADMIN_BOUNDARY_VIOLATION');
  });

  it('POST /sso-self/validate?orgId=org-beta returns 403 ADMIN_BOUNDARY_VIOLATION for an org-alpha admin', async () => {
    const app = await buildApp(ADMIN_A_USER);
    const res = await request(app)
      .post(`/api/admin/sso-self/validate?orgId=${ORG_B}`)
      .send(VALID_SAML_PAYLOAD);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ADMIN_BOUNDARY_VIOLATION');
  });

  it('a member (non-admin, non-owner) is rejected before any SSO data is touched', async () => {
    const app = await buildApp({ id: 'user-member', organizationId: ORG_A, role: 'member' });
    dbGetMock.mockResolvedValue({ role: 'MEMBER' });

    const res = await request(app).get('/api/admin/sso-self');

    expect(res.status).toBe(403);
    // getAdminActor's capability lookup (admin_role_assignments) runs before
    // the 403 is decided — that's fine. What must NEVER happen is a query
    // against sso_configurations for a caller with no security capability.
    const ssoCalls = dbGetMock.mock.calls.filter(
      ([query]: [string]) => typeof query === 'string' && query.includes('sso_configurations')
    );
    expect(ssoCalls.length).toBe(0);
  });

  it('GET /sso-self (own org, no orgId spoof) passes the boundary guard', async () => {
    const app = await buildApp(ADMIN_A_USER);
    const res = await request(app).get('/api/admin/sso-self');

    expect(res.status).toBe(200);
    expect(res.body.organizationId).toBe(ORG_A);
  });
});

describe('HP-24 Story B — writes are pinned to the caller organization_id in SQL', () => {
  it('GET /sso-self reads sso_configurations scoped to the caller org, never a spoofed one', async () => {
    const app = await buildApp(ADMIN_A_USER);
    dbGetMock.mockImplementation((query: string, params: unknown[] = []) => {
      if (typeof query === 'string' && query.includes('organization_members')) {
        return Promise.resolve({ role: 'ADMIN' });
      }
      if (typeof query === 'string' && query.includes('sso_configurations')) {
        expect(query).toContain('organization_id');
        expect(params).toContain(ORG_A);
        expect(params).not.toContain(ORG_B);
        return Promise.resolve(undefined);
      }
      return Promise.resolve(undefined);
    });

    const res = await request(app).get('/api/admin/sso-self');
    expect(res.status).toBe(200);
    expect(res.body.config.configured).toBe(false);
  });

  it('PUT /sso-self INSERTs a new row bound to the caller org_id, ignoring any body organizationId', async () => {
    const app = await buildApp(ADMIN_A_USER);
    // No existing row -> INSERT path.
    dbGetMock.mockImplementation((query: string) => {
      if (typeof query === 'string' && query.includes('organization_members')) {
        return Promise.resolve({ role: 'ADMIN' });
      }
      return Promise.resolve(undefined);
    });

    const res = await request(app)
      .put('/api/admin/sso-self')
      .send({ ...VALID_SAML_PAYLOAD, organizationId: ORG_B }); // attacker-supplied field, must be ignored

    expect(res.status).toBe(200);
    const insertCalls = dbRunMock.mock.calls.filter(
      ([query]: [string]) => typeof query === 'string' && query.includes('INSERT INTO sso_configurations')
    );
    expect(insertCalls.length).toBeGreaterThan(0);
    for (const [query, params] of insertCalls) {
      expect(query).toContain('organization_id');
      expect(params).toContain(ORG_A);
      expect(params).not.toContain(ORG_B);
    }
  });

  it('PUT /sso-self UPDATEs the existing row WHERE organization_id = caller org (not the spoofed one)', async () => {
    const app = await buildApp(ADMIN_A_USER);
    dbGetMock.mockImplementation((query: string) => {
      if (typeof query === 'string' && query.includes('organization_members')) {
        return Promise.resolve({ role: 'ADMIN' });
      }
      if (typeof query === 'string' && query.includes('SELECT id FROM sso_configurations')) {
        return Promise.resolve({ id: 'sso-existing-row' });
      }
      if (typeof query === 'string' && query.includes('SELECT * FROM sso_configurations')) {
        return Promise.resolve({
          id: 'sso-existing-row',
          organization_id: ORG_A,
          protocol: 'saml',
          is_enabled: 0,
        });
      }
      return Promise.resolve(undefined);
    });

    const res = await request(app).put('/api/admin/sso-self').send(VALID_SAML_PAYLOAD);

    expect(res.status).toBe(200);
    const updateCalls = dbRunMock.mock.calls.filter(
      ([query]: [string]) => typeof query === 'string' && query.includes('UPDATE sso_configurations')
    );
    expect(updateCalls.length).toBeGreaterThan(0);
    for (const [query, params] of updateCalls) {
      expect(query).toMatch(/WHERE organization_id = \?/);
      expect(params[params.length - 1]).toBe(ORG_A);
    }
  });
});

describe('HP-24 Story C — half-configured SSO cannot be enabled', () => {
  it('rejects enabling SAML with no certificate (400 VALIDATION_ERROR)', async () => {
    const app = await buildApp(ADMIN_A_USER);
    dbGetMock.mockImplementation((query: string) => {
      if (typeof query === 'string' && query.includes('organization_members')) {
        return Promise.resolve({ role: 'ADMIN' });
      }
      return Promise.resolve(undefined); // no existing sso_configurations row
    });

    const res = await request(app)
      .put('/api/admin/sso-self')
      .send({
        protocol: 'saml',
        providerName: 'Okta',
        isEnabled: true,
        saml: { entityId: 'urn:okta:acme', ssoUrl: 'https://acme.okta.com/sso/saml' },
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details.join(' ')).toMatch(/certificate/i);
  });

  it('rejects a non-https SAML SSO URL', async () => {
    const app = await buildApp(ADMIN_A_USER);
    dbGetMock.mockImplementation((query: string) => {
      if (typeof query === 'string' && query.includes('organization_members')) {
        return Promise.resolve({ role: 'ADMIN' });
      }
      return Promise.resolve(undefined);
    });

    const res = await request(app)
      .put('/api/admin/sso-self')
      .send({
        ...VALID_SAML_PAYLOAD,
        saml: { ...VALID_SAML_PAYLOAD.saml, ssoUrl: 'http://acme.okta.com/sso/saml' },
      });

    expect(res.status).toBe(400);
    expect(res.body.details.join(' ')).toMatch(/https/i);
  });

  it('POST /sso-self/validate reports missing fields without requiring isEnabled in the body', async () => {
    const app = await buildApp(ADMIN_A_USER);
    dbGetMock.mockImplementation((query: string) => {
      if (typeof query === 'string' && query.includes('organization_members')) {
        return Promise.resolve({ role: 'ADMIN' });
      }
      return Promise.resolve(undefined);
    });

    const res = await request(app)
      .post('/api/admin/sso-self/validate')
      .send({ protocol: 'oidc', oidc: { issuer: 'https://idp.acme.com', clientId: 'abc' } });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
    expect(res.body.errors.join(' ')).toMatch(/client.?secret/i);
  });

  it('POST /sso-self/validate reports valid:true for a complete OIDC config', async () => {
    const app = await buildApp(ADMIN_A_USER);
    dbGetMock.mockImplementation((query: string) => {
      if (typeof query === 'string' && query.includes('organization_members')) {
        return Promise.resolve({ role: 'ADMIN' });
      }
      return Promise.resolve(undefined);
    });

    const res = await request(app)
      .post('/api/admin/sso-self/validate')
      .send({
        protocol: 'oidc',
        oidc: {
          issuer: 'https://idp.acme.com',
          clientId: 'abc',
          clientSecret: 'shh-secret',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.errors).toEqual([]);
  });
});
