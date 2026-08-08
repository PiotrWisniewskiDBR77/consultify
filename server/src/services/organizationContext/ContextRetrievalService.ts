/**
 * Shared Context Retrieval Service.
 *
 * Source of truth: docs/product/ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md
 *
 * Single entrypoint for AI workflows (Interview Insight Creator, AI Chat,
 * future modules) to retrieve organization context as ACL-filtered chunks.
 *
 * Stage 3 invariants:
 * - Tenant/org/scope/project/owner ACL is enforced backend-side BEFORE retrieval.
 * - Selected document ids are validated; unauthorized ids are silently dropped (counted as degraded).
 * - Non-ready documents (partial_ready, ocr_required, unreadable, failed, policy_blocked, quota_blocked, deleted)
 *   are excluded from retrieval and reported as degraded reasons.
 * - Retrieval returns chunks (text + native source locator + chunk index), never raw files.
 * - Lineage payload is built once and reused by callers when persisting to organization_context_lineage_events.
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { canonicalizeContextDocumentStatus } from './ContextDocumentService.js';

export type ContextWorkflowMode =
  | 'selected_material_only'
  | 'selected_material_plus_selected_context'
  | 'selected_material_plus_approved_org_context'
  | 'org_context_research_mode';

export const CONTEXT_WORKFLOW_MODES: ContextWorkflowMode[] = [
  'selected_material_only',
  'selected_material_plus_selected_context',
  'selected_material_plus_approved_org_context',
  'org_context_research_mode',
];

export function isValidContextWorkflowMode(value: unknown): value is ContextWorkflowMode {
  return typeof value === 'string' && (CONTEXT_WORKFLOW_MODES as string[]).includes(value);
}

export function normalizeContextWorkflowMode(
  value: unknown,
  fallback: ContextWorkflowMode = 'selected_material_only'
): ContextWorkflowMode {
  return isValidContextWorkflowMode(value) ? value : fallback;
}

export interface ContextRetrievalChunk {
  chunkId: string | null;
  documentId: string;
  filename: string;
  content: string;
  chunkIndex: number | null;
  modality: string;
  sourceLocator: any;
  nativeSourceLocator: any;
  qualityFlags: string[];
  confidence: number | null;
  relevance: number;
}

export interface ContextRetrievalDocument {
  id: string;
  filename: string;
  status: string;
  scope: 'project' | 'user';
  projectId: string | null;
  ownerId: string | null;
  version: number;
  uploadedAt: string;
  usedChunks: ContextRetrievalChunk[];
  excluded: boolean;
  excludedReason: string | null;
}

export interface ContextRetrievalResult {
  workflowMode: ContextWorkflowMode;
  requestedDocumentIds: string[];
  selectedDocumentIds: string[];
  excludedDocumentIds: string[];
  excludedReasons: Array<{ documentId: string; reason: string }>;
  documents: ContextRetrievalDocument[];
  chunks: ContextRetrievalChunk[];
  degraded: boolean;
  degradedReasons: string[];
  retrievalQuery: string;
  retrievalReason: string;
  generatedAt: string;
}

export interface ContextRetrievalInput {
  organizationId: string;
  userId: string;
  workflowMode: ContextWorkflowMode | string;
  workflow: string;
  retrievalQuery?: string | null;
  retrievalReason?: string | null;
  selectedDocumentIds?: string[];
  perDocumentChunkLimit?: number;
  totalChunkLimit?: number;
  /** Required for the fail-closed Agent execution workflow. */
  projectId?: string | null;
}

interface KnowledgeDocRow {
  id: string;
  filename: string;
  status: string;
  scope: string | null;
  project_id: string | null;
  owner_id: string | null;
  version: number | null;
  created_at: string | null;
}

const DEFAULT_PER_DOC_CHUNK_LIMIT = 5;
const DEFAULT_TOTAL_CHUNK_LIMIT = 24;

function safeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => (typeof value === 'string' ? value.trim() : String(value || '').trim()))
    .filter(Boolean);
}

function dedupePreservingOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}

async function fetchAccessibleDocuments(
  ids: string[],
  organizationId: string,
  userId: string,
  agentProjectId?: string | null
): Promise<{ accessible: KnowledgeDocRow[]; missingIds: string[] }> {
  if (ids.length === 0) return { accessible: [], missingIds: [] };
  const placeholders = ids.map(() => '?').join(',');
  const agentScopeSql = agentProjectId
    ? `AND ((scope = 'user' AND owner_id = ?) OR
            (scope = 'project' AND project_id = ? AND EXISTS (
              SELECT 1 FROM project_members pm WHERE pm.project_id = knowledge_docs.project_id AND pm.user_id = ?
            )))`
    : `AND (scope = 'project' OR (scope = 'user' AND owner_id = ?))`;
  const scopeParams = agentProjectId ? [userId, agentProjectId, userId] : [userId];
  const rows = (await dbAll(
    `SELECT id, filename, status, scope, project_id, owner_id, version, created_at
     FROM knowledge_docs
     WHERE id IN (${placeholders})
       AND organization_id = ?
       AND deleted_at IS NULL
       ${agentScopeSql}`,
    [...ids, organizationId, ...scopeParams],
    { fallback: true } as any
  )) as KnowledgeDocRow[];

  const accessibleIds = new Set((rows || []).map((row) => String(row.id)));
  const missingIds = ids.filter((id) => !accessibleIds.has(id));
  return { accessible: rows || [], missingIds };
}

function partitionByReadiness(rows: KnowledgeDocRow[]): {
  readyRows: KnowledgeDocRow[];
  notReadyReasons: Array<{ documentId: string; reason: string }>;
} {
  const readyRows: KnowledgeDocRow[] = [];
  const notReadyReasons: Array<{ documentId: string; reason: string }> = [];
  for (const row of rows) {
    const status = canonicalizeContextDocumentStatus(row.status);
    if (status === 'ready') {
      readyRows.push(row);
    } else {
      notReadyReasons.push({
        documentId: String(row.id),
        reason: `document_status_${status}`,
      });
    }
  }
  return { readyRows, notReadyReasons };
}

async function retrieveChunksWithRagOrFallback(input: {
  query: string;
  organizationId: string;
  readyDocs: KnowledgeDocRow[];
  perDocumentLimit: number;
  totalLimit: number;
}): Promise<ContextRetrievalChunk[]> {
  const ragChunks = await tryRagSearch(input);
  if (ragChunks.length > 0) {
    return ragChunks;
  }
  return loadFallbackChunks(input);
}

async function tryRagSearch(input: {
  query: string;
  organizationId: string;
  readyDocs: KnowledgeDocRow[];
  totalLimit: number;
}): Promise<ContextRetrievalChunk[]> {
  if (input.readyDocs.length === 0 || !input.query) return [];
  try {
    const ragModule = await import('../ragService.js');
    const ragService = (ragModule as any).default || ragModule;
    const documentIds = input.readyDocs.map((row) => String(row.id));
    const docsByFilename = new Map(input.readyDocs.map((row) => [String(row.filename || ''), row]));
    const results = (await ragService.hybridSearch(input.query, {
      limit: Math.max(input.totalLimit, 12),
      organizationId: input.organizationId,
      documentIds,
    })) as any[];
    return (results || []).map((chunk: any) => {
      const sourceName = String(chunk?.filename || chunk?.source || '');
      const owner = docsByFilename.get(sourceName) || input.readyDocs[0];
      return {
        chunkId: chunk?.id ? String(chunk.id) : null,
        documentId: String(owner.id),
        filename: String(owner.filename || sourceName),
        content: String(chunk?.content || '').trim(),
        chunkIndex:
          typeof chunk?.chunkIndex === 'number'
            ? Number(chunk.chunkIndex)
            : typeof chunk?.chunk_index === 'number'
              ? Number(chunk.chunk_index)
              : null,
        modality: String(chunk?.metadata?.modality || 'document'),
        sourceLocator: chunk?.metadata?.sourceLocator || null,
        nativeSourceLocator: chunk?.metadata?.nativeSourceLocator || null,
        qualityFlags: Array.isArray(chunk?.metadata?.qualityFlags)
          ? (chunk.metadata.qualityFlags as string[])
          : [],
        confidence:
          typeof chunk?.metadata?.confidence === 'number'
            ? Number(chunk.metadata.confidence)
              : null,
        relevance: Number(chunk?.hybridScore ?? chunk?.score ?? chunk?.similarity ?? 0),
      };
    });
  } catch (error) {
    logger.warn('[ContextRetrievalService] hybridSearch failed, fallback to direct chunks', error);
    return [];
  }
}

async function loadFallbackChunks(input: {
  readyDocs: KnowledgeDocRow[];
  perDocumentLimit: number;
  totalLimit: number;
}): Promise<ContextRetrievalChunk[]> {
  if (input.readyDocs.length === 0) return [];
  const ids = input.readyDocs.map((row) => String(row.id));
  const placeholders = ids.map(() => '?').join(',');
  const rows = (await dbAll(
    `SELECT c.id, COALESCE(c.doc_id, c.document_id) AS document_ref, c.content, c.chunk_index,
            c.metadata, d.filename
     FROM knowledge_chunks c
     JOIN knowledge_docs d ON (d.id = c.doc_id OR d.id = c.document_id)
     WHERE (c.doc_id IN (${placeholders}) OR c.document_id IN (${placeholders}))
     ORDER BY document_ref, c.chunk_index
     LIMIT ?`,
    [...ids, ...ids, Math.max(input.totalLimit * 2, input.totalLimit)],
    { fallback: true } as any
  )) as Array<any>;

  const perDocCounts = new Map<string, number>();
  const out: ContextRetrievalChunk[] = [];
  for (const row of rows || []) {
    const documentId = String(row.document_ref || '');
    if (!documentId) continue;
    const count = perDocCounts.get(documentId) || 0;
    if (count >= input.perDocumentLimit) continue;
    if (out.length >= input.totalLimit) break;
    let metadata: any = {};
    try {
      metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {};
    } catch {
      metadata = {};
    }
    out.push({
      chunkId: row.id ? String(row.id) : null,
      documentId,
      filename: String(row.filename || 'Context document'),
      content: String(row.content || ''),
      chunkIndex: typeof row.chunk_index === 'number' ? Number(row.chunk_index) : null,
      modality: String(metadata?.modality || 'document'),
      sourceLocator: metadata?.sourceLocator || null,
      nativeSourceLocator: metadata?.nativeSourceLocator || null,
      qualityFlags: Array.isArray(metadata?.qualityFlags)
        ? (metadata.qualityFlags as string[])
        : [],
      confidence: typeof metadata?.confidence === 'number' ? Number(metadata.confidence) : null,
      relevance: 0,
    });
    perDocCounts.set(documentId, count + 1);
  }
  return out;
}

async function fetchOrgApprovedContext(input: {
  organizationId: string;
  userId: string;
  totalLimit: number;
  query: string;
}): Promise<{
  rows: KnowledgeDocRow[];
  chunks: ContextRetrievalChunk[];
}> {
  try {
    const rows = (await dbAll(
      `SELECT id, filename, status, scope, project_id, owner_id, version, created_at
       FROM knowledge_docs
       WHERE organization_id = ?
         AND deleted_at IS NULL
         AND scope = 'project'
         AND status IN ('ready', 'indexed', 'complete', 'completed')
       ORDER BY created_at DESC
       LIMIT 25`,
      [input.organizationId],
      { fallback: true } as any
    )) as KnowledgeDocRow[];
    const chunks = await retrieveChunksWithRagOrFallback({
      query: input.query,
      organizationId: input.organizationId,
      readyDocs: rows || [],
      perDocumentLimit: 2,
      totalLimit: input.totalLimit,
    });
    return { rows: rows || [], chunks };
  } catch (error) {
    logger.warn('[ContextRetrievalService] approved org context lookup failed', error);
    return { rows: [], chunks: [] };
  }
}

export async function retrieveContext(
  input: ContextRetrievalInput
): Promise<ContextRetrievalResult> {
  const isAgentExecution = input.workflow === 'agent_execution';
  if (isAgentExecution && !String(input.projectId || '').trim()) {
    throw new Error('agent_context_project_required');
  }
  const generatedAt = new Date().toISOString();
  const workflowMode = normalizeContextWorkflowMode(input.workflowMode);
  const requestedDocumentIds = dedupePreservingOrder(safeStringArray(input.selectedDocumentIds));
  const perDocumentChunkLimit = Math.max(
    1,
    Math.min(input.perDocumentChunkLimit || DEFAULT_PER_DOC_CHUNK_LIMIT, 12)
  );
  const totalChunkLimit = Math.max(
    perDocumentChunkLimit,
    Math.min(input.totalChunkLimit || DEFAULT_TOTAL_CHUNK_LIMIT, 60)
  );
  const retrievalQuery = String(input.retrievalQuery || '').trim();
  const retrievalReason = String(input.retrievalReason || workflowMode || 'context_retrieval');

  const degradedReasons: string[] = [];
  const excludedReasons: Array<{ documentId: string; reason: string }> = [];

  const { accessible: accessibleRows, missingIds } = await fetchAccessibleDocuments(
    requestedDocumentIds,
    input.organizationId,
    input.userId,
    isAgentExecution ? input.projectId : undefined
  );

  for (const id of missingIds) {
    excludedReasons.push({ documentId: id, reason: 'document_not_accessible' });
  }
  if (missingIds.length > 0) degradedReasons.push('some_documents_not_accessible');

  const { readyRows, notReadyReasons } = partitionByReadiness(accessibleRows);
  for (const reason of notReadyReasons) {
    excludedReasons.push(reason);
  }
  if (notReadyReasons.length > 0) degradedReasons.push('some_documents_not_ready');

  if (workflowMode === 'selected_material_only') {
    const documents: ContextRetrievalDocument[] = accessibleRows.map((row) => ({
      id: String(row.id),
      filename: String(row.filename || ''),
      status: canonicalizeContextDocumentStatus(row.status),
      scope: row.scope === 'project' ? 'project' : 'user',
      projectId: row.project_id ? String(row.project_id) : null,
      ownerId: row.owner_id ? String(row.owner_id) : null,
      version: Number(row.version || 1),
      uploadedAt: String(row.created_at || generatedAt),
      usedChunks: [],
      excluded: true,
      excludedReason: 'workflow_mode_excludes_context_chunks',
    }));
    return {
      workflowMode,
      requestedDocumentIds,
      selectedDocumentIds: accessibleRows.map((row) => String(row.id)),
      excludedDocumentIds: requestedDocumentIds,
      excludedReasons: [
        ...excludedReasons,
        ...accessibleRows.map((row) => ({
          documentId: String(row.id),
          reason: 'workflow_mode_excludes_context_chunks',
        })),
      ],
      documents,
      chunks: [],
      degraded: degradedReasons.length > 0,
      degradedReasons,
      retrievalQuery,
      retrievalReason,
      generatedAt,
    };
  }

  let chunks: ContextRetrievalChunk[] = [];
  if (
    workflowMode === 'selected_material_plus_selected_context' ||
    workflowMode === 'selected_material_plus_approved_org_context'
  ) {
    chunks = await retrieveChunksWithRagOrFallback({
      query: retrievalQuery || retrievalReason,
      organizationId: input.organizationId,
      readyDocs: readyRows,
      perDocumentLimit: perDocumentChunkLimit,
      totalLimit: totalChunkLimit,
    });
  }

  if (workflowMode === 'selected_material_plus_approved_org_context') {
    const remainingBudget = totalChunkLimit - chunks.length;
    if (remainingBudget > 0) {
      const orgContext = await fetchOrgApprovedContext({
        organizationId: input.organizationId,
        userId: input.userId,
        totalLimit: remainingBudget,
        query: retrievalQuery || retrievalReason,
      });
      const knownDocIds = new Set(readyRows.map((row) => String(row.id)));
      const additionalDocs = orgContext.rows.filter((row) => !knownDocIds.has(String(row.id)));
      readyRows.push(...additionalDocs);
      const seenChunkIds = new Set(
        chunks.map((c) => `${c.documentId}:${c.chunkIndex}:${c.chunkId}`)
      );
      for (const chunk of orgContext.chunks) {
        const key = `${chunk.documentId}:${chunk.chunkIndex}:${chunk.chunkId}`;
        if (!seenChunkIds.has(key) && chunks.length < totalChunkLimit) {
          chunks.push(chunk);
          seenChunkIds.add(key);
        }
      }
      if (additionalDocs.length > 0) {
        degradedReasons.push('augmented_with_approved_org_context');
      }
    }
  }

  if (workflowMode === 'org_context_research_mode') {
    const orgContext = await fetchOrgApprovedContext({
      organizationId: input.organizationId,
      userId: input.userId,
      totalLimit: totalChunkLimit,
      query: retrievalQuery || retrievalReason,
    });
    readyRows.length = 0;
    readyRows.push(...orgContext.rows);
    chunks = orgContext.chunks;
  }

  const chunksByDocId = new Map<string, ContextRetrievalChunk[]>();
  for (const chunk of chunks) {
    const list = chunksByDocId.get(chunk.documentId) || [];
    list.push(chunk);
    chunksByDocId.set(chunk.documentId, list);
  }

  const documentList: ContextRetrievalDocument[] = readyRows.map((row) => ({
    id: String(row.id),
    filename: String(row.filename || ''),
    status: canonicalizeContextDocumentStatus(row.status),
    scope: row.scope === 'project' ? 'project' : 'user',
    projectId: row.project_id ? String(row.project_id) : null,
    ownerId: row.owner_id ? String(row.owner_id) : null,
    version: Number(row.version || 1),
    uploadedAt: String(row.created_at || generatedAt),
    usedChunks: chunksByDocId.get(String(row.id)) || [],
    excluded: false,
    excludedReason: null,
  }));

  if (
    workflowMode === 'selected_material_plus_selected_context' &&
    readyRows.length > 0 &&
    chunks.length === 0
  ) {
    degradedReasons.push('no_chunks_for_ready_documents');
  }

  return {
    workflowMode,
    requestedDocumentIds,
    selectedDocumentIds: readyRows.map((row) => String(row.id)),
    excludedDocumentIds: excludedReasons.map((reason) => reason.documentId),
    excludedReasons,
    documents: documentList,
    chunks,
    degraded: degradedReasons.length > 0,
    degradedReasons,
    retrievalQuery,
    retrievalReason,
    generatedAt,
  };
}

export interface ContextLineageRecordInput {
  organizationId: string;
  userId: string;
  workflow: string;
  targetType: string;
  targetId: string;
  eventType: string;
  result: ContextRetrievalResult;
  metadata?: Record<string, unknown>;
  lineageEventId?: string;
  failClosed?: boolean;
}

export async function recordContextRetrievalLineage(
  input: ContextLineageRecordInput
): Promise<void> {
  try {
    const usedChunkPayload = input.result.chunks.map((chunk) => ({
      documentId: chunk.documentId,
      filename: chunk.filename,
      version: 1,
      chunkId: chunk.chunkId,
      chunkIndex: chunk.chunkIndex,
      source: chunk.filename,
      excerpt: chunk.content.slice(0, 1200),
      modality: chunk.modality,
      sourceLocator: chunk.sourceLocator,
      nativeSourceLocator: chunk.nativeSourceLocator,
      confidence: chunk.confidence,
      qualityFlags: chunk.qualityFlags,
    }));

    await dbRun(
      `INSERT INTO organization_context_lineage_events
       (id, organization_id, user_id, target_type, target_id, workflow, event_type,
        requested_document_ids_json, selected_document_ids_json, used_chunks_json,
        degraded, degraded_reasons_json, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
      [
        input.lineageEventId ?? uuidv4(),
        input.organizationId,
        input.userId,
        input.targetType,
        input.targetId,
        input.workflow,
        input.eventType,
        JSON.stringify(input.result.requestedDocumentIds),
        JSON.stringify(input.result.selectedDocumentIds),
        JSON.stringify(usedChunkPayload),
        input.result.degraded ? 1 : 0,
        JSON.stringify(input.result.degradedReasons),
        JSON.stringify({
          workflowMode: input.result.workflowMode,
          retrievalQuery: input.result.retrievalQuery,
          retrievalReason: input.result.retrievalReason,
          excludedDocuments: input.result.excludedReasons,
          ...input.metadata,
        }),
        new Date().toISOString(),
      ],
      { fallback: true } as any
    );
  } catch (error) {
    if (input.failClosed) throw error;
    logger.warn('[ContextRetrievalService] lineage write failed (non-fatal):', error);
  }
}

const contextRetrievalService = {
  retrieveContext,
  recordContextRetrievalLineage,
  CONTEXT_WORKFLOW_MODES,
  isValidContextWorkflowMode,
  normalizeContextWorkflowMode,
};

export default contextRetrievalService;
