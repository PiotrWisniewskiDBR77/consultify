/**
 * presentationBenchmarkTrend
 *
 * Read-only client for the SuperAdmin "Benchmark Trend (vs Gamma target)"
 * dashboard. Wraps:
 *   GET /api/presentations/benchmark/trend?windowMonths=N&referenceSet=...
 *
 * Mirrors the Api/fetch fallback pattern of `presentationOperationsHealth.ts`
 * and always resolves with a `{ status, data?, error? }` envelope so the view
 * can surface honest forbidden / unavailable banners without crashing.
 *
 * The wire payload is normalized into a strict client-side shape so a stray
 * field on the server (or a partial response during a deploy) cannot crash
 * the dashboard. Unknown enum values fall back to safe neutral values
 * ('inconclusive' / 'INCONCLUSIVE').
 */

import { Api } from '@/services/api';

export type BenchmarkTrendFetchStatus = 'ok' | 'error' | 'forbidden' | 'not_found' | 'unavailable';

export type ClientBenchmarkDimension =
  | 'content_quality'
  | 'visual_design'
  | 'long_context_processing'
  | 'api_automation'
  | 'conversational_editing';

export const CLIENT_BENCHMARK_DIMENSIONS: readonly ClientBenchmarkDimension[] = [
  'content_quality',
  'visual_design',
  'long_context_processing',
  'api_automation',
  'conversational_editing',
] as const;

export type ClientDimensionTrendStatus = 'improving' | 'stable' | 'regressing' | 'inconclusive';

export type ClientOverallTrendVerdict = 'TRACKING' | 'AT_RISK' | 'AHEAD_OF_TARGET' | 'INCONCLUSIVE';

export interface ClientDimensionTrendPoint {
  runLabel: string;
  value: number | null;
  delta: number | null;
}

export interface ClientDimensionTrend {
  dimension: ClientBenchmarkDimension;
  points: ClientDimensionTrendPoint[];
  latestValue: number | null;
  averageLast3: number | null;
  averageLast6: number | null;
  status: ClientDimensionTrendStatus;
  distanceToGamma: number | null;
  estimatedRunsToGamma: number | null;
}

export interface ClientBenchmarkTrendReport {
  generatedAt: string;
  organizationId: string;
  referenceSet: string;
  windowMonths: number;
  gammaTarget: number;
  warningThreshold: number;
  dimensions: ClientDimensionTrend[];
  overallVerdict: ClientOverallTrendVerdict;
  summary: string;
}

export interface BenchmarkTrendFetchResult {
  status: BenchmarkTrendFetchStatus;
  data?: ClientBenchmarkTrendReport;
  error?: string;
}

export interface FetchBenchmarkTrendOptions {
  windowMonths?: number;
  referenceSet?: string;
}

const ALLOWED_DIMENSIONS = new Set<ClientBenchmarkDimension>(CLIENT_BENCHMARK_DIMENSIONS);
const ALLOWED_STATUSES = new Set<ClientDimensionTrendStatus>([
  'improving',
  'stable',
  'regressing',
  'inconclusive',
]);
const ALLOWED_VERDICTS = new Set<ClientOverallTrendVerdict>([
  'TRACKING',
  'AT_RISK',
  'AHEAD_OF_TARGET',
  'INCONCLUSIVE',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asDimension(value: unknown): ClientBenchmarkDimension | null {
  if (typeof value === 'string' && ALLOWED_DIMENSIONS.has(value as ClientBenchmarkDimension)) {
    return value as ClientBenchmarkDimension;
  }
  return null;
}

function asStatus(value: unknown): ClientDimensionTrendStatus {
  if (typeof value === 'string' && ALLOWED_STATUSES.has(value as ClientDimensionTrendStatus)) {
    return value as ClientDimensionTrendStatus;
  }
  return 'inconclusive';
}

function asVerdict(value: unknown): ClientOverallTrendVerdict {
  if (typeof value === 'string' && ALLOWED_VERDICTS.has(value as ClientOverallTrendVerdict)) {
    return value as ClientOverallTrendVerdict;
  }
  return 'INCONCLUSIVE';
}

function normalizePoint(raw: unknown): ClientDimensionTrendPoint {
  const r = isRecord(raw) ? raw : {};
  return {
    runLabel: asString(r.runLabel, ''),
    value: asNumberOrNull(r.value),
    delta: asNumberOrNull(r.delta),
  };
}

function normalizeDimension(raw: unknown): ClientDimensionTrend | null {
  if (!isRecord(raw)) return null;
  const dimension = asDimension(raw.dimension);
  if (!dimension) return null;
  const points = Array.isArray(raw.points) ? raw.points.map((p) => normalizePoint(p)) : [];
  return {
    dimension,
    points,
    latestValue: asNumberOrNull(raw.latestValue),
    averageLast3: asNumberOrNull(raw.averageLast3),
    averageLast6: asNumberOrNull(raw.averageLast6),
    status: asStatus(raw.status),
    distanceToGamma: asNumberOrNull(raw.distanceToGamma),
    estimatedRunsToGamma: asNumberOrNull(raw.estimatedRunsToGamma),
  };
}

function normalizeReport(raw: unknown): ClientBenchmarkTrendReport | null {
  if (!isRecord(raw)) return null;
  const dimsRaw = Array.isArray(raw.dimensions) ? raw.dimensions : [];
  const dimensions = dimsRaw
    .map((d) => normalizeDimension(d))
    .filter((d): d is ClientDimensionTrend => d !== null);
  return {
    generatedAt: asString(raw.generatedAt, new Date().toISOString()),
    organizationId: asString(raw.organizationId, ''),
    referenceSet: asString(raw.referenceSet, ''),
    windowMonths: asNumber(raw.windowMonths, 0),
    gammaTarget: asNumber(raw.gammaTarget, 4.0),
    warningThreshold: asNumber(raw.warningThreshold, 3.5),
    dimensions,
    overallVerdict: asVerdict(raw.overallVerdict),
    summary: asString(raw.summary, ''),
  };
}

function statusFromError(err: unknown): BenchmarkTrendFetchStatus {
  if (isRecord(err) && typeof err.status === 'number') {
    const code = err.status;
    if (code === 401) return 'error';
    if (code === 403) return 'forbidden';
    if (code === 404) return 'not_found';
    return 'error';
  }
  return 'unavailable';
}

function safeMessage(err: unknown): string | undefined {
  if (isRecord(err) && typeof err.message === 'string') return err.message;
  return undefined;
}

function clampWindowMonths(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 12;
  const rounded = Math.round(value);
  if (rounded < 1) return 1;
  if (rounded > 36) return 36;
  return rounded;
}

function buildPath(opts: FetchBenchmarkTrendOptions): string {
  const params = new URLSearchParams();
  params.set('windowMonths', String(clampWindowMonths(opts.windowMonths)));
  if (typeof opts.referenceSet === 'string' && opts.referenceSet.length > 0) {
    params.set('referenceSet', opts.referenceSet);
  }
  return `/presentations/benchmark/trend?${params.toString()}`;
}

export async function fetchBenchmarkTrend(
  opts: FetchBenchmarkTrendOptions = {}
): Promise<BenchmarkTrendFetchResult> {
  const path = buildPath(opts);
  const apiAny = Api as unknown as { get?: (url: string) => Promise<unknown> };

  if (typeof apiAny.get === 'function') {
    try {
      const res = await apiAny.get(path);
      const payload = isRecord(res) && 'data' in res ? (res as { data: unknown }).data : res;
      const innerData =
        isRecord(payload) && 'data' in payload ? (payload as { data: unknown }).data : payload;
      const data = normalizeReport(innerData);
      if (!data) return { status: 'error', error: 'invalid_payload' };
      return { status: 'ok', data };
    } catch (err) {
      return { status: statusFromError(err), error: safeMessage(err) };
    }
  }

  try {
    const res = await fetch(`/api${path}`, { credentials: 'include' });
    if (!res.ok) {
      if (res.status === 401) return { status: 'error', error: 'unauthorized' };
      if (res.status === 403) return { status: 'forbidden', error: 'forbidden' };
      if (res.status === 404) return { status: 'not_found', error: 'not_found' };
      return { status: 'error', error: `http_${res.status}` };
    }
    const json: unknown = await res.json().catch(() => null);
    const innerData = isRecord(json) && 'data' in json ? (json as { data: unknown }).data : json;
    const data = normalizeReport(innerData);
    if (!data) return { status: 'error', error: 'invalid_payload' };
    return { status: 'ok', data };
  } catch {
    return { status: 'unavailable', error: 'network_error' };
  }
}
