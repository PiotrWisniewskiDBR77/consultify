/**
 * Finance v3 canonical — Prediction Compute, Stage 1: preflight (Gate D / Fala 6, WP-D08).
 *
 * Program: `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
 * section 8 (Prediction). Schema: `WP-D07_prediction_schema_ADR.md` sections 6.1 (Stage 1 contract),
 * 7 (double-counting algorithm — Layer 1 SQL `finance_prediction_detect_overlaps()`, already live
 * in `server/migrations/20260809_finance_v3_d07_prediction_03_readiness.sql`; Layer 2 numeric
 * preview, "contract, not implemented in the ADR" — THIS module is that Layer 2), live-tested in
 * `WP-D07b_prediction_migration_report.md` (TEST 8/9/10/11).
 *
 * DEC-FIN-004 (two-stage Compute, DECIDED): "System nie blokuje budowania założeń i nie sumuje
 * konfliktów po cichu" — this module never blocks INSERTs into the four prediction assumption
 * tables (`finance_prediction_driver_overrides`/`_initiatives`/`_impact_chain`/`_financing`); it
 * only ANALYZES the current assumption set on demand and records what it found. The compute GATE
 * itself (`finance_prediction_can_start_compute()`) lives in the DB (already shipped, WP-D07b) and
 * is consumed by `predictionComputeService.ts`, not here.
 *
 * Reuse discipline (WP-D08 brief): Layer 2's DRIVER_OVERRIDE numeric preview calls
 * `baselineScheduleEngine.ts`'s pure functions TWICE (once with the Baseline value, once with the
 * override value) — never a re-implementation of that arithmetic. Layer 2's INITIATIVE_IMPACT
 * numeric preview does NOT call the schedule engine (ADR section 7.2: it is a ramp/duration/decay
 * expansion of `amount_decimal`, a different kind of arithmetic entirely) — ramp/decay expansion is
 * implemented once here and reused verbatim by `predictionComputeService.ts` (`impactChainMath.ts`
 * would be the natural split if this grew a second caller beyond these two files; kept inline in
 * both for now, same "duplication is fine below the reuse threshold WP-D06 already accepted for its
 * own small helpers" judgment call).
 */

import { createHash, randomUUID as uuidv4 } from 'node:crypto';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import { computeCapexDepreciation, computeCogsOpex, computeRevenuePvm, computeWcDsoDioDpo } from './baselineScheduleEngine.js';
import { loadContext, requireAssumption, type LoadedContext } from './baselineComputeService.js';

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

interface ScenarioRow {
  business_version_id: string;
  organization_id: string;
  scenario_mode: string;
}

interface OverlapRow {
  entity_id: string;
  canonical_line_id: string;
  period_id: string;
  source_count: number;
  combined_impact_decimal: string | null;
  sources: Array<{ source_type: 'DRIVER_OVERRIDE' | 'INITIATIVE_IMPACT' | 'FINANCING'; source_id: string; estimated_delta: number }>;
}

interface DriverOverrideRow {
  id: string;
  schedule_type: string;
  driver_code: string;
  entity_id: string;
  period_id: string;
  value_decimal: string | null;
  baseline_value_decimal: string | null;
}

interface ImpactChainRow {
  id: string;
  initiative_id: string;
  driver_schedule_type: string | null;
  driver_code: string | null;
  statement_line_id: string;
  entity_id: string;
  amount_kind: 'ABSOLUTE_AMOUNT' | 'PERCENT_OF_BASE' | 'PERCENT_DELTA';
  amount_decimal: string;
  sign: 'POSITIVE' | 'NEGATIVE';
  start_period_id: string | null;
  ramp_months: number | null;
  duration_months: number | null;
  decay_pct_per_period: string | null;
}

interface InitiativeDefaultsRow {
  id: string;
  default_start_period_id: string | null;
  default_ramp_months: number | null;
  default_duration_months: number | null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RunPreflightParams {
  organizationId: string;
  /** The Prediction Scenario's own `business_version_id` (target of `MODEL_TO_SCENARIO`). */
  businessVersionId: string;
  runBy: string;
  /** Optional — improves Layer 2 precision (opening FIXED_ASSETS for capex_depreciation deltas). Falls back to an empty opening-BS read (priorFixedAssets=0) when omitted, same degraded-but-non-crashing behavior documented above for the debt_maturity/tax_nol/equity_re fallback. */
  openingBalanceSheetPeriodId?: string;
  /** Optional — defaults to the first overlap's own entity_id (P0 single-entity scope, same as baselineComputeService.ts). */
  entityId?: string;
}

export interface PreflightFindingPreview {
  findingId: string;
  findingKind: 'OVERLAP_DOUBLE_COUNTING' | 'CONTRADICTORY_SIGNS';
  entityId: string;
  canonicalLineId: string;
  periodId: string;
  sourceCount: number;
  /** Layer 1's naive, same-unit-agnostic sum (ADR section 7.1) — kept for traceability, NOT the number shown to the user. */
  layer1CombinedImpactDecimal: number | null;
  /** Layer 2 — real-currency numeric preview (ADR section 7.2), this module's own implementation. */
  layer2CombinedImpactDecimal: number;
  requiresResolution: boolean;
}

export type RunPreflightResult =
  | {
      ok: true;
      preflightRunId: string;
      findingsCount: number;
      requiredResolutionsCount: number;
      findings: PreflightFindingPreview[];
    }
  | { ok: false; code: 'NO_SCENARIO_ROW' | 'NO_BASELINE_LINEAGE_EDGE'; message: string };

/**
 * Stage 1 (ADR section 6.1). Reads the WHOLE current assumption set (driver_overrides +
 * initiatives/impact_chain + financing), calls the already-shipped
 * `finance_prediction_detect_overlaps()` SQL function (Layer 1), computes a real-currency Layer 2
 * numeric preview for every Layer-1-flagged group, classifies each as
 * OVERLAP_DOUBLE_COUNTING (same-sign sources) or CONTRADICTORY_SIGNS (mixed-sign sources, ADR
 * section 7.3), and persists one `finance_prediction_preflight_runs` row + N
 * `finance_prediction_preflight_findings` rows — superseding any prior CURRENT run for this
 * scenario (ADR section 4.8: `superseded_by_preflight_run_id` chain).
 *
 * Never blocks assumption-building (DEC-FIN-004) — this function is purely additive/analytical.
 */
export async function runPreflight(params: RunPreflightParams): Promise<RunPreflightResult> {
  // W9-C-2 fix: org-scoped. Previously selected by business_version_id alone,
  // so a cross-tenant businessVersionId let the function proceed into another
  // org's scenario/assumption data; only a raw FK violation on the eventual
  // INSERT (`fk_finance_prediction_preflight_runs_bv_org`) stopped the write.
  // Now refuses HERE, typed, the same NO_SCENARIO_ROW shape this function
  // already returns for a genuinely nonexistent scenario.
  const scenario = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<ScenarioRow>(
      `SELECT business_version_id, organization_id, scenario_mode FROM finance_prediction_scenarios
        WHERE business_version_id = ? AND organization_id = ?`,
      [params.businessVersionId, params.organizationId]
    )
  );
  if (!scenario) {
    return { ok: false, code: 'NO_SCENARIO_ROW', message: `No finance_prediction_scenarios row for ${params.businessVersionId}` };
  }

  const baselineModelVersionId = await resolveBaselineModelVersion(params.businessVersionId);
  if (!baselineModelVersionId) {
    return {
      ok: false,
      code: 'NO_BASELINE_LINEAGE_EDGE',
      message: `No MODEL_TO_SCENARIO lineage edge targets business_version_id ${params.businessVersionId}`,
    };
  }

  // Layer 1 (already shipped SQL, WP-D07b) — structural grouping + naive combined delta.
  const overlaps = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<OverlapRow>(`SELECT * FROM finance_prediction_detect_overlaps(?)`, [params.businessVersionId])
  );

  // Everything Layer 2 needs to re-derive real-currency deltas: the linked Baseline Model's own
  // schedule/assumption/history context (loadContext — reused verbatim from
  // baselineComputeService.ts, WP-D08 additive-export), plus the Prediction scenario's own raw
  // driver_overrides/impact_chain rows for the specific sources flagged by Layer 1, plus a
  // canonical_line_id -> line_code map so ADR section 7.2's per-schedule_type dispatch and the
  // impact_chain ramp/decay math both know which line they are computing for.
  const [lineRows, driverOverrideRows, impactChainRows, initiativeRows] = await Promise.all([
    withPinnedPostgresTransaction((tx) => tx.queryAll<{ id: string; line_code: string }>(`SELECT id, line_code FROM financial_statement_lines`)),
    withPinnedPostgresTransaction((tx) =>
      tx.queryAll<DriverOverrideRow>(
        `SELECT id, schedule_type, driver_code, entity_id, period_id, value_decimal, baseline_value_decimal
           FROM finance_prediction_driver_overrides WHERE business_version_id = ?`,
        [params.businessVersionId]
      )
    ),
    withPinnedPostgresTransaction((tx) =>
      tx.queryAll<ImpactChainRow>(
        `SELECT id, initiative_id, driver_schedule_type, driver_code, statement_line_id, entity_id, amount_kind, amount_decimal, sign,
                start_period_id, ramp_months, duration_months, decay_pct_per_period
           FROM finance_prediction_impact_chain WHERE business_version_id = ?`,
        [params.businessVersionId]
      )
    ),
    withPinnedPostgresTransaction((tx) =>
      tx.queryAll<InitiativeDefaultsRow>(
        `SELECT id, default_start_period_id, default_ramp_months, default_duration_months
           FROM finance_prediction_initiatives WHERE business_version_id = ?`,
        [params.businessVersionId]
      )
    ),
  ]);

  const lineCodeById = new Map<string, string>();
  for (const r of lineRows) lineCodeById.set(r.id, r.line_code);
  const driverOverrideById = new Map(driverOverrideRows.map((r) => [r.id, r]));
  const impactChainById = new Map(impactChainRows.map((r) => [r.id, r]));
  const initiativeById = new Map(initiativeRows.map((r) => [r.id, r]));

  // Baseline context (needed only if at least one DRIVER_OVERRIDE overlap exists — loaded lazily,
  // once, same pattern baselineComputeService.ts itself uses for its own single-load-then-loop).
  let baselineCtx: LoadedContext | null = null;
  const needsBaselineCtx = overlaps.some((o) => o.sources.some((s) => s.source_type === 'DRIVER_OVERRIDE'));
  if (needsBaselineCtx) {
    const loaded = await loadContext({
      organizationId: params.organizationId,
      businessVersionId: baselineModelVersionId,
      requestedByUserId: params.runBy,
      engineManifestId: '',
      entityId: params.entityId ?? overlaps[0]?.entity_id ?? '',
      forecastPeriodIds: [],
      openingBalanceSheetPeriodId: params.openingBalanceSheetPeriodId ?? '',
    });
    if (loaded.ok) baselineCtx = loaded.ctx;
  }

  const findings: Array<{
    findingId: string;
    findingKind: 'OVERLAP_DOUBLE_COUNTING' | 'CONTRADICTORY_SIGNS';
    entityId: string;
    canonicalLineId: string;
    periodId: string;
    sourceCount: number;
    layer1: number | null;
    layer2: number;
    involvedSources: OverlapRow['sources'];
  }> = [];

  for (const overlap of overlaps) {
    const layer2Deltas: number[] = [];
    for (const source of overlap.sources) {
      if (source.source_type === 'DRIVER_OVERRIDE') {
        const row = driverOverrideById.get(source.source_id);
        if (row && baselineCtx) {
          layer2Deltas.push(computeDriverOverrideLayer2Delta(row, lineCodeById.get(overlap.canonical_line_id) ?? '', baselineCtx));
        } else {
          layer2Deltas.push(source.estimated_delta); // fallback: Layer 1's own naive figure, documented degraded path
        }
      } else if (source.source_type === 'INITIATIVE_IMPACT') {
        const row = impactChainById.get(source.source_id);
        if (row) {
          const initiative = initiativeById.get(row.initiative_id);
          layer2Deltas.push(computeImpactChainLayer2Delta(row, initiative));
        } else {
          layer2Deltas.push(source.estimated_delta);
        }
      } else {
        // FINANCING — Layer 2 currency preview for financing overlaps is out of scope for this
        // work package (financing's own contribution to a double-counted CELL is rare by
        // construction — financing maps only to LONG_TERM_DEBT/INTEREST_EXPENSE/EQUITY/
        // DIVIDENDS_DECLARED/RETAINED_EARNINGS, ADR section 7.1 file-03 comment — Layer 1's own
        // payload-read estimate is used as-is, documented boundary).
        layer2Deltas.push(source.estimated_delta);
      }
    }
    const layer2Combined = layer2Deltas.reduce((a, b) => a + b, 0);
    const allSameSign = layer2Deltas.every((d) => d >= 0) || layer2Deltas.every((d) => d <= 0);
    findings.push({
      findingId: uuidv4(),
      findingKind: allSameSign ? 'OVERLAP_DOUBLE_COUNTING' : 'CONTRADICTORY_SIGNS',
      entityId: overlap.entity_id,
      canonicalLineId: overlap.canonical_line_id,
      periodId: overlap.period_id,
      sourceCount: overlap.source_count,
      layer1: overlap.combined_impact_decimal === null ? null : Number(overlap.combined_impact_decimal),
      layer2: layer2Combined,
      involvedSources: overlap.sources,
    });
  }

  const assumptionSetSemanticHash = createHash('sha256')
    .update(
      JSON.stringify({
        driverOverrides: driverOverrideRows.map((r) => [r.id, r.schedule_type, r.driver_code, r.entity_id, r.period_id, r.value_decimal]),
        impactChain: impactChainRows.map((r) => [r.id, r.statement_line_id, r.amount_kind, r.amount_decimal, r.sign, r.start_period_id]),
      })
    )
    .digest('hex');

  const preflightRunId = uuidv4();
  await withPinnedPostgresTransaction(async (tx) => {
    const currentRun = await tx.queryOne<{ id: string }>(
      `SELECT id FROM finance_prediction_preflight_runs WHERE business_version_id = ? AND superseded_by_preflight_run_id IS NULL`,
      [params.businessVersionId]
    );
    if (currentRun) {
      await tx.queryRun(`UPDATE finance_prediction_preflight_runs SET superseded_by_preflight_run_id = ? WHERE id = ?`, [
        preflightRunId,
        currentRun.id,
      ]);
    }

    await tx.queryRun(
      `INSERT INTO finance_prediction_preflight_runs
         (id, organization_id, business_version_id, assumption_set_semantic_hash, findings_count, required_resolutions_count, run_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [preflightRunId, params.organizationId, params.businessVersionId, assumptionSetSemanticHash, findings.length, findings.length, params.runBy]
    );

    for (const f of findings) {
      await tx.queryRun(
        `INSERT INTO finance_prediction_preflight_findings
           (id, organization_id, business_version_id, preflight_run_id, finding_kind, requires_resolution,
            entity_id, canonical_line_id, period_id, involved_sources, combined_impact_decimal, proposed_resolution_numeric_preview)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          f.findingId,
          params.organizationId,
          params.businessVersionId,
          preflightRunId,
          f.findingKind,
          true, // OVERLAP_DOUBLE_COUNTING and CONTRADICTORY_SIGNS both require resolution by default (ADR section 7.3 / 4.9)
          f.entityId,
          f.canonicalLineId,
          f.periodId,
          JSON.stringify(f.involvedSources),
          f.layer2,
          JSON.stringify({
            layer1CombinedImpactDecimal: f.layer1,
            layer2CombinedImpactDecimal: f.layer2,
            // Literal proposed resolutions per ADR section 3 ("proponowane rozstrzygnięcie") —
            // free-text labels a UI/CFO can pick from, not a DB-enforced enum.
            options:
              f.findingKind === 'OVERLAP_DOUBLE_COUNTING'
                ? ['SUM_BOTH', 'USE_HIGHER_MAGNITUDE', 'REQUIRES_MANUAL_DECISION']
                : ['NET_SOURCES', 'REQUIRES_MANUAL_DECISION'],
          }),
        ]
      );
    }
  });

  return {
    ok: true,
    preflightRunId,
    findingsCount: findings.length,
    requiredResolutionsCount: findings.length,
    findings: findings.map((f) => ({
      findingId: f.findingId,
      findingKind: f.findingKind,
      entityId: f.entityId,
      canonicalLineId: f.canonicalLineId,
      periodId: f.periodId,
      sourceCount: f.sourceCount,
      layer1CombinedImpactDecimal: f.layer1,
      layer2CombinedImpactDecimal: f.layer2,
      requiresResolution: true,
    })),
  };
}

async function resolveBaselineModelVersion(predictionScenarioBusinessVersionId: string): Promise<string | null> {
  const row = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ source_version_id: string }>(
      `SELECT source_version_id FROM finance_lineage_edges WHERE edge_type = 'MODEL_TO_SCENARIO' AND target_version_id = ?`,
      [predictionScenarioBusinessVersionId]
    )
  );
  return row?.source_version_id ?? null;
}

/**
 * Layer 2, DRIVER_OVERRIDE case (ADR section 7.2, literal): call the ONE `baselineScheduleEngine.ts`
 * pure function matching this override's `schedule_type` TWICE — once with the Baseline (pre-
 * override) driver value, once with the override's own `value_decimal` — using the SAME supporting
 * inputs (e.g. revenue) both times, difference = real-currency delta for the flagged canonical line.
 * `baselineCtx.assumptions` supplies every OTHER driver this schedule_type's function needs (never
 * re-derived, never guessed) — only the ONE driver actually being overridden changes between the
 * two calls.
 *
 * Supported schedule_types for P0: `cogs_opex` (COGS/OPEX), `revenue_pvm` (REVENUE),
 * `capex_depreciation` (CAPEX/DEPRECIATION), `wc_dso_dio_dpo` (AR/INVENTORY/AP) — the four families
 * whose pure function takes a single scalar override cleanly. `debt_maturity`/`tax_nol`/`equity_re`
 * overrides fall back to Layer 1's naive delta (documented boundary — `debt_maturity` is contractual
 * lookup, not ratio-driven, so "override the driver" does not map onto a single scalar the same way).
 */
function computeDriverOverrideLayer2Delta(row: DriverOverrideRow, lineCode: string, ctx: LoadedContext): number {
  const overrideValue = row.value_decimal === null ? null : Number(row.value_decimal);
  const baselineValue = row.baseline_value_decimal === null ? requireAssumption(ctx, row.schedule_type, row.driver_code) : Number(row.baseline_value_decimal);
  if (overrideValue === null) return 0;

  // Representative revenue for this driver's period — PRIOR_YEAR_SAME_PERIOD lookup, same input
  // computeRevenuePvm() itself needs; used as the shared "revenue" input to cogs_opex/
  // capex_depreciation/wc_dso_dio_dpo so both calls (base vs override) are apples-to-apples.
  const period = ctx.periodByCode.get(row.period_id);
  const priorYearRevenue =
    period && period.fiscal_month !== null ? ctx.revenueHistoryByFiscalYearMonth.get(`${period.fiscal_year - 1}-${period.fiscal_month}`) : undefined;
  const revenueGrowth = requireAssumption(ctx, 'revenue_pvm', 'REVENUE_GROWTH_YOY');
  const revenue = priorYearRevenue !== undefined ? computeRevenuePvm({ priorYearSameMonthRevenue: priorYearRevenue, annualGrowthRate: revenueGrowth }) : 0;

  switch (row.schedule_type) {
    case 'revenue_pvm': {
      if (priorYearRevenue === undefined) return 0;
      const base = computeRevenuePvm({ priorYearSameMonthRevenue: priorYearRevenue, annualGrowthRate: baselineValue });
      const withOverride = computeRevenuePvm({ priorYearSameMonthRevenue: priorYearRevenue, annualGrowthRate: overrideValue });
      return withOverride - base;
    }
    case 'cogs_opex': {
      const cogsRatio = requireAssumption(ctx, 'cogs_opex', 'COGS_PCT_OF_REVENUE');
      const opexRatio = requireAssumption(ctx, 'cogs_opex', 'OPEX_PCT_OF_REVENUE');
      const isOpexDriver = row.driver_code === 'OPEX_PCT_OF_REVENUE';
      const base = computeCogsOpex({ revenue, cogsRatio: isOpexDriver ? cogsRatio : baselineValue, opexRatio: isOpexDriver ? baselineValue : opexRatio });
      const withOverride = computeCogsOpex({
        revenue,
        cogsRatio: isOpexDriver ? cogsRatio : overrideValue,
        opexRatio: isOpexDriver ? overrideValue : opexRatio,
      });
      return lineCode === 'OPEX' ? withOverride.opex - base.opex : withOverride.cogs - base.cogs;
    }
    case 'capex_depreciation': {
      const priorFixedAssets = ctx.openingCells.get('FIXED_ASSETS') ?? 0;
      const capexPct = requireAssumption(ctx, 'capex_depreciation', 'CAPEX_PCT_OF_REVENUE');
      const usefulLife = requireAssumption(ctx, 'capex_depreciation', 'USEFUL_LIFE_MONTHS');
      const isUsefulLifeDriver = row.driver_code === 'USEFUL_LIFE_MONTHS';
      const base = computeCapexDepreciation({
        revenue,
        priorFixedAssets,
        capexPctOfRevenue: isUsefulLifeDriver ? capexPct : baselineValue,
        usefulLifeMonths: isUsefulLifeDriver ? baselineValue : usefulLife,
      });
      const withOverride = computeCapexDepreciation({
        revenue,
        priorFixedAssets,
        capexPctOfRevenue: isUsefulLifeDriver ? capexPct : overrideValue,
        usefulLifeMonths: isUsefulLifeDriver ? overrideValue : usefulLife,
      });
      return lineCode === 'DEPRECIATION' ? withOverride.depreciation - base.depreciation : withOverride.capex - base.capex;
    }
    case 'wc_dso_dio_dpo': {
      const days = period ? daysInPeriodLocal(period) : 30;
      const cogsRatio = requireAssumption(ctx, 'cogs_opex', 'COGS_PCT_OF_REVENUE');
      const cogs = revenue * cogsRatio;
      const dso = requireAssumption(ctx, 'wc_dso_dio_dpo', 'DSO_DAYS');
      const dio = requireAssumption(ctx, 'wc_dso_dio_dpo', 'DIO_DAYS');
      const dpo = requireAssumption(ctx, 'wc_dso_dio_dpo', 'DPO_DAYS');
      const pick = (driver: string, base: number) => (row.driver_code === driver ? { base: baselineValue, override: overrideValue } : { base, override: base });
      const dsoV = pick('DSO_DAYS', dso);
      const dioV = pick('DIO_DAYS', dio);
      const dpoV = pick('DPO_DAYS', dpo);
      const base = computeWcDsoDioDpo({ revenue, cogs, daysInPeriod: days, dsoDays: dsoV.base, dioDays: dioV.base, dpoDays: dpoV.base });
      const withOverride = computeWcDsoDioDpo({ revenue, cogs, daysInPeriod: days, dsoDays: dsoV.override, dioDays: dioV.override, dpoDays: dpoV.override });
      if (lineCode === 'AR') return withOverride.ar - base.ar;
      if (lineCode === 'INVENTORY') return withOverride.inventory - base.inventory;
      return withOverride.ap - base.ap;
    }
    default:
      return overrideValue - baselineValue; // fallback for debt_maturity/tax_nol/equity_re (documented boundary above)
  }
}

function daysInPeriodLocal(p: { period_start: string | Date; period_end: string | Date }): number {
  const toIso = (v: string | Date) => (v instanceof Date ? v.toISOString().slice(0, 10) : v);
  const start = Date.parse(`${toIso(p.period_start)}T00:00:00Z`);
  const end = Date.parse(`${toIso(p.period_end)}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

/**
 * Layer 2, INITIATIVE_IMPACT case (ADR section 7.2, literal): expand `start_period_id`/
 * `ramp_months`/`duration_months`/`decay_pct_per_period` (inheriting the parent initiative's
 * `default_*` when the impact row leaves them NULL, ADR section 4.3/4.4) into an
 * `effective_fraction` for the SPECIFIC period the overlap was flagged on, multiply
 * `amount_decimal` by it — NOT a call into `baselineScheduleEngine.ts` (this arithmetic has nothing
 * to do with the schedule engine; the ADR is explicit that only the DRIVER_OVERRIDE case calls it).
 * Same ramp/decay function `predictionComputeService.ts`'s own monthly loop reuses.
 */
export function impactChainEffectiveFraction(monthsSinceStart: number, rampMonths: number | null, durationMonths: number | null, decayPctPerPeriod: number | null): number {
  if (monthsSinceStart < 0) return 0;
  let fraction = 1;
  if (rampMonths && rampMonths > 0) {
    fraction = Math.min(1, (monthsSinceStart + 1) / rampMonths);
  }
  if (durationMonths !== null && durationMonths !== undefined && monthsSinceStart >= durationMonths) {
    const periodsBeyond = monthsSinceStart - durationMonths + 1;
    if (decayPctPerPeriod && decayPctPerPeriod > 0) {
      fraction *= Math.max(0, 1 - decayPctPerPeriod * periodsBeyond);
    } else {
      fraction = 0; // no decay specified => effect ends cleanly at the duration boundary
    }
  }
  return fraction;
}

function computeImpactChainLayer2Delta(row: ImpactChainRow, initiative: InitiativeDefaultsRow | undefined): number {
  // Preflight's Layer 2 preview is evaluated at the impact's OWN start (fraction=1 at
  // monthsSinceStart=0, or the ramp-month-1 fraction if ramping) — a single-period preview number,
  // not a full-horizon expansion (ADR section 4.9's `proposed_resolution_numeric_preview` is a
  // preview, not the compute engine's own per-period application — that full expansion is
  // `predictionComputeService.ts`'s job, section below).
  const startPeriodId = row.start_period_id ?? initiative?.default_start_period_id ?? null;
  if (!startPeriodId) return 0;
  const rampMonths = row.ramp_months ?? initiative?.default_ramp_months ?? null;
  const durationMonths = row.duration_months ?? initiative?.default_duration_months ?? null;
  const decay = row.decay_pct_per_period === null || row.decay_pct_per_period === undefined ? null : Number(row.decay_pct_per_period);
  const fraction = impactChainEffectiveFraction(0, rampMonths, durationMonths, decay);
  const signMultiplier = row.sign === 'NEGATIVE' ? -1 : 1;
  return signMultiplier * Number(row.amount_decimal) * fraction;
}
