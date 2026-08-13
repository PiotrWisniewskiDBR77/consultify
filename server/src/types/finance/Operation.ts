/**
 * AP-00 — Operation: a typed analyst mutation, batch application, and the
 * capability contract that gates which operations are legal.
 *
 * Program: `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md`
 * section 5 (AP-00: "Operation", "batch mutations i idempotency", "capability
 * endpoint"). ADR: `docs/validation/finance-v3/generated/gate-d/AP-00_shared_contracts_ADR.md`.
 *
 * Mapping onto `finance_working_revisions` (Gate B/C, already shipped —
 * `server/src/services/finance/canonical/artifactVersionService.ts`,
 * `server/migrations/20260809_finance_v3_b01_core_artifacts.sql` lines
 * 157-186): applying one `ApplyOperationsBatchRequest` is intended to
 * execute as ONE Postgres transaction that (a) validates the target
 * `business_version_id.status` is `DRAFT`/`NEEDS_CHANGES` (content tables
 * are physically immutable once `APPROVED` —
 * `finance_stmt_lines_enforce_parent_immutability`, WP-D01 section 4.5),
 * (b) applies every `Operation` in the batch as an UPSERT/DELETE against the
 * table each `CellRef.tableName` names, keyed by that table's stable
 * canonical key (`uq_finance_stmt_lines_cell` for `finance_stmt_lines`), (c)
 * demotes the current `finance_working_revisions.is_current` row and INSERTs
 * a new one (`revision_seq + 1`, `crash_recovery_checkpoint = true`, new
 * `content_semantic_hash`) — the exact demote-then-insert pattern
 * `reopenVersion()` already uses for working revisions, and (d) the whole
 * transaction rolls back on any single operation's failure ("atomowe
 * zastosowanie — wszystko albo nic"). This file defines the request/response
 * CONTRACT for that flow; the executor itself is out of scope for this ADR
 * (future Gate D executive work package, analogous to how WP-D01 left its
 * own backfill executor to a future WP-C03-like package).
 */

import { z } from 'zod';

import type { BusinessVersionStatus, FinanceRole } from '../../services/finance/canonical/lifecycleService.js';
import { CellRefSchema, cellRefKey, type CellRef } from './CellRef.js';
import { FinanceArtifactTypeSchema, type FinanceArtifactType } from './ArtifactRef.js';
import { FinanceValueObjectSchema, type FinanceValue } from './financeValueSemantics.js';

// ---------------------------------------------------------------------------
// FinanceValueInput — what a caller SUPPLIES to a mutation. A strict subset
// of FinanceValue: `status`/`valueDecimal` are always required (the mutation
// IS the value), but currency/unit/multiplier/adjustment fields are
// OPTIONAL — when omitted, the executor inherits them from the cell's
// existing row (on UPDATE) or from entity/version defaults (on INSERT). The
// exact inheritance rule is an open question for the executor, flagged in
// the ADR's escalation section — this contract only guarantees the input
// SHAPE, not the inheritance algorithm.
// ---------------------------------------------------------------------------

export const FinanceValueInputSchema = z
  .object({
    status: FinanceValueObjectSchema.shape.status,
    valueDecimal: FinanceValueObjectSchema.shape.valueDecimal,
    nativeCurrency: FinanceValueObjectSchema.shape.nativeCurrency.optional(),
    presentationCurrency: FinanceValueObjectSchema.shape.presentationCurrency.optional(),
    unit: FinanceValueObjectSchema.shape.unit.optional(),
    multiplier: FinanceValueObjectSchema.shape.multiplier.optional(),
    sourceRef: FinanceValueObjectSchema.shape.sourceRef.optional(),
    isAdjustment: FinanceValueObjectSchema.shape.isAdjustment.optional(),
    adjustmentReason: FinanceValueObjectSchema.shape.adjustmentReason.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === 'PRESENT_NONZERO' && (value.valueDecimal === null || value.valueDecimal === '0')) {
      ctx.addIssue({ code: 'custom', message: 'PRESENT_NONZERO requires a non-null, non-zero valueDecimal', path: ['valueDecimal'] });
    }
    if (value.status === 'PRESENT_ZERO' && value.valueDecimal !== '0') {
      ctx.addIssue({ code: 'custom', message: 'PRESENT_ZERO requires valueDecimal === "0"', path: ['valueDecimal'] });
    }
    if (['MISSING', 'NA', 'NOT_APPLICABLE'].includes(value.status) && value.valueDecimal !== null) {
      ctx.addIssue({ code: 'custom', message: `${value.status} requires valueDecimal to be null`, path: ['valueDecimal'] });
    }
  });
export type FinanceValueInput = z.infer<typeof FinanceValueInputSchema>;

// ---------------------------------------------------------------------------
// Operation — discriminated union on `type`. Five verbs per the task brief:
// set / clear / paste / bulk_set / reset. Orthogonal by target-cardinality x
// value-cardinality:
//
//   type      | targets | values                | effect
//   ----------|---------|-----------------------|----------------------------------
//   set       | 1       | 1 (inline)            | write one value to one cell
//   bulk_set  | N       | 1 (inline, shared)    | write the SAME value to N cells
//   paste     | N       | N (aligned by index)  | write a DIFFERENT value per cell (rectangular paste)
//   clear     | N       | none                  | force value_status -> MISSING (delete the value)
//   reset     | N       | none (strategy enum)  | discard local Draft edits, restore the parent business_version's value
//
// `clear` and `reset` are NOT the same operation: `clear` always produces
// MISSING (the analyst is saying "I don't have this"); `reset` restores
// whatever value the PARENT business_version had before this Draft's edits
// (the analyst is saying "undo my edit, not the underlying fact") — the
// per-cell counterpart of the whole-version copy-on-write reopen already
// performs (WP-D01 section 6: "reopen... może skopiować treść z vN do
// vN+1"). `reset` only has one strategy today
// (`TO_PARENT_VERSION_VALUE`) because that is the only baseline WP-D01's
// reopen mechanism actually establishes; the `strategy` field is a
// discriminant precisely so a future baseline (e.g. "reset to Approved
// original before any restatement") can be added without breaking this
// contract.
// ---------------------------------------------------------------------------

const operationCommon = z.object({
  /** Client-generated, unique within one batch (mirrors `opCommon.id` in `server/src/services/tablePlatform/TableAiEditorLevels/operations.ts`). */
  operationId: z.string().min(1),
  /** Per-operation idempotency key — distinct from the batch-level key on `ApplyOperationsBatchRequest` (see that type's doc comment for why both exist). */
  idempotencyKey: z.string().min(1),
  actorId: z.string().min(1),
  actorRole: z.enum(['viewer', 'preparer', 'reviewer', 'approver', 'finance_admin']),
  /** ISO-8601, the analyst's local clock when the edit was made (optimistic UI ordering, AP-04 conflict resolution — NOT the server-authoritative commit time, which the batch response supplies separately). */
  clientTimestamp: z.string().min(1),
  /**
   * The `working_revision_id` this operation was composed against. Mirrors
   * `expectedVersion`/`If-Match` (WP-B02 section 4.2,
   * `lifecycleService.resolveExpectedVersion`) — the executor rejects the
   * WHOLE containing batch if the artifact's current working revision has
   * since moved, the same "you edited against stale data" guard lifecycle
   * transitions already enforce, applied at the content-mutation layer.
   * `null` only for the very first edit against a brand-new Draft that has
   * no prior checkpoint yet.
   */
  sourceWorkingRevisionId: z.string().min(1).nullable(),
});

export const opSetSchema = operationCommon.extend({
  type: z.literal('set'),
  target: CellRefSchema,
  value: FinanceValueInputSchema,
});
export type OpSet = z.infer<typeof opSetSchema>;

export const opClearSchema = operationCommon.extend({
  type: z.literal('clear'),
  target: z.array(CellRefSchema).min(1),
});
export type OpClear = z.infer<typeof opClearSchema>;

export const opPasteSchema = operationCommon
  .extend({
    type: z.literal('paste'),
    target: z.array(CellRefSchema).min(1),
    values: z.array(FinanceValueInputSchema).min(1),
  })
  .superRefine((op, ctx) => {
    if (op.target.length !== op.values.length) {
      ctx.addIssue({
        code: 'custom',
        message: `paste requires target.length === values.length (got ${op.target.length} targets, ${op.values.length} values)`,
        path: ['values'],
      });
    }
  });
export type OpPaste = z.infer<typeof opPasteSchema>;

export const opBulkSetSchema = operationCommon.extend({
  type: z.literal('bulk_set'),
  target: z.array(CellRefSchema).min(1),
  value: FinanceValueInputSchema,
});
export type OpBulkSet = z.infer<typeof opBulkSetSchema>;

export const FinanceResetStrategyValues = ['TO_PARENT_VERSION_VALUE'] as const;
export type FinanceResetStrategy = (typeof FinanceResetStrategyValues)[number];

export const opResetSchema = operationCommon.extend({
  type: z.literal('reset'),
  target: z.array(CellRefSchema).min(1),
  strategy: z.enum(FinanceResetStrategyValues),
});
export type OpReset = z.infer<typeof opResetSchema>;

export const OperationSchema = z.discriminatedUnion('type', [
  opSetSchema,
  opClearSchema,
  opPasteSchema,
  opBulkSetSchema,
  opResetSchema,
]);
export type Operation = z.infer<typeof OperationSchema>;

export const OperationTypeValues = ['set', 'clear', 'paste', 'bulk_set', 'reset'] as const;
export type OperationType = (typeof OperationTypeValues)[number];

/** Every `CellRef` an `Operation` touches, regardless of its branch's target cardinality — used by the executor to lock/validate the full target set up front, and by the batch-level duplicate-target check below. */
export function operationTargets(op: Operation): CellRef[] {
  return op.type === 'set' ? [op.target] : op.target;
}

// ---------------------------------------------------------------------------
// Batch mutation + idempotency contract (scope item 7).
//
// Two DIFFERENT idempotency keys exist on purpose:
//   - `Operation.idempotencyKey` — identifies ONE operation, for audit/replay
//     at the per-mutation grain (mirrors `artifact_lifecycle_events`'s
//     per-event `idempotency_key`, WP-B02).
//   - `ApplyOperationsBatchRequest.batchIdempotencyKey` — identifies the
//     WHOLE HTTP request. A retried POST of the identical batch (same key)
//     must be a no-op replay even if a client bug regenerated fresh
//     per-operation keys on the retry; batch-level idempotency does not rely
//     on the per-operation keys being byte-stable across retries.
// This two-key design is a judgment call (master plan does not spell out
// whether one key is sufficient) — see the ADR's escalation section.
// ---------------------------------------------------------------------------

export const ApplyOperationsBatchRequestSchema = z.object({
  organizationId: z.string().min(1),
  artifactId: z.string().min(1),
  /** Must be the Draft/NeedsChanges business_version_id being edited — never an Approved one (rejected by the executor, mirroring the DB trigger). */
  businessVersionId: z.string().min(1),
  /** CAS pin on the CURRENT working revision, batch-wide (see `operationCommon.sourceWorkingRevisionId` for the per-operation analogue; this is the authoritative one the executor actually checks). */
  expectedWorkingRevisionId: z.string().min(1).nullable(),
  batchIdempotencyKey: z.string().min(1),
  /** 1..1000 — master plan section 10 / AP-01: "1000-cell paste jako jedna transakcja" is the hard upper bound this contract encodes. */
  operations: z.array(OperationSchema).min(1).max(1000),
});
export type ApplyOperationsBatchRequest = z.infer<typeof ApplyOperationsBatchRequestSchema>;

export type ApplyOperationsBatchErrorCode =
  | 'NOT_FOUND'
  | 'WORKING_REVISION_CONFLICT'
  | 'STATE_PRECONDITION_FAILED'
  | 'CAPABILITY_DENIED'
  | 'VALIDATION_FAILED'
  | 'BATCH_TOO_LARGE'
  | 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD';

export type ApplyOperationsBatchResult =
  | {
      ok: true;
      businessVersionId: string;
      newWorkingRevisionId: string;
      newRevisionSeq: number;
      appliedCount: number;
      contentSemanticHash: string;
      idempotentReplay: boolean;
    }
  | {
      ok: false;
      code: ApplyOperationsBatchErrorCode;
      message: string;
      /** Which operation (by `operationId`) the executor was validating/applying when it failed, if determinable before the all-or-nothing rollback. Diagnostic only — the whole batch is rejected regardless. */
      failedAt?: { operationId: string; reason: string } | null;
      currentWorkingRevisionId?: string | null;
    };

/**
 * Pure pre-flight check the client (and the executor, before touching the DB) can run: are any two
 * operations in one batch targeting the identical cell? Not itself a correctness guarantee for the
 * executor (it must still re-check under the DB transaction), but lets the UI reject an obviously-
 * conflicting paste before a round trip.
 *
 * AP-02 bugfix (2026-08-10, Excel round-trip work package): the key used to previously be
 * `${organizationId}|${businessVersionId}|${tableName}` — identical for EVERY cell in the same
 * table/business-version, so this function flagged any batch with more than one cell touching the
 * same table as "duplicate", regardless of whether the cells actually collided. That made the
 * function unusable for its stated purpose (confirmed: no caller had ever exercised it before
 * `financeImportService.ts` — a real multi-cell import batch always tripped the false positive).
 * Fixed to key on the full cell identity via `cellRefKey()` (organizationId + businessVersionId +
 * tableName + rowKey + columnKey), matching what `Operation.ts`'s own doc comment on this function
 * always described the check as doing.
 */
export function findDuplicateTargetsInBatch(operations: readonly Operation[]): string[] {
  const seen = new Map<string, number>();
  for (const op of operations) {
    for (const target of operationTargets(op)) {
      const key = cellRefKey(target);
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }
  return [...seen.entries()].filter(([, count]) => count > 1).map(([key]) => key);
}

// ---------------------------------------------------------------------------
// Capability endpoint (scope item 6):
//   GET /api/v8/finance-v2/capabilities/:artifactType?businessVersionId=...
//
// `:artifactType` selects WHICH capability rule-set applies (different
// artifact types may eventually permit different operation sets — e.g.
// Valuation's maker-checker rules, once WP-D05 exists, may be stricter than
// Statements'). `businessVersionId` is an OPTIONAL query parameter with two
// distinct response modes:
//   - omitted  -> "type-level schema" response: which of the five Operation
//     types this artifact type supports AT ALL, ignoring live state. Useful
//     for the UI to decide which toolbar buttons to even render before any
//     version is loaded.
//   - supplied -> "live" response: the actual allow/deny per operation for
//     THIS business_version_id's current status and the calling actor's
//     role. `businessVersionStatus`/`actorRole` are non-null only in this
//     mode.
// ---------------------------------------------------------------------------

export const FinanceCapabilityDenialReasonValues = [
  'ARTIFACT_APPROVED_IMMUTABLE',
  'ARTIFACT_ARCHIVED',
  'ROLE_INSUFFICIENT',
  'NO_OPEN_DRAFT',
] as const;
export type FinanceCapabilityDenialReason = (typeof FinanceCapabilityDenialReasonValues)[number];

export interface FinanceCapability {
  operation: OperationType;
  allowed: boolean;
  /** Present iff `allowed` is false. */
  reasonCode: FinanceCapabilityDenialReason | null;
}

export const FinanceCapabilitySchema = z.object({
  operation: z.enum(OperationTypeValues),
  allowed: z.boolean(),
  reasonCode: z.enum(FinanceCapabilityDenialReasonValues).nullable(),
});

export interface FinanceCapabilitiesResponse {
  artifactType: FinanceArtifactType;
  /** Null in "type-level schema" mode (no `businessVersionId` supplied). */
  businessVersionId: string | null;
  businessVersionStatus: BusinessVersionStatus | null;
  actorRole: FinanceRole | null;
  /** ALWAYS all five `OperationTypeValues`, allowed true or false — never a sparse list, so the frontend never needs a client-side default-deny fallback for an operation the response omitted. */
  capabilities: FinanceCapability[];
  /** Human-readable banner text for the read-only state, e.g. "Approved statement packs are immutable — reopen to edit." Null when at least one operation is allowed. */
  readOnlyReason: string | null;
}

export const FinanceCapabilitiesResponseSchema = z.object({
  artifactType: FinanceArtifactTypeSchema,
  businessVersionId: z.string().min(1).nullable(),
  businessVersionStatus: z.string().min(1).nullable(),
  actorRole: z.enum(['viewer', 'preparer', 'reviewer', 'approver', 'finance_admin']).nullable(),
  capabilities: z.array(FinanceCapabilitySchema).length(OperationTypeValues.length),
  readOnlyReason: z.string().min(1).nullable(),
});

export type FinanceCapabilitiesResult =
  | { ok: true; data: FinanceCapabilitiesResponse }
  | { ok: false; code: 'UNKNOWN_ARTIFACT_TYPE' | 'NOT_FOUND' | 'FORBIDDEN'; message: string };

/**
 * The ONE rule this contract hardcodes, because it is a physical DB
 * invariant already shipped, not a policy choice this ADR would be
 * inventing: `finance_stmt_lines_enforce_parent_immutability` (WP-D01
 * section 4.5) rejects every INSERT/UPDATE/DELETE once the parent
 * `business_version.status = 'APPROVED'`. Every other allow/deny rule (role
 * matrix per artifact type, NEEDS_CHANGES nuances, archived-artifact
 * handling) is intentionally left to the future capability service
 * implementation — this contract defines the RESPONSE shape (above), not
 * the full rule set (task scope: "kontrakt response, nie pełna
 * implementacja wszystkich reguł").
 */
export function isContentMutableStatus(status: BusinessVersionStatus): boolean {
  return status === 'DRAFT' || status === 'NEEDS_CHANGES';
}

export type { FinanceValue };
