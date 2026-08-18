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
import type {
  DocumentTemplate,
  TemplateSectionBlueprint,
} from './documentStudio/documentStudioTypes.js';
import { persistTemplate as persistDocStudioTemplate } from './documentStudio/documentTemplateRegistryDao.js';
import {
  approveTemplate as approveDocStudioTemplate,
  deprecateTemplate as deprecateDocStudioTemplate,
  draftTemplate as draftDocStudioTemplate,
  ensureTemplateRegistryHydrated,
  getTemplate as getDocStudioTemplate,
  reviseTemplateStructure as reviseDocStudioTemplateStructure,
  updateTemplateContent as updateDocStudioTemplateContent,
} from './documentStudio/documentTemplateService.js';
import {
  registerArtifactOrigin,
  removeTemplateArtifactByOrigin,
} from './v8/artifactRegistryService.js';

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
       WHERE (is_system = true OR organization_id = $1) AND is_active = true AND provenance_status = 'approved'
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
       WHERE is_active = true AND provenance_status = 'approved'
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
       WHERE (is_system = true OR is_public = true OR organization_id = $1) AND provenance_status = 'approved'
       ORDER BY is_system DESC, name`;

/** Legacy source: report_builder_templates (pre-existing "doc" template table). */
async function listReportBuilderDocTemplates(
  orgId: string,
  userId?: string
): Promise<DeliverableTemplate[]> {
  try {
    const rows = await queryAll<DocRow>(
      `SELECT id, name, description, is_system, is_public, report_type, sections_json, organization_id
       FROM report_builder_templates
       WHERE provenance_status = 'approved' AND (
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

// ------------------------------------------------------------------
// document_studio_templates federation ("Most Word Architect → Biblioteka",
// 2026-07-24 — brief §7/§8, decyzja Piotra "Most document_studio → rejestr").
//
// Templates authored via the Word Template Architect
// (`DocumentStudioTemplateArchitectView` → `POST /api/document-studio/templates/plan`
// → `draftTemplate()` in `documentStudio/documentTemplateService.ts`) persist to
// the CANONICAL `document_studio_templates` table (migration
// `769_document_studio_templates.sql`), via
// `documentStudio/documentTemplateRegistryDao.ts#persistTemplate`. That table
// has never been wired into `listDocTemplates` — only the LEGACY
// `report_builder_templates` table was, so architect-created templates were
// invisible in the shared Template Library (`GET /api/deliverables/templates?type=doc`,
// consumed by `useDeliverableTemplates.ts` / `OutputsLauncherModal`).
//
// Fix = READ ADAPTER, not a migration (brief §8: "adapter odczytu, nie
// migracja" — mirrors the `_KONCEPT_TEMPLATE_OUTPUTS_2026-07-10.md` doctrine
// "Delta ≠ scalać tabele"): `listDocTemplates` now federates BOTH sources and
// concatenates them; no rows are moved or duplicated across tables.
//
// Scope boundary (intentional, matches "adapter odczytu"): only the LIST path
// is federated here. `getDeliverableTemplate` / `updateDeliverableTemplate` /
// `deleteDeliverableTemplate` still only search the 3 legacy tables —
// document_studio-sourced rows are read-only from this service's point of
// view; editing/approving/deprecating them stays on the Document Studio's own
// dedicated routes (`/api/document-studio/templates/:id/{approve,deprecate,structure}`).
//
// Visibility gate: only `status = 'approved'` rows are surfaced. The Architect
// UI itself states "Drafts must be approved before they can drive Mode 3
// generation" (`DocumentStudioTemplateArchitectView.tsx`) — an unapproved,
// unreviewed draft is not yet a usable template and would be misleading (and
// non-functional, see `isTemplateUsableForGeneration`) if surfaced in a
// cross-tool picker that immediately kicks off generation
// (`OutputsLauncherModal` → `deliverableKickoff`).
//
// `SYSTEM_ORG_ID` below is a **manually-kept-in-sync literal**, mirroring the
// export of the same name in `documentStudio/documentTemplateRegistryDao.ts`
// — duplicated intentionally rather than imported, so this service (and its
// unit tests) never pull in that module's real Postgres/DbPromise import
// chain just for one string constant.
// ------------------------------------------------------------------

/** Mirrors `SYSTEM_ORG_ID` in `documentStudio/documentTemplateRegistryDao.ts`. */
const DOC_STUDIO_SYSTEM_ORG_ID = '__system__';

type DocStudioTemplateRow = {
  template_id: string;
  name: string;
  purpose: string | null;
  notes: string | null;
  is_system: boolean;
  organization_id: string;
  section_blueprint: unknown;
  document_type: string | null;
};

function safeStringifyArray(raw: unknown): string {
  if (Array.isArray(raw)) return JSON.stringify(raw);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return JSON.stringify(Array.isArray(parsed) ? parsed : []);
    } catch {
      return '[]';
    }
  }
  return '[]';
}

function mapDocStudioRow(r: DocStudioTemplateRow): DeliverableTemplate {
  const isSystem = Boolean(r.is_system);
  const meta: Record<string, unknown> = {
    report_type: r.document_type,
    sections_json: safeStringifyArray(r.section_blueprint),
    // Tags this row's origin so callers (and future migrations) can tell
    // canonical rows apart from the legacy report_builder_templates ones —
    // brief §8: "report_builder_templates i presentation_templates ...
    // (legacy, oznaczone)".
    source: 'document_studio_templates',
  };
  return {
    id: r.template_id,
    type: 'doc' as DeliverableTemplateType,
    name: r.name,
    description: (r.notes && r.notes.trim()) || r.purpose || null,
    isSystem,
    isBlank: detectIsBlank(r.name, meta),
    // System-catalogue rows live under the SYSTEM_ORG_ID sentinel, not a real
    // org — normalize to `null`, matching how mapDeckRow/mapDocRow represent
    // system ownership for the legacy tables.
    organizationId: isSystem ? null : r.organization_id,
    meta,
  };
}

/**
 * Canonical source: document_studio_templates (Word Template Architect).
 * Fail-open, mirrors the other list* helpers in this file — a missing table
 * / schema drift never blocks the legacy report_builder_templates rows from
 * showing up.
 */
async function listDocStudioDocTemplates(orgId: string): Promise<DeliverableTemplate[]> {
  try {
    const rows = await queryAll<DocStudioTemplateRow>(
      `SELECT template_id, name, purpose, notes, is_system, organization_id, section_blueprint, document_type
       FROM document_studio_templates
       WHERE status = 'approved' AND provenance_status = 'approved'
         AND (organization_id = $1 OR (organization_id = $2 AND is_system = TRUE))
       ORDER BY is_system DESC, name`,
      [orgId, DOC_STUDIO_SYSTEM_ORG_ID]
    );
    return rows.map(mapDocStudioRow);
  } catch {
    return [];
  }
}

function sortDocLikeTemplates(templates: DeliverableTemplate[]): DeliverableTemplate[] {
  return [...templates].sort((a, b) => {
    if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

async function listDocTemplates(orgId: string, userId?: string): Promise<DeliverableTemplate[]> {
  // Sequential, not Promise.all: keeps call ordering (and therefore test
  // mocking) simple/deterministic, and each source is already independently
  // fail-open — there's no latency benefit worth the added complexity here.
  const legacyRows = await listReportBuilderDocTemplates(orgId, userId);
  const docStudioRows = await listDocStudioDocTemplates(orgId);
  return sortDocLikeTemplates([...legacyRows, ...docStudioRows]);
}

// ------------------------------------------------------------------
// document_studio_templates WRITE adapter (fala sprzątania 1b, 2026-07-27)
//
// Kanon (docs/product/MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md
// §7): document_studio_templates = kanon dla szablonów 'doc',
// report_builder_templates = legacy. Do tej pory createDeliverableTemplate /
// updateDeliverableTemplate / deleteDeliverableTemplate dla type==='doc'
// pisały WYŁĄCZNIE do report_builder_templates (patrz INSERT/UPDATE/DELETE
// poniżej, teraz gałąź legacy-only). Ten blok przestawia zapis NOWYCH i
// EDYTOWANYCH szablonów 'doc' na document_studio_templates, reużywając
// istniejącego pipeline'u draft→revise→approve z documentTemplateService.ts
// (`./documentStudio/documentTemplateService.ts`) zamiast pisać nowe SQL
// INSERT/UPDATE przeciwko tej tabeli — jedyny "nowy" zapis to
// `updateTemplateContent` w tamtym pliku, który sam reużywa registryStore +
// persistTemplate (ten sam mechanizm co draftTemplate/approveTemplate).
//
// Istniejące rekordy legacy NIE są migrowane (osobna decyzja) — zmienia się
// tylko cel zapisu dla NOWYCH operacji. Odczyt/federacja (listDocTemplates
// powyżej) zostaje bez zmian — czyta oba źródła, jak dotychczas.
//
// Widoczność w Bibliotece (artifact_family='template' tab, `GET
// /api/artifacts?artifactFamily=template`): NIE rejestrujemy tu ręcznie do
// v8_output_artifacts (odwrotnie niż registerBuilderTemplateArtifactBestEffort
// poniżej, który celuje w report_template/presentation_template/
// sheet_template) — document_studio_templates ma już własny, istniejący
// backfill (`backfillDocStudioTemplatesForOrg` → origin_runtime =
// 'document_template', wired w `ensureBackfilledOutputsForOrg`,
// server/src/services/v8/artifactRegistryService.ts), który indeksuje każdy
// `status = 'approved'` wiersz automatycznie przy najbliższym odczycie —
// to jest już właściwa siatka bezpieczeństwa dla tej tabeli. Wołanie
// registerBuilderTemplateArtifactBestEffort dla 'doc' byłoby dziś wręcz
// BŁĘDNE (jego gałąź 'doc' na sztywno zakłada sourceTable:
// 'report_builder_templates').
// ------------------------------------------------------------------

/**
 * `meta.sections_json` z formularza Biblioteki ma kształt `DocSection`
 * (src/components/TemplateBuilder/templateBuilderModel.ts):
 * `{ title, block, depth, hint, ai_filled }`. `TemplateSectionBlueprint`
 * (document_studio_templates) nie ma odpowiednika dla `block`
 * (heading/paragraph/bullets/table/kpi/chart) ani `ai_filled` — świadomie
 * pomijane tutaj (udokumentowana luka pól, nie cichy błąd mapowania).
 * `depth` mapuje się 1:1 na `expectedLengthHint` (identyczny enum
 * short/medium/long), `hint` na `purpose`.
 */
function docSectionsJsonToBlueprint(raw: unknown): TemplateSectionBlueprint[] {
  const arr = typeof raw === 'string' ? safeParseArray(raw) : Array.isArray(raw) ? raw : [];
  const mapped: TemplateSectionBlueprint[] = [];
  for (const entry of arr as any[]) {
    const title = typeof entry?.title === 'string' ? entry.title.trim() : '';
    if (!title) continue;
    const depth = entry?.depth === 'short' || entry?.depth === 'long' ? entry.depth : 'medium';
    mapped.push({
      title,
      level: 1,
      purpose: typeof entry?.hint === 'string' ? entry.hint.trim() : '',
      required: false,
      expectedLengthHint: depth,
    });
  }
  return mapped;
}

/** `DocumentTemplate` (documentTemplateService in-memory shape) → `DeliverableTemplate`
 *  (this file's shared API shape). Mirrors `mapDocStudioRow` above, which does
 *  the same conversion starting from a raw SQL row instead of the service object. */
function mapDocStudioTemplateToDeliverable(t: DocumentTemplate): DeliverableTemplate {
  const meta: Record<string, unknown> = {
    report_type: t.documentType,
    sections_json: JSON.stringify(t.sectionBlueprint ?? []),
    source: 'document_studio_templates',
  };
  const isSystem = t.organizationId === DOC_STUDIO_SYSTEM_ORG_ID;
  return {
    id: t.templateId,
    type: 'doc',
    name: t.name,
    description: (t.notes && t.notes.trim()) || t.purpose || null,
    isSystem,
    isBlank: detectIsBlank(t.name, meta),
    organizationId: isSystem ? null : t.organizationId,
    meta,
  };
}

/**
 * Explicit, awaited durable write to `document_studio_templates` — on top of
 * documentTemplateService's own fire-and-forget persistence (every mutator
 * there does `void persistTemplate(...).catch(() => undefined)`). Needed
 * here because `listDocStudioDocTemplates` (this file) reads Postgres
 * directly rather than the in-process registry: an un-awaited write could
 * lose the create→list race for a caller that lists immediately after
 * creating (exactly the T1 route test this fala's task requires).
 * `persistTemplate` is an upsert (`ON CONFLICT ... DO UPDATE`), so calling
 * it again here after the fire-and-forget call is always safe/idempotent.
 */
async function persistDocStudioTemplateDurable(template: DocumentTemplate): Promise<void> {
  const result = await persistDocStudioTemplate(template);
  if (!result.ok) {
    logger.warn(
      `${LOG_PREFIX} durable persist to document_studio_templates failed for ${template.templateId} — in-process registry has the row, but the DB write did not land this attempt`
    );
  }
}

/** Fetch a 'doc' template that lives in document_studio_templates (not the
 *  legacy report_builder_templates table) for this org, or `null`. Hydrates
 *  the in-process registry first — `getDeliverableTemplate` may be the FIRST
 *  read this process does for `orgId` (e.g. a different request/worker
 *  created the template), so without hydration a cold registryStore would
 *  incorrectly report "not found" for a template that exists in Postgres.
 *  Deprecated templates are treated as not-found (soft-delete semantics,
 *  matching `deleteDeliverableTemplate`'s use of `deprecateTemplate` below). */
async function getDocStudioDocTemplateForDeliverable(
  id: string,
  orgId: string
): Promise<DeliverableTemplate | null> {
  await ensureTemplateRegistryHydrated(orgId);
  const template = getDocStudioTemplate(id, orgId);
  if (!template || template.status === 'deprecated') return null;
  return mapDocStudioTemplateToDeliverable(template);
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
       WHERE provenance_status = 'approved'
       ORDER BY is_featured DESC, name`;

async function listTableTemplates(orgId: string, userId?: string): Promise<DeliverableTemplate[]> {
  try {
    const rows = await queryAll<TableRow>(
      `SELECT id, name, description, is_featured, category, schema_snapshot, created_by, organization_id
       FROM tp_base_templates
       WHERE provenance_status = 'approved' AND (
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

  // doc — document_studio_templates (canon; legacy report_builder_templates
  // row above takes precedence on id collision, which in practice never
  // happens: the two id schemes are disjoint — uuid vs. `doc-template-*`).
  const docStudio = await getDocStudioDocTemplateForDeliverable(id, orgId);
  if (docStudio) return docStudio;

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
            // `sheet_template` also contains historical entries. This record was
            // authored by the current workbook builder, so persist its real
            // lineage explicitly instead of inferring it from the runtime name.
            source: 'canonical',
            legacy: false,
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
      // Dead from `createDeliverableTemplate` since the fala sprzątania 1b
      // canon rewrite (2026-07-27) — 'doc' now writes to
      // document_studio_templates and never calls this function (see the
      // "document_studio_templates WRITE adapter" comment block above
      // `docSectionsJsonToBlueprint`). Left in place (not deleted) only in
      // case another caller ever passes type:'doc' here directly.
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

/** Keep Template Library lifecycle metadata aligned with the canonical workbook row. */
export async function syncWorkbookTemplateArtifactLifecycle(params: {
  template: DeliverableTemplate;
  status: 'draft' | 'approved' | 'deprecated';
  version: string;
  historyCount: number;
  organizationId: string;
  userId: string;
}): Promise<void> {
  const { template, status, version, historyCount, organizationId, userId } = params;
  await registerArtifactOrigin({
    organizationId,
    outputType: 'sheet',
    artifactFamily: 'template',
    originRuntime: 'sheet_template',
    originRecordId: template.id,
    titleSnapshot: template.name,
    ownerUserId: userId,
    createdBy: userId,
    deliveryState: status === 'approved' ? 'published' : status,
    visibilityScope: 'organization',
    originSummary: {
      template: {
        canonicalTemplateId: template.id,
        originRuntime: 'sheet_template',
        source: 'canonical',
        legacy: false,
        orphaned: false,
        scope: 'organization',
        status,
        description: template.description ?? '',
        structureBlueprint: template.meta.schema_snapshot ?? {},
        metadata: { version, historyCount, updatedAt: new Date().toISOString() },
      },
      sourceTable: 'tp_base_templates',
    },
  });
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
    // Canon rewrite (fala sprzątania 1b, 2026-07-27): write to
    // document_studio_templates instead of legacy report_builder_templates —
    // see the "document_studio_templates WRITE adapter" block above for the
    // full rationale. Reuses documentTemplateService's draft→revise→approve
    // pipeline rather than a raw INSERT.
    const purpose = (desc && desc.trim()) || `Szablon: ${name}`;
    const { template: drafted } = draftDocStudioTemplate({
      organizationId: orgId,
      userId,
      input: { name, purpose, notes: desc?.trim() || undefined },
    });

    const sectionBlueprint = docSectionsJsonToBlueprint(metaObj.sections_json);
    const withSections =
      sectionBlueprint.length > 0
        ? reviseDocStudioTemplateStructure({
            templateId: drafted.templateId,
            organizationId: orgId,
            userId,
            sections: sectionBlueprint,
          })
        : drafted;

    // Auto-approve: unlike the AI Template Architect flow (draft → human
    // review → approve), a Template Library template is authored directly,
    // end-to-end, by the same user in one step — there is no separate
    // review step to gate on. Approval is required for the template to be
    // lifecycle-approved. MAT-POL separately requires governed provenance
    // approval before list/generation surfaces expose it; creation alone does
    // not fabricate that rights evidence. This preserves the existing
    // document lifecycle while keeping provenance fail-closed, matching the
    // legacy report_builder_templates behaviour of "visible/usable
    // immediately after creation".
    const approved = approveDocStudioTemplate({
      templateId: withSections.templateId,
      organizationId: orgId,
      userId,
    });

    await persistDocStudioTemplateDurable(approved);
    return mapDocStudioTemplateToDeliverable(approved);
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
  orgId: string,
  userId?: string
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

  if (existing.type === 'doc' && existing.meta.source === 'document_studio_templates') {
    // Canon rewrite (fala sprzątania 1b): edits to a document_studio_templates-
    // backed 'doc' template go through updateTemplateContent (reuses
    // registryStore + persistTemplate, the same plumbing draftTemplate /
    // approveTemplate use) — NOT a new SQL UPDATE against that table.
    await ensureTemplateRegistryHydrated(orgId);
    const sections =
      metaObj.sections_json !== undefined
        ? docSectionsJsonToBlueprint(metaObj.sections_json)
        : undefined;
    let updatedTemplate: DocumentTemplate;
    try {
      updatedTemplate = updateDocStudioTemplateContent({
        templateId: id,
        organizationId: orgId,
        userId: userId ?? '',
        name: updates.name,
        notes: newDesc ?? undefined,
        sections: sections && sections.length > 0 ? sections : undefined,
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'template_not_found') {
        throw new TemplateNotFoundError(id);
      }
      throw err;
    }
    await persistDocStudioTemplateDurable(updatedTemplate);
    return mapDocStudioTemplateToDeliverable(updatedTemplate);
  } else if (existing.type === 'doc') {
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
    const schemaSnapshot =
      metaObj.schema_snapshot !== undefined
        ? typeof metaObj.schema_snapshot === 'string'
          ? metaObj.schema_snapshot
          : JSON.stringify(metaObj.schema_snapshot)
        : JSON.stringify(existing.meta.schema_snapshot ?? {});
    await queryRun(
      `UPDATE tp_base_templates
       SET name = $1, description = $2, schema_snapshot = $3::jsonb
       WHERE id::text = $4 AND organization_id = $5 AND created_by IS NOT NULL`,
      [newName, newDesc, schemaSnapshot, id, orgId]
    );
  }

  const updated = await getDeliverableTemplate(id, orgId);
  if (!updated) throw new TemplateNotFoundError(id);
  return updated;
}

/** Usuń template — tylko org-owned, nie-system. */
export async function deleteDeliverableTemplate(
  id: string,
  orgId: string,
  userId?: string
): Promise<boolean> {
  const existing = await getDeliverableTemplate(id, orgId);
  if (!existing) return false;
  if (existing.isSystem) throw new TemplateForbiddenError();
  if (existing.organizationId !== orgId)
    throw new TemplateForbiddenError('Cross-org delete not allowed');

  if (existing.type === 'doc' && existing.meta.source === 'document_studio_templates') {
    // Canon rewrite (fala sprzątania 1b): "delete" for a document_studio_templates
    // row = deprecateTemplate (existing state transition — soft-delete, no row
    // is ever hard-deleted from that table anywhere in the codebase; matches
    // `listDocStudioDocTemplates`'s `status = 'approved'` filter, so a
    // deprecated row disappears from every read path exactly like a deletion
    // would). NOT a new DELETE statement against document_studio_templates.
    await ensureTemplateRegistryHydrated(orgId);
    try {
      const deprecated = deprecateDocStudioTemplate({
        templateId: id,
        organizationId: orgId,
        userId: userId ?? '',
        reason: 'template_library_delete',
      });
      await persistDocStudioTemplateDurable(deprecated);
      return true;
    } catch (err) {
      if (err instanceof Error && err.message === 'template_not_found') return false;
      throw err;
    }
  }
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
  if (r.changes > 0) {
    await removeTemplateArtifactByOrigin({
      organizationId: orgId,
      originRuntime: 'sheet_template',
      originRecordId: id,
    }).catch((err: unknown) =>
      logger.warn(`${LOG_PREFIX} workbook template index cleanup failed`, { err, id })
    );
  }
  return r.changes > 0;
}
