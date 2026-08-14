/**
 * MIRROR — byte-identical copy of the body below this header, sourced from
 * src/method-core/contracts/ (the frozen public contract, owned by
 * Assessment/Core).
 *
 * WHY THIS FILE EXISTS: server/tsconfig.json sets "rootDir": "." (relative
 * to server/) and production boots via `cd server && npm run build && node
 * dist/src/index.js` (tsc --build tsconfig.build.json). A relative import
 * reaching outside server/ into the repo-root src/ tree fails that build
 * with TS6059 ("File is not under rootDir"). No existing server/src file
 * imports across that boundary (verified 2026-08-13, zero precedent) — tsx
 * (dev) and vitest (tests) both tolerate the cross-boundary import fine,
 * only the production tsc emit does not. Duplicating the contract is the
 * chosen tradeoff over changing rootDir (bigger blast radius) or emitting
 * broken production builds.
 *
 * KEEP IN SYNC: if the corresponding file under src/method-core/contracts/
 * changes, mirror the change here in the same commit. Diff the body below
 * this header comment against the source file to verify no drift.
 * Flagged to Codex as COORD-05 in
 * docs/program/METHOD_ASSESSMENT_CORE_2026-08-13/COORDINATION.md.
 */
/**
 * Shared Method Kernel — session state machine.
 *
 * Owned by: Assessment/Core team. Consumed by: Assessment, Tools, Audits.
 *
 * One machine serves all three modules. Domain statuses (Assessment's
 * `Evidence pending`, Audits' `Sampling`, …) are NOT extra states — they are
 * method-owned sub-stages that MAP onto these kernel states.
 * Canon: METHOD_MODULE_FIVE_SURFACES_STANDARD.md §8,
 *        ASSESSMENT_SESSION_LIFECYCLE_ROLES_AND_INTEGRATIONS.md §1.
 */

import type { MethodActorKind } from './events.js';

/**
 * Kernel session states. Closed set.
 *
 * Assessment's canonical lifecycle maps as:
 *   Draft            → 'draft'
 *   Prepared         → 'prepared'
 *   In interview     → 'active'
 *   Evidence pending → 'active'      (sub-stage; blocks freeze, not work)
 *   Consolidation    → 'active'      (sub-stage)
 *   In review        → 'in_review'
 *   Ready to freeze  → 'in_review'   (sub-stage; readiness = true)
 *   Score frozen     → 'frozen'
 *   Output published → 'frozen'      (Output is a separate object, not a state)
 *   Closed           → 'closed'
 *   Reassessment due → 'closed'      (sub-stage driven by due date)
 *   Archived         → 'archived'
 */
export const METHOD_SESSION_STATES = [
  'draft',
  'prepared',
  'active',
  'in_review',
  'frozen',
  'closed',
  'archived',
] as const;

export type MethodSessionState = (typeof METHOD_SESSION_STATES)[number];

/**
 * Allowed transitions. Anything not listed here is rejected by the kernel.
 *
 * Two rules the canon is explicit about and this table encodes:
 *  1. `frozen` is NOT terminal — reopening is legal, but it produces a NEW
 *     revision and never mutates the frozen snapshot in place
 *     (ASSESSMENT_EVIDENCE_AND_SCORING_CONTRACT.md §7). Hence frozen → active.
 *  2. There is no path that skips `in_review` on the way to `frozen`: a score
 *     is never frozen without a human review step.
 */
export const METHOD_SESSION_TRANSITIONS: Readonly<
  Record<MethodSessionState, readonly MethodSessionState[]>
> = {
  draft: ['prepared', 'archived'],
  prepared: ['active', 'draft', 'archived'],
  active: ['in_review', 'prepared', 'archived'],
  in_review: ['frozen', 'active', 'archived'],
  /** Reopen → new revision. Never an in-place edit of the snapshot. */
  frozen: ['closed', 'active', 'archived'],
  closed: ['active', 'archived'],
  archived: [],
} as const;

export function canTransition(from: MethodSessionState, to: MethodSessionState): boolean {
  return METHOD_SESSION_TRANSITIONS[from].includes(to);
}

/**
 * Reasons a transition is refused. Returned instead of a boolean so the UI can
 * explain the blocker rather than silently disabling a button.
 */
export type TransitionRefusal =
  | { kind: 'illegal_transition'; from: MethodSessionState; to: MethodSessionState }
  | { kind: 'missing_permission'; requiredRole: MethodProcessRole }
  | { kind: 'readiness_blocked'; blockers: readonly string[] }
  | { kind: 'pack_not_released'; methodPackId: string };

export type TransitionResult = { ok: true } | { ok: false; refusal: TransitionRefusal };

/**
 * Process roles, layered ON TOP of app roles and project roles — the kernel
 * never builds its own people directory.
 * Canon: ASSESSMENT_SESSION_LIFECYCLE_ROLES_AND_INTEGRATIONS.md §2, §4.
 */
export const METHOD_PROCESS_ROLES = [
  'owner',
  'lead_assessor',
  'assessor',
  'respondent',
  'evidence_owner',
  'reviewer',
  'approver',
  'observer',
] as const;

export type MethodProcessRole = (typeof METHOD_PROCESS_ROLES)[number];

/**
 * Which role may drive which transition. `approver` alone may freeze — the
 * canon allows one person to hold several roles in a small project, but the
 * combination must be explicit, never implicit.
 */
export const TRANSITION_AUTHORITY: Readonly<
  Partial<Record<MethodSessionState, readonly MethodProcessRole[]>>
> = {
  prepared: ['owner', 'lead_assessor'],
  active: ['owner', 'lead_assessor'],
  in_review: ['lead_assessor', 'assessor'],
  frozen: ['approver'],
  closed: ['owner'],
  archived: ['owner'],
} as const;

/**
 * Save-state machine for the workspace. Split from session state on purpose:
 * a dirty buffer must never look like a lifecycle change.
 * Canon: TOOL_SESSION_WORKSPACE_STANDARD.md §6.3.
 */
export type MethodSaveState =
  | 'CLEAN'
  | 'DIRTY'
  | 'SAVING'
  | 'SAVED'
  | 'SAVE_FAILED'
  | 'OFFLINE_PENDING';

export interface MethodSession {
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string | null;

  /** Which module owns this session — same kernel, three front doors. */
  readonly module: 'assessment' | 'tools' | 'audits';

  /** Pinned pack. A session never floats onto a newer method version. */
  readonly methodPackId: string;
  readonly methodPackVersion: string;

  readonly state: MethodSessionState;
  /** Method-owned sub-stage label, for display and filtering only. */
  readonly domainStage: string | null;

  readonly mode: 'guided_manual' | 'teresa_led';

  readonly ownerUserId: string;
  readonly createdAt: string;
  readonly updatedAt: string;

  /**
   * Optimistic concurrency token. Autosave must never silently overwrite a
   * newer version — a conflict shows a diff instead.
   * Canon: 10_ASSESSMENT_REVIEW.md §9.
   */
  readonly version: number;

  /** Set only in `frozen`; points at the immutable snapshot. */
  readonly frozenSnapshotId: string | null;
  /** Set when this session is a revision produced by reopening a frozen one. */
  readonly revisionOfSessionId: string | null;
  /** True only for an explicitly marked, non-production pack-readiness bypass. */
  readonly demoBypassActive?: boolean;
}

/** Readiness is advisory for navigation and blocking only for freeze. */
export interface MethodReadiness {
  readonly answeredUnits: number;
  readonly totalUnits: number;
  readonly unitsMissingEvidence: number;
  readonly openDiscrepancies: number;
  readonly pendingProposals: number;
  /** Human-readable blockers; empty array means freeze is permitted. */
  readonly freezeBlockers: readonly string[];
}

export interface MethodTransitionRequest {
  readonly sessionId: string;
  readonly to: MethodSessionState;
  readonly actorKind: MethodActorKind;
  readonly actorUserId: string;
  readonly rationale?: string;
  /** Required for `frozen`; the kernel refuses an unexplained freeze. */
  readonly idempotencyKey: string;
}
