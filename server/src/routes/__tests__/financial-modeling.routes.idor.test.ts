/**
 * Cross-org IDOR regression tests for the legacy financial-modeling router
 * (/api/financial-modeling).
 *
 * Wave 1 fixed the by-id model read path (getModel now filters by org).
 * This suite pins the SIBLING endpoints that previously read/mutated by id
 * with NO org filter:
 *   - GET    /models/:id/events
 *   - GET    /models/:id/outputs
 *   - GET    /models/:id/validations
 *   - POST   /models/:id/approve
 *   - PUT    /events/:eventId
 *   - DELETE /events/:eventId
 *
 * Contract: a request for a model/event owned by ANOTHER org must return 404
 * and MUST NOT call the downstream (org-blind) service function.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/legacyCutover/requireActiveMembership.js', () => ({
  requireActiveMembership: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../services/legacyCutover/legacyCutoverKernel.js', () => ({
  createLegacyCutoverGuard: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockGetModel = vi.fn();
const mockListEvents = vi.fn();
const mockGetOutputs = vi.fn();
const mockGetValidations = vi.fn();
const mockApproveModel = vi.fn();
const mockUpdateEvent = vi.fn();
const mockDeleteEvent = vi.fn();

const mockDbGet = vi.fn();
const mockDbRun = vi.fn();

vi.mock('../../services/financialModelingService.js', () => ({
  getModel: (...a: unknown[]) => mockGetModel(...a),
  listModels: vi.fn(),
  createModel: vi.fn(),
  updateModel: vi.fn(),
  computeModel: vi.fn(),
  persistComputeResult: vi.fn(),
  approveModel: (...a: unknown[]) => mockApproveModel(...a),
  addEvent: vi.fn(),
  updateEvent: (...a: unknown[]) => mockUpdateEvent(...a),
  deleteEvent: (...a: unknown[]) => mockDeleteEvent(...a),
  listEvents: (...a: unknown[]) => mockListEvents(...a),
  getOutputs: (...a: unknown[]) => mockGetOutputs(...a),
  getValidations: (...a: unknown[]) => mockGetValidations(...a),
}));

vi.mock('../../services/financeDiagnosticsService.js', () => ({
  getFinanceTraceId: () => 'trace-test',
  logFinanceError: vi.fn(),
  logFinanceEvent: vi.fn(),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  get: (...a: unknown[]) => mockDbGet(...a),
  run: (...a: unknown[]) => mockDbRun(...a),
  all: vi.fn(),
}));

let mockUser: { id: string; organizationId: string } | null = null;

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = mockUser;
    next();
  },
  isAuthenticated: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import financialModelingRoutes from '../financial-modeling.routes.js';

const ATTACKER_ORG = 'org-attacker';
const FOREIGN_MODEL = 'model-owned-by-victim';
const FOREIGN_EVENT = 'event-owned-by-victim';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/financial-modeling', financialModelingRoutes);
  return app;
}

describe('financial-modeling routes — cross-org IDOR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-attacker', organizationId: ATTACKER_ORG };
    // getModel is org-scoped: a foreign-org id resolves to null.
    mockGetModel.mockResolvedValue(null);
    // Event ownership JOIN finds nothing for the attacker org.
    mockDbGet.mockResolvedValue(undefined);
  });

  it('GET /models/:id/events → 404 and does NOT read foreign events', async () => {
    const res = await request(createApp()).get(
      `/api/financial-modeling/models/${FOREIGN_MODEL}/events`
    );
    expect(res.status).toBe(404);
    expect(mockGetModel).toHaveBeenCalledWith(FOREIGN_MODEL, ATTACKER_ORG);
    expect(mockListEvents).not.toHaveBeenCalled();
  });

  it('GET /models/:id/outputs → 404 and does NOT read foreign outputs', async () => {
    const res = await request(createApp()).get(
      `/api/financial-modeling/models/${FOREIGN_MODEL}/outputs`
    );
    expect(res.status).toBe(404);
    expect(mockGetModel).toHaveBeenCalledWith(FOREIGN_MODEL, ATTACKER_ORG);
    expect(mockGetOutputs).not.toHaveBeenCalled();
  });

  it('GET /models/:id/validations → 404 and does NOT read foreign validations', async () => {
    const res = await request(createApp()).get(
      `/api/financial-modeling/models/${FOREIGN_MODEL}/validations`
    );
    expect(res.status).toBe(404);
    expect(mockGetModel).toHaveBeenCalledWith(FOREIGN_MODEL, ATTACKER_ORG);
    expect(mockGetValidations).not.toHaveBeenCalled();
  });

  it('POST /models/:id/approve → 404 and does NOT approve a foreign model', async () => {
    const res = await request(createApp())
      .post(`/api/financial-modeling/models/${FOREIGN_MODEL}/approve`)
      .send({});
    expect(res.status).toBe(404);
    expect(mockGetModel).toHaveBeenCalledWith(FOREIGN_MODEL, ATTACKER_ORG);
    expect(mockApproveModel).not.toHaveBeenCalled();
  });

  it('PUT /events/:eventId → 404 and does NOT mutate a foreign event', async () => {
    const res = await request(createApp())
      .put(`/api/financial-modeling/events/${FOREIGN_EVENT}`)
      .send({ amount: 999999 });
    expect(res.status).toBe(404);
    // Ownership probe must filter by the attacker's org.
    const [, params] = mockDbGet.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual([FOREIGN_EVENT, ATTACKER_ORG]);
    expect(mockUpdateEvent).not.toHaveBeenCalled();
  });

  it('DELETE /events/:eventId → 404 and does NOT delete a foreign event', async () => {
    const res = await request(createApp()).delete(
      `/api/financial-modeling/events/${FOREIGN_EVENT}`
    );
    expect(res.status).toBe(404);
    const [, params] = mockDbGet.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual([FOREIGN_EVENT, ATTACKER_ORG]);
    expect(mockDeleteEvent).not.toHaveBeenCalled();
  });

  it('same-org access still reaches the service (no false 404)', async () => {
    mockGetModel.mockResolvedValue({ id: FOREIGN_MODEL, organization_id: ATTACKER_ORG });
    mockGetValidations.mockResolvedValue([]);
    const res = await request(createApp()).get(
      `/api/financial-modeling/models/${FOREIGN_MODEL}/validations`
    );
    expect(res.status).toBe(200);
    expect(mockGetValidations).toHaveBeenCalledWith(FOREIGN_MODEL);
  });
});
