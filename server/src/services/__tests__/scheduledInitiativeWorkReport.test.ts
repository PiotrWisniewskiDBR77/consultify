/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';

import type {
  MaterialCommandTransaction,
  MaterialCommandUnitOfWork,
  StoredCommandReceipt,
} from '../../domain/initiatives-execution/materialCommand.js';
import { runScheduledInitiativeWorkReport } from '../../routes/pmo/initiativesExecutionRuntime.routes.js';

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
  return { unitOfWork, reader, outbox };
}

const schedule = {
  id: 'schedule-1',
  organizationId: 'org-1',
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
  it('persists CREATE→VALIDATE→FREEZE→APPROVE, retries a partial SMTP delivery, then PUBLISHes once', async () => {
    const runtime = createMemoryRuntime();
    const attempts = new Map<string, number>();
    const sent: Array<{ to: string; pdf: Buffer }> = [];
    const sendEmail = vi.fn(async (message: any) => {
      const to = String(message.to);
      const attempt = (attempts.get(to) ?? 0) + 1;
      attempts.set(to, attempt);
      sent.push({ to, pdf: message.attachments[0].content });
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
});
