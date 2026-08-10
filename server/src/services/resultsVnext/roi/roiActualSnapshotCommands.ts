/**
 * ROI-E004 — `publishRoiActualSnapshot` (Decision D8/D17: an immutable,
 * periodically-published rollup of current (non-superseded) Actual entries,
 * fills `rvn_roi_cases.current_actual_snapshot_id`).
 *
 * Design: docs/product/results-vnext/ROI_E004_DESIGN.md §4.
 *
 * ROLLUP-FORMULA DEVIATION, DOCUMENTED (the design doc names the fields this
 * table must carry — §3's DDL — but gives no exact aggregation formula, the
 * way §4.3 of ROI-E002 pins the engine's own NPV/IRR math to the letter):
 *   - `total_actual_costs` / `total_actual_financial_benefits`: straight
 *     SUMs over CURRENT (non-superseded) entries, `entry_type='cost'` /
 *     `entry_type='benefit' AND` the linked benefit line's `is_financial`,
 *     mirroring which lines feed `totalFinancialBenefits` in
 *     `roiCalculationEngine.ts`.
 *   - `actual_simple_roi`: `(financialBenefits - costs) / costs`, the exact
 *     same ratio shape as the engine's own `simpleRoiDecimal` (not a
 *     percentage — a plain ratio), `null` when costs are zero/absent.
 *   - `actual_npv` is left `null` — Actual entries have no fixed period grid
 *     the way a CalculationRun's `periodSeries` does (entries can land on
 *     arbitrary, possibly overlapping period_start/period_end ranges), and
 *     no source doc specifies how to discount irregular actual cash flows.
 *     Fabricating a period grid here risks a silently wrong number — the
 *     same "honest missing over fabricated" rule `RoiBaseline`'s nullable
 *     fields already establish for this program. Filed as a backlog item in
 *     EXECUTION_LEDGER.md's closure entry for whoever designs ROI-E005/E006
 *     next, rather than silently guessed at.
 *   - `periods_with_actual_count` / `periods_expected_count` /
 *     `coverage_pct`: counts distinct `(period_start, period_end)` pairs
 *     among the entries included versus the number of periods the case's
 *     own `analysisStart`..min(`analysisEnd`, `asOfPeriodEnd`) window spans
 *     at the case's `granularity` — local re-implementation of the same
 *     period-count math `roiCalculationEngine.ts`'s (private)
 *     `computePeriodCount` uses, since that helper is not exported and this
 *     command has no other reason to import engine internals.
 */
import { randomUUID } from 'node:crypto';

import type { PoolClient } from 'pg';

import { computeStateHash } from '../kpi/kpiDefinitionCommands.js';
import { executeAtomicCommand, type AtomicCommandOutcome, type AtomicEventInput } from '../platform/atomicWrite.js';

import { ROI_EVENT_SOURCE, ROI_TRACKING_ACTIVE_STATUSES } from './roiCaseCommands.js';
import { toDateOnlyString } from './roiCalculationRunCommands.js';
// Reuses roiActualEntryCommands.ts's own validation error class for this
// command's status guard, rather than introducing a 7th error class beyond
// the 6 the design doc's §6 explicitly enumerates for handleRoiRouteError —
// both represent the identical "case not in a trackable status" family of
// failure.
import { RoiActualEntryValidationError } from './roiActualEntryCommands.js';
import { toRoiActualSnapshot, type RoiActualSnapshot, type RoiActualSnapshotRow } from './roiForecastActualTypes.js';
import type { RoiCaseGranularity, RoiCaseRow } from './roiTypes.js';

// ==========================================
// SHARED ROW LOADER
// ==========================================

async function loadRoiCaseForUpdate(
  client: PoolClient,
  caseId: string,
  organizationId: string
): Promise<RoiCaseRow | undefined> {
  const result = await client.query<RoiCaseRow>(
    `SELECT * FROM rvn_roi_cases WHERE case_id = $1 AND organization_id = $2 FOR UPDATE`,
    [caseId, organizationId]
  );
  return result.rows[0];
}

function caseRowVersion(row: RoiCaseRow): number {
  return row.row_version;
}

// ==========================================
// LOCAL PERIOD-COUNT HELPER — see file header's documented deviation.
// ==========================================

function parseIsoDateLocal(dateStr: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!match) {
    throw new Error(`[roiActualSnapshotCommands] invalid DATE string "${dateStr}"`);
  }
  return { year: Number(match[1]), month: Number(match[2]) };
}

function countPeriodsInclusive(startStr: string, endStr: string, granularity: RoiCaseGranularity): number {
  const s = parseIsoDateLocal(startStr);
  const e = parseIsoDateLocal(endStr);
  if (granularity === 'monthly') {
    return Math.max(1, (e.year * 12 + e.month) - (s.year * 12 + s.month) + 1);
  }
  return Math.max(1, e.year - s.year + 1);
}

function minDateString(a: string, b: string): string {
  return a <= b ? a : b;
}

// ==========================================
// publishRoiActualSnapshot
// ==========================================

export interface PublishRoiActualSnapshotInput {
  caseId: string;
  organizationId: string;
  expectedVersion: number;
  asOfPeriodEnd: string;
  publishedBy: string;
  actorEffectiveRole: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  reason?: string | null;
}

export async function publishRoiActualSnapshot(
  input: PublishRoiActualSnapshotInput
): Promise<AtomicCommandOutcome<RoiActualSnapshot>> {
  const {
    caseId,
    organizationId,
    expectedVersion,
    asOfPeriodEnd,
    publishedBy,
    actorEffectiveRole,
    idempotencyKey,
    correlationId,
    causationId = null,
    reason = null,
  } = input;

  return executeAtomicCommand<RoiCaseRow, RoiActualSnapshot>({
    organizationId,
    aggregateId: caseId,
    expectedVersion,
    loadForUpdate: loadRoiCaseForUpdate,
    getCurrentVersion: caseRowVersion,
    applyMutation: async (client, currentRow, nextVersion) => {
      // Decision D3: Actual writes (including publishing a rollup snapshot)
      // require ROI_TRACKING_ACTIVE_STATUSES specifically.
      if (!ROI_TRACKING_ACTIVE_STATUSES.includes(currentRow.status)) {
        throw new RoiActualEntryValidationError(
          `ROI case ${caseId} is "${currentRow.status}" — an actual snapshot may only be published while the case is tracking`,
          'CASE_NOT_TRACKABLE',
          { caseId, status: currentRow.status }
        );
      }

      // Current (non-superseded) entries, as of asOfPeriodEnd — same NOT
      // EXISTS "leaf of chain" pattern roiActualEntryRepository.ts uses.
      const entriesResult = await client.query<{
        actual_entry_id: string;
        entry_type: 'cost' | 'benefit' | 'observation';
        amount: string | null;
        data_quality_status: 'unverified' | 'verified' | 'disputed' | 'estimated';
        period_start: string;
        period_end: string;
        is_financial: boolean | null;
      }>(
        `SELECT e.actual_entry_id, e.entry_type, e.amount, e.data_quality_status,
                e.period_start, e.period_end, bl.is_financial
           FROM rvn_roi_actual_entries e
           LEFT JOIN rvn_roi_benefit_lines bl ON bl.benefit_line_id = e.benefit_line_id
          WHERE e.case_id = $1 AND e.organization_id = $2
            AND e.period_end <= $3
            AND NOT EXISTS (
              SELECT 1 FROM rvn_roi_actual_entries newer
               WHERE newer.correction_of_actual_entry_id = e.actual_entry_id
            )
          ORDER BY e.actual_entry_id`,
        [caseId, organizationId, asOfPeriodEnd]
      );

      let totalActualCosts = 0;
      let totalActualFinancialBenefits = 0;
      let unverifiedEntryCount = 0;
      let disputedEntryCount = 0;
      const entryIdsIncluded: string[] = [];
      const periodKeys = new Set<string>();

      for (const row of entriesResult.rows) {
        entryIdsIncluded.push(row.actual_entry_id);
        periodKeys.add(`${row.period_start}|${row.period_end}`);
        if (row.data_quality_status === 'unverified') unverifiedEntryCount += 1;
        if (row.data_quality_status === 'disputed') disputedEntryCount += 1;

        const amount = row.amount === null ? null : Number(row.amount);
        if (amount === null) continue;
        if (row.entry_type === 'cost') {
          totalActualCosts += amount;
        } else if (row.entry_type === 'benefit' && row.is_financial) {
          totalActualFinancialBenefits += amount;
        }
      }

      const actualSimpleRoi = totalActualCosts > 0 ? (totalActualFinancialBenefits - totalActualCosts) / totalActualCosts : null;

      const analysisStart = toDateOnlyString(currentRow.analysis_start);
      const analysisEnd = toDateOnlyString(currentRow.analysis_end);
      let periodsExpectedCount = 0;
      if (analysisStart && analysisEnd) {
        const cappedEnd = minDateString(analysisEnd, asOfPeriodEnd);
        periodsExpectedCount = cappedEnd >= analysisStart ? countPeriodsInclusive(analysisStart, cappedEnd, currentRow.granularity) : 0;
      }
      const periodsWithActualCount = periodKeys.size;
      const coveragePct = periodsExpectedCount > 0 ? (periodsWithActualCount / periodsExpectedCount) * 100 : null;

      const sequenceResult = await client.query<{ next_sequence: string }>(
        `SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_sequence
           FROM rvn_roi_actual_snapshots WHERE case_id = $1`,
        [caseId]
      );
      const sequenceNumber = Number(sequenceResult.rows[0]?.next_sequence ?? 1);

      const insertResult = await client.query<RoiActualSnapshotRow>(
        `INSERT INTO rvn_roi_actual_snapshots (
           case_id, organization_id, sequence_number, as_of_period_end, published_by,
           total_actual_costs, total_actual_financial_benefits, actual_simple_roi, actual_npv,
           periods_with_actual_count, periods_expected_count, coverage_pct,
           unverified_entry_count, disputed_entry_count, entry_ids_included
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [
          caseId,
          organizationId,
          sequenceNumber,
          asOfPeriodEnd,
          publishedBy,
          entriesResult.rows.length ? totalActualCosts : null,
          entriesResult.rows.length ? totalActualFinancialBenefits : null,
          actualSimpleRoi,
          periodsWithActualCount,
          periodsExpectedCount,
          coveragePct,
          unverifiedEntryCount,
          disputedEntryCount,
          JSON.stringify(entryIdsIncluded),
        ]
      );
      const snapshotRow = insertResult.rows[0];
      if (!snapshotRow) {
        throw new Error('[publishRoiActualSnapshot] insert into rvn_roi_actual_snapshots returned no row');
      }

      await client.query(
        `UPDATE rvn_roi_cases SET current_actual_snapshot_id = $1, row_version = $2, updated_by = $3, updated_at = now()
          WHERE case_id = $4`,
        [snapshotRow.actual_snapshot_id, nextVersion, publishedBy, caseId]
      );

      return toRoiActualSnapshot(snapshotRow);
    },
    buildEvent: ({ result, nextVersion }) => {
      const afterState: Record<string, unknown> = { actualSnapshot: result };
      return {
        schemaVersion: 1,
        eventType: 'roi.actual_snapshot_published',
        aggregateType: 'roi_case',
        aggregateId: caseId,
        organizationId,
        actorUserId: publishedBy,
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
        source: ROI_EVENT_SOURCE,
        idempotencyKey,
        expectedVersion,
        resultingVersion: nextVersion,
        payload: { caseId, actualSnapshotId: result.actualSnapshotId, sequenceNumber: result.sequenceNumber },
      } satisfies AtomicEventInput;
    },
  });
}
