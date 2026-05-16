/**
 * Consultify Document Studio — Content Block Library Registry DAO
 * (Epic E10, Slice 10.2).
 *
 * Mirrors the `documentBrandVoiceRegistryDao.ts` design contract:
 *
 *   - Acts as the persistence layer behind the in-process Map cache in
 *     `documentContentBlockService.ts`. The service public API stays
 *     synchronous; persistence is best-effort write-through.
 *   - Every operation is failure-tolerant: a missing migration, a DB
 *     outage, or any other error path resolves to `{ ok: false }` /
 *     `null` / `[]` and does NOT throw. The service falls back to the
 *     in-process Map when persistence is unavailable.
 *   - Reads (`loadContentBlocksForOrg`, `loadAuditForContentBlock`)
 *     hydrate the cache lazily once per organization on cold start.
 *
 * Tenant safety: every query carries `organization_id` in the WHERE
 * clause; cross-tenant reads are deny-by-default.
 *
 * Storage backing (Slice 10.2): in-memory only; the wave5 persistence
 * migration ships in a follow-up. Public function signatures match the
 * Postgres-backed shape so the swap is mechanical.
 */

import type {
  DocumentContentBlockAuditEntry,
  DocumentContentBlockTemplate,
} from './documentStudioTypes.js';

const blockStore = new Map<string, DocumentContentBlockTemplate>();
const auditStore = new Map<string, DocumentContentBlockAuditEntry[]>();

function key(organizationId: string, contentBlockId: string): string {
  return `${organizationId}::${contentBlockId}`;
}

function cloneBlockTemplate(template: DocumentContentBlockTemplate): DocumentContentBlockTemplate {
  return {
    ...template,
    tags: [...template.tags],
    documentTypes: [...template.documentTypes],
    block: JSON.parse(JSON.stringify(template.block)) as DocumentContentBlockTemplate['block'],
  };
}

export async function loadContentBlocksForOrg(
  organizationId: string
): Promise<DocumentContentBlockTemplate[]> {
  if (!organizationId) return [];
  const prefix = `${organizationId}::`;
  const out: DocumentContentBlockTemplate[] = [];
  for (const [k, template] of blockStore.entries()) {
    if (!k.startsWith(prefix)) continue;
    out.push(cloneBlockTemplate(template));
  }
  return out;
}

export async function loadContentBlockById(
  contentBlockId: string,
  organizationId: string
): Promise<DocumentContentBlockTemplate | null> {
  if (!contentBlockId || !organizationId) return null;
  const template = blockStore.get(key(organizationId, contentBlockId));
  return template ? cloneBlockTemplate(template) : null;
}

export async function persistContentBlock(
  template: DocumentContentBlockTemplate
): Promise<{ ok: boolean }> {
  if (!template || !template.contentBlockId || !template.organizationId) {
    return { ok: false };
  }
  blockStore.set(
    key(template.organizationId, template.contentBlockId),
    cloneBlockTemplate(template)
  );
  return { ok: true };
}

export async function loadAuditForContentBlock(
  contentBlockId: string,
  organizationId: string
): Promise<DocumentContentBlockAuditEntry[]> {
  if (!contentBlockId || !organizationId) return [];
  const entries = auditStore.get(key(organizationId, contentBlockId));
  return entries
    ? entries.map((entry) => ({
        ...entry,
        details: entry.details ? { ...entry.details } : undefined,
      }))
    : [];
}

export async function persistContentBlockAuditEntry(
  entry: DocumentContentBlockAuditEntry
): Promise<{ ok: boolean }> {
  if (!entry || !entry.auditId || !entry.contentBlockId || !entry.organizationId) {
    return { ok: false };
  }
  const k = key(entry.organizationId, entry.contentBlockId);
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
export async function __resetContentBlockRegistryDaoForTests(): Promise<void> {
  blockStore.clear();
  auditStore.clear();
}
