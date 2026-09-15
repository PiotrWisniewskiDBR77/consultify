/** @vitest-environment node */
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  MaterialCommandTransaction,
  StoredCommandReceipt,
} from '../../../domain/initiatives-execution/materialCommand.js';
import { createInitiativesExecutionRuntimeRouter } from '../initiativesExecutionRuntime.routes.js';

const savedFlag = process.env.ENABLE_INITIATIVES_WORK_REPORT;
afterEach(() => {
  if (savedFlag === undefined) delete process.env.ENABLE_INITIATIVES_WORK_REPORT;
  else process.env.ENABLE_INITIATIVES_WORK_REPORT = savedFlag;
});

function createRuntime(deliveryAccepted = true) {
  const aggregates = new Map<string, { version: number; payload: any }>();
  const receipts = new Map<string, StoredCommandReceipt<any>>();
  const transaction: MaterialCommandTransaction = {
    findReceipt: async (org, requestId) => receipts.get(`${org}:${requestId}`) ?? null,
    getAggregateVersion: async (org, type, id) =>
      aggregates.get(`${org}:${type}:${id}`)?.version ?? null,
    getAggregatePayload: async (org, type, id) =>
      aggregates.get(`${org}:${type}:${id}`)?.payload ?? null,
    getRelatedAggregateForUpdate: async (org, type, id) =>
      aggregates.get(`${org}:${type}:${id}`) ?? null,
    persistAggregate: async (org, type, id, _from, to, payload) => {
      aggregates.set(`${org}:${type}:${id}`, { version: to, payload });
    },
    appendAudit: async () => undefined,
    appendOutbox: async () => undefined,
    saveReceipt: async (receipt) => {
      receipts.set(`${receipt.organizationId}:${receipt.clientRequestId}`, receipt);
    },
    claimRelation: async () => undefined,
  } as MaterialCommandTransaction;
  const unitOfWork = { transaction: vi.fn(async (work: any) => work(transaction)) };
  const definition = {
    definitionId: 'definition-1',
    currentVersion: 1,
    versions: [
      { definitionVersion: 1, state: 'PUBLISHED', ownerId: 'owner-1', approverId: 'approver-1' },
    ],
  };
  aggregates.set('org-1:report_definition:definition-1', { version: 1, payload: definition });
  const reader = {
    findReportDefinition: vi.fn(async () => definition),
    buildInitiativeWorkReport: vi.fn(async () => ({
      content: {
        title: 'Initiative work report',
        templateId: 'EXECUTIVE_SUMMARY',
        generatedAt: '2026-09-14T09:00:00.000Z',
        summary: { initiatives: 0, pendingDecisions: 0, overdueDecisions: 0, byStatus: {} },
        initiatives: [],
        decisionDebtors: [],
      },
      sources: [source],
    })),
    listReportRuns: vi.fn(async () =>
      [...aggregates.entries()]
        .filter(([key]) => key.startsWith('org-1:report_run:'))
        .map(([key, value]) => ({
          reportRunId: key.slice('org-1:report_run:'.length),
          version: value.version,
          ...value.payload,
        }))
    ),
    resolveProjectIdsForAggregate: vi.fn(async () => ['project-x']),
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const actorId = String(req.header('x-test-actor') || 'owner-1');
    (req as any).user = { id: actorId, organizationId: 'org-1', role: 'admin' };
    (req as any).userRole = 'admin';
    next();
  });
  app.use(
    '/api/v8/pmo/initiatives-execution',
    createInitiativesExecutionRuntimeRouter({
      unitOfWork: unitOfWork as any,
      reader: reader as any,
      authorize: vi.fn(async () => true),
      resolvePolicy: vi.fn(),
      sendWorkReportEmail: vi.fn(async () => deliveryAccepted),
      renderWorkReportPdf: vi.fn(async () => Buffer.from('M5 report')),
    })
  );
  return { app, reader, unitOfWork };
}

const source = {
  sourceType: 'initiative',
  sourceId: 'initiative-1',
  version: 1,
  capturedAt: '2026-09-14T09:00:00.000Z',
  freshness: 'CURRENT',
  formula: null,
  unit: null,
  currency: null,
  window: null,
  confidence: 'HIGH',
  accessState: 'FULL',
  redactions: [],
};

const baseDraft = {
  expectedVersion: 0,
  definitionRef: { definitionId: 'definition-1', version: 1 },
  parentRunRef: null,
  audience: ['board@example.test'],
  scopeRefs: ['organization'],
  period: { start: '2026-09-07T09:00:00.000Z', end: '2026-09-14T09:00:00.000Z' },
  asOf: '2026-09-14T09:00:00.000Z',
  ownerId: 'owner-1',
  approverId: 'approver-1',
};

const postRun = (app: express.Express, id: string, body: object) =>
  request(app).post(`/api/v8/pmo/initiatives-execution/report-runs/${id}`).send(body);
const transitionRun = (app: express.Express, id: string, body: object) =>
  request(app)
    .post(`/api/v8/pmo/initiatives-execution/report-runs/${id}/transitions`)
    .send(body);

describe('shared report-run route respects the Work report server flag', () => {
  it('OFF rejects a Work report create and a profiled transition before every reader/UoW call', async () => {
    delete process.env.ENABLE_INITIATIVES_WORK_REPORT;
    const runtime = createRuntime();
    const createResponse = await postRun(runtime.app, 'work-off', {
      ...baseDraft,
      clientRequestId: 'work-off-create',
      workReport: {
        title: 'Initiative work report',
        templateId: 'EXECUTIVE_SUMMARY',
        cadence: 'ON_DEMAND',
        projectIds: [],
      },
      sources: [],
    });
    expect(createResponse.status).toBe(404);
    expect(createResponse.body).toEqual({ error: { code: 'FEATURE_DISABLED' } });
    expect(runtime.reader.findReportDefinition).not.toHaveBeenCalled();
    expect(runtime.reader.buildInitiativeWorkReport).not.toHaveBeenCalled();
    expect(runtime.unitOfWork.transaction).not.toHaveBeenCalled();

    const transitionResponse = await transitionRun(runtime.app, 'work-off', {
      action: 'VALIDATE',
      profile: 'initiative_work_report',
      expectedVersion: 1,
      clientRequestId: 'work-off-validate',
    });
    expect(transitionResponse.status).toBe(404);
    expect(runtime.reader.listReportRuns).not.toHaveBeenCalled();
    expect(runtime.unitOfWork.transaction).not.toHaveBeenCalled();
  });

  it('ON creates and advances a Work report through the shared route', async () => {
    process.env.ENABLE_INITIATIVES_WORK_REPORT = 'true';
    const runtime = createRuntime();
    const created = await postRun(runtime.app, 'work-on', {
      ...baseDraft,
      clientRequestId: 'work-on-create',
      workReport: {
        title: 'Initiative work report',
        templateId: 'EXECUTIVE_SUMMARY',
        cadence: 'ON_DEMAND',
        projectIds: [],
      },
      sources: [],
    });
    expect(created.status).toBe(201);
    expect(runtime.reader.buildInitiativeWorkReport).toHaveBeenCalledTimes(1);
    const transitioned = await transitionRun(runtime.app, 'work-on', {
      action: 'VALIDATE',
      profile: 'initiative_work_report',
      expectedVersion: 1,
      clientRequestId: 'work-on-validate',
    });
    expect(transitioned.status).toBe(200);
    expect(transitioned.body.response.status).toBe('VALIDATED');
  });

  it('OFF preserves ordinary canonical report-run create and transition', async () => {
    delete process.env.ENABLE_INITIATIVES_WORK_REPORT;
    const runtime = createRuntime();
    const created = await postRun(runtime.app, 'canonical-off', {
      ...baseDraft,
      clientRequestId: 'canonical-off-create',
      workReport: null,
      sources: [source],
    });
    expect(created.status).toBe(201);
    expect(runtime.reader.buildInitiativeWorkReport).not.toHaveBeenCalled();
    const transitioned = await transitionRun(runtime.app, 'canonical-off', {
      action: 'VALIDATE',
      expectedVersion: 1,
      clientRequestId: 'canonical-off-validate',
    });
    expect(transitioned.status).toBe(200);
    expect(transitioned.body.response.status).toBe('VALIDATED');
  });

  it('OFF blocks an existing Work report run even when a caller omits the profile hint', async () => {
    process.env.ENABLE_INITIATIVES_WORK_REPORT = 'true';
    const runtime = createRuntime();
    await postRun(runtime.app, 'work-hidden', {
      ...baseDraft,
      clientRequestId: 'work-hidden-create',
      workReport: {
        title: 'Initiative work report',
        templateId: 'EXECUTIVE_SUMMARY',
        cadence: 'ON_DEMAND',
        projectIds: [],
      },
      sources: [],
    });
    const writesBefore = runtime.unitOfWork.transaction.mock.calls.length;
    process.env.ENABLE_INITIATIVES_WORK_REPORT = 'false';
    const response = await transitionRun(runtime.app, 'work-hidden', {
      action: 'VALIDATE',
      expectedVersion: 1,
      clientRequestId: 'work-hidden-validate',
    });
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'FEATURE_DISABLED' } });
    expect(runtime.unitOfWork.transaction).toHaveBeenCalledTimes(writesBefore);
  });

  it('forbids direct PUBLISH and publishes only after the delivery endpoint succeeds', async () => {
    process.env.ENABLE_INITIATIVES_WORK_REPORT = 'true';
    const runtime = createRuntime(true);
    await postRun(runtime.app, 'delivery-success', {
      ...baseDraft,
      clientRequestId: 'delivery-success-create',
      workReport: {
        title: 'Initiative work report',
        templateId: 'EXECUTIVE_SUMMARY',
        cadence: 'ON_DEMAND',
        projectIds: [],
      },
      sources: [],
    });
    for (const [action, expectedVersion] of [
      ['VALIDATE', 1],
      ['FREEZE', 2],
    ] as const) {
      const response = await transitionRun(runtime.app, 'delivery-success', {
        action,
        expectedVersion,
        clientRequestId: `delivery-success-${action.toLowerCase()}`,
      });
      expect(response.status).toBe(200);
    }
    const approved = await request(runtime.app)
      .post('/api/v8/pmo/initiatives-execution/report-runs/delivery-success/transitions')
      .set('x-test-actor', 'approver-1')
      .send({
        action: 'DECIDE',
        outcome: 'APPROVED',
        rationale: 'M5 delivery proof',
        expectedVersion: 3,
        clientRequestId: 'delivery-success-approve',
      });
    expect(approved.status).toBe(200);

    const directPublish = await request(runtime.app)
      .post('/api/v8/pmo/initiatives-execution/report-runs/delivery-success/transitions')
      .set('x-test-actor', 'approver-1')
      .send({
        action: 'PUBLISH',
        expectedVersion: 4,
        clientRequestId: 'delivery-success-direct-publish',
        distribution: {
          receiptId: 'forbidden-direct',
          audience: 'board@example.test',
          distributedAt: '2026-09-15T15:00:00.000Z',
        },
      });
    expect(directPublish.status).toBe(403);
    expect(directPublish.body).toEqual({ error: { code: 'REPORT_RUN_ACTOR_FORBIDDEN' } });

    const delivered = await request(runtime.app)
      .post('/api/v8/pmo/initiatives-execution/work-reports/delivery-success/deliver')
      .set('x-test-actor', 'approver-1')
      .send({
        expectedVersion: 4,
        clientRequestId: 'delivery-success-send',
        recipients: ['board@example.test'],
      });
    expect(delivered.status).toBe(200);
    expect(delivered.body).toMatchObject({
      published: true,
      status: 'PUBLISHED',
      delivered: ['board@example.test'],
      failed: [],
      pending: [],
    });
  });

  it('returns a governed 502 and keeps the report unpublished when email delivery fails', async () => {
    process.env.ENABLE_INITIATIVES_WORK_REPORT = 'true';
    const runtime = createRuntime(false);
    await postRun(runtime.app, 'delivery-failure', {
      ...baseDraft,
      clientRequestId: 'delivery-failure-create',
      workReport: {
        title: 'Initiative work report',
        templateId: 'EXECUTIVE_SUMMARY',
        cadence: 'ON_DEMAND',
        projectIds: [],
      },
      sources: [],
    });
    for (const [action, expectedVersion] of [
      ['VALIDATE', 1],
      ['FREEZE', 2],
    ] as const) {
      await transitionRun(runtime.app, 'delivery-failure', {
        action,
        expectedVersion,
        clientRequestId: `delivery-failure-${action.toLowerCase()}`,
      });
    }
    await request(runtime.app)
      .post('/api/v8/pmo/initiatives-execution/report-runs/delivery-failure/transitions')
      .set('x-test-actor', 'approver-1')
      .send({
        action: 'DECIDE',
        outcome: 'APPROVED',
        rationale: 'M5 failed delivery proof',
        expectedVersion: 3,
        clientRequestId: 'delivery-failure-approve',
      });

    const failed = await request(runtime.app)
      .post('/api/v8/pmo/initiatives-execution/work-reports/delivery-failure/deliver')
      .set('x-test-actor', 'approver-1')
      .send({
        expectedVersion: 4,
        clientRequestId: 'delivery-failure-send',
        recipients: ['board@example.test'],
      });
    expect(failed.status).toBe(502);
    expect(failed.body).toMatchObject({
      error: { code: 'EMAIL_DELIVERY_FAILED' },
      failed: ['board@example.test'],
      pending: [],
      delivered: [],
      receiptId: 'manual-delivery-delivery-failure',
    });
    const run = (await runtime.reader.listReportRuns()).find(
      (item: any) => item.reportRunId === 'delivery-failure'
    );
    expect(run?.status).toBe('APPROVED');
  });
});
