import { randomUUID } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const enabled = process.env.RUN_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL);
const suite = enabled ? describe : describe.skip;

suite('FLOW-TRANSFORM closure receipt -> ROI case durable binding', () => {
  const orgA = `cf_flow_a_${randomUUID()}`;
  const orgB = `cf_flow_b_${randomUUID()}`;
  const userA = `cf_flow_user_${randomUUID()}`;
  const initiativeId = `cf_flow_init_${randomUUID()}`;
  const receiptId = `materialized-done:${randomUUID()}:receipt`;
  const transitionRef = `materialized-done:${randomUUID()}:transition`;
  let client: pg.Client;
  let ensureBinding: typeof import('../../../server/src/services/resultsVnext/roi/closureReceiptRoiCaseAdapter.js').ensureRoiCaseForClosureReceipt;
  let textIdentityUuid: typeof import('../../../server/src/services/resultsVnext/roi/closureReceiptRoiCaseAdapter.js').closureTextIdentityUuid;

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    process.env.MOCK_DB = 'false';
    client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const dbName = (await client.query<{ current_database: string }>('SELECT current_database()')).rows[0]!.current_database;
    const allowedPrefix = process.env.FLOW_TRANSFORM_DISPOSABLE_DB_PREFIX;
    if (!allowedPrefix || !dbName.startsWith(allowedPrefix)) {
      throw new Error(`FLOW fixture refuses database ${dbName}; set FLOW_TRANSFORM_DISPOSABLE_DB_PREFIX`);
    }
    await client.query(`SELECT pg_advisory_lock(hashtext('FLOW-TRANSFORM-MVP-001'))`);
    ({ ensureRoiCaseForClosureReceipt: ensureBinding, closureTextIdentityUuid: textIdentityUuid } = await import(
      '../../../server/src/services/resultsVnext/roi/closureReceiptRoiCaseAdapter.js'
    ));
    for (const [id, name] of [[orgA, 'Flow A'], [orgB, 'Flow B']]) {
      await client.query(
        `INSERT INTO organizations(id,name,plan,status) VALUES($1,$2,'enterprise','active')`,
        [id, name]
      );
    }
    await client.query(
      `INSERT INTO users(id,organization_id,email,first_name,last_name,role,status)
       VALUES($1,$2,$3,'Flow','Owner','OWNER','active')`,
      [userA, orgA, `${userA}@crossflow.local`]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [`member_${userA}`, orgA, userA]
    );
    await client.query(
      `INSERT INTO initiatives(id,organization_id,name,status,budget_currency,owner_business_id,created_by)
       VALUES($1,$2,'Crossflow full lineage','DONE','USD',$3,$3)`,
      [initiativeId, orgA, userA]
    );
    await client.query(
      `INSERT INTO closure_delivery_receipts
         (id,organization_id,initiative_id,transition_audit_ref,actor_id,actor_label,
          results_status,finance_status,finance_payload)
       VALUES($1,$2,$3,$4,$5,'Crossflow Owner','DELIVERED','NEEDS_DECISION','{}'::jsonb)`,
      [receiptId, orgA, initiativeId, transitionRef, userA]
    );
  });

  afterAll(async () => {
    if (!client) return;
    try {
    await client.query(`DELETE FROM rvn_platform_outbox WHERE event_id IN
      (SELECT event_id FROM rvn_platform_events WHERE organization_id=$1)`, [orgA]);
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id=$1`, [orgA]);
    await client.query(`DELETE FROM rvn_platform_resource_acl WHERE resource_id IN
      (SELECT case_id::text FROM rvn_roi_cases WHERE organization_id=$1)`, [orgA]);
    await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id=$1`, [orgA]);
    await client.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id=$1`, [orgA]);
    await client.query(`DELETE FROM rvn_roi_baselines WHERE organization_id=$1`, [orgA]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id=$1`, [orgA]);
    await client.query(`DELETE FROM rvn_roi_cases WHERE organization_id=$1`, [orgA]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id=$1`, [orgA]);
    await client.query(`DELETE FROM closure_delivery_receipts WHERE id=$1`, [receiptId]);
    await client.query(`DELETE FROM initiatives WHERE id=$1`, [initiativeId]);
    await client.query(`DELETE FROM organization_members WHERE organization_id=$1`, [orgA]);
    await client.query(`DELETE FROM users WHERE id=$1`, [userA]);
      await client.query(`DELETE FROM organizations WHERE id=ANY($1::text[])`, [[orgA, orgB]]);
    } finally {
      await client.query(`SELECT pg_advisory_unlock(hashtext('FLOW-TRANSFORM-MVP-001'))`);
      await client.end();
    }
  });

  it('fails closed before policy, then replays one durable tenant-scoped binding under concurrency', async () => {
    await expect(ensureBinding({ organizationId: orgA, receiptId })).rejects.toThrow();
    expect((await client.query(`SELECT count(*)::int n FROM rvn_roi_cases WHERE organization_id=$1`, [orgA])).rows[0].n).toBe(0);

    await client.query(
      `INSERT INTO rvn_platform_visibility_policies
         (organization_id,domain,policy_version,visibility_mode,is_active,created_by)
       VALUES($1,'roi',1,'OPEN_ORG',true,$2)`,
      [orgA, userA]
    );
    const attempts = await Promise.all(
      Array.from({ length: 8 }, () => ensureBinding({ organizationId: orgA, receiptId }))
    );
    const caseIds = new Set(attempts.map((attempt) => attempt.result.case.caseId));
    expect(caseIds.size).toBe(1);

    const cold = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await cold.connect();
    try {
      const rows = await cold.query(
        `SELECT c.case_id,e.correlation_id,e.idempotency_key
           FROM rvn_roi_cases c
           JOIN rvn_platform_events e
             ON e.organization_id=c.organization_id
            AND e.aggregate_id=c.case_id::text
          WHERE c.organization_id=$1 AND c.initiative_id=$2
            AND e.idempotency_key=$3`,
        [orgA, initiativeId, `closure-receipt:${receiptId}:roi-case:v1`]
      );
      expect(rows.rowCount).toBe(1);
      expect(rows.rows[0].correlation_id).toBe(textIdentityUuid('closure-receipt', receiptId));
    } finally {
      await cold.end();
    }

    await expect(ensureBinding({ organizationId: orgB, receiptId })).rejects.toMatchObject({
      code: 'CLOSURE_RECEIPT_NOT_FOUND',
    });
    expect((await client.query(`SELECT count(*)::int n FROM rvn_roi_cases WHERE organization_id=$1`, [orgB])).rows[0].n).toBe(0);

    const exact = await client.query(
      `SELECT
         (SELECT count(*)::int FROM rvn_roi_cases WHERE organization_id=$1) cases,
         (SELECT count(*)::int FROM rvn_roi_baselines WHERE organization_id=$1) baselines,
         (SELECT count(*)::int FROM rvn_roi_calculation_policy WHERE organization_id=$1) calculation_policies,
         (SELECT count(*)::int FROM rvn_platform_resource_visibility WHERE organization_id=$1) visibility,
         (SELECT count(*)::int FROM rvn_platform_resource_acl WHERE resource_id=(SELECT case_id::text FROM rvn_roi_cases WHERE organization_id=$1)) acl,
         (SELECT count(*)::int FROM rvn_platform_obligations WHERE organization_id=$1) obligations,
         (SELECT count(*)::int FROM rvn_platform_events WHERE organization_id=$1 AND idempotency_key=$2) events,
         (SELECT count(*)::int FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id=$1 AND idempotency_key=$2)) outbox`,
      [orgA, `closure-receipt:${receiptId}:roi-case:v1`]
    );
    expect(exact.rows[0]).toEqual({
      cases: 1,
      baselines: 1,
      calculation_policies: 1,
      visibility: 1,
      acl: 1,
      obligations: 1,
      events: 1,
      outbox: 1,
    });

    await client.query(`UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`, [orgA, userA]);
    await expect(ensureBinding({ organizationId: orgA, receiptId })).rejects.toMatchObject({
      code: 'CLOSURE_RECEIPT_ACTOR_NOT_ACTIVE',
    });
    await client.query(`UPDATE organization_members SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2`, [orgA, userA]);

    process.env.FLOW_CLOSURE_ROI_BINDING_ENABLED = 'true';
    try {
      const { attemptDeliveryInternal, runReconciliationSweep } = await import(
        '../../../server/src/services/closureDeliveryReceiptService.js'
      );
      process.env.FLOW_CLOSURE_ROI_FORCE_RECEIPT_UPDATE_FAILURE = 'true';
      await attemptDeliveryInternal(receiptId);
      let persisted = await client.query(
        `SELECT finance_status,finance_payload->>'roiCaseId' AS roi_case_id
           FROM closure_delivery_receipts WHERE id=$1`,
        [receiptId]
      );
      expect(persisted.rows[0]).toEqual({ finance_status: 'NEEDS_DECISION', roi_case_id: null });
      delete process.env.FLOW_CLOSURE_ROI_FORCE_RECEIPT_UPDATE_FAILURE;
      await client.query(`UPDATE closure_delivery_receipts SET next_retry_at=NOW()-INTERVAL '1 second' WHERE id=$1`, [receiptId]);
      expect(await runReconciliationSweep(10)).toEqual({ claimed: 1, delivered: 1, stillPending: 0 });
      persisted = await client.query(
        `SELECT finance_status,finance_payload->>'roiCaseId' AS roi_case_id
           FROM closure_delivery_receipts WHERE id=$1`,
        [receiptId]
      );
      expect(persisted.rows[0]).toEqual({
        finance_status: 'NEEDS_DECISION',
        roi_case_id: [...caseIds][0],
      });
      const forbidden = await client.query(
        `SELECT
           (SELECT count(*)::int FROM roi_realized_values WHERE initiative_id=$1) realized,
           (SELECT count(*)::int FROM rvn_roi_finance_reconciliations WHERE case_id=(SELECT case_id FROM rvn_roi_cases WHERE organization_id=$2)) reconciliations,
           (SELECT count(*)::int FROM rvn_roi_post_investment_reviews WHERE organization_id=$2) pirs`,
        [initiativeId, orgA]
      );
      expect(forbidden.rows[0]).toEqual({ realized: 0, reconciliations: 0, pirs: 0 });
    } finally {
      delete process.env.FLOW_CLOSURE_ROI_FORCE_RECEIPT_UPDATE_FAILURE;
      delete process.env.FLOW_CLOSURE_ROI_BINDING_ENABLED;
    }
  }, 60_000);
});
