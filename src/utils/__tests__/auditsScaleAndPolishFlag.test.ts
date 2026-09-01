/**
 * @vitest-environment jsdom
 *
 * Unit tests for the Audits scale & polish reveal flag
 * (`isAuditsScaleAndPolishEnabled`). Mirrors
 * `src/utils/__tests__/drdReportFlag.test.ts` — same resolution order
 * (query > localStorage > env > default). Default flipped OFF -> ON on
 * 2026-08-27 (owner accept on dev-render screenshots) — fail-closed on
 * read errors is unchanged.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  AUDITS_SCALE_AND_POLISH_FLAG_KEYS,
  isAuditsScaleAndPolishEnabled,
} from '../auditsScaleAndPolishFlag';

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

describe('isAuditsScaleAndPolishEnabled', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
  });
  afterEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
  });

  // flip po akcepcie właściciela 27.08: default was OFF, now ON.
  it('defaults to ON when nothing is set', () => {
    expect(isAuditsScaleAndPolishEnabled()).toBe(true);
  });

  it('honours localStorage override (1) — redundant with default, still honoured', () => {
    window.localStorage.setItem(AUDITS_SCALE_AND_POLISH_FLAG_KEYS.localStorage, '1');
    expect(isAuditsScaleAndPolishEnabled()).toBe(true);
  });

  it('honours localStorage override (off) — still disables despite the ON default', () => {
    window.localStorage.setItem(AUDITS_SCALE_AND_POLISH_FLAG_KEYS.localStorage, 'off');
    expect(isAuditsScaleAndPolishEnabled()).toBe(false);
  });

  it('URL query overrides localStorage', () => {
    window.localStorage.setItem(AUDITS_SCALE_AND_POLISH_FLAG_KEYS.localStorage, '1');
    setLocationSearch(`?${AUDITS_SCALE_AND_POLISH_FLAG_KEYS.query}=0`);
    expect(isAuditsScaleAndPolishEnabled()).toBe(false);
  });

  it('URL query "true" turns it on', () => {
    setLocationSearch(`?${AUDITS_SCALE_AND_POLISH_FLAG_KEYS.query}=true`);
    expect(isAuditsScaleAndPolishEnabled()).toBe(true);
  });

  it('invalid query value falls through to localStorage', () => {
    window.localStorage.setItem(AUDITS_SCALE_AND_POLISH_FLAG_KEYS.localStorage, '1');
    setLocationSearch(`?${AUDITS_SCALE_AND_POLISH_FLAG_KEYS.query}=banana`);
    expect(isAuditsScaleAndPolishEnabled()).toBe(true);
  });

  it('invalid localStorage value falls through to the ON default', () => {
    window.localStorage.setItem(AUDITS_SCALE_AND_POLISH_FLAG_KEYS.localStorage, 'banana');
    expect(isAuditsScaleAndPolishEnabled()).toBe(true);
  });

  it('exposes stable flag keys', () => {
    expect(AUDITS_SCALE_AND_POLISH_FLAG_KEYS.localStorage).toBe('ff.audits_scale_and_polish');
    expect(AUDITS_SCALE_AND_POLISH_FLAG_KEYS.query).toBe('ff_auditsScaleAndPolish');
    expect(AUDITS_SCALE_AND_POLISH_FLAG_KEYS.env).toBe('VITE_AUDITS_SCALE_AND_POLISH');
  });
});
