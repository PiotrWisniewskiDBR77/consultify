import { describe, expect, it } from 'vitest';

import type { ArtifactStructure } from '../../../../../../src/models/artifact/TemplateFingerprint.js';
import { computeTemplateFingerprint } from '../../../../../../src/models/artifact/TemplateFingerprint.js';
import artifactRuntimeService from '../artifactRuntimeService.js';

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
    approvalRequired: true,
    approvalMode: 'inline',
    ...overrides,
  };
}

function makeApprovalRoutingTable() {
  return {
    tenantId: 'tenant-1',
    defaultRoute: 'operations',
    rules: [
      {
        id: 'restricted-ciso',
        priority: 100,
        match: { kind: 'classification', value: 'Restricted' },
        requires: 'ciso',
      },
      {
        id: 'legal-review',
        priority: 90,
        match: { kind: 'content_tag', value: 'legal' },
        requires: 'legal',
      },
      {
        id: 'spreadsheet-finance',
        priority: 80,
        match: { kind: 'artifact_type', value: 'spreadsheet' },
        requires: 'finance',
      },
      {
        id: 'memo-finance',
        priority: 80,
        match: { kind: 'artifact_type', value: 'memo' },
        requires: 'finance',
      },
      {
        id: 'decision-finance',
        priority: 80,
        match: { kind: 'artifact_type', value: 'decision_doc' },
        requires: 'finance',
      },
    ],
  } as const;
}

describe('artifactRuntimeService.planMutation', () => {
  it('returns a ready mutation plan for a scoped selection', () => {
    const result = artifactRuntimeService.planMutation({
      scope: makeScope(),
      runId: 'run-mutation-1',
      now: '2026-04-20T10:00:00.000Z',
      command: 'Update this paragraph',
      artifact: makeArtifact(),
      proposal: makeMutationProposal(),
      selectionContext: {
        artifactId: 'artifact-1',
        selection: {
          kind: 'nodes',
          nodeIds: ['m-1'],
        },
      },
      selectedOpIndices: [0],
      reviewEvent: 'submit_for_review',
    });

    expect(result.status).toBe('ready');
    expect(result.scopeVerdict.kind).toBe('scoped_to_selection');
    expect(result.nextReviewState).toBe('ready_for_review');
    expect(result.acceptedOpIndices).toEqual([0]);
    expect(result.rejectedOpIndices).toEqual([]);
    expect(result.callerTokenIssued).toBe(true);
  });

  it('returns a rejected plan when a demonstrative command has no selection', () => {
    const result = artifactRuntimeService.planMutation({
      scope: makeScope(),
      command: 'Update this paragraph',
      artifact: makeArtifact(),
      proposal: makeMutationProposal(),
      selectionContext: {
        artifactId: 'artifact-1',
        selection: { kind: 'empty' },
      },
      selectedOpIndices: [0],
      reviewEvent: 'submit_for_review',
    });

    expect(result.status).toBe('rejected');
    expect(result.scopeVerdict.kind).toBe('rejected');
    expect(result.acceptedOpIndices).toEqual([]);
  });
});

describe('artifactRuntimeService.applyMutation', () => {
  it('returns accepted ops and reverse ops for apply-ready mutations', () => {
    const result = artifactRuntimeService.applyMutation({
      scope: makeScope(),
      runId: 'run-apply-1',
      now: '2026-04-20T10:00:00.000Z',
      command: 'Update selected paragraph',
      artifact: makeArtifact(),
      proposal: makeMutationProposal(),
      selectionContext: {
        artifactId: 'artifact-1',
        selection: {
          kind: 'nodes',
          nodeIds: ['m-1'],
        },
      },
      selectedOpIndices: [0],
      reviewEvent: 'submit_for_review',
    });

    expect(result.status).toBe('apply_ready');
    expect(result.acceptedOps).toHaveLength(1);
    expect(result.reverseOps).toEqual([
      {
        kind: 'replace_text',
        nodeId: 'm-1',
        before: 'Updated body',
        after: 'Old body',
      },
    ]);
  });
});

describe('artifactRuntimeService.planExport', () => {
  it('returns a normalized export plan with manifest and footer', () => {
    const result = artifactRuntimeService.planExport({
      scope: makeScope(),
      runId: 'run-export-1',
      now: '2026-04-20T10:00:00.000Z',
      artifact: makeArtifact({
        reviewState: 'approved',
        currentVersionId: 'version-export-1',
      }),
      lineageNodes: [
        {
          id: 'artifact-1',
          lineageRootId: null,
          parentArtifactId: null,
          derivedFromVersionId: null,
          currentVersionId: 'version-export-1',
        },
      ],
      sha256: 'b'.repeat(64),
      format: 'pdf',
      destination: 'download',
      sources: [
        {
          sourceId: 'source-1',
          uri: 'file://source-1',
          retrievedAt: '2026-04-20T09:55:00.000Z',
        },
      ],
      confidentialityTags: ['internal'],
      watermark: { text: 'INTERNAL' },
      tenantWatermarkPolicy: { watermarkRequired: true, defaultText: 'INTERNAL' },
      footerTarget: 'pdf_footer',
    });

    const manifest = result.manifest as { format: string };
    const provenanceFooter = result.provenanceFooter as { sha256Prefix12: string };

    expect(result.exportAllowed).toBe(true);
    expect(result.lineageRootId).toBe('artifact-1');
    expect(manifest.format).toBe('pdf');
    expect(provenanceFooter.sha256Prefix12).toBe('bbbbbbbbbbbb');
  });
});

describe('artifactRuntimeService.planComment', () => {
  it('validates notifications and computes reattachment', () => {
    const result = artifactRuntimeService.planComment({
      scope: makeScope(),
      comment: {
        id: 'comment-1',
        anchor: {
          nodeId: 'm-1',
          range: null,
        },
        author: 'user-1',
        body: 'Please review this section',
        mentions: ['user-2'],
        kind: 'question',
        state: 'unresolved',
        orphaned: false,
        createdAt: '2026-04-20T10:00:00.000Z',
        resolvedAt: null,
      },
      notificationIntents: [
        {
          commentId: 'comment-1',
          recipient: 'user-2',
          emittedAt: '2026-04-20T10:00:01.000Z',
        },
      ],
      mutation: {
        kind: 'node_renamed',
        nodeId: 'm-1',
        newNodeId: 'm-2',
      },
    });

    expect(result.notificationsPlanned).toBe(1);
    expect(result.reattachResult?.outcome).toBe('reattached');
    expect(result.reattachResult?.comment.anchor.nodeId).toBe('m-2');
  });
});

describe('artifactRuntimeService.fingerprintTemplate', () => {
  it('computes fingerprints and validates library placement and transitions', () => {
    const structure: ArtifactStructure = {
      artifactType: 'memo',
      sections: [
        {
          name: 'Summary',
          nodeKinds: ['heading', 'paragraph'],
        },
      ],
    };
    const fingerprint = computeTemplateFingerprint(structure);

    const result = artifactRuntimeService.fingerprintTemplate({
      scope: makeScope(),
      structure,
      libraryFingerprints: [fingerprint],
      placement: {
        reviewState: 'approved',
        everExported: false,
        isTemplate: true,
        storedFolder: 'Templates',
      },
      transition: {
        prior: 'Drafts',
        next: 'Templates',
        event: 'save_as_template',
      },
    });

    expect(result.fingerprint).toBe(fingerprint);
    expect(result.matchesLibrary).toBe(true);
    expect(result.placement?.derivedFolder).toBe('Templates');
    expect(result.transition?.valid).toBe(true);
  });
});

describe('artifactRuntimeService.evaluateApprovals', () => {
  it('resolves the highest-priority matching reviewer role', () => {
    const routingTable = makeApprovalRoutingTable();

    const result = artifactRuntimeService.evaluateApprovals({
      scope: makeScope(),
      context: {
        artifactType: 'memo',
        contentTags: ['legal'],
      },
      routingTable,
      baselineRoutingTable: routingTable,
    });

    expect(result.requiredReviewer).toBe('legal');
    expect(result.resolvedByRuleId).toBe('legal-review');
    expect(result.defaultRouteUsed).toBe(false);
    expect(result.invariants.baselineNotWeakened).toBe(true);
  });
});
