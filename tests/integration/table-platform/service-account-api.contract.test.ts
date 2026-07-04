/**
 * TP REST API — Service Account (PAT) auth + scope enforcement contract test.
 *
 * Proves the "Airtable API" gateway: a `tp_sa_*` token authenticates the record
 * endpoints OUTSIDE the interactive user-JWT path, with scope + org isolation.
 *
 * This exercises the REAL middleware chain mounted by the router:
 *   serviceAccountAuth → verifyToken → requireServiceAccountScope
 *     → requireTableAccess / requireRecordAccess → requireRoles
 * Only the token-hash lookup (ServiceAccountService.validateToken), the DB, and
 * the leaf RecordsService are stubbed. `verifyToken` is stubbed FAITHFULLY: it
 * rejects with 401 unless an upstream middleware already established a
 * principal (req.userId) — exactly how the real JWT verifier treats a
 * non-JWT `tp_sa_*` bearer. Therefore, on the PRE-fix code (no serviceAccountAuth
 * in the chain) every SA request 401s, including read — the required
 * red-before. POST-fix, reads succeed and scope/org rules are enforced.
 *
 * Anti-false-green: validateToken is driven per-test (valid read SA, valid
 * write SA, expired/revoked → invalid, wrong-org SA). The DB mock resolves the
 * target table into a base owned by org-A, so a wrong-org token is denied by
 * the real canAccessBase org check — not by any test shortcut.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted controls ────────────────────────────────────────────────────────
const mockValidateToken = vi.hoisted(() => vi.fn());
const queryMock = vi.hoisted(() => vi.fn());
const mockListRecords = vi.hoisted(() => vi.fn());
const mockUpdateRecord = vi.hoisted(() => vi.fn());

// ── Infra mocks ─────────────────────────────────────────────────────────────
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({
    query: (...args: unknown[]) => queryMock(...(args as [string, unknown[]])),
  }),
}));

vi.mock('express-rate-limit', () => ({
  default: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
  ipKeyGenerator: vi.fn(() => () => 'test-ip'),
}));

vi.mock('../../../server/src/config/FeatureFlags.js', () => ({
  featureFlags: { ENABLE_TABLE_PLATFORM_RECORDS_API: true, ENABLE_TABLE_PLATFORM: true },
}));

// Faithful verifyToken stub: passes ONLY if a principal was already attached
// upstream (mirrors the real verifier rejecting a non-JWT tp_sa_* bearer).
vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    if (req.isServiceAccount === true || req.userId) {
      next();
      return;
    }
    res.status(401).json({ error: 'No token provided' });
  },
  requireSuperAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// REAL service-account middleware under test — only validateToken is stubbed.
vi.mock('../../../server/src/services/tablePlatform/ServiceAccountService.js', () => ({
  serviceAccountService: {
    validateToken: (...args: unknown[]) => mockValidateToken(...args),
  },
}));

vi.mock('../../../server/src/middleware/requireAudit.middleware.js', () => ({
  requireAudit: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// RecordsService leaf — record CRUD result is not what we assert (auth is).
vi.mock('../../../server/src/services/tablePlatform/RecordsService.js', () => ({
  default: {
    listRecords: (...args: unknown[]) => mockListRecords(...args),
    updateRecord: (...args: unknown[]) => mockUpdateRecord(...args),
    getRecord: vi.fn(),
    createRecord: vi.fn(),
  },
}));

// Heavy sibling services stubbed so the router module imports cleanly.
vi.mock('../../../server/src/services/tablePlatform/AutomationService.js', () => ({
  automationService: { triggerNow: vi.fn(), getAutomationRuns: vi.fn(), evaluateTriggers: vi.fn() },
}));
vi.mock('../../../server/src/services/tablePlatform/ExtensionService.js', () => ({
  extensionService: { listExtensions: vi.fn() },
}));
vi.mock('../../../server/src/services/tablePlatform/InterfaceService.js', () => ({
  interfaceService: { listInterfaces: vi.fn() },
}));
vi.mock('../../../server/src/services/tablePlatform/MetadataService.js', () => ({
  default: { getTableMetadata: vi.fn() },
}));
vi.mock('../../../server/src/services/tablePlatform/ProjectionService.js', () => ({
  default: { project: vi.fn() },
}));
vi.mock('../../../server/src/services/tablePlatform/ScheduledAutomationExecutor.js', () => ({
  scheduledAutomationExecutor: { schedule: vi.fn(), cancel: vi.fn() },
  validateCronExpression: vi.fn().mockReturnValue(true),
}));
vi.mock('../../../server/src/services/tablePlatform/SCIMService.js', () => ({
  scimService: { provisionUser: vi.fn() },
}));
vi.mock('../../../server/src/services/tablePlatform/SSOService.js', () => ({
  ssoService: { getSSOConfig: vi.fn() },
}));
vi.mock('../../../server/src/services/tablePlatform/WebhookDispatcherService.js', () => ({
  webhookDispatcher: { dispatch: vi.fn(), dispatchEvent: vi.fn() },
}));
vi.mock('../../../server/src/services/tablePlatform/WebhookRelayService.js', () => ({
  webhookRelayService: { relay: vi.fn(), dispatchEvent: vi.fn() },
}));
vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  registerArtifact: vi.fn(),
  getArtifact: vi.fn(),
}));
vi.mock('../../../server/src/services/v8/reportsPresModelService.js', () => ({
  getReportByBaseId: vi.fn(),
}));

// ── Router under test (REAL PermissionsService + serviceAccountAuth) ────────
import tablePlatformRoutes from '../../../server/src/routes/table-platform.routes.js';

// ── DB fixture: table tbl-a → base-a owned by org-A; NO tp_base_members rows ──
const ORG_A = 'org-a';
const BASE_A = 'base-a';
const TABLE_A = 'tbl-a';
const RECORD_A = 'rec-a';

function installOrgADb(): void {
  queryMock.mockImplementation(async (sql: string) => {
    const s = String(sql).replace(/\s+/g, ' ').trim();
    if (s.startsWith('SELECT t.base_id FROM tp_tables'))
      return { rows: [{ base_id: BASE_A }], rowCount: 1 };
    if (s.startsWith('SELECT base_id FROM tp_tables'))
      return { rows: [{ base_id: BASE_A }], rowCount: 1 };
    if (s.startsWith('SELECT table_id FROM tp_records'))
      return { rows: [{ table_id: TABLE_A }], rowCount: 1 };
    if (s.startsWith('SELECT organization_id, created_by FROM tp_bases'))
      return { rows: [{ organization_id: ORG_A, created_by: 'human-owner' }], rowCount: 1 };
    if (s.startsWith('SELECT role FROM tp_base_members')) return { rows: [], rowCount: 0 };
    return { rows: [], rowCount: 0 };
  });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/table-platform', tablePlatformRoutes);
  return app;
}

const validReadSA = () => ({
  valid: true,
  account: { id: 'sa-1', name: 'CI Read Bot', scopes: ['records:read'] },
  organizationId: ORG_A,
});
const validWriteSA = () => ({
  valid: true,
  account: { id: 'sa-2', name: 'CI Write Bot', scopes: ['records:read', 'records:write'] },
  organizationId: ORG_A,
});

const BEARER = 'tp_sa_faketokenfaketokenfaketokenfaketokenfaketoken';

describe('TP REST API — service-account (PAT) auth + scope enforcement', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    installOrgADb();
    mockListRecords.mockResolvedValue({ records: [], nextCursor: null });
    mockUpdateRecord.mockResolvedValue({ id: RECORD_A, data: { title: 'x' } });
    app = buildApp();
  });

  // (a) valid records:read token → GET records 200
  it('(a) valid tp_sa_ token with records:read → GET records 200', async () => {
    mockValidateToken.mockResolvedValue(validReadSA());

    const res = await request(app)
      .get(`/api/table-platform/tables/${TABLE_A}/records`)
      .set('Authorization', `Bearer ${BEARER}`);

    expect(res.status).toBe(200);
    expect(mockValidateToken).toHaveBeenCalledWith(BEARER);
    expect(mockListRecords).toHaveBeenCalled();
    // Role capped to viewer (read-only scope) — NOT base_owner.
    const opts = mockListRecords.mock.calls[0][1] as { userRole?: string };
    expect(opts.userRole).toBe('viewer');
  });

  // (b) same principal WITHOUT records:write → PATCH 403 (scope gate)
  it('(b) tp_sa_ token missing records:write → PATCH records 403', async () => {
    mockValidateToken.mockResolvedValue(validReadSA()); // read-only scope

    const res = await request(app)
      .patch(`/api/table-platform/records/${RECORD_A}`)
      .set('Authorization', `Bearer ${BEARER}`)
      .send({ data: { title: 'edit' } });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('SERVICE_ACCOUNT_SCOPE_DENIED');
    expect(mockUpdateRecord).not.toHaveBeenCalled();
  });

  // (b2) WITH records:write → PATCH is allowed past the scope gate
  it('(b2) tp_sa_ token with records:write → PATCH records 200', async () => {
    mockValidateToken.mockResolvedValue(validWriteSA());

    const res = await request(app)
      .patch(`/api/table-platform/records/${RECORD_A}`)
      .set('Authorization', `Bearer ${BEARER}`)
      .send({ data: { title: 'edit' } });

    expect(res.status).toBe(200);
    expect(mockUpdateRecord).toHaveBeenCalled();
    // Effective role for a write SA is data_editor (never base_owner/schema).
    const roleArg = mockUpdateRecord.mock.calls[0][4];
    expect(roleArg).toBe('data_editor');
  });

  // (c) expired / revoked token → 401
  it('(c) expired or revoked tp_sa_ token → 401', async () => {
    mockValidateToken.mockResolvedValue({ valid: false }); // expired/revoked/unknown

    const res = await request(app)
      .get(`/api/table-platform/tables/${TABLE_A}/records`)
      .set('Authorization', `Bearer ${BEARER}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SERVICE_ACCOUNT_TOKEN_INVALID');
    expect(mockListRecords).not.toHaveBeenCalled();
  });

  // (d) token belonging to a DIFFERENT org → no access to org-A records
  it('(d) tp_sa_ token from another org → GET org-A records denied (403)', async () => {
    mockValidateToken.mockResolvedValue({
      valid: true,
      account: { id: 'sa-x', name: 'Foreign Bot', scopes: ['records:read'] },
      organizationId: 'org-b', // different org than base-a (org-a)
    });

    const res = await request(app)
      .get(`/api/table-platform/tables/${TABLE_A}/records`)
      .set('Authorization', `Bearer ${BEARER}`);

    expect(res.status).toBe(403);
    expect(mockListRecords).not.toHaveBeenCalled();
  });

  // Regression: no tp_sa_ bearer → JWT path unchanged (401 without principal).
  it('(guard) request without tp_sa_ token still hits the JWT path (401)', async () => {
    const res = await request(app).get(`/api/table-platform/tables/${TABLE_A}/records`);
    expect(res.status).toBe(401);
    expect(mockValidateToken).not.toHaveBeenCalled();
  });
});
