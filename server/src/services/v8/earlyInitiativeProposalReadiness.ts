import type { PgTransactionClient } from '../../utils/queryHelpers.js';
import { loadTransformationAgentExecutionContext } from './transformationAgentExecutionContextService.js';
import { resolveInitiativeLifecycleStage } from '../../constants/initiativeLifecycleStages.js';
import { resolveInitiativeStageForRow } from '../initiative/initiativeLifecycleCanon.js';
import type { ProposeEarlyInitiativeTransitionInput } from './transformationInitiativeTransitionAdapterService.js';
import type { ApprovedLifecycleTarget } from './transformationInitiativeTransitionAdapterService.js';
import type { InitiativeLifecycleGateDomain } from '../initiative/initiativeLifecycleGateDecisionService.js';
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

function matchesExpectedStage(
  row: { status?: unknown; lifecycle_state?: unknown },
  expected: string
): boolean {
  const expectedStage = resolveInitiativeLifecycleStage(expected);
  if (!expectedStage) return false;
  const actualStage = resolveInitiativeStageForRow({
    aggregateLifecycleState: row.lifecycle_state == null ? null : String(row.lifecycle_state),
    dbStatus: row.status,
  });
  return actualStage === expectedStage;
}

export async function readEarlyInitiativeProposalReadiness(
  client: PgTransactionClient,
  input: ProposeEarlyInitiativeTransitionInput
) {
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
  const current = (
    await client.query<any>(
      `SELECT c.version case_version,p.version plan_version,c.context_snapshot_id,i.status,
                i.planned_start_date,i.planned_end_date,i.schedule_baseline_id,i.baseline_version,
                agg.payload_json->>'lifecycleState' AS lifecycle_state
           FROM transformation_cases c
           LEFT JOIN transformation_plans p ON p.plan_id=c.active_plan_id
            AND p.transformation_case_id=c.transformation_case_id AND p.organization_id=c.organization_id
           JOIN transformation_case_artifact_links l ON l.transformation_case_id=c.transformation_case_id
            AND l.organization_id=c.organization_id AND l.artifact_type='initiative' AND l.artifact_id=?
           JOIN initiatives i ON i.id=l.artifact_id AND i.organization_id=c.organization_id
           LEFT JOIN ie_aggregate_state agg ON agg.organization_id=i.organization_id
            AND agg.aggregate_type='initiative' AND agg.aggregate_id=i.id
          WHERE c.transformation_case_id=? AND c.organization_id=?
            AND EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id=c.project_id AND pm.user_id=?)
            AND EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id=c.organization_id
                         AND om.user_id=? AND UPPER(om.status)='ACTIVE')
            AND EXISTS (SELECT 1 FROM project_members reviewer_pm
                         WHERE reviewer_pm.project_id=c.project_id AND reviewer_pm.user_id=?
                           AND UPPER(reviewer_pm.project_role) IN ('PROJECT_SPONSOR','STEERING_COMMITTEE'))
          FOR SHARE OF c,l,i`,
      [
        input.initiativeId,
        input.transformationCaseId,
        input.organizationId,
        input.proposerUserId,
        input.reviewerUserId,
        input.reviewerUserId,
      ]
    )
  ).rows[0];
  if (!current) throw new Error('initiative_lifecycle_authority_required');
  if (current.plan_version == null) throw new Error('initiative_transition_plan_missing');
  if (!matchesExpectedStage(current, expectedStatus))
    throw new Error('initiative_lifecycle_expected_status_drift');
  const milestoneRows =
    input.targetStatus === 'SCHEDULED'
      ? (
          await client.query<any>(
            `SELECT id,target_date FROM initiative_milestones
            WHERE initiative_id=? AND organization_id=? ORDER BY id`,
            [input.initiativeId, input.organizationId]
          )
        ).rows
      : [];
  if (
    input.targetStatus === 'SCHEDULED' &&
    (!current.planned_start_date || !current.planned_end_date || milestoneRows.length === 0)
  )
    throw new Error('initiative_schedule_exact_baseline_required');
  const baselineRefs =
    input.targetStatus === 'SCHEDULED'
      ? milestoneRows.map((row: any) => `milestone:${row.id}:${String(row.target_date)}`)
      : input.targetStatus === 'EXECUTING' || input.targetStatus === 'DONE'
        ? [
            `schedule-baseline:${String(current.schedule_baseline_id ?? '')}:v${Number(current.baseline_version ?? 0)}`,
          ]
        : [
            `transformation-case:${input.transformationCaseId}:v${Number(current.case_version)}`,
            `initiative:${input.initiativeId}:${expectedStatus}`,
          ];
  if (baselineRefs.some((ref: string) => ref.includes('::')))
    throw new Error('initiative_lifecycle_baseline_reference_required');

  return { context, expectedStatus, domain, scopeKey, current, baselineRefs };
}
