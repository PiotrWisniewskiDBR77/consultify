/**
 * AP-01 — shared mutation-context plumbing for PasteEngine / FillEngine /
 * BulkOpsEngine / FindReplaceEngine: the actor/version/idempotency fields
 * every `Operation` (AP-00) requires, factored out once instead of repeated
 * per engine.
 *
 * ADR: `docs/validation/finance-v3/generated/gate-d/AP-01_finance_data_grid_ADR.md`.
 */

import type { BusinessVersionStatus, FinanceRole } from '../../../services/finance/canonical/lifecycleService.js';
import { isContentMutableStatus } from '../../../types/finance/Operation.js';

/**
 * Everything an engine needs to stamp a batch of `Operation`s, EXCEPT the
 * operation-specific target/value payload. Mirrors
 * `ApplyOperationsBatchRequest` (organizationId/artifactId/businessVersionId/
 * expectedWorkingRevisionId/batchIdempotencyKey) plus `operationCommon`
 * (actorId/actorRole/sourceWorkingRevisionId) — one object because in
 * practice a single analyst session supplies both at once.
 */
export interface EngineMutationContext {
  organizationId: string;
  artifactId: string;
  businessVersionId: string;
  /** Batch-level CAS pin — see `Operation.ts` `ApplyOperationsBatchRequest.expectedWorkingRevisionId`. */
  expectedWorkingRevisionId: string | null;
  /** Per-operation CAS pin — see `Operation.ts` `operationCommon.sourceWorkingRevisionId`. In the common case this equals `expectedWorkingRevisionId`; kept separate because the two fields are separate in the AP-00 contract (per-operation vs batch-wide). */
  sourceWorkingRevisionId: string | null;
  actorId: string;
  actorRole: FinanceRole;
  /**
   * Optional live capability gate: when supplied, every `buildXOperations`
   * function in this package checks `isContentMutableStatus` FIRST and
   * returns `CAPABILITY_DENIED` before doing any other work if the version
   * is not editable. Optional (not required) because these engines are pure
   * core logic usable in contexts that have already checked capability
   * upstream (e.g. a server route that calls the capability endpoint
   * separately) — this is a defensive convenience, not the sole enforcement
   * point; the real enforcement is the DB trigger + executor transaction
   * (`Operation.ts` section 6.2), which this package does not implement.
   */
  businessVersionStatus?: BusinessVersionStatus;
  /** ISO-8601 clock, injectable for deterministic tests. Defaults to `new Date().toISOString()`. */
  now?: () => string;
  /** Id generator for `operationId` / `idempotencyKey` / `batchIdempotencyKey`. Injectable for deterministic tests. Defaults to `crypto.randomUUID()`. */
  generateId?: () => string;
}

export type EngineErrorCode =
  | 'CAPABILITY_DENIED'
  | 'EMPTY_INPUT'
  | 'OUT_OF_BOUNDS'
  | 'VALIDATION_FAILED'
  | 'SHAPE_MISMATCH'
  | 'UNSUPPORTED_MODE';

export interface EngineError {
  ok: false;
  code: EngineErrorCode;
  message: string;
  /** Zod-issue-shaped details when the failure came from a schema `safeParse`, for surfacing per-cell validation feedback in a future UI. */
  issues?: readonly { path: (string | number)[]; message: string }[];
}

export function engineError(code: EngineErrorCode, message: string, issues?: EngineError['issues']): EngineError {
  return { ok: false, code, message, ...(issues ? { issues } : {}) };
}

function defaultId(): string {
  // AP-01 core logic has no DB/network dependency; randomUUID is the
  // standard Node global (available since Node 14.17 / this repo already
  // relies on it elsewhere, e.g. server auth handoff refs) and needs no
  // import beyond the runtime global.
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function resolveNow(ctx: Pick<EngineMutationContext, 'now'>): () => string {
  return ctx.now ?? (() => new Date().toISOString());
}

export function resolveIdGenerator(ctx: Pick<EngineMutationContext, 'generateId'>): () => string {
  return ctx.generateId ?? defaultId;
}

/** The one capability check every engine performs up front when `businessVersionStatus` is supplied (see `EngineMutationContext.businessVersionStatus` doc comment). */
export function checkCapability(ctx: Pick<EngineMutationContext, 'businessVersionStatus'>): EngineError | null {
  if (ctx.businessVersionStatus !== undefined && !isContentMutableStatus(ctx.businessVersionStatus)) {
    return engineError(
      'CAPABILITY_DENIED',
      `businessVersionStatus '${ctx.businessVersionStatus}' is not content-mutable (must be DRAFT or NEEDS_CHANGES).`
    );
  }
  return null;
}
