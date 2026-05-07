/**
 * presentationWatchlistSavedSearches
 *
 * Read/write client for per-org persisted ad-hoc text searches used by
 * the SuperAdmin "Governance Watchlist" surface (Sprint 12). Wraps:
 *   GET    /api/presentations/governance/watchlist/saved-searches
 *   POST   /api/presentations/governance/watchlist/saved-searches
 *   DELETE /api/presentations/governance/watchlist/saved-searches/:id
 *   POST   /api/presentations/governance/watchlist/saved-searches/:id/mark-used
 *
 * Mirrors the Api/fetch fallback pattern of `presentationWatchlistPresets`.
 * Always resolves with a `{ status, ... }` envelope so the view can
 * surface honest forbidden / unavailable / conflict / migration banners
 * without crashing.
 */

import { Api } from '@/services/api';

export type SavedSearchVerdict =
  | 'PASS'
  | 'PASS_WITH_P2'
  | 'BLOCKED_P1'
  | 'BLOCKED_P0'
  | 'INCONCLUSIVE';

export type SavedSearchConfidentiality =
  | 'PUBLIC'
  | 'INTERNAL'
  | 'CONFIDENTIAL'
  | 'RESTRICTED';

export interface ClientSavedSearchFilters {
  verdicts?: SavedSearchVerdict[];
  confidentiality?: SavedSearchConfidentiality[];
  minSeverityScore?: number;
  limit?: number;
}

export interface ClientSavedSearchRecord {
  id: string;
  organizationId: string;
  name: string;
  queryText: string;
  filters: ClientSavedSearchFilters;
  createdAt: string;
  lastUsedAt: string | null;
  useCount: number;
  isDefault: boolean;
  createdBy: string | null;
}

export type SavedSearchFetchStatus =
  | 'ok'
  | 'error'
  | 'forbidden'
  | 'unavailable';

export interface FetchSavedSearchesResult {
  status: SavedSearchFetchStatus;
  records?: ClientSavedSearchRecord[];
  error?: string;
}

export type CreateSavedSearchStatus =
  | 'ok'
  | 'name_conflict'
  | 'invalid'
  | 'storage_error'
  | 'forbidden'
  | 'unavailable';

export interface CreateSavedSearchInput {
  name: string;
  queryText: string;
  filters: {
    verdicts?: string[];
    confidentiality?: string[];
    minSeverityScore?: number;
    limit?: number;
  };
  isDefault?: boolean;
}

export interface CreateSavedSearchResult {
  status: CreateSavedSearchStatus;
  record?: ClientSavedSearchRecord;
  errors?: string[];
  error?: string;
}

export type DeleteSavedSearchStatus =
  | 'ok'
  | 'not_found'
  | 'forbidden'
  | 'unavailable';

export interface DeleteSavedSearchResult {
  status: DeleteSavedSearchStatus;
  error?: string;
}

export interface MarkSavedSearchUsedResult {
  status: 'ok' | 'unavailable';
}

const ALLOWED_VERDICTS = new Set<SavedSearchVerdict>([
  'PASS',
  'PASS_WITH_P2',
  'BLOCKED_P1',
  'BLOCKED_P0',
  'INCONCLUSIVE',
]);
const ALLOWED_CONFIDENTIALITY = new Set<SavedSearchConfidentiality>([
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.length > 0 ? value : null;
}

function asNumberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeFilters(raw: unknown): ClientSavedSearchFilters {
  const r = isRecord(raw) ? raw : {};
  const out: ClientSavedSearchFilters = {};

  if (Array.isArray(r.verdicts)) {
    const seen = new Set<SavedSearchVerdict>();
    for (const item of r.verdicts) {
      if (typeof item === 'string' && ALLOWED_VERDICTS.has(item as SavedSearchVerdict)) {
        seen.add(item as SavedSearchVerdict);
      }
    }
    if (seen.size > 0) out.verdicts = Array.from(seen);
  }

  if (Array.isArray(r.confidentiality)) {
    const seen = new Set<SavedSearchConfidentiality>();
    for (const item of r.confidentiality) {
      if (
        typeof item === 'string' &&
        ALLOWED_CONFIDENTIALITY.has(item as SavedSearchConfidentiality)
      ) {
        seen.add(item as SavedSearchConfidentiality);
      }
    }
    if (seen.size > 0) out.confidentiality = Array.from(seen);
  }

  const limit = asNumberOrUndefined(r.limit);
  if (limit !== undefined) out.limit = limit;
  const minSeverity = asNumberOrUndefined(r.minSeverityScore);
  if (minSeverity !== undefined) out.minSeverityScore = minSeverity;

  return out;
}

function normalizeRecord(raw: unknown): ClientSavedSearchRecord | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  const useCountRaw =
    typeof raw.useCount === 'number'
      ? raw.useCount
      : Number(raw.useCount ?? 0) || 0;
  return {
    id,
    organizationId: asString(raw.organizationId),
    name: asString(raw.name, 'Untitled search'),
    queryText: asString(raw.queryText, ''),
    filters: normalizeFilters(raw.filters),
    createdAt: asString(raw.createdAt, new Date().toISOString()),
    lastUsedAt: asStringOrNull(raw.lastUsedAt),
    useCount: useCountRaw,
    isDefault: raw.isDefault === true,
    createdBy: asStringOrNull(raw.createdBy),
  };
}

function statusFromHttp(code: number): SavedSearchFetchStatus {
  if (code === 403) return 'forbidden';
  if (code === 503 || code === 502 || code === 504) return 'unavailable';
  return 'error';
}

function statusFromError(err: unknown): SavedSearchFetchStatus {
  if (isRecord(err) && typeof err.status === 'number') {
    return statusFromHttp(err.status);
  }
  return 'unavailable';
}

function createStatusFromError(err: unknown): CreateSavedSearchStatus {
  const status = statusFromError(err);
  return status === 'error' ? 'unavailable' : status;
}

function deleteStatusFromError(err: unknown): DeleteSavedSearchStatus {
  const status = statusFromError(err);
  return status === 'error' ? 'unavailable' : status;
}

function safeMessage(err: unknown): string | undefined {
  if (isRecord(err) && typeof err.message === 'string') return err.message;
  return undefined;
}

function unwrapData(payload: unknown): unknown {
  if (isRecord(payload) && 'data' in payload) {
    const inner = (payload as { data: unknown }).data;
    if (isRecord(inner) && 'data' in inner) {
      return (inner as { data: unknown }).data;
    }
    return inner;
  }
  return payload;
}

function getApiClient(): {
  get?: (url: string) => Promise<unknown>;
  post?: (url: string, data: unknown) => Promise<unknown>;
  delete?: (url: string) => Promise<unknown>;
} {
  return Api as unknown as {
    get?: (url: string) => Promise<unknown>;
    post?: (url: string, data: unknown) => Promise<unknown>;
    delete?: (url: string) => Promise<unknown>;
  };
}

const BASE_PATH = '/presentations/governance/watchlist/saved-searches';

export async function fetchSavedSearches(): Promise<FetchSavedSearchesResult> {
  const api = getApiClient();

  if (typeof api.get === 'function') {
    try {
      const res = await api.get(BASE_PATH);
      const data = unwrapData(res);
      if (!isRecord(data)) {
        return { status: 'error', records: [], error: 'invalid_payload' };
      }
      const rawRecords = Array.isArray(data.savedSearches)
        ? data.savedSearches
        : Array.isArray(data.records)
          ? data.records
          : [];
      const records = rawRecords
        .map(normalizeRecord)
        .filter((r): r is ClientSavedSearchRecord => r !== null);
      return { status: 'ok', records };
    } catch (err) {
      return {
        status: statusFromError(err),
        records: [],
        error: safeMessage(err),
      };
    }
  }

  try {
    const res = await fetch(`/api${BASE_PATH}`, { credentials: 'include' });
    if (!res.ok) {
      return {
        status: statusFromHttp(res.status),
        records: [],
        error: `http_${res.status}`,
      };
    }
    const json: unknown = await res.json().catch(() => null);
    const data = unwrapData(json);
    if (!isRecord(data)) {
      return { status: 'error', records: [], error: 'invalid_payload' };
    }
    const rawRecords = Array.isArray(data.savedSearches)
      ? data.savedSearches
      : Array.isArray(data.records)
        ? data.records
        : [];
    const records = rawRecords
      .map(normalizeRecord)
      .filter((r): r is ClientSavedSearchRecord => r !== null);
    return { status: 'ok', records };
  } catch {
    return { status: 'unavailable', records: [], error: 'network_error' };
  }
}

export async function createSavedSearch(
  input: CreateSavedSearchInput
): Promise<CreateSavedSearchResult> {
  const body = {
    name: input.name,
    queryText: input.queryText,
    filters: input.filters,
    isDefault: input.isDefault === true,
  };
  const api = getApiClient();

  if (typeof api.post === 'function') {
    try {
      const res = await api.post(BASE_PATH, body);
      const data = unwrapData(res);
      if (!isRecord(data)) {
        return { status: 'invalid', error: 'invalid_payload' };
      }
      const record = normalizeRecord(data.savedSearch ?? data.record);
      return { status: 'ok', ...(record ? { record } : {}) };
    } catch (err) {
      if (isRecord(err) && typeof err.status === 'number') {
        if (err.status === 409) {
          return { status: 'name_conflict', error: 'name_taken' };
        }
        if (err.status === 400) {
          const errors = isRecord(err.data) && Array.isArray(err.data.errors)
            ? err.data.errors.filter((e: unknown): e is string => typeof e === 'string')
            : undefined;
          return {
            status: 'invalid',
            error: safeMessage(err) || 'invalid',
            ...(errors && errors.length > 0 ? { errors } : {}),
          };
        }
        if (err.status === 503) {
          return { status: 'storage_error', error: 'storage_error' };
        }
      }
      return { status: createStatusFromError(err), error: safeMessage(err) };
    }
  }

  try {
    const res = await fetch(`/api${BASE_PATH}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      if (res.status === 409) return { status: 'name_conflict', error: 'name_taken' };
      if (res.status === 400) {
        let errors: string[] | undefined;
        try {
          const json = await res.json();
          if (isRecord(json) && Array.isArray(json.errors)) {
            errors = json.errors.filter((e: unknown): e is string => typeof e === 'string');
          }
        } catch {
          // best-effort body parse
        }
        return { status: 'invalid', error: 'invalid', ...(errors ? { errors } : {}) };
      }
      if (res.status === 503) return { status: 'storage_error', error: 'storage_error' };
      return { status: createStatusFromError({ status: res.status }), error: `http_${res.status}` };
    }
    const json: unknown = await res.json().catch(() => null);
    const data = unwrapData(json);
    if (!isRecord(data)) return { status: 'invalid', error: 'invalid_payload' };
    const record = normalizeRecord(data.savedSearch ?? data.record);
    return { status: 'ok', ...(record ? { record } : {}) };
  } catch {
    return { status: 'unavailable', error: 'network_error' };
  }
}

export async function deleteSavedSearch(
  id: string
): Promise<DeleteSavedSearchResult> {
  const safeId = encodeURIComponent(String(id || '').trim());
  if (!safeId) return { status: 'unavailable', error: 'id_required' };
  const path = `${BASE_PATH}/${safeId}`;
  const api = getApiClient();

  if (typeof api.delete === 'function') {
    try {
      await api.delete(path);
      return { status: 'ok' };
    } catch (err) {
      if (isRecord(err) && err.status === 404) {
        return { status: 'not_found' };
      }
      return { status: deleteStatusFromError(err), error: safeMessage(err) };
    }
  }

  try {
    const res = await fetch(`/api${path}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      if (res.status === 404) return { status: 'not_found' };
      const status = statusFromHttp(res.status);
      return { status: status === 'error' ? 'unavailable' : status, error: `http_${res.status}` };
    }
    return { status: 'ok' };
  } catch {
    return { status: 'unavailable', error: 'network_error' };
  }
}

export async function markSavedSearchUsed(
  id: string
): Promise<MarkSavedSearchUsedResult> {
  const safeId = encodeURIComponent(String(id || '').trim());
  if (!safeId) return { status: 'unavailable' };
  const path = `${BASE_PATH}/${safeId}/mark-used`;
  const api = getApiClient();

  if (typeof api.post === 'function') {
    try {
      await api.post(path, {});
      return { status: 'ok' };
    } catch {
      return { status: 'unavailable' };
    }
  }

  try {
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    return { status: res.ok ? 'ok' : 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}
