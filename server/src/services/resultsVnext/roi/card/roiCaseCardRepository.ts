/**
 * ROI (P7K C) — odczyt JEDNEJ analizy ROI jako karty N w trzech częściach
 * (Założenia → Wyliczenia → Realizacja) oraz wiersza rejestru analiz.
 *
 * Źródło prawdy: docs/modules/07_rezultaty/SSOT_WYNIKI_KPI_OKR_ROI.md §4,
 * docs/program/grafika/ROI_METODYKA_WLASCICIELA_20260905.md,
 * docs/program/grafika/WYNIKI_ZALOZENIA_GRAFICZNE_20260905.md §4.
 * Braki schematu domknięte migracją `20260906_rvn_roi_card_three_parts.sql`.
 *
 * WIDOCZNOŚĆ: każde zapytanie tutaj przechodzi przez ten sam obowiązkowy
 * `INNER JOIN rvn_visible_resources` po `roi_case`, którego używa
 * `roiRepository.ts` — tabele podrzędne (koszty, korzyści, założenia, ryzyka,
 * wariancje, PIR) dziedziczą widoczność po SPRAWIE, nigdy nie mają własnego
 * wiersza widoczności (ta sama zasada, co w `getRoiBaseline`). Bramka
 * `resolveRoiGovernedVisibility` stoi PRZED tym modułem, w trasie.
 *
 * BRAK ≠ ZERO: pola, których nie da się policzyć z zapisanych wierszy, wracają
 * jako `null`. Zamiana `null` na 0 tutaj byłaby kłamstwem, którego UI już nie
 * odróżni (SSOT §6: „brak danych = —, nigdy 0").
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../../database/PostgresDatabase.js';
import { buildVisibilityScopedCte } from '../../platform/visibilityScopedQuery.js';
import { ROI_RESOURCE_TYPE } from '../roiCaseCommands.js';

import {
  buildCashFlowRows,
  computeRoiIndicators,
  computeSensitivity,
  deriveRoiCardPhase,
  horizonYears,
  sumOneTime,
  sumRecurringPerYear,
  type RoiAssumptionVerdict,
  type RoiBenefitClass,
  type RoiCardCadence,
  type RoiCardCashFlowRow,
  type RoiCardIndicators,
  type RoiCardPhase,
  type RoiCardTimingType,
  type RoiInvestmentRecommendation,
  type RoiSensitivityRow,
} from './roiCardMetrics.js';

// ==========================================
// DTO — kształt, który wychodzi na drut (camelCase, liczby jako `number`)
// ==========================================

export interface RoiRegistryRowDto {
  caseId: string;
  title: string;
  subjectType: string | null;
  optionVariant: number | null;
  optionVariantLabel: string | null;
  status: string;
  phase: RoiCardPhase;
  ownerUserId: string;
  currency: string;
  analysisStart: string | null;
  analysisEnd: string | null;
  horizonYears: number | null;
  capex: number | null;
  annualNetBenefit: number | null;
  roiPct: number | null;
  paybackYears: number | null;
  npv: number | null;
  irrPct: number | null;
  recommendation: RoiInvestmentRecommendation | null;
  recommendationCondition: string | null;
  updatedAt: string;
}

export interface RoiCardAssumptionDto {
  assumptionId: string;
  category: string;
  label: string;
  unit: string | null;
  baseValue: number | null;
  downsideValue: number | null;
  upsideValue: number | null;
  confidence: string | null;
  source: string | null;
  sensitivityRank: number | null;
  /** Werdykt z przeglądu po realizacji — część 3 karty. */
  verdict: RoiAssumptionVerdict | null;
  verdictNote: string | null;
}

export interface RoiCardCostLineDto {
  costLineId: string;
  category: string;
  label: string;
  description: string | null;
  amount: number | null;
  currency: string;
  timingType: RoiCardTimingType;
  recurrenceCadence: RoiCardCadence | null;
}

export interface RoiCardBenefitLineDto {
  benefitLineId: string;
  category: string;
  label: string;
  description: string | null;
  benefitClass: RoiBenefitClass | null;
  isFinancial: boolean;
  amount: number | null;
  currency: string | null;
  timingType: RoiCardTimingType;
  recurrenceCadence: RoiCardCadence | null;
  kpiChainNote: string | null;
  doubleCountingGroup: string | null;
  doubleCountingResolutionNote: string | null;
}

export interface RoiCardRiskDto {
  riskId: string;
  category: string;
  label: string;
  description: string | null;
  likelihood: string | null;
  impact: string | null;
  mitigation: string | null;
  ownerUserId: string | null;
}

export interface RoiCardScenarioDto {
  scenarioId: string;
  scenarioType: string;
  label: string;
  description: string | null;
  /** Wskaźniki scenariusza pochodzą z JEGO przebiegu kalkulacji. Brak przebiegu
   *  = wszystkie `null` i `hasRun: false` — UI pisze „—", nie zmyśloną liczbę. */
  hasRun: boolean;
  roiPct: number | null;
  paybackYears: number | null;
  npv: number | null;
  irrPct: number | null;
}

export interface RoiCardVarianceDto {
  varianceId: string;
  metric: string;
  comparisonType: string;
  expected: number | null;
  actual: number | null;
  varianceAmount: number | null;
  variancePct: number | null;
  status: string;
}

export interface RoiCardPirDto {
  pirId: string;
  sequenceNumber: number;
  milestoneMonths: number | null;
  status: string;
  outcome: string | null;
  lessonsLearned: string | null;
  recommendation: string | null;
  realizedRoiPct: number | null;
  realizedNpv: number | null;
  realizedPaybackYears: number | null;
  startedAt: string;
  finalizedAt: string | null;
}

/** Wskaźniki ZAPISANE przez silnik w ostatnim zakończonym przebiegu. */
export interface RoiCardStoredRunDto {
  runId: string;
  engineVersion: string;
  completedAt: string;
  totalCosts: number | null;
  totalFinancialBenefits: number | null;
  roiPct: number | null;
  npv: number | null;
  irrPct: number | null;
  irrStatus: string | null;
  paybackPeriods: number | null;
  discountedPaybackPeriods: number | null;
  benefitCostRatio: number | null;
}

export interface RoiCaseCardDto {
  caseId: string;
  organizationId: string;
  initiativeId: string;
  title: string;
  status: string;
  ownerUserId: string;
  currency: string;
  granularity: string;
  analysisStart: string | null;
  analysisEnd: string | null;
  updatedAt: string;
  phase: RoiCardPhase;

  // — część 1: Założenia —
  subjectType: string | null;
  optionVariant: number | null;
  optionVariantLabel: string | null;
  problemStatement: string | null;
  scopeSummary: string | null;
  bauOptionLabel: string | null;
  recommendation: RoiInvestmentRecommendation | null;
  recommendationCondition: string | null;
  baseline: {
    currentMeasuredValue: number | null;
    currentMeasuredUnit: string | null;
    currentMeasuredAsOf: string | null;
    interventionComparisonNotes: string | null;
    source: string | null;
    confidence: string | null;
  } | null;
  calculationPolicy: {
    discountRatePct: number | null;
    taxTreatment: string | null;
    inflationRatePct: number | null;
    requiredMetrics: string[] | null;
    notes: string | null;
  } | null;
  assumptions: RoiCardAssumptionDto[];
  costLines: RoiCardCostLineDto[];
  benefitLines: RoiCardBenefitLineDto[];
  risks: RoiCardRiskDto[];

  // — część 2: Wyliczenia —
  indicators: RoiCardIndicators;
  storedRun: RoiCardStoredRunDto | null;
  cashFlow: RoiCardCashFlowRow[];
  sensitivity: RoiSensitivityRow[];
  scenarios: RoiCardScenarioDto[];

  // — część 3: Realizacja —
  variances: RoiCardVarianceDto[];
  pirs: RoiCardPirDto[];
}

// ==========================================
// Odczyt
// ==========================================

async function withReadClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await acquirePgClient();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function rows<T extends QueryResultRow>(
  client: PoolClient,
  sql: string,
  values: unknown[]
): Promise<T[]> {
  return (await client.query<T>(sql, values)).rows;
}

/** Kolumny NUMERIC wracają z `pg` jako string — jedna konwersja w jednym
 *  miejscu, żeby nigdzie wyżej nie dodać do siebie dwóch napisów. */
function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toCadence(value: unknown): RoiCardCadence | null {
  return value === 'monthly' || value === 'quarterly' || value === 'annual' ? value : null;
}

export interface RoiCardReadParams {
  userId: string;
  organizationId: string;
}

/**
 * Rejestr analiz (poziom 1). JEDNO zapytanie z bocznymi agregatami zamiast
 * N+1 wywołań kalkulacji per wiersz — to był udokumentowany powód, dla którego
 * `ResultsRoiHub` nie miał dotąd kolumn wskaźników (patrz nagłówek tamtego
 * pliku). Powód znika, bo agregat liczy Postgres, a nie klient.
 */
export async function listRoiRegistryRows(
  params: RoiCardReadParams & { includeArchived?: boolean; limit?: number; offset?: number }
): Promise<RoiRegistryRowDto[]> {
  const { userId, organizationId, includeArchived = false, limit = 100, offset = 0 } = params;
  const cte = await buildVisibilityScopedCte({ userId, organizationId, resourceType: ROI_RESOURCE_TYPE });
  const values: unknown[] = [...cte.values, limit, offset];
  const limitIdx = values.length - 1;
  const offsetIdx = values.length;

  const sql = `${cte.sql}
    SELECT rc.case_id, rc.title, rc.subject_type, rc.option_variant, rc.option_variant_label,
           rc.status, rc.owner_user_id, rc.currency, rc.analysis_start, rc.analysis_end,
           rc.investment_recommendation, rc.recommendation_condition, rc.updated_at,
           capex.total                     AS capex_total,
           benefit.total_per_year          AS benefit_per_year,
           cost_recurring.total_per_year   AS cost_per_year,
           run.simple_roi, run.npv, run.irr_pct, run.payback_periods,
           (run.run_id IS NOT NULL)        AS has_run,
           realization.has_realization
      FROM rvn_roi_cases rc
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = rc.case_id::text
      LEFT JOIN LATERAL (
             SELECT SUM(cl.amount) AS total
               FROM rvn_roi_cost_lines cl
              WHERE cl.case_id = rc.case_id AND cl.deleted_at IS NULL AND cl.timing_type = 'one_time'
           ) capex ON TRUE
      LEFT JOIN LATERAL (
             SELECT SUM(cl.amount * CASE cl.recurrence_cadence
                                      WHEN 'monthly' THEN 12 WHEN 'quarterly' THEN 4 ELSE 1 END) AS total_per_year
               FROM rvn_roi_cost_lines cl
              WHERE cl.case_id = rc.case_id AND cl.deleted_at IS NULL AND cl.timing_type = 'recurring'
           ) cost_recurring ON TRUE
      LEFT JOIN LATERAL (
             SELECT SUM(bl.amount * CASE bl.recurrence_cadence
                                      WHEN 'monthly' THEN 12 WHEN 'quarterly' THEN 4 ELSE 1 END) AS total_per_year
               FROM rvn_roi_benefit_lines bl
              WHERE bl.case_id = rc.case_id AND bl.deleted_at IS NULL
                AND bl.timing_type = 'recurring' AND bl.is_financial = TRUE
           ) benefit ON TRUE
      LEFT JOIN LATERAL (
             SELECT r.run_id, r.simple_roi, r.npv, r.irr_pct, r.payback_periods
               FROM rvn_roi_calculation_runs r
              WHERE r.case_id = rc.case_id AND r.status = 'completed' AND r.scenario_id IS NULL
              ORDER BY r.completed_at DESC NULLS LAST
              LIMIT 1
           ) run ON TRUE
      LEFT JOIN LATERAL (
             SELECT (EXISTS (SELECT 1 FROM rvn_roi_variances v WHERE v.case_id = rc.case_id)
                  OR EXISTS (SELECT 1 FROM rvn_roi_post_investment_reviews p WHERE p.case_id = rc.case_id)) AS has_realization
           ) realization ON TRUE
     WHERE rc.organization_id = $1
       ${includeArchived ? '' : 'AND rc.archived_at IS NULL'}
     ORDER BY rc.updated_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const result = await withReadClient((client) => rows<QueryResultRow>(client, sql, values));

  return result.map((r) => {
    const horizon = horizonYears(r.analysis_start, r.analysis_end);
    const benefits = num(r.benefit_per_year);
    const costs = num(r.cost_per_year);
    const annualNet = benefits === null ? null : benefits - (costs ?? 0);
    const simpleRoi = num(r.simple_roi);
    return {
      caseId: r.case_id,
      title: r.title,
      subjectType: r.subject_type ?? null,
      optionVariant: r.option_variant === null || r.option_variant === undefined ? null : Number(r.option_variant),
      optionVariantLabel: r.option_variant_label ?? null,
      status: r.status,
      phase: deriveRoiCardPhase({
        hasCompletedRun: !!r.has_run,
        hasRealizationData: !!r.has_realization,
      }),
      ownerUserId: r.owner_user_id,
      currency: r.currency,
      analysisStart: r.analysis_start,
      analysisEnd: r.analysis_end,
      horizonYears: horizon,
      capex: num(r.capex_total),
      annualNetBenefit: annualNet,
      roiPct: simpleRoi === null ? null : simpleRoi * 100,
      paybackYears: num(r.payback_periods),
      npv: num(r.npv),
      irrPct: num(r.irr_pct),
      recommendation: (r.investment_recommendation ?? null) as RoiInvestmentRecommendation | null,
      recommendationCondition: r.recommendation_condition ?? null,
      updatedAt: r.updated_at,
    } satisfies RoiRegistryRowDto;
  });
}

/** Karta jednej analizy (poziom 2). `null` = niewidoczna albo nie istnieje —
 *  trasa zwraca na to 404, nigdy 403 (nie wolno wyciekać, że sprawa istnieje). */
export async function getRoiCaseCard(
  params: RoiCardReadParams & { caseId: string }
): Promise<RoiCaseCardDto | null> {
  const { userId, organizationId, caseId } = params;
  const cte = await buildVisibilityScopedCte({ userId, organizationId, resourceType: ROI_RESOURCE_TYPE });
  const scoped = [...cte.values, caseId];
  const caseIdIdx = scoped.length;

  return withReadClient(async (client) => {
    const caseRows = await rows<QueryResultRow>(
      client,
      `${cte.sql}
       SELECT rc.*
         FROM rvn_roi_cases rc
         INNER JOIN rvn_visible_resources vr
                 ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = rc.case_id::text
        WHERE rc.organization_id = $1 AND rc.case_id = $${caseIdIdx}`,
      scoped
    );
    const c = caseRows[0];
    if (!c) return null;

    // Od tego miejsca widoczność jest już rozstrzygnięta na SPRAWIE — tabele
    // podrzędne czytamy po `case_id`, dokładnie jak `getRoiBaseline`.
    const [
      baselineRows,
      policyRows,
      assumptionRows,
      costRows,
      benefitRows,
      riskRows,
      scenarioRows,
      runRows,
      varianceRows,
      pirRows,
      outcomeRows,
    ] = await Promise.all([
      rows<QueryResultRow>(client, `SELECT * FROM rvn_roi_baselines WHERE case_id = $1`, [caseId]),
      rows<QueryResultRow>(client, `SELECT * FROM rvn_roi_calculation_policy WHERE case_id = $1`, [caseId]),
      rows<QueryResultRow>(
        client,
        `SELECT * FROM rvn_roi_assumptions WHERE case_id = $1 AND deleted_at IS NULL
          ORDER BY sensitivity_rank NULLS LAST, created_at`,
        [caseId]
      ),
      rows<QueryResultRow>(
        client,
        `SELECT * FROM rvn_roi_cost_lines WHERE case_id = $1 AND deleted_at IS NULL ORDER BY created_at`,
        [caseId]
      ),
      rows<QueryResultRow>(
        client,
        `SELECT * FROM rvn_roi_benefit_lines WHERE case_id = $1 AND deleted_at IS NULL ORDER BY created_at`,
        [caseId]
      ),
      rows<QueryResultRow>(
        client,
        `SELECT * FROM rvn_roi_risks WHERE case_id = $1 AND deleted_at IS NULL ORDER BY created_at`,
        [caseId]
      ),
      rows<QueryResultRow>(
        client,
        `SELECT s.*, r.run_id AS scenario_run_id, r.simple_roi, r.npv, r.irr_pct, r.payback_periods
           FROM rvn_roi_scenarios s
           LEFT JOIN LATERAL (
                  SELECT run_id, simple_roi, npv, irr_pct, payback_periods
                    FROM rvn_roi_calculation_runs cr
                   WHERE cr.scenario_id = s.scenario_id AND cr.status = 'completed'
                   ORDER BY cr.completed_at DESC NULLS LAST LIMIT 1
                ) r ON TRUE
          WHERE s.case_id = $1 AND s.deleted_at IS NULL
          ORDER BY s.created_at`,
        [caseId]
      ),
      rows<QueryResultRow>(
        client,
        `SELECT * FROM rvn_roi_calculation_runs
          WHERE case_id = $1 AND status = 'completed' AND scenario_id IS NULL
          ORDER BY completed_at DESC NULLS LAST LIMIT 1`,
        [caseId]
      ),
      rows<QueryResultRow>(
        client,
        `SELECT * FROM rvn_roi_variances WHERE case_id = $1 ORDER BY created_at`,
        [caseId]
      ),
      rows<QueryResultRow>(
        client,
        `SELECT * FROM rvn_roi_post_investment_reviews WHERE case_id = $1 ORDER BY sequence_number`,
        [caseId]
      ),
      rows<QueryResultRow>(
        client,
        `SELECT * FROM rvn_roi_assumption_outcomes WHERE case_id = $1`,
        [caseId]
      ),
    ]);

    const baselineRow = baselineRows[0] ?? null;
    const policyRow = policyRows[0] ?? null;
    const runRow = runRows[0] ?? null;

    const verdictByAssumption = new Map<string, QueryResultRow>();
    for (const o of outcomeRows) verdictByAssumption.set(o.assumption_id, o);

    const costLines: RoiCardCostLineDto[] = costRows.map((r) => ({
      costLineId: r.cost_line_id,
      category: r.category,
      label: r.label,
      description: r.description ?? null,
      amount: num(r.amount),
      currency: r.currency,
      timingType: r.timing_type as RoiCardTimingType,
      recurrenceCadence: toCadence(r.recurrence_cadence),
    }));

    const benefitLines: RoiCardBenefitLineDto[] = benefitRows.map((r) => ({
      benefitLineId: r.benefit_line_id,
      category: r.category,
      label: r.label,
      description: r.description ?? null,
      benefitClass: (r.benefit_class ?? null) as RoiBenefitClass | null,
      isFinancial: !!r.is_financial,
      amount: num(r.amount),
      currency: r.currency ?? null,
      timingType: r.timing_type as RoiCardTimingType,
      recurrenceCadence: toCadence(r.recurrence_cadence),
      kpiChainNote: r.kpi_chain_note ?? null,
      doubleCountingGroup: r.double_counting_group ?? null,
      doubleCountingResolutionNote: r.double_counting_resolution_note ?? null,
    }));

    const capex = sumOneTime(costLines);
    const annualCosts = sumRecurringPerYear(costLines);
    const annualBenefits = sumRecurringPerYear(
      benefitLines.map((b) => ({
        amount: b.amount,
        timingType: b.timingType,
        recurrenceCadence: b.recurrenceCadence,
        isFinancial: b.isFinancial,
      }))
    );
    const annualNetBenefit = annualBenefits === null ? null : annualBenefits - (annualCosts ?? 0);
    const horizon = horizonYears(c.analysis_start, c.analysis_end);
    const discountRatePct = policyRow ? num(policyRow.discount_rate_pct) : null;

    const indicators = computeRoiIndicators({
      initialInvestment: capex,
      annualNetBenefit,
      horizon,
      discountRatePct,
    });

    const cashFlow = buildCashFlowRows({
      analysisStart: c.analysis_start,
      horizon,
      initialInvestment: capex,
      annualCosts,
      annualBenefits,
      discountRatePct,
    });

    const sensitivity = computeSensitivity({
      initialInvestment: capex,
      annualBenefits,
      annualCosts,
      horizon,
      discountRatePct,
    });

    const pirs: RoiCardPirDto[] = pirRows.map((r) => ({
      pirId: r.pir_id,
      sequenceNumber: Number(r.sequence_number),
      milestoneMonths: r.milestone_months === null || r.milestone_months === undefined ? null : Number(r.milestone_months),
      status: r.status,
      outcome: r.outcome ?? null,
      lessonsLearned: r.lessons_learned ?? null,
      recommendation: r.recommendation ?? null,
      realizedRoiPct: num(r.realized_roi_pct),
      realizedNpv: num(r.realized_npv),
      realizedPaybackYears: num(r.realized_payback_periods),
      startedAt: r.started_at,
      finalizedAt: r.finalized_at ?? null,
    }));

    const variances: RoiCardVarianceDto[] = varianceRows.map((r) => ({
      varianceId: r.variance_id,
      metric: r.metric,
      comparisonType: r.comparison_type,
      expected: num(r.baseline_value),
      actual: num(r.comparison_value),
      varianceAmount: num(r.variance_amount),
      variancePct: num(r.variance_pct),
      status: r.status,
    }));

    return {
      caseId: c.case_id,
      organizationId: c.organization_id,
      initiativeId: c.initiative_id,
      title: c.title,
      status: c.status,
      ownerUserId: c.owner_user_id,
      currency: c.currency,
      granularity: c.granularity,
      analysisStart: c.analysis_start,
      analysisEnd: c.analysis_end,
      updatedAt: c.updated_at,
      phase: deriveRoiCardPhase({
        hasCompletedRun: !!runRow,
        hasRealizationData: variances.length > 0 || pirs.length > 0,
      }),

      subjectType: c.subject_type ?? null,
      optionVariant: c.option_variant === null || c.option_variant === undefined ? null : Number(c.option_variant),
      optionVariantLabel: c.option_variant_label ?? null,
      problemStatement: c.problem_statement ?? null,
      scopeSummary: c.scope_summary ?? null,
      bauOptionLabel: c.bau_option_label ?? null,
      recommendation: (c.investment_recommendation ?? null) as RoiInvestmentRecommendation | null,
      recommendationCondition: c.recommendation_condition ?? null,

      baseline: baselineRow
        ? {
            currentMeasuredValue: num(baselineRow.current_measured_value),
            currentMeasuredUnit: baselineRow.current_measured_unit ?? null,
            currentMeasuredAsOf: baselineRow.current_measured_as_of ?? null,
            interventionComparisonNotes: baselineRow.intervention_comparison_notes ?? null,
            source: baselineRow.source ?? null,
            confidence: baselineRow.confidence ?? null,
          }
        : null,
      calculationPolicy: policyRow
        ? {
            discountRatePct,
            taxTreatment: policyRow.tax_treatment ?? null,
            inflationRatePct: num(policyRow.inflation_rate_pct),
            requiredMetrics: policyRow.required_metrics ?? null,
            notes: policyRow.notes ?? null,
          }
        : null,

      assumptions: assumptionRows.map((r) => {
        const outcome = verdictByAssumption.get(r.assumption_id);
        return {
          assumptionId: r.assumption_id,
          category: r.category,
          label: r.label,
          unit: r.unit ?? null,
          baseValue: num(r.base_value),
          downsideValue: num(r.downside_value),
          upsideValue: num(r.upside_value),
          confidence: r.confidence ?? null,
          source: r.source ?? null,
          sensitivityRank: r.sensitivity_rank === null || r.sensitivity_rank === undefined ? null : Number(r.sensitivity_rank),
          verdict: (outcome?.verdict ?? null) as RoiAssumptionVerdict | null,
          verdictNote: outcome?.note ?? null,
        } satisfies RoiCardAssumptionDto;
      }),
      costLines,
      benefitLines,
      risks: riskRows.map((r) => ({
        riskId: r.risk_id,
        category: r.category,
        label: r.label,
        description: r.description ?? null,
        likelihood: r.likelihood ?? null,
        impact: r.impact ?? null,
        mitigation: r.mitigation ?? null,
        ownerUserId: r.owner_user_id ?? null,
      })),

      indicators,
      storedRun: runRow
        ? {
            runId: runRow.run_id,
            engineVersion: runRow.engine_version,
            completedAt: runRow.completed_at,
            totalCosts: num(runRow.total_costs),
            totalFinancialBenefits: num(runRow.total_financial_benefits),
            roiPct: num(runRow.simple_roi) === null ? null : (num(runRow.simple_roi) as number) * 100,
            npv: num(runRow.npv),
            irrPct: num(runRow.irr_pct),
            irrStatus: runRow.irr_status ?? null,
            paybackPeriods: num(runRow.payback_periods),
            discountedPaybackPeriods: num(runRow.discounted_payback_periods),
            benefitCostRatio: num(runRow.benefit_cost_ratio),
          }
        : null,
      cashFlow,
      sensitivity,
      scenarios: scenarioRows.map((r) => ({
        scenarioId: r.scenario_id,
        scenarioType: r.scenario_type,
        label: r.label,
        description: r.description ?? null,
        hasRun: !!r.scenario_run_id,
        roiPct: num(r.simple_roi) === null ? null : (num(r.simple_roi) as number) * 100,
        paybackYears: num(r.payback_periods),
        npv: num(r.npv),
        irrPct: num(r.irr_pct),
      })),

      variances,
      pirs,
    } satisfies RoiCaseCardDto;
  });
}
