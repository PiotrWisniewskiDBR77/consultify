/**
 * Cross-org IDOR regression tests for the economics router (/api/economics).
 *
 * Pins the by-id endpoints that previously read/mutated finance data with
 * NO org filter:
 *   - GET /financial-analyses/:id/ratios
 *   - GET /financial-analyses/:id/insights
 *   - PUT /budgets/:budgetId/lines/:lineId
 *   - PUT /budgets/:budgetId/scenarios/:scenarioId/adjustments
 *
 * Contract: foreign-org id → 404; downstream (org-blind) service NOT called.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetAnalysisRatios = vi.fn();
const mockGetAnalysisInsights = vi.fn();
const mockGetBudget = vi.fn();
const mockUpdateBudgetLine = vi.fn();
const mockUpdateScenarioAdjustments = vi.fn();
const mockDbGet = vi.fn();

vi.mock('../../services/financialAnalysisService.js', () => ({
  getAnalysisRatios: (...a: unknown[]) => mockGetAnalysisRatios(...a),
  getAnalysisInsights: (...a: unknown[]) => mockGetAnalysisInsights(...a),
}));

vi.mock('../../services/budgetingService.js', () => ({
  getBudget: (...a: unknown[]) => mockGetBudget(...a),
  updateBudgetLine: (...a: unknown[]) => mockUpdateBudgetLine(...a),
  updateScenarioAdjustments: (...a: unknown[]) => mockUpdateScenarioAdjustments(...a),
  listBudgets: vi.fn(),
  getBudgetLines: vi.fn(),
  getScenarios: vi.fn(),
  approveBudget: vi.fn(),
  generateScenarioProjections: vi.fn(),
}));

vi.mock('../../services/valuationService.js', () => ({
  listValuations: vi.fn(),
  getValuation: vi.fn(),
  createValuation: vi.fn(),
  getOrgFinanceSettings: vi.fn(),
}));
vi.mock('../../services/valuationExportService.js', () => ({ exportValuationPptx: vi.fn() }));
vi.mock('../../services/decisionService.js', () => ({ default: {} }));
vi.mock('../../services/economicsFinancials.js', () => ({
  applyScenarioAdjustments: vi.fn(),
  calculateFinancialMetrics: vi.fn(),
  defaultFinancialData: {},
  normalizeFinancialData: vi.fn(),
  validateFinancialData: vi.fn(),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  get: (...a: unknown[]) => mockDbGet(...a),
  all: vi.fn().mockResolvedValue([]),
  run: vi.fn(),
}));

vi.mock('../../utils/pgFlags.js', () => ({ flagOn: () => false, parseMaybeJson: (v: unknown) => v }));

let mockUser: { id: string; organizationId: string } | null = null;

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = mockUser;
    next();
  },
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import economicsRoutes from '../economics.routes.js';

const ATTACKER_ORG = 'org-attacker';
const FOREIGN_ANALYSIS = 'analysis-victim';
const FOREIGN_BUDGET = 'budget-victim';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/economics', economicsRoutes);
  return app;
}

describe('economics routes — cross-org IDOR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-attacker', organizationId: ATTACKER_ORG };
    // Org-scoped parent lookups resolve to nothing for a foreign id.
    mockDbGet.mockResolvedValue(undefined);
    mockGetBudget.mockResolvedValue(null);
  });

  it('GET /financial-analyses/:id/ratios → 404, does NOT read foreign ratios', async () => {
    const res = await request(createApp()).get(
      `/api/economics/financial-analyses/${FOREIGN_ANALYSIS}/ratios`
    );
    expect(res.status).toBe(404);
    const [, params] = mockDbGet.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual([FOREIGN_ANALYSIS, ATTACKER_ORG]);
    expect(mockGetAnalysisRatios).not.toHaveBeenCalled();
  });

  it('GET /financial-analyses/:id/insights → 404, does NOT read foreign insights', async () => {
    const res = await request(createApp()).get(
      `/api/economics/financial-analyses/${FOREIGN_ANALYSIS}/insights`
    );
    expect(res.status).toBe(404);
    const [, params] = mockDbGet.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual([FOREIGN_ANALYSIS, ATTACKER_ORG]);
    expect(mockGetAnalysisInsights).not.toHaveBeenCalled();
  });

  it('PUT /budgets/:budgetId/lines/:lineId → 404, does NOT mutate foreign budget line', async () => {
    const res = await request(createApp())
      .put(`/api/economics/budgets/${FOREIGN_BUDGET}/lines/line-1`)
      .send({ baselineValue: 999999 });
    expect(res.status).toBe(404);
    expect(mockGetBudget).toHaveBeenCalledWith(ATTACKER_ORG, FOREIGN_BUDGET);
    expect(mockUpdateBudgetLine).not.toHaveBeenCalled();
  });

  it('PUT /budgets/:budgetId/scenarios/:scenarioId/adjustments → 404, does NOT mutate foreign scenario', async () => {
    const res = await request(createApp())
      .put(`/api/economics/budgets/${FOREIGN_BUDGET}/scenarios/sc-1/adjustments`)
      .send({ revenue: 1 });
    expect(res.status).toBe(404);
    expect(mockGetBudget).toHaveBeenCalledWith(ATTACKER_ORG, FOREIGN_BUDGET);
    expect(mockUpdateScenarioAdjustments).not.toHaveBeenCalled();
  });

  it('same-org budget mutation still reaches the service (no false 404)', async () => {
    mockGetBudget.mockResolvedValue({ id: FOREIGN_BUDGET });
    mockUpdateBudgetLine.mockResolvedValue(undefined);
    const res = await request(createApp())
      .put(`/api/economics/budgets/${FOREIGN_BUDGET}/lines/line-1`)
      .send({ baselineValue: 42 });
    expect(res.status).toBe(200);
    expect(mockUpdateBudgetLine).toHaveBeenCalledWith(FOREIGN_BUDGET, 'line-1', {
      baselineValue: 42,
    });
  });
});
