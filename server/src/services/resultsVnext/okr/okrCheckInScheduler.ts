/**
 * OKR-E004 — Obligation seeding + missed-cadence detection (design §8).
 *
 * Neither function here is wired to a live cron — same P10 posture
 * `okrCycleScheduler.ts` (OKR-E001) states for itself: "pure, fully-tested,
 * directly-callable functions... wiring an actual periodic trigger is out
 * of scope." Both are safe to call repeatedly (idempotent by construction),
 * mirroring `proposeAndExecuteDueCycleTransitions`'s own per-row
 * error-isolation discipline: one bad Set/occurrence never aborts the whole
 * pass.
 *
 * Does NOT modify `okrCycleScheduler.ts` beyond the additive
 * `createdOccurrenceIds` field already landed in a separate commit (IO-6) —
 * `generateCadenceOccurrences` itself is imported UNCHANGED.
 */
import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import { createObligation } from '../platform/obligations.js';

import {
  applySetRollupUpdate,
  CHECK_IN_OBLIGATION_TYPE,
  OKR_CHECKIN_KEY_RESULT_REFERENCE_TYPE,
} from './okrCheckInCommands.js';
import { generateCadenceOccurrences } from './okrCycleScheduler.js';
import { resolveOkrCyclePinnedPolicySnapshot } from './okrObjectiveCommands.js';
import type { OkrSetRow } from './okrSetTypes.js';

export const OKR_CHECKIN_SCHEDULER_ACTOR = 'system:okr_checkin_scheduler';

// ==========================================
// generateCadenceOccurrencesAndSeedCheckInObligations (design §8.2)
// ==========================================

export interface GenerateCadenceOccurrencesAndSeedCheckInObligationsInput {
  organizationId: string;
  cycleId: string;
}

export interface GenerateCadenceOccurrencesAndSeedCheckInObligationsResult {
  occurrencesCreated: number;
  obligationsSeeded: number;
}

/**
 * Calls E001's `generateCadenceOccurrences` (imported, unmodified — the P11
 * handoff's "no ALTER" covers the TABLE; the additive `createdOccurrenceIds`
 * field on its RESULT type, landed separately, is what makes this function
 * possible without a schema change or a second query to guess which rows
 * are new).
 *
 * For every newly-created occurrence, seeds a `check_in` obligation for
 * every live (non-cancelled) KR belonging to an ACTIVE Set in this Cycle.
 * Restricted to `status='active'` Sets deliberately — a KR whose Set is
 * still `draft`/`submitted`/`approved` has no path to actually fulfil a
 * check-in (`recordCheckIn`'s own `SET_NOT_ACTIVE` guard would reject it),
 * so seeding one there would be a dead-end MyWork item; not a design
 * requirement, a straightforward consequence of the guard this epic itself
 * enforces.
 *
 * Idempotent via `createObligation`'s own `ON CONFLICT (organization_id,
 * deduplication_key) DO NOTHING` (design §4.4) — safe to re-run the whole
 * pass; a second call with the same occurrences/KRs seeds zero new rows.
 */
export async function generateCadenceOccurrencesAndSeedCheckInObligations(
  input: GenerateCadenceOccurrencesAndSeedCheckInObligationsInput
): Promise<GenerateCadenceOccurrencesAndSeedCheckInObligationsResult> {
  const { organizationId, cycleId } = input;
  const generated = await generateCadenceOccurrences({ organizationId, cycleId });

  if (generated.createdOccurrenceIds.length === 0) {
    return { occurrencesCreated: generated.created, obligationsSeeded: 0 };
  }

  const client = await acquirePgClient();
  let obligationsSeeded = 0;
  try {
    const occurrenceRowsResult = await client.query<{ cadence_occurrence_id: string; window_end: string }>(
      `SELECT cadence_occurrence_id, window_end FROM okr_vnext_checkin_occurrences WHERE cadence_occurrence_id = ANY($1::uuid[])`,
      [generated.createdOccurrenceIds]
    );

    const krRowsResult = await client.query<{ key_result_id: string; owner_user_id: string; row_version: number }>(
      `SELECT kr.key_result_id, kr.owner_user_id, kr.row_version
         FROM okr_vnext_key_results kr
         JOIN okr_vnext_sets s ON s.set_id = kr.set_id
        WHERE s.cycle_id = $1 AND s.organization_id = $2 AND kr.status <> 'cancelled' AND s.status = 'active'`,
      [cycleId, organizationId]
    );

    for (const occurrence of occurrenceRowsResult.rows) {
      for (const kr of krRowsResult.rows) {
        const created = await createObligation(client, {
          organizationId,
          assigneeUserId: kr.owner_user_id,
          referenceType: OKR_CHECKIN_KEY_RESULT_REFERENCE_TYPE,
          referenceId: kr.key_result_id,
          aggregateVersionAtCreation: kr.row_version,
          obligationType: CHECK_IN_OBLIGATION_TYPE,
          dueAt: occurrence.window_end,
          cadenceOccurrenceId: occurrence.cadence_occurrence_id,
          deduplicationKey: `${organizationId}:${OKR_CHECKIN_KEY_RESULT_REFERENCE_TYPE}:${kr.key_result_id}:${CHECK_IN_OBLIGATION_TYPE}:${occurrence.cadence_occurrence_id}`,
        });
        if (created) obligationsSeeded += 1;
      }
    }
  } finally {
    client.release();
  }

  return { occurrencesCreated: generated.created, obligationsSeeded };
}

// ==========================================
// detectAndFlagMissedCheckIns (design §8.3)
// ==========================================

export interface DetectAndFlagMissedCheckInsInput {
  organizationId: string;
  cycleId: string;
  asOf?: Date;
}

export interface DetectAndFlagMissedCheckInsResult {
  setsReassessed: number;
  obligationsStillOpen: number;
}

/**
 * This is what actually satisfies AC-011's "brak check-in -> stale/
 * attention, NIGDY syntetyczne 0%" for Sets that receive NO check-in
 * activity at all — without this function, a Set's `attention_state` only
 * ever updates reactively, inside `recordCheckIn`/`correctCheckIn`'s own
 * transaction, when SOME check-in happens on ANY of its KRs. This function
 * independently notices "a window closed with nothing recorded" and
 * recomputes `attention_state`/`overall_*` for every ACTIVE Set in the
 * Cycle, reusing `applySetRollupUpdate` (the exact same rollup logic
 * `recordCheckIn`/`correctCheckIn` use — no duplicated formula).
 *
 * One `BEGIN`/`COMMIT` PER SET, not one giant transaction for the whole
 * Cycle — a single Set losing its row lock to a concurrent `recordCheckIn`
 * call (or any other error) is caught and skipped, never aborting the rest
 * of the pass, mirroring `proposeAndExecuteDueCycleTransitions`'s own
 * per-row error isolation.
 *
 * Deliberately emits NO platform event/outbox entry — this is a read-model
 * refresh of already-known facts (every input it consumes is either a KR/
 * Objective progress value already persisted by a real command, or a
 * boolean derived from existing check-in/occurrence rows), not a new
 * business fact of its own; no AC asks for an audit trail specifically for
 * this recompute pass.
 */
export async function detectAndFlagMissedCheckIns(
  input: DetectAndFlagMissedCheckInsInput
): Promise<DetectAndFlagMissedCheckInsResult> {
  const { organizationId, cycleId } = input;
  const asOf = input.asOf ?? new Date();

  const listClient = await acquirePgClient();
  let activeSetIds: string[];
  try {
    const result = await listClient.query<{ set_id: string }>(
      `SELECT set_id FROM okr_vnext_sets WHERE organization_id = $1 AND cycle_id = $2 AND status = 'active'`,
      [organizationId, cycleId]
    );
    activeSetIds = result.rows.map((row) => row.set_id);
  } finally {
    listClient.release();
  }

  let setsReassessed = 0;
  for (const setId of activeSetIds) {
    const client = await acquirePgClient();
    try {
      await client.query('BEGIN');
      const setRowResult = await client.query<OkrSetRow>(
        `SELECT * FROM okr_vnext_sets WHERE set_id = $1 AND organization_id = $2 FOR UPDATE`,
        [setId, organizationId]
      );
      const setRow = setRowResult.rows[0];
      if (!setRow) {
        await client.query('ROLLBACK');
        continue;
      }
      const { snapshot } = await resolveOkrCyclePinnedPolicySnapshot(client, setId, organizationId);
      await applySetRollupUpdate(client, setRow, organizationId, OKR_CHECKIN_SCHEDULER_ACTOR, snapshot);
      await client.query('COMMIT');
      setsReassessed += 1;
    } catch {
      // One bad Set (lost lock race, transient error) never aborts the
      // rest of the pass — same discipline
      // proposeAndExecuteDueCycleTransitions uses per-Cycle.
      try {
        await client.query('ROLLBACK');
      } catch {
        // Connection already broken — nothing more to do for this Set.
      }
    } finally {
      client.release();
    }
  }

  const countClient = await acquirePgClient();
  let obligationsStillOpen = 0;
  try {
    // rvn_platform_obligations.reference_id is UUID (matches
    // kr.key_result_id directly, no cast); .cadence_occurrence_id is TEXT
    // while okr_vnext_checkin_occurrences.cadence_occurrence_id is UUID —
    // ::text cast required on THAT join (the inverse of the usual
    // resource_visibility TEXT-vs-UUID direction this program keeps
    // tripping on — verified by direct \d against both tables, not assumed).
    const obligationsStillOpenResult = await countClient.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM rvn_platform_obligations o
         JOIN okr_vnext_key_results kr ON kr.key_result_id = o.reference_id AND o.reference_type = $1
         JOIN okr_vnext_checkin_occurrences occ ON occ.cadence_occurrence_id::text = o.cadence_occurrence_id
        WHERE o.organization_id = $2 AND o.obligation_type = $3 AND o.status = 'open'
          AND occ.cycle_id = $4 AND occ.window_end < $5`,
      [OKR_CHECKIN_KEY_RESULT_REFERENCE_TYPE, organizationId, CHECK_IN_OBLIGATION_TYPE, cycleId, asOf.toISOString()]
    );
    obligationsStillOpen = Number(obligationsStillOpenResult.rows[0]?.count ?? '0');
  } finally {
    countClient.release();
  }

  return { setsReassessed, obligationsStillOpen };
}
