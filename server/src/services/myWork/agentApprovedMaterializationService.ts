import { createHash, randomUUID } from 'node:crypto';

import { withPgTransaction } from '../../utils/queryHelpers.js';

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

export async function getAgentPlanSourceIdentity(organizationId: string, sourcePlanId: string) {
  return withPgTransaction((tx) => sourceIdentity(tx, organizationId, sourcePlanId));
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
  return withPgTransaction(async (tx) => {
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
    if (receipt.rows[0]) return { receipt: receipt.rows[0], replayed: true };
    if (proposal.state !== 'APPROVED' || proposal.decision !== 'APPROVE' ||
        proposal.state_version !== input.expectedStateVersion) throw new Error('MYW_AGENT_MATERIALIZATION_STALE');
    if (new Date(proposal.expires_at).getTime() <= Date.now()) throw new Error('MYW_AGENT_PROPOSAL_EXPIRED');
    const actual = await sourceIdentity(tx, input.organizationId, proposal.source_plan_id);
    if (actual.sourceVersion !== Number(proposal.source_version) || actual.sourceHash !== proposal.source_hash) {
      throw new Error('MYW_AGENT_SOURCE_DRIFT');
    }
    const content = proposal.content as Record<string, unknown>;
    const title = String(content.title || '').trim();
    if (!title) throw new Error('MYW_AGENT_CONTENT_INVALID');
    const targetId = randomUUID();
    if (proposal.target_kind === 'task') {
      await tx.query(
        `INSERT INTO tasks(id,organization_id,title,description,status,priority,created_by,created_at,updated_at)
         VALUES(?,?,?,?,'todo','medium',?,now(),now())`,
        [targetId,input.organizationId,title,String(content.description || ''),proposal.requester_id]
      );
    } else if (proposal.target_kind === 'decision') {
      await tx.query(
        `INSERT INTO decisions(id,organization_id,title,description,type,status,decision_maker_id,created_by,created_at,updated_at)
         VALUES(?,?,?,?,'APPROVAL','pending',?,?,now(),now())`,
        [targetId,input.organizationId,title,String(content.description || ''),proposal.approver_id,proposal.requester_id]
      );
    } else {
      const body = String(content.body || content.description || '');
      await tx.query(
        `INSERT INTO notebook_pages(id,owner_user_id,organization_id,visibility,title,content_json,content_text,tags_json,created_at,updated_at)
         VALUES(?,?,?,'private',?,?,'','[]',now(),now())`,
        [targetId,proposal.requester_id,input.organizationId,title,JSON.stringify({ type: 'doc', content: body })]
      );
      await tx.query(`UPDATE notebook_pages SET content_text=? WHERE id=?`, [body,targetId]);
    }
    const insertedReceipt = await tx.query<any>(
      `INSERT INTO myw_agent_materialization_receipts
       (proposal_id,approval_id,organization_id,target_kind,target_id,source_hash,content_hash,materialized_by)
       VALUES(?,?,?,?,?,?,?,?) RETURNING *`,
      [proposal.proposal_id,proposal.approval_id,input.organizationId,proposal.target_kind,targetId,
        proposal.source_hash,proposal.content_hash,input.actorId]
    );
    await tx.query(
      `UPDATE myw_agent_materialization_proposals SET state='MATERIALIZED',state_version=state_version+1,updated_at=now()
       WHERE proposal_id=? AND state='APPROVED' AND state_version=?`,
      [proposal.proposal_id,input.expectedStateVersion]
    );
    return { receipt: insertedReceipt.rows[0], replayed: false };
  });
}
