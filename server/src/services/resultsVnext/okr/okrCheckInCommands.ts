/**
 * OKR-E004 — Check-in command layer.
 *
 * Design: docs/product/results-vnext/OKR_E004_DESIGN.md §7, ratified by the
 * §-IO Integration Owner rulings block at the top of that document.
 *
 * Both commands go through `executeAtomicCreate` (KPI decision #12,
 * `kpiMeasurementCommands.ts` §4.1) — NEVER `executeAtomicCommand` with a
 * caller-supplied `expectedVersion` on the checkin's own aggregate, since a
 * check-in has no prior state of its own to CAS against (each is a new,
 * immutable row). The KR/Set rows a check-in writes THROUGH to (D6/D8) are
 * instead locked with `SELECT ... FOR UPDATE` directly inside this
 * command's own transaction — the exact ROI-E004 D6 "pointer-update" shape
 * (`roiForecastVersionCommands.ts::loadRoiCaseForUpdate`, re-verified by
 * direct read) generalized from "a version-id pointer" to "denormalized
 * computed values": the check-in always wins over whatever the KR/Set rows
 * currently hold, no contest, because it is inherently the freshest fact.
 *
 * IO-1 re-verification performed against ACTUAL LANDED code (not the
 * design's own best-effort projections) before writing this file:
 * `okrKeyResultCommands.ts::updateKeyResult` (the exact UPDATE column list
 * this file's own KR write-through mirrors), `okrObjectiveCommands.ts::
 * recomputeObjectiveRollup`/`resolveOkrCyclePinnedPolicySnapshot` (REUSED
 * here directly, not reimplemented — the design's D6/D8 predates knowing
 * these existed, and reusing them guarantees this epic can never silently
 * drift from OKR-E003's own rollup semantics), `okrSetCommands.ts::
 * createOkrSet`'s SAVEPOINT-wrapped duplicate-INSERT pattern (mirrored
 * verbatim below for D4's reject-not-auto-convert requirement),
 * `okrProgressEngine.ts::calculateKeyResultProgress` (E003's real exported
 * signature — the design flagged this as unknown; it is pure,
 * `{direction, baselineValue, targetValue, currentValue, rangeMin,
 * rangeMax} -> {progress, reason, outOfRangeDistance}`).
 *
 * DEVIATIONS FROM THE DESIGN DRAFT, all restated in the EXECUTION_LEDGER
 * closure entry:
 *  - §7.1 numbered its steps INSERT-checkin -> lock-KR -> two-step
 *    previous_value UPDATE. This file locks the KR FIRST (its
 *    `current_value` is needed as `previous_value` anyway), then does a
 *    SINGLE SAVEPOINT-wrapped INSERT with `previous_value` already known —
 *    simpler, same guarantees, one fewer UPDATE.
 *  - `system_suggested_status`/authoritative `okr_vnext_key_results.status`:
 *    per the task's own governing instruction, this remains an explicitly
 *    OPEN cross-cutting question (design open question #4). This
 *    implementation does NOT auto-write the KR's authoritative `status`
 *    from either `system_suggested_status` or `owner_declared_status` — no
 *    AC names that capability (IO-3). `system_suggested_status` on the
 *    checkin row itself is populated ONLY for the one case the progress
 *    engine's own geometry makes definitionally forced (binary: progress
 *    1.0 -> 'achieved', 0.0 -> 'not_achieved') — every other geometry would
 *    need an invented progress-to-status threshold band (IO-5), so it stays
 *    `null` there. `owner_declared_status` is recorded verbatim as
 *    submitted, also never auto-applied to the KR's `status` column.
 *  - No KR-ownership enforcement (`submittedBy` need not equal
 *    `keyResult.ownerUserId`): the AC table's "KR Owner, Manager" Roles
 *    cell is treated as a UI/UX expectation, not a server-enforced
 *    ownership gate — consistent with EVERY other command in the landed
 *    OKR domain (`createKeyResult`/`updateKeyResult`/`createObjective` none
 *    enforce "only the owner may call this"; visibility via the Set's own
 *    ABAC row is the actual, established gate throughout this domain).
 *  - Added a `KEY_RESULT_CANCELLED` guard (not explicit in the design) —
 *    checking in against a cancelled KR would silently be excluded from
 *    every rollup anyway (`recomputeObjectiveRollup`'s own
 *    `status <> 'cancelled'` filter); rejecting outright is basic data
 *    integrity, not new product scope.
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import { executeAtomicCreate, type AtomicCommandOutcome, type AtomicEventInput } from '../platform/atomicWrite.js';
import { assertCommandCapability, type CommandAccessContext } from '../platform/commandCapabilityGuard.js';
import { completeObligation, createObligation } from '../platform/obligations.js';

import { toOkrCheckIn, type OkrCheckIn, type OkrCheckInConfidence, type OkrCheckInRow, type OkrCheckInStatus } from './okrCheckInTypes.js';
import { OkrKeyResultNotFoundError } from './okrKeyResultCommands.js';
import { toOkrKeyResult, type OkrKeyResult, type OkrKeyResultRow } from './okrKeyResultTypes.js';
import { recomputeObjectiveRollup, resolveOkrCyclePinnedPolicySnapshot } from './okrObjectiveCommands.js';
import { OKR_EVENT_SOURCE } from './okrProgramCommands.js';
import type { OkrProgramPolicySnapshot } from './okrProgramTypes.js';
import { calculateKeyResultProgress } from './okrProgressEngine.js';
import { computeSetRollup, type ComputeSetRollupObjectiveInput } from './okrSetRollupCalculator.js';
import { toOkrSet, type OkrSet, type OkrSetRow } from './okrSetTypes.js';

// ==========================================
// CONSTANTS
// ==========================================

/** Plan §13's literal MyWork obligation-type names, matched verbatim. */
export const CHECK_IN_OBLIGATION_TYPE = 'check_in';
export const EXPLAIN_LOW_CONFIDENCE_OBLIGATION_TYPE = 'explain_low_confidence';

/** `rvn_platform_obligations.reference_type` value for a check-in
 * obligation — a descriptive string, not a registered ABAC resource type
 * (Key Results carry no own visibility row, D14) — same posture
 * `kpiDeviationCommands.ts`'s `DEVIATION_CASE_REFERENCE_TYPE` and
 * `roiPirCommands.ts`'s literal `'roi_case'` already establish. */
export const OKR_CHECKIN_KEY_RESULT_REFERENCE_TYPE = 'okr_key_result';

// ==========================================
// ERRORS (D13 — own classes, never reused across aggregates)
// ==========================================

export class OkrCheckInValidationError extends Error {
  code: string;
  details?: Record<string, unknown>;
  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'OkrCheckInValidationError';
    this.code = code;
    this.details = details;
  }
}

export class OkrCheckInNotFoundError extends Error {
  code = 'CHECKIN_NOT_FOUND';
  details: Record<string, unknown>;
  constructor(checkInId: string) {
    super(`OKR CheckIn ${checkInId} not found`);
    this.name = 'OkrCheckInNotFoundError';
    this.details = { checkInId };
  }
}

/** D4: a second `recordCheckIn` for an already-checked-in (KR, occurrence)
 * pair is REJECTED (409), never auto-converted to a correction — the
 * caller must call `correctCheckIn` explicitly. Names the existing row's
 * id so the caller can act on it. */
export class OkrCheckInAlreadyExistsForOccurrenceError extends Error {
  code = 'CHECKIN_ALREADY_EXISTS_FOR_OCCURRENCE';
  details: Record<string, unknown>;
  constructor(keyResultId: string, cadenceOccurrenceId: string, existingCheckInId: string) {
    super(
      `A check-in already exists for key result ${keyResultId} in cadence occurrence ${cadenceOccurrenceId} (checkin_id=${existingCheckInId}) — use correctCheckIn instead of recordCheckIn`
    );
    this.name = 'OkrCheckInAlreadyExistsForOccurrenceError';
    this.details = { keyResultId, cadenceOccurrenceId, existingCheckInId };
  }
}

// RN-G5 — command capability names (docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md).
// This file's own header previously documented "No KR-ownership
// enforcement (submittedBy need not equal keyResult.ownerUserId) ...
// consistent with EVERY other command in the landed OKR domain" — that
// was the pre-RN-G5 gap this whole package targets, not a deliberate
// final security decision. Gated here the same as every other domain:
// the KR's own owner_user_id, already loaded via loadKeyResultForUpdate.
//
// `record` reuses the EXACT pre-existing capability string
// `'okr.checkin.create'` (NOT a new `results.okr.*`-namespaced name) —
// verified via grep that `effectiveAccessService.ts`'s
// `APPLICATION_ROLE_BASELINE_CAPABILITIES.USER` already grants this
// literal string to every plain USER-role member (line ~569: `USER:
// [...CANVAS_MEMBER_CAPABILITIES, 'okr.checkin.create']`) — this repo's
// ONE existing baseline capability grant for any non-admin OKR action.
// Using a different string would silently strip every ordinary member's
// pre-existing ability to check in on their own KRs (this package cannot
// touch effectiveAccessService.ts to add a new baseline grant, so reusing
// the one that already exists is the only way to avoid a regression).
// `correct` has no such baseline precedent — capability-only via '*' or
// an explicit grant, same as every other correction-style command
// (correctMeasurement/correctActualEntry) in this package.
export const OKR_CHECKIN_CAPABILITIES = {
  record: 'okr.checkin.create',
  correct: 'results.okr.checkin.correct',
} as const;

// ==========================================
// SHARED HELPERS
// ==========================================

function numOrNull(value: string | null): number | null {
  return value === null ? null : Number(value);
}

async function loadKeyResultForUpdate(client: PoolClient, keyResultId: string, organizationId: string): Promise<OkrKeyResultRow> {
  const result = await client.query<OkrKeyResultRow>(
    `SELECT * FROM okr_vnext_key_results WHERE key_result_id = $1 AND organization_id = $2 FOR UPDATE`,
    [keyResultId, organizationId]
  );
  const row = result.rows[0];
  if (!row) throw new OkrKeyResultNotFoundError(keyResultId);
  return row;
}

async function loadSetForUpdate(client: PoolClient, setId: string, organizationId: string): Promise<OkrSetRow> {
  const result = await client.query<OkrSetRow>(
    `SELECT * FROM okr_vnext_sets WHERE set_id = $1 AND organization_id = $2 FOR UPDATE`,
    [setId, organizationId]
  );
  const row = result.rows[0];
  if (!row) throw new Error(`[okrCheckInCommands] set ${setId} not found for key result under it`);
  return row;
}

/** D8/D10: computes `anyKeyResultStale`/`lastCheckinAt`/`nextCheckinDueAt`
 * for a Set as of the current moment — the SQL-side counterpart to
 * `okrSetRollupCalculator.ts`'s pure `computeSetRollup`. Bounded by the
 * Set's own KR/occurrence count (design §7.1 step 6's own stated
 * complexity bound), not a program-wide scan. */
async function loadSetCheckInFacts(
  client: PoolClient,
  setId: string,
  organizationId: string
): Promise<{ anyKeyResultStale: boolean; lastCheckinAt: string | null; nextCheckinDueAt: string | null }> {
  const staleResult = await client.query<{ any_stale: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM okr_vnext_key_results kr2
         JOIN okr_vnext_sets s2 ON s2.set_id = kr2.set_id
         JOIN okr_vnext_checkin_occurrences occ ON occ.cycle_id = s2.cycle_id AND occ.organization_id = kr2.organization_id
        WHERE kr2.set_id = $1 AND kr2.organization_id = $2 AND kr2.status <> 'cancelled'
          AND occ.window_end < now()
          AND NOT EXISTS (
            SELECT 1 FROM okr_vnext_checkins c2
             WHERE c2.key_result_id = kr2.key_result_id AND c2.cadence_occurrence_id = occ.cadence_occurrence_id
               AND c2.correction_of_checkin_id IS NULL
          )
     ) AS any_stale`,
    [setId, organizationId]
  );

  const lastCheckinResult = await client.query<{ last_checkin_at: string | null }>(
    `SELECT MAX(submitted_at) AS last_checkin_at FROM okr_vnext_checkins WHERE set_id = $1 AND organization_id = $2`,
    [setId, organizationId]
  );

  const nextDueResult = await client.query<{ next_checkin_due_at: string | null }>(
    `SELECT MIN(occ.window_end) AS next_checkin_due_at
       FROM okr_vnext_checkin_occurrences occ
       JOIN okr_vnext_sets s2 ON s2.cycle_id = occ.cycle_id AND s2.organization_id = occ.organization_id
      WHERE s2.set_id = $1 AND s2.organization_id = $2
        AND occ.window_end >= now()
        AND EXISTS (
          SELECT 1 FROM okr_vnext_key_results kr2
           WHERE kr2.set_id = s2.set_id AND kr2.organization_id = s2.organization_id AND kr2.status <> 'cancelled'
             AND NOT EXISTS (
               SELECT 1 FROM okr_vnext_checkins c2
                WHERE c2.key_result_id = kr2.key_result_id AND c2.cadence_occurrence_id = occ.cadence_occurrence_id
                  AND c2.correction_of_checkin_id IS NULL
             )
        )`,
    [setId, organizationId]
  );

  return {
    anyKeyResultStale: staleResult.rows[0]?.any_stale ?? false,
    lastCheckinAt: lastCheckinResult.rows[0]?.last_checkin_at ?? null,
    nextCheckinDueAt: nextDueResult.rows[0]?.next_checkin_due_at ?? null,
  };
}

async function loadNonCancelledObjectivesForRollup(
  client: PoolClient,
  setId: string,
  organizationId: string
): Promise<ComputeSetRollupObjectiveInput[]> {
  const result = await client.query<{
    objective_id: string;
    progress: string | null;
    confidence: OkrCheckInConfidence | null;
    confidence_numeric_value: string | null;
  }>(
    `SELECT objective_id, progress, confidence, confidence_numeric_value
       FROM okr_vnext_objectives
      WHERE set_id = $1 AND organization_id = $2 AND status <> 'cancelled'`,
    [setId, organizationId]
  );
  return result.rows.map((row) => ({
    objectiveId: row.objective_id,
    progress: numOrNull(row.progress),
    confidence: row.confidence,
    confidenceNumericValue: numOrNull(row.confidence_numeric_value),
  }));
}

/** D9/D10: recomputes and persists the Set's own rollup columns, reusing
 * the row already locked FOR UPDATE by the caller. Shared by
 * `recordCheckIn` and `correctCheckIn` (design §7.2: "re-runs steps 4-8").
 *
 * `objectiveRollupModel`/`objectiveConfidenceModel` come from the SAME
 * Cycle-pinned policy snapshot the KR/Objective write-through already
 * resolved (`resolveOkrCyclePinnedPolicySnapshot`) — never a second,
 * independent read, so the Set layer can never disagree with the Objective
 * layer about which policy version governed this write.
 */
export async function applySetRollupUpdate(
  client: PoolClient,
  setRow: OkrSetRow,
  organizationId: string,
  updatedBy: string,
  policy: Pick<OkrProgramPolicySnapshot, 'objectiveRollupModel' | 'objectiveConfidenceModel'>
): Promise<OkrSet> {
  const objectives = await loadNonCancelledObjectivesForRollup(client, setRow.set_id, organizationId);
  const facts = await loadSetCheckInFacts(client, setRow.set_id, organizationId);
  const rollup = computeSetRollup({
    objectives,
    objectiveRollupModel: policy.objectiveRollupModel,
    objectiveConfidenceModel: policy.objectiveConfidenceModel,
    anyKeyResultStale: facts.anyKeyResultStale,
    lastCheckinAt: facts.lastCheckinAt,
    nextCheckinDueAt: facts.nextCheckinDueAt,
  });

  const nextVersion = setRow.row_version + 1;
  const updateResult = await client.query<OkrSetRow>(
    `UPDATE okr_vnext_sets
        SET overall_progress = $1, overall_confidence = $2, attention_state = $3,
            last_checkin_at = $4, next_checkin_due_at = $5,
            overall_progress_reason = $6, overall_confidence_reason = $7,
            row_version = $8, updated_by = $9, updated_at = now()
      WHERE set_id = $10
      RETURNING *`,
    [
      rollup.overallProgress,
      rollup.overallConfidence,
      rollup.attentionState,
      rollup.lastCheckinAt,
      rollup.nextCheckinDueAt,
      // RN-G6-SRV / D08: Set-level counterpart of the Objective/KR
      // `progress_calc_reason`/`confidence_calc_reason` columns — see
      // 20260831_rvn_okr_not_calculable_reason.sql header for the full
      // diagnosis of why these were computed but discarded until now.
      rollup.overallProgressReason,
      rollup.overallConfidenceReason,
      nextVersion,
      updatedBy,
      setRow.set_id,
    ]
  );
  const updatedRow = updateResult.rows[0];
  if (!updatedRow) throw new Error(`[applySetRollupUpdate] update returned no row for ${setRow.set_id}`);
  return toOkrSet(updatedRow);
}

/**
 * D5: the plan's single ambiguous `confidence: high|medium|low|numeric|null`
 * union, resolved at the command layer against the Program's OWN
 * `confidenceModel` policy field (`high_medium_low`|`numeric`|`custom`) —
 * never a DB CHECK (cross-table rule, same posture the migration's own
 * header states). `'custom'` is rejected outright (mirrors
 * `recomputeObjectiveRollup`'s own precedent for an unimplemented model —
 * IO-5: no invented mapping for a model this epic does not implement).
 */
function assertConfidenceMatchesProgramModel(
  confidenceModel: OkrProgramPolicySnapshot['confidenceModel'],
  confidence: OkrCheckInConfidence | null | undefined,
  confidenceNumericValue: number | null | undefined
): void {
  if (confidence === undefined || confidence === null) {
    if (confidenceNumericValue !== undefined && confidenceNumericValue !== null) {
      throw new OkrCheckInValidationError(
        'confidenceNumericValue was provided without confidence — set confidence="numeric" alongside it',
        'CONFIDENCE_NUMERIC_VALUE_WITHOUT_CONFIDENCE',
        {}
      );
    }
    return;
  }
  if (confidenceModel === 'custom') {
    throw new OkrCheckInValidationError(
      `Program confidence_model "custom" is not implemented in OKR-E004 — check-ins may not carry a confidence value under this policy`,
      'CONFIDENCE_MODEL_NOT_IMPLEMENTED',
      { confidenceModel }
    );
  }
  if (confidenceModel === 'high_medium_low' && confidence === 'numeric') {
    throw new OkrCheckInValidationError(
      'confidence="numeric" is not valid — this Program\'s confidence_model is "high_medium_low"',
      'CONFIDENCE_MODEL_MISMATCH',
      { confidenceModel, confidence }
    );
  }
  if (confidenceModel === 'numeric' && confidence !== 'numeric') {
    throw new OkrCheckInValidationError(
      `confidence="${confidence}" is not valid — this Program's confidence_model is "numeric" (use confidence="numeric" with confidenceNumericValue)`,
      'CONFIDENCE_MODEL_MISMATCH',
      { confidenceModel, confidence }
    );
  }
  if (confidence === 'numeric' && (confidenceNumericValue === undefined || confidenceNumericValue === null)) {
    throw new OkrCheckInValidationError(
      'confidenceNumericValue is required when confidence="numeric"',
      'CONFIDENCE_NUMERIC_VALUE_REQUIRED',
      {}
    );
  }
  if (confidence !== 'numeric' && confidenceNumericValue !== undefined && confidenceNumericValue !== null) {
    throw new OkrCheckInValidationError(
      `confidenceNumericValue must be omitted when confidence="${confidence}" (only valid alongside confidence="numeric")`,
      'CONFIDENCE_NUMERIC_VALUE_NOT_ALLOWED',
      {}
    );
  }
}

/**
 * §-IO item 1 style definitionally-forced mapping (binary geometry only —
 * see this file's own header note on IO-5): every other geometry would
 * require an invented progress-to-status threshold band, so
 * `system_suggested_status` stays `null` for them.
 */
function suggestStatusFromBinaryProgress(direction: string, progress: number | null): OkrCheckInStatus | null {
  if (direction !== 'binary' || progress === null) return null;
  if (progress === 1) return 'achieved';
  if (progress === 0) return 'not_achieved';
  return null;
}

// ==========================================
// recordCheckIn (design §7.1)
// ==========================================

export interface RecordCheckInInput {
  keyResultId: string;
  organizationId: string;
  cadenceOccurrenceId: string;
  /** `null` = a qualitative-only check-in this round; the KR's own
   * `current_value` is left UNCHANGED (never clobbered to null) — see this
   * file's header deviation note. */
  newValue: number | null;
  ownerDeclaredStatus?: OkrCheckInStatus | null;
  confidence?: OkrCheckInConfidence | null;
  confidenceNumericValue?: number | null;
  note: string;
  blocker?: string | null;
  supportRequested?: string | null;
  evidenceRefs?: unknown[];
  submittedBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
  access: CommandAccessContext;
}

export interface RecordCheckInResult {
  checkIn: OkrCheckIn;
  keyResult: OkrKeyResult;
  set: OkrSet;
}

export async function recordCheckIn(input: RecordCheckInInput): Promise<AtomicCommandOutcome<RecordCheckInResult>> {
  const {
    keyResultId,
    organizationId,
    cadenceOccurrenceId,
    newValue,
    ownerDeclaredStatus = null,
    confidence,
    confidenceNumericValue,
    note,
    blocker = null,
    supportRequested = null,
    evidenceRefs = [],
    submittedBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
    access,
  } = input;

  return executeAtomicCreate<RecordCheckInResult>({
    organizationId,
    applyMutation: async (client) => {
      const krRow = await loadKeyResultForUpdate(client, keyResultId, organizationId);

      assertCommandCapability({
        access,
        actorUserId: submittedBy,
        capability: OKR_CHECKIN_CAPABILITIES.record,
        responsibleUserIds: [krRow.owner_user_id],
      });

      if (krRow.status === 'cancelled') {
        throw new OkrCheckInValidationError(
          `Key Result ${keyResultId} is cancelled — check-ins are not accepted against a cancelled key result`,
          'KEY_RESULT_CANCELLED',
          { keyResultId }
        );
      }

      const setRow = await loadSetForUpdate(client, krRow.set_id, organizationId);
      if (setRow.status !== 'active') {
        throw new OkrCheckInValidationError(
          `OKR Set ${setRow.set_id} is "${setRow.status}" — check-ins are only accepted while the Set is "active"`,
          'SET_NOT_ACTIVE',
          { setId: setRow.set_id, status: setRow.status }
        );
      }

      const { policyVersionId, snapshot } = await resolveOkrCyclePinnedPolicySnapshot(client, krRow.set_id, organizationId);
      assertConfidenceMatchesProgramModel(snapshot.confidenceModel, confidence, confidenceNumericValue);

      const previousValue = numOrNull(krRow.current_value);
      const effectiveCurrentValue = newValue !== null ? newValue : previousValue;

      const progressCalc = calculateKeyResultProgress({
        direction: krRow.direction,
        baselineValue: numOrNull(krRow.baseline_value),
        targetValue: numOrNull(krRow.target_value),
        currentValue: effectiveCurrentValue,
        rangeMin: numOrNull(krRow.range_min),
        rangeMax: numOrNull(krRow.range_max),
      });
      const systemSuggestedStatus = suggestStatusFromBinaryProgress(krRow.direction, progressCalc.progress);

      // D2/D3/D4: SAVEPOINT-wrapped INSERT so a caught 23505 on
      // ux_okr_vnext_checkins_kr_occurrence_original can ROLLBACK TO
      // SAVEPOINT before the follow-up SELECT that names the existing
      // row's id — without the SAVEPOINT, Postgres aborts the WHOLE
      // transaction on the unique violation (25P02 on any further query).
      // Mirrors createOkrSet's own duplicate-prevention shape verbatim.
      await client.query('SAVEPOINT okr_checkin_record');
      let checkInRow: OkrCheckInRow;
      try {
        const insertResult = await client.query<OkrCheckInRow>(
          `INSERT INTO okr_vnext_checkins
             (organization_id, key_result_id, objective_id, set_id, cadence_occurrence_id,
              previous_value, new_value, calculated_progress, calculated_progress_reason,
              owner_declared_status, system_suggested_status,
              confidence, confidence_numeric_value,
              note, blocker, support_requested, evidence_refs, submitted_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
           RETURNING *`,
          [
            organizationId,
            keyResultId,
            krRow.objective_id,
            krRow.set_id,
            cadenceOccurrenceId,
            previousValue,
            newValue,
            progressCalc.progress,
            // RN-G6-SRV / D08: same reason string already persisted onto the
            // sibling KR row below (`progress_calc_reason`) — previously
            // computed here and discarded for the check-in's own row.
            progressCalc.reason,
            ownerDeclaredStatus,
            systemSuggestedStatus,
            confidence ?? null,
            confidenceNumericValue ?? null,
            note,
            blocker,
            supportRequested,
            JSON.stringify(evidenceRefs ?? []),
            submittedBy,
          ]
        );
        const inserted = insertResult.rows[0];
        if (!inserted) throw new Error('[recordCheckIn] insert into okr_vnext_checkins returned no row');
        checkInRow = inserted;
        await client.query('RELEASE SAVEPOINT okr_checkin_record');
      } catch (err: unknown) {
        if ((err as { code?: string }).code === '23505') {
          await client.query('ROLLBACK TO SAVEPOINT okr_checkin_record');
          const existingResult = await client.query<{ checkin_id: string }>(
            `SELECT checkin_id FROM okr_vnext_checkins
              WHERE key_result_id = $1 AND cadence_occurrence_id = $2 AND correction_of_checkin_id IS NULL`,
            [keyResultId, cadenceOccurrenceId]
          );
          const existing = existingResult.rows[0];
          if (!existing) {
            throw new Error(
              `[recordCheckIn] 23505 on ux_okr_vnext_checkins_kr_occurrence_original but no winning row found for (${keyResultId}, ${cadenceOccurrenceId})`
            );
          }
          throw new OkrCheckInAlreadyExistsForOccurrenceError(keyResultId, cadenceOccurrenceId, existing.checkin_id);
        }
        throw err;
      }

      // D6: KR write-through — always wins, no CAS on the caller's behalf
      // (§7.1/§4.5's borrowed ROI-E004 D6 lock-then-pointer-update shape).
      // KR.confidence/confidence_numeric_value are overwritten ONLY when
      // this check-in explicitly provided one (`undefined` = leave the
      // KR's existing owner-declared value untouched).
      const nextKrConfidence = confidence !== undefined ? confidence : krRow.confidence;
      const nextKrConfidenceNumeric = confidence !== undefined ? (confidenceNumericValue ?? null) : numOrNull(krRow.confidence_numeric_value);
      const krUpdateResult = await client.query<OkrKeyResultRow>(
        `UPDATE okr_vnext_key_results
            SET current_value = $1, progress = $2, progress_calc_policy_version_id = $3,
                progress_calc_reason = $4, out_of_range_distance = $5,
                confidence = $6, confidence_numeric_value = $7,
                row_version = row_version + 1, updated_by = $8, updated_at = now()
          WHERE key_result_id = $9
          RETURNING *`,
        [
          effectiveCurrentValue,
          progressCalc.progress,
          policyVersionId,
          progressCalc.reason,
          progressCalc.outOfRangeDistance,
          nextKrConfidence,
          nextKrConfidenceNumeric,
          submittedBy,
          keyResultId,
        ]
      );
      const updatedKrRow = krUpdateResult.rows[0];
      if (!updatedKrRow) throw new Error(`[recordCheckIn] update returned no row for key result ${keyResultId}`);
      const keyResult = toOkrKeyResult(updatedKrRow);

      // D6/E003 reuse: recomputes the parent Objective's own rollup from
      // ALL its non-cancelled KRs (not just this one) in the SAME
      // transaction — never reimplemented here.
      await recomputeObjectiveRollup(client, {
        objectiveId: krRow.objective_id,
        setId: krRow.set_id,
        organizationId,
        policyVersionId,
        snapshot,
        actorUserId: submittedBy,
        actorEffectiveRole,
        idempotencyKey,
        correlationId,
        causationId,
      });

      // D8/D9/D10: Set-level rollup, eager, same transaction, same locked
      // row acquired above.
      const set = await applySetRollupUpdate(client, setRow, organizationId, submittedBy, snapshot);

      // D11/AC-013: completes the specific occurrence's obligation only
      // (the new optional cadenceOccurrenceId filter — see
      // platform/obligations.ts's own header note on why the unfiltered
      // form is unsafe for a KR that can have more than one open check_in
      // obligation at once).
      await completeObligation(client, {
        organizationId,
        referenceType: OKR_CHECKIN_KEY_RESULT_REFERENCE_TYPE,
        referenceId: keyResultId,
        obligationType: CHECK_IN_OBLIGATION_TYPE,
        completedViaCommand: 'recordCheckIn',
        cadenceOccurrenceId,
      });

      // Mirrors recordMeasurement's own synchronous, same-transaction
      // side-effect call (kpiMeasurementCommands.ts §4.1) applied to the
      // plan's own named "explain low confidence" obligation type.
      if (confidence === 'low') {
        await createObligation(client, {
          organizationId,
          assigneeUserId: keyResult.ownerUserId,
          referenceType: OKR_CHECKIN_KEY_RESULT_REFERENCE_TYPE,
          referenceId: keyResultId,
          aggregateVersionAtCreation: updatedKrRow.row_version,
          obligationType: EXPLAIN_LOW_CONFIDENCE_OBLIGATION_TYPE,
          cadenceOccurrenceId,
          deduplicationKey: `${organizationId}:${OKR_CHECKIN_KEY_RESULT_REFERENCE_TYPE}:${keyResultId}:${EXPLAIN_LOW_CONFIDENCE_OBLIGATION_TYPE}:${cadenceOccurrenceId}`,
        });
      }

      return { checkIn: toOkrCheckIn(checkInRow), keyResult, set };
    },
    buildEvent: ({ result }) => {
      const afterState = { checkIn: result.checkIn };
      return {
        schemaVersion: 1,
        eventType: 'okr_checkin.recorded',
        aggregateType: 'okr_set',
        aggregateId: result.set.setId,
        organizationId,
        actorUserId: submittedBy,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState: null,
        afterState,
        stateHash: computeStateHash(afterState),
        reason,
        evidenceRefs: [],
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: 1,
        payload: { checkInId: result.checkIn.checkInId, keyResultId },
      } satisfies AtomicEventInput;
    },
  });
}

// ==========================================
// correctCheckIn (design §7.2)
// ==========================================

export interface CorrectCheckInInput {
  checkInId: string;
  organizationId: string;
  newValue?: number | null;
  ownerDeclaredStatus?: OkrCheckInStatus | null;
  confidence?: OkrCheckInConfidence | null;
  confidenceNumericValue?: number | null;
  correctionReason: string;
  submittedBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  access: CommandAccessContext;
}

export interface CorrectCheckInResult {
  original: OkrCheckIn;
  superseding: OkrCheckIn;
  keyResult: OkrKeyResult;
  set: OkrSet;
}

/**
 * Mirrors `correctMeasurement`/`correctActualEntry` exactly: no SAVEPOINT
 * needed (the composite unique index only applies `WHERE
 * correction_of_checkin_id IS NULL` — a correction row never collides with
 * it). Re-runs the KR/Objective/Set write-through against the SUPERSEDING
 * row's (possibly-unchanged) values. Does NOT re-run `completeObligation` —
 * the obligation was already completed by the original `recordCheckIn`; a
 * correction to an already-checked-in window does not reopen it (design
 * §7.2, explicit).
 */
export async function correctCheckIn(input: CorrectCheckInInput): Promise<AtomicCommandOutcome<CorrectCheckInResult>> {
  const {
    checkInId,
    organizationId,
    newValue,
    ownerDeclaredStatus,
    confidence,
    confidenceNumericValue,
    correctionReason,
    submittedBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    access,
  } = input;

  return executeAtomicCreate<CorrectCheckInResult>({
    organizationId,
    applyMutation: async (client) => {
      const originalResult = await client.query<OkrCheckInRow>(
        `SELECT * FROM okr_vnext_checkins WHERE checkin_id = $1 AND organization_id = $2`,
        [checkInId, organizationId]
      );
      const originalRow = originalResult.rows[0];
      if (!originalRow) throw new OkrCheckInNotFoundError(checkInId);

      const krRow = await loadKeyResultForUpdate(client, originalRow.key_result_id, organizationId);

      assertCommandCapability({
        access,
        actorUserId: submittedBy,
        capability: OKR_CHECKIN_CAPABILITIES.correct,
        responsibleUserIds: [krRow.owner_user_id],
      });

      const setRow = await loadSetForUpdate(client, krRow.set_id, organizationId);
      const { policyVersionId, snapshot } = await resolveOkrCyclePinnedPolicySnapshot(client, krRow.set_id, organizationId);

      const mergedConfidence = confidence !== undefined ? confidence : originalRow.confidence;
      const mergedConfidenceNumeric = confidence !== undefined ? (confidenceNumericValue ?? null) : numOrNull(originalRow.confidence_numeric_value);
      assertConfidenceMatchesProgramModel(snapshot.confidenceModel, mergedConfidence, mergedConfidenceNumeric);

      const mergedNewValue = newValue !== undefined ? newValue : numOrNull(originalRow.new_value);
      const previousValue = numOrNull(krRow.current_value);
      const effectiveCurrentValue = mergedNewValue !== null ? mergedNewValue : previousValue;

      const progressCalc = calculateKeyResultProgress({
        direction: krRow.direction,
        baselineValue: numOrNull(krRow.baseline_value),
        targetValue: numOrNull(krRow.target_value),
        currentValue: effectiveCurrentValue,
        rangeMin: numOrNull(krRow.range_min),
        rangeMax: numOrNull(krRow.range_max),
      });
      const systemSuggestedStatus = suggestStatusFromBinaryProgress(krRow.direction, progressCalc.progress);
      const mergedOwnerDeclaredStatus = ownerDeclaredStatus !== undefined ? ownerDeclaredStatus : originalRow.owner_declared_status;

      const insertResult = await client.query<OkrCheckInRow>(
        `INSERT INTO okr_vnext_checkins
           (organization_id, key_result_id, objective_id, set_id, cadence_occurrence_id,
            previous_value, new_value, calculated_progress, calculated_progress_reason,
            owner_declared_status, system_suggested_status,
            confidence, confidence_numeric_value,
            note, blocker, support_requested, evidence_refs,
            correction_of_checkin_id, correction_reason, submitted_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
         RETURNING *`,
        [
          organizationId,
          originalRow.key_result_id,
          originalRow.objective_id,
          originalRow.set_id,
          originalRow.cadence_occurrence_id,
          previousValue,
          mergedNewValue,
          progressCalc.progress,
          // RN-G6-SRV / D08 — see recordCheckIn's identical comment above.
          progressCalc.reason,
          mergedOwnerDeclaredStatus,
          systemSuggestedStatus,
          mergedConfidence,
          mergedConfidenceNumeric,
          originalRow.note,
          originalRow.blocker,
          originalRow.support_requested,
          JSON.stringify(originalRow.evidence_refs ?? []),
          checkInId,
          correctionReason,
          submittedBy,
        ]
      );
      const supersedingRow = insertResult.rows[0];
      if (!supersedingRow) throw new Error('[correctCheckIn] insert into okr_vnext_checkins returned no row');

      const nextKrConfidence = confidence !== undefined ? confidence : krRow.confidence;
      const nextKrConfidenceNumeric = confidence !== undefined ? (confidenceNumericValue ?? null) : numOrNull(krRow.confidence_numeric_value);
      const krUpdateResult = await client.query<OkrKeyResultRow>(
        `UPDATE okr_vnext_key_results
            SET current_value = $1, progress = $2, progress_calc_policy_version_id = $3,
                progress_calc_reason = $4, out_of_range_distance = $5,
                confidence = $6, confidence_numeric_value = $7,
                row_version = row_version + 1, updated_by = $8, updated_at = now()
          WHERE key_result_id = $9
          RETURNING *`,
        [
          effectiveCurrentValue,
          progressCalc.progress,
          policyVersionId,
          progressCalc.reason,
          progressCalc.outOfRangeDistance,
          nextKrConfidence,
          nextKrConfidenceNumeric,
          submittedBy,
          originalRow.key_result_id,
        ]
      );
      const updatedKrRow = krUpdateResult.rows[0];
      if (!updatedKrRow) throw new Error(`[correctCheckIn] update returned no row for key result ${originalRow.key_result_id}`);
      const keyResult = toOkrKeyResult(updatedKrRow);

      await recomputeObjectiveRollup(client, {
        objectiveId: originalRow.objective_id,
        setId: originalRow.set_id,
        organizationId,
        policyVersionId,
        snapshot,
        actorUserId: submittedBy,
        actorEffectiveRole,
        idempotencyKey,
        correlationId,
        causationId,
      });

      const set = await applySetRollupUpdate(client, setRow, organizationId, submittedBy, snapshot);

      // Design §7.2: does NOT re-run completeObligation (already completed
      // by the original recordCheckIn). DOES re-run the low-confidence
      // obligation creation — createObligation's own ON CONFLICT DO NOTHING
      // makes a repeat call harmless, and a correction can genuinely be the
      // FIRST time confidence drops to 'low' for this window.
      if (mergedConfidence === 'low') {
        await createObligation(client, {
          organizationId,
          assigneeUserId: keyResult.ownerUserId,
          referenceType: OKR_CHECKIN_KEY_RESULT_REFERENCE_TYPE,
          referenceId: originalRow.key_result_id,
          aggregateVersionAtCreation: updatedKrRow.row_version,
          obligationType: EXPLAIN_LOW_CONFIDENCE_OBLIGATION_TYPE,
          cadenceOccurrenceId: originalRow.cadence_occurrence_id,
          deduplicationKey: `${organizationId}:${OKR_CHECKIN_KEY_RESULT_REFERENCE_TYPE}:${originalRow.key_result_id}:${EXPLAIN_LOW_CONFIDENCE_OBLIGATION_TYPE}:${originalRow.cadence_occurrence_id}`,
        });
      }

      return { original: toOkrCheckIn(originalRow), superseding: toOkrCheckIn(supersedingRow), keyResult, set };
    },
    buildEvent: ({ result }) => {
      const afterState = { checkIn: result.superseding };
      const beforeState = { checkIn: result.original };
      return {
        schemaVersion: 1,
        eventType: 'okr_checkin.corrected',
        aggregateType: 'okr_set',
        aggregateId: result.set.setId,
        organizationId,
        actorUserId: submittedBy,
        actorEffectiveRole,
        commandId: randomUUID(),
        correlationId: correlationId ?? randomUUID(),
        causationId,
        occurredAt: new Date().toISOString(),
        policyVersion: '',
        beforeState,
        afterState,
        stateHash: computeStateHash(afterState),
        reason: correctionReason,
        evidenceRefs: [],
        source: OKR_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion: null,
        resultingVersion: 1,
        payload: { checkInId: result.superseding.checkInId, correctionOfCheckInId: checkInId, keyResultId: result.original.keyResultId },
      } satisfies AtomicEventInput;
    },
  });
}
