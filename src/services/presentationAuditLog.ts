import { Api } from '@/services/api';

export type PresentationAuditActorType = 'USER' | 'AI_AGENT' | 'SYSTEM' | string;

export interface PresentationAuditLogEvent {
  id: string;
  timestamp: string;
  actorId: string | null;
  actorType: PresentationAuditActorType;
  action: string;
  resourceType: string;
  resourceId: string | null;
  scope: string | null;
  operationId: string | null;
  summary: string;
  metadata: Record<string, unknown>;
}

export type AuditLogFetchStatus =
  | 'ok'
  | 'error'
  | 'forbidden'
  | 'not_found'
  | 'unavailable';

export interface AuditLogFetchResult {
  status: AuditLogFetchStatus;
  events?: PresentationAuditLogEvent[];
  total?: number;
  error?: string;
}

export interface AuditLogFetchOptions {
  limit?: number;
  offset?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value == null) return null;
  return String(value);
}

function normalizeEvent(raw: unknown): PresentationAuditLogEvent | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const timestamp = asString(raw.timestamp);
  const action = asString(raw.action);
  const resourceType = asString(raw.resourceType);
  if (!id || !timestamp || !action) return null;

  const metadata = isRecord(raw.metadata) ? (raw.metadata as Record<string, unknown>) : {};

  return {
    id,
    timestamp,
    actorId: asNullableString(raw.actorId),
    actorType: asString(raw.actorType, 'SYSTEM'),
    action,
    resourceType,
    resourceId: asNullableString(raw.resourceId),
    scope: asNullableString(raw.scope),
    operationId: asNullableString(raw.operationId),
    summary: asString(raw.summary, `${action} ${resourceType}`.trim()),
    metadata,
  };
}

interface UnwrappedPayload {
  events: unknown[];
  total: number;
}

function unwrapPayload(payload: unknown): UnwrappedPayload {
  if (!isRecord(payload)) return { events: [], total: 0 };
  const direct = payload as Record<string, unknown>;
  if (Array.isArray(direct.events)) {
    return {
      events: direct.events as unknown[],
      total: asNumber(direct.total, (direct.events as unknown[]).length),
    };
  }
  const inner = direct.data;
  if (isRecord(inner)) {
    if (Array.isArray((inner as Record<string, unknown>).events)) {
      const events = (inner as Record<string, unknown>).events as unknown[];
      return {
        events,
        total: asNumber((inner as Record<string, unknown>).total, events.length),
      };
    }
    const innerData = (inner as Record<string, unknown>).data;
    if (isRecord(innerData) && Array.isArray((innerData as Record<string, unknown>).events)) {
      const events = (innerData as Record<string, unknown>).events as unknown[];
      return {
        events,
        total: asNumber((innerData as Record<string, unknown>).total, events.length),
      };
    }
  }
  return { events: [], total: 0 };
}

function statusFromError(err: unknown): AuditLogFetchStatus {
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

function buildPath(deckId: string, opts?: AuditLogFetchOptions): string {
  const params = new URLSearchParams();
  if (opts?.limit != null) {
    const limit = Math.max(1, Math.min(500, Math.floor(opts.limit)));
    params.set('limit', String(limit));
  }
  if (opts?.offset != null) {
    const offset = Math.max(0, Math.floor(opts.offset));
    params.set('offset', String(offset));
  }
  const qs = params.toString();
  const base = `/presentations/decks/${encodeURIComponent(deckId)}/audit-log`;
  return qs ? `${base}?${qs}` : base;
}

export async function fetchPresentationAuditLog(
  deckId: string,
  opts?: AuditLogFetchOptions
): Promise<AuditLogFetchResult> {
  if (!deckId) {
    return { status: 'not_found', error: 'missing_deck_id' };
  }

  const path = buildPath(deckId, opts);
  const apiAny = Api as unknown as { get?: (url: string) => Promise<unknown> };

  if (typeof apiAny.get === 'function') {
    try {
      const res = await apiAny.get(path);
      const payload = isRecord(res) && 'data' in res ? (res as { data: unknown }).data : res;
      const { events: rawEvents, total } = unwrapPayload(payload);
      const events = rawEvents
        .map(normalizeEvent)
        .filter((e): e is PresentationAuditLogEvent => e !== null);
      return { status: 'ok', events, total };
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
    const { events: rawEvents, total } = unwrapPayload(json);
    const events = rawEvents
      .map(normalizeEvent)
      .filter((e): e is PresentationAuditLogEvent => e !== null);
    return { status: 'ok', events, total };
  } catch {
    return { status: 'unavailable', error: 'network_error' };
  }
}
