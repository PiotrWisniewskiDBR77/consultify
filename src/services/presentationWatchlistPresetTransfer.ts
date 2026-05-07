/**
 * presentationWatchlistPresetTransfer
 *
 * Pure-frontend transfer layer for Governance Watchlist filter presets.
 * Provides JSON export bundling and import validation/planning so the UI
 * can offer human-portable preset sharing without coupling to localStorage,
 * fetch, or any other side-effecting concern.
 *
 * Validation rules mirror the server-side `presentationWatchlistPresetService`
 * so a bundle that round-trips through this layer can be safely fed back to
 * `createWatchlistPreset` without surprise NAME_TOO_LONG / FILTERS_INVALID
 * rejections. The actual persistence is the UI's responsibility — this
 * module just produces inert plans.
 *
 * Hard guarantees:
 *   - `parseImportJson` and `planImport` NEVER throw. All failure modes
 *     surface as values in the result.
 *   - Bundles are hard-capped at 50 presets to keep import previews
 *     bounded and prevent accidental abuse via oversized files.
 *   - The bundle schema string is fixed to
 *     `consultify.watchlist.preset.bundle.v1` so future format changes
 *     can be detected and refused honestly.
 */

const BUNDLE_SCHEMA = 'consultify.watchlist.preset.bundle.v1';
const NAME_MAX_LEN = 60;
const LIMIT_MIN = 1;
const LIMIT_MAX = 200;
const MAX_PRESETS_PER_BUNDLE = 50;

const ALLOWED_SEVERITIES = new Set<WatchlistPresetExportSeverity>([
  'BLOCKED_P0',
  'BLOCKED_P1',
]);
const ALLOWED_CONFIDENTIALITY = new Set<WatchlistPresetExportConfidentiality>([
  'public',
  'internal',
  'confidential',
]);

export type WatchlistPresetExportSeverity = 'BLOCKED_P0' | 'BLOCKED_P1';
export type WatchlistPresetExportConfidentiality =
  | 'public'
  | 'internal'
  | 'confidential';

export interface WatchlistPresetExportFilters {
  onlyBlocked: boolean;
  limit: number;
  minSeverity?: WatchlistPresetExportSeverity;
  confidentiality?: WatchlistPresetExportConfidentiality[];
}

export interface WatchlistPresetExportRecord {
  name: string;
  description: string | null;
  filters: WatchlistPresetExportFilters;
  isDefault: boolean;
}

export interface WatchlistPresetExportBundle {
  schema: 'consultify.watchlist.preset.bundle.v1';
  exportedAt: string;
  count: number;
  presets: WatchlistPresetExportRecord[];
  meta?: {
    sourceOrgIdHint?: string;
    note?: string;
  };
}

export interface ImportValidationResult {
  ok: boolean;
  bundle?: WatchlistPresetExportBundle;
  errors: string[];
  presetsCount: number;
}

export interface ImportPlanInput {
  bundle: WatchlistPresetExportBundle;
  existingNames: string[];
}

export interface ImportPlan {
  toCreate: WatchlistPresetExportRecord[];
  duplicates: { name: string; reason: 'name_exists' }[];
  invalid: { name: string; reason: string }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clampLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 50;
  const rounded = Math.round(value);
  if (rounded < LIMIT_MIN) return LIMIT_MIN;
  if (rounded > LIMIT_MAX) return LIMIT_MAX;
  return rounded;
}

function normalizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (collapsed.length === 0) return null;
  return collapsed.length > NAME_MAX_LEN
    ? collapsed.slice(0, NAME_MAX_LEN)
    : collapsed;
}

function normalizeDescription(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeFilters(raw: unknown): WatchlistPresetExportFilters {
  const r = isRecord(raw) ? raw : {};
  const out: WatchlistPresetExportFilters = {
    onlyBlocked: typeof r.onlyBlocked === 'boolean' ? r.onlyBlocked : true,
    limit: clampLimit(r.limit),
  };

  if (
    typeof r.minSeverity === 'string' &&
    ALLOWED_SEVERITIES.has(r.minSeverity as WatchlistPresetExportSeverity)
  ) {
    out.minSeverity = r.minSeverity as WatchlistPresetExportSeverity;
  }

  if (Array.isArray(r.confidentiality)) {
    const seen = new Set<WatchlistPresetExportConfidentiality>();
    for (const item of r.confidentiality) {
      if (
        typeof item === 'string' &&
        ALLOWED_CONFIDENTIALITY.has(item as WatchlistPresetExportConfidentiality)
      ) {
        seen.add(item as WatchlistPresetExportConfidentiality);
      }
    }
    if (seen.size > 0) out.confidentiality = Array.from(seen);
  }

  return out;
}

/**
 * Strict revalidation of a filters object for import. Unlike
 * `normalizeFilters` (which silently coerces defaults), this returns null
 * if the shape is wrong enough that we'd rather refuse the preset than
 * silently rewrite the user's intent.
 *
 * Invalid means: filters is not an object at all, `onlyBlocked` is present
 * but non-boolean, `limit` is present but not a finite number in 1..200,
 * or optional fields are present but malformed enough to imply a
 * hand-edited corrupt bundle.
 */
function strictValidateFilters(
  raw: unknown
): { ok: true; value: WatchlistPresetExportFilters } | { ok: false; reason: string } {
  if (!isRecord(raw)) return { ok: false, reason: 'filters_not_object' };

  if (
    'onlyBlocked' in raw &&
    typeof (raw as Record<string, unknown>).onlyBlocked !== 'boolean'
  ) {
    return { ok: false, reason: 'onlyBlocked_not_boolean' };
  }
  const onlyBlocked =
    typeof (raw as Record<string, unknown>).onlyBlocked === 'boolean'
      ? ((raw as Record<string, unknown>).onlyBlocked as boolean)
      : true;

  if (!('limit' in raw)) return { ok: false, reason: 'limit_missing' };
  const limitRaw = (raw as Record<string, unknown>).limit;
  if (typeof limitRaw !== 'number' || !Number.isFinite(limitRaw)) {
    return { ok: false, reason: 'limit_not_number' };
  }
  if (limitRaw < LIMIT_MIN || limitRaw > LIMIT_MAX) {
    return { ok: false, reason: 'limit_out_of_range' };
  }
  const limit = Math.round(limitRaw);

  const out: WatchlistPresetExportFilters = { onlyBlocked, limit };

  const minSeverityRaw = (raw as Record<string, unknown>).minSeverity;
  if (minSeverityRaw !== undefined && minSeverityRaw !== null) {
    if (
      typeof minSeverityRaw !== 'string' ||
      !ALLOWED_SEVERITIES.has(minSeverityRaw as WatchlistPresetExportSeverity)
    ) {
      return { ok: false, reason: 'minSeverity_invalid' };
    }
    out.minSeverity = minSeverityRaw as WatchlistPresetExportSeverity;
  }

  const confRaw = (raw as Record<string, unknown>).confidentiality;
  if (confRaw !== undefined && confRaw !== null) {
    if (!Array.isArray(confRaw)) {
      return { ok: false, reason: 'confidentiality_not_array' };
    }
    const seen = new Set<WatchlistPresetExportConfidentiality>();
    for (const item of confRaw) {
      if (
        typeof item !== 'string' ||
        !ALLOWED_CONFIDENTIALITY.has(item as WatchlistPresetExportConfidentiality)
      ) {
        return { ok: false, reason: 'confidentiality_invalid_value' };
      }
      seen.add(item as WatchlistPresetExportConfidentiality);
    }
    if (seen.size > 0) out.confidentiality = Array.from(seen);
  }

  return { ok: true, value: out };
}

export interface BuildExportBundleInput {
  presets: {
    name: string;
    description: string | null;
    filters: unknown;
    isDefault: boolean;
  }[];
  sourceOrgIdHint?: string;
  note?: string;
  nowIso?: string;
}

/**
 * Build a JSON-serializable export bundle from the live presets state.
 * Pre-filters silently: presets with empty trimmed names are dropped, and
 * each preset's filters are re-normalized (limit clamped, invalid
 * minSeverity stripped, confidentiality deduped). Callers that care about
 * which inputs were skipped should validate before calling this — the
 * bundle output represents the success path only.
 */
export function buildExportBundle(
  input: BuildExportBundleInput
): WatchlistPresetExportBundle {
  const records: WatchlistPresetExportRecord[] = [];
  for (const raw of input.presets) {
    const name = normalizeName(raw.name);
    if (!name) continue;
    records.push({
      name,
      description: normalizeDescription(raw.description),
      filters: normalizeFilters(raw.filters),
      isDefault: raw.isDefault === true,
    });
  }

  const meta: { sourceOrgIdHint?: string; note?: string } = {};
  if (typeof input.sourceOrgIdHint === 'string' && input.sourceOrgIdHint.length > 0) {
    meta.sourceOrgIdHint = input.sourceOrgIdHint;
  }
  if (typeof input.note === 'string' && input.note.length > 0) {
    meta.note = input.note;
  }

  const bundle: WatchlistPresetExportBundle = {
    schema: BUNDLE_SCHEMA,
    exportedAt:
      typeof input.nowIso === 'string' && input.nowIso.length > 0
        ? input.nowIso
        : new Date().toISOString(),
    count: records.length,
    presets: records,
  };
  if (Object.keys(meta).length > 0) bundle.meta = meta;
  return bundle;
}

export function bundleToJson(bundle: WatchlistPresetExportBundle): string {
  return JSON.stringify(bundle, null, 2);
}

/**
 * Parse a raw JSON string into a validated import bundle. Never throws —
 * any structural issue surfaces in `errors`. A bundle whose `presets`
 * array is empty after filtering is reported with `ok: false` so the UI
 * can refuse to show a confirm button.
 *
 * Hard cap of 50 presets: if the input has more, the first 50 valid ones
 * are kept and a warning is recorded. This keeps import previews bounded
 * regardless of how the bundle was produced.
 */
export function parseImportJson(raw: string): ImportValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return {
      ok: false,
      errors: [`JSON parse failed: ${msg}`],
      presetsCount: 0,
    };
  }

  if (!isRecord(parsed)) {
    return {
      ok: false,
      errors: ['Bundle must be a JSON object.'],
      presetsCount: 0,
    };
  }

  const schema = parsed.schema;
  if (schema !== BUNDLE_SCHEMA) {
    const actual = typeof schema === 'string' ? schema : '<missing>';
    return {
      ok: false,
      errors: [
        `Expected schema '${BUNDLE_SCHEMA}' but got '${actual}'`,
      ],
      presetsCount: 0,
    };
  }

  if (!('presets' in parsed) || !Array.isArray(parsed.presets)) {
    return {
      ok: false,
      errors: ['Bundle is missing a `presets` array.'],
      presetsCount: 0,
    };
  }

  const errors: string[] = [];
  const accepted: WatchlistPresetExportRecord[] = [];
  const rawPresets = parsed.presets as unknown[];

  if (rawPresets.length > MAX_PRESETS_PER_BUNDLE) {
    errors.push(
      `Bundle contains ${rawPresets.length} presets; only the first ${MAX_PRESETS_PER_BUNDLE} valid presets will be considered.`
    );
  }

  for (let idx = 0; idx < rawPresets.length; idx += 1) {
    if (accepted.length >= MAX_PRESETS_PER_BUNDLE) break;

    const candidate = rawPresets[idx];
    if (!isRecord(candidate)) {
      errors.push(`Preset at index ${idx} is not an object.`);
      continue;
    }

    const name = normalizeName(candidate.name);
    if (!name) {
      errors.push(
        `Preset at index ${idx} has a missing or empty name (max ${NAME_MAX_LEN} chars after trim).`
      );
      continue;
    }

    const filtersResult = strictValidateFilters(candidate.filters);
    if (!filtersResult.ok) {
      errors.push(
        `Preset '${name}' has invalid filters (${filtersResult.reason}).`
      );
      continue;
    }

    accepted.push({
      name,
      description: normalizeDescription(candidate.description),
      filters: filtersResult.value,
      isDefault: candidate.isDefault === true,
    });
  }

  const meta = isRecord(parsed.meta)
    ? {
        ...(typeof parsed.meta.sourceOrgIdHint === 'string'
          ? { sourceOrgIdHint: parsed.meta.sourceOrgIdHint }
          : {}),
        ...(typeof parsed.meta.note === 'string' ? { note: parsed.meta.note } : {}),
      }
    : undefined;

  const exportedAt =
    typeof parsed.exportedAt === 'string' && parsed.exportedAt.length > 0
      ? parsed.exportedAt
      : new Date(0).toISOString();

  const bundle: WatchlistPresetExportBundle = {
    schema: BUNDLE_SCHEMA,
    exportedAt,
    count: accepted.length,
    presets: accepted,
    ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
  };

  return {
    ok: accepted.length > 0,
    bundle,
    errors,
    presetsCount: accepted.length,
  };
}

/**
 * Build an import plan by partitioning the bundle's presets into
 * to-create / duplicates / invalid buckets. `existingNames` is expected
 * to be normalized (lowercase, trimmed) by the caller; this function
 * lower-cases the bundle preset names before comparing so call sites can
 * keep their bookkeeping simple.
 *
 * Order of `bundle.presets` is preserved across the output buckets so
 * the UI can render a stable preview list.
 */
export function planImport(input: ImportPlanInput): ImportPlan {
  const existing = new Set(input.existingNames || []);
  const toCreate: WatchlistPresetExportRecord[] = [];
  const duplicates: { name: string; reason: 'name_exists' }[] = [];
  const invalid: { name: string; reason: string }[] = [];

  const bundle = input.bundle;
  if (!bundle || !Array.isArray(bundle.presets)) {
    return { toCreate, duplicates, invalid };
  }

  for (const preset of bundle.presets) {
    const filtersResult = strictValidateFilters(preset.filters);
    if (!filtersResult.ok) {
      invalid.push({ name: preset.name, reason: filtersResult.reason });
      continue;
    }
    const lower = preset.name.trim().toLowerCase();
    if (existing.has(lower)) {
      duplicates.push({ name: preset.name, reason: 'name_exists' });
      continue;
    }
    toCreate.push({ ...preset, filters: filtersResult.value });
  }

  return { toCreate, duplicates, invalid };
}

export const __internals = {
  BUNDLE_SCHEMA,
  MAX_PRESETS_PER_BUNDLE,
  NAME_MAX_LEN,
};
