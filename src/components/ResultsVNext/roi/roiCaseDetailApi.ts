/**
 * RN-G2 §G #12-14 — ROI Case MODEL SETUP API client: baseline +
 * calculation policy (§G #12), assumptions CRUD (§G #13 first half), cost
 * lines + benefit lines CRUD (§G #13 second half / §G #14). Deliberately
 * NOT scenarios/overrides/calculation-runs/forecast/actuals/variances/PIR/
 * finance links — those stay later packages (§G #15-21), matching the ROI
 * Case registry package's own "small, exactly-scoped client" convention
 * (`roiApi.ts` header comment).
 *
 * Same `getJson`/`mutateJson` plumbing as `roiApi.ts` (imported, not
 * duplicated — see that file's header comment on the export). Server
 * source of truth for every shape below:
 *  - `server/src/services/resultsVnext/roi/roiTypes.ts` (`RoiBaseline`)
 *  - `server/src/services/resultsVnext/roi/roiEconomicModelTypes.ts`
 *    (`RoiCalculationPolicy`/`RoiAssumption`/`RoiCostLine`/`RoiBenefitLine`
 *    — DTOs are already camelCase JSON on the wire via `to*` mappers, and
 *    numeric columns are ALREADY converted to JS `number` server-side
 *    — `toNullableNumber`/`Number(row.amount)` — so this client never adds
 *    two numeric-string wire values together the way CLAUDE.md's `numeric`
 *    driver pitfall warns about; it only ever displays server-computed
 *    numbers or sends a single typed `number` field back)
 *  - `server/src/validators/resultsVnextRoi.validators.ts`
 *    (`CaptureOrUpdateBaselineSchema`)
 *  - `server/src/validators/resultsVnextRoiEconomicModel.validators.ts`
 *    (every other schema referenced below — read in full, not guessed)
 *  - `server/src/routes/resultsVnext/roi.routes.ts` L690-1367 (exact
 *    paths/methods/response envelopes for every endpoint below)
 */
import { getJson, mutateJson, newRoiIdempotencyKey, RoiApiError } from './roiApi';
import { shouldUseResultsVNextOwnerSampleData } from '../resultsVNextOwnerSampleData';

export { newRoiIdempotencyKey, RoiApiError };

// ==========================================
// Shared enums — verbatim from the server CHECK constraints cited above.
// `RoiConfidenceLevel` intentionally covers BOTH
// `ROI_BASELINE_CONFIDENCE_LEVELS` (roiTypes.ts) and `ROI_CONFIDENCE_LEVELS`
// (roiEconomicModelTypes.ts): both are `['low','medium','high']` verbatim —
// one client type, not two identical unions that could silently diverge.
// ==========================================

export const ROI_CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;
export type RoiConfidenceLevel = (typeof ROI_CONFIDENCE_LEVELS)[number];

export const ROI_BASELINE_PROJECTION_METHODS = ['flat', 'growth_rate', 'custom'] as const;
export type RoiBaselineProjectionMethod = (typeof ROI_BASELINE_PROJECTION_METHODS)[number];

export const ROI_TAX_TREATMENTS = ['pre_tax', 'post_tax', 'not_modeled'] as const;
export type RoiTaxTreatment = (typeof ROI_TAX_TREATMENTS)[number];

export const ROI_ROUNDING_POLICIES = ['half_up_2dp', 'half_even_2dp', 'none'] as const;
export type RoiRoundingPolicy = (typeof ROI_ROUNDING_POLICIES)[number];

export const ROI_TIMING_TYPES = ['one_time', 'recurring'] as const;
export type RoiTimingType = (typeof ROI_TIMING_TYPES)[number];

export const ROI_RECURRENCE_CADENCES = ['monthly', 'quarterly', 'annual'] as const;
export type RoiRecurrenceCadence = (typeof ROI_RECURRENCE_CADENCES)[number];

// ==========================================
// DTOs (1:1 with the server `to*` mapper output — every field it returns)
// ==========================================

export interface RoiBaseline {
  baselineId: string;
  caseId: string;
  organizationId: string;
  baselinePeriodStart: string | null;
  baselinePeriodEnd: string | null;
  currentMeasuredValue: number | null;
  currentMeasuredUnit: string | null;
  currentMeasuredAsOf: string | null;
  bauProjectionMethod: RoiBaselineProjectionMethod;
  bauGrowthRatePct: number | null;
  bauReferenceValue: number | null;
  interventionComparisonNotes: string | null;
  source: string | null;
  confidence: RoiConfidenceLevel | null;
  ownerUserId: string | null;
  frozenAt: string | null;
  frozenBy: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoiCalculationPolicy {
  policyRowId: string;
  caseId: string;
  organizationId: string;
  discountRatePct: number | null;
  taxTreatment: RoiTaxTreatment | null;
  inflationRatePct: number | null;
  roundingPolicy: RoiRoundingPolicy;
  requiredMetrics: string[] | null;
  notes: string | null;
  confidence: RoiConfidenceLevel | null;
  ownerUserId: string | null;
  frozenAt: string | null;
  frozenBy: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoiAssumption {
  assumptionId: string;
  caseId: string;
  organizationId: string;
  category: string;
  label: string;
  unit: string | null;
  baseValue: number | null;
  downsideValue: number | null;
  upsideValue: number | null;
  confidence: RoiConfidenceLevel | null;
  evidenceRef: string | null;
  source: string | null;
  ownerUserId: string | null;
  sensitivityRank: number | null;
  notes: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  frozenAt: string | null;
  frozenBy: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoiCostLine {
  costLineId: string;
  caseId: string;
  organizationId: string;
  category: string;
  label: string;
  description: string | null;
  amount: number;
  currency: string;
  timingType: RoiTimingType;
  oneTimePeriodDate: string | null;
  recurrenceStartDate: string | null;
  recurrenceEndDate: string | null;
  recurrenceCadence: RoiRecurrenceCadence | null;
  confidence: RoiConfidenceLevel | null;
  source: string | null;
  ownerUserId: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  frozenAt: string | null;
  frozenBy: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoiBenefitLine {
  benefitLineId: string;
  caseId: string;
  organizationId: string;
  category: string;
  label: string;
  description: string | null;
  isFinancial: boolean;
  amount: number | null;
  currency: string | null;
  timingType: RoiTimingType;
  oneTimePeriodDate: string | null;
  recurrenceStartDate: string | null;
  recurrenceEndDate: string | null;
  recurrenceCadence: RoiRecurrenceCadence | null;
  rampPeriods: number | null;
  doubleCountingGroup: string | null;
  doubleCountingResolutionNote: string | null;
  confidence: RoiConfidenceLevel | null;
  source: string | null;
  ownerUserId: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  frozenAt: string | null;
  frozenBy: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** Shared trailer every write call needs — `expectedVersion` for the CAS,
 * `reason` for the audit event (required on some endpoints, optional on
 * others — enforced by each function's own input type below, not here). */
interface WriteTrailer {
  idempotencyKey: string;
}

// ==========================================
// GET/PUT .../baseline
// ==========================================

export async function getRoiBaseline(caseId: string): Promise<RoiBaseline | null> {
  if (shouldUseResultsVNextOwnerSampleData()) {
    return {
      baselineId: `${caseId}-baseline`,
      caseId,
      organizationId: 'sample-org',
      baselinePeriodStart: '2025-01-01',
      baselinePeriodEnd: '2025-12-31',
      currentMeasuredValue: 1240000,
      currentMeasuredUnit: 'PLN/year',
      currentMeasuredAsOf: '2025-12-31',
      bauProjectionMethod: 'flat',
      bauGrowthRatePct: 0,
      bauReferenceValue: 1240000,
      interventionComparisonNotes:
        'Owner-review sample baseline used to evaluate the full ROI card.',
      source: 'Owner review sample',
      confidence: 'medium',
      ownerUserId: 'Piotr Wiśniewski',
      frozenAt: null,
      frozenBy: null,
      rowVersion: 1,
      createdBy: 'Piotr Wiśniewski',
      createdAt: '2026-01-15T08:00:00.000Z',
      updatedAt: '2026-08-23T14:30:00.000Z',
    };
  }
  try {
    const { baseline } = await getJson<{ baseline: RoiBaseline }>(
      `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/baseline`
    );
    return baseline;
  } catch (err) {
    // Design note (`roiBaselineCommands.ts` L98): "the baseline row always
    // exists from case creation" — a 404 here is not the expected steady
    // state, but the route DOES define one (`roi.routes.ts` L703-706) for a
    // case-not-found/edge condition, so the client still has to render it
    // honestly (empty state) instead of treating it as a thrown error.
    if (err instanceof RoiApiError && err.status === 404) return null;
    throw err;
  }
}

export interface PutRoiBaselineInput {
  expectedVersion: number;
  baselinePeriodStart?: string | null;
  baselinePeriodEnd?: string | null;
  currentMeasuredValue?: number | null;
  currentMeasuredUnit?: string | null;
  currentMeasuredAsOf?: string | null;
  bauProjectionMethod?: RoiBaselineProjectionMethod;
  bauGrowthRatePct?: number | null;
  bauReferenceValue?: number | null;
  interventionComparisonNotes?: string | null;
  source?: string | null;
  confidence?: RoiConfidenceLevel | null;
  ownerUserId?: string | null;
  reason?: string | null;
}

export interface PutRoiBaselineResponse {
  outcome: 'applied' | 'duplicate';
  baseline: RoiBaseline;
}

export async function putRoiBaseline(
  caseId: string,
  input: PutRoiBaselineInput & WriteTrailer
): Promise<PutRoiBaselineResponse> {
  return mutateJson<PutRoiBaselineResponse>(
    'PUT',
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/baseline`,
    input
  );
}

// ==========================================
// GET/PUT .../calculation-policy
// ==========================================

export async function getRoiCalculationPolicy(
  caseId: string
): Promise<RoiCalculationPolicy | null> {
  if (shouldUseResultsVNextOwnerSampleData()) {
    return {
      policyRowId: `${caseId}-policy`,
      caseId,
      organizationId: 'sample-org',
      discountRatePct: 8,
      taxTreatment: 'pre_tax',
      inflationRatePct: 2.5,
      roundingPolicy: 'half_up_2dp',
      requiredMetrics: ['NPV', 'IRR', 'payback_period'],
      notes: 'Owner-review sample policy used to evaluate the full ROI card.',
      confidence: 'medium',
      ownerUserId: 'Piotr Wiśniewski',
      frozenAt: null,
      frozenBy: null,
      rowVersion: 1,
      createdBy: 'Piotr Wiśniewski',
      createdAt: '2026-01-15T08:00:00.000Z',
      updatedAt: '2026-08-23T14:30:00.000Z',
    };
  }
  try {
    const { calculationPolicy } = await getJson<{ calculationPolicy: RoiCalculationPolicy }>(
      `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/calculation-policy`
    );
    return calculationPolicy;
  } catch (err) {
    // Same "shell row always exists from case creation" design as the
    // baseline above (`roiCalculationPolicyCommands.ts` header comment) —
    // the 404 branch still exists on the route and is rendered honestly.
    if (err instanceof RoiApiError && err.status === 404) return null;
    throw err;
  }
}

export interface PutRoiCalculationPolicyInput {
  expectedVersion: number;
  discountRatePct?: number | null;
  taxTreatment?: RoiTaxTreatment | null;
  inflationRatePct?: number | null;
  roundingPolicy?: RoiRoundingPolicy;
  requiredMetrics?: string[] | null;
  notes?: string | null;
  confidence?: RoiConfidenceLevel | null;
  ownerUserId?: string | null;
  reason?: string | null;
}

export interface PutRoiCalculationPolicyResponse {
  outcome: 'applied' | 'duplicate';
  calculationPolicy: RoiCalculationPolicy;
}

export async function putRoiCalculationPolicy(
  caseId: string,
  input: PutRoiCalculationPolicyInput & WriteTrailer
): Promise<PutRoiCalculationPolicyResponse> {
  return mutateJson<PutRoiCalculationPolicyResponse>(
    'PUT',
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/calculation-policy`,
    input
  );
}

// ==========================================
// GET/POST/PATCH/DELETE .../assumptions[/:assumptionId]
// ==========================================

export async function listRoiAssumptions(caseId: string): Promise<RoiAssumption[]> {
  const { assumptions } = await getJson<{ assumptions: RoiAssumption[] }>(
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/assumptions`
  );
  return assumptions;
}

export interface AddRoiAssumptionInput {
  category: string;
  label: string;
  unit?: string | null;
  baseValue?: number | null;
  downsideValue?: number | null;
  upsideValue?: number | null;
  confidence?: RoiConfidenceLevel | null;
  evidenceRef?: string | null;
  source?: string | null;
  ownerUserId?: string | null;
  sensitivityRank?: number | null;
  notes?: string | null;
  reason?: string | null;
}

export interface RoiAssumptionWriteResponse {
  outcome: 'applied' | 'duplicate';
  assumption: RoiAssumption;
}

export async function addRoiAssumption(
  caseId: string,
  input: AddRoiAssumptionInput & WriteTrailer
): Promise<RoiAssumptionWriteResponse> {
  return mutateJson<RoiAssumptionWriteResponse>(
    'POST',
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/assumptions`,
    input
  );
}

export interface UpdateRoiAssumptionInput extends Partial<AddRoiAssumptionInput> {
  expectedVersion: number;
}

export async function updateRoiAssumption(
  caseId: string,
  assumptionId: string,
  input: UpdateRoiAssumptionInput & WriteTrailer
): Promise<RoiAssumptionWriteResponse> {
  return mutateJson<RoiAssumptionWriteResponse>(
    'PATCH',
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/assumptions/${encodeURIComponent(assumptionId)}`,
    input
  );
}

export interface RemoveRoiLineItemInput {
  expectedVersion: number;
  reason?: string | null;
}

export async function removeRoiAssumption(
  caseId: string,
  assumptionId: string,
  input: RemoveRoiLineItemInput & WriteTrailer
): Promise<RoiAssumptionWriteResponse> {
  return mutateJson<RoiAssumptionWriteResponse>(
    'DELETE',
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/assumptions/${encodeURIComponent(assumptionId)}`,
    input
  );
}

// ==========================================
// GET/POST/PATCH/DELETE .../cost-lines[/:costLineId]
// ==========================================

export async function listRoiCostLines(caseId: string): Promise<RoiCostLine[]> {
  const { costLines } = await getJson<{ costLines: RoiCostLine[] }>(
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/cost-lines`
  );
  return costLines;
}

export interface AddRoiCostLineInput {
  category: string;
  label: string;
  description?: string | null;
  amount: number;
  currency: string;
  timingType: RoiTimingType;
  oneTimePeriodDate?: string | null;
  recurrenceStartDate?: string | null;
  recurrenceEndDate?: string | null;
  recurrenceCadence?: RoiRecurrenceCadence | null;
  confidence?: RoiConfidenceLevel | null;
  source?: string | null;
  ownerUserId?: string | null;
  reason?: string | null;
}

export interface RoiCostLineWriteResponse {
  outcome: 'applied' | 'duplicate';
  costLine: RoiCostLine;
}

export async function addRoiCostLine(
  caseId: string,
  input: AddRoiCostLineInput & WriteTrailer
): Promise<RoiCostLineWriteResponse> {
  return mutateJson<RoiCostLineWriteResponse>(
    'POST',
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/cost-lines`,
    input
  );
}

export interface UpdateRoiCostLineInput extends Partial<AddRoiCostLineInput> {
  expectedVersion: number;
}

export async function updateRoiCostLine(
  caseId: string,
  costLineId: string,
  input: UpdateRoiCostLineInput & WriteTrailer
): Promise<RoiCostLineWriteResponse> {
  return mutateJson<RoiCostLineWriteResponse>(
    'PATCH',
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/cost-lines/${encodeURIComponent(costLineId)}`,
    input
  );
}

export async function removeRoiCostLine(
  caseId: string,
  costLineId: string,
  input: RemoveRoiLineItemInput & WriteTrailer
): Promise<RoiCostLineWriteResponse> {
  return mutateJson<RoiCostLineWriteResponse>(
    'DELETE',
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/cost-lines/${encodeURIComponent(costLineId)}`,
    input
  );
}

// ==========================================
// GET/POST/PATCH/DELETE .../benefit-lines[/:benefitLineId]
// ==========================================

export async function listRoiBenefitLines(caseId: string): Promise<RoiBenefitLine[]> {
  const { benefitLines } = await getJson<{ benefitLines: RoiBenefitLine[] }>(
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/benefit-lines`
  );
  return benefitLines;
}

export interface AddRoiBenefitLineInput {
  category: string;
  label: string;
  description?: string | null;
  isFinancial?: boolean;
  amount?: number | null;
  currency?: string | null;
  timingType: RoiTimingType;
  oneTimePeriodDate?: string | null;
  recurrenceStartDate?: string | null;
  recurrenceEndDate?: string | null;
  recurrenceCadence?: RoiRecurrenceCadence | null;
  rampPeriods?: number | null;
  doubleCountingGroup?: string | null;
  doubleCountingResolutionNote?: string | null;
  confidence?: RoiConfidenceLevel | null;
  source?: string | null;
  ownerUserId?: string | null;
  reason?: string | null;
}

export interface RoiBenefitLineWriteResponse {
  outcome: 'applied' | 'duplicate';
  benefitLine: RoiBenefitLine;
}

export async function addRoiBenefitLine(
  caseId: string,
  input: AddRoiBenefitLineInput & WriteTrailer
): Promise<RoiBenefitLineWriteResponse> {
  return mutateJson<RoiBenefitLineWriteResponse>(
    'POST',
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/benefit-lines`,
    input
  );
}

export interface UpdateRoiBenefitLineInput extends Partial<AddRoiBenefitLineInput> {
  expectedVersion: number;
}

export async function updateRoiBenefitLine(
  caseId: string,
  benefitLineId: string,
  input: UpdateRoiBenefitLineInput & WriteTrailer
): Promise<RoiBenefitLineWriteResponse> {
  return mutateJson<RoiBenefitLineWriteResponse>(
    'PATCH',
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/benefit-lines/${encodeURIComponent(benefitLineId)}`,
    input
  );
}

export async function removeRoiBenefitLine(
  caseId: string,
  benefitLineId: string,
  input: RemoveRoiLineItemInput & WriteTrailer
): Promise<RoiBenefitLineWriteResponse> {
  return mutateJson<RoiBenefitLineWriteResponse>(
    'DELETE',
    `/vnext/results/roi/cases/${encodeURIComponent(caseId)}/benefit-lines/${encodeURIComponent(benefitLineId)}`,
    input
  );
}
