import { createHash } from 'node:crypto';

import { executeInitiativeTransition } from '../initiative/initiativeTransitionService.js';
import {
  recordInitiativeLifecycleGateDecision,
  type InitiativeLifecycleGateDomain,
} from '../initiative/initiativeLifecycleGateDecisionService.js';
import { withPgTransaction } from '../../utils/queryHelpers.js';
import {
  registerGovernedProposal,
  reviewProposalScope,
  withProposalGovernanceClient,
} from './agentProposalGovernanceService.js';
import { dispatchAgentAdapter } from './agentAdapterOrchestratorService.js';
import { loadTransformationAgentExecutionContext } from './transformationAgentExecutionContextService.js';

type LifecycleTarget = 'SCHEDULED' | 'EXECUTING' | 'DONE';
export type ApprovedLifecycleTarget = 'PROMOTED' | 'PLANNING' | LifecycleTarget;

const APPROVED_DOMAIN_BY_TARGET: Record<ApprovedLifecycleTarget, InitiativeLifecycleGateDomain> = {
  PROMOTED: 'GOVERNANCE_DECISION_MAKING',
  PLANNING: 'RESOURCE_RESPONSIBILITY',
  SCHEDULED: 'SCHEDULE_MILESTONES',
  EXECUTING: 'GOVERNANCE_DECISION_MAKING',
  DONE: 'CLOSURE',
};
const APPROVED_EXPECTED_BY_TARGET: Record<ApprovedLifecycleTarget, string> = {
  PROMOTED: 'REVIEW',
  PLANNING: 'PROMOTED',
  SCHEDULED: 'APPROVED',
  EXECUTING: 'SCHEDULED',
  DONE: 'EXECUTING',
};

const DOMAIN_BY_TARGET: Record<LifecycleTarget, InitiativeLifecycleGateDomain> = {
  SCHEDULED: 'SCHEDULE_MILESTONES',
  EXECUTING: 'GOVERNANCE_DECISION_MAKING',
  DONE: 'CLOSURE',
};

const EXPECTED_BY_TARGET: Record<LifecycleTarget, string> = {
  SCHEDULED: 'APPROVED',
  EXECUTING: 'SCHEDULED',
  DONE: 'EXECUTING',
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

const digest = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');

export interface ProposeEarlyInitiativeTransitionInput {
  organizationId: string;
  transformationCaseId: string;
  initiativeId: string;
  proposerUserId: string;
  reviewerUserId: string;
  targetStatus: ApprovedLifecycleTarget;
  reason: string;
}

/** Propose only. Approval remains exclusively owned by the generic A05 review boundary. */
export async function proposeEarlyInitiativeTransition(input: ProposeEarlyInitiativeTransitionInput) {
  if (input.proposerUserId === input.reviewerUserId)
    throw new Error('initiative_lifecycle_self_review_denied');
  const context = await loadTransformationAgentExecutionContext({
    transformationCaseId: input.transformationCaseId,
    organizationId: input.organizationId,
    actorUserId: input.proposerUserId,
  });
  const expectedStatus = APPROVED_EXPECTED_BY_TARGET[input.targetStatus];
  const domain = APPROVED_DOMAIN_BY_TARGET[input.targetStatus];
  const scopeKey = `initiative_lifecycle:${domain.toLowerCase()}`;
  return withPgTransaction(async (client) => {
    const current = (
      await client.query<any>(
        `SELECT c.version case_version,p.version plan_version,c.context_snapshot_id,i.status,
                i.planned_start_date,i.planned_end_date,i.schedule_baseline_id,i.baseline_version
           FROM transformation_cases c
           JOIN transformation_plans p ON p.plan_id=c.active_plan_id
            AND p.transformation_case_id=c.transformation_case_id AND p.organization_id=c.organization_id
           JOIN transformation_case_artifact_links l ON l.transformation_case_id=c.transformation_case_id
            AND l.organization_id=c.organization_id AND l.artifact_type='initiative' AND l.artifact_id=?
           JOIN initiatives i ON i.id=l.artifact_id AND i.organization_id=c.organization_id
          WHERE c.transformation_case_id=? AND c.organization_id=?
            AND EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id=c.project_id AND pm.user_id=?)
            AND EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id=c.organization_id
                         AND om.user_id=? AND UPPER(om.status)='ACTIVE')
          FOR SHARE OF c,p,l,i`,
        [input.initiativeId, input.transformationCaseId, input.organizationId, input.proposerUserId, input.reviewerUserId]
      )
    ).rows[0];
    if (!current) throw new Error('initiative_lifecycle_authority_required');
    if (String(current.status).toUpperCase() !== expectedStatus)
      throw new Error('initiative_lifecycle_expected_status_drift');
    const milestoneRows = input.targetStatus === 'SCHEDULED'
      ? (await client.query<any>(
          `SELECT id,target_date FROM initiative_milestones
            WHERE initiative_id=? AND organization_id=? ORDER BY id`,
          [input.initiativeId, input.organizationId]
        )).rows
      : [];
    if (input.targetStatus === 'SCHEDULED' &&
        (!current.planned_start_date || !current.planned_end_date || milestoneRows.length === 0))
      throw new Error('initiative_schedule_exact_baseline_required');
    const baselineRefs = input.targetStatus === 'SCHEDULED'
      ? milestoneRows.map((row: any) => `milestone:${row.id}:${String(row.target_date)}`)
      : input.targetStatus === 'EXECUTING' || input.targetStatus === 'DONE'
        ? [`schedule-baseline:${String(current.schedule_baseline_id ?? '')}:v${Number(current.baseline_version ?? 0)}`]
        : [
            `transformation-case:${input.transformationCaseId}:v${Number(current.case_version)}`,
            `initiative:${input.initiativeId}:${expectedStatus}`,
          ];
    if (baselineRefs.some((ref: string) => ref.includes('::')))
      throw new Error('initiative_lifecycle_baseline_reference_required');
    const payload = {
      transformationCaseId: input.transformationCaseId,
      initiativeId: input.initiativeId,
      expectedStatus,
      targetStatus: input.targetStatus,
      pmoDomain: domain,
      sourceCaseVersion: Number(current.case_version),
      baselineRefs,
    };
    const sourceDigest = digest(payload);
    const proposalId = `t01-lifecycle:${input.transformationCaseId}:${domain}:${sourceDigest}`;
    const governed = await withProposalGovernanceClient(client, () =>
      registerGovernedProposal({
        proposalId,
        organizationId: input.organizationId,
        canonicalRunId: context.canonicalRunId,
        planVersion: Number(current.plan_version),
        contextDigest: digest({ transformationCaseId: input.transformationCaseId, contextSnapshotId: current.context_snapshot_id }),
        before: { status: expectedStatus },
        after: payload,
        approvalScopes: [scopeKey],
        reviewerAuthorityByScope: { [scopeKey]: [input.reviewerUserId] },
        expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        actorUserId: input.proposerUserId,
        changeReason: input.reason,
      })
    );
    return { ...payload, proposalVersionId: governed.proposalVersionId, scopeKey, sourceDigest };
  });
}

export interface ExecuteApprovedEarlyInitiativeTransitionInput {
  organizationId: string;
  initiativeId: string;
  proposalVersionId: string;
  reviewerUserId: string;
  reviewerRole: string;
  reason: string;
}

/** Consumes an already-approved exact A05 review; never creates or approves one. */
export async function executeApprovedEarlyInitiativeTransition(input: ExecuteApprovedEarlyInitiativeTransitionInput) {
  const pins = await withPgTransaction(async (client) => {
    const row = (
      await client.query<any>(
        `SELECT p.after_json,p.expires_at,r.review_id,r.reviewed_by_user_id
           FROM v8_agent_proposal_versions p
           JOIN v8_agent_proposal_scope_reviews r ON r.proposal_version_id=p.proposal_version_id
          WHERE p.proposal_version_id=? AND p.organization_id=? AND p.status='approved'
            AND r.decision='approved' AND r.reviewed_by_user_id=? FOR SHARE OF p,r`,
        [input.proposalVersionId, input.organizationId, input.reviewerUserId]
      )
    ).rows[0];
    if (!row) throw new Error('initiative_lifecycle_approved_review_required');
    if (new Date(row.expires_at).getTime() <= Date.now()) throw new Error('initiative_lifecycle_proposal_expired');
    const payload = row.after_json as any;
    if (String(payload.initiativeId) !== input.initiativeId)
      throw new Error('initiative_lifecycle_proposal_target_mismatch');
    const targetStatus = payload.targetStatus as ApprovedLifecycleTarget;
    if (!APPROVED_DOMAIN_BY_TARGET[targetStatus] || payload.pmoDomain !== APPROVED_DOMAIN_BY_TARGET[targetStatus])
      throw new Error('initiative_lifecycle_proposal_target_invalid');
    const expectedDigest = digest(payload);
    return { payload, sourceDigest: expectedDigest, reviewId: String(row.review_id), expiresAt: new Date(row.expires_at).toISOString(), scopeKey: `initiative_lifecycle:${payload.pmoDomain.toLowerCase()}` };
  });
  const deferred: Array<() => Promise<void>> = [];
  const { gate, transition } = await withPgTransaction(async (client) => {
    const gate = await recordInitiativeLifecycleGateDecision(client, {
      organizationId: input.organizationId,
      initiativeId: pins.payload.initiativeId,
      transformationCaseId: pins.payload.transformationCaseId,
      pmoDomain: pins.payload.pmoDomain,
      decisionStatus: 'approved',
      sourceDigest: pins.sourceDigest,
      sourceCaseVersion: pins.payload.sourceCaseVersion,
      baselineRefs: pins.payload.baselineRefs,
      a05ProposalVersionId: input.proposalVersionId,
      a05ApprovalReceiptRef: pins.reviewId,
      humanActorUserId: input.reviewerUserId,
      humanAuthorityRef: pins.scopeKey,
      rationale: input.reason,
      deadlineAt: pins.expiresAt,
      idempotencyKey: `initiative-lifecycle:${pins.payload.initiativeId}:${pins.payload.pmoDomain}:${pins.sourceDigest}`,
    });
    const transition = await executeInitiativeTransition({
      orgId: input.organizationId,
      initiativeId: pins.payload.initiativeId,
      actorId: input.reviewerUserId,
      actorRole: input.reviewerRole,
      nextStatusInput: pins.payload.targetStatus,
      expectedCurrentStatus: pins.payload.expectedStatus,
      reason: input.reason,
      transactionClient: client,
      deferPostCommitEffect: (effect) => deferred.push(effect),
    });
    if (!transition.ok) throw new Error(`initiative_transition_denied:${JSON.stringify(transition.body)}`);
    return { gate, transition };
  });
  await Promise.allSettled(deferred.map((effect) => effect()));
  return { gateDecisionId: gate.decision.decisionId, transition, idempotentReplay: gate.idempotentReplay };
}

export interface GovernedInitiativeTransitionInput {
  organizationId: string;
  transformationCaseId: string;
  initiativeId: string;
  actorUserId: string;
  actorRole: string;
  targetStatus: LifecycleTarget;
  reason: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
}

/**
 * Human-triggered T01 lifecycle boundary. Common A05 owns approval, A06 owns
 * mutation dispatch, the canonical gate owner owns the immutable decision and
 * InitiativeTransitionService remains the sole status/history writer.
 */
export async function executeGovernedInitiativeTransition(
  input: GovernedInitiativeTransitionInput
) {
  const context = await loadTransformationAgentExecutionContext({
    transformationCaseId: input.transformationCaseId,
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
  });
  const targetStatus = input.targetStatus;
  const domain = DOMAIN_BY_TARGET[targetStatus];
  const expectedStatus = EXPECTED_BY_TARGET[targetStatus];
  const scopeKey = `initiative_lifecycle:${domain.toLowerCase()}`;

  const pins = await withPgTransaction(async (client) => {
    const current = (
      await client.query<any>(
        `SELECT c.version case_version,p.version plan_version,c.context_snapshot_id,
                i.status,i.planned_start_date,i.planned_end_date,i.schedule_baseline_id,
                i.baseline_version
           FROM transformation_cases c
           JOIN transformation_plans p ON p.plan_id=c.active_plan_id
            AND p.transformation_case_id=c.transformation_case_id
            AND p.organization_id=c.organization_id
           JOIN transformation_case_artifact_links l
             ON l.transformation_case_id=c.transformation_case_id
            AND l.organization_id=c.organization_id
            AND l.artifact_type='initiative' AND l.artifact_id=?
           JOIN initiatives i ON i.id=l.artifact_id AND i.organization_id=c.organization_id
          WHERE c.transformation_case_id=? AND c.organization_id=?
            AND EXISTS (SELECT 1 FROM project_members pm
                         WHERE pm.project_id=c.project_id AND pm.user_id=?)
          FOR UPDATE OF i`,
        [input.initiativeId, input.transformationCaseId, input.organizationId, input.actorUserId]
      )
    ).rows[0];
    if (!current) throw new Error('initiative_lifecycle_authority_required');
    if (String(current.status).toUpperCase() !== expectedStatus)
      throw new Error('initiative_lifecycle_expected_status_drift');

    const milestoneRows = (
      await client.query<any>(
        `SELECT id,target_date,status FROM initiative_milestones
          WHERE initiative_id=? AND organization_id=? ORDER BY id`,
        [input.initiativeId, input.organizationId]
      )
    ).rows;
    const plannedStartDate = input.plannedStartDate ?? current.planned_start_date;
    const plannedEndDate = input.plannedEndDate ?? current.planned_end_date;
    const baselineRefs =
      targetStatus === 'SCHEDULED'
        ? milestoneRows.map((row: any) => `milestone:${row.id}:${String(row.target_date)}`)
        : [
            `schedule-baseline:${String(current.schedule_baseline_id ?? '')}:v${Number(current.baseline_version ?? 0)}`,
          ];
    if (
      targetStatus === 'SCHEDULED' &&
      (!plannedStartDate || !plannedEndDate || !milestoneRows.length)
    )
      throw new Error('initiative_schedule_exact_baseline_required');
    if (baselineRefs.some((ref: string) => ref.includes('::')))
      throw new Error('initiative_lifecycle_baseline_reference_required');

    const payload = {
      transformationCaseId: input.transformationCaseId,
      initiativeId: input.initiativeId,
      expectedStatus,
      targetStatus,
      plannedStartDate: plannedStartDate ? String(plannedStartDate).slice(0, 10) : null,
      plannedEndDate: plannedEndDate ? String(plannedEndDate).slice(0, 10) : null,
      milestoneIds: milestoneRows.map((row: any) => String(row.id)),
      baselineRefs,
      sourceCaseVersion: Number(current.case_version),
    };
    const sourceDigest = digest(payload);
    const proposalId = `t01-lifecycle:${input.transformationCaseId}:${domain}:${sourceDigest}`;
    const existingGoverned = (
      await client.query<{ proposal_version_id: string }>(
        `SELECT proposal_version_id FROM v8_agent_proposal_versions
          WHERE proposal_id=? AND organization_id=? AND status='approved'
          ORDER BY proposal_version DESC LIMIT 1 FOR SHARE`,
        [proposalId, input.organizationId]
      )
    ).rows[0];
    const governed = existingGoverned
      ? { proposalVersionId: existingGoverned.proposal_version_id }
      : await withProposalGovernanceClient(client, () =>
          registerGovernedProposal({
            proposalId,
            organizationId: input.organizationId,
            canonicalRunId: context.canonicalRunId,
            planVersion: Number(current.plan_version),
            contextDigest: digest({
              transformationCaseId: input.transformationCaseId,
              contextSnapshotId: current.context_snapshot_id,
            }),
            before: { status: expectedStatus },
            after: payload,
            approvalScopes: [scopeKey],
            reviewerAuthorityByScope: { [scopeKey]: [input.actorUserId] },
            expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
            actorUserId: input.actorUserId,
            changeReason: input.reason,
          })
        );
    if (!existingGoverned) {
      await withProposalGovernanceClient(client, () =>
        reviewProposalScope({
          proposalVersionId: governed.proposalVersionId,
          organizationId: input.organizationId,
          scopeKey,
          decision: 'approved',
          reason: input.reason,
          actorUserId: input.actorUserId,
        })
      );
    }
    const review = (
      await client.query<any>(
        `SELECT review_id FROM v8_agent_proposal_scope_reviews
          WHERE proposal_version_id=? AND scope_key=? AND decision='approved'`,
        [governed.proposalVersionId, scopeKey]
      )
    ).rows[0];
    if (!review) throw new Error('initiative_lifecycle_a05_receipt_missing');
    const proposalExpiry = (
      await client.query<{ expires_at: string }>(
        `SELECT expires_at FROM v8_agent_proposal_versions
          WHERE proposal_version_id=? AND organization_id=?`,
        [governed.proposalVersionId, input.organizationId]
      )
    ).rows[0];
    if (!proposalExpiry) throw new Error('initiative_lifecycle_a05_proposal_missing');
    return {
      payload,
      sourceDigest,
      proposalVersionId: governed.proposalVersionId,
      reviewId: String(review.review_id),
      scopeKey,
      baselineRefs,
      sourceCaseVersion: Number(current.case_version),
      plannedStartDate: payload.plannedStartDate,
      plannedEndDate: payload.plannedEndDate,
      deadlineAt: new Date(proposalExpiry.expires_at).toISOString(),
    };
  });

  return dispatchAgentAdapter({
    canonicalRunId: context.canonicalRunId,
    organizationId: input.organizationId,
    transformationCaseId: input.transformationCaseId,
    actorUserId: input.actorUserId,
    agentId: context.agentId,
    toolName: 'transformation.initiative_lifecycle.transition',
    projectId: context.projectId,
    idempotencyKey: `initiative-lifecycle:${input.initiativeId}:${domain}:${pins.sourceDigest}`,
    payload: pins.payload,
    adapter: {
      key: 'transformation.initiative_lifecycle.transition',
      compensationPolicy: 'manual_repair',
      execute: async () => {
        const gate = await withPgTransaction(async (client) => {
          await client.query(`SELECT pg_advisory_xact_lock(hashtext(?),hashtext(?))`, [
            input.organizationId,
            input.initiativeId,
          ]);
          if (targetStatus === 'SCHEDULED') {
            await client.query(
              `UPDATE initiatives SET planned_start_date=?,planned_end_date=?,updated_at=NOW()
                WHERE id=? AND organization_id=? AND UPPER(status)='APPROVED'`,
              [pins.plannedStartDate, pins.plannedEndDate, input.initiativeId, input.organizationId]
            );
          }
          return recordInitiativeLifecycleGateDecision(client, {
            organizationId: input.organizationId,
            initiativeId: input.initiativeId,
            transformationCaseId: input.transformationCaseId,
            pmoDomain: domain,
            decisionStatus: 'approved',
            sourceDigest: pins.sourceDigest,
            sourceCaseVersion: pins.sourceCaseVersion,
            baselineRefs: pins.baselineRefs,
            a05ProposalVersionId: pins.proposalVersionId,
            a05ApprovalReceiptRef: pins.reviewId,
            humanActorUserId: input.actorUserId,
            humanAuthorityRef: pins.scopeKey,
            rationale: input.reason,
            deadlineAt: pins.deadlineAt,
            idempotencyKey: `initiative-lifecycle:${input.initiativeId}:${domain}:${pins.sourceDigest}`,
          });
        });
        const transition = await executeInitiativeTransition({
          orgId: input.organizationId,
          initiativeId: input.initiativeId,
          actorId: input.actorUserId,
          actorRole: input.actorRole,
          nextStatusInput: targetStatus,
          expectedCurrentStatus: expectedStatus,
          reason: input.reason,
        });
        if (transition.ok === false)
          throw new Error(`initiative_transition_denied:${JSON.stringify(transition.body)}`);
        return {
          artifactType: 'initiative',
          artifactId: input.initiativeId,
          module: 'initiatives',
          operation: `transition:${expectedStatus}->${targetStatus}`,
          data: {
            gateDecisionId: gate.decision.decisionId,
            correlationId: transition.correlationId,
          },
        };
      },
      readback: async () => {
        return withPgTransaction(async (client) => {
          const row = (
            await client.query<any>(
              `SELECT status,baseline_version,schedule_baseline_id FROM initiatives
                WHERE id=? AND organization_id=?`,
              [input.initiativeId, input.organizationId]
            )
          ).rows[0];
          return row && String(row.status).toUpperCase() === targetStatus ? row : null;
        });
      },
    },
  });
}
