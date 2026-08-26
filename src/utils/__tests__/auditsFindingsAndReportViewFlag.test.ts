import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  AUDITS_FINDINGS_AND_REPORT_VIEW_FLAG_KEYS,
  isAuditsFindingsAndReportViewEnabled,
  resetAuditsFindingsAndReportViewFlagCache,
} from '../auditsFindingsAndReportViewFlag';

const ORIGINAL_LOCATION = window.location;

function setLocationSearch(search: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...ORIGINAL_LOCATION, search },
  });
}

describe('Audits findings + report view flag (fail-closed — CLAUDE.md #7, default OFF)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
    resetAuditsFindingsAndReportViewFlagCache();
  });

  afterEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
    resetAuditsFindingsAndReportViewFlagCache();
  });

  it('defaults OFF with no query, localStorage, or env override', () => {
    expect(isAuditsFindingsAndReportViewEnabled()).toBe(false);
  });

  it('enables via URL query "1"/"true"/"on"', () => {
    for (const value of ['1', 'true', 'on']) {
      setLocationSearch(`?${AUDITS_FINDINGS_AND_REPORT_VIEW_FLAG_KEYS.query}=${value}`);
      resetAuditsFindingsAndReportViewFlagCache();
      expect(isAuditsFindingsAndReportViewEnabled()).toBe(true);
    }
  });

  it('enables via localStorage "1"/"true"/"on"', () => {
    for (const value of ['1', 'true', 'on']) {
      window.localStorage.setItem(AUDITS_FINDINGS_AND_REPORT_VIEW_FLAG_KEYS.localStorage, value);
      resetAuditsFindingsAndReportViewFlagCache();
      expect(isAuditsFindingsAndReportViewEnabled()).toBe(true);
    }
  });

  it('query wins over localStorage: query=0 beats localStorage on', () => {
    window.localStorage.setItem(AUDITS_FINDINGS_AND_REPORT_VIEW_FLAG_KEYS.localStorage, '1');
    setLocationSearch(`?${AUDITS_FINDINGS_AND_REPORT_VIEW_FLAG_KEYS.query}=0`);
    resetAuditsFindingsAndReportViewFlagCache();
    expect(isAuditsFindingsAndReportViewEnabled()).toBe(false);
  });

  it('query wins over localStorage: query=1 beats localStorage off', () => {
    window.localStorage.setItem(AUDITS_FINDINGS_AND_REPORT_VIEW_FLAG_KEYS.localStorage, 'off');
    setLocationSearch(`?${AUDITS_FINDINGS_AND_REPORT_VIEW_FLAG_KEYS.query}=1`);
    resetAuditsFindingsAndReportViewFlagCache();
    expect(isAuditsFindingsAndReportViewEnabled()).toBe(true);
  });

  it('caches the resolution: a query flip after first read has no effect until reset', () => {
    expect(isAuditsFindingsAndReportViewEnabled()).toBe(false);
    setLocationSearch(`?${AUDITS_FINDINGS_AND_REPORT_VIEW_FLAG_KEYS.query}=1`);
    // No reset yet — cached value from the first call still wins.
    expect(isAuditsFindingsAndReportViewEnabled()).toBe(false);
    resetAuditsFindingsAndReportViewFlagCache();
    expect(isAuditsFindingsAndReportViewEnabled()).toBe(true);
  });

  it('resetAuditsFindingsAndReportViewFlagCache forces a fresh read reflecting new state', () => {
    window.localStorage.setItem(AUDITS_FINDINGS_AND_REPORT_VIEW_FLAG_KEYS.localStorage, '1');
    resetAuditsFindingsAndReportViewFlagCache();
    expect(isAuditsFindingsAndReportViewEnabled()).toBe(true);

    window.localStorage.removeItem(AUDITS_FINDINGS_AND_REPORT_VIEW_FLAG_KEYS.localStorage);
    resetAuditsFindingsAndReportViewFlagCache();
    expect(isAuditsFindingsAndReportViewEnabled()).toBe(false);
  });
});
