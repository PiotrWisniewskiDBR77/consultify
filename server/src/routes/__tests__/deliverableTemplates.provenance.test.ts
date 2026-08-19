/** @vitest-environment node */

/**
 * POST /api/deliverables/templates/:id/provenance/approve
 * (MAT-POL / AMD-MAT-PROVENANCE-WRITER-002)
 *
 * Route-contract test only — the service's transaction/DB behaviour is covered
 * where the service lives. Here we prove the HTTP boundary: status mapping is
 * exhaustive, the identity used for the write comes ONLY from the verified
 * token (never the body), the Idempotency-Key HEADER is the single source of
 * the replay key (a body fallback was removed — a body-supplied idempotencyKey
 * is never consulted, even when the header is absent), templateId comes from
 * the URL not the body, and a 500 never echoes the raw error text to the
 * client.
 *
 * Mocking pattern copied from
 * server/src/routes/__tests__/workbook-commands.routes.test.ts: mock the
 * service module directly (functions as vi.fn(), error classes re-implemented
 * locally so `instanceof` checks inside the route still resolve against the
 * SAME class objects the route imports), mock auth/rbac middleware to inject a
 * fixed authenticated user, mount the real router with supertest. No DB.
 *
 * A SECOND, env-gated describe block lives at the bottom of this file: the
 * integrator ruled the mock-only suite above insufficient on its own (it
 * proves the HTTP boundary but stubs away the two things that actually decide
 * "who may attest rights" — the JWT verification and the tenant-role lookup
 * inside `approveTemplateProvenance` itself). That block mounts the REAL
 * router behind the REAL `verifyToken` + `requireOrgAccess` chain, with real
 * HS256-signed JWTs and real rows in `organizations` / `users` /
 * `organization_members`, against a real PostgreSQL database. It is
 * `describe.skipIf`-gated on four env vars (see `REAL_PG` below) and is a
 * no-op — collected, immediately skipped, nothing imported or executed — when
 * they are absent, so it cannot affect the mock-only suite above under normal
 * `vitest run` invocations without that env.
 *
 * Mixing an ahead-of-time `vi.mock()`'d suite with a real-stack suite in one
 * file requires undoing those mocks at runtime: `vi.unmock` is ITSELF hoisted
 * (see the vitest type declaration for `vi.unmock` — "This call is hoisted to
 * the top of the file, so it will only unmock modules that were defined in
 * `setupFiles`"), so it cannot reverse a same-file `vi.mock()` call. The
 * non-hoisted counterpart, `vi.doUnmock`, can — paired with
 * `vi.resetModules()` and a dynamic `import()` inside the real block's
 * `beforeAll`, this loads a genuinely fresh, unmocked module graph
 * (auth.middleware → rbac.middleware → deliverableTemplateService →
 * deliverableTemplates.routes) without touching the already-bound top-level
 * imports the mock-only suite above already captured at file-load time. This
 * is safe only because Vitest runs `describe` blocks in file declaration
 * order by default: the mock-only suite above always finishes before the
 * real block's `beforeAll` calls `resetModules`.
 */

import { randomUUID } from 'node:crypto';

import express, { type Express, type Router } from 'express';
import jwt from 'jsonwebtoken';
import { Pool, type PoolClient } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Vitest hoists vi.mock() factories above regular imports/consts, but it makes
// a special exception for identifiers prefixed with `mock` so they can still
// be referenced from inside a factory declared further down the file — same
// convention as workbook-commands.routes.test.ts.
const mockApproveTemplateProvenance = vi.fn();
const mockListPendingTemplateProvenance = vi.fn();

const AUTH_USER_ID = 'auth-user-1';
const AUTH_ORG_ID = 'auth-org-1';

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: AUTH_USER_ID, organizationId: AUTH_ORG_ID };
    next();
  },
}));

vi.mock('../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// suggestTemplate is imported at module scope by the router (POST /templates/suggest)
// but is unrelated to this endpoint; stub it so the module loads without pulling
// in its real dependency chain.
vi.mock('../../services/deliverableTemplateSuggestService.js', () => ({
  suggestTemplate: vi.fn(async () => null),
}));

vi.mock('../../services/deliverableTemplateService.js', () => {
  // Re-implemented locally (not vi.importActual) so this mock never drags in the
  // real service's DB/transaction dependency chain. The route only relies on
  // `instanceof` against the class object it imported from this same mocked
  // module, so a structurally-equivalent local class is sufficient — and
  // matches name/code 1:1 with the real classes in deliverableTemplateService.ts
  // so this test breaks if that contract drifts.
  class TemplateForbiddenError extends Error {
    constructor(msg = 'Cannot modify system template') {
      super(msg);
      this.name = 'TemplateForbiddenError';
    }
  }
  class TemplateNotFoundError extends Error {
    constructor(id: string) {
      super(`Template not found: ${id}`);
      this.name = 'TemplateNotFoundError';
    }
  }
  class TemplateProvenanceUnsupportedRegistryError extends Error {
    code = 'UNSUPPORTED_TEMPLATE_REGISTRY' as const;
    constructor(registry: string) {
      super(`Template registry is not approvable: ${registry}`);
      this.name = 'TemplateProvenanceUnsupportedRegistryError';
    }
  }
  class TemplateProvenanceInvalidError extends Error {
    code = 'INCOMPLETE_PROVENANCE' as const;
    constructor(field: string) {
      super(`Provenance field is required and must be non-empty: ${field}`);
      this.name = 'TemplateProvenanceInvalidError';
    }
  }
  class TemplateProvenanceForbiddenError extends Error {
    code: 'ORG_MEMBERSHIP_REVOKED' | 'PROVENANCE_ROLE_REQUIRED';
    constructor(code: 'ORG_MEMBERSHIP_REVOKED' | 'PROVENANCE_ROLE_REQUIRED', msg: string) {
      super(msg);
      this.code = code;
      this.name = 'TemplateProvenanceForbiddenError';
    }
  }
  class TemplateProvenanceConflictError extends Error {
    code: 'IDEMPOTENCY_KEY_REUSED' | 'TEMPLATE_ALREADY_APPROVED';
    constructor(code: 'IDEMPOTENCY_KEY_REUSED' | 'TEMPLATE_ALREADY_APPROVED', msg: string) {
      super(msg);
      this.code = code;
      this.name = 'TemplateProvenanceConflictError';
    }
  }
  return {
    approveTemplateProvenance: (...args: unknown[]) => mockApproveTemplateProvenance(...args),
    listPendingTemplateProvenance: (...args: unknown[]) =>
      mockListPendingTemplateProvenance(...args),
    createDeliverableTemplate: vi.fn(),
    deleteDeliverableTemplate: vi.fn(),
    getDeliverableTemplate: vi.fn(),
    listDeliverableTemplates: vi.fn(),
    syncWorkbookTemplateArtifactLifecycle: vi.fn(),
    updateDeliverableTemplate: vi.fn(),
    TemplateForbiddenError,
    TemplateNotFoundError,
    TemplateProvenanceConflictError,
    TemplateProvenanceForbiddenError,
    TemplateProvenanceInvalidError,
    TemplateProvenanceUnsupportedRegistryError,
  };
});

import {
  TemplateNotFoundError,
  TemplateProvenanceConflictError,
  TemplateProvenanceForbiddenError,
  TemplateProvenanceInvalidError,
  TemplateProvenanceUnsupportedRegistryError,
} from '../../services/deliverableTemplateService.js';
import deliverableTemplatesRoutes from '../deliverableTemplates.routes.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/deliverables', deliverableTemplatesRoutes);
  return app;
}

const TEMPLATE_ID = 'tmpl-777';
const APPROVE_URL = `/api/deliverables/templates/${TEMPLATE_ID}/provenance/approve`;

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    registry: 'generated_workbooks',
    source: 'internal-catalog',
    licenseBasis: 'owned',
    authority: 'legal@consultify.ai',
    version: '1.0.0',
    evidence: 'https://intranet.consultify.ai/rights/tmpl-777',
    ...overrides,
  };
}

function freshReceipt() {
  return {
    replayed: false,
    receipt: {
      organizationId: AUTH_ORG_ID,
      idempotencyKey: 'idem-key-1',
      registry: 'generated_workbooks',
      templateId: TEMPLATE_ID,
      requestFingerprint: 'fp-abc',
      provenanceVersion: '1.0.0',
      approvedBy: AUTH_USER_ID,
      approvedByRole: 'OWNER',
      createdAt: '2026-08-18T00:00:00.000Z',
    },
  };
}

beforeEach(() => {
  mockApproveTemplateProvenance.mockReset();
  mockListPendingTemplateProvenance.mockReset();
});

describe('GET /api/deliverables/templates-provenance/pending', () => {
  it('returns only the authenticated tenant rights queue', async () => {
    const templates = [
      {
        registry: 'presentation_templates',
        templateId: 'template-1',
        name: 'Board update',
        provenanceStatus: 'quarantined',
      },
    ];
    mockListPendingTemplateProvenance.mockResolvedValueOnce(templates);

    const res = await request(createApp()).get('/api/deliverables/templates-provenance/pending');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ templates });
    expect(mockListPendingTemplateProvenance).toHaveBeenCalledWith({
      organizationId: AUTH_ORG_ID,
      actorUserId: AUTH_USER_ID,
    });
  });

  it('fails closed when the service rejects the caller role', async () => {
    mockListPendingTemplateProvenance.mockRejectedValueOnce(
      new TemplateProvenanceForbiddenError(
        'PROVENANCE_ROLE_REQUIRED',
        'Owner or admin role required'
      )
    );

    const res = await request(createApp()).get('/api/deliverables/templates-provenance/pending');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PROVENANCE_ROLE_REQUIRED');
  });
});

describe('POST /api/deliverables/templates/:id/provenance/approve — status mapping', () => {
  it('returns 201 with the receipt on a fresh approval (replayed: false)', async () => {
    const result = freshReceipt();
    mockApproveTemplateProvenance.mockResolvedValueOnce(result);

    const res = await request(createApp())
      .post(APPROVE_URL)
      .set('Idempotency-Key', 'idem-key-1')
      .send(validBody());

    expect(mockApproveTemplateProvenance).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
    expect(res.body).toEqual(result);
  });

  it('returns 200 on a replay of an already-approved request (replayed: true)', async () => {
    const result = { ...freshReceipt(), replayed: true };
    mockApproveTemplateProvenance.mockResolvedValueOnce(result);

    const res = await request(createApp())
      .post(APPROVE_URL)
      .set('Idempotency-Key', 'idem-key-1')
      .send(validBody());

    expect(mockApproveTemplateProvenance).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(result);
  });

  it('maps TemplateProvenanceUnsupportedRegistryError to 400 and echoes its code', async () => {
    mockApproveTemplateProvenance.mockRejectedValueOnce(
      new TemplateProvenanceUnsupportedRegistryError('not_a_real_registry')
    );

    const res = await request(createApp())
      .post(APPROVE_URL)
      .set('Idempotency-Key', 'idem-key-1')
      .send(validBody({ registry: 'not_a_real_registry' }));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UNSUPPORTED_TEMPLATE_REGISTRY');
  });

  it('maps TemplateProvenanceInvalidError to 400 and echoes its code', async () => {
    mockApproveTemplateProvenance.mockRejectedValueOnce(
      new TemplateProvenanceInvalidError('source')
    );

    const res = await request(createApp())
      .post(APPROVE_URL)
      .set('Idempotency-Key', 'idem-key-1')
      .send(validBody({ source: '' }));

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INCOMPLETE_PROVENANCE');
  });

  it('maps TemplateProvenanceForbiddenError(ORG_MEMBERSHIP_REVOKED) to 403 and echoes its code', async () => {
    mockApproveTemplateProvenance.mockRejectedValueOnce(
      new TemplateProvenanceForbiddenError(
        'ORG_MEMBERSHIP_REVOKED',
        'Active organization membership required'
      )
    );

    const res = await request(createApp())
      .post(APPROVE_URL)
      .set('Idempotency-Key', 'idem-key-1')
      .send(validBody());

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ORG_MEMBERSHIP_REVOKED');
  });

  it('maps TemplateProvenanceForbiddenError(PROVENANCE_ROLE_REQUIRED) to 403 and echoes its code', async () => {
    mockApproveTemplateProvenance.mockRejectedValueOnce(
      new TemplateProvenanceForbiddenError(
        'PROVENANCE_ROLE_REQUIRED',
        'Organization OWNER or ADMIN role required'
      )
    );

    const res = await request(createApp())
      .post(APPROVE_URL)
      .set('Idempotency-Key', 'idem-key-1')
      .send(validBody());

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PROVENANCE_ROLE_REQUIRED');
  });

  it('maps TemplateProvenanceConflictError(IDEMPOTENCY_KEY_REUSED) to 409 and echoes its code', async () => {
    mockApproveTemplateProvenance.mockRejectedValueOnce(
      new TemplateProvenanceConflictError(
        'IDEMPOTENCY_KEY_REUSED',
        'Idempotency key was already used for a different approval'
      )
    );

    const res = await request(createApp())
      .post(APPROVE_URL)
      .set('Idempotency-Key', 'idem-key-1')
      .send(validBody());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('maps TemplateProvenanceConflictError(TEMPLATE_ALREADY_APPROVED) to 409 and echoes its code', async () => {
    mockApproveTemplateProvenance.mockRejectedValueOnce(
      new TemplateProvenanceConflictError(
        'TEMPLATE_ALREADY_APPROVED',
        'Template provenance has already been approved'
      )
    );

    const res = await request(createApp())
      .post(APPROVE_URL)
      .set('Idempotency-Key', 'idem-key-1')
      .send(validBody());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TEMPLATE_ALREADY_APPROVED');
  });

  it('maps TemplateNotFoundError to 404 without a coded response', async () => {
    mockApproveTemplateProvenance.mockRejectedValueOnce(new TemplateNotFoundError(TEMPLATE_ID));

    const res = await request(createApp())
      .post(APPROVE_URL)
      .set('Idempotency-Key', 'idem-key-1')
      .send(validBody());

    expect(res.status).toBe(404);
    // TemplateNotFoundError carries no .code — the route branch for it emits
    // only `{ error }`, unlike the coded provenance error branches above.
    expect(res.body.code).toBeUndefined();
    expect(res.body.error).toContain(TEMPLATE_ID);
  });

  it('maps an unexpected error to 500 with a generic message, never the raw error text', async () => {
    const secret = 'relation "template_provenance_approval_receipts" violates fk_constraint_9f2';
    mockApproveTemplateProvenance.mockRejectedValueOnce(new Error(secret));

    const res = await request(createApp())
      .post(APPROVE_URL)
      .set('Idempotency-Key', 'idem-key-1')
      .send(validBody());

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to approve template provenance' });
    // Belt-and-suspenders: scan the serialized body, not just the `error` field,
    // in case some other route change starts spreading extra properties in.
    expect(JSON.stringify(res.body)).not.toContain(secret);
  });
});

describe('POST /api/deliverables/templates/:id/provenance/approve — identity comes from the token only', () => {
  it('ignores every spoofed identity field in the body and forwards only the authenticated org/user', async () => {
    mockApproveTemplateProvenance.mockResolvedValueOnce(freshReceipt());

    const res = await request(createApp())
      .post(APPROVE_URL)
      .set('Idempotency-Key', 'header-key-1')
      .send(
        validBody({
          organizationId: 'attacker-org',
          organization_id: 'attacker-org-snake',
          actorUserId: 'attacker-user',
          userId: 'attacker-user-2',
          approvedBy: 'attacker-approver',
          approved_by_role: 'SUPERADMIN',
          // idempotencyKey belongs in the same spoof category as org/actor: a
          // body-supplied replay key must never reach the service, even
          // alongside a legitimate header.
          idempotencyKey: 'attacker-supplied-idem-key',
        })
      );

    expect(res.status).toBe(201);
    // First prove the mock was actually invoked, THEN inspect what it received —
    // an assertion about "absence" of a spoofed value is meaningless if we never
    // confirmed the call happened and captured real arguments.
    expect(mockApproveTemplateProvenance).toHaveBeenCalledTimes(1);
    const callArgs = mockApproveTemplateProvenance.mock.calls[0][0];

    expect(callArgs.organizationId).toBe(AUTH_ORG_ID);
    expect(callArgs.actorUserId).toBe(AUTH_USER_ID);
    expect(callArgs.organizationId).not.toBe('attacker-org');
    expect(callArgs.organizationId).not.toBe('attacker-org-snake');
    expect(callArgs.actorUserId).not.toBe('attacker-user');
    expect(callArgs.actorUserId).not.toBe('attacker-user-2');
    // The replay key comes from the header only — the body value must lose
    // even when a real header is also present.
    expect(callArgs.idempotencyKey).toBe('header-key-1');
    expect(callArgs.idempotencyKey).not.toBe('attacker-supplied-idem-key');
    // The service call shape has no slot for a caller-asserted approver identity
    // or role at all — approvedBy/approvedByRole are resolved server-side from
    // the DB inside the service. Confirm the spoofed values didn't sneak into
    // the call under any key.
    expect(JSON.stringify(callArgs)).not.toContain('attacker-approver');
    expect(JSON.stringify(callArgs)).not.toContain('SUPERADMIN');
  });
});

describe('POST /api/deliverables/templates/:id/provenance/approve — Idempotency-Key is header-only', () => {
  it('uses the Idempotency-Key header value as the replay key', async () => {
    mockApproveTemplateProvenance.mockResolvedValueOnce(freshReceipt());

    await request(createApp())
      .post(APPROVE_URL)
      .set('Idempotency-Key', 'header-key')
      .send(validBody());

    expect(mockApproveTemplateProvenance).toHaveBeenCalledTimes(1);
    const callArgs = mockApproveTemplateProvenance.mock.calls[0][0];
    expect(callArgs.idempotencyKey).toBe('header-key');
  });

  it('never falls back to body.idempotencyKey when the header is absent — service gets an empty key and the request is rejected', async () => {
    // Mirrors the real service's requireNonEmpty('idempotencyKey') behaviour:
    // an empty key is invalid and must never be silently replaced by a body
    // value. We don't assume this — the mock only rejects when the key it
    // actually received is empty, so the assertions below are load-bearing.
    mockApproveTemplateProvenance.mockImplementationOnce(async (params: any) => {
      if (!params.idempotencyKey) {
        throw new TemplateProvenanceInvalidError('idempotencyKey');
      }
      return freshReceipt();
    });

    const res = await request(createApp())
      .post(APPROVE_URL)
      .send(validBody({ idempotencyKey: 'body-only-key-must-be-ignored' }));

    expect(mockApproveTemplateProvenance).toHaveBeenCalledTimes(1);
    const callArgs = mockApproveTemplateProvenance.mock.calls[0][0];
    expect(callArgs.idempotencyKey).not.toBe('body-only-key-must-be-ignored');
    expect(callArgs.idempotencyKey).toBe('');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INCOMPLETE_PROVENANCE');
  });
});

describe('POST /api/deliverables/templates/:id/provenance/approve — templateId source', () => {
  it('takes templateId from the URL param, not from a conflicting body field', async () => {
    mockApproveTemplateProvenance.mockResolvedValueOnce(freshReceipt());

    await request(createApp())
      .post(APPROVE_URL)
      .set('Idempotency-Key', 'idem-key-1')
      .send(validBody({ templateId: 'body-supplied-other-template' }));

    expect(mockApproveTemplateProvenance).toHaveBeenCalledTimes(1);
    const callArgs = mockApproveTemplateProvenance.mock.calls[0][0];
    expect(callArgs.templateId).toBe(TEMPLATE_ID);
    expect(callArgs.templateId).not.toBe('body-supplied-other-template');
  });
});

// =============================================================================
// MAT-PROV-19 — real PostgreSQL, real auth chain (see file header for why this
// coexists with the mock-only suite above and how the same-file mock is
// defeated for this block only).
//
// Hard opt-in, ALL FOUR required, else describe.skipIf(...) makes this whole
// block a no-op:
//   RUN_DB_TESTS==='1' AND MOCK_DB==='false' AND
//   TEMPLATE_PROVENANCE_M19_CLEANUP==='1' AND DATABASE_URL startsWith 'postgres'
// PLUS a namespace guard in beforeAll: `SELECT current_database()` must equal
// the database name parsed from DATABASE_URL, and BOTH must match
// /^mat_provenance_/. Never weaken this — it is what stops this suite from
// ever writing into a database it wasn't explicitly handed.
// =============================================================================

const DATABASE_URL = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  process.env.TEMPLATE_PROVENANCE_M19_CLEANUP === '1' &&
  DATABASE_URL.startsWith('postgres');

const MAT_PROV_19_LOCK_KEY = 'consultify:mat-prov-19:deliverableTemplates.provenance.test.ts';

/**
 * Mirrors deliverableTemplateService.ts:1236-1240 (`TEMPLATE_REGISTRY_ID_COLUMN`,
 * a module-private const, not exported) so this file's own verification
 * queries know which column each registry keys its rows by. If that mapping
 * ever changes, this copy has to change with it — there is no way to import
 * the real one without exporting it from the service.
 */
const MAT_PROV_19_REGISTRY_ID_COLUMN: Record<string, string> = {
  document_studio_templates: 'template_id',
  presentation_templates: 'id',
  tp_base_templates: 'id',
};

function matProv19ParseDatabaseNameFromUrl(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\//, '');
  } catch {
    return '';
  }
}

describe.skipIf(!REAL_PG)(
  'POST /api/deliverables/templates/:id/provenance/approve — real PostgreSQL, real auth chain (MAT-PROV-19)',
  () => {
    type Actor = { id: string; email: string; token: string };

    let pool: Pool;
    let lockClient: PoolClient;
    let realRouter: Router;
    let jwtSecret = '';
    let canonicalRegistries: readonly string[] = [];

    let orgA = '';
    let orgB = '';
    let ownerA: Actor;
    let adminA: Actor;
    let memberA: Actor;
    let revokedA: Actor;
    let ownerB: Actor;
    let ghostSuperAdmin: { id: string; email: string };

    const createdUserIds: string[] = [];
    const createdMemberIds: string[] = [];
    const createdTemplateIds: {
      document_studio_templates: string[];
      presentation_templates: string[];
      tp_base_templates: string[];
    } = {
      document_studio_templates: [],
      presentation_templates: [],
      tp_base_templates: [],
    };

    function mountRealApp(): Express {
      const app = express();
      app.use(express.json());
      app.use('/api/deliverables', realRouter);
      return app;
    }

    function signToken(payload: Record<string, unknown>): string {
      return jwt.sign(payload, jwtSecret, { expiresIn: '30m' });
    }

    function realProvenanceBody(
      registry: string,
      overrides: Partial<{
        source: string;
        licenseBasis: string;
        authority: string;
        version: string;
        evidence: string;
      }> = {}
    ) {
      return {
        registry,
        source: 'internal-catalog',
        licenseBasis: 'owned',
        authority: 'legal@consultify.ai',
        version: '1.0.0',
        evidence: `https://intranet.consultify.ai/rights/${randomUUID()}`,
        ...overrides,
      };
    }

    async function seedOrg(name: string): Promise<string> {
      const id = randomUUID();
      await pool.query(
        `INSERT INTO organizations (id, name, plan, status) VALUES ($1, $2, 'enterprise', 'active')`,
        [id, name]
      );
      return id;
    }

    async function seedUser(orgId: string, label: string): Promise<{ id: string; email: string }> {
      const id = randomUUID();
      const email = `${label}-${id}@example.test`;
      await pool.query(
        `INSERT INTO users (id, organization_id, email, password, role, status)
         VALUES ($1, $2, $3, 'unused', 'MEMBER', 'active')`,
        [id, orgId, email]
      );
      createdUserIds.push(id);
      return { id, email };
    }

    async function seedActor(
      orgId: string,
      label: string,
      orgRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CONSULTANT',
      status: 'ACTIVE' | 'REVOKED'
    ): Promise<Actor> {
      const { id, email } = await seedUser(orgId, label);
      const memberId = randomUUID();
      await pool.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [memberId, orgId, id, orgRole, status]
      );
      createdMemberIds.push(memberId);
      const token = signToken({ id, email, organizationId: orgId, role: orgRole });
      return { id, email, token };
    }

    async function seedDocStudioTemplate(orgId: string, label: string): Promise<string> {
      const id = randomUUID();
      await pool.query(
        `INSERT INTO document_studio_templates
           (template_id, organization_id, name, category, document_type, purpose, created_by)
         VALUES ($1, $2, $3, 'general', 'report', 'MAT-PROV-19 fixture', $4)`,
        [id, orgId, label, orgId]
      );
      createdTemplateIds.document_studio_templates.push(id);
      return id;
    }

    async function seedPresentationTemplate(orgId: string, label: string): Promise<string> {
      const id = randomUUID();
      await pool.query(
        `INSERT INTO presentation_templates
           (id, organization_id, name, deck_type, outline_json, is_system, is_active)
         VALUES ($1, $2, $3, 'policy', '[]', FALSE, TRUE)`,
        [id, orgId, label]
      );
      createdTemplateIds.presentation_templates.push(id);
      return id;
    }

    async function seedTpBaseTemplate(orgId: string, label: string): Promise<string> {
      const id = randomUUID();
      await pool.query(
        `INSERT INTO tp_base_templates (id, organization_id, name, category, schema_snapshot)
         VALUES ($1, $2, $3, 'general', '{}'::jsonb)`,
        [id, orgId, label]
      );
      createdTemplateIds.tp_base_templates.push(id);
      return id;
    }

    async function provenanceStatusOf(
      registry: string,
      templateId: string
    ): Promise<string | null> {
      const idColumn = MAT_PROV_19_REGISTRY_ID_COLUMN[registry];
      const result = await pool.query<{ provenance_status: string }>(
        `SELECT provenance_status FROM ${registry} WHERE ${idColumn}::text = $1`,
        [templateId]
      );
      return result.rows[0]?.provenance_status ?? null;
    }

    async function receiptCount(organizationId: string, idempotencyKey: string): Promise<number> {
      const result = await pool.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM template_provenance_approval_receipts
          WHERE organization_id = $1 AND idempotency_key = $2`,
        [organizationId, idempotencyKey]
      );
      return Number(result.rows[0]?.count ?? 0);
    }

    async function receiptCountForTarget(
      organizationId: string,
      registry: string,
      templateId: string
    ): Promise<number> {
      const result = await pool.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM template_provenance_approval_receipts
          WHERE organization_id = $1 AND registry = $2 AND template_id = $3`,
        [organizationId, registry, templateId]
      );
      return Number(result.rows[0]?.count ?? 0);
    }

    beforeAll(async () => {
      pool = new Pool({ connectionString: DATABASE_URL });

      // Namespace guard (never weaken this): two independent readings of
      // "which database am I touching" must agree, and both must look like a
      // disposable MAT-PROV-19 scratch database, before a single fixture row
      // is written.
      const expectedDbName = matProv19ParseDatabaseNameFromUrl(DATABASE_URL);
      const actualDbNameResult = await pool.query<{ name: string }>(
        'SELECT current_database() AS name'
      );
      const actualDbName = String(actualDbNameResult.rows[0]?.name || '');
      if (
        !expectedDbName ||
        actualDbName !== expectedDbName ||
        !/^mat_provenance_/.test(actualDbName) ||
        !/^mat_provenance_/.test(expectedDbName)
      ) {
        throw new Error(
          `MAT-PROV-19 namespace guard refused this database: current_database()=${JSON.stringify(
            actualDbName
          )} DATABASE_URL database=${JSON.stringify(
            expectedDbName
          )} (both must match and start with "mat_provenance_")`
        );
      }

      lockClient = await pool.connect();
      await lockClient.query('SELECT pg_advisory_lock(hashtext($1))', [MAT_PROV_19_LOCK_KEY]);

      // Fresh, REAL module graph for this block only — see the file header
      // for why doUnmock+resetModules+dynamic import is required to defeat
      // the top-of-file vi.mock() calls without touching the mock-only suite
      // above (which has already finished running by the time this executes,
      // since Vitest runs describe blocks in file order by default).
      vi.resetModules();
      vi.doUnmock('../../middleware/auth.middleware.js');
      vi.doUnmock('../../middleware/rbac.middleware.js');
      vi.doUnmock('../../services/deliverableTemplateService.js');
      vi.doUnmock('../../services/deliverableTemplateSuggestService.js');
      vi.doUnmock('../../utils/Logger.js');

      const routesModule = await import('../deliverableTemplates.routes.js');
      realRouter = routesModule.default as Router;

      const serviceModule = await import('../../services/deliverableTemplateService.js');
      canonicalRegistries = serviceModule.TEMPLATE_PROVENANCE_REGISTRIES;

      const configModule = (await import('../../config/Config.js')) as {
        config?: { JWT_SECRET: string };
        default?: { JWT_SECRET: string };
      };
      jwtSecret = configModule.config?.JWT_SECRET || configModule.default?.JWT_SECRET || '';
      if (!jwtSecret) {
        throw new Error('Real Config.js did not yield a JWT_SECRET — cannot sign real tokens');
      }

      // Shared, read-only-after-creation identity fixtures. Template rows are
      // deliberately NOT shared — every `it()` below seeds its own, so tests
      // stay independent of declaration/execution order.
      orgA = await seedOrg('MAT-PROV-19 tenant A');
      orgB = await seedOrg('MAT-PROV-19 tenant B');

      ownerA = await seedActor(orgA, 'owner-a', 'OWNER', 'ACTIVE');
      adminA = await seedActor(orgA, 'admin-a', 'ADMIN', 'ACTIVE');
      memberA = await seedActor(orgA, 'member-a', 'MEMBER', 'ACTIVE');
      revokedA = await seedActor(orgA, 'revoked-a', 'MEMBER', 'REVOKED');
      ownerB = await seedActor(orgB, 'owner-b', 'OWNER', 'ACTIVE');
      // No organization_members row anywhere for this identity — see test 6.
      ghostSuperAdmin = await seedUser(orgA, 'ghost-superadmin');
    }, 30000);

    afterAll(async () => {
      if (!pool) return;
      try {
        // ---- Exact receipt accounting (ACCOUNT, do not exclude) ----
        // Every successful (201, `replayed: false`) call anywhere in the
        // suite above writes exactly one new row to
        // template_provenance_approval_receipts; every replay (200) and
        // every rejection (4xx/5xx) writes zero — that is the exact property
        // each numbered test's own `receiptCount(...)` assertions already
        // prove locally. Summed by hand against the numbered tests above:
        //   orgA: test 1, 2, 9(tp_base leg), 10, 11, 12, 13, 14, 15, 17 = 10
        //   orgB: test 14                                               =  1
        // Test 16 (poisoned CHECK) rolls its own insert back along with the
        // failed status UPDATE in the same transaction, so it contributes 0
        // — already proven inline by that test's own
        // `receiptCount(...).toBe(0)`. These two constants are the precise,
        // non-negotiable expectation, not a lower bound.
        const EXPECTED_ORG_A_RECEIPTS = 10;
        const EXPECTED_ORG_B_RECEIPTS = 1;

        const orgAReceiptCount = await pool.query<{ count: number }>(
          `SELECT count(*)::int AS count FROM template_provenance_approval_receipts WHERE organization_id = $1`,
          [orgA]
        );
        const orgBReceiptCount = await pool.query<{ count: number }>(
          `SELECT count(*)::int AS count FROM template_provenance_approval_receipts WHERE organization_id = $1`,
          [orgB]
        );
        expect(Number(orgAReceiptCount.rows[0]?.count ?? 0)).toBe(EXPECTED_ORG_A_RECEIPTS);
        expect(Number(orgBReceiptCount.rows[0]?.count ?? 0)).toBe(EXPECTED_ORG_B_RECEIPTS);

        // ---- Pinned cleanup transaction, on a dedicated client, FK-safe
        // order: templates (all three registries) -> organization_members ->
        // users. organizations and template_provenance_approval_receipts are
        // deliberately NOT included — see above and below. Final zero
        // residue for those two tables is achieved by the CALLER dropping
        // this entire disposable database after the suite finishes; this
        // suite asserts exact accounting for them, never zero.
        const cleanupClient = await pool.connect();
        try {
          await cleanupClient.query('BEGIN');
          if (createdTemplateIds.document_studio_templates.length) {
            await cleanupClient.query(
              `DELETE FROM document_studio_templates WHERE template_id = ANY($1::text[])`,
              [createdTemplateIds.document_studio_templates]
            );
          }
          if (createdTemplateIds.presentation_templates.length) {
            await cleanupClient.query(
              `DELETE FROM presentation_templates WHERE id = ANY($1::text[])`,
              [createdTemplateIds.presentation_templates]
            );
          }
          if (createdTemplateIds.tp_base_templates.length) {
            await cleanupClient.query(`DELETE FROM tp_base_templates WHERE id = ANY($1::uuid[])`, [
              createdTemplateIds.tp_base_templates,
            ]);
          }
          if (createdMemberIds.length) {
            await cleanupClient.query(
              `DELETE FROM organization_members WHERE id = ANY($1::text[])`,
              [createdMemberIds]
            );
          }
          if (createdUserIds.length) {
            await cleanupClient.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [
              createdUserIds,
            ]);
          }
          await cleanupClient.query('COMMIT');
        } catch (err) {
          await cleanupClient.query('ROLLBACK').catch(() => undefined);
          throw err;
        } finally {
          cleanupClient.release();
        }

        // ---- Receipts/organizations residue is a PROVEN DESIGN PROPERTY,
        // not an oversight — checked AFTER the cleanup transaction above, so
        // users/organization_members (which also reference organizations)
        // are already gone and the ONLY remaining referencing row is the
        // receipt(s) this suite wrote. template_provenance_approval_receipts
        // is fully append-only (its trigger —
        // 20261019_template_provenance_approval_receipts.sql's
        // guard_template_provenance_receipt_immutability — rejects UPDATE
        // and DELETE outright, reconfirmed below) and its organization_id
        // column REFERENCES organizations(id) ON DELETE RESTRICT. Deleting
        // either organization at this point MUST fail with a foreign-key
        // violation raised specifically by that table. Prove it by actually
        // attempting the delete, rather than merely asserting we chose not
        // to.
        for (const orgId of [orgA, orgB] as const) {
          let rejected = false;
          try {
            await pool.query('DELETE FROM organizations WHERE id = $1', [orgId]);
          } catch (err: any) {
            rejected = true;
            expect(err.code).toBe('23503');
            expect(String(err.detail || err.message || '')).toContain(
              'template_provenance_approval_receipts'
            );
          }
          expect(rejected).toBe(true);
        }

        // organizations and template_provenance_approval_receipts are NOT
        // deleted, and residue for them is NOT asserted zero here — see the
        // exact-count assertions and the proven-rejection loop above, which
        // together turn "we left it behind" into an accounted, verified
        // property of the schema rather than an unmeasured gap. Templates
        // and identity rows ARE fully reclaimed below — that is the honest
        // zero-residue this suite can claim by exact id.
        const residue = await pool.query<{
          doc_studio: number;
          presentation: number;
          tp_base: number;
          members: number;
          users: number;
        }>(
          `SELECT
             (SELECT count(*) FROM document_studio_templates WHERE template_id = ANY($1::text[]))::int AS doc_studio,
             (SELECT count(*) FROM presentation_templates WHERE id = ANY($2::text[]))::int AS presentation,
             (SELECT count(*) FROM tp_base_templates WHERE id = ANY($3::uuid[]))::int AS tp_base,
             (SELECT count(*) FROM organization_members WHERE id = ANY($4::text[]))::int AS members,
             (SELECT count(*) FROM users WHERE id = ANY($5::text[]))::int AS users`,
          [
            createdTemplateIds.document_studio_templates,
            createdTemplateIds.presentation_templates,
            createdTemplateIds.tp_base_templates,
            createdMemberIds,
            createdUserIds,
          ]
        );
        expect(residue.rows[0]).toEqual({
          doc_studio: 0,
          presentation: 0,
          tp_base: 0,
          members: 0,
          users: 0,
        });

        // The cleanup + accounting strategy above only holds because this
        // trigger is actually armed for the ENTIRE run — never disabled, not
        // even transiently. If it were ever disabled, "we didn't delete
        // receipts because the trigger forbids it" would be a false excuse,
        // not a real constraint — so confirm it, don't just assume it.
        const trigger = await pool.query<{ tgenabled: string }>(
          `SELECT tgenabled FROM pg_trigger
            WHERE tgrelid = 'template_provenance_approval_receipts'::regclass
              AND tgname = 'trg_template_provenance_receipt_immutable' AND NOT tgisinternal`
        );
        expect(trigger.rows[0]?.tgenabled).toBe('O');
      } finally {
        // Nested finally: the advisory lock MUST be released and its
        // release verified (not just attempted) even if the cleanup above
        // threw, and the pool MUST be ended even if the unlock itself
        // throws. Nothing in here is allowed to swallow an error from the
        // outer try — there is no catch above, so a thrown assertion or
        // query failure there propagates through both finally blocks and
        // fails the suite, exactly as it should.
        try {
          const unlockResult = await lockClient.query<{ unlocked: boolean }>(
            'SELECT pg_advisory_unlock(hashtext($1)) AS unlocked',
            [MAT_PROV_19_LOCK_KEY]
          );
          // A Pool discards a connection whose query rejected, so the lock
          // was taken AND is released on this SAME dedicated `lockClient`
          // (never via `pool.query`) — otherwise the unlock could land on a
          // different backend and this assertion would prove nothing.
          expect(unlockResult.rows[0]?.unlocked).toBe(true);

          const heldLocks = await lockClient.query<{ count: number }>(
            `SELECT count(*)::int AS count FROM pg_locks
              WHERE locktype = 'advisory' AND pid = pg_backend_pid()`
          );
          expect(Number(heldLocks.rows[0]?.count ?? 0)).toBe(0);
        } finally {
          lockClient.release();
          await pool.end();
        }
      }
    }, 30000);

    it('1. ACTIVE same-tenant OWNER approves a document_studio_templates target -> 201 with receipt', async () => {
      const templateId = await seedDocStudioTemplate(orgA, 'owner-approve-target');
      const key = `m19-owner-${randomUUID()}`;

      const res = await request(mountRealApp())
        .post(`/api/deliverables/templates/${templateId}/provenance/approve`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .set('Idempotency-Key', key)
        .send(realProvenanceBody('document_studio_templates'));

      expect(res.status).toBe(201);
      expect(res.body.replayed).toBe(false);
      expect(res.body.receipt.approvedBy).toBe(ownerA.id);
      expect(res.body.receipt.approvedByRole).toBe('OWNER');
      expect(res.body.receipt.templateId).toBe(templateId);
      expect(await receiptCount(orgA, key)).toBe(1);
      expect(await provenanceStatusOf('document_studio_templates', templateId)).toBe('approved');
    });

    it('2. ACTIVE same-tenant ADMIN approves a presentation_templates target (a different template) -> 201', async () => {
      const templateId = await seedPresentationTemplate(orgA, 'admin-approve-target');
      const key = `m19-admin-${randomUUID()}`;

      const res = await request(mountRealApp())
        .post(`/api/deliverables/templates/${templateId}/provenance/approve`)
        .set('Authorization', `Bearer ${adminA.token}`)
        .set('Idempotency-Key', key)
        .send(realProvenanceBody('presentation_templates'));

      expect(res.status).toBe(201);
      expect(res.body.receipt.approvedBy).toBe(adminA.id);
      expect(res.body.receipt.approvedByRole).toBe('ADMIN');
      expect(await receiptCount(orgA, key)).toBe(1);
      expect(await provenanceStatusOf('presentation_templates', templateId)).toBe('approved');
    });

    it('3. ACTIVE MEMBER is denied 403 PROVENANCE_ROLE_REQUIRED, zero writes', async () => {
      const templateId = await seedDocStudioTemplate(orgA, 'member-denied-target');
      const key = `m19-member-${randomUUID()}`;

      const res = await request(mountRealApp())
        .post(`/api/deliverables/templates/${templateId}/provenance/approve`)
        .set('Authorization', `Bearer ${memberA.token}`)
        .set('Idempotency-Key', key)
        .send(realProvenanceBody('document_studio_templates'));

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PROVENANCE_ROLE_REQUIRED');
      expect(await receiptCount(orgA, key)).toBe(0);
      expect(await provenanceStatusOf('document_studio_templates', templateId)).toBe('unknown');
    });

    it('4. REVOKED member is denied 403 ORG_MEMBERSHIP_REVOKED, zero writes', async () => {
      const templateId = await seedDocStudioTemplate(orgA, 'revoked-denied-target');
      const key = `m19-revoked-${randomUUID()}`;

      const res = await request(mountRealApp())
        .post(`/api/deliverables/templates/${templateId}/provenance/approve`)
        .set('Authorization', `Bearer ${revokedA.token}`)
        .set('Idempotency-Key', key)
        .send(realProvenanceBody('document_studio_templates'));

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ORG_MEMBERSHIP_REVOKED');
      expect(await receiptCount(orgA, key)).toBe(0);
      expect(await provenanceStatusOf('document_studio_templates', templateId)).toBe('unknown');
    });

    it('5. Foreign-tenant actor targeting another org template -> 404, no existence leak, zero writes', async () => {
      const templateId = await seedDocStudioTemplate(orgA, 'cross-tenant-target'); // belongs to orgA
      const key = `m19-crosstenant-${randomUUID()}`;

      const res = await request(mountRealApp())
        .post(`/api/deliverables/templates/${templateId}/provenance/approve`)
        .set('Authorization', `Bearer ${ownerB.token}`) // token org = orgB
        .set('Idempotency-Key', key)
        .send(realProvenanceBody('document_studio_templates'));

      expect(res.status).toBe(404);
      // TemplateNotFoundError carries no .code (deliverableTemplateService.ts:585-590);
      // the route's branch for it emits only `{ error }` — see the mock-only
      // "maps TemplateNotFoundError to 404" test above for the same contract.
      expect(res.body.code).toBeUndefined();
      expect(res.body.error).toContain(templateId);
      expect(await receiptCount(orgB, key)).toBe(0);
      expect(await provenanceStatusOf('document_studio_templates', templateId)).toBe('unknown');
    });

    it('6. Platform SUPERADMIN token with no organization_members row in the target org', async () => {
      const templateId = await seedDocStudioTemplate(orgA, 'ghost-superadmin-target');
      const key = `m19-ghost-${randomUUID()}`;
      const ghostToken = signToken({
        id: ghostSuperAdmin.id,
        email: ghostSuperAdmin.email,
        organizationId: orgA,
        role: 'SUPERADMIN',
        isSuperAdmin: true,
      });

      const res = await request(mountRealApp())
        .post(`/api/deliverables/templates/${templateId}/provenance/approve`)
        .set('Authorization', `Bearer ${ghostToken}`)
        .set('Idempotency-Key', key)
        .send(realProvenanceBody('document_studio_templates'));

      // Per deliverableTemplateService.ts:1399-1410, the tenant-membership
      // SELECT is a flat `organization_members` lookup with NO superadmin
      // bypass — `requireOrgAccess()` (rbac.middleware.ts:211-252) only
      // checks that SOME organizationId is present, it never reads
      // organization_members itself. A SUPERADMIN token holding no
      // membership row in this org should therefore fail the exact same
      // `!membership.rows.length` branch as any stranger: 403
      // ORG_MEMBERSHIP_REVOKED.
      //
      // AUTHORED WITHOUT A DATABASE (see task brief): this expectation is
      // written from reading the code above, not from having executed it.
      // The DoD expects denial. If the real run disagrees with this
      // assertion, THAT disagreement is a real product finding — report it,
      // do not loosen this assertion to match a surprise pass, and do not
      // patch product code to force it green.
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ORG_MEMBERSHIP_REVOKED');
      expect(await receiptCount(orgA, key)).toBe(0);
      expect(await provenanceStatusOf('document_studio_templates', templateId)).toBe('unknown');
    });

    it('7. No token -> denied before any write', async () => {
      const templateId = await seedDocStudioTemplate(orgA, 'no-token-target');
      const key = `m19-notoken-${randomUUID()}`;

      const res = await request(mountRealApp())
        .post(`/api/deliverables/templates/${templateId}/provenance/approve`)
        .set('Idempotency-Key', key)
        .send(realProvenanceBody('document_studio_templates'));

      expect(res.status).toBe(401);
      expect(await receiptCount(orgA, key)).toBe(0);
      expect(await provenanceStatusOf('document_studio_templates', templateId)).toBe('unknown');
    });

    // 8. Membership lookup failure (e.g. a transaction that cannot read
    // organization_members) -> non-2xx and zero writes.
    //
    // SKIPPED — could not write this deterministically without either
    // (a) editing product code to add a fault-injection hook (forbidden by
    // the task brief), or (b) DDL/privilege manipulation on a table every
    // OTHER test in this file (and possibly worker S1's separate file, if it
    // ends up sharing this database) depends on being readable — e.g.
    // `REVOKE SELECT ON organization_members` or holding an
    // `ACCESS EXCLUSIVE` lock across the request. Both require table-owner
    // or superuser privilege this file has no way to confirm it holds on a
    // handed-off database, and a mistimed release (process killed mid-test,
    // an unhandled rejection between REVOKE and the matching GRANT) would
    // leave organization_members broken for every other suite on that
    // instance, not just this one. That risk profile is exactly what the
    // task brief's escape hatch exists for: "If you cannot force this
    // deterministically without editing product code, say so and skip it
    // rather than faking it." Test 16 below forces a comparable
    // (UPDATE-fails-mid-transaction) fault via a CHECK constraint, but that
    // technique is scoped to a single throwaway row it owns outright — it
    // does not generalize to a SELECT against a table shared by every
    // fixture in this suite.
    it.skip('8. Membership lookup failure -> non-2xx and zero writes (see comment above — cannot force deterministically without editing product code or risking shared-table privilege manipulation)', () => {
      // Intentionally empty — see the skip reason above.
    });

    it('9. Registry gate: the three canonical registries are approvable; legacy + invented registries are 400 with zero writes', async () => {
      expect(canonicalRegistries).toEqual([
        'document_studio_templates',
        'presentation_templates',
        'tp_base_templates',
      ]);

      // document_studio_templates and presentation_templates are already
      // proven approvable by tests 1 and 2 above (distinct actors and
      // registries); this test adds the third canonical registry so all
      // three are covered, then both rejection cases.
      const tpBaseTemplateId = await seedTpBaseTemplate(orgA, 'registry-gate-tp-base');
      const tpBaseKey = `m19-registry-tpbase-${randomUUID()}`;
      const okRes = await request(mountRealApp())
        .post(`/api/deliverables/templates/${tpBaseTemplateId}/provenance/approve`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .set('Idempotency-Key', tpBaseKey)
        .send(realProvenanceBody('tp_base_templates'));
      expect(okRes.status).toBe(201);
      expect(await provenanceStatusOf('tp_base_templates', tpBaseTemplateId)).toBe('approved');

      // report_builder_templates is legacy and deliberately unsupported
      // (deliverableTemplateService.ts:1225-1231). The templateId path
      // param below targets a REAL document_studio_templates row, so a 400
      // here can only be the registry gate rejecting before any DB lookup
      // — not a 404 for a missing id.
      const legacyTargetId = await seedDocStudioTemplate(orgA, 'registry-gate-legacy-attempt');
      const legacyKey = `m19-registry-legacy-${randomUUID()}`;
      const legacyRes = await request(mountRealApp())
        .post(`/api/deliverables/templates/${legacyTargetId}/provenance/approve`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .set('Idempotency-Key', legacyKey)
        .send(realProvenanceBody('report_builder_templates'));
      expect(legacyRes.status).toBe(400);
      expect(legacyRes.body.code).toBe('UNSUPPORTED_TEMPLATE_REGISTRY');
      expect(await receiptCount(orgA, legacyKey)).toBe(0);
      expect(await provenanceStatusOf('document_studio_templates', legacyTargetId)).toBe('unknown');

      const inventedKey = `m19-registry-invented-${randomUUID()}`;
      const inventedRes = await request(mountRealApp())
        .post(`/api/deliverables/templates/${legacyTargetId}/provenance/approve`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .set('Idempotency-Key', inventedKey)
        .send(realProvenanceBody('not_a_real_registry_xyz'));
      expect(inventedRes.status).toBe(400);
      expect(inventedRes.body.code).toBe('UNSUPPORTED_TEMPLATE_REGISTRY');
      expect(await receiptCount(orgA, inventedKey)).toBe(0);
    }, 20000);

    it('10. 8 concurrent identical approvals -> exactly one 201, seven 200 replays, one receipt row, status flips once', async () => {
      const templateId = await seedPresentationTemplate(orgA, 'concurrency-target');
      const key = `m19-concurrency-${randomUUID()}`;
      const body = realProvenanceBody('presentation_templates');

      const responses = await Promise.all(
        Array.from({ length: 8 }, () =>
          request(mountRealApp())
            .post(`/api/deliverables/templates/${templateId}/provenance/approve`)
            .set('Authorization', `Bearer ${ownerA.token}`)
            .set('Idempotency-Key', key)
            .send(body)
        )
      );

      const created = responses.filter((r) => r.status === 201);
      const replayed = responses.filter((r) => r.status === 200);
      expect(created.length).toBe(1);
      expect(replayed.length).toBe(7);
      expect(created[0].body.replayed).toBe(false);
      for (const r of replayed) expect(r.body.replayed).toBe(true);

      expect(await receiptCount(orgA, key)).toBe(1);
      expect(await provenanceStatusOf('presentation_templates', templateId)).toBe('approved');
    }, 20000);

    it('11. Cold replay through a NEW Pool and a NEW express mount returns the same receipt with replayed:true', async () => {
      const templateId = await seedDocStudioTemplate(orgA, 'cold-replay-target');
      const key = `m19-coldreplay-${randomUUID()}`;
      const body = realProvenanceBody('document_studio_templates');

      const firstRes = await request(mountRealApp())
        .post(`/api/deliverables/templates/${templateId}/provenance/approve`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .set('Idempotency-Key', key)
        .send(body);
      expect(firstRes.status).toBe(201);

      // A genuinely new Pool (not the fixture `pool` above) and a
      // genuinely new Express mount around the same router module
      // instance — the router itself carries no per-request state, so a
      // matching replay here proves the replay comes from the database
      // row, not from any in-memory cache tied to a specific
      // app/connection instance.
      const coldPool = new Pool({ connectionString: DATABASE_URL });
      try {
        const coldApp = mountRealApp();
        const replayRes = await request(coldApp)
          .post(`/api/deliverables/templates/${templateId}/provenance/approve`)
          .set('Authorization', `Bearer ${ownerA.token}`)
          .set('Idempotency-Key', key)
          .send(body);

        expect(replayRes.status).toBe(200);
        expect(replayRes.body.replayed).toBe(true);
        expect(replayRes.body.receipt).toEqual(firstRes.body.receipt);

        const coldCheck = await coldPool.query<{ count: number }>(
          `SELECT count(*)::int AS count FROM template_provenance_approval_receipts
              WHERE organization_id = $1 AND idempotency_key = $2`,
          [orgA, key]
        );
        expect(Number(coldCheck.rows[0]?.count ?? 0)).toBe(1);
      } finally {
        await coldPool.end();
      }
    }, 20000);

    it('12. Same key, different authorized actor -> 409 IDEMPOTENCY_KEY_REUSED (the digest binds the actor), zero new receipt', async () => {
      const templateX = await seedDocStudioTemplate(orgA, 'actor-binding-first');
      const templateY = await seedDocStudioTemplate(orgA, 'actor-binding-second');
      const key = `m19-actorbind-${randomUUID()}`;

      const firstRes = await request(mountRealApp())
        .post(`/api/deliverables/templates/${templateX}/provenance/approve`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .set('Idempotency-Key', key)
        .send(realProvenanceBody('document_studio_templates'));
      expect(firstRes.status).toBe(201);

      const secondRes = await request(mountRealApp())
        .post(`/api/deliverables/templates/${templateY}/provenance/approve`)
        .set('Authorization', `Bearer ${adminA.token}`) // different authorized actor, same org
        .set('Idempotency-Key', key)
        .send(realProvenanceBody('document_studio_templates'));

      expect(secondRes.status).toBe(409);
      expect(secondRes.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
      expect(await receiptCount(orgA, key)).toBe(1); // only the first actor's receipt
      expect(await provenanceStatusOf('document_studio_templates', templateY)).toBe('unknown');
    });

    it('13. Same key, altered provenance body -> 409 IDEMPOTENCY_KEY_REUSED, zero new receipt', async () => {
      const templateId = await seedDocStudioTemplate(orgA, 'body-binding-target');
      const key = `m19-bodybind-${randomUUID()}`;

      const firstRes = await request(mountRealApp())
        .post(`/api/deliverables/templates/${templateId}/provenance/approve`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .set('Idempotency-Key', key)
        .send(
          realProvenanceBody('document_studio_templates', {
            evidence: 'https://intranet.consultify.ai/rights/original',
          })
        );
      expect(firstRes.status).toBe(201);

      const alteredRes = await request(mountRealApp())
        .post(`/api/deliverables/templates/${templateId}/provenance/approve`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .set('Idempotency-Key', key)
        .send(
          realProvenanceBody('document_studio_templates', {
            evidence: 'https://intranet.consultify.ai/rights/ALTERED',
          })
        );

      expect(alteredRes.status).toBe(409);
      expect(alteredRes.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
      expect(await receiptCount(orgA, key)).toBe(1);
    });

    it('14. The same raw key in two different tenants succeeds independently -> two receipts, no interference', async () => {
      const templateInA = await seedDocStudioTemplate(orgA, 'cross-tenant-same-key-a');
      const templateInB = await seedDocStudioTemplate(orgB, 'cross-tenant-same-key-b');
      const sharedKey = `m19-sharedkey-${randomUUID()}`;

      const resA = await request(mountRealApp())
        .post(`/api/deliverables/templates/${templateInA}/provenance/approve`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .set('Idempotency-Key', sharedKey)
        .send(realProvenanceBody('document_studio_templates'));
      const resB = await request(mountRealApp())
        .post(`/api/deliverables/templates/${templateInB}/provenance/approve`)
        .set('Authorization', `Bearer ${ownerB.token}`)
        .set('Idempotency-Key', sharedKey)
        .send(realProvenanceBody('document_studio_templates'));

      expect(resA.status).toBe(201);
      expect(resB.status).toBe(201);
      expect(resA.body.receipt.organizationId).toBe(orgA);
      expect(resB.body.receipt.organizationId).toBe(orgB);
      expect(await receiptCount(orgA, sharedKey)).toBe(1);
      expect(await receiptCount(orgB, sharedKey)).toBe(1);
      expect(await provenanceStatusOf('document_studio_templates', templateInA)).toBe('approved');
      expect(await provenanceStatusOf('document_studio_templates', templateInB)).toBe('approved');
    });

    it('15. Already-approved template under a NEW key -> 409 TEMPLATE_ALREADY_APPROVED, zero new receipt', async () => {
      const templateId = await seedPresentationTemplate(orgA, 'already-approved-target');
      const firstKey = `m19-alreadyapproved-first-${randomUUID()}`;
      const firstRes = await request(mountRealApp())
        .post(`/api/deliverables/templates/${templateId}/provenance/approve`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .set('Idempotency-Key', firstKey)
        .send(realProvenanceBody('presentation_templates'));
      expect(firstRes.status).toBe(201);

      const secondKey = `m19-alreadyapproved-second-${randomUUID()}`;
      const secondRes = await request(mountRealApp())
        .post(`/api/deliverables/templates/${templateId}/provenance/approve`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .set('Idempotency-Key', secondKey)
        .send(realProvenanceBody('presentation_templates'));

      expect(secondRes.status).toBe(409);
      expect(secondRes.body.code).toBe('TEMPLATE_ALREADY_APPROVED');
      expect(await receiptCount(orgA, secondKey)).toBe(0);
      expect(await receiptCountForTarget(orgA, 'presentation_templates', templateId)).toBe(1);
    });

    it('16. Forced rollback atomicity: a poisoned CHECK constraint fails the status UPDATE mid-transaction -> zero receipt residue, provenance_status unchanged', async () => {
      const poisonId = randomUUID();
      const constraintName = `ck_m19_poison_${randomUUID().replace(/-/g, '_')}`;

      await pool.query(
        `INSERT INTO presentation_templates
             (id, organization_id, name, deck_type, outline_json, is_system, is_active)
           VALUES ($1, $2, $3, 'policy', '[]', FALSE, TRUE)`,
        [poisonId, orgA, 'atomicity-poison-fixture']
      );
      // poisonId is a crypto.randomUUID() output (fixed hex/dash charset,
      // never user input), so interpolating it into DDL here carries no
      // injection risk. The CHECK only ever evaluates false for THIS row
      // transitioning to 'approved' — for every other row `id = poisonId`
      // is false, so the CHECK is trivially true for them regardless of
      // their own provenance_status. This reproduces
      // deliverableTemplateService.ts:1521-1532 (the status UPDATE, which
      // has no try/catch of its own unlike the receipt INSERT above it)
      // failing mid-transaction WITHOUT touching any file under server/.
      await pool.query(
        `ALTER TABLE presentation_templates ADD CONSTRAINT ${constraintName}
             CHECK (NOT (id = '${poisonId}' AND provenance_status = 'approved'))`
      );

      try {
        const key = `m19-atomicity-${randomUUID()}`;
        const res = await request(mountRealApp())
          .post(`/api/deliverables/templates/${poisonId}/provenance/approve`)
          .set('Authorization', `Bearer ${ownerA.token}`)
          .set('Idempotency-Key', key)
          .send(realProvenanceBody('presentation_templates'));

        // The CHECK violation (23514) is a raw, un-typed Postgres error —
        // it matches none of the route's typed `instanceof` branches
        // (deliverableTemplates.routes.ts:308-338), so it falls through to
        // the generic 500 branch: same shape as the mock-only "never
        // echoes the raw error text" test earlier in this file.
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Failed to approve template provenance' });

        expect(await receiptCount(orgA, key)).toBe(0);
        expect(await provenanceStatusOf('presentation_templates', poisonId)).toBe('unknown');
      } finally {
        await pool.query(
          `ALTER TABLE presentation_templates DROP CONSTRAINT IF EXISTS ${constraintName}`
        );
        await pool.query(`DELETE FROM presentation_templates WHERE id = $1`, [poisonId]);
      }
    }, 20000);

    it('17. Quarantine visibility through the real listDeliverableTemplates (GET /templates?type=deck): absent before approval, present after', async () => {
      const templateId = await seedPresentationTemplate(orgA, 'quarantine-visibility-target');

      const before = await request(mountRealApp())
        .get('/api/deliverables/templates?type=deck')
        .set('Authorization', `Bearer ${ownerA.token}`);
      expect(before.status).toBe(200);
      // listDeckTemplates (deliverableTemplateService.ts:135-150, legacy
      // fallback at :116-119) filters `provenance_status = 'approved'`;
      // this row starts 'unknown' (the m19 migration's column default), so
      // it must be absent from the list.
      expect(before.body.templates.map((t: { id: string }) => t.id)).not.toContain(templateId);

      const key = `m19-quarantine-${randomUUID()}`;
      const approveRes = await request(mountRealApp())
        .post(`/api/deliverables/templates/${templateId}/provenance/approve`)
        .set('Authorization', `Bearer ${ownerA.token}`)
        .set('Idempotency-Key', key)
        .send(realProvenanceBody('presentation_templates'));
      expect(approveRes.status).toBe(201);

      const after = await request(mountRealApp())
        .get('/api/deliverables/templates?type=deck')
        .set('Authorization', `Bearer ${ownerA.token}`);
      expect(after.status).toBe(200);
      expect(after.body.templates.map((t: { id: string }) => t.id)).toContain(templateId);
    }, 20000);
  }
);
