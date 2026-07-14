/**
 * HTTP status-mapping tests for POST /api/financial-modeling/models.
 *
 * The create handler's catch block must distinguish *not-found* references
 * (a missing/foreign-org project, initiative, or source statement) from
 * seed/validation errors:
 *   - any '... not found' message  → 404 (caller can't see the referenced row)
 *   - 'Statement'/'critical lines'/'seed' (not-found-free) → 400
 *   - anything else → rethrow (500)
 *
 * Regression: 'Source statement not found' (lowercase 'statement', thrown by
 * buildSeededAssumptionsFromStatement) previously fell through the 'Statement'
 * substring check and leaked as a 500.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateModel = vi.fn();

vi.mock('../../services/financialModelingService.js', () => ({
  getModel: vi.fn(),
  listModels: vi.fn(),
  createModel: (...a: unknown[]) => mockCreateModel(...a),
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

// Minimal body that satisfies the create schema.
const validBody = { name: 'M', startDate: '2026-01-01' };

describe('POST /models — create error → HTTP status mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-1', organizationId: ORG };
  });

  it("maps 'Source statement not found' → 404 (not 500)", async () => {
    mockCreateModel.mockRejectedValue(new Error('Source statement not found'));
    const res = await request(createApp())
      .post('/api/financial-modeling/models')
      .send({ ...validBody, sourceStatementId: 'stmt-foreign' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it("maps a foreign-org 'Source project not found' → 404", async () => {
    mockCreateModel.mockRejectedValue(new Error('Source project not found'));
    const res = await request(createApp())
      .post('/api/financial-modeling/models')
      .send({ ...validBody, projectId: 'project-foreign' });
    expect(res.status).toBe(404);
  });

  it("maps a foreign-org 'Source initiative not found' → 404", async () => {
    mockCreateModel.mockRejectedValue(new Error('Source initiative not found'));
    const res = await request(createApp())
      .post('/api/financial-modeling/models')
      .send({ ...validBody, initiativeId: 'initiative-foreign' });
    expect(res.status).toBe(404);
  });

  it('keeps a (not-found-free) statement-readiness error at 400', async () => {
    mockCreateModel.mockRejectedValue(
      new Error('Statement must be statement-ready before it can seed a model')
    );
    const res = await request(createApp())
      .post('/api/financial-modeling/models')
      .send({ ...validBody, sourceStatementId: 'stmt-1' });
    expect(res.status).toBe(400);
  });

  it('still returns 201 on success', async () => {
    mockCreateModel.mockResolvedValue('new-model-id');
    const res = await request(createApp()).post('/api/financial-modeling/models').send(validBody);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, id: 'new-model-id' });
  });
});
