/**
 * M20 L-01 — IDOR regression: cross-org guard on record-templates / forms /
 * row-policies / governed-models (fix e9c6cb9c0a).
 *
 * Verifies that `PermissionsService.canAccessBase` is called for each
 * secondary endpoint and returns 403 when it signals access denied.
 * Does NOT require a real database — DB lookups are stubbed by queryMock.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted: control canAccessBase and DB per test ───────────────────────────

const mockCanAccessBase = vi.hoisted(() => vi.fn<[string, string, string], Promise<boolean>>());

const queryMock = vi.hoisted(() => vi.fn());

const mockGetGovernedModel = vi.hoisted(() => vi.fn());

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({ query: (...args: unknown[]) => queryMock(...(args as [string, unknown[]])) }),
}));

vi.mock('express-rate-limit', () => ({
  default: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
  ipKeyGenerator: vi.fn(() => () => 'test-ip'),
}));

vi.mock('../../../server/src/config/FeatureFlags.js', () => ({
  featureFlags: {
    ENABLE_TABLE_PLATFORM_RECORDS_API: true,
    ENABLE_TABLE_PLATFORM: true,
  },
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: unknown, next: () => void) => {
    req.userId = 'user-org-a';
    req.organizationId = 'org-a';
    req.user = { id: 'user-org-a', organizationId: 'org-a' };
    next();
  },
  requireSuperAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/middleware/requireAudit.middleware.js', () => ({
  requireAudit: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/services/tablePlatform/PermissionsService.js', () => ({
  default: {
    canAccessBase: (...args: [string, string, string]) => mockCanAccessBase(...args),
    requireBaseAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireTableAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireFieldAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireRecordAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireViewAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireGovernedModelAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireRoles: () => (_req: unknown, _res: unknown, next: () => void) => next(),
    SCHEMA_ROLES: ['owner', 'base_owner'],
    DATA_ROLES: ['owner', 'base_owner', 'data_editor'],
    VIEW_ROLES: ['owner', 'base_owner', 'data_editor', 'viewer'],
    INTERFACE_ROLES: ['owner', 'base_owner'],
    ALL_ROLES: ['owner', 'base_owner', 'data_editor', 'commenter', 'viewer'],
  },
}));

vi.mock('../../../server/src/services/tablePlatform/GovernedModelService.js', () => ({
  default: {
    getModel: (...args: unknown[]) => mockGetGovernedModel(...args),
    listModels: vi.fn().mockResolvedValue([]),
    createModel: vi.fn(),
    updateModel: vi.fn(),
    deleteModel: vi.fn(),
    addKpi: vi.fn(),
  },
}));

// Stub heavy services so import doesn't crash
vi.mock('../../../server/src/services/tablePlatform/FormService.js', () => ({
  default: {
    getSubmissions: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    createForm: vi.fn(),
    deleteForm: vi.fn(),
    getForm: vi.fn(),
  },
}));

vi.mock('../../../server/src/services/tablePlatform/RowPolicyService.js', () => ({
  default: {
    createPolicy: vi.fn().mockResolvedValue({ id: 'policy-1', name: 'test', role: 'viewer' }),
    listPolicies: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../server/src/services/tablePlatform/ModuleSyncService.js', () => ({
  syncToModule: vi.fn().mockResolvedValue({ syncStatus: 'success', syncedRecords: 0, syncId: 'sync-1' }),
}));

vi.mock('../../../server/src/services/tablePlatform/AutomationService.js', () => ({
  automationService: { triggerNow: vi.fn(), getAutomationRuns: vi.fn() },
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

vi.mock('../../../server/src/services/tablePlatform/RecordsService.js', () => ({
  default: { createRecord: vi.fn(), listRecords: vi.fn() },
}));

vi.mock('../../../server/src/services/tablePlatform/ScheduledAutomationExecutor.js', () => ({
  scheduledAutomationExecutor: { schedule: vi.fn(), cancel: vi.fn() },
  validateCronExpression: vi.fn().mockReturnValue(true),
}));

vi.mock('../../../server/src/services/tablePlatform/SCIMService.js', () => ({
  scimService: { provisionUser: vi.fn() },
}));

vi.mock('../../../server/src/services/tablePlatform/ServiceAccountService.js', () => ({
  serviceAccountService: { create: vi.fn() },
}));

vi.mock('../../../server/src/services/tablePlatform/SSOService.js', () => ({
  ssoService: { getSSOConfig: vi.fn() },
}));

vi.mock('../../../server/src/services/tablePlatform/WebhookDispatcherService.js', () => ({
  webhookDispatcher: { dispatch: vi.fn() },
}));

vi.mock('../../../server/src/services/tablePlatform/WebhookRelayService.js', () => ({
  webhookRelayService: { relay: vi.fn() },
}));

vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  registerArtifact: vi.fn(),
  getArtifact: vi.fn(),
}));

vi.mock('../../../server/src/services/v8/reportsPresModelService.js', () => ({
  getReportByBaseId: vi.fn(),
}));

// ── Route under test ──────────────────────────────────────────────────────────

import tablePlatformRoutes from '../../../server/src/routes/table-platform.routes.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/table-platform', tablePlatformRoutes);
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('M20 L-01 — cross-org IDOR regression (canAccessBase guards)', () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    vi.resetAllMocks();
    app = buildApp();
  });

  // ── 1. GET /forms/:formId/submissions ──────────────────────────────────────

  describe('GET /forms/:formId/submissions', () => {
    it('returns 403 when form belongs to a different org (cross-org attack)', async () => {
      // DB resolves form → base in org-B
      queryMock.mockResolvedValue({ rows: [{ base_id: 'base-b' }] });
      // canAccessBase: user-org-a vs org-b base → denied
      mockCanAccessBase.mockResolvedValue(false);

      const res = await request(app).get('/api/table-platform/forms/form-b/submissions');

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/access denied/i);
      expect(mockCanAccessBase).toHaveBeenCalledWith('user-org-a', 'org-a', 'base-b');
    });

    it('proceeds past guard (no 403) when form belongs to same org', async () => {
      queryMock.mockResolvedValue({ rows: [{ base_id: 'base-a' }] });
      mockCanAccessBase.mockResolvedValue(true);

      const res = await request(app).get('/api/table-platform/forms/form-a/submissions');

      expect(res.status).not.toBe(403);
      expect(mockCanAccessBase).toHaveBeenCalledWith('user-org-a', 'org-a', 'base-a');
    });

    it('returns 404 when form does not exist (no base resolution)', async () => {
      queryMock.mockResolvedValue({ rows: [] });

      const res = await request(app).get('/api/table-platform/forms/form-missing/submissions');

      expect(res.status).toBe(404);
      expect(mockCanAccessBase).not.toHaveBeenCalled();
    });
  });

  // ── 2. POST /tables/:tableId/row-policies ──────────────────────────────────

  describe('POST /tables/:tableId/row-policies', () => {
    it('returns 403 when table belongs to a different org', async () => {
      queryMock.mockResolvedValue({ rows: [{ base_id: 'base-b' }] });
      mockCanAccessBase.mockResolvedValue(false);

      const res = await request(app)
        .post('/api/table-platform/tables/tbl-b/row-policies')
        .send({ name: 'Attacker policy', role: 'viewer' });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/access denied/i);
      expect(mockCanAccessBase).toHaveBeenCalledWith('user-org-a', 'org-a', 'base-b');
    });

    it('proceeds past guard (no 403) when table belongs to same org', async () => {
      queryMock.mockResolvedValue({ rows: [{ base_id: 'base-a' }] });
      mockCanAccessBase.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/table-platform/tables/tbl-a/row-policies')
        .send({ name: 'My policy', role: 'viewer' });

      expect(res.status).not.toBe(403);
      expect(mockCanAccessBase).toHaveBeenCalledWith('user-org-a', 'org-a', 'base-a');
    });

    it('returns 404 when table does not exist', async () => {
      queryMock.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .post('/api/table-platform/tables/tbl-missing/row-policies')
        .send({ name: 'test', role: 'viewer' });

      expect(res.status).toBe(404);
      expect(mockCanAccessBase).not.toHaveBeenCalled();
    });
  });

  // ── 3. POST /governed-models/:modelId/publish-to-results ──────────────────

  describe('POST /governed-models/:modelId/publish-to-results', () => {
    it('returns 403 when governed model base belongs to a different org', async () => {
      mockGetGovernedModel.mockResolvedValue({ id: 'model-b', base_id: 'base-b', name: 'B model' });
      mockCanAccessBase.mockResolvedValue(false);

      const res = await request(app)
        .post('/api/table-platform/governed-models/model-b/publish-to-results')
        .send({ kpiIds: ['kpi-1'] });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/access denied/i);
      expect(mockCanAccessBase).toHaveBeenCalledWith('user-org-a', 'org-a', 'base-b');
    });

    it('proceeds past guard (no 403) when model belongs to same org', async () => {
      mockGetGovernedModel.mockResolvedValue({ id: 'model-a', base_id: 'base-a', name: 'A model' });
      mockCanAccessBase.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/table-platform/governed-models/model-a/publish-to-results')
        .send({ kpiIds: ['kpi-1'], fieldMapping: {} });

      expect(res.status).not.toBe(403);
      expect(mockCanAccessBase).toHaveBeenCalledWith('user-org-a', 'org-a', 'base-a');
    });

    it('returns 404 when governed model does not exist', async () => {
      mockGetGovernedModel.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/table-platform/governed-models/model-missing/publish-to-results')
        .send({ kpiIds: [] });

      expect(res.status).toBe(404);
      expect(mockCanAccessBase).not.toHaveBeenCalled();
    });
  });
});
