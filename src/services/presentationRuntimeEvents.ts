import { Api } from '@/services/api';

export interface PresentationRuntimeEvent {
  id: string;
  organizationId: string;
  deckId: string | null;
  userId: string | null;
  eventType: string;
  status: string | null;
  scope: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PresentationRuntimeEventsResult {
  events: PresentationRuntimeEvent[];
  degraded: boolean;
  reason?: string;
}

interface FetchOptions {
  eventType?: string;
  since?: string;
  limit?: number;
}

const AGENT_EDIT_PREFIX = 'agent_edit_';
const AGENT_EDIT_STATUSES = new Set<string>(['proposal', 'applied']);

function normalizeEvent(raw: any): PresentationRuntimeEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const id =
    typeof raw.id === 'string'
      ? raw.id
      : typeof raw.event_id === 'string'
        ? raw.event_id
        : '';
  const eventType =
    typeof raw.eventType === 'string'
      ? raw.eventType
      : typeof raw.event_type === 'string'
        ? raw.event_type
        : '';
  const createdAt =
    typeof raw.createdAt === 'string'
      ? raw.createdAt
      : typeof raw.created_at === 'string'
        ? raw.created_at
        : '';
  if (!id || !eventType || !createdAt) return null;

  const organizationId =
    typeof raw.organizationId === 'string'
      ? raw.organizationId
      : typeof raw.organization_id === 'string'
        ? raw.organization_id
        : '';
  const deckIdRaw =
    typeof raw.deckId === 'string'
      ? raw.deckId
      : typeof raw.deck_id === 'string'
        ? raw.deck_id
        : null;
  const userIdRaw =
    typeof raw.userId === 'string'
      ? raw.userId
      : typeof raw.user_id === 'string'
        ? raw.user_id
        : null;
  const status = typeof raw.status === 'string' ? raw.status : null;
  const scope = typeof raw.scope === 'string' ? raw.scope : null;
  const metadata =
    raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : {};

  return {
    id,
    organizationId,
    deckId: deckIdRaw,
    userId: userIdRaw,
    eventType,
    status,
    scope,
    metadata,
    createdAt,
  };
}

function unwrapEventArray(payload: unknown): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.events)) return obj.events as any[];
    if (Array.isArray((obj as any).data)) return (obj as any).data as any[];
    if (obj.data && typeof obj.data === 'object') {
      const inner = obj.data as Record<string, unknown>;
      if (Array.isArray(inner.events)) return inner.events as any[];
      if (Array.isArray((inner as any).data)) return (inner as any).data as any[];
    }
  }
  return [];
}

function buildPath(deckId: string, options?: FetchOptions): string {
  const limit = Math.max(1, Math.min(500, options?.limit ?? 50));
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (options?.eventType) params.set('eventType', options.eventType);
  if (options?.since) params.set('since', options.since);
  return `/presentations/decks/${encodeURIComponent(deckId)}/runtime-events?${params.toString()}`;
}

export async function fetchPresentationRuntimeEvents(
  deckId: string,
  options?: FetchOptions
): Promise<PresentationRuntimeEventsResult> {
  if (!deckId) {
    return { events: [], degraded: true, reason: 'missing_deck_id' };
  }

  const path = buildPath(deckId, options);
  const apiAny = Api as unknown as { get?: (url: string) => Promise<any> };

  if (typeof apiAny.get === 'function') {
    try {
      const res = await apiAny.get(path);
      const payload = res && typeof res === 'object' && 'data' in res ? (res as any).data : res;
      const rawEvents = unwrapEventArray(payload);
      const events = rawEvents
        .map(normalizeEvent)
        .filter((e): e is PresentationRuntimeEvent => e !== null);
      return { events, degraded: false };
    } catch (err: any) {
      if (err && typeof err === 'object' && typeof err.status === 'number') {
        return { events: [], degraded: true, reason: 'http_error' };
      }
      return { events: [], degraded: true, reason: 'network_error' };
    }
  }

  try {
    const res = await fetch(`/api${path}`, { credentials: 'include' });
    if (!res.ok) {
      return { events: [], degraded: true, reason: 'http_error' };
    }
    const payload = await res.json().catch(() => null);
    const rawEvents = unwrapEventArray(payload);
    const events = rawEvents
      .map(normalizeEvent)
      .filter((e): e is PresentationRuntimeEvent => e !== null);
    return { events, degraded: false };
  } catch {
    return { events: [], degraded: true, reason: 'network_error' };
  }
}

export function deriveLastAgentActivity(events: PresentationRuntimeEvent[]): string | null {
  if (!Array.isArray(events) || events.length === 0) return null;

  const filtered = events.filter(
    (e) =>
      typeof e?.eventType === 'string' &&
      e.eventType.startsWith(AGENT_EDIT_PREFIX) &&
      typeof e.status === 'string' &&
      AGENT_EDIT_STATUSES.has(e.status)
  );

  if (filtered.length === 0) return null;

  const sorted = [...filtered].sort((a, b) => {
    const ta = Date.parse(a.createdAt);
    const tb = Date.parse(b.createdAt);
    const va = Number.isNaN(ta) ? 0 : ta;
    const vb = Number.isNaN(tb) ? 0 : tb;
    return vb - va;
  });

  return sorted[0]?.createdAt || null;
}
