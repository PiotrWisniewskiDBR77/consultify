/**
 * V8 Knowledge + Retrieval Integration Service
 *
 * Integration layer connecting Knowledge/RAG with the governed retrieval system.
 * Working memory and governed retrieval operate as a unified pipeline.
 *
 * Invariant: all knowledge enters working memory through the governed retrieval
 * gateway — no ungoverned side-channels (§1.3 of analysis packet).
 *
 * References:
 *  - WP-W2-AI-02_KNOWLEDGE_RETRIEVAL_INTEGRATION.md
 *  - DECISION_LOG_WAVE_2.md  (Decisions W2-4, W2-5, W2-6, W2-7)
 *
 * Upstream services used:
 *  - governedRetrievalService.createRetrievalRequest()
 *  - trustAuditService.assignTrustClass()
 */

import { v4 as uuidv4 } from 'uuid';

import type {
  CreateWorkingMemoryEntryParams,
  FreshnessPolicy,
  MemoryFreshnessCheck,
  MemoryPromotionRequest,
  MemoryType,
  OrchestrateRetrievalParams,
  PromotionStatus,
  RequestMemoryPromotionParams,
  WorkingMemoryEntry,
  WorkingMemoryOrchestrationResult,
} from '../../types/knowledgeRetrievalIntegration.js';
import {
  CreateWorkingMemoryEntryParamsSchema,
  OrchestrateRetrievalParamsSchema,
  RequestMemoryPromotionParamsSchema,
} from '../../types/knowledgeRetrievalIntegration.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { createRetrievalRequest } from './governedRetrievalService.js';
import { assignTrustClass } from './trustAuditService.js';

// ==========================================
// HELPERS
// ==========================================

const LOG_PREFIX = '[V8:KnowledgeRetrieval]';

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

interface WorkingMemoryRow {
  entry_id: string;
  conversation_id: string;
  organization_id: string;
  memory_type: string;
  content: string;
  source_ref: string | null;
  created_at: string;
  expires_at: string | null;
}

interface PromotionRow {
  request_id: string;
  organization_id: string;
  source_entry_id: string;
  target_memory_type: string;
  promotion_status: string;
  provenance_ref: string;
  requested_by: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

// ==========================================
// ROW MAPPERS
// ==========================================

function rowToWorkingMemory(row: WorkingMemoryRow): WorkingMemoryEntry {
  return {
    entryId: row.entry_id,
    conversationId: row.conversation_id,
    organizationId: row.organization_id,
    memoryType: row.memory_type as MemoryType,
    content: row.content,
    sourceRef: row.source_ref,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

function rowToPromotion(row: PromotionRow): MemoryPromotionRequest {
  return {
    requestId: row.request_id,
    organizationId: row.organization_id,
    sourceEntryId: row.source_entry_id,
    targetMemoryType: row.target_memory_type as MemoryType,
    promotionStatus: row.promotion_status as PromotionStatus,
    provenanceRef: row.provenance_ref,
    requestedBy: row.requested_by,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  };
}

/**
 * Decision W2-5: freshness policy per memory type.
 * Internal memory stores use their own freshness checks,
 * not connector ACL lag semantics.
 */
const MEMORY_FRESHNESS_POLICY: Record<MemoryType, FreshnessPolicy> = {
  ephemeral: 'inherently_fresh',
  session: 'inherently_fresh',
  user_private_durable: 'check_on_read',
  organization_durable: 'periodic_reindex',
};

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Store a working memory entry with lifecycle metadata.
 */
export async function createWorkingMemoryEntry(
  params: CreateWorkingMemoryEntryParams
): Promise<WorkingMemoryEntry> {
  const validated = CreateWorkingMemoryEntryParamsSchema.parse(params);

  const entryId = uuidv4();
  const createdAt = new Date().toISOString();

  const entry: WorkingMemoryEntry = {
    entryId,
    conversationId: validated.conversationId,
    organizationId: validated.organizationId,
    memoryType: validated.memoryType,
    content: validated.content,
    sourceRef: validated.sourceRef ?? null,
    createdAt,
    expiresAt: validated.expiresAt ?? null,
  };

  await dbRun(
    `INSERT INTO v8_working_memory_entries (
      entry_id, conversation_id, organization_id, memory_type,
      content, source_ref, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.entryId,
      entry.conversationId,
      entry.organizationId,
      entry.memoryType,
      entry.content,
      entry.sourceRef,
      entry.createdAt,
      entry.expiresAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Created working memory entry ${entryId} ` +
      `[type=${entry.memoryType}] for conversation ${entry.conversationId}`
  );

  return entry;
}

/**
 * Retrieve active working memory entries for a conversation, scoped to an organization.
 * Filters out expired entries (expiresAt < now).
 */
export async function getWorkingMemory(
  conversationId: string,
  organizationId: string
): Promise<WorkingMemoryEntry[]> {
  const now = new Date().toISOString();

  const rows = await dbAll<WorkingMemoryRow>(
    `SELECT * FROM v8_working_memory_entries
     WHERE conversation_id = ? AND organization_id = ?
       AND (expires_at IS NULL OR expires_at > ?)
     ORDER BY created_at ASC`,
    [conversationId, organizationId, now],
    { fallback: true }
  );

  return (rows || []).map(rowToWorkingMemory);
}

/**
 * Orchestrate retrieval: combine governed retrieval + working memory.
 *
 * Pipeline:
 * 1. Fetch active working memory for the conversation
 * 2. Issue a governed retrieval request through the gateway (§1.3 invariant)
 * 3. Assign merged trust class via trustAuditService (Decision 23)
 * 4. Return unified result
 */
export async function orchestrateRetrieval(
  params: OrchestrateRetrievalParams
): Promise<WorkingMemoryOrchestrationResult> {
  const validated = OrchestrateRetrievalParamsSchema.parse(params);

  const requestId = uuidv4();

  const workingMemoryResults = await getWorkingMemory(
    validated.conversationId,
    validated.organizationId
  );

  const workingMemoryContextRef =
    validated.workingMemoryContextRef ??
    (workingMemoryResults.length > 0
      ? `wm:${validated.conversationId}:${workingMemoryResults.length}`
      : null);

  const retrievalRequest = await createRetrievalRequest({
    organizationId: validated.organizationId,
    contextSnapshotId: validated.contextSnapshotId,
    consumerClass: validated.consumerClass,
    query: validated.query,
    searchPreset: validated.searchPreset,
    budgetHint: validated.budgetHint ?? null,
    workingMemoryContextRef,
  });

  const mergedTrustClass = await assignTrustClass({
    evidenceRefs: [],
    modelDeclaredClass: null,
    degradedModeFlag: false,
    uncertaintyClass: workingMemoryResults.length === 0 ? 'partial_evidence' : null,
  });

  const result: WorkingMemoryOrchestrationResult = {
    requestId,
    organizationId: validated.organizationId,
    retrievalResults: [],
    workingMemoryResults,
    mergedTrustClass,
    budgetUsed: validated.budgetHint ?? {},
  };

  logger.info(
    `${LOG_PREFIX} Orchestrated retrieval ${requestId} ` +
      `[retrievalReq=${retrievalRequest.requestId}, wmEntries=${workingMemoryResults.length}, ` +
      `trust=${mergedTrustClass}] for org ${validated.organizationId}`
  );

  return result;
}

/**
 * Request governed promotion of compacted memory (Decision W2-6).
 *
 * Not silent — requires provenance and promotion workflow.
 * Compacted memory may become durable only with provenance;
 * no direct promotion as if it were original source evidence.
 */
export async function requestMemoryPromotion(
  params: RequestMemoryPromotionParams
): Promise<MemoryPromotionRequest> {
  const validated = RequestMemoryPromotionParamsSchema.parse(params);

  const requestId = uuidv4();
  const createdAt = new Date().toISOString();

  const promotion: MemoryPromotionRequest = {
    requestId,
    organizationId: validated.organizationId,
    sourceEntryId: validated.sourceEntryId,
    targetMemoryType: validated.targetMemoryType,
    promotionStatus: 'pending',
    provenanceRef: validated.provenanceRef,
    requestedBy: validated.requestedBy,
    resolvedBy: null,
    resolvedAt: null,
    createdAt,
  };

  await dbRun(
    `INSERT INTO v8_memory_promotion_requests (
      request_id, organization_id, source_entry_id, target_memory_type,
      promotion_status, provenance_ref, requested_by, resolved_by,
      resolved_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      promotion.requestId,
      promotion.organizationId,
      promotion.sourceEntryId,
      promotion.targetMemoryType,
      promotion.promotionStatus,
      promotion.provenanceRef,
      promotion.requestedBy,
      promotion.resolvedBy,
      promotion.resolvedAt,
      promotion.createdAt,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Created memory promotion request ${requestId} ` +
      `[source=${validated.sourceEntryId}, target=${validated.targetMemoryType}] ` +
      `by ${validated.requestedBy}`
  );

  return promotion;
}

/**
 * Resolve a memory promotion request (approve or reject).
 */
export async function resolveMemoryPromotion(
  requestId: string,
  status: 'approved' | 'rejected',
  resolvedBy: string
): Promise<MemoryPromotionRequest> {
  const resolvedAt = new Date().toISOString();

  const row = await dbGet<PromotionRow>(
    `SELECT * FROM v8_memory_promotion_requests WHERE request_id = ?`,
    [requestId],
    { fallback: true }
  );

  if (!row) {
    throw new Error(`Memory promotion request ${requestId} not found`);
  }

  if (row.promotion_status !== 'pending') {
    throw new Error(
      `Memory promotion request ${requestId} already resolved (status=${row.promotion_status})`
    );
  }

  await dbRun(
    `UPDATE v8_memory_promotion_requests
     SET promotion_status = ?, resolved_by = ?, resolved_at = ?
     WHERE request_id = ?`,
    [status, resolvedBy, resolvedAt, requestId]
  );

  const resolved: MemoryPromotionRequest = {
    ...rowToPromotion(row),
    promotionStatus: status,
    resolvedBy,
    resolvedAt,
  };

  logger.info(`${LOG_PREFIX} Resolved memory promotion ${requestId}: ${status} by ${resolvedBy}`);

  return resolved;
}

/**
 * Check memory freshness for a given memory type and organization (Decision W2-5).
 *
 * Internal memory stores use their own freshness/governance checks,
 * not connector ACL lag semantics. Session and ephemeral memory are
 * inherently fresh; durable memory types require explicit checks.
 */
export async function checkMemoryFreshness(
  memoryType: MemoryType,
  organizationId: string
): Promise<MemoryFreshnessCheck> {
  const policy = MEMORY_FRESHNESS_POLICY[memoryType];
  const now = new Date().toISOString();

  let isStale = false;

  if (policy === 'inherently_fresh') {
    isStale = false;
  } else if (policy === 'check_on_read') {
    const latestRow = await dbGet<WorkingMemoryRow>(
      `SELECT * FROM v8_working_memory_entries
       WHERE organization_id = ? AND memory_type = ?
       ORDER BY created_at DESC LIMIT 1`,
      [organizationId, memoryType],
      { fallback: true }
    );

    if (latestRow) {
      const ageMs = Date.now() - new Date(latestRow.created_at).getTime();
      const ONE_HOUR_MS = 60 * 60 * 1000;
      isStale = ageMs > ONE_HOUR_MS;
    }
  } else if (policy === 'periodic_reindex') {
    const latestRow = await dbGet<WorkingMemoryRow>(
      `SELECT * FROM v8_working_memory_entries
       WHERE organization_id = ? AND memory_type = ?
       ORDER BY created_at DESC LIMIT 1`,
      [organizationId, memoryType],
      { fallback: true }
    );

    if (latestRow) {
      const ageMs = Date.now() - new Date(latestRow.created_at).getTime();
      const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
      isStale = ageMs > FOUR_HOURS_MS;
    }
  }

  const result: MemoryFreshnessCheck = {
    memoryType,
    organizationId,
    freshnessPolicy: policy,
    lastCheckedAt: now,
    isStale,
  };

  logger.info(
    `${LOG_PREFIX} Freshness check [type=${memoryType}, policy=${policy}, stale=${isStale}] ` +
      `for org ${organizationId}`
  );

  return result;
}
