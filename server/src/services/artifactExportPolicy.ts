export type ArtifactExportMode = 'draft' | 'final';
export type ArtifactPublishChannel = 'download' | 'public_link';
export type ArtifactClassification = 'public' | 'internal' | 'confidential';

export type ArtifactExportBlockCode =
  | 'PUBLIC_LINK_CLASSIFICATION_BLOCKED'
  | 'CRITICAL_QA_BLOCKED'
  | 'CURRENT_APPROVAL_REQUIRED'
  | 'OVERRIDE_PERMISSION_REQUIRED'
  | 'OVERRIDE_REASON_REQUIRED';

export interface ArtifactExportPolicyInput {
  mode: ArtifactExportMode;
  channel: ArtifactPublishChannel;
  classification: ArtifactClassification;
  criticalQaFindings: number;
  approvalCurrentForVersion: boolean;
  override?: {
    requested: boolean;
    permitted: boolean;
    reason?: string | null;
  };
}

export interface ArtifactExportPolicyDecision {
  allowed: boolean;
  draftMarkingRequired: boolean;
  overrideApplied: boolean;
  blocks: ArtifactExportBlockCode[];
}

/**
 * Shared, fail-closed export/publish policy for open artifacts.
 *
 * This function deliberately has no format-specific or persistence logic, so
 * DOC, PPT and XLSX routes can evaluate the same rules server-side. A UI may
 * explain this result, but it must never be the policy authority.
 */
export function evaluateArtifactExportPolicy(
  input: ArtifactExportPolicyInput
): ArtifactExportPolicyDecision {
  const blocks: ArtifactExportBlockCode[] = [];

  // Classification is never overrideable as part of export. It requires its
  // own privileged, audited lifecycle operation before a public link exists.
  if (input.channel === 'public_link' && input.classification !== 'public') {
    blocks.push('PUBLIC_LINK_CLASSIFICATION_BLOCKED');
  }

  const governanceBlocks: ArtifactExportBlockCode[] = [];
  if (input.mode === 'final') {
    if (input.criticalQaFindings > 0) governanceBlocks.push('CRITICAL_QA_BLOCKED');
    if (!input.approvalCurrentForVersion) governanceBlocks.push('CURRENT_APPROVAL_REQUIRED');
  }

  let overrideApplied = false;
  if (governanceBlocks.length > 0 && input.override?.requested) {
    if (!input.override.permitted) {
      blocks.push('OVERRIDE_PERMISSION_REQUIRED');
    } else if (!input.override.reason?.trim()) {
      blocks.push('OVERRIDE_REASON_REQUIRED');
    } else {
      overrideApplied = true;
    }
  } else {
    blocks.push(...governanceBlocks);
  }

  return {
    allowed: blocks.length === 0,
    draftMarkingRequired: input.mode === 'draft',
    overrideApplied,
    blocks,
  };
}
