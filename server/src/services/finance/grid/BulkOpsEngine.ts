/**
 * AP-01 — BulkOpsEngine: bulk clear/reset/set over an arbitrary set of
 * target cells (a selection's cells, or any explicit `CellRef[]`), producing
 * AP-00 `Operation` batches.
 *
 * Program: `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 * section 10 ("bulk set/reset/clear"). ADR:
 * `docs/validation/finance-v3/generated/gate-d/AP-01_finance_data_grid_ADR.md`
 * section 6.
 *
 * Maps 1:1 onto AP-00's three no-inline-per-cell-value verbs:
 *   CLEAR -> Operation.type = 'clear'    (force value_status -> MISSING)
 *   RESET -> Operation.type = 'reset'    (discard local Draft edits)
 *   SET   -> Operation.type = 'bulk_set' (write the SAME value to every target)
 * `clear`/`reset` semantics are NOT this engine's to redefine — see
 * `Operation.ts` section 6.1's own doc comment for why they are distinct
 * verbs, not variants of each other.
 */

import { CellRefSchema } from '../../../types/finance/CellRef.js';
import type { CellRef } from '../../../types/finance/CellRef.js';
import { FinanceValueInputSchema } from '../../../types/finance/Operation.js';
import type { ApplyOperationsBatchRequest, FinanceResetStrategy, FinanceValueInput } from '../../../types/finance/Operation.js';
import {
  type EngineError,
  type EngineMutationContext,
  checkCapability,
  engineError,
  resolveIdGenerator,
  resolveNow,
} from './engineContext.js';
import { MAX_CELLS_PER_OPERATION, chunkArray } from './gridCoordinates.js';

export type BulkOpKind = 'CLEAR' | 'RESET' | 'SET';

interface BulkOpsCommonParams extends EngineMutationContext {
  targets: readonly CellRef[];
}

export interface BuildBulkClearParams extends BulkOpsCommonParams {
  kind: 'CLEAR';
}

export interface BuildBulkResetParams extends BulkOpsCommonParams {
  kind: 'RESET';
  strategy: FinanceResetStrategy;
}

export interface BuildBulkSetParams extends BulkOpsCommonParams {
  kind: 'SET';
  value: FinanceValueInput;
}

export type BuildBulkOperationsParams = BuildBulkClearParams | BuildBulkResetParams | BuildBulkSetParams;

export interface BulkOpsEngineSuccess {
  ok: true;
  batches: ApplyOperationsBatchRequest[];
  totalCells: number;
}

export type BulkOpsEngineResult = BulkOpsEngineSuccess | EngineError;

export function buildBulkOperations(params: BuildBulkOperationsParams): BulkOpsEngineResult {
  const capabilityError = checkCapability(params);
  if (capabilityError) return capabilityError;

  if (params.targets.length === 0) {
    return engineError('EMPTY_INPUT', 'Bulk operation target set is empty.');
  }

  const parsedTargets: CellRef[] = [];
  const issues: NonNullable<EngineError['issues']>[number][] = [];
  params.targets.forEach((target, i) => {
    const parsed = CellRefSchema.safeParse(target);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({ path: [`targets[${i}]`, ...issue.path.map(String)], message: issue.message });
      }
      return;
    }
    parsedTargets.push(parsed.data);
  });
  if (issues.length > 0) {
    return engineError('VALIDATION_FAILED', `${issues.length} target(s) failed CellRef validation.`, issues);
  }

  let parsedValue: FinanceValueInput | null = null;
  if (params.kind === 'SET') {
    const result = FinanceValueInputSchema.safeParse(params.value);
    if (!result.success) {
      return engineError(
        'VALIDATION_FAILED',
        'Bulk set value failed FinanceValueInput validation.',
        result.error.issues.map((issue) => ({ path: ['value', ...issue.path.map(String)], message: issue.message }))
      );
    }
    parsedValue = result.data;
  }

  const now = resolveNow(params);
  const generateId = resolveIdGenerator(params);
  const chunks = chunkArray(parsedTargets, MAX_CELLS_PER_OPERATION);

  const batches: ApplyOperationsBatchRequest[] = chunks.map((targets) => {
    const common = {
      operationId: generateId(),
      idempotencyKey: generateId(),
      actorId: params.actorId,
      actorRole: params.actorRole,
      clientTimestamp: now(),
      sourceWorkingRevisionId: params.sourceWorkingRevisionId,
    } as const;

    const operation =
      params.kind === 'CLEAR'
        ? ({ type: 'clear' as const, ...common, target: targets })
        : params.kind === 'RESET'
          ? ({ type: 'reset' as const, ...common, target: targets, strategy: params.strategy })
          : ({ type: 'bulk_set' as const, ...common, target: targets, value: parsedValue! });

    return {
      organizationId: params.organizationId,
      artifactId: params.artifactId,
      businessVersionId: params.businessVersionId,
      expectedWorkingRevisionId: params.expectedWorkingRevisionId,
      batchIdempotencyKey: generateId(),
      operations: [operation],
    };
  });

  return { ok: true, batches, totalCells: parsedTargets.length };
}
