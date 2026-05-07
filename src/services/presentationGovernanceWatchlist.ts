/**
 * presentationGovernanceWatchlist
 *
 * Read-only client for the SuperAdmin "Governance Watchlist" surface. Wraps:
 *   GET /api/presentations/governance/watchlist?onlyBlocked=…&limit=…
 *
 * Mirrors the Api/fetch fallback pattern of `presentationGovernance.ts` and
 * always resolves with a `{ status, data?, error? }` envelope so the view can
 * surface honest forbidden / unavailable banners without crashing.
 */

import { Api } from '@/services/api';

export type WatchlistVerdict =
  | 'PASS'
  | 'PASS_WITH_P2'
  | 'BLOCKED_P1'
  | 'BLOCKED_P0'
  | 'INCONCLUSIVE';

export interface WatchlistEntry {
  deckId: string;
  title: string;
  confidentialityLevel: 'public' | 'internal' | 'confidential' | string;
  updatedAt: string | null;
  overallVerdict: WatchlistVerdict;
  p0: number;
  p1: number;
  p2: number;
  gateCount: number;
  exportsBlocked: number;
  lastActivityAt: string | null;
  severityScore: number;
}

export interface WatchlistTotals {
  decks: number;
  blockedP0: number;
  blockedP1: number;
  passWithP2: number;
  pass: number;
  inconclusive: number;
}

export interface WatchlistResponse {
  generatedAt: string;
  totals: WatchlistTotals;
  entries: WatchlistEntry[];
  warnings?: string[];
  appliedFilters?: { onlyBlocked: boolean; limit: number };
}

export type WatchlistFetchStatus =
  | 'ok'
  | 'error'
  | 'forbidden'
  | 'not_found'
  | 'unavailable';

export interface WatchlistFetchResult {
  status: WatchlistFetchStatus;
  data?: WatchlistResponse;
  error?: string;
}

export interface FetchWatchlistOptions {
  onlyBlocked?: boolean;
  limit?: number;
}

const ALLOWED_VERDICTS = new Set<WatchlistVerdict>([
  'PASS',
  'PASS_WITH_P2',
  'BLOCKED_P1',
  'BLOCKED_P0',
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

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asVerdict(value: unknown): WatchlistVerdict {
  if (typeof value === 'string' && ALLOWED_VERDICTS.has(value as WatchlistVerdict)) {
    return value as WatchlistVerdict;
  }
  return 'INCONCLUSIVE';
}

function normalizeEntry(raw: unknown): WatchlistEntry | null {
  if (!isRecord(raw)) return null;
  const deckId = asString(raw.deckId);
  if (!deckId) return null;
  return {
    deckId,
    title: asString(raw.title, 'Untitled deck'),
    confidentialityLevel: asString(raw.confidentialityLevel, 'internal'),
    updatedAt: asStringOrNull(raw.updatedAt),
    overallVerdict: asVerdict(raw.overallVerdict),
    p0: asNumber(raw.p0),
    p1: asNumber(raw.p1),
    p2: asNumber(raw.p2),
    gateCount: asNumber(raw.gateCount),
    exportsBlocked: asNumber(raw.exportsBlocked),
    lastActivityAt: asStringOrNull(raw.lastActivityAt),
    severityScore: asNumber(raw.severityScore),
  };
}

function normalizeTotals(raw: unknown): WatchlistTotals {
  const r = isRecord(raw) ? raw : {};
  return {
    decks: asNumber(r.decks),
    blockedP0: asNumber(r.blockedP0),
    blockedP1: asNumber(r.blockedP1),
    passWithP2: asNumber(r.passWithP2),
    pass: asNumber(r.pass),
    inconclusive: asNumber(r.inconclusive),
  };
}

function normalizeResponse(raw: unknown): WatchlistResponse | null {
  if (!isRecord(raw)) return null;
  const entriesRaw = Array.isArray(raw.entries) ? raw.entries : [];
  const entries = entriesRaw
    .map((entry) => normalizeEntry(entry))
    .filter((entry): entry is WatchlistEntry => entry !== null);
  const out: WatchlistResponse = {
    generatedAt: asString(raw.generatedAt, new Date().toISOString()),
    totals: normalizeTotals(raw.totals),
    entries,
  };
  if (Array.isArray(raw.warnings)) {
    const warnings = raw.warnings
      .map((w) => (typeof w === 'string' ? w : null))
      .filter((w): w is string => w !== null);
    if (warnings.length > 0) out.warnings = warnings;
  }
  if (isRecord(raw.appliedFilters)) {
    const applied = raw.appliedFilters as Record<string, unknown>;
    out.appliedFilters = {
      onlyBlocked: applied.onlyBlocked === true,
      limit: asNumber(applied.limit, 50),
    };
  }
  return out;
}

function statusFromError(err: unknown): WatchlistFetchStatus {
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

function clampLimit(limit?: number): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return 50;
  const rounded = Math.round(limit);
  if (rounded < 1) return 1;
  if (rounded > 200) return 200;
  return rounded;
}

function buildPath(opts: FetchWatchlistOptions): string {
  const params = new URLSearchParams();
  params.set('onlyBlocked', opts.onlyBlocked === false ? 'false' : 'true');
  params.set('limit', String(clampLimit(opts.limit)));
  return `/presentations/governance/watchlist?${params.toString()}`;
}

export async function fetchPresentationGovernanceWatchlist(
  opts: FetchWatchlistOptions = {}
): Promise<WatchlistFetchResult> {
  const path = buildPath(opts);
  const apiAny = Api as unknown as { get?: (url: string) => Promise<unknown> };

  if (typeof apiAny.get === 'function') {
    try {
      const res = await apiAny.get(path);
      const payload = isRecord(res) && 'data' in res ? (res as { data: unknown }).data : res;
      const innerData =
        isRecord(payload) && 'data' in payload
          ? (payload as { data: unknown }).data
          : payload;
      const data = normalizeResponse(innerData);
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
    const data = normalizeResponse(innerData);
    if (!data) return { status: 'error', error: 'invalid_payload' };
    return { status: 'ok', data };
  } catch {
    return { status: 'unavailable', error: 'network_error' };
  }
}
