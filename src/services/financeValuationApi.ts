/**
 * M16 — Finance Valuation Suite API client.
 *
 * Typed fetch wrappers over `/api/v8/finance-valuation/*`
 * (server/src/routes/v8/finance-valuation.routes.ts) — the fala-4 bridge that
 * wired 7 previously-orphaned pure-function engines as REST endpoints.
 *
 * This client covers the 3 endpoints consumed by the M16 valuation-suite
 * panels (behind `m16ValuationSuite`, default OFF — see
 * src/components/Economics/financeFeatureFlags.ts):
 *   - Monte Carlo NPV simulation      -> MonteCarloNpvPanel
 *   - Real options (defer/abandon/staged) -> RealOptionsPanel
 *   - What-if sensitivity (tornado + 2D data-table) -> WhatIfSensitivityPanel
 *
 * Response envelope mirrors the rest of the v8 finance surface:
 * `{ data: <payload>, meta }`. `Api.post` wraps the raw JSON body in an
 * axios-like `{ data: <body> }`, so callers must unwrap twice — see `post()`
 * below (same convention as InvestmentAppraisalPanel / VarianceBridgePanel).
 */
import { Api } from '@/services/api';

const BASE = '/api/v8/finance-valuation';

// ─── Shared model shapes (mirror server/src/services/*) ──────────────────

export interface TriangularDriver {
  kind: 'triangular';
  min: number;
  mode: number;
  max: number;
}

export interface NormalDriver {
  kind: 'normal';
  mean: number;
  sd: number;
}

export type NpvDriver = TriangularDriver | NormalDriver;
export type NpvDrivers = Record<string, NpvDriver>;

export interface HistogramBin {
  binStart: number;
  binEnd: number;
  count: number;
}

export interface SimulationResult {
  samples: number[];
  mean: number;
  p10: number;
  p50: number;
  p90: number;
  probPositive: number;
  valueAtRisk5: number;
}

export interface LinearModelInput {
  /** Coefficient per driver id; drivers without an entry default to 1. */
  weights?: Record<string, number>;
  intercept?: number;
}

export interface MonteCarloNpvRequest extends LinearModelInput {
  drivers: NpvDrivers;
  iterations?: number;
  seed?: number;
  bins?: number;
}

export interface MonteCarloNpvResponse {
  simulation: SimulationResult;
  histogram: HistogramBin[];
}

// ─── Real options ──────────────────────────────────────────────────────

export interface DeferOptionInput {
  underlyingValue: number;
  investmentCost: number;
  volatility: number;
  riskFreeRate: number;
  timeToDecideYears: number;
  steps?: number;
}
export type DeferRecommendation = 'defer' | 'invest-now' | 'abandon';
export interface DeferOptionResult {
  optionValue: number;
  expandedNpv: number;
  recommendation: DeferRecommendation;
}

export interface AbandonOptionInput {
  underlyingValue: number;
  salvageValue: number;
  volatility: number;
  riskFreeRate: number;
  timeToDecideYears: number;
  steps?: number;
}
export interface AbandonOptionResult {
  salvageValue: number;
  optionValue: number;
}

export interface InvestmentStage {
  cost: number;
  expectedValue: number;
  successProb: number;
}
export type StagedRecommendation = 'pilot-first' | 'full-commit';
export interface StagedInvestmentResult {
  totalOptionValue: number;
  recommendation: StagedRecommendation;
}

// ─── What-if / sensitivity ──────────────────────────────────────────────

export type SensitivityDrivers = Record<string, number>;

export interface TornadoBar {
  label: string;
  low: number;
  high: number;
}
export interface TornadoResult {
  base: number;
  bars: TornadoBar[];
}

export interface DataTableCell {
  x: number;
  y: number;
  value: number;
}
export interface DataTable2DResult {
  xLabels: number[];
  yLabels: number[];
  matrix: DataTableCell[];
}

export interface TornadoRequest extends LinearModelInput {
  baseDrivers: SensitivityDrivers;
  driverIds: string[];
  swingPct?: number;
}

export interface DataTable2DRequest extends LinearModelInput {
  baseDrivers: SensitivityDrivers;
  xDriver: string;
  yDriver: string;
  xRange: number[];
  yRange: number[];
}

// ─── Envelope + error handling ──────────────────────────────────────────

export class FinanceValuationApiError extends Error {}

/**
 * `Api.post` returns an axios-like `{ data: <body> }`; the server body is
 * itself `{ data: <payload>, meta }` (or `{ error }` on 4xx — asyncHandler
 * lets a thrown/handleResponse error surface first, so this only needs to
 * defend against a missing `data` field on a 200 that shouldn't happen).
 */
async function post<T>(path: string, body: unknown): Promise<T> {
  const res: any = await Api.post(`${BASE}${path}`, body);
  const envelope = res?.data ?? res;
  const payload = envelope?.data ?? envelope;
  if (payload === undefined || payload === null) {
    throw new FinanceValuationApiError(`finance-valuation ${path}: empty response`);
  }
  return payload as T;
}

// ─── 1. Monte Carlo NPV ─────────────────────────────────────────────────

export async function runMonteCarloNpv(req: MonteCarloNpvRequest): Promise<MonteCarloNpvResponse> {
  return post<MonteCarloNpvResponse>('/monte-carlo-npv', req);
}

// ─── 2. Real options ────────────────────────────────────────────────────

export async function runDeferOption(input: DeferOptionInput): Promise<DeferOptionResult> {
  return post<DeferOptionResult>('/real-options/defer', input);
}

export async function runAbandonOption(input: AbandonOptionInput): Promise<AbandonOptionResult> {
  return post<AbandonOptionResult>('/real-options/abandon', input);
}

export async function runStagedInvestment(
  stages: InvestmentStage[]
): Promise<StagedInvestmentResult> {
  return post<StagedInvestmentResult>('/real-options/staged', { stages });
}

// ─── 3. What-if / sensitivity ───────────────────────────────────────────

export async function runTornado(req: TornadoRequest): Promise<TornadoResult> {
  return post<TornadoResult>('/sensitivity/tornado', req);
}

export async function runDataTable2D(req: DataTable2DRequest): Promise<DataTable2DResult> {
  return post<DataTable2DResult>('/sensitivity/data-table', req);
}
