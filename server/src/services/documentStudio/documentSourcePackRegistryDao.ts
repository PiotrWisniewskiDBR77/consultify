/**
 * Consultify Document Studio — Source Pack Registry DAO
 * (Epic E4, Slice 4.1 → wave5 layer-2 persistence).
 *
 * Postgres-backed persistence layer behind the in-process Map cache in
 * `documentSourcePackService.ts`. Mirrors `documentApprovalRegistryDao.ts`:
 *
 *   - Best-effort write-through: every operation resolves to `{ ok: false }` /
 *     `null` / `[]` on any error and does NOT throw — the service falls back
 *     to its in-process Map cache when persistence is unavailable.
 *   - Reads (`loadSourcePacksForOrg`, `loadSourcePackById`, `loadAuditForPack`)
 *     hydrate the cache lazily once per organization on cold start.
 *   - Tenant safety: every query carries `organization_id` in the WHERE
 *     clause; cross-tenant reads are deny-by-default.
 *
 * Storage backing: tables `document_source_packs` +
 * `document_source_pack_audit` (migration 781). The canonical object — incl.
 * the nested `items[]` (SourcePackItem) — is stored in `payload_json`; the
 * pack is always read/written whole, so items need no standalone table.
 * Scalar columns mirror the fields used for WHERE/ordering/status.
 */

import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import type { SourcePack, SourcePackAuditEntry, SourcePackStatus } from './documentStudioTypes.js';

interface PackRow {
  pack_id: string;
  payload_json: unknown;
}

interface AuditRow {
  audit_id: string;
  payload_json: unknown;
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

function rowToPack(row: PackRow): SourcePack | null {
  const pack = parseJson<SourcePack | null>(row.payload_json, null);
  if (!pack || !pack.packId) return null;
  // Defensive: ensure the nested items array survives a malformed payload.
  pack.items = Array.isArray(pack.items) ? pack.items : [];
  return pack;
}

function rowToAudit(row: AuditRow): SourcePackAuditEntry | null {
  const entry = parseJson<SourcePackAuditEntry | null>(row.payload_json, null);
  if (!entry || !entry.auditId) return null;
  return entry;
}

/**
 * Load every pack visible to a tenant. Resolves to `[]` on any failure
 * so the service degrades to its in-process Map.
 */
export async function loadSourcePacksForOrg(organizationId: string): Promise<SourcePack[]> {
  if (!organizationId) return [];
  try {
    const rows = await dbAll<PackRow>(
      `SELECT pack_id, payload_json FROM document_source_packs
         WHERE organization_id = $1
         ORDER BY created_at ASC`,
      [organizationId]
    );
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.map(rowToPack).filter((p): p is SourcePack => p !== null);
  } catch (err) {
    logger.warn('[DocumentStudio][SourcePackDao] loadSourcePacksForOrg failed', {
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Single-pack lookup. Cross-tenant reads return `null` even when the
 * pack id exists under a different tenant (organization_id in WHERE).
 */
export async function loadSourcePackById(
  packId: string,
  organizationId: string
): Promise<SourcePack | null> {
  if (!packId || !organizationId) return null;
  try {
    const rows = await dbAll<PackRow>(
      `SELECT pack_id, payload_json FROM document_source_packs
         WHERE pack_id = $1 AND organization_id = $2
         LIMIT 1`,
      [packId, organizationId]
    );
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rowToPack(rows[0]);
  } catch (err) {
    logger.warn('[DocumentStudio][SourcePackDao] loadSourcePackById failed', {
      packId,
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Upsert a pack. Best-effort; never throws. Packs mutate (items append,
 * status/totalContentLength change) so this is ON CONFLICT DO UPDATE.
 */
export async function persistSourcePack(pack: SourcePack): Promise<{ ok: boolean }> {
  if (!pack || !pack.packId || !pack.organizationId) return { ok: false };
  try {
    const result = await dbRun(
      `INSERT INTO document_source_packs (
         pack_id, organization_id, status, created_at, updated_at, payload_json
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (pack_id) DO UPDATE SET
         organization_id = EXCLUDED.organization_id,
         status = EXCLUDED.status,
         created_at = EXCLUDED.created_at,
         updated_at = EXCLUDED.updated_at,
         payload_json = EXCLUDED.payload_json`,
      [
        pack.packId,
        pack.organizationId,
        pack.status ?? null,
        pack.createdAt ?? null,
        pack.updatedAt ?? null,
        JSON.stringify(pack),
      ]
    );
    return { ok: result.success === true };
  } catch (err) {
    logger.warn('[DocumentStudio][SourcePackDao] persistSourcePack failed', {
      packId: pack.packId,
      organizationId: pack.organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}

const PACK_UPSERT_SQL = `INSERT INTO document_source_packs (
     pack_id, organization_id, status, created_at, updated_at, payload_json
   ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
   ON CONFLICT (pack_id) DO UPDATE SET
     organization_id = EXCLUDED.organization_id,
     status = EXCLUDED.status,
     created_at = EXCLUDED.created_at,
     updated_at = EXCLUDED.updated_at,
     payload_json = EXCLUDED.payload_json`;

const AUDIT_UPSERT_SQL = `INSERT INTO document_source_pack_audit (
     audit_id, pack_id, organization_id, action, actor_id,
     occurred_at, payload_json
   ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
   ON CONFLICT (audit_id) DO UPDATE SET
     pack_id = EXCLUDED.pack_id,
     organization_id = EXCLUDED.organization_id,
     action = EXCLUDED.action,
     actor_id = EXCLUDED.actor_id,
     occurred_at = EXCLUDED.occurred_at,
     payload_json = EXCLUDED.payload_json`;

const packParams = (pack: SourcePack): unknown[] => [
  pack.packId,
  pack.organizationId,
  pack.status ?? null,
  pack.createdAt ?? null,
  pack.updatedAt ?? null,
  JSON.stringify(pack),
];

const auditParams = (entry: SourcePackAuditEntry): unknown[] => [
  entry.auditId,
  entry.packId,
  entry.organizationId,
  entry.action ?? null,
  entry.actorId ?? null,
  entry.occurredAt ?? null,
  JSON.stringify(entry),
];

/**
 * Atomic write-through for one lifecycle transition: the pack row and the
 * audit row that describes the transition land together, or neither lands.
 *
 * WHY THIS REPLACES THE FIRE-AND-FORGET PAIR: the service used to issue
 * `void persistSourcePack(next).catch(...)` and `void
 * persistSourcePackAuditEntry(entry).catch(...)` and return synchronously.
 * Both upserts target the SAME `pack_id` row across a draft → add-item →
 * mark-ready sequence, so three un-awaited upserts could complete out of
 * order and an earlier one could overwrite a later one — a pack promoted to
 * `ready` in memory came back from Postgres as `draft`. Under the in-memory
 * mock the promises resolved on the microtask queue in issue order, which is
 * why the defect was invisible to the mocked test suite and only appeared
 * against a real database.
 *
 * Unlike the single-row helpers above this does NOT swallow failures: the
 * caller must decide, because reporting a persisted lifecycle transition that
 * did not persist is precisely the false-success the fire-and-forget shape
 * produced.
 *
 * `DbPromise.transaction()` is deliberately NOT used — it issues BEGIN, the
 * statements and COMMIT as separate pooled calls that can land on different
 * physical connections, so it provides no atomicity on Postgres. The pinned
 * single-connection helper is used instead. When the process is running
 * against the in-memory mock (unit tests without `RUN_DB_TESTS`) there is no
 * pool to pin, so the writes are issued sequentially — still awaited, which
 * is what makes the ordering deterministic in both modes.
 */
export async function persistSourcePackWithAudit(
  pack: SourcePack,
  audit: SourcePackAuditEntry | null
): Promise<{ ok: boolean; error?: string }> {
  if (!pack || !pack.packId || !pack.organizationId) {
    return { ok: false, error: 'invalid_pack' };
  }
  if (audit && (!audit.auditId || !audit.packId || !audit.organizationId)) {
    return { ok: false, error: 'invalid_audit_entry' };
  }

  try {
    const { getDatabaseAsync } = await import('../../database/Database.js');
    const db = (await getDatabaseAsync()) as { isMock?: boolean };

    if (db?.isMock === true) {
      await dbRun(PACK_UPSERT_SQL, packParams(pack), { fallback: false });
      if (audit) await dbRun(AUDIT_UPSERT_SQL, auditParams(audit), { fallback: false });
      return { ok: true };
    }

    const { withPgTransaction } = await import('../../database/PostgresDatabase.js');
    await withPgTransaction(async (query) => {
      await query(PACK_UPSERT_SQL, packParams(pack));
      if (audit) await query(AUDIT_UPSERT_SQL, auditParams(audit));
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[DocumentStudio][SourcePackDao] persistSourcePackWithAudit failed', {
      packId: pack.packId,
      organizationId: pack.organizationId,
      message,
    });
    return { ok: false, error: message };
  }
}

/**
 * Load the full audit trail for a pack, oldest-first. Returns `[]` on any
 * failure or cross-tenant attempt.
 */
export async function loadAuditForPack(
  packId: string,
  organizationId: string
): Promise<SourcePackAuditEntry[]> {
  if (!packId || !organizationId) return [];
  try {
    const rows = await dbAll<AuditRow>(
      `SELECT audit_id, payload_json FROM document_source_pack_audit
         WHERE pack_id = $1 AND organization_id = $2
         ORDER BY occurred_at ASC`,
      [packId, organizationId]
    );
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.map(rowToAudit).filter((e): e is SourcePackAuditEntry => e !== null);
  } catch (err) {
    logger.warn('[DocumentStudio][SourcePackDao] loadAuditForPack failed', {
      packId,
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Append/replace a single audit entry. Idempotent on duplicate `auditId`
 * (ON CONFLICT DO UPDATE) so retries don't double-count.
 */
export async function persistSourcePackAuditEntry(
  entry: SourcePackAuditEntry
): Promise<{ ok: boolean }> {
  if (!entry || !entry.auditId || !entry.packId || !entry.organizationId) {
    return { ok: false };
  }
  try {
    const result = await dbRun(
      `INSERT INTO document_source_pack_audit (
         audit_id, pack_id, organization_id, action, actor_id,
         occurred_at, payload_json
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (audit_id) DO UPDATE SET
         pack_id = EXCLUDED.pack_id,
         organization_id = EXCLUDED.organization_id,
         action = EXCLUDED.action,
         actor_id = EXCLUDED.actor_id,
         occurred_at = EXCLUDED.occurred_at,
         payload_json = EXCLUDED.payload_json`,
      [
        entry.auditId,
        entry.packId,
        entry.organizationId,
        entry.action ?? null,
        entry.actorId ?? null,
        entry.occurredAt ?? null,
        JSON.stringify(entry),
      ]
    );
    return { ok: result.success === true };
  } catch (err) {
    logger.warn('[DocumentStudio][SourcePackDao] persistSourcePackAuditEntry failed', {
      auditId: entry.auditId,
      organizationId: entry.organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}

/**
 * Soft-delete sentinel: flips the pack's lifecycle status (e.g. to
 * `archived`) in both the scalar `status` column and the `payload_json`
 * copy so reads stay consistent. Best-effort; returns `{ ok: false }`
 * when the pack does not exist for the tenant.
 */
export async function markSourcePackArchivedInDao(
  packId: string,
  organizationId: string,
  status: SourcePackStatus
): Promise<{ ok: boolean }> {
  if (!packId || !organizationId) return { ok: false };
  try {
    const result = await dbRun(
      `UPDATE document_source_packs
         SET status = $3,
             payload_json = jsonb_set(payload_json, '{status}', to_jsonb($3::text), true)
         WHERE pack_id = $1 AND organization_id = $2`,
      [packId, organizationId, status]
    );
    return { ok: result.success === true };
  } catch (err) {
    logger.warn('[DocumentStudio][SourcePackDao] markSourcePackArchivedInDao failed', {
      packId,
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}

/** @internal Test-only reset — best-effort DELETE of both tables. */
export async function __resetSourcePackRegistryDaoForTests(): Promise<void> {
  try {
    await dbRun('DELETE FROM document_source_pack_audit', []);
    await dbRun('DELETE FROM document_source_packs', []);
  } catch {
    /* best-effort: table may not exist in a unit-test sandbox */
  }
}
