import { createHash } from 'node:crypto';

import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';
import { publishedReportDefinitionVersion, type ReportDefinition } from './reportDefinition.js';
export interface ReportSource {
  sourceType: string;
  sourceId: string;
  version: number;
  capturedAt: string;
  freshness: 'CURRENT' | 'STALE' | 'UNKNOWN';
  formula: string | null;
  unit: string | null;
  currency: string | null;
  window: { start: string; end: string } | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  accessState: 'FULL' | 'REDACTED' | 'DENIED';
  redactions: string[];
}
export interface ReportRun {
  reportRunId: string;
  definitionRef: { definitionId: string; version: number };
  parentRunRef: { reportRunId: string; version: number } | null;
  status: 'DRAFT' | 'VALIDATED' | 'FROZEN' | 'APPROVED' | 'PUBLISHED' | 'FAILED' | 'SUPERSEDED';
  tenantId: string;
  audience: string[];
  scopeRefs: string[];
  period: { start: string; end: string };
  asOf: string;
  sources: ReportSource[];
  ownerId: string;
  approverId: string;
  validationFindings: string[];
  contentHash: string | null;
  frozenSnapshot: Record<string, unknown> | null;
  approval: { outcome: 'APPROVED' | 'RETURNED'; rationale: string; by: string; at: string } | null;
  exportPackage: { format: 'JSON'; contentHash: string; payload: Record<string, unknown> } | null;
  distributionReceipts: Array<{
    receiptId: string;
    audience: string;
    distributedAt: string;
    contentHash: string;
  }>;
  followUpTaskRef: { taskId: string; version: number; receiptClientRequestId: string } | null;
  createdAt: string;
  updatedAt: string;
}
function stable(v: any): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
      .join(',')}}`;
  return JSON.stringify(v);
}
export function reportContentHash(snapshot: Record<string, unknown>) {
  return createHash('sha256').update(stable(snapshot)).digest('hex');
}
type Draft = Pick<
  ReportRun,
  | 'definitionRef'
  | 'parentRunRef'
  | 'audience'
  | 'scopeRefs'
  | 'period'
  | 'asOf'
  | 'sources'
  | 'ownerId'
  | 'approverId'
>;
async function exactDefinition(
  tx: any,
  org: string,
  ref: { definitionId: string; version: number }
) {
  const d = await tx.getRelatedAggregateForUpdate(org, 'report_definition', ref.definitionId);
  const published = d
    ? publishedReportDefinitionVersion(d.payload as ReportDefinition, ref.version)
    : null;
  if (!d || !published)
    throw new MaterialCommandValidationError(
      'Exact tenant-scoped PUBLISHED report definition version required'
    );
  return { aggregateVersion: d.version, definition: published };
}
export async function createReportRun(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<Draft>
): Promise<MaterialCommandResult<ReportRun>> {
  if (envelope.aggregateType !== 'report_run' || envelope.commandType !== 'report-run.create')
    throw new MaterialCommandValidationError('Invalid report draft');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const p = envelope.payload;
    await exactDefinition(tx, envelope.organizationId, p.definitionRef);
    if (p.parentRunRef) {
      const parent = await tx.getRelatedAggregateForUpdate<ReportRun>(
        envelope.organizationId,
        'report_run',
        p.parentRunRef.reportRunId
      );
      if (
        !parent ||
        parent.version !== p.parentRunRef.version ||
        !['FROZEN', 'APPROVED', 'PUBLISHED'].includes(parent.payload.status)
      )
        throw new MaterialCommandValidationError('Refresh requires exact immutable parent run');
    }
    const now = new Date().toISOString(),
      run: ReportRun = {
        ...p,
        reportRunId: envelope.aggregateId,
        tenantId: envelope.organizationId,
        status: 'DRAFT',
        validationFindings: [],
        contentHash: null,
        frozenSnapshot: null,
        approval: null,
        exportPackage: null,
        distributionReceipts: [],
        followUpTaskRef: null,
        createdAt: now,
        updatedAt: now,
      };
    if (p.parentRunRef)
      await tx.claimRelation({
        organizationId: envelope.organizationId,
        relationType: `REPORT_REFRESH:${p.parentRunRef.reportRunId}`,
        sourceType: 'report_run',
        sourceId: p.parentRunRef.reportRunId,
        sourceVersion: p.parentRunRef.version,
        targetType: 'report_run',
        targetId: envelope.aggregateId,
        payload: {},
      });
    return {
      mutation: run,
      response: run,
      eventType: p.parentRunRef ? 'report-run.refreshed' : 'report-run.drafted',
      eventPayload: run,
      auditPayload: run,
    };
  });
}
type Action =
  | { action: 'VALIDATE' }
  | { action: 'FREEZE' }
  | { action: 'DECIDE'; outcome: 'APPROVED' | 'RETURNED'; rationale: string }
  | {
      action: 'PUBLISH';
      distribution: { receiptId: string; audience: string; distributedAt: string };
    }
  | { action: 'FAIL'; reason: string }
  | { action: 'SUPERSEDE' }
  | {
      action: 'LINK_FOLLOW_UP';
      taskReceiptClientRequestId: string;
      taskId: string;
      taskVersion: number;
    };

export function reportSourceValidationFindings(sources: ReportSource[]): string[] {
  const findings: string[] = [];
  if (sources.length === 0) findings.push('NO_SOURCES');
  if (sources.some((source) => source.freshness !== 'CURRENT'))
    findings.push('STALE_OR_UNKNOWN_SOURCE');
  if (sources.some((source) => source.accessState === 'DENIED'))
    findings.push('SOURCE_ACCESS_DENIED');
  if (
    sources.some(
      (source) => !source.version || !source.capturedAt || source.confidence === 'UNKNOWN'
    )
  )
    findings.push('SOURCE_EVIDENCE_INCOMPLETE');
  return findings;
}

export async function transitionReportRun(
  uow: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<Action>
): Promise<MaterialCommandResult<ReportRun>> {
  if (envelope.aggregateType !== 'report_run' || envelope.commandType !== 'report-run.transition')
    throw new MaterialCommandValidationError('Invalid report transition');
  return executeMaterialCommand(uow, envelope, async (tx) => {
    const r = await tx.getAggregatePayload<ReportRun>(
      envelope.organizationId,
      'report_run',
      envelope.aggregateId
    );
    if (!r) throw new MaterialCommandValidationError('Report run not found');
    const p = envelope.payload,
      now = new Date().toISOString();
    let next: ReportRun;
    if (p.action === 'VALIDATE') {
      if (r.status !== 'DRAFT' || envelope.actorId !== r.ownerId)
        throw new MaterialCommandValidationError('Owner validates DRAFT');
      await exactDefinition(tx, envelope.organizationId, r.definitionRef);
      const findings = reportSourceValidationFindings(r.sources);
      if (findings.length)
        throw new MaterialCommandValidationError(`Report validation failed: ${findings.join(',')}`);
      next = { ...r, status: 'VALIDATED', validationFindings: [], updatedAt: now };
    } else if (p.action === 'FREEZE') {
      if (r.status !== 'VALIDATED' || envelope.actorId !== r.ownerId)
        throw new MaterialCommandValidationError('Owner freezes VALIDATED report');
      const snapshot = {
        definitionRef: r.definitionRef,
        tenantId: r.tenantId,
        audience: r.audience,
        scopeRefs: r.scopeRefs,
        period: r.period,
        asOf: r.asOf,
        sources: r.sources,
      };
      const hash = reportContentHash(snapshot);
      next = {
        ...r,
        status: 'FROZEN',
        frozenSnapshot: snapshot,
        contentHash: hash,
        updatedAt: now,
      };
    } else if (p.action === 'DECIDE') {
      if (r.status !== 'FROZEN' || envelope.actorId !== r.approverId || r.approverId === r.ownerId)
        throw new MaterialCommandValidationError('Independent approval of FROZEN report required');
      next = {
        ...r,
        status: p.outcome === 'APPROVED' ? 'APPROVED' : 'DRAFT',
        approval: { outcome: p.outcome, rationale: p.rationale, by: envelope.actorId, at: now },
        contentHash: p.outcome === 'APPROVED' ? r.contentHash : null,
        frozenSnapshot: p.outcome === 'APPROVED' ? r.frozenSnapshot : null,
        updatedAt: now,
      };
    } else if (p.action === 'PUBLISH') {
      if (
        r.status !== 'APPROVED' ||
        envelope.actorId !== r.approverId ||
        !r.frozenSnapshot ||
        !r.contentHash
      )
        throw new MaterialCommandValidationError(
          'Authorized Report Approver and exact approved frozen snapshot required'
        );
      const hash = reportContentHash(r.frozenSnapshot);
      if (hash !== r.contentHash)
        throw new MaterialCommandValidationError('Frozen report hash mismatch');
      next = {
        ...r,
        status: 'PUBLISHED',
        exportPackage: { format: 'JSON', contentHash: hash, payload: r.frozenSnapshot },
        distributionReceipts: [...r.distributionReceipts, { ...p.distribution, contentHash: hash }],
        updatedAt: now,
      };
    } else if (p.action === 'LINK_FOLLOW_UP') {
      if (!['APPROVED', 'PUBLISHED'].includes(r.status))
        throw new MaterialCommandValidationError('Approved report required');
      const receipt = await tx.findReceipt<any>(
          envelope.organizationId,
          p.taskReceiptClientRequestId
        ),
        task = await tx.getRelatedAggregateForUpdate<any>(
          envelope.organizationId,
          'execution_task',
          p.taskId
        );
      if (
        !receipt ||
        receipt.aggregateType !== 'execution_task' ||
        receipt.aggregateId !== p.taskId ||
        receipt.aggregateVersion !== p.taskVersion ||
        !task ||
        task.version !== p.taskVersion
      )
        throw new MaterialCommandValidationError(
          'Canonical follow-up Task receipt/readback required'
        );
      await tx.claimRelation({
        organizationId: envelope.organizationId,
        relationType: `REPORT_FOLLOW_UP:${p.taskId}`,
        sourceType: 'report_run',
        sourceId: r.reportRunId,
        sourceVersion: envelope.expectedVersion,
        targetType: 'execution_task',
        targetId: p.taskId,
        payload: { receiptClientRequestId: p.taskReceiptClientRequestId },
      });
      next = {
        ...r,
        followUpTaskRef: {
          taskId: p.taskId,
          version: p.taskVersion,
          receiptClientRequestId: p.taskReceiptClientRequestId,
        },
        updatedAt: now,
      };
    } else if (p.action === 'FAIL')
      next = { ...r, status: 'FAILED', validationFindings: [p.reason], updatedAt: now };
    else next = { ...r, status: 'SUPERSEDED', updatedAt: now };
    return {
      mutation: next,
      response: next,
      eventType: `report-run.${p.action.toLowerCase()}`,
      eventPayload: next,
      auditPayload: next,
    };
  });
}
