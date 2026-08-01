/**
 * Consultify Document Studio — Share Link Registry DAO
 * (Epic E13 → wave5 layer-2 persistence).
 *
 * Postgres-backed persistence layer behind the in-process Map cache in
 * `documentShareLinkService.ts`. Mirrors `documentApprovalRegistryDao.ts`:
 *
 *   - Best-effort write-through: every operation resolves to `{ ok: false }` /
 *     `null` / `[]` / `0` on any error and does NOT throw — the service falls
 *     back to its in-process Map cache when persistence is unavailable.
 *   - Reads (`loadShareLinksForOrg`, `loadShareLinkById`,
 *     `loadShareLinkByToken`, `loadShareLinkByTokenHash`,
 *     `loadAuditForShareLink`) hydrate the cache lazily on cold start.
 *   - Tenant safety: every primary-key query carries `organization_id` so
 *     cross-tenant reads are deny-by-default. The token / token-hash resolves
 *     intentionally do NOT take a tenant id — the token itself is the auth
 *     signal and the resolver returns the owning tenant on the row.
 *
 * Storage backing: tables `document_share_links` + `document_share_link_audit`
 * (migration 781). The canonical object is stored in `payload_json`; scalar
 * columns (incl. `token` / `token_hash` secondary-index columns) mirror the
 * fields used for WHERE/ordering.
 */

import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import type {
  DocumentShareLink,
  DocumentShareLinkAuditEntry,
  DocumentShareLinkStatus,
} from './documentStudioTypes.js';

interface LinkRow {
  share_link_id: string;
  payload_json: unknown;
}

interface AuditRow {
  audit_id: string;
  payload_json: unknown;
}

interface CountRow {
  count: number | string;
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

function rowToLink(row: LinkRow): DocumentShareLink | null {
  const link = parseJson<DocumentShareLink | null>(row.payload_json, null);
  if (!link || !link.shareLinkId) return null;
  return link;
}

function rowToAudit(row: AuditRow): DocumentShareLinkAuditEntry | null {
  const entry = parseJson<DocumentShareLinkAuditEntry | null>(row.payload_json, null);
  if (!entry || !entry.auditId) return null;
  return entry;
}

/**
 * Load every share link visible to a tenant. Resolves to `[]` on any failure
 * so the service degrades to its in-process Map.
 */
export async function loadShareLinksForOrg(organizationId: string): Promise<DocumentShareLink[]> {
  if (!organizationId) return [];
  try {
    const rows = await dbAll<LinkRow>(
      `SELECT share_link_id, payload_json FROM document_share_links
         WHERE organization_id = $1
         ORDER BY created_at ASC`,
      [organizationId]
    );
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.map(rowToLink).filter((l): l is DocumentShareLink => l !== null);
  } catch (err) {
    logger.warn('[DocumentStudio][ShareLinkDao] loadShareLinksForOrg failed', {
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Single-link lookup by primary key. Cross-tenant reads return `null`
 * even when the share-link id exists under a different tenant.
 */
export async function loadShareLinkById(
  shareLinkId: string,
  organizationId: string
): Promise<DocumentShareLink | null> {
  if (!shareLinkId || !organizationId) return null;
  try {
    const rows = await dbAll<LinkRow>(
      `SELECT share_link_id, payload_json FROM document_share_links
         WHERE share_link_id = $1 AND organization_id = $2
         LIMIT 1`,
      [shareLinkId, organizationId]
    );
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rowToLink(rows[0]);
  } catch (err) {
    logger.warn('[DocumentStudio][ShareLinkDao] loadShareLinkById failed', {
      shareLinkId,
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Token-based resolve. Returns the link AND its owning organization (carried
 * on the row) because the consumer does not know the tenant in advance — the
 * service stamps the resulting tuple on every downstream mutation. Returns
 * `null` for an empty / unknown token.
 */
export async function loadShareLinkByToken(token: string): Promise<DocumentShareLink | null> {
  if (!token || token.trim().length === 0) return null;
  try {
    const rows = await dbAll<LinkRow>(
      `SELECT share_link_id, payload_json FROM document_share_links
         WHERE token = $1
         LIMIT 1`,
      [token]
    );
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rowToLink(rows[0]);
  } catch (err) {
    logger.warn('[DocumentStudio][ShareLinkDao] loadShareLinkByToken failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Hash-based resolve used by the hardening path — the DAO-level companion
 * for the service's HMAC verification flow. Returns `null` for an empty /
 * unknown hash.
 */
export async function loadShareLinkByTokenHash(
  tokenHash: string
): Promise<DocumentShareLink | null> {
  if (!tokenHash || tokenHash.trim().length === 0) return null;
  try {
    const rows = await dbAll<LinkRow>(
      `SELECT share_link_id, payload_json FROM document_share_links
         WHERE token_hash = $1
         LIMIT 1`,
      [tokenHash]
    );
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rowToLink(rows[0]);
  } catch (err) {
    logger.warn('[DocumentStudio][ShareLinkDao] loadShareLinkByTokenHash failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Upsert a share link. Best-effort; never throws. Links mutate (status /
 * consume-count / revocation metadata change) so this is ON CONFLICT DO
 * UPDATE. The `token` / `token_hash` index columns are kept in sync via
 * EXCLUDED so a rotated token can never resolve to a stale row.
 */
export async function persistShareLink(link: DocumentShareLink): Promise<{ ok: boolean }> {
  if (!link || !link.shareLinkId || !link.organizationId || !link.token) {
    return { ok: false };
  }
  try {
    const result = await dbRun(
      `INSERT INTO document_share_links (
         share_link_id, artifact_id, organization_id, token, token_hash,
         status, created_at, payload_json
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (share_link_id) DO UPDATE SET
         artifact_id = EXCLUDED.artifact_id,
         organization_id = EXCLUDED.organization_id,
         token = EXCLUDED.token,
         token_hash = EXCLUDED.token_hash,
         status = EXCLUDED.status,
         created_at = EXCLUDED.created_at,
         payload_json = EXCLUDED.payload_json`,
      [
        link.shareLinkId,
        link.artifactId,
        link.organizationId,
        link.token,
        link.tokenHash ?? null,
        link.status ?? null,
        link.createdAt ?? null,
        JSON.stringify(link),
      ]
    );
    return { ok: result.success === true };
  } catch (err) {
    logger.warn('[DocumentStudio][ShareLinkDao] persistShareLink failed', {
      shareLinkId: link.shareLinkId,
      organizationId: link.organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}

/**
 * Revoke an active link with a compare-and-set update. A concurrent rotation
 * may complete first, but it cannot resurrect the row after this update.
 */
export async function revokeActiveShareLinkInDao(
  link: DocumentShareLink
): Promise<{ ok: boolean; conflict: boolean }> {
  if (!link?.shareLinkId || !link.organizationId) return { ok: false, conflict: false };
  try {
    const result = await dbRun(
      `UPDATE document_share_links
          SET status = $3, payload_json = $4::jsonb
        WHERE share_link_id = $1 AND organization_id = $2 AND status = 'active'`,
      [link.shareLinkId, link.organizationId, link.status, JSON.stringify(link)]
    );
    if (result.success !== true) return { ok: false, conflict: false };
    return { ok: true, conflict: (result.changes ?? 0) !== 1 };
  } catch (err) {
    logger.warn('[DocumentStudio][ShareLinkDao] revokeActiveShareLinkInDao failed', {
      shareLinkId: link.shareLinkId,
      organizationId: link.organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, conflict: false };
  }
}

/** Rotate only the exact active token version observed by the caller. */
export async function rotateActiveShareLinkTokenInDao(
  link: DocumentShareLink,
  expectedTokenHash: string
): Promise<{ ok: boolean; conflict: boolean }> {
  if (!link?.shareLinkId || !link.organizationId || !expectedTokenHash) {
    return { ok: false, conflict: false };
  }
  try {
    const result = await dbRun(
      `UPDATE document_share_links
          SET token = $4, token_hash = $5, payload_json = $6::jsonb
        WHERE share_link_id = $1 AND organization_id = $2
          AND status = 'active' AND token_hash = $3`,
      [
        link.shareLinkId,
        link.organizationId,
        expectedTokenHash,
        link.token,
        link.tokenHash ?? null,
        JSON.stringify(link),
      ]
    );
    if (result.success !== true) return { ok: false, conflict: false };
    return { ok: true, conflict: (result.changes ?? 0) !== 1 };
  } catch (err) {
    logger.warn('[DocumentStudio][ShareLinkDao] rotateActiveShareLinkTokenInDao failed', {
      shareLinkId: link.shareLinkId,
      organizationId: link.organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, conflict: false };
  }
}

/**
 * Apply a status update + revocation metadata in a single hop. Used by the
 * service's `revokeShareLink` path so the DAO never sees a half-revoked row.
 * Updates both the scalar `status` column and the persisted payload. Returns
 * `{ ok: false }` when the link does not exist for the tenant.
 */
export async function markShareLinkStatusInDao(
  shareLinkId: string,
  organizationId: string,
  patch: Pick<DocumentShareLink, 'status'> &
    Partial<Pick<DocumentShareLink, 'revokedBy' | 'revokedAt' | 'revokedReason'>>
): Promise<{ ok: boolean }> {
  if (!shareLinkId || !organizationId) return { ok: false };
  try {
    const existing = await loadShareLinkById(shareLinkId, organizationId);
    if (!existing) return { ok: false };
    const next: DocumentShareLink = {
      ...existing,
      status: patch.status,
      revokedBy: patch.revokedBy ?? existing.revokedBy,
      revokedAt: patch.revokedAt ?? existing.revokedAt,
      revokedReason: patch.revokedReason ?? existing.revokedReason,
    };
    const result = await dbRun(
      `UPDATE document_share_links
         SET status = $3, payload_json = $4::jsonb
         WHERE share_link_id = $1 AND organization_id = $2`,
      [shareLinkId, organizationId, next.status ?? null, JSON.stringify(next)]
    );
    return { ok: result.success === true };
  } catch (err) {
    logger.warn('[DocumentStudio][ShareLinkDao] markShareLinkStatusInDao failed', {
      shareLinkId,
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}

/**
 * Increment the consume counter alongside `lastConsumedAt`. The service uses
 * this on every successful `consumeShareLink` so the right-panel surface can
 * show "Used N times" without scanning the audit log. Returns the
 * post-increment count or `null` when the link does not exist.
 */
export async function bumpShareLinkConsumeCount(
  shareLinkId: string,
  organizationId: string,
  consumedAt: string
): Promise<number | null> {
  if (!shareLinkId || !organizationId) return null;
  try {
    const existing = await loadShareLinkById(shareLinkId, organizationId);
    if (!existing) return null;
    const next: DocumentShareLink = {
      ...existing,
      consumeCount: (existing.consumeCount ?? 0) + 1,
      lastConsumedAt: consumedAt,
    };
    const result = await dbRun(
      `UPDATE document_share_links
         SET payload_json = $3::jsonb
         WHERE share_link_id = $1 AND organization_id = $2`,
      [shareLinkId, organizationId, JSON.stringify(next)]
    );
    if (result.success !== true) return null;
    return next.consumeCount;
  } catch (err) {
    logger.warn('[DocumentStudio][ShareLinkDao] bumpShareLinkConsumeCount failed', {
      shareLinkId,
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Load the full audit trail for a link, oldest-first (occurredAt ASC). Returns
 * `[]` on any failure or cross-tenant attempt.
 */
export async function loadAuditForShareLink(
  shareLinkId: string,
  organizationId: string
): Promise<DocumentShareLinkAuditEntry[]> {
  if (!shareLinkId || !organizationId) return [];
  try {
    const rows = await dbAll<AuditRow>(
      `SELECT audit_id, payload_json FROM document_share_link_audit
         WHERE share_link_id = $1 AND organization_id = $2
         ORDER BY occurred_at ASC`,
      [shareLinkId, organizationId]
    );
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.map(rowToAudit).filter((e): e is DocumentShareLinkAuditEntry => e !== null);
  } catch (err) {
    logger.warn('[DocumentStudio][ShareLinkDao] loadAuditForShareLink failed', {
      shareLinkId,
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
export async function persistShareLinkAuditEntry(
  entry: DocumentShareLinkAuditEntry
): Promise<{ ok: boolean }> {
  if (!entry || !entry.auditId || !entry.shareLinkId || !entry.organizationId) {
    return { ok: false };
  }
  try {
    const result = await dbRun(
      `INSERT INTO document_share_link_audit (
         audit_id, share_link_id, artifact_id, organization_id, action, actor_id,
         occurred_at, payload_json
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (audit_id) DO UPDATE SET
         share_link_id = EXCLUDED.share_link_id,
         artifact_id = EXCLUDED.artifact_id,
         organization_id = EXCLUDED.organization_id,
         action = EXCLUDED.action,
         actor_id = EXCLUDED.actor_id,
         occurred_at = EXCLUDED.occurred_at,
         payload_json = EXCLUDED.payload_json`,
      [
        entry.auditId,
        entry.shareLinkId,
        entry.artifactId ?? null,
        entry.organizationId,
        entry.action ?? null,
        entry.actorId ?? null,
        entry.occurredAt ?? null,
        JSON.stringify(entry),
      ]
    );
    return { ok: result.success === true };
  } catch (err) {
    logger.warn('[DocumentStudio][ShareLinkDao] persistShareLinkAuditEntry failed', {
      auditId: entry.auditId,
      organizationId: entry.organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}

/**
 * Count active links for an artifact without copying the rows. Resolves to
 * `0` on any failure path.
 */
export async function countActiveShareLinksForArtifact(
  artifactId: string,
  organizationId: string,
  statusToCount: DocumentShareLinkStatus = 'active'
): Promise<number> {
  if (!artifactId || !organizationId) return 0;
  try {
    const rows = await dbAll<CountRow>(
      `SELECT COUNT(*)::int AS count FROM document_share_links
         WHERE artifact_id = $1 AND organization_id = $2 AND status = $3`,
      [artifactId, organizationId, statusToCount]
    );
    if (!Array.isArray(rows) || rows.length === 0) return 0;
    return Number(rows[0].count) || 0;
  } catch (err) {
    logger.warn('[DocumentStudio][ShareLinkDao] countActiveShareLinksForArtifact failed', {
      artifactId,
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

/** @internal Test-only reset — best-effort DELETE of both tables. */
export async function __resetShareLinkRegistryDaoForTests(): Promise<void> {
  try {
    await dbRun('DELETE FROM document_share_link_audit', []);
    await dbRun('DELETE FROM document_share_links', []);
  } catch {
    /* best-effort: table may not exist in a unit-test sandbox */
  }
}
