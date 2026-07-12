/**
 * #82f — GET /api/financial-modeling/models/:id/assumptions-status
 * Confirms the route is actually wired to `financialModelingService.getModelAssumptionsStatus`
 * (assumptionsRegistry / Z114 caller) and is fail-soft (never 500 on engine error).
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetModel = vi.fn();
const mockGetModelAssumptionsStatus = vi.fn();

vi.mock('../../services/financialModelingService.js', () => ({
  getModel: (...a: unknown[]) => mockGetModel(...a),
  getModelAssumptionsStatus: (...a: unknown[]) => mockGetModelAssumptionsStatus(...a),
  listModels: vi.fn(),
  createModel: vi.fn(),
  updateModel: vi.fn(),
  computeModel: vi.fn(),
  persistComputeResult: vi.fn(),
  approveModel: vi.fn(),
  addEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  listEvents: vi.fn().mockResolvedValue([]),
  getOutputs: vi.fn(),
  getValidations: vi.fn(),
  reseedModelFromSource: vi.fn(),
}));

vi.mock('../../services/financeDiagnosticsService.js', () => ({
  getFinanceTraceId: () => 'trace-test',
  logFinanceError: vi.fn(),
  logFinanceEvent: vi.fn(),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  get: vi.fn(),
  run: vi.fn(),
  all: vi.fn().mockResolvedValue([]),
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

import financialModelingRoutes from '../financial-modeling.routes.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/financial-modeling', financialModelingRoutes);
  return app;
}

const MODEL_ID = 'model-1';

describe('GET /api/financial-modeling/models/:id/assumptions-status (#82f)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-1', organizationId: ORG };
  });

  it('calls financialModelingService.getModelAssumptionsStatus and returns its result', async () => {
    mockGetModelAssumptionsStatus.mockResolvedValue({
      modelId: MODEL_ID,
      available: true,
      isGrounded: true,
      seedSource: { type: 'statement_pack', periodLabel: 'FY2025' },
      assumptions: [
        {
          key: 'baseline.revenue',
          label: 'Przychód (baseline)',
          value: 1000000,
          unit: 'kwota',
          provenance: { source_type: 'imported' },
          status: 'sourced',
          needsReview: false,
        },
        {
          key: 'baseline.capex',
          label: 'CAPEX (baseline)',
          value: null,
          unit: 'kwota',
          provenance: { source_type: 'ai_assumed' },
          status: 'missing',
          needsReview: true,
        },
      ],
      coverage: { modelType: 'financial_model.3stmt', requiredCount: 10, presentCount: 8, coverage: 0.8, complete: false },
    });

    const res = await request(createApp()).get(
      `/api/financial-modeling/models/${MODEL_ID}/assumptions-status`
    );

    expect(res.status).toBe(200);
    expect(mockGetModelAssumptionsStatus).toHaveBeenCalledWith(MODEL_ID, ORG);
    expect(res.body.available).toBe(true);
    expect(res.body.assumptions).toHaveLength(2);
    expect(res.body.assumptions[0].status).toBe('sourced');
    expect(res.body.assumptions[1].status).toBe('missing');
  });

  it('returns 404 when the model does not exist', async () => {
    mockGetModelAssumptionsStatus.mockResolvedValue(null);

    const res = await request(createApp()).get(
      `/api/financial-modeling/models/missing-model/assumptions-status`
    );

    expect(res.status).toBe(404);
  });

  it('degrades to available:false (never 500) when the engine throws', async () => {
    mockGetModelAssumptionsStatus.mockRejectedValue(new Error('boom'));

    const res = await request(createApp()).get(
      `/api/financial-modeling/models/${MODEL_ID}/assumptions-status`
    );

    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.assumptions).toEqual([]);
  });
});
