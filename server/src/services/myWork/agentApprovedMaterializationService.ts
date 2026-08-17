import { createHash, randomUUID } from 'node:crypto';

import { queryOne, withPgTransaction } from '../../utils/queryHelpers.js';

export type MaterializationTarget = 'task' | 'decision' | 'notebook';

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const sha = (value: unknown) => createHash('sha256').update(typeof value === 'string' ? value : stable(value)).digest('hex');

async function requireActiveMember(tx: any, organizationId: string, userId: string) {
  const member = await tx.query(
    `SELECT 1 FROM organization_members WHERE organization_id=? AND user_id=? AND UPPER(status)='ACTIVE'`,
    [organizationId, userId]
  );
  if (!member.rows[0]) throw new Error('MYW_AGENT_ACTIVE_MEMBERSHIP_REQUIRED');
}

async function sourceIdentity(tx: any, organizationId: string, sourcePlanId: string) {
  const result = await tx.query(
    `SELECT id,organization_id,user_id,title,description,status,total_steps,completed_steps,current_step_index,
            plan_json,result_summary,error_message,is_background,scheduled_at,started_at,completed_at,created_at,updated_at,
            floor(extract(epoch FROM updated_at)*1000)::bigint AS source_version
       FROM ai_agent_plans WHERE id=? AND organization_id=?`,
    [sourcePlanId, organizationId]
  );
  const row = result.rows[0];
  if (!row) throw new Error('MYW_AGENT_SOURCE_NOT_FOUND');
  const sourceVersion = Number(row.source_version);
  delete row.source_version;
  return { sourceVersion, sourceHash: sha(row) };
}

export async function getAgentPlanSourceIdentity(organizationId: string, sourcePlanId: string, userId: string) {
  return withPgTransaction(async (tx) => {
    await requireActiveMember(tx,organizationId,userId);
    return sourceIdentity(tx, organizationId, sourcePlanId);
  });
}

export async function createMaterializationProposal(input: {
  organizationId: string; requesterId: string; sourcePlanId: string; sourceVersion: number;
  sourceHash: string; targetKind: MaterializationTarget; content: Record<string, unknown>;
  idempotencyKey: string; expiresAt: string;
}) {
  const contentHash = sha(input.content);
  const requestDigest = sha({ ...input, contentHash });
  return withPgTransaction(async (tx) => {
    await requireActiveMember(tx, input.organizationId, input.requesterId);
    await tx.query(`SELECT pg_advisory_xact_lock(hashtext(?))`,
      [`myw-agent:${input.organizationId}:${input.idempotencyKey}`]);
    const existing = await tx.query<any>(
      `SELECT * FROM myw_agent_materialization_proposals WHERE organization_id=? AND idempotency_key=?`,
      [input.organizationId, input.idempotencyKey]
    );
    if (existing.rows[0]) {
      if (existing.rows[0].request_digest !== requestDigest) throw new Error('MYW_AGENT_IDEMPOTENCY_COLLISION');
      return { proposal: existing.rows[0], replayed: true };
    }
    const actual = await sourceIdentity(tx, input.organizationId, input.sourcePlanId);
    if (actual.sourceVersion !== input.sourceVersion || actual.sourceHash !== input.sourceHash) {
      throw new Error('MYW_AGENT_SOURCE_DRIFT');
    }
    const expires = new Date(input.expiresAt);
    if (!Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now()) throw new Error('MYW_AGENT_EXPIRY_INVALID');
    const inserted = await tx.query<any>(
      `INSERT INTO myw_agent_materialization_proposals
       (organization_id,requester_id,source_plan_id,source_version,source_hash,target_kind,content,content_hash,
        idempotency_key,request_digest,expires_at)
       VALUES(?,?,?,?,?,?,?::jsonb,?,?,?,?) RETURNING *`,
      [input.organizationId,input.requesterId,input.sourcePlanId,input.sourceVersion,input.sourceHash,input.targetKind,
        JSON.stringify(input.content),contentHash,input.idempotencyKey,requestDigest,expires.toISOString()]
    );
    return { proposal: inserted.rows[0], replayed: false };
  });
}

export async function decideMaterializationProposal(input: {
  proposalId: string; organizationId: string; approverId: string; decision: 'APPROVE' | 'REJECT';
  expectedStateVersion: number; sourceHash: string;
}) {
  return withPgTransaction(async (tx) => {
    await requireActiveMember(tx, input.organizationId, input.approverId);
    const selected = await tx.query<any>(
      `SELECT * FROM myw_agent_materialization_proposals WHERE proposal_id=? AND organization_id=? FOR UPDATE`,
      [input.proposalId,input.organizationId]
    );
    const proposal = selected.rows[0];
    if (!proposal) throw new Error('MYW_AGENT_PROPOSAL_NOT_FOUND');
    if (proposal.requester_id === input.approverId) throw new Error('MYW_AGENT_SELF_APPROVAL_FORBIDDEN');
    if (proposal.source_hash !== input.sourceHash) throw new Error('MYW_AGENT_SOURCE_HASH_MISMATCH');
    if (proposal.state !== 'PENDING' || proposal.state_version !== input.expectedStateVersion) {
      throw new Error('MYW_AGENT_PROPOSAL_STALE');
    }
    const expired = new Date(proposal.expires_at).getTime() <= Date.now();
    const state = expired ? 'EXPIRED' : input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const updated = await tx.query<any>(
      `UPDATE myw_agent_materialization_proposals SET state=?,state_version=state_version+1,updated_at=now()
       WHERE proposal_id=? AND state='PENDING' AND state_version=? RETURNING *`,
      [state,input.proposalId,input.expectedStateVersion]
    );
    if (!updated.rows[0]) throw new Error('MYW_AGENT_PROPOSAL_STALE');
    if (expired) return { proposal: updated.rows[0], approval: null };
    const approval = await tx.query<any>(
      `INSERT INTO myw_agent_materialization_approvals
       (proposal_id,organization_id,approver_id,decision,proposal_state_version,source_hash)
       VALUES(?,?,?,?,?,?) RETURNING *`,
      [input.proposalId,input.organizationId,input.approverId,input.decision,updated.rows[0].state_version,input.sourceHash]
    );
    return { proposal: updated.rows[0], approval: approval.rows[0] };
  });
}

export async function materializeApprovedProposal(input: {
  proposalId: string; organizationId: string; actorId: string; expectedStateVersion: number;
}) {
  const workerId = `myw-http-${process.pid}-${randomUUID()}`;
  const claimed = await withPgTransaction(async (tx) => {
    await requireActiveMember(tx, input.organizationId, input.actorId);
    const selected = await tx.query<any>(
      `SELECT p.*,a.approval_id,a.approver_id,a.decision FROM myw_agent_materialization_proposals p
       JOIN myw_agent_materialization_approvals a ON a.proposal_id=p.proposal_id
       WHERE p.proposal_id=? AND p.organization_id=? FOR UPDATE OF p`,
      [input.proposalId,input.organizationId]
    );
    const proposal = selected.rows[0];
    if (!proposal) throw new Error('MYW_AGENT_PROPOSAL_NOT_FOUND');
    const receipt = await tx.query<any>(`SELECT * FROM myw_agent_materialization_receipts WHERE proposal_id=?`, [input.proposalId]);
    if (receipt.rows[0]?.status === 'SUCCEEDED') return { terminal: receipt.rows[0] };
    if (proposal.state !== 'APPROVED' || proposal.decision !== 'APPROVE' ||
        proposal.state_version !== input.expectedStateVersion) throw new Error('MYW_AGENT_MATERIALIZATION_STALE');
    if (new Date(proposal.expires_at).getTime() <= Date.now()) throw new Error('MYW_AGENT_PROPOSAL_EXPIRED');
    const actual = await sourceIdentity(tx, input.organizationId, proposal.source_plan_id);
    if (actual.sourceVersion !== Number(proposal.source_version) || actual.sourceHash !== proposal.source_hash) {
      throw new Error('MYW_AGENT_SOURCE_DRIFT');
    }
    if (!receipt.rows[0]) {
      await tx.query(
        `INSERT INTO myw_agent_materialization_receipts
         (proposal_id,approval_id,organization_id,target_kind,source_hash,content_hash,materialized_by,status)
         VALUES(?,?,?,?,?,?,?,'PENDING')`,
        [proposal.proposal_id,proposal.approval_id,input.organizationId,proposal.target_kind,
          proposal.source_hash,proposal.content_hash,input.actorId]
      );
    }
    const lease = await tx.query<any>(
      `UPDATE myw_agent_materialization_receipts SET status='RUNNING',lease_owner=?,lease_expires_at=now()+interval '5 minutes',updated_at=now()
       WHERE proposal_id=? AND (status IN ('PENDING','FAILED') OR (status='RUNNING' AND lease_expires_at<now())) RETURNING *`,
      [workerId,proposal.proposal_id]
    );
    if (!lease.rows[0]) return { busy: true as const };
    return { proposal, receipt: lease.rows[0] };
  });
  if ('terminal' in claimed) return { receipt: claimed.terminal, replayed: true };
  if ('busy' in claimed) {
    for (let attempt=0;attempt<250;attempt+=1) {
      const receipt = await queryOne<any>(`SELECT * FROM myw_agent_materialization_receipts WHERE proposal_id=?`,[input.proposalId]);
      if (receipt?.status === 'SUCCEEDED') return {receipt,replayed:true};
      if (receipt?.status === 'FAILED') throw new Error(receipt.last_error_code || 'MYW_AGENT_MATERIALIZATION_FAILED');
      await new Promise(resolve=>setTimeout(resolve,20));
    }
    throw new Error('MYW_AGENT_MATERIALIZATION_BUSY');
  }
  const proposal = claimed.proposal;
  const content = proposal.content as Record<string, unknown>;
  const title = String(content.title || '').trim();
  const commandKey = `myw-agent:${proposal.proposal_id}`;
  const sourceIdentityValue = `${proposal.source_plan_id}:${proposal.source_version}:${proposal.source_hash}`;
  try {
    if (!title) throw new Error('MYW_AGENT_CONTENT_INVALID');
    let targetId: string;
    if (proposal.target_kind === 'task') {
      const [{ TaskService }, { getDatabase }] = await Promise.all([
        import('../TaskService.js'), import('../../database/Database.js')
      ]);
      const task = await new TaskService(await getDatabase() as any).createTask({
        title,description:String(content.description || ''),status:'todo',priority:'medium'
      },proposal.requester_id,{idempotencyKey:commandKey,sourceType:'myw_agent_proposal',sourceId:sourceIdentityValue});
      targetId = task.id;
    } else if (proposal.target_kind === 'decision') {
      const { default: decisionService } = await import('../decisionService.js');
      const decision = await decisionService.createDecision({organizationId:input.organizationId,title,
        description:String(content.description || ''),type:'APPROVAL',decisionMakerId:proposal.approver_id,
        createdBy:proposal.requester_id,idempotencyKey:commandKey,sourceType:'myw_agent_proposal',sourceId:sourceIdentityValue});
      targetId = decision.id;
    } else {
      const { createNotebookNote } = await import('../notebookService.js');
      const note = await createNotebookNote({organizationId:input.organizationId,userId:proposal.requester_id,title,
        body:String(content.body || content.description || ''),source:'myw_agent_proposal',proposalId:proposal.proposal_id,
        idempotencyKey:commandKey,sourceIdentity:sourceIdentityValue});
      targetId = note.id;
    }
    const outputDigest = sha({targetKind:proposal.target_kind,targetId,commandVersion:1});
    const completed = await withPgTransaction(async (tx) => {
      const receipt = await tx.query<any>(
        `UPDATE myw_agent_materialization_receipts SET status='SUCCEEDED',target_id=?,output_digest=?,last_error_code=NULL,
         lease_owner=NULL,lease_expires_at=NULL,updated_at=now() WHERE proposal_id=? AND status='RUNNING' AND lease_owner=? RETURNING *`,
        [targetId,outputDigest,proposal.proposal_id,workerId]
      );
      if (!receipt.rows[0]) throw new Error('MYW_AGENT_MATERIALIZATION_LEASE_LOST');
      await tx.query(`UPDATE myw_agent_materialization_proposals SET state='MATERIALIZED',state_version=state_version+1,updated_at=now()
        WHERE proposal_id=? AND state='APPROVED' AND state_version=?`,[proposal.proposal_id,input.expectedStateVersion]);
      return receipt.rows[0];
    });
    return {receipt:completed,replayed:false};
  } catch (error) {
    await withPgTransaction(async (tx) => tx.query(
      `UPDATE myw_agent_materialization_receipts SET status='FAILED',last_error_code=?,lease_owner=NULL,lease_expires_at=NULL,updated_at=now()
       WHERE proposal_id=? AND status='RUNNING' AND lease_owner=?`,
      [String(error instanceof Error ? error.message : error).slice(0,128),proposal.proposal_id,workerId]
    ));
    throw error;
  }
}
