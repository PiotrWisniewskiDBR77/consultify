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

vi.mock('../../utils/pgFlags.js', () => ({ flagOn: () => false, parseMaybeJson: (v: unknown) => v }));

const ORG = 'org-1';
let mockUser: { id: string; organizationId: string } | null = null;

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = mockUser;
    next();
  },
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import economicsRoutes from '../economics.routes.js';

const ANALYSIS = 'analysis-1';
const BUDGET = 'budget-1';

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
    mockDbGet.mockResolvedValue(undefined); // no existing scenario → insert
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
});
