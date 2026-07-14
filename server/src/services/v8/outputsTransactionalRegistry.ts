/**
 * outputsTransactionalRegistry — W5 / X6 (Seria X, domena M17 Outputs)
 *
 * Transakcyjna rejestracja artefaktu w M17 Outputs registry.
 *
 * Cel X6: dziś `registerArtifactOrigin` w `artifactRegistryService.ts` robi DWA
 * niezależne INSERT-y (v8_output_artifacts + v8_artifact_origin_links). Jeśli
 * pierwszy się powiedzie a drugi nie → orphan artifact bez origin link
 * (drift). Dodatkowo `notifyContextOfNewArtifact` jest fire-and-forget. Audit
 * log w `emitRunAudit` swallowuje błędy. Spec X6 wymaga transakcyjnej
 * rejestracji + jawnego lineage.
 *
 * Ten serwis dostarcza ALTERNATYWNĄ ścieżkę (opt-in, nie zmienia żywej
 * `registerArtifactOrigin` — klienci dzisiaj używają fire-and-forget i nie
 * chcemy ich łamać). Nowe callowe ścieżki (X1-X5) używają tej funkcji.
 *
 * KONTRAKT (różny od B-series):
 *   - NIE fail-open: błąd transakcji RZUCA (klient ma świadomie decydować
 *     co zrobić — orphan-by-default wprowadza ciche driftowanie).
 *   - Idempotentny: dla istniejącej (originRuntime, originRecordId) zwraca
 *     ten sam artifactId (FT-1 idempotencja).
 *   - Transakcyjny: oba INSERT-y w jednej `BEGIN`/`COMMIT`. ROLLBACK przy
 *     błędzie → ZERO orphanów.
 *   - Lineage: zwraca jawne `lineage` (origin → artifact) przy KAŻDYM
 *     wywołaniu (nie tylko nowym).
 *
 * @module services/v8/outputsTransactionalRegistry
 */

import { v4 as uuidv4 } from 'uuid';

import {
  type ArtifactOriginRuntime,
  type RegisterArtifactOriginParams,
  RegisterArtifactOriginParamsSchema,
} from '../../types/artifactRegistry.js';
import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const LOG_PREFIX = '[outputsTransactionalRegistry]';

// ──────────────────────────────────────────────────────────────
// Public contract
// ──────────────────────────────────────────────────────────────

export interface OutputArtifactLineage {
  artifactId: string;
  organizationId: string;
  outputType: 'report' | 'presentation' | 'sheet';
  originRuntime: ArtifactOriginRuntime;
  originRecordId: string;
  isPrimaryOrigin: boolean;
}

export interface TransactionalRegistrationResult {
  artifactId: string;
  isNew: boolean;
  lineage: OutputArtifactLineage;
}

// ──────────────────────────────────────────────────────────────
// Helpery — odczyt istniejącego linku (idempotency check)
// ──────────────────────────────────────────────────────────────

interface ExistingLinkRow {
  artifact_id: string;
  organization_id: string;
  origin_runtime: string;
  origin_record_id: string;
  is_primary_origin: number | boolean;
}

interface ExistingArtifactRow {
  artifact_id: string;
  organization_id: string;
  output_type: string;
}

async function findExistingLink(
  organizationId: string,
  originRuntime: string,
  originRecordId: string
): Promise<ExistingLinkRow | null> {
  return dbGet<ExistingLinkRow>(
    `SELECT artifact_id, organization_id, origin_runtime, origin_record_id, is_primary_origin
     FROM v8_artifact_origin_links
     WHERE organization_id = ? AND origin_runtime = ? AND origin_record_id = ?`,
    [organizationId, originRuntime, originRecordId]
  );
}

async function getOutputType(artifactId: string, organizationId: string): Promise<string | null> {
  const row = await dbGet<ExistingArtifactRow>(
    `SELECT artifact_id, organization_id, output_type
     FROM v8_output_artifacts
     WHERE artifact_id = ? AND organization_id = ?`,
    [artifactId, organizationId]
  );
  return row?.output_type ?? null;
}

// ──────────────────────────────────────────────────────────────
// Main entry — transactional registration
// ──────────────────────────────────────────────────────────────

/**
 * Rejestruje artefakt w M17 Outputs transakcyjnie.
 *
 * - Idempotentny: jeśli (originRuntime, originRecordId) już istnieje →
 *   zwraca ten sam artifactId (`isNew=false`). Brak driftu.
 * - Transakcyjny: oba INSERT-y w BEGIN/COMMIT; błąd → ROLLBACK + throw.
 * - Lineage: zawsze zwraca jawny pointer origin→artifact.
 *
 * UWAGA — kontrakt RZUCA przy błędzie (nie fail-open). Klient decyduje
 * co zrobić (np. retry, surface to user, log to dead-letter queue).
 *
 * @throws Error przy walidacji parametrów lub błędzie transakcji
 */
export async function registerOutputArtifactTransactional(
  params: RegisterArtifactOriginParams
): Promise<TransactionalRegistrationResult> {
  const validated = RegisterArtifactOriginParamsSchema.parse(params);

  // 1. Idempotency check — POZA transakcją (fast path dla istniejących).
  //    Wyścig: dwóch równoległych callerów dla tej samej pary
  //    (originRuntime, originRecordId) → drugi i tak zobaczy istniejący link
  //    przy re-check wewnątrz transakcji (patrz pkt 3).
  const fastPath = await findExistingLink(
    validated.organizationId,
    validated.originRuntime,
    validated.originRecordId
  );

  if (fastPath) {
    const outputType = await getOutputType(fastPath.artifact_id, validated.organizationId);
    return {
      artifactId: fastPath.artifact_id,
      isNew: false,
      lineage: {
        artifactId: fastPath.artifact_id,
        organizationId: validated.organizationId,
        outputType: (outputType ?? validated.outputType) as 'report' | 'presentation' | 'sheet',
        originRuntime: validated.originRuntime,
        originRecordId: validated.originRecordId,
        isPrimaryOrigin: Boolean(fastPath.is_primary_origin),
      },
    };
  }

  // 2. Wejście do transakcji — oba INSERT-y atomowo.
  const artifactId = uuidv4();
  const linkId = uuidv4();
  const now = new Date().toISOString();

  await dbRun('BEGIN', [], { fallback: false });

  try {
    // 3. Re-check wewnątrz transakcji — chroni przed race między fast-path a
    //    INSERT-em (wyścig: A zobaczył pusto → próbuje INSERT, B w tym czasie
    //    INSERT-uje pierwszy). Druga próba INSERT-u rzuci unique violation,
    //    więc check wewnątrz tx zwraca już-istniejący rekord zamiast crashu.
    const rechecked = await findExistingLink(
      validated.organizationId,
      validated.originRuntime,
      validated.originRecordId
    );

    if (rechecked) {
      await dbRun('COMMIT', [], { fallback: false });
      const outputType = await getOutputType(rechecked.artifact_id, validated.organizationId);
      return {
        artifactId: rechecked.artifact_id,
        isNew: false,
        lineage: {
          artifactId: rechecked.artifact_id,
          organizationId: validated.organizationId,
          outputType: (outputType ?? validated.outputType) as 'report' | 'presentation' | 'sheet',
          originRuntime: validated.originRuntime,
          originRecordId: validated.originRecordId,
          isPrimaryOrigin: Boolean(rechecked.is_primary_origin),
        },
      };
    }

    // 4. INSERT artefaktu.
    await dbRun(
      `INSERT INTO v8_output_artifacts (
        artifact_id, organization_id, output_type, artifact_family, delivery_state,
        title_snapshot, owner_user_id, canonical_home, visibility_scope, project_id,
        context_snapshot_id, execution_run_id, template_family_ref, source_initiative_id,
        ai_governance_preset_ref, origin_summary_json, created_by, created_at, last_transition_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        artifactId,
        validated.organizationId,
        validated.outputType,
        validated.artifactFamily,
        validated.deliveryState ?? 'draft',
        validated.titleSnapshot ?? null,
        validated.ownerUserId ?? null,
        'outputs_library',
        validated.visibilityScope ?? 'organization',
        validated.projectId ?? null,
        validated.contextSnapshotId ?? null,
        validated.executionRunId ?? null,
        validated.templateFamilyRef ?? null,
        validated.sourceInitiativeId ?? null,
        validated.aiGovernancePresetRef ?? null,
        validated.originSummary ? JSON.stringify(validated.originSummary) : null,
        validated.createdBy,
        now,
        now,
      ],
      { fallback: false }
    );

    // 5. INSERT origin link — jawny lineage.
    await dbRun(
      `INSERT INTO v8_artifact_origin_links (
        link_id, artifact_id, organization_id, origin_runtime, origin_record_id, is_primary_origin, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        linkId,
        artifactId,
        validated.organizationId,
        validated.originRuntime,
        validated.originRecordId,
        1,
        now,
      ],
      { fallback: false }
    );

    await dbRun('COMMIT', [], { fallback: false });

    logger.info(
      `${LOG_PREFIX} Registered ${validated.originRuntime}:${validated.originRecordId} ` +
        `→ artifact ${artifactId} (transactional)`
    );

    return {
      artifactId,
      isNew: true,
      lineage: {
        artifactId,
        organizationId: validated.organizationId,
        outputType: validated.outputType,
        originRuntime: validated.originRuntime,
        originRecordId: validated.originRecordId,
        isPrimaryOrigin: true,
      },
    };
  } catch (err) {
    try {
      await dbRun('ROLLBACK', [], { fallback: false });
    } catch (rollbackErr) {
      logger.error(`${LOG_PREFIX} ROLLBACK failed`, rollbackErr);
    }
    logger.error(
      `${LOG_PREFIX} Transactional registration FAILED for ` +
        `${validated.originRuntime}:${validated.originRecordId}`,
      err
    );
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────
// Lineage lookup — public read-side helper
// ──────────────────────────────────────────────────────────────

/**
 * Zwraca pełen lineage dla artefaktu (artifactId → wszystkie origin links).
 * Idempotentny czyt; nie modyfikuje stanu.
 */
export async function getArtifactLineage(
  artifactId: string,
  organizationId: string
): Promise<OutputArtifactLineage[]> {
  const rows = await dbGet<ExistingArtifactRow>(
    `SELECT artifact_id, organization_id, output_type
     FROM v8_output_artifacts
     WHERE artifact_id = ? AND organization_id = ?`,
    [artifactId, organizationId]
  );
  if (!rows) return [];

  const { all: dbAll } = await import('../../utils/DbPromise.js');
  const linkRows = await dbAll<ExistingLinkRow>(
    `SELECT artifact_id, organization_id, origin_runtime, origin_record_id, is_primary_origin
     FROM v8_artifact_origin_links
     WHERE artifact_id = ? AND organization_id = ?
     ORDER BY is_primary_origin DESC, created_at ASC`,
    [artifactId, organizationId]
  );

  return linkRows.map((r) => ({
    artifactId: r.artifact_id,
    organizationId: r.organization_id,
    outputType: rows.output_type as 'report' | 'presentation' | 'sheet',
    originRuntime: r.origin_runtime as ArtifactOriginRuntime,
    originRecordId: r.origin_record_id,
    isPrimaryOrigin: Boolean(r.is_primary_origin),
  }));
}
