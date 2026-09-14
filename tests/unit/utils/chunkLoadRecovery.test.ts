/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CHUNK_UPDATE_EVENT,
  announceChunkUpdateAvailable,
  attemptChunkReload,
  hasAlreadyAttemptedChunkReload,
  isChunkLoadError,
} from '@/utils/chunkLoadRecovery';

describe('chunkLoadRecovery — Z-11 (2026-09-14)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  describe('isChunkLoadError', () => {
    it('detects the Vite/prod "failed to fetch dynamically imported module" message', () => {
      expect(
        isChunkLoadError(new Error('Failed to fetch dynamically imported module https://x/assets/MainLayout-abc123.js'))
      ).toBe(true);
    });

    it('detects "Importing a module script failed"', () => {
      expect(isChunkLoadError(new Error('Importing a module script failed'))).toBe(true);
    });

    it('detects ChunkLoadError by name/message', () => {
      const err = new Error('Loading chunk 4 failed');
      err.name = 'ChunkLoadError';
      expect(isChunkLoadError(err)).toBe(true);
    });

    it('does not flag an unrelated error', () => {
      expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    });
  });

  describe('attemptChunkReload — one-time guard', () => {
    it('reloads once, then reports already-attempted for the same build+URL', () => {
      const reloadSpy = vi.fn();
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, href: 'http://localhost/foo', reload: reloadSpy },
        writable: true,
        configurable: true,
      });

      expect(hasAlreadyAttemptedChunkReload()).toBe(false);

      const firstAttempt = attemptChunkReload();
      expect(firstAttempt).toBe(true);
      expect(reloadSpy).toHaveBeenCalledTimes(1);
      expect(hasAlreadyAttemptedChunkReload()).toBe(true);

      // Second symptom from Z-11: reload happened, chunk is STILL missing —
      // a second attempt must NOT reload again (would loop forever).
      const secondAttempt = attemptChunkReload();
      expect(secondAttempt).toBe(false);
      expect(reloadSpy).toHaveBeenCalledTimes(1);

      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('announceChunkUpdateAvailable', () => {
    it('dispatches the global CHUNK_UPDATE_EVENT the banner listens for', () => {
      const handler = vi.fn();
      window.addEventListener(CHUNK_UPDATE_EVENT, handler);

      announceChunkUpdateAvailable();

      expect(handler).toHaveBeenCalledTimes(1);
      window.removeEventListener(CHUNK_UPDATE_EVENT, handler);
    });
  });
});
