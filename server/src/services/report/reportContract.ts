/**
 * reportContract.ts — KONTRAKT SILNIKA RAPORTÓW F5 (keystone Fazy 1)
 * =====================================================================
 * Cienki interfejs nad kanonem `reportBuilderService` (mount `/api/report-builder`,
 * wersjonowanie `report_builder_versions`). Rozstrzyga sprzeczność panelu
 * (Results chce snapshot-immutable, PM chce live-pull) JEDNĄ regułą:
 *
 *        ┌──────────────────────────────────────────────────────────┐
 *        │  live  = PATRZEĆ  (dashboard, podgląd — bez artefaktu)    │
 *        │  snapshot = PUBLIKOWAĆ (immutable, grounding, eksport)    │
 *        └──────────────────────────────────────────────────────────┘
 *
 * To NIE jest wybór „albo-albo" — to dwie fazy życia tego samego raportu.
 * KAŻDY publish/eksport przechodzi przez snapshot → godzi Results (immutable)
 * z PM (live). Cztery tryby (rdzeń §4.2):
 *
 *   TRYB 2  readLive(defId, scope)              → dashboard/podgląd, render świeży
 *   TRYB 1  createSnapshot(defId, scope)        → snapshotId immutable (publikacja/grounding)
 *   TRYB 3  exportFile(snapshotId, format)      → DOCX/PPTX/XLSX/PDF (Finance/workbook) — ZAWSZE od snapshotu
 *   TRYB 4  fromTemplate(templateId)            → structural input (kształt, nie dane)
 *
 * ŹRÓDŁO PRAWDY: `Harvard/wdrozenie-100/_KONCEPT_RDZEN_2026-07-10.md` §4.
 * Definicje raportów żyją w tabeli `report_definitions` (migracja 910), NIE w hardkodzie.
 *
 * ZAKAZ TWARDY (reguła rdzenia): żaden nowy route/serwis `*report*` — wszystko przez ten
 * kontrakt i kanon. Ten plik jest cienki celowo: deleguje do kanonu, egzekwuje regułę,
 * a miejsca wymagające generalizacji (snapshot-store z kpiReportSnapshot, persystencja
 * lineage/EvidenceEnvelope, silniki eksportu) są oznaczone jawnym TODO — nie fantomem.
 */

import { parseMaybeJson } from '../../utils/pgFlags.js';
import { queryAll, queryOne } from '../../utils/queryHelpers.js';
import { validateUUID } from '../../utils/validation.js';
import ReportBuilderService from '../reportBuilderService.js';

/* ────────────────────────────────────────────────────────────────────────────
   Typy
   ──────────────────────────────────────────────────────────────────────────── */

export type ReportReadMode = 'live' | 'snapshot';
export type ReportExportFormat = 'docx' | 'pptx' | 'xlsx' | 'pdf';

/** Wiersz rejestru `report_definitions` (migracja 910), znormalizowany do camelCase. */
export interface ReportDefinitionRecord {
  id: string;
  organizationId: string | null; // NULL = definicja systemowa
  key: string;
  name: string;
  kind: string; // np. 'EXECUTION_PACK'
  audience: string | null;
  cadence: string | null;
  scope: string | null;
  readMode: ReportReadMode;
  /** Lista sekcji raportu (section_specs). */
  sections: string[];
  /** Wiązanie danych + prezentacja: { dataSources[], ragLogic, followUpActions[], icon, highlights[] }. */
  sourceBinding: Record<string, unknown>;
  templateRef: string | null;
  isSystem: boolean;
  createdAt: string;
}

/**
 * Zakres odczytu — CO liczymy (okres jest obiektem pierwszej klasy, wymaganie Results).
 * `reportId` pozwala zamrozić istniejący raport-artefakt (ścieżka realna dziś);
 * `entityType`/`entityIds` opisują materializację od read-modeli (ścieżka do generalizacji).
 */
export interface ReportScope {
  organizationId: string;
  createdBy: string;
  projectId?: string;
  entityType?: string;
  entityIds?: string[];
  periodFrom?: string;
  periodTo?: string;
  /** Jeśli podany — snapshot zamraża TEN istniejący raport (ścieżka wspierana przez kanon dziś). */
  reportId?: string;
  title?: string;
}

/** TRYB 2 — widok live: definicja + zadeklarowane read-modele; render pozostaje świeży, bez artefaktu. */
export interface LiveReportView {
  readMode: 'live';
  definition: ReportDefinitionRecord;
  /** Kanoniczne read-modele deklarowane przez definicję (dataSources) — front renderuje na żywo. */
  readModels: string[];
  capturedAt: string;
  /**
   * live NIE materializuje artefaktu. Aby opublikować/wyeksportować widok live →
   * przejdź przez createSnapshot (reguła „nie istnieje eksport z live").
   */
  publishable: false;
}

/** TRYB 1 — snapshot immutable: uchwyt do zamrożonej publikacji (grounding, eksport). */
export interface ReportSnapshot {
  snapshotId: string; // = versionId (report_builder_versions są append-only → immutable)
  definitionId: string;
  reportId: string;
  organizationId: string;
  capturedAt: string;
  period: { from?: string; to?: string };
  immutable: true;
  /**
   * Koperta lineage/dowodu. Persystencja pełnego EvidenceEnvelope + lineage.source_rows[]
   * do wierszy źródłowych = TODO Fazy 1 (rdzeń §3.2, §4.2) — tu deklarowana strukturalnie.
   */
  lineage: { sourceRows: unknown[]; envelope: Record<string, unknown> | null };
}

/* ────────────────────────────────────────────────────────────────────────────
   Rejestr definicji (report_definitions) — odczyt
   ──────────────────────────────────────────────────────────────────────────── */

interface DefinitionRow {
  id: string;
  organization_id: string | null;
  key: string;
  name: string;
  kind: string;
  audience: string | null;
  cadence: string | null;
  scope: string | null;
  read_mode: string;
  sections_json: unknown;
  source_binding: unknown;
  template_ref: string | null;
  is_system: boolean | number | null;
  created_at: string;
}

function mapDefinition(row: DefinitionRow): ReportDefinitionRecord {
  return {
    id: row.id,
    organizationId: row.organization_id ?? null,
    key: row.key,
    name: row.name,
    kind: row.kind,
    audience: row.audience ?? null,
    cadence: row.cadence ?? null,
    scope: row.scope ?? null,
    readMode: (row.read_mode as ReportReadMode) || 'live',
    sections: parseMaybeJson<string[]>(row.sections_json, []),
    sourceBinding: parseMaybeJson<Record<string, unknown>>(row.source_binding, {}),
    templateRef: row.template_ref ?? null,
    isSystem: Boolean(row.is_system),
    createdAt: row.created_at,
  };
}

/**
 * Definicje widoczne dla organizacji: systemowe (organization_id IS NULL) + org-własne.
 * To jest źródło katalogu Execution (zastępuje hardkod `ExecutionHub.reportCatalog`).
 */
export async function listDefinitions(
  organizationId: string,
  opts?: { kind?: string }
): Promise<ReportDefinitionRecord[]> {
  // Day 314 — `report_definitions.organization_id` is typed `uuid`, but
  // `organizations.id` is TEXT and legacy tenants carry non-UUID ids. Binding
  // such an id made Postgres abort the whole statement with
  // `invalid input syntax for type uuid`, so GET /api/report-builder/definitions
  // returned 500 and those tenants saw no report catalog at all. A tenant whose
  // id cannot be a uuid simply owns no org-specific rows — it must still get the
  // system catalog (organization_id IS NULL), which is what Execution renders.
  const orgAddressable = validateUUID(organizationId);
  const params: unknown[] = orgAddressable ? [organizationId] : [];
  let kindClause = '';
  const orgClause = orgAddressable
    ? '(organization_id IS NULL OR organization_id = ?)'
    : 'organization_id IS NULL';
  if (opts?.kind) {
    kindClause = ' AND kind = ?';
    params.push(opts.kind);
  }
  const rows = await queryAll<DefinitionRow>(
    `SELECT * FROM report_definitions
      WHERE ${orgClause}${kindClause}
      ORDER BY is_system DESC, name ASC`,
    params
  );
  return rows.map(mapDefinition);
}

export async function getDefinition(defId: string): Promise<ReportDefinitionRecord | null> {
  const row = await queryOne<DefinitionRow>(
    `SELECT * FROM report_definitions WHERE id = ? LIMIT 1`,
    [defId]
  );
  return row ? mapDefinition(row) : null;
}

/* ────────────────────────────────────────────────────────────────────────────
   TRYB 2 — LIVE (patrzeć)
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * readLive — widok dashboardowy: świeży render z read-modeli deklarowanych przez definicję.
 * NIE tworzy artefaktu. Publikacja/eksport tego widoku MUSI przejść przez createSnapshot.
 */
export async function readLive(defId: string, scope: ReportScope): Promise<LiveReportView> {
  const definition = await getDefinition(defId);
  if (!definition) throw new Error(`report_definition not found: ${defId}`);
  const dataSources = Array.isArray((definition.sourceBinding as any)?.dataSources)
    ? ((definition.sourceBinding as any).dataSources as string[])
    : [];
  return {
    readMode: 'live',
    definition,
    readModels: dataSources,
    capturedAt: new Date().toISOString(),
    publishable: false,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   TRYB 1 — SNAPSHOT (publikować)
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * createSnapshot — zamraża raport w niezmienny snapshot (publikacja/grounding).
 * Reguła: to JEDYNA brama do publikacji i eksportu.
 *
 * Ścieżka realna dziś (wspierana przez kanon): scope.reportId wskazuje istniejący raport
 * → tworzymy niezmienną WERSJĘ (`report_builder_versions` = append-only) i zwracamy jej id
 * jako snapshotId. `refresh` = nowa wersja (stara zostaje niezmienna — wymaganie Results).
 *
 * TODO (rdzeń §4.3 krok 1 — generalizacja): materializacja snapshotu WPROST z read-modeli
 * (period + entityType/entityIds) bez wcześniejszego raportu — uogólnić z `kpiReportSnapshotService`
 * (już deleguje do createReport({sourceType:'RESULTS_KPI_REPORT'})). Wtedy snapshot niesie
 * lineage.source_rows[] + EvidenceEnvelope (§3.2). Do tego czasu ta ścieżka rzuca jawny błąd.
 */
export async function createSnapshot(defId: string, scope: ReportScope): Promise<ReportSnapshot> {
  const definition = await getDefinition(defId);
  if (!definition) throw new Error(`report_definition not found: ${defId}`);

  if (!scope.reportId) {
    // Generalizacja snapshot-store z kpiReportSnapshot — poza zakresem tego kontraktu (Faza 1, §4.3/1).
    throw new Error(
      'createSnapshot: materializacja snapshotu z read-modeli (bez reportId) wymaga ' +
        'generalizacji snapshot-store z kpiReportSnapshotService — TODO rdzeń §4.3 krok 1. ' +
        'Podaj scope.reportId aby zamrozić istniejący raport.'
    );
  }

  const version = await ReportBuilderService.createVersion(
    scope.reportId,
    scope.organizationId,
    scope.createdBy,
    {
      changeType: 'manual',
      changeSummary: `Snapshot freeze — definicja ${definition.id} (${definition.name})`,
    }
  );

  const versionId = String((version as any)?.id ?? (version as any)?.version_id ?? scope.reportId);

  return {
    snapshotId: versionId,
    definitionId: definition.id,
    reportId: scope.reportId,
    organizationId: scope.organizationId,
    capturedAt: new Date().toISOString(),
    period: { from: scope.periodFrom, to: scope.periodTo },
    immutable: true,
    // TODO (§3.2): wypełnić lineage.source_rows[] (tabela+id+wartość per liczba) + EvidenceEnvelope.
    lineage: { sourceRows: [], envelope: null },
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   TRYB 3 — FILE-EXPORT (DOCX/PPTX/XLSX/PDF) — ZAWSZE od snapshotu
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * exportFile — materializacja pliku ZAWSZE od snapshotu (nigdy od live — lekcja split-brain
 * Excel/Sheet: jeden kanał materializacji). Każdy eksport dostaje stronę „Kluczowe założenia
 * i źródła" z EvidenceEnvelope (§3.3 — dopięcie przy wpięciu silników).
 *
 * TODO (rdzeń §4.2 tryb 3): wpiąć realne silniki renderu — workbook WQ-01..09 (xlsx),
 * bundlePptxRuntime (deck), docGenerationRuntime/documentStudio (doc). Tu rejestrujemy
 * eksport przez kanon (`createExportRecord`); render pliku dołączamy w kroku wpięcia silników.
 */
export async function exportFile(
  snapshot: ReportSnapshot,
  format: ReportExportFormat,
  ctx: { exportedBy: string; filePath?: string; fileSize?: number; language?: string }
): Promise<{ exportId: string; snapshotId: string; format: ReportExportFormat }> {
  if (!snapshot?.immutable || !snapshot.snapshotId) {
    throw new Error(
      'exportFile: eksport dozwolony WYŁĄCZNIE od snapshotu (reguła: nie ma eksportu z live).'
    );
  }
  const record = await ReportBuilderService.createExportRecord({
    reportId: snapshot.reportId,
    reportType: snapshot.definitionId,
    format,
    filePath: ctx.filePath || '', // TODO: ścieżka z realnego silnika renderu
    fileSize: ctx.fileSize ?? 0,
    language: ctx.language,
    exportedBy: ctx.exportedBy,
  });
  return { exportId: record.id, snapshotId: snapshot.snapshotId, format };
}

/* ────────────────────────────────────────────────────────────────────────────
   TRYB 4 — STRUCTURAL-TEMPLATE (kształt, nie dane)
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * fromTemplate — INPUT deklarujący STRUKTURĘ (sections/outline) dla trybów 1-3.
 * Template nigdy nie niesie danych ani brandingu (motyw = Brand Kit org). Deleguje do kanonu.
 */
export async function fromTemplate(
  templateId: string,
  scope: ReportScope,
  options?: { assessmentId?: string; projectId?: string; title?: string }
): Promise<{ reportId: string }> {
  const report = await ReportBuilderService.generateFromTemplate(
    templateId,
    scope.organizationId,
    scope.createdBy,
    {
      assessmentId: options?.assessmentId,
      projectId: options?.projectId ?? scope.projectId,
      title: options?.title ?? scope.title,
    }
  );
  return { reportId: String((report as any).id) };
}

const ReportContract = {
  listDefinitions,
  getDefinition,
  readLive,
  createSnapshot,
  exportFile,
  fromTemplate,
};

export default ReportContract;
