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
 * KEEP IN SYNC: if the corresponding file under src/method-core/contracts/ changes, mirror
 * the change here in the same commit. `diff` the body below the closing
 * `*/` of this header against the source file to verify no drift.
 * Flagged to Codex as COORD-05 in
 * docs/program/METHOD_ASSESSMENT_CORE_2026-08-13/COORDINATION.md.
 */
/**
 * Shared Method Kernel — Teresa proposal / preview / commit.
 *
 * One capability layer serves BOTH the conversation and the local AI buttons.
 * Canon is explicit that a button and a chat turn must not become two
 * implementations, two prompts or two truths:
 * TOOL_SESSION_WORKSPACE_STANDARD.md §6A ("Zasada antyduplikacyjna").
 *
 * The mandated cycle is Intent → Preview → Human confirmation → Commit → Settle.
 * This module makes skipping a step a type error, not a code-review opinion.
 */

import type { MethodProcessRole } from './session';

/**
 * Capability catalogue. Closed set, taken verbatim from
 * TERESA_ASSESSMENT_FACILITATION_PLAYBOOK.md §3 so that the runtime and the
 * playbook cannot drift apart.
 */
export const TERESA_CAPABILITIES = [
  // facilitation loop
  'explain_method_unit',
  'diagnose_candidate_level',
  'ask_next_best_question',
  'request_specific_evidence',
  'summarize_response_without_invention',
  'map_response_to_attributes',
  'detect_contradiction',
  'challenge_coverage_and_scale',
  'draft_score_proposal',
  'prepare_calibration_brief',
  'suggest_target_and_pathway',
  'draft_finding',
  'cluster_findings',
  'draft_initiative_proposals',
  'prepare_output_outline',
  // question help
  'explain_question_plainly',
  'explain_why_question_matters',
  'compare_adjacent_levels',
  'show_answer_examples',
  'identify_likely_respondent_role',
  'suggest_evidence_to_request',
  'rephrase_question_without_changing_intent',
  'resolve_i_dont_know',
] as const;

export type TeresaCapabilityId = (typeof TERESA_CAPABILITIES)[number];

/**
 * Capabilities Teresa may NEVER hold. Listed as data so a test can assert the
 * registry never grows one of them by accident.
 * Canon: TERESA_ASSESSMENT_FACILITATION_PLAYBOOK.md §5.
 */
export const TERESA_FORBIDDEN_EFFECTS = [
  'approve_score',
  'approve_target',
  'freeze_session',
  'publish_output',
  'register_initiative',
  'create_evidence',
  'change_method_definition',
] as const;

export type TeresaForbiddenEffect = (typeof TERESA_FORBIDDEN_EFFECTS)[number];

/** Step 1 — Intent. What the user (or a button) asked for. */
export interface TeresaIntent {
  readonly capabilityId: TeresaCapabilityId;
  readonly sessionId: string;
  readonly unitId?: string;
  readonly level?: number;
  readonly questionId?: string;
  /** Free text when the intent came from conversation rather than a button. */
  readonly utterance?: string;
  readonly invokedBy: 'conversation' | 'local_action';
  readonly actorUserId: string;
}

/**
 * Evidence-honesty classification. Teresa must label every claim; a declaration
 * may not be presented as a fact.
 * Canon: TERESA_ASSESSMENT_FACILITATION_PLAYBOOK.md §4.
 */
export type TeresaStatementKind =
  | 'confirmed_fact'
  | 'respondent_declaration'
  | 'interpretation'
  | 'missing_evidence'
  | 'proposal'
  | 'decision_required';

export interface TeresaStatement {
  readonly kind: TeresaStatementKind;
  readonly text: string;
  readonly sourceRefs: readonly string[];
}

/**
 * Step 2 — Preview. Produced BEFORE anything is written. Holds the exact diff
 * the user is being asked to accept.
 */
export interface TeresaPreview {
  readonly previewId: string;
  readonly intent: TeresaIntent;
  readonly statements: readonly TeresaStatement[];
  /** Precise description of what would change, for the diff view. */
  readonly proposedChanges: readonly TeresaProposedChange[];
  readonly quality: TeresaQualityVerdict;
  readonly createdAt: string;
  /** Previews expire so a stale proposal cannot be committed much later. */
  readonly expiresAt: string;
}

export interface TeresaProposedChange {
  readonly target: 'answer' | 'note' | 'evidence_request' | 'score_proposal' | 'finding' | 'initiative_draft';
  readonly targetId: string | null;
  readonly before: unknown;
  readonly after: unknown;
}

/**
 * Quality gate. A proposal that cannot name unit/level, attributes, supporting
 * and missing evidence, limitations and the next decision does not pass.
 * Canon: TERESA_ASSESSMENT_FACILITATION_PLAYBOOK.md §6.
 */
export interface TeresaQualityVerdict {
  readonly verdict: 'valid' | 'needs_human_review' | 'invalid';
  readonly failedChecks: readonly TeresaQualityCheck[];
}

export const TERESA_QUALITY_CHECKS = [
  'names_unit_and_level',
  'names_attributes',
  'lists_supporting_evidence',
  'lists_missing_evidence',
  'states_limitations',
  'states_next_decision',
  'no_unsupported_claim',
  'no_invented_number',
  'consistent_with_method_pack',
] as const;

export type TeresaQualityCheck = (typeof TERESA_QUALITY_CHECKS)[number];

/**
 * Step 3 — Commit. Requires the previewId, so a commit without a preview is
 * unrepresentable. The kernel additionally refuses a commit whose preview has
 * expired, was already consumed, or carries verdict `invalid`.
 */
export interface TeresaCommitRequest {
  readonly previewId: string;
  readonly decision: 'accept' | 'accept_with_edits' | 'reject' | 'rethink';
  /** Present only for `accept_with_edits`; replaces the proposed `after`. */
  readonly editedChanges?: readonly TeresaProposedChange[];
  readonly actorUserId: string;
  readonly idempotencyKey: string;
}

export type TeresaCommitResult =
  | { readonly ok: true; readonly eventIds: readonly string[] }
  | { readonly ok: false; readonly refusal: TeresaCommitRefusal };

export type TeresaCommitRefusal =
  | { readonly kind: 'preview_not_found' }
  | { readonly kind: 'preview_expired'; readonly expiredAt: string }
  | { readonly kind: 'preview_already_consumed' }
  | { readonly kind: 'quality_invalid'; readonly failedChecks: readonly TeresaQualityCheck[] }
  | { readonly kind: 'forbidden_effect'; readonly effect: TeresaForbiddenEffect }
  | { readonly kind: 'missing_permission'; readonly requiredRole: MethodProcessRole }
  | { readonly kind: 'session_frozen' };

/**
 * The single registry entry. Both the chat route and the button route resolve
 * to the SAME entry — that is what makes the anti-duplication rule enforceable.
 */
export interface TeresaCapabilityDefinition {
  readonly id: TeresaCapabilityId;
  readonly inputSchemaRef: string;
  readonly outputSchemaRef: string;
  readonly allowedSources: readonly ('method_pack' | 'session_answers' | 'evidence' | 'vault')[];
  /** Roles permitted to invoke. Teresa inherits the caller's permissions. */
  readonly allowedRoles: readonly MethodProcessRole[];
  readonly producesProposal: boolean;
  readonly requiredQualityChecks: readonly TeresaQualityCheck[];
}
