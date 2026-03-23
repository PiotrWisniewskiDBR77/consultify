/**
 * V8 Governed Retrieval Service
 *
 * Core governance/contract layer for the unified retrieval system.
 * All AI consumers route retrieval through this service.
 *
 * This is the primitive layer — actual search/embedding logic is NOT here.
 * It validates requests, enforces context binding (Decision 2), logs traces,
 * and provides the ACL check contract (stub implementation).
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  ACLCheckResult,
  CreateRetrievalRequestParams,
  LogRetrievalTraceParams,
  RetrievalRequest,
  RetrievalTrace,
} from '../../types/governedRetrieval.js';
import {
  CreateRetrievalRequestParamsSchema,
  LogRetrievalTraceParamsSchema,
} from '../../types/governedRetrieval.js';
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

/**
 * Three-layer ACL check — stub implementation.
 *
 * Returns the structural ACLCheckResult with all three layers evaluated.
 * Actual ACL enforcement will be wired in a later packet when connector
 * registry and source ACL projector are available.
 */
export async function checkACL(
  request: RetrievalRequest,
): Promise<ACLCheckResult> {
  const now = new Date().toISOString();

  const result: ACLCheckResult = {
    overallVerdict: 'allowed',
    layers: [
      {
        layer: 'tenant_boundary',
        verdict: 'allowed',
        denialReason: null,
        detail: `Tenant ${request.organizationId} boundary check passed (stub)`,
      },
      {
        layer: 'source_acl',
        verdict: 'allowed',
        denialReason: null,
        detail: 'Source ACL projection passed (stub — no connector registry yet)',
      },
      {
        layer: 'scope_sensitivity',
        verdict: 'allowed',
        denialReason: null,
        detail: `Scope/sensitivity gate passed for preset ${request.searchPreset} (stub)`,
      },
    ],
    checkedAt: now,
    aclStalenessMs: null,
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
