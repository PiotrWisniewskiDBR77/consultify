/**
 * OKR-E001 — Cycle scheduler service-actor functions.
 *
 * Design: docs/product/results-vnext/OKR_E001_DESIGN.md §6.6 (Decision P10:
 * pure, fully-tested, directly-callable functions — wiring an actual
 * periodic trigger is out of scope for this epic, matching
 * `outboxDrain.ts`'s own precedent). NOT exposed over HTTP — internal, calls
 * the same transition commands a human would.
 */
import { randomUUID } from 'node:crypto';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';

import { AtomicWriteConflictError } from '../platform/atomicWrite.js';

import type { OkrProgramPolicyVersionRow } from './okrProgramTypes.js';
import {
  OKR_CYCLE_ACTIVATE_SPEC,
  OKR_CYCLE_CLOSE_SPEC,
  OKR_CYCLE_OPEN_DRAFTING_SPEC,
  OKR_CYCLE_OPEN_REVIEW_SPEC,
  OkrCycleValidationError,
  runOkrCycleLifecycleTransition,
  type OkrCycleLifecycleTransitionSpec,
} from './okrCycleCommands.js';
import type { OkrCycleRow, OkrCycleStatus } from './okrCycleTypes.js';
import { OKR_SET_OPEN_REVIEW_SPEC, runOkrSetLifecycleTransition, OkrSetValidationError } from './okrSetCommands.js';
import type { OkrSetRow } from './okrSetTypes.js';

/** The platform's actual service-actor convention (design §6.6): nullable
 * `actorUserId` + a `'system:*'` role string — there is no separate
 * `actor_type` column anywhere in this schema. */
export const OKR_CYCLE_SCHEDULER_ACTOR_ROLE = 'system:okr_cycle_scheduler';

// ==========================================
// proposeAndExecuteDueCycleTransitions
// ==========================================

interface DueTransitionRule {
  fromStatus: OkrCycleStatus;
  /** okr_vnext_cycles column whose passing triggers this transition. */
  dueColumn: 'draft_open_at' | 'active_start_at' | 'review_open_at' | 'close_at';
  spec: OkrCycleLifecycleTransitionSpec;
}

/** Ordered planned->drafting->active->review->closed pipeline — each rule's
 * `dueColumn` is the Cycle timestamp that, once passed, means this
 * transition is due. */
const DUE_TRANSITION_RULES: readonly DueTransitionRule[] = [
  { fromStatus: 'planned', dueColumn: 'draft_open_at', spec: OKR_CYCLE_OPEN_DRAFTING_SPEC },
  { fromStatus: 'drafting', dueColumn: 'active_start_at', spec: OKR_CYCLE_ACTIVATE_SPEC },
  { fromStatus: 'active', dueColumn: 'review_open_at', spec: OKR_CYCLE_OPEN_REVIEW_SPEC },
  { fromStatus: 'review', dueColumn: 'close_at', spec: OKR_CYCLE_CLOSE_SPEC },
];

export interface ProposeAndExecuteDueCycleTransitionsInput {
  organizationId: string;
  asOf?: Date;
}

export interface ProposeAndExecuteDueCycleTransitionsResult {
  transitioned: Array<{ cycleId: string; toStatus: string }>;
}

/**
 * For every Cycle in (planned|drafting|active|review) whose next due
 * timestamp has passed `asOf` (default: now), calls
 * `runOkrCycleLifecycleTransition` with `actorUserId=null` and
 * `actorEffectiveRole='system:okr_cycle_scheduler'`. Idempotent by
 * construction: each call re-SELECTs due Cycles fresh — once a Cycle has
 * transitioned, it no longer matches its old status predicate, so a second
 * call in the same pass (or a later call) finds nothing left to do for it.
 * A single Cycle losing a CAS race (e.g. a concurrent manual transition)
 * does not abort the whole pass — same "one bad tick never kills the
 * process" discipline `outboxDrain.ts` documents for its own cron wiring.
 */
export async function proposeAndExecuteDueCycleTransitions(
  input: ProposeAndExecuteDueCycleTransitionsInput
): Promise<ProposeAndExecuteDueCycleTransitionsResult> {
  const { organizationId } = input;
  const asOf = input.asOf ?? new Date();
  const transitioned: Array<{ cycleId: string; toStatus: string }> = [];

  for (const rule of DUE_TRANSITION_RULES) {
    const client = await acquirePgClient();
    let dueRows: OkrCycleRow[];
    try {
      const result = await client.query<OkrCycleRow>(
        `SELECT * FROM okr_vnext_cycles
          WHERE organization_id = $1 AND status = $2 AND ${rule.dueColumn} <= $3
          ORDER BY ${rule.dueColumn} ASC`,
        [organizationId, rule.fromStatus, asOf.toISOString()]
      );
      dueRows = result.rows;
    } finally {
      client.release();
    }

    for (const row of dueRows) {
      try {
        const outcome = await runOkrCycleLifecycleTransition(rule.spec, {
          cycleId: row.cycle_id,
          organizationId,
          expectedVersion: row.row_version,
          actorUserId: null,
          actorEffectiveRole: OKR_CYCLE_SCHEDULER_ACTOR_ROLE,
          idempotencyKey: `okr-cycle-scheduler-${rule.spec.eventType}-${row.cycle_id}-${randomUUID()}`,
          reason: 'Scheduled transition — due timestamp passed',
        });
        if (outcome.outcome === 'applied') {
          transitioned.push({ cycleId: row.cycle_id, toStatus: rule.spec.toStatus });
        }
      } catch (err) {
        // Fromstatuses guard rejection or a lost CAS race — another actor
        // (manual override or a prior scheduler pass) already moved this
        // Cycle. Skip it, keep processing the rest of the batch.
        if (err instanceof OkrCycleValidationError || err instanceof AtomicWriteConflictError) {
          continue;
        }
        throw err;
      }
    }
  }

  return { transitioned };
}

// ==========================================
// cascadeOkrSetsToReview (OKR-E007, design §4.6)
// ==========================================

export interface CascadeOkrSetsToReviewInput {
  organizationId: string;
  cycleId: string;
}

export interface CascadeOkrSetsToReviewResult {
  transitioned: string[];
}

/**
 * Called alongside (not instead of) the Cycle's own `review_open_at`-driven
 * transition — for every `status='active'` Set under the Cycle, calls
 * `runOkrSetLifecycleTransition(OKR_SET_OPEN_REVIEW_SPEC, ...)` as a
 * service actor (`actorUserId=null`, `actorEffectiveRole=
 * 'system:okr_cycle_scheduler'`, same convention `OKR_CYCLE_SCHEDULER_ACTOR_ROLE`
 * already establishes for Cycle transitions). Idempotent by construction:
 * the CAS'd `fromStatuses:['active']` guard rejects harmlessly on a second
 * run once a Set has already moved to `review`. A single Set losing its
 * CAS race (a concurrent manual `open-review` call) does not abort the
 * whole pass, same "one bad tick never kills the process" discipline
 * `proposeAndExecuteDueCycleTransitions` above already uses.
 */
export async function cascadeOkrSetsToReview(
  input: CascadeOkrSetsToReviewInput
): Promise<CascadeOkrSetsToReviewResult> {
  const { organizationId, cycleId } = input;
  const transitioned: string[] = [];

  const client = await acquirePgClient();
  let activeSets: OkrSetRow[];
  try {
    const result = await client.query<OkrSetRow>(
      `SELECT * FROM okr_vnext_sets WHERE organization_id = $1 AND cycle_id = $2 AND status = 'active'`,
      [organizationId, cycleId]
    );
    activeSets = result.rows;
  } finally {
    client.release();
  }

  for (const setRow of activeSets) {
    try {
      const outcome = await runOkrSetLifecycleTransition(OKR_SET_OPEN_REVIEW_SPEC, {
        setId: setRow.set_id,
        organizationId,
        expectedVersion: setRow.row_version,
        actorUserId: null,
        actorEffectiveRole: OKR_CYCLE_SCHEDULER_ACTOR_ROLE,
        idempotencyKey: `okr-cycle-scheduler-${OKR_SET_OPEN_REVIEW_SPEC.eventType}-${setRow.set_id}-${randomUUID()}`,
        reason: 'Scheduled cascade — parent Cycle entered review',
      });
      if (outcome.outcome === 'applied') {
        transitioned.push(setRow.set_id);
      }
    } catch (err) {
      if (err instanceof OkrSetValidationError || err instanceof AtomicWriteConflictError) {
        continue;
      }
      throw err;
    }
  }

  return { transitioned };
}

// ==========================================
// generateCadenceOccurrences
// ==========================================

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Custom is intentionally NOT handled — design §6.6: "custom = no-op until
 * a later epic defines its interval source." */
type GeneratableCheckinFrequency = 'weekly' | 'biweekly' | 'monthly';

function advanceCadence(date: Date, frequency: GeneratableCheckinFrequency): Date {
  const next = new Date(date.getTime());
  if (frequency === 'weekly') {
    next.setUTCDate(next.getUTCDate() + 7);
  } else if (frequency === 'biweekly') {
    next.setUTCDate(next.getUTCDate() + 14);
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

function computeCadenceWindows(
  activeStartAt: string,
  finalUpdateDueAt: string,
  frequency: GeneratableCheckinFrequency
): Array<{ start: string; end: string }> {
  const windows: Array<{ start: string; end: string }> = [];
  const rangeEnd = new Date(finalUpdateDueAt);
  let cursor = new Date(activeStartAt);

  // Defensive bound — a Cycle with a malformed/inverted window should not
  // spin this loop forever. 520 == 10 years of weekly windows, comfortably
  // beyond any realistic Cycle length.
  let iterations = 0;
  const MAX_ITERATIONS = 520;

  while (cursor.getTime() <= rangeEnd.getTime() && iterations < MAX_ITERATIONS) {
    const next = advanceCadence(cursor, frequency);
    const windowEndCandidate = new Date(Math.min(next.getTime() - DAY_MS, rangeEnd.getTime()));
    const windowEnd = windowEndCandidate.getTime() >= cursor.getTime() ? windowEndCandidate : new Date(cursor.getTime());
    windows.push({ start: toDateOnly(cursor), end: toDateOnly(windowEnd) });
    cursor = next;
    iterations += 1;
  }
  return windows;
}

export interface GenerateCadenceOccurrencesInput {
  organizationId: string;
  cycleId: string;
}

export interface GenerateCadenceOccurrencesResult {
  created: number;
  skippedExisting: number;
  /**
   * OKR-E004 addition (IO-6: additive, backward-compatible — no existing
   * caller destructures an exact object shape that this would break). The
   * design's own open question #8 flagged that the original
   * `{created, skippedExisting}` shape only gives a COUNT, but E004's
   * obligation-seeding function (`generateCadenceOccurrencesAndSeedCheckInObligations`,
   * okrCheckInScheduler.ts) needs the actual new row ids to seed a
   * `check_in` obligation per newly-opened window. Populated with the
   * `cadence_occurrence_id` of every row this call itself inserted (the
   * `RETURNING` from the `INSERT ... ON CONFLICT DO NOTHING` below) — never
   * includes ids that already existed (those hit `skippedExisting`).
   */
  createdOccurrenceIds: string[];
}

/**
 * Materializes `okr_vnext_checkin_occurrences` rows for a Cycle from
 * `active_start_at` through `final_update_due_at`, at intervals derived
 * from the Cycle's own PINNED policy snapshot's `checkinFrequency` (not the
 * Program's current live value — same "a Cycle's behavior depends on the
 * policy version it was created under" principle
 * `okr_vnext_cycles.policy_version_id` itself embodies). `custom` frequency
 * is a no-op (design §6.6). Idempotent via
 * `INSERT ... ON CONFLICT (cycle_id, window_start) DO NOTHING`.
 */
export async function generateCadenceOccurrences(
  input: GenerateCadenceOccurrencesInput
): Promise<GenerateCadenceOccurrencesResult> {
  const { organizationId, cycleId } = input;

  const client = await acquirePgClient();
  try {
    const cycleResult = await client.query<OkrCycleRow>(
      `SELECT * FROM okr_vnext_cycles WHERE cycle_id = $1 AND organization_id = $2`,
      [cycleId, organizationId]
    );
    const cycleRow = cycleResult.rows[0];
    if (!cycleRow) {
      throw new Error(`[generateCadenceOccurrences] Cycle ${cycleId} not found`);
    }

    const policyVersionResult = await client.query<OkrProgramPolicyVersionRow>(
      `SELECT * FROM okr_vnext_program_policy_versions
        WHERE policy_version_id = $1 AND organization_id = $2`,
      [cycleRow.policy_version_id, organizationId]
    );
    const policyVersionRow = policyVersionResult.rows[0];
    if (!policyVersionRow) {
      throw new Error(
        `[generateCadenceOccurrences] pinned policy version ${cycleRow.policy_version_id} not found for Cycle ${cycleId}`
      );
    }

    const checkinFrequency = policyVersionRow.snapshot.checkinFrequency;
    if (checkinFrequency === 'custom') {
      return { created: 0, skippedExisting: 0, createdOccurrenceIds: [] };
    }

    const windows = computeCadenceWindows(cycleRow.active_start_at, cycleRow.final_update_due_at, checkinFrequency);

    let created = 0;
    let skippedExisting = 0;
    const createdOccurrenceIds: string[] = [];
    for (const window of windows) {
      const insertResult = await client.query<{ cadence_occurrence_id: string }>(
        `INSERT INTO okr_vnext_checkin_occurrences (organization_id, cycle_id, window_start, window_end)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (cycle_id, window_start) DO NOTHING
         RETURNING cadence_occurrence_id`,
        [organizationId, cycleId, window.start, window.end]
      );
      const insertedRow = insertResult.rows[0];
      if (insertedRow) {
        created += 1;
        createdOccurrenceIds.push(insertedRow.cadence_occurrence_id);
      } else {
        skippedExisting += 1;
      }
    }
    return { created, skippedExisting, createdOccurrenceIds };
  } finally {
    client.release();
  }
}
