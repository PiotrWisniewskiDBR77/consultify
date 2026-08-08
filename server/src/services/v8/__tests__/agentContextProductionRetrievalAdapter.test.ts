import { beforeEach, describe, expect, it, vi } from 'vitest';

const { retrieveMock, lineageMock, revalidateMock } = vi.hoisted(() => ({
  retrieveMock: vi.fn(),
  lineageMock: vi.fn(),
  revalidateMock: vi.fn(),
}));
vi.mock('../../organizationContext/ContextRetrievalService.js', () => ({
  retrieveContext: retrieveMock,
  recordContextRetrievalLineage: lineageMock,
}));
vi.mock('../agentContextGroundingService.js', () => ({
  revalidateTransformationContext: revalidateMock,
}));

import { retrieveAndRevalidateTransformationContext } from '../agentContextProductionRetrievalAdapter.js';

const owner = {
  execution_run_id: 'run-1',
  context_snapshot_id: 'snap-1',
  project_id: 'project-1',
  mandate: 'Reduce lead time',
  initiator_user_id: 'user-1',
  source_context_refs: JSON.stringify([
    { artifactId: 'doc-1', module: 'Knowledge' },
    { artifactId: 'foreign-ignored', module: 'Finance' },
  ]),
};
const policy = {
  allowedModules: ['Knowledge'], allowedArtifactIds: [], projectId: 'project-1',
  maxResults: 2, maxWorkingMemoryChars: 100,
};

describe('agent production retrieval adapter', () => {
  beforeEach(() => {
    retrieveMock.mockReset();
    lineageMock.mockReset().mockResolvedValue(undefined);
    revalidateMock.mockReset().mockResolvedValue({ decision: 'allowed', canonicalRunId: 'run-1' });
  });

  it('maps bounded native chunks and actual relevance into policy revalidation', async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [owner] }) } as any;
    retrieveMock.mockResolvedValue({
      selectedDocumentIds: ['doc-1'], degraded: false, degradedReasons: [],
      requestedDocumentIds: ['doc-1'], excludedDocumentIds: [], excludedReasons: [],
      workflowMode: 'selected_material_plus_selected_context', retrievalQuery: owner.mandate,
      retrievalReason: 'canonical_agent_context_grounding', generatedAt: new Date().toISOString(),
      documents: [{ id: 'doc-1', projectId: 'project-1' }],
      chunks: [{ documentId: 'doc-1', chunkId: 'chunk-1', chunkIndex: 3, nativeSourceLocator: { page: 4 }, content: 'grounded fact', relevance: 0.91 }],
    });

    await retrieveAndRevalidateTransformationContext({ transformationCaseId: 'case-1', organizationId: 'org-1', actorUserId: 'actor-1', policy, client });

    expect(retrieveMock).toHaveBeenCalledWith(expect.objectContaining({ workflow: 'agent_execution', projectId: 'project-1', selectedDocumentIds: ['doc-1'], totalChunkLimit: 2 }));
    expect(revalidateMock).toHaveBeenCalledWith(expect.objectContaining({
      candidates: [expect.objectContaining({ artifactId: 'doc-1', module: 'Knowledge', projectId: 'project-1', relevance: 0.91 })],
    }));
    expect(lineageMock).toHaveBeenCalledTimes(1);
  });

  it('fails closed on retrieval error and does not write lineage', async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [owner] }) } as any;
    retrieveMock.mockRejectedValue(new Error('retrieval unavailable'));
    revalidateMock.mockResolvedValue({ decision: 'blocked_snapshot' });
    await retrieveAndRevalidateTransformationContext({ transformationCaseId: 'case-1', organizationId: 'org-1', actorUserId: 'actor-1', policy, client });
    expect(revalidateMock).toHaveBeenCalledWith(expect.objectContaining({ candidates: [], retrievalFailureReason: 'retrieval unavailable' }));
    expect(lineageMock).not.toHaveBeenCalled();
  });

  it('requires a pinned project before any retrieval', async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [{ ...owner, project_id: null }] }) } as any;
    await retrieveAndRevalidateTransformationContext({ transformationCaseId: 'case-1', organizationId: 'org-1', actorUserId: 'actor-1', policy: { ...policy, projectId: null }, client });
    expect(retrieveMock).not.toHaveBeenCalled();
    expect(revalidateMock).toHaveBeenCalledWith(expect.objectContaining({ retrievalFailureReason: 'agent_context_project_required' }));
  });
});
