/**
 * DP-3 shared idea maps — membership + canonical-row access (T3).
 *
 * Single point of truth for "can this user read/write this idea's map" and
 * "which my_idea_maps row is canonical for this idea", shared by the HTTP
 * routes (T4) and the collab WS gateway (T5) once ENABLE_SHARED_IDEA_MAPS
 * is on. See Harvard/wdrozenie-100/_M06_DP3_MULTIPLAYER_PLAN_2026-07-04.md
 * §2 (Uprawnienia) and §5 (Kompatybilność).
 *
 * IMPORTANT — placeholder style: every query in this module uses `?`
 * placeholders. PostgresDatabase.ts:377 translates `?` → `$1, $2, ...`
 * SEQUENTIALLY per query; never mix `?` and `$n` in the same SQL string.
 */
import type { IDatabase } from '../database/IDatabase.js';
import { getTableColumns } from '../utils/dbSchema.js';

export interface IdeaMembership {
  /** True when the idea exists in the org AND the user is an ACTIVE org member. */
  canRead: boolean;
  /** Same gate as canRead today (T3 scope). Kept separate so T4/T5 can layer
   *  additional write-only restrictions (e.g. per-node locks) without
   *  touching the membership check itself. */
  canWrite: boolean;
}

const NO_ACCESS: IdeaMembership = { canRead: false, canWrite: false };

/**
 * Checks that `ideaId` belongs to `organizationId` AND that `userId` is an
 * ACTIVE member of that organization. Both conditions must hold for any
 * access; there is no cross-org fallback.
 *
 * Query pattern mirrors the existing org-scope gate in
 * ideaCollabWs.gateway.ts (`SELECT id FROM my_ideas WHERE id = ? AND
 * organization_id = ?`) plus a second query against organization_members.
 */
export async function assertIdeaMembership(
  db: IDatabase,
  organizationId: string,
  userId: string,
  ideaId: string
): Promise<IdeaMembership> {
  if (!db || !organizationId || !userId || !ideaId) return NO_ACCESS;

  const idea = await db.get<{ id: string }>(
    'SELECT id FROM my_ideas WHERE id = ? AND organization_id = ?',
    [ideaId, organizationId]
  );
  if (!idea) return NO_ACCESS;

  const member = await db.get<{ id: string }>(
    "SELECT id FROM organization_members WHERE organization_id = ? AND user_id = ? AND status = 'ACTIVE'",
    [organizationId, userId]
  );
  if (!member) return NO_ACCESS;

  // T3 scope: membership alone gates both read and write. Finer-grained
  // write restrictions (e.g. role-based) are out of scope for DP-3 Wave 1.
  return { canRead: true, canWrite: true };
}

export interface CanonicalMapRow {
  id: string;
  ideaId: string;
  organizationId: string;
  version: number;
  [key: string]: unknown;
}

/**
 * Selects the canonical `my_idea_maps` row for `ideaId` (is_canonical = TRUE).
 *
 * Returns `null` when:
 *   - the `is_canonical` column doesn't exist yet in this environment
 *     (schema not migrated, or mock DB fallback list not yet aware of it —
 *     see server/src/utils/dbSchema.ts MOCK_TABLE_FALLBACK_COLUMNS); the
 *     caller MUST fall back to the legacy per-user row selection in this case.
 *   - no canonical row exists for the idea (e.g. data migration T2 hasn't
 *     run yet, or the idea has no map at all).
 */
export async function selectCanonicalMapRow(
  db: IDatabase,
  ideaId: string,
  organizationId: string
): Promise<CanonicalMapRow | null> {
  if (!db || !ideaId || !organizationId) return null;

  const mapCols = await getTableColumns('my_idea_maps');
  if (!mapCols.has('is_canonical')) return null;

  const row = await db.get<CanonicalMapRow>(
    `SELECT id, idea_id as "ideaId", organization_id as "organizationId", version
     FROM my_idea_maps
     WHERE idea_id = ? AND organization_id = ? AND is_canonical = TRUE
     LIMIT 1`,
    [ideaId, organizationId]
  );
  return row ?? null;
}

/**
 * CONTRACT PLACEHOLDER (T5 scope) — not implemented here.
 *
 * applyGraphPatchToCanonical(db, ideaId, organizationId, userId, patch) will:
 *   1. Serialize concurrent writes per ideaId (in-memory Map<ideaId, Promise>,
 *      single-writer queue — see plan §3).
 *   2. Read-modify-write the canonical row inside a transaction, bumping
 *      `version` and stamping `last_editor_user_id = userId`.
 *   3. Return the new version so the gateway can broadcast
 *      `{ type: 'graph_version', version }` to the room.
 *
 * Intentionally left unimplemented in T1-T3 — the gateway must keep using
 * pure in-memory relay (no persistence) until this lands.
 */
export const applyGraphPatchToCanonical = undefined;
