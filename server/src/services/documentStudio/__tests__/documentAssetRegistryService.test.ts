/**
 * Document Studio — Slice E15.5.coverPageLogo asset registry service tests.
 *
 * Covers `registerLogo`, `getActiveOrgLogo`, `getAssetById`,
 * `archiveAsset`, `listAssetsForOrg`, `listAssetAudit`. Tests
 * exercise input validation, auto-archive-on-replacement (single
 * active per org), tenant isolation, idempotency, and the audit
 * chain semantics (`asset_replaced` for rotations vs `asset_archived`
 * for explicit archive calls).
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  __resetAssetRegistryForTests,
  archiveAsset,
  DOCUMENT_ASSET_MAX_BYTES,
  getActiveOrgLogo,
  getAssetById,
  listAssetAudit,
  listAssetsForOrg,
  registerLogo,
} from '../documentAssetRegistryService.js';

// 1×1 transparent PNG (decoded byte-stream) base64-encoded — the
// canonical "smallest valid PNG" used in many test suites. Decoded
// length is 67 bytes which is below our 100-byte sanity floor, so
// we pad below to satisfy the registry's minimum size.
const TINY_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0xfa, 0xcf, 0x00, 0x00,
  0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
  0xae, 0x42, 0x60, 0x82,
]);

function makePngBase64(extraBytes = 100): string {
  // Pad to clear the 100-byte floor without producing a malformed PNG.
  // Tests don't crack the bytes open — they only validate that the
  // registry's structural checks pass.
  const padding = Buffer.alloc(extraBytes, 0x00);
  return Buffer.concat([TINY_PNG_BUFFER, padding]).toString('base64');
}

describe('documentAssetRegistryService', () => {
  beforeEach(() => {
    __resetAssetRegistryForTests();
  });

  describe('registerLogo input validation', () => {
    it('rejects empty organizationId', () => {
      expect(() =>
        registerLogo({
          organizationId: '',
          actorId: 'user-1',
          mimeType: 'image/png',
          dataBase64: makePngBase64(),
        })
      ).toThrow('asset_invalid_organization');
    });

    it('rejects empty actorId', () => {
      expect(() =>
        registerLogo({
          organizationId: 'org-1',
          actorId: '',
          mimeType: 'image/png',
          dataBase64: makePngBase64(),
        })
      ).toThrow('asset_invalid_actor');
    });

    it('rejects unsupported mime type', () => {
      expect(() =>
        registerLogo({
          organizationId: 'org-1',
          actorId: 'user-1',
          mimeType: 'image/webp',
          dataBase64: makePngBase64(),
        })
      ).toThrow('asset_invalid_mime_type');
    });

    it('rejects empty dataBase64', () => {
      expect(() =>
        registerLogo({
          organizationId: 'org-1',
          actorId: 'user-1',
          mimeType: 'image/png',
          dataBase64: '',
        })
      ).toThrow('asset_invalid_base64');
    });

    it('rejects bytes below the 100-byte sanity floor', () => {
      const tinyB64 = Buffer.from('hi').toString('base64');
      expect(() =>
        registerLogo({
          organizationId: 'org-1',
          actorId: 'user-1',
          mimeType: 'image/png',
          dataBase64: tinyB64,
        })
      ).toThrow('asset_too_small');
    });

    it('rejects bytes above the size cap', () => {
      const oversize = Buffer.alloc(DOCUMENT_ASSET_MAX_BYTES + 1, 0x00).toString('base64');
      expect(() =>
        registerLogo({
          organizationId: 'org-1',
          actorId: 'user-1',
          mimeType: 'image/png',
          dataBase64: oversize,
        })
      ).toThrow('asset_too_large');
    });
  });

  describe('happy path + auto-archive on replacement', () => {
    it('mints an active logo with audit row + sets it as the active org logo', () => {
      const asset = registerLogo({
        organizationId: 'org-1',
        actorId: 'user-1',
        mimeType: 'image/png',
        dataBase64: makePngBase64(),
        filename: 'logo.png',
      });
      expect(asset.assetId).toBeDefined();
      expect(asset.organizationId).toBe('org-1');
      expect(asset.kind).toBe('logo');
      expect(asset.status).toBe('active');
      expect(asset.mimeType).toBe('image/png');
      expect(asset.filename).toBe('logo.png');
      expect(asset.byteLength).toBeGreaterThan(100);
      expect(asset.createdBy).toBe('user-1');

      const active = getActiveOrgLogo('org-1');
      expect(active?.assetId).toBe(asset.assetId);

      const audit = listAssetAudit(asset.assetId, 'org-1');
      expect(audit).toHaveLength(1);
      expect(audit[0]?.action).toBe('asset_registered');
    });

    it('auto-archives previous active logo when a new one is registered (one active per org)', () => {
      const first = registerLogo({
        organizationId: 'org-1',
        actorId: 'user-1',
        mimeType: 'image/png',
        dataBase64: makePngBase64(),
      });
      const second = registerLogo({
        organizationId: 'org-1',
        actorId: 'user-2',
        mimeType: 'image/jpeg',
        dataBase64: makePngBase64(150),
      });

      const refreshedFirst = getAssetById({ assetId: first.assetId, organizationId: 'org-1' });
      expect(refreshedFirst.status).toBe('archived');
      expect(refreshedFirst.archivedBy).toBe('user-2');
      expect(refreshedFirst.archiveReason).toBe('replaced_by_new_logo');

      const active = getActiveOrgLogo('org-1');
      expect(active?.assetId).toBe(second.assetId);

      const auditFirst = listAssetAudit(first.assetId, 'org-1');
      expect(auditFirst).toHaveLength(2);
      const replacement = auditFirst.find((row) => row.action === 'asset_replaced');
      expect(replacement?.details?.replacedBy).toBe(second.assetId);
    });
  });

  describe('archiveAsset', () => {
    it('archives an active asset and emits asset_archived audit row', () => {
      const asset = registerLogo({
        organizationId: 'org-1',
        actorId: 'user-1',
        mimeType: 'image/png',
        dataBase64: makePngBase64(),
      });
      const archived = archiveAsset({
        assetId: asset.assetId,
        organizationId: 'org-1',
        actorId: 'user-1',
        reason: 'cleanup',
      });
      expect(archived.status).toBe('archived');
      expect(archived.archiveReason).toBe('cleanup');

      const audit = listAssetAudit(asset.assetId, 'org-1');
      const archiveRow = audit.find((row) => row.action === 'asset_archived');
      expect(archiveRow).toBeDefined();
      expect(archiveRow?.details?.reason).toBe('cleanup');

      const active = getActiveOrgLogo('org-1');
      expect(active).toBeNull();
    });

    it('is idempotent — archiving an already-archived asset is a no-op (no extra audit row)', () => {
      const asset = registerLogo({
        organizationId: 'org-1',
        actorId: 'user-1',
        mimeType: 'image/png',
        dataBase64: makePngBase64(),
      });
      archiveAsset({
        assetId: asset.assetId,
        organizationId: 'org-1',
        actorId: 'user-1',
      });
      const auditBefore = listAssetAudit(asset.assetId, 'org-1');
      archiveAsset({
        assetId: asset.assetId,
        organizationId: 'org-1',
        actorId: 'user-1',
      });
      const auditAfter = listAssetAudit(asset.assetId, 'org-1');
      expect(auditAfter).toHaveLength(auditBefore.length);
    });
  });

  describe('tenant isolation', () => {
    it('getActiveOrgLogo returns only the requesting org logo', () => {
      registerLogo({
        organizationId: 'org-A',
        actorId: 'user-A',
        mimeType: 'image/png',
        dataBase64: makePngBase64(),
      });
      const orgB = registerLogo({
        organizationId: 'org-B',
        actorId: 'user-B',
        mimeType: 'image/png',
        dataBase64: makePngBase64(150),
      });
      expect(getActiveOrgLogo('org-B')?.assetId).toBe(orgB.assetId);
      expect(getActiveOrgLogo('org-X')).toBeNull();
    });

    it('cross-tenant getAssetById throws asset_not_found (no existence leak)', () => {
      const asset = registerLogo({
        organizationId: 'org-A',
        actorId: 'user-A',
        mimeType: 'image/png',
        dataBase64: makePngBase64(),
      });
      expect(() => getAssetById({ assetId: asset.assetId, organizationId: 'org-B' })).toThrow(
        'asset_not_found'
      );
    });

    it('listAssetsForOrg only returns assets for that org', () => {
      registerLogo({
        organizationId: 'org-A',
        actorId: 'user-A',
        mimeType: 'image/png',
        dataBase64: makePngBase64(),
      });
      registerLogo({
        organizationId: 'org-B',
        actorId: 'user-B',
        mimeType: 'image/png',
        dataBase64: makePngBase64(),
      });
      const onlyOrgA = listAssetsForOrg('org-A');
      expect(onlyOrgA).toHaveLength(1);
      expect(onlyOrgA[0]?.organizationId).toBe('org-A');
    });
  });

  describe('listAssetsForOrg filters', () => {
    it('honors `status` filter', () => {
      const a = registerLogo({
        organizationId: 'org-1',
        actorId: 'u',
        mimeType: 'image/png',
        dataBase64: makePngBase64(),
      });
      registerLogo({
        organizationId: 'org-1',
        actorId: 'u',
        mimeType: 'image/png',
        dataBase64: makePngBase64(150),
      });
      // After the second register, `a` is archived (auto-replacement).
      const archivedAssets = listAssetsForOrg('org-1', { status: 'archived' });
      expect(archivedAssets.map((row) => row.assetId)).toContain(a.assetId);
      const activeAssets = listAssetsForOrg('org-1', { status: 'active' });
      expect(activeAssets.every((row) => row.status === 'active')).toBe(true);
    });
  });
});
