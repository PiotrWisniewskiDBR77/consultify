/**
 * ROI (P7K C) — klient dwóch odczytów karty analizy ROI:
 *  · `GET /vnext/results/roi/registry`         — poziom 1, tabela analiz
 *  · `GET /vnext/results/roi/cases/:id/card`   — poziom 2, karta w 3 częściach
 *
 * Kształty 1:1 z `server/src/services/resultsVnext/roi/card/roiCaseCardRepository.ts`
 * (czytane, nie zgadywane). Transport ten sam, co reszta ROI: `getJson`
 * z `../roiApi.ts` (goły `fetch` + `API_URL` + `getHeaders`), NIE wielki
 * obiekt `Api` — dwa transporty w jednym module to dwie prawdy o błędach.
 *
 * BRAK ≠ ZERO: każde pole liczbowe jest `number | null`; `null` znaczy
 * „nie policzone / nie zapisane" i UI rysuje „—" (SSOT §6).
 */
import { getJson, RoiApiError } from '../roiApi';

export { RoiApiError };

export type RoiCardPhase = 'assumptions' | 'calculations' | 'realization';
export type RoiInvestmentRecommendation = 'go' | 'conditional_go' | 'no_go';
export type RoiBenefitClass = 'hard' | 'avoided' | 'soft' | 'strategic';
export type RoiAssumptionVerdict = 'confirmed' | 'partially_confirmed' | 'refuted';
export type RoiCardTimingType = 'one_time' | 'recurring';
export type RoiCardCadence = 'monthly' | 'quarterly' | 'annual';

export interface RoiRegistryRow {
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

export interface RoiCardAssumption {
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
  verdict: RoiAssumptionVerdict | null;
  verdictNote: string | null;
}

export interface RoiCardCostLine {
  costLineId: string;
  category: string;
  label: string;
  description: string | null;
  amount: number | null;
  currency: string;
  timingType: RoiCardTimingType;
  recurrenceCadence: RoiCardCadence | null;
}

export interface RoiCardBenefitLine {
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

export interface RoiCardRisk {
  riskId: string;
  category: string;
  label: string;
  description: string | null;
  likelihood: string | null;
  impact: string | null;
  mitigation: string | null;
  ownerUserId: string | null;
}

export interface RoiCardScenario {
  scenarioId: string;
  scenarioType: string;
  label: string;
  description: string | null;
  hasRun: boolean;
  roiPct: number | null;
  paybackYears: number | null;
  npv: number | null;
  irrPct: number | null;
}

export interface RoiCardVariance {
  varianceId: string;
  metric: string;
  comparisonType: string;
  expected: number | null;
  actual: number | null;
  varianceAmount: number | null;
  variancePct: number | null;
  status: string;
}

export interface RoiCardPir {
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

export interface RoiCardCashFlowRow {
  year: number;
  label: string;
  costs: number;
  benefits: number;
  net: number;
  cumulative: number;
  discounted: number | null;
  cumulativeDiscounted: number | null;
}

export interface RoiCardIndicators {
  capex: number | null;
  annualNetBenefit: number | null;
  horizonYears: number | null;
  roiPct: number | null;
  arrPct: number | null;
  paybackYears: number | null;
  discountedPaybackYears: number | null;
  npv: number | null;
  irrPct: number | null;
  profitabilityIndex: number | null;
  benefitCostRatio: number | null;
  discountRatePct: number | null;
}

export interface RoiCardStoredRun {
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

export interface RoiSensitivityRow {
  driverId: 'capex' | 'annual_benefit' | 'annual_opex' | 'discount_rate';
  minusNpv: number | null;
  minusRoiPct: number | null;
  minusPaybackYears: number | null;
  plusNpv: number | null;
  plusRoiPct: number | null;
  plusPaybackYears: number | null;
}

export interface RoiCaseCard {
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
  assumptions: RoiCardAssumption[];
  costLines: RoiCardCostLine[];
  benefitLines: RoiCardBenefitLine[];
  risks: RoiCardRisk[];

  indicators: RoiCardIndicators;
  storedRun: RoiCardStoredRun | null;
  cashFlow: RoiCardCashFlowRow[];
  sensitivity: RoiSensitivityRow[];
  scenarios: RoiCardScenario[];

  variances: RoiCardVariance[];
  pirs: RoiCardPir[];
}

export async function listRoiRegistry(): Promise<RoiRegistryRow[]> {
  const { rows } = await getJson<{ rows: RoiRegistryRow[] }>('/vnext/results/roi/registry');
  return rows;
}

/** `null` = 404 z serwera: „nie istnieje" i „nie widzisz" są nieodróżnialne
 *  z założenia (D06/D07) — strona renderuje na to stan braku dostępu. */
export async function getRoiCaseCard(caseId: string): Promise<RoiCaseCard | null> {
  try {
    const { card } = await getJson<{ card: RoiCaseCard }>(
      `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/card`
    );
    return card;
  } catch (err) {
    if (err instanceof RoiApiError && err.status === 404) return null;
    throw err;
  }
}
