import { describe, expect, it } from 'vitest';

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
    content: { __opaqueType: 'memo', blob: { body: 'hello' } },
    ...overrides,
  };
}

function makeMemoPreview() {
  return {
    kind: 'memo',
    schemaVersion: 1,
    blocks: [
      {
        id: 'm-1',
        kind: 'paragraph',
        text: 'Updated body',
        payload: {},
      },
    ],
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
    preview: makeMemoPreview(),
    createdAt: '2026-04-20T10:00:00.000Z',
    proposedBy: 'agent:test',
    approvalRequired: false,
    approvalMode: 'inline',
    ...overrides,
  };
}

describe('artifactPipelineService', () => {
  it('preflight returns checks and ok=true for valid request', () => {
    const preflight = artifactPipelineService.preflight({
      scope: makeScope(),
      runId: 'run-1',
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
    });

    expect(preflight.ok).toBe(true);
    expect(preflight.checks.find((c) => c.id === 'request_schema_valid')?.status).toBe('pass');
  });

  it('run materializes preview into a new version and stores it', () => {
    const result = artifactPipelineService.run({
      scope: makeScope(),
      runId: 'run-2',
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

    expect(result.materialized).toBe(true);
    expect(result.summary.fromVersionId).toBe('version-1');
    expect(result.summary.toVersionId).not.toBeNull();
    expect((result.artifact as any).currentVersionId).toBe(result.summary.toVersionId);
    expect((result.artifact as any).content).toEqual(makeMemoPreview());

    const stored = artifactPipelineService.getMaterializedArtifact({
      scope: makeScope(),
      artifactId: 'artifact-1',
    });
    expect(stored?.currentVersionId).toBe(result.summary.toVersionId);

    const run = artifactPipelineService.getRun({ scope: makeScope(), runId: 'run-2' });
    expect(run?.runId).toBe('run-2');
    expect(run?.materialized).toBe(true);
  });
});
