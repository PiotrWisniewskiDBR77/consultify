/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const enabled = process.env.RUN_DB_TESTS === '1';

describe.skipIf(!enabled)('DAY157 provenance predicate and sandbox revert — real PG', () => {
  const tag = randomUUID();
  const org = `day157-org-${tag}`;
  const requester = `day157-requester-${tag}`;
  const approver = `day157-approver-${tag}`;
  const plan = `day157-plan-${tag}`;
  const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
  let pool: Pool;
  let service: typeof import('../../services/myWork/agentApprovedMaterializationService.js');
  let sourceVersion: number;
  let sourceHash: string;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      `INSERT INTO organizations(id,name,plan,status) VALUES($1,'Day157','enterprise','active')`,
      [org]
    );
    for (const user of [requester, approver]) {
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'unused','OWNER','active')`,
        [user, org, `${user}@test.local`]
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER','ACTIVE')`,
        [randomUUID(), org, user]
      );
    }
    await pool.query(
      `INSERT INTO ai_agent_plans(id,organization_id,user_id,title,plan_json,updated_at)
       VALUES($1,$2,$3,'Day157 source','[]',date_trunc('milliseconds',now()))`,
      [plan, org, requester]
    );
    service = await import('../../services/myWork/agentApprovedMaterializationService.js');
    ({ sourceVersion, sourceHash } = await service.getAgentPlanSourceIdentity(
      org,
      plan,
      requester
    ));
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(
      `ALTER TABLE myw_agent_materialization_receipts DISABLE TRIGGER trg_myw_agent_receipt_append_only`
    );
    await pool.query(
      `ALTER TABLE myw_agent_materialization_approvals DISABLE TRIGGER trg_myw_agent_approval_append_only`
    );
    await pool.query(
      `ALTER TABLE myw_agent_materialization_proposals DISABLE TRIGGER trg_myw_agent_proposal_guard`
    );
    await pool.query(`DELETE FROM myw_agent_materialization_receipts WHERE organization_id=$1`, [
      org,
    ]);
    await pool.query(`DELETE FROM myw_agent_canonical_outbox WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM myw_agent_materialization_approvals WHERE organization_id=$1`, [
      org,
    ]);
    await pool.query(`DELETE FROM myw_agent_materialization_proposals WHERE organization_id=$1`, [
      org,
    ]);
    await pool.query(
      `ALTER TABLE myw_agent_materialization_receipts ENABLE TRIGGER trg_myw_agent_receipt_append_only`
    );
    await pool.query(
      `ALTER TABLE myw_agent_materialization_approvals ENABLE TRIGGER trg_myw_agent_approval_append_only`
    );
    await pool.query(
      `ALTER TABLE myw_agent_materialization_proposals ENABLE TRIGGER trg_myw_agent_proposal_guard`
    );
    await pool.query(`DELETE FROM tasks WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM decisions WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM notebook_pages WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM ai_agent_plans WHERE id=$1`, [plan]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM users WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [org]);
    await pool.end();
  });

  it('materializes three traced rows and reverts exactly the predicate match', async () => {
    const targetIds: string[] = [];
    for (const targetKind of ['task', 'decision', 'notebook'] as const) {
      const created = await service.createMaterializationProposal({
        organizationId: org,
        requesterId: requester,
        sourcePlanId: plan,
        sourceVersion,
        sourceHash,
        targetKind,
        content: { title: `Day157 ${targetKind}`, description: 'approved body' },
        idempotencyKey: `day157-${targetKind}-${tag}`,
        expiresAt,
      });
      await service.decideMaterializationProposal({
        proposalId: created.proposal.proposal_id,
        organizationId: org,
        approverId: approver,
        decision: 'APPROVE',
        expectedStateVersion: 1,
        sourceHash,
      });
      const completed = await service.materializeApprovedProposal({
        proposalId: created.proposal.proposal_id,
        organizationId: org,
        actorId: approver,
        expectedStateVersion: 2,
      });
      targetIds.push(completed.receipt.target_id);
    }

    await pool.query(
      `INSERT INTO tasks(id,organization_id,title,source) VALUES($1,$2,'manual task','manual')`,
      [randomUUID(), org]
    );
    await pool.query(
      `INSERT INTO decisions(id,organization_id,title) VALUES($1,$2,'manual decision')`,
      [randomUUID(), org]
    );
    await pool.query(
      `INSERT INTO notebook_pages(id,owner_user_id,organization_id,title,content_json) VALUES($1,$2,$3,'manual note','{}')`,
      [randomUUID(), requester, org]
    );

    const predicate = `
      SELECT 'task' kind,id FROM tasks WHERE organization_id=$1 AND source_type='myw_agent_proposal'
      UNION ALL SELECT 'decision',id FROM decisions WHERE organization_id=$1 AND source_type='myw_agent_proposal'
      UNION ALL SELECT 'notebook',id FROM notebook_pages WHERE organization_id=$1
        AND source_type='myw_agent_proposal' AND materialization_provenance IS NOT NULL`;
    const beforeRows = (await pool.query(predicate, [org])).rows;
    const countBefore = beforeRows.length;

    await pool.query(
      `DELETE FROM tasks WHERE organization_id=$1 AND source_type='myw_agent_proposal'`,
      [org]
    );
    await pool.query(
      `DELETE FROM decisions WHERE organization_id=$1 AND source_type='myw_agent_proposal'`,
      [org]
    );
    await pool.query(
      `DELETE FROM notebook_pages WHERE organization_id=$1 AND source_type='myw_agent_proposal' AND materialization_provenance IS NOT NULL`,
      [org]
    );
    const countAfter = (await pool.query(predicate, [org])).rowCount ?? 0;
    const countReverted = countBefore - countAfter;

    console.log(
      `DAY157_COUNTS count_before=${countBefore} count_reverted=${countReverted} count_after=${countAfter}`
    );
    expect(new Set(beforeRows.map((row) => row.id))).toEqual(new Set(targetIds));
    expect(countBefore - countReverted).toBe(countAfter);
    expect([countBefore, countReverted, countAfter]).toEqual([3, 3, 0]);
    expect(
      (await pool.query(`SELECT count(*)::int n FROM tasks WHERE organization_id=$1`, [org]))
        .rows[0].n
    ).toBe(1);
    expect(
      (await pool.query(`SELECT count(*)::int n FROM decisions WHERE organization_id=$1`, [org]))
        .rows[0].n
    ).toBe(1);
    expect(
      (
        await pool.query(`SELECT count(*)::int n FROM notebook_pages WHERE organization_id=$1`, [
          org,
        ])
      ).rows[0].n
    ).toBe(1);
  }, 30_000);
});
