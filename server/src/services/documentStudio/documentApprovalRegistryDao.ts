/**
 * Consultify Document Studio — Approval Workflow Registry DAO
 * (Epic E10, Slice 10.1 → wave5 layer-2 persistence).
 *
 * Postgres-backed persistence layer behind the in-process Map cache in
 * `documentApprovalService.ts`. Mirrors `documentVersionSnapshotRegistryDao.ts`:
 *
 *   - Best-effort write-through: every operation resolves to `{ ok: false }` /
 *     `null` / `[]` on any error and does NOT throw — the service falls back
 *     to its in-process Map cache when persistence is unavailable.
 *   - Reads (`loadApprovalsForArtifact`, `loadApprovalsForOrganization`,
 *     `loadAuditForApproval`) hydrate the cache lazily once per
 *     (organization, artifact) on cold start.
 *   - Tenant safety: every query carries `organization_id` in the WHERE clause;
 *     cross-tenant reads are deny-by-default.
 *
 * Storage backing: tables `document_approvals` + `document_approval_audit`
 * (migration 780). The canonical object (incl. nested participants[]/
 * decisions[]/details) is stored in `payload_json`; scalar columns mirror the
 * fields used for WHERE/ordering.
 */

import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import type { DocumentApprovalAuditEntry, DocumentApprovalRequest } from './documentStudioTypes.js';

interface ApprovalRow {
  approval_id: string;
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

function rowToApproval(row: ApprovalRow): DocumentApprovalRequest | null {
  const approval = parseJson<DocumentApprovalRequest | null>(row.payload_json, null);
  if (!approval || !approval.approvalId) return null;
  // Defensive: ensure array shapes survive a malformed payload.
  approval.participants = Array.isArray(approval.participants) ? approval.participants : [];
  approval.decisions = Array.isArray(approval.decisions) ? approval.decisions : [];
  return approval;
}

function rowToAudit(row: AuditRow): DocumentApprovalAuditEntry | null {
  const entry = parseJson<DocumentApprovalAuditEntry | null>(row.payload_json, null);
  if (!entry || !entry.auditId) return null;
  return entry;
}

/**
 * Load every approval for a given (org, artifact). Resolves to `[]` on any
 * failure so the service degrades to its in-process Map.
 */
export async function loadApprovalsForArtifact(
  artifactId: string,
  organizationId: string
): Promise<DocumentApprovalRequest[]> {
  if (!artifactId || !organizationId) return [];
  try {
    const rows = await dbAll<ApprovalRow>(
      `SELECT approval_id, payload_json FROM document_approvals
         WHERE artifact_id = $1 AND organization_id = $2
         ORDER BY created_at ASC`,
      [artifactId, organizationId]
    );
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.map(rowToApproval).filter((a): a is DocumentApprovalRequest => a !== null);
  } catch (err) {
    logger.warn('[DocumentStudio][ApprovalDao] loadApprovalsForArtifact failed', {
      artifactId,
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Load every approval visible to a tenant (tenant-wide dashboards).
 * Resolves to `[]` on any failure.
 */
export async function loadApprovalsForOrganization(
  organizationId: string
): Promise<DocumentApprovalRequest[]> {
  if (!organizationId) return [];
  try {
    const rows = await dbAll<ApprovalRow>(
      `SELECT approval_id, payload_json FROM document_approvals
         WHERE organization_id = $1
         ORDER BY created_at ASC`,
      [organizationId]
    );
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.map(rowToApproval).filter((a): a is DocumentApprovalRequest => a !== null);
  } catch (err) {
    logger.warn('[DocumentStudio][ApprovalDao] loadApprovalsForOrganization failed', {
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Single-approval lookup. Cross-tenant reads return `null` even when the
 * approval id exists under a different tenant (organization_id in WHERE).
 */
export async function loadApprovalById(
  approvalId: string,
  organizationId: string
): Promise<DocumentApprovalRequest | null> {
  if (!approvalId || !organizationId) return null;
  try {
    const rows = await dbAll<ApprovalRow>(
      `SELECT approval_id, payload_json FROM document_approvals
         WHERE approval_id = $1 AND organization_id = $2
         LIMIT 1`,
      [approvalId, organizationId]
    );
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rowToApproval(rows[0]);
  } catch (err) {
    logger.warn('[DocumentStudio][ApprovalDao] loadApprovalById failed', {
      approvalId,
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Upsert an approval. Best-effort; never throws. Approvals mutate (decisions
 * append, status changes) so this is ON CONFLICT DO UPDATE, not DO NOTHING.
 */
export async function persistApproval(approval: DocumentApprovalRequest): Promise<{ ok: boolean }> {
  if (!approval || !approval.approvalId || !approval.organizationId || !approval.artifactId) {
    return { ok: false };
  }
  try {
    const result = await dbRun(
      `INSERT INTO document_approvals (
         approval_id, artifact_id, organization_id, status, requested_by,
         created_at, updated_at, payload_json
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (approval_id) DO UPDATE SET
         artifact_id = EXCLUDED.artifact_id,
         organization_id = EXCLUDED.organization_id,
         status = EXCLUDED.status,
         requested_by = EXCLUDED.requested_by,
         created_at = EXCLUDED.created_at,
         updated_at = EXCLUDED.updated_at,
         payload_json = EXCLUDED.payload_json`,
      [
        approval.approvalId,
        approval.artifactId,
        approval.organizationId,
        approval.status ?? null,
        approval.requestedBy ?? null,
        approval.createdAt ?? null,
        approval.updatedAt ?? null,
        JSON.stringify(approval),
      ]
    );
    return { ok: result.success === true };
  } catch (err) {
    logger.warn('[DocumentStudio][ApprovalDao] persistApproval failed', {
      approvalId: approval.approvalId,
      organizationId: approval.organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}

/**
 * Load the audit trail for an approval, oldest-first. Resolves to `[]` on any
 * failure. organization_id in WHERE keeps cross-tenant reads deny-by-default.
 */
export async function loadAuditForApproval(
  approvalId: string,
  organizationId: string
): Promise<DocumentApprovalAuditEntry[]> {
  if (!approvalId || !organizationId) return [];
  try {
    const rows = await dbAll<AuditRow>(
      `SELECT audit_id, payload_json FROM document_approval_audit
         WHERE approval_id = $1 AND organization_id = $2
         ORDER BY occurred_at ASC`,
      [approvalId, organizationId]
    );
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.map(rowToAudit).filter((e): e is DocumentApprovalAuditEntry => e !== null);
  } catch (err) {
    logger.warn('[DocumentStudio][ApprovalDao] loadAuditForApproval failed', {
      approvalId,
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
export async function persistApprovalAuditEntry(
  entry: DocumentApprovalAuditEntry
): Promise<{ ok: boolean }> {
  if (!entry || !entry.auditId || !entry.approvalId || !entry.organizationId) {
    return { ok: false };
  }
  try {
    const result = await dbRun(
      `INSERT INTO document_approval_audit (
         audit_id, approval_id, artifact_id, organization_id, action, actor_id,
         occurred_at, payload_json
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (audit_id) DO UPDATE SET
         approval_id = EXCLUDED.approval_id,
         artifact_id = EXCLUDED.artifact_id,
         organization_id = EXCLUDED.organization_id,
         action = EXCLUDED.action,
         actor_id = EXCLUDED.actor_id,
         occurred_at = EXCLUDED.occurred_at,
         payload_json = EXCLUDED.payload_json`,
      [
        entry.auditId,
        entry.approvalId,
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
    logger.warn('[DocumentStudio][ApprovalDao] persistApprovalAuditEntry failed', {
      auditId: entry.auditId,
      organizationId: entry.organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: false };
  }
}

/** @internal Test-only reset — best-effort DELETE of both tables. */
export async function __resetApprovalRegistryDaoForTests(): Promise<void> {
  try {
    await dbRun('DELETE FROM document_approval_audit', []);
    await dbRun('DELETE FROM document_approvals', []);
  } catch {
    /* best-effort: table may not exist in a unit-test sandbox */
  }
}
