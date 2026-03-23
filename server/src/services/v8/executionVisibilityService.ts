/**
 * V8 Execution Visibility and Handoff Service
 *
 * WP-W3-LIFECYCLE-03: Canonical execution signals, hierarchical aggregation,
 * results handoff events, rebaseline proposals via shared approval spine,
 * and forecast confidence assessment with auto-capping.
 *
 * Decision W3-8:  Hierarchical signal aggregation — blockers roll up explicitly.
 * Decision W3-9:  Canonical results handoff event family.
 * Decision W3-10: Rebaseline uses shared proposal/approval spine (WP-W1-AI-03).
 * Decision W3-11: Forecast confidence auto-capped when critical-path data is weak.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  ExecutionSignal,
  SignalAggregation,
  ResultsHandoffEvent,
  RebaselineProposal,
  ForecastConfidence,
  EmitSignalParams,
  EmitResultsHandoffEventParams,
  CreateRebaselineProposalParams,
  AssessForecastConfidenceParams,
  SignalSeverity,
  ForecastConfidenceLevel,
  SourceObjectType,
} from '../../types/executionVisibility.js';
import {
  EmitSignalParamsSchema,
  EmitResultsHandoffEventParamsSchema,
  CreateRebaselineProposalParamsSchema,
  AssessForecastConfidenceParamsSchema,
  SIGNAL_SEVERITY_RANK,
} from '../../types/executionVisibility.js';
import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:ExecutionVisibility]';

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    logger.warn(`${LOG_PREFIX} Failed to parse JSON, using fallback`);
    return fallback;
  }
}

// ==========================================
// ROW TYPES
// ==========================================

interface SignalRow {
  signal_id: string;
  signal_type: string;
  source_object_type: string;
  source_object_id: string;
  organization_id: string;
  severity: string;
  payload: string;
  timestamp: string;
}

interface AggregationRow {
  aggregation_id: string;
  level: string;
  source_object_id: string;
  organization_id: string;
  source_signals: string;
  aggregated_severity: string;
  preserves_lineage: number;
  timestamp: string;
}

interface HandoffEventRow {
  event_id: string;
  event_type: string;
  initiative_id: string;
  organization_id: string;
  payload: string;
  timestamp: string;
}

interface RebaselineRow {
  proposal_id: string;
  initiative_id: string;
  organization_id: string;
  execution_run_id: string;
  reason: string;
  baseline_before: string;
  baseline_after: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

// ==========================================
// ROW MAPPERS
// ==========================================

function rowToSignal(row: SignalRow): ExecutionSignal {
  return {
    signalId: row.signal_id,
    signalType: row.signal_type as ExecutionSignal['signalType'],
    sourceObjectType: row.source_object_type as ExecutionSignal['sourceObjectType'],
    sourceObjectId: row.source_object_id,
    organizationId: row.organization_id,
    severity: row.severity as ExecutionSignal['severity'],
    payload: safeJsonParse(row.payload, {}),
    timestamp: row.timestamp,
  };
}

function rowToAggregation(row: AggregationRow): SignalAggregation {
  return {
    aggregationId: row.aggregation_id,
    level: row.level as SignalAggregation['level'],
    sourceObjectId: row.source_object_id,
    organizationId: row.organization_id,
    sourceSignals: safeJsonParse<string[]>(row.source_signals, []),
    aggregatedSeverity: row.aggregated_severity as SignalAggregation['aggregatedSeverity'],
    preservesLineage: row.preserves_lineage === 1,
    timestamp: row.timestamp,
  };
}

function rowToHandoffEvent(row: HandoffEventRow): ResultsHandoffEvent {
  return {
    eventId: row.event_id,
    eventType: row.event_type as ResultsHandoffEvent['eventType'],
    initiativeId: row.initiative_id,
    organizationId: row.organization_id,
    payload: safeJsonParse(row.payload, {}),
    timestamp: row.timestamp,
  };
}

function rowToRebaseline(row: RebaselineRow): RebaselineProposal {
  return {
    proposalId: row.proposal_id,
    initiativeId: row.initiative_id,
    organizationId: row.organization_id,
    executionRunId: row.execution_run_id,
    reason: row.reason,
    baselineBefore: safeJsonParse(row.baseline_before, {}),
    baselineAfter: safeJsonParse(row.baseline_after, {}),
    status: row.status as RebaselineProposal['status'],
    createdAt: row.created_at,
    resolvedAt: row.resolved_at || null,
  };
}

// ==========================================
// SEVERITY HELPERS
// ==========================================

function maxSeverity(severities: SignalSeverity[]): SignalSeverity {
  if (severities.length === 0) return 'info';
  let max: SignalSeverity = 'info';
  for (const s of severities) {
    if (SIGNAL_SEVERITY_RANK[s] > SIGNAL_SEVERITY_RANK[max]) {
      max = s;
    }
  }
  return max;
}

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Emit a canonical execution signal.
 */
export async function emitSignal(params: EmitSignalParams): Promise<ExecutionSignal> {
  const validated = EmitSignalParamsSchema.parse(params);

  const signalId = uuidv4();
  const now = new Date().toISOString();

  const signal: ExecutionSignal = {
    signalId,
    signalType: validated.signalType,
    sourceObjectType: validated.sourceObjectType,
    sourceObjectId: validated.sourceObjectId,
    organizationId: validated.organizationId,
    severity: validated.severity,
    payload: validated.payload,
    timestamp: now,
  };

  await dbRun(
    `INSERT INTO v8_execution_signals (
      signal_id, signal_type, source_object_type, source_object_id,
      organization_id, severity, payload, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      signal.signalId,
      signal.signalType,
      signal.sourceObjectType,
      signal.sourceObjectId,
      signal.organizationId,
      signal.severity,
      JSON.stringify(signal.payload),
      signal.timestamp,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Emitted signal ${signal.signalType} [${signal.severity}] for ${signal.sourceObjectType}:${signal.sourceObjectId}`,
  );
  return signal;
}

/**
 * Get signals by source object with org-level isolation.
 */
export async function getSignalsBySource(
  sourceObjectType: SourceObjectType,
  sourceObjectId: string,
  organizationId: string,
): Promise<ExecutionSignal[]> {
  const rows = await dbAll<SignalRow>(
    `SELECT * FROM v8_execution_signals
     WHERE source_object_type = ? AND source_object_id = ? AND organization_id = ?
     ORDER BY timestamp ASC`,
    [sourceObjectType, sourceObjectId, organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToSignal);
}

/**
 * Decision W3-8: Hierarchical signal aggregation.
 * Aggregates signals for a given level and source object.
 * Blockers and critical severities roll up explicitly — never averaged away.
 * Preserves lineage (source signal IDs) for traceability down.
 */
export async function aggregateSignals(
  level: SignalAggregation['level'],
  sourceObjectId: string,
  organizationId: string,
): Promise<SignalAggregation> {
  const sourceTypeForLevel: Record<string, SourceObjectType> = {
    task: 'task',
    initiative: 'initiative',
    project: 'project',
    pmo: 'program',
  };

  const sourceObjectType = sourceTypeForLevel[level] || 'initiative';

  const rows = await dbAll<SignalRow>(
    `SELECT * FROM v8_execution_signals
     WHERE source_object_type = ? AND source_object_id = ? AND organization_id = ?
     ORDER BY timestamp ASC`,
    [sourceObjectType, sourceObjectId, organizationId],
    { fallback: true },
  );

  const signals = (rows || []).map(rowToSignal);
  const sourceSignalIds = signals.map((s) => s.signalId);
  const severities = signals.map((s) => s.severity);
  const aggregatedSeverity = maxSeverity(severities);

  const aggregationId = uuidv4();
  const now = new Date().toISOString();

  const aggregation: SignalAggregation = {
    aggregationId,
    level,
    sourceObjectId,
    organizationId,
    sourceSignals: sourceSignalIds,
    aggregatedSeverity,
    preservesLineage: true,
    timestamp: now,
  };

  await dbRun(
    `INSERT INTO v8_signal_aggregations (
      aggregation_id, level, source_object_id, organization_id,
      source_signals, aggregated_severity, preserves_lineage, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      aggregation.aggregationId,
      aggregation.level,
      aggregation.sourceObjectId,
      aggregation.organizationId,
      JSON.stringify(aggregation.sourceSignals),
      aggregation.aggregatedSeverity,
      aggregation.preservesLineage ? 1 : 0,
      aggregation.timestamp,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Aggregated ${signals.length} signals at ${level} level → ${aggregatedSeverity}`,
  );
  return aggregation;
}

/**
 * Decision W3-9: Emit a canonical results handoff event.
 */
export async function emitResultsHandoffEvent(
  params: EmitResultsHandoffEventParams,
): Promise<ResultsHandoffEvent> {
  const validated = EmitResultsHandoffEventParamsSchema.parse(params);

  const eventId = uuidv4();
  const now = new Date().toISOString();

  const event: ResultsHandoffEvent = {
    eventId,
    eventType: validated.eventType,
    initiativeId: validated.initiativeId,
    organizationId: validated.organizationId,
    payload: validated.payload,
    timestamp: now,
  };

  await dbRun(
    `INSERT INTO v8_results_handoff_events (
      event_id, event_type, initiative_id, organization_id, payload, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      event.eventId,
      event.eventType,
      event.initiativeId,
      event.organizationId,
      JSON.stringify(event.payload),
      event.timestamp,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Emitted handoff event ${event.eventType} for initiative ${event.initiativeId}`,
  );
  return event;
}

/**
 * Get handoff events for an initiative with org-level isolation.
 */
export async function getHandoffEventsByInitiative(
  initiativeId: string,
  organizationId: string,
): Promise<ResultsHandoffEvent[]> {
  const rows = await dbAll<HandoffEventRow>(
    `SELECT * FROM v8_results_handoff_events
     WHERE initiative_id = ? AND organization_id = ?
     ORDER BY timestamp ASC`,
    [initiativeId, organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToHandoffEvent);
}

/**
 * Decision W3-10: Create a rebaseline proposal linked to the shared approval spine.
 * Status starts as 'draft' — follows the same governance lifecycle as ActionProposal.
 */
export async function createRebaselineProposal(
  params: CreateRebaselineProposalParams,
): Promise<RebaselineProposal> {
  const validated = CreateRebaselineProposalParamsSchema.parse(params);

  const proposalId = uuidv4();
  const now = new Date().toISOString();

  const proposal: RebaselineProposal = {
    proposalId,
    initiativeId: validated.initiativeId,
    organizationId: validated.organizationId,
    executionRunId: validated.executionRunId,
    reason: validated.reason,
    baselineBefore: validated.baselineBefore,
    baselineAfter: validated.baselineAfter,
    status: 'draft',
    createdAt: now,
    resolvedAt: null,
  };

  await dbRun(
    `INSERT INTO v8_rebaseline_proposals (
      proposal_id, initiative_id, organization_id, execution_run_id,
      reason, baseline_before, baseline_after, status, created_at, resolved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      proposal.proposalId,
      proposal.initiativeId,
      proposal.organizationId,
      proposal.executionRunId,
      proposal.reason,
      JSON.stringify(proposal.baselineBefore),
      JSON.stringify(proposal.baselineAfter),
      proposal.status,
      proposal.createdAt,
      proposal.resolvedAt,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Created rebaseline proposal ${proposalId} for initiative ${validated.initiativeId}`,
  );
  return proposal;
}

/**
 * Get rebaseline proposals for an initiative with org-level isolation.
 */
export async function getRebaselineProposalsByInitiative(
  initiativeId: string,
  organizationId: string,
): Promise<RebaselineProposal[]> {
  const rows = await dbAll<RebaselineRow>(
    `SELECT * FROM v8_rebaseline_proposals
     WHERE initiative_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [initiativeId, organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToRebaseline);
}

/**
 * Decision W3-11: Assess forecast confidence with auto-capping.
 * Confidence cannot exceed data reliability on the critical path.
 *
 * Capping rules:
 * - dataReliabilityScore < 0.3 → insufficient_data, capped by data_reliability
 * - dataReliabilityScore < 0.6 → low_confidence, capped by data_reliability
 * - hasCapacityGap → capped at low_confidence by capacity_gap
 * - !criticalPathKnown → capped at low_confidence by critical_path_unknown
 * - Otherwise: score >= 0.8 → high, >= 0.6 → medium
 */
export async function assessForecastConfidence(
  params: AssessForecastConfidenceParams,
): Promise<ForecastConfidence> {
  const validated = AssessForecastConfidenceParamsSchema.parse(params);

  const { dataReliabilityScore, hasCapacityGap, criticalPathKnown } = validated;

  if (dataReliabilityScore < 0.3) {
    return {
      confidenceLevel: 'insufficient_data',
      cappedBy: 'data_reliability',
      dataReliabilityScore,
    };
  }

  if (dataReliabilityScore < 0.6) {
    return {
      confidenceLevel: 'low_confidence',
      cappedBy: 'data_reliability',
      dataReliabilityScore,
    };
  }

  if (hasCapacityGap) {
    return {
      confidenceLevel: 'low_confidence',
      cappedBy: 'capacity_gap',
      dataReliabilityScore,
    };
  }

  if (!criticalPathKnown) {
    return {
      confidenceLevel: 'low_confidence',
      cappedBy: 'critical_path_unknown',
      dataReliabilityScore,
    };
  }

  let confidenceLevel: ForecastConfidenceLevel;
  if (dataReliabilityScore >= 0.8) {
    confidenceLevel = 'high_confidence';
  } else {
    confidenceLevel = 'medium_confidence';
  }

  return {
    confidenceLevel,
    cappedBy: null,
    dataReliabilityScore,
  };
}

// ==========================================
// DASHBOARD, BLOCKERS, REBASELINE HISTORY, ROLLUP (Wave 11)
// ==========================================

export type ExecutionDashboardHealth = 'healthy' | 'at_risk' | 'blocked';

export interface ExecutionDashboardView {
  signals: ExecutionSignal[];
  handoffs: ResultsHandoffEvent[];
  forecasts: ForecastConfidence;
  overallHealth: ExecutionDashboardHealth;
}

export interface ExecutionBlockerItem {
  kind: 'signal_severity_blocker' | 'low_forecast_confidence';
  signal?: ExecutionSignal;
  dataReliabilityScore?: number;
  message: string;
}

function deriveAssessParamsFromSignals(
  signals: ExecutionSignal[],
): AssessForecastConfidenceParams {
  let dataReliabilityScore = 0.92;
  for (const s of signals) {
    if (s.severity === 'blocker') {
      dataReliabilityScore -= 0.4;
    } else if (s.severity === 'critical') {
      dataReliabilityScore -= 0.22;
    } else if (s.severity === 'warning') {
      dataReliabilityScore -= 0.07;
    }
    if (s.signalType === 'forecast_low_confidence_count') {
      dataReliabilityScore -= 0.18;
    }
    if (s.signalType === 'missing_baseline_count' || s.signalType === 'missing_estimate_count') {
      dataReliabilityScore -= 0.08;
    }
  }
  dataReliabilityScore = Math.max(0, Math.min(1, dataReliabilityScore));

  const hasCapacityGap = signals.some(
    (s) =>
      s.signalType === 'owners_over_capacity_count' &&
      s.severity !== 'info',
  );

  const criticalPathKnown = !signals.some(
    (s) =>
      s.signalType === 'critical_path_slip_count' &&
      (s.severity === 'critical' || s.severity === 'blocker'),
  );

  return { dataReliabilityScore, hasCapacityGap, criticalPathKnown };
}

function overallHealthFromSignalsAndForecast(
  signals: ExecutionSignal[],
  forecast: ForecastConfidence,
): ExecutionDashboardHealth {
  if (signals.some((s) => s.severity === 'blocker')) {
    return 'blocked';
  }
  if (forecast.dataReliabilityScore < 0.3) {
    return 'at_risk';
  }
  if (signals.some((s) => s.severity === 'critical')) {
    return 'at_risk';
  }
  if (signals.some((s) => s.severity === 'warning')) {
    return 'at_risk';
  }
  return 'healthy';
}

/**
 * Initiative-scoped execution view: signals, handoffs, derived forecast confidence, health.
 */
export async function getExecutionDashboard(
  initiativeId: string,
  organizationId: string,
): Promise<ExecutionDashboardView> {
  const signalRows = await dbAll<SignalRow>(
    `SELECT * FROM v8_execution_signals
     WHERE organization_id = ?
       AND source_object_type = 'initiative'
       AND source_object_id = ?
     ORDER BY timestamp DESC`,
    [organizationId, initiativeId],
    { fallback: true },
  );

  const signals = (signalRows || []).map(rowToSignal);

  const handoffRows = await dbAll<HandoffEventRow>(
    `SELECT * FROM v8_results_handoff_events
     WHERE initiative_id = ? AND organization_id = ?
     ORDER BY timestamp DESC`,
    [initiativeId, organizationId],
    { fallback: true },
  );

  const handoffs = (handoffRows || []).map(rowToHandoffEvent);

  const assessParams = deriveAssessParamsFromSignals(signals);
  const forecasts = await assessForecastConfidence(assessParams);

  const overallHealth = overallHealthFromSignalsAndForecast(signals, forecasts);

  return {
    signals,
    handoffs,
    forecasts,
    overallHealth,
  };
}

/**
 * Blockers: severity === 'blocker', or derived forecast data reliability below 0.3.
 * (Canonical model uses severity `blocker`, not signal_type `blocker`.)
 */
export async function detectBlockers(
  initiativeId: string,
  organizationId: string,
): Promise<ExecutionBlockerItem[]> {
  const dashboard = await getExecutionDashboard(initiativeId, organizationId);
  const out: ExecutionBlockerItem[] = [];

  for (const s of dashboard.signals) {
    if (s.severity === 'blocker') {
      out.push({
        kind: 'signal_severity_blocker',
        signal: s,
        message: `Execution signal ${s.signalType} is marked as blocker`,
      });
    }
  }

  if (dashboard.forecasts.dataReliabilityScore < 0.3) {
    out.push({
      kind: 'low_forecast_confidence',
      dataReliabilityScore: dashboard.forecasts.dataReliabilityScore,
      message: 'Forecast confidence capped: data reliability score below 0.3',
    });
  }

  return out;
}

/**
 * Rebaseline proposals for an initiative, newest first.
 */
export async function getRebaselineHistory(
  initiativeId: string,
  organizationId: string,
): Promise<RebaselineProposal[]> {
  const rows = await dbAll<RebaselineRow>(
    `SELECT * FROM v8_rebaseline_proposals
     WHERE initiative_id = ? AND organization_id = ?
     ORDER BY created_at DESC`,
    [initiativeId, organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToRebaseline);
}

export interface SignalRollupResult {
  byType: Map<string, number>;
  byInitiative: Map<string, number>;
  total: number;
}

/**
 * Count execution signals in a time window for an organization.
 * Initiative bucket uses source_object_id when source_object_type is initiative; other sources roll into __non_initiative__.
 */
export async function rollupSignals(
  organizationId: string,
  fromDate: string,
  toDate: string,
): Promise<SignalRollupResult> {
  const rows = await dbAll<SignalRow>(
    `SELECT * FROM v8_execution_signals
     WHERE organization_id = ?
       AND timestamp >= ?
       AND timestamp <= ?
     ORDER BY timestamp ASC`,
    [organizationId, fromDate, toDate],
    { fallback: true },
  );

  const signals = (rows || []).map(rowToSignal);
  const byType = new Map<string, number>();
  const byInitiative = new Map<string, number>();

  for (const s of signals) {
    byType.set(s.signalType, (byType.get(s.signalType) ?? 0) + 1);

    if (s.sourceObjectType === 'initiative') {
      const k = s.sourceObjectId;
      byInitiative.set(k, (byInitiative.get(k) ?? 0) + 1);
    } else {
      const k = '__non_initiative__';
      byInitiative.set(k, (byInitiative.get(k) ?? 0) + 1);
    }
  }

  return {
    byType,
    byInitiative,
    total: signals.length,
  };
}
