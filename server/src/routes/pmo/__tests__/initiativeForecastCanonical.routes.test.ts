/** @vitest-environment node */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createInitiativesExecutionRuntimeRouter } from '../initiativesExecutionRuntime.routes.js';

const initiativeId = 'initiative-forecast-a';
const organizationId = 'org-forecast-a';
const actorId = 'actor-forecast-a';
const canonicalPayload = {
  initiativeId,
  projectId: 'project-forecast-a',
  initiativeOwnerId: actorId,
  lifecycleState: 'IN_EXECUTION',
  title: 'Canonical Initiative payload must survive forecast writes',
};

describe('canonical Initiative forecast HTTP command', () => {
  const transaction = {
    findReceipt: vi.fn(),
    getAggregateVersion: vi.fn(),
    getAggregatePayload: vi.fn(),
    getRelatedAggregateForUpdate: vi.fn(),
    writeInitiativeForecastProjection: vi.fn(),
    persistAggregate: vi.fn(),
    appendAudit: vi.fn(),
    appendOutbox: vi.fn(),
    saveReceipt: vi.fn(),
  };
  const unitOfWork = {
    transaction: vi.fn(async (work: (tx: typeof transaction) => Promise<unknown>) =>
      work(transaction)
    ),
  };
  const reader = {
    findById: vi.fn(),
    findModuleInitiativeForPlanning: vi.fn(),
  };
  const authorize = vi.fn();
  const authorizeInitiativeObject = vi.fn();
  const resolvePolicy = vi.fn();

  const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = {
        id: actorId,
        organizationId,
        role: 'INITIATIVE_OWNER',
      };
      next();
    });
    app.use(
      '/api/initiatives/runtime-v1',
      createInitiativesExecutionRuntimeRouter({
        unitOfWork,
        reader,
        authorize,
        authorizeInitiativeObject,
        resolvePolicy,
      } as any)
    );
    return app;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    reader.findById.mockResolvedValue({
      version: 4,
      initiative: canonicalPayload,
      updatedAt: '2026-09-13T08:00:00.000Z',
    });
    reader.findModuleInitiativeForPlanning.mockResolvedValue({
      initiativeId,
      status: 'IN_EXECUTION',
      projectId: canonicalPayload.projectId,
      dependsOn: [],
    });
    authorize.mockResolvedValue(true);
    authorizeInitiativeObject.mockResolvedValue(true);
    resolvePolicy.mockResolvedValue({
      policyId: 'policy-standard',
      version: 3,
      config: { selfApproval: false },
    });
    transaction.findReceipt.mockResolvedValue(null);
    transaction.getAggregateVersion.mockResolvedValue(4);
    transaction.getAggregatePayload.mockResolvedValue(canonicalPayload);
    transaction.getRelatedAggregateForUpdate.mockResolvedValue({
      version: 4,
      payload: canonicalPayload,
    });
    transaction.writeInitiativeForecastProjection.mockResolvedValue({
      before: { forecastStartDate: '2026-09-01', forecastEndDate: '2026-09-30' },
      after: { forecastStartDate: '2026-09-01', forecastEndDate: '2026-10-15' },
      receiptId: 'forecast-receipt-a',
      observedAt: '2026-09-13T08:05:00.000Z',
    });
  });

  it('updates only the supplied forecast end through the same canonical Initiative version', async () => {
    const response = await request(buildApp())
      .post(`/api/initiatives/runtime-v1/initiatives/${initiativeId}/forecast`)
      .set('X-Correlation-ID', 'forecast-correlation-a')
      .send({
        expectedVersion: 4,
        clientRequestId: 'forecast-request-a',
        forecastEndDate: '2026-10-15',
        reason: 'Supplier delivery moved',
      });

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toMatchObject({
      status: 'APPLIED',
      aggregateVersion: 5,
      response: {
        initiativeId,
        before: { forecastStartDate: '2026-09-01', forecastEndDate: '2026-09-30' },
        after: { forecastStartDate: '2026-09-01', forecastEndDate: '2026-10-15' },
        receiptId: 'forecast-receipt-a',
      },
    });
    expect(transaction.writeInitiativeForecastProjection).toHaveBeenCalledWith({
      organizationId,
      initiativeId,
      actorId,
      clientRequestId: 'forecast-request-a',
      reason: 'Supplier delivery moved',
      canonicalBefore: { forecastStartDate: null, forecastEndDate: null },
      canonicalFieldPresence: { forecastStartDate: false, forecastEndDate: false },
      forecastEndDate: '2026-10-15',
    });
    expect(transaction.persistAggregate).toHaveBeenCalledWith(
      organizationId,
      'initiative',
      initiativeId,
      4,
      5,
      expect.objectContaining({
        lifecycleState: 'IN_EXECUTION',
        title: canonicalPayload.title,
        forecastEndDate: '2026-10-15',
      })
    );
    expect(
      Object.prototype.hasOwnProperty.call(
        transaction.persistAggregate.mock.calls[0][5],
        'forecastStartDate'
      )
    ).toBe(false);
  });

  it('rejects an empty forecast command before opening the transaction', async () => {
    const response = await request(buildApp())
      .post(`/api/initiatives/runtime-v1/initiatives/${initiativeId}/forecast`)
      .send({
        expectedVersion: 4,
        clientRequestId: 'forecast-empty-a',
        reason: 'No changed field',
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
    expect(unitOfWork.transaction).not.toHaveBeenCalled();
  });

  it('checks the tenant-scoped canonical Initiative before command replay can run', async () => {
    reader.findById.mockResolvedValueOnce(null);

    const response = await request(buildApp())
      .post(`/api/initiatives/runtime-v1/initiatives/${initiativeId}/forecast`)
      .send({
        expectedVersion: 4,
        clientRequestId: 'forecast-foreign-replay-probe',
        forecastStartDate: '2026-09-02',
        reason: 'Foreign replay probe',
      });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
    expect(unitOfWork.transaction).not.toHaveBeenCalled();
  });

  it('requires the Initiative object update capability before opening the transaction', async () => {
    authorizeInitiativeObject.mockResolvedValueOnce(false);

    const response = await request(buildApp())
      .post(`/api/initiatives/runtime-v1/initiatives/${initiativeId}/forecast`)
      .send({
        expectedVersion: 4,
        clientRequestId: 'forecast-denied-a',
        forecastStartDate: null,
        reason: 'Explicitly clear an invalid date',
      });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ error: { code: 'CAPABILITY_REQUIRED' } });
    expect(unitOfWork.transaction).not.toHaveBeenCalled();
  });

  it('does not rewrite a closed Initiative without a governed reopen Decision', async () => {
    const closedPayload = { ...canonicalPayload, lifecycleState: 'CLOSED' };
    transaction.getAggregatePayload.mockResolvedValueOnce(closedPayload);
    transaction.getRelatedAggregateForUpdate.mockResolvedValueOnce({
      version: 4,
      payload: closedPayload,
    });

    const response = await request(buildApp())
      .post(`/api/initiatives/runtime-v1/initiatives/${initiativeId}/forecast`)
      .send({
        expectedVersion: 4,
        clientRequestId: 'forecast-closed-a',
        forecastEndDate: '2026-10-15',
        reason: 'Attempt after closure',
      });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      error: { code: 'INITIATIVE_FORECAST_LIFECYCLE_INVALID' },
    });
    expect(transaction.writeInitiativeForecastProjection).not.toHaveBeenCalled();
    expect(transaction.persistAggregate).not.toHaveBeenCalled();
  });

  it('rolls back a partial update whose merged forecast range is inverted', async () => {
    transaction.writeInitiativeForecastProjection.mockResolvedValueOnce({
      before: { forecastStartDate: '2026-10-10', forecastEndDate: '2026-10-30' },
      after: { forecastStartDate: '2026-10-10', forecastEndDate: '2026-10-01' },
      receiptId: 'forecast-invalid-range-a',
      observedAt: '2026-09-13T08:05:00.000Z',
    });

    const response = await request(buildApp())
      .post(`/api/initiatives/runtime-v1/initiatives/${initiativeId}/forecast`)
      .send({
        expectedVersion: 4,
        clientRequestId: 'forecast-invalid-range-a',
        forecastEndDate: '2026-10-01',
        reason: 'Invalid merged range',
      });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ error: { code: 'INITIATIVE_FORECAST_RANGE_INVALID' } });
    expect(transaction.persistAggregate).not.toHaveBeenCalled();
    expect(transaction.appendAudit).not.toHaveBeenCalled();
    expect(transaction.appendOutbox).not.toHaveBeenCalled();
    expect(transaction.saveReceipt).not.toHaveBeenCalled();
  });

  it('advertises the canonical forecast writer only for an eligible Initiative with its module projection', async () => {
    const response = await request(buildApp()).get(
      `/api/initiatives/runtime-v1/initiatives/${initiativeId}/capabilities`
    );

    expect(response.status).toBe(200);
    expect(response.body.executionWrites.forecast).toEqual({
      available: true,
      canonicalCommand: 'POST /api/initiatives/runtime-v1/initiatives/:initiativeId/forecast',
      denialAt: null,
      denialCode: null,
      legacyDenialAt: 'BRAMKA_LEGACY',
      legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
    });
  });

  it('does not advertise forecast as available for a CLOSED Initiative', async () => {
    reader.findById.mockResolvedValueOnce({
      version: 4,
      initiative: { ...canonicalPayload, lifecycleState: 'CLOSED' },
      updatedAt: '2026-09-13T08:00:00.000Z',
    });

    const response = await request(buildApp()).get(
      `/api/initiatives/runtime-v1/initiatives/${initiativeId}/capabilities`
    );

    expect(response.status).toBe(200);
    expect(response.body.executionWrites.forecast).toMatchObject({
      available: false,
      denialAt: 'CYKL_ŻYCIA',
      denialCode: 'INITIATIVE_FORECAST_LIFECYCLE_INVALID',
    });
  });

  it('advertises the native canonical forecast writer without a compatibility module projection', async () => {
    reader.findModuleInitiativeForPlanning.mockResolvedValueOnce(null);

    const response = await request(buildApp()).get(
      `/api/initiatives/runtime-v1/initiatives/${initiativeId}/capabilities`
    );

    expect(response.status).toBe(200);
    expect(response.body.executionWrites.forecast).toMatchObject({
      available: true,
      denialAt: null,
      denialCode: null,
    });
  });
});
