import { describe, expect, it } from 'vitest';

import {
  EXECUTION_PROPOSAL_V1_REQUIRED_KEYS,
  unsafeActorId,
  unsafePolicyId,
  unsafeProposalId,
  unsafeTenantId,
  type ExecutionProposalV1,
} from '@/models/agent/ExecutionProposalV1';
import { unsafeRunId } from '@/models/agent/RunLedger';
import {
  ARTIFACT_REQUIRED_KEYS,
  unsafeArtifactId,
  unsafeArtifactVersionId,
  unsafeExportRecordId,
  unsafeRetentionPolicyId,
  unsafeUserId,
  type Artifact,
} from '@/models/artifact/Artifact';
import {
  runAgentExecutionPipeline,
  unsafeAgentExecutionPipelineRunId,
} from '@/models/v10/pipelines/AgentExecutionPipeline';

describe('V10 schema-only models', () => {
  it('exposes required-key manifests for execution proposals and artifacts', () => {
    expect(EXECUTION_PROPOSAL_V1_REQUIRED_KEYS).toEqual(
      expect.arrayContaining(['schemaVersion', 'tenantId', 'approvalMode', 'reversibilityHint'])
    );
    expect(ARTIFACT_REQUIRED_KEYS).toEqual(
      expect.arrayContaining(['id', 'tenantId', 'type', 'reviewState', 'content'])
    );
  });

  it('keeps the agent execution pipeline deterministic and schema-only', () => {
    const proposal: ExecutionProposalV1 = {
      schemaVersion: 'v1',
      id: unsafeProposalId('proposal-1'),
      tenantId: unsafeTenantId('tenant-1'),
      correlationId: 'corr-1',
      messageType: 'execution_proposal',
      severity: 'S2',
      ops: [],
      sources: [],
      rationale: 'Smoke test proposal',
      expectedVersions: {},
      approvalMode: 'inline',
      approvalPolicyId: unsafePolicyId('policy-1'),
      preview: { summary: 'No-op', renderedMarkdown: null },
      navigationIntent: 'stay_in_chat',
      budget: { maxWallClockMs: 1000, maxCostUsdCents: 0, maxToolCalls: 1 },
      blastRadius: { entityCount: 0, externalVisible: false, tenantsAffected: 1 },
      reversibilityHint: 'reversible',
      proposedBy: unsafeActorId('actor-1'),
      proposedAt: '2026-05-16T00:00:00.000Z',
      expiresAt: '2026-05-17T00:00:00.000Z',
    };

    expect(
      runAgentExecutionPipeline({
        pipelineRunId: unsafeAgentExecutionPipelineRunId('pipeline-1'),
        runId: unsafeRunId('run-1'),
        proposal,
        operatorApproved: false,
        now: '2026-05-16T00:00:00.000Z',
      })
    ).toMatchObject({
      severity: 'S2',
      gateDecision: 'rejected',
      ledgerRunRow: null,
    });
  });

  it('allows artifacts to be expressed through the unified artifact envelope', () => {
    const artifact: Artifact = {
      id: unsafeArtifactId('artifact-1'),
      tenantId: unsafeTenantId('tenant-1'),
      type: 'memo',
      ownerId: unsafeUserId('user-1'),
      permissionPolicyId: unsafePolicyId('policy-1'),
      dataClassification: 'Internal',
      retentionPolicyId: unsafeRetentionPolicyId('retention-1'),
      reviewState: 'draft',
      currentVersionId: unsafeArtifactVersionId('version-1'),
      lineageRootId: null,
      parentArtifactId: null,
      derivedFromVersionId: null,
      createdAt: '2026-05-16T00:00:00.000Z',
      updatedAt: '2026-05-16T00:00:00.000Z',
      archivedAt: null,
      exportRecords: [unsafeExportRecordId('export-1')],
      evidenceRefs: [],
      content: { __opaqueType: 'memo', blob: { title: 'Smoke test' } },
    };

    expect(artifact.type).toBe('memo');
    expect(artifact.reviewState).toBe('draft');
  });
});
