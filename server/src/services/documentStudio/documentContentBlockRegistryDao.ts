/**
 * Consultify Document Studio — Content Block Library Registry DAO
 * (Epic E10, Slice 10.2 → wave5 layer-2 persistence).
 *
 * Postgres-backed persistence layer behind the in-process Map cache in
 * `documentContentBlockService.ts`. Mirrors `documentApprovalRegistryDao.ts`:
 *
 *   - Best-effort write-through: every operation resolves to `{ ok: false }` /
 *     `null` / `[]` on any error and does NOT throw — the service falls back
 *     to its in-process Map cache when persistence is unavailable.
 *   - Reads (`loadContentBlocksForOrg`, `loadContentBlockById`,
 *     `loadAuditForContentBlock`) hydrate the cache lazily once per
 *     organization on cold start.
 *   - Tenant safety: every query carries `organization_id` in the WHERE
 *     clause; cross-tenant reads are deny-by-default.
 *
 * Storage backing: tables `document_content_blocks` +
 * `document_content_block_audit` (migration 781). The canonical object
 * (incl. nested tags[]/documentTypes[]/block) is stored in `payload_json`;
 * scalar columns mirror the fields used for WHERE/ordering.
 */

import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import type {
  DocumentContentBlockAuditEntry,
  DocumentContentBlockTemplate,
} from './documentStudioTypes.js';

interface BlockRow {
  content_block_id: string;
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

function rowToBlock(row: BlockRow): DocumentContentBlockTemplate | null {
  const block = parseJson<DocumentContentBlockTemplate | null>(row.payload_json, null);
  if (!block || !block.contentBlockId) return null;
  // Defensive: ensure array shapes survive a malformed payload.
  block.tags = Array.isArray(block.tags) ? block.tags : [];
  block.documentTypes = Array.isArray(block.documentTypes) ? block.documentTypes : [];
  return block;
}

function rowToAudit(row: AuditRow): DocumentContentBlockAuditEntry | null {
  const entry = parseJson<DocumentContentBlockAuditEntry | null>(row.payload_json, null);
  if (!entry || !entry.auditId) return null;
  return entry;
}

export async function loadContentBlocksForOrg(
  organizationId: string
): Promise<DocumentContentBlockTemplate[]> {
  if (!organizationId) return [];
  try {
    const rows = await dbAll<BlockRow>(
      `SELECT content_block_id, payload_json FROM document_content_blocks
         WHERE organization_id = $1
         ORDER BY created_at ASC`,
      [organizationId]
    );
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.map(rowToBlock).filter((b): b is DocumentContentBlockTemplate => b !== null);
  } catch (err) {
    logger.warn('[DocumentStudio][ContentBlockDao] loadContentBlocksForOrg failed', {
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

export async function loadContentBlockById(
  contentBlockId: string,
  organizationId: string
): Promise<DocumentContentBlockTemplate | null> {
  if (!contentBlockId || !organizationId) return null;
  try {
    const rows = await dbAll<BlockRow>(
      `SELECT content_block_id, payload_json FROM document_content_blocks
         WHERE content_block_id = $1 AND organization_id = $2
         LIMIT 1`,
      [contentBlockId, organizationId]
    );
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rowToBlock(rows[0]);
  } catch (err) {
    logger.warn('[DocumentStudio][ContentBlockDao] loadContentBlockById failed', {
      contentBlockId,
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Upsert a content-block template. Best-effort; never throws. Templates mutate
 * (status/version/block change) so this is ON CONFLICT DO UPDATE, not DO NOTHING.
 */
export async function persistContentBlock(
  template: DocumentContentBlockTemplate
): Promise<{ ok: boolean }> {
  if (!template || !template.contentBlockId || !template.organizationId) {
    return { ok: false };
  }
  try {
    const result = await dbRun(
      `INSERT INTO document_content_blocks (
         content_block_id, organization_id, status, created_at, updated_at, payload_json
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (content_block_id) DO UPDATE SET
         organization_id = EXCLUDED.organization_id,
         status = EXCLUDED.status,
         created_at = EXCLUDED.created_at,
         updated_at = EXCLUDED.updated_at,
         payload_json = EXCLUDED.payload_json`,
      [
        template.contentBlockId,
        template.organizationId,
        template.status ?? null,
        template.createdAt ?? null,
        template.updatedAt ?? null,
        JSON.stringify(template),
      ]
    );
    return { ok: result.success === true };
  } catch (err) {
    logger.warn('[DocumentStudio][ContentBlockDao] persistContentBlock failed', {
      contentBlockId: template.contentBlockId,
      organizationId: template.organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}

export async function loadAuditForContentBlock(
  contentBlockId: string,
  organizationId: string
): Promise<DocumentContentBlockAuditEntry[]> {
  if (!contentBlockId || !organizationId) return [];
  try {
    const rows = await dbAll<AuditRow>(
      `SELECT audit_id, payload_json FROM document_content_block_audit
         WHERE content_block_id = $1 AND organization_id = $2
         ORDER BY occurred_at ASC`,
      [contentBlockId, organizationId]
    );
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.map(rowToAudit).filter((e): e is DocumentContentBlockAuditEntry => e !== null);
  } catch (err) {
    logger.warn('[DocumentStudio][ContentBlockDao] loadAuditForContentBlock failed', {
      contentBlockId,
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
export async function persistContentBlockAuditEntry(
  entry: DocumentContentBlockAuditEntry
): Promise<{ ok: boolean }> {
  if (!entry || !entry.auditId || !entry.contentBlockId || !entry.organizationId) {
    return { ok: false };
  }
  try {
    const result = await dbRun(
      `INSERT INTO document_content_block_audit (
         audit_id, content_block_id, organization_id, action, actor_id,
         occurred_at, payload_json
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (audit_id) DO UPDATE SET
         content_block_id = EXCLUDED.content_block_id,
         organization_id = EXCLUDED.organization_id,
         action = EXCLUDED.action,
         actor_id = EXCLUDED.actor_id,
         occurred_at = EXCLUDED.occurred_at,
         payload_json = EXCLUDED.payload_json`,
      [
        entry.auditId,
        entry.contentBlockId,
        entry.organizationId,
        entry.action ?? null,
        entry.actorId ?? null,
        entry.occurredAt ?? null,
        JSON.stringify(entry),
      ]
    );
    return { ok: result.success === true };
  } catch (err) {
    logger.warn('[DocumentStudio][ContentBlockDao] persistContentBlockAuditEntry failed', {
      auditId: entry.auditId,
      organizationId: entry.organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}

/** @internal Test-only reset — best-effort DELETE of both tables. */
export async function __resetContentBlockRegistryDaoForTests(): Promise<void> {
  try {
    await dbRun('DELETE FROM document_content_block_audit', []);
    await dbRun('DELETE FROM document_content_blocks', []);
  } catch {
    /* best-effort: table may not exist in a unit-test sandbox */
  }
}
