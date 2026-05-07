/**
 * presentationOperationsHealthDrilldown
 *
 * Read-only client for the SuperAdmin "Operations Health" drill-down panel.
 * Wraps:
 *   GET /api/presentations/operations/health/slo/:sloId/drilldown
 *
 * Mirrors the Api/fetch fallback pattern of `presentationOperationsHealth`
 * and always resolves with a `{ status, data?, error? }` envelope so the
 * panel can surface honest forbidden / unavailable banners without
 * crashing on payload shape drift.
 */

import { Api } from '@/services/api';

import type { SloStatus } from './presentationOperationsHealth';

export type DrilldownFetchStatus =
  | 'ok'
  | 'error'
  | 'forbidden'
  | 'not_found'
  | 'unavailable';

export type DrilldownSloId =
  | 'generation_success_rate'
  | 'export_success_rate'
  | 'p95_generation_latency_ms'
  | 'agent_edit_success_rate'
  | 'export_blocked_rate';

export interface TrendPoint {
  bucketStart: string;
  bucketEnd: string;
  observedNumeric: number | null;
  status: SloStatus;
  sampleSize: number;
}

export interface TopProblematicDeck {
  deckId: string;
  title: string;
  observedNumeric: number | null;
  failureCount: number;
  totalCount: number;
}

export interface DrilldownEventSample {
  occurredAt: string;
  deckId: string;
  type: string;
  status: string | null;
  durationMs: number | null;
  excerpt: string | null;
}

export interface SloDrilldownReport {
  sloId: DrilldownSloId;
  windowStart: string;
  windowEnd: string;
  bucketDays: number;
  trend: TrendPoint[];
  topProblematicDecks: TopProblematicDeck[];
  recentSamples: DrilldownEventSample[];
  warnings: string[];
}

export interface DrilldownFetchResult {
  status: DrilldownFetchStatus;
  data?: SloDrilldownReport;
  error?: string;
}

export interface FetchDrilldownOptions {
  windowDays?: number;
  bucketDays?: number;
}

const ALLOWED_SLO_IDS = new Set<DrilldownSloId>([
  'generation_success_rate',
  'export_success_rate',
  'p95_generation_latency_ms',
  'agent_edit_success_rate',
  'export_blocked_rate',
]);

const ALLOWED_SLO_STATUS = new Set<SloStatus>([
  'pass',
  'at_risk',
  'breach',
  'inconclusive',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asSloStatus(value: unknown): SloStatus {
  if (typeof value === 'string' && ALLOWED_SLO_STATUS.has(value as SloStatus)) {
    return value as SloStatus;
  }
  return 'inconclusive';
}

function asSloId(value: unknown): DrilldownSloId | null {
  if (typeof value === 'string' && ALLOWED_SLO_IDS.has(value as DrilldownSloId)) {
    return value as DrilldownSloId;
  }
  return null;
}

function normalizeTrendPoint(raw: unknown): TrendPoint | null {
  if (!isRecord(raw)) return null;
  const bucketStart = asString(raw.bucketStart, '');
  const bucketEnd = asString(raw.bucketEnd, '');
  if (!bucketStart || !bucketEnd) return null;
  return {
    bucketStart,
    bucketEnd,
    observedNumeric: asNumberOrNull(raw.observedNumeric),
    status: asSloStatus(raw.status),
    sampleSize: Math.max(0, Math.floor(asNumber(raw.sampleSize, 0))),
  };
}

function normalizeTopDeck(raw: unknown): TopProblematicDeck | null {
  if (!isRecord(raw)) return null;
  const deckId = asString(raw.deckId, '');
  if (!deckId) return null;
  return {
    deckId,
    title: asString(raw.title, deckId),
    observedNumeric: asNumberOrNull(raw.observedNumeric),
    failureCount: Math.max(0, Math.floor(asNumber(raw.failureCount, 0))),
    totalCount: Math.max(0, Math.floor(asNumber(raw.totalCount, 0))),
  };
}

function normalizeSample(raw: unknown): DrilldownEventSample | null {
  if (!isRecord(raw)) return null;
  const occurredAt = asString(raw.occurredAt, '');
  if (!occurredAt) return null;
  return {
    occurredAt,
    deckId: asString(raw.deckId, ''),
    type: asString(raw.type, ''),
    status: asStringOrNull(raw.status),
    durationMs: asNumberOrNull(raw.durationMs),
    excerpt: asStringOrNull(raw.excerpt),
  };
}

function normalizeReport(raw: unknown): SloDrilldownReport | null {
  if (!isRecord(raw)) return null;
  const sloId = asSloId(raw.sloId);
  if (!sloId) return null;
  const trend = (Array.isArray(raw.trend) ? raw.trend : [])
    .map((p) => normalizeTrendPoint(p))
    .filter((p): p is TrendPoint => p !== null);
  const topProblematicDecks = (Array.isArray(raw.topProblematicDecks)
    ? raw.topProblematicDecks
    : []
  )
    .map((d) => normalizeTopDeck(d))
    .filter((d): d is TopProblematicDeck => d !== null);
  const recentSamples = (Array.isArray(raw.recentSamples) ? raw.recentSamples : [])
    .map((s) => normalizeSample(s))
    .filter((s): s is DrilldownEventSample => s !== null);
  const warnings = (Array.isArray(raw.warnings) ? raw.warnings : [])
    .map((w) => (typeof w === 'string' ? w : null))
    .filter((w): w is string => w !== null);

  return {
    sloId,
    windowStart: asString(raw.windowStart, ''),
    windowEnd: asString(raw.windowEnd, ''),
    bucketDays: Math.max(1, Math.floor(asNumber(raw.bucketDays, 1))),
    trend,
    topProblematicDecks,
    recentSamples,
    warnings,
  };
}

function statusFromError(err: unknown): DrilldownFetchStatus {
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

function clampWindow(windowDays?: number): number {
  if (typeof windowDays !== 'number' || !Number.isFinite(windowDays)) return 30;
  const rounded = Math.round(windowDays);
  if (rounded < 1) return 1;
  if (rounded > 90) return 90;
  return rounded;
}

function clampBucket(bucketDays?: number): number {
  if (typeof bucketDays !== 'number' || !Number.isFinite(bucketDays)) return 1;
  const rounded = Math.round(bucketDays);
  if (rounded < 1) return 1;
  if (rounded > 7) return 7;
  return rounded;
}

function buildPath(sloId: DrilldownSloId, opts: FetchDrilldownOptions): string {
  const params = new URLSearchParams();
  params.set('windowDays', String(clampWindow(opts.windowDays)));
  params.set('bucketDays', String(clampBucket(opts.bucketDays)));
  return `/presentations/operations/health/slo/${encodeURIComponent(sloId)}/drilldown?${params.toString()}`;
}

export async function fetchSloDrilldown(
  sloId: DrilldownSloId,
  opts: FetchDrilldownOptions = {}
): Promise<DrilldownFetchResult> {
  if (!ALLOWED_SLO_IDS.has(sloId)) {
    return { status: 'error', error: 'invalid_slo_id' };
  }
  const path = buildPath(sloId, opts);
  const apiAny = Api as unknown as { get?: (url: string) => Promise<unknown> };

  if (typeof apiAny.get === 'function') {
    try {
      const res = await apiAny.get(path);
      const payload = isRecord(res) && 'data' in res ? (res as { data: unknown }).data : res;
      const innerData =
        isRecord(payload) && 'data' in payload
          ? (payload as { data: unknown }).data
          : payload;
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
    const innerData =
      isRecord(json) && 'data' in json ? (json as { data: unknown }).data : json;
    const data = normalizeReport(innerData);
    if (!data) return { status: 'error', error: 'invalid_payload' };
    return { status: 'ok', data };
  } catch {
    return { status: 'unavailable', error: 'network_error' };
  }
}
