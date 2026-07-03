/**
 * unifiedDocEntityService — W5 / X5 (Seria X, domena doc/sheet entity merge)
 *
 * Cel X5: dziś doc istnieje w DWÓCH miejscach:
 *   - `work_canvas_drafts` — stan DRAFT (edycja w czacie/Canvasie)
 *   - `wave5_artifacts`     — stan COMMITTED (edycja w Document Studio)
 *
 * `work_canvas_drafts.artifact_id` LINKUJE do `wave5_artifacts.artifact_id` —
 * most na poziomie schemy JUŻ ISTNIEJE. Brakuje warstwy logiki:
 *   - ujednoliconego READ API (jeden poprawny widok niezależnie od stanu),
 *   - ujednoliconego COMMIT (draft → artifact w jednej transakcji, bez
 *     duplikatu).
 *
 * Ten serwis dostarcza obie operacje JAKO OPT-IN. Istniejące endpointy
 * (`work-canvas.routes.ts`, `document-studio.routes.ts`) NIE są modyfikowane —
 * żywi klienci nie są łamani. Nowy serwis to baza dla unified entity model
 * używanego przez przyszłe ścieżki (M18 Document Studio v2, M20 Outputs hub).
 *
 * KONTRAKT:
 *   - getUnifiedDoc → read-only; nigdy nie modyfikuje stanu; null gdy brak
 *   - commitDraftToArtifact → transakcyjny; tworzy wave5_artifacts JEŻELI
 *     draft nie ma jeszcze artifact_id, lub aktualizuje istniejący
 *     wave5_artifacts JEŻELI link już jest. Nigdy nie tworzy duplikatu.
 *   - org-scope wymuszony na każdej operacji.
 *
 * @module services/deliverables/unifiedDocEntityService
 */

import { v4 as uuidv4 } from 'uuid';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const LOG_PREFIX = '[unifiedDocEntityService]';

// ──────────────────────────────────────────────────────────────
// Public contract
// ──────────────────────────────────────────────────────────────

export type DocSurface = 'draft' | 'committed' | 'linked';

export interface UnifiedDocEntity {
  /** Stabilny identyfikator artefaktu (jeśli istnieje wave5 rekord). */
  artifactId: string | null;
  /** ID draftu w work_canvas_drafts (jeśli draft istnieje). */
  draftId: string | null;
  organizationId: string;
  title: string;
  /**
   * Treść — może pochodzić z draftu (content_json) lub artefaktu (content),
   * w zależności od najnowszego źródła wg `updated_at/committed_at`.
   */
  content: string;
  /**
   * Skąd przyszła `content` w tym widoku:
   *   - 'draft'     — TYLKO draft, brak artefaktu
   *   - 'committed' — TYLKO artefakt, brak draftu
   *   - 'linked'    — oba istnieją; content z nowszego źródła
   */
  source: DocSurface;
  /** Czy istnieje aktywny draft z niezacommitowanymi zmianami. */
  hasUncommittedChanges: boolean;
  draftUpdatedAt: string | null;
  artifactUpdatedAt: string | null;
}

export interface CommitDraftResult {
  artifactId: string;
  isNewArtifact: boolean;
  version: number;
}

// ──────────────────────────────────────────────────────────────
// Raw row types (mirror schemas)
// ──────────────────────────────────────────────────────────────

interface DraftRow {
  id: string;
  organization_id: string;
  title: string;
  content_json: string;
  artifact_id: string | null;
  artifact_version: number | null;
  save_state: string;
  dirty_state: string;
  updated_at: string;
}

interface ArtifactRow {
  artifact_id: string;
  organization_id: string;
  title: string;
  content: string;
  current_version: number;
  updated_at: string;
  committed_at: string | null;
}

// ──────────────────────────────────────────────────────────────
// READ — getUnifiedDoc
// ──────────────────────────────────────────────────────────────

async function findDraft(
  organizationId: string,
  draftId: string
): Promise<DraftRow | null> {
  return dbGet<DraftRow>(
    `SELECT id, organization_id, title, content_json, artifact_id, artifact_version,
            save_state, dirty_state, updated_at
     FROM work_canvas_drafts
     WHERE organization_id = ? AND id = ?`,
    [organizationId, draftId]
  );
}

async function findDraftByArtifactId(
  organizationId: string,
  artifactId: string
): Promise<DraftRow | null> {
  return dbGet<DraftRow>(
    `SELECT id, organization_id, title, content_json, artifact_id, artifact_version,
            save_state, dirty_state, updated_at
     FROM work_canvas_drafts
     WHERE organization_id = ? AND artifact_id = ?
     ORDER BY updated_at DESC
     LIMIT 1`,
    [organizationId, artifactId]
  );
}

async function findArtifact(
  organizationId: string,
  artifactId: string
): Promise<ArtifactRow | null> {
  return dbGet<ArtifactRow>(
    `SELECT artifact_id, organization_id, title, content, current_version,
            updated_at, committed_at
     FROM wave5_artifacts
     WHERE organization_id = ? AND artifact_id = ?`,
    [organizationId, artifactId]
  );
}

/**
 * Zwraca ujednolicony widok dokumentu. Akceptuje EITHER draftId LUB
 * artifactId — robi też najlepszy lookup jeśli oba podane (idempotentny).
 *
 * Logika wyboru `content`:
 *   - draft only           → content = draft.content_json, source='draft'
 *   - artifact only        → content = artifact.content, source='committed'
 *   - oba istnieją (link)  → content = NOWSZY (porównanie updated_at), source='linked'
 *
 * Read-only. Nigdy nie rzuca — błąd DB → null + log.
 */
export async function getUnifiedDoc(
  organizationId: string,
  identifier: { draftId?: string; artifactId?: string }
): Promise<UnifiedDocEntity | null> {
  if (!organizationId) return null;
  const { draftId, artifactId } = identifier;
  if (!draftId && !artifactId) return null;

  try {
    let draft: DraftRow | null = null;
    let artifact: ArtifactRow | null = null;

    if (draftId) {
      draft = await findDraft(organizationId, draftId);
      if (draft?.artifact_id) {
        artifact = await findArtifact(organizationId, draft.artifact_id);
      }
    } else if (artifactId) {
      artifact = await findArtifact(organizationId, artifactId);
      if (artifact) {
        draft = await findDraftByArtifactId(organizationId, artifactId);
      }
    }

    if (!draft && !artifact) return null;

    // Wybór "winnera" treści — nowsza updated_at wygrywa.
    let content: string;
    let source: DocSurface;
    let title: string;
    let hasUncommittedChanges = false;

    if (draft && artifact) {
      const draftMs = Date.parse(draft.updated_at);
      const artifactMs = Date.parse(artifact.updated_at);
      const draftNewer = Number.isFinite(draftMs) && draftMs > artifactMs;
      content = draftNewer ? draft.content_json : artifact.content;
      title = draft.title || artifact.title;
      source = 'linked';
      // Niezacommitowane = draft jest dirty lub nowszy niż artifact.
      hasUncommittedChanges =
        draft.dirty_state === 'dirty' || draft.save_state !== 'saved' || draftNewer;
    } else if (draft) {
      content = draft.content_json;
      title = draft.title;
      source = 'draft';
      hasUncommittedChanges = draft.dirty_state === 'dirty' || draft.save_state !== 'saved';
    } else if (artifact) {
      content = artifact.content;
      title = artifact.title;
      source = 'committed';
    } else {
      return null;
    }

    return {
      artifactId: artifact?.artifact_id ?? draft?.artifact_id ?? null,
      draftId: draft?.id ?? null,
      organizationId,
      title,
      content,
      source,
      hasUncommittedChanges,
      draftUpdatedAt: draft?.updated_at ?? null,
      artifactUpdatedAt: artifact?.updated_at ?? null,
    };
  } catch (err) {
    logger.warn(`${LOG_PREFIX} getUnifiedDoc failed`, {
      organizationId,
      identifier,
      err: (err as Error).message,
    });
    return null;
  }
}

// ──────────────────────────────────────────────────────────────
// COMMIT — draft → artifact (no duplicate)
// ──────────────────────────────────────────────────────────────

/**
 * Commituje draft do wave5_artifacts.
 *
 * - Jeśli draft.artifact_id IS NULL → tworzy NOWY wave5_artifacts (1 rekord).
 * - Jeśli draft.artifact_id NOT NULL → AKTUALIZUJE istniejący wave5_artifacts
 *   (bumpuje current_version). NIGDY nie tworzy duplikatu.
 * - Zaktualizowuje draft: zapisuje artifact_id (jeśli nowy), bumpuje
 *   artifact_version, ustawia save_state='saved', dirty_state='clean'.
 *
 * Operacja transakcyjna — błąd → ROLLBACK + throw.
 *
 * @throws Error gdy draft nie istnieje lub DB padnie
 */
export async function commitDraftToArtifact(params: {
  organizationId: string;
  draftId: string;
  committedBy: string;
}): Promise<CommitDraftResult> {
  const { organizationId, draftId, committedBy } = params;
  if (!organizationId || !draftId || !committedBy) {
    throw new Error(`${LOG_PREFIX} missing required param`);
  }

  const draft = await findDraft(organizationId, draftId);
  if (!draft) {
    throw new Error(`${LOG_PREFIX} draft not found: ${draftId}`);
  }

  const now = new Date().toISOString();

  await dbRun('BEGIN', [], { fallback: false });
  try {
    let artifactId: string;
    let isNewArtifact: boolean;
    let version: number;

    if (draft.artifact_id) {
      // Aktualizacja istniejącego artefaktu.
      const existing = await findArtifact(organizationId, draft.artifact_id);
      if (!existing) {
        // Draft wskazuje na nieistniejący artifact_id → traktujemy jak nowy.
        artifactId = draft.artifact_id;
        version = 1;
        isNewArtifact = true;
        await dbRun(
          `INSERT INTO wave5_artifacts (
            artifact_id, organization_id, artifact_type, status, title, content,
            current_version, created_by, created_at, updated_at, committed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            artifactId,
            organizationId,
            'document',
            'committed',
            draft.title,
            draft.content_json,
            version,
            committedBy,
            now,
            now,
            now,
          ],
          { fallback: false }
        );
      } else {
        artifactId = existing.artifact_id;
        version = existing.current_version + 1;
        isNewArtifact = false;
        await dbRun(
          `UPDATE wave5_artifacts
           SET title = ?, content = ?, current_version = ?, updated_at = ?, committed_at = ?
           WHERE artifact_id = ? AND organization_id = ?`,
          [draft.title, draft.content_json, version, now, now, artifactId, organizationId],
          { fallback: false }
        );
        // Wersja w wave5_artifact_versions (jeśli tabela istnieje).
        try {
          await dbRun(
            `INSERT INTO wave5_artifact_versions (
              version_id, artifact_id, organization_id, version, content, provenance_json
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [uuidv4(), artifactId, organizationId, version, draft.content_json, '{}'],
            { fallback: false }
          );
        } catch (verErr) {
          logger.warn(`${LOG_PREFIX} version insert failed (non-blocking)`, verErr);
        }
      }
    } else {
      // Nowy artefakt — tworzymy + przypiszemy do draftu.
      artifactId = uuidv4();
      version = 1;
      isNewArtifact = true;
      await dbRun(
        `INSERT INTO wave5_artifacts (
          artifact_id, organization_id, artifact_type, status, title, content,
          current_version, created_by, created_at, updated_at, committed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          artifactId,
          organizationId,
          'document',
          'committed',
          draft.title,
          draft.content_json,
          version,
          committedBy,
          now,
          now,
          now,
        ],
        { fallback: false }
      );
    }

    // Aktualizacja draftu — link + flaga "saved".
    await dbRun(
      `UPDATE work_canvas_drafts
       SET artifact_id = ?, artifact_version = ?,
           save_state = ?, dirty_state = ?, updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [artifactId, version, 'saved', 'clean', now, draftId, organizationId],
      { fallback: false }
    );

    await dbRun('COMMIT', [], { fallback: false });

    logger.info(`${LOG_PREFIX} commit draft=${draftId} → artifact=${artifactId} v${version}`);
    return { artifactId, isNewArtifact, version };
  } catch (err) {
    try {
      await dbRun('ROLLBACK', [], { fallback: false });
    } catch (rollbackErr) {
      logger.error(`${LOG_PREFIX} ROLLBACK failed`, rollbackErr);
    }
    logger.error(`${LOG_PREFIX} commitDraftToArtifact failed`, err);
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────
// READ-side helper — list drafts linked to artifact (for "in progress" UX)
// ──────────────────────────────────────────────────────────────

/**
 * Zwraca listę draftów linkujących do danego artefaktu (zwykle 0 albo 1, ale
 * legacy dane mogą mieć więcej). Read-only.
 */
export async function listDraftsForArtifact(
  organizationId: string,
  artifactId: string
): Promise<Array<{ draftId: string; updatedAt: string; dirty: boolean }>> {
  if (!organizationId || !artifactId) return [];
  try {
    const rows = await dbAll<DraftRow>(
      `SELECT id, organization_id, title, content_json, artifact_id, artifact_version,
              save_state, dirty_state, updated_at
       FROM work_canvas_drafts
       WHERE organization_id = ? AND artifact_id = ?
       ORDER BY updated_at DESC`,
      [organizationId, artifactId]
    );
    return rows.map((r) => ({
      draftId: r.id,
      updatedAt: r.updated_at,
      dirty: r.dirty_state === 'dirty' || r.save_state !== 'saved',
    }));
  } catch (err) {
    logger.warn(`${LOG_PREFIX} listDraftsForArtifact failed`, (err as Error).message);
    return [];
  }
}
