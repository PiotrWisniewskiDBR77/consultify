import { beforeEach, describe, expect, it, vi } from 'vitest';

const registerArtifactOriginMock = vi.fn(async () => ({
  artifactId: 'artifact-db-1',
  organizationId: 'tenant-1',
  outputType: 'report',
  artifactFamily: 'document',
  deliveryState: 'draft',
  titleSnapshot: 'Demo memo (updated)',
  ownerUserId: 'user-1',
  canonicalHome: 'outputs_library',
  visibilityScope: 'organization',
  projectId: null,
  contextSnapshotId: null,
  executionRunId: null,
  templateFamilyRef: null,
  sourceInitiativeId: null,
  aiGovernancePresetRef: null,
  originSummary: { v10: { runId: 'run-3' } },
  createdBy: 'user-1',
  createdAt: '2026-04-20T10:00:00.000Z',
  lastTransitionAt: '2026-04-20T10:00:00.000Z',
}));

vi.mock('../../../v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: (...args: any[]) => registerArtifactOriginMock(...args),
}));

import artifactPipelineService from '../artifactPipelineService.js';

function makeScope() {
  return {
    tenantId: 'tenant-1',
    userId: 'user-1',
    userRole: 'ADMIN',
  } as const;
}

function makeArtifact(overrides: Record<string, unknown> = {}) {
  return {
    id: 'artifact-1',
    tenantId: 'tenant-1',
    type: 'memo',
    ownerId: 'user-1',
    permissionPolicyId: 'policy-1',
    dataClassification: 'Internal',
    retentionPolicyId: 'retention-1',
    reviewState: 'draft',
    currentVersionId: 'version-1',
    lineageRootId: 'artifact-1',
    parentArtifactId: null,
    derivedFromVersionId: null,
    createdAt: '2026-04-20T10:00:00.000Z',
    updatedAt: '2026-04-20T10:00:00.000Z',
    archivedAt: null,
    exportRecords: [],
    evidenceRefs: [{ trustBundleSha256: 'a'.repeat(64), sourceHint: 'fixture' }],
    content: { title: 'Demo memo', blocks: [] },
    ...overrides,
  };
}

function makeMutationProposal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proposal-1',
    artifactId: 'artifact-1',
    declaredArtifactType: 'memo',
    baseVersionId: 'version-1',
    intent: 'update_artifact',
    sourceSet: [{ trustBundleSha256: 'a'.repeat(64), sourceHint: 'fixture' }],
    ops: [
      {
        kind: 'replace_text',
        nodeId: 'm-1',
        before: 'Old body',
        after: 'Updated body',
      },
    ],
    rationale: 'update selected paragraph',
    citations: [],
    trustBundleHash: 'a'.repeat(64),
    reversibleTxnId: 'txn-1',
    preview: { title: 'Demo memo (updated)', blocks: [] },
    createdAt: '2026-04-20T10:00:00.000Z',
    proposedBy: 'agent:test',
    approvalRequired: false,
    approvalMode: 'inline',
    ...overrides,
  };
}

describe('artifactPipelineService.publishRunToOutputsLibrary', () => {
  beforeEach(() => {
    registerArtifactOriginMock.mockClear();
  });

  it('registers a native_artifact origin keyed by runId', async () => {
    artifactPipelineService.run({
      scope: makeScope(),
      runId: 'run-3',
      now: '2026-04-20T10:00:00.000Z',
      command: 'Update selected paragraph',
      artifact: makeArtifact(),
      proposal: makeMutationProposal(),
      selectionContext: {
        artifactId: 'artifact-1',
        selection: { kind: 'nodes', nodeIds: ['m-1'] },
      },
      selectedOpIndices: [0],
      reviewEvent: 'submit_for_review',
      materialize: true,
    });

    const published = await artifactPipelineService.publishRunToOutputsLibrary({
      scope: makeScope(),
      runId: 'run-3',
    });

    expect(registerArtifactOriginMock).toHaveBeenCalledTimes(1);
    const call = registerArtifactOriginMock.mock.calls[0]?.[0];
    expect(call.organizationId).toBe('tenant-1');
    expect(call.originRuntime).toBe('native_artifact');
    expect(call.originRecordId).toBe('run-3');
    expect(call.createdBy).toBe('user-1');

    expect(published.origin.originRecordId).toBe('run-3');
    expect(published.artifact.artifactId).toBe('artifact-db-1');
  });
});

