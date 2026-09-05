/** @vitest-environment jsdom */

/**
 * 2026-09-05: shared gate for the bottom-right admin/dev diagnostic
 * chrome (`EnvironmentBadge`, `ChatV9FlagsIndicator`) — see
 * `src/utils/debugOverlays.ts`. Covers the opt-in/opt-out/persistence
 * contract directly, independent of either component.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEBUG_OVERLAYS_SESSION_KEY,
  isDebugOverlaysOptedIn,
  shouldShowDebugOverlays,
} from '../../../src/utils/debugOverlays';

function setSearch(search: string) {
  // `tests/setup.ts` replaces `window.location` with a plain object
  // snapshot (to stub navigation methods), so it no longer tracks
  // `history.pushState` — mutate `.search` directly instead.
  (window.location as unknown as { search: string }).search = search;
}

describe('debugOverlays', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    setSearch('');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    window.sessionStorage.clear();
    setSearch('');
  });

  describe('shouldShowDebugOverlays', () => {
    it('is true in dev regardless of URL or storage', () => {
      vi.stubEnv('DEV', true as unknown as string);
      expect(shouldShowDebugOverlays()).toBe(true);
    });

    it('is false outside dev with no opt-in', () => {
      vi.stubEnv('DEV', false as unknown as string);
      expect(shouldShowDebugOverlays()).toBe(false);
    });

    it('is true outside dev once ?debug=1 is present', () => {
      vi.stubEnv('DEV', false as unknown as string);
      setSearch('?debug=1');
      expect(shouldShowDebugOverlays()).toBe(true);
    });
  });

  describe('isDebugOverlaysOptedIn', () => {
    it('defaults to false with a clean URL and empty storage', () => {
      expect(isDebugOverlaysOptedIn()).toBe(false);
    });

    it('?debug=1 opts in and persists to sessionStorage', () => {
      setSearch('?debug=1');
      expect(isDebugOverlaysOptedIn()).toBe(true);
      expect(window.sessionStorage.getItem(DEBUG_OVERLAYS_SESSION_KEY)).toBe('1');
    });

    it('a prior opt-in survives a later call with no query param', () => {
      window.sessionStorage.setItem(DEBUG_OVERLAYS_SESSION_KEY, '1');
      expect(isDebugOverlaysOptedIn()).toBe(true);
    });

    it('?debug=0 clears a standing opt-in', () => {
      window.sessionStorage.setItem(DEBUG_OVERLAYS_SESSION_KEY, '1');
      setSearch('?debug=0');
      expect(isDebugOverlaysOptedIn()).toBe(false);
      expect(window.sessionStorage.getItem(DEBUG_OVERLAYS_SESSION_KEY)).toBeNull();
    });

    it('an unrelated query param neither opts in nor clears an existing opt-in', () => {
      window.sessionStorage.setItem(DEBUG_OVERLAYS_SESSION_KEY, '1');
      setSearch('?foo=bar');
      expect(isDebugOverlaysOptedIn()).toBe(true);
    });
  });
});
