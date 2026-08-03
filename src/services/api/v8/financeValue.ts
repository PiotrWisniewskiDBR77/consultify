/**
 * M16 Value-Tracking bridge (wire-d) — typed FE client for 5 previously
 * orphaned M16 value-office engines that already have live v8 endpoints
 * (server/src/routes/v8/finance-value.routes.ts, mounted at
 * `/api/v8/finance/value-tracking`) but had zero UI:
 *
 *   - valueLedgerService              → frozen baseline + append-only
 *                                        correction ledger + current value
 *   - valueAttributionRollupService   → anti-double-count portfolio value
 *                                        rollup (pure)
 *   - valueCapturePipelineService     → G0..G5 value-capture stage-gates
 *   - bankingValueService             → banking benefits into next-period
 *                                        budget lines (pure)
 *   - extendedRatiosService           → ROE/ROA/ROIC/DSCR/DuPont/benchmark
 *                                        ratios (pure)
 *
 * `v8Get`/`v8Post` unwrap the `{ data, meta }` envelope, so callers here get
 * the inner `data` object directly.
 *
 * Gated behind the `m16ValueSuite` flag (financeFeatureFlags.ts) — panels
 * consuming this client render only when the flag is on.
 */
import { v8Get, v8Post } from './client';

const BASE = '/finance/value-tracking';

// ─────────────────────────────────────────────────────────────────────────
// 1. Value ledger — frozen baseline + append-only correction ledger
// ─────────────────────────────────────────────────────────────────────────

export interface ValueBaseline {
  id: string;
  organization_id: string;
  initiative_id: string;
  kpi_id: string;
  frozen_value: number;
  frozen_at: string;
  frozen_by: string | null;
  source_snapshot: string | null;
  is_active: number;
}

export interface ValueLedgerEntry {
  id: string;
  organization_id: string;
  initiative_id: string;
  entry_type: string;
  value_delta: number;
  reason: string | null;
  provenance: string | null;
  created_by: string | null;
  created_at: string;
}

export interface FreezeBaselineRequest {
  initiativeId: string;
  kpiId: string;
  value: number;
  frozenBy?: string | null;
  sourceSnapshot?: unknown;
}

export interface AppendLedgerEntryRequest {
  initiativeId: string;
  entryType: string;
  valueDelta: number;
  reason?: string | null;
  provenance?: unknown;
  createdBy?: string | null;
}

export interface AuditTrailStep {
  kind: string;
  id: string | null;
  delta: number;
  runningTotal: number;
  reason?: string | null;
  provenance?: string | null;
  at?: string | null;
}

export interface CurrentValueResult {
  current: number;
  baselineValue: number;
  auditTrail: AuditTrailStep[];
}

export async function postFreezeBaseline(req: FreezeBaselineRequest): Promise<ValueBaseline> {
  return v8Post<ValueBaseline>(`${BASE}/ledger/baselines`, req);
}

export async function getActiveBaseline(
  initiativeId: string,
  kpiId: string
): Promise<ValueBaseline | null> {
  return v8Get<ValueBaseline | null>(`${BASE}/ledger/baselines/active`, { initiativeId, kpiId });
}

export async function postLedgerEntry(req: AppendLedgerEntryRequest): Promise<ValueLedgerEntry> {
  return v8Post<ValueLedgerEntry>(`${BASE}/ledger/entries`, req);
}

export async function getLedgerEntries(initiativeId: string): Promise<ValueLedgerEntry[]> {
  return v8Get<ValueLedgerEntry[]>(`${BASE}/ledger/entries`, { initiativeId });
}

export async function getCurrentValue(
  initiativeId: string,
  kpiId: string
): Promise<CurrentValueResult> {
  return v8Get<CurrentValueResult>(`${BASE}/ledger/current-value`, { initiativeId, kpiId });
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Value attribution rollup — anti-double-count portfolio rollup (pure)
// ─────────────────────────────────────────────────────────────────────────

export interface ValueContribution {
  initiativeId: string;
  kpiId: string;
  kpiDelta: number;
  contributionShare: number;
  valuePerKpiUnit: number;
}

export interface KpiRollup {
  kpiId: string;
  delta: number;
  attributed: number;
  unexplainedRemainder: number;
}

export interface PortfolioRollup {
  totalAttributed: number;
  byKpi: KpiRollup[];
  doubleCountAvoided: number;
}

export interface InitiativeValue {
  initiativeId: string;
  attributedValue: number;
}

export async function postAttributionRollup(
  contributions: ValueContribution[]
): Promise<PortfolioRollup> {
  return v8Post<PortfolioRollup>(`${BASE}/attribution/rollup`, { contributions });
}

export async function postAttributionByInitiative(
  contributions: ValueContribution[]
): Promise<InitiativeValue[]> {
  return v8Post<InitiativeValue[]>(`${BASE}/attribution/by-initiative`, { contributions });
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Value capture pipeline — G0..G5 stage-gates
// ─────────────────────────────────────────────────────────────────────────

export type ValueCaptureGateStage = 'G0' | 'G1' | 'G2' | 'G3' | 'G4' | 'G5';
export type ValueCaptureGateStatus = 'pending' | 'passed' | 'blocked';

export interface ValueCaptureGate {
  id: string;
  organizationId: string;
  initiativeId: string;
  gate: ValueCaptureGateStage;
  status: ValueCaptureGateStatus;
  criteria: string | null;
  signedOffBy: string | null;
  signedOffAt: string | null;
  valueEvidence: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateGateRequest {
  initiativeId: string;
  gate: ValueCaptureGateStage;
  status?: ValueCaptureGateStatus;
  criteria?: string | null;
  valueEvidence?: number | null;
}

export interface FunnelStage {
  gate: ValueCaptureGateStage;
  count: number;
  totalValue: number;
  conversionFromPrev: number;
}

export async function getGates(initiativeId?: string): Promise<ValueCaptureGate[]> {
  return v8Get<ValueCaptureGate[]>(
    `${BASE}/capture/gates`,
    initiativeId ? { initiativeId } : undefined
  );
}

export async function postCreateGate(req: CreateGateRequest): Promise<ValueCaptureGate> {
  return v8Post<ValueCaptureGate>(`${BASE}/capture/gates`, req);
}

export async function postAdvanceGate(id: string, signedOffBy: string): Promise<ValueCaptureGate> {
  return v8Post<ValueCaptureGate>(`${BASE}/capture/gates/${encodeURIComponent(id)}/advance`, {
    signedOffBy,
  });
}

export async function getFunnel(initiativeId?: string): Promise<FunnelStage[]> {
  return v8Get<FunnelStage[]>(
    `${BASE}/capture/funnel`,
    initiativeId ? { initiativeId } : undefined
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Banking the value — benefits wired into next-period budget lines (pure)
// ─────────────────────────────────────────────────────────────────────────

export type BenefitType = 'cost_out' | 'revenue_up';

export interface Benefit {
  value: number;
  type: BenefitType;
  isHard: boolean;
  isRunRate: boolean;
  mappedBudgetLine: string;
}

export interface BudgetLineImpact {
  lineCode: string;
  deltaValue: number;
}

export interface BankBenefitResult {
  bankedAmount: number;
  budgetLineImpact: BudgetLineImpact;
  period: string;
}

export type BankingStatusValue = 'banked' | 'pending' | 'leaked';

export interface BankingStatusResult {
  status: BankingStatusValue;
  variance: number;
}

export interface PortfolioBenefitItem {
  benefit: Benefit;
  actual?: number;
}

export interface PortfolioBankedResult {
  totalBanked: number;
  totalPending: number;
  totalLeaked: number;
  bankedPct: number;
}

export async function postBankBenefit(
  benefit: Benefit,
  targetBudgetPeriod: string
): Promise<BankBenefitResult> {
  return v8Post<BankBenefitResult>(`${BASE}/banking/bank`, { benefit, targetBudgetPeriod });
}

export async function postBankingStatus(
  benefit: Benefit,
  actual?: number
): Promise<BankingStatusResult> {
  return v8Post<BankingStatusResult>(`${BASE}/banking/status`, {
    benefit,
    ...(actual !== undefined ? { actual } : {}),
  });
}

export async function postPortfolioBanked(
  items: PortfolioBenefitItem[]
): Promise<PortfolioBankedResult> {
  return v8Post<PortfolioBankedResult>(`${BASE}/banking/portfolio`, { items });
}

// ─────────────────────────────────────────────────────────────────────────
// 5. Extended ratios — ROE/ROA/ROIC/DSCR/DuPont/benchmark (pure)
// ─────────────────────────────────────────────────────────────────────────

export type ExtendedRatioCategory = 'return' | 'leverage' | 'coverage' | 'efficiency';
export type ExtendedRatioStatus = 'ok' | 'warn' | 'critical';

export interface ExtendedFinancials {
  netIncome: number;
  equity: number;
  totalAssets: number;
  ebit: number;
  ebitda: number;
  debt: number;
  cash: number;
  revenue: number;
  fixedAssets: number;
  taxRatePct: number;
}

export interface ExtendedRatio {
  code: string;
  label: string;
  value: number | null;
  category: ExtendedRatioCategory;
  status: ExtendedRatioStatus;
}

export interface DupontDecomposition {
  roe: number | null;
  netMargin: number | null;
  assetTurnover: number | null;
  equityMultiplier: number | null;
}

export interface IndustryBenchmark {
  p25: number;
  median: number;
  p75: number;
}

export type BenchmarkPercentile = 'p25' | 'median' | 'p75' | 'above' | 'below';

export interface BenchmarkComparison {
  percentile: BenchmarkPercentile;
  status: ExtendedRatioStatus;
}

export async function postExtendedRatios(fin: ExtendedFinancials): Promise<ExtendedRatio[]> {
  return v8Post<ExtendedRatio[]>(`${BASE}/ratios/extended`, fin);
}

export async function postDupontDecomposition(
  fin: ExtendedFinancials
): Promise<DupontDecomposition> {
  return v8Post<DupontDecomposition>(`${BASE}/ratios/dupont`, fin);
}

export async function postBenchmarkStatus(
  value: number,
  benchmark: IndustryBenchmark
): Promise<BenchmarkComparison> {
  return v8Post<BenchmarkComparison>(`${BASE}/ratios/benchmark`, { value, benchmark });
}

// ─────────────────────────────────────────────────────────────────────────
// 6. Post-investment review (FIN-007) — approved Finance baseline vs.
//    Execution-recorded actual(s), reconciled into a durable receipt.
//    References the canonical roi_realized_values rows by id; never a
//    second actuals ledger.
// ─────────────────────────────────────────────────────────────────────────

export interface PostInvestmentReview {
  id: string;
  organizationId: string;
  initiativeId: string;
  baselineModelId: string;
  baselineVersion: number;
  baselineStatementType: string;
  baselineLineCode: string;
  baselinePeriodDate: string;
  projectedValue: number;
  actualIds: string[];
  actualPeriodMonth: string;
  realizedValue: number;
  variance: number;
  variancePct: number;
  reconciliationStatus: 'matched' | 'variance';
  evidence: Record<string, unknown> | null;
  status: 'in_progress' | 'completed' | 'failed';
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
}

export interface ApprovedBaselineOption {
  modelId: string;
  name: string;
  version: number;
  approvedAt: string | null;
  startDate: string;
}

/** Every APPROVED financial model for this initiative, newest version first
 * — a convenience list for a baseline picker. Never a trust boundary:
 * createPostInvestmentReview re-validates approved+version itself. */
export async function getApprovedBaselines(
  initiativeId: string
): Promise<ApprovedBaselineOption[]> {
  return v8Get<ApprovedBaselineOption[]>(`${BASE}/approved-baselines`, { initiativeId });
}

export interface CreatePostInvestmentReviewPayload {
  initiativeId: string;
  actualIds: string[];
  baselineModelId: string;
  baselineExpectedVersion: number;
  baselineStatementType: 'P&L' | 'BS' | 'CF';
  baselineLineCode: string;
  baselinePeriodDate: string;
  tolerancePct?: number;
}

/** Requires an Idempotency-Key — a retry with the same key + same payload
 * returns the SAME review; a different payload under the same key is a 409. */
export async function createPostInvestmentReview(
  payload: CreatePostInvestmentReviewPayload,
  idempotencyKey: string
): Promise<PostInvestmentReview> {
  return v8Post<PostInvestmentReview>(`${BASE}/post-investment-reviews`, payload, {
    extraHeaders: { 'Idempotency-Key': idempotencyKey },
  });
}

export async function getPostInvestmentReview(id: string): Promise<PostInvestmentReview> {
  return v8Get<PostInvestmentReview>(`${BASE}/post-investment-reviews/${encodeURIComponent(id)}`);
}

/** Completed reviews for an initiative, newest first. */
export async function listPostInvestmentReviews(
  initiativeId: string
): Promise<PostInvestmentReview[]> {
  return v8Get<PostInvestmentReview[]>(`${BASE}/post-investment-reviews`, { initiativeId });
}
