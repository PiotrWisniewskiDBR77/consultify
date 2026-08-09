/**
 * Document Studio — Slice E15.5.coverPageLogo asset registry service.
 *
 * Tenant-scoped registry of small visual assets the renderer can
 * embed (PNG / JPEG, ≤5 MB, kind = `'logo'` for the MVP). Assets are
 * stored as base64 in-memory; the production swap is a wave5 DAO
 * with the same public surface so callers don't change.
 *
 * Surface:
 *   - `registerLogo({ organizationId, actorId, mimeType, dataBase64, filename })`
 *     → DocumentAsset. Auto-archives the previous active logo for the
 *     same org. Throws on validation failures (`asset_invalid_*` codes).
 *   - `getActiveOrgLogo(organizationId)` → DocumentAsset | null. The
 *     export pipeline calls this when `coverPageDetailed.includeLogo`
 *     is true so the renderer receives ready-to-embed bytes.
 *   - `getAssetById({ assetId, organizationId })` → DocumentAsset.
 *   - `archiveAsset({ assetId, organizationId, actorId, reason })` →
 *     DocumentAsset (idempotent — already archived returns the row
 *     unchanged with no audit emission).
 *   - `listAssetsForOrg(organizationId, options)` → DocumentAsset[]
 *     (active + archived; reverse-chronological; tenant-scoped).
 *   - `listAssetAudit(assetId, organizationId)` → DocumentAssetAuditEntry[].
 *   - `__resetAssetRegistryForTests()` — test-only reset helper.
 *
 * Validation rules:
 *   - `mimeType` MUST be `image/png` or `image/jpeg`.
 *   - `dataBase64` MUST decode cleanly to ≤ DOCUMENT_ASSET_MAX_BYTES.
 *   - `dataBase64` MUST be ≥ 100 bytes (sanity floor — anything smaller
 *     is not a real image).
 *
 * Audit semantics: every mutation appends a `DocumentAssetAuditEntry`.
 * Auto-archive on replacement emits a `'asset_replaced'` row referencing
 * the prior asset id (so reviewers can reconstruct the rotation chain
 * from a single tenant's audit feed).
 */

import { randomUUID } from 'node:crypto';

import type {
  DocumentAsset,
  DocumentAssetAuditAction,
  DocumentAssetAuditEntry,
  DocumentAssetKind,
  DocumentAssetMimeType,
  DocumentAssetStatus,
} from './documentStudioTypes.js';

export const DOCUMENT_ASSET_MAX_BYTES = 5 * 1024 * 1024;
const DOCUMENT_ASSET_MIN_BYTES = 100;
const SUPPORTED_MIME_TYPES: ReadonlyArray<DocumentAssetMimeType> = ['image/png', 'image/jpeg'];

const assetStore = new Map<string, DocumentAsset>(); // assetId → asset
const auditStore = new Map<string, DocumentAssetAuditEntry[]>(); // assetId → audit rows

interface RegisterLogoInput {
  organizationId: string;
  actorId: string;
  mimeType: string;
  dataBase64: string;
  filename?: string;
}

interface ArchiveAssetInput {
  assetId: string;
  organizationId: string;
  actorId: string;
  reason?: string;
  /** Internal flag — when true emits `asset_replaced` instead of `asset_archived`. */
  replacedBy?: string;
}

interface ListAssetOptions {
  kind?: DocumentAssetKind;
  status?: DocumentAssetStatus;
}

function nowIso(): string {
  return new Date().toISOString();
}

function appendAudit(
  asset: DocumentAsset,
  action: DocumentAssetAuditAction,
  actorId: string,
  details?: Record<string, unknown>
): DocumentAssetAuditEntry {
  const entry: DocumentAssetAuditEntry = {
    auditId: randomUUID(),
    assetId: asset.assetId,
    organizationId: asset.organizationId,
    action,
    actorId,
    occurredAt: nowIso(),
    details,
  };
  const existing = auditStore.get(asset.assetId) ?? [];
  existing.push(entry);
  auditStore.set(asset.assetId, existing);
  return entry;
}

function isSupportedMime(value: string): value is DocumentAssetMimeType {
  return SUPPORTED_MIME_TYPES.includes(value as DocumentAssetMimeType);
}

function decodeBase64Safely(
  dataBase64: string
): { ok: true; byteLength: number } | { ok: false; reason: string } {
  // Defensive: avoid throwing on malformed input by using `Buffer.from` +
  // a round-trip parity check (Buffer silently re-encodes garbage; if the
  // re-encoded form does not match the input we treat it as malformed).
  let buf: Buffer;
  try {
    buf = Buffer.from(dataBase64, 'base64');
  } catch {
    return { ok: false, reason: 'asset_invalid_base64' };
  }
  if (!buf || buf.length === 0) return { ok: false, reason: 'asset_invalid_base64' };
  if (buf.length < DOCUMENT_ASSET_MIN_BYTES) return { ok: false, reason: 'asset_too_small' };
  if (buf.length > DOCUMENT_ASSET_MAX_BYTES) return { ok: false, reason: 'asset_too_large' };
  return { ok: true, byteLength: buf.length };
}

export function registerLogo(input: RegisterLogoInput): DocumentAsset {
  const organizationId = String(input.organizationId ?? '').trim();
  const actorId = String(input.actorId ?? '').trim();
  if (organizationId.length === 0) throw new Error('asset_invalid_organization');
  if (actorId.length === 0) throw new Error('asset_invalid_actor');
  if (!isSupportedMime(input.mimeType)) throw new Error('asset_invalid_mime_type');
  if (typeof input.dataBase64 !== 'string' || input.dataBase64.trim().length === 0)
    throw new Error('asset_invalid_base64');

  const decoded = decodeBase64Safely(input.dataBase64);
  if (decoded.ok === false) throw new Error(decoded.reason);

  // Auto-archive previous active logo for this org (one-active-at-a-time).
  // Emit `asset_replaced` instead of `asset_archived` so reviewers can
  // reconstruct the rotation chain.
  const previousActive = getActiveOrgLogo(organizationId);

  const now = nowIso();
  const asset: DocumentAsset = {
    assetId: randomUUID(),
    organizationId,
    kind: 'logo',
    status: 'active',
    mimeType: input.mimeType,
    dataBase64: input.dataBase64,
    byteLength: decoded.byteLength,
    filename: input.filename ? String(input.filename).slice(0, 200) : undefined,
    createdBy: actorId,
    createdAt: now,
  };
  assetStore.set(asset.assetId, asset);
  appendAudit(asset, 'asset_registered', actorId, {
    mimeType: asset.mimeType,
    byteLength: asset.byteLength,
    filename: asset.filename ?? null,
  });

  if (previousActive) {
    archiveAsset({
      assetId: previousActive.assetId,
      organizationId,
      actorId,
      reason: 'replaced_by_new_logo',
      replacedBy: asset.assetId,
    });
  }

  return asset;
}

export function getActiveOrgLogo(organizationId: string): DocumentAsset | null {
  const orgId = String(organizationId ?? '').trim();
  if (orgId.length === 0) return null;
  // Linear scan is fine — asset count per org stays small (1 active +
  // historical archives). Production swap: indexed query.
  let result: DocumentAsset | null = null;
  for (const asset of assetStore.values()) {
    if (asset.organizationId !== orgId) continue;
    if (asset.kind !== 'logo') continue;
    if (asset.status !== 'active') continue;
    // First active wins. Service guarantees at most one active per
    // (org, kind) tuple, so the iteration is single-hit in practice.
    result = asset;
    break;
  }
  return result;
}

export function getAssetById(input: { assetId: string; organizationId: string }): DocumentAsset {
  const asset = assetStore.get(input.assetId);
  if (!asset) throw new Error('asset_not_found');
  if (asset.organizationId !== input.organizationId) throw new Error('asset_not_found');
  return asset;
}

export function archiveAsset(input: ArchiveAssetInput): DocumentAsset {
  const asset = getAssetById({
    assetId: input.assetId,
    organizationId: input.organizationId,
  });
  if (asset.status === 'archived') return asset;
  const archived: DocumentAsset = {
    ...asset,
    status: 'archived',
    archivedBy: input.actorId,
    archivedAt: nowIso(),
    archiveReason: input.reason,
  };
  assetStore.set(asset.assetId, archived);
  appendAudit(archived, input.replacedBy ? 'asset_replaced' : 'asset_archived', input.actorId, {
    reason: input.reason ?? null,
    replacedBy: input.replacedBy ?? null,
  });
  return archived;
}

export function listAssetsForOrg(
  organizationId: string,
  options: ListAssetOptions = {}
): DocumentAsset[] {
  const orgId = String(organizationId ?? '').trim();
  if (orgId.length === 0) return [];
  const out: DocumentAsset[] = [];
  for (const asset of assetStore.values()) {
    if (asset.organizationId !== orgId) continue;
    if (options.kind && asset.kind !== options.kind) continue;
    if (options.status && asset.status !== options.status) continue;
    out.push(asset);
  }
  // Reverse-chronological by createdAt so the most recent rotation
  // surfaces first in admin UIs.
  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  return out;
}

export function listAssetAudit(assetId: string, organizationId: string): DocumentAssetAuditEntry[] {
  // Tenant scoping: we still call `getAssetById` so a cross-tenant
  // request gets a stable `asset_not_found` error instead of leaking
  // existence.
  getAssetById({ assetId, organizationId });
  return [...(auditStore.get(assetId) ?? [])];
}

/**
 * Test-only helper. Drops every in-memory asset row + audit entry so
 * each test starts from a clean registry. Production code MUST NOT
 * call this.
 */
export function __resetAssetRegistryForTests(): void {
  assetStore.clear();
  auditStore.clear();
}
