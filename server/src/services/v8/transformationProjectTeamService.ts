import { createHash } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

import { activateA06ForTenant } from './agentTenantSettingsService.js';
import {
  registerGovernedProposal,
  reviewProposalScope,
  withProposalGovernanceClient,
} from './agentProposalGovernanceService.js';
import { withPgTransaction } from '../../utils/queryHelpers.js';

type Actor = { organizationId: string; actorUserId: string; actorRole: string };
type Member = {
  kind: 'human' | 'agent';
  identityId?: string | null;
  displayName: string;
  role: string;
  authority: string[];
  autonomy?: 'prepare_only' | 'execute_with_approval' | 'bounded_autonomous';
  budgetLimit?: number | null;
  sourceRefs: string[];
};
type Blueprint = {
  sponsorUserId?: string | null;
  members: Member[];
  raci: Array<{
    workItem: string;
    responsible: string[];
    accountable: string | null;
    consulted: string[];
    informed: string[];
  }>;
  agentLimits: Record<string, { autonomy: string; budgetLimit: number | null }>;
  work: Array<{
    workItem: string;
    ownerIdentityId: string | null;
    branchStatus: string;
    estimatedCost: number | null;
    conflicts: string[];
    pendingDecisions: string[];
  }>;
};

function hash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function authority(role: string) {
  if (!['OWNER', 'ADMIN', 'SUPERADMIN'].includes(role.toUpperCase()))
    throw new Error('PROJECT_TEAM_AUTHORITY_REQUIRED');
}
function key(value: string) {
  if (value.trim().length < 8) throw new Error('PROJECT_TEAM_IDEMPOTENCY_KEY_REQUIRED');
}

async function loadCase(client: any, organizationId: string, caseId: string) {
  const row = (
    await client.query(
      `SELECT transformation_case_id,organization_id,project_id,execution_run_id,active_plan_id,version,context_snapshot_id FROM transformation_cases WHERE transformation_case_id=? AND organization_id=? FOR UPDATE`,
      [caseId, organizationId]
    )
  ).rows[0];
  if (!row?.execution_run_id || !row?.active_plan_id)
    throw new Error('PROJECT_TEAM_CANONICAL_CASE_NOT_READY');
  return row;
}
async function receipt(
  client: any,
  organizationId: string,
  idempotencyKey: string,
  digest: string
) {
  const row = (
    await client.query(
      `SELECT * FROM transformation_project_team_receipts WHERE organization_id=? AND idempotency_key=? FOR UPDATE`,
      [organizationId, idempotencyKey]
    )
  ).rows[0];
  if (row && row.request_digest !== digest) throw new Error('PROJECT_TEAM_IDEMPOTENCY_CONFLICT');
  return row;
}
async function validateHumanMembership(
  client: any,
  projectId: string | null,
  members: Member[],
  organizationId: string
) {
  const missing: string[] = [];
  for (const [index, member] of members.entries()) {
    if (member.kind === 'human' && !member.identityId) missing.push(`members.${index}.identityId`);
    if (member.kind === 'human' && member.identityId && projectId) {
      const found = (
        await client.query(
          `SELECT 1 ok FROM projects p WHERE p.id=? AND (p.owner_id=? OR EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=?))`,
          [projectId, member.identityId, member.identityId]
        )
      ).rows[0];
      if (!found) throw new Error('PROJECT_TEAM_HUMAN_NOT_PROJECT_MEMBER');
    }
    if (member.kind === 'agent' && !member.identityId) missing.push(`members.${index}.identityId`);
    if (member.kind === 'agent' && member.identityId) {
      const found = (
        await client.query(
          `SELECT 1 ok FROM wave8_agent_definitions WHERE agent_id=? AND (organization_id IS NULL OR organization_id=?)`,
          [member.identityId, organizationId]
        )
      ).rows[0];
      if (!found) throw new Error('PROJECT_TEAM_AGENT_IDENTITY_NOT_FOUND');
    }
    if (!member.authority.length) missing.push(`members.${index}.authority`);
    if (member.kind === 'agent' && member.budgetLimit == null)
      missing.push(`members.${index}.budgetLimit`);
  }
  return missing;
}

export async function proposeProjectTeam(
  input: Actor & {
    caseId: string;
    expectedCaseVersion: number;
    blueprint: Blueprint;
    idempotencyKey: string;
  }
) {
  authority(input.actorRole);
  key(input.idempotencyKey);
  const requestDigest = hash({
    action: 'propose',
    caseId: input.caseId,
    expectedCaseVersion: input.expectedCaseVersion,
    blueprint: input.blueprint,
  });
  return withPgTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext(?))`, [
      `team:${input.organizationId}:${input.caseId}`,
    ]);
    const replay = await receipt(client, input.organizationId, input.idempotencyKey, requestDigest);
    if (replay) return { ...replay.result_json, idempotentReplay: true };
    const tc = await loadCase(client, input.organizationId, input.caseId);
    if (Number(tc.version) !== input.expectedCaseVersion)
      throw new Error('PROJECT_TEAM_CASE_VERSION_CONFLICT');
    const missing = await validateHumanMembership(
      client,
      tc.project_id,
      input.blueprint.members,
      input.organizationId
    );
    if (!input.blueprint.members.some((member) => member.kind === 'human'))
      missing.push('members.humanParticipant');
    if (!input.blueprint.members.some((member) => member.kind === 'agent'))
      missing.push('members.specializedAgent');
    if (!input.blueprint.sponsorUserId) missing.unshift('sponsorUserId');
    if (input.blueprint.sponsorUserId && tc.project_id) {
      const sponsor = (
        await client.query(
          `SELECT 1 ok FROM projects p WHERE p.id=? AND (p.owner_id=? OR EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=?))`,
          [tc.project_id, input.blueprint.sponsorUserId, input.blueprint.sponsorUserId]
        )
      ).rows[0];
      if (!sponsor) throw new Error('PROJECT_TEAM_SPONSOR_NOT_PROJECT_MEMBER');
    }
    for (const [i, r] of input.blueprint.raci.entries()) {
      if (!r.accountable) missing.push(`raci.${i}.accountable`);
      if (!r.responsible.length) missing.push(`raci.${i}.responsible`);
    }
    const questions = missing.map((k) => `UNKNOWN: provide ${k}`);
    const previous = (
      await client.query<{ blueprint_id: string; max_version: number }>(
        `SELECT blueprint_id,COALESCE(MAX(blueprint_version),0)::int max_version FROM transformation_project_team_blueprints WHERE transformation_case_id=? AND organization_id=? GROUP BY blueprint_id ORDER BY max_version DESC LIMIT 1`,
        [input.caseId, input.organizationId]
      )
    ).rows[0];
    const blueprintId = previous?.blueprint_id ?? `team-${uuidv4()}`,
      version = Number(previous?.max_version ?? 0) + 1,
      blueprintVersionId = `team-version-${uuidv4()}`;
    const status = missing.length ? 'needs_clarification' : 'pending_approval';
    let governedProposalVersionId: null | string = null;
    if (!missing.length) {
      const registered = await withProposalGovernanceClient(client, () =>
        registerGovernedProposal({
          proposalId: blueprintId,
          organizationId: input.organizationId,
          canonicalRunId: tc.execution_run_id,
          planVersion: 1,
          contextDigest: hash({
            contextSnapshotId: tc.context_snapshot_id,
            caseVersion: tc.version,
          }),
          before: {},
          after: input.blueprint as any,
          approvalScopes: ['project_team'],
          reviewerAuthorityByScope: { project_team: [input.blueprint.sponsorUserId!] },
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
          actorUserId: input.actorUserId,
          changeReason: 'Teresa project team proposal',
        })
      );
      governedProposalVersionId = registered.proposalVersionId;
    }
    await client.query(
      `UPDATE transformation_project_team_blueprints SET status='superseded',updated_at=NOW() WHERE transformation_case_id=? AND status IN ('needs_clarification','pending_approval')`,
      [input.caseId]
    );
    await client.query(
      `INSERT INTO transformation_project_team_blueprints (blueprint_version_id,blueprint_id,organization_id,project_id,transformation_case_id,canonical_run_id,case_version,blueprint_version,status,sponsor_user_id,members_json,raci_json,agent_limits_json,work_json,missing_keys_json,clarification_questions_json,content_digest,governed_proposal_version_id,proposed_by_user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?::jsonb,?::jsonb,?::jsonb,?::jsonb,?::jsonb,?::jsonb,?,?,?)`,
      [
        blueprintVersionId,
        blueprintId,
        input.organizationId,
        tc.project_id,
        input.caseId,
        tc.execution_run_id,
        tc.version,
        version,
        status,
        input.blueprint.sponsorUserId ?? null,
        JSON.stringify(input.blueprint.members),
        JSON.stringify(input.blueprint.raci),
        JSON.stringify(input.blueprint.agentLimits),
        JSON.stringify(input.blueprint.work),
        JSON.stringify(missing),
        JSON.stringify(questions),
        hash(input.blueprint),
        governedProposalVersionId,
        input.actorUserId,
      ]
    );
    const result = {
      blueprintVersionId,
      blueprintId,
      version,
      status,
      missingKeys: missing,
      clarificationQuestions: questions,
      governedProposalVersionId,
      idempotentReplay: false,
    };
    await client.query(
      `INSERT INTO transformation_project_team_receipts (receipt_id,organization_id,transformation_case_id,blueprint_version_id,action,idempotency_key,request_digest,result_json,actor_user_id) VALUES (?,?,?,?,'propose',?,?,?::jsonb,?)`,
      [
        `team-receipt-${uuidv4()}`,
        input.organizationId,
        input.caseId,
        blueprintVersionId,
        input.idempotencyKey,
        requestDigest,
        JSON.stringify(result),
        input.actorUserId,
      ]
    );
    await client.query(
      `INSERT INTO transformation_project_team_audit_events VALUES (?,?,?,?,?,?,?::jsonb,NOW())`,
      [
        `team-audit-${uuidv4()}`,
        input.organizationId,
        input.caseId,
        blueprintVersionId,
        status === 'needs_clarification' ? 'clarification_required' : 'proposed',
        input.actorUserId,
        JSON.stringify({ missingKeys: missing }),
      ]
    );
    return result;
  });
}

export async function approveProjectTeam(
  input: Actor & {
    caseId: string;
    blueprintVersionId: string;
    expectedVersion: number;
    reason: string;
    idempotencyKey: string;
  }
) {
  authority(input.actorRole);
  key(input.idempotencyKey);
  const requestDigest = hash({
    action: 'approve',
    blueprintVersionId: input.blueprintVersionId,
    expectedVersion: input.expectedVersion,
    reason: input.reason,
  });
  return withPgTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext(?))`, [
      `team:${input.organizationId}:${input.caseId}`,
    ]);
    const replay = await receipt(client, input.organizationId, input.idempotencyKey, requestDigest);
    if (replay) return { ...replay.result_json, idempotentReplay: true };
    await loadCase(client, input.organizationId, input.caseId);
    const row = (
      await client.query<{
        status: string;
        blueprint_version: number;
        governed_proposal_version_id: string | null;
      }>(
        `SELECT * FROM transformation_project_team_blueprints WHERE blueprint_version_id=? AND transformation_case_id=? AND organization_id=? FOR UPDATE`,
        [input.blueprintVersionId, input.caseId, input.organizationId]
      )
    ).rows[0];
    if (
      !row ||
      row.status !== 'pending_approval' ||
      Number(row.blueprint_version) !== input.expectedVersion ||
      !row.governed_proposal_version_id
    )
      throw new Error('PROJECT_TEAM_NOT_APPROVABLE');
    const reviewed = await withProposalGovernanceClient(client, () =>
      reviewProposalScope({
        proposalVersionId: row.governed_proposal_version_id,
        organizationId: input.organizationId,
        scopeKey: 'project_team',
        decision: 'approved',
        reason: input.reason,
        actorUserId: input.actorUserId,
      })
    );
    if (reviewed.status !== 'approved') throw new Error('PROJECT_TEAM_GOVERNANCE_NOT_APPROVED');
    await client.query(
      `UPDATE transformation_project_team_blueprints SET status='approved',approved_by_user_id=?,approved_at=NOW(),updated_at=NOW() WHERE blueprint_version_id=?`,
      [input.actorUserId, input.blueprintVersionId]
    );
    const result = {
      blueprintVersionId: input.blueprintVersionId,
      status: 'approved',
      governedProposalVersionId: row.governed_proposal_version_id,
      idempotentReplay: false,
    };
    await client.query(
      `INSERT INTO transformation_project_team_receipts (receipt_id,organization_id,transformation_case_id,blueprint_version_id,action,idempotency_key,request_digest,result_json,actor_user_id) VALUES (?,?,?,?,'approve',?,?,?::jsonb,?)`,
      [
        `team-receipt-${uuidv4()}`,
        input.organizationId,
        input.caseId,
        input.blueprintVersionId,
        input.idempotencyKey,
        requestDigest,
        JSON.stringify(result),
        input.actorUserId,
      ]
    );
    await client.query(
      `INSERT INTO transformation_project_team_audit_events (event_id,organization_id,transformation_case_id,blueprint_version_id,event_type,actor_user_id,detail_json) VALUES (?,?,?,?,'approved',?,?::jsonb)`,
      [
        `team-audit-${uuidv4()}`,
        input.organizationId,
        input.caseId,
        input.blueprintVersionId,
        input.actorUserId,
        JSON.stringify({ reason: input.reason }),
      ]
    );
    return result;
  });
}

export async function activateProjectTeam(
  input: Actor & { caseId: string; blueprintVersionId: string; idempotencyKey: string }
) {
  authority(input.actorRole);
  key(input.idempotencyKey);
  const requestDigest = hash({ action: 'activate', blueprintVersionId: input.blueprintVersionId });
  const prepared = await withPgTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext(?))`, [
      `team:${input.organizationId}:${input.caseId}`,
    ]);
    const replay = await receipt(client, input.organizationId, input.idempotencyKey, requestDigest);
    if (replay) return { replay };
    const tc = await loadCase(client, input.organizationId, input.caseId);
    const row = (
      await client.query<Record<string, unknown> & { status: string }>(
        `SELECT * FROM transformation_project_team_blueprints WHERE blueprint_version_id=? AND transformation_case_id=? AND organization_id=? FOR UPDATE`,
        [input.blueprintVersionId, input.caseId, input.organizationId]
      )
    ).rows[0];
    if (!row || !['approved', 'activated'].includes(row.status))
      throw new Error('PROJECT_TEAM_APPROVAL_REQUIRED');
    return { tc, row };
  });
  if ('replay' in prepared) return { ...prepared.replay.result_json, idempotentReplay: true };
  const activation = await activateA06ForTenant({
    organizationId: input.organizationId,
    projectId: prepared.tc.project_id,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    idempotencyKey: `team:${input.idempotencyKey}`,
  });
  return withPgTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext(?))`, [
      `team:${input.organizationId}:${input.caseId}`,
    ]);
    const replay = await receipt(client, input.organizationId, input.idempotencyKey, requestDigest);
    if (replay) return { ...replay.result_json, idempotentReplay: true };
    const row = (
      await client.query<{ status: string }>(
        `SELECT status FROM transformation_project_team_blueprints WHERE blueprint_version_id=? AND organization_id=? FOR UPDATE`,
        [input.blueprintVersionId, input.organizationId]
      )
    ).rows[0];
    if (!row || !['approved', 'activated'].includes(row.status))
      throw new Error('PROJECT_TEAM_APPROVAL_REQUIRED');
    const result = {
      blueprintVersionId: input.blueprintVersionId,
      status: 'activated',
      activationReceiptId: activation.receipt_id,
      policyCount: Number(activation.policy_count),
      idempotentReplay: false,
    };
    await client.query(
      `UPDATE transformation_project_team_blueprints SET status='activated',updated_at=NOW() WHERE blueprint_version_id=?`,
      [input.blueprintVersionId]
    );
    await client.query(
      `INSERT INTO transformation_project_team_receipts (receipt_id,organization_id,transformation_case_id,blueprint_version_id,action,idempotency_key,request_digest,result_json,actor_user_id) VALUES (?,?,?,?,'activate',?,?,?::jsonb,?)`,
      [
        `team-receipt-${uuidv4()}`,
        input.organizationId,
        input.caseId,
        input.blueprintVersionId,
        input.idempotencyKey,
        requestDigest,
        JSON.stringify(result),
        input.actorUserId,
      ]
    );
    await client.query(
      `INSERT INTO transformation_project_team_audit_events (event_id,organization_id,transformation_case_id,blueprint_version_id,event_type,actor_user_id,detail_json) VALUES (?,?,?,?,'activated',?,?::jsonb)`,
      [
        `team-audit-${uuidv4()}`,
        input.organizationId,
        input.caseId,
        input.blueprintVersionId,
        input.actorUserId,
        JSON.stringify({
          activationReceiptId: activation.receipt_id,
          policyCount: activation.policy_count,
        }),
      ]
    );
    return result;
  });
}

export async function getProjectTeam(input: { organizationId: string; caseId: string }) {
  return withPgTransaction(async (client) => {
    const tc = await loadCase(client, input.organizationId, input.caseId);
    const row = (
      await client.query<Record<string, unknown>>(
        `SELECT * FROM transformation_project_team_blueprints WHERE transformation_case_id=? AND organization_id=? AND status<>'superseded' ORDER BY blueprint_version DESC LIMIT 1`,
        [input.caseId, input.organizationId]
      )
    ).rows[0];
    return row ? { ...row, project_id: tc.project_id } : null;
  });
}
