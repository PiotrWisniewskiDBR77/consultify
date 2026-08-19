import { createHash, randomUUID } from 'node:crypto';

import { withPgTransaction } from '../../utils/queryHelpers.js';

export type FlowSourceKind = 'organization' | 'interview' | 'drd' | 'swot';

export class FlowTransformLineageError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'FlowTransformLineageError';
  }
}

type SourceReceipt = {
  receiptId: string;
  sourceVersion: string;
  sourceContentHash: string;
  candidateId: string;
};

type FlowReceiptRow = {
  receipt_id: string;
  organization_id: string;
  source_kind: FlowSourceKind;
  source_receipt_id: string;
  source_version: string;
  source_content_hash: string;
  candidate_id: string;
  initiative_id: string;
  execution_link_id: string;
  results_case_id: string;
  results_actual_snapshot_id: string;
  finance_reconciliation_id: string;
  finance_decision_id: string;
  pir_id: string;
  correlation_id: string;
  identity_digest: string;
  certified_by: string;
  certified_at: string | Date;
};

function map(row: FlowReceiptRow) {
  return {
    receiptId: row.receipt_id,
    organizationId: row.organization_id,
    sourceKind: row.source_kind,
    sourceReceiptId: row.source_receipt_id,
    sourceVersion: row.source_version,
    sourceContentHash: row.source_content_hash,
    candidateId: row.candidate_id,
    initiativeId: row.initiative_id,
    executionLinkId: row.execution_link_id,
    resultsCaseId: row.results_case_id,
    resultsActualSnapshotId: row.results_actual_snapshot_id,
    financeReconciliationId: row.finance_reconciliation_id,
    financeDecisionId: row.finance_decision_id,
    pirId: row.pir_id,
    correlationId: row.correlation_id,
    identityDigest: row.identity_digest,
    certifiedBy: row.certified_by,
    certifiedAt: new Date(row.certified_at).toISOString(),
  };
}

async function loadSourceReceipt(
  query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>,
  organizationId: string,
  sourceKind: FlowSourceKind,
  sourceReceiptId: string
): Promise<SourceReceipt> {
  if (sourceKind === 'organization') {
    const row = (
      await query<{
        id: string;
        snapshot_id: string;
        snapshot_version: number;
        snapshot_content_hash: string;
        candidate_id: string;
      }>(
        `SELECT id, snapshot_id, snapshot_version, snapshot_content_hash, candidate_id
       FROM organization_snapshot_candidate_handoffs WHERE organization_id=? AND id=?`,
        [organizationId, sourceReceiptId]
      )
    ).rows[0];
    if (row)
      return {
        receiptId: row.id,
        sourceVersion: `${row.snapshot_id}:${row.snapshot_version}`,
        sourceContentHash: row.snapshot_content_hash,
        candidateId: row.candidate_id,
      };
  } else if (sourceKind === 'interview') {
    const row = (
      await query<{
        id: string;
        source_version: string | null;
        snapshot_content_hash: string | null;
        candidate_id: string;
      }>(
        `SELECT id, source_version, snapshot_content_hash, candidate_id
       FROM interview_candidate_handoffs WHERE organization_id=? AND id=?`,
        [organizationId, sourceReceiptId]
      )
    ).rows[0];
    if (row) {
      if (!row.source_version || !row.snapshot_content_hash)
        throw new FlowTransformLineageError(
          'SOURCE_LINEAGE_UNRESOLVED',
          409,
          'Interview receipt predates immutable source lineage'
        );
      return {
        receiptId: row.id,
        sourceVersion: row.source_version,
        sourceContentHash: row.snapshot_content_hash,
        candidateId: row.candidate_id,
      };
    }
  } else if (sourceKind === 'drd') {
    const row = (
      await query<{
        id: string;
        source_version: string | null;
        snapshot_content_hash: string | null;
        candidate_id: string;
      }>(
        `SELECT id, source_version, snapshot_content_hash, candidate_id
       FROM assessment_candidate_handoffs WHERE organization_id=? AND id=?`,
        [organizationId, sourceReceiptId]
      )
    ).rows[0];
    if (row) {
      if (!row.source_version || !row.snapshot_content_hash)
        throw new FlowTransformLineageError(
          'SOURCE_LINEAGE_UNRESOLVED',
          409,
          'DRD receipt predates immutable source lineage'
        );
      return {
        receiptId: row.id,
        sourceVersion: row.source_version,
        sourceContentHash: row.snapshot_content_hash,
        candidateId: row.candidate_id,
      };
    }
  } else {
    const row = (
      await query<{
        id: string;
        tool_output_id: string | null;
        tool_output_version: number | null;
        tool_output_content_hash: string | null;
        source_revision: number | null;
        candidate_id: string;
      }>(
        `SELECT id, tool_output_id, tool_output_version, tool_output_content_hash, source_revision, candidate_id
       FROM swot_candidate_handoffs WHERE organization_id=? AND id=?`,
        [organizationId, sourceReceiptId]
      )
    ).rows[0];
    if (row) {
      if (
        !row.tool_output_id ||
        row.tool_output_version == null ||
        !row.tool_output_content_hash ||
        row.source_revision == null
      )
        throw new FlowTransformLineageError(
          'SOURCE_LINEAGE_UNRESOLVED',
          409,
          'SWOT receipt predates immutable source lineage'
        );
      return {
        receiptId: row.id,
        sourceVersion: `${row.tool_output_id}:${row.tool_output_version}:${row.source_revision}`,
        sourceContentHash: row.tool_output_content_hash,
        candidateId: row.candidate_id,
      };
    }
  }
  throw new FlowTransformLineageError('SOURCE_RECEIPT_NOT_FOUND', 404, 'Source receipt not found');
}

export async function certifyFlowTransformLineage(input: {
  organizationId: string;
  sourceKind: FlowSourceKind;
  sourceReceiptId: string;
  actorId: string;
  correlationId?: string;
}) {
  return withPgTransaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext(?), hashtext(?))', [
      input.organizationId,
      `flow:${input.sourceKind}:${input.sourceReceiptId}`,
    ]);
    const source = await loadSourceReceipt(
      tx.query.bind(tx),
      input.organizationId,
      input.sourceKind,
      input.sourceReceiptId
    );
    const candidate = (
      await tx.query<{ id: string; status: string; initiative_id: string | null }>(
        `SELECT id,status,initiative_id FROM initiative_candidates WHERE organization_id=? AND id=?`,
        [input.organizationId, source.candidateId]
      )
    ).rows[0];
    if (!candidate || candidate.status !== 'accepted' || !candidate.initiative_id)
      throw new FlowTransformLineageError(
        'CANDIDATE_NOT_ACCEPTED',
        409,
        'Candidate has no durable accepted Initiative identity'
      );

    const execution = (
      await tx.query<{ link_id: string; initiative_id: string }>(
        `SELECT link_id, initiative_id FROM execution_case_links WHERE organization_id=? AND initiative_id=?`,
        [input.organizationId, candidate.initiative_id]
      )
    ).rows[0];
    if (!execution)
      throw new FlowTransformLineageError(
        'EXECUTION_IDENTITY_MISSING',
        409,
        'Initiative has no canonical Execution identity'
      );

    const results = (
      await tx.query<{ case_id: string; current_actual_snapshot_id: string | null }>(
        `SELECT case_id,current_actual_snapshot_id FROM rvn_roi_cases
       WHERE organization_id=? AND initiative_id=? AND status NOT IN ('cancelled')
       ORDER BY created_at DESC LIMIT 1`,
        [input.organizationId, candidate.initiative_id]
      )
    ).rows[0];
    if (!results?.current_actual_snapshot_id)
      throw new FlowTransformLineageError(
        'RESULTS_ACTUAL_MISSING',
        409,
        'Execution has no immutable Results Actual snapshot'
      );
    const actual = (
      await tx.query<{ actual_snapshot_id: string }>(
        `SELECT actual_snapshot_id FROM rvn_roi_actual_snapshots
       WHERE organization_id=? AND case_id=? AND actual_snapshot_id=?`,
        [input.organizationId, results.case_id, results.current_actual_snapshot_id]
      )
    ).rows[0];
    if (!actual)
      throw new FlowTransformLineageError(
        'RESULTS_ACTUAL_POINTER_INVALID',
        409,
        'Results Actual pointer is not tenant-valid'
      );

    const reconciliation = (
      await tx.query<{
        reconciliation_id: string;
        opened_by: string;
        terminal_decision_id: string | null;
        status: string;
      }>(
        `SELECT reconciliation_id,opened_by,terminal_decision_id,status
       FROM rvn_roi_finance_reconciliations
       WHERE organization_id=? AND case_id=? AND results_actual_snapshot_id=?
         AND status IN ('resolved','accepted_divergence')
       ORDER BY opened_at DESC LIMIT 1`,
        [input.organizationId, results.case_id, actual.actual_snapshot_id]
      )
    ).rows[0];
    if (!reconciliation?.terminal_decision_id)
      throw new FlowTransformLineageError(
        'FINANCE_RECONCILIATION_MISSING',
        409,
        'Results Actual has no terminal governed Finance reconciliation'
      );
    const decision = (
      await tx.query<{ decision_id: string; decided_by: string }>(
        `SELECT decision_id,decided_by FROM rvn_finance_reconciliation_decisions
       WHERE organization_id=? AND reconciliation_id=? AND decision_id=?`,
        [
          input.organizationId,
          reconciliation.reconciliation_id,
          reconciliation.terminal_decision_id,
        ]
      )
    ).rows[0];
    if (!decision)
      throw new FlowTransformLineageError(
        'FINANCE_DECISION_MISSING',
        409,
        'Terminal Finance decision pointer is invalid'
      );
    if (decision.decided_by === reconciliation.opened_by)
      throw new FlowTransformLineageError(
        'FINANCE_SOD_VIOLATION',
        409,
        'Finance reconciliation maker cannot be its checker'
      );

    const pir = (
      await tx.query<{ pir_id: string; review_snapshot_payload: unknown }>(
        `SELECT pir_id,review_snapshot_payload FROM rvn_roi_post_investment_reviews
       WHERE organization_id=? AND case_id=? AND status='finalized'
       ORDER BY sequence_number DESC LIMIT 1`,
        [input.organizationId, results.case_id]
      )
    ).rows[0];
    if (!pir)
      throw new FlowTransformLineageError(
        'PIR_MISSING',
        409,
        'No finalized PIR exists for the Results case'
      );
    const payload =
      typeof pir.review_snapshot_payload === 'string'
        ? JSON.parse(pir.review_snapshot_payload)
        : (pir.review_snapshot_payload as Record<string, unknown> | null);
    if (!payload || payload.currentActualSnapshotId !== actual.actual_snapshot_id)
      throw new FlowTransformLineageError(
        'PIR_ACTUAL_MISMATCH',
        409,
        'PIR is not frozen against the exact Results Actual snapshot'
      );

    const identities = {
      sourceKind: input.sourceKind,
      sourceReceiptId: source.receiptId,
      sourceVersion: source.sourceVersion,
      sourceContentHash: source.sourceContentHash,
      candidateId: candidate.id,
      initiativeId: candidate.initiative_id,
      executionLinkId: execution.link_id,
      resultsCaseId: results.case_id,
      resultsActualSnapshotId: actual.actual_snapshot_id,
      financeReconciliationId: reconciliation.reconciliation_id,
      financeDecisionId: decision.decision_id,
      pirId: pir.pir_id,
    };
    const identityDigest = createHash('sha256').update(JSON.stringify(identities)).digest('hex');
    const existing = (
      await tx.query<FlowReceiptRow>(
        `SELECT * FROM flow_transform_lineage_receipts WHERE organization_id=? AND source_kind=? AND source_receipt_id=?`,
        [input.organizationId, input.sourceKind, source.receiptId]
      )
    ).rows[0];
    if (existing) {
      if (existing.identity_digest !== identityDigest)
        throw new FlowTransformLineageError(
          'FLOW_LINEAGE_COLLISION',
          409,
          'Existing correlation receipt pins different downstream identities'
        );
      return { created: false, receipt: map(existing) };
    }
    const correlationId = input.correlationId || randomUUID();
    const inserted = (
      await tx.query<FlowReceiptRow>(
        `INSERT INTO flow_transform_lineage_receipts
       (organization_id,source_kind,source_receipt_id,source_version,source_content_hash,candidate_id,initiative_id,
        execution_link_id,results_case_id,results_actual_snapshot_id,finance_reconciliation_id,finance_decision_id,pir_id,
        correlation_id,identity_digest,certified_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *`,
        [
          input.organizationId,
          input.sourceKind,
          source.receiptId,
          source.sourceVersion,
          source.sourceContentHash,
          candidate.id,
          candidate.initiative_id,
          execution.link_id,
          results.case_id,
          actual.actual_snapshot_id,
          reconciliation.reconciliation_id,
          decision.decision_id,
          pir.pir_id,
          correlationId,
          identityDigest,
          input.actorId,
        ]
      )
    ).rows[0];
    if (!inserted)
      throw new FlowTransformLineageError(
        'FLOW_RECEIPT_READBACK_FAILED',
        500,
        'Correlation receipt readback failed'
      );
    return { created: true, receipt: map(inserted) };
  });
}
