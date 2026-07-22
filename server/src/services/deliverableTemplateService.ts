/**
 * deliverableTemplateService — federuje szablony z 3 tabel (deck/doc/table)
 * w jeden zunifikowany typ DeliverableTemplate.
 *
 * Fail-open per tabela: jeśli SQL rzuci (schema drift), zwracamy [] dla
 * danego typu i nie blokujemy pozostałych (wzorzec: finding_subquery_optional_table_silent_empty).
 *
 * CRUD (T3): create/update/delete/getById — org-scoped, system templates chronione (403).
 */

import logger from '../utils/Logger.js';
import { queryAll, queryOne, queryRun } from '../utils/queryHelpers.js';
import { registerArtifactOrigin } from './v8/artifactRegistryService.js';

const LOG_PREFIX = '[deliverableTemplateService]';

export type DeliverableTemplateType = 'doc' | 'deck' | 'table';

export interface DeliverableTemplate {
  id: string;
  type: DeliverableTemplateType;
  name: string;
  description: string | null;
  isSystem: boolean;
  isBlank: boolean;
  organizationId: string | null;
  meta: Record<string, unknown>;
}

const BLANK_NAME_PATTERN = /blank|pusty/i;

/**
 * True gdy błąd DB to "column visibility does not exist" (Postgres 42703) —
 * czyli migracja 918_template_visibility.sql jeszcze nie została ręcznie
 * zastosowana na tej bazie. W takim wypadku wołający ma paść z powrotem na
 * starą, 2-poziomową regułę (system/organizacja) — wsteczna zgodność.
 */
function isMissingVisibilityColumnError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /column\s+"?visibility"?\s+does not exist/i.test(msg);
}

function detectIsBlank(name: string, meta: Record<string, unknown>): boolean {
  if (BLANK_NAME_PATTERN.test(name)) return true;
  // doc: brak sekcji
  if (Array.isArray(meta.sections_json) && (meta.sections_json as unknown[]).length === 0)
    return true;
  if (typeof meta.sections_json === 'string') {
    try {
      const parsed = JSON.parse(meta.sections_json as string);
      if (Array.isArray(parsed) && parsed.length === 0) return true;
    } catch {
      // ignore
    }
  }
  // deck: brak outline
  if (Array.isArray(meta.outline_json) && (meta.outline_json as unknown[]).length === 0)
    return true;
  if (typeof meta.outline_json === 'string') {
    try {
      const parsed = JSON.parse(meta.outline_json as string);
      if (Array.isArray(parsed) && parsed.length === 0) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

type DeckRow = {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  theme: string | null;
  organization_id: string | null;
  outline_json: string | null;
};

function mapDeckRow(r: DeckRow): DeliverableTemplate {
  const meta: Record<string, unknown> = {
    theme: r.theme,
    outline_json: r.outline_json,
  };
  return {
    id: r.id,
    type: 'deck' as DeliverableTemplateType,
    name: r.name,
    description: r.description,
    isSystem: Boolean(r.is_system),
    isBlank: detectIsBlank(r.name, meta),
    organizationId: r.organization_id,
    meta,
  };
}

const LEGACY_DECK_SQL = `SELECT id, name, description, is_system, theme, organization_id, outline_json
       FROM presentation_templates
       WHERE (is_system = true OR organization_id = $1) AND is_active = true
       ORDER BY is_system DESC, name`;

/**
 * 3-poziomowa reguła widoczności (System/Organizacja/Prywatny), spójna z
 * doc/table poniżej. `visibility` może nie istnieć jeszcze na tej bazie
 * (migracja 918 nie zastosowana) — w takim razie łapiemy błąd i wracamy do
 * starej, 2-poziomowej reguły (LEGACY_*_SQL) zamiast fail-open→[] (co
 * ukryłoby WSZYSTKIE szablony aż do ręcznej migracji).
 *
 * Gałąź `organization_id IS NULL AND created_by IS NOT NULL` to sieć
 * bezpieczeństwa dla osieroconych rekordów sprzed org-scopingu (np.
 * tp_base_templates zapisywanych przez inny caller —
 * tablePlatform/TemplateService.ts:createFromTable — bez organization_id):
 * zamiast nowo zniknąć (żaden `organization_id = $1` ich nie złapie), zostają
 * widoczne tak jak dziś (twardy wymóg: „żaden istniejący template nie znika").
 */
async function listDeckTemplates(orgId: string, userId?: string): Promise<DeliverableTemplate[]> {
  try {
    const rows = await queryAll<DeckRow>(
      `SELECT id, name, description, is_system, theme, organization_id, outline_json
       FROM presentation_templates
       WHERE is_active = true
         AND (
           is_system = true
           OR (COALESCE(visibility, 'organization') <> 'private' AND organization_id = $1)
           OR (visibility = 'private' AND created_by = $2)
           OR (organization_id IS NULL AND created_by IS NOT NULL)
         )
       ORDER BY is_system DESC, name`,
      [orgId, userId ?? null]
    );
    return rows.map(mapDeckRow);
  } catch (err) {
    if (isMissingVisibilityColumnError(err)) {
      try {
        const rows = await queryAll<DeckRow>(LEGACY_DECK_SQL, [orgId]);
        return rows.map(mapDeckRow);
      } catch {
        return [];
      }
    }
    return [];
  }
}

type DocRow = {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_public: boolean;
  report_type: string | null;
  sections_json: string | null;
  organization_id: string | null;
};

function mapDocRow(r: DocRow): DeliverableTemplate {
  const meta: Record<string, unknown> = {
    report_type: r.report_type,
    sections_json: r.sections_json,
  };
  return {
    id: r.id,
    type: 'doc' as DeliverableTemplateType,
    name: r.name,
    description: r.description,
    isSystem: Boolean(r.is_system),
    isBlank: detectIsBlank(r.name, meta),
    organizationId: r.organization_id,
    meta,
  };
}

const LEGACY_DOC_SQL = `SELECT id, name, description, is_system, is_public, report_type, sections_json, organization_id
       FROM report_builder_templates
       WHERE (is_system = true OR is_public = true OR organization_id = $1)
       ORDER BY is_system DESC, name`;

async function listDocTemplates(orgId: string, userId?: string): Promise<DeliverableTemplate[]> {
  try {
    const rows = await queryAll<DocRow>(
      `SELECT id, name, description, is_system, is_public, report_type, sections_json, organization_id
       FROM report_builder_templates
       WHERE (
         is_system = true
         OR is_public = true
         OR (COALESCE(visibility, 'organization') <> 'private' AND organization_id = $1)
         OR (visibility = 'private' AND created_by = $2)
         OR (organization_id IS NULL AND created_by IS NOT NULL)
       )
       ORDER BY is_system DESC, name`,
      [orgId, userId ?? null]
    );
    return rows.map(mapDocRow);
  } catch (err) {
    if (isMissingVisibilityColumnError(err)) {
      try {
        const rows = await queryAll<DocRow>(LEGACY_DOC_SQL, [orgId]);
        return rows.map(mapDocRow);
      } catch {
        return [];
      }
    }
    return [];
  }
}

type TableRow = {
  id: string;
  name: string;
  description: string | null;
  is_featured: boolean;
  category: string | null;
  schema_snapshot: unknown;
  created_by: string | null;
  organization_id: string | null;
};

function mapTableRow(r: TableRow): DeliverableTemplate {
  const meta: Record<string, unknown> = {
    category: r.category,
    schema_snapshot: r.schema_snapshot,
  };
  return {
    id: String(r.id),
    type: 'table' as DeliverableTemplateType,
    name: r.name,
    description: r.description,
    isSystem: r.created_by === null,
    isBlank: detectIsBlank(r.name, {}),
    organizationId: r.organization_id ?? null,
    meta,
  };
}

// Legacy behaviour (pre-3-level-visibility): NO org scoping at all — every
// tp_base_templates row was visible to every org. Kept only as the
// missing-column fallback so this list never goes empty because of a schema
// drift; org-scoping the same as deck/doc is the actual bug fix here (see
// migration 918 comment / final report — flagged as an intentional gap-close,
// not a silent behaviour change).
const LEGACY_TABLE_SQL = `SELECT id, name, description, is_featured, category, schema_snapshot, created_by, organization_id
       FROM tp_base_templates
       ORDER BY is_featured DESC, name`;

async function listTableTemplates(orgId: string, userId?: string): Promise<DeliverableTemplate[]> {
  try {
    const rows = await queryAll<TableRow>(
      `SELECT id, name, description, is_featured, category, schema_snapshot, created_by, organization_id
       FROM tp_base_templates
       WHERE (
         created_by IS NULL
         OR (COALESCE(visibility, 'organization') <> 'private' AND organization_id = $1)
         OR (visibility = 'private' AND created_by = $2)
         OR (organization_id IS NULL AND created_by IS NOT NULL)
       )
       ORDER BY is_featured DESC, name`,
      [orgId, userId ?? null]
    );
    return rows.map(mapTableRow);
  } catch (err) {
    if (isMissingVisibilityColumnError(err)) {
      try {
        const rows = await queryAll<TableRow>(LEGACY_TABLE_SQL, []);
        return rows.map(mapTableRow);
      } catch {
        return [];
      }
    }
    return [];
  }
}

export async function listDeliverableTemplates(
  type: DeliverableTemplateType,
  orgId: string,
  userId?: string
): Promise<DeliverableTemplate[]> {
  switch (type) {
    case 'deck':
      return listDeckTemplates(orgId, userId);
    case 'doc':
      return listDocTemplates(orgId, userId);
    case 'table':
      return listTableTemplates(orgId, userId);
    default:
      return [];
  }
}

// ============================================================
// T3 — CRUD: tworzenie/edycja/usuwanie szablonów użytkownika
// Reguły bezpieczeństwa:
//   - is_system = false zawsze dla user-created
//   - org-scope (organization_id = orgId) wymuszony na wszystkich mutacjach
//   - DELETE/PUT na system templates → rzuć TemplateForbiddenError
// ============================================================

export class TemplateForbiddenError extends Error {
  constructor(msg = 'Cannot modify system template') {
    super(msg);
    this.name = 'TemplateForbiddenError';
  }
}

export class TemplateNotFoundError extends Error {
  constructor(id: string) {
    super(`Template not found: ${id}`);
    this.name = 'TemplateNotFoundError';
  }
}

/** Pobierz jeden szablon po id (przeszukuje wszystkie 3 tabele). */
export async function getDeliverableTemplate(
  id: string,
  orgId: string
): Promise<DeliverableTemplate | null> {
  // deck
  const deck = await queryOne<{
    id: string;
    name: string;
    description: string | null;
    is_system: boolean;
    theme: string | null;
    organization_id: string | null;
    outline_json: string | null;
  }>(
    `SELECT id, name, description, is_system, theme, organization_id, outline_json
     FROM presentation_templates
     WHERE id = $1 AND (is_system = true OR organization_id = $2)`,
    [id, orgId]
  );
  if (deck) {
    const meta: Record<string, unknown> = { theme: deck.theme, outline_json: deck.outline_json };
    return {
      id: deck.id,
      type: 'deck',
      name: deck.name,
      description: deck.description,
      isSystem: Boolean(deck.is_system),
      isBlank: detectIsBlank(deck.name, meta),
      organizationId: deck.organization_id,
      meta,
    };
  }

  // doc
  const doc = await queryOne<{
    id: string;
    name: string;
    description: string | null;
    is_system: boolean;
    is_public: boolean;
    report_type: string | null;
    sections_json: string | null;
    organization_id: string | null;
  }>(
    `SELECT id, name, description, is_system, is_public, report_type, sections_json, organization_id
     FROM report_builder_templates
     WHERE id = $1 AND (is_system = true OR is_public = true OR organization_id = $2)`,
    [id, orgId]
  );
  if (doc) {
    const meta: Record<string, unknown> = {
      report_type: doc.report_type,
      sections_json: doc.sections_json,
    };
    return {
      id: doc.id,
      type: 'doc',
      name: doc.name,
      description: doc.description,
      isSystem: Boolean(doc.is_system),
      isBlank: detectIsBlank(doc.name, meta),
      organizationId: doc.organization_id,
      meta,
    };
  }

  // table
  const tbl = await queryOne<{
    id: string;
    name: string;
    description: string | null;
    is_featured: boolean;
    category: string | null;
    schema_snapshot: unknown;
    created_by: string | null;
    organization_id: string | null;
  }>(
    `SELECT id, name, description, is_featured, category, schema_snapshot, created_by, organization_id
     FROM tp_base_templates
     WHERE id::text = $1 AND (created_by IS NULL OR organization_id = $2)`,
    [id, orgId]
  );
  if (tbl) {
    const meta: Record<string, unknown> = {
      category: tbl.category,
      schema_snapshot: tbl.schema_snapshot,
    };
    return {
      id: String(tbl.id),
      type: 'table',
      name: tbl.name,
      description: tbl.description,
      isSystem: tbl.created_by === null,
      isBlank: detectIsBlank(tbl.name, {}),
      organizationId: tbl.organization_id,
      meta,
    };
  }

  return null;
}

function safeParseArray(raw: string): unknown[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Split-brain fix (Template Library): templates created directly in a builder
 * (report/deck) land in the legacy tables (report_builder_templates /
 * presentation_templates) but, unlike the "save as template" flow
 * (server/src/routes/artifacts.routes.ts POST /:id/save-as-template), were
 * never registered in the canonical Outputs artifact registry
 * (artifactRegistryService). The Template Library tab reads
 * `GET /api/artifacts?artifactFamily=template`, which is backed by that
 * registry — so builder-created templates were saved but invisible there.
 *
 * This mirrors the origin-runtime + visibilityScope shape used both by the
 * save-as-template route and by the report/presentation template backfill
 * helpers in artifactRegistryService.ts (`backfillReportTemplatesForOrg` /
 * `backfillPresentationTemplatesForOrg`): is_system is always false here
 * (user-created, not a system template) and organization_id is always set,
 * so visibilityScope maps to 'organization' (org-wide, matching how these
 * rows are already readable org-wide via listDeliverableTemplates' own
 * `is_system = true OR organization_id = $1` clause).
 *
 * `table` templates (tp_base_templates — despite the DB name, these are the
 * Excel/Arkusz templates surfaced in TemplateBuilder as "Arkusz (Excel)", see
 * src/components/TemplateBuilder/templateBuilderModel.ts) now map to the
 * 'sheet_template' origin runtime (Fala B, 2026-07-22) — the same value
 * already used for the seeded bt-sheet-* business templates
 * (server/migrations/20260412_seed_business_templates.sql), so the DB CHECK
 * constraint on v8_artifact_origin_links.origin_runtime already allows it;
 * only the TS enum (ArtifactOriginRuntimeValues) and this branch were behind.
 *
 * Registry write is best-effort and must never fail template creation — the
 * legacy table row is (and remains) the source of truth.
 */
async function registerBuilderTemplateArtifactBestEffort(params: {
  type: DeliverableTemplateType;
  templateId: string;
  name: string;
  description: string | null;
  sectionsJson?: string;
  outlineJson?: string;
  schemaSnapshotJson?: string;
  organizationId: string;
  userId: string;
}): Promise<void> {
  const { type, templateId, name, description, organizationId, userId } = params;

  try {
    const now = new Date().toISOString();
    if (type === 'table') {
      let schemaSnapshot: unknown = {};
      try {
        schemaSnapshot = params.schemaSnapshotJson ? JSON.parse(params.schemaSnapshotJson) : {};
      } catch {
        schemaSnapshot = {};
      }
      // Arkusz templates store their structure as a flat column list
      // (SheetColumn[] — src/components/TemplateBuilder/templateBuilderModel.ts)
      // or, for a workbook-derived snapshot, a { sheets: [...] } shape. Surface
      // whichever is present as a lightweight blueprint for the Template
      // Library card — never fail registration if the shape doesn't match.
      const columns = Array.isArray(schemaSnapshot)
        ? schemaSnapshot
        : Array.isArray((schemaSnapshot as any)?.columns)
          ? (schemaSnapshot as any).columns
          : [];
      const sheets = Array.isArray((schemaSnapshot as any)?.sheets)
        ? (schemaSnapshot as any).sheets
        : [];

      await registerArtifactOrigin({
        organizationId,
        outputType: 'sheet',
        artifactFamily: 'template',
        originRuntime: 'sheet_template',
        originRecordId: templateId,
        titleSnapshot: name,
        ownerUserId: userId,
        createdBy: userId,
        deliveryState: 'draft',
        visibilityScope: 'organization',
        originSummary: {
          template: {
            scope: 'org',
            status: 'draft',
            description: description || '',
            structureBlueprint:
              sheets.length > 0
                ? { sheets: sheets.map((s: any) => ({ name: s?.name || s?.title || '' })) }
                : {
                    columns: columns.map((c: any) => ({
                      key: c?.key || c?.header || '',
                      header: c?.header || c?.key || '',
                    })),
                  },
            metadata: {
              createdBy: userId,
              createdAt: now,
              updatedAt: now,
              legacyTemplateId: templateId,
            },
          },
          sourceTable: 'tp_base_templates',
        },
      });
      return;
    }

    if (type === 'doc') {
      const sections = safeParseArray(params.sectionsJson ?? '[]');
      await registerArtifactOrigin({
        organizationId,
        outputType: 'report',
        artifactFamily: 'template',
        originRuntime: 'report_template',
        originRecordId: templateId,
        titleSnapshot: name,
        ownerUserId: userId,
        createdBy: userId,
        deliveryState: 'draft',
        visibilityScope: 'organization',
        originSummary: {
          template: {
            scope: 'org',
            status: 'draft',
            description: description || '',
            reportType: 'custom',
            structureBlueprint: {
              sections: sections.map((s: any) => ({
                key: s?.key || s?.sectionKey || s?.section_key || s?.id || '',
                title: s?.title || s?.name || '',
              })),
            },
            metadata: {
              createdBy: userId,
              createdAt: now,
              updatedAt: now,
              legacyTemplateId: templateId,
            },
          },
          sourceTable: 'report_builder_templates',
        },
      });
      return;
    }

    // deck
    const outline = safeParseArray(params.outlineJson ?? '[]');
    await registerArtifactOrigin({
      organizationId,
      outputType: 'presentation',
      artifactFamily: 'template',
      originRuntime: 'presentation_template',
      originRecordId: templateId,
      titleSnapshot: name,
      ownerUserId: userId,
      createdBy: userId,
      deliveryState: 'draft',
      visibilityScope: 'organization',
      originSummary: {
        template: {
          scope: 'org',
          status: 'draft',
          description: description || '',
          deckType: 'custom',
          structureBlueprint: { outline },
          metadata: {
            createdBy: userId,
            createdAt: now,
            updatedAt: now,
            legacyTemplateId: templateId,
          },
        },
        sourceTable: 'presentation_templates',
      },
    });
  } catch (err) {
    logger.warn(
      `${LOG_PREFIX} artifact-registry registration failed for builder template ${templateId} (type=${type}, template row still saved): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/** Utwórz user-owned template w odpowiedniej tabeli. */
export async function createDeliverableTemplate(
  type: DeliverableTemplateType,
  name: string,
  description: string | undefined,
  meta: Record<string, unknown> | undefined,
  orgId: string,
  userId: string
): Promise<DeliverableTemplate> {
  const desc = description ?? null;
  const metaObj = meta ?? {};

  if (type === 'doc') {
    const sectionsJson =
      typeof metaObj.sections_json === 'string'
        ? metaObj.sections_json
        : JSON.stringify(metaObj.sections_json ?? []);
    const row = await queryOne<{ id: string }>(
      `INSERT INTO report_builder_templates
         (id, name, description, source_type, report_type, sections_json,
          is_system, is_default, is_public, organization_id, created_by, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, 'DELIVERABLE', 'custom', $3,
               false, false, false, $4, $5, NOW(), NOW())
       RETURNING id`,
      [name, desc, sectionsJson, orgId, userId]
    );
    if (!row) throw new Error('Insert doc template returned no row');
    await registerBuilderTemplateArtifactBestEffort({
      type,
      templateId: row.id,
      name,
      description: desc,
      sectionsJson,
      organizationId: orgId,
      userId,
    });
    return (await getDeliverableTemplate(row.id, orgId))!;
  }

  if (type === 'deck') {
    const outlineJson =
      typeof metaObj.outline_json === 'string'
        ? metaObj.outline_json
        : JSON.stringify(metaObj.outline_json ?? []);
    const row = await queryOne<{ id: string }>(
      `INSERT INTO presentation_templates
         (id, name, description, deck_type, outline_json,
          is_system, is_active, organization_id, created_by, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, 'custom', $3,
               false, true, $4, $5, NOW(), NOW())
       RETURNING id`,
      [name, desc, outlineJson, orgId, userId]
    );
    if (!row) throw new Error('Insert deck template returned no row');
    await registerBuilderTemplateArtifactBestEffort({
      type,
      templateId: row.id,
      name,
      description: desc,
      outlineJson,
      organizationId: orgId,
      userId,
    });
    return (await getDeliverableTemplate(row.id, orgId))!;
  }

  // table
  const schemaSnapshot =
    typeof metaObj.schema_snapshot === 'string'
      ? metaObj.schema_snapshot
      : JSON.stringify(metaObj.schema_snapshot ?? {});
  const category = typeof metaObj.category === 'string' ? metaObj.category : 'custom';
  const row = await queryOne<{ id: string }>(
    `INSERT INTO tp_base_templates
       (name, description, category, schema_snapshot, is_featured,
        organization_id, created_by, created_at)
     VALUES ($1, $2, $3, $4::jsonb, false, $5, $6, NOW())
     RETURNING id::text AS id`,
    [name, desc, category, schemaSnapshot, orgId, userId]
  );
  if (!row) throw new Error('Insert table template returned no row');
  await registerBuilderTemplateArtifactBestEffort({
    type,
    templateId: row.id,
    name,
    description: desc,
    schemaSnapshotJson: schemaSnapshot,
    organizationId: orgId,
    userId,
  });
  return (await getDeliverableTemplate(row.id, orgId))!;
}

/** Zaktualizuj template — tylko org-owned, nie-system. */
export async function updateDeliverableTemplate(
  id: string,
  updates: { name?: string; description?: string; meta?: Record<string, unknown> },
  orgId: string
): Promise<DeliverableTemplate> {
  // Sprawdź we wszystkich 3 tabelach
  const existing = await getDeliverableTemplate(id, orgId);
  if (!existing) throw new TemplateNotFoundError(id);
  if (existing.isSystem) throw new TemplateForbiddenError();
  if (existing.organizationId !== orgId)
    throw new TemplateForbiddenError('Cross-org update not allowed');

  const newName = updates.name ?? existing.name;
  const newDesc = updates.description !== undefined ? updates.description : existing.description;
  const metaObj = updates.meta ?? {};

  if (existing.type === 'doc') {
    const sectionsJson =
      metaObj.sections_json !== undefined
        ? typeof metaObj.sections_json === 'string'
          ? metaObj.sections_json
          : JSON.stringify(metaObj.sections_json)
        : String(existing.meta.sections_json ?? '[]');
    await queryRun(
      `UPDATE report_builder_templates
       SET name = $1, description = $2, sections_json = $3, updated_at = NOW()
       WHERE id = $4 AND organization_id = $5 AND is_system = false`,
      [newName, newDesc, sectionsJson, id, orgId]
    );
  } else if (existing.type === 'deck') {
    const outlineJson =
      metaObj.outline_json !== undefined
        ? typeof metaObj.outline_json === 'string'
          ? metaObj.outline_json
          : JSON.stringify(metaObj.outline_json)
        : String(existing.meta.outline_json ?? '[]');
    await queryRun(
      `UPDATE presentation_templates
       SET name = $1, description = $2, outline_json = $3, updated_at = NOW()
       WHERE id = $4 AND organization_id = $5 AND is_system = false`,
      [newName, newDesc, outlineJson, id, orgId]
    );
  } else {
    // table
    await queryRun(
      `UPDATE tp_base_templates
       SET name = $1, description = $2
       WHERE id::text = $3 AND organization_id = $4 AND created_by IS NOT NULL`,
      [newName, newDesc, id, orgId]
    );
  }

  const updated = await getDeliverableTemplate(id, orgId);
  if (!updated) throw new TemplateNotFoundError(id);
  return updated;
}

/** Usuń template — tylko org-owned, nie-system. */
export async function deleteDeliverableTemplate(id: string, orgId: string): Promise<boolean> {
  const existing = await getDeliverableTemplate(id, orgId);
  if (!existing) return false;
  if (existing.isSystem) throw new TemplateForbiddenError();
  if (existing.organizationId !== orgId)
    throw new TemplateForbiddenError('Cross-org delete not allowed');

  if (existing.type === 'doc') {
    const r = await queryRun(
      `DELETE FROM report_builder_templates WHERE id = $1 AND organization_id = $2 AND is_system = false`,
      [id, orgId]
    );
    return r.changes > 0;
  }
  if (existing.type === 'deck') {
    const r = await queryRun(
      `DELETE FROM presentation_templates WHERE id = $1 AND organization_id = $2 AND is_system = false`,
      [id, orgId]
    );
    return r.changes > 0;
  }
  // table
  const r = await queryRun(
    `DELETE FROM tp_base_templates WHERE id::text = $1 AND organization_id = $2 AND created_by IS NOT NULL`,
    [id, orgId]
  );
  return r.changes > 0;
}
