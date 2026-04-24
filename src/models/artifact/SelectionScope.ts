/**
 * V10-ART-014 — selection-aware mutations (Wave A seed).
 *
 * Implements R-ARTIFACT-14 from
 * `docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md#v10-art-014`.
 *
 * Scope (Wave A seed · schema-only)
 * ---------------------------------
 * The editor exposes the current selection (cursor focus, single
 * node, multi-node range) via a `SelectionContext` hook. Chat
 * commands are translated into an op list scoped by that selection.
 *
 * Dev-plan acceptance criteria pinned at runtime here:
 *   - "Selection-scoped commands produce ops only within the
 *     selection." ⇒ `resolveOpScope` returns a `scoped_to_selection`
 *     verdict whose `nodeIds` is a non-empty subset of the
 *     selection's node ids (filtered by `assertOpsWithinSelection`
 *     at the applier ingress).
 *   - "Ambiguous commands (`this bullet`) without selection are
 *     rejected with a clarification prompt." ⇒ `resolveOpScope`
 *     returns a `rejected` verdict with `ambiguous_demonstrative` +
 *     the lexeme that triggered the rejection (so the reasoning
 *     layer can synthesise the clarification prompt).
 *
 * Wave A seed lands:
 *   - `SelectionScopeKind` closed tuple (`empty`, `nodes`,
 *     `range`).
 *   - `SelectionContext` envelope carrying the selection shape +
 *     the anchor `artifactId`.
 *   - `DEMONSTRATIVE_PRONOUNS` closed catalogue of lexemes that
 *     MUST be resolvable against a non-empty selection.
 *   - `resolveOpScope(command, selection)` — pure dispatcher
 *     returning a `ScopeVerdict` union (`scoped_to_selection`,
 *     `whole_artifact`, `rejected`).
 *   - `assertOpsWithinSelection(ops, selection)` — applier-ingress
 *     guard enforcing the "ops only within the selection" criterion
 *     by checking every op whose `nodeId` is defined is in the
 *     selection's node-id set.
 */

import type { ArtifactId } from './Artifact';
import type { ArtifactOp } from './ArtifactOp';

// ---------------------------------------------------------------------------
// §1 — Selection shape.
// ---------------------------------------------------------------------------

export const SELECTION_SCOPE_KINDS = ['empty', 'nodes', 'range'] as const;

export type SelectionScopeKind = (typeof SELECTION_SCOPE_KINDS)[number];

export interface EmptySelection {
  readonly kind: 'empty';
}

export interface NodesSelection {
  readonly kind: 'nodes';
  readonly nodeIds: readonly string[];
}

export interface RangeSelection {
  readonly kind: 'range';
  readonly nodeIds: readonly string[];
  readonly startNodeId: string;
  readonly endNodeId: string;
}

export type SelectionScope = EmptySelection | NodesSelection | RangeSelection;

export interface SelectionContext {
  readonly artifactId: ArtifactId;
  readonly selection: SelectionScope;
}

// ---------------------------------------------------------------------------
// §2 — Demonstrative-pronoun catalogue (PL + EN).
// ---------------------------------------------------------------------------

/**
 * Closed catalogue of lexemes whose semantics require a non-empty
 * selection. The reasoning layer tokenises the command, lowercases,
 * and checks membership — a single hit is enough to classify the
 * command as ambiguous-without-selection.
 */
export const DEMONSTRATIVE_PRONOUNS = [
  // English
  'this',
  'these',
  'that',
  'those',
  'here',
  'selected',
  // Polish (R-ONBOARD-4 persona set)
  'ten',
  'ta',
  'to',
  'te',
  'ci',
  'tamto',
  'tutaj',
  'zaznaczone',
] as const;

export type DemonstrativePronoun = (typeof DEMONSTRATIVE_PRONOUNS)[number];

const DEMONSTRATIVE_SET: ReadonlySet<string> = new Set(DEMONSTRATIVE_PRONOUNS);

/**
 * Returns the first demonstrative lexeme present in `command`, or
 * `null` when the command is unambiguous-without-context. Pure; used
 * by the scope resolver and by reasoning-layer command parsers.
 */
export function findDemonstrativeLexeme(command: string): DemonstrativePronoun | null {
  const tokens = command
    .toLowerCase()
    .split(/[^\p{L}\p{N}_]+/u)
    .filter((t) => t.length > 0);
  for (const t of tokens) {
    if (DEMONSTRATIVE_SET.has(t)) return t as DemonstrativePronoun;
  }
  return null;
}

// ---------------------------------------------------------------------------
// §3 — Scope-verdict union.
// ---------------------------------------------------------------------------

export const SCOPE_VERDICT_KINDS = ['scoped_to_selection', 'whole_artifact', 'rejected'] as const;

export type ScopeVerdictKind = (typeof SCOPE_VERDICT_KINDS)[number];

export type ScopeRejectionReason =
  | 'ambiguous_demonstrative_without_selection'
  | 'empty_command'
  | 'range_missing_endpoints';

export interface ScopedToSelection {
  readonly kind: 'scoped_to_selection';
  readonly nodeIds: readonly string[];
}

export interface WholeArtifactScope {
  readonly kind: 'whole_artifact';
}

export interface RejectedScope {
  readonly kind: 'rejected';
  readonly reason: ScopeRejectionReason;
  readonly triggeringLexeme: DemonstrativePronoun | null;
  /**
   * Human-readable clarification seed the reasoning layer may hand
   * to the prompt synthesizer (e.g. "Which bullet do you mean?"). The
   * schema-only seed ships a deterministic default; the prompt
   * writer may localise.
   */
  readonly clarificationSeed: string;
}

export type ScopeVerdict = ScopedToSelection | WholeArtifactScope | RejectedScope;

// ---------------------------------------------------------------------------
// §4 — Resolver.
// ---------------------------------------------------------------------------

/**
 * Pure dispatcher:
 *   - empty / blank command                  ⇒ rejected(empty_command).
 *   - range selection w/o endpoints          ⇒ rejected(range_missing_endpoints).
 *   - command contains demonstrative         ⇒
 *       selection non-empty ⇒ scoped_to_selection(nodeIds).
 *       selection empty    ⇒ rejected(ambiguous_demonstrative_without_selection,
 *                                     triggeringLexeme).
 *   - command lacks demonstrative            ⇒
 *       selection non-empty ⇒ scoped_to_selection(nodeIds).
 *       selection empty    ⇒ whole_artifact.
 */
export function resolveOpScope(command: string, selection: SelectionScope): ScopeVerdict {
  if (command.trim().length === 0) {
    return {
      kind: 'rejected',
      reason: 'empty_command',
      triggeringLexeme: null,
      clarificationSeed: 'Please restate your request.',
    };
  }

  if (selection.kind === 'range') {
    if (selection.startNodeId.length === 0 || selection.endNodeId.length === 0) {
      return {
        kind: 'rejected',
        reason: 'range_missing_endpoints',
        triggeringLexeme: null,
        clarificationSeed: 'Range selection is incomplete; please reselect or click a single node.',
      };
    }
  }

  const lexeme = findDemonstrativeLexeme(command);
  const nodeIds = selection.kind === 'empty' ? [] : selection.nodeIds;
  const selectionEmpty = nodeIds.length === 0;

  if (lexeme) {
    if (selectionEmpty) {
      return {
        kind: 'rejected',
        reason: 'ambiguous_demonstrative_without_selection',
        triggeringLexeme: lexeme,
        clarificationSeed: `You used "${lexeme}" but nothing is selected — please click the node you mean.`,
      };
    }
    return { kind: 'scoped_to_selection', nodeIds };
  }

  if (selectionEmpty) {
    return { kind: 'whole_artifact' };
  }
  return { kind: 'scoped_to_selection', nodeIds };
}

// ---------------------------------------------------------------------------
// §5 — Applier-ingress guard.
// ---------------------------------------------------------------------------

export type InvalidSelectionScopeReason =
  | 'op_node_outside_selection'
  | 'empty_selection_for_scoped_ops';

export class InvalidSelectionScopeError extends Error {
  readonly reason: InvalidSelectionScopeReason;
  readonly offendingNodeId: string | null;

  constructor(params: {
    reason: InvalidSelectionScopeReason;
    offendingNodeId?: string | null;
    message?: string;
  }) {
    super(
      params.message ??
        `Invalid selection-scope: ${params.reason}${
          params.offendingNodeId ? ` (nodeId=${params.offendingNodeId})` : ''
        }`
    );
    this.name = 'InvalidSelectionScopeError';
    this.reason = params.reason;
    this.offendingNodeId = params.offendingNodeId ?? null;
  }
}

/**
 * Extracts the nodeId an op mutates, when the op kind carries one.
 * Returns `null` for ops that address the artifact tree by JSON path
 * (`json_patch`) or cells / charts (spreadsheet / chart ops) — those
 * are out of scope for the selection-nodes rule and fall through the
 * applier's generic guards.
 */
function nodeIdForOp(op: ArtifactOp): string | null {
  switch (op.kind) {
    case 'replace_text':
    case 'move_block':
      return op.nodeId;
    case 'json_patch':
    case 'update_cell_formula':
    case 'update_chart_binding':
      return null;
    default: {
      const _exhaustive: never = op;
      return _exhaustive;
    }
  }
}

/**
 * Enforces "ops only within the selection" at the applier ingress.
 * Called with the op list plus the same `SelectionScope` the resolver
 * consumed. `whole_artifact` scopes skip this guard at the call site
 * (the applier branches on `ScopeVerdict.kind`).
 */
export function assertOpsWithinSelection(
  ops: readonly ArtifactOp[],
  selection: SelectionScope
): void {
  const nodeIds = selection.kind === 'empty' ? [] : selection.nodeIds;
  if (nodeIds.length === 0) {
    throw new InvalidSelectionScopeError({
      reason: 'empty_selection_for_scoped_ops',
    });
  }
  const allowed = new Set(nodeIds);
  for (const op of ops) {
    const nodeId = nodeIdForOp(op);
    if (nodeId === null) continue;
    if (!allowed.has(nodeId)) {
      throw new InvalidSelectionScopeError({
        reason: 'op_node_outside_selection',
        offendingNodeId: nodeId,
      });
    }
  }
}
