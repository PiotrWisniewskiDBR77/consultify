/**
 * OKR-E004 — §O.2 (day 17 backend block 2 instruction, `CODEX_DAY17_
 * RESULTS_BACKEND2_INSTRUKCJA.md`): server-side, read-only aggregate of a
 * Set's check-ins, one row per live Key Result.
 *
 * `DEC-62(d)`: the client's own per-KR aggregation is authorized to move to
 * the server so the Set header and the KR detail stop computing the same
 * thing twice with two different formulas. Read-only — this file issues
 * SELECTs only; the check-in write path stays exactly where it is
 * (`okrCheckInCommands.ts::recordCheckIn`/`correctCheckIn`).
 *
 * ── `staleness` semantics (the reason day 17's own attempt stopped here) ──
 * The day-17 report's STOP read "brak wiążącej semantyki `CURRENT` kontra
 * `DUE`" — no *authoritative* definition of the boundary existed anywhere
 * in writing. It does not need a new one invented: `okrCheckInCommands.ts`'s
 * `loadSetCheckInFacts` (§205-245 in that file) ALREADY carries the two
 * governing predicates, at Set granularity:
 *   - "any_stale": EXISTS an occurrence whose `window_end < now()` with no
 *     ORIGINAL (non-correction) check-in for it — this is exactly what
 *     "missed a closed window" means everywhere else in this domain
 *     (`okrCheckInScheduler.ts::detectAndFlagMissedCheckIns` reuses the same
 *     shape to flag `attention_state='watch'`).
 *   - "next_checkin_due_at": MIN(`window_end`) over occurrences with
 *     `window_end >= now()` that still lack a check-in — "the next
 *     obligation that has not yet been fulfilled," open or not-yet-open,
 *     mirrored verbatim from that same function.
 * This file re-derives BOTH predicates at KEY-RESULT granularity (instead
 * of Set-wide EXISTS/MIN) and folds them into the four-value enum the O.2
 * contract asks for, with no third predicate and no invented threshold:
 *   - `OVERDUE`  — the KR-scoped "any_stale" predicate is true (mirrors the
 *                  existing Set-level query verbatim, scoped down).
 *   - `DUE`      — not OVERDUE, and the KR-scoped "next due" predicate
 *                  resolves to a non-null occurrence (an obligation exists,
 *                  open now or still ahead, not yet fulfilled).
 *   - `CURRENT`  — not OVERDUE, no next-due occurrence outstanding, AND at
 *                  least one cadence occurrence exists for the Set's Cycle
 *                  (every occurrence that exists has been checked into).
 *   - `UNKNOWN`  — zero cadence occurrences exist for the Set's Cycle at
 *                  all (`stalenessReason: 'NO_CADENCE_CONFIGURED'`) — "we
 *                  don't know" is never collapsed into "CURRENT" (day 17
 *                  instruction §O.2 requirement 2, explicit: "Nigdy
 *                  CURRENT").
 * `hasCadence` is a single Set/Cycle-wide fact (occurrences are generated
 * per-Cycle, not per-KR — `okr_vnext_checkin_occurrences.cycle_id`), so it
 * is computed once and shared by every KR in the response.
 *
 * Because a KR with `hasCadence=true` and zero check-ins ever MUST have
 * either an overdue occurrence or an outstanding next-due occurrence (any
 * generated occurrence is either already past or not — there is no third
 * case), `CURRENT` can only ever be reached once every occurrence that
 * exists has a check-in, which makes `lastCheckIn` provably non-null
 * whenever `staleness==='CURRENT'` — no extra guard needed to keep the two
 * fields consistent.
 *
 * `lastCheckIn` uses the SAME "authoritative row" pattern already
 * established for corrections elsewhere in this domain — verbatim from
 * `kpiRepository.ts::listMeasurements`'s `currentOnlyClause` and
 * `okrAttentionRepository.ts::listOpenBlockers`'s identical `NOT EXISTS
 * (... newer.correction_of_checkin_id = c.checkin_id)` clause: the row a
 * later correction points at is never "current" once a superseding row
 * exists.
 */
import type { PoolClient } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';

export type OkrCheckInSummaryStaleness = 'CURRENT' | 'DUE' | 'OVERDUE' | 'UNKNOWN';
export type OkrCheckInSummaryStalenessReason = 'NO_CHECKIN_YET' | 'NO_CADENCE_CONFIGURED' | null;

export interface OkrCheckInSummaryLastCheckIn {
  checkInId: string;
  recordedAt: string;
  confidence: string | null;
}

export interface OkrCheckInSummaryKeyResult {
  keyResultId: string;
  objectiveId: string;
  lastCheckIn: OkrCheckInSummaryLastCheckIn | null;
  nextExpectedAt: string | null;
  staleness: OkrCheckInSummaryStaleness;
  stalenessReason: OkrCheckInSummaryStalenessReason;
}

export interface OkrCheckInSummaryRollup {
  total: number;
  withCheckIn: number;
  overdue: number;
  neverCheckedIn: number;
  oldestCheckInAt: string | null;
  newestCheckInAt: string | null;
}

export interface SetCheckInSummary {
  setId: string;
  keyResults: OkrCheckInSummaryKeyResult[];
  rollup: OkrCheckInSummaryRollup;
  calculatedAt: string;
}

async function withReadClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await acquirePgClient();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

interface KeyResultRow {
  key_result_id: string;
  objective_id: string;
}

interface LastCheckInRow {
  key_result_id: string;
  checkin_id: string;
  submitted_at: string;
  confidence: string | null;
}

interface OverdueRow {
  key_result_id: string;
}

interface NextDueRow {
  key_result_id: string;
  next_expected_at: string;
}

export interface GetSetCheckInSummaryParams {
  setId: string;
  organizationId: string;
}

export async function getSetCheckInSummary(params: GetSetCheckInSummaryParams): Promise<SetCheckInSummary> {
  const { setId, organizationId } = params;

  const [keyResultRows, cadenceCount, lastCheckInRows, overdueRows, nextDueRows] = await withReadClient(
    async (client) => {
      const keyResultsResult = await client.query<KeyResultRow>(
        `SELECT key_result_id, objective_id
           FROM okr_vnext_key_results
          WHERE set_id = $1 AND organization_id = $2 AND status <> 'cancelled'
          ORDER BY created_at ASC`,
        [setId, organizationId]
      );

      // Cadence occurrences are generated per-Cycle (design §7.1/§8.2), not
      // per-KR — one existence check, shared by every KR in this Set.
      const cadenceCountResult = await client.query<{ occurrence_count: string }>(
        `SELECT COUNT(*)::text AS occurrence_count
           FROM okr_vnext_checkin_occurrences occ
           JOIN okr_vnext_sets s ON s.cycle_id = occ.cycle_id AND s.organization_id = occ.organization_id
          WHERE s.set_id = $1 AND s.organization_id = $2`,
        [setId, organizationId]
      );

      // "Authoritative" (not-yet-superseded) row per KR, most recent by
      // submission — the correction-chain-tip pattern established by
      // `kpiRepository.ts::listMeasurements`/`okrAttentionRepository.ts::
      // listOpenBlockers`.
      const lastCheckInResult = await client.query<LastCheckInRow>(
        `SELECT DISTINCT ON (c.key_result_id)
                c.key_result_id, c.checkin_id, c.submitted_at, c.confidence
           FROM okr_vnext_checkins c
           JOIN okr_vnext_key_results kr ON kr.key_result_id = c.key_result_id
          WHERE kr.set_id = $1 AND kr.organization_id = $2 AND c.organization_id = $2
            AND NOT EXISTS (
              SELECT 1 FROM okr_vnext_checkins newer WHERE newer.correction_of_checkin_id = c.checkin_id
            )
          ORDER BY c.key_result_id, c.submitted_at DESC`,
        [setId, organizationId]
      );

      // KR-scoped "any_stale" — verbatim copy of
      // `okrCheckInCommands.ts::loadSetCheckInFacts`'s own predicate,
      // narrowed from `kr2.set_id = $1` (Set-wide EXISTS) to a per-KR
      // GROUP BY so every stale KR is named, not just flagged as "some KR
      // is stale."
      const overdueResult = await client.query<OverdueRow>(
        `SELECT DISTINCT kr2.key_result_id
           FROM okr_vnext_key_results kr2
           JOIN okr_vnext_sets s2 ON s2.set_id = kr2.set_id
           JOIN okr_vnext_checkin_occurrences occ ON occ.cycle_id = s2.cycle_id AND occ.organization_id = kr2.organization_id
          WHERE kr2.set_id = $1 AND kr2.organization_id = $2 AND kr2.status <> 'cancelled'
            AND occ.window_end < now()
            AND NOT EXISTS (
              SELECT 1 FROM okr_vnext_checkins c2
               WHERE c2.key_result_id = kr2.key_result_id AND c2.cadence_occurrence_id = occ.cadence_occurrence_id
                 AND c2.correction_of_checkin_id IS NULL
            )`,
        [setId, organizationId]
      );

      // KR-scoped "next_checkin_due_at" — same predicate as
      // `loadSetCheckInFacts`'s `nextDueResult`, narrowed from
      // `MIN(...)` across the whole Set to `MIN(...) GROUP BY key_result_id`
      // so each KR gets its own next-expected date.
      const nextDueResult = await client.query<NextDueRow>(
        `SELECT kr2.key_result_id, MIN(occ.window_end) AS next_expected_at
           FROM okr_vnext_key_results kr2
           JOIN okr_vnext_sets s2 ON s2.set_id = kr2.set_id
           JOIN okr_vnext_checkin_occurrences occ ON occ.cycle_id = s2.cycle_id AND occ.organization_id = kr2.organization_id
          WHERE kr2.set_id = $1 AND kr2.organization_id = $2 AND kr2.status <> 'cancelled'
            AND occ.window_end >= now()
            AND NOT EXISTS (
              SELECT 1 FROM okr_vnext_checkins c2
               WHERE c2.key_result_id = kr2.key_result_id AND c2.cadence_occurrence_id = occ.cadence_occurrence_id
                 AND c2.correction_of_checkin_id IS NULL
            )
          GROUP BY kr2.key_result_id`,
        [setId, organizationId]
      );

      return [
        keyResultsResult.rows,
        Number(cadenceCountResult.rows[0]?.occurrence_count ?? '0'),
        lastCheckInResult.rows,
        overdueResult.rows,
        nextDueResult.rows,
      ] as const;
    }
  );

  const hasCadence = cadenceCount > 0;
  const lastCheckInByKr = new Map<string, LastCheckInRow>(lastCheckInRows.map((row) => [row.key_result_id, row]));
  const overdueKrIds = new Set(overdueRows.map((row) => row.key_result_id));
  const nextDueByKr = new Map<string, string>(nextDueRows.map((row) => [row.key_result_id, row.next_expected_at]));

  const keyResults: OkrCheckInSummaryKeyResult[] = keyResultRows.map((row) => {
    const lastCheckInRow = lastCheckInByKr.get(row.key_result_id) ?? null;
    const lastCheckIn: OkrCheckInSummaryLastCheckIn | null = lastCheckInRow
      ? { checkInId: lastCheckInRow.checkin_id, recordedAt: lastCheckInRow.submitted_at, confidence: lastCheckInRow.confidence }
      : null;
    const nextExpectedAt = nextDueByKr.get(row.key_result_id) ?? null;

    let staleness: OkrCheckInSummaryStaleness;
    let stalenessReason: OkrCheckInSummaryStalenessReason;
    if (!hasCadence) {
      staleness = 'UNKNOWN';
      stalenessReason = 'NO_CADENCE_CONFIGURED';
    } else if (overdueKrIds.has(row.key_result_id)) {
      staleness = 'OVERDUE';
      stalenessReason = lastCheckIn === null ? 'NO_CHECKIN_YET' : null;
    } else if (nextExpectedAt !== null) {
      staleness = 'DUE';
      stalenessReason = lastCheckIn === null ? 'NO_CHECKIN_YET' : null;
    } else {
      staleness = 'CURRENT';
      stalenessReason = null;
    }

    return {
      keyResultId: row.key_result_id,
      objectiveId: row.objective_id,
      lastCheckIn,
      nextExpectedAt,
      staleness,
      stalenessReason,
    };
  });

  // Requirement 3 (§O.2): rollup is computed from THIS SAME list, never a
  // separate query — a mismatch between `keyResults.length` and
  // `rollup.total` would otherwise be a silent, undetected defect.
  const withCheckInEntries = keyResults.filter((kr) => kr.lastCheckIn !== null);
  const recordedAts = withCheckInEntries.map((kr) => kr.lastCheckIn!.recordedAt).sort();
  const rollup: OkrCheckInSummaryRollup = {
    total: keyResults.length,
    withCheckIn: withCheckInEntries.length,
    overdue: keyResults.filter((kr) => kr.staleness === 'OVERDUE').length,
    neverCheckedIn: keyResults.filter((kr) => kr.lastCheckIn === null).length,
    oldestCheckInAt: recordedAts.length > 0 ? recordedAts[0]! : null,
    newestCheckInAt: recordedAts.length > 0 ? recordedAts[recordedAts.length - 1]! : null,
  };

  return {
    setId,
    keyResults,
    rollup,
    calculatedAt: new Date().toISOString(),
  };
}
