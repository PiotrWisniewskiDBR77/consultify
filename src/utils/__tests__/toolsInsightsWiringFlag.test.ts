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

describe('Tools Insights Wiring flag (DEC-118 repair #1: default OFF, fail-closed)', () => {
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

  it('defaults OFF with no query, localStorage, or env override', () => {
    expect(isToolsInsightsWiringEnabled()).toBe(false);
  });

  it('enables via localStorage "on"/"1"/"true"', () => {
    for (const value of ['on', '1', 'true']) {
      window.localStorage.setItem(TOOLS_INSIGHTS_WIRING_FLAG_KEYS.localStorage, value);
      resetToolsInsightsWiringFlagCache();
      expect(isToolsInsightsWiringEnabled()).toBe(true);
    }
  });

  it('enables via URL query "on"/"1"/"true"', () => {
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

  it('caches the resolution: a query flip after first read has no effect until reset', () => {
    expect(isToolsInsightsWiringEnabled()).toBe(false);
    setLocationSearch(`?${TOOLS_INSIGHTS_WIRING_FLAG_KEYS.query}=1`);
    // No reset yet — cached value from the first call still wins.
    expect(isToolsInsightsWiringEnabled()).toBe(false);
    resetToolsInsightsWiringFlagCache();
    expect(isToolsInsightsWiringEnabled()).toBe(true);
  });

  it('resetToolsInsightsWiringFlagCache forces a fresh read reflecting new state', () => {
    window.localStorage.setItem(TOOLS_INSIGHTS_WIRING_FLAG_KEYS.localStorage, 'on');
    resetToolsInsightsWiringFlagCache();
    expect(isToolsInsightsWiringEnabled()).toBe(true);

    window.localStorage.removeItem(TOOLS_INSIGHTS_WIRING_FLAG_KEYS.localStorage);
    resetToolsInsightsWiringFlagCache();
    expect(isToolsInsightsWiringEnabled()).toBe(false);
  });
});
