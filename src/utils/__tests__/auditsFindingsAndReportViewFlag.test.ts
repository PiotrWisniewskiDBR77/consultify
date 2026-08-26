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

describe('Audits findings + report view flag (CLAUDE.md #7, default ON — flip po akcepcie właściciela 27.08)', () => {
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

  // flip po akcepcie właściciela 27.08 (Audits — dokument raportu, 13 sekcji): default was OFF, now ON.
  it('defaults ON with no query, localStorage, or env override', () => {
    expect(isAuditsFindingsAndReportViewEnabled()).toBe(true);
  });

  it('localStorage "off"/"0"/"false" still disables it despite the ON default', () => {
    for (const value of ['off', '0', 'false']) {
      window.localStorage.setItem(AUDITS_FINDINGS_AND_REPORT_VIEW_FLAG_KEYS.localStorage, value);
      resetAuditsFindingsAndReportViewFlagCache();
      expect(isAuditsFindingsAndReportViewEnabled()).toBe(false);
    }
  });

  it('enables via URL query "1"/"true"/"on" (redundant with default, still honoured)', () => {
    for (const value of ['1', 'true', 'on']) {
      setLocationSearch(`?${AUDITS_FINDINGS_AND_REPORT_VIEW_FLAG_KEYS.query}=${value}`);
      resetAuditsFindingsAndReportViewFlagCache();
      expect(isAuditsFindingsAndReportViewEnabled()).toBe(true);
    }
  });

  it('enables via localStorage "1"/"true"/"on" (redundant with default, still honoured)', () => {
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

  it('invalid query value falls through to localStorage', () => {
    window.localStorage.setItem(AUDITS_FINDINGS_AND_REPORT_VIEW_FLAG_KEYS.localStorage, 'off');
    setLocationSearch(`?${AUDITS_FINDINGS_AND_REPORT_VIEW_FLAG_KEYS.query}=banana`);
    resetAuditsFindingsAndReportViewFlagCache();
    expect(isAuditsFindingsAndReportViewEnabled()).toBe(false);
  });

  it('invalid localStorage value falls through to the ON default', () => {
    window.localStorage.setItem(AUDITS_FINDINGS_AND_REPORT_VIEW_FLAG_KEYS.localStorage, 'banana');
    resetAuditsFindingsAndReportViewFlagCache();
    expect(isAuditsFindingsAndReportViewEnabled()).toBe(true);
  });

  it('caches the resolution: a query flip after first read has no effect until reset', () => {
    expect(isAuditsFindingsAndReportViewEnabled()).toBe(true);
    setLocationSearch(`?${AUDITS_FINDINGS_AND_REPORT_VIEW_FLAG_KEYS.query}=0`);
    // No reset yet — cached value from the first call still wins.
    expect(isAuditsFindingsAndReportViewEnabled()).toBe(true);
    resetAuditsFindingsAndReportViewFlagCache();
    expect(isAuditsFindingsAndReportViewEnabled()).toBe(false);
  });

  it('resetAuditsFindingsAndReportViewFlagCache forces a fresh read reflecting new state', () => {
    window.localStorage.setItem(AUDITS_FINDINGS_AND_REPORT_VIEW_FLAG_KEYS.localStorage, 'off');
    resetAuditsFindingsAndReportViewFlagCache();
    expect(isAuditsFindingsAndReportViewEnabled()).toBe(false);

    window.localStorage.removeItem(AUDITS_FINDINGS_AND_REPORT_VIEW_FLAG_KEYS.localStorage);
    resetAuditsFindingsAndReportViewFlagCache();
    expect(isAuditsFindingsAndReportViewEnabled()).toBe(true);
  });
});
