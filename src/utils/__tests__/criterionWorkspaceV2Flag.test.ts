import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CRITERION_WORKSPACE_V2_FLAG_KEYS,
  isCriterionWorkspaceV2Enabled,
  resetCriterionWorkspaceV2FlagCache,
} from '../criterionWorkspaceV2Flag';

const ORIGINAL_LOCATION = window.location;

function setLocationSearch(search: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...ORIGINAL_LOCATION, search },
  });
}

describe('Criterion Workspace V2 flag (DEC-97: default ON)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
    resetCriterionWorkspaceV2FlagCache();
  });

  afterEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
    resetCriterionWorkspaceV2FlagCache();
  });

  it('defaults ON with no query, localStorage, or env override', () => {
    expect(isCriterionWorkspaceV2Enabled()).toBe(true);
  });

  it('disables via localStorage "off"/"0"/"false"', () => {
    for (const value of ['off', '0', 'false']) {
      window.localStorage.setItem(CRITERION_WORKSPACE_V2_FLAG_KEYS.localStorage, value);
      resetCriterionWorkspaceV2FlagCache();
      expect(isCriterionWorkspaceV2Enabled()).toBe(false);
    }
  });

  it('disables via URL query "off"/"0"/"false"', () => {
    for (const value of ['off', '0', 'false']) {
      setLocationSearch(`?${CRITERION_WORKSPACE_V2_FLAG_KEYS.query}=${value}`);
      resetCriterionWorkspaceV2FlagCache();
      expect(isCriterionWorkspaceV2Enabled()).toBe(false);
    }
  });

  it('query wins over localStorage: query=1 beats localStorage off', () => {
    window.localStorage.setItem(CRITERION_WORKSPACE_V2_FLAG_KEYS.localStorage, 'off');
    setLocationSearch(`?${CRITERION_WORKSPACE_V2_FLAG_KEYS.query}=1`);
    resetCriterionWorkspaceV2FlagCache();
    expect(isCriterionWorkspaceV2Enabled()).toBe(true);
  });

  it('query wins over localStorage: query=0 beats localStorage on', () => {
    window.localStorage.setItem(CRITERION_WORKSPACE_V2_FLAG_KEYS.localStorage, '1');
    setLocationSearch(`?${CRITERION_WORKSPACE_V2_FLAG_KEYS.query}=0`);
    resetCriterionWorkspaceV2FlagCache();
    expect(isCriterionWorkspaceV2Enabled()).toBe(false);
  });

  it('localStorage "on" is honored when no query is present', () => {
    window.localStorage.setItem(CRITERION_WORKSPACE_V2_FLAG_KEYS.localStorage, 'on');
    resetCriterionWorkspaceV2FlagCache();
    expect(isCriterionWorkspaceV2Enabled()).toBe(true);
  });

  it('caches the resolution: a query flip after first read has no effect until reset', () => {
    expect(isCriterionWorkspaceV2Enabled()).toBe(true);
    setLocationSearch(`?${CRITERION_WORKSPACE_V2_FLAG_KEYS.query}=0`);
    // No reset yet — cached value from the first call still wins.
    expect(isCriterionWorkspaceV2Enabled()).toBe(true);
    resetCriterionWorkspaceV2FlagCache();
    expect(isCriterionWorkspaceV2Enabled()).toBe(false);
  });

  it('resetCriterionWorkspaceV2FlagCache forces a fresh read reflecting new state', () => {
    window.localStorage.setItem(CRITERION_WORKSPACE_V2_FLAG_KEYS.localStorage, 'off');
    resetCriterionWorkspaceV2FlagCache();
    expect(isCriterionWorkspaceV2Enabled()).toBe(false);

    window.localStorage.removeItem(CRITERION_WORKSPACE_V2_FLAG_KEYS.localStorage);
    resetCriterionWorkspaceV2FlagCache();
    expect(isCriterionWorkspaceV2Enabled()).toBe(true);
  });
});
