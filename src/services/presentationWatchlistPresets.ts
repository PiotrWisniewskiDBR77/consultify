/**
 * presentationWatchlistPresets
 *
 * Read/write client for the per-org saved filter presets used by the
 * SuperAdmin "Governance Watchlist" surface. Wraps:
 *   GET    /api/presentations/governance/watchlist-presets
 *   POST   /api/presentations/governance/watchlist-presets
 *   DELETE /api/presentations/governance/watchlist-presets/:id
 *
 * Mirrors the Api/fetch fallback pattern of `presentationGovernance*.ts`.
 * Always resolves with a `{ status, ... }` envelope so the view can surface
 * honest forbidden / unavailable / conflict banners without crashing.
 *
 * Server intentionally never auto-applies a preset to the watchlist GET; the
 * client decides which preset is active. We only deal in storage here.
 */

import { Api } from '@/services/api';

export type WatchlistPresetSeverity = 'BLOCKED_P0' | 'BLOCKED_P1';
export type WatchlistPresetConfidentiality = 'public' | 'internal' | 'confidential';

export interface WatchlistPresetFilters {
  onlyBlocked: boolean;
  limit: number;
  minSeverity?: WatchlistPresetSeverity;
  confidentiality?: WatchlistPresetConfidentiality[];
}

export interface ClientWatchlistPreset {
  id: string;
  name: string;
  description: string | null;
  filters: WatchlistPresetFilters;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type WatchlistPresetFetchStatus = 'ok' | 'error' | 'forbidden' | 'not_found' | 'unavailable';

export interface FetchPresetsResult {
  status: WatchlistPresetFetchStatus;
  presets: ClientWatchlistPreset[];
  warnings?: string[];
  error?: string;
}

export interface CreatePresetInput {
  name: string;
  description?: string;
  filters: WatchlistPresetFilters;
  isDefault?: boolean;
}

export interface CreatePresetResult {
  status: WatchlistPresetFetchStatus | 'conflict';
  preset?: ClientWatchlistPreset;
  warnings?: string[];
  error?: string;
}

export interface DeletePresetResult {
  status: WatchlistPresetFetchStatus;
  error?: string;
}

const ALLOWED_SEVERITIES = new Set<WatchlistPresetSeverity>(['BLOCKED_P0', 'BLOCKED_P1']);
const ALLOWED_CONFIDENTIALITY = new Set<WatchlistPresetConfidentiality>([
  'public',
  'internal',
  'confidential',
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

function clampLimit(value: unknown): number {
  const n = asNumber(value, 50);
  if (n < 1) return 1;
  if (n > 200) return 200;
  return Math.round(n);
}

function normalizeFilters(raw: unknown): WatchlistPresetFilters {
  const r = isRecord(raw) ? raw : {};
  const out: WatchlistPresetFilters = {
    onlyBlocked: typeof r.onlyBlocked === 'boolean' ? r.onlyBlocked : true,
    limit: clampLimit(r.limit),
  };
  if (
    typeof r.minSeverity === 'string' &&
    ALLOWED_SEVERITIES.has(r.minSeverity as WatchlistPresetSeverity)
  ) {
    out.minSeverity = r.minSeverity as WatchlistPresetSeverity;
  }
  if (Array.isArray(r.confidentiality)) {
    const seen = new Set<WatchlistPresetConfidentiality>();
    for (const item of r.confidentiality) {
      if (
        typeof item === 'string' &&
        ALLOWED_CONFIDENTIALITY.has(item as WatchlistPresetConfidentiality)
      ) {
        seen.add(item as WatchlistPresetConfidentiality);
      }
    }
    if (seen.size > 0) out.confidentiality = Array.from(seen);
  }
  return out;
}

function normalizePreset(raw: unknown): ClientWatchlistPreset | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  return {
    id,
    name: asString(raw.name, 'Untitled preset'),
    description: asStringOrNull(raw.description),
    filters: normalizeFilters(raw.filters),
    isDefault: raw.isDefault === true,
    createdAt: asString(raw.createdAt, new Date().toISOString()),
    updatedAt: asString(raw.updatedAt, new Date().toISOString()),
  };
}

function statusFromHttp(code: number): WatchlistPresetFetchStatus {
  if (code === 401) return 'error';
  if (code === 403) return 'forbidden';
  if (code === 404) return 'not_found';
  return 'error';
}

function statusFromError(err: unknown): WatchlistPresetFetchStatus {
  if (isRecord(err) && typeof err.status === 'number') {
    return statusFromHttp(err.status);
  }
  return 'unavailable';
}

function safeMessage(err: unknown): string | undefined {
  if (isRecord(err) && typeof err.message === 'string') return err.message;
  return undefined;
}

function unwrapData(payload: unknown): unknown {
  // Tolerate both axios-like `{ data: ... }` and our envelope `{ data: ... }`
  // by peeling at most twice.
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

export async function fetchWatchlistPresets(): Promise<FetchPresetsResult> {
  const path = '/presentations/governance/watchlist-presets';
  const api = getApiClient();

  if (typeof api.get === 'function') {
    try {
      const res = await api.get(path);
      const data = unwrapData(res);
      if (!isRecord(data)) {
        return { status: 'error', presets: [], error: 'invalid_payload' };
      }
      const rawPresets = Array.isArray(data.presets) ? data.presets : [];
      const presets = rawPresets
        .map(normalizePreset)
        .filter((p): p is ClientWatchlistPreset => p !== null);
      const warnings = Array.isArray(data.warnings)
        ? data.warnings.filter((w): w is string => typeof w === 'string')
        : undefined;
      return {
        status: 'ok',
        presets,
        ...(warnings && warnings.length > 0 ? { warnings } : {}),
      };
    } catch (err) {
      return { status: statusFromError(err), presets: [], error: safeMessage(err) };
    }
  }

  try {
    const res = await fetch(`/api${path}`, { credentials: 'include' });
    if (!res.ok) {
      return {
        status: statusFromHttp(res.status),
        presets: [],
        error: `http_${res.status}`,
      };
    }
    const json: unknown = await res.json().catch(() => null);
    const data = unwrapData(json);
    if (!isRecord(data)) {
      return { status: 'error', presets: [], error: 'invalid_payload' };
    }
    const rawPresets = Array.isArray(data.presets) ? data.presets : [];
    const presets = rawPresets
      .map(normalizePreset)
      .filter((p): p is ClientWatchlistPreset => p !== null);
    const warnings = Array.isArray(data.warnings)
      ? data.warnings.filter((w): w is string => typeof w === 'string')
      : undefined;
    return {
      status: 'ok',
      presets,
      ...(warnings && warnings.length > 0 ? { warnings } : {}),
    };
  } catch {
    return { status: 'unavailable', presets: [], error: 'network_error' };
  }
}

export async function createWatchlistPreset(input: CreatePresetInput): Promise<CreatePresetResult> {
  const path = '/presentations/governance/watchlist-presets';
  const body = {
    name: input.name,
    description: input.description,
    filters: input.filters,
    isDefault: input.isDefault === true,
  };
  const api = getApiClient();

  if (typeof api.post === 'function') {
    try {
      const res = await api.post(path, body);
      const data = unwrapData(res);
      if (!isRecord(data)) {
        return { status: 'error', error: 'invalid_payload' };
      }
      const preset = normalizePreset(data.preset);
      const warnings = Array.isArray(data.warnings)
        ? data.warnings.filter((w): w is string => typeof w === 'string')
        : undefined;
      return {
        status: 'ok',
        ...(preset ? { preset } : {}),
        ...(warnings && warnings.length > 0 ? { warnings } : {}),
      };
    } catch (err) {
      const status = statusFromError(err);
      // The Api wrapper surfaces 409 as a generic error; sniff the status
      // numeric so the UI can render an inline NAME_TAKEN message.
      if (isRecord(err) && err.status === 409) {
        return { status: 'conflict', error: safeMessage(err) || 'name_taken' };
      }
      return { status, error: safeMessage(err) };
    }
  }

  try {
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      if (res.status === 409) return { status: 'conflict', error: 'name_taken' };
      return { status: statusFromHttp(res.status), error: `http_${res.status}` };
    }
    const json: unknown = await res.json().catch(() => null);
    const data = unwrapData(json);
    if (!isRecord(data)) return { status: 'error', error: 'invalid_payload' };
    const preset = normalizePreset(data.preset);
    return { status: 'ok', ...(preset ? { preset } : {}) };
  } catch {
    return { status: 'unavailable', error: 'network_error' };
  }
}

export async function deleteWatchlistPreset(id: string): Promise<DeletePresetResult> {
  const safeId = encodeURIComponent(String(id || '').trim());
  if (!safeId) return { status: 'error', error: 'id_required' };
  const path = `/presentations/governance/watchlist-presets/${safeId}`;
  const api = getApiClient();

  if (typeof api.delete === 'function') {
    try {
      await api.delete(path);
      return { status: 'ok' };
    } catch (err) {
      return { status: statusFromError(err), error: safeMessage(err) };
    }
  }

  try {
    const res = await fetch(`/api${path}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      return { status: statusFromHttp(res.status), error: `http_${res.status}` };
    }
    return { status: 'ok' };
  } catch {
    return { status: 'unavailable', error: 'network_error' };
  }
}
