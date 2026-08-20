import { canonicalPayloadHash } from './contentHash.js';
import { withPgTransaction } from '../../../utils/queryHelpers.js';
import { hasFinanceEditRole } from '../../legacyCutover/requireActiveMembership.js';
import { evaluateStatementReadiness, validateStatement } from '../../financialStatementService.js';
import { confirmAndRegisterStatementPack } from './statementPackRegistrationService.js';
import { StatementGovernanceError } from './statementSourceReceiptService.js';

export interface ConfirmGovernedStatementInput {
  organizationId: string;
  statementId: string;
  sourceReceiptId: string;
  expectedValuesVersion: number;
  idempotencyKey: string;
  userId: string;
}

export async function confirmGovernedStatement(input: ConfirmGovernedStatementInput) {
  if (!input.idempotencyKey.trim())
    throw new StatementGovernanceError(
      'IDEMPOTENCY_KEY_REQUIRED',
      400,
      'Idempotency-Key is required'
    );
  const requestHash = canonicalPayloadHash({
    statementId: input.statementId,
    sourceReceiptId: input.sourceReceiptId,
    expectedValuesVersion: input.expectedValuesVersion,
  });
  return withPgTransaction(async (tx) => {
    const member = (
      await tx.query<any>(
        `SELECT status,role FROM organization_members WHERE organization_id=? AND user_id=? FOR UPDATE`,
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
      `${input.organizationId}:${input.idempotencyKey}:STATEMENT_CONFIRM`,
    ]);
    const replay = (
      await tx.query<any>(
        `SELECT request_hash,response_json FROM finance_statement_confirmation_receipts WHERE organization_id=? AND idempotency_key=?`,
        [input.organizationId, input.idempotencyKey]
      )
    ).rows[0];
    if (replay) {
      if (replay.request_hash !== requestHash)
        throw new StatementGovernanceError(
          'IDEMPOTENCY_PAYLOAD_COLLISION',
          409,
          'Confirmation key collision'
        );
      return { ...replay.response_json, replayed: true };
    }
    const statement = (
      await tx.query<any>(
        `SELECT * FROM financial_statements WHERE id=? AND organization_id=? FOR UPDATE`,
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
    const receipt = (
      await tx.query<any>(
        `SELECT * FROM finance_statement_source_receipts WHERE receipt_id=? AND organization_id=? AND statement_id=? FOR SHARE`,
        [input.sourceReceiptId, input.organizationId, input.statementId]
      )
    ).rows[0];
    if (!receipt)
      throw new StatementGovernanceError(
        'SOURCE_RECEIPT_NOT_FOUND',
        409,
        'Complete source receipt required'
      );
    const values = (
      await tx.query<any>(
        `SELECT id,canonical_line_id AS "canonicalLineId",value,original_label AS "originalLabel",mapping_status AS "mappingStatus",is_non_financial AS "isNonFinancial",source_candidate_row_id,evidence_json FROM financial_statement_values WHERE statement_id=? ORDER BY source_row,id FOR SHARE`,
        [input.statementId]
      )
    ).rows;
    const unresolved = values.filter((v: any) => !v.isNonFinancial && !v.canonicalLineId);
    if (unresolved.length)
      throw new StatementGovernanceError(
        'UNMAPPED_FINANCIAL_LINES',
        409,
        'All eligible lines must be mapped'
      );
    const manualRows = values.filter(
      (v: any) => String(v.mappingStatus || '').toLowerCase() === 'manual'
    );
    for (const value of manualRows) {
      if (!value.source_candidate_row_id)
        throw new StatementGovernanceError(
          'MANUAL_MAPPING_AUDIT_MISSING',
          409,
          'Manual mapping lacks source candidate'
        );
      const decision = (
        await tx.query<any>(
          `SELECT action,canonical_line_id,source_receipt_id,statement_values_version FROM finance_statement_manual_mapping_decisions WHERE organization_id=? AND statement_id=? AND candidate_row_id=? ORDER BY decided_at DESC,decision_id DESC LIMIT 1`,
          [input.organizationId, input.statementId, value.source_candidate_row_id]
        )
      ).rows[0];
      if (
        !decision ||
        (value.isNonFinancial
          ? decision.action !== 'EXCLUDE' || decision.canonical_line_id !== null
          : decision.action !== 'ACCEPT' ||
            decision.canonical_line_id !== value.canonicalLineId) ||
        decision.source_receipt_id !== input.sourceReceiptId ||
        Number(decision.statement_values_version) !== input.expectedValuesVersion
      )
        throw new StatementGovernanceError(
          'MANUAL_MAPPING_AUDIT_MISSING',
          409,
          'Current accepted manual decision required'
        );
    }
    const validation = validateStatement(values, statement.statement_type);
    const readiness = evaluateStatementReadiness({
      rawStatus: statement.status,
      statementType: statement.statement_type,
      validationStatus: validation.status,
      currency: statement.currency,
      scaling: statement.scaling,
      validationMessages: validation.messages,
      values,
    });
    if (!readiness.isReady)
      throw new StatementGovernanceError(
        'STATEMENT_NOT_READY',
        409,
        'Statement failed readiness contract'
      );
    const registered = await confirmAndRegisterStatementPack({
      statementId: input.statementId,
      organizationId: input.organizationId,
      userId: input.userId,
      statement,
      values,
      validations: validation.messages,
      readiness,
    });
    const response = {
      ...registered,
      statementId: input.statementId,
      sourceReceiptId: input.sourceReceiptId,
      valuesVersion: input.expectedValuesVersion,
    };
    await tx.query(
      `INSERT INTO finance_statement_confirmation_receipts(organization_id,statement_id,idempotency_key,request_hash,source_receipt_id,statement_values_version,statement_pack_id,artifact_id,business_version_id,working_revision_id,response_json,confirmed_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        input.organizationId,
        input.statementId,
        input.idempotencyKey,
        requestHash,
        input.sourceReceiptId,
        input.expectedValuesVersion,
        registered.statementPackId,
        registered.artifactId,
        registered.businessVersionId,
        registered.workingRevisionId,
        JSON.stringify(response),
        input.userId,
      ]
    );
    return { ...response, replayed: false };
  });
}
