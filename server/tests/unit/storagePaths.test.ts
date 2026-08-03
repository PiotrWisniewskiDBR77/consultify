/**
 * utils/storagePaths — G2 (P0 niezawodność): persistent-volume-ready storage
 * base dir.
 *
 * Background: exports/uploads written under `process.cwd()` are lost on every
 * Railway redeploy (ephemeral container disk). This helper centralizes the
 * base directory so an operator can opt in to a mounted persistent Volume via
 * `STORAGE_DIR` (or Railway's own `RAILWAY_VOLUME_MOUNT_PATH`) with ZERO code
 * changes elsewhere. This suite proves:
 *   (A) REGRESSION: with no env var set, behavior is byte-identical to the
 *       historic `path.join(process.cwd(), 'exports'|'uploads', ...)` sites.
 *   (B) NEW: STORAGE_DIR / RAILWAY_VOLUME_MOUNT_PATH (in that precedence
 *       order) redirect the base dir, and `resolveStoredRelativePath` resolves
 *       historic "/uploads/..." / "/exports/..." DB values against it.
 */

import { chmodSync, existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  baseStorageDir,
  exportsDir,
  resolveStoredRelativePath,
  uploadsDir,
} from '../../src/utils/storagePaths.js';

describe('storagePaths', () => {
  const originalStorageDir = process.env.STORAGE_DIR;
  const originalVolumeMount = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  let scratchDir: string;

  beforeEach(() => {
    delete process.env.STORAGE_DIR;
    delete process.env.RAILWAY_VOLUME_MOUNT_PATH;
    scratchDir = mkdtempSync(path.join(tmpdir(), 'g2-storage-paths-'));
  });

  afterEach(() => {
    if (originalStorageDir === undefined) delete process.env.STORAGE_DIR;
    else process.env.STORAGE_DIR = originalStorageDir;
    if (originalVolumeMount === undefined) delete process.env.RAILWAY_VOLUME_MOUNT_PATH;
    else process.env.RAILWAY_VOLUME_MOUNT_PATH = originalVolumeMount;
    rmSync(scratchDir, { recursive: true, force: true });
  });

  describe('(A) default behavior — zero env set — matches the historic pattern', () => {
    it('baseStorageDir() defaults to process.cwd()', () => {
      expect(baseStorageDir()).toBe(process.cwd());
    });

    it('exportsDir(...) matches path.join(process.cwd(), "exports", ...)', () => {
      expect(exportsDir('presentations')).toBe(
        path.join(process.cwd(), 'exports', 'presentations')
      );
      expect(exportsDir('presentations', 'assets', 'deck-1')).toBe(
        path.join(process.cwd(), 'exports', 'presentations', 'assets', 'deck-1')
      );
    });

    it('uploadsDir(...) matches path.join(process.cwd(), "uploads", ...)', () => {
      expect(uploadsDir('avatars')).toBe(path.join(process.cwd(), 'uploads', 'avatars'));
    });

    it('resolveStoredRelativePath resolves historic "/uploads/..." DB values against cwd', () => {
      expect(resolveStoredRelativePath('/uploads/avatars/x.jpg')).toBe(
        path.join(process.cwd(), 'uploads', 'avatars', 'x.jpg')
      );
      // Also handles the no-leading-slash form some callers store.
      expect(resolveStoredRelativePath('exports/valuations/v1.pptx')).toBe(
        path.join(process.cwd(), 'exports', 'valuations', 'v1.pptx')
      );
    });
  });

  describe('(B) STORAGE_DIR / RAILWAY_VOLUME_MOUNT_PATH opt-in', () => {
    it('STORAGE_DIR redirects baseStorageDir()', () => {
      process.env.STORAGE_DIR = scratchDir;
      expect(baseStorageDir()).toBe(path.resolve(scratchDir));
    });

    it('RAILWAY_VOLUME_MOUNT_PATH is used when STORAGE_DIR is unset', () => {
      process.env.RAILWAY_VOLUME_MOUNT_PATH = scratchDir;
      expect(baseStorageDir()).toBe(path.resolve(scratchDir));
    });

    it('STORAGE_DIR takes precedence over RAILWAY_VOLUME_MOUNT_PATH', () => {
      const otherDir = mkdtempSync(path.join(tmpdir(), 'g2-storage-paths-other-'));
      try {
        process.env.STORAGE_DIR = scratchDir;
        process.env.RAILWAY_VOLUME_MOUNT_PATH = otherDir;
        expect(baseStorageDir()).toBe(path.resolve(scratchDir));
      } finally {
        rmSync(otherDir, { recursive: true, force: true });
      }
    });

    it('exportsDir()/uploadsDir() land under the volume once STORAGE_DIR is set', () => {
      process.env.STORAGE_DIR = scratchDir;
      expect(exportsDir('presentations')).toBe(path.join(scratchDir, 'exports', 'presentations'));
      expect(uploadsDir('avatars')).toBe(path.join(scratchDir, 'uploads', 'avatars'));
    });

    it('resolveStoredRelativePath resolves against the volume once STORAGE_DIR is set', () => {
      process.env.STORAGE_DIR = scratchDir;
      expect(resolveStoredRelativePath('/uploads/avatars/x.jpg')).toBe(
        path.join(scratchDir, 'uploads', 'avatars', 'x.jpg')
      );
    });
  });

  describe('directory creation', () => {
    it('exportsDir(...) creates the directory (mkdir -p) if missing', () => {
      process.env.STORAGE_DIR = scratchDir;
      const dir = exportsDir('presentations', 'assets', 'deck-1');
      expect(existsSync(dir)).toBe(true);
    });

    it('uploadsDir(...) creates the directory (mkdir -p) if missing', () => {
      process.env.STORAGE_DIR = scratchDir;
      const dir = uploadsDir('branding', 'org-1');
      expect(existsSync(dir)).toBe(true);
    });
  });

  describe('fail-soft on unwritable base dir (P0 hotfix 2026-07-22)', () => {
    // Regression test for the incident: a freshly-mounted Railway Volume is
    // root-owned by default, so mkdir under it throws EACCES for the
    // non-root app user. That MUST NOT crash the process — it must fall back
    // to the historic process.cwd()-rooted path instead.
    let unwritableParent: string;

    beforeEach(() => {
      unwritableParent = mkdtempSync(path.join(tmpdir(), 'storage-paths-locked-'));
      chmodSync(unwritableParent, 0o000);
    });

    afterEach(() => {
      chmodSync(unwritableParent, 0o755);
      rmSync(unwritableParent, { recursive: true, force: true });
    });

    it('exportsDir(...) falls back to process.cwd() instead of throwing when STORAGE_DIR is not writable', () => {
      process.env.STORAGE_DIR = path.join(unwritableParent, 'volume');
      let dir = '';
      expect(() => {
        dir = exportsDir('presentations');
      }).not.toThrow();
      expect(dir).toBe(path.join(process.cwd(), 'exports', 'presentations'));
      expect(existsSync(dir)).toBe(true);
    });

    it('uploadsDir(...) falls back to process.cwd() instead of throwing when STORAGE_DIR is not writable', () => {
      process.env.STORAGE_DIR = path.join(unwritableParent, 'volume');
      let dir = '';
      expect(() => {
        dir = uploadsDir('avatars');
      }).not.toThrow();
      expect(dir).toBe(path.join(process.cwd(), 'uploads', 'avatars'));
      expect(existsSync(dir)).toBe(true);
    });
  });
});
