/** @vitest-environment node */
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createInitiativesExecutionRuntimeRouter } from '../initiativesExecutionRuntime.routes.js';

const saved = process.env.ENABLE_EXECUTION_REPORT_E4;
afterEach(() => {
  if (saved === undefined) delete process.env.ENABLE_EXECUTION_REPORT_E4;
  else process.env.ENABLE_EXECUTION_REPORT_E4 = saved;
});

const run = {
  reportRunId: 'run-1',
  version: 3,
  status: 'FROZEN',
  ownerId: 'admin-1',
  approverId: 'approver-1',
  workReport: { profile: 'execution_report', content: { title: 'Execution report' } },
  frozenSnapshot: { workReport: { profile: 'execution_report', content: { title: 'Execution report' } } },
};

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { id: 'admin-1', organizationId: 'org-1', role: 'admin' };
    (req as any).userRole = 'admin';
    next();
  });
  app.use(
    '/runtime-v1',
    createInitiativesExecutionRuntimeRouter({
      unitOfWork: {} as any,
      reader: {
        listReportRuns: vi.fn(async () => [run]),
        resolveProjectIdsForAggregate: vi.fn(async () => ['project-1']),
      } as any,
      authorize: vi.fn(async () => true),
      resolvePolicy: vi.fn(),
    })
  );
  return app;
}

const validCreate = {
  expectedVersion: 0,
  clientRequestId: 'create-1',
  definitionRef: { definitionId: 'definition-1', version: 1 },
  parentRunRef: null,
  audience: ['board@example.test'],
  scopeRefs: ['organization'],
  period: { start: '2026-09-01T00:00:00.000Z', end: '2026-09-07T23:59:59.000Z' },
  asOf: '2026-09-08T00:00:00.000Z',
  sources: [],
  ownerId: 'admin-1',
  approverId: 'approver-1',
  workReport: {
    profile: 'execution_report',
    title: 'Weekly execution report',
    templateId: 'weekly-exec',
    cadence: 'WEEKLY',
    projectIds: [],
    detailLevel: 'MANAGEMENT',
    snapshotId: '1f1da14f-616c-4ba8-bc7d-982e0496fd13',
  },
};

describe('ENABLE_EXECUTION_REPORT_E4 server gate', () => {
  it('defaults OFF and blocks profile create, transition, PDF and delivery', async () => {
    delete process.env.ENABLE_EXECUTION_REPORT_E4;
    const app = makeApp();
    const responses = await Promise.all([
      request(app).post('/runtime-v1/report-runs/new-run').send(validCreate),
      request(app).post('/runtime-v1/report-runs/run-1/transitions').send({
        expectedVersion: 3,
        clientRequestId: 'transition-1',
        profile: 'execution_report',
        action: 'FREEZE',
      }),
      request(app).get('/runtime-v1/execution-reports/run-1/pdf'),
      request(app).post('/runtime-v1/execution-reports/schedules').send({}),
      request(app).post('/runtime-v1/execution-reports/run-1/deliver').send({
        expectedVersion: 3,
        recipients: ['board@example.test'],
      }),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: { code: 'FEATURE_DISABLED' } });
    }
  });

  it('does not change the original initiative profile gate', async () => {
    process.env.ENABLE_EXECUTION_REPORT_E4 = 'true';
    delete process.env.ENABLE_INITIATIVES_WORK_REPORT;
    const response = await request(makeApp())
      .post('/runtime-v1/report-runs/new-run')
      .send({ ...validCreate, workReport: { ...validCreate.workReport, profile: 'initiative_work_report', templateId: 'EXECUTIVE_SUMMARY' } });
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'FEATURE_DISABLED' } });
  });
});
