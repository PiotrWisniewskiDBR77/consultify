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
 * Shared Method Kernel — artifact event model.
 *
 * Owned by: Assessment/Core team. Consumed by: Assessment, Tools, Audits.
 * Public contract — changes require a COORDINATION_REQUIRED note to Codex.
 *
 * The kernel is method-agnostic on purpose: it carries NO DRD/SIRI/ADMA rule.
 * Method-specific meaning lives behind `MethodAdapter` (see ./methodPack.ts).
 *
 * Canon:
 *  - docs/.../AGREEMENTS/ASSESSMENT_WORKBENCH_SYSTEM_CONTRACT.md §3, §7
 *  - docs/.../AGREEMENTS/ASSESSMENT_EVIDENCE_AND_SCORING_CONTRACT.md §1
 *  - docs/.../AGREEMENTS/TOOL_SESSION_WORKSPACE_STANDARD.md §6.2.2
 */

/**
 * The 18 kernel events. This list is closed: a method may not invent an event,
 * it carries method meaning in `payload` behind its adapter.
 *
 * Ordering below mirrors the canonical work chain
 * `answer → evidence → AI proposal → decision → artifact → downstream`.
 */
export const METHOD_EVENT_TYPES = [
  // --- answering -----------------------------------------------------------
  'ANSWER_DRAFTED',
  'ANSWER_CONFIRMED',
  'ANSWER_REVISED',
  'NOTE_ADDED',
  // --- evidence ------------------------------------------------------------
  'EVIDENCE_ATTACHED',
  'EVIDENCE_VERIFIED',
  // --- Teresa (propose → preview → commit) ---------------------------------
  'TERESA_PROPOSAL_CREATED',
  'TERESA_PROPOSAL_ACCEPTED',
  'TERESA_PROPOSAL_REJECTED',
  // --- human decision ------------------------------------------------------
  'DECISION_PROPOSED',
  'DECISION_APPROVED',
  'DECISION_SENT_BACK',
  // --- artifact ------------------------------------------------------------
  'ARTIFACT_UPDATED',
  'ARTIFACT_REORGANIZED',
  // --- downstream ----------------------------------------------------------
  'OUTPUT_CREATED',
  'OUTPUT_APPROVED',
  'REPORT_REQUESTED',
  'INITIATIVE_PROPOSED',
] as const;

export type MethodEventType = (typeof METHOD_EVENT_TYPES)[number];

/**
 * Who caused the event. Kept separate from `actorUserId` because provenance
 * must survive even when a human accepts an AI proposal: the accepting human is
 * the actor, but the originating author stays visible.
 *
 * Canon: TOOL_SESSION_WORKSPACE_STANDARD.md §5.3
 * ("AI-generated i human-authored provenance pozostaje widoczne").
 */
export type MethodActorKind = 'human' | 'teresa' | 'system';

/**
 * Events are append-only. Nothing in the kernel rewrites or deletes an event;
 * a correction is a NEW event that supersedes an earlier one via `supersedes`.
 */
export interface MethodEvent<TPayload = unknown> {
  /** Stable event id (uuid). */
  readonly id: string;
  readonly type: MethodEventType;

  /** Tenancy + process scoping. Every event is org-scoped without exception. */
  readonly organizationId: string;
  readonly sessionId: string;

  /**
   * Unit the event is about — an area/dimension/criterion id from the pinned
   * Method Pack. Absent for session-level events (e.g. OUTPUT_CREATED).
   */
  readonly unitId?: string;
  /** Level/band under consideration, when the event is level-scoped. */
  readonly level?: number;

  readonly actorKind: MethodActorKind;
  /** Null only for `system`. Teresa events carry the invoking user. */
  readonly actorUserId: string | null;

  /**
   * Method Pack version pinned by the session at the time of the event.
   * Required so history stays reproducible after a pack upgrade.
   */
  readonly methodPackVersion: string;

  readonly occurredAt: string; // ISO-8601 UTC

  /** Event this one corrects/replaces. Append-only correction, never in-place. */
  readonly supersedes?: string;

  /** Idempotency key — replaying the same key must not create a second event. */
  readonly idempotencyKey?: string;

  readonly payload: TPayload;
}

/**
 * Narrowed payloads for the events whose shape the kernel actually constrains.
 * Everything else is method-owned and typed by the adapter.
 */

export interface AnswerEventPayload {
  readonly questionId: string;
  /**
   * Canon requires an honest "I don't know" that is NOT scored as zero.
   * ASSESSMENT_QUESTION_HELP_AND_CONVERSATION_STANDARD.md §4.
   */
  readonly answerState:
    | 'confirmed'
    | 'partial'
    | 'no'
    | 'dont_know'
    | 'no_evidence'
    | 'not_applicable';
  readonly text?: string;
  /** Mandatory for `not_applicable` — canon forbids unjustified N/A. */
  readonly justification?: string;
}

export interface EvidenceEventPayload {
  readonly evidenceId: string;
  readonly evidenceType:
    | 'document'
    | 'system_record'
    | 'metric'
    | 'demonstration'
    | 'observation'
    | 'interview_statement'
    | 'media'
    | 'external_source';
  /**
   * Evidence strength ladder E0..E4.
   * E0 none · E1 declaration · E2 artefact pointed to · E3 artefact verified ·
   * E4 confirmed repeatable result.
   * Deliberately independent of level fulfilment and of assessor confidence —
   * ASSESSMENT_EVIDENCE_AND_SCORING_CONTRACT.md §5.
   */
  readonly strength: EvidenceStrength;
  readonly linkedQuestionIds?: readonly string[];
}

export const EVIDENCE_STRENGTHS = ['E0', 'E1', 'E2', 'E3', 'E4'] as const;
export type EvidenceStrength = (typeof EVIDENCE_STRENGTHS)[number];

export interface DecisionEventPayload {
  readonly decisionId: string;
  /** What the human decided about — a level/band, a target, or a freeze. */
  readonly subject: 'current_level' | 'target_level' | 'freeze' | 'output_approval';
  readonly proposedValue?: number;
  readonly decidedValue?: number;
  /** Canon: every decision keeps rationale AND the delta vs the AI proposal. */
  readonly rationale: string;
  readonly divergesFromProposal?: boolean;
}

export interface TeresaProposalEventPayload {
  readonly proposalId: string;
  readonly capabilityId: string;
  /**
   * Human-readable preview shown BEFORE commit. The kernel refuses to commit a
   * proposal that never produced a preview — see ./teresa.ts.
   */
  readonly previewRef: string;
  /** Quality gate verdict — TERESA_ASSESSMENT_FACILITATION_PLAYBOOK.md §6. */
  readonly qualityVerdict: 'valid' | 'needs_human_review' | 'invalid';
}

/** Type guard used at the API boundary to reject unknown event types. */
export function isMethodEventType(value: unknown): value is MethodEventType {
  return (
    typeof value === 'string' && (METHOD_EVENT_TYPES as readonly string[]).includes(value)
  );
}
