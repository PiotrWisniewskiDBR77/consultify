import type { Artifact } from '../../artifact/Artifact.js';
import type { MutationProposal } from '../../artifact/MutationProposal.js';
import type { ReviewEvent } from '../../artifact/ReviewStateMachine.js';
import { nextReviewState, type ReviewState } from '../../artifact/ReviewStateMachine.js';

export type ArtifactMutationRunId = string & { readonly __brand: 'ArtifactMutationRunId' };

export function unsafeArtifactMutationRunId(value: string): ArtifactMutationRunId {
  return String(value) as ArtifactMutationRunId;
}

export type ArtifactMutationPipelineOutput = {
  readonly runId: ArtifactMutationRunId;
  readonly proposalId: string;
  readonly partialAcceptance: { readonly selectedOpIndices: readonly number[] };
  readonly rejectedOps: readonly { readonly opIndex: number; readonly reason: string }[];
  readonly previousReviewState: ReviewState;
  readonly nextReviewState: ReviewState;
  readonly auditEvent: unknown;
  readonly callerToken: string | null;
};

export function runArtifactMutationPipeline(input: {
  readonly runId: ArtifactMutationRunId;
  readonly artifact: Artifact;
  readonly proposal: MutationProposal;
  readonly selectedOpIndices: readonly number[];
  readonly reviewEvent: ReviewEvent;
  readonly actorId: string;
  readonly now: string;
}): ArtifactMutationPipelineOutput {
  const previous = String(input.artifact.reviewState) as ReviewState;
  const next = nextReviewState(previous, input.reviewEvent);

  return {
    runId: input.runId,
    proposalId: String(input.proposal.id),
    partialAcceptance: { selectedOpIndices: [...input.selectedOpIndices] },
    rejectedOps: [],
    previousReviewState: previous,
    nextReviewState: next,
    auditEvent: {
      kind: 'artifact_mutation_planned',
      actorId: input.actorId,
      now: input.now,
      proposalId: String(input.proposal.id),
    },
    callerToken: 'caller-token',
  };
}

