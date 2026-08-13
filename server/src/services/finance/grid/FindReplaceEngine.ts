/**
 * AP-01 — FindReplaceEngine: locate cells matching a caller-supplied
 * predicate, optionally replace them, producing AP-00 `Operation` batches
 * for the replace step.
 *
 * Program: `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 * section 10 ("find/replace"). Task scope: "znajdź komórki spełniające
 * predykat (wartość/formuła/quality)". ADR:
 * `docs/validation/finance-v3/generated/gate-d/AP-01_finance_data_grid_ADR.md`
 * section 7.
 *
 * PREDICATE SCOPE, documented judgment call: AP-00's `FinanceValue` has no
 * `formula` field (same gap `PasteEngine`'s paste-special modes document)
 * and no single `quality` field — "quality" in this program lives in a
 * separate concept (the exception ledger, `exceptionLedgerService.ts`, Gate
 * C) that this AP-01 core-logic package does not depend on (staying
 * DB/service-free per this package's own scope). Rather than inventing a
 * `formula`/`quality` field this contract does not have, `findCells` takes a
 * fully generic `(cell: GridCellSnapshot) => boolean` predicate. Callers
 * compose whatever check they need — `status`/`valueDecimal` predicates via
 * the helpers below for the "value" axis this contract DOES support, or
 * their own predicate closing over an externally-fetched exception-ledger
 * lookup for the "quality" axis this package cannot see. "Formula" search
 * has no answer today for the same reason `PasteEngine`'s `FORMULAS_ONLY`
 * mode does not — flagged in the ADR, not silently ignored.
 */

import { CellRefSchema } from '../../../types/finance/CellRef.js';
import type { CellRef } from '../../../types/finance/CellRef.js';
import { FinanceValueInputSchema } from '../../../types/finance/Operation.js';
import type { ApplyOperationsBatchRequest, FinanceValueInput } from '../../../types/finance/Operation.js';
import type { FinanceValueStatus } from '../../../types/finance/financeValueSemantics.js';
import {
  type EngineError,
  type EngineMutationContext,
  checkCapability,
  engineError,
  resolveIdGenerator,
  resolveNow,
} from './engineContext.js';
import { MAX_CELLS_PER_OPERATION, chunkArray, type GridCoordinate } from './gridCoordinates.js';

/** A cell as visible to search: its grid position, domain address, and current value. Built by the caller from whatever in-memory grid data source it holds — this package does not own cell storage (see AP-01 ADR section 2 for why: the grid's actual populated-cell store is React-layer state, out of scope here). */
export interface GridCellSnapshot {
  coordinate: GridCoordinate;
  ref: CellRef;
  value: FinanceValueInput;
}

export type CellPredicate = (cell: GridCellSnapshot) => boolean;

// ---------------------------------------------------------------------------
// Predicate builders for the "value" axis (the one axis AP-00's contract
// actually models). Composable with `&&`/`||` or a caller's own predicate.
// ---------------------------------------------------------------------------

export function byStatus(...statuses: readonly FinanceValueStatus[]): CellPredicate {
  const set = new Set(statuses);
  return (cell) => set.has(cell.value.status);
}

export function byDecimalEquals(decimal: string): CellPredicate {
  return (cell) => cell.value.valueDecimal === decimal;
}

export function byDecimalInRange(min: number, max: number): CellPredicate {
  return (cell) => {
    if (cell.value.valueDecimal === null) return false;
    const n = Number(cell.value.valueDecimal);
    return Number.isFinite(n) && n >= min && n <= max;
  };
}

/** True for a cell with no confirmed value at all (`MISSING`/`NA`/`NOT_APPLICABLE`) — the closest this contract comes to a generic "quality gap" predicate without depending on the exception ledger. */
export function byNoConfirmedValue(): CellPredicate {
  return byStatus('MISSING', 'NA', 'NOT_APPLICABLE');
}

// ---------------------------------------------------------------------------
// Find
// ---------------------------------------------------------------------------

/** Pure, synchronous scan — `cells` is whatever iterable the caller's in-memory grid data source produces (an array, or a generator over a sparse Map's values for the 10k x 120 scale; see the performance test for the latter). */
export function findCells(cells: Iterable<GridCellSnapshot>, predicate: CellPredicate): GridCellSnapshot[] {
  const matches: GridCellSnapshot[] = [];
  for (const cell of cells) {
    if (predicate(cell)) matches.push(cell);
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Replace
// ---------------------------------------------------------------------------

export interface BuildFindReplaceOperationsParams extends EngineMutationContext {
  matches: readonly GridCellSnapshot[];
  /** A single shared replacement value (emits `bulk_set`), or a per-cell function (emits `paste`) — mirrors the same shared-vs-per-cell distinction `Operation.ts` draws between `bulk_set` and `paste`. */
  replacement: FinanceValueInput | ((cell: GridCellSnapshot) => FinanceValueInput);
}

export interface FindReplaceEngineSuccess {
  ok: true;
  batches: ApplyOperationsBatchRequest[];
  totalCells: number;
}

export type FindReplaceEngineResult = FindReplaceEngineSuccess | EngineError;

export function buildFindReplaceOperations(params: BuildFindReplaceOperationsParams): FindReplaceEngineResult {
  const capabilityError = checkCapability(params);
  if (capabilityError) return capabilityError;

  if (params.matches.length === 0) {
    return engineError('EMPTY_INPUT', 'No matched cells to replace.');
  }

  const isShared = typeof params.replacement !== 'function';
  const targets: CellRef[] = [];
  const values: FinanceValueInput[] = [];
  const issues: NonNullable<EngineError['issues']>[number][] = [];

  params.matches.forEach((cell, i) => {
    const parsedRef = CellRefSchema.safeParse(cell.ref);
    if (!parsedRef.success) {
      issues.push({ path: [`matches[${i}]`, 'ref'], message: 'matched cell has an invalid CellRef' });
      return;
    }
    const rawValue = isShared ? (params.replacement as FinanceValueInput) : (params.replacement as (c: GridCellSnapshot) => FinanceValueInput)(cell);
    const parsedValue = FinanceValueInputSchema.safeParse(rawValue);
    if (!parsedValue.success) {
      for (const issue of parsedValue.error.issues) {
        issues.push({ path: [`matches[${i}]`, 'replacement', ...issue.path.map(String)], message: issue.message });
      }
      return;
    }
    targets.push(parsedRef.data);
    values.push(parsedValue.data);
  });

  if (issues.length > 0) {
    return engineError('VALIDATION_FAILED', `${issues.length} match(es) failed validation.`, issues);
  }
  // A shared, function-free replacement is validated once above per-match
  // (cheap, and keeps the loop uniform); collapse to the single parsed value
  // for the bulk_set branch.
  const sharedValue = isShared ? values[0]! : null;

  const now = resolveNow(params);
  const generateId = resolveIdGenerator(params);

  let batches: ApplyOperationsBatchRequest[];
  if (sharedValue) {
    const chunks = chunkArray(targets, MAX_CELLS_PER_OPERATION);
    batches = chunks.map((chunkTargets) => ({
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
          target: chunkTargets,
          value: sharedValue,
        },
      ],
    }));
  } else {
    const targetChunks = chunkArray(targets, MAX_CELLS_PER_OPERATION);
    const valueChunks = chunkArray(values, MAX_CELLS_PER_OPERATION);
    batches = targetChunks.map((chunkTargets, i) => ({
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
          target: chunkTargets,
          values: valueChunks[i]!,
        },
      ],
    }));
  }

  return { ok: true, batches, totalCells: targets.length };
}
