/**
 * M16 integrity fix (07-15 audit) — route wiring regression.
 *
 * `getModel(modelId)` was called across 16 sites in `finance.routes.ts`
 * without `organizationId`, so cross-org isolation relied entirely on a
 * post-fetch `model.organization_id !== organizationId → 404` check rather
 * than the SQL itself (defense-in-depth only, not defense-in-depth PLUS a
 * scoped query). This test mounts the real v8 router (same scaffold as
 * `p05-finance-lane.test.ts`) and asserts that `GET /api/v8/finance/models/:id`
 * and `DELETE /api/v8/finance/models/:id` call the (mocked)
 * `financialModelingService.getModel` with the caller's organizationId as the
 * second argument — so a future edit that drops the param regresses this test
 * even before it would regress the SQL-level unit test.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbRun = vi.fn();
const mockDbGet = vi.fn();
const mockDbAll = vi.fn();

vi.mock('../../../services/legacyCutover/requireActiveMembership.js', () => ({
  requireActiveMembership: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

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

const mockGetModel = vi.fn();

vi.mock('../../../services/financialModelingService.js', () => ({
  addEvent: vi.fn(),
  approveModel: vi.fn(),
  computeModel: vi.fn(),
  createModel: vi.fn(),
  deleteEvent: vi.fn(),
  getModel: (...args: unknown[]) => mockGetModel(...args),
  getOutputs: vi.fn(),
  getValidations: vi.fn(),
  listEvents: vi.fn(),
  listModels: vi.fn(),
  persistComputeResult: vi.fn(),
  reseedModelFromSource: vi.fn(),
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

const ORG_A = '00000000-0000-4000-8000-0000000000aa';
const USER_A = 'u-org-a';

describe('M16 — GET/DELETE /api/v8/finance/models/:modelId org-scope wiring', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: USER_A, role: 'admin', organizationId: ORG_A, isSuperAdmin: false };
    app = createApp();
  });

  it('GET /models/:modelId calls getModel(modelId, organizationId) — SQL-level org scope wired through the route', async () => {
    mockGetModel.mockResolvedValueOnce({
      id: 'model-1',
      organization_id: ORG_A,
      assumptions_json: {},
    });

    const res = await request(app).get('/api/v8/finance/models/model-1');

    expect(mockGetModel).toHaveBeenCalledWith('model-1', ORG_A);
    expect(res.status).toBe(200);
  });

  it("GET /models/:modelId — org-scoped getModel returning null (cross-org row filtered by SQL) -> 404, never leaks another org's model", async () => {
    // A real org-scoped SQL WHERE clause returns nothing for a model owned by
    // a different org — mock the service accordingly instead of returning
    // org-B's row and relying on the post-fetch check alone.
    mockGetModel.mockResolvedValueOnce(null);

    const res = await request(app).get('/api/v8/finance/models/model-owned-by-org-b');

    expect(mockGetModel).toHaveBeenCalledWith('model-owned-by-org-b', ORG_A);
    expect(res.status).toBe(404);
  });

  it('DELETE /models/:modelId calls getModel(modelId, organizationId)', async () => {
    mockGetModel.mockResolvedValueOnce({
      id: 'model-1',
      organization_id: ORG_A,
      assumptions_json: {},
    });
    mockDbRun.mockResolvedValue(undefined);

    await request(app).delete('/api/v8/finance/models/model-1');

    expect(mockGetModel).toHaveBeenCalledWith('model-1', ORG_A);
  });
});
