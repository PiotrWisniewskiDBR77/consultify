/**
 * presentationTelemetry
 *
 * Read-only client for the per-deck runtime-events summary endpoint used by the
 * SuperAdmin "Presentation Telemetry" view. Wraps:
 *   GET /api/presentations/decks/:deckId/runtime-events/summary?windowDays=N
 *
 * Always resolves (never throws) so the UI can render an honest "degraded" state
 * with a machine-readable reason instead of crashing or silently returning fake
 * counters.
 */

import { Api } from '@/services/api';

export interface PresentationTelemetryRollupTotals {
  proposalsCreated: number;
  editsApplied: number;
  editsRejected: number;
  exportsBlocked: number;
  noops: number;
  total: number;
}

export interface PresentationTelemetryRollup {
  deckId: string;
  windowDays: number;
  generatedAt: string;
  totals: PresentationTelemetryRollupTotals;
  byEventType: Array<{ eventType: string; count: number; lastAt: string | null }>;
  lastActivityAt: string | null;
  degraded?: boolean;
  reason?: string;
}

const DEFAULT_WINDOW_DAYS = 7;
const ALLOWED_WINDOWS = new Set<number>([1, 7, 14, 30, 90]);

function zeroTotals(): PresentationTelemetryRollupTotals {
  return {
    proposalsCreated: 0,
    editsApplied: 0,
    editsRejected: 0,
    exportsBlocked: 0,
    noops: 0,
    total: 0,
  };
}

function normalizeWindow(windowDays?: number): number {
  if (typeof windowDays !== 'number' || !Number.isFinite(windowDays)) {
    return DEFAULT_WINDOW_DAYS;
  }
  const rounded = Math.round(windowDays);
  if (ALLOWED_WINDOWS.has(rounded)) return rounded;
  // Clamp anything else into the supported range so we never send an arbitrary
  // window the backend may not understand.
  if (rounded <= 1) return 1;
  if (rounded >= 90) return 90;
  // Fall back to the default for anything in-between but unsupported.
  return DEFAULT_WINDOW_DAYS;
}

function pickNumber(raw: unknown, fallback = 0): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function pickString(raw: unknown, fallback = ''): string {
  return typeof raw === 'string' ? raw : fallback;
}

function pickStringOrNull(raw: unknown): string | null {
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

function unwrapPayload(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  // Accept both `{ ...rollup }` and `{ data: { ...rollup } }` shapes.
  if (
    obj.data &&
    typeof obj.data === 'object' &&
    !Array.isArray(obj.data) &&
    // Heuristic: prefer the inner object only if it actually looks like a rollup.
    ('totals' in (obj.data as Record<string, unknown>) ||
      'byEventType' in (obj.data as Record<string, unknown>) ||
      'deckId' in (obj.data as Record<string, unknown>))
  ) {
    return obj.data as Record<string, unknown>;
  }
  return obj;
}

function normalizeRollup(
  payload: unknown,
  deckId: string,
  windowDays: number
): PresentationTelemetryRollup {
  const root = unwrapPayload(payload);
  if (!root) {
    return {
      deckId,
      windowDays,
      generatedAt: new Date().toISOString(),
      totals: zeroTotals(),
      byEventType: [],
      lastActivityAt: null,
      degraded: true,
      reason: 'invalid_payload',
    };
  }

  const totalsRaw =
    root.totals && typeof root.totals === 'object' && !Array.isArray(root.totals)
      ? (root.totals as Record<string, unknown>)
      : {};

  const totals: PresentationTelemetryRollupTotals = {
    proposalsCreated: pickNumber(totalsRaw.proposalsCreated),
    editsApplied: pickNumber(totalsRaw.editsApplied),
    editsRejected: pickNumber(totalsRaw.editsRejected),
    exportsBlocked: pickNumber(totalsRaw.exportsBlocked),
    noops: pickNumber(totalsRaw.noops),
    total: pickNumber(totalsRaw.total),
  };

  // If the backend omitted `total`, derive it from the parts so the KPI grid
  // and the "no events" empty-state stay consistent.
  if (!totalsRaw.total) {
    totals.total =
      totals.proposalsCreated +
      totals.editsApplied +
      totals.editsRejected +
      totals.exportsBlocked +
      totals.noops;
  }

  const byEventTypeRaw = Array.isArray(root.byEventType) ? (root.byEventType as unknown[]) : [];
  const byEventType = byEventTypeRaw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const e = entry as Record<string, unknown>;
      const eventType = pickString(e.eventType);
      if (!eventType) return null;
      return {
        eventType,
        count: pickNumber(e.count),
        lastAt: pickStringOrNull(e.lastAt),
      };
    })
    .filter((e): e is { eventType: string; count: number; lastAt: string | null } => e !== null);

  const generatedAt = pickString(root.generatedAt) || new Date().toISOString();
  const resolvedDeckId = pickString(root.deckId) || deckId;
  const resolvedWindow = pickNumber(root.windowDays, windowDays) || windowDays;
  const lastActivityAt = pickStringOrNull(root.lastActivityAt);

  const out: PresentationTelemetryRollup = {
    deckId: resolvedDeckId,
    windowDays: resolvedWindow,
    generatedAt,
    totals,
    byEventType,
    lastActivityAt,
  };

  // Honor degraded/reason if the backend explicitly returned them in a 2xx body.
  if (root.degraded === true) {
    out.degraded = true;
    const reason = pickString(root.reason);
    if (reason) out.reason = reason;
  }

  return out;
}

function degradedRollup(
  deckId: string,
  windowDays: number,
  reason: string
): PresentationTelemetryRollup {
  return {
    deckId,
    windowDays,
    generatedAt: new Date().toISOString(),
    totals: zeroTotals(),
    byEventType: [],
    lastActivityAt: null,
    degraded: true,
    reason,
  };
}

function buildPath(deckId: string, windowDays: number): string {
  const params = new URLSearchParams();
  params.set('windowDays', String(windowDays));
  return `/presentations/decks/${encodeURIComponent(deckId)}/runtime-events/summary?${params.toString()}`;
}

export async function fetchPresentationTelemetryRollup(
  deckId: string,
  windowDays?: number
): Promise<PresentationTelemetryRollup> {
  const window = normalizeWindow(windowDays);

  if (!deckId || typeof deckId !== 'string') {
    return degradedRollup('', window, 'missing_deck_id');
  }

  const path = buildPath(deckId, window);
  const apiAny = Api as unknown as { get?: (url: string) => Promise<unknown> };

  if (typeof apiAny.get === 'function') {
    try {
      const res = await apiAny.get(path);
      const payload =
        res && typeof res === 'object' && 'data' in (res as Record<string, unknown>)
          ? (res as { data: unknown }).data
          : res;
      return normalizeRollup(payload, deckId, window);
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        typeof (err as { status?: unknown }).status === 'number'
      ) {
        return degradedRollup(deckId, window, 'http_error');
      }
      return degradedRollup(deckId, window, 'network_error');
    }
  }

  try {
    const res = await fetch(`/api${path}`, { credentials: 'include' });
    if (!res.ok) {
      return degradedRollup(deckId, window, 'http_error');
    }
    const payload = await res.json().catch(() => null);
    return normalizeRollup(payload, deckId, window);
  } catch {
    return degradedRollup(deckId, window, 'network_error');
  }
}
