/**
 * MW-10 — kanoniczne wersjonowanie dokumentów Vault (`knowledge_docs`).
 *
 * CO BYŁO PRZED: kolumna `knowledge_docs.version INTEGER DEFAULT 1` istniała od
 * `20260303_schema_alignment.sql`, ale nie miała ANI JEDNEGO writera ani readera
 * w `server/src/` — kolumna-fantom. Zero historii, zero restore'u, zero
 * niezmiennego snapshotu treści. Jedyna „edycja" dokumentu Vault to metadane
 * (kategoria/tagi/folder/poziom), które nadpisywały wiersz w miejscu.
 *
 * CO ROBI TEN MODUŁ: trzyma historię w `knowledge_doc_versions`
 * (940_mw010_vault_document_versions.sql) i wystawia operacje, które NIGDY nie
 * nadpisują historii:
 *   - `recordInitialVersion` — upload → wersja 1,
 *   - `claimNextVersion` + `commitVersion` — nowa treść → kolejna wersja,
 *   - `restore` = ta sama para, tylko treść pochodzi ze starszej wersji, a
 *     wiersz niesie `origin='restore'` + `restored_from_version`.
 *
 * WSPÓŁBIEŻNOŚĆ (kontrakt MW-10 pkt 10 — CAS, nie last-write-wins):
 * `claimNextVersion` robi warunkowy `UPDATE ... WHERE version = <oczekiwana>`.
 * Ten JEDEN statement jest muteksem: przy dwóch równoległych edycjach dokładnie
 * jeden dostaje `changes = 1`, drugi `changes = 0` → 409. Unikalny indeks
 * `(document_id, version_number)` jest drugim, niezależnym bezpiecznikiem.
 *
 * CZEGO TU NIE MA (świadomie): to NIE jest lineage Document Studio
 * (`document_version_snapshots`, 776_document_studio_wave5_persistence.sql) ani
 * MAT-10 — tamte klucze to `artifact_id` i `schema_json`, inna encja. MW-10 nie
 * duplikuje ani nie przejmuje tamtych tabel.
 *
 * ★ SCHEMAT MA JEDNEGO WŁAŚCICIELA (poprawka po recenzji CTO 2026-08-03,
 * kontrakt pkt 7 „brak runtime ALTER TABLE"): tabela `knowledge_doc_versions`,
 * jej indeksy oraz `knowledge_docs.version`/`file_size_bytes` pochodzą
 * WYŁĄCZNIE z `server/migrations/940_mw010_vault_document_versions.sql`. Ten
 * moduł wcześniej niósł RÓWNOLEGŁY, runtime'owy `ensureVaultVersionSchema()`
 * (CREATE TABLE IF NOT EXISTS + ALTER, ten sam wzorzec co
 * `KnowledgeService.ensureKnowledgeSchema`) — usunięty. Dwóch właścicieli tej
 * samej kolumny (migracja + runtime patch) to dokładnie ten wzorzec dryfu
 * schematu, który już raz ukrył prawdziwą awarię w tym repo (patrz DZIENNIK
 * `939_mw010...` → `940_mw010...`: `file_size_bytes` miała identyczny problem
 * i została naprawiona tym samym sposobem — jeden właściciel, migracja).
 * Środowisko, na którym migracja 940 nie przeszła, ma zepsuty Vault w OGÓLE
 * (upload/edit padają wcześniej, w `KnowledgeService.addDocument`) — runtime
 * fallback tutaj nie naprawiał tego, tylko maskował objaw dla samej tabeli
 * wersji, nie dla reszty ścieżki.
 */

import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

import * as DbPromise from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import { uploadsDir } from '../../utils/storagePaths.js';

export type VaultVersionOrigin = 'upload' | 'edit' | 'restore';

export interface VaultDocumentVersion {
  versionId: string;
  documentId: string;
  organizationId: string;
  versionNumber: number;
  filename: string;
  filepath: string | null;
  fileSizeBytes: number | null;
  contentHash: string | null;
  chunkCount: number;
  origin: VaultVersionOrigin;
  restoredFromVersion: number | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string | null;
}

interface VersionRow {
  version_id: string;
  document_id: string;
  organization_id: string;
  version_number: number | string;
  filename: string;
  filepath: string | null;
  file_size_bytes: number | string | null;
  content_hash: string | null;
  chunk_count: number | string | null;
  origin: string;
  restored_from_version: number | string | null;
  note: string | null;
  created_by: string | null;
  created_at: string | Date | null;
}

const asInt = (value: unknown): number | null =>
  value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value);

const asIso = (value: string | Date | null): string | null => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

const mapRow = (row: VersionRow): VaultDocumentVersion => ({
  versionId: String(row.version_id),
  documentId: String(row.document_id),
  organizationId: String(row.organization_id ?? ''),
  versionNumber: asInt(row.version_number) ?? 1,
  filename: String(row.filename ?? 'document'),
  filepath: row.filepath ? String(row.filepath) : null,
  fileSizeBytes: asInt(row.file_size_bytes),
  contentHash: row.content_hash ? String(row.content_hash) : null,
  chunkCount: asInt(row.chunk_count) ?? 0,
  origin:
    row.origin === 'edit' || row.origin === 'restore'
      ? (row.origin as VaultVersionOrigin)
      : 'upload',
  restoredFromVersion: asInt(row.restored_from_version),
  note: row.note ? String(row.note) : null,
  createdBy: row.created_by ? String(row.created_by) : null,
  createdAt: asIso(row.created_at),
});

/** SHA-256 zawartości pliku — odcisk snapshotu (do porównań i audytu). */
export function hashFile(filepath: string): string | null {
  try {
    return createHash('sha256').update(fs.readFileSync(filepath)).digest('hex');
  } catch {
    return null;
  }
}

/**
 * Ścieżka pliku dla NOWEJ wersji. Każda wersja dostaje własny, unikalny plik —
 * snapshot jest niezmienny, więc nigdy nie nadpisujemy pliku poprzedniej wersji.
 * (Uploader Vault używa `${Date.now()}-${nazwa}`, co przy dwóch zapisach w tej
 * samej milisekundzie mogłoby się skleić — tu doklejamy losowy człon.)
 */
export function buildVersionFilePath(orgId: string, filename: string): string {
  const safeName = String(path.basename(filename || 'document'))
    .replace(/[/\\]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return path.join(uploadsDir('knowledge', orgId), `${Date.now()}-${randomUUID()}-${safeName}`);
}

export type ClaimResult =
  | { ok: true; previousVersion: number; nextVersion: number }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'stale'; currentVersion: number };

/**
 * Rezerwuje kolejny numer wersji przez warunkowy UPDATE wskaźnika
 * `knowledge_docs.version` (CAS). Zwrot `stale` = ktoś inny zdążył podbić wersję
 * → wołający MUSI odpowiedzieć 409, a nie nadpisać cudzą zmianę.
 *
 * `expectedVersion === null` znaczy „klient nie deklaruje wersji" — wtedy CAS
 * jedzie na wersji odczytanej przed chwilą, więc wyścig DWÓCH zapisów nadal
 * kończy się 409 dla przegranego (nie last-write-wins).
 */
export async function claimNextVersion(params: {
  organizationId: string;
  documentId: string;
  expectedVersion: number | null;
}): Promise<ClaimResult> {
  const { organizationId, documentId, expectedVersion } = params;

  const current = await DbPromise.get<{ version: number | string | null }>(
    `SELECT version FROM knowledge_docs
      WHERE id = ? AND organization_id = ? AND deleted_at IS NULL`,
    [documentId, organizationId],
    { fallback: true } as any
  );
  if (!current) return { ok: false, reason: 'not_found' };

  const currentVersion = asInt(current.version) ?? 1;
  if (expectedVersion !== null && expectedVersion !== currentVersion) {
    return { ok: false, reason: 'stale', currentVersion };
  }

  const nextVersion = currentVersion + 1;
  const result = await DbPromise.run(
    `UPDATE knowledge_docs
        SET version = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ? AND deleted_at IS NULL AND version = ?`,
    [nextVersion, documentId, organizationId, currentVersion],
    { fallback: false } as any
  );
  if (!Number((result as any)?.changes)) {
    // Przegrany wyścigu: między SELECT a UPDATE ktoś inny podbił wersję.
    const fresh = await DbPromise.get<{ version: number | string | null }>(
      `SELECT version FROM knowledge_docs
        WHERE id = ? AND organization_id = ? AND deleted_at IS NULL`,
      [documentId, organizationId],
      { fallback: true } as any
    );
    if (!fresh) return { ok: false, reason: 'not_found' };
    return { ok: false, reason: 'stale', currentVersion: asInt(fresh.version) ?? currentVersion };
  }

  return { ok: true, previousVersion: currentVersion, nextVersion };
}

/** Wycofanie wskaźnika, gdy commit wersji padł po udanym CAS (kompensacja). */
export async function releaseVersionClaim(params: {
  organizationId: string;
  documentId: string;
  previousVersion: number;
  claimedVersion: number;
}): Promise<void> {
  await DbPromise.run(
    `UPDATE knowledge_docs SET version = ?
      WHERE id = ? AND organization_id = ? AND version = ?`,
    [params.previousVersion, params.documentId, params.organizationId, params.claimedVersion],
    { fallback: true } as any
  );
}

/**
 * Dopisuje NIEZMIENNY wiersz wersji i przestawia „aktualną treść" dokumentu na
 * ten snapshot. Wiersze wersji nie są nigdy aktualizowane poza `deleted_at`
 * (kaskada z usunięcia dokumentu) — dlatego historia przeżywa każdy restore.
 */
export async function commitVersion(params: {
  organizationId: string;
  documentId: string;
  versionNumber: number;
  filename: string;
  filepath: string | null;
  fileSizeBytes: number | null;
  contentHash: string | null;
  chunkCount: number;
  origin: VaultVersionOrigin;
  restoredFromVersion?: number | null;
  note?: string | null;
  createdBy: string | null;
  /** `false` dla wersji 1 zakładanej razem z dokumentem (INSERT już to ustawił). */
  syncDocumentRow?: boolean;
}): Promise<VaultDocumentVersion> {
  const versionId = randomUUID();

  await DbPromise.run(
    `INSERT INTO knowledge_doc_versions
       (version_id, document_id, organization_id, version_number, filename, filepath,
        file_size_bytes, content_hash, chunk_count, origin, restored_from_version, note,
        created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      versionId,
      params.documentId,
      params.organizationId,
      params.versionNumber,
      params.filename,
      params.filepath,
      params.fileSizeBytes,
      params.contentHash,
      params.chunkCount,
      params.origin,
      params.restoredFromVersion ?? null,
      params.note ?? null,
      params.createdBy,
    ],
    { fallback: false } as any
  );

  if (params.syncDocumentRow !== false) {
    await DbPromise.run(
      `UPDATE knowledge_docs
          SET filename = ?, filepath = ?, file_size_bytes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND organization_id = ?`,
      [
        params.filename,
        params.filepath,
        params.fileSizeBytes,
        params.documentId,
        params.organizationId,
      ],
      { fallback: false } as any
    );
  }

  const created = await getVersion(params.organizationId, params.documentId, params.versionNumber);
  if (created) return created;
  // Odczyt zwrotny nie powinien pudłować — jeżeli pudłuje, oddaj to, co zapisaliśmy.
  return {
    versionId,
    documentId: params.documentId,
    organizationId: params.organizationId,
    versionNumber: params.versionNumber,
    filename: params.filename,
    filepath: params.filepath,
    fileSizeBytes: params.fileSizeBytes,
    contentHash: params.contentHash,
    chunkCount: params.chunkCount,
    origin: params.origin,
    restoredFromVersion: params.restoredFromVersion ?? null,
    note: params.note ?? null,
    createdBy: params.createdBy,
    createdAt: null,
  };
}

/** Wersja 1 zakładana razem z dokumentem (upload). */
export async function recordInitialVersion(params: {
  organizationId: string;
  documentId: string;
  filename: string;
  filepath: string | null;
  fileSizeBytes: number | null;
  chunkCount: number;
  createdBy: string | null;
}): Promise<VaultDocumentVersion> {
  return commitVersion({
    ...params,
    versionNumber: 1,
    contentHash: params.filepath ? hashFile(params.filepath) : null,
    origin: 'upload',
    syncDocumentRow: false,
  });
}

/**
 * Historia wersji dokumentu — malejąco (najnowsza pierwsza). Zawsze
 * org-scoped i zawsze z pominięciem wersji skasowanych kaskadą z dokumentu.
 */
export async function listVersions(
  organizationId: string,
  documentId: string
): Promise<VaultDocumentVersion[]> {
  const rows = await DbPromise.all<VersionRow>(
    `SELECT * FROM knowledge_doc_versions
      WHERE document_id = ? AND (organization_id = ? OR organization_id = '') AND deleted_at IS NULL
      ORDER BY version_number DESC`,
    [documentId, organizationId],
    { fallback: true } as any
  );
  return (rows || []).map(mapRow);
}

export async function getVersion(
  organizationId: string,
  documentId: string,
  versionNumber: number
): Promise<VaultDocumentVersion | null> {
  const row = await DbPromise.get<VersionRow>(
    `SELECT * FROM knowledge_doc_versions
      WHERE document_id = ? AND (organization_id = ? OR organization_id = '')
        AND version_number = ? AND deleted_at IS NULL`,
    [documentId, organizationId, versionNumber],
    { fallback: true } as any
  );
  return row ? mapRow(row) : null;
}

/**
 * Kaskada z miękkiego usunięcia dokumentu (kontrakt MW-10 pkt 9): po DELETE nie
 * może zostać ANI JEDNA osiągalna wersja. Wiersze zostają (audyt), ale każdy
 * odczyt wersji filtruje `deleted_at IS NULL`.
 */
export async function softDeleteVersionsForDocument(
  organizationId: string,
  documentId: string
): Promise<number> {
  const result = await DbPromise.run(
    `UPDATE knowledge_doc_versions
        SET deleted_at = CURRENT_TIMESTAMP
      WHERE document_id = ? AND (organization_id = ? OR organization_id = '') AND deleted_at IS NULL`,
    [documentId, organizationId],
    { fallback: true } as any
  );
  return Number((result as any)?.changes) || 0;
}

/** Kopia pliku snapshotu pod nową, unikalną ścieżkę (używane przez restore). */
export function copySnapshotFile(
  organizationId: string,
  sourcePath: string,
  filename: string
): { filepath: string; sizeBytes: number | null; contentHash: string | null } | null {
  try {
    if (!sourcePath || !fs.existsSync(sourcePath)) return null;
    const target = buildVersionFilePath(organizationId, filename);
    fs.copyFileSync(sourcePath, target);
    const stat = fs.statSync(target);
    return { filepath: target, sizeBytes: stat.size, contentHash: hashFile(target) };
  } catch (e: any) {
    logger.warn('[VaultVersions] copySnapshotFile failed', { error: e?.message || e });
    return null;
  }
}

const vaultDocumentVersionService = {
  claimNextVersion,
  releaseVersionClaim,
  commitVersion,
  recordInitialVersion,
  listVersions,
  getVersion,
  softDeleteVersionsForDocument,
  copySnapshotFile,
  buildVersionFilePath,
  hashFile,
};

export default vaultDocumentVersionService;
