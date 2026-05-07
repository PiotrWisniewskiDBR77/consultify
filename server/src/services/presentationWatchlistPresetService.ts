/**
 * Presentation Watchlist Preset Service
 *
 * Pure validation/normalization core for per-org saved filter presets used
 * by the SuperAdmin "Governance Watchlist" surface. This module is
 * intentionally DB-free so it stays unit-test friendly. The route layer is
 * responsible for persistence; this service just guarantees that the input
 * shape we hand to the DB is sane and that error codes are stable.
 *
 * The preset filters intentionally cover dimensions the watchlist GET
 * endpoint does NOT yet honor (minSeverity, confidentiality[]) — they are
 * stored for forward compatibility so the client can apply them client-side
 * once those filters land. The watchlist GET is never auto-coupled to a
 * preset; the client decides which preset is active.
 */
export type WatchlistPresetSeverity = 'BLOCKED_P0' | 'BLOCKED_P1';
export type WatchlistPresetConfidentiality = 'public' | 'internal' | 'confidential';

export interface WatchlistPresetFilters {
  onlyBlocked: boolean;
  limit: number;
  minSeverity?: WatchlistPresetSeverity;
  confidentiality?: WatchlistPresetConfidentiality[];
}

export interface WatchlistPreset {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  filters: WatchlistPresetFilters;
  isDefault: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WatchlistPresetCreateInput {
  name: string;
  description?: string | null;
  filters: WatchlistPresetFilters;
  isDefault?: boolean;
}

const NAME_MAX_LEN = 60;
const DESCRIPTION_MAX_LEN = 280;
const LIMIT_MIN = 1;
const LIMIT_MAX = 200;
const LIMIT_DEFAULT = 50;
const ALLOWED_SEVERITIES: ReadonlySet<WatchlistPresetSeverity> = new Set([
  'BLOCKED_P0',
  'BLOCKED_P1',
]);
const ALLOWED_CONFIDENTIALITY: ReadonlySet<WatchlistPresetConfidentiality> = new Set([
  'public',
  'internal',
  'confidential',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Trim, collapse internal whitespace, truncate to NAME_MAX_LEN. Throws
 * `Error('NAME_REQUIRED')` if empty after trim. Truncation is silent (we
 * report `NAME_TOO_LONG` only at the validation layer where we still have
 * the raw value).
 */
export function normalizePresetName(raw: string): string {
  if (typeof raw !== 'string') throw new Error('NAME_REQUIRED');
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (collapsed.length === 0) throw new Error('NAME_REQUIRED');
  return collapsed.length > NAME_MAX_LEN ? collapsed.slice(0, NAME_MAX_LEN) : collapsed;
}

function clampLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return LIMIT_DEFAULT;
  const rounded = Math.round(value);
  if (rounded < LIMIT_MIN) return LIMIT_MIN;
  if (rounded > LIMIT_MAX) return LIMIT_MAX;
  return rounded;
}

/**
 * Coerce arbitrary input into a `WatchlistPresetFilters`. Unknown / invalid
 * values fall back to honest defaults rather than throwing — `onlyBlocked`
 * defaults to `true`, `limit` defaults to 50, optional filters that do not
 * pass allow-list checks are stripped (never silently coerced to a wrong
 * value).
 */
export function normalizePresetFilters(raw: unknown): WatchlistPresetFilters {
  const r = isRecord(raw) ? raw : {};

  const onlyBlocked =
    typeof r.onlyBlocked === 'boolean' ? r.onlyBlocked : true;

  const limit = clampLimit(r.limit);

  const out: WatchlistPresetFilters = { onlyBlocked, limit };

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

/**
 * Validate a create-preset payload. Returns a tagged result instead of
 * throwing so the route layer can map errors to HTTP 400s without
 * try/catch noise.
 */
export function validatePresetCreateInput(
  raw: unknown
):
  | { ok: true; value: WatchlistPresetCreateInput }
  | { ok: false; error: string } {
  if (!isRecord(raw)) return { ok: false, error: 'FILTERS_INVALID' };

  // Name is mandatory and length-checked against the raw collapsed value so
  // the caller gets a clean NAME_TOO_LONG signal instead of silent truncation.
  if (typeof raw.name !== 'string') return { ok: false, error: 'NAME_REQUIRED' };
  const collapsedRaw = raw.name.replace(/\s+/g, ' ').trim();
  if (collapsedRaw.length === 0) return { ok: false, error: 'NAME_REQUIRED' };
  if (collapsedRaw.length > NAME_MAX_LEN) {
    return { ok: false, error: 'NAME_TOO_LONG' };
  }
  const name = collapsedRaw;

  let description: string | null = null;
  if (raw.description !== undefined && raw.description !== null) {
    if (typeof raw.description !== 'string') {
      return { ok: false, error: 'DESCRIPTION_TOO_LONG' };
    }
    if (raw.description.length > DESCRIPTION_MAX_LEN) {
      return { ok: false, error: 'DESCRIPTION_TOO_LONG' };
    }
    const trimmed = raw.description.trim();
    description = trimmed.length > 0 ? trimmed : null;
  }

  if (raw.filters === undefined || raw.filters === null) {
    return { ok: false, error: 'FILTERS_INVALID' };
  }
  if (!isRecord(raw.filters)) {
    return { ok: false, error: 'FILTERS_INVALID' };
  }
  const filters = normalizePresetFilters(raw.filters);

  const isDefault = raw.isDefault === true;

  return {
    ok: true,
    value: { name, description, filters, isDefault },
  };
}

/**
 * Locale-aware, case-insensitive name comparator. Used to give the UI a
 * stable, human-friendly preset list ordering without coupling to whatever
 * locale the DB happens to collate on.
 */
export function comparePresetsByName(
  a: { name: string },
  b: { name: string }
): number {
  const an = String(a?.name ?? '');
  const bn = String(b?.name ?? '');
  return an.localeCompare(bn, undefined, { sensitivity: 'base' });
}
