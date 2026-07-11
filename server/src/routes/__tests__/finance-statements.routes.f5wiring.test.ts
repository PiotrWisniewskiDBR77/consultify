/**
 * HTTP wiring tests for the F5 "silnik→route" endpoints added to
 * finance-statements.routes.ts (additive, delta task — engines already
 * existed as services with zero route callers):
 *
 *   POST /packs/:id/report-section                       → financeReportSectionService.publishFinanceReportSectionSnapshot
 *   GET  /packs/:id/reconcile-summary                     → financeReportSectionService.loadReconcileSummaryForPack
 *   GET  /packs/:id/report-section/lineage                → financeReportSectionService.loadFinanceReportLineageForPack (#82g)
 *   GET  /aggregate-scope/initiatives/:initiativeId/delta → financeAggregateScopeService.computeInitiativeDeltaForOrg
 *   GET  /packs/:id/aggregate-scope/portfolio              → financeAggregateScopeService.computePortfolioAggregateForPack
 *
 * These are thin route→service wiring tests (services fully mocked) — they
 * pin auth (401 without org), not-found (404), success payload shape, and
 * fail-soft degradation (no 500 on service error for read endpoints).
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetPackDetail = vi.fn();
const mockPublishReportSection = vi.fn();
const mockLoadReconcileSummary = vi.fn();
const mockLoadLineage = vi.fn();
const mockComputeInitiativeDelta = vi.fn();
const mockComputePortfolioAggregate = vi.fn();

vi.mock('../../services/financialStatementPackService.js', () => ({
  getStatementPackDetail: (...a: unknown[]) => mockGetPackDetail(...a),
  // Other named exports the router imports — no-op spies to keep module shape intact.
  assignStatementToExistingPack: vi.fn(),
  detachStatementFromPack: vi.fn(),
  listStatementPacks: vi.fn(),
  recomputeStatementPackForOrganization: vi.fn(),
  syncStatementToPack: vi.fn(),
}));

vi.mock('../../services/financeReportSectionService.js', () => ({
  publishFinanceReportSectionSnapshot: (...a: unknown[]) => mockPublishReportSection(...a),
  loadReconcileSummaryForPack: (...a: unknown[]) => mockLoadReconcileSummary(...a),
  loadFinanceReportLineageForPack: (...a: unknown[]) => mockLoadLineage(...a),
}));

vi.mock('../../services/financeAggregateScopeService.js', () => ({
  computeInitiativeDeltaForOrg: (...a: unknown[]) => mockComputeInitiativeDelta(...a),
  computePortfolioAggregateForPack: (...a: unknown[]) => mockComputePortfolioAggregate(...a),
}));

let mockCtx: { userId?: string; reqOrg?: string } = {};

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = mockCtx.userId
      ? { id: mockCtx.userId, organizationId: mockCtx.reqOrg ?? '' }
      : undefined;
    req.userId = mockCtx.userId;
    req.organizationId = mockCtx.reqOrg ?? '';
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

import financeStatementsRoutes from '../finance-statements.routes.js';

const CALLER_ORG = 'org-legit-member';
const PACK_ID = 'pack-123';
const INITIATIVE_ID = 'init-456';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/finance-statements', financeStatementsRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCtx = { userId: 'user-legit', reqOrg: CALLER_ORG };
});

describe('POST /packs/:id/report-section', () => {
  it('no validated org → 401, service not called', async () => {
    mockCtx = { userId: 'user-orgless', reqOrg: '' };
    const res = await request(createApp()).post(`/api/finance-statements/packs/${PACK_ID}/report-section`);
    expect(res.status).toBe(401);
    expect(mockPublishReportSection).not.toHaveBeenCalled();
  });

  it('pack not found in caller org → 404, service not called', async () => {
    mockGetPackDetail.mockResolvedValue(null);
    const res = await request(createApp()).post(`/api/finance-statements/packs/${PACK_ID}/report-section`);
    expect(res.status).toBe(404);
    expect(mockPublishReportSection).not.toHaveBeenCalled();
  });

  it('own-org publish succeeds → 201 with reportId/snapshotId/section/envelope/lineage, forwards orgId/createdBy/packId/valuationId', async () => {
    mockGetPackDetail.mockResolvedValue({ id: PACK_ID });
    const lineageStub = { packId: PACK_ID, sourcePack: null, generatedAt: '2026-07-11T00:00:00.000Z', assumptions: [], entries: [] };
    mockPublishReportSection.mockResolvedValue({
      reportId: 'report-1',
      snapshotId: 'snap-1',
      section: { packId: PACK_ID, verdict: 'GREEN' },
      envelope: { id: 'env-1' },
      lineage: lineageStub,
    });

    const res = await request(createApp())
      .post(`/api/finance-statements/packs/${PACK_ID}/report-section`)
      .send({ valuationId: 'val-1', title: 'Sekcja Q1' });

    expect(res.status).toBe(201);
    // #82g — jawny LINEAGE: publish teraz zwraca envelope+lineage obok section (wcześniej
    // route je milcząco odrzucał mimo że publishFinanceReportSectionSnapshot je liczył).
    expect(res.body).toEqual({
      success: true,
      reportId: 'report-1',
      snapshotId: 'snap-1',
      section: { packId: PACK_ID, verdict: 'GREEN' },
      envelope: { id: 'env-1' },
      lineage: lineageStub,
    });
    expect(mockPublishReportSection).toHaveBeenCalledWith({
      organizationId: CALLER_ORG,
      createdBy: 'user-legit',
      packId: PACK_ID,
      valuationId: 'val-1',
      title: 'Sekcja Q1',
      periodFrom: undefined,
      periodTo: undefined,
    });
  });

  it('service throws → 500, not silently swallowed (write endpoint, not fail-soft)', async () => {
    mockGetPackDetail.mockResolvedValue({ id: PACK_ID });
    mockPublishReportSection.mockRejectedValue(new Error('boom'));
    const res = await request(createApp()).post(`/api/finance-statements/packs/${PACK_ID}/report-section`);
    expect(res.status).toBe(500);
  });
});

describe('GET /packs/:id/reconcile-summary', () => {
  it('no validated org → 401', async () => {
    mockCtx = { userId: 'user-orgless', reqOrg: '' };
    const res = await request(createApp()).get(`/api/finance-statements/packs/${PACK_ID}/reconcile-summary`);
    expect(res.status).toBe(401);
  });

  it('pack not found → 404', async () => {
    mockLoadReconcileSummary.mockResolvedValue(null);
    const res = await request(createApp()).get(`/api/finance-statements/packs/${PACK_ID}/reconcile-summary`);
    expect(res.status).toBe(404);
  });

  it('own-org read succeeds → 200 with persisted summary, called with (orgId, packId)', async () => {
    mockLoadReconcileSummary.mockResolvedValue({
      packId: PACK_ID,
      available: true,
      enforceMode: false,
      overallStatus: 'pass',
      summary: { passed: 8, warnings: 0, failed: 0, skipped: 0 },
      checks: [],
      computedAt: '2026-07-10T00:00:00.000Z',
    });
    const res = await request(createApp()).get(`/api/finance-statements/packs/${PACK_ID}/reconcile-summary`);
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.overallStatus).toBe('pass');
    expect(mockLoadReconcileSummary).toHaveBeenCalledWith(CALLER_ORG, PACK_ID);
  });

  it('fail-soft: service throws → 200 with available:false, not 500', async () => {
    mockLoadReconcileSummary.mockRejectedValue(new Error('db down'));
    const res = await request(createApp()).get(`/api/finance-statements/packs/${PACK_ID}/reconcile-summary`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ packId: PACK_ID, available: false, overallStatus: 'na' });
  });
});

describe('GET /packs/:id/report-section/lineage (#82g)', () => {
  it('no validated org → 401, service not called', async () => {
    mockCtx = { userId: 'user-orgless', reqOrg: '' };
    const res = await request(createApp()).get(`/api/finance-statements/packs/${PACK_ID}/report-section/lineage`);
    expect(res.status).toBe(401);
    expect(mockLoadLineage).not.toHaveBeenCalled();
  });

  it('pack not found → 404', async () => {
    mockLoadLineage.mockResolvedValue(null);
    const res = await request(createApp()).get(`/api/finance-statements/packs/${PACK_ID}/report-section/lineage`);
    expect(res.status).toBe(404);
  });

  it('own-org read succeeds → 200 with packId/available/lineage entries carrying sourcePack+method+assumptions', async () => {
    mockLoadLineage.mockResolvedValue({
      packId: PACK_ID,
      available: true,
      lineage: {
        packId: PACK_ID,
        sourcePack: { packId: PACK_ID, entityName: 'DBR77 Sp. z o.o.', periodLabel: 'FY2025', periodEnd: '2025-12-31', currency: 'PLN' },
        generatedAt: '2026-07-11T00:00:00.000Z',
        assumptions: [{ key: 'ratio_engine', value: 'financeRatioFamilyCatalog', sourceType: 'imported' }],
        entries: [
          {
            id: 'GROSS_MARGIN',
            category: 'ratio',
            label: 'Marża brutto',
            value: '40%',
            method: 'GROSS_PROFIT / REVENUE × 100',
            family: 'profitability',
            requiredLineCodes: ['GROSS_PROFIT', 'REVENUE'],
            sourcePack: { packId: PACK_ID, entityName: 'DBR77 Sp. z o.o.', periodLabel: 'FY2025', periodEnd: '2025-12-31', currency: 'PLN' },
            assumptions: [],
          },
        ],
      },
    });
    const res = await request(createApp()).get(`/api/finance-statements/packs/${PACK_ID}/report-section/lineage`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.packId).toBe(PACK_ID);
    expect(res.body.available).toBe(true);
    expect(res.body.lineage.entries).toHaveLength(1);
    expect(res.body.lineage.entries[0]).toMatchObject({
      id: 'GROSS_MARGIN',
      category: 'ratio',
      sourcePack: { packId: PACK_ID, periodLabel: 'FY2025' },
      method: 'GROSS_PROFIT / REVENUE × 100',
    });
    expect(mockLoadLineage).toHaveBeenCalledWith(CALLER_ORG, PACK_ID, undefined);
  });

  it('forwards optional valuationId query param', async () => {
    mockLoadLineage.mockResolvedValue({ packId: PACK_ID, available: true, lineage: { packId: PACK_ID, sourcePack: null, generatedAt: '2026-07-11T00:00:00.000Z', assumptions: [], entries: [] } });
    await request(createApp()).get(`/api/finance-statements/packs/${PACK_ID}/report-section/lineage?valuationId=val-9`);
    expect(mockLoadLineage).toHaveBeenCalledWith(CALLER_ORG, PACK_ID, 'val-9');
  });

  it('fail-soft: service throws → 200 with available:false, not 500', async () => {
    mockLoadLineage.mockRejectedValue(new Error('db down'));
    const res = await request(createApp()).get(`/api/finance-statements/packs/${PACK_ID}/report-section/lineage`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, packId: PACK_ID, available: false });
  });
});

describe('GET /aggregate-scope/initiatives/:initiativeId/delta', () => {
  it('no validated org → 401', async () => {
    mockCtx = { userId: 'user-orgless', reqOrg: '' };
    const res = await request(createApp()).get(
      `/api/finance-statements/aggregate-scope/initiatives/${INITIATIVE_ID}/delta`
    );
    expect(res.status).toBe(401);
  });

  it('own-org read succeeds → 200 with delta, called with (orgId, initiativeId)', async () => {
    mockComputeInitiativeDelta.mockResolvedValue({
      scope: 'initiative',
      initiativeId: INITIATIVE_ID,
      sourceType: 'budget_initiative_links',
      statements: { pnl: { REVENUE: 1000 }, bs: {}, cf: {} },
    });
    const res = await request(createApp()).get(
      `/api/finance-statements/aggregate-scope/initiatives/${INITIATIVE_ID}/delta`
    );
    expect(res.status).toBe(200);
    expect(res.body.initiativeId).toBe(INITIATIVE_ID);
    expect(res.body.delta.sourceType).toBe('budget_initiative_links');
    expect(mockComputeInitiativeDelta).toHaveBeenCalledWith(CALLER_ORG, INITIATIVE_ID);
  });

  it('no data (skip, not zero) → 200 with delta:null', async () => {
    mockComputeInitiativeDelta.mockResolvedValue(null);
    const res = await request(createApp()).get(
      `/api/finance-statements/aggregate-scope/initiatives/${INITIATIVE_ID}/delta`
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ initiativeId: INITIATIVE_ID, delta: null });
  });

  it('fail-soft: service throws → 200 with delta:null, not 500', async () => {
    mockComputeInitiativeDelta.mockRejectedValue(new Error('db down'));
    const res = await request(createApp()).get(
      `/api/finance-statements/aggregate-scope/initiatives/${INITIATIVE_ID}/delta`
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ initiativeId: INITIATIVE_ID, delta: null });
  });
});

describe('GET /packs/:id/aggregate-scope/portfolio', () => {
  it('no validated org → 401', async () => {
    mockCtx = { userId: 'user-orgless', reqOrg: '' };
    const res = await request(createApp()).get(
      `/api/finance-statements/packs/${PACK_ID}/aggregate-scope/portfolio`
    );
    expect(res.status).toBe(401);
  });

  it('pack not found → 404, service not called', async () => {
    mockGetPackDetail.mockResolvedValue(null);
    const res = await request(createApp()).get(
      `/api/finance-statements/packs/${PACK_ID}/aggregate-scope/portfolio`
    );
    expect(res.status).toBe(404);
    expect(mockComputePortfolioAggregate).not.toHaveBeenCalled();
  });

  it('own-org read succeeds → 200, CSV initiativeIds parsed and forwarded', async () => {
    mockGetPackDetail.mockResolvedValue({ id: PACK_ID });
    mockComputePortfolioAggregate.mockResolvedValue({
      scope: 'portfolio',
      basePackId: PACK_ID,
      includedInitiativeIds: ['a', 'b'],
      skippedInitiativeIds: [],
      statements: { pnl: {}, bs: {}, cf: {} },
    });
    const res = await request(createApp()).get(
      `/api/finance-statements/packs/${PACK_ID}/aggregate-scope/portfolio?initiativeIds=a,b`
    );
    expect(res.status).toBe(200);
    expect(res.body.includedInitiativeIds).toEqual(['a', 'b']);
    expect(mockComputePortfolioAggregate).toHaveBeenCalledWith({
      organizationId: CALLER_ORG,
      basePackId: PACK_ID,
      initiativeIds: ['a', 'b'],
    });
  });

  it('fail-soft: service throws → 200 with base-only empty statements, not 500', async () => {
    mockGetPackDetail.mockResolvedValue({ id: PACK_ID });
    mockComputePortfolioAggregate.mockRejectedValue(new Error('db down'));
    const res = await request(createApp()).get(
      `/api/finance-statements/packs/${PACK_ID}/aggregate-scope/portfolio?initiativeIds=a,b`
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      scope: 'portfolio',
      basePackId: PACK_ID,
      includedInitiativeIds: [],
      skippedInitiativeIds: ['a', 'b'],
    });
  });
});
