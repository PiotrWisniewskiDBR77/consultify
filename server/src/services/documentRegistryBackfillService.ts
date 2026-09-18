/**
 * DOC-0 etap 1 (DEC-594 / DEC-595): porządek w rejestrze listowym dokumentów.
 *
 * Treść istnieje w `wave5_artifacts`, ale 119 z 238 wierszy nie ma odpowiednika
 * w `v8_output_artifacts` — istniejący `backfillNativeArtifactsForOrg`
 * (artifactRegistryService.ts:1950) celowo obejmuje TYLKO `artifact_type='report'`
 * z `provenance_json LIKE '%documentStudioSchema%'`, więc arkusze, decki i
 * research_reporty zostają poza listą. Ten serwis dopełnia resztę przez ten sam
 * idempotentny `registerArtifactOrigin` (drugi przebieg = 0 wstawień).
 *
 * Osobno: 6 wierszy `artifact_family='document'` nie ma treści w ŻADNYM
 * rejestrze (origin_runtime='report' bez rekordu w `report_builder_reports`).
 * DEC-595 każe im zniknąć z listy odwracalnie i z logiem — bez DDL, istniejącym
 * `delivery_state='archived'`; `restoreArchivedDocumentRows` cofa dokładnie tę
 * zmianę, przywracając stan sprzed archiwizacji.
 */
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { resolveArtifactContent } from './artifacts/artifactContentResolverService.js';
import {
  deriveArtifactVisibilityScope,
  mapPresentationStatusToDeliveryState,
  mapReportStatusToDeliveryState,
  registerArtifactOrigin,
} from './v8/artifactRegistryService.js';

const LOG_PREFIX = '[doc0-registry]';
const FALLBACK_ACTOR = 'system';
const BACKFILL_SOURCE_TYPE = 'doc0_native_backfill';

export type ListOutputType = 'report' | 'presentation' | 'sheet';
export type ListArtifactFamily = 'document' | 'presentation' | 'sheet';

const LIST_SHAPE_BY_NATIVE_TYPE: Record<
  string,
  { outputType: ListOutputType; artifactFamily: ListArtifactFamily }
> = {
  report: { outputType: 'report', artifactFamily: 'document' },
  research_report: { outputType: 'report', artifactFamily: 'document' },
  slide_deck: { outputType: 'presentation', artifactFamily: 'presentation' },
  spreadsheet: { outputType: 'sheet', artifactFamily: 'sheet' },
};

/** `wave5_artifacts.artifact_type` → para (outputType, artifactFamily) rejestru listowego. */
export function listShapeForNativeArtifactType(
  artifactType: string | null | undefined
): { outputType: ListOutputType; artifactFamily: ListArtifactFamily } | null {
  return LIST_SHAPE_BY_NATIVE_TYPE[String(artifactType ?? '').trim()] ?? null;
}

export interface UnlistedNativeArtifactRow {
  artifactId: string;
  organizationId: string;
  artifactType: string | null;
  status: string | null;
  title: string | null;
  projectId: string | null;
  createdBy: string | null;
  contentLength: number;
}

/**
 * Wiersze `wave5_artifacts` Z treścią, bez wiersza w rejestrze listowym
 * (brak linku `origin_runtime='native_artifact'` dla tego samego org).
 */
export async function findUnlistedNativeArtifacts(
  params: { organizationId?: string } = {}
): Promise<UnlistedNativeArtifactRow[]> {
  const scoped = Boolean(params.organizationId);
  const rows = await dbAll<{
    artifact_id: string;
    organization_id: string;
    artifact_type: string | null;
    status: string | null;
    title: string | null;
    project_id: string | null;
    created_by: string | null;
    content_length: number | string | null;
  }>(
    `SELECT a.artifact_id, a.organization_id, a.artifact_type, a.status, a.title,
            a.project_id, a.created_by, LENGTH(COALESCE(a.content, '')) AS content_length
       FROM wave5_artifacts a
       LEFT JOIN v8_artifact_origin_links l
         ON l.organization_id = a.organization_id
        AND l.origin_runtime = 'native_artifact'
        AND l.origin_record_id = a.artifact_id
      WHERE l.link_id IS NULL
        AND COALESCE(a.content, '') <> ''
        ${scoped ? 'AND a.organization_id = ?' : ''}
      ORDER BY a.created_at ASC`,
    scoped ? [params.organizationId as string] : [],
    { fallback: true }
  );

  return (rows || []).map((row) => ({
    artifactId: row.artifact_id,
    organizationId: row.organization_id,
    artifactType: row.artifact_type,
    status: row.status,
    title: row.title,
    projectId: row.project_id,
    createdBy: row.created_by,
    contentLength: Number(row.content_length ?? 0),
  }));
}

export interface NativeBackfillSummary {
  dryRun: boolean;
  scanned: number;
  inserted: number;
  failed: number;
  skippedUnsupportedType: number;
  byFamily: Record<string, number>;
}

/**
 * DEC-594: dopisuje brakujące wiersze listy dla treści z `wave5_artifacts`.
 * Idempotentne — `registerArtifactOrigin` rozpoznaje istniejący link po
 * (organization_id, origin_runtime, origin_record_id) i nie tworzy duplikatu.
 */
export async function backfillUnlistedNativeArtifacts(
  params: { organizationId?: string; dryRun?: boolean } = {}
): Promise<NativeBackfillSummary> {
  const dryRun = params.dryRun === true;
  const rows = await findUnlistedNativeArtifacts(params);
  const summary: NativeBackfillSummary = {
    dryRun,
    scanned: rows.length,
    inserted: 0,
    failed: 0,
    skippedUnsupportedType: 0,
    byFamily: {},
  };

  for (const row of rows) {
    const shape = listShapeForNativeArtifactType(row.artifactType);
    if (!shape) {
      summary.skippedUnsupportedType += 1;
      logger.warn(
        `${LOG_PREFIX} skipped ${row.artifactId}: unsupported wave5 artifact_type ${String(
          row.artifactType
        )}`
      );
      continue;
    }
    if (dryRun) {
      summary.inserted += 1;
      summary.byFamily[shape.artifactFamily] = (summary.byFamily[shape.artifactFamily] || 0) + 1;
      continue;
    }

    const deliveryState =
      shape.outputType === 'presentation'
        ? mapPresentationStatusToDeliveryState(row.status)
        : mapReportStatusToDeliveryState(row.status);

    try {
      const registered = await registerArtifactOrigin({
        organizationId: row.organizationId,
        outputType: shape.outputType,
        artifactFamily: shape.artifactFamily,
        originRuntime: 'native_artifact',
        originRecordId: row.artifactId,
        titleSnapshot: row.title || 'Untitled artifact',
        ownerUserId: row.createdBy,
        createdBy: row.createdBy || FALLBACK_ACTOR,
        deliveryState,
        visibilityScope: deriveArtifactVisibilityScope({
          outputType: shape.outputType,
          projectId: row.projectId,
          ownerUserId: row.createdBy,
          isBackfill: true,
        }),
        projectId: row.projectId,
        originSummary: {
          sourceType: BACKFILL_SOURCE_TYPE,
          sourceTable: 'wave5_artifacts',
          nativeType: row.artifactType,
          nativeStatus: row.status,
          contentLength: row.contentLength,
        },
      });
      if (!registered) {
        summary.failed += 1;
        continue;
      }
      summary.inserted += 1;
      summary.byFamily[shape.artifactFamily] = (summary.byFamily[shape.artifactFamily] || 0) + 1;
      logger.info(
        `${LOG_PREFIX} backfilled ${row.artifactId} → ${registered.artifactId} ` +
          `(${shape.artifactFamily}/${shape.outputType}, delivery_state=${deliveryState}, org=${row.organizationId})`
      );
    } catch (error: unknown) {
      summary.failed += 1;
      logger.warn(
        `${LOG_PREFIX} backfill failed for ${row.artifactId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  logger.info(
    `${LOG_PREFIX} backfill finished: scanned=${summary.scanned} inserted=${summary.inserted} ` +
      `failed=${summary.failed} skippedUnsupportedType=${summary.skippedUnsupportedType} dryRun=${dryRun}`
  );
  return summary;
}

export type DocumentContentRegistry = 'artifact_content' | 'work_canvas_drafts' | null;

export interface DocumentContentLocation {
  registry: DocumentContentRegistry;
  /** Kod błędu z `resolveArtifactContent`, gdy treści nie ma w kontrakcie artefaktu. */
  reason: string | null;
}

/**
 * Jedno źródło prawdy o tym, GDZIE leży treść dokumentu z listy: najpierw
 * wspólny kontrakt `GET /api/artifacts/:id/content` (wave5 + report_builder),
 * potem — dla 9 wierszy zapisanych przez kanwę czatu z origin_runtime
 * 'native_artifact' — `work_canvas_drafts`. `null` = treść nie istnieje nigdzie.
 */
export async function locateDocumentContent(params: {
  artifactId: string;
  organizationId: string;
  originRuntime: string;
  originRecordId: string;
}): Promise<DocumentContentLocation> {
  let reason: string | null = null;
  try {
    await resolveArtifactContent({
      artifactId: params.artifactId,
      organizationId: params.organizationId,
    });
    return { registry: 'artifact_content', reason: null };
  } catch (error: unknown) {
    reason =
      (error as { code?: string })?.code || (error instanceof Error ? error.message : 'error');
  }

  const draft = await dbGet<{ id: string }>(
    `SELECT id FROM work_canvas_drafts WHERE id = ? AND organization_id = ?`,
    [params.originRecordId, params.organizationId],
    { fallback: true }
  );
  if (draft?.id) return { registry: 'work_canvas_drafts', reason };

  return { registry: null, reason };
}

export interface ContentlessDocumentRow {
  artifactId: string;
  organizationId: string;
  title: string | null;
  deliveryState: string;
  originRuntime: string;
  originRecordId: string;
  reason: string | null;
}

/** Wiersze listy `artifact_family='document'`, których treść nie istnieje w żadnym rejestrze. */
export async function findContentlessDocumentRows(
  params: { organizationId?: string } = {}
): Promise<ContentlessDocumentRow[]> {
  const scoped = Boolean(params.organizationId);
  const rows = await dbAll<{
    artifact_id: string;
    organization_id: string;
    title_snapshot: string | null;
    delivery_state: string;
    origin_runtime: string;
    origin_record_id: string;
  }>(
    `SELECT a.artifact_id, a.organization_id, a.title_snapshot, a.delivery_state,
            l.origin_runtime, l.origin_record_id
       FROM v8_output_artifacts a
       JOIN v8_artifact_origin_links l
         ON l.artifact_id = a.artifact_id
        AND l.organization_id = a.organization_id
        AND l.is_primary_origin = 1
      WHERE a.artifact_family = 'document'
        ${scoped ? 'AND a.organization_id = ?' : ''}
      ORDER BY a.created_at ASC`,
    scoped ? [params.organizationId as string] : [],
    { fallback: true }
  );

  const contentless: ContentlessDocumentRow[] = [];
  for (const row of rows || []) {
    const located = await locateDocumentContent({
      artifactId: row.artifact_id,
      organizationId: row.organization_id,
      originRuntime: row.origin_runtime,
      originRecordId: row.origin_record_id,
    });
    if (located.registry) continue;
    contentless.push({
      artifactId: row.artifact_id,
      organizationId: row.organization_id,
      title: row.title_snapshot,
      deliveryState: row.delivery_state,
      originRuntime: row.origin_runtime,
      originRecordId: row.origin_record_id,
      reason: located.reason,
    });
  }
  return contentless;
}

export interface ArchivedDocumentEntry {
  artifactId: string;
  organizationId: string;
  previousDeliveryState: string;
  title: string | null;
}

export interface ArchiveSummary {
  dryRun: boolean;
  scanned: number;
  archived: number;
  alreadyArchived: number;
  entries: ArchivedDocumentEntry[];
}

/**
 * DEC-595: sieroty 404 dostają `delivery_state='archived'` (istniejące pole,
 * zero DDL). Każdy wiersz idzie do loga ze stanem sprzed zmiany, a zwrócona
 * lista `entries` jest wejściem `restoreArchivedDocumentRows` — odwracalność.
 */
export async function archiveContentlessDocumentRows(
  params: { organizationId?: string; dryRun?: boolean } = {}
): Promise<ArchiveSummary> {
  const dryRun = params.dryRun === true;
  const rows = await findContentlessDocumentRows(params);
  const summary: ArchiveSummary = {
    dryRun,
    scanned: rows.length,
    archived: 0,
    alreadyArchived: 0,
    entries: [],
  };

  for (const row of rows) {
    if (row.deliveryState === 'archived') {
      summary.alreadyArchived += 1;
      continue;
    }
    const entry: ArchivedDocumentEntry = {
      artifactId: row.artifactId,
      organizationId: row.organizationId,
      previousDeliveryState: row.deliveryState,
      title: row.title,
    };
    summary.entries.push(entry);
    if (dryRun) {
      summary.archived += 1;
      continue;
    }
    const archived = await archiveDocumentRowAsOrphan({
      artifactId: row.artifactId,
      organizationId: row.organizationId,
      previousDeliveryState: row.deliveryState,
      reason: row.reason,
    });
    if (!archived) {
      summary.entries.pop();
      logger.warn(`${LOG_PREFIX} archive failed for ${row.artifactId}`);
      continue;
    }
    summary.archived += 1;
    logger.info(
      `${LOG_PREFIX} archived contentless document ${row.artifactId} ` +
        `("${row.title ?? ''}", ${row.deliveryState} → archived, origin=${row.originRuntime}:${
          row.originRecordId
        }, reason=${row.reason ?? 'unknown'})`
    );
  }

  logger.info(
    `${LOG_PREFIX} archive finished: scanned=${summary.scanned} archived=${summary.archived} ` +
      `alreadyArchived=${summary.alreadyArchived} dryRun=${dryRun}`
  );
  return summary;
}

export interface ArchiveOrphanRowParams {
  artifactId: string;
  organizationId: string;
  /** `delivery_state` sprzed archiwizacji — `restoreArchivedDocumentRows` czyta go z wiersza. */
  previousDeliveryState: string;
  /** Powód sieroctwa: kod z `locateDocumentContent` albo źródło usunięcia treści. */
  reason: string | null;
}

/**
 * DEC-595: JEDEN wiersz rejestru listowego bez treści dostaje parę
 * (`delivery_state='archived'` + etykieta `doc0Orphan` w ISTNIEJĄCEJ kolumnie
 * `origin_summary_json`, zero DDL). Parę czyta `matchesViewFilters`
 * (v8/artifactRegistryService.ts:3023-3031) i zdejmuje wiersz z listy Dokumenty —
 * sam `archived` NIE wystarcza, bo archiwum z wyboru użytkownika zostaje widoczne
 * (filtr statusu 'archived' w Outputs). `--restore` celowo NIE usuwa etykiety:
 * przywrócony wiersz ma etykietę, ale `delivery_state` sprzed archiwizacji — para
 * filtrująca rozpada się i wiersz wraca na listę.
 *
 * Zwraca `false`, gdy wiersz jest już zamknięty (`delivery_state='archived'`) albo
 * gdy UPDATE nie doszedł — wołacz decyduje, czy to odwrócić.
 */
export async function archiveDocumentRowAsOrphan(params: ArchiveOrphanRowParams): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const current = await dbGet<{ origin_summary_json: string | null; delivery_state: string }>(
    `SELECT origin_summary_json, delivery_state FROM v8_output_artifacts
      WHERE artifact_id = ? AND organization_id = ?`,
    [params.artifactId, params.organizationId],
    { fallback: true }
  );
  if (!current || current.delivery_state === 'archived') return false;

  let summaryJson: Record<string, unknown> = {};
  try {
    const parsed = current.origin_summary_json ? JSON.parse(current.origin_summary_json) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      summaryJson = parsed as Record<string, unknown>;
    }
  } catch {
    summaryJson = {};
  }
  const stamped = JSON.stringify({
    ...summaryJson,
    doc0Orphan: true,
    doc0OrphanReason: params.reason ?? null,
    doc0OrphanArchivedAt: nowIso,
    // Wpis 87 P1: persist the pre-archive state IN THE ROW so `--restore` can
    // read it back from the database instead of depending on the apply log as
    // its only source (a second idempotent `--apply` used to overwrite the log
    // with empty entries, after which `--restore` silently restored 0 and left
    // the rows archived forever).
    doc0OrphanPreviousDeliveryState: params.previousDeliveryState,
  });
  const result = await dbRun(
    `UPDATE v8_output_artifacts
        SET delivery_state = 'archived', origin_summary_json = ?, last_transition_at = ?
      WHERE artifact_id = ? AND organization_id = ? AND delivery_state <> 'archived'`,
    [stamped, nowIso, params.artifactId, params.organizationId]
  );
  return result?.success !== false;
}

/**
 * U-45 (Wpis 92): treść dokumentu została USUNIĘTA w swoim rejestrze treści, więc
 * wiersz rejestru listowego (`v8_output_artifacts` + `v8_artifact_origin_links`)
 * nie może zostać AKTYWNĄ sierotą. Dokładnie ten rozjazd zmierzony na kopii
 * stagingu: 6 wierszy `artifact_family='document'` z `origin_runtime='report'`,
 * których `origin_record_id` nie istnieje w `report_builder_reports` — lista je
 * pokazywała, a otwarcie dawało 404, bo `DELETE /api/report-builder/:id` kasował
 * treść i nie dotykał rejestru.
 *
 * Zamknięcie wiersza listy jest niedestrukcyjne (etykieta +
 * `delivery_state='archived'`), ale treść raportu została usunięta. Dlatego
 * `REPORT_CONTENT_DELETED` jest raportowany oddzielnie i wykluczony z restore
 * DEC-595; nie kasujemy grantów, bram recenzji ani rekordów publikacji wiersza.
 */
export async function archiveRegistryRowForDeletedContent(params: {
  organizationId: string;
  originRuntime: string;
  originRecordId: string;
  reason: string;
}): Promise<{ artifactId: string | null; archived: boolean }> {
  const link = await dbGet<{ artifact_id: string }>(
    `SELECT artifact_id FROM v8_artifact_origin_links
      WHERE organization_id = ? AND origin_runtime = ? AND origin_record_id = ?
        AND is_primary_origin = 1`,
    [params.organizationId, params.originRuntime, params.originRecordId],
    { fallback: true }
  );
  const artifactId = String(link?.artifact_id || '').trim();
  if (!artifactId) return { artifactId: null, archived: false };

  const row = await dbGet<{ delivery_state: string }>(
    `SELECT delivery_state FROM v8_output_artifacts
      WHERE artifact_id = ? AND organization_id = ?`,
    [artifactId, params.organizationId],
    { fallback: true }
  );
  if (!row) return { artifactId, archived: false };

  const archived = await archiveDocumentRowAsOrphan({
    artifactId,
    organizationId: params.organizationId,
    previousDeliveryState: row.delivery_state,
    reason: params.reason,
  });
  if (archived) {
    logger.info(
      `${LOG_PREFIX} closed registry row ${artifactId} after content deletion ` +
        `(${row.delivery_state} → archived, origin=${params.originRuntime}:${
          params.originRecordId
        }, reason=${params.reason})`
    );
  }
  return { artifactId, archived };
}

/** Cofa `archiveContentlessDocumentRows` wiersz po wierszu (stan sprzed archiwizacji). */
export async function restoreArchivedDocumentRows(
  entries: ArchivedDocumentEntry[]
): Promise<{ restored: number; failed: number }> {
  let restored = 0;
  let failed = 0;
  for (const entry of entries || []) {
    const result = await dbRun(
      `UPDATE v8_output_artifacts
          SET delivery_state = ?, last_transition_at = ?
        WHERE artifact_id = ? AND organization_id = ? AND delivery_state = 'archived'`,
      [
        entry.previousDeliveryState,
        new Date().toISOString(),
        entry.artifactId,
        entry.organizationId,
      ]
    );
    if (result?.success === false) {
      failed += 1;
      logger.warn(`${LOG_PREFIX} restore failed for ${entry.artifactId}`);
      continue;
    }
    restored += 1;
    logger.info(
      `${LOG_PREFIX} restored document ${entry.artifactId} (archived → ${entry.previousDeliveryState})`
    );
  }
  return { restored, failed };
}

/**
 * Wpis 87 P1: the authoritative source for `--restore` is the DATABASE, not the
 * apply log. Returns every document row currently `delivery_state='archived'`
 * that carries the DOC-0 orphan label stamped by `archiveContentlessDocumentRows`,
 * excluding `REPORT_CONTENT_DELETED`, whose owner content cannot be restored,
 * with the pre-archive state read back from the row itself
 * (`doc0OrphanPreviousDeliveryState`). A second idempotent `--apply` no longer
 * breaks restore: even if the log were lost, these rows are found and reverted.
 *
 * `previousDeliveryState` falls back to `'draft'` only for rows archived by a
 * build BEFORE this field existed (the dump copy is re-applied with the fixed
 * code, so in practice the field is always present).
 */
export async function findArchivedDoc0OrphanRows(
  params: { organizationId?: string } = {}
): Promise<ArchivedDocumentEntry[]> {
  const scoped = Boolean(params.organizationId);
  const rows = await dbAll<{
    artifact_id: string;
    organization_id: string;
    title_snapshot: string | null;
    origin_summary_json: string | null;
  }>(
    `SELECT a.artifact_id, a.organization_id, a.title_snapshot, a.origin_summary_json
       FROM v8_output_artifacts a
      WHERE a.artifact_family = 'document'
        AND a.delivery_state = 'archived'
        ${scoped ? 'AND a.organization_id = ?' : ''}
      ORDER BY a.created_at ASC`,
    scoped ? [params.organizationId as string] : [],
    { fallback: true }
  );

  const entries: ArchivedDocumentEntry[] = [];
  for (const row of rows || []) {
    let label: Record<string, unknown> = {};
    try {
      const parsed = row.origin_summary_json ? JSON.parse(row.origin_summary_json) : null;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        label = parsed as Record<string, unknown>;
      }
    } catch {
      label = {};
    }
    if (label.doc0Orphan !== true) continue;
    // This reason means the owner content was intentionally deleted. Restoring
    // its registry row would expose a document whose open path is a 404.
    if (label.doc0OrphanReason === 'REPORT_CONTENT_DELETED') continue;
    const previousDeliveryState =
      typeof label.doc0OrphanPreviousDeliveryState === 'string' &&
      label.doc0OrphanPreviousDeliveryState.trim() !== ''
        ? label.doc0OrphanPreviousDeliveryState
        : 'draft';
    entries.push({
      artifactId: row.artifact_id,
      organizationId: row.organization_id,
      previousDeliveryState,
      title: row.title_snapshot,
    });
  }
  return entries;
}

/** Rows intentionally closed after content deletion; report them, never restore them. */
export async function findIrreversibleArchivedDoc0Rows(
  params: { organizationId?: string } = {}
): Promise<ArchivedDocumentEntry[]> {
  const scoped = Boolean(params.organizationId);
  const rows = await dbAll<{
    artifact_id: string;
    organization_id: string;
    title_snapshot: string | null;
    origin_summary_json: string | null;
  }>(
    `SELECT a.artifact_id, a.organization_id, a.title_snapshot, a.origin_summary_json
       FROM v8_output_artifacts a
      WHERE a.artifact_family = 'document'
        AND a.delivery_state = 'archived'
        ${scoped ? 'AND a.organization_id = ?' : ''}
      ORDER BY a.created_at ASC`,
    scoped ? [params.organizationId as string] : [],
    { fallback: true }
  );

  const entries: ArchivedDocumentEntry[] = [];
  for (const row of rows || []) {
    let label: Record<string, unknown> = {};
    try {
      const parsed = row.origin_summary_json ? JSON.parse(row.origin_summary_json) : null;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        label = parsed as Record<string, unknown>;
      }
    } catch {
      label = {};
    }
    if (label.doc0Orphan !== true || label.doc0OrphanReason !== 'REPORT_CONTENT_DELETED') {
      continue;
    }
    const previousDeliveryState =
      typeof label.doc0OrphanPreviousDeliveryState === 'string' &&
      label.doc0OrphanPreviousDeliveryState.trim() !== ''
        ? label.doc0OrphanPreviousDeliveryState
        : 'draft';
    entries.push({
      artifactId: row.artifact_id,
      organizationId: row.organization_id,
      previousDeliveryState,
      title: row.title_snapshot,
    });
  }
  return entries;
}
