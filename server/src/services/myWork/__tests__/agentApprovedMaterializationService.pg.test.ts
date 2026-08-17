/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const enabled = process.env.RUN_DB_TESTS === '1';

describe.skipIf(!enabled)('MYW-AGT-BVP approved materialization — real PG', () => {
  const tag = randomUUID();
  const org = `org-${tag}`;
  const requester = `requester-${tag}`;
  const approver = `approver-${tag}`;
  const revoked = `revoked-${tag}`;
  const plan = `plan-${tag}`;
  const expiresAt = new Date(Date.now()+3_600_000).toISOString();
  let pool: Pool;
  let service: typeof import('../agentApprovedMaterializationService.js');
  let sourceVersion: number;
  let sourceHash: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(`INSERT INTO organizations(id,name,plan,status) VALUES($1,'MYW AGT','enterprise','active')`, [org]);
    for (const [user, status] of [[requester,'ACTIVE'],[approver,'ACTIVE'],[revoked,'INACTIVE']]) {
      await pool.query(`INSERT INTO users(id,organization_id,email,password,role,status) VALUES($1,$2,$3,'unused','OWNER','active')`,
        [user,org,`${user}@test.local`]);
      await pool.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES($1,$2,$3,'OWNER',$4)`,
        [randomUUID(),org,user,status]);
    }
    await pool.query(`INSERT INTO ai_agent_plans(id,organization_id,user_id,title,plan_json,updated_at) VALUES($1,$2,$3,'Source','[]',date_trunc('milliseconds',now()))`,
      [plan,org,requester]);
    service = await import('../agentApprovedMaterializationService.js');
    ({ sourceVersion, sourceHash } = await service.getAgentPlanSourceIdentity(org, plan));
  });

  afterAll(async () => {
    await pool.query(`ALTER TABLE myw_agent_materialization_receipts DISABLE TRIGGER trg_myw_agent_receipt_append_only`);
    await pool.query(`ALTER TABLE myw_agent_materialization_approvals DISABLE TRIGGER trg_myw_agent_approval_append_only`);
    await pool.query(`ALTER TABLE myw_agent_materialization_proposals DISABLE TRIGGER trg_myw_agent_proposal_guard`);
    await pool.query(`DELETE FROM myw_agent_materialization_receipts WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM myw_agent_materialization_approvals WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM myw_agent_materialization_proposals WHERE organization_id=$1`, [org]);
    await pool.query(`ALTER TABLE myw_agent_materialization_receipts ENABLE TRIGGER trg_myw_agent_receipt_append_only`);
    await pool.query(`ALTER TABLE myw_agent_materialization_approvals ENABLE TRIGGER trg_myw_agent_approval_append_only`);
    await pool.query(`ALTER TABLE myw_agent_materialization_proposals ENABLE TRIGGER trg_myw_agent_proposal_guard`);
    await pool.query(`DELETE FROM tasks WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM decisions WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM notebook_pages WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM ai_agent_plans WHERE id=$1`, [plan]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM users WHERE organization_id=$1`, [org]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [org]);
    await pool.end();
  });

  const request = (targetKind: 'task'|'decision'|'notebook', key: string, content: Record<string,unknown> = { title: `${targetKind} title`, description: 'approved body' }) =>
    ({ organizationId: org,requesterId: requester,sourcePlanId: plan,sourceVersion,sourceHash,targetKind,content,
      idempotencyKey: key,expiresAt });

  it.each(['task','decision','notebook'] as const)('materializes one real canonical %s through separate approval and receipt', async (kind) => {
    const created = await service.createMaterializationProposal(request(kind, `${kind}-${tag}`));
    await expect(service.decideMaterializationProposal({ proposalId: created.proposal.proposal_id,organizationId: org,
      approverId: requester,decision:'APPROVE',expectedStateVersion:1,sourceHash })).rejects.toThrow('SELF_APPROVAL');
    const decided = await service.decideMaterializationProposal({ proposalId: created.proposal.proposal_id,organizationId: org,
      approverId: approver,decision:'APPROVE',expectedStateVersion:1,sourceHash });
    const eight = await Promise.all(Array.from({length:8},()=>service.materializeApprovedProposal({ proposalId: created.proposal.proposal_id,
      organizationId:org,actorId:approver,expectedStateVersion:2 })));
    expect(new Set(eight.map(x=>x.receipt.target_id)).size).toBe(1);
    const target = kind === 'task' ? 'tasks' : kind === 'decision' ? 'decisions' : 'notebook_pages';
    expect((await pool.query(`SELECT count(*)::int n FROM ${target} WHERE id=$1`, [eight[0].receipt.target_id])).rows[0].n).toBe(1);
    expect(decided.approval.approver_id).toBe(approver);
  });

  it('converges 8-way proposal replay, rejects collision, stale, revoked, rejected and append-only mutation', async () => {
    const input = request('task', `eight-${tag}`);
    const results = await Promise.all(Array.from({length:8},()=>service.createMaterializationProposal(input)));
    expect(new Set(results.map(x=>x.proposal.proposal_id)).size).toBe(1);
    await expect(service.createMaterializationProposal({...input,content:{title:'changed'}})).rejects.toThrow('COLLISION');
    const proposalId = results[0].proposal.proposal_id;
    await expect(service.decideMaterializationProposal({proposalId,organizationId:org,approverId:revoked,decision:'APPROVE',expectedStateVersion:1,sourceHash}))
      .rejects.toThrow('MEMBERSHIP');
    await service.decideMaterializationProposal({proposalId,organizationId:org,approverId:approver,decision:'REJECT',expectedStateVersion:1,sourceHash});
    await expect(service.materializeApprovedProposal({proposalId,organizationId:org,actorId:approver,expectedStateVersion:2})).rejects.toThrow();
    expect((await pool.query(`SELECT count(*)::int n FROM myw_agent_materialization_receipts WHERE proposal_id=$1`,[proposalId])).rows[0].n).toBe(0);
    await expect(pool.query(`UPDATE myw_agent_materialization_approvals SET decision='APPROVE' WHERE proposal_id=$1`,[proposalId])).rejects.toThrow(/append.only/i);
    await expect(pool.query(`DELETE FROM myw_agent_materialization_approvals WHERE proposal_id=$1`,[proposalId])).rejects.toThrow(/append.only/i);
    await expect(pool.query(`DELETE FROM myw_agent_materialization_proposals WHERE proposal_id=$1`,[proposalId])).rejects.toThrow(/append.only/i);
  });

  it('fails closed on source drift and writer failure without a false receipt, including cold readback', async () => {
    const drift = await service.createMaterializationProposal(request('task',`drift-${tag}`));
    await service.decideMaterializationProposal({proposalId:drift.proposal.proposal_id,organizationId:org,approverId:approver,
      decision:'APPROVE',expectedStateVersion:1,sourceHash});
    await pool.query(`UPDATE ai_agent_plans SET title='drifted',updated_at=updated_at+interval '1 second' WHERE id=$1`,[plan]);
    await expect(service.materializeApprovedProposal({proposalId:drift.proposal.proposal_id,organizationId:org,actorId:approver,expectedStateVersion:2}))
      .rejects.toThrow('SOURCE_DRIFT');
    expect((await pool.query(`SELECT count(*)::int n FROM myw_agent_materialization_receipts WHERE proposal_id=$1`,[drift.proposal.proposal_id])).rows[0].n).toBe(0);
    const cold = new Pool({connectionString:process.env.DATABASE_URL,max:1});
    expect((await cold.query(`SELECT state FROM myw_agent_materialization_proposals WHERE proposal_id=$1`,[drift.proposal.proposal_id])).rows[0].state).toBe('APPROVED');
    await cold.end();

    const current = await service.getAgentPlanSourceIdentity(org,plan);
    const invalid = await service.createMaterializationProposal({ ...request('task',`writer-fail-${tag}`,{title:''}),
      sourceVersion:current.sourceVersion,sourceHash:current.sourceHash });
    await service.decideMaterializationProposal({proposalId:invalid.proposal.proposal_id,organizationId:org,approverId:approver,
      decision:'APPROVE',expectedStateVersion:1,sourceHash:current.sourceHash});
    await expect(service.materializeApprovedProposal({proposalId:invalid.proposal.proposal_id,organizationId:org,actorId:approver,expectedStateVersion:2}))
      .rejects.toThrow('CONTENT_INVALID');
    expect((await pool.query(`SELECT count(*)::int n FROM myw_agent_materialization_receipts WHERE proposal_id=$1`,[invalid.proposal.proposal_id])).rows[0].n).toBe(0);

    const expired = await service.createMaterializationProposal({ ...request('notebook',`expired-${tag}`),
      sourceVersion:current.sourceVersion,sourceHash:current.sourceHash,expiresAt:new Date(Date.now()+25).toISOString() });
    await new Promise(resolve=>setTimeout(resolve,40));
    const expiredDecision = await service.decideMaterializationProposal({proposalId:expired.proposal.proposal_id,organizationId:org,
      approverId:approver,decision:'APPROVE',expectedStateVersion:1,sourceHash:current.sourceHash});
    expect(expiredDecision.proposal.state).toBe('EXPIRED');
    expect(expiredDecision.approval).toBeNull();
  });
});
