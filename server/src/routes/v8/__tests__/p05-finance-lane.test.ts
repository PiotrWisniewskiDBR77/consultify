/**
 * P05 Finance Lane — Integration tests.
 *
 * Covers: §2.3.1 bounded lanes, §2.3.2 KPI↔Finance coherence,
 * §2.3.3 versioning, §2.3.4 error taxonomy, §2.3.5 anti-duplicate,
 * §2.3.6 degraded posture, §2.3.7 acceptance checklist.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FINANCE_ANTI_DUPLICATE_RULES,
  FINANCE_DEGRADED_SCENARIOS,
  FINANCE_OWNERSHIP_BOUNDARY,
  IMPORT_ERROR_TAXONOMY,
  MUTATION_ERROR_TAXONOMY,
  P05_ACCEPTANCE_CHECKLIST,
  P05_FINANCE_LANE_CONTRACT,
  VERSION_SEMANTICS,
} from '../../../services/v8/financeCanon.js';

const mockDbRun = vi.fn();
const mockDbGet = vi.fn();
const mockDbAll = vi.fn();

vi.mock('../../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

vi.mock('../../../services/v8/financeIntegrationService.js', () => ({
  getFinanceDashboard: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../../services/financialAnalysisService.js', () => ({
  createAnalysis: vi.fn(),
  listAnalyses: vi.fn(),
  getAnalysisRatios: vi.fn(),
  getAnalysisInsights: vi.fn(),
  approveAnalysis: vi.fn(),
  runFullAnalysis: vi.fn(),
}));

vi.mock('../../../services/financialModelingService.js', () => ({
  addEvent: vi.fn(),
  approveModel: vi.fn(),
  computeModel: vi.fn(),
  createModel: vi.fn(),
  deleteEvent: vi.fn(),
  getModel: vi.fn(),
  getOutputs: vi.fn(),
  getValidations: vi.fn(),
  listEvents: vi.fn(),
  listModels: vi.fn(),
  persistComputeResult: vi.fn(),
  updateModel: vi.fn(),
}));

vi.mock('../../../services/financialStatementService.js', () => ({
  confirmStatement: vi.fn(),
  createStatement: vi.fn(),
  detectStatementType: vi.fn(),
  evaluateStatementReadiness: vi.fn(),
  extractFinancialLines: vi.fn(),
  analyzeAndExtractFullDocument: vi.fn(),
  getLatestStatementIngestRun: vi.fn(),
  loadPersistedStatementCandidateRows: vi.fn(),
  loadStatementSourceText: vi.fn(),
  locateStatementSections: vi.fn(),
  persistStatementCandidateRows: vi.fn(),
  persistStatementExtractedSections: vi.fn(),
  persistStatementMappingCandidates: vi.fn(),
  persistStatementValidationLedger: vi.fn(),
  recordStatementQualityRun: vi.fn(),
  recordStatementSourceArtifact: vi.fn(),
  resolveStatementColumnSelection: vi.fn(),
  resolveDuplicateSuggestedMappings: vi.fn(),
  saveStatementValues: vi.fn(),
  snapshotCanonicalStatementVersion: vi.fn(),
  startStatementIngestRun: vi.fn(),
  updateStatementMetadata: vi.fn(),
  updateStatementReadinessState: vi.fn(),
  updateStatementStatus: vi.fn(),
  updateStatementIngestRun: vi.fn(),
  validateStatement: vi.fn(),
  saveStatementValuesFlow: vi.fn(),
}));

vi.mock('../../../services/financialStatementReadService.js', () => ({
  getStatementPackDetail: vi.fn(),
  getStatementDetail: vi.fn(),
  listStatements: vi.fn(),
  listStatementPacks: vi.fn(),
}));

vi.mock('../../../services/ratioAnalysisService.js', () => ({
  computeRatios: vi.fn(),
  buildStatementAnalytics: vi.fn(),
}));

vi.mock('../../../services/valuationService.js', () => ({
  listValuations: vi.fn(),
}));

vi.mock('../../../services/budgetingService.js', () => ({
  listBudgets: vi.fn(),
}));

vi.mock('../../../services/financeCanonicalRegistry.ts', () => ({
  ensureCanonicalRegistryInDatabase: vi.fn(),
}));

vi.mock('../../../services/financeCanonicalRegistryService.ts', () => ({
  ensureCanonicalRegistryInDatabase: vi.fn(),
}));

vi.mock('../../../services/llmFinancialMappingService.js', () => ({
  applyLlmProposals: vi.fn(),
  applySecondPassProposals: vi.fn(),
  mapDuplicateConflictLinesWithLLM: vi.fn(),
  mapUnmappedLinesWithLLM: vi.fn(),
}));

vi.mock('../../../services/financeMappingPolicy.js', () => ({
  assessCoverage: vi.fn(),
  classifyMappingTier: vi.fn(),
  isLikelySubtotalOrAggregate: vi.fn(),
  isNonFinancialByPolicy: vi.fn(),
}));

vi.mock('../../../services/openAIFinancialExtractionService.js', () => ({
  extractFinancialLinesWithAnthropic: vi.fn(),
  extractFinancialLinesWithOpenAI: vi.fn(),
}));

vi.mock('../../../services/financialStatementPackService.js', () => ({
  recomputeStatementPackForOrganization: vi.fn(),
  syncStatementToPack: vi.fn(),
}));

vi.mock('../../../services/financeCanonicalResolver.js', () => ({
  autoMapLines: vi.fn(),
}));

vi.mock('../../../services/financeDiagnosticsService.js', () => ({
  searchStatementDocumentIntelligence: vi.fn(),
  classifyStatementDocument: vi.fn(),
}));

vi.mock('../../../services/financeCompositeScores.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../../utils/pdfExtractText.js', () => ({
  pdfExtractText: vi.fn(),
}));

vi.mock('../../../services/v8/featureFlagService.js', () => ({
  getV8Flags: vi.fn().mockResolvedValue({ v8_enabled: true }),
  getAllOrgFlags: vi.fn().mockResolvedValue([]),
  setV8OrgFlag: vi.fn().mockResolvedValue({}),
  isV8Enabled: vi.fn().mockResolvedValue(true),
  isV8ShadowMode: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../../utils/v8MetricsStore.js', () => ({
  recordV8Request: vi.fn(),
  getV8MetricsSnapshot: vi.fn().mockReturnValue({}),
}));

vi.mock('../../../middleware/v8Metrics.middleware.js', () => ({
  v8MetricsMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../utils/financeTraceId.js', () => ({
  getFinanceTraceId: vi.fn().mockReturnValue('trace-test'),
  logFinanceError: vi.fn(),
  logFinanceEvent: vi.fn(),
}));

vi.mock('../../../services/v8/financeIntegrationHooks.js', () => ({
  registerLaneRunArtifact: vi.fn().mockResolvedValue(undefined),
  upsertFinanceInboxItems: vi.fn().mockResolvedValue(undefined),
  pushDegradedToRadar: vi.fn().mockResolvedValue(undefined),
  captureFinanceContextSnapshot: vi.fn().mockResolvedValue(undefined),
  recordSwitchoverDecision: vi.fn().mockResolvedValue(undefined),
}));

let mockUser: { id: string; role: string; organizationId: string; isSuperAdmin: boolean } | null =
  null;

vi.mock('../../../middleware/auth.middleware.js', () => ({
  default: (req: any, _res: any, next: () => void) => {
    if (mockUser) {
      req.userId = mockUser.id;
      req.userRole = mockUser.role;
      req.organizationId = mockUser.organizationId;
      req.user = mockUser;
      req.can = () => true;
    }
    next();
  },
  verifyToken: (req: any, _res: any, next: () => void) => {
    if (mockUser) {
      req.userId = mockUser.id;
      req.userRole = mockUser.role;
      req.organizationId = mockUser.organizationId;
      req.user = mockUser;
      req.can = () => true;
    }
    next();
  },
  requireSuperAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireOrganization: (_req: unknown, _res: unknown, next: () => void) => next(),
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import v8Router from '../index.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8', v8Router);
  return app;
}

const ORG = '00000000-0000-4000-8000-000000000099';
const USER = 'u-test-fin';

describe('P05 Finance Lane', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: USER, role: 'admin', organizationId: ORG, isSuperAdmin: false };
    app = createApp();
  });

  // ─── §2.3.1 Lane orchestration ────────────────────────────

  describe('POST /lane/start — start a lane run', () => {
    it('creates a new lane run with import as first step', async () => {
      mockDbRun.mockResolvedValueOnce({ changes: 1 });
      const res = await request(app)
        .post('/api/v8/finance/lane/start')
        .send({ versionType: 'current' });
      expect(res.status).toBe(200);
      expect(res.body.data.currentStep).toBe('import');
      expect(res.body.data.versionType).toBe('current');
      expect(res.body.data.runId).toBeTruthy();
      expect(res.body.meta.contract).toBe('finance_lane_v1');
    });
  });

  describe('POST /lane/:runId/advance — advance lane step', () => {
    it('advances from import to analysis on completed outcome', async () => {
      const run = {
        run_id: 'run-1',
        organization_id: ORG,
        current_step: 'import',
        import_outcome: null,
        analysis_completed: 0,
        mutation_outcome: null,
        readback_confirmed: 0,
        degraded_json: '[]',
        audit_trail_json: '[]',
        version_type: 'current',
        kpi_linkage_status: 'coherent',
        created_at: '2026-03-01',
        updated_at: '2026-03-01',
      };
      mockDbGet
        .mockResolvedValueOnce({ role: 'admin' }) // permission check
        .mockResolvedValueOnce(null) // model check
        .mockResolvedValueOnce(run); // getLaneRun
      mockDbRun.mockResolvedValueOnce({ changes: 1 });

      const res = await request(app)
        .post('/api/v8/finance/lane/run-1/advance')
        .send({ outcome: 'completed' });
      expect(res.status).toBe(200);
      expect(res.body.data.currentStep).toBe('analysis');
      expect(res.body.data.importOutcome).toBe('completed');
    });

    it('blocks advancement on import failure and adds degraded reason', async () => {
      const run = {
        run_id: 'run-2',
        organization_id: ORG,
        current_step: 'import',
        import_outcome: null,
        analysis_completed: 0,
        mutation_outcome: null,
        readback_confirmed: 0,
        degraded_json: '[]',
        audit_trail_json: '[]',
        version_type: 'current',
        kpi_linkage_status: 'coherent',
        created_at: '2026-03-01',
        updated_at: '2026-03-01',
      };
      mockDbGet
        .mockResolvedValueOnce({ role: 'admin' }) // permission check
        .mockResolvedValueOnce(null) // model check
        .mockResolvedValueOnce(run); // getLaneRun
      mockDbRun.mockResolvedValueOnce({ changes: 1 });

      const res = await request(app)
        .post('/api/v8/finance/lane/run-2/advance')
        .send({ outcome: 'failed', detail: 'CSV parsing error' });
      expect(res.status).toBe(200);
      expect(res.body.data.currentStep).toBe('import');
      expect(res.body.data.importOutcome).toBe('failed');
      expect(res.body.data.degraded).toHaveLength(1);
      expect(res.body.data.degraded[0].reason).toBe('import_failed');
    });

    it('rejects missing outcome', async () => {
      const res = await request(app).post('/api/v8/finance/lane/run-3/advance').send({});
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('P05_OUTCOME_REQUIRED');
    });
  });

  describe('GET /lane/:runId — get lane run', () => {
    it('returns a lane run', async () => {
      mockDbGet.mockResolvedValueOnce({
        run_id: 'run-1',
        organization_id: ORG,
        current_step: 'analysis',
        import_outcome: 'completed',
        analysis_completed: 0,
        mutation_outcome: null,
        readback_confirmed: 0,
        degraded_json: '[]',
        audit_trail_json: '[]',
        version_type: 'current',
        kpi_linkage_status: 'coherent',
        created_at: '2026-03-01',
        updated_at: '2026-03-01',
      });
      const res = await request(app).get('/api/v8/finance/lane/run-1');
      expect(res.status).toBe(200);
      expect(res.body.data.runId).toBe('run-1');
      expect(res.body.data.currentStep).toBe('analysis');
    });

    it('returns 404 for non-existent run', async () => {
      mockDbGet.mockResolvedValueOnce(null);
      const res = await request(app).get('/api/v8/finance/lane/nope');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('P05_RUN_NOT_FOUND');
    });
  });

  describe('GET /lane — list lane runs', () => {
    it('returns list of runs', async () => {
      mockDbAll.mockResolvedValueOnce([
        {
          run_id: 'r1',
          organization_id: ORG,
          current_step: 'readback',
          import_outcome: 'completed',
          analysis_completed: 1,
          mutation_outcome: 'applied',
          readback_confirmed: 1,
          degraded_json: '[]',
          audit_trail_json: '[]',
          version_type: 'current',
          kpi_linkage_status: 'coherent',
          created_at: '2026-03-01',
          updated_at: '2026-03-01',
        },
      ]);
      const res = await request(app).get('/api/v8/finance/lane');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  // ─── §2.3.4 Mutation audit ────────────────────────────────

  describe('POST /lane/:runId/mutation-audit — record mutation audit', () => {
    it('records a mutation audit entry', async () => {
      mockDbRun.mockResolvedValueOnce({ changes: 1 });
      const res = await request(app).post('/api/v8/finance/lane/run-1/mutation-audit').send({
        mutationType: 'budget_update',
        targetEntity: 'budget-42',
        previousValue: '10000',
        newValue: '12000',
        outcome: 'applied',
      });
      expect(res.status).toBe(200);
      expect(res.body.data.mutationType).toBe('budget_update');
      expect(res.body.data.outcome).toBe('applied');
      expect(res.body.data.auditId).toBeTruthy();
    });

    it('rejects missing required fields', async () => {
      const res = await request(app)
        .post('/api/v8/finance/lane/run-1/mutation-audit')
        .send({ mutationType: 'x' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('P05_AUDIT_PARAMS_REQUIRED');
    });
  });

  describe('GET /lane/:runId/mutation-audit — list mutation audits', () => {
    it('returns audit entries for a run', async () => {
      mockDbAll.mockResolvedValueOnce([
        {
          audit_id: 'a1',
          organization_id: ORG,
          run_id: 'run-1',
          mutation_type: 'budget_update',
          target_entity: 'b1',
          previous_value: '100',
          new_value: '200',
          outcome: 'applied',
          actor: USER,
          created_at: '2026-03-01',
        },
      ]);
      const res = await request(app).get('/api/v8/finance/lane/run-1/mutation-audit');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].mutationType).toBe('budget_update');
    });
  });

  // ─── §2.3.3 Versioning ────────────────────────────────────

  describe('POST /versions/snapshot — create version snapshot', () => {
    it('creates a current version snapshot', async () => {
      mockDbRun.mockResolvedValueOnce({ changes: 1 });
      const res = await request(app)
        .post('/api/v8/finance/versions/snapshot')
        .send({ versionType: 'current', snapshotData: { budget: 50000, revenue: 120000 } });
      expect(res.status).toBe(200);
      expect(res.body.data.versionType).toBe('current');
      expect(res.body.data.isFinalized).toBe(false);
      expect(res.body.data.snapshotId).toBeTruthy();
    });

    it('rejects missing params', async () => {
      const res = await request(app).post('/api/v8/finance/versions/snapshot').send({});
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('P05_VERSION_PARAMS_REQUIRED');
    });
  });

  describe('POST /versions/:snapshotId/finalize — switchover', () => {
    it('finalizes a snapshot as actual', async () => {
      mockDbGet.mockResolvedValueOnce({
        snapshot_id: 'snap-1',
        organization_id: ORG,
        version_type: 'actual',
        snapshot_data: '{"budget":50000}',
        switchover_date: null,
        switchover_actor: null,
        is_finalized: 0,
        created_at: '2026-03-01',
      });
      mockDbRun.mockResolvedValueOnce({ changes: 1 });
      mockDbGet.mockResolvedValueOnce({
        snapshot_id: 'snap-1',
        organization_id: ORG,
        version_type: 'actual',
        snapshot_data: '{"budget":50000}',
        switchover_date: '2026-03-31',
        switchover_actor: USER,
        is_finalized: 1,
        created_at: '2026-03-01',
      });

      const res = await request(app).post('/api/v8/finance/versions/snap-1/finalize');
      expect(res.status).toBe(200);
      expect(res.body.data.isFinalized).toBe(true);
      expect(res.body.data.switchoverActor).toBe(USER);
    });
  });

  describe('GET /versions — list version snapshots', () => {
    it('returns version snapshots', async () => {
      mockDbAll.mockResolvedValueOnce([
        {
          snapshot_id: 's1',
          organization_id: ORG,
          version_type: 'current',
          snapshot_data: '{}',
          switchover_date: null,
          switchover_actor: null,
          is_finalized: 0,
          created_at: '2026-03-01',
        },
      ]);
      const res = await request(app).get('/api/v8/finance/versions');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  // ─── §2.3.2 KPI↔Finance coherence ────────────────────────

  describe('GET /lane/:runId/kpi-coherence — KPI linkage check', () => {
    it('returns coherent when no unresolved reconciliations', async () => {
      mockDbAll.mockResolvedValueOnce([]);
      const res = await request(app).get('/api/v8/finance/lane/run-1/kpi-coherence');
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('coherent');
    });

    it('returns stale when reconciliations are old', async () => {
      const oldDate = new Date(Date.now() - 10 * 86400000).toISOString();
      mockDbAll.mockResolvedValueOnce([
        { kpi_id: 'k1', reconciliation_status: 'pending', updated_at: oldDate },
      ]);
      mockDbRun.mockResolvedValueOnce({ changes: 1 });

      const res = await request(app).get('/api/v8/finance/lane/run-1/kpi-coherence');
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('stale');
    });
  });

  // ─── E2E: import → analysis → mutation → readback ─────────

  describe('E2E lane workflow', () => {
    it('completes full import→analysis→mutation→readback lane', async () => {
      // Step 1: Start lane run
      mockDbRun.mockResolvedValueOnce({ changes: 1 });
      const startRes = await request(app)
        .post('/api/v8/finance/lane/start')
        .send({ versionType: 'current' });
      expect(startRes.status).toBe(200);
      const runId = startRes.body.data.runId;

      // Step 2: Advance import → completed
      const importRun = {
        run_id: runId,
        organization_id: ORG,
        current_step: 'import',
        import_outcome: null,
        analysis_completed: 0,
        mutation_outcome: null,
        readback_confirmed: 0,
        degraded_json: '[]',
        audit_trail_json: JSON.stringify(startRes.body.data.auditTrail),
        version_type: 'current',
        kpi_linkage_status: 'coherent',
        created_at: '2026-03-01',
        updated_at: '2026-03-01',
      };
      mockDbGet
        .mockResolvedValueOnce({ role: 'admin' }) // permission
        .mockResolvedValueOnce(null) // model
        .mockResolvedValueOnce(importRun); // getLaneRun
      mockDbRun.mockResolvedValueOnce({ changes: 1 });

      const importRes = await request(app)
        .post(`/api/v8/finance/lane/${runId}/advance`)
        .send({ outcome: 'completed' });
      expect(importRes.body.data.currentStep).toBe('analysis');

      // Step 3: Advance analysis → completed
      const analysisRun = {
        ...importRun,
        current_step: 'analysis',
        import_outcome: 'completed',
        audit_trail_json: JSON.stringify(importRes.body.data.auditTrail),
      };
      mockDbGet
        .mockResolvedValueOnce({ role: 'admin' }) // permission
        .mockResolvedValueOnce(null) // model
        .mockResolvedValueOnce(analysisRun); // getLaneRun
      mockDbRun.mockResolvedValueOnce({ changes: 1 });

      const analysisRes = await request(app)
        .post(`/api/v8/finance/lane/${runId}/advance`)
        .send({ outcome: 'completed' });
      expect(analysisRes.body.data.currentStep).toBe('mutation');

      // Step 4: Record mutation audit
      mockDbRun.mockResolvedValueOnce({ changes: 1 });
      const auditRes = await request(app)
        .post(`/api/v8/finance/lane/${runId}/mutation-audit`)
        .send({
          mutationType: 'forecast_update',
          targetEntity: 'model-1',
          newValue: '150000',
          outcome: 'applied',
        });
      expect(auditRes.status).toBe(200);

      // Step 5: Advance mutation → applied
      const mutationRun = {
        ...analysisRun,
        current_step: 'mutation',
        analysis_completed: 1,
        audit_trail_json: JSON.stringify(analysisRes.body.data.auditTrail),
      };
      mockDbGet
        .mockResolvedValueOnce({ role: 'admin' }) // permission
        .mockResolvedValueOnce(null) // model
        .mockResolvedValueOnce(mutationRun); // getLaneRun
      mockDbRun.mockResolvedValueOnce({ changes: 1 });

      const mutationRes = await request(app)
        .post(`/api/v8/finance/lane/${runId}/advance`)
        .send({ outcome: 'applied' });
      expect(mutationRes.body.data.currentStep).toBe('readback');

      // Step 6: Advance readback → confirmed
      const readbackRun = {
        ...mutationRun,
        current_step: 'readback',
        mutation_outcome: 'applied',
        audit_trail_json: JSON.stringify(mutationRes.body.data.auditTrail),
      };
      mockDbGet
        .mockResolvedValueOnce({ role: 'admin' }) // permission
        .mockResolvedValueOnce(null) // model
        .mockResolvedValueOnce(readbackRun); // getLaneRun
      // getMutationAudits query
      mockDbAll.mockResolvedValueOnce([
        {
          audit_id: 'a1',
          organization_id: ORG,
          run_id: runId,
          mutation_type: 'forecast_update',
          target_entity: 'model-1',
          previous_value: null,
          new_value: '150000',
          outcome: 'applied',
          actor: 'test-user',
          created_at: '2026-03-31',
        },
      ]);
      // checkKpiLinkageCoherence query
      mockDbAll.mockResolvedValueOnce([]);
      mockDbRun.mockResolvedValueOnce({ changes: 1 });

      const readbackRes = await request(app)
        .post(`/api/v8/finance/lane/${runId}/advance`)
        .send({ outcome: 'confirmed' });
      expect(readbackRes.body.data.readbackConfirmed).toBe(true);
      expect(readbackRes.body.data.auditTrail.length).toBeGreaterThanOrEqual(5);
      const verifiedEntry = readbackRes.body.data.auditTrail.find(
        (e: Record<string, unknown>) => e.outcome === 'readback_verified'
      );
      expect(verifiedEntry).toBeDefined();
    });
  });
});

// ─── Unit tests for financeCanon.ts ──────────────────────────

describe('financeCanon — unit tests', () => {
  describe('P05_ACCEPTANCE_CHECKLIST', () => {
    it('has exactly 12 items', () => {
      expect(P05_ACCEPTANCE_CHECKLIST).toHaveLength(12);
    });

    it('covers all required sections', () => {
      const sections = new Set(P05_ACCEPTANCE_CHECKLIST.map((c) => c.section));
      expect(sections.size).toBeGreaterThanOrEqual(5);
    });
  });

  describe('FINANCE_DEGRADED_SCENARIOS', () => {
    it('has at least 9 scenarios', () => {
      expect(FINANCE_DEGRADED_SCENARIOS.length).toBeGreaterThanOrEqual(9);
    });

    it('each scenario has user-visible state and next action', () => {
      for (const s of FINANCE_DEGRADED_SCENARIOS) {
        expect(s.userVisibleState).toBeTruthy();
        expect(s.nextAction).toBeTruthy();
      }
    });
  });

  describe('FINANCE_ANTI_DUPLICATE_RULES', () => {
    it('has no_parallel_finance_truth', () => {
      expect(FINANCE_ANTI_DUPLICATE_RULES.no_parallel_finance_truth).toBeTruthy();
    });
  });

  describe('FINANCE_OWNERSHIP_BOUNDARY', () => {
    it('defines results_owns, finance_owns, shared', () => {
      expect(FINANCE_OWNERSHIP_BOUNDARY.results_owns.length).toBeGreaterThan(0);
      expect(FINANCE_OWNERSHIP_BOUNDARY.finance_owns.length).toBeGreaterThan(0);
      expect(FINANCE_OWNERSHIP_BOUNDARY.shared.length).toBeGreaterThan(0);
      expect(FINANCE_OWNERSHIP_BOUNDARY.one_truth_rule).toContain('not overwritten');
    });
  });

  describe('VERSION_SEMANTICS', () => {
    it('defines actual, current, switchover', () => {
      expect(VERSION_SEMANTICS.actual).toContain('committed truth');
      expect(VERSION_SEMANTICS.current).toContain('Working view');
      expect(VERSION_SEMANTICS.switchover).toContain('Explicit');
    });
  });

  describe('IMPORT_ERROR_TAXONOMY', () => {
    it('has completed, completed_with_warnings, failed', () => {
      expect(IMPORT_ERROR_TAXONOMY.completed).toBeTruthy();
      expect(IMPORT_ERROR_TAXONOMY.completed_with_warnings).toBeTruthy();
      expect(IMPORT_ERROR_TAXONOMY.failed).toBeTruthy();
    });
  });

  describe('MUTATION_ERROR_TAXONOMY', () => {
    it('has applied, failed, conflict, rolled_back', () => {
      expect(MUTATION_ERROR_TAXONOMY.applied).toBeTruthy();
      expect(MUTATION_ERROR_TAXONOMY.failed).toBeTruthy();
      expect(MUTATION_ERROR_TAXONOMY.conflict).toBeTruthy();
      expect(MUTATION_ERROR_TAXONOMY.rolled_back).toBeTruthy();
    });
  });
});

describe('P05 Concurrent Lane Run Prevention', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    // vi.clearAllMocks() resets call history but does NOT flush queued
    // mockResolvedValueOnce values left over from earlier describe blocks
    // (e.g. the E2E workflow). mockReset() drains that once-queue so these
    // assertions see exactly the values they enqueue.
    mockDbGet.mockReset();
    mockDbRun.mockReset();
    mockDbAll.mockReset();
    mockUser = { id: USER, role: 'admin', organizationId: ORG, isSuperAdmin: false };
    app = createApp();
    mockDbGet.mockResolvedValue(null);
    mockDbRun.mockResolvedValue(undefined);
    mockDbAll.mockResolvedValue([]);
  });

  it('rejects second concurrent lane run with 409 and P05_CONCURRENT_RUN_EXISTS', async () => {
    // Atomic INSERT...WHERE NOT EXISTS returns 0 changes when active run exists
    mockDbRun.mockResolvedValueOnce({ changes: 0 });
    // Follow-up SELECT to get the active run for the error message
    mockDbGet.mockResolvedValueOnce({ run_id: 'existing-run' });

    const res = await request(app)
      .post('/api/v8/finance/lane/start')
      .send({ versionType: 'current' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('P05_CONCURRENT_RUN_EXISTS');
    expect(res.body.error).toContain('Active lane run already exists');
  });

  it('allows new run after previous completed (readback confirmed)', async () => {
    mockDbRun.mockResolvedValueOnce({ changes: 1 });

    const res = await request(app)
      .post('/api/v8/finance/lane/start')
      .send({ versionType: 'current' });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.currentStep).toBe('import');
  });
});

describe('P05 AdvanceLaneContext from HTTP', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    // vi.clearAllMocks() resets call history but does NOT flush queued
    // mockResolvedValueOnce values left over from earlier describe blocks
    // (e.g. the E2E workflow). mockReset() drains that once-queue so these
    // assertions see exactly the values they enqueue.
    mockDbGet.mockReset();
    mockDbRun.mockReset();
    mockDbAll.mockReset();
    mockUser = { id: USER, role: 'admin', organizationId: ORG, isSuperAdmin: false };
    app = createApp();
    mockDbGet.mockResolvedValue(null);
    mockDbRun.mockResolvedValue(undefined);
    mockDbAll.mockResolvedValue([]);
  });

  it('returns P05_PERMISSION_DENIED when user lacks finance mutation role', async () => {
    mockDbGet
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        run_id: 'run-1',
        organization_id: 'org-1',
        current_step: 'import',
        import_outcome: null,
        analysis_completed: 0,
        mutation_outcome: null,
        readback_confirmed: 0,
        degraded_json: '[]',
        audit_trail_json: '[]',
        version_type: 'current',
        kpi_linkage_status: 'coherent',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .mockResolvedValueOnce({ role: 'viewer' });

    mockDbRun.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v8/finance/lane/run-1/advance')
      .send({ outcome: 'completed' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('P05_PERMISSION_DENIED');
  });

  it('returns 422 for invalid outcome on import step (P05_INVALID_OUTCOME)', async () => {
    mockDbGet
      .mockResolvedValueOnce({ role: 'admin' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        run_id: 'run-1',
        organization_id: ORG,
        current_step: 'import',
        import_outcome: null,
        analysis_completed: 0,
        mutation_outcome: null,
        readback_confirmed: 0,
        degraded_json: '[]',
        audit_trail_json: '[]',
        version_type: 'current',
        kpi_linkage_status: 'coherent',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    mockDbRun.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v8/finance/lane/run-1/advance')
      .send({ outcome: 'totally_bogus' });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('P05_INVALID_OUTCOME');
  });

  it('advances from import to analysis on completed_with_warnings and adds degraded', async () => {
    mockDbGet
      .mockResolvedValueOnce({ role: 'admin' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        run_id: 'run-1',
        organization_id: ORG,
        current_step: 'import',
        import_outcome: null,
        analysis_completed: 0,
        mutation_outcome: null,
        readback_confirmed: 0,
        degraded_json: '[]',
        audit_trail_json: '[]',
        version_type: 'current',
        kpi_linkage_status: 'coherent',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    mockDbRun.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v8/finance/lane/run-1/advance')
      .send({ outcome: 'completed_with_warnings', detail: 'Minor date format issues' });

    expect(res.status).toBe(200);
    expect(res.body.data.currentStep).toBe('analysis');
    expect(res.body.data.importOutcome).toBe('completed_with_warnings');
    const degraded = res.body.data.degraded || [];
    const warningEntry = degraded.find((d: any) => d.reason === 'import_completed_with_warnings');
    expect(warningEntry).toBeDefined();
    expect(warningEntry.detail).toContain('Minor date format issues');
  });

  it('adds stale_model degraded when model >30d old', async () => {
    const oldDate = new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString();

    mockDbGet
      .mockResolvedValueOnce({ role: 'admin' })
      .mockResolvedValueOnce({ max_updated: oldDate })
      .mockResolvedValueOnce({
        run_id: 'run-1',
        organization_id: 'org-1',
        current_step: 'import',
        import_outcome: null,
        analysis_completed: 0,
        mutation_outcome: null,
        readback_confirmed: 0,
        degraded_json: '[]',
        audit_trail_json: '[]',
        version_type: 'current',
        kpi_linkage_status: 'coherent',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    mockDbRun.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v8/finance/lane/run-1/advance')
      .send({ outcome: 'completed' });

    expect(res.status).toBe(200);
    const degraded = res.body?.data?.degraded || [];
    const staleEntry = degraded.find((d: any) => d.reason === 'stale_model');
    expect(staleEntry).toBeDefined();
    expect(staleEntry.detail).toContain('days ago');
  });
});
