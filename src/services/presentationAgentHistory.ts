import { Api } from '@/services/api';

export type AgentHistoryStatus = 'draft' | 'accepted' | 'rejected' | 'applied' | 'failed' | string;

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

export type AgentHistoryFetchStatus = 'ok' | 'error' | 'forbidden' | 'not_found' | 'unavailable';

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

export interface PresentationAgentHistoryRevertDiffSummary {
  cardsBefore: number;
  cardsAfter: number;
  cardsAdded: number;
  cardsRemoved: number;
  changedCards: number;
}

export type PresentationAgentHistoryRevertStatus =
  | 'ok'
  | 'error'
  | 'forbidden'
  | 'not_found'
  | 'unavailable'
  | 'conflict';

export interface PresentationAgentHistoryRevertResult {
  status: PresentationAgentHistoryRevertStatus;
  data?: {
    deckId: string;
    versionBefore: number;
    versionAfter: number;
    revertOperationId: string;
    diffSummary: PresentationAgentHistoryRevertDiffSummary;
  };
  error?: string;
  reason?: string;
}

function asNumberSafe(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeRevertDiff(raw: unknown): PresentationAgentHistoryRevertDiffSummary {
  const safe = isRecord(raw) ? raw : {};
  return {
    cardsBefore: asNumberSafe(safe.cardsBefore),
    cardsAfter: asNumberSafe(safe.cardsAfter),
    cardsAdded: asNumberSafe(safe.cardsAdded),
    cardsRemoved: asNumberSafe(safe.cardsRemoved),
    changedCards: asNumberSafe(safe.changedCards),
  };
}

function normalizeRevertSuccess(
  payload: unknown,
  fallbackDeckId: string
): NonNullable<PresentationAgentHistoryRevertResult['data']> | null {
  const root = isRecord(payload) ? payload : {};
  const data = isRecord(root.data) ? (root.data as Record<string, unknown>) : root;
  const deckId = typeof data.deckId === 'string' && data.deckId ? data.deckId : fallbackDeckId;
  const revertOperationId =
    typeof data.revertOperationId === 'string' ? data.revertOperationId : '';
  if (!revertOperationId) return null;
  return {
    deckId,
    versionBefore: asNumberSafe(data.versionBefore),
    versionAfter: asNumberSafe(data.versionAfter),
    revertOperationId,
    diffSummary: normalizeRevertDiff(data.diffSummary),
  };
}

function readErrorPayload(payload: unknown): { error?: string; reason?: string } {
  const safe = isRecord(payload) ? payload : {};
  const out: { error?: string; reason?: string } = {};
  if (typeof safe.error === 'string') out.error = safe.error;
  else if (typeof safe.message === 'string') out.error = safe.message;
  if (typeof safe.reason === 'string') out.reason = safe.reason;
  return out;
}

export async function revertPresentationAgentOperation(
  deckId: string,
  operationId: string
): Promise<PresentationAgentHistoryRevertResult> {
  if (!deckId || !operationId) {
    return { status: 'not_found', error: 'missing_identifier' };
  }

  const path = `/presentations/decks/${encodeURIComponent(deckId)}/agent-history/${encodeURIComponent(
    operationId
  )}/revert`;
  const apiAny = Api as unknown as { post?: (url: string, body: unknown) => Promise<unknown> };

  if (typeof apiAny.post === 'function') {
    try {
      const res = await apiAny.post(path, { confirm: true });
      const payload = isRecord(res) && 'data' in res ? (res as { data: unknown }).data : res;
      const data = normalizeRevertSuccess(payload, deckId);
      if (!data) return { status: 'error', error: 'invalid_response' };
      return { status: 'ok', data };
    } catch (err) {
      const code = isRecord(err) && typeof err.status === 'number' ? err.status : 0;
      const errPayload =
        isRecord(err) && 'data' in err ? (err as { data: unknown }).data : undefined;
      const errInfo = readErrorPayload(errPayload);
      if (code === 401 || code === 403) {
        return { status: 'forbidden', error: errInfo.error || 'forbidden' };
      }
      if (code === 404) return { status: 'not_found', error: errInfo.error || 'not_found' };
      if (code === 409) {
        return {
          status: 'conflict',
          error: errInfo.error || 'conflict',
          reason: errInfo.reason,
        };
      }
      if (code >= 400 && code < 600) {
        return { status: 'error', error: errInfo.error || `http_${code}` };
      }
      return { status: 'unavailable', error: safeMessage(err) || 'network_error' };
    }
  }

  try {
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const errInfo = readErrorPayload(json);
      if (res.status === 401 || res.status === 403) {
        return { status: 'forbidden', error: errInfo.error || 'forbidden' };
      }
      if (res.status === 404) {
        return { status: 'not_found', error: errInfo.error || 'not_found' };
      }
      if (res.status === 409) {
        return {
          status: 'conflict',
          error: errInfo.error || 'conflict',
          reason: errInfo.reason,
        };
      }
      return { status: 'error', error: errInfo.error || `http_${res.status}` };
    }
    const data = normalizeRevertSuccess(json, deckId);
    if (!data) return { status: 'error', error: 'invalid_response' };
    return { status: 'ok', data };
  } catch {
    return { status: 'unavailable', error: 'network_error' };
  }
}

export interface PresentationBulkRevertRejection {
  operationId: string;
  reason: string;
}

export interface PresentationBulkRevertResult {
  status: 'ok' | 'error' | 'forbidden' | 'not_found' | 'unavailable' | 'conflict';
  data?: {
    deckId: string;
    baseSnapshotId: string;
    count: number;
    revertOperationId: string;
    versionBefore: number;
    versionAfter: number;
    diffSummary: {
      cardsBefore: number;
      cardsAfter: number;
      cardsAdded: number;
      cardsRemoved: number;
      changedCards: number;
    };
  };
  error?: string;
  reasons?: string[];
  rejected?: PresentationBulkRevertRejection[];
  missingIds?: string[];
}

function readBulkErrorPayload(payload: unknown): {
  error?: string;
  reasons?: string[];
  rejected?: PresentationBulkRevertRejection[];
  missingIds?: string[];
} {
  const safe = isRecord(payload) ? payload : {};
  const out: {
    error?: string;
    reasons?: string[];
    rejected?: PresentationBulkRevertRejection[];
    missingIds?: string[];
  } = {};
  if (typeof safe.error === 'string') out.error = safe.error;
  else if (typeof safe.message === 'string') out.error = safe.message;
  if (Array.isArray(safe.reasons)) {
    out.reasons = safe.reasons
      .map((r) => (typeof r === 'string' ? r : ''))
      .filter((r): r is string => !!r);
  }
  if (Array.isArray(safe.rejected)) {
    out.rejected = safe.rejected
      .map((entry) => {
        if (!isRecord(entry)) return null;
        const operationId = typeof entry.operationId === 'string' ? entry.operationId : '';
        const reason = typeof entry.reason === 'string' ? entry.reason : '';
        if (!operationId || !reason) return null;
        return { operationId, reason };
      })
      .filter((e): e is PresentationBulkRevertRejection => e !== null);
  }
  if (Array.isArray(safe.missingIds)) {
    out.missingIds = safe.missingIds
      .map((id) => (typeof id === 'string' ? id : ''))
      .filter((id): id is string => !!id);
  }
  return out;
}

function normalizeBulkSuccess(
  payload: unknown,
  fallbackDeckId: string
): NonNullable<PresentationBulkRevertResult['data']> | null {
  const root = isRecord(payload) ? payload : {};
  const data = isRecord(root.data) ? (root.data as Record<string, unknown>) : root;
  const deckId = typeof data.deckId === 'string' && data.deckId ? data.deckId : fallbackDeckId;
  const revertOperationId =
    typeof data.revertOperationId === 'string' ? data.revertOperationId : '';
  const baseSnapshotId = typeof data.baseSnapshotId === 'string' ? data.baseSnapshotId : '';
  if (!revertOperationId || !baseSnapshotId) return null;
  return {
    deckId,
    baseSnapshotId,
    count: asNumberSafe(data.count),
    revertOperationId,
    versionBefore: asNumberSafe(data.versionBefore),
    versionAfter: asNumberSafe(data.versionAfter),
    diffSummary: normalizeRevertDiff(data.diffSummary),
  };
}

export async function bulkRevertPresentationAgentOperations(
  deckId: string,
  operationIds: string[]
): Promise<PresentationBulkRevertResult> {
  if (!deckId) {
    return { status: 'not_found', error: 'missing_deck_id' };
  }
  if (!Array.isArray(operationIds) || operationIds.length === 0) {
    return { status: 'error', error: 'missing_operation_ids' };
  }

  const path = `/presentations/decks/${encodeURIComponent(deckId)}/agent-history/bulk-revert`;
  const body = { operationIds, confirm: true as const };
  const apiAny = Api as unknown as { post?: (url: string, body: unknown) => Promise<unknown> };

  if (typeof apiAny.post === 'function') {
    try {
      const res = await apiAny.post(path, body);
      const payload = isRecord(res) && 'data' in res ? (res as { data: unknown }).data : res;
      const data = normalizeBulkSuccess(payload, deckId);
      if (!data) return { status: 'error', error: 'invalid_response' };
      return { status: 'ok', data };
    } catch (err) {
      const code = isRecord(err) && typeof err.status === 'number' ? err.status : 0;
      const errPayload =
        isRecord(err) && 'data' in err ? (err as { data: unknown }).data : undefined;
      const errInfo = readBulkErrorPayload(errPayload);
      if (code === 401 || code === 403) {
        return { status: 'forbidden', error: errInfo.error || 'forbidden' };
      }
      if (code === 404) {
        return { status: 'not_found', error: errInfo.error || 'not_found' };
      }
      if (code === 409 || code === 422) {
        return {
          status: 'conflict',
          error: errInfo.error || 'conflict',
          reasons: errInfo.reasons,
          rejected: errInfo.rejected,
          missingIds: errInfo.missingIds,
        };
      }
      if (code >= 400 && code < 600) {
        return { status: 'error', error: errInfo.error || `http_${code}` };
      }
      return { status: 'unavailable', error: safeMessage(err) || 'network_error' };
    }
  }

  try {
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const errInfo = readBulkErrorPayload(json);
      if (res.status === 401 || res.status === 403) {
        return { status: 'forbidden', error: errInfo.error || 'forbidden' };
      }
      if (res.status === 404) {
        return { status: 'not_found', error: errInfo.error || 'not_found' };
      }
      if (res.status === 409 || res.status === 422) {
        return {
          status: 'conflict',
          error: errInfo.error || 'conflict',
          reasons: errInfo.reasons,
          rejected: errInfo.rejected,
          missingIds: errInfo.missingIds,
        };
      }
      return { status: 'error', error: errInfo.error || `http_${res.status}` };
    }
    const data = normalizeBulkSuccess(json, deckId);
    if (!data) return { status: 'error', error: 'invalid_response' };
    return { status: 'ok', data };
  } catch {
    return { status: 'unavailable', error: 'network_error' };
  }
}
