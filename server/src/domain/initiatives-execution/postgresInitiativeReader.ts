import type { Pool } from 'pg';

import type { CapacityScenario } from './capacityScenario.js';
import type { InitiativeCardSelectionItem } from './configureInitiativeCards.js';
import { gateRule, type GovernanceGate } from './organizationGovernance.js';
import type { PlanScenario } from './planScenario.js';
import type { PortfolioScenario } from './portfolioScenario.js';
import type { PortfolioDecision } from './portfolioDecision.js';
import type { EffectiveGovernancePolicy } from './postgresGovernancePolicyResolver.js';
import type { RegisteredInitiative } from './registerInitiative.js';

export interface SourceProposalReadModel {
  id: string;
  title: string;
  problem: string | null;
  proposedOutcome: string | null;
  sourceType: string;
  sourceId: string;
  sourceVersion: number;
  proposalVersion: number;
  projectId: string | null;
  initiativeOwnerId: string | null;
  visibility: 'PROJECT' | 'ORGANIZATION_RESTRICTED';
  evidenceState: 'READY' | 'PARTIAL' | 'STALE' | 'UNKNOWN';
  duplicateState: 'CLEAR' | 'POSSIBLE' | 'UNKNOWN';
  provenance: { system: string; recordType: string; capturedAt: string; evidenceRefs: string[] };
  policyRef: { policyId: string; policyVersion: number };
  status: string;
  disposition: 'REGISTER' | 'MERGE' | 'EXTEND' | 'RETURN' | 'DEFER' | 'DISMISS' | null;
  registeredInitiativeId: string | null;
  updatedAt: string;
}

export interface InitiativeReadModel {
  version: number;
  initiative: RegisteredInitiative;
  updatedAt: string;
}

export interface InitiativeCardVersionReadModel {
  cardKey: string;
  cardVersion: number;
  aggregateVersion: number;
  applicability: 'REQUIRED' | 'OPTIONAL' | 'NOT_APPLICABLE';
  completion: 'EMPTY' | 'IN_PROGRESS' | 'COMPLETE';
  quality: 'UNKNOWN' | 'SUFFICIENT' | 'WARNING' | 'BLOCKER';
  freshness: 'CURRENT' | 'STALE' | 'SOURCE_UNAVAILABLE';
  reviewState: 'NOT_REQUESTED' | 'REQUESTED' | 'CHANGES_REQUESTED' | 'ACCEPTED';
  content: Record<string, unknown>;
  evidenceRefs: string[];
  waiverDecisionId: string | null;
  publishedBy: string;
  publishedAt: string;
}

export interface PendingDefinitionDecisionReadModel {
  version: number;
  decisionId: string;
  initiativeId: string;
  gate: 'DEFINITION';
  status: 'PENDING';
  requesterId: string;
  authorityId: string;
  dueAt: string;
  requestedAt: string;
  cardVersions: Record<string, number>;
}

export interface PendingAnalysisDecisionReadModel {
  version: number;
  decisionId: string;
  initiativeId: string;
  gate: 'ANALYSIS';
  status: 'PENDING';
  requesterId: string;
  authorityId: string;
  dueAt: string;
  requestedAt: string;
  cardVersions: Record<string, number>;
}

export interface PendingDefinitionRemediationReadModel {
  version: number;
  aggregateType: 'task' | 'decision';
  aggregateId: string;
  initiativeId: string;
  findingId: string;
  workType: 'FINANCE_EVIDENCE' | 'TECHNICAL_OPTION';
  title: string;
  accountableId: string;
  dueAt: string;
  status: 'OPEN' | 'PENDING';
  options: string[];
}

export class PostgresInitiativeReader {
  constructor(private readonly pool: Pool) {}

  async resolveProjectIdsForAggregate(
    organizationId: string,
    aggregateType: string,
    aggregateId: string
  ): Promise<string[]> {
    const row = await this.pool.query<{ payload_json: Record<string, any> }>(
      `SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type=$2 AND aggregate_id=$3`,
      [organizationId, aggregateType, aggregateId]
    );
    const payload = row.rows[0]?.payload_json;
    if (!payload) return [];
    if (typeof payload.projectId === 'string' && payload.projectId.trim())
      return [payload.projectId];
    if (aggregateType === 'report_definition') {
      const current = Array.isArray(payload.versions)
        ? payload.versions.find((item: any) => item.definitionVersion === payload.currentVersion)
        : null;
      return Array.isArray(current?.scope?.projectIds) ? current.scope.projectIds : [];
    }
    if (aggregateType === 'report_run')
      return this.resolveProjectIdsForAggregate(
        organizationId,
        'report_definition',
        payload.definitionRef?.definitionId
      );
    if (payload.executionCaseId && aggregateType !== 'execution_case')
      return this.resolveProjectIdsForAggregate(
        organizationId,
        'execution_case',
        payload.executionCaseId
      );
    if (payload.initiativeId)
      return this.resolveProjectIdsForAggregate(organizationId, 'initiative', payload.initiativeId);
    if (aggregateType === 'material_change') {
      const target = payload.target;
      if (target?.initiativeId)
        return this.resolveProjectIdsForAggregate(
          organizationId,
          'initiative',
          target.initiativeId
        );
      if (target?.aggregateType && target?.aggregateId)
        return this.resolveProjectIdsForAggregate(
          organizationId,
          target.aggregateType,
          target.aggregateId
        );
    }
    if (aggregateType === 'plan_scenario')
      return payload.portfolioScenarioId
        ? this.resolveProjectIdsForAggregate(
            organizationId,
            'portfolio_scenario',
            payload.portfolioScenarioId
          )
        : [];
    if (aggregateType === 'capacity_scenario')
      return this.resolveProjectIdsForAggregate(
        organizationId,
        'plan_scenario',
        payload.planScenarioId
      );
    if (aggregateType === 'portfolio_scenario')
      return typeof payload.scope?.portfolioId === 'string' ? [payload.scope.portfolioId] : [];
    if (aggregateType === 'results_kpi_observation')
      return this.resolveProjectIdsForAggregate(
        organizationId,
        'results_acceptance',
        payload.resultsCaseRef?.resultsCaseId
      );
    if (aggregateType === 'archive_manifest')
      return this.resolveProjectIdsForAggregate(organizationId, 'initiative', payload.initiativeId);
    return [];
  }

  async listCapacityScenarios(organizationId: string) {
    const result = await this.pool.query<{
      aggregate_id: string;
      payload_json: CapacityScenario;
      updated_at: Date | string;
    }>(
      `SELECT aggregate_id,payload_json,updated_at FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='capacity_scenario' ORDER BY updated_at DESC`,
      [organizationId]
    );
    return result.rows.map((r) => {
      const states = [
        ...r.payload_json.periods.flatMap((p) => [
          p.demand.knowledgeState,
          p.supply.knowledgeState,
        ]),
        ...r.payload_json.constraints.map((c) => c.state),
      ];
      return {
        id: r.aggregate_id,
        name: String((r.payload_json as any).name ?? r.aggregate_id),
        state: r.payload_json.status,
        version: r.payload_json.scenarioVersion,
        planRef: {
          scenarioId: r.payload_json.planScenarioId,
          scenarioVersion: r.payload_json.planScenarioVersion,
        },
        window: {
          start: r.payload_json.periods[0]?.start ?? null,
          end: r.payload_json.periods.at(-1)?.end ?? null,
        },
        unit: { windowUnit: r.payload_json.windowUnit, timezone: r.payload_json.timezone },
        updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
        knowledgeSummary: {
          known: states.filter((s) => s === 'KNOWN').length,
          estimated: states.filter((s) => s === 'ESTIMATED').length,
          unknown: states.filter((s) => s === 'UNKNOWN').length,
          unconfirmed: states.filter((s) => s === 'UNCONFIRMED').length,
        },
      };
    });
  }
  async listPendingHandoffAcceptances(organizationId: string, authorityId: string) {
    const result = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='decision' AND payload_json->>'status'='PENDING' AND payload_json ? 'handoffPackageId' AND payload_json ? 'executionCaseId' AND payload_json->>'authorityId'=$2 ORDER BY (payload_json->>'dueAt')::timestamptz`,
      [organizationId, authorityId]
    );
    return result.rows.map((r) => ({
      version: r.version,
      decisionId: r.aggregate_id,
      ...r.payload_json,
    }));
  }
  async findExecutionCase(organizationId: string, executionCaseId: string) {
    const result = await this.pool.query<{
      version: number;
      payload_json: Record<string, unknown>;
      updated_at: Date | string;
    }>(
      `SELECT version,payload_json,updated_at FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='execution_case' AND aggregate_id=$2`,
      [organizationId, executionCaseId]
    );
    return result.rows[0]
      ? {
          version: result.rows[0].version,
          executionCaseId,
          detail: result.rows[0].payload_json,
          updatedAt:
            result.rows[0].updated_at instanceof Date
              ? result.rows[0].updated_at.toISOString()
              : String(result.rows[0].updated_at),
        }
      : null;
  }
  async findExecutionCaseByInitiative(organizationId: string, initiativeId: string) {
    const result = await this.pool.query<{ target_id: string }>(
      `SELECT target_id FROM ie_aggregate_relations WHERE organization_id=$1 AND relation_type='INITIATIVE_EXECUTION_CASE' AND source_type='initiative' AND source_id=$2`,
      [organizationId, initiativeId]
    );
    return result.rows[0] ? this.findExecutionCase(organizationId, result.rows[0].target_id) : null;
  }
  async listExecutionCases(organizationId: string) {
    const result = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
      updated_at: Date | string;
    }>(
      `SELECT version,aggregate_id,payload_json,updated_at FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='execution_case' ORDER BY updated_at DESC`,
      [organizationId]
    );
    return result.rows.map((r) => ({
      executionCaseId: r.aggregate_id,
      version: r.version,
      initiativeId: String(r.payload_json.initiativeId),
      state: String(r.payload_json.state),
      executionManagerId: String(r.payload_json.executionManagerId),
      handoffPackageId: String(r.payload_json.handoffPackageId),
      updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
    }));
  }
  async listExecutionTasks(organizationId: string, executionCaseId?: string) {
    const result = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='execution_task' AND ($2::text IS NULL OR payload_json->>'executionCaseId'=$2) ORDER BY (payload_json->>'dueAt')::timestamptz`,
      [organizationId, executionCaseId ?? null]
    );
    return result.rows.map((r) => ({
      version: r.version,
      taskId: r.aggregate_id,
      ...r.payload_json,
    }));
  }
  async listExecutionMilestones(organizationId: string, executionCaseId?: string) {
    const result = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state
        WHERE organization_id=$1 AND aggregate_type='execution_milestone'
          AND ($2::text IS NULL OR payload_json->>'executionCaseId'=$2)
        ORDER BY payload_json->>'targetAt' NULLS LAST, aggregate_id`,
      [organizationId, executionCaseId ?? null]
    );
    return result.rows.map((row) => ({
      version: row.version,
      milestoneId: row.aggregate_id,
      ...row.payload_json,
    }));
  }
  async listExecutionDecisions(organizationId: string, executionCaseId?: string) {
    const result = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='execution_decision' AND ($2::text IS NULL OR payload_json->>'executionCaseId'=$2) ORDER BY (payload_json->>'dueAt')::timestamptz`,
      [organizationId, executionCaseId ?? null]
    );
    return result.rows.map((r) => ({
      version: r.version,
      decisionId: r.aggregate_id,
      ...r.payload_json,
    }));
  }
  async listMyExecutionWork(organizationId: string, actorId: string) {
    const [tasks, decisions] = await Promise.all([
      this.pool.query<{
        version: number;
        aggregate_id: string;
        payload_json: Record<string, unknown>;
      }>(
        `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='execution_task' AND payload_json->>'status' IN ('OPEN','BLOCKED') AND (payload_json->>'assigneeId'=$2 OR payload_json->>'ownerId'=$2)`,
        [organizationId, actorId]
      ),
      this.pool.query<{
        version: number;
        aggregate_id: string;
        payload_json: Record<string, unknown>;
      }>(
        `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='execution_decision' AND payload_json->>'status'='PENDING' AND payload_json->>'authorityId'=$2`,
        [organizationId, actorId]
      ),
    ]);
    return {
      tasks: tasks.rows.map((r) => ({
        version: r.version,
        taskId: r.aggregate_id,
        ...r.payload_json,
      })),
      decisions: decisions.rows.map((r) => ({
        version: r.version,
        decisionId: r.aggregate_id,
        ...r.payload_json,
      })),
    };
  }
  async listOperationalAllocations(organizationId: string, executionCaseId?: string) {
    const result = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='operational_allocation' AND ($2::text IS NULL OR payload_json->>'executionCaseId'=$2) ORDER BY updated_at DESC`,
      [organizationId, executionCaseId ?? null]
    );
    return result.rows.map((r) => ({
      version: r.version,
      allocationId: r.aggregate_id,
      ...r.payload_json,
    }));
  }
  async listMyOperationalAllocations(organizationId: string, actorId: string) {
    const result = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='operational_allocation' AND ((payload_json->>'status'='REQUESTED' AND payload_json->>'assigneeId'=$2) OR (payload_json->>'status'='ASSIGNEE_ACCEPTED' AND payload_json->>'resourceManagerId'=$2)) ORDER BY updated_at DESC`,
      [organizationId, actorId]
    );
    return result.rows.map((r) => ({
      version: r.version,
      allocationId: r.aggregate_id,
      ...r.payload_json,
    }));
  }
  async listManagementSignals(organizationId: string) {
    const result = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='management_signal' ORDER BY updated_at DESC`,
      [organizationId]
    );
    return result.rows.map((r) => ({
      version: r.version,
      signalId: r.aggregate_id,
      ...r.payload_json,
    }));
  }
  async listInterventionCases(organizationId: string) {
    const result = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='intervention_case' ORDER BY updated_at DESC`,
      [organizationId]
    );
    return result.rows.map((r) => ({
      version: r.version,
      interventionId: r.aggregate_id,
      ...r.payload_json,
    }));
  }
  async findReportDefinition(organizationId: string, definitionId: string) {
    const result = await this.pool.query<{
      version: number;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='report_definition' AND aggregate_id=$2`,
      [organizationId, definitionId]
    );
    return result.rows[0]
      ? { definitionId, version: result.rows[0].version, ...result.rows[0].payload_json }
      : null;
  }
  async listReportDefinitions(organizationId: string) {
    const result = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, any>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state
       WHERE organization_id=$1 AND aggregate_type='report_definition' ORDER BY updated_at DESC`,
      [organizationId]
    );
    return result.rows.map((row) => {
      const currentVersion = Number(row.payload_json.currentVersion ?? 0);
      const current = Array.isArray(row.payload_json.versions)
        ? row.payload_json.versions.find((item: any) => item.definitionVersion === currentVersion)
        : null;
      return {
        definitionId: row.aggregate_id,
        aggregateVersion: row.version,
        currentVersion,
        state: current?.state ?? 'UNKNOWN',
        name: current?.name ?? null,
        purpose: current?.purpose ?? null,
        audience: current?.audience ?? [],
        cadence: current?.cadence ?? null,
        ownerId: current?.ownerId ?? null,
        approverId: current?.approverId ?? null,
        projectIds: Array.isArray(current?.scope?.projectIds) ? current.scope.projectIds : [],
        generalBacklogAllowed: current?.scope?.generalBacklogAllowed === true,
        updatedAt: row.payload_json.updatedAt ?? null,
      };
    });
  }
  async listReportRuns(organizationId: string) {
    const result = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='report_run' ORDER BY updated_at DESC`,
      [organizationId]
    );
    return result.rows.map((r) => ({
      version: r.version,
      reportRunId: r.aggregate_id,
      ...r.payload_json,
    }));
  }
  async findBenefitsHandoffPack(organizationId: string, packId: string) {
    const r = await this.pool.query<{ version: number; payload_json: Record<string, unknown> }>(
      `SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='benefits_handoff_pack' AND aggregate_id=$2`,
      [organizationId, packId]
    );
    return r.rows[0] ? { version: r.rows[0].version, packId, ...r.rows[0].payload_json } : null;
  }
  async listDeliveryAcceptances(organizationId: string) {
    const r = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='delivery_acceptance' ORDER BY updated_at DESC`,
      [organizationId]
    );
    return r.rows.map((x) => ({
      version: x.version,
      decisionId: x.aggregate_id,
      ...x.payload_json,
    }));
  }
  async listResultsAcceptances(organizationId: string) {
    const r = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='results_acceptance' ORDER BY updated_at DESC`,
      [organizationId]
    );
    return r.rows.map((x) => ({
      version: x.version,
      resultsCaseId: x.aggregate_id,
      ...x.payload_json,
    }));
  }
  async listMyAcceptanceWork(organizationId: string, actorId: string) {
    const delivery = await this.pool.query<{
        version: number;
        aggregate_id: string;
        payload_json: Record<string, unknown>;
      }>(
        `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='delivery_acceptance' AND payload_json->>'status'='PENDING' AND payload_json->>'authorityId'=$2`,
        [organizationId, actorId]
      ),
      results = await this.pool.query<{
        version: number;
        aggregate_id: string;
        payload_json: Record<string, unknown>;
      }>(
        `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='results_acceptance' AND payload_json->>'status'='PENDING' AND payload_json->>'authorityId'=$2`,
        [organizationId, actorId]
      );
    return {
      delivery: delivery.rows.map((x) => ({
        version: x.version,
        decisionId: x.aggregate_id,
        ...x.payload_json,
      })),
      results: results.rows.map((x) => ({
        version: x.version,
        resultsCaseId: x.aggregate_id,
        ...x.payload_json,
      })),
    };
  }
  async listEffectivenessCases(organizationId: string) {
    const r = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='effectiveness_case' ORDER BY updated_at DESC`,
      [organizationId]
    );
    return r.rows.map((x) => ({
      version: x.version,
      effectivenessCaseId: x.aggregate_id,
      ...x.payload_json,
    }));
  }
  async findResultsKpiObservation(organizationId: string, id: string) {
    const r = await this.pool.query<{ version: number; payload_json: Record<string, unknown> }>(
      `SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='results_kpi_observation' AND aggregate_id=$2`,
      [organizationId, id]
    );
    return r.rows[0]
      ? { version: r.rows[0].version, observationId: id, ...r.rows[0].payload_json }
      : null;
  }
  async listResultsKpiObservations(organizationId: string, resultsCaseId?: string) {
    const r = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='results_kpi_observation' AND ($2::text IS NULL OR payload_json#>>'{resultsCaseRef,resultsCaseId}'=$2) ORDER BY payload_json->>'asOf' DESC`,
      [organizationId, resultsCaseId ?? null]
    );
    return r.rows.map((row) => ({
      version: row.version,
      observationId: row.aggregate_id,
      ...row.payload_json,
    }));
  }
  async findFinanceReconciliation(organizationId: string, id: string) {
    const r = await this.pool.query<{ version: number; payload_json: Record<string, unknown> }>(
      `SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='finance_reconciliation' AND aggregate_id=$2`,
      [organizationId, id]
    );
    return r.rows[0]
      ? { version: r.rows[0].version, reconciliationId: id, ...r.rows[0].payload_json }
      : null;
  }
  async findClosureSnapshot(organizationId: string, id: string) {
    const r = await this.pool.query<{ version: number; payload_json: Record<string, unknown> }>(
      `SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='closure_snapshot' AND aggregate_id=$2`,
      [organizationId, id]
    );
    return r.rows[0]
      ? { version: r.rows[0].version, snapshotId: id, ...r.rows[0].payload_json }
      : null;
  }
  async findEffectivenessSnapshot(organizationId: string, id: string) {
    const r = await this.pool.query<{ version: number; payload_json: Record<string, unknown> }>(
      `SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='effectiveness_snapshot' AND aggregate_id=$2`,
      [organizationId, id]
    );
    return r.rows[0]
      ? { version: r.rows[0].version, snapshotId: id, ...r.rows[0].payload_json }
      : null;
  }
  async findClosureCase(organizationId: string, id: string) {
    const r = await this.pool.query<{ version: number; payload_json: Record<string, unknown> }>(
      `SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='closure_case' AND aggregate_id=$2`,
      [organizationId, id]
    );
    return r.rows[0]
      ? { version: r.rows[0].version, closureCaseId: id, ...r.rows[0].payload_json }
      : null;
  }
  async listClosureCases(organizationId: string) {
    const r = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='closure_case' ORDER BY updated_at DESC`,
      [organizationId]
    );
    return r.rows.map((row) => ({
      version: row.version,
      closureCaseId: row.aggregate_id,
      ...row.payload_json,
    }));
  }
  async listArchiveManifests(organizationId: string) {
    const r = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='archive_manifest' ORDER BY updated_at DESC`,
      [organizationId]
    );
    return r.rows.map((x) => ({
      version: x.version,
      archiveId: x.aggregate_id,
      ...x.payload_json,
    }));
  }
  async listMyEffectivenessWork(organizationId: string, actorId: string) {
    const r = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='effectiveness_case' AND ((payload_json->>'status'='TRACKING' AND payload_json->>'benefitOwnerId'=$2) OR (payload_json->>'status'='PENDING_REVIEW' AND payload_json->>'reviewerId'=$2) OR (payload_json->>'status'='EFFECTIVE' AND payload_json->>'closureAuthorityId'=$2)) ORDER BY updated_at`,
      [organizationId, actorId]
    );
    return r.rows.map((x) => ({
      version: x.version,
      effectivenessCaseId: x.aggregate_id,
      ...x.payload_json,
    }));
  }
  async listMaterialChanges(organizationId: string) {
    const r = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='material_change' ORDER BY updated_at DESC`,
      [organizationId]
    );
    return r.rows.map((x) => ({
      version: x.version,
      proposalId: x.aggregate_id,
      ...x.payload_json,
    }));
  }
  async listMyMaterialChangeWork(organizationId: string, actorId: string) {
    const r = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='material_change' AND ((payload_json->>'status'='DRAFT' AND payload_json->>'ownerId'=$2) OR (payload_json->>'status'='PENDING' AND payload_json->>'authorityId'=$2) OR (payload_json->>'status' IN ('APPROVED','CONDITIONALLY_APPROVED') AND payload_json->>'ownerId'=$2)) ORDER BY updated_at`,
      [organizationId, actorId]
    );
    return r.rows.map((x) => ({
      version: x.version,
      proposalId: x.aggregate_id,
      ...x.payload_json,
    }));
  }
  async listAIAnalysisProposals(organizationId: string) {
    const r = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='ai_analysis_proposal' ORDER BY updated_at DESC`,
      [organizationId]
    );
    return r.rows.map((x) => ({
      version: x.version,
      proposalId: x.aggregate_id,
      ...x.payload_json,
    }));
  }
  async listMyAIAnalysisReviews(organizationId: string, actorId: string) {
    const r = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='ai_analysis_proposal' AND payload_json->>'status'='PENDING_REVIEW' AND payload_json->>'authorizedReviewerId'=$2 ORDER BY updated_at`,
      [organizationId, actorId]
    );
    return r.rows.map((x) => ({
      version: x.version,
      proposalId: x.aggregate_id,
      ...x.payload_json,
    }));
  }
  async listCapacityOptions(organizationId: string) {
    const r = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='capacity_options' ORDER BY updated_at DESC`,
      [organizationId]
    );
    return r.rows.map((x) => ({
      version: x.version,
      comparisonId: x.aggregate_id,
      ...x.payload_json,
    }));
  }
  async listGateQuorums(organizationId: string) {
    const r = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='gate_quorum' ORDER BY updated_at DESC`,
      [organizationId]
    );
    return r.rows.map((x) => ({ version: x.version, quorumId: x.aggregate_id, ...x.payload_json }));
  }

  async listMyGateSignoffs(organizationId: string, actorId: string) {
    const decisions = await this.pool.query<{
      version: number;
      decision_id: string;
      decision: Record<string, any>;
      relation_type: string;
      initiative_id: string;
      project_id: string;
      policy_id: string;
      policy_version: number;
      updated_at: string;
    }>(
      `SELECT d.version, d.aggregate_id decision_id, d.payload_json decision,
              rel.relation_type, rel.source_id initiative_id,
              i.payload_json->>'projectId' project_id,
              audit.policy_id, audit.policy_version, d.updated_at
         FROM ie_aggregate_state d
         JOIN ie_aggregate_relations rel
           ON rel.organization_id=d.organization_id AND rel.target_type='decision'
          AND rel.target_id=d.aggregate_id
          AND rel.relation_type ~ '^INITIATIVE_(DEFINITION_DECISION|ANALYSIS_DECISION|PORTFOLIO_DECISION|SCHEDULE_DECISION|HANDOFF_ACCEPTANCE):'
         JOIN ie_aggregate_state i
           ON i.organization_id=d.organization_id AND i.aggregate_type='initiative'
          AND i.aggregate_id=rel.source_id
         JOIN LATERAL (
           SELECT a.policy_id,a.policy_version
             FROM ie_audit_events a
            WHERE a.organization_id=d.organization_id
              AND a.payload_json->>'decisionId'=d.aggregate_id
            ORDER BY a.id ASC LIMIT 1
         ) audit ON true
        WHERE d.organization_id=$1 AND d.aggregate_type='decision'
          AND d.payload_json->>'status'='PENDING'
       UNION ALL
       SELECT c.version, c.aggregate_id decision_id, c.payload_json decision,
              rel.relation_type, rel.source_id initiative_id,
              i.payload_json->>'projectId' project_id,
              audit.policy_id, audit.policy_version, c.updated_at
         FROM ie_aggregate_state c
         JOIN ie_aggregate_relations rel
           ON rel.organization_id=c.organization_id AND rel.target_type='closure_case'
          AND rel.target_id=c.aggregate_id
          AND rel.relation_type ~ '^INITIATIVE_CLOSURE_CASE:'
         JOIN ie_aggregate_state i
           ON i.organization_id=c.organization_id AND i.aggregate_type='initiative'
          AND i.aggregate_id=rel.source_id
         JOIN LATERAL (
           SELECT a.policy_id,a.policy_version
             FROM ie_audit_events a
            WHERE a.organization_id=c.organization_id
              AND a.aggregate_type='closure_case'
              AND a.aggregate_id=c.aggregate_id
              AND a.command_type='closure.request'
            ORDER BY a.id ASC LIMIT 1
         ) audit ON true
        WHERE c.organization_id=$1 AND c.aggregate_type='closure_case'
          AND c.payload_json->>'status'='PENDING'
        ORDER BY updated_at ASC`,
      [organizationId]
    );
    const items = [];
    for (const row of decisions.rows) {
      const gate = (row.decision.gate ??
        (row.relation_type.includes('_CLOSURE_')
          ? 'CLOSURE'
          : row.relation_type.includes('_DEFINITION_')
            ? 'DEFINITION'
            : row.relation_type.includes('_ANALYSIS_')
              ? 'ANALYSIS'
              : row.relation_type.includes('_PORTFOLIO_')
                ? 'PORTFOLIO'
                : row.relation_type.includes('_SCHEDULE_')
                  ? 'SCHEDULE'
                  : 'HANDOFF')) as GovernanceGate;
      const policyRow = await this.pool.query<{
        baseline: EffectiveGovernancePolicy['baseline'];
        strictness: number;
        scope_type: EffectiveGovernancePolicy['source'];
        config_json: Record<string, unknown>;
      }>(
        `SELECT baseline,strictness,scope_type,config_json FROM ie_governance_policies
          WHERE (organization_id=$1 OR organization_id='*') AND policy_id=$2 AND version=$3
          ORDER BY CASE WHEN organization_id=$1 THEN 0 ELSE 1 END LIMIT 1`,
        [organizationId, row.policy_id, row.policy_version]
      );
      if (!policyRow.rows[0]) continue;
      const bindings = await this.pool.query<{
        role_key: string;
        principal_id: string;
        delegation_json: Record<string, any> | null;
      }>(
        `SELECT role_key,principal_id,delegation_json FROM ie_governance_role_bindings
          WHERE organization_id=$1 AND policy_id=$2 AND policy_version=$3
            AND (project_id='*' OR project_id=$4)`,
        [organizationId, row.policy_id, row.policy_version, row.project_id]
      );
      const policy: EffectiveGovernancePolicy = {
        policyId: row.policy_id,
        version: row.policy_version,
        baseline: policyRow.rows[0].baseline,
        strictness: policyRow.rows[0].strictness,
        source: policyRow.rows[0].scope_type,
        config: {
          ...(policyRow.rows[0].config_json ?? {}),
          roleBindings: bindings.rows.map((binding) => ({
            roleKey: binding.role_key,
            principalId: binding.principal_id,
            ...(binding.delegation_json ?? {}),
          })),
        },
      };
      const rule = gateRule(policy, gate);
      const actorBindings = bindings.rows.flatMap((binding) => {
        const direct = binding.principal_id === actorId;
        const delegate = (binding.delegation_json?.delegates ?? []).find(
          (candidate: any) =>
            candidate.principalId === actorId &&
            Array.isArray(candidate.gates) &&
            candidate.gates.includes(gate) &&
            Date.parse(candidate.expiresAt) > Date.now()
        );
        if (!direct && !delegate) return [];
        return [
          {
            roleKey: binding.role_key,
            mode: direct ? ('DIRECT' as const) : ('DELEGATED' as const),
            delegatedFrom: direct ? null : binding.principal_id,
            delegationProof: direct
              ? null
              : {
                  delegatedFrom: binding.principal_id,
                  delegationRef: delegate.delegationRef,
                  version: delegate.version,
                },
            eligible:
              (!rule.requiredRoles.length || rule.requiredRoles.includes(binding.role_key)) &&
              (!rule.separation || row.decision.requesterId !== actorId),
          },
        ];
      });
      const quorumId = `${gate}:${row.decision_id}`;
      const quorum = await this.pool.query<{
        version: number;
        payload_json: Record<string, any>;
      }>(
        `SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1
          AND aggregate_type='gate_quorum' AND aggregate_id=$2`,
        [organizationId, quorumId]
      );
      const current = quorum.rows[0];
      const alreadySigned = Boolean(
        current?.payload_json.signoffs?.some((signoff: any) => signoff.signerId === actorId)
      );
      const effectiveActorBindings = actorBindings.map((binding) => ({
        ...binding,
        eligible: binding.eligible && !alreadySigned,
      }));
      const actorCanDecide =
        row.decision.authorityId === actorId &&
        (!rule.separation || row.decision.requesterId !== actorId);
      const actorAuthorized = actorBindings.length > 0 || actorCanDecide;
      const dueAt = row.decision.dueAt ?? null;
      items.push({
        gate,
        decisionId: row.decision_id,
        decisionVersion: row.version,
        initiativeId: row.initiative_id,
        projectId: row.project_id,
        requesterId: row.decision.requesterId,
        authorityId: row.decision.authorityId,
        requestedAt: row.decision.requestedAt,
        dueAt,
        sla: {
          hours: rule.slaHours,
          dueAt,
          state:
            current?.payload_json.status === 'SATISFIED' ||
            current?.payload_json.status === 'REJECTED'
              ? 'COMPLETED'
              : dueAt && Date.parse(dueAt) < Date.now()
                ? 'OVERDUE'
                : 'OPEN',
        },
        effectivePolicy: {
          policyId: policy.policyId,
          policyVersion: policy.version,
          profile: policy.baseline,
          source: policy.source,
          policyEnforced: Boolean(policy.config.enforceGateGovernance),
          rule,
        },
        actorBindings: effectiveActorBindings,
        actorEligible: effectiveActorBindings.some((binding) => binding.eligible),
        actorAuthorized,
        actorCanDecide,
        actorAlreadySigned: alreadySigned,
        quorum: current
          ? {
              quorumId,
              version: current.version,
              status: current.payload_json.status,
              signoffs: current.payload_json.signoffs ?? [],
              receiptId: current.payload_json.receiptId ?? null,
              updatedAt: current.payload_json.updatedAt,
            }
          : {
              quorumId,
              version: 0,
              status: 'COLLECTING',
              signoffs: [],
              receiptId: null,
              updatedAt: null,
            },
      });
    }
    return items;
  }

  async findPortfolioScenario(
    organizationId: string,
    scenarioId: string
  ): Promise<{ version: number; scenario: PortfolioScenario } | null> {
    const result = await this.pool.query<{ version: number; payload_json: PortfolioScenario }>(
      `SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='portfolio_scenario' AND aggregate_id=$2`,
      [organizationId, scenarioId]
    );
    return result.rows[0]
      ? { version: result.rows[0].version, scenario: result.rows[0].payload_json }
      : null;
  }

  async listPortfolioScenarios(organizationId: string) {
    const result = await this.pool.query<{
      aggregate_id: string;
      version: number;
      payload_json: PortfolioScenario;
      updated_at: Date | string;
    }>(
      `SELECT aggregate_id,version,payload_json,updated_at FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='portfolio_scenario' ORDER BY updated_at DESC`,
      [organizationId]
    );
    return result.rows.map((r) => ({
      id: r.aggregate_id,
      name: String((r.payload_json as any).name ?? r.aggregate_id),
      state: r.payload_json.status,
      version: r.payload_json.scenarioVersion,
      model: r.payload_json.model,
      scope: r.payload_json.scope,
      updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
    }));
  }

  async listPortfolioScenarioHistory(
    organizationId: string,
    scenarioId: string
  ): Promise<PortfolioScenario[]> {
    const result = await this.pool.query<{ payload_json: PortfolioScenario }>(
      `SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='portfolio_scenario_version' AND aggregate_id LIKE $2 ORDER BY (payload_json->>'scenarioVersion')::int ASC`,
      [organizationId, `${scenarioId}:v%`]
    );
    return result.rows.map((r) => r.payload_json);
  }

  async listPendingPortfolioDecisions(organizationId: string, authorityId: string) {
    const result = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='decision' AND payload_json->>'status'='PENDING' AND payload_json ? 'scenarioId' AND payload_json->>'authorityId'=$2 ORDER BY (payload_json->>'requestedAt')::timestamptz`,
      [organizationId, authorityId]
    );
    return result.rows.map((r) => ({
      version: r.version,
      decisionId: r.aggregate_id,
      ...r.payload_json,
    }));
  }
  async listPendingScheduleDecisions(organizationId: string, authorityId: string) {
    const result = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='decision' AND payload_json->>'status'='PENDING' AND payload_json ? 'executionManagerId' AND payload_json->>'authorityId'=$2 ORDER BY (payload_json->>'dueAt')::timestamptz`,
      [organizationId, authorityId]
    );
    return result.rows.map((r) => ({
      version: r.version,
      decisionId: r.aggregate_id,
      ...r.payload_json,
    }));
  }
  async findHandoffPackage(organizationId: string, handoffPackageId: string) {
    const result = await this.pool.query<{
      version: number;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='handoff_package' AND aggregate_id=$2`,
      [organizationId, handoffPackageId]
    );
    return result.rows[0]
      ? { version: result.rows[0].version, handoffPackageId, ...result.rows[0].payload_json }
      : null;
  }

  async findPlanScenario(
    organizationId: string,
    scenarioId: string
  ): Promise<{
    version: number;
    scenario: PlanScenario;
    governedChanges: Array<Record<string, unknown>>;
  } | null> {
    const result = await this.pool.query<{ version: number; payload_json: PlanScenario }>(
      `SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='plan_scenario' AND aggregate_id=$2`,
      [organizationId, scenarioId]
    );
    if (!result.rows[0]) return null;
    const changes = await this.pool.query<{ payload_json: Record<string, unknown> }>(
      `SELECT i.payload_json FROM ie_aggregate_relations r
       JOIN ie_aggregate_state i ON i.organization_id=r.organization_id
        AND i.aggregate_type='intervention_case' AND i.aggregate_id=r.target_id
       WHERE r.organization_id=$1 AND r.source_type='plan_scenario' AND r.source_id=$2
        AND r.relation_type LIKE 'PLAN_INTERVENTION:%' ORDER BY i.updated_at DESC`,
      [organizationId, scenarioId]
    );
    return {
      version: result.rows[0].version,
      scenario: result.rows[0].payload_json,
      governedChanges: changes.rows.map((row) => row.payload_json),
    };
  }
  async listPlanScenarioHistory(
    organizationId: string,
    scenarioId: string
  ): Promise<PlanScenario[]> {
    const result = await this.pool.query<{ payload_json: PlanScenario }>(
      `SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='plan_scenario_version' AND aggregate_id LIKE $2 ORDER BY (payload_json->>'scenarioVersion')::int`,
      [organizationId, `${scenarioId}:v%`]
    );
    return result.rows.map((r) => r.payload_json);
  }
  async listPlanScenarios(organizationId: string) {
    const result = await this.pool.query<{
      aggregate_id: string;
      payload_json: PlanScenario;
      updated_at: Date | string;
    }>(
      `SELECT aggregate_id,payload_json,updated_at FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='plan_scenario' ORDER BY updated_at DESC`,
      [organizationId]
    );
    return result.rows.map((r) => ({
      id: r.aggregate_id,
      name: String((r.payload_json as any).name ?? r.aggregate_id),
      state: r.payload_json.status,
      version: r.payload_json.scenarioVersion,
      portfolioRef: {
        scenarioId: r.payload_json.portfolioScenarioId,
        scenarioVersion: r.payload_json.portfolioScenarioVersion,
      },
      timeBasis: {
        windowUnit: r.payload_json.windowUnit ?? null,
        timezone: r.payload_json.timezone ?? null,
        periods: r.payload_json.periods ?? null,
        knowledgeState:
          r.payload_json.windowUnit &&
          r.payload_json.timezone &&
          Array.isArray(r.payload_json.periods)
            ? 'KNOWN'
            : 'UNKNOWN',
      },
      window: {
        earliest:
          r.payload_json.windows
            .map((w) => w.earliest)
            .filter(Boolean)
            .sort()[0] ?? null,
        latest:
          r.payload_json.windows
            .map((w) => w.latest)
            .filter(Boolean)
            .sort()
            .at(-1) ?? null,
      },
      updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
    }));
  }
  async findCapacityScenario(
    organizationId: string,
    scenarioId: string
  ): Promise<{ version: number; scenario: CapacityScenario } | null> {
    const result = await this.pool.query<{ version: number; payload_json: CapacityScenario }>(
      `SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='capacity_scenario' AND aggregate_id=$2`,
      [organizationId, scenarioId]
    );
    return result.rows[0]
      ? { version: result.rows[0].version, scenario: result.rows[0].payload_json }
      : null;
  }
  async listCapacityScenarioHistory(
    organizationId: string,
    scenarioId: string
  ): Promise<CapacityScenario[]> {
    const result = await this.pool.query<{ payload_json: CapacityScenario }>(
      `SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='capacity_scenario_version' AND aggregate_id LIKE $2 ORDER BY (payload_json->>'scenarioVersion')::int`,
      [organizationId, `${scenarioId}:v%`]
    );
    return result.rows.map((r) => r.payload_json);
  }

  async findSourceProposal(
    organizationId: string,
    proposalId: string
  ): Promise<SourceProposalReadModel | null> {
    const proposals = await this.listSourceProposals(organizationId, proposalId, true);
    return proposals[0] ?? null;
  }

  async findById(
    organizationId: string,
    initiativeId: string
  ): Promise<InitiativeReadModel | null> {
    const result = await this.pool.query<{
      version: number;
      payload_json: RegisteredInitiative;
      updated_at: Date | string;
    }>(
      `SELECT version, payload_json, updated_at
         FROM ie_aggregate_state
        WHERE organization_id = $1 AND aggregate_type = 'initiative' AND aggregate_id = $2`,
      [organizationId, initiativeId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      version: row.version,
      initiative: row.payload_json,
      updatedAt:
        row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }

  async listInitiatives(organizationId: string): Promise<InitiativeReadModel[]> {
    const result = await this.pool.query<{
      version: number;
      payload_json: RegisteredInitiative;
      updated_at: Date | string;
    }>(
      `SELECT version, payload_json, updated_at
         FROM ie_aggregate_state
        WHERE organization_id = $1 AND aggregate_type = 'initiative'
        ORDER BY updated_at DESC`,
      [organizationId]
    );
    return result.rows.map((row) => ({
      version: row.version,
      initiative: row.payload_json,
      updatedAt:
        row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    }));
  }

  /**
   * Cold readback for the exact Portfolio gate attached to an Initiative.
   * The Initiative aggregate owns the decision reference; both rows are constrained
   * to the authenticated tenant so a caller cannot probe a foreign decision id.
   */
  async findPortfolioDecisionForInitiative(
    organizationId: string,
    initiativeId: string
  ): Promise<{ version: number; decision: PortfolioDecision } | null> {
    const result = await this.pool.query<{
      version: number;
      payload_json: PortfolioDecision;
    }>(
      `SELECT d.version, d.payload_json
         FROM ie_aggregate_state i
         JOIN ie_aggregate_state d
           ON d.organization_id = i.organization_id
          AND d.aggregate_type = 'decision'
          AND d.aggregate_id = i.payload_json->>'portfolioDecisionId'
        WHERE i.organization_id = $1
          AND i.aggregate_type = 'initiative'
          AND i.aggregate_id = $2
          AND d.payload_json->>'initiativeId' = i.aggregate_id`,
      [organizationId, initiativeId]
    );
    const row = result.rows[0];
    return row ? { version: row.version, decision: row.payload_json } : null;
  }

  async findBySource(
    organizationId: string,
    sourceType: string,
    sourceId: string
  ): Promise<InitiativeReadModel | null> {
    const result = await this.pool.query<{ target_id: string }>(
      `SELECT target_id
         FROM ie_aggregate_relations
        WHERE organization_id = $1 AND relation_type = 'SOURCE_REGISTRATION'
          AND source_type = $2 AND source_id = $3`,
      [organizationId, sourceType, sourceId]
    );
    const target = result.rows[0];
    if (!target) return null;
    return this.findById(organizationId, target.target_id);
  }

  async findDefinitionRemediationById(
    organizationId: string,
    aggregateType: 'task' | 'decision',
    aggregateId: string
  ): Promise<{ version: number; payload: Record<string, unknown> } | null> {
    const result = await this.pool.query<{
      version: number;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version, payload_json FROM ie_aggregate_state
        WHERE organization_id = $1 AND aggregate_type = $2 AND aggregate_id = $3
          AND ((aggregate_type = 'task' AND payload_json->>'workType' = 'FINANCE_EVIDENCE')
            OR (aggregate_type = 'decision' AND payload_json->>'decisionType' = 'TECHNICAL_OPTION'))`,
      [organizationId, aggregateType, aggregateId]
    );
    const row = result.rows[0];
    return row ? { version: row.version, payload: row.payload_json } : null;
  }

  async listLatestInitiativeCards(
    organizationId: string,
    initiativeId: string
  ): Promise<InitiativeCardVersionReadModel[]> {
    const result = await this.pool.query<{
      card_key: string;
      card_version: number;
      aggregate_version: number;
      applicability: InitiativeCardVersionReadModel['applicability'];
      completion: InitiativeCardVersionReadModel['completion'];
      quality: InitiativeCardVersionReadModel['quality'];
      freshness: InitiativeCardVersionReadModel['freshness'];
      review_state: InitiativeCardVersionReadModel['reviewState'];
      content_json: Record<string, unknown>;
      evidence_refs_json: string[];
      waiver_decision_id: string | null;
      published_by: string;
      published_at: Date | string;
    }>(
      `SELECT DISTINCT ON (card_key)
              card_key, card_version, aggregate_version, applicability, completion,
              quality, freshness, review_state, content_json, evidence_refs_json,
              waiver_decision_id, published_by, published_at
         FROM ie_initiative_card_versions
        WHERE organization_id = $1 AND initiative_id = $2
        ORDER BY card_key, card_version DESC`,
      [organizationId, initiativeId]
    );
    return result.rows.map((row) => ({
      cardKey: row.card_key,
      cardVersion: row.card_version,
      aggregateVersion: row.aggregate_version,
      applicability: row.applicability,
      completion: row.completion,
      quality: row.quality,
      freshness: row.freshness,
      reviewState: row.review_state,
      content: row.content_json,
      evidenceRefs: row.evidence_refs_json,
      waiverDecisionId: row.waiver_decision_id,
      publishedBy: row.published_by,
      publishedAt:
        row.published_at instanceof Date
          ? row.published_at.toISOString()
          : String(row.published_at),
    }));
  }

  async listInitiativeCardSelection(
    organizationId: string,
    initiativeId: string
  ): Promise<InitiativeCardSelectionItem[]> {
    const result = await this.pool.query<{
      card_key: string;
      included: boolean;
      position: number;
      requiredness: InitiativeCardSelectionItem['requiredness'];
      waiver_decision_id: string | null;
    }>(
      `SELECT card_key, included, position, requiredness, waiver_decision_id
         FROM ie_initiative_card_selection
        WHERE organization_id = $1 AND initiative_id = $2
        ORDER BY position ASC`,
      [organizationId, initiativeId]
    );
    return result.rows.map((row) => ({
      cardKey: row.card_key,
      included: row.included,
      position: row.position,
      requiredness: row.requiredness,
      waiverDecisionId: row.waiver_decision_id,
    }));
  }

  async listPendingDefinitionDecisions(
    organizationId: string,
    authorityId: string
  ): Promise<PendingDefinitionDecisionReadModel[]> {
    const result = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Omit<PendingDefinitionDecisionReadModel, 'version' | 'decisionId'>;
    }>(
      `SELECT version, aggregate_id, payload_json
         FROM ie_aggregate_state
        WHERE organization_id = $1 AND aggregate_type = 'decision'
          AND payload_json->>'gate' = 'DEFINITION'
          AND payload_json->>'status' = 'PENDING'
          AND payload_json->>'authorityId' = $2
        ORDER BY (payload_json->>'dueAt')::timestamptz ASC, updated_at ASC`,
      [organizationId, authorityId]
    );
    return result.rows.map((row) => ({
      version: row.version,
      decisionId: row.aggregate_id,
      ...row.payload_json,
    }));
  }

  async listPendingAnalysisDecisions(
    organizationId: string,
    authorityId: string
  ): Promise<PendingAnalysisDecisionReadModel[]> {
    const result = await this.pool.query<{
      version: number;
      aggregate_id: string;
      payload_json: Omit<PendingAnalysisDecisionReadModel, 'version' | 'decisionId'>;
    }>(
      `SELECT version, aggregate_id, payload_json
         FROM ie_aggregate_state
        WHERE organization_id = $1 AND aggregate_type = 'decision'
          AND payload_json->>'gate' = 'ANALYSIS'
          AND payload_json->>'status' = 'PENDING'
          AND payload_json->>'authorityId' = $2
        ORDER BY (payload_json->>'dueAt')::timestamptz ASC, updated_at ASC`,
      [organizationId, authorityId]
    );
    return result.rows.map((row) => ({
      version: row.version,
      decisionId: row.aggregate_id,
      ...row.payload_json,
    }));
  }

  async listPendingDefinitionRemediation(
    organizationId: string,
    actorId: string
  ): Promise<PendingDefinitionRemediationReadModel[]> {
    const result = await this.pool.query<{
      version: number;
      aggregate_type: 'task' | 'decision';
      aggregate_id: string;
      payload_json: Record<string, unknown>;
    }>(
      `SELECT version, aggregate_type, aggregate_id, payload_json
         FROM ie_aggregate_state
        WHERE organization_id = $1
          AND (
            (aggregate_type = 'task' AND payload_json->>'workType' = 'FINANCE_EVIDENCE'
             AND payload_json->>'status' = 'OPEN' AND payload_json->>'assigneeId' = $2)
            OR
            (aggregate_type = 'decision' AND payload_json->>'decisionType' = 'TECHNICAL_OPTION'
             AND payload_json->>'status' = 'PENDING' AND payload_json->>'authorityId' = $2)
          )
        ORDER BY (payload_json->>'dueAt')::timestamptz ASC, updated_at ASC`,
      [organizationId, actorId]
    );
    return result.rows.map((row) => ({
      version: row.version,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      initiativeId: String(row.payload_json.parentId),
      findingId: String(row.payload_json.findingId),
      workType:
        row.aggregate_type === 'task'
          ? ('FINANCE_EVIDENCE' as const)
          : ('TECHNICAL_OPTION' as const),
      title: String(row.payload_json.title),
      accountableId: String(
        row.aggregate_type === 'task' ? row.payload_json.assigneeId : row.payload_json.authorityId
      ),
      dueAt: String(row.payload_json.dueAt),
      status: row.aggregate_type === 'task' ? ('OPEN' as const) : ('PENDING' as const),
      options: Array.isArray(row.payload_json.options)
        ? row.payload_json.options.map((option) => String(option))
        : [],
    }));
  }

  async listSourceProposals(
    organizationId: string,
    proposalId?: string,
    includeDecided = false
  ): Promise<SourceProposalReadModel[]> {
    const result = await this.pool.query<{
      id: string;
      title: string;
      problem: string | null;
      proposed_outcome: string | null;
      source_type: string;
      source_id: string | null;
      source_version: number;
      version: number;
      project_id: string | null;
      initiative_owner_id: string | null;
      visibility: 'PROJECT' | 'ORGANIZATION_RESTRICTED';
      evidence_state: 'READY' | 'PARTIAL' | 'STALE' | 'UNKNOWN';
      duplicate_state: 'CLEAR' | 'POSSIBLE' | 'UNKNOWN';
      provenance_json: SourceProposalReadModel['provenance'];
      policy_id: string | null;
      policy_version: number | null;
      status: string;
      disposition: SourceProposalReadModel['disposition'];
      registered_initiative_id: string | null;
      updated_at: Date | string;
    }>(
      `SELECT id, title, problem, proposed_outcome, source_type, source_id, source_version,
              version, project_id, initiative_owner_id, visibility, evidence_state,
              duplicate_state, provenance_json, policy_id, policy_version, status, disposition,
              registered_initiative_id, updated_at
         FROM initiative_candidates
        WHERE organization_id = $1
          AND ($3::boolean OR (status = 'pending' AND registered_initiative_id IS NULL))
          AND ($2::text IS NULL OR id = $2)
        ORDER BY updated_at DESC, created_at DESC`,
      [organizationId, proposalId ?? null, includeDecided]
    );
    return result.rows.flatMap((row) =>
      row.source_id
        ? [
            {
              id: row.id,
              title: row.title,
              problem: row.problem,
              proposedOutcome: row.proposed_outcome,
              sourceType: row.source_type,
              sourceId: row.source_id,
              sourceVersion: row.source_version,
              proposalVersion: row.version,
              projectId: row.project_id,
              initiativeOwnerId: row.initiative_owner_id,
              visibility: row.visibility,
              evidenceState: row.evidence_state,
              duplicateState: row.duplicate_state,
              provenance: row.provenance_json,
              policyRef: {
                policyId: row.policy_id ?? 'UNKNOWN',
                policyVersion: row.policy_version ?? 0,
              },
              status: row.status,
              disposition: row.disposition,
              registeredInitiativeId: row.registered_initiative_id,
              updatedAt:
                row.updated_at instanceof Date
                  ? row.updated_at.toISOString()
                  : String(row.updated_at),
            },
          ]
        : []
    );
  }
}
