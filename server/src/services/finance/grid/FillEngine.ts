/**
 * AP-01 — FillEngine: fill down/right from a source pattern into a target
 * range, producing AP-00 `Operation` batches. Detects a numeric arithmetic
 * progression along the fill axis when possible; otherwise tiles (repeats)
 * the source pattern — the same two behaviors Excel's fill handle exhibits.
 *
 * Program: `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 * section 10 ("fill down/right"). ADR:
 * `docs/validation/finance-v3/generated/gate-d/AP-01_finance_data_grid_ADR.md`
 * section 5.
 *
 * OPERATION-TYPE CHOICE (a deliberate reuse of AP-00's `Operation` design
 * table, not a new rule): when the fill result is a SINGLE shared value
 * repeated to every target cell, this engine emits `'bulk_set'` (`Operation.ts`:
 * "write the SAME value to N cells") — cheaper for the executor to reason
 * about than N identical `'paste'` entries. When the fill result varies per
 * cell (a detected numeric series, or a tiled pattern with more than one
 * distinct source value), it emits `'paste'` (aligned per-cell values), the
 * same verb `PasteEngine` uses for the same reason ("write a DIFFERENT value
 * per cell").
 *
 * SERIES DETECTION SCOPE (task: "obsłuż progresję liczbową jeśli źródło to
 * seria, i proste kopiowanie"): only attempted when the source pattern is
 * ONE cell deep along the fill axis (a single row for a RIGHT fill, a single
 * column for a DOWN fill) with >= 2 numeric present (`PRESENT_ZERO`/
 * `PRESENT_NONZERO`) cells and a constant step between consecutive values.
 * A multi-row/multi-column source pattern (Excel's "fill a repeating 2-row
 * pattern downward") is tiled (copied cyclically), not analyzed for a
 * series — "proste kopiowanie" is the task's own stated fallback for that
 * case, and 2D series inference (e.g. detecting a diagonal or per-row trend)
 * is out of this package's scope.
 */

import { CellRefSchema } from '../../../types/finance/CellRef.js';
import type { CellRef } from '../../../types/finance/CellRef.js';
import { FinanceValueInputSchema } from '../../../types/finance/Operation.js';
import type { ApplyOperationsBatchRequest, FinanceValueInput } from '../../../types/finance/Operation.js';
import {
  type EngineError,
  type EngineMutationContext,
  checkCapability,
  engineError,
  resolveIdGenerator,
  resolveNow,
} from './engineContext.js';
import {
  MAX_CELLS_PER_OPERATION,
  chunkArray,
  iterateRect,
  isRectInBounds,
  rectCellCount,
  type GridAddressResolver,
  type GridRect,
} from './gridCoordinates.js';

export type FillDirection = 'DOWN' | 'RIGHT';

export interface FillSourceCell {
  value: FinanceValueInput;
}

export interface BuildFillOperationsParams extends EngineMutationContext {
  direction: FillDirection;
  /** Row-major source pattern. For a `DOWN` fill this is typically Nx1 (a single column); for a `RIGHT` fill typically 1xN — but any rectangle is accepted and tiled if it is not eligible for series detection (see file header). */
  source: readonly (readonly FillSourceCell[])[];
  sourceRect: GridRect;
  /** Must be adjacent to and axis-aligned with `sourceRect` in `direction` (e.g. `DOWN`: same `left`/`right`, `top === sourceRect.bottom + 1`). */
  targetRect: GridRect;
  resolver: GridAddressResolver;
}

export interface FillEngineSuccess {
  ok: true;
  batches: ApplyOperationsBatchRequest[];
  totalCells: number;
  /** Diagnostic: which strategy this fill actually used, for the future UI to show ("filled as series +12/mo" vs "copied"). */
  strategy: 'NUMERIC_SERIES' | 'TILE_UNIFORM' | 'TILE_PATTERN';
}

export type FillEngineResult = FillEngineSuccess | EngineError;

function isNumericPresent(value: FinanceValueInput): value is FinanceValueInput & { valueDecimal: string } {
  return (value.status === 'PRESENT_NONZERO' || value.status === 'PRESENT_ZERO') && value.valueDecimal !== null;
}

/** Detects a constant-step arithmetic series along a 1-D sequence of source values. Returns the step, or `null` if fewer than 2 numeric values or the step is not constant (within a relative float epsilon — these are decimal strings from a UI copy, not guaranteed exact binary floats). */
function detectConstantStep(values: readonly FinanceValueInput[]): number | null {
  if (values.length < 2 || !values.every(isNumericPresent)) return null;
  const nums = values.map((v) => Number(v.valueDecimal));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const step = nums[1]! - nums[0]!;
  const EPSILON = 1e-9;
  for (let i = 2; i < nums.length; i++) {
    if (Math.abs(nums[i]! - nums[i - 1]! - step) > EPSILON * Math.max(1, Math.abs(step))) return null;
  }
  return step;
}

function withNewDecimal(source: FinanceValueInput, decimal: number): FinanceValueInput {
  return { ...source, status: decimal === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO', valueDecimal: String(decimal) };
}

function isAdjacentAligned(direction: FillDirection, source: GridRect, target: GridRect): boolean {
  if (direction === 'DOWN') {
    return target.left === source.left && target.right === source.right && target.top === source.bottom + 1;
  }
  return target.top === source.top && target.bottom === source.bottom && target.left === source.right + 1;
}

export function buildFillOperations(params: BuildFillOperationsParams): FillEngineResult {
  const capabilityError = checkCapability(params);
  if (capabilityError) return capabilityError;

  if (rectCellCount(params.sourceRect) === 0 || params.source.length === 0 || params.source[0]!.length === 0) {
    return engineError('EMPTY_INPUT', 'Fill source is empty.');
  }
  if (rectCellCount(params.targetRect) === 0) {
    return engineError('EMPTY_INPUT', 'Fill target range is empty.');
  }
  if (!isRectInBounds(params.targetRect, params.resolver)) {
    return engineError('OUT_OF_BOUNDS', `Fill target rect exceeds grid bounds (${params.resolver.rowCount}x${params.resolver.colCount}).`);
  }
  if (!isAdjacentAligned(params.direction, params.sourceRect, params.targetRect)) {
    return engineError(
      'SHAPE_MISMATCH',
      `Fill target rect must be adjacent to and axis-aligned with the source rect for direction '${params.direction}'.`
    );
  }

  const sourceHeight = params.source.length;
  const sourceWidth = params.source[0]!.length;
  const flatSource: FinanceValueInput[] = [];
  const parseIssues: NonNullable<EngineError['issues']>[number][] = [];
  for (let r = 0; r < sourceHeight; r++) {
    for (let c = 0; c < sourceWidth; c++) {
      const cell = params.source[r]?.[c];
      if (!cell) {
        parseIssues.push({ path: [`source[${r}][${c}]`], message: 'source rect is ragged (missing cell)' });
        continue;
      }
      const parsed = FinanceValueInputSchema.safeParse(cell.value);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          parseIssues.push({ path: [`source[${r}][${c}]`, ...issue.path.map(String)], message: issue.message });
        }
        continue;
      }
      flatSource.push(parsed.data);
    }
  }
  if (parseIssues.length > 0) {
    return engineError('VALIDATION_FAILED', `${parseIssues.length} fill source cell(s) failed validation.`, parseIssues);
  }

  // 1-D series detection only when the source pattern is a single cell deep
  // along the fill axis (see file header).
  const isSingleAxis = params.direction === 'DOWN' ? sourceWidth === 1 : sourceHeight === 1;
  const step = isSingleAxis ? detectConstantStep(flatSource) : null;

  const targetCoords = [...iterateRect(params.targetRect)];
  const distinctValues = new Set(flatSource.map((v) => `${v.status}|${v.valueDecimal}`));

  let strategy: FillEngineSuccess['strategy'];
  let resolvedValues: FinanceValueInput[];

  if (step !== null) {
    strategy = 'NUMERIC_SERIES';
    const lastSourceNumber = Number(flatSource[flatSource.length - 1]!.valueDecimal);
    resolvedValues = targetCoords.map((_, i) => withNewDecimal(flatSource[flatSource.length - 1]!, lastSourceNumber + step * (i + 1)));
  } else if (distinctValues.size === 1) {
    strategy = 'TILE_UNIFORM';
    resolvedValues = targetCoords.map(() => flatSource[0]!);
  } else {
    strategy = 'TILE_PATTERN';
    resolvedValues = targetCoords.map((_, i) => flatSource[i % flatSource.length]!);
  }

  const now = resolveNow(params);
  const generateId = resolveIdGenerator(params);
  const targetRefs: CellRef[] = [];
  for (const coord of targetCoords) {
    const parsedRef = CellRefSchema.safeParse(params.resolver.cellRefAt(coord));
    if (!parsedRef.success) {
      return engineError('VALIDATION_FAILED', `resolver.cellRefAt returned an invalid CellRef for coordinate ${JSON.stringify(coord)}.`);
    }
    targetRefs.push(parsedRef.data);
  }

  let batches: ApplyOperationsBatchRequest[];

  if (strategy === 'TILE_UNIFORM') {
    const chunks = chunkArray(targetRefs, MAX_CELLS_PER_OPERATION);
    batches = chunks.map((targets) => ({
      organizationId: params.organizationId,
      artifactId: params.artifactId,
      businessVersionId: params.businessVersionId,
      expectedWorkingRevisionId: params.expectedWorkingRevisionId,
      batchIdempotencyKey: generateId(),
      operations: [
        {
          type: 'bulk_set',
          operationId: generateId(),
          idempotencyKey: generateId(),
          actorId: params.actorId,
          actorRole: params.actorRole,
          clientTimestamp: now(),
          sourceWorkingRevisionId: params.sourceWorkingRevisionId,
          target: targets,
          value: resolvedValues[0]!,
        },
      ],
    }));
  } else {
    const targetChunks = chunkArray(targetRefs, MAX_CELLS_PER_OPERATION);
    const valueChunks = chunkArray(resolvedValues, MAX_CELLS_PER_OPERATION);
    batches = targetChunks.map((targets, i) => ({
      organizationId: params.organizationId,
      artifactId: params.artifactId,
      businessVersionId: params.businessVersionId,
      expectedWorkingRevisionId: params.expectedWorkingRevisionId,
      batchIdempotencyKey: generateId(),
      operations: [
        {
          type: 'paste',
          operationId: generateId(),
          idempotencyKey: generateId(),
          actorId: params.actorId,
          actorRole: params.actorRole,
          clientTimestamp: now(),
          sourceWorkingRevisionId: params.sourceWorkingRevisionId,
          target: targets,
          values: valueChunks[i]!,
        },
      ],
    }));
  }

  return { ok: true, batches, totalCells: targetRefs.length, strategy };
}
