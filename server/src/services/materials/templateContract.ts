/**
 * Materials — Template Library contract (R11 doc slice).
 *
 * Locked vocabulary + pure normalizers shared by the two sides of the slice:
 *   - `services/v8/artifactRegistryService.ts` — the Template Library INDEX
 *     adapter (writes `originSummary.template`, detects orphaned links).
 *   - `services/materials/creationIntent.ts` — the server-side RESOLVER.
 *
 * This module is deliberately dependency-free (no DB, no Document Studio) so
 * the index adapter can consume the contract without dragging the Document
 * Studio module graph — and so both sides normalize identically.
 *
 * ★ Field names below are consumed by the frontend. Do not rename.
 */

/** Visibility level of a template. `'unknown'` when the registry carries no signal. */
export type TemplateScope = 'system' | 'organization' | 'personal' | 'unknown';

/** Lifecycle state of a template. `'unknown'` when the registry carries no signal. */
export type TemplateStatus = 'approved' | 'published' | 'draft' | 'deprecated' | 'unknown';

/** Canonical registry a template origin link points at. */
export type TemplateOriginRuntime =
  | 'document_template'
  | 'report_template'
  | 'presentation_template'
  | 'sheet_template';

/** `'canonical'` = current registry; `'legacy'` = pre-canonical registry kept for compat. */
export type TemplateSource = 'canonical' | 'legacy';

/**
 * Shape carried under `originSummary.template` for every template artifact.
 * The frontend reads exactly these keys.
 */
export interface TemplateOriginSummaryFields {
  canonicalTemplateId: string;
  originRuntime: TemplateOriginRuntime;
  source: TemplateSource;
  legacy: boolean;
  orphaned: boolean;
  scope: TemplateScope;
  status: TemplateStatus;
}

/**
 * Sentinel organization id under which seeded system Document Studio templates
 * live. Mirrors `documentStudio/documentTemplateRegistryDao.SYSTEM_ORG_ID`;
 * duplicated here only to keep this module dependency-free.
 */
export const SYSTEM_TEMPLATE_ORG_ID = '__system__';

export const TEMPLATE_ORIGIN_RUNTIMES: readonly TemplateOriginRuntime[] = [
  'document_template',
  'report_template',
  'presentation_template',
  'sheet_template',
];

/** Runtimes that can be resolved into a DOCUMENT blueprint (this slice). */
export const DOCUMENT_ORIGIN_RUNTIMES: readonly TemplateOriginRuntime[] = [
  'document_template',
  'report_template',
];

/**
 * Runtimes that can be resolved into a PRESENTATION (deck) blueprint (R11 deck
 * slice, 2026-07-26). Mirrors `DOCUMENT_ORIGIN_RUNTIMES` above — kept as its
 * own list rather than folded in so a runtime can only ever resolve into the
 * one format its registry actually produces.
 */
export const PRESENTATION_ORIGIN_RUNTIMES: readonly TemplateOriginRuntime[] = [
  'presentation_template',
];

export function isTemplateOriginRuntime(value: unknown): value is TemplateOriginRuntime {
  return TEMPLATE_ORIGIN_RUNTIMES.includes(value as TemplateOriginRuntime);
}

/**
 * `report_template` is the pre-canonical registry kept for backwards
 * compatibility. Document, presentation and workbook/sheet Studio templates
 * are canonical artifact-native registries.
 */
export function templateSourceForRuntime(runtime: TemplateOriginRuntime): TemplateSource {
  return runtime === 'report_template' ? 'legacy' : 'canonical';
}

/**
 * Map whatever the registry stores onto the locked scope vocabulary. The
 * historical `'app'` / `'application'` spellings mean system scope and are
 * normalized — they are NEVER emitted. Anything unrecognised is `'unknown'`
 * rather than a made-up default.
 */
export function normalizeTemplateScope(raw: unknown): TemplateScope {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!value) return 'unknown';
  if (value === 'system' || value === 'app' || value === 'application' || value === 'global') {
    return 'system';
  }
  if (value === 'organization' || value === 'org' || value === 'tenant') return 'organization';
  if (value === 'personal' || value === 'private' || value === 'user' || value === 'own') {
    return 'personal';
  }
  return 'unknown';
}

export function normalizeTemplateStatus(raw: unknown): TemplateStatus {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!value) return 'unknown';
  if (value === 'approved') return 'approved';
  if (value === 'published' || value === 'active') return 'published';
  if (value === 'draft') return 'draft';
  if (value === 'deprecated' || value === 'archived' || value === 'retired') return 'deprecated';
  return 'unknown';
}

/** Postgres returns booleans, SQLite returns 0/1, seeds sometimes return strings. */
export function toBool(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = String(value).trim().toLowerCase();
  if (text === 'true' || text === 't' || text === '1' || text === 'yes') return true;
  if (text === 'false' || text === 'f' || text === '0' || text === 'no') return false;
  return null;
}

/**
 * Derive the REAL scope from the columns the canonical registries actually
 * carry. No masking: when nothing in the row says anything, the answer is
 * `'unknown'`.
 *
 * `'personal'` is only produced when the row carries an explicit visibility
 * value (migration 918 `visibility` column) — none of the three registries has
 * per-user template ownership today.
 */
export function deriveTemplateScope(row: {
  is_system?: unknown;
  organization_id?: unknown;
  visibility?: unknown;
}): TemplateScope {
  const explicit = normalizeTemplateScope(row.visibility);
  if (explicit !== 'unknown') return explicit;

  if (toBool(row.is_system) === true) return 'system';

  const orgId = typeof row.organization_id === 'string' ? row.organization_id.trim() : '';
  if (orgId === SYSTEM_TEMPLATE_ORG_ID) return 'system';
  if (orgId) return 'organization';

  // `report_builder_templates.organization_id IS NULL` + `is_system` absent →
  // genuinely no signal.
  return 'unknown';
}
