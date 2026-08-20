import { canonicalPayloadHash } from './contentHash.js';
import { withPgTransaction } from '../../../utils/queryHelpers.js';
import { hasFinanceEditRole } from '../../legacyCutover/requireActiveMembership.js';
import { evaluateStatementReadiness, validateStatement } from '../../financialStatementService.js';
import { StatementGovernanceError } from './statementSourceReceiptService.js';

export interface RecordManualMappingDecisionInput {
  organizationId: string;
  statementId: string;
  candidateRowId: string;
  canonicalLineId?: string | null;
  action: 'ACCEPT' | 'REJECT' | 'EXCLUDE';
  reason: string;
  sourceReceiptId: string;
  expectedValuesVersion: number;
  idempotencyKey: string;
  userId: string;
}

async function refreshReadinessFromDurableDecisions(
  tx: import('../../../utils/queryHelpers.js').PgTransactionClient,
  organizationId: string,
  statementId: string,
  valuesVersion: number
) {
  const statement = (
    await tx.query<any>(
      `SELECT status,statement_type,currency,scaling FROM financial_statements
        WHERE id=? AND organization_id=? FOR UPDATE`,
      [statementId, organizationId]
    )
  ).rows[0];
  const values = (
    await tx.query<any>(
      `SELECT canonical_line_id AS "canonicalLineId",value,original_label AS "originalLabel",
              mapping_status AS "mappingStatus",is_non_financial AS "isNonFinancial",
              source_candidate_row_id,evidence_json
         FROM financial_statement_values WHERE statement_id=?`,
      [statementId]
    )
  ).rows.map((value: any) => {
    let evidence: any = {};
    try {
      evidence =
        typeof value.evidence_json === 'string'
          ? JSON.parse(value.evidence_json)
          : value.evidence_json || {};
    } catch {
      evidence = {};
    }
    return { ...value, periodLabel: evidence.periodLabel || null };
  });
  const missing = (
    await tx.query<{ count: number }>(
      `SELECT count(*)::int AS count
         FROM financial_statement_values value
        WHERE value.statement_id=?
          AND lower(coalesce(value.mapping_status,''))='manual'
          AND NOT EXISTS (
            SELECT 1
              FROM finance_statement_manual_mapping_decisions decision
             WHERE decision.organization_id=?
               AND decision.statement_id=value.statement_id
               AND decision.candidate_row_id=value.source_candidate_row_id
               AND decision.action='ACCEPT'
               AND decision.canonical_line_id=value.canonical_line_id
               AND decision.statement_values_version=?
               AND decision.source_receipt_id=(
                 SELECT receipt.receipt_id
                   FROM finance_statement_source_receipts receipt
                  WHERE receipt.organization_id=?
                    AND receipt.statement_id=value.statement_id
                  ORDER BY receipt.imported_at DESC,receipt.receipt_id DESC LIMIT 1
               )
               AND decision.decision_id=(
                 SELECT latest.decision_id
                   FROM finance_statement_manual_mapping_decisions latest
                  WHERE latest.organization_id=decision.organization_id
                    AND latest.statement_id=decision.statement_id
                    AND latest.candidate_row_id=decision.candidate_row_id
                  ORDER BY latest.decided_at DESC,latest.decision_id DESC LIMIT 1
               )
          )`,
      [statementId, organizationId, valuesVersion, organizationId]
    )
  ).rows[0]?.count;
  const base = validateStatement(values, statement.statement_type);
  const validation = Number(missing || 0)
    ? {
        status: 'needs_review' as const,
        messages: [
          ...base.messages,
          {
            type: 'error' as const,
            code: 'MANUAL_MAPPING_NOT_VERIFIED',
            message: `${Number(missing)} manual mapping(s) require an append-only verification decision.`,
          },
        ],
      }
    : base;
  const readiness = evaluateStatementReadiness({
    rawStatus: statement.status,
    statementType: statement.statement_type,
    validationStatus: validation.status,
    currency: statement.currency,
    scaling: statement.scaling,
    validationMessages: validation.messages,
    values,
  });
  await tx.query(
    `UPDATE financial_statements
        SET validation_status=?,validation_messages=?,readiness_status=?,readiness_score=?,
            quality_summary=?,quality_reason_codes=?,updated_at=now()
      WHERE id=? AND organization_id=? AND values_version=?`,
    [
      validation.status,
      JSON.stringify(validation.messages),
      readiness.readinessStatus,
      readiness.readinessScore,
      readiness.summary,
      JSON.stringify(readiness.reasonCodes),
      statementId,
      organizationId,
      valuesVersion,
    ]
  );
  return { validation, readiness };
}

export async function recordManualMappingDecision(input: RecordManualMappingDecisionInput) {
  if (!input.idempotencyKey.trim() || !input.reason.trim())
    throw new StatementGovernanceError(
      'MANUAL_DECISION_INVALID',
      400,
      'Idempotency key and reason required'
    );
  const command = {
    statementId: input.statementId,
    candidateRowId: input.candidateRowId,
    canonicalLineId: input.canonicalLineId || null,
    action: input.action,
    reason: input.reason.trim(),
    sourceReceiptId: input.sourceReceiptId,
    expectedValuesVersion: input.expectedValuesVersion,
  };
  const requestHash = canonicalPayloadHash(command);
  return withPgTransaction(async (tx) => {
    const member = (
      await tx.query<any>(
        `SELECT status,role FROM organization_members WHERE organization_id=? AND user_id=? FOR SHARE`,
        [input.organizationId, input.userId]
      )
    ).rows[0];
    if (String(member?.status || '').toUpperCase() !== 'ACTIVE')
      throw new StatementGovernanceError(
        'ORG_MEMBERSHIP_REVOKED',
        403,
        'Active membership required'
      );
    if (!hasFinanceEditRole(member.role))
      throw new StatementGovernanceError(
        'FINANCE_EDIT_FORBIDDEN',
        403,
        'Finance editor role required'
      );
    await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended(?,0))`, [
      `${input.organizationId}:${input.idempotencyKey}:STATEMENT_MAPPING`,
    ]);
    const replay = (
      await tx.query<any>(
        `SELECT * FROM finance_statement_manual_mapping_decisions WHERE organization_id=? AND idempotency_key=?`,
        [input.organizationId, input.idempotencyKey]
      )
    ).rows[0];
    if (replay) {
      if (replay.request_hash !== requestHash)
        throw new StatementGovernanceError(
          'IDEMPOTENCY_PAYLOAD_COLLISION',
          409,
          'Decision key collision'
        );
      const refreshed = await refreshReadinessFromDurableDecisions(
        tx,
        input.organizationId,
        input.statementId,
        input.expectedValuesVersion
      );
      return { ...replay, ...refreshed, replay: true };
    }
    const statement = (
      await tx.query<any>(
        `SELECT values_version FROM financial_statements WHERE id=? AND organization_id=? FOR UPDATE`,
        [input.statementId, input.organizationId]
      )
    ).rows[0];
    if (!statement)
      throw new StatementGovernanceError('STATEMENT_NOT_FOUND', 404, 'Statement not found');
    if (Number(statement.values_version) !== input.expectedValuesVersion)
      throw new StatementGovernanceError(
        'STALE_STATEMENT_VERSION',
        409,
        'Statement values changed'
      );
    const candidate = (
      await tx.query<any>(
        `SELECT c.id,m.score,m.match_reason FROM financial_statement_candidate_rows c LEFT JOIN financial_statement_mapping_candidates m ON m.candidate_row_id=c.id AND m.canonical_line_id=? WHERE c.id=? AND c.statement_id=? ORDER BY m.score DESC NULLS LAST LIMIT 1`,
        [input.canonicalLineId || null, input.candidateRowId, input.statementId]
      )
    ).rows[0];
    if (!candidate)
      throw new StatementGovernanceError(
        'MAPPING_CANDIDATE_NOT_FOUND',
        404,
        'Candidate row not found'
      );
    const receipt = (
      await tx.query<any>(
        `SELECT receipt_id FROM finance_statement_source_receipts WHERE receipt_id=? AND organization_id=? AND statement_id=?`,
        [input.sourceReceiptId, input.organizationId, input.statementId]
      )
    ).rows[0];
    if (!receipt)
      throw new StatementGovernanceError(
        'SOURCE_RECEIPT_NOT_FOUND',
        409,
        'Matching source receipt required'
      );
    const row = (
      await tx.query<any>(
        `INSERT INTO finance_statement_manual_mapping_decisions(organization_id,statement_id,candidate_row_id,canonical_line_id,action,reason,model_score_snapshot,model_reason_snapshot,source_receipt_id,statement_values_version,idempotency_key,request_hash,decided_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *`,
        [
          input.organizationId,
          input.statementId,
          input.candidateRowId,
          input.canonicalLineId || null,
          input.action,
          input.reason.trim(),
          candidate.score ?? null,
          candidate.match_reason ?? null,
          input.sourceReceiptId,
          input.expectedValuesVersion,
          input.idempotencyKey,
          requestHash,
          input.userId,
        ]
      )
    ).rows[0];
    const refreshed = await refreshReadinessFromDurableDecisions(
      tx,
      input.organizationId,
      input.statementId,
      input.expectedValuesVersion
    );
    return { ...row, ...refreshed, replay: false };
  });
}
