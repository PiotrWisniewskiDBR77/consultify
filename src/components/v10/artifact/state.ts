import type { MutationProposal } from '@/models/artifact/MutationProposal';
import type { ReviewerRole } from '@/models/artifact/RoleBasedApprovalGates';
import type { SelectionScope } from '@/models/artifact/SelectionScope';
import type { ArtifactApprovalEvaluationResponse } from '@/services/api/v10/artifactRuntime';

export function buildDefaultSelectedOpIndices(proposal: Pick<MutationProposal, 'ops'>): number[] {
  return proposal.ops.map((_, index) => index);
}

export function formatSelectionSummary(selection?: SelectionScope | null): string {
  if (!selection) {
    return 'Selection unavailable';
  }

  switch (selection.kind) {
    case 'empty':
      return 'Whole artifact scope';
    case 'nodes':
      return `${selection.nodeIds.length} node${selection.nodeIds.length === 1 ? '' : 's'} selected`;
    case 'range':
      return `${selection.nodeIds.length} nodes in range`;
    default: {
      const exhaustive: never = selection;
      return String(exhaustive);
    }
  }
}

export function formatReviewerRole(role: ReviewerRole): string {
  return role
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function approvalStatusBadgeVariant(
  status: ArtifactApprovalEvaluationResponse['status']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ready':
      return 'default';
    case 'attention_required':
      return 'secondary';
    case 'blocked':
      return 'destructive';
    default:
      return 'outline';
  }
}
