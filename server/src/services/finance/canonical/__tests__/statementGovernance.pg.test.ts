import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_PG)('statement governance receipts (real PostgreSQL)', () => {
  const organizationId = `org-statement-governance-${randomUUID()}`;
  const userId = `user-statement-governance-${randomUUID()}`;
  const statementId = `statement-governance-${randomUUID()}`;
  const candidateRowId = `candidate-governance-${randomUUID()}`;
  let client: Client;
  let registerReceipt: typeof import('../statementSourceReceiptService.js').registerStatementSourceReceipt;
  let recordDecision: typeof import('../statementManualMappingDecisionService.js').recordManualMappingDecision;
  let confirmGoverned: typeof import('../statementGovernedConfirmationService.js').confirmGovernedStatement;

  const receiptInput = () => ({
    organizationId,
    statementId,
    uploadId: 'upload-1',
    durableObjectId: 'vault://statement-governance/source-1',
    originalFileName: 'pełna nazwa źródła 2026.xlsx',
    contentSha256: 'a'.repeat(64),
    sizeBytes: 128,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sourceKind: 'UPLOAD' as const,
    importerName: 'statement-xlsx',
    importerVersion: '1.0.0',
    entityName: 'Governance Entity',
    periods: [{ start: '2026-01-01', end: '2026-12-31', label: 'FY2026' }],
    pageRanges: [],
    userId,
  });

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    ({ registerStatementSourceReceipt: registerReceipt } =
      await import('../statementSourceReceiptService.js'));
    ({ recordManualMappingDecision: recordDecision } =
      await import('../statementManualMappingDecisionService.js'));
    ({ confirmGovernedStatement: confirmGoverned } =
      await import('../statementGovernedConfirmationService.js'));
    await client.query(`INSERT INTO organizations(id,name) VALUES($1,'Statement governance')`, [
      organizationId,
    ]);
    await client.query(
      `INSERT INTO users(id,organization_id,email,first_name,last_name,role)
       VALUES($1,$2,$3,'Statement','Governance','ADMIN')`,
      [userId, organizationId, `${userId}@test.local`]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at)
       VALUES($1,$2,$3,'OWNER','ACTIVE',now())`,
      [randomUUID(), organizationId, userId]
    );
    await client.query(
      `INSERT INTO financial_statements
       (id,organization_id,entity_name,statement_type,period_start,period_end,period_label,currency,scaling,status,validation_status,values_version,created_by)
       VALUES($1,$2,'Governance Entity','P&L','2026-01-01','2026-12-31','FY2026','PLN','units','mapped','pass',0,$3)`,
      [statementId, organizationId, userId]
    );
    await client.query(
      `INSERT INTO financial_statement_candidate_rows
       (id,statement_id,row_label,source_row,raw_value,normalized_value,confidence)
       VALUES($1,$2,'Przychody',1,'100',100,0.61)`,
      [candidateRowId, statementId]
    );
    await client.query(
      `INSERT INTO financial_statement_mapping_candidates
       (id,statement_id,candidate_row_id,canonical_line_id,score,match_reason,is_selected,selected_by)
       VALUES($1,$2,$3,'fsl-pl-revenue',0.61,'model suggestion',FALSE,'system_alt')`,
      [randomUUID(), statementId, candidateRowId]
    );
    await client.query(
      `INSERT INTO financial_statement_values
       (id,statement_id,canonical_line_id,original_label,value,confidence,source_row,
        mapping_status,is_non_financial,value_origin,mapping_confidence,source_candidate_row_id)
       VALUES($1,$2,'fsl-pl-revenue','Przychody',100,0.61,1,'manual',FALSE,'manual',0.61,$3)`,
      [randomUUID(), statementId, candidateRowId]
    );
  });

  afterAll(async () => {
    if (!client) return;
    await client.query('BEGIN');
    try {
      await client.query(`SET LOCAL session_replication_role=replica`);
      await client.query(
        `DELETE FROM finance_statement_confirmation_receipts WHERE organization_id=$1`,
        [organizationId]
      );
      await client.query(
        `DELETE FROM finance_statement_manual_mapping_decisions WHERE organization_id=$1`,
        [organizationId]
      );
      await client.query(`DELETE FROM finance_statement_source_receipts WHERE organization_id=$1`, [
        organizationId,
      ]);
      await client.query(
        `DELETE FROM financial_statement_mapping_candidates WHERE statement_id=$1`,
        [statementId]
      );
      await client.query(`DELETE FROM financial_statement_candidate_rows WHERE statement_id=$1`, [
        statementId,
      ]);
      await client.query(`DELETE FROM financial_statements WHERE id=$1`, [statementId]);
      await client.query(`DELETE FROM organization_members WHERE organization_id=$1`, [
        organizationId,
      ]);
      await client.query(`DELETE FROM users WHERE id=$1`, [userId]);
      await client.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
      await client.query(`SET LOCAL session_replication_role=origin`);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      await client.end();
    }
  });

  it('persists full provenance, replays exactly, rejects collision and blocks mutation', async () => {
    const first = await registerReceipt(receiptInput());
    expect(first.replay).toBe(false);
    expect(first.original_file_name).toBe(receiptInput().originalFileName);
    expect(first.content_sha256).toHaveLength(64);
    expect(first.imported_by).toBe(userId);
    expect(first.periods_json).toEqual(receiptInput().periods);
    expect((await registerReceipt(receiptInput())).receipt_id).toBe(first.receipt_id);
    await expect(
      registerReceipt({ ...receiptInput(), durableObjectId: 'vault://different' })
    ).rejects.toMatchObject({ code: 'SOURCE_RECEIPT_COLLISION' });
    await expect(
      client.query(
        `UPDATE finance_statement_source_receipts SET importer_version='2' WHERE receipt_id=$1`,
        [first.receipt_id]
      )
    ).rejects.toThrow(/immutable/);
  });

  it('records an append-only human decision without upgrading the model score', async () => {
    const receipt = await registerReceipt(receiptInput());
    const decision = await recordDecision({
      organizationId,
      statementId,
      candidateRowId,
      canonicalLineId: 'fsl-pl-revenue',
      action: 'ACCEPT',
      reason: 'Verified against source row 1',
      sourceReceiptId: receipt.receipt_id,
      expectedValuesVersion: 0,
      idempotencyKey: 'manual-map-1',
      userId,
    });
    expect(decision.action).toBe('ACCEPT');
    expect(Number(decision.model_score_snapshot)).toBe(0.61);
    expect(decision.decided_by).toBe(userId);
    const refreshed = await client.query(
      `SELECT validation_messages FROM financial_statements WHERE id=$1`,
      [statementId]
    );
    expect(String(refreshed.rows[0].validation_messages || '')).not.toContain(
      'MANUAL_MAPPING_NOT_VERIFIED'
    );
    await expect(
      client.query(`DELETE FROM finance_statement_manual_mapping_decisions WHERE decision_id=$1`, [
        decision.decision_id,
      ])
    ).rejects.toThrow(/immutable/);
  });

  it('checks current authority before a winning receipt replay', async () => {
    await registerReceipt(receiptInput());
    await client.query(
      `UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,
      [organizationId, userId]
    );
    await expect(registerReceipt(receiptInput())).rejects.toMatchObject({
      code: 'ORG_MEMBERSHIP_REVOKED',
    });
    await client.query(
      `UPDATE organization_members SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2`,
      [organizationId, userId]
    );
  });

  it('fails closed before confirmation when the immutable source receipt is absent', async () => {
    await expect(
      confirmGoverned({
        organizationId,
        statementId,
        sourceReceiptId: `missing-${randomUUID()}`,
        expectedValuesVersion: 0,
        idempotencyKey: `confirm-without-receipt-${randomUUID()}`,
        userId,
      })
    ).rejects.toMatchObject({ code: 'SOURCE_RECEIPT_NOT_FOUND' });
  });
});
