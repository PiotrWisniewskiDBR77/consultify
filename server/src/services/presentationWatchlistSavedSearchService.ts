/**
 * Presentation Watchlist Saved Search Service (Sprint 12)
 *
 * Per-org persisted ad-hoc text searches for the SuperAdmin "Governance
 * Watchlist" surface. Analog to Sprint 10 watchlist presets, but tuned for
 * free-text deck-title queries combined with verdict / confidentiality
 * filters. The pure validation/normalization core is DB-free so it stays
 * unit-test friendly and is reused by both the route layer (for storage
 * validation) and the matcher used by the watchlist filter pipeline /
 * frontend highlighter (so server and client stay in lockstep).
 *
 * Storage rules:
 *   - Saved searches are scoped per `organization_id` and never leak.
 *   - The watchlist GET endpoint stays preset/saved-search-agnostic; the
 *     client decides which saved search is active.
 *   - DB helpers degrade honestly when the migration has not run yet —
 *     they return `storage_error` with `migration_pending` instead of
 *     throwing so the UI can show an honest banner.
 */

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SavedSearchVerdict =
  | 'PASS'
  | 'PASS_WITH_P2'
  | 'BLOCKED_P1'
  | 'BLOCKED_P0'
  | 'INCONCLUSIVE';

export type SavedSearchConfidentiality = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export interface SavedSearchFilters {
  verdicts?: SavedSearchVerdict[];
  confidentiality?: SavedSearchConfidentiality[];
  minSeverityScore?: number;
  limit?: number;
}

export interface SavedSearchInput {
  name: string;
  queryText: string;
  filters: SavedSearchFilters;
  isDefault?: boolean;
}

export interface SavedSearchRecord {
  id: string;
  organizationId: string;
  name: string;
  queryText: string;
  filters: SavedSearchFilters;
  createdAt: string;
  lastUsedAt: string | null;
  useCount: number;
  isDefault: boolean;
  createdBy: string | null;
}

export interface ValidateInputResult {
  ok: boolean;
  normalized?: {
    name: string;
    queryText: string;
    filters: SavedSearchFilters;
    isDefault: boolean;
  };
  errors: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAME_MAX_LEN = 60;
const QUERY_MAX_LEN = 120;
const LIMIT_MIN = 1;
const LIMIT_MAX = 200;
const LIMIT_DEFAULT = 50;
const SEVERITY_MIN = 0;
const SEVERITY_MAX = 1000;
const SEVERITY_DEFAULT = 0;

const ALLOWED_VERDICTS: ReadonlySet<SavedSearchVerdict> = new Set([
  'PASS',
  'PASS_WITH_P2',
  'BLOCKED_P1',
  'BLOCKED_P0',
  'INCONCLUSIVE',
]);

const ALLOWED_CONFIDENTIALITY: ReadonlySet<SavedSearchConfidentiality> = new Set([
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED',
]);

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Trim + collapse internal whitespace, truncate to NAME_MAX_LEN. Empty after
 * trim is considered invalid by the validation layer; here we just emit a
 * warning when truncation happens so the caller can surface it.
 */
export function normalizeSavedSearchName(raw: unknown): { name: string; warnings: string[] } {
  const warnings: string[] = [];
  if (typeof raw !== 'string') return { name: '', warnings };
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (collapsed.length > NAME_MAX_LEN) {
    warnings.push('name_truncated');
    return { name: collapsed.slice(0, NAME_MAX_LEN), warnings };
  }
  return { name: collapsed, warnings };
}

/**
 * Trim and truncate to QUERY_MAX_LEN. Empty after trim is allowed
 * (filter-only saved search). Internal whitespace is preserved verbatim
 * because users typing multi-word queries expect their spacing to round-trip.
 */
export function normalizeSavedSearchQueryText(raw: unknown): {
  queryText: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  if (typeof raw !== 'string') return { queryText: '', warnings };
  const trimmed = raw.trim();
  if (trimmed.length > QUERY_MAX_LEN) {
    warnings.push('query_truncated');
    return { queryText: trimmed.slice(0, QUERY_MAX_LEN), warnings };
  }
  return { queryText: trimmed, warnings };
}

function clampLimit(value: unknown, warnings: string[]): number {
  if (value === undefined || value === null) return LIMIT_DEFAULT;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    warnings.push('limit_invalid_default_50');
    return LIMIT_DEFAULT;
  }
  const rounded = Math.round(value);
  if (rounded < LIMIT_MIN) {
    warnings.push('limit_clamped_min');
    return LIMIT_MIN;
  }
  if (rounded > LIMIT_MAX) {
    warnings.push('limit_clamped_max');
    return LIMIT_MAX;
  }
  return rounded;
}

function clampSeverity(value: unknown, warnings: string[]): number {
  if (value === undefined || value === null) return SEVERITY_DEFAULT;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    warnings.push('severity_invalid_default_0');
    return SEVERITY_DEFAULT;
  }
  if (value < SEVERITY_MIN) {
    warnings.push('severity_clamped_min');
    return SEVERITY_MIN;
  }
  if (value > SEVERITY_MAX) {
    warnings.push('severity_clamped_max');
    return SEVERITY_MAX;
  }
  return value;
}

function dedupeAllowList<T extends string>(
  raw: unknown,
  allow: ReadonlySet<T>,
  warnings: string[],
  warnDropped: string
): T[] | undefined {
  if (!Array.isArray(raw)) {
    if (raw !== undefined && raw !== null) {
      warnings.push(warnDropped);
    }
    return undefined;
  }
  const seen = new Set<T>();
  let dropped = 0;
  for (const item of raw) {
    if (typeof item === 'string' && allow.has(item as T)) {
      seen.add(item as T);
    } else {
      dropped += 1;
    }
  }
  if (dropped > 0) warnings.push(warnDropped);
  return seen.size > 0 ? Array.from(seen) : undefined;
}

/**
 * Coerce arbitrary input into a `SavedSearchFilters`. Unknown / invalid
 * values fall back to honest defaults (limit=50, minSeverityScore=0) and
 * unknown enum values are dropped with a `dropped_*` warning so the caller
 * can surface a hint to the user. Never throws.
 */
export function normalizeSavedSearchFilters(raw: unknown): {
  filters: SavedSearchFilters;
  warnings: string[];
} {
  const warnings: string[] = [];
  const r = isRecord(raw) ? raw : {};

  const out: SavedSearchFilters = {
    limit: clampLimit(r.limit, warnings),
    minSeverityScore: clampSeverity(r.minSeverityScore, warnings),
  };

  const verdicts = dedupeAllowList<SavedSearchVerdict>(
    r.verdicts,
    ALLOWED_VERDICTS,
    warnings,
    'dropped_unknown_verdict'
  );
  if (verdicts) out.verdicts = verdicts;

  const confidentiality = dedupeAllowList<SavedSearchConfidentiality>(
    r.confidentiality,
    ALLOWED_CONFIDENTIALITY,
    warnings,
    'dropped_unknown_confidentiality'
  );
  if (confidentiality) out.confidentiality = confidentiality;

  return { filters: out, warnings };
}

/**
 * Validate a create-saved-search payload. Tagged result so the route layer
 * can map errors to HTTP 400 without try/catch noise. Errors and warnings
 * are kept separate: errors block the create, warnings (truncation, dropped
 * enum values, clamp) still allow the create to proceed.
 */
export function validateSavedSearchCreateInput(raw: unknown): ValidateInputResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(raw)) {
    return { ok: false, errors: ['INVALID_PAYLOAD'], warnings };
  }

  const nameInput = raw.name;
  if (typeof nameInput !== 'string') {
    errors.push('NAME_REQUIRED');
  } else {
    const collapsedRaw = nameInput.replace(/\s+/g, ' ').trim();
    if (collapsedRaw.length === 0) errors.push('NAME_REQUIRED');
  }
  const { name, warnings: nameWarnings } = normalizeSavedSearchName(nameInput);
  warnings.push(...nameWarnings);

  const { queryText, warnings: queryWarnings } = normalizeSavedSearchQueryText(raw.queryText);
  warnings.push(...queryWarnings);

  // Filters are optional — an empty object is valid (defaults applied).
  const filtersRaw = raw.filters === undefined || raw.filters === null ? {} : raw.filters;
  const { filters, warnings: filterWarnings } = normalizeSavedSearchFilters(filtersRaw);
  warnings.push(...filterWarnings);

  const isDefault = raw.isDefault === true;

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }

  return {
    ok: true,
    normalized: { name, queryText, filters, isDefault },
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Pure matcher
// ---------------------------------------------------------------------------

/**
 * Pure matcher used by both the watchlist filter pipeline and the frontend
 * highlighter. Empty `queryText` matches any deck title. Verdict /
 * confidentiality filters short-circuit when their array is empty (no
 * filtering). `severityScore >= minSeverityScore` always applies.
 *
 * Confidentiality compare is case-insensitive so the saved-search enum
 * (`PUBLIC | INTERNAL | ...`) can match a `WatchlistEntry.confidentiality`
 * value that comes through as lowercase from the deck row.
 */
export function matchesSavedSearch(
  entry: {
    deckTitle: string;
    verdict: string;
    confidentiality: string;
    severityScore: number;
  },
  input: { queryText: string; filters: SavedSearchFilters }
): boolean {
  const haystack = String(entry?.deckTitle ?? '').toLocaleLowerCase();
  const needle = String(input?.queryText ?? '')
    .trim()
    .toLocaleLowerCase();
  if (needle.length > 0 && !haystack.includes(needle)) return false;

  const filters = input?.filters ?? {};

  if (Array.isArray(filters.verdicts) && filters.verdicts.length > 0) {
    const v = String(entry?.verdict ?? '');
    if (!filters.verdicts.includes(v as SavedSearchVerdict)) return false;
  }

  if (Array.isArray(filters.confidentiality) && filters.confidentiality.length > 0) {
    const c = String(entry?.confidentiality ?? '').toUpperCase();
    const allowed = filters.confidentiality.map((x) => String(x).toUpperCase());
    if (!allowed.includes(c)) return false;
  }

  const min = typeof filters.minSeverityScore === 'number' ? filters.minSeverityScore : 0;
  const score = typeof entry?.severityScore === 'number' ? entry.severityScore : 0;
  if (score < min) return false;

  return true;
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

const TABLE = 'presentation_watchlist_saved_searches';

function isSchemaMissingError(error: unknown): boolean {
  const msg = String((error as any)?.message || '').toLowerCase();
  return (
    msg.includes('does not exist') ||
    msg.includes('no such table') ||
    msg.includes('no such column') ||
    msg.includes('relation')
  );
}

function isUniqueViolation(error: unknown): boolean {
  const msg = String((error as any)?.message || '').toLowerCase();
  return (
    msg.includes('unique') ||
    msg.includes('duplicate') ||
    msg.includes('presentation_watchlist_saved_searches_organization_id_name')
  );
}

export type DbStatus = 'ok' | 'name_conflict' | 'invalid' | 'storage_error' | 'not_found';

export interface CreateSavedSearchResult {
  status: DbStatus;
  record?: SavedSearchRecord;
  errors?: string[];
  warnings?: string[];
  reason?: string;
}

export interface DeleteSavedSearchResult {
  status: 'ok' | 'not_found' | 'storage_error';
  reason?: string;
}

function rowToRecord(row: Record<string, any>): SavedSearchRecord {
  let filters: SavedSearchFilters;
  try {
    const raw = row.filters;
    const parsed = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw ?? {});
    filters = normalizeSavedSearchFilters(parsed).filters;
  } catch {
    filters = normalizeSavedSearchFilters({}).filters;
  }
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    name: String(row.name ?? ''),
    queryText: String(row.query_text ?? ''),
    filters,
    createdAt: row.created_at ? String(row.created_at) : new Date().toISOString(),
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
    useCount: typeof row.use_count === 'number' ? row.use_count : Number(row.use_count) || 0,
    isDefault: Boolean(row.is_default),
    createdBy: row.created_by ? String(row.created_by) : null,
  };
}

export async function listSavedSearches(orgId: string): Promise<{
  status: 'ok' | 'storage_error';
  records: SavedSearchRecord[];
  reason?: string;
}> {
  if (!orgId) return { status: 'ok', records: [] };
  try {
    const rows = (await dbAll(
      `SELECT id, organization_id, name, query_text, filters,
              created_by, created_at, last_used_at, use_count, is_default
         FROM ${TABLE}
        WHERE organization_id = ?
        ORDER BY is_default DESC, name ASC`,
      [orgId]
    )) as Array<Record<string, any>>;
    const records = (rows || []).map(rowToRecord);
    return { status: 'ok', records };
  } catch (error) {
    if (isSchemaMissingError(error)) {
      return { status: 'storage_error', records: [], reason: 'migration_pending' };
    }
    return { status: 'storage_error', records: [], reason: 'db_error' };
  }
}

export async function createSavedSearch(
  orgId: string,
  input: SavedSearchInput,
  userId?: string | null
): Promise<CreateSavedSearchResult> {
  if (!orgId) {
    return { status: 'invalid', errors: ['ORG_REQUIRED'] };
  }

  const validation = validateSavedSearchCreateInput(input);
  if (!validation.ok || !validation.normalized) {
    return {
      status: 'invalid',
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }
  const norm = validation.normalized;

  try {
    if (norm.isDefault) {
      // At most one default per org. Best-effort clear (don't fail the
      // insert if the partial index can't be created on a non-PG DB).
      try {
        await dbRun(
          `UPDATE ${TABLE} SET is_default = false
            WHERE organization_id = ? AND is_default = true`,
          [orgId]
        );
      } catch {
        // Ignore — INSERT below will surface the real error.
      }
    }

    const filtersJson = JSON.stringify(norm.filters);
    await dbRun(
      `INSERT INTO ${TABLE} (
         organization_id, name, query_text, filters, created_by, is_default
       ) VALUES (?, ?, ?, ?::jsonb, ?, ?)`,
      [orgId, norm.name, norm.queryText, filtersJson, userId ?? null, norm.isDefault]
    );

    const created = (await dbGet(
      `SELECT id, organization_id, name, query_text, filters,
              created_by, created_at, last_used_at, use_count, is_default
         FROM ${TABLE}
        WHERE organization_id = ? AND name = ?
        ORDER BY created_at DESC
        LIMIT 1`,
      [orgId, norm.name]
    )) as Record<string, any> | null;

    return {
      status: 'ok',
      record: created ? rowToRecord(created) : undefined,
      ...(validation.warnings.length > 0 ? { warnings: validation.warnings } : {}),
    };
  } catch (error) {
    if (isSchemaMissingError(error)) {
      return { status: 'storage_error', reason: 'migration_pending' };
    }
    if (isUniqueViolation(error)) {
      return { status: 'name_conflict', errors: ['NAME_TAKEN'] };
    }
    return { status: 'storage_error', reason: 'db_error' };
  }
}

export async function deleteSavedSearch(
  orgId: string,
  id: string
): Promise<DeleteSavedSearchResult> {
  const safeId = String(id || '').trim();
  if (!orgId || !safeId) {
    return { status: 'not_found' };
  }
  try {
    const existing = (await dbGet(`SELECT id FROM ${TABLE} WHERE id = ? AND organization_id = ?`, [
      safeId,
      orgId,
    ])) as { id: string } | null;
    if (!existing) return { status: 'not_found' };

    await dbRun(`DELETE FROM ${TABLE} WHERE id = ? AND organization_id = ?`, [safeId, orgId]);
    return { status: 'ok' };
  } catch (error) {
    if (isSchemaMissingError(error)) {
      return { status: 'storage_error', reason: 'migration_pending' };
    }
    return { status: 'storage_error', reason: 'db_error' };
  }
}

/**
 * Fire-and-forget bookkeeping. Bumps `use_count` and stamps `last_used_at`.
 * Never throws — best-effort.
 */
export async function markUsed(orgId: string, id: string): Promise<void> {
  const safeId = String(id || '').trim();
  if (!orgId || !safeId) return;
  try {
    await dbRun(
      `UPDATE ${TABLE}
          SET use_count = use_count + 1,
              last_used_at = now()
        WHERE id = ? AND organization_id = ?`,
      [safeId, orgId]
    );
  } catch {
    // Best-effort. Schema-missing or transient errors are silently swallowed.
  }
}
