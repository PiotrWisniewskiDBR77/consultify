/**
 * resultsFinanceReconciliationService — M15 (Rezultaty) ↔ M16 (Finanse)
 * reconciliation ENGINE. Closes chain gap #11 (Harvard R4 #10).
 * ============================================================================
 *
 * WHY THIS EXISTS (the gap this closes)
 * -------------------------------------
 * `resultsROIService.getReconciliationOverview` is a DISPLAY seam: it needs a
 * reconciliation row to already exist and compares a KPI `target_value` against
 * a raw SUM of realized entries with NO unit conversion. A KPI measured in %,
 * count or duration therefore never reconciles against a €-denominated finance
 * driver — the crude `isMonetaryUnit` null-skip is exactly the source of the
 * "absurd OEE / wariancja" Fable flagged in R3.
 *
 * This module is the missing ENGINE:
 *   1. PULL actuals from Results per initiative (v8_kpi_definitions current
 *      value / v8_roi_realization_entries realized sum).
 *   2. MAP each KPI to a finance-model driver/benefit via an explicit
 *      unit-conversion multiplier, so both sides share ONE finance basis
 *      before any subtraction (unit consistency — OEE units already fixed
 *      upstream; here we guarantee the mapping never mixes bases).
 *   3. Compute a realized-vs-projected DEVIATION (absolute + %) and persist it
 *      on `v8_kpi_finance_reconciliations` (deviation columns added by
 *      migration 20260703_v8_kpi_finance_reconciliation_deviation.sql).
 *   4. Emit an advisory CONCLUSION_LAYER (headline → K2 co-znaczy → K3 co-robić
 *      → K4 efekt) per docs/standards/CONCLUSION_LAYER_STANDARD.md. Numbers
 *      come ONLY from the engine; the narrator is a deterministic stub.
 *
 * The pure functions (normalizeToFinanceBasis / computeDeviation /
 * buildDeviationConclusion) carry no I/O so the reconciliation math is unit
 * testable offline; `pullAndReconcileInitiative` is the DB-backed round-trip.
 *
 * O4.7 WIRING — market-vs-execution post-mortem
 * -------------------------------------------
 * `buildDeviationConclusion` above narrates the deviation but implicitly treats
 * the whole gap as "our execution" (favorable/unfavorable), never asking whether
 * the MARKET moved. `financePostMortemService.decomposeVariance` (O4.7, built,
 * zero callers before this wiring) answers that: given projected/realized (this
 * module already computes both, unit-normalised) it splits the gap into a market
 * effect and an execution effect. This module has NO market-shift data source
 * yet (no benchmark/market-growth feed reaches this reconciliation path), so we
 * call it with `marketShifts: []` — which `decomposeVariance` honestly reports as
 * `'undetermined'` (not "execution failure") rather than fabricating an
 * attribution. The moment a market-shift feed exists, wiring it in here is a
 * one-line change (populate `marketShifts`); until then this is an honest,
 * additive `postMortem` field alongside the existing conclusion — never
 * overwrites the K1..K4 narrative already computed.
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { decomposeVariance, type VarianceDecomposition } from '../financePostMortemService.js';

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export type FinanceMetricType =
  | 'currency'
  | 'percentage'
  | 'count'
  | 'ratio'
  | 'duration'
  | 'score'
  | 'index';

/** Severity of a realized-vs-projected gap. */
export type DeviationSeverity = 'on_track' | 'watch' | 'off_track';

/** One K3 action (verb + owner role + impact/effort), per CONCLUSION_LAYER §4.3. */
export interface ReconciliationAction {
  action: string;
  ownerRole: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
}

/** CONCLUSION_LAYER payload for a single reconciled KPI↔driver pair. */
export interface DeviationConclusion {
  /** answer-first thesis, ≤ ~20 words. */
  headline: string;
  /** K1 — the deviation fact. */
  k1Fact: string;
  /** K2 — co to znaczy (causal reading). */
  k2Meaning: string;
  /** K3 — 1..3 ranked actions. */
  k3Actions: ReconciliationAction[];
  /** K4 — expected effect + horizon. */
  k4Effect: string;
  severity: DeviationSeverity;
  /** false = deterministic stub. */
  aiGenerated: boolean;
}

/** How a Results KPI maps onto a finance-model driver/benefit line. */
export interface KpiDriverMapping {
  kpiId: string;
  /** Finance-model driver / benefit line the KPI feeds. */
  driverKey: string;
  /**
   * KPI-unit → finance-unit factor. realizedFinance = kpiActual × multiplier.
   * e.g. a "hours saved" KPI × (€/hour) → € on the finance basis. Default 1.
   */
  unitMultiplier?: number;
  /**
   * Projected driver value on the finance basis (from the finance model). When
   * omitted the KPI's own target (× multiplier) is used as the projection.
   */
  projectedValue?: number | null;
}

export interface ReconciledKpi {
  kpiId: string;
  kpiName: string;
  metricType: FinanceMetricType;
  driverKey: string;
  unitMultiplier: number;
  /** KPI actual in its native unit (before conversion). */
  kpiActual: number | null;
  /** KPI target in its native unit (before conversion). */
  kpiTarget: number | null;
  /** Realized value on the finance basis (kpiActual × multiplier). */
  realizedValue: number | null;
  /** Projected value on the finance basis. */
  projectedValue: number | null;
  deviationAbsolute: number | null;
  deviationPercent: number | null;
  conclusion: DeviationConclusion | null;
  /**
   * O4.7 — market-vs-execution decomposition of the same realized/projected pair.
   * `null` only when realized or projected is itself missing (no fabricated 0).
   * With no market-shift feed wired yet, a real (non-on-plan) gap resolves to
   * `verdict: 'undetermined'` — honest, not a guessed execution failure.
   */
  postMortem: VarianceDecomposition | null;
}

export interface InitiativeReconciliationResult {
  organizationId: string;
  initiativeId: string;
  reconciledCount: number;
  offTrackCount: number;
  items: ReconciledKpi[];
}

// ---------------------------------------------------------------------------
// Pure engine — no I/O
// ---------------------------------------------------------------------------

/** |x| < 1e-9 → 0; rounds to 2 decimals to kill float noise. */
function round2(value: number): number {
  const r = Math.round(value * 100) / 100;
  return Math.abs(r) < 1e-9 ? 0 : r;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Convert a KPI's native-unit value onto the finance basis. This is the single
 * choke-point that guarantees unit consistency: EVERY figure that later enters
 * a subtraction passes through here first, so realized and projected always
 * share one basis (no "% vs €" comparisons).
 */
export function normalizeToFinanceBasis(
  nativeValue: number | null | undefined,
  unitMultiplier: number | null | undefined
): number | null {
  if (!isFiniteNumber(nativeValue)) return null;
  const m = isFiniteNumber(unitMultiplier) ? unitMultiplier : 1;
  return round2(nativeValue * m);
}

export interface DeviationResult {
  deviationAbsolute: number | null;
  deviationPercent: number | null;
  severity: DeviationSeverity;
}

/**
 * Deviation of realized vs projected, both already on the finance basis.
 * severity bands: |%| ≤ 5 on_track, ≤ 15 watch, else off_track (abs fallback
 * when projected = 0). NO_DATA on either side → on_track with null deviation.
 */
export function computeDeviation(
  realized: number | null,
  projected: number | null,
  bands: { watchPct?: number; offTrackPct?: number } = {}
): DeviationResult {
  const watchPct = bands.watchPct ?? 5;
  const offTrackPct = bands.offTrackPct ?? 15;

  if (!isFiniteNumber(realized) || !isFiniteNumber(projected)) {
    return { deviationAbsolute: null, deviationPercent: null, severity: 'on_track' };
  }

  const deviationAbsolute = round2(realized - projected);
  const deviationPercent =
    projected !== 0 ? round2((deviationAbsolute / Math.abs(projected)) * 100) : null;

  // Percent-based bands when we have a non-zero projection; otherwise fall back
  // to "any non-zero absolute gap = off_track".
  const magnitude =
    deviationPercent != null
      ? Math.abs(deviationPercent)
      : Math.abs(deviationAbsolute) > 0
        ? Infinity
        : 0;

  let severity: DeviationSeverity = 'on_track';
  if (magnitude > offTrackPct) severity = 'off_track';
  else if (magnitude > watchPct) severity = 'watch';

  return { deviationAbsolute, deviationPercent, severity };
}

/**
 * Deterministic CONCLUSION_LAYER for one reconciled KPI. Every number quoted in
 * prose is one of the engine figures passed in — the narrator invents nothing.
 */
export function buildDeviationConclusion(input: {
  kpiName: string;
  driverKey: string;
  realized: number | null;
  projected: number | null;
  deviation: DeviationResult;
}): DeviationConclusion {
  const { kpiName, driverKey, realized, projected, deviation } = input;
  const { deviationAbsolute, deviationPercent, severity } = deviation;

  if (!isFiniteNumber(realized) || !isFiniteNumber(projected)) {
    return {
      headline: `${kpiName}: brak danych do uzgodnienia z driverem ${driverKey}`,
      k1Fact: 'Brak zrealizowanej lub prognozowanej wartości na wspólnej bazie finansowej.',
      k2Meaning:
        'Bez obu stron (realized + projected) na tej samej jednostce nie można policzyć odchylenia — uzgodnienie jest niekompletne.',
      k3Actions: [
        {
          action: `Uzupełnij mapowanie KPI „${kpiName}" → driver „${driverKey}" (multiplier jednostki) i wprowadź aktuale`,
          ownerRole: 'Owner rezultatu (M15)',
          impact: 'medium',
          effort: 'low',
        },
      ],
      k4Effect: 'Po uzupełnieniu danych uzgodnienie policzy odchylenie i status w kolejnym pull.',
      severity: 'on_track',
      aiGenerated: false,
    };
  }

  const pctText = deviationPercent != null ? `${deviationPercent}%` : `${deviationAbsolute}`;
  const dir = (deviationAbsolute ?? 0) >= 0 ? 'powyżej' : 'poniżej';

  const k1Fact = `Zrealizowano ${realized} vs prognoza ${projected} na driverze „${driverKey}" — odchylenie ${deviationAbsolute} (${pctText}).`;

  if (severity === 'on_track') {
    return {
      headline: `${kpiName}: realizacja zgodna z modelem finansowym (${pctText})`,
      k1Fact,
      k2Meaning:
        'Odchylenie mieści się w paśmie tolerancji — założenie w modelu finansowym trzyma się rzeczywistości.',
      k3Actions: [
        {
          action: 'Utrzymaj kadencję pomiaru; nie wymaga korekty modelu',
          ownerRole: 'Owner rezultatu (M15)',
          impact: 'low',
          effort: 'low',
        },
      ],
      k4Effect: 'Prognoza finansowa pozostaje wiarygodna w bieżącym horyzoncie.',
      severity,
      aiGenerated: false,
    };
  }

  const isFavorable = (deviationAbsolute ?? 0) >= 0;
  const k2Meaning = isFavorable
    ? `Realizacja jest ${dir} prognozy — model finansowy niedoszacował korzyści z tego drivera; benefit case jest konserwatywny.`
    : `Realizacja jest ${dir} prognozy — założenie w modelu finansowym nie materializuje się; benefit case jest zagrożony.`;

  const k3Actions: ReconciliationAction[] = isFavorable
    ? [
        {
          action: `Zaktualizuj driver „${driverKey}" w modelu finansowym w górę do poziomu realizacji i przelicz NPV/IRR`,
          ownerRole: 'Analityk finansowy (M16)',
          impact: 'high',
          effort: 'medium',
        },
        {
          action: 'Potwierdź trwałość korzyści (sustainment) przed rewizją prognozy',
          ownerRole: 'Owner rezultatu (M15)',
          impact: 'medium',
          effort: 'low',
        },
      ]
    : [
        {
          action: `Zdiagnozuj przyczynę luki na driverze „${driverKey}" (RCA odchylenia KPI)`,
          ownerRole: 'Owner rezultatu (M15)',
          impact: 'high',
          effort: 'medium',
        },
        {
          action: 'Skoryguj prognozę drivera w modelu lub uruchom działanie naprawcze inicjatywy',
          ownerRole: 'Analityk finansowy (M16)',
          impact: 'high',
          effort: 'medium',
        },
      ];

  return {
    headline: `${kpiName}: realizacja ${dir} prognozy o ${pctText} — ${severity === 'off_track' ? 'poza pasmem' : 'obserwuj'}`,
    k1Fact,
    k2Meaning,
    k3Actions,
    k4Effect: isFavorable
      ? 'Rewizja prognozy w górę podniesie deklarowany zwrot inicjatywy w kolejnym cyklu przeglądu.'
      : 'Bez korekty prognoza przeszacowuje zwrot inicjatywy — ryzyko rozminięcia benefit case w horyzoncie modelu.',
    severity,
    aiGenerated: false,
  };
}

// ---------------------------------------------------------------------------
// DB-backed round-trip
// ---------------------------------------------------------------------------

interface KpiRow {
  kpi_id: string;
  name: string;
  metric_type: string;
  target_value: number | null;
  current_value: number | null;
}

/**
 * Pull actuals from Results for one initiative, map each KPI to its finance
 * driver, compute the realized-vs-projected deviation and persist it (upsert)
 * on `v8_kpi_finance_reconciliations` with a CONCLUSION_LAYER.
 *
 * `mappings` supplies the KPI→driver bridge (driverKey + unit multiplier +
 * optional projected value from the finance model). KPIs with no mapping are
 * skipped — reconciliation is only meaningful where a driver link exists.
 */
export async function pullAndReconcileInitiative(
  organizationId: string,
  initiativeId: string,
  mappings: KpiDriverMapping[],
  options: { initiatedBy?: 'results' | 'finance'; recordedBy?: string | null } = {}
): Promise<InitiativeReconciliationResult> {
  const initiatedBy = options.initiatedBy ?? 'results';
  const mappingByKpi = new Map<string, KpiDriverMapping>();
  for (const m of mappings || []) {
    if (m?.kpiId && m?.driverKey) mappingByKpi.set(m.kpiId, m);
  }

  const items: ReconciledKpi[] = [];
  if (mappingByKpi.size === 0) {
    return { organizationId, initiativeId, reconciledCount: 0, offTrackCount: 0, items };
  }

  const kpiRows = await dbAll<KpiRow>(
    `SELECT kpi_id, name, metric_type, target_value, current_value
       FROM v8_kpi_definitions
      WHERE organization_id = ? AND initiative_id = ?`,
    [organizationId, initiativeId],
    { fallback: true }
  );

  const nowIso = new Date().toISOString();
  let offTrackCount = 0;

  // H5.3 (N+1): batch the realized-ROI SUM for every KPI in one grouped query
  // instead of one SUM query per KPI inside the loop. Only KPIs that have a
  // driver mapping are reconciled, so restrict the IN-set to those. Result is
  // identical per-KPI — looked up from `realizedByKpi` below.
  const reconcilableKpiIds = (kpiRows || [])
    .map((k) => k.kpi_id)
    .filter((id) => mappingByKpi.has(id));
  const realizedByKpi = new Map<string, number | null>();
  if (reconcilableKpiIds.length > 0) {
    const realizedRows = await dbAll<{ kpi_id: string; realized_sum: number | null }>(
      `SELECT kpi_id, SUM(realized_value) AS realized_sum
         FROM v8_roi_realization_entries
        WHERE organization_id = ? AND kpi_id IN (${reconcilableKpiIds.map(() => '?').join(', ')})
        GROUP BY kpi_id`,
      [organizationId, ...reconcilableKpiIds],
      { fallback: true }
    );
    for (const row of realizedRows || []) {
      realizedByKpi.set(String(row.kpi_id), row.realized_sum ?? null);
    }
  }

  for (const kpi of kpiRows || []) {
    const mapping = mappingByKpi.get(kpi.kpi_id);
    if (!mapping) continue;

    const unitMultiplier = isFiniteNumber(mapping.unitMultiplier) ? mapping.unitMultiplier : 1;

    // Realized actual: prefer the summed realized ROI entries; fall back to the
    // KPI's own current_value. Then normalise to the finance basis.
    const realizedSum = realizedByKpi.has(kpi.kpi_id)
      ? (realizedByKpi.get(kpi.kpi_id) ?? null)
      : null;
    const kpiActual = isFiniteNumber(realizedSum)
      ? Number(realizedSum)
      : isFiniteNumber(kpi.current_value)
        ? Number(kpi.current_value)
        : null;

    const realizedValue = normalizeToFinanceBasis(kpiActual, unitMultiplier);

    // Projected: explicit finance-model value if supplied, else the KPI target
    // normalised through the same multiplier (so both sides share one basis).
    const projectedValue = isFiniteNumber(mapping.projectedValue)
      ? round2(Number(mapping.projectedValue))
      : normalizeToFinanceBasis(kpi.target_value, unitMultiplier);

    const deviation = computeDeviation(realizedValue, projectedValue);
    const conclusion = buildDeviationConclusion({
      kpiName: kpi.name,
      driverKey: mapping.driverKey,
      realized: realizedValue,
      projected: projectedValue,
      deviation,
    });
    if (deviation.severity === 'off_track') offTrackCount += 1;

    // O4.7 — market-vs-execution post-mortem on the SAME realized/projected pair (already
    // unit-normalised above). Only computed when both sides are real numbers — a missing
    // side means "no data", never a fabricated 0 baseline (honest-empty, §"no guessing").
    const postMortem: VarianceDecomposition | null =
      isFiniteNumber(realizedValue) && isFiniteNumber(projectedValue)
        ? decomposeVariance({
            projected: projectedValue,
            realized: realizedValue,
            marketShifts: [], // no market-shift feed wired to this reconciliation path yet
            language: 'pl',
          })
        : null;

    await upsertReconciliation({
      organizationId,
      kpiId: kpi.kpi_id,
      driverKey: mapping.driverKey,
      unitMultiplier,
      projectedValue,
      realizedValue,
      deviation,
      conclusion,
      postMortem,
      initiatedBy,
      nowIso,
    });

    items.push({
      kpiId: kpi.kpi_id,
      kpiName: kpi.name,
      metricType: (kpi.metric_type as FinanceMetricType) ?? 'currency',
      driverKey: mapping.driverKey,
      unitMultiplier,
      kpiActual,
      kpiTarget: isFiniteNumber(kpi.target_value) ? Number(kpi.target_value) : null,
      realizedValue,
      projectedValue,
      deviationAbsolute: deviation.deviationAbsolute,
      deviationPercent: deviation.deviationPercent,
      conclusion,
      postMortem,
    });
  }

  return {
    organizationId,
    initiativeId,
    reconciledCount: items.length,
    offTrackCount,
    items,
  };
}

/** Upsert one reconciliation row keyed by (org, kpi, driver). */
async function upsertReconciliation(input: {
  organizationId: string;
  kpiId: string;
  driverKey: string;
  unitMultiplier: number;
  projectedValue: number | null;
  realizedValue: number | null;
  deviation: DeviationResult;
  conclusion: DeviationConclusion;
  /** O4.7 — persisted alongside the conclusion (no schema migration: embedded in conclusion_json). */
  postMortem: VarianceDecomposition | null;
  initiatedBy: 'results' | 'finance';
  nowIso: string;
}): Promise<void> {
  const {
    organizationId,
    kpiId,
    driverKey,
    unitMultiplier,
    projectedValue,
    realizedValue,
    deviation,
    conclusion,
    postMortem,
    initiatedBy,
    nowIso,
  } = input;

  // O4.7 — additive: `conclusion_json` already flows through to the Results reconciliation
  // read seam (`resultsROIService.getReconciliationOverview` → `eng_conclusion_json` →
  // `conclusion`), so embedding `postMortem` here (no new column, no migration) makes the
  // market-vs-execution decomposition reach that existing render path for free. `conclusion`
  // itself keeps its original shape — postMortem is a sibling key on the serialized object.
  const conclusionJson = JSON.stringify(postMortem ? { ...conclusion, postMortem } : conclusion);

  const existing = await dbGet<{ reconciliation_id: string }>(
    `SELECT reconciliation_id
       FROM v8_kpi_finance_reconciliations
      WHERE organization_id = ? AND kpi_id = ? AND driver_key = ?
      LIMIT 1`,
    [organizationId, kpiId, driverKey],
    { fallback: true }
  );

  if (existing?.reconciliation_id) {
    await dbRun(
      `UPDATE v8_kpi_finance_reconciliations
          SET unit_multiplier = ?, projected_value = ?, realized_value = ?,
              deviation_absolute = ?, deviation_percent = ?, conclusion_json = ?,
              reconciliation_status = 'reconciled', reconciled_at = ?, updated_at = ?
        WHERE reconciliation_id = ? AND organization_id = ?`,
      [
        unitMultiplier,
        projectedValue,
        realizedValue,
        deviation.deviationAbsolute,
        deviation.deviationPercent,
        conclusionJson,
        nowIso,
        nowIso,
        existing.reconciliation_id,
        organizationId,
      ]
    );
    return;
  }

  await dbRun(
    `INSERT INTO v8_kpi_finance_reconciliations (
       reconciliation_id, organization_id, kpi_id, finance_ref, reconciliation_status,
       initiated_by, driver_key, unit_multiplier, projected_value, realized_value,
       deviation_absolute, deviation_percent, conclusion_json, reconciled_at,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, 'reconciled', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      organizationId,
      kpiId,
      driverKey,
      initiatedBy,
      driverKey,
      unitMultiplier,
      projectedValue,
      realizedValue,
      deviation.deviationAbsolute,
      deviation.deviationPercent,
      conclusionJson,
      nowIso,
      nowIso,
      nowIso,
    ]
  );
}

export default {
  normalizeToFinanceBasis,
  computeDeviation,
  buildDeviationConclusion,
  pullAndReconcileInitiative,
};
