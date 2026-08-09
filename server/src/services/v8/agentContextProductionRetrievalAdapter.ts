import { createHash } from 'node:crypto';

import type { PgTransactionClient } from '../../utils/queryHelpers.js';
import {
  recordContextRetrievalLineage,
  retrieveContext,
} from '../organizationContext/ContextRetrievalService.js';
import {
  type GroundingCandidate,
  type GroundingPolicy,
  revalidateTransformationContext,
} from './agentContextGroundingService.js';

interface ContextOwnerRow {
  execution_run_id: string;
  context_snapshot_id: string;
  project_id: string | null;
  mandate: string;
  initiator_user_id: string;
  source_context_refs: unknown;
}

function parseRefs(raw: unknown): Array<{ artifactId: string; module: string }> {
  let value = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const ref = item as Record<string, unknown>;
    const artifactId = String(ref.artifactId ?? ref.sourceId ?? '').trim();
    const module = String(ref.module ?? ref.sourceKind ?? '').trim();
    return artifactId && ['Knowledge', 'Vault'].includes(module) ? [{ artifactId, module }] : [];
  });
}

const stableId = (parts: unknown[]) =>
  createHash('sha256').update(JSON.stringify(parts)).digest('hex');

export async function retrieveAndRevalidateTransformationContext(input: {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  policy: GroundingPolicy;
  client: PgTransactionClient;
}) {
  const owner = (await input.client.query<ContextOwnerRow>(
    `SELECT c.execution_run_id, c.context_snapshot_id, c.project_id, c.mandate,
            s.initiator_user_id, s.source_context_refs
       FROM transformation_cases c
       JOIN v8_context_snapshots s ON s.snapshot_id = c.context_snapshot_id
        AND s.organization_id = c.organization_id
      WHERE c.transformation_case_id = ? AND c.organization_id = ?`,
    [input.transformationCaseId, input.organizationId]
  )).rows[0];

  if (!owner?.project_id) {
    return revalidateTransformationContext({ ...input, candidates: [], retrievalFailureReason: 'agent_context_project_required' });
  }
  const refs = parseRefs(owner.source_context_refs);
  if (refs.length === 0) return revalidateTransformationContext({ ...input, candidates: [] });

  let retrieval: Awaited<ReturnType<typeof retrieveContext>>;
  try {
    retrieval = await retrieveContext({
      organizationId: input.organizationId,
      userId: owner.initiator_user_id,
      projectId: owner.project_id,
      workflow: 'agent_execution',
      workflowMode: 'selected_material_plus_selected_context',
      retrievalQuery: owner.mandate,
      retrievalReason: 'canonical_agent_context_grounding',
      selectedDocumentIds: refs.map((ref) => ref.artifactId),
      perDocumentChunkLimit: Math.max(1, Math.min(5, input.policy.maxResults)),
      totalChunkLimit: Math.max(1, input.policy.maxResults),
    });
    if (retrieval.excludedDocumentIds.length > 0) {
      throw new Error('agent_context_source_inaccessible_or_not_ready');
    }
  } catch (error) {
    return revalidateTransformationContext({ ...input, candidates: [], retrievalFailureReason: error instanceof Error ? error.message : 'retrieval_failed' });
  }
  const documents = new Map(retrieval.documents.map((document) => [document.id, document]));
  const modules = new Map(refs.map((ref) => [ref.artifactId, ref.module]));
  const candidates: GroundingCandidate[] = retrieval.chunks.map((chunk) => ({
    sourceRef: JSON.stringify({ documentId: chunk.documentId, chunkId: chunk.chunkId, chunkIndex: chunk.chunkIndex, nativeSourceLocator: chunk.nativeSourceLocator }),
    artifactId: chunk.documentId,
    module: modules.get(chunk.documentId) ?? 'Knowledge',
    projectId: documents.get(chunk.documentId)?.projectId ?? null,
    content: chunk.content,
    relevance: Number.isFinite(chunk.relevance) ? chunk.relevance : 0,
  }));
  const decision = await revalidateTransformationContext({ ...input, candidates });
  if (decision.decision === 'allowed') {
    await recordContextRetrievalLineage({
      lineageEventId: `agent-context-${stableId([owner.execution_run_id, owner.context_snapshot_id, retrieval.selectedDocumentIds, retrieval.chunks.map((chunk) => [chunk.chunkId, chunk.relevance])])}`,
      failClosed: true,
      organizationId: input.organizationId,
      userId: owner.initiator_user_id,
      workflow: 'agent_execution',
      targetType: 'canonical_agent_run',
      targetId: owner.execution_run_id,
      eventType: 'agent_context_retrieved',
      result: retrieval,
      metadata: { contextSnapshotId: owner.context_snapshot_id },
    });
  }
  return decision;
}
