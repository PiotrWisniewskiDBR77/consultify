/**
 * AP-01 — PasteEngine: rectangular paste from a copied source block onto a
 * target anchor, producing AP-00 `Operation` batches.
 *
 * Program: `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 * section 10 ("rectangular paste", "paste special", "1000-cell paste jako
 * jedna transakcja"). ADR:
 * `docs/validation/finance-v3/generated/gate-d/AP-01_finance_data_grid_ADR.md`
 * section 4 (batch-size decision), section 6 (paste-special decision).
 *
 * OPERATION-TYPE CHOICE: emits AP-00's `'paste'` verb (target[]/values[]
 * aligned by index), not N `'set'` operations — `Operation.ts`'s own doc
 * comment defines `'paste'` as exactly "write a DIFFERENT value per cell
 * (rectangular paste)", so using it is following the existing contract, not
 * inventing a convention.
 *
 * 1000-CELL CHUNKING (task scope item 7 — "dokumentuj który wariant"):
 * DECISION = split into multiple sequential batches, each internally atomic,
 * NOT reject with an error. Rationale: `Operation.ts` section 6.4 already
 * states the contract's own position — "A caller (AP-01) needing to paste
 * more than 1000 cells must chunk into multiple batches; this contract does
 * not attempt cross-batch atomicity for that case (out of scope)." Rejecting
 * outright would make a >1000-cell Excel paste (a completely normal analyst
 * action against a 10k x 120 grid) simply fail with no path forward, which
 * contradicts the master plan's own product goal ("Excel round-trip");
 * splitting keeps the action possible at the cost of losing whole-paste
 * atomicity above 1000 cells, a cost the AP-00 contract already accepted
 * when it fixed the per-batch cap at exactly 1000. This package does not
 * implement cross-chunk rollback/compensation (undoing already-applied
 * chunks after a later chunk fails) — flagged as an AP-04 (Undo) concern in
 * the ADR, since AP-04 owns the undo stack this package's `Operation` entries
 * feed into.
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
  isRectInBounds,
  type GridAddressResolver,
  type GridCoordinate,
  type GridRect,
} from './gridCoordinates.js';

/**
 * Paste-special modes (task scope: "values-only/formulas-only/formats-only").
 * IMPORTANT CONTRACT GAP, resolved here as a documented judgment call: AP-00's
 * `FinanceValue`/`FinanceValueInput` (server/src/types/finance/
 * financeValueSemantics.ts, Operation.ts) has NO formula field and NO format/
 * style field at all — only status/valueDecimal/currency/unit/multiplier/
 * sourceRef/isAdjustment/adjustmentReason. There is therefore nothing for a
 * "formulas-only" or "formats-only" paste to write today. Two ways to close
 * this gap were available: (a) silently treat every mode identically to
 * `VALUES_ONLY`, which would make a UI's "Paste Special > Formats Only"
 * button silently paste values too — a correctness trap; or (b) make the
 * unsupported modes fail loudly with a distinct error code that names the
 * gap. This engine takes (b): `FORMULAS_ONLY`/`FORMATS_ONLY` always return
 * `UNSUPPORTED_MODE`. When AP-00's `FinanceValue` gains formula/format
 * fields (flagged as an open question for a future ADR, not decided here),
 * this engine's two extra branches become real implementations instead of
 * error returns — the mode enum already anticipates them.
 */
export type PasteMode = 'ALL' | 'VALUES_ONLY' | 'FORMULAS_ONLY' | 'FORMATS_ONLY';

export interface PasteSourceCell {
  value: FinanceValueInput;
}

export interface BuildPasteOperationsParams extends EngineMutationContext {
  mode: PasteMode;
  /** Where the paste lands — top-left of the target rectangle. */
  anchor: GridCoordinate;
  /** Row-major rectangular block, e.g. copied from a 3x2 source selection: `source.length === 3`, `source[0].length === 2`. */
  source: readonly (readonly PasteSourceCell[])[];
  resolver: GridAddressResolver;
}

export interface PasteEngineSuccess {
  ok: true;
  /** One or more atomic batches, to be submitted to the executor IN ORDER. Each batch is independently atomic; the whole paste is atomic only when `batches.length === 1` (source cell count <= 1000) — see file header. */
  batches: ApplyOperationsBatchRequest[];
  totalCells: number;
}

export type PasteEngineResult = PasteEngineSuccess | EngineError;

function targetRectForSource(anchor: GridCoordinate, source: BuildPasteOperationsParams['source']): GridRect | null {
  const height = source.length;
  const width = height > 0 ? source[0]!.length : 0;
  if (height === 0 || width === 0) return null;
  return { top: anchor.row, left: anchor.col, bottom: anchor.row + height - 1, right: anchor.col + width - 1 };
}

export function buildPasteOperations(params: BuildPasteOperationsParams): PasteEngineResult {
  const capabilityError = checkCapability(params);
  if (capabilityError) return capabilityError;

  if (params.mode === 'FORMULAS_ONLY' || params.mode === 'FORMATS_ONLY') {
    return engineError(
      'UNSUPPORTED_MODE',
      `Paste mode '${params.mode}' has no representation in the current AP-00 FinanceValue contract (no formula/format field). Use 'VALUES_ONLY' or 'ALL'.`
    );
  }

  const rect = targetRectForSource(params.anchor, params.source);
  if (!rect) return engineError('EMPTY_INPUT', 'Paste source block is empty.');
  if (!isRectInBounds(rect, params.resolver)) {
    return engineError('OUT_OF_BOUNDS', `Paste target rect ${JSON.stringify(rect)} exceeds grid bounds (${params.resolver.rowCount}x${params.resolver.colCount}).`);
  }

  const cellRefs: CellRef[] = [];
  const values: FinanceValueInput[] = [];
  const issues: NonNullable<EngineError['issues']>[number][] = [];

  for (let r = 0; r < params.source.length; r++) {
    const row = params.source[r]!;
    for (let c = 0; c < row.length; c++) {
      const sourceCell = row[c]!;
      const parsedValue = FinanceValueInputSchema.safeParse(sourceCell.value);
      if (!parsedValue.success) {
        for (const issue of parsedValue.error.issues) {
          issues.push({ path: [`source[${r}][${c}]`, ...issue.path.map(String)], message: issue.message });
        }
        continue;
      }
      const coord: GridCoordinate = { row: params.anchor.row + r, col: params.anchor.col + c };
      const ref = params.resolver.cellRefAt(coord);
      const parsedRef = CellRefSchema.safeParse(ref);
      if (!parsedRef.success) {
        issues.push({ path: [`source[${r}][${c}]`, 'resolvedCellRef'], message: 'resolver.cellRefAt returned an invalid CellRef' });
        continue;
      }
      cellRefs.push(parsedRef.data);
      values.push(parsedValue.data);
    }
  }

  if (issues.length > 0) {
    return engineError('VALIDATION_FAILED', `${issues.length} source cell(s) failed FinanceValueInput validation.`, issues);
  }

  const now = resolveNow(params);
  const generateId = resolveIdGenerator(params);

  const targetChunks = chunkArray(cellRefs, MAX_CELLS_PER_OPERATION);
  const valueChunks = chunkArray(values, MAX_CELLS_PER_OPERATION);

  const batches: ApplyOperationsBatchRequest[] = targetChunks.map((targets, i) => {
    const chunkValues = valueChunks[i]!;
    return {
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
          values: chunkValues,
        },
      ],
    };
  });

  return { ok: true, batches, totalCells: cellRefs.length };
}
