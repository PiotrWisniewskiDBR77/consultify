import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetV8Context = vi.fn();
const mockRequireCaseAccess = vi.fn();
const mockAppendCaseHistoryEvent = vi.fn();
const mockGetCaseHistoryEvent = vi.fn();
const mockRecordValueMeasurement = vi.fn();
const mockListCaseHistoryEventsForCase = vi.fn();

vi.mock('../../../middleware/v8Auth.middleware.js', () => ({
  getV8Context: (...args: unknown[]) => mockGetV8Context(...args),
}));

vi.mock('../../../services/caseWorkspace/caseWorkspaceAuthContext.js', async () => {
  const actual = await vi.importActual<typeof import('../../../services/caseWorkspace/caseWorkspaceAuthContext.js')>(
    '../../../services/caseWorkspace/caseWorkspaceAuthContext.js'
  );
  return { ...actual, requireCaseAccess: (...args: unknown[]) => mockRequireCaseAccess(...args) };
});

vi.mock('../../../services/caseWorkspace/caseHistoryService.js', () => ({
  appendCaseHistoryEvent: (...args: unknown[]) => mockAppendCaseHistoryEvent(...args),
  getCaseHistoryEvent: (...args: unknown[]) => mockGetCaseHistoryEvent(...args),
  listCaseHistoryEventsForCase: (...args: unknown[]) => mockListCaseHistoryEventsForCase(...args),
  recordValueMeasurement: (...args: unknown[]) => mockRecordValueMeasurement(...args),
  getValueMeasurement: vi.fn(),
  listValueMeasurementsForCase: vi.fn(),
  listValueMeasurementsForMetric: vi.fn(),
}));

import caseHistoryRoutes from '../caseHistory.routes.js';
import { errorHandlerMiddleware } from '../../../utils/ErrorHandler.js';

const ORG = 'org-1';
const USER = 'user-1';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8/case-workspace', caseHistoryRoutes);
  app.use(errorHandlerMiddleware);
  return app;
}

describe('caseWorkspace history/value-measurement routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetV8Context.mockReturnValue({ organizationId: ORG, userId: USER, userRole: 'ADMIN', isSuperAdmin: false });
    mockRequireCaseAccess.mockResolvedValue({ membershipId: 'm1', organizationId: ORG, userId: USER, role: 'ADMIN' });
  });

  it('rejects an append-event body missing summary with 400', async () => {
    const res = await request(createApp())
      .post('/api/v8/case-workspace/cases/case-1/history-events')
      .send({ eventType: 'CASE_STATUS_CHANGED', occurredAt: '2026-01-01T00:00:00.000Z' });
    expect(res.status).toBe(400);
    expect(mockAppendCaseHistoryEvent).not.toHaveBeenCalled();
  });

  it('never forwards a body-supplied organizationId/actorId — always uses the authenticated actor', async () => {
    mockAppendCaseHistoryEvent.mockResolvedValue({ eventId: 'cwhist-1', caseId: 'case-1' });
    const res = await request(createApp())
      .post('/api/v8/case-workspace/cases/case-1/history-events')
      .send({
        eventType: 'CASE_STATUS_CHANGED',
        occurredAt: '2026-01-01T00:00:00.000Z',
        summary: 'status changed',
      });
    expect(res.status).toBe(201);
    expect(mockAppendCaseHistoryEvent).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG, actorId: USER, caseId: 'case-1' })
    );
  });

  it('resolves the owning caseId via getCaseHistoryEvent before authorizing a by-id read, and 404s when missing', async () => {
    mockGetCaseHistoryEvent.mockResolvedValue(null);
    const res = await request(createApp()).get('/api/v8/case-workspace/history-events/evt-missing');
    expect(res.status).toBe(404);
    expect(mockRequireCaseAccess).not.toHaveBeenCalled();
  });

  it('rejects a value-measurement body with an invalid measurementStatus enum with 400', async () => {
    const res = await request(createApp())
      .post('/api/v8/case-workspace/cases/case-1/value-measurements')
      .send({
        metricKey: 'nps',
        metricName: 'NPS',
        measurementStatus: 'NOT_A_STATUS',
        measurementDate: '2026-01-01',
        confidence: 'HIGH',
        attribution: 'direct',
      });
    expect(res.status).toBe(400);
    expect(mockRecordValueMeasurement).not.toHaveBeenCalled();
  });

  it('maps value_measurement_actual_value_required to 400 (business-rule required-field error)', async () => {
    mockRecordValueMeasurement.mockRejectedValue(new Error('value_measurement_actual_value_required'));
    const res = await request(createApp())
      .post('/api/v8/case-workspace/cases/case-1/value-measurements')
      .send({
        metricKey: 'nps',
        metricName: 'NPS',
        measurementStatus: 'CONFIRMED',
        measurementDate: '2026-01-01',
        confidence: 'HIGH',
        attribution: 'direct',
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALUE_MEASUREMENT_ACTUAL_VALUE_REQUIRED');
  });

  it('checks case access before listing history events for a case', async () => {
    mockListCaseHistoryEventsForCase.mockResolvedValue([]);
    const res = await request(createApp()).get('/api/v8/case-workspace/cases/case-1/history-events');
    expect(res.status).toBe(200);
    expect(mockRequireCaseAccess).toHaveBeenCalledWith(USER, 'case-1');
  });
});
