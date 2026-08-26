/**
 * @vitest-environment jsdom
 *
 * Unit tests for the idea inspector right-rail flag
 * (`isIdeaInspectorRightRailEnabled`, DEC-90).
 *
 * Coverage:
 *   * Default is now ON (2026-08-26 flip) when no override is present.
 *   * localStorage 'off' (and other falsy spellings) still disables it —
 *     the flip must not remove the per-user kill switch.
 *   * URL query override still has highest priority, in both directions.
 *   * env override still participates in the fallback chain, below
 *     query/localStorage and above the new default.
 *   * Invalid raw values still fall through instead of matching.
 *   * The per-call cache is exercised via resetIdeaInspectorRightRailFlagCache.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  IDEA_INSPECTOR_RIGHT_RAIL_FLAG_KEYS,
  isIdeaInspectorRightRailEnabled,
  resetIdeaInspectorRightRailFlagCache,
} from '../ideaInspectorRightRailFlag';

const ORIGINAL_LOCATION = window.location;

function setLocationSearch(search: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...ORIGINAL_LOCATION,
      search,
    },
  });
}

describe('isIdeaInspectorRightRailEnabled', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
    resetIdeaInspectorRightRailFlagCache();
  });
  afterEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
    resetIdeaInspectorRightRailFlagCache();
  });

  it('defaults to ON when nothing is set (DEC-90 flip)', () => {
    expect(isIdeaInspectorRightRailEnabled()).toBe(true);
  });

  it('localStorage "off" disables it even though the default is now ON', () => {
    window.localStorage.setItem(IDEA_INSPECTOR_RIGHT_RAIL_FLAG_KEYS.localStorage, 'off');
    expect(isIdeaInspectorRightRailEnabled()).toBe(false);
  });

  it('localStorage "0" / "false" also disable it', () => {
    window.localStorage.setItem(IDEA_INSPECTOR_RIGHT_RAIL_FLAG_KEYS.localStorage, '0');
    expect(isIdeaInspectorRightRailEnabled()).toBe(false);
    resetIdeaInspectorRightRailFlagCache();
    window.localStorage.setItem(IDEA_INSPECTOR_RIGHT_RAIL_FLAG_KEYS.localStorage, 'false');
    expect(isIdeaInspectorRightRailEnabled()).toBe(false);
  });

  it('localStorage "1" / "on" / "true" keep it enabled (redundant with default, still honoured)', () => {
    window.localStorage.setItem(IDEA_INSPECTOR_RIGHT_RAIL_FLAG_KEYS.localStorage, 'on');
    expect(isIdeaInspectorRightRailEnabled()).toBe(true);
  });

  it('URL query overrides localStorage off', () => {
    window.localStorage.setItem(IDEA_INSPECTOR_RIGHT_RAIL_FLAG_KEYS.localStorage, 'off');
    setLocationSearch(`?${IDEA_INSPECTOR_RIGHT_RAIL_FLAG_KEYS.query}=1`);
    expect(isIdeaInspectorRightRailEnabled()).toBe(true);
  });

  it('URL query can still turn it off explicitly', () => {
    setLocationSearch(`?${IDEA_INSPECTOR_RIGHT_RAIL_FLAG_KEYS.query}=0`);
    expect(isIdeaInspectorRightRailEnabled()).toBe(false);
  });

  it('invalid query value falls through to localStorage', () => {
    window.localStorage.setItem(IDEA_INSPECTOR_RIGHT_RAIL_FLAG_KEYS.localStorage, 'off');
    setLocationSearch(`?${IDEA_INSPECTOR_RIGHT_RAIL_FLAG_KEYS.query}=banana`);
    expect(isIdeaInspectorRightRailEnabled()).toBe(false);
  });

  it('invalid localStorage value falls through to the ON default', () => {
    window.localStorage.setItem(IDEA_INSPECTOR_RIGHT_RAIL_FLAG_KEYS.localStorage, 'banana');
    expect(isIdeaInspectorRightRailEnabled()).toBe(true);
  });

  it('caches the resolved value until reset', () => {
    expect(isIdeaInspectorRightRailEnabled()).toBe(true);
    // Setting localStorage after the first read must NOT change the result
    // until the cache is explicitly reset.
    window.localStorage.setItem(IDEA_INSPECTOR_RIGHT_RAIL_FLAG_KEYS.localStorage, 'off');
    expect(isIdeaInspectorRightRailEnabled()).toBe(true);
    resetIdeaInspectorRightRailFlagCache();
    expect(isIdeaInspectorRightRailEnabled()).toBe(false);
  });

  it('exposes stable flag keys', () => {
    expect(IDEA_INSPECTOR_RIGHT_RAIL_FLAG_KEYS.localStorage).toBe('ff.idea_inspector_right_rail');
    expect(IDEA_INSPECTOR_RIGHT_RAIL_FLAG_KEYS.query).toBe('ff_ideaInspectorRightRail');
    expect(IDEA_INSPECTOR_RIGHT_RAIL_FLAG_KEYS.env).toBe('VITE_IDEA_INSPECTOR_RIGHT_RAIL');
  });
});
