/**
 * RN-G6 Outbox Dispatcher — `finance_projection` consumer.
 *
 * Design: docs/product/results-vnext/RN_G6_FINANCE_PROJECTION_DESIGN.md
 * (FROZEN, six binding Integration Owner rulings IO-F1..IO-F6 in §1).
 * Second consumer built against the landed RN-G3 dispatcher — the
 * dispatcher itself (`outboxDrain.ts`/`platformOutboxDrainCron.ts`) needed
 * ZERO changes; this file, one line in `consumerRegistry.ts`, and removing
 * `'finance_projection'` from `UNBUILT_CONSUMER_GROUPS` are the whole diff.
 *
 * ==========================================================================
 * IO-F6 — TWO-LAYER TRANSACTION SHAPE (verbatim from the frozen design,
 * §1 IO-F6 + §6, preserved here per the ruling's own instruction: "the
 * reasoning must be preserved verbatim in the implementation file's
 * header" — this is the ONE place this consumer differs structurally from
 * `myworkProjectionConsumer.ts`'s single-transaction precedent, and it must
 * be visible to a reviewer, not discovered later):
 *
 *   "The deviation is forced and correct: openRoiFinanceReconciliation is
 *   an executeAtomicCreate call with its own idempotency-key guard, so it
 *   cannot and need not be inlined into the outer transaction. Both layers
 *   are independently safe under redelivery."
 *
 *   - Layer 1 (dispatcher's per-row transaction, passed-in `client`): the
 *     `rvn_platform_consumer_processed` claim + the projection upsert.
 *   - Layer 2 (separate connection, only on divergence):
 *     `openRoiFinanceReconciliation`, guarded by its own deterministic
 *     idempotency key `finance-projection-divergence:${event_id}:${link_id}`.
 *
 *   If Layer 1 rolls back after Layer 2 committed, redelivery re-runs both:
 *   the claim re-inserts cleanly and Layer 2 hits its own `ON CONFLICT DO
 *   NOTHING`, returning `duplicate` — no second reconciliation, no
 *   exception. Independently safe without being one physical transaction.
 *
 * The projection-specific command entrypoint keeps the same two-layer shape:
 * its `executeAtomicCreate` call genuinely opens a
 * SEPARATE connection from the one this file's caller (the dispatcher) has
 * pinned for the outer per-row transaction; there is no way to hand it the
 * outer `client` even if the file were edited to accept one, because
 * `executeAtomicCreate`'s own idempotency guard (INSERT ... ON CONFLICT DO
 * NOTHING on `rvn_platform_events`) needs its own commit boundary to be
 * meaningful under redelivery — exactly what Layer 2 is.
 *
 * The internal entrypoint supplies the fixed non-human actor itself and
 * verifies the exact persisted tenant/case source event before mutation.
 * Public/human callers remain on the ordinary command, whose ACTIVE
 * membership and capability checks are unchanged.
 *
 * Idempotency (design §5, mirrors myworkProjectionConsumer.ts's own guard):
 * `rvn_platform_consumer_processed` is checked/claimed FIRST via `ON
 * CONFLICT DO NOTHING`, before any other write. No row returned = already
 * processed by this consumer group = expected no-op success under
 * at-least-once redelivery, not an error.
 *
 * IO-F1/IO-F2/IO-F3/IO-F4/IO-F5 are implemented literally — see the
 * per-function comments below for where each applies. None of them are
 * "resolved": IO-F1's owner and IO-F2's threshold are explicitly left
 * unbuilt/unset (see EXECUTION_LEDGER.md's closure entry for this
 * package), not silently decided here.
 */
import type { PoolClient } from 'pg';

import logger from '../../../utils/Logger.js';
import { ROI_COMPARE_METRICS, type RoiCompareMetric } from '../roi/roiCompareRepository.js';
import {
  FINANCE_PROJECTION_RECONCILIATION_ACTOR,
  openRoiFinanceReconciliationFromProjection,
} from '../roi/roiFinanceReconciliationCommands.js';

import type { RvnOutboxRow } from './outboxDrain.js';
import type { RvnPlatformEventRow } from './consumerRegistry.js';

const CONSUMER_GROUP = 'finance_projection';

/**
 * IO-F6 (§5.4): "a direct reuse of okrDecisionResolutionScanner.ts's landed
 * precedent, not a new pattern." No human triggers a divergence-detection
 * reconciliation — this consumer is the sole caller, always with this
 * identity. See the file header for why this is passed as `actorUserId`
 * rather than the ruling's literal `null`.
 */
export const FINANCE_PROJECTION_CONSUMER_ACTOR = FINANCE_PROJECTION_RECONCILIATION_ACTOR;

function isRoiCompareMetric(value: string): value is RoiCompareMetric {
  return (ROI_COMPARE_METRICS as readonly string[]).includes(value);
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

function requirePayloadString(event: RvnPlatformEventRow, key: string): string {
  const value = (event.payload as Record<string, unknown> | null)?.[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `[financeProjectionConsumer] event ${event.event_id} (${event.event_type}) missing required payload.${key}`
    );
  }
  return value;
}

// ==========================================
// Source-figure resolution (§3 — every figure carries its lineage;
// source_id is always the EVENT's own payload id, never a fresh pointer
// lookup on rvn_roi_cases — the three source tables are immutable, so the
// payload id can never go stale, and this avoids racing a later event that
// already moved the case's pointer forward).
// ==========================================

interface ResolvedFigure {
  value: number;
  sourceKind: 'approval_snapshot' | 'forecast_version' | 'actual_snapshot';
  sourceId: string;
  sourceSequenceNumber: number;
}

/** §3: `rvn_roi_approval_snapshots.snapshot_payload->'decisionCalculationRun'->>tracked_metric`. */
async function readApprovalSnapshotFigure(
  client: PoolClient,
  params: { snapshotId: string; caseId: string; organizationId: string; metric: RoiCompareMetric }
): Promise<ResolvedFigure | null> {
  const result = await client.query<{
    sequence_number: number;
    snapshot_payload: { decisionCalculationRun: Record<string, number | null> };
  }>(
    `SELECT sequence_number, snapshot_payload FROM rvn_roi_approval_snapshots
      WHERE snapshot_id = $1 AND case_id = $2 AND organization_id = $3`,
    [params.snapshotId, params.caseId, params.organizationId]
  );
  const row = result.rows[0];
  if (!row) return null;
  const value = row.snapshot_payload.decisionCalculationRun[params.metric];
  if (value === null || value === undefined) return null;
  return {
    value,
    sourceKind: 'approval_snapshot',
    sourceId: params.snapshotId,
    sourceSequenceNumber: row.sequence_number,
  };
}

/** §3: `rvn_roi_forecast_versions.<metric column>`. Same column-mapping shape
 * `roiVarianceCommands.ts`'s `readScopedMetricValue` already uses for the
 * 'forecast' scope — not re-derived, just re-expressed for this consumer's
 * own query shape. */
async function readForecastVersionFigure(
  client: PoolClient,
  params: { forecastVersionId: string; caseId: string; organizationId: string; metric: RoiCompareMetric }
): Promise<ResolvedFigure | null> {
  const result = await client.query<{
    sequence_number: number;
    npv: string | null;
    simple_roi: string | null;
    total_costs: string | null;
    total_financial_benefits: string | null;
    payback_periods: string | null;
  }>(
    `SELECT sequence_number, npv, simple_roi, total_costs, total_financial_benefits, payback_periods
       FROM rvn_roi_forecast_versions
      WHERE forecast_version_id = $1 AND case_id = $2 AND organization_id = $3`,
    [params.forecastVersionId, params.caseId, params.organizationId]
  );
  const row = result.rows[0];
  if (!row) return null;
  const columnByMetric: Record<RoiCompareMetric, string | null> = {
    npv: row.npv,
    simpleRoi: row.simple_roi,
    totalCosts: row.total_costs,
    totalFinancialBenefits: row.total_financial_benefits,
    paybackPeriods: row.payback_periods,
  };
  const raw = columnByMetric[params.metric];
  if (raw === null) return null;
  return {
    value: Number(raw),
    sourceKind: 'forecast_version',
    sourceId: params.forecastVersionId,
    sourceSequenceNumber: row.sequence_number,
  };
}

/** §3: `rvn_roi_actual_snapshots.<actual_* column>` — "`paybackPeriods`
 * unavailable for this source — the table has no payback column."
 * `roiVarianceCommands.ts`'s `readScopedMetricValue` handles the identical
 * gap by THROWING `RoiVarianceValidationError('METRIC_NOT_AVAILABLE_FOR_
 * ACTUAL')` back to a human caller over HTTP. There is no human here — this
 * runs inside an async, at-least-once outbox dispatch, and throwing would
 * dead-letter and CRITICAL-alert an otherwise perfectly healthy event for
 * every case that happens to track paybackPeriods. So this returns `null`
 * instead: an honest "no figure available from this source," never a
 * fabricated value and never a swallowed real error (a genuine DB error
 * from the query below still propagates normally). */
async function readActualSnapshotFigure(
  client: PoolClient,
  params: { actualSnapshotId: string; caseId: string; organizationId: string; metric: RoiCompareMetric }
): Promise<ResolvedFigure | null> {
  if (params.metric === 'paybackPeriods') {
    logger.debug(
      '[resultsVnext/platform/financeProjectionConsumer] paybackPeriods has no Actual value — rvn_roi_actual_snapshots stores no payback_periods column (documented gap, roiVarianceCommands.ts precedent)',
      { actualSnapshotId: params.actualSnapshotId, caseId: params.caseId }
    );
    return null;
  }
  const result = await client.query<{
    sequence_number: number;
    actual_npv: string | null;
    actual_simple_roi: string | null;
    total_actual_costs: string | null;
    total_actual_financial_benefits: string | null;
  }>(
    `SELECT sequence_number, actual_npv, actual_simple_roi, total_actual_costs, total_actual_financial_benefits
       FROM rvn_roi_actual_snapshots
      WHERE actual_snapshot_id = $1 AND case_id = $2 AND organization_id = $3`,
    [params.actualSnapshotId, params.caseId, params.organizationId]
  );
  const row = result.rows[0];
  if (!row) return null;
  const columnByMetric: Record<Exclude<RoiCompareMetric, 'paybackPeriods'>, string | null> = {
    npv: row.actual_npv,
    simpleRoi: row.actual_simple_roi,
    totalCosts: row.total_actual_costs,
    totalFinancialBenefits: row.total_actual_financial_benefits,
  };
  const raw = columnByMetric[params.metric as Exclude<RoiCompareMetric, 'paybackPeriods'>];
  if (raw === null) return null;
  return {
    value: Number(raw),
    sourceKind: 'actual_snapshot',
    sourceId: params.actualSnapshotId,
    sourceSequenceNumber: row.sequence_number,
  };
}

// ==========================================
// Case context (status/currency/current pointers) — read fresh on every
// event so `case_status` on the projection row is always accurate and
// self-healing, never hard-coded per event type.
// ==========================================

interface CaseProjectionContext {
  status: string;
  currency: string;
  latestApprovedSnapshotId: string | null;
  currentForecastVersionId: string | null;
  currentActualSnapshotId: string | null;
}

async function readCaseProjectionContext(
  client: PoolClient,
  caseId: string,
  organizationId: string
): Promise<CaseProjectionContext> {
  const result = await client.query<{
    status: string;
    currency: string;
    latest_approved_snapshot_id: string | null;
    current_forecast_version_id: string | null;
    current_actual_snapshot_id: string | null;
  }>(
    `SELECT status, currency, latest_approved_snapshot_id, current_forecast_version_id, current_actual_snapshot_id
       FROM rvn_roi_cases WHERE case_id = $1 AND organization_id = $2`,
    [caseId, organizationId]
  );
  const row = result.rows[0];
  if (!row) {
    // rvn_platform_events.aggregate_id for every one of this consumer's
    // event types is a real roi_case with a NOT NULL FK chain behind it —
    // unreachable in practice. Throw rather than silently skip (design
    // proof 8: "No silent failure... no swallow-and-continue path anywhere
    // in the consumer").
    throw new Error(
      `[financeProjectionConsumer] rvn_roi_cases row not found for case ${caseId} org ${organizationId}`
    );
  }
  return {
    status: row.status,
    currency: row.currency,
    latestApprovedSnapshotId: row.latest_approved_snapshot_id,
    currentForecastVersionId: row.current_forecast_version_id,
    currentActualSnapshotId: row.current_actual_snapshot_id,
  };
}

/** IO-F5: seed priority actual > forecast > approved, for `roi.finance_
 * link_created` only — the ONE place this consumer reads the case's
 * CURRENT pointer columns instead of an event payload id, because the
 * `finance_link_created` event payload carries no snapshot/forecast/actual
 * id at all (`{ caseId, linkId }`) — there is nothing else to seed from. */
async function resolveSeedFigure(
  client: PoolClient,
  params: { caseId: string; organizationId: string; metric: RoiCompareMetric; caseContext: CaseProjectionContext }
): Promise<ResolvedFigure | null> {
  const { caseId, organizationId, metric, caseContext } = params;
  if (caseContext.currentActualSnapshotId) {
    const figure = await readActualSnapshotFigure(client, {
      actualSnapshotId: caseContext.currentActualSnapshotId,
      caseId,
      organizationId,
      metric,
    });
    if (figure) return figure;
  }
  if (caseContext.currentForecastVersionId) {
    const figure = await readForecastVersionFigure(client, {
      forecastVersionId: caseContext.currentForecastVersionId,
      caseId,
      organizationId,
      metric,
    });
    if (figure) return figure;
  }
  if (caseContext.latestApprovedSnapshotId) {
    const figure = await readApprovalSnapshotFigure(client, {
      snapshotId: caseContext.latestApprovedSnapshotId,
      caseId,
      organizationId,
      metric,
    });
    if (figure) return figure;
  }
  return null;
}

// ==========================================
// Divergence + reconciliation (§4/§5)
// ==========================================

interface ReconciliationMirror {
  status: string;
  reconciliationId: string;
}

async function findOpenReconciliation(client: PoolClient, financeLinkId: string): Promise<ReconciliationMirror | null> {
  const result = await client.query<{ reconciliation_id: string; status: string }>(
    `SELECT reconciliation_id, status FROM rvn_roi_finance_reconciliations
      WHERE finance_link_id = $1 AND status IN ('open','investigating')
      ORDER BY opened_at DESC LIMIT 1`,
    [financeLinkId]
  );
  const row = result.rows[0];
  return row ? { status: row.status, reconciliationId: row.reconciliation_id } : null;
}

/**
 * §5. Preconditions (IO-F1): only called when BOTH `tracked_metric` and
 * `pinned_finance_value` are non-null for this link — callers gate on that
 * before invoking this function; "nothing to diverge against" is handled
 * upstream, not here.
 *
 * 1. Currency check first (§4) — mismatch alone is a divergence, NO numeric
 *    comparison attempted (mirrors `roiCalculationEngine.ts`'s own policy of
 *    hard-failing mixed currency rather than silently converting).
 * 2. Otherwise exact `IS DISTINCT FROM` on NUMERIC, computed IN SQL (not a
 *    JS `!==`) so the comparison runs against the genuine NUMERIC values,
 *    not a JS-float round-trip of them. IO-F2: no tolerance band — do not
 *    add one, however useful it might look.
 * 3. §5.3 guard 1 (application level): an already-open/investigating
 *    reconciliation for this link short-circuits — never a second one.
 * 4. §5.3 guard 2 (DB level, race backstop): a unique-violation on
 *    `ux_rvn_roi_finance_reconciliations_one_open_per_link` from a
 *    concurrent worker is caught and treated as "already opened," then the
 *    winning row is re-read — never surfaced as a dispatch failure.
 */
async function checkAndOpenDivergence(
  client: PoolClient,
  params: {
    link: { link_id: string; pinned_finance_value: string; currency: string | null };
    caseId: string;
    organizationId: string;
    roiValue: number;
    resultsActualSnapshotId: string;
    resultsActualMetric: Exclude<RoiCompareMetric, 'paybackPeriods'>;
    caseCurrency: string;
    eventId: string;
  }
): Promise<ReconciliationMirror | null> {
  const { link, caseId, organizationId, roiValue, resultsActualSnapshotId, resultsActualMetric, caseCurrency, eventId } = params;
  const pinnedValue = Number(link.pinned_finance_value);

  let divergenceReason: string | null = null;
  let isDivergent: boolean;

  if (link.currency !== null && link.currency !== caseCurrency) {
    isDivergent = true;
    divergenceReason = 'currency_mismatch';
  } else {
    const cmp = await client.query<{ is_distinct: boolean }>(
      `SELECT ($1::numeric IS DISTINCT FROM $2::numeric) AS is_distinct`,
      [roiValue, pinnedValue]
    );
    isDivergent = cmp.rows[0]?.is_distinct ?? false;
  }

  if (!isDivergent) return null;

  const existing = await findOpenReconciliation(client, link.link_id);
  if (existing) return existing;

  try {
    // Layer 2 — see file header. Separate connection, own idempotency key.
    await openRoiFinanceReconciliationFromProjection({
      caseId,
      organizationId,
      financeLinkId: link.link_id,
      resultsActualSnapshotId,
      resultsActualMetric,
      roiValue,
      financeValue: pinnedValue,
      divergenceReason,
      idempotencyKey: `finance-projection-divergence:${eventId}:${link.link_id}`,
      sourceEventId: eventId,
    });
    // Deliberately NOT trusting `outcome.result` here even on 'applied' —
    // re-reading below is the single code path for both 'applied' and
    // 'duplicate' outcomes (see next comment) and stays correct either way.
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // §5.3 guard 2 — fall through to the re-read below.
  }

  // Re-read rather than trust `openRoiFinanceReconciliation`'s own return
  // value: on a 'duplicate' outcome (this exact idempotency key already
  // committed in a prior delivery attempt), `executeAtomicCreate` falls
  // back to casting the stored event's `after_state` — which for THIS
  // event is `{ reconciliation: {...} }`, not the bare `RoiFinanceReconciliation`
  // the cast claims — so `.status`/`.reconciliationId` would read
  // `undefined` off that path. Re-querying the table directly is correct
  // for 'applied', 'duplicate', and the caught-race case uniformly.
  const winner = await findOpenReconciliation(client, link.link_id);
  if (!winner) {
    throw new Error(
      `[financeProjectionConsumer] expected an open/investigating reconciliation for link ${link.link_id} after openRoiFinanceReconciliation, found none`
    );
  }
  return winner;
}

// ==========================================
// Projection upsert (Layer 1)
// ==========================================

async function upsertFinanceProjectionRow(
  client: PoolClient,
  params: {
    financeLinkId: string;
    caseId: string;
    organizationId: string;
    caseStatus: string;
    trackedMetric: string | null;
    figure: ResolvedFigure | null;
    currency: string | null;
    reconciliation: ReconciliationMirror | null;
  }
): Promise<void> {
  const { financeLinkId, caseId, organizationId, caseStatus, trackedMetric, figure, currency, reconciliation } =
    params;
  await client.query(
    `INSERT INTO rvn_roi_finance_projections (
       finance_link_id, case_id, organization_id, case_status, is_link_active,
       tracked_metric, roi_value, roi_value_currency, source_kind, source_id, source_sequence_number,
       reconciliation_status, last_reconciliation_id, projected_at, updated_at
     ) VALUES ($1,$2,$3,$4,true,$5,$6,$7,$8,$9,$10,$11,$12, now(), now())
     ON CONFLICT (finance_link_id) DO UPDATE SET
       case_status = excluded.case_status,
       is_link_active = true,
       tracked_metric = COALESCE(excluded.tracked_metric, rvn_roi_finance_projections.tracked_metric),
       roi_value = COALESCE(excluded.roi_value, rvn_roi_finance_projections.roi_value),
       roi_value_currency = COALESCE(excluded.roi_value_currency, rvn_roi_finance_projections.roi_value_currency),
       source_kind = COALESCE(excluded.source_kind, rvn_roi_finance_projections.source_kind),
       source_id = COALESCE(excluded.source_id, rvn_roi_finance_projections.source_id),
       source_sequence_number = COALESCE(excluded.source_sequence_number, rvn_roi_finance_projections.source_sequence_number),
       reconciliation_status = COALESCE(excluded.reconciliation_status, rvn_roi_finance_projections.reconciliation_status),
       last_reconciliation_id = COALESCE(excluded.last_reconciliation_id, rvn_roi_finance_projections.last_reconciliation_id),
       updated_at = now()`,
    [
      financeLinkId,
      caseId,
      organizationId,
      caseStatus,
      trackedMetric,
      figure?.value ?? null,
      figure ? currency : null,
      figure?.sourceKind ?? null,
      figure?.sourceId ?? null,
      figure?.sourceSequenceNumber ?? null,
      reconciliation?.status ?? null,
      reconciliation?.reconciliationId ?? null,
    ]
  );
}

async function syncCaseStatusOnAllProjections(
  client: PoolClient,
  caseId: string,
  organizationId: string,
  caseStatus: string
): Promise<void> {
  await client.query(
    `UPDATE rvn_roi_finance_projections SET case_status = $1, updated_at = now()
      WHERE case_id = $2 AND organization_id = $3`,
    [caseStatus, caseId, organizationId]
  );
}

/** §7: any event that carries a new ROI figure applies it to EVERY link
 * currently on the case (§2: "one row per active link" — a case may carry
 * several links with different purposes), not just one. A link whose
 * `tracked_metric` is NULL still gets its `case_status` synced (IO-F1:
 * "maintain lifecycle... only" when there is nothing to diverge against or
 * even track) but no figure/divergence work. */
async function applyFigureToAllLinks(
  client: PoolClient,
  params: {
    caseId: string;
    organizationId: string;
    eventId: string;
    caseContext: CaseProjectionContext;
    resolveFigure: (metric: RoiCompareMetric) => Promise<ResolvedFigure | null>;
  }
): Promise<void> {
  const { caseId, organizationId, eventId, caseContext, resolveFigure } = params;
  const links = await client.query<{
    link_id: string;
    tracked_metric: string | null;
    pinned_finance_value: string | null;
    currency: string | null;
  }>(
    `SELECT link_id, tracked_metric, pinned_finance_value, currency
       FROM rvn_roi_finance_links WHERE case_id = $1 AND organization_id = $2`,
    [caseId, organizationId]
  );

  for (const link of links.rows) {
    let figure: ResolvedFigure | null = null;
    let reconciliation: ReconciliationMirror | null = null;

    if (link.tracked_metric !== null && isRoiCompareMetric(link.tracked_metric)) {
      figure = await resolveFigure(link.tracked_metric);
      if (figure?.sourceKind === 'actual_snapshot' && link.pinned_finance_value !== null && link.tracked_metric !== 'paybackPeriods') {
        reconciliation = await checkAndOpenDivergence(client, {
          link: { link_id: link.link_id, pinned_finance_value: link.pinned_finance_value, currency: link.currency },
          caseId,
          organizationId,
          roiValue: figure.value,
          resultsActualSnapshotId: figure.sourceId,
          resultsActualMetric: link.tracked_metric,
          caseCurrency: caseContext.currency,
          eventId,
        });
      }
    }

    await upsertFinanceProjectionRow(client, {
      financeLinkId: link.link_id,
      caseId,
      organizationId,
      caseStatus: caseContext.status,
      trackedMetric: link.tracked_metric,
      figure,
      currency: caseContext.currency,
      reconciliation,
    });
  }
}

// ==========================================
// roi.finance_link_created / roi.finance_link_removed / reconciliation
// mirror (§7)
// ==========================================

async function handleFinanceLinkCreated(
  client: PoolClient,
  params: { caseId: string; organizationId: string; linkId: string; eventId: string }
): Promise<void> {
  const { caseId, organizationId, linkId, eventId } = params;
  const caseContext = await readCaseProjectionContext(client, caseId, organizationId);

  const linkResult = await client.query<{
    tracked_metric: string | null;
    pinned_finance_value: string | null;
    currency: string | null;
  }>(
    `SELECT tracked_metric, pinned_finance_value, currency
       FROM rvn_roi_finance_links WHERE link_id = $1 AND case_id = $2 AND organization_id = $3`,
    [linkId, caseId, organizationId]
  );
  const link = linkResult.rows[0];
  if (!link) {
    // rvn_roi_finance_reconciliations/this event's own aggregate imply the
    // link row was just committed in the SAME atomic transaction that
    // produced this event — unreachable in practice.
    throw new Error(`[financeProjectionConsumer] rvn_roi_finance_links row not found for link ${linkId}`);
  }

  let figure: ResolvedFigure | null = null;
  let reconciliation: ReconciliationMirror | null = null;

  // IO-F4: tracked_metric is never parsed out of link_purpose or backfilled
  // — either the caller supplied it at creation (this column read below) or
  // it stays NULL forever for this link.
  if (link.tracked_metric !== null && isRoiCompareMetric(link.tracked_metric)) {
    // IO-F5: seed priority actual > forecast > approved.
    figure = await resolveSeedFigure(client, { caseId, organizationId, metric: link.tracked_metric, caseContext });
    if (figure?.sourceKind === 'actual_snapshot' && link.pinned_finance_value !== null && link.tracked_metric !== 'paybackPeriods') {
      reconciliation = await checkAndOpenDivergence(client, {
        link: { link_id: linkId, pinned_finance_value: link.pinned_finance_value, currency: link.currency },
        caseId,
        organizationId,
        roiValue: figure.value,
        resultsActualSnapshotId: figure.sourceId,
        resultsActualMetric: link.tracked_metric,
        caseCurrency: caseContext.currency,
        eventId,
      });
    }
  }

  await upsertFinanceProjectionRow(client, {
    financeLinkId: linkId,
    caseId,
    organizationId,
    caseStatus: caseContext.status,
    trackedMetric: link.tracked_metric,
    figure,
    currency: caseContext.currency,
    reconciliation,
  });
}

/** §7: "is_link_active = false (history retained)" — a plain UPDATE, never
 * a DELETE. The underlying `rvn_roi_finance_links` row is ALREADY hard-
 * deleted by `removeRoiFinanceLink` by the time this event dispatches (same
 * atomic transaction that produced the event) — see the migration's header
 * for why this table's FK to that one was deliberately dropped rather than
 * left blocking that DELETE. */
async function handleFinanceLinkRemoved(client: PoolClient, linkId: string): Promise<void> {
  await client.query(
    `UPDATE rvn_roi_finance_projections SET is_link_active = false, updated_at = now()
      WHERE finance_link_id = $1`,
    [linkId]
  );
}

/** §7: "Mirror status + id" for `roi.finance_reconciliation_opened`/
 * `_resolved` — both events' payload is `{ caseId, reconciliationId }` (no
 * `financeLinkId`), so this re-reads the reconciliation row itself to learn
 * which link it belongs to. Covers reconciliations opened via the HTTP
 * route (`POST .../finance-reconciliations`, a human/Finance-triggered
 * open) in addition to the ones this consumer opens itself in
 * `checkAndOpenDivergence` — the latter already mirrors status/id directly
 * at open time, so this handler re-applies the identical values when its
 * OWN follow-up event later dispatches; idempotent, harmless. */
async function mirrorReconciliationStatus(client: PoolClient, reconciliationId: string): Promise<void> {
  const result = await client.query<{ finance_link_id: string; status: string }>(
    `SELECT finance_link_id, status FROM rvn_roi_finance_reconciliations WHERE reconciliation_id = $1`,
    [reconciliationId]
  );
  const row = result.rows[0];
  if (!row) {
    logger.warn(
      '[resultsVnext/platform/financeProjectionConsumer] reconciliation row not found for mirror update — skipping',
      { reconciliationId }
    );
    return;
  }
  await client.query(
    `UPDATE rvn_roi_finance_projections SET reconciliation_status = $1, last_reconciliation_id = $2, updated_at = now()
      WHERE finance_link_id = $3`,
    [row.status, reconciliationId, row.finance_link_id]
  );
}

// ==========================================
// Public entrypoint (consumerRegistry.ts's ConsumerFn)
// ==========================================

export async function dispatchFinanceProjection(
  client: PoolClient,
  event: RvnPlatformEventRow,
  _outboxRow: RvnOutboxRow
): Promise<void> {
  // Layer 1 idempotency guard — see file header.
  const claim = await client.query<{ event_id: string }>(
    `INSERT INTO rvn_platform_consumer_processed (consumer_group, event_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING event_id`,
    [CONSUMER_GROUP, event.event_id]
  );
  if (claim.rowCount === 0) {
    return;
  }

  const caseId = event.aggregate_id;
  const organizationId = event.organization_id;

  switch (event.event_type) {
    case 'roi.case_approved': {
      const snapshotId = requirePayloadString(event, 'snapshotId');
      const caseContext = await readCaseProjectionContext(client, caseId, organizationId);
      await applyFigureToAllLinks(client, {
        caseId,
        organizationId,
        eventId: event.event_id,
        caseContext,
        resolveFigure: (metric) => readApprovalSnapshotFigure(client, { snapshotId, caseId, organizationId, metric }),
      });
      break;
    }
    case 'roi.forecast_published': {
      const forecastVersionId = requirePayloadString(event, 'forecastVersionId');
      const caseContext = await readCaseProjectionContext(client, caseId, organizationId);
      await applyFigureToAllLinks(client, {
        caseId,
        organizationId,
        eventId: event.event_id,
        caseContext,
        resolveFigure: (metric) =>
          readForecastVersionFigure(client, { forecastVersionId, caseId, organizationId, metric }),
      });
      break;
    }
    case 'roi.actual_snapshot_published': {
      const actualSnapshotId = requirePayloadString(event, 'actualSnapshotId');
      const caseContext = await readCaseProjectionContext(client, caseId, organizationId);
      await applyFigureToAllLinks(client, {
        caseId,
        organizationId,
        eventId: event.event_id,
        caseContext,
        resolveFigure: (metric) =>
          readActualSnapshotFigure(client, { actualSnapshotId, caseId, organizationId, metric }),
      });
      break;
    }
    case 'roi.tracking_started':
      await syncCaseStatusOnAllProjections(client, caseId, organizationId, 'tracking');
      break;
    case 'roi.benefits_realization_started':
      await syncCaseStatusOnAllProjections(client, caseId, organizationId, 'benefits_realization');
      break;
    case 'roi.case_cancelled':
      await syncCaseStatusOnAllProjections(client, caseId, organizationId, 'cancelled');
      break;
    case 'roi.case_closed':
      await syncCaseStatusOnAllProjections(client, caseId, organizationId, 'closed');
      break;
    case 'roi.actual_recorded':
    case 'roi.actual_corrected':
      // §7: deliberate no-op — these fire per raw append-only entry, not
      // yet rolled into an immutable snapshot. Projecting from unsnapshotted
      // entries would let the figure Finance sees change with no stable
      // pinned artifact behind it. Already claimed above, so redelivery
      // stays a no-op rather than an error.
      break;
    case 'roi.finance_link_created': {
      const linkId = requirePayloadString(event, 'linkId');
      await handleFinanceLinkCreated(client, { caseId, organizationId, linkId, eventId: event.event_id });
      break;
    }
    case 'roi.finance_link_removed': {
      const linkId = requirePayloadString(event, 'linkId');
      await handleFinanceLinkRemoved(client, linkId);
      break;
    }
    case 'roi.finance_reconciliation_opened':
    case 'roi.finance_reconciliation_resolved': {
      const reconciliationId = requirePayloadString(event, 'reconciliationId');
      await mirrorReconciliationStatus(client, reconciliationId);
      break;
    }
    default:
      logger.debug(
        '[resultsVnext/platform/financeProjectionConsumer] no handler for event_type — claimed as a no-op',
        { eventId: event.event_id, eventType: event.event_type }
      );
      break;
  }
}
