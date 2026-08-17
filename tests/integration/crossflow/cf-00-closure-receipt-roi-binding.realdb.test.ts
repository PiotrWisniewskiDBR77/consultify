import { randomUUID } from 'node:crypto';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const enabled = process.env.RUN_DB_TESTS === '1' && Boolean(process.env.DATABASE_URL);
const suite = enabled ? describe : describe.skip;

suite('FLOW-TRANSFORM closure receipt -> ROI case durable binding', () => {
  const orgA = `cf_flow_a_${randomUUID()}`;
  const orgB = `cf_flow_b_${randomUUID()}`;
  const ownerA = `cf_flow_owner_${randomUUID()}`;
  const closerA = `cf_flow_closer_${randomUUID()}`;
  const initiativeId = `cf_flow_init_${randomUUID()}`;
  const receiptId = `materialized-done:${randomUUID()}:receipt`;
  const transitionRef = `materialized-done:${randomUUID()}:transition`;
  const secondReceiptId = `materialized-done:${randomUUID()}:receipt`;
  const secondTransitionRef = `materialized-done:${randomUUID()}:transition`;
  const actorlessReceiptId = `materialized-done:${randomUUID()}:receipt`;
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
    if (process.env.FLOW_TRANSFORM_ALLOW_FIXTURE_CLEANUP !== '1' || !allowedPrefix || !dbName.startsWith('flow_') || !dbName.startsWith(allowedPrefix)) {
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
       VALUES($1,$3,$4,'Flow','Owner','OWNER','active'),
             ($2,$3,$5,'Flow','Closer','ADMIN','active')`,
      [ownerA, closerA, orgA, `${ownerA}@crossflow.local`, `${closerA}@crossflow.local`]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$3,$4,'OWNER','ACTIVE'),($2,$3,$5,'ADMIN','ACTIVE')`,
      [`member_${ownerA}`, `member_${closerA}`, orgA, ownerA, closerA]
    );
    await client.query(
      `INSERT INTO initiatives(id,organization_id,name,status,budget_currency,owner_business_id,created_by)
       VALUES($1,$2,'Crossflow full lineage','DONE','USD',$3,$3)`,
      [initiativeId, orgA, ownerA]
    );
    await client.query(
      `INSERT INTO closure_delivery_receipts
         (id,organization_id,initiative_id,transition_audit_ref,actor_id,actor_label,
          results_status,finance_status,finance_payload)
       VALUES($1,$2,$3,$4,$5,'Crossflow Owner','DELIVERED','NEEDS_DECISION','{}'::jsonb)`,
      [receiptId, orgA, initiativeId, transitionRef, closerA]
    );
  });

  afterAll(async () => {
    if (!client) return;
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM closure_delivery_receipts WHERE id=$1`, [receiptId]);
      await client.query('ROLLBACK');
      expect((await client.query(`SELECT count(*)::int n FROM closure_delivery_receipts WHERE id=$1`, [receiptId])).rows[0].n).toBe(1);
      await client.query('BEGIN');
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
    await client.query(`DELETE FROM closure_delivery_receipts WHERE id=ANY($1::text[])`, [[receiptId, secondReceiptId, actorlessReceiptId]]);
    await client.query(`DELETE FROM initiatives WHERE id=$1`, [initiativeId]);
    await client.query(`DELETE FROM organization_members WHERE organization_id=$1`, [orgA]);
    await client.query(`DELETE FROM users WHERE id=ANY($1::text[])`, [[ownerA, closerA]]);
      await client.query(`DELETE FROM organizations WHERE id=ANY($1::text[])`, [[orgA, orgB]]);
      const residue = await client.query(`SELECT
        (SELECT count(*)::int FROM rvn_roi_cases WHERE organization_id=$1) cases,
        (SELECT count(*)::int FROM rvn_platform_events WHERE organization_id=$1) events,
        (SELECT count(*)::int FROM closure_delivery_receipts WHERE id=ANY($2::text[])) receipts,
        (SELECT count(*)::int FROM initiatives WHERE id=$3) initiatives,
        (SELECT count(*)::int FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id=$1)) outbox,
        (SELECT count(*)::int FROM rvn_roi_baselines WHERE organization_id=$1) baselines,
        (SELECT count(*)::int FROM rvn_roi_calculation_policy WHERE organization_id=$1) calculation_policies,
        (SELECT count(*)::int FROM rvn_platform_resource_visibility WHERE organization_id=$1) visibility,
        (SELECT count(*)::int FROM rvn_platform_resource_acl WHERE resource_id IN (SELECT case_id::text FROM rvn_roi_cases WHERE organization_id=$1)) acl,
        (SELECT count(*)::int FROM rvn_platform_obligations WHERE organization_id=$1) obligations,
        (SELECT count(*)::int FROM organization_members WHERE organization_id=$1) members,
        (SELECT count(*)::int FROM users WHERE id=ANY($4::text[])) users`, [orgA, [receiptId, secondReceiptId, actorlessReceiptId], initiativeId, [ownerA, closerA]]);
      expect(residue.rows[0]).toEqual({ cases: 0, events: 0, receipts: 0, initiatives: 0, outbox: 0, baselines: 0, calculation_policies: 0, visibility: 0, acl: 0, obligations: 0, members: 0, users: 0 });
      await client.query('COMMIT');
      const postCommit = await client.query(`SELECT count(*)::int n FROM organizations WHERE id=ANY($1::text[])`, [[orgA, orgB]]);
      expect(postCommit.rows[0].n).toBe(0);
      const triggerStates = await client.query<{ tgname: string; tgenabled: string }>(
        `SELECT t.tgname,t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
          WHERE NOT t.tgisinternal AND c.relname=ANY($1::text[]) ORDER BY t.tgname`,
        [['closure_delivery_receipts', 'rvn_platform_events', 'rvn_platform_outbox']]
      );
      expect(triggerStates.rows.every((row) => row.tgenabled === 'O')).toBe(true);
      expect(triggerStates.rows).toContainEqual({ tgname: 'trg_rvn_operational_alert_terminal_at', tgenabled: 'O' });
    } finally {
      if ((client as any).query) await client.query('ROLLBACK').catch(() => undefined);
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
      [orgA, ownerA]
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
      expect(textIdentityUuid('closure-receipt', receiptId)).toBe(textIdentityUuid('closure-receipt', receiptId));
      expect(textIdentityUuid('closure-receipt', receiptId)).not.toBe(textIdentityUuid('closure-transition', receiptId));
      const corpus = [receiptId, transitionRef, secondReceiptId, secondTransitionRef].flatMap((value) =>
        ['closure-receipt', 'closure-transition'].map((namespace) => textIdentityUuid(namespace, value))
      );
      expect(new Set(corpus).size).toBe(corpus.length);
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
      acl: 2,
      obligations: 1,
      events: 1,
      outbox: 1,
    });

    const attribution = await client.query(`SELECT c.owner_user_id,e.actor_user_id,e.source,e.correlation_id,e.causation_id
      FROM rvn_roi_cases c JOIN rvn_platform_events e ON e.organization_id=c.organization_id AND e.aggregate_id=c.case_id::text
      WHERE e.organization_id=$1 AND e.idempotency_key=$2`, [orgA, `closure-receipt:${receiptId}:roi-case:v1`]);
    expect(attribution.rows[0]).toEqual({ owner_user_id: ownerA, actor_user_id: closerA, source: 'resultsVnext.roi', correlation_id: textIdentityUuid('closure-receipt', receiptId), causation_id: textIdentityUuid('closure-transition', transitionRef) });
    const aclPrincipals = await client.query(`SELECT grantee_id FROM rvn_platform_resource_acl WHERE resource_id=$1 ORDER BY grantee_id`, [[...caseIds][0]]);
    expect(aclPrincipals.rows.map((row) => row.grantee_id)).toEqual([closerA, ownerA].sort());

    await client.query(`UPDATE rvn_roi_cases SET title='Mutable projection title' WHERE case_id=$1`, [[...caseIds][0]]);
    await expect(ensureBinding({ organizationId: orgA, receiptId })).resolves.toMatchObject({ outcome: 'duplicate' });
    await client.query(`UPDATE initiatives SET name='Mutable projection title' WHERE id=$1`, [initiativeId]);
    await expect(ensureBinding({ organizationId: orgA, receiptId })).rejects.toMatchObject({ code: 'CLOSURE_RECEIPT_BINDING_COLLISION' });
    await client.query(`UPDATE initiatives SET name='Crossflow full lineage' WHERE id=$1`, [initiativeId]);
    await client.query(`UPDATE rvn_roi_cases SET title='Crossflow full lineage — post-closure ROI' WHERE case_id=$1`, [[...caseIds][0]]);

    await client.query(`UPDATE closure_delivery_receipts SET transition_audit_ref=$2 WHERE id=$1`, [receiptId, `${transitionRef}:altered`]);
    await expect(ensureBinding({ organizationId: orgA, receiptId })).rejects.toMatchObject({ code: 'CLOSURE_RECEIPT_BINDING_COLLISION' });
    await client.query(`UPDATE closure_delivery_receipts SET transition_audit_ref=$2 WHERE id=$1`, [receiptId, transitionRef]);

    for (const [sql, params] of [
      [`UPDATE closure_delivery_receipts SET actor_id=$2 WHERE id=$1`, [receiptId, ownerA]],
      [`UPDATE initiatives SET owner_business_id=$2 WHERE id=$1`, [initiativeId, closerA]],
      [`UPDATE initiatives SET budget_currency='EUR' WHERE id=$1`, [initiativeId]],
      [`UPDATE initiatives SET name='Altered title' WHERE id=$1`, [initiativeId]],
    ] as const) {
      await client.query(sql, params as string[]);
      await expect(ensureBinding({ organizationId: orgA, receiptId })).rejects.toMatchObject({ code: 'CLOSURE_RECEIPT_BINDING_COLLISION' });
      await client.query(`UPDATE closure_delivery_receipts SET actor_id=$2 WHERE id=$1`, [receiptId, closerA]);
      await client.query(`UPDATE initiatives SET owner_business_id=$2,budget_currency='USD',name='Crossflow full lineage' WHERE id=$1`, [initiativeId, ownerA]);
    }

    await client.query(`UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`, [orgA, closerA]);
    await expect(ensureBinding({ organizationId: orgA, receiptId })).rejects.toMatchObject({
      code: 'CLOSURE_RECEIPT_ACTOR_NOT_ACTIVE',
    });
    await client.query(`UPDATE organization_members SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2`, [orgA, closerA]);
    await client.query(`UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`, [orgA, ownerA]);
    await expect(ensureBinding({ organizationId: orgA, receiptId })).rejects.toMatchObject({ code: 'CLOSURE_RECEIPT_OWNER_REQUIRED' });
    await client.query(`UPDATE organization_members SET status='ACTIVE' WHERE organization_id=$1 AND user_id=$2`, [orgA, ownerA]);

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
      await client.query(`INSERT INTO closure_delivery_receipts
        (id,organization_id,initiative_id,transition_audit_ref,actor_id,actor_label,results_status,finance_status,finance_payload)
        VALUES($1,$2,$3,$4,$5,'Flow Closer','DELIVERED','NEEDS_DECISION','{}'::jsonb)`,
        [secondReceiptId, orgA, initiativeId, secondTransitionRef, closerA]);
      const second = await ensureBinding({ organizationId: orgA, receiptId: secondReceiptId });
      expect(second.result.case.caseId).toBe([...caseIds][0]);
      await client.query(`UPDATE closure_delivery_receipts SET finance_payload=jsonb_build_object('roiCaseId',$2::text) WHERE id=$1`, [secondReceiptId, second.result.case.caseId]);
      const afterSecond = await client.query(`SELECT
        (SELECT count(*)::int FROM rvn_roi_cases WHERE organization_id=$1) cases,
        (SELECT count(*)::int FROM rvn_roi_baselines WHERE organization_id=$1) baselines,
        (SELECT count(*)::int FROM rvn_platform_events WHERE organization_id=$1 AND idempotency_key IN ($2,$3)) bindings`,
        [orgA, `closure-receipt:${receiptId}:roi-case:v1`, `closure-receipt:${secondReceiptId}:roi-case:v1`]);
      expect(afterSecond.rows[0]).toEqual({ cases: 1, baselines: 1, bindings: 2 });
      const allExact = await client.query(`SELECT
        (SELECT count(*)::int FROM rvn_roi_cases WHERE organization_id=$1) cases,
        (SELECT count(*)::int FROM rvn_roi_baselines WHERE organization_id=$1) baselines,
        (SELECT count(*)::int FROM rvn_roi_calculation_policy WHERE organization_id=$1) calculation_policies,
        (SELECT count(*)::int FROM rvn_platform_resource_visibility WHERE organization_id=$1) visibility,
        (SELECT count(*)::int FROM rvn_platform_resource_acl WHERE resource_id=$2) acl,
        (SELECT count(*)::int FROM rvn_platform_obligations WHERE organization_id=$1) obligations,
        (SELECT count(*)::int FROM rvn_platform_events WHERE organization_id=$1 AND idempotency_key LIKE 'closure-receipt:%:roi-case:v1') events,
        (SELECT count(*)::int FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id=$1 AND idempotency_key LIKE 'closure-receipt:%:roi-case:v1')) outbox`, [orgA, [...caseIds][0]]);
      expect(allExact.rows[0]).toEqual({ cases: 1, baselines: 1, calculation_policies: 1, visibility: 1, acl: 2, obligations: 1, events: 2, outbox: 2 });

      await client.query(`INSERT INTO closure_delivery_receipts
        (id,organization_id,initiative_id,transition_audit_ref,actor_id,actor_label,results_status,finance_status,finance_payload)
        VALUES($1,$2,$3,$4,NULL,'System','DELIVERED','NEEDS_DECISION','{}'::jsonb)`,
        [actorlessReceiptId, orgA, initiativeId, `materialized-done:${randomUUID()}:transition`]);
      await attemptDeliveryInternal(actorlessReceiptId);
      const actorless = await client.query(`SELECT finance_payload->>'roiBindingDisposition' disposition,next_retry_at FROM closure_delivery_receipts WHERE id=$1`, [actorlessReceiptId]);
      expect(actorless.rows[0]).toEqual({ disposition: 'NON_BINDABLE_MISSING_ACTOR', next_retry_at: null });
      expect(await runReconciliationSweep(10)).toEqual({ claimed: 0, delivered: 0, stillPending: 0 });
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
