/**
 * V8 Trust, Audit and Observability Service
 *
 * Core primitives for AI output trust classification, provenance tracking,
 * support trace assembly, degraded condition recording, and health signal observability.
 *
 * Decision 23: trust is assigned by runtime contract (hybrid), not model self-report alone.
 * Decision 24: lightweight provenance everywhere, full ledger where business meaning matters.
 * Decision 25: brief explanation for users, full trace for operators.
 * Decision 26: voice_transcript_partial is an explicit degraded condition.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  TrustClass,
  ProvenanceLedgerEntry,
  SupportTrace,
  DegradedCondition,
  HealthSignal,
  RoutingExplanation,
  EvidenceRef,
  CitationBinding,
  TrustSummary,
  AssignTrustClassParams,
  CreateProvenanceLedgerEntryParams,
  CreateSupportTraceParams,
  RecordDegradedConditionParams,
  RecordHealthSignalParams,
  AudienceLevel,
} from '../../types/trustAudit.js';
import {
  AssignTrustClassParamsSchema,
  CreateProvenanceLedgerEntryParamsSchema,
  CreateSupportTraceParamsSchema,
  RecordDegradedConditionParamsSchema,
  RecordHealthSignalParamsSchema,
  TRUST_CLASS_RANK,
} from '../../types/trustAudit.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:TrustAudit]';

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

interface ProvenanceRow {
  entry_id: string;
  organization_id: string;
  output_id: string;
  output_type: string;
  trust_class: string;
  citation_bindings: string;
  context_snapshot_id: string;
  retrieval_trace_id: string | null;
  execution_run_id: string | null;
  routing_explanation_id: string | null;
  trust_summary: string;
  created_at: string;
  created_by: string;
}

interface SupportTraceRow {
  trace_id: string;
  organization_id: string;
  context_snapshot_id: string;
  execution_run_id: string | null;
  retrieval_request_id: string | null;
  routing_explanation_id: string | null;
  trust_class: string;
  routing_explanation: string | null;
  degraded_conditions: string;
  created_at: string;
}

interface DegradedConditionRow {
  condition_id: string;
  organization_id: string;
  condition_type: string;
  severity: string;
  user_message: string;
  operator_detail: string;
  support_trace_id: string | null;
  created_at: string;
}

interface HealthSignalRow {
  signal_id: string;
  organization_id: string;
  signal_type: string;
  component_id: string;
  status: string;
  value: number | null;
  threshold: number | null;
  metadata: string;
  timestamp: string;
}

// ==========================================
// ROW MAPPERS
// ==========================================

function rowToProvenance(row: ProvenanceRow): ProvenanceLedgerEntry {
  return {
    entryId: row.entry_id,
    organizationId: row.organization_id,
    outputId: row.output_id,
    outputType: row.output_type as ProvenanceLedgerEntry['outputType'],
    trustClass: row.trust_class as TrustClass,
    citationBindings: safeJsonParse<CitationBinding[]>(row.citation_bindings, []),
    contextSnapshotId: row.context_snapshot_id,
    retrievalTraceId: row.retrieval_trace_id,
    executionRunId: row.execution_run_id,
    routingExplanationId: row.routing_explanation_id,
    trustSummary: safeJsonParse<TrustSummary>(row.trust_summary, {
      groundedFactCount: 0,
      synthesisCount: 0,
      uncertainInferenceCount: 0,
      degradedCount: 0,
      lowestTrustClass: 'degraded',
      degradedFlag: false,
    }),
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

function rowToSupportTrace(row: SupportTraceRow): SupportTrace {
  return {
    traceId: row.trace_id,
    organizationId: row.organization_id,
    contextSnapshotId: row.context_snapshot_id,
    executionRunId: row.execution_run_id,
    retrievalRequestId: row.retrieval_request_id,
    routingExplanationId: row.routing_explanation_id,
    trustClass: row.trust_class as TrustClass,
    routingExplanation: safeJsonParse<RoutingExplanation | null>(row.routing_explanation, null),
    degradedConditions: safeJsonParse<DegradedCondition[]>(row.degraded_conditions, []),
    createdAt: row.created_at,
  };
}

function rowToDegradedCondition(row: DegradedConditionRow): DegradedCondition {
  return {
    conditionId: row.condition_id,
    organizationId: row.organization_id,
    conditionType: row.condition_type as DegradedCondition['conditionType'],
    severity: row.severity as DegradedCondition['severity'],
    userMessage: row.user_message,
    operatorDetail: row.operator_detail,
    supportTraceId: row.support_trace_id,
    createdAt: row.created_at,
  };
}

function rowToHealthSignal(row: HealthSignalRow): HealthSignal {
  return {
    signalId: row.signal_id,
    organizationId: row.organization_id,
    signalType: row.signal_type as HealthSignal['signalType'],
    componentId: row.component_id,
    status: row.status as HealthSignal['status'],
    value: row.value,
    threshold: row.threshold,
    metadata: safeJsonParse(row.metadata, {}),
    timestamp: row.timestamp,
  };
}

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Assign a trust class using hybrid logic (Decision 23).
 *
 * The model may propose a class, but the final assignment is derived from:
 * source/provenance quality, retrieval quality, execution path, and policy checks.
 * If the model claims grounded_fact but evidence doesn't support it, the class is downgraded.
 */
export async function assignTrustClass(params: AssignTrustClassParams): Promise<TrustClass> {
  const validated = AssignTrustClassParamsSchema.parse(params);

  if (validated.degradedModeFlag) {
    return 'degraded';
  }

  if (validated.evidenceRefs.length === 0) {
    return 'uncertain_inference';
  }

  const hasStrongVerified = validated.evidenceRefs.some(
    (ref) => ref.bindingStrength === 'strong' && ref.verificationState === 'verified',
  );

  if (hasStrongVerified && validated.evidenceRefs.length === 1) {
    return 'grounded_fact';
  }

  const allModerateOrBetter = validated.evidenceRefs.every(
    (ref) => ref.bindingStrength === 'strong' || ref.bindingStrength === 'moderate',
  );

  if (validated.evidenceRefs.length >= 2 && allModerateOrBetter) {
    if (hasStrongVerified) {
      return 'grounded_fact';
    }
    return 'synthesis';
  }

  if (
    validated.modelDeclaredClass === 'grounded_fact' &&
    !hasStrongVerified
  ) {
    logger.info(
      `${LOG_PREFIX} Model declared grounded_fact but evidence insufficient — downgrading`,
    );
    return validated.evidenceRefs.length >= 2 ? 'synthesis' : 'uncertain_inference';
  }

  return validated.modelDeclaredClass ?? 'uncertain_inference';
}

/**
 * Create a provenance ledger entry (Decision 24: full ledger for important outputs).
 */
export async function createProvenanceLedgerEntry(
  params: CreateProvenanceLedgerEntryParams,
): Promise<ProvenanceLedgerEntry> {
  const validated = CreateProvenanceLedgerEntryParamsSchema.parse(params);

  const entryId = uuidv4();
  const now = new Date().toISOString();

  const entry: ProvenanceLedgerEntry = {
    entryId,
    organizationId: validated.organizationId,
    outputId: validated.outputId,
    outputType: validated.outputType,
    trustClass: validated.trustClass,
    citationBindings: validated.citationBindings,
    contextSnapshotId: validated.contextSnapshotId,
    retrievalTraceId: validated.retrievalTraceId ?? null,
    executionRunId: validated.executionRunId ?? null,
    routingExplanationId: validated.routingExplanationId ?? null,
    trustSummary: validated.trustSummary,
    createdAt: now,
    createdBy: validated.createdBy,
  };

  await dbRun(
    `INSERT INTO v8_provenance_ledger (
      entry_id, organization_id, output_id, output_type,
      trust_class, citation_bindings, context_snapshot_id,
      retrieval_trace_id, execution_run_id, routing_explanation_id,
      trust_summary, created_at, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.entryId,
      entry.organizationId,
      entry.outputId,
      entry.outputType,
      entry.trustClass,
      JSON.stringify(entry.citationBindings),
      entry.contextSnapshotId,
      entry.retrievalTraceId,
      entry.executionRunId,
      entry.routingExplanationId,
      JSON.stringify(entry.trustSummary),
      entry.createdAt,
      entry.createdBy,
    ],
  );

  logger.info(`${LOG_PREFIX} Created provenance entry ${entryId} for output ${entry.outputId}`);
  return entry;
}

/**
 * Retrieve provenance entries for a given output, scoped to organization.
 */
export async function getProvenanceByOutput(
  outputId: string,
  organizationId: string,
): Promise<ProvenanceLedgerEntry[]> {
  const rows = await dbAll<ProvenanceRow>(
    `SELECT * FROM v8_provenance_ledger
     WHERE output_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [outputId, organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToProvenance);
}

/**
 * Create a unified support trace.
 */
export async function createSupportTrace(
  params: CreateSupportTraceParams,
): Promise<SupportTrace> {
  const validated = CreateSupportTraceParamsSchema.parse(params);

  const traceId = uuidv4();
  const now = new Date().toISOString();

  const trace: SupportTrace = {
    traceId,
    organizationId: validated.organizationId,
    contextSnapshotId: validated.contextSnapshotId,
    executionRunId: validated.executionRunId ?? null,
    retrievalRequestId: validated.retrievalRequestId ?? null,
    routingExplanationId: validated.routingExplanationId ?? null,
    trustClass: validated.trustClass,
    routingExplanation: validated.routingExplanation ?? null,
    degradedConditions: validated.degradedConditions,
    createdAt: now,
  };

  await dbRun(
    `INSERT INTO v8_support_traces (
      trace_id, organization_id, context_snapshot_id,
      execution_run_id, retrieval_request_id, routing_explanation_id,
      trust_class, routing_explanation, degraded_conditions, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      trace.traceId,
      trace.organizationId,
      trace.contextSnapshotId,
      trace.executionRunId,
      trace.retrievalRequestId,
      trace.routingExplanationId,
      trace.trustClass,
      trace.routingExplanation ? JSON.stringify(trace.routingExplanation) : null,
      JSON.stringify(trace.degradedConditions),
      trace.createdAt,
    ],
  );

  logger.info(`${LOG_PREFIX} Created support trace ${traceId} for org ${trace.organizationId}`);
  return trace;
}

/**
 * Retrieve a support trace by ID with organization-level isolation.
 */
export async function getSupportTrace(
  traceId: string,
  organizationId: string,
): Promise<SupportTrace | null> {
  const row = await dbGet<SupportTraceRow>(
    `SELECT * FROM v8_support_traces
     WHERE trace_id = ? AND organization_id = ?`,
    [traceId, organizationId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToSupportTrace(row);
}

/**
 * Retrieve all support traces for an execution run, scoped to organization.
 */
export async function getSupportTracesByRun(
  executionRunId: string,
  organizationId: string,
): Promise<SupportTrace[]> {
  const rows = await dbAll<SupportTraceRow>(
    `SELECT * FROM v8_support_traces
     WHERE execution_run_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [executionRunId, organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToSupportTrace);
}

/**
 * Get routing explanation at the appropriate audience level (Decision 25).
 *
 * 'user': concise, no internal details (model names, policy weights, raw heuristics).
 * 'operator'/'admin': full routing trace with all details.
 */
export async function getRoutingExplanation(
  traceId: string,
  organizationId: string,
  audienceLevel: AudienceLevel,
): Promise<string | null> {
  const trace = await getSupportTrace(traceId, organizationId);
  if (!trace || !trace.routingExplanation) return null;

  const routing = trace.routingExplanation;

  if (audienceLevel === 'user') {
    let explanation = `Purpose: ${routing.purpose}.`;
    if (routing.fallbackOccurred) {
      explanation += ' An alternative model was used due to temporary availability constraints.';
    }
    return explanation;
  }

  let explanation =
    `Model: ${routing.modelSelected}. ` +
    `Reason: ${routing.modelSelectionReason}. ` +
    `Workload class: ${routing.workloadClass}. ` +
    `Purpose: ${routing.purpose}.`;

  if (routing.fallbackOccurred) {
    explanation +=
      ` Fallback from ${routing.fallbackFrom ?? 'unknown'}: ${routing.fallbackReason ?? 'unspecified'}.`;
  }

  if (routing.costTier) {
    explanation += ` Cost tier: ${routing.costTier}.`;
  }

  if (routing.latencyObservedMs != null) {
    explanation += ` Latency: ${routing.latencyObservedMs}ms.`;
  }

  return explanation;
}

/**
 * Record a degraded condition (Decision 26: voice_transcript_partial is explicit).
 */
export async function recordDegradedCondition(
  params: RecordDegradedConditionParams,
): Promise<DegradedCondition> {
  const validated = RecordDegradedConditionParamsSchema.parse(params);

  const conditionId = uuidv4();
  const now = new Date().toISOString();

  const condition: DegradedCondition = {
    conditionId,
    organizationId: validated.organizationId,
    conditionType: validated.conditionType,
    severity: validated.severity,
    userMessage: validated.userMessage,
    operatorDetail: validated.operatorDetail,
    supportTraceId: validated.supportTraceId ?? null,
    createdAt: now,
  };

  await dbRun(
    `INSERT INTO v8_degraded_conditions (
      condition_id, organization_id, condition_type, severity,
      user_message, operator_detail, support_trace_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      condition.conditionId,
      condition.organizationId,
      condition.conditionType,
      condition.severity,
      condition.userMessage,
      condition.operatorDetail,
      condition.supportTraceId,
      condition.createdAt,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Recorded degraded condition ${conditionId}: ${condition.conditionType}`,
  );
  return condition;
}

/**
 * Get all degraded conditions for an organization, scoped by date range.
 */
export async function getDegradedConditions(
  organizationId: string,
  fromDate?: string,
  toDate?: string,
): Promise<DegradedCondition[]> {
  let sql = `SELECT * FROM v8_degraded_conditions WHERE organization_id = ?`;
  const params: unknown[] = [organizationId];

  if (fromDate) {
    sql += ` AND created_at >= ?`;
    params.push(fromDate);
  }
  if (toDate) {
    sql += ` AND created_at <= ?`;
    params.push(toDate);
  }

  sql += ` ORDER BY created_at DESC`;

  const rows = await dbAll<DegradedConditionRow>(sql, params, { fallback: true });
  return (rows || []).map(rowToDegradedCondition);
}

/**
 * Get all health signals for an organization, scoped by date range.
 */
export async function getHealthSignals(
  organizationId: string,
  fromDate?: string,
  toDate?: string,
): Promise<HealthSignal[]> {
  let sql = `SELECT * FROM v8_health_signals WHERE organization_id = ?`;
  const params: unknown[] = [organizationId];

  if (fromDate) {
    sql += ` AND timestamp >= ?`;
    params.push(fromDate);
  }
  if (toDate) {
    sql += ` AND timestamp <= ?`;
    params.push(toDate);
  }

  sql += ` ORDER BY timestamp DESC`;

  const rows = await dbAll<HealthSignalRow>(sql, params, { fallback: true });
  return (rows || []).map(rowToHealthSignal);
}

/**
 * Record a health signal for observability baseline.
 */
export async function recordHealthSignal(
  params: RecordHealthSignalParams,
): Promise<HealthSignal> {
  const validated = RecordHealthSignalParamsSchema.parse(params);

  const signalId = uuidv4();
  const now = new Date().toISOString();

  const signal: HealthSignal = {
    signalId,
    organizationId: validated.organizationId,
    signalType: validated.signalType,
    componentId: validated.componentId,
    status: validated.status,
    value: validated.value ?? null,
    threshold: validated.threshold ?? null,
    metadata: validated.metadata,
    timestamp: now,
  };

  await dbRun(
    `INSERT INTO v8_health_signals (
      signal_id, organization_id, signal_type, component_id,
      status, value, threshold, metadata, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      signal.signalId,
      signal.organizationId,
      signal.signalType,
      signal.componentId,
      signal.status,
      signal.value,
      signal.threshold,
      JSON.stringify(signal.metadata),
      signal.timestamp,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Recorded health signal ${signalId}: ${signal.signalType} = ${signal.status}`,
  );
  return signal;
}

// ==========================================
// PROVENANCE LEDGER WIRING (Decision D24)
// ==========================================

export interface ProvenanceLedgerResult {
  entries: ProvenanceLedgerEntry[];
  explanation: RoutingExplanation | null;
  supportTrace: SupportTrace | null;
}

/**
 * Assemble the full provenance chain for an output — all provenance entries
 * ordered by creation, with the latest support trace and routing explanation.
 */
export async function buildProvenanceLedger(
  outputId: string,
  organizationId: string,
): Promise<ProvenanceLedgerResult> {
  const entries = await getProvenanceByOutput(outputId, organizationId);

  let explanation: RoutingExplanation | null = null;
  let supportTrace: SupportTrace | null = null;

  const routingExplanationId = entries.find((e) => e.routingExplanationId)?.routingExplanationId;
  const executionRunId = entries.find((e) => e.executionRunId)?.executionRunId;

  if (executionRunId) {
    const traces = await getSupportTracesByRun(executionRunId, organizationId);
    if (traces.length > 0) {
      supportTrace = traces[traces.length - 1];
      explanation = supportTrace.routingExplanation;
    }
  }

  logger.info(
    `${LOG_PREFIX} Built provenance ledger for output ${outputId}: ${entries.length} entries`,
  );

  return { entries, explanation, supportTrace };
}

/**
 * Compute the effective trust class for an output based on its provenance chain.
 *
 * - If any entry has bindingStrength 'none' in any citation binding → degraded
 * - If any entry has verificationState 'unverified' in any citation binding → uncertain_inference
 * - If all entries are verified with strong binding → grounded_fact
 * - Otherwise → synthesis
 */
export async function assessTrustClass(
  outputId: string,
  organizationId: string,
): Promise<TrustClass> {
  const entries = await getProvenanceByOutput(outputId, organizationId);

  if (entries.length === 0) {
    return 'uncertain_inference';
  }

  const allBindings = entries.flatMap((e) => e.citationBindings);
  const allEvidenceRefs = allBindings.flatMap((b) => b.evidenceRefs);

  if (allEvidenceRefs.length === 0) {
    return 'uncertain_inference';
  }

  const hasNoneBinding = allEvidenceRefs.some((ref) => ref.bindingStrength === 'none');
  if (hasNoneBinding) {
    return 'degraded';
  }

  const hasUnverified = allEvidenceRefs.some((ref) => ref.verificationState === 'unverified');
  if (hasUnverified) {
    return 'uncertain_inference';
  }

  const allStrongVerified = allEvidenceRefs.every(
    (ref) => ref.bindingStrength === 'strong' && ref.verificationState === 'verified',
  );
  if (allStrongVerified) {
    return 'grounded_fact';
  }

  return 'synthesis';
}

/**
 * Query provenance entries for an organization in a date range.
 */
export async function getProvenanceByOrg(
  organizationId: string,
  fromDate: string,
  toDate: string,
  limit?: number,
): Promise<ProvenanceLedgerEntry[]> {
  let sql = `SELECT * FROM v8_provenance_ledger
     WHERE organization_id = ? AND created_at >= ? AND created_at <= ?
     ORDER BY created_at DESC`;
  const params: unknown[] = [organizationId, fromDate, toDate];

  if (limit != null && limit > 0) {
    sql += ` LIMIT ?`;
    params.push(limit);
  }

  const rows = await dbAll<ProvenanceRow>(sql, params, { fallback: true });
  return (rows || []).map(rowToProvenance);
}

// ==========================================
// ROUTING EXPLANATION RUNTIME (Decision D25)
// ==========================================

export interface UserExplanationResult {
  summary: string;
  trustClass: TrustClass;
  hasDegradedConditions: boolean;
}

/**
 * Build a concise user-facing explanation string from the provenance chain.
 * Hides internal details (model names, policy weights, raw heuristics).
 */
export async function buildUserExplanation(
  outputId: string,
  organizationId: string,
): Promise<UserExplanationResult> {
  const ledger = await buildProvenanceLedger(outputId, organizationId);
  const trustClass = await assessTrustClass(outputId, organizationId);

  const hasDegradedConditions =
    ledger.supportTrace != null && ledger.supportTrace.degradedConditions.length > 0;

  let summary: string;

  switch (trustClass) {
    case 'grounded_fact':
      summary = 'This output is based on verified, strongly-bound sources.';
      break;
    case 'synthesis':
      summary = 'This output synthesizes information from multiple sources.';
      break;
    case 'uncertain_inference':
      summary = 'This output contains inferences that could not be fully verified.';
      break;
    case 'degraded':
      summary = 'This output was produced under degraded conditions and may be less reliable.';
      break;
    default:
      summary = 'Trust classification is unavailable for this output.';
  }

  if (hasDegradedConditions) {
    const userMessages = ledger.supportTrace!.degradedConditions.map((d) => d.userMessage);
    summary += ' ' + userMessages.join(' ');
  }

  if (ledger.explanation?.fallbackOccurred) {
    summary += ' An alternative model was used due to temporary availability constraints.';
  }

  return { summary, trustClass, hasDegradedConditions };
}

export interface OperatorExplanationResult {
  summary: string;
  trustClass: TrustClass;
  provenanceEntries: ProvenanceLedgerEntry[];
  degradedConditions: DegradedCondition[];
  healthSignals: HealthSignal[];
}

/**
 * Build a full operator/support explanation with all provenance entries,
 * degraded conditions, and health signals.
 */
export async function buildOperatorExplanation(
  outputId: string,
  organizationId: string,
): Promise<OperatorExplanationResult> {
  const ledger = await buildProvenanceLedger(outputId, organizationId);
  const trustClass = await assessTrustClass(outputId, organizationId);
  const degradedConditions = ledger.supportTrace?.degradedConditions ?? [];
  const healthSignals = await getHealthSignals(organizationId);

  let summary = `Trust class: ${trustClass}. Provenance entries: ${ledger.entries.length}.`;

  if (ledger.explanation) {
    const r = ledger.explanation;
    summary += ` Model: ${r.modelSelected}. Reason: ${r.modelSelectionReason}.`;
    summary += ` Workload: ${r.workloadClass}. Purpose: ${r.purpose}.`;
    if (r.fallbackOccurred) {
      summary += ` Fallback from ${r.fallbackFrom ?? 'unknown'}: ${r.fallbackReason ?? 'unspecified'}.`;
    }
    if (r.latencyObservedMs != null) {
      summary += ` Latency: ${r.latencyObservedMs}ms.`;
    }
  }

  if (degradedConditions.length > 0) {
    summary += ` Degraded conditions: ${degradedConditions.length}.`;
    for (const dc of degradedConditions) {
      summary += ` [${dc.conditionType}/${dc.severity}] ${dc.operatorDetail}`;
    }
  }

  return {
    summary,
    trustClass,
    provenanceEntries: ledger.entries,
    degradedConditions,
    healthSignals,
  };
}

// ==========================================
// DEGRADED-STATE VOCABULARY RUNTIME (Decision D26)
// ==========================================

interface DegradedConditionRowExtended extends DegradedConditionRow {
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
}

export interface ResolvedDegradedCondition extends DegradedCondition {
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
}

function rowToResolvedDegradedCondition(row: DegradedConditionRowExtended): ResolvedDegradedCondition {
  return {
    ...rowToDegradedCondition(row),
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    resolutionNote: row.resolution_note,
  };
}

/**
 * Get all unresolved degraded conditions for an organization (where resolved_at IS NULL).
 */
export async function getActiveDegradedConditions(
  organizationId: string,
): Promise<ResolvedDegradedCondition[]> {
  const rows = await dbAll<DegradedConditionRowExtended>(
    `SELECT * FROM v8_degraded_conditions
     WHERE organization_id = ? AND resolved_at IS NULL
     ORDER BY created_at DESC`,
    [organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToResolvedDegradedCondition);
}

/**
 * Mark a degraded condition as resolved with timestamp and resolution note.
 */
export async function resolveDegradedCondition(
  conditionId: string,
  resolvedBy: string,
  resolution: string,
): Promise<ResolvedDegradedCondition | null> {
  const now = new Date().toISOString();

  await dbRun(
    `UPDATE v8_degraded_conditions
     SET resolved_at = ?, resolved_by = ?, resolution_note = ?
     WHERE condition_id = ?`,
    [now, resolvedBy, resolution, conditionId],
  );

  const row = await dbGet<DegradedConditionRowExtended>(
    `SELECT * FROM v8_degraded_conditions WHERE condition_id = ?`,
    [conditionId],
    { fallback: true },
  );

  if (!row) return null;

  logger.info(`${LOG_PREFIX} Resolved degraded condition ${conditionId} by ${resolvedBy}`);
  return rowToResolvedDegradedCondition(row);
}

/**
 * Get the latest health signal for each signal type — the health dashboard.
 */
export async function getHealthDashboard(
  organizationId: string,
): Promise<Map<string, HealthSignal>> {
  const rows = await dbAll<HealthSignalRow>(
    `SELECT h1.* FROM v8_health_signals h1
     INNER JOIN (
       SELECT signal_type, MAX(timestamp) AS max_ts
       FROM v8_health_signals
       WHERE organization_id = ?
       GROUP BY signal_type
     ) h2 ON h1.signal_type = h2.signal_type AND h1.timestamp = h2.max_ts
     WHERE h1.organization_id = ?`,
    [organizationId, organizationId],
    { fallback: true },
  );

  const dashboard = new Map<string, HealthSignal>();
  for (const row of rows || []) {
    const signal = rowToHealthSignal(row);
    dashboard.set(signal.signalType, signal);
  }

  return dashboard;
}
