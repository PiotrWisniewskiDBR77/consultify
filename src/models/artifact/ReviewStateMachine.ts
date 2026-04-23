/**
 * V10-ART-003 — ReviewState finite-state machine (Wave A seed).
 *
 * Implements R-ARTIFACT-3 from
 * `docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md#v10-art-003`.
 *
 * FSM
 * ---
 *   draft → ready_for_review → approved → published → archived
 *              ↑                   ↓
 *              └───── rejected ────┘
 *
 * Additional terminal path: `archived` accepts no further transitions;
 * `draft → archived` is explicitly disallowed (a draft is discarded,
 * not archived). `approved` is frozen: a `MutationProposal` on an
 * `approved` artifact must create a new version, not in-place edit —
 * that rule is enforced at the ArtifactStore boundary (V10-ART-022),
 * not here.
 *
 * Scope (Wave A seed)
 * -------------------
 * Pure FSM: transition table, `canTransition` resolver, and an
 * audit-event shape for every transition. No persistence, no
 * reviewer identity handling — those land at V10-ART-023.
 *
 * Re-exports `ReviewState` from `./Artifact` so downstream code has
 * a single import source.
 */

import type { ReviewState } from './Artifact';

export type { ReviewState } from './Artifact';

// ---------------------------------------------------------------------------
// §1 — Events.
// ---------------------------------------------------------------------------

export type ReviewEvent =
  | 'submit_for_review'
  | 'approve'
  | 'reject'
  | 'resubmit'
  | 'publish'
  | 'archive';

export const REVIEW_EVENTS: readonly ReviewEvent[] = [
  'submit_for_review',
  'approve',
  'reject',
  'resubmit',
  'publish',
  'archive',
] as const;

// ---------------------------------------------------------------------------
// §2 — Transition table.
// ---------------------------------------------------------------------------

export interface ReviewTransition {
  readonly from: ReviewState;
  readonly event: ReviewEvent;
  readonly to: ReviewState;
}

/**
 * The exhaustive list of legal transitions. Anything not in this
 * table is rejected by `canTransition` — the FSM is closed.
 */
export const REVIEW_TRANSITIONS: readonly ReviewTransition[] = [
  { from: 'draft', event: 'submit_for_review', to: 'ready_for_review' },
  { from: 'ready_for_review', event: 'approve', to: 'approved' },
  { from: 'ready_for_review', event: 'reject', to: 'rejected' },
  { from: 'rejected', event: 'resubmit', to: 'ready_for_review' },
  { from: 'approved', event: 'publish', to: 'published' },
  { from: 'published', event: 'archive', to: 'archived' },
  { from: 'approved', event: 'archive', to: 'archived' },
  { from: 'rejected', event: 'archive', to: 'archived' },
] as const;

/**
 * Resolves the next state for a given (from, event) pair. Returns
 * `null` when the transition is not allowed. Callers log the
 * rejection and surface `InvalidTransitionError` (defined below).
 */
export function nextReviewState(
  from: ReviewState,
  event: ReviewEvent,
): ReviewState | null {
  for (const t of REVIEW_TRANSITIONS) {
    if (t.from === from && t.event === event) return t.to;
  }
  return null;
}

export function canTransition(from: ReviewState, event: ReviewEvent): boolean {
  return nextReviewState(from, event) !== null;
}

/**
 * Terminal states. `archived` is the only true terminal; `approved`
 * and `published` are "terminalish" — they accept additional events
 * (publish, archive) but freeze mutation. The test asserts that no
 * event leaves `archived`.
 */
export const TERMINAL_REVIEW_STATES: readonly ReviewState[] = ['archived'] as const;

// ---------------------------------------------------------------------------
// §3 — Audit entry.
// ---------------------------------------------------------------------------

declare const REVIEWER_ID_BRAND: unique symbol;
export type ReviewerId = string & { readonly [REVIEWER_ID_BRAND]: void };
export const unsafeReviewerId = (v: string): ReviewerId => v as ReviewerId;

/**
 * Shape of the audit row every transition writes. Hash of the
 * TrustBundle at transition time is captured so the evidence base
 * supporting an approval is locked in the audit log.
 */
export interface ReviewTransitionAudit {
  readonly artifactId: string;
  readonly versionId: string;
  readonly from: ReviewState;
  readonly event: ReviewEvent;
  readonly to: ReviewState;
  readonly reviewerId: ReviewerId;
  readonly trustBundleSha256: string | null;
  readonly occurredAt: string; // ISO-8601
  readonly note: string | null;
}

// ---------------------------------------------------------------------------
// §4 — Error class.
// ---------------------------------------------------------------------------

/**
 * Thrown by the would-be apply site when a transition is rejected.
 * Not thrown by `canTransition` / `nextReviewState` (those are pure
 * resolvers) — those return `null`/`false` instead so a caller can
 * compose without try/catch.
 */
export class InvalidReviewTransitionError extends Error {
  public readonly from: ReviewState;
  public readonly event: ReviewEvent;

  constructor(from: ReviewState, event: ReviewEvent) {
    super(`Invalid review transition: ${from} --${event}--> ?`);
    this.name = 'InvalidReviewTransitionError';
    this.from = from;
    this.event = event;
  }
}

/**
 * Helper: resolves the next state or throws. Consumed by the audit
 * write path (V10-ART-023) which wants hard failure semantics.
 */
export function resolveNextReviewStateOrThrow(
  from: ReviewState,
  event: ReviewEvent,
): ReviewState {
  const next = nextReviewState(from, event);
  if (next === null) {
    throw new InvalidReviewTransitionError(from, event);
  }
  return next;
}

/**
 * Enumerates every (from, event) pair in the closed product and
 * classifies it as legal / illegal. Used by the "100% state
 * transition coverage" invariant so the test body iterates once
 * instead of hand-typing all combinations.
 */
export function enumerateAllTransitions(): ReadonlyArray<{
  from: ReviewState;
  event: ReviewEvent;
  legal: boolean;
}> {
  const all: Array<{ from: ReviewState; event: ReviewEvent; legal: boolean }> = [];
  const states: ReviewState[] = [
    'draft',
    'ready_for_review',
    'rejected',
    'approved',
    'published',
    'archived',
  ];
  for (const from of states) {
    for (const event of REVIEW_EVENTS) {
      all.push({ from, event, legal: canTransition(from, event) });
    }
  }
  return all;
}
