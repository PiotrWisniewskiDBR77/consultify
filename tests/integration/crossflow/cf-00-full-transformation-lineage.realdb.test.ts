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
  const receiptId = randomUUID();
  let client: pg.Client;
  let ensureBinding: typeof import('../../../server/src/services/resultsVnext/roi/closureReceiptRoiCaseAdapter.js').ensureRoiCaseForClosureReceipt;

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    process.env.MOCK_DB = 'false';
    client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    ({ ensureRoiCaseForClosureReceipt: ensureBinding } = await import(
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
       VALUES($1,$2,$3,$1,$4,'Crossflow Owner','DELIVERED','NEEDS_DECISION','{}'::jsonb)`,
      [receiptId, orgA, initiativeId, userA]
    );
  });

  afterAll(async () => {
    if (!client) return;
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
    await client.end();
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
      expect(rows.rows[0].correlation_id).toBe(receiptId);
    } finally {
      await cold.end();
    }

    await expect(ensureBinding({ organizationId: orgB, receiptId })).rejects.toMatchObject({
      code: 'CLOSURE_RECEIPT_NOT_FOUND',
    });
    expect((await client.query(`SELECT count(*)::int n FROM rvn_roi_cases WHERE organization_id=$1`, [orgB])).rows[0].n).toBe(0);

    process.env.FLOW_CLOSURE_ROI_BINDING_ENABLED = 'true';
    try {
      const { attemptDeliveryInternal } = await import(
        '../../../server/src/services/closureDeliveryReceiptService.js'
      );
      await attemptDeliveryInternal(receiptId);
      const persisted = await client.query(
        `SELECT finance_status,finance_payload->>'roiCaseId' AS roi_case_id
           FROM closure_delivery_receipts WHERE id=$1`,
        [receiptId]
      );
      expect(persisted.rows[0]).toEqual({
        finance_status: 'NEEDS_DECISION',
        roi_case_id: [...caseIds][0],
      });
    } finally {
      delete process.env.FLOW_CLOSURE_ROI_BINDING_ENABLED;
    }
  }, 60_000);
});
