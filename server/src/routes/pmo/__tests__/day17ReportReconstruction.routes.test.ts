import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createInitiativesExecutionRuntimeRouter } from '../initiativesExecutionRuntime.routes.js';

describe('Day 17 X.1 report reconstruction HTTP contract', () => {
  const listReportRuns = vi.fn();
  const resolveProjectIdsForAggregate = vi.fn();
  const authorize = vi.fn();
  const unitOfWork = {} as any;

  const makeApp = () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = { id: 'user-a', organizationId: 'org-a', role: 'OWNER' };
      next();
    });
    app.use(
      '/api/v8/pmo/initiatives-execution',
      createInitiativesExecutionRuntimeRouter({
        unitOfWork,
        reader: { listReportRuns, resolveProjectIdsForAggregate } as any,
        authorize,
        resolvePolicy: vi.fn(),
      })
    );
    return app;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    listReportRuns.mockResolvedValue([
      {
        reportRunId: 'run-1',
        sources: [
          {
            sourceType: 'execution_task',
            sourceId: 'task-1',
            version: 2,
            capturedAt: '2026-08-01T00:00:00.000Z',
            freshness: 'CURRENT',
            formula: null,
            unit: null,
            currency: null,
            window: null,
            confidence: 'HIGH',
            accessState: 'FULL',
            redactions: [],
          },
        ],
      },
    ]);
    resolveProjectIdsForAggregate.mockResolvedValue(['project-a']);
    authorize.mockResolvedValue(true);
  });

  it('returns an honest non-reconstructable result without mutating the run', async () => {
    const response = await request(makeApp())
      .post('/api/v8/pmo/initiatives-execution/report-runs/run-1/reconstruct')
      .send({ asOf: '2026-08-10T00:00:00.000Z' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      reportRunId: 'run-1',
      asOf: '2026-08-10T00:00:00.000Z',
      reconstructable: false,
      sources: [],
      gaps: [{ reason: 'NO_EVENT_HISTORY_BEFORE_AS_OF' }],
    });
    expect(Object.keys(unitOfWork)).toHaveLength(0);
  });

  it('rejects a future timestamp', async () => {
    const response = await request(makeApp())
      .post('/api/v8/pmo/initiatives-execution/report-runs/run-1/reconstruct')
      .send({ asOf: '2999-01-01T00:00:00.000Z' });
    expect(response.status).toBe(400);
  });

  it('returns 404 for a missing tenant-scoped run', async () => {
    listReportRuns.mockResolvedValue([]);
    const response = await request(makeApp())
      .post('/api/v8/pmo/initiatives-execution/report-runs/run-foreign/reconstruct')
      .send({ asOf: '2026-08-10T00:00:00.000Z' });
    expect(response.status).toBe(404);
  });

  it('returns 404 when project visibility is denied', async () => {
    authorize.mockResolvedValue(false);
    const response = await request(makeApp())
      .post('/api/v8/pmo/initiatives-execution/report-runs/run-1/reconstruct')
      .send({ asOf: '2026-08-10T00:00:00.000Z' });
    expect(response.status).toBe(404);
  });
});
