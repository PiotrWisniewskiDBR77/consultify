/**
 * V10-ART-007 — MutationProposal envelope (Wave A seed, schema + invariants).
 *
 * Implements R-ARTIFACT-7 from
 * `docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md#v10-art-007`.
 *
 * Scope (Wave A seed)
 * -------------------
 * The central envelope every AI-originated artifact edit flows through.
 * A proposal is **never** applied directly — it must pass the shape +
 * invariant bundle in `assertMutationProposal`, then be approved by the
 * configured approval mode, before the `reversibleTxnId` is committed by
 * the apply pipeline (V10-ART-010).
 *
 * Integrates these sibling Wave A seed primitives in one place:
 *   - `Artifact` identity brands     (V10-ART-001)
 *   - `ArtifactType`                 (V10-ART-002)
 *   - `ArtifactCanonicalContent`     (V10-ART-006)  ← `preview`
 *   - `ApprovalMode`                 (V10-AGT-004)  ← `approvalMode`
 *   - `EvidenceRef`                  (V10-ART-001)  ← `sourceSet`
 *   - `ActorId`                      (V10-AGT-001)  ← `proposedBy`
 *
 * What lands here
 * ---------------
 *   - Branded `MutationProposalId`, `TxnId`, `TrustBundleHash`
 *   - `MutationIntent` union (`create_artifact` | `update_artifact`
 *     | `derive_artifact` | `archive`)
 *   - Placeholder `ArtifactOp` (superseded by V10-ART-008) and
 *     `Citation` (superseded by V10-ART-009) with JSDoc pointers
 *   - `MutationProposal` core interface (17 fields, all readonly)
 *   - `MUTATION_PROPOSAL_REQUIRED_KEYS` manifest
 *   - `assertMutationProposal` invariant bundle:
 *       * rationale ≥ `MIN_RATIONALE_LENGTH` chars (trimmed)
 *       * intent ↔ baseVersionId coherence
 *       * sourceSet / ops non-empty for non-archive intents
 *       * preview kind matches declaredArtifactType
 *       * approvalRequired ↔ approvalMode coherence
 *       * citation trust-bundle sha must appear in sourceSet
 *   - `InvalidMutationProposalError` with structured `reason` code
 *
 * What does NOT land here
 * -----------------------
 *   - Typed `ArtifactOp` discriminated union (V10-ART-008)
 *   - Typed `Citation` with span offsets (V10-ART-009)
 *   - Direct-write ban + apply pipeline (V10-ART-010)
 *   - Partial-accept mutation path (V10-ART-011)
 *   - Reversible transaction store (V10-ART-013)
 *   - `TrustBundle` schema (V10-RSN-015)
 *
 * Runtime behaviour
 * -----------------
 * Pure module. `assertMutationProposal` is the only function with a
 * throw path and it never performs I/O. The `ff.artifact_mutation_proposal`
 * flag gates adoption; without it, callers continue to write via the
 * legacy path. When ON, the ArtifactStore (V10-ART-022) rejects any
 * AI-sourced write that did not pass through this envelope.
 *
 * Invariant summary
 * -----------------
 * An invalid proposal **never** reaches the approval UI. The apply
 * pipeline (V10-ART-010) calls `assertMutationProposal` at ingress and
 * again immediately before commit; both call sites are required
 * because `ArtifactCanonicalContent` content can mutate between the
 * two boundaries and the coherence check must hold at commit time.
 */

import type { ApprovalMode } from '../agent/ApprovalMode';
import type { ActorId } from '../agent/ExecutionProposalV1';
import type {
  ArtifactId,
  ArtifactType,
  ArtifactVersionId,
  EvidenceRef,
  Timestamp,
} from './Artifact';
import {
  type ArtifactCanonicalContent,
  assertContentMatchesType,
} from './ArtifactCanonicalContent';

// ---------------------------------------------------------------------------
// §1 — Identity brands.
// ---------------------------------------------------------------------------

declare const MUTATION_PROPOSAL_ID_BRAND: unique symbol;
declare const TXN_ID_BRAND: unique symbol;
declare const TRUST_BUNDLE_HASH_BRAND: unique symbol;

export type MutationProposalId = string & {
  readonly [MUTATION_PROPOSAL_ID_BRAND]: void;
};
export type TxnId = string & { readonly [TXN_ID_BRAND]: void };

/**
 * SHA-256 hex digest of the reasoning TrustBundle that sourced this
 * mutation. Branded separately from `string` so apply-time wiring
 * cannot confuse it with a generic content hash.
 *
 * @placeholder Promoted to a first-class type alongside the full
 *   TrustBundle schema in V10-RSN-015.
 */
export type TrustBundleHash = string & {
  readonly [TRUST_BUNDLE_HASH_BRAND]: void;
};

export const unsafeMutationProposalId = (v: string): MutationProposalId => v as MutationProposalId;
export const unsafeTxnId = (v: string): TxnId => v as TxnId;
export const unsafeTrustBundleHash = (v: string): TrustBundleHash => v as TrustBundleHash;

// ---------------------------------------------------------------------------
// §2 — Intent union.
// ---------------------------------------------------------------------------

/**
 * The four mutation intents an AI may express against an artifact.
 *
 * `create_artifact`  — materialise a new artifact row (no base version)
 * `update_artifact`  — in-place edit on an existing version
 * `derive_artifact`  — fork a new artifact whose `parentArtifactId`
 *                      points at the source; independent version chain
 * `archive`          — soft-delete flow; source & ops MAY be empty
 */
export type MutationIntent = 'create_artifact' | 'update_artifact' | 'derive_artifact' | 'archive';

export const MUTATION_INTENTS: readonly MutationIntent[] = [
  'create_artifact',
  'update_artifact',
  'derive_artifact',
  'archive',
] as const;

// ---------------------------------------------------------------------------
// §3 — Placeholders for V10-ART-008 (ops) + V10-ART-009 (citations).
// ---------------------------------------------------------------------------

/**
 * @placeholder Superseded by the typed `ArtifactOp` discriminated
 *   union in `./ArtifactOp` (V10-ART-008, landed in V10-09). This
 *   loose shape is retained only while the V10 rollout is gated on
 *   `ff.artifact_typed_ops === false` (default-OFF). When that flag
 *   flips ON, the proposal ingress switches to importing the strict
 *   union from `./ArtifactOp` and this interface is removed.
 *
 *   During the migration window, `assertMutationProposal` continues
 *   to enforce the minimum invariant (`op.kind` is non-empty). The
 *   strict per-op validation (`assertArtifactOp`) is applied by the
 *   ArtifactStore apply pipeline (V10-ART-010 / V10-ART-012), so the
 *   loose field shape here does not weaken the runtime contract.
 */
export interface ArtifactOp {
  readonly kind: string;
  readonly targetNodeId?: string;
  readonly payload?: unknown;
}

/**
 * @placeholder Superseded by the typed `CitationV1` in
 *   `./CitationV1.ts` (V10-ART-009, landed in V10-10). Kept as the
 *   legacy shape for proposals that arrive while
 *   `ff.artifact_citation_v1` is OFF — once that flag flips ON, the
 *   MutationProposal ingress swaps to `CitationV1` +
 *   `assertFactualOpsHaveCitations`, and this interface will be
 *   removed.
 */
export interface Citation {
  readonly trustBundleSha256: string;
  readonly sourceHint?: string | null;
  readonly span?: { readonly start: number; readonly end: number };
}

// ---------------------------------------------------------------------------
// §4 — Core envelope.
// ---------------------------------------------------------------------------

/**
 * Every AI-originated artifact edit is a `MutationProposal`. The
 * envelope carries every field a reviewer needs to decide without
 * opening sibling surfaces: what is changing, why, against which base
 * version, sourced from which evidence, and with which reversible
 * transaction id to roll back on dissent.
 *
 * Stability contract
 * ------------------
 * - `id` is stable across the review lifecycle (draft, approved,
 *   rejected, partially-accepted). It is *not* reused across reruns
 *   — a re-proposal after user feedback gets a fresh id.
 * - `reversibleTxnId` is the handle the apply pipeline passes to
 *   V10-ART-013 (undo store). Undo resolves the id back to a
 *   committed row set and reverses it atomically.
 * - `baseVersionId === null` IFF `intent === 'create_artifact'`; any
 *   other combination is rejected by `assertMutationProposal`.
 */
export interface MutationProposal {
  readonly id: MutationProposalId;
  readonly artifactId: ArtifactId;
  /**
   * Artifact type the preview is expected to satisfy. For
   * `create_artifact` this is the type of the row about to be
   * materialised; for `update_artifact` / `derive_artifact` it is
   * the current type of the target row (callers read it from the
   * ArtifactStore). Carrying it here avoids an extra store hit
   * inside `assertMutationProposal`.
   */
  readonly declaredArtifactType: ArtifactType;
  /**
   * Base version id for optimistic concurrency. MUST be `null` for
   * `create_artifact` (no prior version) and non-null for any other
   * intent. At apply time the pipeline reads the current version and
   * rejects the proposal if it has advanced past `baseVersionId`.
   */
  readonly baseVersionId: ArtifactVersionId | null;
  readonly intent: MutationIntent;
  /**
   * Evidence references the mutation is grounded in. MUST be
   * non-empty for any intent other than `archive` (nothing new to
   * substantiate on a soft delete).
   */
  readonly sourceSet: readonly EvidenceRef[];
  /**
   * Ordered list of ops the mutation will execute against the
   * artifact's canonical content. MUST be non-empty for any intent
   * other than `archive`. Ops SHOULD address content by stable
   * `NodeId` (V10-ART-006); the op registry (V10-ART-008) formalises
   * this rule.
   */
  readonly ops: readonly ArtifactOp[];
  /**
   * Free-form human-readable reason the mutation is being proposed.
   * Rendered verbatim in the approval UI. Must be at least
   * `MIN_RATIONALE_LENGTH` non-whitespace chars so the dev plan's
   * "User sees rationale … before deciding" acceptance criterion
   * cannot be silently defeated by an empty string.
   */
  readonly rationale: string;
  readonly citations: readonly Citation[];
  /**
   * SHA-256 digest of the reasoning TrustBundle that produced the
   * proposal. MUST match a `trustBundleSha256` carried in at least
   * one `sourceSet` entry (coherence invariant).
   */
  readonly trustBundleHash: TrustBundleHash;
  readonly reversibleTxnId: TxnId;
  /**
   * Post-mutation artifact content, typed. The approval UI renders
   * this as the "after" side of the diff. Must structurally match
   * `declaredArtifactType` or `assertMutationProposal` throws.
   */
  readonly preview: ArtifactCanonicalContent;
  readonly createdAt: Timestamp;
  readonly proposedBy: ActorId;
  /**
   * Whether the mutation requires explicit approval before commit.
   * When `false`, `approvalMode` MUST be `'implicit'`. When `true`,
   * `approvalMode` MUST be anything but `'implicit'`. Both branches
   * are checked by `assertMutationProposal`.
   */
  readonly approvalRequired: boolean;
  readonly approvalMode: ApprovalMode;
}

/**
 * The required-keys manifest. Consumed by the unit test to fail fast
 * if a future PR drops a field from the envelope.
 */
export const MUTATION_PROPOSAL_REQUIRED_KEYS = [
  'id',
  'artifactId',
  'declaredArtifactType',
  'baseVersionId',
  'intent',
  'sourceSet',
  'ops',
  'rationale',
  'citations',
  'trustBundleHash',
  'reversibleTxnId',
  'preview',
  'createdAt',
  'proposedBy',
  'approvalRequired',
  'approvalMode',
] as const satisfies ReadonlyArray<keyof MutationProposal>;

export type MutationProposalRequiredKey = (typeof MUTATION_PROPOSAL_REQUIRED_KEYS)[number];

// ---------------------------------------------------------------------------
// §5 — Invariant thresholds.
// ---------------------------------------------------------------------------

/**
 * Minimum trimmed length of `rationale`. Picked to be the smallest
 * number that rejects single-word rationales like "fix" / "update"
 * while still accepting short legitimate ones like "add totals row".
 */
export const MIN_RATIONALE_LENGTH = 8;

// ---------------------------------------------------------------------------
// §6 — Error class.
// ---------------------------------------------------------------------------

export type InvalidMutationProposalReason =
  | 'rationale_too_short'
  | 'source_set_empty'
  | 'ops_empty'
  | 'base_version_missing'
  | 'base_version_unexpected'
  | 'preview_type_mismatch'
  | 'approval_mode_inconsistent'
  | 'citation_not_in_source_set'
  | 'empty_op_kind';

export class InvalidMutationProposalError extends Error {
  public readonly reason: InvalidMutationProposalReason;
  public readonly proposalId: MutationProposalId;
  public readonly detail: string;

  constructor(
    reason: InvalidMutationProposalReason,
    proposalId: MutationProposalId,
    detail: string
  ) {
    super(`InvalidMutationProposal[${reason}] proposal=${String(proposalId)}: ${detail}`);
    this.name = 'InvalidMutationProposalError';
    this.reason = reason;
    this.proposalId = proposalId;
    this.detail = detail;
  }
}

// ---------------------------------------------------------------------------
// §7 — Invariant bundle.
// ---------------------------------------------------------------------------

/**
 * Validates a `MutationProposal` end-to-end. Throws
 * `InvalidMutationProposalError` with a structured reason code on the
 * first violation; the apply pipeline surfaces the reason verbatim in
 * telemetry so dashboards can slice by failure mode.
 *
 * This function is **pure** and **synchronous**. It is safe to call
 * at ingress, immediately before commit, and inside tests.
 */
export function assertMutationProposal(proposal: MutationProposal): void {
  // §7.1 — rationale length.
  if (proposal.rationale.trim().length < MIN_RATIONALE_LENGTH) {
    throw new InvalidMutationProposalError(
      'rationale_too_short',
      proposal.id,
      `rationale must be ≥ ${MIN_RATIONALE_LENGTH} non-whitespace chars ` +
        `(got ${proposal.rationale.trim().length})`
    );
  }

  // §7.2 — intent ↔ baseVersionId coherence.
  if (proposal.intent === 'create_artifact' && proposal.baseVersionId !== null) {
    throw new InvalidMutationProposalError(
      'base_version_unexpected',
      proposal.id,
      "intent='create_artifact' requires baseVersionId=null"
    );
  }
  if (proposal.intent !== 'create_artifact' && proposal.baseVersionId === null) {
    throw new InvalidMutationProposalError(
      'base_version_missing',
      proposal.id,
      `intent='${proposal.intent}' requires a non-null baseVersionId`
    );
  }

  // §7.3 — non-archive intents require sourceSet + ops.
  if (proposal.intent !== 'archive') {
    if (proposal.sourceSet.length === 0) {
      throw new InvalidMutationProposalError(
        'source_set_empty',
        proposal.id,
        `intent='${proposal.intent}' requires at least one EvidenceRef`
      );
    }
    if (proposal.ops.length === 0) {
      throw new InvalidMutationProposalError(
        'ops_empty',
        proposal.id,
        `intent='${proposal.intent}' requires at least one ArtifactOp`
      );
    }
  }

  // §7.4 — ops must carry a non-empty kind.
  for (let i = 0; i < proposal.ops.length; i += 1) {
    const op = proposal.ops[i]!;
    if (op.kind.trim().length === 0) {
      throw new InvalidMutationProposalError(
        'empty_op_kind',
        proposal.id,
        `ops[${i}].kind must be a non-empty string`
      );
    }
  }

  // §7.5 — preview structurally matches declaredArtifactType.
  try {
    assertContentMatchesType(proposal.declaredArtifactType, proposal.preview);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new InvalidMutationProposalError('preview_type_mismatch', proposal.id, detail);
  }

  // §7.6 — approvalRequired ↔ approvalMode coherence.
  if (proposal.approvalRequired && proposal.approvalMode === 'implicit') {
    throw new InvalidMutationProposalError(
      'approval_mode_inconsistent',
      proposal.id,
      "approvalRequired=true forbids approvalMode='implicit'"
    );
  }
  if (!proposal.approvalRequired && proposal.approvalMode !== 'implicit') {
    throw new InvalidMutationProposalError(
      'approval_mode_inconsistent',
      proposal.id,
      "approvalRequired=false requires approvalMode='implicit' " +
        `(got '${proposal.approvalMode}')`
    );
  }

  // §7.7 — every citation's trustBundleSha256 must appear in sourceSet.
  if (proposal.citations.length > 0) {
    const bundleSet = new Set<string>();
    for (const ref of proposal.sourceSet) {
      bundleSet.add(ref.trustBundleSha256);
    }
    for (let i = 0; i < proposal.citations.length; i += 1) {
      const cit = proposal.citations[i]!;
      if (!bundleSet.has(cit.trustBundleSha256)) {
        throw new InvalidMutationProposalError(
          'citation_not_in_source_set',
          proposal.id,
          `citations[${i}].trustBundleSha256=${cit.trustBundleSha256} ` +
            'does not appear in sourceSet'
        );
      }
    }
  }
}
