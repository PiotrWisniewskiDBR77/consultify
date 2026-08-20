/**
 * Input-validation (zod) tests for the legacy economics router
 * (/api/economics).
 *
 * Wave 5 M16 hardening retrofitted `validateBody(...)` onto the mutating
 * endpoints whose body shape is determinable from in-router SQL /
 * economicsFinancials. These tests pin:
 *   (a) a valid body still reaches the handler (200/201),
 *   (b) a malformed/extra-key body is rejected with 400 BEFORE any DB write.
 *
 * Endpoints that forward a raw body to external services (financialAnalysis/
 * valuation/budgeting services) are intentionally NOT schema'd and are not
 * covered here.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbGet = vi.fn();
const mockDbRun = vi.fn();
const mockDbAll = vi.fn();

const mockNormalizeFinancialData = vi.fn();
const mockValidateFinancialData = vi.fn();
const mockCalculateFinancialMetrics = vi.fn();
const mockApplyScenarioAdjustments = vi.fn();

vi.mock('../../services/financialAnalysisService.js', () => ({
  getAnalysisRatios: vi.fn(),
  getAnalysisInsights: vi.fn(),
  createAnalysis: vi.fn(),
  listAnalyses: vi.fn(),
  getAnalysis: vi.fn(),
  updateAnalysis: vi.fn(),
  runFullAnalysis: vi.fn(),
  approveAnalysis: vi.fn(),
  computeLivePreview: vi.fn(),
}));

vi.mock('../../services/budgetingService.js', () => ({
  getBudget: vi.fn(),
  updateBudgetLine: vi.fn(),
  updateScenarioAdjustments: vi.fn(),
  listBudgets: vi.fn(),
  getBudgetLines: vi.fn(),
  getScenarios: vi.fn(),
  approveBudget: vi.fn(),
  generateScenarioProjections: vi.fn(),
  createBudget: vi.fn(),
}));

vi.mock('../../services/valuationService.js', () => ({
  listValuations: vi.fn(),
  getValuation: vi.fn(),
  createValuation: vi.fn(),
  updateAssumptions: vi.fn(),
  updatePeers: vi.fn(),
  getOrgFinanceSettings: vi.fn(),
  setOrgFinanceSettings: vi.fn(),
}));
vi.mock('../../services/valuationExportService.js', () => ({ exportValuationPptx: vi.fn() }));
vi.mock('../../services/decisionService.js', () => ({
  default: { createDecision: vi.fn().mockResolvedValue({ id: 'decision-1' }) },
}));

vi.mock('../../services/economicsFinancials.js', () => ({
  applyScenarioAdjustments: (...a: unknown[]) => mockApplyScenarioAdjustments(...a),
  calculateFinancialMetrics: (...a: unknown[]) => mockCalculateFinancialMetrics(...a),
  defaultFinancialData: {},
  normalizeFinancialData: (...a: unknown[]) => mockNormalizeFinancialData(...a),
  validateFinancialData: (...a: unknown[]) => mockValidateFinancialData(...a),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  get: (...a: unknown[]) => mockDbGet(...a),
  run: (...a: unknown[]) => mockDbRun(...a),
  all: (...a: unknown[]) => mockDbAll(...a),
}));

vi.mock('../../utils/pgFlags.js', () => ({
  flagOn: () => false,
  parseMaybeJson: (v: unknown) => v,
}));

vi.mock('../../services/legacyCutover/legacyCutoverKernel.js', () => ({
  createLegacyCutoverGuard:
    () => (_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }) =>
      res.status(410).json({
        code: 'LEGACY_WRITER_DISABLED',
        writerId: 'ECO-W22',
        successor: '/api/v8/finance-v2/valuation/registrations',
      }),
}));

const ORG = 'org-1';
let mockUser: { id: string; organizationId: string } | null = null;

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = mockUser;
    next();
  },
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import * as budgetingSvc from '../../services/budgetingService.js';
import * as finAnalysisSvc from '../../services/financialAnalysisService.js';
import * as valuationSvc from '../../services/valuationService.js';
import economicsRoutes from '../economics.routes.js';

const ANALYSIS = 'analysis-1';
const BUDGET = 'budget-1';
const VALUATION = 'valuation-1';
const LINE = 'line-1';
const SCENARIO = 'scenario-1';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/economics', economicsRoutes);
  return app;
}

describe('economics routes — input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-1', organizationId: ORG };
    mockDbGet.mockResolvedValue(undefined);
    mockDbRun.mockResolvedValue({ changes: 1 });
    mockDbAll.mockResolvedValue([]);
    mockNormalizeFinancialData.mockReturnValue({ assumptions: [] });
    mockValidateFinancialData.mockReturnValue({ errors: [], warnings: [], recommendations: [] });
    mockCalculateFinancialMetrics.mockReturnValue({
      npv: 0,
      irr: 0,
      roi: 0,
      paybackPeriod: 1,
      cashFlows: [],
    });
    mockApplyScenarioAdjustments.mockReturnValue({ assumptions: [] });

    // Service-delegated mutator defaults (wave 6 boundary-validation suite).
    vi.mocked(finAnalysisSvc.createAnalysis).mockResolvedValue({ id: 'fa-1' } as any);
    vi.mocked(finAnalysisSvc.updateAnalysis).mockResolvedValue(undefined as any);
    vi.mocked(valuationSvc.createValuation).mockResolvedValue({ id: VALUATION } as any);
    vi.mocked(valuationSvc.getValuation).mockResolvedValue({
      id: VALUATION,
      horizon_years: 5,
      assumptions: '{}',
      peers: '[]',
    } as any);
    vi.mocked(valuationSvc.updateAssumptions).mockResolvedValue(undefined as any);
    vi.mocked(valuationSvc.updatePeers).mockResolvedValue(undefined as any);
    vi.mocked(valuationSvc.getOrgFinanceSettings).mockResolvedValue({
      defaultWacc: 12,
      defaultCurrency: 'PLN',
      defaultHorizonYears: 5,
    } as any);
    vi.mocked(valuationSvc.setOrgFinanceSettings).mockResolvedValue(undefined as any);
    vi.mocked(budgetingSvc.createBudget).mockResolvedValue({ id: BUDGET } as any);
    vi.mocked(budgetingSvc.getBudget).mockResolvedValue({ id: BUDGET } as any);
    vi.mocked(budgetingSvc.updateBudgetLine).mockResolvedValue(undefined as any);
    vi.mocked(budgetingSvc.updateScenarioAdjustments).mockResolvedValue(undefined as any);
  });

  // ── POST /analyses ──
  it('POST /analyses — valid body → 201', async () => {
    const res = await request(createApp())
      .post('/api/economics/analyses')
      .send({ name: 'Digitization', analysisType: 'financial' });
    expect(res.status).toBe(201);
    expect(mockDbRun).toHaveBeenCalled();
  });

  it('POST /analyses — missing name → 400, no DB write', async () => {
    const res = await request(createApp())
      .post('/api/economics/analyses')
      .send({ description: 'no name' });
    expect(res.status).toBe(400);
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('POST /analyses — extra key → 400 (strict)', async () => {
    const res = await request(createApp())
      .post('/api/economics/analyses')
      .send({ name: 'X', organization_id: 'org-hijack' });
    expect(res.status).toBe(400);
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  // ── PUT /analyses/:id ──
  it('PUT /analyses/:id — valid body → 200', async () => {
    mockDbGet.mockResolvedValueOnce({ id: ANALYSIS });
    const res = await request(createApp())
      .put(`/api/economics/analyses/${ANALYSIS}`)
      .send({ name: 'Renamed', completionPercent: 50 });
    expect(res.status).toBe(200);
  });

  it('PUT /analyses/:id — overallScore wrong type → 400', async () => {
    const res = await request(createApp())
      .put(`/api/economics/analyses/${ANALYSIS}`)
      .send({ overallScore: 'high' });
    expect(res.status).toBe(400);
  });

  // ── POST /analyses/:id/link-initiative ──
  it('POST /analyses/:id/link-initiative — missing initiativeId → 400', async () => {
    const res = await request(createApp())
      .post(`/api/economics/analyses/${ANALYSIS}/link-initiative`)
      .send({});
    expect(res.status).toBe(400);
  });

  // ── PUT /analyses/:id/financials ──
  it('PUT /analyses/:id/financials — valid body → 200', async () => {
    // analysis lookup → existing row; financials existing lookup → none.
    mockDbGet
      .mockResolvedValueOnce({ id: ANALYSIS, initiative_id: null })
      .mockResolvedValue(undefined);
    const res = await request(createApp())
      .put(`/api/economics/analyses/${ANALYSIS}/financials`)
      .send({ discountRate: 10, investmentHorizon: 5 });
    expect(res.status).toBe(200);
  });

  it('PUT /analyses/:id/financials — extra top-level key → 400', async () => {
    const res = await request(createApp())
      .put(`/api/economics/analyses/${ANALYSIS}/financials`)
      .send({ unexpected: true });
    expect(res.status).toBe(400);
  });

  // ── POST /analyses/:id/scenarios ──
  it('POST /analyses/:id/scenarios — missing scenarioType → 400', async () => {
    const res = await request(createApp())
      .post(`/api/economics/analyses/${ANALYSIS}/scenarios`)
      .send({ name: 'Optimistic' });
    expect(res.status).toBe(400);
  });

  it('POST /analyses/:id/scenarios — valid body → 200', async () => {
    // first dbGet = analysis exists; second dbGet = no existing scenario → insert
    mockDbGet.mockResolvedValueOnce({ id: ANALYSIS }).mockResolvedValue(undefined);
    const res = await request(createApp())
      .post(`/api/economics/analyses/${ANALYSIS}/scenarios`)
      .send({ scenarioType: 'optimistic', name: 'Optimistic' });
    expect(res.status).toBe(200);
  });

  // ── PUT /analyses/:id/benefits ──
  it('PUT /analyses/:id/benefits — missing trackingPeriod → 400', async () => {
    const res = await request(createApp())
      .put(`/api/economics/analyses/${ANALYSIS}/benefits`)
      .send({ plannedBenefits: 100 });
    expect(res.status).toBe(400);
  });

  // ── POST /financial-analyses/:id/initiatives ──
  it('POST /financial-analyses/:id/initiatives — empty array → 400', async () => {
    const res = await request(createApp())
      .post(`/api/economics/financial-analyses/${ANALYSIS}/initiatives`)
      .send({ acceptedProposalIds: [] });
    expect(res.status).toBe(400);
  });

  // ── POST /budgets/:id/import-document ──
  it('POST /budgets/:id/import-document — missing documentText → 400', async () => {
    const res = await request(createApp())
      .post(`/api/economics/budgets/${BUDGET}/import-document`)
      .send({});
    expect(res.status).toBe(400);
  });

  // ── POST /budgets/:id/initiatives ──
  it('POST /budgets/:id/initiatives — missing initiativeId → 400', async () => {
    const res = await request(createApp())
      .post(`/api/economics/budgets/${BUDGET}/initiatives`)
      .send({});
    expect(res.status).toBe(400);
  });

  // ════════════════════════════════════════════════
  // Wave 6 — service-delegated mutators (boundary validation).
  // Valid body reaches the service (200/201); malformed body is rejected
  // with 400 and the downstream service method is NOT invoked.
  // ════════════════════════════════════════════════

  // ── POST /financial-analyses → finAnalysisSvc.createAnalysis ──
  it('POST /financial-analyses — valid body → 201', async () => {
    const res = await request(createApp())
      .post('/api/economics/financial-analyses')
      .send({ title: 'Q4 FA', analysisType: 'comprehensive', currency: 'PLN' });
    expect(res.status).toBe(201);
    expect(finAnalysisSvc.createAnalysis).toHaveBeenCalled();
  });

  it('POST /financial-analyses — missing title → 400, service not reached', async () => {
    const res = await request(createApp())
      .post('/api/economics/financial-analyses')
      .send({ analysisType: 'comprehensive' });
    expect(res.status).toBe(400);
    expect(finAnalysisSvc.createAnalysis).not.toHaveBeenCalled();
  });

  it('POST /financial-analyses — extra key → 400 (strict), service not reached', async () => {
    const res = await request(createApp())
      .post('/api/economics/financial-analyses')
      .send({ title: 'X', organization_id: 'org-hijack' });
    expect(res.status).toBe(400);
    expect(finAnalysisSvc.createAnalysis).not.toHaveBeenCalled();
  });

  // ── PUT /financial-analyses/:id → finAnalysisSvc.updateAnalysis ──
  it('PUT /financial-analyses/:id — valid partial body → 200', async () => {
    const res = await request(createApp())
      .put(`/api/economics/financial-analyses/${ANALYSIS}`)
      .send({ title: 'Renamed', rebuildFromStatements: true });
    expect(res.status).toBe(200);
    expect(finAnalysisSvc.updateAnalysis).toHaveBeenCalled();
  });

  it('PUT /financial-analyses/:id — periods wrong type → 400, service not reached', async () => {
    const res = await request(createApp())
      .put(`/api/economics/financial-analyses/${ANALYSIS}`)
      .send({ periods: 'not-an-array' });
    expect(res.status).toBe(400);
    expect(finAnalysisSvc.updateAnalysis).not.toHaveBeenCalled();
  });

  // ── POST /valuations — retired duplicate writer ──
  it('POST /valuations — fails closed and advertises the canonical successor', async () => {
    const res = await request(createApp())
      .post('/api/economics/valuations')
      .send({ title: 'DCF', sourceType: 'manual', horizonYears: 5 });
    expect(res.status).toBe(410);
    expect(res.body).toMatchObject({
      code: 'LEGACY_WRITER_DISABLED',
      writerId: 'ECO-W22',
      successor: '/api/v8/finance-v2/valuation/registrations',
    });
    expect(valuationSvc.createValuation).not.toHaveBeenCalled();
  });

  it('POST /valuations — missing sourceType → 400, service not reached', async () => {
    const res = await request(createApp()).post('/api/economics/valuations').send({ title: 'DCF' });
    expect(res.status).toBe(410);
    expect(valuationSvc.createValuation).not.toHaveBeenCalled();
  });

  it('POST /valuations — invalid sourceType enum → 400, service not reached', async () => {
    const res = await request(createApp())
      .post('/api/economics/valuations')
      .send({ title: 'DCF', sourceType: 'wat' });
    expect(res.status).toBe(410);
    expect(valuationSvc.createValuation).not.toHaveBeenCalled();
  });

  // ── PUT /valuations/:id/assumptions → valuationSvc.updateAssumptions ──
  it('PUT /valuations/:id/assumptions — valid partial body → 200', async () => {
    const res = await request(createApp())
      .put(`/api/economics/valuations/${VALUATION}/assumptions`)
      .send({ waccPercent: 11, waccBreakdown: { beta: 1.3 } });
    expect(res.status).toBe(200);
    expect(valuationSvc.updateAssumptions).toHaveBeenCalled();
  });

  it('PUT /valuations/:id/assumptions — extra top-level key → 400, service not reached', async () => {
    const res = await request(createApp())
      .put(`/api/economics/valuations/${VALUATION}/assumptions`)
      .send({ injected: true });
    expect(res.status).toBe(400);
    expect(valuationSvc.updateAssumptions).not.toHaveBeenCalled();
  });

  it('PUT /valuations/:id/assumptions — terminalMethod bad enum → 400, service not reached', async () => {
    const res = await request(createApp())
      .put(`/api/economics/valuations/${VALUATION}/assumptions`)
      .send({ terminalMethod: 'magic' });
    expect(res.status).toBe(400);
    expect(valuationSvc.updateAssumptions).not.toHaveBeenCalled();
  });

  // ── PUT /valuations/:id/peers → valuationSvc.updatePeers ──
  it('PUT /valuations/:id/peers — valid body → 200', async () => {
    const res = await request(createApp())
      .put(`/api/economics/valuations/${VALUATION}/peers`)
      .send({
        metric: 'EV/EBITDA',
        min: 5,
        median: 8,
        max: 12,
        peerSet: [{ name: 'Peer A' }],
      });
    expect(res.status).toBe(200);
    expect(valuationSvc.updatePeers).toHaveBeenCalled();
  });

  it('PUT /valuations/:id/peers — missing median → 400, service not reached', async () => {
    const res = await request(createApp())
      .put(`/api/economics/valuations/${VALUATION}/peers`)
      .send({ metric: 'EV/EBITDA', min: 5, max: 12, peerSet: [] });
    expect(res.status).toBe(400);
    expect(valuationSvc.updatePeers).not.toHaveBeenCalled();
  });

  // ── POST /budgets → budgetingSvc.createBudget ──
  it('POST /budgets — valid body → 201', async () => {
    const res = await request(createApp())
      .post('/api/economics/budgets')
      .send({ title: 'FY26', periodStart: '2026-01', periodEnd: '2026-12' });
    expect(res.status).toBe(201);
    expect(budgetingSvc.createBudget).toHaveBeenCalled();
  });

  it('POST /budgets — missing periodEnd → 400, service not reached', async () => {
    const res = await request(createApp())
      .post('/api/economics/budgets')
      .send({ title: 'FY26', periodStart: '2026-01' });
    expect(res.status).toBe(400);
    expect(budgetingSvc.createBudget).not.toHaveBeenCalled();
  });

  it('POST /budgets — extra key → 400 (strict), service not reached', async () => {
    const res = await request(createApp())
      .post('/api/economics/budgets')
      .send({ title: 'FY26', periodStart: '2026-01', periodEnd: '2026-12', status: 'APPROVED' });
    expect(res.status).toBe(400);
    expect(budgetingSvc.createBudget).not.toHaveBeenCalled();
  });

  // ── PUT /budgets/:budgetId/lines/:lineId → budgetingSvc.updateBudgetLine ──
  it('PUT /budgets/:budgetId/lines/:lineId — valid body → 200', async () => {
    const res = await request(createApp())
      .put(`/api/economics/budgets/${BUDGET}/lines/${LINE}`)
      .send({ baselineValue: 1000, isLocked: true });
    expect(res.status).toBe(200);
    expect(budgetingSvc.updateBudgetLine).toHaveBeenCalled();
  });

  it('PUT /budgets/:budgetId/lines/:lineId — baselineValue wrong type → 400, service not reached', async () => {
    const res = await request(createApp())
      .put(`/api/economics/budgets/${BUDGET}/lines/${LINE}`)
      .send({ baselineValue: 'lots' });
    expect(res.status).toBe(400);
    expect(budgetingSvc.updateBudgetLine).not.toHaveBeenCalled();
  });

  it('PUT /budgets/:budgetId/lines/:lineId — extra key → 400 (strict), service not reached', async () => {
    const res = await request(createApp())
      .put(`/api/economics/budgets/${BUDGET}/lines/${LINE}`)
      .send({ baseline_value: 1000 });
    expect(res.status).toBe(400);
    expect(budgetingSvc.updateBudgetLine).not.toHaveBeenCalled();
  });

  // ── PUT /budgets/:budgetId/scenarios/:scenarioId/adjustments → updateScenarioAdjustments ──
  it('PUT /budgets/:budgetId/scenarios/:scenarioId/adjustments — valid numeric record → 200', async () => {
    const res = await request(createApp())
      .put(`/api/economics/budgets/${BUDGET}/scenarios/${SCENARIO}/adjustments`)
      .send({ revenueGrowth: 0.1, costReduction: 0.05, customDriver: 0.2 });
    expect(res.status).toBe(200);
    expect(budgetingSvc.updateScenarioAdjustments).toHaveBeenCalled();
  });

  it('PUT /budgets/:budgetId/scenarios/:scenarioId/adjustments — non-numeric value → 400, service not reached', async () => {
    const res = await request(createApp())
      .put(`/api/economics/budgets/${BUDGET}/scenarios/${SCENARIO}/adjustments`)
      .send({ revenueGrowth: 'up' });
    expect(res.status).toBe(400);
    expect(budgetingSvc.updateScenarioAdjustments).not.toHaveBeenCalled();
  });

  // ── PUT /finance-settings → valuationSvc.setOrgFinanceSettings ──
  it('PUT /finance-settings — valid body → 200', async () => {
    const res = await request(createApp())
      .put('/api/economics/finance-settings')
      .send({ defaultWacc: 10, defaultCurrency: 'EUR' });
    expect(res.status).toBe(200);
    expect(valuationSvc.setOrgFinanceSettings).toHaveBeenCalled();
  });

  it('PUT /finance-settings — defaultWacc wrong type → 400, service not reached', async () => {
    const res = await request(createApp())
      .put('/api/economics/finance-settings')
      .send({ defaultWacc: 'high' });
    expect(res.status).toBe(400);
    expect(valuationSvc.setOrgFinanceSettings).not.toHaveBeenCalled();
  });

  it('PUT /finance-settings — unknown key → 400 (strict), service not reached', async () => {
    const res = await request(createApp())
      .put('/api/economics/finance-settings')
      .send({ defaultWacc: 10, evilKey: 'x' });
    expect(res.status).toBe(400);
    expect(valuationSvc.setOrgFinanceSettings).not.toHaveBeenCalled();
  });
});
