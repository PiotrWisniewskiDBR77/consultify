/**
 * Consultify Document Studio — Approval Workflow Registry DAO
 * (Epic E10, Slice 10.1).
 *
 * Mirrors the `documentBrandVoiceRegistryDao.ts` design contract:
 *
 *   - Acts as the persistence layer behind the in-process Map cache in
 *     `documentApprovalService.ts`. The service public API stays
 *     synchronous; persistence is best-effort write-through.
 *   - Every operation is failure-tolerant: a missing migration, a DB
 *     outage, or any other error path resolves to `{ ok: false }` /
 *     `null` / `[]` and does NOT throw. The service falls back to the
 *     in-process Map when persistence is unavailable.
 *   - Reads (`loadApprovalsForArtifact`, `loadAuditForApproval`)
 *     hydrate the cache lazily once per (organization, artifact) on
 *     cold start.
 *
 * Tenant safety: every query carries `organization_id` in the WHERE
 * clause; cross-tenant reads are deny-by-default.
 *
 * Storage backing (Slice 10.1): in-memory only; the wave5 persistence
 * migration ships in a follow-up. Public function signatures match the
 * Postgres-backed shape so the swap is mechanical.
 */

import type { DocumentApprovalAuditEntry, DocumentApprovalRequest } from './documentStudioTypes.js';

const approvalStore = new Map<string, DocumentApprovalRequest>();
const auditStore = new Map<string, DocumentApprovalAuditEntry[]>();

function key(organizationId: string, approvalId: string): string {
  return `${organizationId}::${approvalId}`;
}

function cloneApproval(approval: DocumentApprovalRequest): DocumentApprovalRequest {
  return {
    ...approval,
    participants: approval.participants.map((participant) => ({ ...participant })),
    decisions: approval.decisions.map((decision) => ({ ...decision })),
  };
}

/**
 * Load every approval for a given (org, artifact). Cross-tenant rows
 * are filtered by the key prefix. Resolves to `[]` on any failure.
 */
export async function loadApprovalsForArtifact(
  artifactId: string,
  organizationId: string
): Promise<DocumentApprovalRequest[]> {
  if (!artifactId || !organizationId) return [];
  const prefix = `${organizationId}::`;
  const out: DocumentApprovalRequest[] = [];
  for (const [k, approval] of approvalStore.entries()) {
    if (!k.startsWith(prefix)) continue;
    if (approval.artifactId !== artifactId) continue;
    out.push(cloneApproval(approval));
  }
  return out;
}

/**
 * Load every approval visible to a tenant. Useful for tenant-wide
 * dashboards. Cross-tenant rows filtered by key prefix; resolves to
 * `[]` on any failure.
 */
export async function loadApprovalsForOrganization(
  organizationId: string
): Promise<DocumentApprovalRequest[]> {
  if (!organizationId) return [];
  const prefix = `${organizationId}::`;
  const out: DocumentApprovalRequest[] = [];
  for (const [k, approval] of approvalStore.entries()) {
    if (!k.startsWith(prefix)) continue;
    out.push(cloneApproval(approval));
  }
  return out;
}

/**
 * Single-approval lookup. Cross-tenant reads return `null` even when
 * the approval id exists under a different tenant.
 */
export async function loadApprovalById(
  approvalId: string,
  organizationId: string
): Promise<DocumentApprovalRequest | null> {
  if (!approvalId || !organizationId) return null;
  const approval = approvalStore.get(key(organizationId, approvalId));
  return approval ? cloneApproval(approval) : null;
}

/**
 * Upsert an approval. Best-effort; never throws. Returns
 * `{ ok: false }` on an empty input so the service can degrade.
 */
export async function persistApproval(approval: DocumentApprovalRequest): Promise<{ ok: boolean }> {
  if (!approval || !approval.approvalId || !approval.organizationId) return { ok: false };
  approvalStore.set(key(approval.organizationId, approval.approvalId), cloneApproval(approval));
  return { ok: true };
}

export async function loadAuditForApproval(
  approvalId: string,
  organizationId: string
): Promise<DocumentApprovalAuditEntry[]> {
  if (!approvalId || !organizationId) return [];
  const entries = auditStore.get(key(organizationId, approvalId));
  return entries
    ? entries.map((entry) => ({
        ...entry,
        details: entry.details ? { ...entry.details } : undefined,
      }))
    : [];
}

/**
 * Append a single audit entry. Idempotent on duplicate `auditId` — a
 * second persist with the same id replaces the previous row so retries
 * don't double-count.
 */
export async function persistApprovalAuditEntry(
  entry: DocumentApprovalAuditEntry
): Promise<{ ok: boolean }> {
  if (!entry || !entry.auditId || !entry.approvalId || !entry.organizationId) {
    return { ok: false };
  }
  const k = key(entry.organizationId, entry.approvalId);
  const current = auditStore.get(k) ?? [];
  const filtered = current.filter((existing) => existing.auditId !== entry.auditId);
  filtered.push({
    ...entry,
    details: entry.details ? { ...entry.details } : undefined,
  });
  auditStore.set(k, filtered);
  return { ok: true };
}

/** @internal Test-only reset of both in-memory stores. */
export async function __resetApprovalRegistryDaoForTests(): Promise<void> {
  approvalStore.clear();
  auditStore.clear();
}
