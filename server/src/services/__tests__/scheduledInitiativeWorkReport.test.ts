/** @vitest-environment node */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  MaterialCommandTransaction,
  MaterialCommandUnitOfWork,
  StoredCommandReceipt,
} from '../../domain/initiatives-execution/materialCommand.js';
import { reportContentHash } from '../../domain/initiatives-execution/reportRun.js';
import {
  createInitiativesExecutionRuntimeRouter,
  deliverInitiativeWorkReport,
  runScheduledInitiativeWorkReport,
} from '../../routes/pmo/initiativesExecutionRuntime.routes.js';

interface StoredAggregate {
  version: number;
  payload: any;
}

function canonicalKey(org: string, type: string, id: string) {
  return `${org}:${type}:${id}`;
}

function createMemoryRuntime() {
  const aggregates = new Map<string, StoredAggregate>();
  const receipts = new Map<string, StoredCommandReceipt<any>>();
  const outbox: Array<{ eventType: string; payload: any }> = [];
  const definition = {
    definitionId: 'definition-1',
    tenantId: 'org-1',
    currentVersion: 3,
    versions: [
      {
        definitionVersion: 3,
        state: 'PUBLISHED',
        ownerId: 'owner-1',
        approverId: 'approver-1',
        name: 'Weekly decisions',
        purpose: 'Decision control',
        audience: ['board'],
        cadence: 'WEEKLY',
        scope: { type: 'organization', refs: [], projectIds: [], generalBacklogAllowed: true },
        outputSchema: {},
        sections: [{ sectionId: 'decisions', title: 'Decisions', mandatory: true }],
        sourceBindings: [
          {
            bindingId: 'initiatives',
            sourceType: 'initiative',
            required: true,
            scope: 'organization',
          },
        ],
        formulas: [],
        units: [],
        currencies: [],
        windows: [],
        access: { audienceRoles: ['admin'], classification: 'INTERNAL' },
        redaction: { rules: [], defaultState: 'FULL' },
        freshnessThresholdMinutes: 60,
        confidenceThreshold: 'HIGH',
        validationFindings: [],
        createdAt: '2026-09-14T08:00:00.000Z',
        updatedAt: '2026-09-14T08:00:00.000Z',
        publishedAt: '2026-09-14T08:00:00.000Z',
        publishedBy: 'approver-1',
      },
    ],
    createdAt: '2026-09-14T08:00:00.000Z',
    updatedAt: '2026-09-14T08:00:00.000Z',
  };
  aggregates.set(canonicalKey('org-1', 'report_definition', 'definition-1'), {
    version: 3,
    payload: definition,
  });

  const transaction: MaterialCommandTransaction = {
    findReceipt: async (org, requestId) => receipts.get(`${org}:${requestId}`) ?? null,
    getAggregateVersion: async (org, type, id) =>
      aggregates.get(canonicalKey(org, type, id))?.version ?? null,
    getAggregatePayload: async (org, type, id) =>
      aggregates.get(canonicalKey(org, type, id))?.payload ?? null,
    getRelatedAggregateForUpdate: async (org, type, id) =>
      aggregates.get(canonicalKey(org, type, id)) ?? null,
    persistAggregate: async (org, type, id, _from, to, mutation) => {
      aggregates.set(canonicalKey(org, type, id), { version: to, payload: mutation });
    },
    appendAudit: async () => undefined,
    appendOutbox: async (entry) => {
      outbox.push({ eventType: entry.eventType, payload: entry.payload });
    },
    saveReceipt: async (receipt) => {
      receipts.set(`${receipt.organizationId}:${receipt.clientRequestId}`, receipt);
    },
    claimRelation: async () => undefined,
  } as MaterialCommandTransaction;
  const unitOfWork: MaterialCommandUnitOfWork = {
    transaction: async (work) => work(transaction),
  };
  const reader = {
    findReportDefinition: async () => definition,
    buildInitiativeWorkReport: async () => ({
      content: {
        title: 'Weekly decisions',
        templateId: 'DECISION_BACKLOG',
        generatedAt: '2026-09-14T09:00:00.000Z',
        summary: {
          initiatives: 1,
          pendingDecisions: 2,
          overdueDecisions: 1,
          byStatus: { ACTIVE: 1 },
        },
        initiatives: [],
        decisionDebtors: [
          {
            authorityId: 'manager-1',
            authorityName: 'Manager One',
            pending: 2,
            overdue: 1,
            oldestDueAt: '2026-09-12T09:00:00.000Z',
          },
        ],
      },
      sources: [
        {
          sourceType: 'initiative',
          sourceId: 'initiative-1',
          version: 7,
          capturedAt: '2026-09-14T09:00:00.000Z',
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
    }),
    listReportRuns: async (org: string) =>
      [...aggregates.entries()]
        .filter(([key]) => key.startsWith(`${org}:report_run:`))
        .map(([key, value]) => ({
          version: value.version,
          reportRunId: key.slice(`${org}:report_run:`.length),
          ...value.payload,
        })),
  };
  return { unitOfWork, reader, outbox, aggregates };
}

const schedule = {
  id: 'schedule-1',
  organizationId: 'org-1',
  locale: 'en' as const,
  runtimeReport: {
    definitionId: 'definition-1',
    definitionVersion: 3,
    templateId: 'DECISION_BACKLOG',
    title: 'Weekly decisions',
    projectIds: [],
    ownerId: 'owner-1',
    approverId: 'approver-1',
    recipients: [' Board@example.test ', 'ops@example.test', 'board@example.test'],
    cadence: 'WEEKLY' as const,
  },
};

describe('scheduled initiative work report canonical lifecycle', () => {
  const savedFlag = process.env.ENABLE_INITIATIVES_WORK_REPORT;

  beforeEach(() => {
    process.env.ENABLE_INITIATIVES_WORK_REPORT = 'true';
  });

  afterEach(() => {
    if (savedFlag === undefined) delete process.env.ENABLE_INITIATIVES_WORK_REPORT;
    else process.env.ENABLE_INITIATIVES_WORK_REPORT = savedFlag;
  });

  it('defaults OFF and rejects the runner before it reads or writes report state', async () => {
    delete process.env.ENABLE_INITIATIVES_WORK_REPORT;
    const runtime = createMemoryRuntime();
    const reader = {
      ...runtime.reader,
      findReportDefinition: vi.fn(runtime.reader.findReportDefinition),
    };
    await expect(
      runScheduledInitiativeWorkReport(schedule, {
        unitOfWork: runtime.unitOfWork as any,
        reader: reader as any,
        sendEmail: vi.fn(),
      })
    ).rejects.toThrow('INITIATIVES_WORK_REPORT_DISABLED');
    expect(reader.findReportDefinition).not.toHaveBeenCalled();
    expect(await runtime.reader.listReportRuns('org-1')).toEqual([]);
  });

  it('persists CREATE→VALIDATE→FREEZE→APPROVE, retries a partial SMTP delivery, then PUBLISHes once', async () => {
    const runtime = createMemoryRuntime();
    const attempts = new Map<string, number>();
    const sent: Array<{ to: string; pdf: Buffer; text: string; html: string }> = [];
    const sendEmail = vi.fn(async (message: any) => {
      const to = String(message.to);
      const attempt = (attempts.get(to) ?? 0) + 1;
      attempts.set(to, attempt);
      sent.push({
        to,
        pdf: message.attachments[0].content,
        text: message.text,
        html: message.html,
      });
      return !(to === 'ops@example.test' && attempt === 1);
    });

    await expect(
      runScheduledInitiativeWorkReport(schedule, {
        unitOfWork: runtime.unitOfWork as any,
        reader: runtime.reader as any,
        sendEmail,
      })
    ).rejects.toThrow('INITIATIVE_WORK_REPORT_EMAIL_RETRY_REQUIRED');

    let dashboard = await runtime.reader.listReportRuns('org-1');
    expect(dashboard).toHaveLength(1);
    expect(dashboard[0]).toMatchObject({
      status: 'APPROVED',
      distributionReceipts: [],
      deliveryAttempts: [
        {
          audience: ['board@example.test', 'ops@example.test'],
          recipients: [
            { address: 'board@example.test', status: 'DELIVERED', attempts: 1 },
            { address: 'ops@example.test', status: 'FAILED', attempts: 1 },
          ],
        },
      ],
    });

    const reportRunId = await runScheduledInitiativeWorkReport(schedule, {
      unitOfWork: runtime.unitOfWork as any,
      reader: runtime.reader as any,
      sendEmail,
    });
    dashboard = await runtime.reader.listReportRuns('org-1');
    expect(dashboard[0]).toMatchObject({
      reportRunId,
      status: 'PUBLISHED',
      exportPackage: { format: 'JSON' },
    });
    expect(dashboard[0].distributionReceipts).toHaveLength(1);
    expect(attempts.get('board@example.test')).toBe(1);
    expect(attempts.get('ops@example.test')).toBe(2);
    expect(sent.every(({ pdf }) => pdf.subarray(0, 4).toString() === '%PDF')).toBe(true);
    expect(sent.every(({ text }) => text.startsWith('Consultify work report:'))).toBe(true);
    expect(sent.every(({ html }) => !/Raport z pracy/.test(html))).toBe(true);

    await expect(
      runScheduledInitiativeWorkReport(schedule, {
        unitOfWork: runtime.unitOfWork as any,
        reader: runtime.reader as any,
        sendEmail,
      })
    ).resolves.toBe(reportRunId);
    expect(sendEmail).toHaveBeenCalledTimes(3);
    expect(runtime.outbox.map((entry) => entry.eventType)).toEqual(
      expect.arrayContaining([
        'report-run.drafted',
        'report-run.validate',
        'report-run.freeze',
        'report-run.decide',
        'report-run.begin_delivery',
        'report-run.claim_recipient',
        'report-run.record_recipient',
        'report-run.publish',
      ])
    );
  });

  it('manual HTTP retry reuses the run receipt and never resends a successful recipient', async () => {
    const runtime = createMemoryRuntime();
    const content = {
      title: 'Manual report',
      templateId: 'EXECUTIVE_SUMMARY',
      generatedAt: '2026-09-14T09:00:00.000Z',
      projectIds: [],
      summary: { initiatives: 0, pendingDecisions: 0, overdueDecisions: 0, byStatus: {} },
      initiatives: [],
      decisionDebtors: [],
    };
    const frozenSnapshot = {
      definitionRef: { definitionId: 'definition-1', version: 3 },
      tenantId: 'org-1',
      audience: ['a@example.test', 'b@example.test'],
      scopeRefs: ['project:project-1'],
      period: { start: '2026-09-07T09:00:00.000Z', end: '2026-09-14T09:00:00.000Z' },
      asOf: content.generatedAt,
      workReport: {
        title: content.title,
        templateId: content.templateId,
        cadence: 'ON_DEMAND',
        content,
      },
      sources: [{ sourceType: 'initiative', sourceId: 'initiative-1', version: 1 }],
    };
    runtime.aggregates.set(canonicalKey('org-1', 'report_run', 'run-manual'), {
      version: 4,
      payload: {
        reportRunId: 'run-manual',
        status: 'APPROVED',
        approverId: 'approver-1',
        ownerId: 'owner-1',
        frozenSnapshot,
        contentHash: reportContentHash(frozenSnapshot),
        distributionReceipts: [],
        deliveryAttempts: [],
      },
    });
    const attempts = new Map<string, number>();
    const sendWorkReportEmail = vi.fn(async ({ to }: any) => {
      const count = (attempts.get(to) ?? 0) + 1;
      attempts.set(to, count);
      return !(to === 'b@example.test' && count === 1);
    });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = { id: 'approver-1', organizationId: 'org-1', role: 'admin' };
      (req as any).userRole = 'admin';
      next();
    });
    app.use(
      '/api/v8/pmo/initiatives-execution',
      createInitiativesExecutionRuntimeRouter({
        unitOfWork: runtime.unitOfWork as any,
        reader: {
          ...runtime.reader,
          resolveProjectIdsForAggregate: async () => ['project-1'],
        } as any,
        authorize: async () => true,
        resolvePolicy: vi.fn(),
        sendWorkReportEmail,
        renderWorkReportPdf: async () => Buffer.from('%PDF-manual'),
      })
    );

    const first = await request(app)
      .post('/api/v8/pmo/initiatives-execution/work-reports/run-manual/deliver')
      .send({
        expectedVersion: 4,
        clientRequestId: 'ui-click-1',
        recipients: [' A@example.test ', 'b@example.test', 'a@example.test'],
      });
    expect(first.status).toBe(502);
    expect(first.body).toMatchObject({
      delivered: ['a@example.test'],
      failed: ['b@example.test'],
      receiptId: 'manual-delivery-run-manual',
    });

    const second = await request(app)
      .post('/api/v8/pmo/initiatives-execution/work-reports/run-manual/deliver')
      .send({
        expectedVersion: 4,
        clientRequestId: 'ui-click-2',
        recipients: ['b@example.test', 'a@example.test'],
      });
    expect(second.status).toBe(200);
    expect(attempts.get('a@example.test')).toBe(1);
    expect(attempts.get('b@example.test')).toBe(2);
    const dashboard = await runtime.reader.listReportRuns('org-1');
    expect(dashboard[0]).toMatchObject({
      status: 'PUBLISHED',
      distributionReceipts: [{ receiptId: 'manual-delivery-run-manual' }],
    });
  });

  it('keeps an active SENDING lease fenced, then safely reclaims it after timeout', async () => {
    const runtime = createMemoryRuntime();
    const content = {
      title: 'Recovery report',
      templateId: 'EXECUTIVE_SUMMARY',
      generatedAt: '2026-09-14T09:00:00.000Z',
      projectIds: [],
      summary: { initiatives: 0, pendingDecisions: 0, overdueDecisions: 0, byStatus: {} },
      initiatives: [],
      decisionDebtors: [],
    };
    const frozenSnapshot = {
      definitionRef: { definitionId: 'definition-1', version: 3 },
      tenantId: 'org-1',
      audience: ['recovery@example.test'],
      scopeRefs: ['organization'],
      period: { start: '2026-09-07T09:00:00.000Z', end: '2026-09-14T09:00:00.000Z' },
      asOf: content.generatedAt,
      workReport: {
        title: content.title,
        templateId: content.templateId,
        cadence: 'ON_DEMAND',
        content,
      },
      sources: [{ sourceType: 'initiative', sourceId: 'initiative-1', version: 1 }],
    };
    runtime.aggregates.set(canonicalKey('org-1', 'report_run', 'run-recovery'), {
      version: 5,
      payload: {
        reportRunId: 'run-recovery',
        status: 'APPROVED',
        approverId: 'approver-1',
        ownerId: 'owner-1',
        frozenSnapshot,
        contentHash: reportContentHash(frozenSnapshot),
        distributionReceipts: [],
        deliveryAttempts: [
          {
            receiptId: 'manual-delivery-run-recovery',
            audience: ['recovery@example.test'],
            startedAt: '2026-09-14T09:00:00.000Z',
            recipients: [
              {
                address: 'recovery@example.test',
                status: 'SENDING',
                attempts: 1,
                lastAttemptAt: '2026-09-14T09:00:00.000Z',
                lastError: null,
                attemptToken: 'dead-process-fence',
                leaseExpiresAt: '2026-09-14T09:05:00.000Z',
              },
            ],
          },
        ],
      },
    });
    const sendEmail = vi.fn(async () => true);
    const baseInput = {
      organizationId: 'org-1',
      reportRunId: 'run-recovery',
      approverId: 'approver-1',
      expectedVersion: 5,
      receiptId: 'manual-delivery-run-recovery',
      recipients: ['recovery@example.test'],
    };

    const activeLease = await deliverInitiativeWorkReport(baseInput, {
      unitOfWork: runtime.unitOfWork as any,
      reader: runtime.reader as any,
      sendEmail,
      renderPdf: async () => Buffer.from('%PDF-recovery'),
      now: () => new Date('2026-09-14T09:04:00.000Z'),
    });
    expect(activeLease).toMatchObject({ published: false, status: 'DELIVERY_IN_PROGRESS' });
    expect(sendEmail).not.toHaveBeenCalled();

    const recovered = await deliverInitiativeWorkReport(baseInput, {
      unitOfWork: runtime.unitOfWork as any,
      reader: runtime.reader as any,
      sendEmail,
      renderPdf: async () => Buffer.from('%PDF-recovery'),
      now: () => new Date('2026-09-14T09:06:00.000Z'),
    });
    expect(recovered).toMatchObject({ published: true, status: 'PUBLISHED' });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const dashboard = await runtime.reader.listReportRuns('org-1');
    expect(dashboard[0].deliveryAttempts[0].recipients[0]).toMatchObject({
      status: 'DELIVERED',
      attempts: 2,
      attemptToken: null,
      leaseExpiresAt: null,
    });
  });
});
