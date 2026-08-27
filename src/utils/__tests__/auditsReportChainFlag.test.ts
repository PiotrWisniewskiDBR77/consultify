import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUDITS_REPORT_CHAIN_FLAG_KEYS,
  isAuditsReportChainEnabled,
  resetAuditsReportChainFlagCache,
} from '../auditsReportChainFlag';

const ORIGINAL_LOCATION = window.location;

function setLocationSearch(search: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...ORIGINAL_LOCATION, search },
  });
}

describe('Audits report-chain flag', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
    resetAuditsReportChainFlagCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    setLocationSearch('');
    resetAuditsReportChainFlagCache();
  });

  it('defaults OFF', () => {
    expect(isAuditsReportChainEnabled()).toBe(false);
  });

  it('query enables and query=0 wins over localStorage=1', () => {
    window.localStorage.setItem(AUDITS_REPORT_CHAIN_FLAG_KEYS.localStorage, '1');
    setLocationSearch(`?${AUDITS_REPORT_CHAIN_FLAG_KEYS.query}=1`);
    expect(isAuditsReportChainEnabled()).toBe(true);
    resetAuditsReportChainFlagCache();
    setLocationSearch(`?${AUDITS_REPORT_CHAIN_FLAG_KEYS.query}=0`);
    expect(isAuditsReportChainEnabled()).toBe(false);
  });

  it('localStorage enables when query is absent', () => {
    window.localStorage.setItem(AUDITS_REPORT_CHAIN_FLAG_KEYS.localStorage, 'on');
    expect(isAuditsReportChainEnabled()).toBe(true);
  });

  it('fails closed when localStorage access throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(isAuditsReportChainEnabled()).toBe(false);
  });

  it('reset clears the cached resolution', () => {
    expect(isAuditsReportChainEnabled()).toBe(false);
    window.localStorage.setItem(AUDITS_REPORT_CHAIN_FLAG_KEYS.localStorage, '1');
    expect(isAuditsReportChainEnabled()).toBe(false);
    resetAuditsReportChainFlagCache();
    expect(isAuditsReportChainEnabled()).toBe(true);
  });
});
