/**
 * @vitest-environment jsdom
 *
 * Unit tests for the DRD Audit Report reveal flag (`isDrdReportEnabled`).
 *
 * Coverage:
 *   * Default OFF when no override (the whole point — engine exists but is
 *     not live for every user yet).
 *   * URL query override has highest priority.
 *   * localStorage override beats env default.
 *   * `0` / `off` / `false` parse to false; `1` / `on` / `true` to true.
 *   * Invalid raw values fall through to lower priority.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DRD_REPORT_FLAG_KEYS, isDrdReportEnabled } from '../drdReportFlag';

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

describe('isDrdReportEnabled', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
  });
  afterEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
  });

  it('defaults to OFF when nothing is set', () => {
    expect(isDrdReportEnabled()).toBe(false);
  });

  it('honours localStorage override (1)', () => {
    window.localStorage.setItem(DRD_REPORT_FLAG_KEYS.localStorage, '1');
    expect(isDrdReportEnabled()).toBe(true);
  });

  it('honours localStorage override (off)', () => {
    window.localStorage.setItem(DRD_REPORT_FLAG_KEYS.localStorage, 'off');
    expect(isDrdReportEnabled()).toBe(false);
  });

  it('URL query overrides localStorage', () => {
    window.localStorage.setItem(DRD_REPORT_FLAG_KEYS.localStorage, '1');
    setLocationSearch(`?${DRD_REPORT_FLAG_KEYS.query}=0`);
    expect(isDrdReportEnabled()).toBe(false);
  });

  it('URL query "true" turns it on', () => {
    setLocationSearch(`?${DRD_REPORT_FLAG_KEYS.query}=true`);
    expect(isDrdReportEnabled()).toBe(true);
  });

  it('invalid query value falls through to localStorage', () => {
    window.localStorage.setItem(DRD_REPORT_FLAG_KEYS.localStorage, '1');
    setLocationSearch(`?${DRD_REPORT_FLAG_KEYS.query}=banana`);
    expect(isDrdReportEnabled()).toBe(true);
  });

  it('invalid localStorage value also falls through', () => {
    window.localStorage.setItem(DRD_REPORT_FLAG_KEYS.localStorage, 'banana');
    expect(isDrdReportEnabled()).toBe(false);
  });

  it('exposes stable flag keys', () => {
    expect(DRD_REPORT_FLAG_KEYS.localStorage).toBe('ff.drdReport');
    expect(DRD_REPORT_FLAG_KEYS.query).toBe('ff_drd_report');
    expect(DRD_REPORT_FLAG_KEYS.env).toBe('VITE_DRD_REPORT_ENABLED');
  });
});
