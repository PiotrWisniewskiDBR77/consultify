/**
 * @vitest-environment jsdom
 *
 * Unit tests for the MELS Tabele kill-switch (`isMelsTabeleEnabled`).
 *
 * Coverage:
 *   * Default OFF when no override.
 *   * URL query override has highest priority.
 *   * localStorage override beats env default.
 *   * `0` / `off` / `false` parse to false; `1` / `on` / `true` to true.
 *   * Invalid raw values fall through to lower priority.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MELS_TABELE_FLAG_KEYS, isMelsTabeleEnabled } from '../melsTabeleFlag';

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

describe('isMelsTabeleEnabled', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
  });
  afterEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
  });

  it('defaults to OFF when nothing is set', () => {
    expect(isMelsTabeleEnabled()).toBe(false);
  });

  it('honours localStorage override (1)', () => {
    window.localStorage.setItem(MELS_TABELE_FLAG_KEYS.localStorage, '1');
    expect(isMelsTabeleEnabled()).toBe(true);
  });

  it('honours localStorage override (off)', () => {
    window.localStorage.setItem(MELS_TABELE_FLAG_KEYS.localStorage, 'off');
    expect(isMelsTabeleEnabled()).toBe(false);
  });

  it('URL query overrides localStorage', () => {
    window.localStorage.setItem(MELS_TABELE_FLAG_KEYS.localStorage, '1');
    setLocationSearch(`?${MELS_TABELE_FLAG_KEYS.query}=0`);
    expect(isMelsTabeleEnabled()).toBe(false);
  });

  it('URL query "true" turns it on', () => {
    setLocationSearch(`?${MELS_TABELE_FLAG_KEYS.query}=true`);
    expect(isMelsTabeleEnabled()).toBe(true);
  });

  it('invalid query value falls through to localStorage', () => {
    window.localStorage.setItem(MELS_TABELE_FLAG_KEYS.localStorage, '1');
    setLocationSearch(`?${MELS_TABELE_FLAG_KEYS.query}=banana`);
    expect(isMelsTabeleEnabled()).toBe(true);
  });

  it('invalid localStorage value also falls through', () => {
    window.localStorage.setItem(MELS_TABELE_FLAG_KEYS.localStorage, 'banana');
    expect(isMelsTabeleEnabled()).toBe(false);
  });

  it('exposes stable flag keys', () => {
    expect(MELS_TABELE_FLAG_KEYS.localStorage).toBe('ff.mels_tabele');
    expect(MELS_TABELE_FLAG_KEYS.query).toBe('ff_melsTabele');
    expect(MELS_TABELE_FLAG_KEYS.env).toBe('VITE_MELS_TABELE');
  });
});
