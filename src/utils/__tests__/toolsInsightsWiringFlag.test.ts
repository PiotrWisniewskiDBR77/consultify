import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  isToolsInsightsWiringEnabled,
  resetToolsInsightsWiringFlagCache,
  TOOLS_INSIGHTS_WIRING_FLAG_KEYS,
} from '../toolsInsightsWiringFlag';

const ORIGINAL_LOCATION = window.location;

function setLocationSearch(search: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...ORIGINAL_LOCATION, search },
  });
}

describe('Tools Insights Wiring flag (default ON — flip po akcepcie właściciela 27.08)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
    resetToolsInsightsWiringFlagCache();
  });

  afterEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
    resetToolsInsightsWiringFlagCache();
  });

  // flip po akcepcie właściciela 27.08: default was OFF, now ON.
  it('defaults ON with no query, localStorage, or env override', () => {
    expect(isToolsInsightsWiringEnabled()).toBe(true);
  });

  it('localStorage "off"/"0"/"false" still disables it despite the ON default', () => {
    for (const value of ['off', '0', 'false']) {
      window.localStorage.setItem(TOOLS_INSIGHTS_WIRING_FLAG_KEYS.localStorage, value);
      resetToolsInsightsWiringFlagCache();
      expect(isToolsInsightsWiringEnabled()).toBe(false);
    }
  });

  it('enables via localStorage "on"/"1"/"true" (redundant with default, still honoured)', () => {
    for (const value of ['on', '1', 'true']) {
      window.localStorage.setItem(TOOLS_INSIGHTS_WIRING_FLAG_KEYS.localStorage, value);
      resetToolsInsightsWiringFlagCache();
      expect(isToolsInsightsWiringEnabled()).toBe(true);
    }
  });

  it('enables via URL query "on"/"1"/"true" (redundant with default, still honoured)', () => {
    for (const value of ['on', '1', 'true']) {
      setLocationSearch(`?${TOOLS_INSIGHTS_WIRING_FLAG_KEYS.query}=${value}`);
      resetToolsInsightsWiringFlagCache();
      expect(isToolsInsightsWiringEnabled()).toBe(true);
    }
  });

  it('query wins over localStorage: query=0 beats localStorage on', () => {
    window.localStorage.setItem(TOOLS_INSIGHTS_WIRING_FLAG_KEYS.localStorage, '1');
    setLocationSearch(`?${TOOLS_INSIGHTS_WIRING_FLAG_KEYS.query}=0`);
    resetToolsInsightsWiringFlagCache();
    expect(isToolsInsightsWiringEnabled()).toBe(false);
  });

  it('query wins over localStorage: query=1 beats localStorage off', () => {
    window.localStorage.setItem(TOOLS_INSIGHTS_WIRING_FLAG_KEYS.localStorage, 'off');
    setLocationSearch(`?${TOOLS_INSIGHTS_WIRING_FLAG_KEYS.query}=1`);
    resetToolsInsightsWiringFlagCache();
    expect(isToolsInsightsWiringEnabled()).toBe(true);
  });

  it('invalid localStorage value falls through to the ON default', () => {
    window.localStorage.setItem(TOOLS_INSIGHTS_WIRING_FLAG_KEYS.localStorage, 'banana');
    resetToolsInsightsWiringFlagCache();
    expect(isToolsInsightsWiringEnabled()).toBe(true);
  });

  it('caches the resolution: a query flip after first read has no effect until reset', () => {
    expect(isToolsInsightsWiringEnabled()).toBe(true);
    setLocationSearch(`?${TOOLS_INSIGHTS_WIRING_FLAG_KEYS.query}=0`);
    // No reset yet — cached value from the first call still wins.
    expect(isToolsInsightsWiringEnabled()).toBe(true);
    resetToolsInsightsWiringFlagCache();
    expect(isToolsInsightsWiringEnabled()).toBe(false);
  });

  it('resetToolsInsightsWiringFlagCache forces a fresh read reflecting new state', () => {
    window.localStorage.setItem(TOOLS_INSIGHTS_WIRING_FLAG_KEYS.localStorage, 'off');
    resetToolsInsightsWiringFlagCache();
    expect(isToolsInsightsWiringEnabled()).toBe(false);

    window.localStorage.removeItem(TOOLS_INSIGHTS_WIRING_FLAG_KEYS.localStorage);
    resetToolsInsightsWiringFlagCache();
    expect(isToolsInsightsWiringEnabled()).toBe(true);
  });
});
