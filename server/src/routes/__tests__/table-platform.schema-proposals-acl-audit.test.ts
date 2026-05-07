/**
 * READ-ONLY ACL Audit on existing `/schema/proposals/*` endpoints (US-3.5).
 *
 * MUST NOT EDIT ANY SOURCE — this is a passive audit per D3.
 *
 * For each governance endpoint we simulate a cross-tenant request where:
 *  - actor belongs to `org-A`
 *  - proposal/workspace/base belong to `org-B`
 *
 * Expectation (security-correct behavior): cross-tenant access returns 403.
 * Actual behavior is captured in test assertions — when an assertion fails,
 * the test name names the leaking endpoint and the failure becomes the
 * P0 finding recorded in `audit-findings/SCHEMA_PROPOSALS_ACL_AUDIT_2026-05-07.md`.
 *
 * Per D3 (STOP-and-file): we DO NOT patch leaks in this block. The Sprint
 * Exit Gate is set to BLOCKED_P1 if any of these tests fail.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── ChatToSchemaService — every method receives an org-B-owned proposal ──────

const TENANT_A = 'org-A';
const TENANT_B = 'org-B';
const PROPOSAL_B = 'proposal-from-tenant-B';
const WORKSPACE_B = 'workspace-of-tenant-B';
const BASE_B = 'base-of-tenant-B';

const mockGenerateProposal = vi.fn();
const mockExecuteProposal = vi.fn();
const mockRejectProposal = vi.fn();
const mockRefineProposal = vi.fn();
const mockUndoProposal = vi.fn();
const mockRedoProposal = vi.fn();
const mockGetProposal = vi.fn();
const mockListProposals = vi.fn();

vi.mock('../../services/tablePlatform/ChatToSchemaService.js', () => ({
  default: {
    generateProposal: (...args: unknown[]) => mockGenerateProposal(...args),
    executeProposal: (...args: unknown[]) => mockExecuteProposal(...args),
    rejectProposal: (...args: unknown[]) => mockRejectProposal(...args),
    refineProposal: (...args: unknown[]) => mockRefineProposal(...args),
    undoProposal: (...args: unknown[]) => mockUndoProposal(...args),
    redoProposal: (...args: unknown[]) => mockRedoProposal(...args),
    getProposal: (...args: unknown[]) => mockGetProposal(...args),
    listProposals: (...args: unknown[]) => mockListProposals(...args),
    getSchemaHistory: vi.fn().mockReturnValue([]),
  },
}));

// ── PermissionsService — realistic semantics for cross-tenant ────────────────

// `requireRoles` resolves baseId from proposal → checks org match.
// Cross-tenant: actor.org=A, base.org=B → MUST 403.
vi.mock('../../services/tablePlatform/PermissionsService.js', () => ({
  default: {
    canAccessBase: (_userId: string, orgId: string, baseId: string) =>
      Promise.resolve(orgId === TENANT_B && baseId === BASE_B),
    requireBaseAccess: (req: any, res: any, next: any) => {
      const userOrg = req.organizationId;
      const baseOrg = TENANT_B; // base under audit belongs to tenant B
      if (userOrg !== baseOrg) return res.status(403).json({ error: 'Access denied to this base' });
      next();
    },
    requireTableAccess: (_req: any, _res: any, next: any) => next(),
    requireFieldAccess: (_req: any, _res: any, next: any) => next(),
    requireRecordAccess: (_req: any, _res: any, next: any) => next(),
    requireViewAccess: (_req: any, _res: any, next: any) => next(),
    requireRoles: (..._roles: string[]) => async (req: any, res: any, next: any) => {
      // Production middleware: resolves baseId from proposalId (via tp_schema_proposals
      // operations[0].target.base_id), then runs `requireRole(baseId, userId, orgId, ...)`
      // which falls back to `canAccessBase` validating `base.organization_id === orgId`.
      const proposalId = req.params?.proposalId;
      if (!proposalId) {
        res.status(400).json({ error: 'Cannot resolve baseId for permission check' });
        return;
      }
      // Simulate proposal.operations[0].target.base_id = BASE_B → base.org_id = TENANT_B.
      const baseOrgId = TENANT_B;
      const userOrgId = req.organizationId;
      if (userOrgId !== baseOrgId) {
        res.status(403).json({
          error: `Access denied. Required roles. Current role: none`,
        });
        return;
      }
      (req as any).resolvedBaseId = BASE_B;
      next();
    },
    SCHEMA_ROLES: ['base_owner', 'schema_editor'],
    DATA_ROLES: ['base_owner', 'schema_editor', 'data_editor'],
    VIEW_ROLES: ['base_owner', 'schema_editor', 'view_editor'],
    INTERFACE_ROLES: ['base_owner', 'schema_editor', 'interface_builder'],
    ALL_ROLES: [
      'base_owner',
      'schema_editor',
      'data_editor',
      'view_editor',
      'interface_builder',
      'viewer',
      'form_submitter',
    ],
  },
}));

// ── Other module mocks ───────────────────────────────────────────────────────

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../config/FeatureFlags.js', () => ({
  featureFlags: { ENABLE_TABLE_PLATFORM_RECORDS_API: true },
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../database/Database.js', () => ({
  getDatabase: () => ({
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes('FROM tp_bases') && sql.includes('workspace_id')) {
        const workspaceId = params[0];
        const orgId = params[1];
        return workspaceId === WORKSPACE_B && orgId === TENANT_B
          ? { rows: [{ id: BASE_B }] }
          : { rows: [] };
      }
      if (sql.includes('FROM tp_schema_proposals') && sql.includes('WHERE id = $1')) {
        return {
          rows: [
            {
              workspace_id: WORKSPACE_B,
              operations: [{ target: { base_id: BASE_B } }],
            },
          ],
        };
      }
      return { rows: [] };
    }),
  }),
}));

vi.mock('../../services/chatToSchema/safetyGuardrails.js', () => ({
  checkRateLimit: () => ({ allowed: true, retryAfterMs: 0 }),
  validateProposalLimits: () => ({ valid: true, errors: [] }),
  validateSchemaOperations: () => ({ valid: true, errors: [] }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockReq(overrides: Record<string, unknown> = {}): any {
  return {
    method: 'GET',
    params: {},
    body: {},
    query: {},
    headers: {},
    userId: 'user-A',
    organizationId: TENANT_A, // actor belongs to tenant A
    user: { id: 'user-A', organizationId: TENANT_A },
    ...overrides,
  };
}

function createMockRes(): any {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  res.send = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  return res;
}

async function importRouter(): Promise<any> {
  const mod = await import('../table-platform.routes.js');
  return mod.default;
}

function findRoute(router: any, method: string, path: string): any {
  return router.stack.find(
    (l: any) => l.route?.path === path && l.route?.methods?.[method.toLowerCase()]
  );
}

async function runFullChain(layer: any, req: any, res: any): Promise<void> {
  const handlers = layer.route.stack;
  for (const handler of handlers) {
    let nextCalled = false;
    let nextErr: unknown = null;
    await new Promise<void>((resolve) => {
      const result = handler.handle(req, res, (err?: unknown) => {
        nextCalled = true;
        nextErr = err;
        resolve();
      });
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        (result as Promise<unknown>).then(() => {
          if (!nextCalled) resolve();
        }, () => resolve());
      } else if (!nextCalled) {
        // Synchronous handler; if it called res.status(..).json(...) without
        // calling next, we resolve immediately.
        setImmediate(() => resolve());
      }
    });
    if (nextErr) throw nextErr;
    if (!nextCalled) return;
  }
}

interface AuditFinding {
  endpoint: string;
  method: string;
  routeMiddleware: 'requireRoles' | 'requireBaseAccess' | 'none';
  crossTenantStatus: number;
  guardPresent: boolean;
  notes: string;
}

const findings: AuditFinding[] = [];

function record(finding: AuditFinding) {
  findings.push(finding);
}

// ── Audit cases ──────────────────────────────────────────────────────────────

describe('ACL Audit on /schema/proposals/* (US-3.5, READ-ONLY)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Every service method, when called, returns data that BELONGS to TENANT_B
    // (i.e., what a leak would expose). Failure to gate at the route means
    // the actor (TENANT_A) can read/mutate this object → P0 leak.
    mockGenerateProposal.mockResolvedValue({
      id: PROPOSAL_B,
      workspaceId: WORKSPACE_B,
      operations: [],
      status: 'pending',
    });
    mockExecuteProposal.mockResolvedValue({ success: true, status: 'executed' });
    mockRejectProposal.mockResolvedValue(undefined);
    mockRefineProposal.mockResolvedValue({
      id: PROPOSAL_B,
      workspaceId: WORKSPACE_B,
      operations: [],
      status: 'pending',
    });
    mockUndoProposal.mockResolvedValue({ success: true });
    mockRedoProposal.mockResolvedValue({ success: true });
    mockGetProposal.mockResolvedValue({
      id: PROPOSAL_B,
      workspace_id: WORKSPACE_B,
      organization_id: TENANT_B,
      operations: [{ target: { base_id: BASE_B } }],
    });
    mockListProposals.mockResolvedValue([
      {
        id: PROPOSAL_B,
        workspace_id: WORKSPACE_B,
        organization_id: TENANT_B,
        operations: [],
      },
    ]);
  });

  it('Endpoint #1: POST /schema/propose — cross-tenant request behavior', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'post', '/schema/propose');
    expect(layer).toBeDefined();

    const req = createMockReq({
      method: 'POST',
      // Body specifies workspaceId from tenant B; route reads workspaceId from BODY.
      body: { workspaceId: WORKSPACE_B, message: 'add a Tasks table' },
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    record({
      endpoint: 'POST /schema/propose',
      method: 'POST',
      routeMiddleware: 'requireBaseAccess',
      crossTenantStatus: res.statusCode,
      guardPresent: res.statusCode === 403,
      notes:
        'Guarded by requireWorkspaceTenantAccess; workspaceId must belong to actor organization.',
    });

    // Document expected behavior (will fail on leak):
    expect(res.statusCode).toBe(403);
  });

  it('Endpoint #2: POST /schema/proposals/:proposalId/execute — cross-tenant 403 expected', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'post', '/schema/proposals/:proposalId/execute');
    expect(layer).toBeDefined();

    const req = createMockReq({
      method: 'POST',
      params: { proposalId: PROPOSAL_B },
      body: {},
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    record({
      endpoint: 'POST /schema/proposals/:proposalId/execute',
      method: 'POST',
      routeMiddleware: 'requireRoles',
      crossTenantStatus: res.statusCode,
      guardPresent: res.statusCode === 403,
      notes:
        'Has requireRoles(...SCHEMA_ROLES). Resolves baseId from proposal → ' +
        'canAccessBase validates base.organization_id === actor.organizationId.',
    });

    expect(res.statusCode).toBe(403);
  });

  it('Endpoint #3: POST /schema/proposals/:proposalId/reject — cross-tenant request behavior', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'post', '/schema/proposals/:proposalId/reject');
    expect(layer).toBeDefined();

    const req = createMockReq({
      method: 'POST',
      params: { proposalId: PROPOSAL_B },
      body: { reason: 'cross-tenant attempt' },
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    record({
      endpoint: 'POST /schema/proposals/:proposalId/reject',
      method: 'POST',
      routeMiddleware: 'requireRoles',
      crossTenantStatus: res.statusCode,
      guardPresent: res.statusCode === 403,
      notes:
        'Guarded by requireSchemaProposalAccess; proposal resolves to base and base org must match actor org.',
    });

    expect(res.statusCode).toBe(403);
  });

  it('Endpoint #4: POST /schema/proposals/:proposalId/refine — cross-tenant request behavior', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'post', '/schema/proposals/:proposalId/refine');
    expect(layer).toBeDefined();

    const req = createMockReq({
      method: 'POST',
      params: { proposalId: PROPOSAL_B },
      body: { message: 'refine me' },
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    record({
      endpoint: 'POST /schema/proposals/:proposalId/refine',
      method: 'POST',
      routeMiddleware: 'requireRoles',
      crossTenantStatus: res.statusCode,
      guardPresent: res.statusCode === 403,
      notes:
        'Guarded by requireSchemaProposalAccess; proposal resolves to base and base org must match actor org.',
    });

    expect(res.statusCode).toBe(403);
  });

  it('Endpoint #5: POST /schema/proposals/:proposalId/undo — cross-tenant request behavior', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'post', '/schema/proposals/:proposalId/undo');
    expect(layer).toBeDefined();

    const req = createMockReq({
      method: 'POST',
      params: { proposalId: PROPOSAL_B },
      body: { baseId: BASE_B },
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    record({
      endpoint: 'POST /schema/proposals/:proposalId/undo',
      method: 'POST',
      routeMiddleware: 'requireRoles',
      crossTenantStatus: res.statusCode,
      guardPresent: res.statusCode === 403,
      notes:
        'Guarded by requireSchemaProposalAccess; baseId is resolved server-side from proposal.',
    });

    expect(res.statusCode).toBe(403);
  });

  it('Endpoint #6: POST /schema/proposals/:proposalId/redo — cross-tenant request behavior', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'post', '/schema/proposals/:proposalId/redo');
    expect(layer).toBeDefined();

    const req = createMockReq({
      method: 'POST',
      params: { proposalId: PROPOSAL_B },
      body: { baseId: BASE_B },
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    record({
      endpoint: 'POST /schema/proposals/:proposalId/redo',
      method: 'POST',
      routeMiddleware: 'requireRoles',
      crossTenantStatus: res.statusCode,
      guardPresent: res.statusCode === 403,
      notes:
        'Guarded by requireSchemaProposalAccess; baseId is resolved server-side from proposal.',
    });

    expect(res.statusCode).toBe(403);
  });

  it('Endpoint #7: GET /schema/proposals/:proposalId — cross-tenant request behavior', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'get', '/schema/proposals/:proposalId');
    expect(layer).toBeDefined();

    const req = createMockReq({
      method: 'GET',
      params: { proposalId: PROPOSAL_B },
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    record({
      endpoint: 'GET /schema/proposals/:proposalId',
      method: 'GET',
      routeMiddleware: 'requireRoles',
      crossTenantStatus: res.statusCode,
      guardPresent: res.statusCode === 403,
      notes:
        'Guarded by requireSchemaProposalAccess before ChatToSchemaService.getProposal is called.',
    });

    expect(res.statusCode).toBe(403);
  });

  it('Endpoint #8: GET /workspaces/:workspaceId/schema/proposals — cross-tenant request behavior', async () => {
    const router = await importRouter();
    const layer = findRoute(router, 'get', '/workspaces/:workspaceId/schema/proposals');
    expect(layer).toBeDefined();

    const req = createMockReq({
      method: 'GET',
      params: { workspaceId: WORKSPACE_B },
      query: {},
    });
    const res = createMockRes();
    await runFullChain(layer!, req, res);

    record({
      endpoint: 'GET /workspaces/:workspaceId/schema/proposals',
      method: 'GET',
      routeMiddleware: 'requireBaseAccess',
      crossTenantStatus: res.statusCode,
      guardPresent: res.statusCode === 403,
      notes:
        'Guarded by requireWorkspaceTenantAccess before listProposals is called.',
    });

    expect(res.statusCode).toBe(403);
  });

  it('Audit summary — at least one finding recorded', () => {
    // Sanity check the audit ran and emitted findings (sets baseline for the
    // findings doc). Per D3 we record but DO NOT patch.
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });
});

export { findings as __auditFindings };
