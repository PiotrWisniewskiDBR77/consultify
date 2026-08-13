/**
 * ROI Case FULL TOOL API client — the remaining ~11 sub-resource groups
 * `roiCaseDetailApi.ts` deliberately left out of its scope (that file's own
 * header comment: "Deliberately NOT scenarios/overrides/calculation-runs/
 * forecast/actuals/variances/PIR/finance links — those stay later
 * packages"). This file is that later package: scenarios + overrides,
 * calculation runs, KPI evidence links (+freshness-check), approval
 * snapshots, forecast versions + compare, actuals (+corrections/verify/
 * dispute), actual snapshots, variances (+causes), the case-level benefits-
 * realization view, PIR (schedule/list/detail/draft-edit/teresa-draft-
 * disposition), finance links, finance reconciliations.
 *
 * Same `getJson`/`mutateJson`/`RoiApiError`/`newRoiIdempotencyKey` plumbing
 * as `roiApi.ts`/`roiCaseDetailApi.ts` — imported, not duplicated (one
 * family of files convention, `roiApi.ts` header comment).
 *
 * Every path/method/body-field/response-envelope-key below was read
 * directly off `server/src/routes/resultsVnext/roi.routes.ts` (line ranges
 * cited per section) and the paired validator files
 * (`server/src/validators/resultsVnextRoiEconomicModel.validators.ts`,
 * `resultsVnextRoiForecastActual.validators.ts`, `resultsVnextRoiPir.validators.ts`,
 * `resultsVnextRoi.validators.ts`) — not guessed. `server/**` is frozen and
 * out of this package's allowlist; this file is a pure client of it.
 *
 * Numeric-string pitfall (CLAUDE.md "pułapka pieniędzy"): every DTO below
 * mirrors the server's OWN camelCase JSON, and every server `to*` mapper
 * routes numeric columns through `toNullableNumber`/`Number(...)` before
 * serializing — so every numeric field here already arrives as a JS
 * `number | null` on the wire, never a `numeric`-as-string. This client
 * never adds two wire values together; it only displays server-computed
 * numbers or sends a single typed `number` back.
 *
 * Honest-missing note (confirmed by direct grep of `server/src/services/
 * resultsVnext/roi/`, zero hits): the ROI domain's numeric fields are a
 * strict `number | null` PAIR, never a `'not_calculable'` triple — that
 * third state exists only in the OKR domain. `RoiIrrStatus`
 * (`roiApi.ts`) is the one ROI exception, and it is already handled by
 * `deriveIrrHonestValue` in `roiRegistryMappers.ts`. Nothing here invents a
 * `'not_calculable'` sentinel the server does not return.
 */
import { getJson, mutateJson, newRoiIdempotencyKey, RoiApiError } from './roiApi';

export { newRoiIdempotencyKey, RoiApiError };

// ==========================================
// Shared enums — verbatim from server CHECK constraints / TS const arrays.
// ==========================================

export const ROI_SCENARIO_TYPES = ['downside', 'upside', 'custom'] as const;
export type RoiScenarioType = (typeof ROI_SCENARIO_TYPES)[number];

export const ROI_SCENARIO_OVERRIDE_TARGET_TYPES = ['assumption', 'cost_line', 'benefit_line'] as const;
export type RoiScenarioOverrideTargetType = (typeof ROI_SCENARIO_OVERRIDE_TARGET_TYPES)[number];

export const ROI_EVIDENCE_LINK_PURPOSES = ['primary_evidence', 'supporting'] as const;
export type RoiEvidenceLinkPurpose = (typeof ROI_EVIDENCE_LINK_PURPOSES)[number];

export const ROI_EVIDENCE_LINK_DISPUTE_STATUSES = ['none', 'stale', 'disputed'] as const;
export type RoiEvidenceLinkDisputeStatus = (typeof ROI_EVIDENCE_LINK_DISPUTE_STATUSES)[number];

export const ROI_ACTUAL_ENTRY_TYPES = ['cost', 'benefit', 'observation'] as const;
export type RoiActualEntryType = (typeof ROI_ACTUAL_ENTRY_TYPES)[number];

export const ROI_DATA_QUALITY_STATUSES = ['unverified', 'verified', 'disputed', 'estimated'] as const;
export type RoiDataQualityStatus = (typeof ROI_DATA_QUALITY_STATUSES)[number];

export const ROI_VARIANCE_COMPARISON_TYPES = ['approved_vs_forecast', 'approved_vs_actual', 'forecast_vs_actual'] as const;
export type RoiVarianceComparisonType = (typeof ROI_VARIANCE_COMPARISON_TYPES)[number];

export const ROI_VARIANCE_STATUSES = ['open', 'explained', 'action_planned', 'resolved'] as const;
export type RoiVarianceStatus = (typeof ROI_VARIANCE_STATUSES)[number];

export const ROI_COMPARE_METRICS = ['npv', 'simpleRoi', 'totalCosts', 'totalFinancialBenefits', 'paybackPeriods'] as const;
export type RoiCompareMetric = (typeof ROI_COMPARE_METRICS)[number];

export const ROI_PIR_STATUSES = ['draft', 'finalized'] as const;
export type RoiPirStatus = (typeof ROI_PIR_STATUSES)[number];

export const ROI_PIR_OUTCOMES = [
  'benefits_fully_realized',
  'benefits_partially_realized',
  'benefits_not_realized',
] as const;
export type RoiPirOutcome = (typeof ROI_PIR_OUTCOMES)[number];

export const ROI_PIR_TERESA_DRAFT_DISPOSITIONS = ['accepted', 'rejected', 'edited_then_accepted'] as const;
export type RoiPirTeresaDraftDisposition = (typeof ROI_PIR_TERESA_DRAFT_DISPOSITIONS)[number];

export const ROI_FINANCE_RECONCILIATION_STATUSES = ['open', 'investigating', 'resolved', 'accepted_divergence'] as const;
export type RoiFinanceReconciliationStatus = (typeof ROI_FINANCE_RECONCILIATION_STATUSES)[number];

/** `RoiIrrStatus` shape is already declared in `roiApi.ts` — reused, not
 * redeclared, for calc-run/forecast-version parity. */
export type { RoiIrrStatus } from './roiApi';
import type { RoiIrrStatus } from './roiApi';

interface WriteTrailer {
  idempotencyKey: string;
}
export interface RemoveTrailer {
  expectedVersion: number;
  reason?: string | null;
}

const base = (caseId: string) => `/vnext/results/roi/cases/${encodeURIComponent(caseId)}`;

// ==========================================
// Scenarios — GET/POST/PATCH/DELETE .../scenarios[/:scenarioId]
// (roi.routes.ts L1470-1626)
// ==========================================

export interface RoiScenario {
  scenarioId: string;
  caseId: string;
  organizationId: string;
  scenarioType: RoiScenarioType;
  label: string;
  description: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  frozenAt: string | null;
  frozenBy: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export async function listRoiScenarios(caseId: string, includeDeleted = false): Promise<RoiScenario[]> {
  const { scenarios } = await getJson<{ scenarios: RoiScenario[] }>(`${base(caseId)}/scenarios`, { includeDeleted });
  return scenarios;
}

export interface AddRoiScenarioInput {
  scenarioType: RoiScenarioType;
  label: string;
  description?: string | null;
  reason?: string | null;
}
export interface RoiScenarioWriteResponse {
  outcome: 'applied' | 'duplicate';
  scenario: RoiScenario;
}
export async function addRoiScenario(caseId: string, input: AddRoiScenarioInput & WriteTrailer): Promise<RoiScenarioWriteResponse> {
  return mutateJson<RoiScenarioWriteResponse>('POST', `${base(caseId)}/scenarios`, input);
}
export interface UpdateRoiScenarioInput {
  expectedVersion: number;
  label?: string;
  description?: string | null;
  reason?: string | null;
}
export async function updateRoiScenario(
  caseId: string,
  scenarioId: string,
  input: UpdateRoiScenarioInput & WriteTrailer
): Promise<RoiScenarioWriteResponse> {
  return mutateJson<RoiScenarioWriteResponse>('PATCH', `${base(caseId)}/scenarios/${encodeURIComponent(scenarioId)}`, input);
}
export async function removeRoiScenario(
  caseId: string,
  scenarioId: string,
  input: RemoveTrailer & WriteTrailer
): Promise<RoiScenarioWriteResponse> {
  return mutateJson<RoiScenarioWriteResponse>('DELETE', `${base(caseId)}/scenarios/${encodeURIComponent(scenarioId)}`, input);
}

// ==========================================
// Scenario overrides — POST .../scenarios/:scenarioId/overrides ;
// DELETE .../overrides/:overrideId (roi.routes.ts L1628-1697)
// ==========================================

export interface RoiScenarioOverride {
  overrideId: string;
  scenarioId: string;
  organizationId: string;
  targetType: RoiScenarioOverrideTargetType;
  targetId: string;
  overrideValue: number | null;
  overrideAmount: number | null;
  note: string | null;
  createdBy: string;
  createdAt: string;
}
export interface SetRoiScenarioOverrideInput {
  expectedVersion: number;
  targetType: RoiScenarioOverrideTargetType;
  targetId: string;
  overrideValue?: number | null;
  overrideAmount?: number | null;
  note?: string | null;
  reason?: string | null;
}
export interface RoiScenarioOverrideWriteResponse {
  outcome: 'applied' | 'duplicate';
  override: RoiScenarioOverride;
}
export async function setRoiScenarioOverride(
  caseId: string,
  scenarioId: string,
  input: SetRoiScenarioOverrideInput & WriteTrailer
): Promise<RoiScenarioOverrideWriteResponse> {
  return mutateJson<RoiScenarioOverrideWriteResponse>(
    'POST',
    `${base(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/overrides`,
    input
  );
}
export async function removeRoiScenarioOverride(
  caseId: string,
  scenarioId: string,
  overrideId: string,
  input: RemoveTrailer & WriteTrailer
): Promise<{ outcome: 'applied' | 'duplicate'; overrideId: string }> {
  return mutateJson('DELETE', `${base(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/overrides/${encodeURIComponent(overrideId)}`, input);
}

// ==========================================
// Calculation runs — POST/GET .../calculation-runs[/:runId]
// (roi.routes.ts L1697-1770)
// ==========================================

export interface RoiCalculationRun {
  runId: string;
  caseId: string;
  organizationId: string;
  scenarioId: string | null;
  status: 'completed' | 'failed';
  totalCosts: number | null;
  totalFinancialBenefits: number | null;
  simpleRoi: number | null;
  npv: number | null;
  irrPct: number | null;
  irrStatus: RoiIrrStatus;
  paybackPeriods: number | null;
  discountedPaybackPeriods: number | null;
  benefitCostRatio: number | null;
  inputHash: string;
  hasUnresolvedDoubleCounting: boolean;
  hasMixedCurrencyFailure: boolean;
  validationFindings: unknown[];
  warnings: unknown[];
  initiatedBy: string;
  startedAt: string;
  completedAt: string;
  createdAt: string;
}
export async function listRoiCalculationRuns(caseId: string, limit = 50, offset = 0): Promise<RoiCalculationRun[]> {
  const { runs } = await getJson<{ runs: RoiCalculationRun[] }>(`${base(caseId)}/calculation-runs`, { limit, offset });
  return runs;
}
export async function getRoiCalculationRun(caseId: string, runId: string): Promise<RoiCalculationRun | null> {
  try {
    const { run } = await getJson<{ run: RoiCalculationRun }>(`${base(caseId)}/calculation-runs/${encodeURIComponent(runId)}`);
    return run;
  } catch (err) {
    if (err instanceof RoiApiError && err.status === 404) return null;
    throw err;
  }
}
export interface CreateRoiCalculationRunInput {
  scenarioId?: string | null;
  reason?: string | null;
}
export interface RoiCalculationRunWriteResponse {
  outcome: 'applied' | 'duplicate';
  run: RoiCalculationRun;
}
export async function createRoiCalculationRun(
  caseId: string,
  input: CreateRoiCalculationRunInput & WriteTrailer
): Promise<RoiCalculationRunWriteResponse> {
  return mutateJson<RoiCalculationRunWriteResponse>('POST', `${base(caseId)}/calculation-runs`, input);
}

// ==========================================
// KPI evidence links — GET/POST/DELETE .../benefit-lines/:benefitLineId/
// kpi-evidence-links[/:linkId] ; POST .../:linkId/freshness-check
// (roi.routes.ts L1368-1467, L3084-…)
// ==========================================

export interface RoiBenefitEvidenceLink {
  linkId: string;
  benefitLineId: string;
  caseId: string;
  organizationId: string;
  kpiId: string;
  pinnedKpiDefinitionVersionId: string;
  expectedUnit: string | null;
  purpose: RoiEvidenceLinkPurpose;
  linkedBy: string;
  linkedAt: string;
  freshnessCheckedAt: string | null;
  disputeStatus: RoiEvidenceLinkDisputeStatus;
  notes: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
export async function listRoiBenefitEvidenceLinks(caseId: string, benefitLineId: string): Promise<RoiBenefitEvidenceLink[]> {
  const { links } = await getJson<{ links: RoiBenefitEvidenceLink[] }>(
    `${base(caseId)}/benefit-lines/${encodeURIComponent(benefitLineId)}/kpi-evidence-links`
  );
  return links;
}
export interface AddRoiBenefitEvidenceLinkInput {
  kpiId: string;
  pinnedKpiDefinitionVersionId: string;
  expectedUnit?: string | null;
  purpose: RoiEvidenceLinkPurpose;
  notes?: string | null;
  reason?: string | null;
}
export interface RoiBenefitEvidenceLinkWriteResponse {
  outcome: 'applied' | 'duplicate';
  link: RoiBenefitEvidenceLink;
}
export async function addRoiBenefitEvidenceLink(
  caseId: string,
  benefitLineId: string,
  input: AddRoiBenefitEvidenceLinkInput & WriteTrailer
): Promise<RoiBenefitEvidenceLinkWriteResponse> {
  return mutateJson<RoiBenefitEvidenceLinkWriteResponse>(
    'POST',
    `${base(caseId)}/benefit-lines/${encodeURIComponent(benefitLineId)}/kpi-evidence-links`,
    input
  );
}
export async function removeRoiBenefitEvidenceLink(
  caseId: string,
  benefitLineId: string,
  linkId: string,
  input: RemoveTrailer & WriteTrailer
): Promise<{ outcome: 'applied' | 'duplicate'; linkId: string }> {
  return mutateJson(
    'DELETE',
    `${base(caseId)}/benefit-lines/${encodeURIComponent(benefitLineId)}/kpi-evidence-links/${encodeURIComponent(linkId)}`,
    input
  );
}
export async function flagRoiBenefitEvidenceLinkFreshnessCheck(
  caseId: string,
  benefitLineId: string,
  linkId: string,
  input: { reason?: string | null } & WriteTrailer
): Promise<RoiBenefitEvidenceLinkWriteResponse> {
  return mutateJson<RoiBenefitEvidenceLinkWriteResponse>(
    'POST',
    `${base(caseId)}/benefit-lines/${encodeURIComponent(benefitLineId)}/kpi-evidence-links/${encodeURIComponent(linkId)}/freshness-check`,
    input
  );
}

// ==========================================
// Approval snapshots — GET .../approval-snapshots[/:snapshotId] (read-only,
// system-generated by `approveRoiCase` — no write route exists)
// (roi.routes.ts L1938-1980)
// ==========================================

export interface RoiApprovalSnapshot {
  snapshotId: string;
  caseId: string;
  organizationId: string;
  approvedBy: string;
  approvedAt: string;
  baselineSnapshot: Record<string, unknown>;
  economicModelSnapshot: Record<string, unknown>;
  calculationRunId: string;
  createdAt: string;
}
export async function listRoiApprovalSnapshots(caseId: string): Promise<RoiApprovalSnapshot[]> {
  const { snapshots } = await getJson<{ snapshots: RoiApprovalSnapshot[] }>(`${base(caseId)}/approval-snapshots`);
  return snapshots;
}
export async function getRoiApprovalSnapshot(caseId: string, snapshotId: string): Promise<RoiApprovalSnapshot | null> {
  try {
    const { snapshot } = await getJson<{ snapshot: RoiApprovalSnapshot }>(
      `${base(caseId)}/approval-snapshots/${encodeURIComponent(snapshotId)}`
    );
    return snapshot;
  } catch (err) {
    if (err instanceof RoiApiError && err.status === 404) return null;
    throw err;
  }
}

// ==========================================
// Forecast versions + compare — POST/GET .../forecast-versions[/:id] ;
// GET .../compare (roi.routes.ts L2009-2100)
// ==========================================

export interface RoiForecastVersion {
  forecastVersionId: string;
  caseId: string;
  organizationId: string;
  sequenceNumber: number;
  status: 'completed' | 'failed';
  totalCosts: number | null;
  totalFinancialBenefits: number | null;
  simpleRoi: number | null;
  npv: number | null;
  irrPct: number | null;
  irrStatus: RoiIrrStatus;
  paybackPeriods: number | null;
  discountedPaybackPeriods: number | null;
  benefitCostRatio: number | null;
  reason: string;
  publishedBy: string;
  publishedAt: string;
  hasUnresolvedDoubleCounting: boolean;
  hasMixedCurrencyFailure: boolean;
  validationFindings: unknown[];
  warnings: unknown[];
  createdAt: string;
}
export async function listRoiForecastVersions(caseId: string): Promise<RoiForecastVersion[]> {
  const { forecastVersions } = await getJson<{ forecastVersions: RoiForecastVersion[] }>(`${base(caseId)}/forecast-versions`);
  return forecastVersions;
}
export async function getRoiForecastVersion(caseId: string, forecastVersionId: string): Promise<RoiForecastVersion | null> {
  try {
    const { forecastVersion } = await getJson<{ forecastVersion: RoiForecastVersion }>(
      `${base(caseId)}/forecast-versions/${encodeURIComponent(forecastVersionId)}`
    );
    return forecastVersion;
  } catch (err) {
    if (err instanceof RoiApiError && err.status === 404) return null;
    throw err;
  }
}
export interface CreateRoiForecastVersionInput {
  expectedVersion: number;
  /** REQUIRED — `CreateRoiForecastVersionSchema` (`resultsVnextRoiForecastActual.validators.ts`
   * L99-104): `reason: z.string().min(1)`, unlike most other endpoints'
   * optional reason. */
  reason: string;
  overrides?: Array<{
    targetType: 'assumption' | 'cost_line' | 'benefit_line';
    targetId: string;
    overrideValue?: number | null;
    overrideAmount?: number | null;
  }>;
}
export interface RoiForecastVersionWriteResponse {
  outcome: 'applied' | 'duplicate';
  forecastVersion: RoiForecastVersion;
}
export async function createRoiForecastVersion(
  caseId: string,
  input: CreateRoiForecastVersionInput & WriteTrailer
): Promise<RoiForecastVersionWriteResponse> {
  return mutateJson<RoiForecastVersionWriteResponse>('POST', `${base(caseId)}/forecast-versions`, input);
}

/** `GET .../compare` — no query params (route reads only `:caseId`,
 * `roi.routes.ts` L2078-2098); server resolves what to compare internally. */
export interface RoiCompareView {
  caseId: string;
  metrics: Record<
    string,
    {
      approved: number | null;
      forecast: number | null;
      actual: number | null;
    }
  >;
  [key: string]: unknown;
}
export async function getRoiCaseCompareView(caseId: string): Promise<RoiCompareView | null> {
  try {
    const { compare } = await getJson<{ compare: RoiCompareView }>(`${base(caseId)}/compare`);
    return compare;
  } catch (err) {
    if (err instanceof RoiApiError && err.status === 404) return null;
    throw err;
  }
}

// ==========================================
// Actuals — GET/POST .../actuals ; GET .../actuals/:entryId ;
// POST .../:entryId/corrections|verify|dispute
// (roi.routes.ts L2100-2286)
// ==========================================

export interface RoiActualEntry {
  actualEntryId: string;
  caseId: string;
  organizationId: string;
  entryType: RoiActualEntryType;
  costLineId: string | null;
  benefitLineId: string | null;
  periodStart: string;
  periodEnd: string;
  amount: number | null;
  currency: string | null;
  dataQualityStatus: RoiDataQualityStatus;
  correctionOfActualEntryId: string | null;
  correctionReason: string | null;
  source: string;
  evidenceRefs: unknown[];
  notes: string | null;
  recordedBy: string;
  recordedAt: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  lineKey: string;
}
export async function listRoiActualEntries(
  caseId: string,
  opts: { includeSuperseded?: boolean; limit?: number; offset?: number } = {}
): Promise<RoiActualEntry[]> {
  const { entries } = await getJson<{ entries: RoiActualEntry[] }>(`${base(caseId)}/actuals`, opts);
  return entries;
}
export async function getRoiActualEntry(caseId: string, entryId: string): Promise<RoiActualEntry | null> {
  try {
    const { actualEntry } = await getJson<{ actualEntry: RoiActualEntry }>(`${base(caseId)}/actuals/${encodeURIComponent(entryId)}`);
    return actualEntry;
  } catch (err) {
    if (err instanceof RoiApiError && err.status === 404) return null;
    throw err;
  }
}
export interface RecordRoiActualEntryInput {
  entryType: RoiActualEntryType;
  costLineId?: string | null;
  benefitLineId?: string | null;
  /** ISO date/time strings — `isoDateString` validator, any `Date.parse`-able value. */
  periodStart: string;
  periodEnd: string;
  amount?: number | null;
  currency?: string | null;
  source: string;
  evidenceRefs?: unknown[];
  notes?: string | null;
  reason?: string | null;
}
export interface RoiActualEntryWriteResponse {
  outcome: 'applied' | 'duplicate';
  actualEntry: RoiActualEntry;
}
export async function recordRoiActualEntry(
  caseId: string,
  input: RecordRoiActualEntryInput & WriteTrailer
): Promise<RoiActualEntryWriteResponse> {
  return mutateJson<RoiActualEntryWriteResponse>('POST', `${base(caseId)}/actuals`, input);
}
export interface CorrectRoiActualEntryInput {
  /** REQUIRED-but-nullable — `requiredNullableNumberField`, always present
   * in the body, may itself be `null`. */
  amount: number | null;
  currency?: string | null;
  correctionReason: string;
}
export async function correctRoiActualEntry(
  caseId: string,
  entryId: string,
  input: CorrectRoiActualEntryInput & WriteTrailer
): Promise<RoiActualEntryWriteResponse> {
  return mutateJson<RoiActualEntryWriteResponse>('POST', `${base(caseId)}/actuals/${encodeURIComponent(entryId)}/corrections`, input);
}
export async function verifyRoiActualEntry(
  caseId: string,
  entryId: string,
  input: { notes?: string | null } & WriteTrailer
): Promise<RoiActualEntryWriteResponse> {
  return mutateJson<RoiActualEntryWriteResponse>('POST', `${base(caseId)}/actuals/${encodeURIComponent(entryId)}/verify`, input);
}
export async function disputeRoiActualEntry(
  caseId: string,
  entryId: string,
  input: { disputeReason: string } & WriteTrailer
): Promise<RoiActualEntryWriteResponse> {
  return mutateJson<RoiActualEntryWriteResponse>('POST', `${base(caseId)}/actuals/${encodeURIComponent(entryId)}/dispute`, input);
}

// ==========================================
// Actual snapshots — POST/GET .../actual-snapshots[/:id]
// (roi.routes.ts L2286-2360)
// ==========================================

export interface RoiActualSnapshot {
  actualSnapshotId: string;
  caseId: string;
  organizationId: string;
  totalActualCosts: number | null;
  totalActualFinancialBenefits: number | null;
  actualSimpleRoi: number | null;
  actualNpv: number | null;
  coveragePct: number | null;
  periodsWithActualCount: number;
  periodsExpectedCount: number;
  unverifiedEntryCount: number;
  disputedEntryCount: number;
  entryIdsIncluded: string[];
  sequenceNumber: number;
  asOfPeriodEnd: string;
  publishedBy: string;
  publishedAt: string;
  createdAt: string;
}
export async function listRoiActualSnapshots(caseId: string): Promise<RoiActualSnapshot[]> {
  const { actualSnapshots } = await getJson<{ actualSnapshots: RoiActualSnapshot[] }>(`${base(caseId)}/actual-snapshots`);
  return actualSnapshots;
}
export async function getRoiActualSnapshot(caseId: string, actualSnapshotId: string): Promise<RoiActualSnapshot | null> {
  try {
    const { actualSnapshot } = await getJson<{ actualSnapshot: RoiActualSnapshot }>(
      `${base(caseId)}/actual-snapshots/${encodeURIComponent(actualSnapshotId)}`
    );
    return actualSnapshot;
  } catch (err) {
    if (err instanceof RoiApiError && err.status === 404) return null;
    throw err;
  }
}
export interface PublishRoiActualSnapshotInput {
  expectedVersion: number;
  asOfPeriodEnd: string;
  reason?: string | null;
}
export interface RoiActualSnapshotWriteResponse {
  outcome: 'applied' | 'duplicate';
  actualSnapshot: RoiActualSnapshot;
}
export async function publishRoiActualSnapshot(
  caseId: string,
  input: PublishRoiActualSnapshotInput & WriteTrailer
): Promise<RoiActualSnapshotWriteResponse> {
  return mutateJson<RoiActualSnapshotWriteResponse>('POST', `${base(caseId)}/actual-snapshots`, input);
}

// ==========================================
// Variances + causes — GET/POST .../variances ; GET/PATCH .../variances/:id ;
// POST .../causes ; DELETE .../causes/:causeId
// (roi.routes.ts L2361-2522)
// ==========================================

export interface RoiVariance {
  varianceId: string;
  caseId: string;
  organizationId: string;
  comparisonType: RoiVarianceComparisonType;
  metric: RoiCompareMetric;
  referenceApprovalSnapshotId: string | null;
  referenceForecastVersionId: string | null;
  referenceActualSnapshotId: string | null;
  baselineValue: number | null;
  comparisonValue: number | null;
  varianceAmount: number | null;
  variancePct: number | null;
  status: RoiVarianceStatus;
  ownerUserId: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}
export interface RoiVarianceCause {
  causeId: string;
  varianceId: string;
  organizationId: string;
  causeCategory: string;
  contributionPct: number | null;
  narrative: string;
  createdBy: string;
  createdAt: string;
}
export async function listRoiVariances(caseId: string): Promise<RoiVariance[]> {
  const { variances } = await getJson<{ variances: RoiVariance[] }>(`${base(caseId)}/variances`);
  return variances;
}
export async function getRoiVariance(caseId: string, varianceId: string): Promise<RoiVariance | null> {
  try {
    const { variance } = await getJson<{ variance: RoiVariance }>(`${base(caseId)}/variances/${encodeURIComponent(varianceId)}`);
    return variance;
  } catch (err) {
    if (err instanceof RoiApiError && err.status === 404) return null;
    throw err;
  }
}
export interface RecordRoiVarianceInput {
  comparisonType: RoiVarianceComparisonType;
  metric: RoiCompareMetric;
  referenceApprovalSnapshotId?: string | null;
  referenceForecastVersionId?: string | null;
  referenceActualSnapshotId?: string | null;
  ownerUserId?: string | null;
  reason?: string | null;
}
export interface RoiVarianceWriteResponse {
  outcome: 'applied' | 'duplicate';
  variance: RoiVariance;
}
export async function recordRoiVariance(caseId: string, input: RecordRoiVarianceInput & WriteTrailer): Promise<RoiVarianceWriteResponse> {
  return mutateJson<RoiVarianceWriteResponse>('POST', `${base(caseId)}/variances`, input);
}
export interface UpdateRoiVarianceStatusInput {
  expectedVersion: number;
  status?: RoiVarianceStatus;
  ownerUserId?: string | null;
  reason?: string | null;
}
export async function updateRoiVarianceStatus(
  caseId: string,
  varianceId: string,
  input: UpdateRoiVarianceStatusInput & WriteTrailer
): Promise<RoiVarianceWriteResponse> {
  return mutateJson<RoiVarianceWriteResponse>('PATCH', `${base(caseId)}/variances/${encodeURIComponent(varianceId)}`, input);
}
export interface AddRoiVarianceCauseInput {
  causeCategory: string;
  contributionPct?: number | null;
  narrative: string;
  reason?: string | null;
}
export interface RoiVarianceCauseWriteResponse {
  outcome: 'applied' | 'duplicate';
  varianceCause: RoiVarianceCause;
}
export async function addRoiVarianceCause(
  caseId: string,
  varianceId: string,
  input: AddRoiVarianceCauseInput & WriteTrailer
): Promise<RoiVarianceCauseWriteResponse> {
  return mutateJson<RoiVarianceCauseWriteResponse>('POST', `${base(caseId)}/variances/${encodeURIComponent(varianceId)}/causes`, input);
}
export async function removeRoiVarianceCause(
  caseId: string,
  varianceId: string,
  causeId: string,
  input: { reason?: string | null } & WriteTrailer
): Promise<{ outcome: 'applied' | 'duplicate'; causeId: string }> {
  return mutateJson(
    'DELETE',
    `${base(caseId)}/variances/${encodeURIComponent(varianceId)}/causes/${encodeURIComponent(causeId)}`,
    input
  );
}

// ==========================================
// Case-level benefits realization — GET .../benefits-realization
// (roi.routes.ts L2596-2620; Decision D14, readable in any status)
// ==========================================

export interface RoiCaseBenefitsRealizationView {
  caseId: string;
  approvedFinancialBenefits: number | null;
  actualFinancialBenefits: number | null;
  benefitsRealizationPct: number | null;
  [key: string]: unknown;
}
export async function getRoiCaseBenefitsRealization(caseId: string): Promise<RoiCaseBenefitsRealizationView | null> {
  try {
    const { benefitsRealization } = await getJson<{ benefitsRealization: RoiCaseBenefitsRealizationView }>(
      `${base(caseId)}/benefits-realization`
    );
    return benefitsRealization;
  } catch (err) {
    if (err instanceof RoiApiError && err.status === 404) return null;
    throw err;
  }
}

// ==========================================
// PIR — PUT .../post-investment-review-schedule ;
// GET .../post-investment-reviews[/:pirId] ;
// PATCH .../post-investment-reviews/:pirId ;
// POST .../:pirId/teresa-draft-disposition
// (roi.routes.ts L2624-2842)
// ==========================================

export interface RoiPostInvestmentReview {
  pirId: string;
  caseId: string;
  organizationId: string;
  sequenceNumber: number;
  status: RoiPirStatus;
  startedBy: string;
  startedAt: string;
  reviewSnapshotHash: string;
  outcome: RoiPirOutcome | null;
  lessonsLearned: string | null;
  recommendation: string | null;
  openVarianceWaiverReason: string | null;
  teresaDraftLessonsPayload: Record<string, unknown> | null;
  teresaDraftGeneratedAt: string | null;
  teresaDraftDisposition: RoiPirTeresaDraftDisposition | null;
  teresaDraftDispositionBy: string | null;
  teresaDraftDispositionAt: string | null;
  finalizedBy: string | null;
  finalizedAt: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}
export interface ScheduleRoiPirInput {
  expectedVersion: number;
  nextReviewAt: string;
  reason?: string | null;
}
export async function scheduleRoiPostInvestmentReview(
  caseId: string,
  input: ScheduleRoiPirInput & WriteTrailer
): Promise<{ outcome: 'applied' | 'duplicate'; case: import('./roiApi').RoiCaseListItem }> {
  return mutateJson('PUT', `${base(caseId)}/post-investment-review-schedule`, input);
}
export async function listRoiPostInvestmentReviews(caseId: string): Promise<RoiPostInvestmentReview[]> {
  const { postInvestmentReviews } = await getJson<{ postInvestmentReviews: RoiPostInvestmentReview[] }>(
    `${base(caseId)}/post-investment-reviews`
  );
  return postInvestmentReviews;
}
export async function getRoiPostInvestmentReview(caseId: string, pirId: string): Promise<RoiPostInvestmentReview | null> {
  try {
    const { postInvestmentReview } = await getJson<{ postInvestmentReview: RoiPostInvestmentReview }>(
      `${base(caseId)}/post-investment-reviews/${encodeURIComponent(pirId)}`
    );
    return postInvestmentReview;
  } catch (err) {
    if (err instanceof RoiApiError && err.status === 404) return null;
    throw err;
  }
}
export interface UpdateRoiPirDraftInput {
  expectedVersion: number;
  outcome?: RoiPirOutcome | null;
  lessonsLearned?: string | null;
  recommendation?: string | null;
  reason?: string | null;
}
export interface RoiPirWriteResponse {
  outcome: 'applied' | 'duplicate';
  postInvestmentReview: RoiPostInvestmentReview;
}
export async function updateRoiPostInvestmentReviewDraft(
  caseId: string,
  pirId: string,
  input: UpdateRoiPirDraftInput & WriteTrailer
): Promise<RoiPirWriteResponse> {
  return mutateJson<RoiPirWriteResponse>('PATCH', `${base(caseId)}/post-investment-reviews/${encodeURIComponent(pirId)}`, input);
}
export interface RecordRoiPirTeresaDraftDispositionInput {
  expectedVersion: number;
  disposition: RoiPirTeresaDraftDisposition;
  /** Required unless `disposition === 'rejected'` (server rule,
   * `roiPirCommands.ts` L718-724, `FINAL_LESSONS_TEXT_REQUIRED`) — the form
   * layer enforces this, the type stays nullable/optional to match the wire
   * schema exactly. */
  finalLessonsText?: string | null;
  reason?: string | null;
}
export async function recordRoiPirTeresaDraftDisposition(
  caseId: string,
  pirId: string,
  input: RecordRoiPirTeresaDraftDispositionInput & WriteTrailer
): Promise<RoiPirWriteResponse> {
  return mutateJson<RoiPirWriteResponse>(
    'POST',
    `${base(caseId)}/post-investment-reviews/${encodeURIComponent(pirId)}/teresa-draft-disposition`,
    input
  );
}

// ==========================================
// Finance links + reconciliations — GET/POST .../finance-links ;
// DELETE .../:linkId ; GET/POST .../finance-reconciliations ;
// PATCH .../:reconciliationId ; GET .../finance-projections
// (roi.routes.ts L2864-3063)
// ==========================================

export interface RoiFinanceLink {
  linkId: string;
  caseId: string;
  organizationId: string;
  financeArtifactType: string;
  financeArtifactId: string;
  financeVersionId: string;
  mappingVersion: number;
  source: string;
  asOf: string;
  semanticUnit: string | null;
  currency: string | null;
  linkPurpose: string;
  linkedBy: string;
  linkedAt: string;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
export async function listRoiFinanceLinks(caseId: string): Promise<RoiFinanceLink[]> {
  const { financeLinks } = await getJson<{ financeLinks: RoiFinanceLink[] }>(`${base(caseId)}/finance-links`);
  return financeLinks;
}
export interface CreateRoiFinanceLinkInput {
  financeArtifactType: string;
  financeArtifactId: string;
  financeVersionId: string;
  mappingVersion?: number;
  source: string;
  asOf: string;
  semanticUnit?: string | null;
  currency?: string | null;
  linkPurpose: string;
  reason?: string | null;
}
export interface RoiFinanceLinkWriteResponse {
  outcome: 'applied' | 'duplicate';
  financeLink: RoiFinanceLink;
}
export async function createRoiFinanceLink(
  caseId: string,
  input: CreateRoiFinanceLinkInput & WriteTrailer
): Promise<RoiFinanceLinkWriteResponse> {
  return mutateJson<RoiFinanceLinkWriteResponse>('POST', `${base(caseId)}/finance-links`, input);
}
export async function removeRoiFinanceLink(
  caseId: string,
  linkId: string,
  input: RemoveTrailer & WriteTrailer
): Promise<RoiFinanceLinkWriteResponse> {
  return mutateJson<RoiFinanceLinkWriteResponse>('DELETE', `${base(caseId)}/finance-links/${encodeURIComponent(linkId)}`, input);
}

export interface RoiFinanceReconciliation {
  reconciliationId: string;
  caseId: string;
  organizationId: string;
  financeLinkId: string;
  roiValue: number | null;
  financeValue: number | null;
  divergenceReason: string | null;
  status: RoiFinanceReconciliationStatus;
  openedBy: string;
  openedAt: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  rowVersion: number;
}
export async function listRoiFinanceReconciliations(caseId: string): Promise<RoiFinanceReconciliation[]> {
  const { financeReconciliations } = await getJson<{ financeReconciliations: RoiFinanceReconciliation[] }>(
    `${base(caseId)}/finance-reconciliations`
  );
  return financeReconciliations;
}
export interface OpenRoiFinanceReconciliationInput {
  financeLinkId: string;
  roiValue: number;
  financeValue: number;
  divergenceReason?: string | null;
  reason?: string | null;
}
export interface RoiFinanceReconciliationWriteResponse {
  outcome: 'applied' | 'duplicate';
  financeReconciliation: RoiFinanceReconciliation;
}
export async function openRoiFinanceReconciliation(
  caseId: string,
  input: OpenRoiFinanceReconciliationInput & WriteTrailer
): Promise<RoiFinanceReconciliationWriteResponse> {
  return mutateJson<RoiFinanceReconciliationWriteResponse>('POST', `${base(caseId)}/finance-reconciliations`, input);
}
export interface UpdateRoiFinanceReconciliationStatusInput {
  expectedVersion: number;
  status: RoiFinanceReconciliationStatus;
  resolutionNotes?: string | null;
  reason?: string | null;
}
export async function updateRoiFinanceReconciliationStatus(
  caseId: string,
  reconciliationId: string,
  input: UpdateRoiFinanceReconciliationStatusInput & WriteTrailer
): Promise<RoiFinanceReconciliationWriteResponse> {
  return mutateJson<RoiFinanceReconciliationWriteResponse>(
    'PATCH',
    `${base(caseId)}/finance-reconciliations/${encodeURIComponent(reconciliationId)}`,
    input
  );
}

/** Read-only, RN-G6 design §9 — no write route exists for this resource. */
export interface RoiFinanceProjection {
  [key: string]: unknown;
}
export async function listRoiFinanceProjections(caseId: string): Promise<RoiFinanceProjection[]> {
  const { financeProjections } = await getJson<{ financeProjections: RoiFinanceProjection[] }>(`${base(caseId)}/finance-projections`);
  return financeProjections;
}
