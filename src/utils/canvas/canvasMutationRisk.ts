/**
 * Canvas mutation risk policy — safety gate for AI/Teresa-driven Canvas edits.
 *
 * Teresa is meant to STEER the side panel (create/append/patch the document),
 * but autonomous edits must be bounded: small, local changes can auto-apply,
 * while whole-document rewrites or large insertions need human approval.
 * This module classifies an edit operation by risk and resolves the policy
 * (auto-apply vs requires-approval) per actor.
 *
 * Spec/contract: tests/unit/canvas/canvasMutationRisk.test.ts
 * Wiring target (follow-up): useCanvasAIStream → applyPatchOperations gate.
 */

export type CanvasMutationRisk = 'low' | 'medium' | 'high';

export type CanvasMutationActor = 'teresa' | 'user';

/** Surgical replacement of a user-selected span. */
export interface ReplaceSelectionOp {
  type: 'replace_selection';
  selectedText?: string;
  replacementMd: string;
}

/** Full-document overwrite (highest blast radius). */
export interface UpdateDocumentOp {
  type: 'update_document';
  contentMd: string;
}

/** Insertion of a new Canvas element (table/text/callout/...). */
export interface InsertElementOp {
  type: 'insert_element';
  elementKind: string;
  contentMd: string;
}

export type CanvasMutationOperation = ReplaceSelectionOp | UpdateDocumentOp | InsertElementOp;

export interface CanvasMutationPolicyResult {
  risk: CanvasMutationRisk;
  requiresApproval: boolean;
  canAutoApply: boolean;
}

// Character thresholds for sizing a change. Kept conservative: a paragraph-ish
// edit stays low; a multi-paragraph block is medium; anything larger is high.
const LOW_MAX_CHARS = 280;
const MEDIUM_MAX_CHARS = 1500;

const sizeRisk = (chars: number): CanvasMutationRisk => {
  if (chars <= LOW_MAX_CHARS) return 'low';
  if (chars <= MEDIUM_MAX_CHARS) return 'medium';
  return 'high';
};

/**
 * Classify a single Canvas mutation by blast radius.
 * - update_document → always `high` (replaces the whole document)
 * - replace_selection / insert_element → sized by content length
 */
export function classifyCanvasMutationRisk(operation: CanvasMutationOperation): CanvasMutationRisk {
  switch (operation.type) {
    case 'update_document':
      return 'high';
    case 'replace_selection':
      return sizeRisk((operation.replacementMd || '').length);
    case 'insert_element':
      return sizeRisk((operation.contentMd || '').length);
    default:
      // Unknown operation shape → treat as medium (needs a human look).
      return 'medium';
  }
}

/**
 * Resolve the apply policy for an operation given the actor.
 * - `teresa` (autopilot): may auto-apply ONLY low-risk edits; medium/high need approval.
 * - `user` (assisted): always routed through approval — the user reviews before apply.
 */
export function canvasMutationPolicy(
  actor: CanvasMutationActor,
  operation: CanvasMutationOperation
): CanvasMutationPolicyResult {
  const risk = classifyCanvasMutationRisk(operation);
  const canAutoApply = actor === 'teresa' && risk === 'low';
  return {
    risk,
    requiresApproval: !canAutoApply,
    canAutoApply,
  };
}
