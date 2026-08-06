/**
 * Consultify Document Studio — Template Registry DAO (Epic E1, Slice 1.1).
 *
 * Persists `DocumentTemplate` and `TemplateAuditEntry` records to Postgres
 * (`document_studio_templates`, `document_studio_template_audit`).
 *
 * Design contract:
 *   - The DAO is a write-through layer behind the in-process Map cache in
 *     `documentTemplateService.ts`. The service public API stays
 *     synchronous; persistence is a background side-effect.
 *   - Every operation is `safeMode`-tolerant: a missing migration, a DB
 *     outage, or any other failure path resolves to `{ ok: false }` /
 *     `null` / `[]` and does NOT throw. The service falls back to the
 *     in-process Map when persistence is unavailable.
 *   - Reads (`loadTemplatesForOrg`, `loadAuditForTemplate`) hydrate the
 *     cache lazily once per organization on cold start.
 *
 * Tenant safety: every query carries `organization_id` in the WHERE
 * clause; a `null` / empty `organizationId` is rejected at the call site
 * (the service already guards this).
 */

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import type {
  CommunicationRegister,
  DocumentConfidentiality,
  DocumentDensity,
  DocumentLanguageStyle,
  DocumentTemplate,
  DocumentTypeKey,
  TemplateAuditAction,
  TemplateAuditEntry,
  TemplateCategory,
  TemplateStatus,
} from './documentStudioTypes.js';

interface TemplateRow {
  template_id: string;
  organization_id: string;
  name: string;
  category: string;
  document_type: string;
  purpose: string;
  audience: unknown;
  language: 'pl' | 'en';
  language_style: string;
  communication_register: string;
  density: string;
  confidentiality: string;
  required_inputs: unknown;
  section_blueprint: unknown;
  formatting_schema: unknown;
  export_rules: unknown;
  status: TemplateStatus;
  version: string;
  created_by: string;
  created_at: string | Date;
  updated_at: string | Date;
  approved_by?: string | null;
  approved_at?: string | Date | null;
  deprecated_by?: string | null;
  deprecated_at?: string | Date | null;
  notes?: string | null;
  is_system?: boolean | null;
  // Slice E14.persistence — product fields. All optional / NULL-tolerant.
  usage_count?: number | null;
  last_used_at?: string | Date | null;
  feedback_quality_score?: number | null;
  feedback_sample_size?: number | null;
  persona_tags?: unknown;
  region_tags?: unknown;
  brand_tags?: unknown;
  dependency_tags?: unknown;
}

interface AuditRow {
  audit_id: string;
  template_id: string;
  organization_id: string;
  action: TemplateAuditAction;
  actor_id: string;
  occurred_at: string | Date;
  details?: unknown;
}

/**
 * Sentinel organization id under which seeded system templates are stored.
 * Read paths fold `system` rows into every org's listings via
 * `loadTemplatesForOrg`, so consultants in any organization see the
 * curated catalogue without per-org duplication.
 */
export const SYSTEM_ORG_ID = '__system__';

function toIsoString(value: string | Date | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  if (value instanceof Date) return value.toISOString();
  // Postgres can return ISO strings or `2026-05-07 22:30:12.123+00`. Both
  // parse cleanly through the Date constructor.
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function rowToTemplate(row: TemplateRow): DocumentTemplate {
  return {
    templateId: row.template_id,
    organizationId: row.organization_id,
    name: row.name,
    category: row.category as TemplateCategory,
    documentType: row.document_type as DocumentTypeKey,
    purpose: row.purpose,
    audience: parseJson<string[]>(row.audience, []),
    language: row.language,
    languageStyle: row.language_style as DocumentLanguageStyle,
    communicationRegister: row.communication_register as CommunicationRegister,
    density: row.density as DocumentDensity,
    confidentiality: row.confidentiality as DocumentConfidentiality,
    requiredInputs: parseJson<string[]>(row.required_inputs, []),
    sectionBlueprint: parseJson<DocumentTemplate['sectionBlueprint']>(row.section_blueprint, []),
    formattingSchema: parseJson<DocumentTemplate['formattingSchema']>(
      row.formatting_schema,
      {} as DocumentTemplate['formattingSchema']
    ),
    exportRules: parseJson<DocumentTemplate['exportRules']>(row.export_rules, {
      docx: true,
      pdf: true,
      markdown: true,
      approvalRequiredForExport: false,
    }),
    status: row.status,
    version: row.version,
    createdBy: row.created_by,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    approvedBy: row.approved_by ?? undefined,
    approvedAt: row.approved_at ? toIsoString(row.approved_at) : undefined,
    deprecatedBy: row.deprecated_by ?? undefined,
    deprecatedAt: row.deprecated_at ? toIsoString(row.deprecated_at) : undefined,
    notes: row.notes ?? undefined,
    // Slice E14.persistence — product fields.
    usageCount: typeof row.usage_count === 'number' ? row.usage_count : undefined,
    lastUsedAt: row.last_used_at ? toIsoString(row.last_used_at) : undefined,
    feedbackQualityScore:
      typeof row.feedback_quality_score === 'number' ? row.feedback_quality_score : undefined,
    feedbackSampleSize:
      typeof row.feedback_sample_size === 'number' ? row.feedback_sample_size : undefined,
    personaTags: parseJson<string[]>(row.persona_tags, []) ?? undefined,
    regionTags: parseJson<string[]>(row.region_tags, []) ?? undefined,
    brandTags: parseJson<string[]>(row.brand_tags, []) ?? undefined,
    dependencyTags: parseJson<string[]>(row.dependency_tags, []) ?? undefined,
  };
}

function rowToAudit(row: AuditRow): TemplateAuditEntry {
  return {
    auditId: row.audit_id,
    templateId: row.template_id,
    organizationId: row.organization_id,
    action: row.action,
    actorId: row.actor_id,
    occurredAt: toIsoString(row.occurred_at),
    details: parseJson<Record<string, unknown>>(row.details, {}),
  };
}

/**
 * Load every template visible to the given organization. The result merges
 * system-scope rows (seeded with `is_system = TRUE` under
 * `organization_id = SYSTEM_ORG_ID`) with rows owned by the org itself.
 *
 * Failure modes (missing migration, DB outage, schema drift) resolve to an
 * empty array so the in-process cache stays usable.
 */
export async function loadTemplatesForOrg(organizationId: string): Promise<DocumentTemplate[]> {
  if (!organizationId) return [];
  try {
    const rows = await dbAll<TemplateRow>(
      `SELECT * FROM document_studio_templates
        WHERE organization_id = $1 OR (organization_id = $2 AND is_system = TRUE)
        ORDER BY created_at DESC`,
      [organizationId, SYSTEM_ORG_ID]
    );
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.map(rowToTemplate);
  } catch (err) {
    // dbAll already swallows table-not-found errors with `fallback: true`.
    // We only reach this path on truly exceptional failures.
    logger.warn('[DocumentStudio][TemplateDao] loadTemplatesForOrg failed', {
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

export async function loadTemplateById(
  templateId: string,
  organizationId: string
): Promise<DocumentTemplate | null> {
  if (!templateId || !organizationId) return null;
  try {
    const row = await dbGet<TemplateRow>(
      `SELECT * FROM document_studio_templates
        WHERE template_id = $1
          AND (organization_id = $2 OR (organization_id = $3 AND is_system = TRUE))
        LIMIT 1`,
      [templateId, organizationId, SYSTEM_ORG_ID]
    );
    return row ? rowToTemplate(row) : null;
  } catch (err) {
    logger.warn('[DocumentStudio][TemplateDao] loadTemplateById failed', {
      templateId,
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Persist a template (insert-or-update). Returns `{ ok: true }` on success
 * and `{ ok: false }` on any failure; the caller treats `ok: false` as
 * non-fatal because the in-process Map already holds the truth.
 */
export async function persistTemplate(
  template: DocumentTemplate,
  options: { isSystem?: boolean } = {}
): Promise<{ ok: boolean }> {
  if (!template?.templateId || !template.organizationId) return { ok: false };
  try {
    const result = await dbRun(
      `INSERT INTO document_studio_templates (
         template_id, organization_id, name, category, document_type,
         purpose, audience, language, language_style, communication_register,
         density, confidentiality, required_inputs, section_blueprint,
         formatting_schema, export_rules, status, version, created_by,
         created_at, updated_at, approved_by, approved_at, deprecated_by,
         deprecated_at, notes, is_system,
         usage_count, last_used_at, feedback_quality_score,
         feedback_sample_size, persona_tags, region_tags,
         brand_tags, dependency_tags
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7::jsonb, $8, $9, $10,
         $11, $12, $13::jsonb, $14::jsonb,
         $15::jsonb, $16::jsonb, $17, $18, $19,
         $20, $21, $22, $23, $24,
         $25, $26, $27,
         $28, $29, $30,
         $31, $32::jsonb, $33::jsonb,
         $34::jsonb, $35::jsonb
       )
       ON CONFLICT (template_id) DO UPDATE SET
         organization_id = EXCLUDED.organization_id,
         name = EXCLUDED.name,
         category = EXCLUDED.category,
         document_type = EXCLUDED.document_type,
         purpose = EXCLUDED.purpose,
         audience = EXCLUDED.audience,
         language = EXCLUDED.language,
         language_style = EXCLUDED.language_style,
         communication_register = EXCLUDED.communication_register,
         density = EXCLUDED.density,
         confidentiality = EXCLUDED.confidentiality,
         required_inputs = EXCLUDED.required_inputs,
         section_blueprint = EXCLUDED.section_blueprint,
         formatting_schema = EXCLUDED.formatting_schema,
         export_rules = EXCLUDED.export_rules,
         status = EXCLUDED.status,
         version = EXCLUDED.version,
         updated_at = EXCLUDED.updated_at,
         approved_by = EXCLUDED.approved_by,
         approved_at = EXCLUDED.approved_at,
         deprecated_by = EXCLUDED.deprecated_by,
         deprecated_at = EXCLUDED.deprecated_at,
         notes = EXCLUDED.notes,
         is_system = EXCLUDED.is_system,
         usage_count = EXCLUDED.usage_count,
         last_used_at = EXCLUDED.last_used_at,
         feedback_quality_score = EXCLUDED.feedback_quality_score,
         feedback_sample_size = EXCLUDED.feedback_sample_size,
         persona_tags = EXCLUDED.persona_tags,
         region_tags = EXCLUDED.region_tags,
         brand_tags = EXCLUDED.brand_tags,
         dependency_tags = EXCLUDED.dependency_tags`,
      [
        template.templateId,
        template.organizationId,
        template.name,
        template.category,
        template.documentType,
        template.purpose,
        JSON.stringify(template.audience ?? []),
        template.language,
        template.languageStyle,
        template.communicationRegister,
        template.density,
        template.confidentiality,
        JSON.stringify(template.requiredInputs ?? []),
        JSON.stringify(template.sectionBlueprint ?? []),
        JSON.stringify(template.formattingSchema ?? {}),
        JSON.stringify(template.exportRules ?? {}),
        template.status,
        template.version,
        template.createdBy,
        template.createdAt,
        template.updatedAt,
        template.approvedBy ?? null,
        template.approvedAt ?? null,
        template.deprecatedBy ?? null,
        template.deprecatedAt ?? null,
        template.notes ?? null,
        options.isSystem === true,
        // Slice E14.persistence — product fields. NULL when undefined
        // so legacy rows continue to read NULL on the way out.
        typeof template.usageCount === 'number' ? template.usageCount : null,
        template.lastUsedAt ?? null,
        typeof template.feedbackQualityScore === 'number' ? template.feedbackQualityScore : null,
        typeof template.feedbackSampleSize === 'number' ? template.feedbackSampleSize : null,
        JSON.stringify(template.personaTags ?? []),
        JSON.stringify(template.regionTags ?? []),
        JSON.stringify(template.brandTags ?? []),
        JSON.stringify(template.dependencyTags ?? []),
      ]
    );
    return { ok: result.success === true };
  } catch (err) {
    logger.warn('[DocumentStudio][TemplateDao] persistTemplate failed', {
      templateId: template.templateId,
      organizationId: template.organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}

export async function deleteTemplateRecord(
  templateId: string,
  organizationId: string
): Promise<{ ok: boolean }> {
  if (!templateId || !organizationId || organizationId === SYSTEM_ORG_ID) return { ok: false };
  try {
    await dbRun(
      `DELETE FROM document_studio_template_audit
        WHERE template_id = $1 AND organization_id = $2`,
      [templateId, organizationId]
    );
    await dbRun(
      `DELETE FROM document_studio_templates
        WHERE template_id = $1 AND organization_id = $2 AND status = 'draft' AND is_system = FALSE`,
      [templateId, organizationId]
    );
    return { ok: true };
  } catch (err) {
    logger.warn('[DocumentStudio][TemplateDao] deleteTemplateRecord failed', {
      templateId,
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}

export async function loadAuditForTemplate(
  templateId: string,
  organizationId: string
): Promise<TemplateAuditEntry[]> {
  if (!templateId || !organizationId) return [];
  try {
    const rows = await dbAll<AuditRow>(
      `SELECT * FROM document_studio_template_audit
        WHERE template_id = $1
          AND (organization_id = $2 OR organization_id = $3)
        ORDER BY occurred_at ASC`,
      [templateId, organizationId, SYSTEM_ORG_ID]
    );
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.map(rowToAudit);
  } catch (err) {
    logger.warn('[DocumentStudio][TemplateDao] loadAuditForTemplate failed', {
      templateId,
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

export async function persistAuditEntry(entry: TemplateAuditEntry): Promise<{ ok: boolean }> {
  if (!entry?.auditId || !entry.templateId || !entry.organizationId) return { ok: false };
  try {
    const result = await dbRun(
      `INSERT INTO document_studio_template_audit (
         audit_id, template_id, organization_id, action, actor_id,
         occurred_at, details
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7::jsonb
       )
       ON CONFLICT (audit_id) DO NOTHING`,
      [
        entry.auditId,
        entry.templateId,
        entry.organizationId,
        entry.action,
        entry.actorId,
        entry.occurredAt,
        JSON.stringify(entry.details ?? {}),
      ]
    );
    return { ok: result.success === true };
  } catch (err) {
    logger.warn('[DocumentStudio][TemplateDao] persistAuditEntry failed', {
      auditId: entry.auditId,
      templateId: entry.templateId,
      organizationId: entry.organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}

/**
 * Test-only helper: nukes every persistence artifact written by the DAO.
 * Production callers MUST NOT use it. Used by integration tests that
 * exercise both the cache and the DAO together.
 *
 * @internal
 */
export async function __resetTemplateRegistryDaoForTests(): Promise<void> {
  try {
    await dbRun(`DELETE FROM document_studio_template_audit`, []);
    await dbRun(`DELETE FROM document_studio_templates`, []);
  } catch {
    // Tables may not exist in the test DB — silently ignore so the test
    // suite stays compatible with the pre-migration baseline.
  }
}
