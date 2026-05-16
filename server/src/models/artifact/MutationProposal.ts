import type { ArtifactOp } from './ArtifactOp.js';

export type MutationProposalId = string & { readonly __brand: 'MutationProposalId' };
export type TrustBundleHash = string & { readonly __brand: 'TrustBundleHash' };
export type TxnId = string & { readonly __brand: 'TxnId' };

export function unsafeMutationProposalId(value: string): MutationProposalId {
  return String(value) as MutationProposalId;
}

export function unsafeTrustBundleHash(value: string): TrustBundleHash {
  return String(value) as TrustBundleHash;
}

export function unsafeTxnId(value: string): TxnId {
  return String(value) as TxnId;
}

export type SourceEvidenceRef = {
  readonly trustBundleSha256: string;
  readonly sourceHint: string | null;
};

export type MutationProposal = {
  readonly id: MutationProposalId;
  readonly artifactId: string;
  readonly declaredArtifactType: string;
  readonly baseVersionId: string | null;
  readonly intent: string;
  readonly sourceSet: readonly SourceEvidenceRef[];
  readonly ops: readonly ArtifactOp[];
  readonly rationale: string;
  readonly citations: readonly unknown[];
  readonly trustBundleHash: TrustBundleHash;
  readonly reversibleTxnId: TxnId;
  readonly preview: unknown;
  readonly createdAt: string;
  readonly proposedBy: string;
  readonly approvalRequired: boolean;
  readonly approvalMode: string;
};

export function assertMutationProposal(proposal: MutationProposal): void {
  const hash = String(proposal.trustBundleHash);
  if (hash.length !== 64) {
    throw new Error(`Invalid trust bundle hash (expected 64 chars): ${hash.length}`);
  }
  if (!Array.isArray(proposal.ops)) {
    throw new Error('Mutation proposal ops must be an array');
  }
}
