import { Api } from '@/services/api';

export type AgentHistoryStatus =
  | 'draft'
  | 'accepted'
  | 'rejected'
  | 'applied'
  | 'failed'
  | string;

export interface AgentHistorySlideDiff {
  index: number;
  action: 'added' | 'removed' | 'modified' | 'unchanged';
  titleBefore?: string | null;
  titleAfter?: string | null;
  bulletsAdded?: string[];
  bulletsRemoved?: string[];
  layoutBefore?: string | null;
  layoutAfter?: string | null;
}

export interface AgentHistoryDiff {
  cardsBefore: number | null;
  cardsAfter: number | null;
  cardsAdded: number;
  cardsRemoved: number;
  changedCards: number;
  slides?: AgentHistorySlideDiff[];
  editPlan?: unknown;
}

export interface PresentationAgentHistoryEntry {
  id: string;
  deckId: string;
  status: AgentHistoryStatus;
  operationType: string;
  prompt: string | null;
  reply: string | null;
  actions: string[];
  versionBefore: number | null;
  versionAfter: number | null;
  createdAt: string | null;
  resolvedAt: string | null;
  diff: AgentHistoryDiff;
}

export type AgentHistoryFetchStatus =
  | 'ok'
  | 'error'
  | 'forbidden'
  | 'not_found'
  | 'unavailable';

export interface AgentHistoryFetchResult {
  status: AgentHistoryFetchStatus;
  entries?: PresentationAgentHistoryEntry[];
  total?: number;
  warnings?: string[];
  error?: string;
}

export interface AgentHistoryFetchOptions {
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

function asNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asNullableString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value == null) return null;
  return String(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => (typeof entry === 'string' ? entry : String(entry)));
}

function normalizeSlide(raw: unknown): AgentHistorySlideDiff | null {
  if (!isRecord(raw)) return null;
  const indexRaw = raw.index;
  const actionRaw = typeof raw.action === 'string' ? raw.action : '';
  const action: AgentHistorySlideDiff['action'] =
    actionRaw === 'added' || actionRaw === 'removed' || actionRaw === 'modified'
      ? (actionRaw as AgentHistorySlideDiff['action'])
      : 'unchanged';
  const index = typeof indexRaw === 'number' && Number.isFinite(indexRaw) ? indexRaw : 0;
  return {
    index,
    action,
    titleBefore: asNullableString(raw.titleBefore),
    titleAfter: asNullableString(raw.titleAfter),
    bulletsAdded: asStringArray(raw.bulletsAdded),
    bulletsRemoved: asStringArray(raw.bulletsRemoved),
    layoutBefore: asNullableString(raw.layoutBefore),
    layoutAfter: asNullableString(raw.layoutAfter),
  };
}

function normalizeDiff(raw: unknown): AgentHistoryDiff {
  const safe = isRecord(raw) ? raw : {};
  const slidesRaw = safe.slides;
  const slides = Array.isArray(slidesRaw)
    ? slidesRaw
        .map(normalizeSlide)
        .filter((slide): slide is AgentHistorySlideDiff => slide !== null)
    : undefined;
  return {
    cardsBefore: asNumberOrNull(safe.cardsBefore),
    cardsAfter: asNumberOrNull(safe.cardsAfter),
    cardsAdded: asNumber(safe.cardsAdded),
    cardsRemoved: asNumber(safe.cardsRemoved),
    changedCards: asNumber(safe.changedCards),
    slides,
    editPlan: safe.editPlan,
  };
}

function normalizeEntry(raw: unknown): PresentationAgentHistoryEntry | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  return {
    id,
    deckId: asString(raw.deckId),
    status: asString(raw.status, 'draft'),
    operationType: asString(raw.operationType, 'agent_edit'),
    prompt: asNullableString(raw.prompt),
    reply: asNullableString(raw.reply),
    actions: asStringArray(raw.actions),
    versionBefore: asNumberOrNull(raw.versionBefore),
    versionAfter: asNumberOrNull(raw.versionAfter),
    createdAt: asNullableString(raw.createdAt),
    resolvedAt: asNullableString(raw.resolvedAt),
    diff: normalizeDiff(raw.diff),
  };
}

interface UnwrappedPayload {
  operations: unknown[];
  total: number;
  warnings: string[];
}

function readOperationsLayer(layer: Record<string, unknown>): UnwrappedPayload | null {
  if (Array.isArray(layer.operations)) {
    const operations = layer.operations as unknown[];
    const warningsRaw = layer.warnings;
    const warnings = Array.isArray(warningsRaw)
      ? warningsRaw.map((w) => (typeof w === 'string' ? w : String(w)))
      : [];
    return {
      operations,
      total: asNumber(layer.total, operations.length),
      warnings,
    };
  }
  return null;
}

function unwrapPayload(payload: unknown): UnwrappedPayload {
  const empty: UnwrappedPayload = { operations: [], total: 0, warnings: [] };
  if (!isRecord(payload)) return empty;
  const direct = readOperationsLayer(payload);
  if (direct) return direct;
  const inner = (payload as Record<string, unknown>).data;
  if (isRecord(inner)) {
    const innerLayer = readOperationsLayer(inner);
    if (innerLayer) return innerLayer;
    const innerData = (inner as Record<string, unknown>).data;
    if (isRecord(innerData)) {
      const deeper = readOperationsLayer(innerData);
      if (deeper) return deeper;
    }
  }
  return empty;
}

function statusFromError(err: unknown): AgentHistoryFetchStatus {
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

function buildPath(deckId: string, opts?: AgentHistoryFetchOptions): string {
  const params = new URLSearchParams();
  if (opts?.limit != null) {
    const limit = Math.max(1, Math.min(200, Math.floor(opts.limit)));
    params.set('limit', String(limit));
  }
  if (opts?.offset != null) {
    const offset = Math.max(0, Math.floor(opts.offset));
    params.set('offset', String(offset));
  }
  const qs = params.toString();
  const base = `/presentations/decks/${encodeURIComponent(deckId)}/agent-history`;
  return qs ? `${base}?${qs}` : base;
}

export async function fetchPresentationAgentHistory(
  deckId: string,
  opts?: AgentHistoryFetchOptions
): Promise<AgentHistoryFetchResult> {
  if (!deckId) {
    return { status: 'not_found', error: 'missing_deck_id' };
  }

  const path = buildPath(deckId, opts);
  const apiAny = Api as unknown as { get?: (url: string) => Promise<unknown> };

  if (typeof apiAny.get === 'function') {
    try {
      const res = await apiAny.get(path);
      const payload = isRecord(res) && 'data' in res ? (res as { data: unknown }).data : res;
      const { operations: rawOps, total, warnings } = unwrapPayload(payload);
      const entries = rawOps
        .map(normalizeEntry)
        .filter((entry): entry is PresentationAgentHistoryEntry => entry !== null);
      return { status: 'ok', entries, total, warnings };
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
    const { operations: rawOps, total, warnings } = unwrapPayload(json);
    const entries = rawOps
      .map(normalizeEntry)
      .filter((entry): entry is PresentationAgentHistoryEntry => entry !== null);
    return { status: 'ok', entries, total, warnings };
  } catch {
    return { status: 'unavailable', error: 'network_error' };
  }
}
