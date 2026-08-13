/**
 * OKR-E007 — Carry-forward command layer.
 *
 * Design: docs/product/results-vnext/OKR_E007_DESIGN.md §4.7, D8/D15-D17.
 *
 * D8: Set-level lineage ONLY — zero Objective/KeyResult CONTENT is copied.
 * `carryForwardOkrSet` creates an EMPTY draft Set (`carried_from_set_id`
 * pointer, same `scope_type`/`scope_id`/`owner_user_id`/`reviewer_user_id`/
 * `title` as the source) in the target Cycle. Content re-drafting is
 * OKR-E008 Teresa's job (`POST .../advisor/reflection`), which proposes a
 * patch INTO this draft using the closed Set + its Reflections'
 * `next_cycle_change` fields as grounded context — never auto-copied here.
 *
 * D16 (restated forward, not this epic's to resolve): a carried-forward
 * Objective, when OKR-E008 eventually creates one, must be a NEW row with
 * a `carried_from_objective_id` pointer — never the same Objective row
 * moved between Sets (which would corrupt the closed Set's immutable
 * `okr_vnext_approved_snapshots.snapshot_payload`). `okr_vnext_objectives`
 * has no such column yet (E003 did not reserve one) — flagged again here,
 * not silently worked around.
 *
 * D17: thin wrapper around E002's existing `createOkrSet` — reuses its
 * SAVEPOINT-based duplicate-tuple handling, visibility-policy lookup, ACL
 * grants, and `draft_okr_set` obligation verbatim rather than
 * reimplementing any of them. `createOkrSet`'s own `okr_set.created` event
 * is the only event this call produces — no separate carry-forward event.
 */
import { acquirePgClient } from '../../../database/PostgresDatabase.js';

import { assertCommandCapability, type CommandAccessContext } from '../platform/commandCapabilityGuard.js';

import { createOkrSet, OkrSetValidationError, type CreateOkrSetResult } from './okrSetCommands.js';
import { OkrCycleValidationError } from './okrCycleCommands.js';
import { toOkrSet, type OkrSet, type OkrSetRow } from './okrSetTypes.js';
import type { OkrCycleRow } from './okrCycleTypes.js';

// RN-G5 — command capability name (docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md).
export const OKR_CARRY_FORWARD_CAPABILITY = 'results.okr.set.carry_forward';

export interface CarryForwardOkrSetInput {
  sourceSetId: string;
  targetCycleId: string;
  organizationId: string;
  actorUserId: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export interface CarryForwardOkrSetResult {
  sourceSet: OkrSet;
  carriedSet: OkrSet;
  /** `false` = a Set for the target (program, cycle, scope, owner) tuple
   * already existed — E002 D3's dedupe reused it instead of creating a
   * second one (`createOkrSet`'s own `created` flag, passed through). */
  created: boolean;
}

/**
 * Read-only source guard (`status==='closed'`), read-only target-Cycle
 * guard (`status IN ('planned','drafting')`), then a single call into
 * `createOkrSet` (D17). No row lock on either the source Set or the target
 * Cycle — both reads are point-in-time eligibility checks, not part of a
 * CAS'd mutation of either aggregate (the actual write lands entirely
 * inside `createOkrSet`'s own transaction).
 */
export async function carryForwardOkrSet(input: CarryForwardOkrSetInput): Promise<CarryForwardOkrSetResult> {
  const {
    sourceSetId,
    targetCycleId,
    organizationId,
    actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  const client = await acquirePgClient();
  let sourceRow: OkrSetRow | undefined;
  let targetCycleRow: OkrCycleRow | undefined;
  try {
    const sourceResult = await client.query<OkrSetRow>(
      `SELECT * FROM okr_vnext_sets WHERE set_id = $1 AND organization_id = $2`,
      [sourceSetId, organizationId]
    );
    sourceRow = sourceResult.rows[0];
    if (!sourceRow) {
      throw new OkrSetValidationError(`OKR Set ${sourceSetId} not found`, 'SET_NOT_FOUND', { setId: sourceSetId });
    }
    if (sourceRow.status !== 'closed') {
      throw new OkrSetValidationError(
        `OKR Set ${sourceSetId} is "${sourceRow.status}" — only a "closed" Set may be carried forward`,
        'SOURCE_NOT_CLOSED',
        { setId: sourceSetId, status: sourceRow.status }
      );
    }

    const cycleResult = await client.query<OkrCycleRow>(
      `SELECT * FROM okr_vnext_cycles WHERE cycle_id = $1 AND organization_id = $2`,
      [targetCycleId, organizationId]
    );
    targetCycleRow = cycleResult.rows[0];
    if (!targetCycleRow) {
      throw new OkrCycleValidationError(`OKR Cycle ${targetCycleId} not found`, 'CYCLE_NOT_FOUND', { cycleId: targetCycleId });
    }
    if (targetCycleRow.status !== 'planned' && targetCycleRow.status !== 'drafting') {
      throw new OkrCycleValidationError(
        `OKR Cycle ${targetCycleId} is "${targetCycleRow.status}" — a Set may only be carried forward into a "planned" or "drafting" Cycle`,
        'TARGET_CYCLE_NOT_ELIGIBLE',
        { cycleId: targetCycleId, status: targetCycleRow.status }
      );
    }
  } finally {
    client.release();
  }

  // RN-G5: unlike a fresh createOkrSet (which has no prior row to check
  // against, see that command's own documented ungated decision),
  // carryForwardOkrSet acts on an EXISTING closed source Set — it has a
  // real owner/reviewer already loaded above, so this is gated on THAT,
  // not left capability-only.
  assertCommandCapability({
    access,
    actorUserId,
    capability: OKR_CARRY_FORWARD_CAPABILITY,
    responsibleUserIds: [sourceRow.owner_user_id, sourceRow.reviewer_user_id],
  });

  const outcome = await createOkrSet({
    organizationId,
    programId: sourceRow.program_id,
    cycleId: targetCycleId,
    scopeType: sourceRow.scope_type,
    scopeId: sourceRow.scope_id,
    ownerUserId: sourceRow.owner_user_id,
    reviewerUserId: sourceRow.reviewer_user_id,
    title: sourceRow.title,
    carriedFromSetId: sourceSetId,
    createdBy: actorUserId,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId,
    reason,
    // createOkrSet itself is deliberately capability-only-ungated (see its
    // own header comment) — this carryForwardOkrSet-level check above is
    // the real gate for this call path. Passed through only because the
    // field is structurally required.
    access,
  });

  const result: CreateOkrSetResult = outcome.result;
  return {
    sourceSet: toOkrSet(sourceRow),
    carriedSet: result.set,
    created: result.created,
  };
}
