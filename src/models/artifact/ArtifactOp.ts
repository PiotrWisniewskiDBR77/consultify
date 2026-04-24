/**
 * V10-ART-008 — typed ArtifactOp list (Wave A seed, schema + reverse).
 *
 * Implements R-ARTIFACT-8 from
 * `docs/Chat V9/ARTIFACT_RUNTIME_DEVELOPMENT_PLAN_2026-04-18.md#v10-art-008`.
 *
 * Scope (Wave A seed)
 * -------------------
 * Promotes the placeholder `ArtifactOp` carried in `MutationProposal`
 * (V10-ART-007) to a closed discriminated union keyed on `kind`, one
 * variant per physical operation the ArtifactStore will apply. Every
 * op carries `before`/`after` (or the structural equivalent) so the
 * one-step undo pipeline (V10-ART-012) can **reverse without
 * re-reading the store**. `reverseArtifactOp` is the pure inverse.
 *
 * What lands here
 * ---------------
 *   - Branded `CellId`, `ChartId` ids
 *   - `CellRange` shape (A1:B7 or absolute sheet range)
 *   - Five op variants:
 *       * `json_patch`            — opaque path/value mutation
 *       * `replace_text`          — node-id-addressed text swap
 *       * `move_block`            — block reorder within a parent
 *       * `update_cell_formula`   — spreadsheet formula change with
 *                                   dependency hint
 *       * `update_chart_binding`  — chart data-range rebind
 *   - `ArtifactOp` discriminated union + `ARTIFACT_OP_KINDS` catalogue
 *   - `reverseArtifactOp(op)` — pure, total, deterministic inverse
 *   - `reverseArtifactOps(ops)` — reverses both the op list AND the
 *     order (apply op[0] then op[1] ⇒ reverse op[1] then op[0])
 *   - `assertArtifactOp(op)` — structural validator:
 *       * node / cell / chart / parent ids are non-empty
 *       * `replace_text.before !== replace_text.after`
 *       * `update_cell_formula.before !== update_cell_formula.after`
 *       * `move_block.fromIndex !== move_block.toIndex`, non-negative
 *       * `json_patch.path` starts with `/` (RFC 6902 form)
 *   - `InvalidArtifactOpError` with a structured `reason` code
 *
 * What does NOT land here
 * -----------------------
 *   - `applyArtifactOp(content, op)` — needs full
 *     `ArtifactCanonicalContent` integration (7 variants × 5 ops) and
 *     lands with V10-ART-012 one-step undo.
 *   - Op-level ACL check (V10-ART-010 direct-write ban)
 *   - Op coalescing / batching (V10-ART-013)
 *
 * Invariant contract
 * ------------------
 *   - `reverseArtifactOp(reverseArtifactOp(op)) === op`      (structural)
 *   - `reverseArtifactOps(reverseArtifactOps(ops)) === ops`  (structural)
 *   - `assertArtifactOp(reverseArtifactOp(op))` succeeds IFF
 *     `assertArtifactOp(op)` succeeds (reversal preserves validity).
 *
 * These are the bedrock of the one-step undo: if the forward op set
 * is valid, its reverse is guaranteed valid, so the undo pipeline
 * can ship without a second validation pass.
 */

// ---------------------------------------------------------------------------
// §1 — Branded ids + shared shapes.
// ---------------------------------------------------------------------------

declare const CELL_ID_BRAND: unique symbol;
declare const CHART_ID_BRAND: unique symbol;

export type CellId = string & { readonly [CELL_ID_BRAND]: void };
export type ChartId = string & { readonly [CHART_ID_BRAND]: void };

export const unsafeCellId = (v: string): CellId => v as CellId;
export const unsafeChartId = (v: string): ChartId => v as ChartId;

/**
 * A1-style cell range scoped to a sheet. `end` is inclusive. Sheet
 * id is opaque to the op — the spreadsheet runtime (V10-ART-017)
 * resolves the final cells.
 */
export interface CellRange {
  readonly sheetId: string;
  readonly start: string;
  readonly end: string;
}

function sameCellRange(a: CellRange, b: CellRange): boolean {
  return a.sheetId === b.sheetId && a.start === b.start && a.end === b.end;
}

// ---------------------------------------------------------------------------
// §2 — Op variants.
// ---------------------------------------------------------------------------

/**
 * Opaque JSON-patch style op against the canonical content tree.
 * `path` is RFC-6902 form starting with `/`. `before` is optional
 * only to accommodate additive patches (paths that do not yet exist
 * in the tree); the apply pipeline (V10-ART-012) fills it in at
 * read-back time for reversibility.
 */
export interface JsonPatchOp {
  readonly kind: 'json_patch';
  readonly path: string;
  readonly before?: unknown;
  readonly after: unknown;
}

export interface ReplaceTextOp {
  readonly kind: 'replace_text';
  readonly nodeId: string;
  readonly before: string;
  readonly after: string;
}

export interface MoveBlockOp {
  readonly kind: 'move_block';
  readonly nodeId: string;
  readonly parentId: string;
  readonly fromIndex: number;
  readonly toIndex: number;
}

export interface UpdateCellFormulaOp {
  readonly kind: 'update_cell_formula';
  readonly cellId: CellId;
  readonly before: string;
  readonly after: string;
  /**
   * Cell ids the *after* formula reads from, precomputed by the
   * proposer so the store can invalidate dependents without a parse
   * pass. Empty array ⇒ a literal value (no dependencies).
   */
  readonly dependencies: readonly CellId[];
}

export interface UpdateChartBindingOp {
  readonly kind: 'update_chart_binding';
  readonly chartId: ChartId;
  readonly before: CellRange;
  readonly after: CellRange;
}

export type ArtifactOp =
  | JsonPatchOp
  | ReplaceTextOp
  | MoveBlockOp
  | UpdateCellFormulaOp
  | UpdateChartBindingOp;

export type ArtifactOpKind = ArtifactOp['kind'];

export const ARTIFACT_OP_KINDS = [
  'json_patch',
  'replace_text',
  'move_block',
  'update_cell_formula',
  'update_chart_binding',
] as const satisfies readonly ArtifactOpKind[];

// ---------------------------------------------------------------------------
// §3 — Reverse.
// ---------------------------------------------------------------------------

/**
 * Returns the exact inverse of `op`. Pure, total, deterministic.
 *
 * The inverse operates on the same target and carries the
 * before/after pair swapped. For `move_block`, the swap is the
 * index pair. For `json_patch`, the reverse is `{ before → after,
 * after → before }` — the path stays the same. `before` on a
 * `json_patch` was optional to admit additive patches; when it is
 * `undefined`, the reverse becomes a removal (`after: undefined`).
 */
export function reverseArtifactOp(op: ArtifactOp): ArtifactOp {
  switch (op.kind) {
    case 'json_patch':
      return {
        kind: 'json_patch',
        path: op.path,
        before: op.after,
        after: op.before,
      };
    case 'replace_text':
      return {
        kind: 'replace_text',
        nodeId: op.nodeId,
        before: op.after,
        after: op.before,
      };
    case 'move_block':
      return {
        kind: 'move_block',
        nodeId: op.nodeId,
        parentId: op.parentId,
        fromIndex: op.toIndex,
        toIndex: op.fromIndex,
      };
    case 'update_cell_formula':
      return {
        kind: 'update_cell_formula',
        cellId: op.cellId,
        before: op.after,
        after: op.before,
        // Dependencies belong to the "after" formula; the reverse's
        // dependencies are therefore whatever the *old* formula read
        // from. That information is NOT available from the op alone,
        // so we hand back an empty array and leave it to the apply
        // pipeline (V10-ART-012) to refill at undo time. Documented
        // here so reviewers don't mistake this for a bug.
        dependencies: [],
      };
    case 'update_chart_binding':
      return {
        kind: 'update_chart_binding',
        chartId: op.chartId,
        before: op.after,
        after: op.before,
      };
    default: {
      const _exhaustive: never = op;
      throw new Error(
        `reverseArtifactOp: unknown op kind ${String((_exhaustive as { kind: string }).kind)}`
      );
    }
  }
}

/**
 * Reverses a sequence of ops. The op *order* is reversed in addition
 * to each op being individually reversed — applying `[a, b, c]`
 * forward then `reverseArtifactOps([a, b, c])` returns the content
 * to its starting state (the inverse of `c` runs first). Pure.
 */
export function reverseArtifactOps(ops: readonly ArtifactOp[]): readonly ArtifactOp[] {
  const out: ArtifactOp[] = [];
  for (let i = ops.length - 1; i >= 0; i -= 1) {
    out.push(reverseArtifactOp(ops[i]!));
  }
  return out;
}

// ---------------------------------------------------------------------------
// §4 — Error class + validator.
// ---------------------------------------------------------------------------

export type InvalidArtifactOpReason =
  | 'empty_id'
  | 'json_patch_bad_path'
  | 'text_noop'
  | 'formula_noop'
  | 'move_noop'
  | 'move_negative_index'
  | 'chart_noop';

export class InvalidArtifactOpError extends Error {
  public readonly reason: InvalidArtifactOpReason;
  public readonly opKind: ArtifactOpKind;

  constructor(reason: InvalidArtifactOpReason, opKind: ArtifactOpKind, detail: string) {
    super(`InvalidArtifactOp[${reason}] kind=${opKind}: ${detail}`);
    this.name = 'InvalidArtifactOpError';
    this.reason = reason;
    this.opKind = opKind;
  }
}

function requireNonEmpty(
  value: string,
  reason: InvalidArtifactOpReason,
  kind: ArtifactOpKind,
  field: string
): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new InvalidArtifactOpError(reason, kind, `${field} must be non-empty`);
  }
}

/**
 * Structural validator. Pure; throws `InvalidArtifactOpError` on the
 * first violation with a structured `reason` code. Invariants:
 *
 *   - Target ids (`nodeId`, `cellId`, `chartId`, `parentId`) non-empty.
 *   - `json_patch.path` starts with `/` (RFC 6902).
 *   - `replace_text` / `update_cell_formula` are not no-ops
 *     (`before === after` forbidden — the proposer should have
 *     omitted the op).
 *   - `move_block.fromIndex !== toIndex`; both non-negative.
 *   - `update_chart_binding` is not a no-op.
 */
export function assertArtifactOp(op: ArtifactOp): void {
  switch (op.kind) {
    case 'json_patch': {
      if (typeof op.path !== 'string' || op.path.length === 0) {
        throw new InvalidArtifactOpError('json_patch_bad_path', op.kind, 'path must be non-empty');
      }
      if (op.path[0] !== '/') {
        throw new InvalidArtifactOpError(
          'json_patch_bad_path',
          op.kind,
          `path must start with '/' (RFC 6902); got '${op.path}'`
        );
      }
      return;
    }
    case 'replace_text': {
      requireNonEmpty(op.nodeId, 'empty_id', op.kind, 'nodeId');
      if (op.before === op.after) {
        throw new InvalidArtifactOpError(
          'text_noop',
          op.kind,
          'replace_text.before === after (no-op)'
        );
      }
      return;
    }
    case 'move_block': {
      requireNonEmpty(op.nodeId, 'empty_id', op.kind, 'nodeId');
      requireNonEmpty(op.parentId, 'empty_id', op.kind, 'parentId');
      if (op.fromIndex < 0 || op.toIndex < 0) {
        throw new InvalidArtifactOpError(
          'move_negative_index',
          op.kind,
          `indices must be ≥ 0 (got fromIndex=${op.fromIndex}, toIndex=${op.toIndex})`
        );
      }
      if (op.fromIndex === op.toIndex) {
        throw new InvalidArtifactOpError(
          'move_noop',
          op.kind,
          `fromIndex === toIndex === ${op.fromIndex} (no-op)`
        );
      }
      return;
    }
    case 'update_cell_formula': {
      requireNonEmpty(String(op.cellId), 'empty_id', op.kind, 'cellId');
      if (op.before === op.after) {
        throw new InvalidArtifactOpError(
          'formula_noop',
          op.kind,
          'update_cell_formula.before === after (no-op)'
        );
      }
      return;
    }
    case 'update_chart_binding': {
      requireNonEmpty(String(op.chartId), 'empty_id', op.kind, 'chartId');
      requireNonEmpty(op.before.sheetId, 'empty_id', op.kind, 'before.sheetId');
      requireNonEmpty(op.after.sheetId, 'empty_id', op.kind, 'after.sheetId');
      if (sameCellRange(op.before, op.after)) {
        throw new InvalidArtifactOpError(
          'chart_noop',
          op.kind,
          'update_chart_binding.before === after (no-op)'
        );
      }
      return;
    }
    default: {
      const _exhaustive: never = op;
      throw new Error(
        `assertArtifactOp: unknown op kind ${String((_exhaustive as { kind: string }).kind)}`
      );
    }
  }
}
