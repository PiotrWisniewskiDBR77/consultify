/**
 * V8 Governed Retrieval Service
 *
 * Core governance/contract layer for the unified retrieval system.
 * All AI consumers route retrieval through this service.
 *
 * This is the primitive layer — actual search/embedding logic is NOT here.
 * It validates requests, enforces context binding (Decision 2), logs traces,
 * runs the 7-stage pre-filter pipeline, and provides real ACL enforcement.
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  ACLCheckResult,
  ACLLayerResult,
  CreateRetrievalRequestParams,
  DeniedEntry,
  FreshnessState,
  LogRetrievalTraceParams,
  PipelineStageTrace,
  RetrievalRequest,
  RetrievalResult,
  RetrievalTrace,
  SearchPreset,
  ScopeResolutionSummary,
  SensitivityLabel,
} from '../../types/governedRetrieval.js';
import { PipelineStageValues } from '../../types/governedRetrieval.js';
import {
  CreateRetrievalRequestParamsSchema,
  LogRetrievalTraceParamsSchema,
} from '../../types/governedRetrieval.js';
import type { ScopeType } from '../../types/contextSnapshot.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:GovernedRetrieval]';

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    logger.warn(`${LOG_PREFIX} Failed to parse JSON, using fallback`);
    return fallback;
  }
}

interface RequestRow {
  request_id: string;
  organization_id: string;
  context_snapshot_id: string | null;
  retrieval_scope_token: string | null;
  consumer_class: string;
  query: string;
  search_preset: string;
  budget_hint: string | null;
  working_memory_context_ref: string | null;
  status: string;
  created_at: string;
}

interface TraceRow {
  trace_id: string;
  request_id: string;
  organization_id: string;
  snapshot_id: string | null;
  conversation_id: string | null;
  consumer_class: string;
  preset_used: string;
  scope_resolution_summary: string;
  pipeline_stages: string;
  candidates_considered: number;
  results_returned: number;
  results: string;
  denied_entries: string;
  freshness_warnings: string;
  total_latency_ms: number;
  created_at: string;
}

function rowToRequest(row: RequestRow): RetrievalRequest {
  return {
    requestId: row.request_id,
    organizationId: row.organization_id,
    contextSnapshotId: row.context_snapshot_id,
    retrievalScopeToken: safeJsonParse(row.retrieval_scope_token, null),
    consumerClass: row.consumer_class as RetrievalRequest['consumerClass'],
    query: row.query,
    searchPreset: row.search_preset as RetrievalRequest['searchPreset'],
    budgetHint: safeJsonParse(row.budget_hint, null),
    workingMemoryContextRef: row.working_memory_context_ref,
    status: row.status as RetrievalRequest['status'],
    createdAt: row.created_at,
  };
}

function rowToTrace(row: TraceRow): RetrievalTrace {
  return {
    traceId: row.trace_id,
    requestId: row.request_id,
    organizationId: row.organization_id,
    snapshotId: row.snapshot_id,
    conversationId: row.conversation_id,
    consumerClass: row.consumer_class as RetrievalTrace['consumerClass'],
    presetUsed: row.preset_used as RetrievalTrace['presetUsed'],
    scopeResolutionSummary: safeJsonParse(row.scope_resolution_summary, {
      tenantId: row.organization_id,
      projectId: null,
      scopeTypes: [],
      sensitivityCeiling: 'internal' as const,
      privacyMode: false,
    }),
    pipelineStages: safeJsonParse(row.pipeline_stages, []),
    candidatesConsidered: row.candidates_considered,
    resultsReturned: row.results_returned,
    results: safeJsonParse(row.results, []),
    deniedEntries: safeJsonParse(row.denied_entries, []),
    freshnessWarnings: safeJsonParse(row.freshness_warnings, []),
    totalLatencyMs: row.total_latency_ms,
    createdAt: row.created_at,
  };
}

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Validate and log a retrieval request.
 *
 * Enforces Decision 2: interactive consumers require a full ContextSnapshot;
 * background consumers may use a RetrievalScopeToken.
 */
export async function createRetrievalRequest(
  params: CreateRetrievalRequestParams,
): Promise<RetrievalRequest> {
  const validated = CreateRetrievalRequestParamsSchema.parse(params);

  const requestId = uuidv4();
  const createdAt = new Date().toISOString();

  const request: RetrievalRequest = {
    requestId,
    organizationId: validated.organizationId,
    contextSnapshotId: validated.contextSnapshotId ?? null,
    retrievalScopeToken: validated.retrievalScopeToken ?? null,
    consumerClass: validated.consumerClass,
    query: validated.query,
    searchPreset: validated.searchPreset,
    budgetHint: validated.budgetHint ?? null,
    workingMemoryContextRef: validated.workingMemoryContextRef ?? null,
    status: 'pending',
    createdAt,
  };

  await dbRun(
    `INSERT INTO v8_retrieval_requests (
      request_id, organization_id, context_snapshot_id, retrieval_scope_token,
      consumer_class, query, search_preset, budget_hint,
      working_memory_context_ref, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      request.requestId,
      request.organizationId,
      request.contextSnapshotId,
      request.retrievalScopeToken ? JSON.stringify(request.retrievalScopeToken) : null,
      request.consumerClass,
      request.query,
      request.searchPreset,
      request.budgetHint ? JSON.stringify(request.budgetHint) : null,
      request.workingMemoryContextRef,
      request.status,
      request.createdAt,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Created retrieval request ${requestId} ` +
    `[consumer=${request.consumerClass}, preset=${request.searchPreset}] ` +
    `for org ${request.organizationId}`,
  );

  return request;
}

export async function getRequest(
  requestId: string,
  organizationId: string,
): Promise<RetrievalRequest | null> {
  const row = await dbGet<RequestRow>(
    `SELECT * FROM v8_retrieval_requests
     WHERE request_id = ? AND organization_id = ?`,
    [requestId, organizationId],
    { fallback: true },
  );

  if (!row) return null;
  return rowToRequest(row);
}

// ==========================================
// ACL ENFORCEMENT (Decision D10 staleness windows)
// ==========================================

const ACL_STALENESS_WINDOWS_MS: Record<SensitivityLabel, number> = {
  confidential: 3_600_000,   // 1 hour
  internal: 14_400_000,      // 4 hours
  public: 86_400_000,        // 24 hours
};

const PRESET_SENSITIVITY_CEILING: Record<SearchPreset, SensitivityLabel[]> = {
  artifact_deep: ['confidential', 'internal', 'public'],
  project_focused: ['internal', 'public'],
  workspace_broad: ['internal', 'public'],
  cross_org_federated: ['public'],
};

export interface SourceACLContext {
  sourceRef: string;
  tenantId: string;
  sensitivityLabel: SensitivityLabel;
  aclCheckedAt: string | null;
}

/**
 * Three-layer ACL check with real enforcement.
 *
 * Layer 1 — Tenant boundary: request org must match source tenant.
 * Layer 2 — Source ACL: staleness check per Decision D10 windows.
 * Layer 3 — Scope sensitivity: preset ceiling vs source sensitivity.
 *
 * Additionally checks privacy mode from the retrieval scope token.
 */
export async function checkACL(
  request: RetrievalRequest,
  source?: SourceACLContext,
): Promise<ACLCheckResult> {
  const now = new Date();
  const nowIso = now.toISOString();
  const layers: ACLLayerResult[] = [];
  let overallVerdict: ACLCheckResult['overallVerdict'] = 'allowed';
  let aclStalenessMs: number | null = null;

  // Layer 1: Tenant boundary
  if (source && source.tenantId !== request.organizationId) {
    layers.push({
      layer: 'tenant_boundary',
      verdict: 'denied',
      denialReason: 'TENANT_BOUNDARY',
      detail: `Source tenant ${source.tenantId} does not match request org ${request.organizationId}`,
    });
    overallVerdict = 'denied';
  } else {
    layers.push({
      layer: 'tenant_boundary',
      verdict: 'allowed',
      denialReason: null,
      detail: `Tenant ${request.organizationId} boundary check passed`,
    });
  }

  // Layer 2: Source ACL staleness (Decision D10)
  if (source && overallVerdict !== 'denied') {
    if (source.aclCheckedAt) {
      const aclAge = now.getTime() - new Date(source.aclCheckedAt).getTime();
      aclStalenessMs = aclAge;
      const maxStaleness = ACL_STALENESS_WINDOWS_MS[source.sensitivityLabel];

      if (aclAge > maxStaleness) {
        layers.push({
          layer: 'source_acl',
          verdict: 'degraded',
          denialReason: null,
          detail: `ACL data stale by ${Math.round(aclAge / 1000)}s (max ${Math.round(maxStaleness / 1000)}s for ${source.sensitivityLabel})`,
        });
        if (overallVerdict === 'allowed') overallVerdict = 'degraded';
      } else {
        layers.push({
          layer: 'source_acl',
          verdict: 'allowed',
          denialReason: null,
          detail: `ACL data fresh (${Math.round(aclAge / 1000)}s old, limit ${Math.round(maxStaleness / 1000)}s)`,
        });
      }
    } else {
      layers.push({
        layer: 'source_acl',
        verdict: 'allowed',
        denialReason: null,
        detail: 'No ACL timestamp — first check, allowing',
      });
    }
  } else if (!source) {
    layers.push({
      layer: 'source_acl',
      verdict: 'allowed',
      denialReason: null,
      detail: 'No source context provided — skipping ACL staleness check',
    });
  }

  // Layer 3: Scope sensitivity ceiling
  if (source && overallVerdict !== 'denied') {
    const allowedLabels = PRESET_SENSITIVITY_CEILING[request.searchPreset];
    if (!allowedLabels.includes(source.sensitivityLabel)) {
      layers.push({
        layer: 'scope_sensitivity',
        verdict: 'denied',
        denialReason: 'SENSITIVITY_BLOCKED',
        detail: `Source sensitivity "${source.sensitivityLabel}" exceeds ceiling for preset "${request.searchPreset}" (allowed: ${allowedLabels.join(', ')})`,
      });
      overallVerdict = 'denied';
    } else {
      layers.push({
        layer: 'scope_sensitivity',
        verdict: 'allowed',
        denialReason: null,
        detail: `Sensitivity "${source.sensitivityLabel}" within ceiling for preset "${request.searchPreset}"`,
      });
    }
  } else if (!source) {
    layers.push({
      layer: 'scope_sensitivity',
      verdict: 'allowed',
      denialReason: null,
      detail: `Scope/sensitivity gate passed for preset ${request.searchPreset} (no source context)`,
    });
  }

  // Privacy mode check (not a formal layer, but can override verdict)
  if (source && overallVerdict !== 'denied') {
    const privacyMode = request.retrievalScopeToken?.privacyMode ?? false;
    if (privacyMode && source.sensitivityLabel === 'confidential') {
      const sensitivityLayer = layers.find((l) => l.layer === 'scope_sensitivity');
      if (sensitivityLayer) {
        sensitivityLayer.verdict = 'denied';
        sensitivityLayer.denialReason = 'PRIVACY_MODE';
        sensitivityLayer.detail = 'Privacy mode blocks confidential sources';
      }
      overallVerdict = 'denied';
    }
  }

  const result: ACLCheckResult = {
    overallVerdict,
    layers,
    checkedAt: nowIso,
    aclStalenessMs,
  };

  logger.info(
    `${LOG_PREFIX} ACL check for request ${request.requestId}: ${result.overallVerdict}`,
  );

  return result;
}

/**
 * Record a support-visible pipeline trace for a retrieval request.
 */
export async function logRetrievalTrace(
  params: LogRetrievalTraceParams,
): Promise<RetrievalTrace> {
  const validated = LogRetrievalTraceParamsSchema.parse(params);

  const traceId = uuidv4();
  const createdAt = new Date().toISOString();

  const trace: RetrievalTrace = {
    traceId,
    requestId: validated.requestId,
    organizationId: validated.organizationId,
    snapshotId: validated.snapshotId ?? null,
    conversationId: validated.conversationId ?? null,
    consumerClass: validated.consumerClass,
    presetUsed: validated.presetUsed,
    scopeResolutionSummary: validated.scopeResolutionSummary,
    pipelineStages: validated.pipelineStages,
    candidatesConsidered: validated.candidatesConsidered,
    resultsReturned: validated.resultsReturned,
    results: validated.results,
    deniedEntries: validated.deniedEntries,
    freshnessWarnings: validated.freshnessWarnings,
    totalLatencyMs: validated.totalLatencyMs,
    createdAt,
  };

  await dbRun(
    `INSERT INTO v8_retrieval_traces (
      trace_id, request_id, organization_id, snapshot_id, conversation_id,
      consumer_class, preset_used, scope_resolution_summary, pipeline_stages,
      candidates_considered, results_returned, results, denied_entries,
      freshness_warnings, total_latency_ms, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      trace.traceId,
      trace.requestId,
      trace.organizationId,
      trace.snapshotId,
      trace.conversationId,
      trace.consumerClass,
      trace.presetUsed,
      JSON.stringify(trace.scopeResolutionSummary),
      JSON.stringify(trace.pipelineStages),
      trace.candidatesConsidered,
      trace.resultsReturned,
      JSON.stringify(trace.results),
      JSON.stringify(trace.deniedEntries),
      JSON.stringify(trace.freshnessWarnings),
      trace.totalLatencyMs,
      trace.createdAt,
    ],
  );

  logger.info(
    `${LOG_PREFIX} Logged trace ${traceId} for request ${trace.requestId} ` +
    `[${trace.resultsReturned} results, ${trace.deniedEntries.length} denied, ${trace.totalLatencyMs}ms]`,
  );

  return trace;
}

/**
 * Retrieve all traces for a given retrieval request, scoped to an organization.
 */
export async function getTracesByRequest(
  requestId: string,
  organizationId: string,
): Promise<RetrievalTrace[]> {
  const rows = await dbAll<TraceRow>(
    `SELECT * FROM v8_retrieval_traces
     WHERE request_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [requestId, organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToTrace);
}

/**
 * Retrieve all traces for a conversation, scoped to an organization.
 * Supports the support-visible trace access model (§6.4 of analysis packet).
 */
export async function getTracesByConversation(
  conversationId: string,
  organizationId: string,
): Promise<RetrievalTrace[]> {
  const rows = await dbAll<TraceRow>(
    `SELECT * FROM v8_retrieval_traces
     WHERE conversation_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [conversationId, organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToTrace);
}

// ==========================================
// FRESHNESS RUNTIME
// ==========================================

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Determine freshness state for a source based on its last sync timestamp.
 */
export function checkFreshness(
  sourceRef: string,
  connectorId: string | null,
  freshnessAt: string | null,
): FreshnessState {
  if (freshnessAt === null) return 'disconnected';

  const ageMs = Date.now() - new Date(freshnessAt).getTime();

  if (ageMs > SEVEN_DAYS_MS) return 'archived';
  if (ageMs > TWENTY_FOUR_HOURS_MS) return 'stale';
  if (ageMs > ONE_HOUR_MS && connectorId !== null) return 'drifted';
  return 'fresh';
}

// ==========================================
// PIPELINE
// ==========================================

export interface CandidateSource {
  sourceRef: string;
  connectorId: string | null;
  scopeType: ScopeType;
  sensitivityLabel: SensitivityLabel;
  freshnessAt: string | null;
  tenantId: string;
  aclCheckedAt: string | null;
}

export interface PipelineOutput {
  results: RetrievalResult[];
  denied: DeniedEntry[];
  stages: PipelineStageTrace[];
}

/**
 * Execute the full 7-stage pre-filter pipeline on candidate sources.
 *
 * Stages (in order): tenant_filter → scope_type_filter → acl_filter →
 * sensitivity_filter → freshness_filter → privacy_mode_filter → connector_health_filter
 */
export async function runPipeline(
  request: RetrievalRequest,
  sources: CandidateSource[],
): Promise<PipelineOutput> {
  const denied: DeniedEntry[] = [];
  const stages: PipelineStageTrace[] = [];
  let candidates = [...sources];

  const scopeResolution = buildScopeResolution(request);
  const allowedSensitivities = PRESET_SENSITIVITY_CEILING[request.searchPreset];
  const privacyMode = scopeResolution.privacyMode;

  for (const stageName of PipelineStageValues) {
    const start = Date.now();
    const before = candidates.length;
    const stageDenied: DeniedEntry[] = [];

    switch (stageName) {
      case 'tenant_filter':
        candidates = candidates.filter((s) => {
          if (s.tenantId !== request.organizationId) {
            stageDenied.push({
              sourceRef: s.sourceRef,
              connectorId: s.connectorId,
              denialReason: 'TENANT_BOUNDARY',
              denialDetail: `Source tenant ${s.tenantId} != request org ${request.organizationId}`,
              freshnessStateAtDenial: null,
              sensitivityLabel: s.sensitivityLabel,
            });
            return false;
          }
          return true;
        });
        break;

      case 'scope_type_filter':
        candidates = candidates.filter((s) => {
          if (!scopeResolution.scopeTypes.includes(s.scopeType)) {
            stageDenied.push({
              sourceRef: s.sourceRef,
              connectorId: s.connectorId,
              denialReason: 'SCOPE_MISMATCH',
              denialDetail: `Source scope "${s.scopeType}" not in resolved scopes [${scopeResolution.scopeTypes.join(', ')}]`,
              freshnessStateAtDenial: null,
              sensitivityLabel: s.sensitivityLabel,
            });
            return false;
          }
          return true;
        });
        break;

      case 'acl_filter':
        candidates = candidates.filter((s) => {
          if (s.aclCheckedAt) {
            const staleness = Date.now() - new Date(s.aclCheckedAt).getTime();
            const maxStaleness = ACL_STALENESS_WINDOWS_MS[s.sensitivityLabel];
            if (staleness > maxStaleness * 2) {
              stageDenied.push({
                sourceRef: s.sourceRef,
                connectorId: s.connectorId,
                denialReason: 'ACL_DENIED',
                denialDetail: `ACL data critically stale (${Math.round(staleness / 1000)}s, 2x limit for ${s.sensitivityLabel})`,
                freshnessStateAtDenial: null,
                sensitivityLabel: s.sensitivityLabel,
              });
              return false;
            }
          }
          return true;
        });
        break;

      case 'sensitivity_filter':
        candidates = candidates.filter((s) => {
          if (!allowedSensitivities.includes(s.sensitivityLabel)) {
            stageDenied.push({
              sourceRef: s.sourceRef,
              connectorId: s.connectorId,
              denialReason: 'SENSITIVITY_BLOCKED',
              denialDetail: `Sensitivity "${s.sensitivityLabel}" exceeds preset "${request.searchPreset}" ceiling`,
              freshnessStateAtDenial: null,
              sensitivityLabel: s.sensitivityLabel,
            });
            return false;
          }
          return true;
        });
        break;

      case 'freshness_filter':
        candidates = candidates.filter((s) => {
          const state = checkFreshness(s.sourceRef, s.connectorId, s.freshnessAt);
          if (state === 'archived') {
            stageDenied.push({
              sourceRef: s.sourceRef,
              connectorId: s.connectorId,
              denialReason: 'FRESHNESS_EXCLUDED',
              denialDetail: 'Source archived (>7 days stale)',
              freshnessStateAtDenial: state,
              sensitivityLabel: s.sensitivityLabel,
            });
            return false;
          }
          return true;
        });
        break;

      case 'privacy_mode_filter':
        candidates = candidates.filter((s) => {
          if (privacyMode && s.sensitivityLabel === 'confidential') {
            stageDenied.push({
              sourceRef: s.sourceRef,
              connectorId: s.connectorId,
              denialReason: 'PRIVACY_MODE',
              denialDetail: 'Privacy mode blocks confidential sources',
              freshnessStateAtDenial: null,
              sensitivityLabel: s.sensitivityLabel,
            });
            return false;
          }
          return true;
        });
        break;

      case 'connector_health_filter':
        candidates = candidates.filter((s) => {
          const state = checkFreshness(s.sourceRef, s.connectorId, s.freshnessAt);
          if (state === 'disconnected') {
            stageDenied.push({
              sourceRef: s.sourceRef,
              connectorId: s.connectorId,
              denialReason: 'CONNECTOR_DISCONNECTED',
              denialDetail: 'Source has no freshness timestamp — connector disconnected',
              freshnessStateAtDenial: state,
              sensitivityLabel: s.sensitivityLabel,
            });
            return false;
          }
          return true;
        });
        break;
    }

    denied.push(...stageDenied);
    stages.push({
      stage: stageName,
      candidatesBefore: before,
      candidatesAfter: candidates.length,
      deniedCount: stageDenied.length,
      durationMs: Date.now() - start,
    });
  }

  const results: RetrievalResult[] = candidates.map((s, idx) => {
    const freshnessState = checkFreshness(s.sourceRef, s.connectorId, s.freshnessAt);
    const aclCheckResult: ACLCheckResult = {
      overallVerdict: 'allowed',
      layers: [
        { layer: 'tenant_boundary', verdict: 'allowed', denialReason: null, detail: null },
        { layer: 'source_acl', verdict: 'allowed', denialReason: null, detail: null },
        { layer: 'scope_sensitivity', verdict: 'allowed', denialReason: null, detail: null },
      ],
      checkedAt: new Date().toISOString(),
      aclStalenessMs: s.aclCheckedAt
        ? Date.now() - new Date(s.aclCheckedAt).getTime()
        : null,
    };

    return {
      sourceRef: s.sourceRef,
      connectorId: s.connectorId,
      scopeType: s.scopeType,
      relevanceScore: 1,
      trustClass: freshnessState === 'fresh' ? 'verified' as const : 'provisional' as const,
      sensitivityLabel: s.sensitivityLabel,
      freshnessState,
      aclCheckResult,
      rankPosition: idx,
      citationBindingRef: null,
    };
  });

  logger.info(
    `${LOG_PREFIX} Pipeline completed: ${sources.length} candidates → ${results.length} results, ${denied.length} denied`,
  );

  return { results, denied, stages };
}

// ==========================================
// QUERY HELPERS
// ==========================================

/**
 * Retrieve retrieval requests for an organization, ordered by creation date desc.
 */
export async function getRequestsByOrg(
  organizationId: string,
  limit: number = 50,
): Promise<RetrievalRequest[]> {
  const rows = await dbAll<RequestRow>(
    `SELECT * FROM v8_retrieval_requests
     WHERE organization_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [organizationId, limit],
    { fallback: true },
  );

  return (rows || []).map(rowToRequest);
}

// ==========================================
// SCOPE TRACEABILITY
// ==========================================

const PRESET_TO_SCOPE_TYPES: Record<SearchPreset, ScopeType[]> = {
  artifact_deep: ['session', 'user_private', 'organization', 'system', 'external'],
  project_focused: ['organization', 'system'],
  workspace_broad: ['organization', 'system', 'external'],
  cross_org_federated: ['external'],
};

/**
 * Build a ScopeResolutionSummary from a retrieval request's context.
 */
export function buildScopeResolution(request: RetrievalRequest): ScopeResolutionSummary {
  const scopeTypes = PRESET_TO_SCOPE_TYPES[request.searchPreset];
  const allowedSensitivities = PRESET_SENSITIVITY_CEILING[request.searchPreset];
  const sensitivityCeiling: SensitivityLabel = allowedSensitivities.includes('confidential')
    ? 'confidential'
    : allowedSensitivities.includes('internal')
      ? 'internal'
      : 'public';

  const privacyMode = request.retrievalScopeToken?.privacyMode ?? false;

  return {
    tenantId: request.organizationId,
    projectId: null,
    scopeTypes,
    sensitivityCeiling,
    privacyMode,
  };
}

/**
 * Retrieve all retrieval traces linked to a specific context snapshot.
 */
export async function getTracesBySnapshot(
  snapshotId: string,
  organizationId: string,
): Promise<RetrievalTrace[]> {
  const rows = await dbAll<TraceRow>(
    `SELECT * FROM v8_retrieval_traces
     WHERE snapshot_id = ? AND organization_id = ?
     ORDER BY created_at ASC`,
    [snapshotId, organizationId],
    { fallback: true },
  );

  return (rows || []).map(rowToTrace);
}
