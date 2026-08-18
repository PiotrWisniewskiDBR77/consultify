/**
 * Materials — creation intent: SERVER-SIDE template resolution (R11 doc slice).
 *
 * A "create from template" intent arrives from the client as a `TemplateRef`.
 * The client is NOT trusted: it may name a Template Library card
 * (`kind: 'library'`, an artifact id) or a canonical registry record
 * (`kind: 'internal'`). Either way the server re-resolves the reference,
 * re-checks tenant access, and returns the blueprint FRESH from the canonical
 * registry — never from the artifact index snapshot, which is a projection and
 * can lag behind template edits.
 *
 * Scope of this slice: DOCUMENT formats only.
 *   - `document_template`  → `document_studio_templates` (canonical registry)
 *   - `report_template`    → `report_builder_templates`  (legacy registry)
 * Deck (`presentation_template`) and sheet (`sheet_template`) resolve to
 * `TEMPLATE_FORMAT_UNSUPPORTED` and are handled by their own slices.
 *
 * The blueprint for `document_template` is produced by REUSING the existing
 * Document Studio resolver (`documentTemplateService.getTemplate`, hydrated via
 * `ensureTemplateRegistryHydrated`). No second blueprint parser lives here.
 *
 * Read-only by construction: this module never writes, updates or deletes.
 */

import { get as dbGet } from '../../utils/DbPromise.js';
import { SYSTEM_ORG_ID } from '../documentStudio/documentTemplateRegistryDao.js';
import {
  ensureTemplateRegistryHydrated,
  getTemplate as getRegisteredTemplate,
} from '../documentStudio/documentTemplateService.js';
import type {
  TemplateOriginRuntime,
  TemplateScope,
  TemplateSource,
  TemplateStatus,
} from './templateContract.js';
import {
  deriveTemplateScope,
  DOCUMENT_ORIGIN_RUNTIMES,
  isTemplateOriginRuntime,
  normalizeTemplateStatus,
  PRESENTATION_ORIGIN_RUNTIMES,
  toBool,
} from './templateContract.js';

// The locked vocabulary lives in `templateContract.ts` (dependency-free so the
// Template Library index adapter can share it). Re-exported here because the
// resolver is the contract's primary consumer.
export type {
  TemplateOriginRuntime,
  TemplateScope,
  TemplateSource,
  TemplateStatus,
} from './templateContract.js';
export {
  deriveTemplateScope,
  DOCUMENT_ORIGIN_RUNTIMES,
  isTemplateOriginRuntime,
  normalizeTemplateScope,
  normalizeTemplateStatus,
  PRESENTATION_ORIGIN_RUNTIMES,
  TEMPLATE_ORIGIN_RUNTIMES,
  templateSourceForRuntime,
} from './templateContract.js';

// =============================================================================
// CONTRACT (locked — field names are consumed by the frontend)
// =============================================================================

/**
 * Disjoint union on purpose: a reference is EITHER a Template Library card
 * (artifact id, runtime unknown to the caller) OR a canonical registry record
 * (id + runtime, BOTH required). A loose object with two optional ids would let
 * an `internal` ref omit the runtime and silently resolve against the wrong
 * registry.
 */
export type TemplateRef =
  | { kind: 'library'; templateArtifactId: string }
  | { kind: 'internal'; canonicalTemplateId: string; originRuntime: TemplateOriginRuntime };

export interface ResolvedDocumentTemplate {
  originRuntime: TemplateOriginRuntime;
  canonicalTemplateId: string;
  format: 'document';
  scope: TemplateScope;
  status: TemplateStatus;
  source: TemplateSource;
  legacy: boolean;
  /** Fresh from the canonical registry — NOT from the artifact index snapshot. */
  sectionBlueprint: unknown[];
}

/**
 * R11 deck slice (2026-07-26) — presentation counterpart of
 * `ResolvedDocumentTemplate`. `name` is carried (unlike the document shape)
 * because the deck-from-template creation route needs a sensible default
 * deck title without a separate intake step — it is display metadata, not
 * part of the locked `TemplateOriginSummaryFields` contract.
 */
export interface ResolvedPresentationTemplate {
  originRuntime: 'presentation_template';
  canonicalTemplateId: string;
  format: 'presentation';
  name: string;
  scope: TemplateScope;
  status: TemplateStatus;
  source: TemplateSource;
  legacy: boolean;
  /** Fresh from `presentation_templates.outline_json` — NOT from the index snapshot. */
  outlineBlueprint: unknown[];
  /** Canonical visual identity selected by the Template Architect. */
  theme: string;
  /** Validated later by the presentation runtime; carried fresh from the registry. */
  customTemplate?: unknown;
}

export type TemplateResolveErrorCode =
  | 'TEMPLATE_NOT_INDEXED'
  | 'TEMPLATE_ORPHANED'
  | 'TEMPLATE_FORBIDDEN'
  | 'TEMPLATE_DEPRECATED'
  | 'TEMPLATE_FORMAT_UNSUPPORTED';

/**
 * Typed failure so the route/FE can map to an honest message instead of a
 * generic 500. `details` is diagnostic only — never surfaced verbatim.
 */
export class TemplateResolveError extends Error {
  readonly code: TemplateResolveErrorCode;
  readonly details: Record<string, unknown>;

  constructor(
    code: TemplateResolveErrorCode,
    message: string,
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'TemplateResolveError';
    this.code = code;
    this.details = details;
  }
}

export function isTemplateResolveError(err: unknown): err is TemplateResolveError {
  return err instanceof TemplateResolveError;
}

function parseJsonArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw === null || raw === undefined) return [];
  if (typeof raw === 'object') return [];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// =============================================================================
// ROW SHAPES (mirror the real columns — migrations 769 / 503)
// =============================================================================

interface OriginLinkProbeRow {
  origin_runtime: string | null;
  origin_record_id: string | null;
}

interface DocumentStudioTemplateProbeRow {
  template_id: string;
  organization_id: string | null;
  status: string | null;
  is_system: unknown;
  provenance_status: string | null;
}

interface ReportTemplateProbeRow {
  id: string;
  organization_id: string | null;
  is_system: unknown;
  is_active: unknown;
  is_public: unknown;
  sections_json: string | null;
  provenance_status: string | null;
}

interface PresentationTemplateProbeRow {
  id: string;
  organization_id: string | null;
  name: string | null;
  is_system: unknown;
  is_active: unknown;
  /** Migration 767 — CHECK (lifecycle_state IN ('draft','approved','deprecated')). */
  lifecycle_state: string | null;
  outline_json: string | null;
  theme: string | null;
  layout_policy_json: string | null;
  provenance_status: string | null;
}

function parseJsonObject(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (raw === null || raw === undefined) return null;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// =============================================================================
// RESOLVER
// =============================================================================

/**
 * Resolve a client-supplied template reference into a server-validated document
 * blueprint. Throws `TemplateResolveError` with a typed `code` on every
 * rejection path — never returns a partially trusted result.
 */
export async function resolveDocumentTemplateForCreation(
  ref: TemplateRef,
  ctx: { organizationId: string }
): Promise<ResolvedDocumentTemplate> {
  const organizationId = (ctx?.organizationId ?? '').trim();
  if (!organizationId) {
    throw new TemplateResolveError(
      'TEMPLATE_FORBIDDEN',
      'Template resolution requires an organization context'
    );
  }

  const { originRuntime, canonicalTemplateId } = await resolveReference(ref, organizationId);

  if (!DOCUMENT_ORIGIN_RUNTIMES.includes(originRuntime)) {
    throw new TemplateResolveError(
      'TEMPLATE_FORMAT_UNSUPPORTED',
      `Origin runtime ${originRuntime} does not produce a document`,
      { originRuntime, canonicalTemplateId }
    );
  }

  return originRuntime === 'document_template'
    ? resolveDocumentStudioTemplate(canonicalTemplateId, organizationId)
    : resolveLegacyReportTemplate(canonicalTemplateId, organizationId);
}

/**
 * Turn either ref shape into (runtime, canonical id). The `library` shape is
 * looked up in the artifact index; the `internal` shape is taken at face value
 * for the LOOKUP only — access is always re-validated downstream against the
 * canonical registry, never against the caller's claim.
 *
 * Module-private: both `resolveDocumentTemplateForCreation` and
 * `resolvePresentationTemplateForCreation` (R11 deck slice) live in this same
 * file and share this one lookup — no need to export it.
 */
async function resolveReference(
  ref: TemplateRef,
  organizationId: string
): Promise<{ originRuntime: TemplateOriginRuntime; canonicalTemplateId: string }> {
  if (ref?.kind === 'internal') {
    const canonicalTemplateId = (ref.canonicalTemplateId ?? '').trim();
    if (!canonicalTemplateId || !isTemplateOriginRuntime(ref.originRuntime)) {
      throw new TemplateResolveError(
        'TEMPLATE_NOT_INDEXED',
        'Internal template reference must carry both canonicalTemplateId and originRuntime',
        { ref: ref as unknown as Record<string, unknown> }
      );
    }
    return { originRuntime: ref.originRuntime, canonicalTemplateId };
  }

  const templateArtifactId = (ref as { templateArtifactId?: string })?.templateArtifactId?.trim();
  if (!templateArtifactId) {
    throw new TemplateResolveError(
      'TEMPLATE_NOT_INDEXED',
      'Library template reference must carry a templateArtifactId',
      { ref: ref as unknown as Record<string, unknown> }
    );
  }

  const link = await dbGet<OriginLinkProbeRow>(
    `SELECT origin_runtime, origin_record_id
       FROM v8_artifact_origin_links
      WHERE artifact_id = ?
        AND organization_id = ?
      ORDER BY is_primary_origin DESC
      LIMIT 1`,
    [templateArtifactId, organizationId],
    { fallback: true }
  );

  const originRecordId = link?.origin_record_id?.trim();
  if (!link || !originRecordId || !isTemplateOriginRuntime(link.origin_runtime)) {
    throw new TemplateResolveError(
      'TEMPLATE_NOT_INDEXED',
      'Template artifact is not present in the Template Library index',
      { templateArtifactId, originRuntime: link?.origin_runtime ?? null }
    );
  }

  return { originRuntime: link.origin_runtime, canonicalTemplateId: originRecordId };
}

/**
 * Canonical path. Access + status come from the registry row (authoritative,
 * UNSCOPED probe so "missing" and "another tenant's" stay distinguishable);
 * the blueprint comes from the Document Studio resolver.
 */
async function resolveDocumentStudioTemplate(
  canonicalTemplateId: string,
  organizationId: string
): Promise<ResolvedDocumentTemplate> {
  const row = await dbGet<DocumentStudioTemplateProbeRow>(
    `SELECT template_id, organization_id, status, is_system, provenance_status
       FROM document_studio_templates
      WHERE template_id = ?
      LIMIT 1`,
    [canonicalTemplateId],
    { fallback: true }
  );

  if (!row) {
    throw new TemplateResolveError(
      'TEMPLATE_ORPHANED',
      'Template link points at a document template that no longer exists',
      { canonicalTemplateId, originRuntime: 'document_template' }
    );
  }

  const isSystem = toBool(row.is_system) === true;
  const ownedByCaller = (row.organization_id ?? '') === organizationId;
  const systemVisible = isSystem && (row.organization_id ?? '') === SYSTEM_ORG_ID;
  if (!ownedByCaller && !systemVisible) {
    throw new TemplateResolveError(
      'TEMPLATE_FORBIDDEN',
      'Template belongs to another organization',
      { canonicalTemplateId, originRuntime: 'document_template' }
    );
  }
  if (row.provenance_status !== 'approved') {
    throw new TemplateResolveError('TEMPLATE_FORBIDDEN', 'Template provenance is not approved', {
      canonicalTemplateId, originRuntime: 'document_template', provenanceStatus: row.provenance_status ?? 'unknown',
    });
  }

  const status = normalizeTemplateStatus(row.status);
  if (status === 'deprecated') {
    throw new TemplateResolveError('TEMPLATE_DEPRECATED', 'Template has been deprecated', {
      canonicalTemplateId,
      originRuntime: 'document_template',
    });
  }

  // Blueprint FRESH from the canonical registry — reuse of the Document Studio
  // resolver (its cache hydrates from the same table), not a second parser.
  await ensureTemplateRegistryHydrated(organizationId);
  const template = getRegisteredTemplate(canonicalTemplateId, organizationId);
  if (!template) {
    throw new TemplateResolveError(
      'TEMPLATE_ORPHANED',
      'Template row exists but the canonical registry cannot resolve its blueprint',
      { canonicalTemplateId, originRuntime: 'document_template' }
    );
  }

  return {
    originRuntime: 'document_template',
    canonicalTemplateId,
    format: 'document',
    scope: deriveTemplateScope(row),
    status,
    source: 'canonical',
    legacy: false,
    sectionBlueprint: Array.isArray(template.sectionBlueprint)
      ? (template.sectionBlueprint as unknown[])
      : [],
  };
}

/**
 * Legacy path. `report_builder_templates` has NO status column — `is_active` is
 * the only lifecycle signal, so an inactive row reads as `'deprecated'`, an
 * active one as `'published'`, and a row without the column as `'unknown'`.
 */
async function resolveLegacyReportTemplate(
  canonicalTemplateId: string,
  organizationId: string
): Promise<ResolvedDocumentTemplate> {
  const row = await dbGet<ReportTemplateProbeRow>(
    `SELECT id, organization_id, is_system, is_active, is_public, sections_json, provenance_status
       FROM report_builder_templates
      WHERE id = ?
      LIMIT 1`,
    [canonicalTemplateId],
    { fallback: true }
  );

  if (!row) {
    throw new TemplateResolveError(
      'TEMPLATE_ORPHANED',
      'Template link points at a report template that no longer exists',
      { canonicalTemplateId, originRuntime: 'report_template' }
    );
  }

  const isSystem = toBool(row.is_system) === true;
  const isPublic = toBool(row.is_public) === true;
  const orgId = (row.organization_id ?? '').trim();
  // Mirrors reportBuilderService.getTemplateById visibility: own org, system
  // (organization_id IS NULL / is_system), or explicitly cross-org public.
  const visible = orgId === organizationId || orgId === '' || isSystem || isPublic;
  if (!visible) {
    throw new TemplateResolveError(
      'TEMPLATE_FORBIDDEN',
      'Template belongs to another organization',
      { canonicalTemplateId, originRuntime: 'report_template' }
    );
  }
  if (row.provenance_status !== 'approved') {
    throw new TemplateResolveError('TEMPLATE_FORBIDDEN', 'Template provenance is not approved', {
      canonicalTemplateId, originRuntime: 'report_template', provenanceStatus: row.provenance_status ?? 'unknown',
    });
  }

  const isActive = toBool(row.is_active);
  const status: TemplateStatus =
    isActive === false ? 'deprecated' : isActive === true ? 'published' : 'unknown';
  if (status === 'deprecated') {
    throw new TemplateResolveError('TEMPLATE_DEPRECATED', 'Template has been deprecated', {
      canonicalTemplateId,
      originRuntime: 'report_template',
    });
  }

  return {
    originRuntime: 'report_template',
    canonicalTemplateId,
    format: 'document',
    scope: deriveTemplateScope(row),
    status,
    source: 'legacy',
    legacy: true,
    // Legacy registry stores its blueprint as the sections array; read fresh.
    sectionBlueprint: parseJsonArray(row.sections_json),
  };
}

// =============================================================================
// PRESENTATION (deck) RESOLVER — R11 deck slice (2026-07-26)
// =============================================================================

/**
 * Resolve a client-supplied template reference into a server-validated
 * presentation blueprint. Same contract shape and rejection discipline as
 * `resolveDocumentTemplateForCreation` above — throws `TemplateResolveError`
 * with a typed `code` on every rejection path, never returns a partially
 * trusted result.
 *
 * `presentation_template` is the only origin runtime this resolves (deck has
 * no legacy pre-canonical registry the way document/report do).
 */
export async function resolvePresentationTemplateForCreation(
  ref: TemplateRef,
  ctx: { organizationId: string }
): Promise<ResolvedPresentationTemplate> {
  const organizationId = (ctx?.organizationId ?? '').trim();
  if (!organizationId) {
    throw new TemplateResolveError(
      'TEMPLATE_FORBIDDEN',
      'Template resolution requires an organization context'
    );
  }

  const { originRuntime, canonicalTemplateId } = await resolveReference(ref, organizationId);

  if (!PRESENTATION_ORIGIN_RUNTIMES.includes(originRuntime)) {
    throw new TemplateResolveError(
      'TEMPLATE_FORMAT_UNSUPPORTED',
      `Origin runtime ${originRuntime} does not produce a presentation`,
      { originRuntime, canonicalTemplateId }
    );
  }

  const row = await dbGet<PresentationTemplateProbeRow>(
    `SELECT id, organization_id, name, is_system, is_active, lifecycle_state, outline_json,
            theme, layout_policy_json, provenance_status
       FROM presentation_templates
      WHERE id = ?
      LIMIT 1`,
    [canonicalTemplateId],
    { fallback: true }
  );

  if (!row) {
    throw new TemplateResolveError(
      'TEMPLATE_ORPHANED',
      'Template link points at a presentation template that no longer exists',
      { canonicalTemplateId, originRuntime: 'presentation_template' }
    );
  }

  const isSystem = toBool(row.is_system) === true;
  const orgId = (row.organization_id ?? '').trim();
  // Mirrors the existing `GET /presentations/templates` visibility predicate
  // (`organization_id IS NULL OR organization_id = ?`): a NULL org row is a
  // system template regardless of the `is_system` flag's literal value.
  const ownedByCaller = orgId !== '' && orgId === organizationId;
  const systemVisible = isSystem || orgId === '';
  if (!ownedByCaller && !systemVisible) {
    throw new TemplateResolveError(
      'TEMPLATE_FORBIDDEN',
      'Template belongs to another organization',
      { canonicalTemplateId, originRuntime: 'presentation_template' }
    );
  }
  if (row.provenance_status !== 'approved') {
    throw new TemplateResolveError('TEMPLATE_FORBIDDEN', 'Template provenance is not approved', {
      canonicalTemplateId, originRuntime: 'presentation_template', provenanceStatus: row.provenance_status ?? 'unknown',
    });
  }

  // `is_active = false` is the older kill-switch (still checked by the list
  // route); `lifecycle_state` (migration 767) is the authoritative lifecycle
  // column. An inactive row reads as deprecated regardless of lifecycle_state.
  const isActive = toBool(row.is_active);
  const lifecycleStatus = normalizeTemplateStatus(row.lifecycle_state);
  const status: TemplateStatus = isActive === false ? 'deprecated' : lifecycleStatus;
  if (status === 'deprecated') {
    throw new TemplateResolveError('TEMPLATE_DEPRECATED', 'Template has been deprecated', {
      canonicalTemplateId,
      originRuntime: 'presentation_template',
    });
  }

  const layoutPolicy = parseJsonObject(row.layout_policy_json);
  return {
    originRuntime: 'presentation_template',
    canonicalTemplateId,
    format: 'presentation',
    name: (row.name ?? '').trim(),
    scope: deriveTemplateScope(row),
    status,
    source: 'canonical',
    legacy: false,
    // Blueprint FRESH from the canonical registry — never from the artifact
    // index snapshot, which can lag behind template edits.
    outlineBlueprint: parseJsonArray(row.outline_json),
    theme: (row.theme ?? '').trim() || 'modern',
    customTemplate: layoutPolicy?.customTemplate,
  };
}
