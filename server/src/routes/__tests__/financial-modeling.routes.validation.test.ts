/**
 * Input-validation (zod) tests for the legacy financial-modeling router
 * (/api/financial-modeling).
 *
 * Wave 5 M16 hardening retrofitted `validateBody(...)` onto every mutating
 * endpoint that previously read req.body schemalessly. These tests pin:
 *   (a) a valid body still reaches the handler (200/201),
 *   (b) a malformed/extra-key body is rejected with 400 BEFORE the
 *       downstream service is invoked.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetModel = vi.fn();
const mockCreateModel = vi.fn();
const mockUpdateModel = vi.fn();
const mockAddEvent = vi.fn();
const mockUpdateEvent = vi.fn();
const mockDbGet = vi.fn();
const mockDbRun = vi.fn();

vi.mock('../../services/financialModelingService.js', () => ({
  getModel: (...a: unknown[]) => mockGetModel(...a),
  listModels: vi.fn(),
  createModel: (...a: unknown[]) => mockCreateModel(...a),
  updateModel: (...a: unknown[]) => mockUpdateModel(...a),
  computeModel: vi.fn(),
  persistComputeResult: vi.fn(),
  approveModel: vi.fn(),
  addEvent: (...a: unknown[]) => mockAddEvent(...a),
  updateEvent: (...a: unknown[]) => mockUpdateEvent(...a),
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
  get: (...a: unknown[]) => mockDbGet(...a),
  run: (...a: unknown[]) => mockDbRun(...a),
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

const OWNED_MODEL = 'model-1';
const OWNED_EVENT = 'event-1';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/financial-modeling', financialModelingRoutes);
  return app;
}

describe('financial-modeling routes — input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: 'user-1', organizationId: ORG };
    mockGetModel.mockResolvedValue({ id: OWNED_MODEL, organization_id: ORG, status: 'draft' });
    mockCreateModel.mockResolvedValue('new-model-id');
    mockAddEvent.mockResolvedValue('new-event-id');
    // Event ownership probe (PUT /events/:eventId) resolves to an owned row.
    mockDbGet.mockResolvedValue({ id: OWNED_EVENT });
  });

  // ── POST /models ──
  it('POST /models — valid body → 201 and calls createModel', async () => {
    const res = await request(createApp())
      .post('/api/financial-modeling/models')
      .send({ name: 'Plan A', startDate: '2026-01-01', horizonMonths: 12 });
    expect(res.status).toBe(201);
    expect(mockCreateModel).toHaveBeenCalledTimes(1);
  });

  it('POST /models — missing required name → 400, createModel NOT called', async () => {
    const res = await request(createApp())
      .post('/api/financial-modeling/models')
      .send({ startDate: '2026-01-01' });
    expect(res.status).toBe(400);
    expect(mockCreateModel).not.toHaveBeenCalled();
  });

  it('POST /models — wrong type (horizonMonths string) → 400', async () => {
    const res = await request(createApp())
      .post('/api/financial-modeling/models')
      .send({ name: 'Plan A', startDate: '2026-01-01', horizonMonths: 'twelve' });
    expect(res.status).toBe(400);
    expect(mockCreateModel).not.toHaveBeenCalled();
  });

  it('POST /models — unexpected extra key → 400 (strict)', async () => {
    const res = await request(createApp())
      .post('/api/financial-modeling/models')
      .send({ name: 'Plan A', startDate: '2026-01-01', dropTable: 'x' });
    expect(res.status).toBe(400);
    expect(mockCreateModel).not.toHaveBeenCalled();
  });

  // ── PUT /models/:id ──
  it('PUT /models/:id — valid partial body → 200 and calls updateModel', async () => {
    const res = await request(createApp())
      .put(`/api/financial-modeling/models/${OWNED_MODEL}`)
      .send({ name: 'Renamed', status: 'review' });
    expect(res.status).toBe(200);
    expect(mockUpdateModel).toHaveBeenCalledTimes(1);
  });

  it('PUT /models/:id — bad granularity enum → 400, updateModel NOT called', async () => {
    const res = await request(createApp())
      .put(`/api/financial-modeling/models/${OWNED_MODEL}`)
      .send({ granularity: 'hourly' });
    expect(res.status).toBe(400);
    expect(mockUpdateModel).not.toHaveBeenCalled();
  });

  it('PUT /models/:id — unexpected key → 400 (strict)', async () => {
    const res = await request(createApp())
      .put(`/api/financial-modeling/models/${OWNED_MODEL}`)
      .send({ organization_id: 'org-hijack' });
    expect(res.status).toBe(400);
    expect(mockUpdateModel).not.toHaveBeenCalled();
  });

  // ── POST /models/:id/events ──
  it('POST /models/:id/events — valid body → 201 and calls addEvent', async () => {
    const res = await request(createApp())
      .post(`/api/financial-modeling/models/${OWNED_MODEL}/events`)
      .send({
        eventType: 'revenue',
        name: 'Sales',
        amount: 1000,
        periodStart: '2026-01-01',
        cfClassification: 'operating',
      });
    expect(res.status).toBe(201);
    expect(mockAddEvent).toHaveBeenCalledTimes(1);
  });

  it('POST /models/:id/events — invalid eventType enum → 400, addEvent NOT called', async () => {
    const res = await request(createApp())
      .post(`/api/financial-modeling/models/${OWNED_MODEL}/events`)
      .send({
        eventType: 'not_a_type',
        name: 'Sales',
        amount: 1000,
        periodStart: '2026-01-01',
        cfClassification: 'operating',
      });
    expect(res.status).toBe(400);
    expect(mockAddEvent).not.toHaveBeenCalled();
  });

  it('POST /models/:id/events — missing amount → 400', async () => {
    const res = await request(createApp())
      .post(`/api/financial-modeling/models/${OWNED_MODEL}/events`)
      .send({
        eventType: 'revenue',
        name: 'Sales',
        periodStart: '2026-01-01',
        cfClassification: 'operating',
      });
    expect(res.status).toBe(400);
    expect(mockAddEvent).not.toHaveBeenCalled();
  });

  it('POST /models/:id/events — amount as string → 400', async () => {
    const res = await request(createApp())
      .post(`/api/financial-modeling/models/${OWNED_MODEL}/events`)
      .send({
        eventType: 'revenue',
        name: 'Sales',
        amount: '1000',
        periodStart: '2026-01-01',
        cfClassification: 'operating',
      });
    expect(res.status).toBe(400);
    expect(mockAddEvent).not.toHaveBeenCalled();
  });

  // ── PUT /events/:eventId ──
  it('PUT /events/:eventId — valid body → 200 and calls updateEvent', async () => {
    const res = await request(createApp())
      .put(`/api/financial-modeling/events/${OWNED_EVENT}`)
      .send({ amount: 500, is_active: false });
    expect(res.status).toBe(200);
    expect(mockUpdateEvent).toHaveBeenCalledTimes(1);
  });

  it('PUT /events/:eventId — unexpected key → 400, updateEvent NOT called', async () => {
    const res = await request(createApp())
      .put(`/api/financial-modeling/events/${OWNED_EVENT}`)
      .send({ model_id: 'other-model' });
    expect(res.status).toBe(400);
    expect(mockUpdateEvent).not.toHaveBeenCalled();
  });
});
