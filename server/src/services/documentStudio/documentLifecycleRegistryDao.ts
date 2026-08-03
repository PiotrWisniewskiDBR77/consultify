/**
 * Consultify Document Studio — Lifecycle State Registry DAO (Epic E5).
 *
 * Postgres-backed persistence layer behind the in-process Map cache in
 * `documentLifecycleService.ts`. Mirrors `documentSourcePackRegistryDao.ts`:
 *
 *   - Best-effort write-through: every operation resolves to `{ ok: false }` /
 *     `[]` on any error and does NOT throw — the service falls back to its
 *     in-process Map cache when persistence is unavailable.
 *   - `loadLifecycleStatesForOrg` hydrates the cache lazily once per org
 *     on cold start (one query, all artifacts for the org).
 *   - Tenant safety: every query carries `organization_id` in the WHERE
 *     clause; cross-tenant reads are deny-by-default.
 *
 * Storage backing: table `document_lifecycle_states` (migration 782).
 * PRIMARY KEY (artifact_id, organization_id) — one mutable row per artifact;
 * upsert via ON CONFLICT DO UPDATE.
 */

import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import type {
  DocumentLifecycleState,
  DocumentLifecycleTransition,
} from './documentLifecycleService.js';

interface LifecycleRow {
  artifact_id: string;
  organization_id: string;
  status: string;
  status_changed_at: string | null;
  status_changed_by: string | null;
  status_reason: string | null;
  history_json: unknown;
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

function rowToState(row: LifecycleRow): DocumentLifecycleState | null {
  if (!row.artifact_id || !row.organization_id) return null;
  return {
    artifactId: row.artifact_id,
    organizationId: row.organization_id,
    status: row.status as DocumentLifecycleState['status'],
    statusChangedAt: row.status_changed_at ?? new Date().toISOString(),
    statusChangedBy: row.status_changed_by ?? 'system',
    statusReason: row.status_reason ?? undefined,
    history: parseJson<DocumentLifecycleTransition[]>(row.history_json, []),
  };
}

/**
 * Load all lifecycle states for a tenant in one query.
 * Used by cold-start hydration in documentLifecycleService.ts.
 * Resolves to `[]` on any failure so the service degrades to its in-process Map.
 */
export async function loadLifecycleStatesForOrg(
  organizationId: string
): Promise<DocumentLifecycleState[]> {
  if (!organizationId) return [];
  try {
    const rows = await dbAll<LifecycleRow>(
      `SELECT artifact_id, organization_id, status,
              status_changed_at, status_changed_by, status_reason, history_json
         FROM document_lifecycle_states
        WHERE organization_id = $1
        ORDER BY updated_at ASC`,
      [organizationId]
    );
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.map(rowToState).filter((s): s is DocumentLifecycleState => s !== null);
  } catch (err) {
    logger.warn('[DocumentStudio][LifecycleDao] loadLifecycleStatesForOrg failed', {
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Point lookup for a single artifact, tenant-scoped. Added for MAT-010's
 * durability-confirmation poll (Codex final review, Blocker 2): after a
 * lifecycle transition's fire-and-forget `persistLifecycleState` call, the
 * route polls THIS function to confirm the row actually reflects the new
 * status in Postgres before responding.
 */
export async function loadLifecycleStateForArtifact(
  artifactId: string,
  organizationId: string
): Promise<DocumentLifecycleState | null> {
  if (!artifactId || !organizationId) return null;
  try {
    const rows = await dbAll<LifecycleRow>(
      `SELECT artifact_id, organization_id, status,
              status_changed_at, status_changed_by, status_reason, history_json
         FROM document_lifecycle_states
        WHERE artifact_id = $1 AND organization_id = $2
        LIMIT 1`,
      [artifactId, organizationId]
    );
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rowToState(rows[0]);
  } catch (err) {
    logger.warn('[DocumentStudio][LifecycleDao] loadLifecycleStateForArtifact failed', {
      artifactId,
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Upsert a lifecycle state. Best-effort; never throws.
 * ON CONFLICT DO UPDATE — one row per (artifact_id, organization_id).
 */
export async function persistLifecycleState(
  state: DocumentLifecycleState
): Promise<{ ok: boolean }> {
  if (!state?.artifactId || !state.organizationId) return { ok: false };
  try {
    const result = await dbRun(
      `INSERT INTO document_lifecycle_states (
         artifact_id, organization_id, status,
         status_changed_at, status_changed_by, status_reason,
         history_json, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       ON CONFLICT (artifact_id, organization_id) DO UPDATE SET
         status             = EXCLUDED.status,
         status_changed_at  = EXCLUDED.status_changed_at,
         status_changed_by  = EXCLUDED.status_changed_by,
         status_reason      = EXCLUDED.status_reason,
         history_json       = EXCLUDED.history_json,
         updated_at         = EXCLUDED.updated_at`,
      [
        state.artifactId,
        state.organizationId,
        state.status,
        state.statusChangedAt ?? null,
        state.statusChangedBy ?? null,
        state.statusReason ?? null,
        JSON.stringify(state.history ?? []),
        new Date().toISOString(),
      ]
    );
    return { ok: result.success === true };
  } catch (err) {
    logger.warn('[DocumentStudio][LifecycleDao] persistLifecycleState failed', {
      artifactId: state.artifactId,
      organizationId: state.organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}

/** @internal Test-only reset — best-effort DELETE of the table. */
export async function __resetLifecycleRegistryDaoForTests(): Promise<void> {
  try {
    await dbRun('DELETE FROM document_lifecycle_states', []);
  } catch {
    /* best-effort: table may not exist in a unit-test sandbox */
  }
}
