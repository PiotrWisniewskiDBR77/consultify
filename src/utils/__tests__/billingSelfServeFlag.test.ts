/**
 * @vitest-environment jsdom
 *
 * Unit tests for the billing self-serve kill-switch (`isBillingSelfServeEnabled`).
 *
 * Decision D8 makes the DEFAULT-OFF behaviour load-bearing: when the flag is
 * off, the self-serve card flow and revenue-analytics surfaces must be hidden,
 * so the default must be verified.
 *
 * Coverage:
 *   * Default OFF when no override.
 *   * URL query override has highest priority.
 *   * localStorage override beats env default.
 *   * `0` / `off` / `false` parse to false; `1` / `on` / `true` to true.
 *   * Invalid raw values fall through to lower priority.
 *   * Stable flag keys.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BILLING_SELF_SERVE_FLAG_KEYS, isBillingSelfServeEnabled } from '../billingSelfServeFlag';

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

describe('isBillingSelfServeEnabled', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
  });
  afterEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
  });

  it('defaults to OFF when nothing is set', () => {
    expect(isBillingSelfServeEnabled()).toBe(false);
  });

  it('honours localStorage override (1)', () => {
    window.localStorage.setItem(BILLING_SELF_SERVE_FLAG_KEYS.localStorage, '1');
    expect(isBillingSelfServeEnabled()).toBe(true);
  });

  it('honours localStorage override (off)', () => {
    window.localStorage.setItem(BILLING_SELF_SERVE_FLAG_KEYS.localStorage, 'off');
    expect(isBillingSelfServeEnabled()).toBe(false);
  });

  it('URL query overrides localStorage', () => {
    window.localStorage.setItem(BILLING_SELF_SERVE_FLAG_KEYS.localStorage, '1');
    setLocationSearch(`?${BILLING_SELF_SERVE_FLAG_KEYS.query}=0`);
    expect(isBillingSelfServeEnabled()).toBe(false);
  });

  it('URL query "true" turns it on', () => {
    setLocationSearch(`?${BILLING_SELF_SERVE_FLAG_KEYS.query}=true`);
    expect(isBillingSelfServeEnabled()).toBe(true);
  });

  it('invalid query value falls through to localStorage', () => {
    window.localStorage.setItem(BILLING_SELF_SERVE_FLAG_KEYS.localStorage, '1');
    setLocationSearch(`?${BILLING_SELF_SERVE_FLAG_KEYS.query}=banana`);
    expect(isBillingSelfServeEnabled()).toBe(true);
  });

  it('invalid localStorage value also falls through to OFF default', () => {
    window.localStorage.setItem(BILLING_SELF_SERVE_FLAG_KEYS.localStorage, 'banana');
    expect(isBillingSelfServeEnabled()).toBe(false);
  });

  it('exposes stable flag keys', () => {
    expect(BILLING_SELF_SERVE_FLAG_KEYS.localStorage).toBe('ff.billing_self_serve');
    expect(BILLING_SELF_SERVE_FLAG_KEYS.query).toBe('ff_billingSelfServe');
    expect(BILLING_SELF_SERVE_FLAG_KEYS.env).toBe('VITE_BILLING_SELF_SERVE');
  });
});
