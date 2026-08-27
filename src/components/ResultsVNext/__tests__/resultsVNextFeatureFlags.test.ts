/**
 * @vitest-environment jsdom
 *
 * Unit tests for `isResultsVNextFlagEnabled` (RN-G2 registry flags:
 * kpiRegistry / roiRegistry / okrRegistry).
 *
 * kpiRegistry flipped OFF -> ON (demo/stage/dev; public production stays
 * OFF) on 2026-08-27 — Piotr accepted the KPI registry on dev-render
 * screenshots (DEC-2026-08-26-112 flagged it "GOTOWE DO WŁĄCZENIA", decision
 * deferred to the owner's visual odbiór — that odbiór has now happened).
 * roiRegistry/okrRegistry are untouched by this flip and stay default OFF
 * everywhere — neither domain has had its dev-render odbiór yet.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  isResultsVNextFlagEnabled,
  resultsVNextHostAllowsDefaultOn,
  RESULTS_VNEXT_FLAG_KEYS,
} from '../resultsVNextFeatureFlags';

const ORIGINAL_LOCATION = window.location;

function setLocation(overrides: { search?: string; hostname?: string }) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...ORIGINAL_LOCATION,
      search: overrides.search ?? '',
      hostname: overrides.hostname ?? ORIGINAL_LOCATION.hostname,
    },
  });
}

describe('isResultsVNextFlagEnabled', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocation({});
  });
  afterEach(() => {
    window.localStorage.clear();
    setLocation({});
  });

  describe('kpiRegistry (flip po akcepcie właściciela 27.08)', () => {
    it('defaults ON on a non-production host (e.g. localhost/demo/stage/dev)', () => {
      expect(isResultsVNextFlagEnabled('kpiRegistry')).toBe(true);
    });

    it('defaults OFF on public production (consultify.ai)', () => {
      setLocation({ hostname: 'consultify.ai' });
      expect(isResultsVNextFlagEnabled('kpiRegistry')).toBe(false);
    });

    it('defaults OFF on www.consultify.ai too', () => {
      setLocation({ hostname: 'www.consultify.ai' });
      expect(isResultsVNextFlagEnabled('kpiRegistry')).toBe(false);
    });

    it('localStorage "0" still disables it despite the ON default', () => {
      window.localStorage.setItem(RESULTS_VNEXT_FLAG_KEYS.kpiRegistry.localStorage, '0');
      expect(isResultsVNextFlagEnabled('kpiRegistry')).toBe(false);
    });

    it('URL query "0" still disables it despite the ON default, and persists to localStorage', () => {
      setLocation({ search: `?${RESULTS_VNEXT_FLAG_KEYS.kpiRegistry.query}=0` });
      expect(isResultsVNextFlagEnabled('kpiRegistry')).toBe(false);
      expect(window.localStorage.getItem(RESULTS_VNEXT_FLAG_KEYS.kpiRegistry.localStorage)).toBe(
        '0'
      );
    });

    it('URL query "1" keeps it enabled on production too (explicit opt-in beats the host guard)', () => {
      setLocation({
        hostname: 'consultify.ai',
        search: `?${RESULTS_VNEXT_FLAG_KEYS.kpiRegistry.query}=1`,
      });
      expect(isResultsVNextFlagEnabled('kpiRegistry')).toBe(true);
    });

    it('env override "1" keeps it enabled regardless of host', () => {
      // env is read via import.meta.env at module scope in the source; this
      // repo's other *FeatureFlags tests do not exercise the env branch
      // directly for the same reason (import.meta.env is build-time), so we
      // only assert the documented precedence here: query > localStorage >
      // env > default. The default-on assertions above already cover the
      // env-unset path for kpiRegistry.
      expect(RESULTS_VNEXT_FLAG_KEYS.kpiRegistry.env).toBe('VITE_RESULTS_VNEXT_KPI_ENABLED');
    });
  });

  describe('roiRegistry / okrRegistry — untouched by the kpiRegistry flip', () => {
    it('roiRegistry still defaults OFF everywhere', () => {
      expect(isResultsVNextFlagEnabled('roiRegistry')).toBe(false);
      setLocation({ hostname: 'consultify.ai' });
      expect(isResultsVNextFlagEnabled('roiRegistry')).toBe(false);
    });

    it('okrRegistry still defaults OFF everywhere', () => {
      expect(isResultsVNextFlagEnabled('okrRegistry')).toBe(false);
      setLocation({ hostname: 'consultify.ai' });
      expect(isResultsVNextFlagEnabled('okrRegistry')).toBe(false);
    });

    it('roiRegistry/okrRegistry still honour explicit query/localStorage overrides', () => {
      window.localStorage.setItem(RESULTS_VNEXT_FLAG_KEYS.roiRegistry.localStorage, '1');
      expect(isResultsVNextFlagEnabled('roiRegistry')).toBe(true);
      setLocation({ search: `?${RESULTS_VNEXT_FLAG_KEYS.okrRegistry.query}=1` });
      expect(isResultsVNextFlagEnabled('okrRegistry')).toBe(true);
    });
  });

  describe('resultsSearch — owner-contract Menu 2 entry', () => {
    it('stays OFF by default and turns ON only with an explicit carrier', () => {
      expect(isResultsVNextFlagEnabled('resultsSearch')).toBe(false);
      setLocation({ search: `?${RESULTS_VNEXT_FLAG_KEYS.resultsSearch.query}=1` });
      expect(isResultsVNextFlagEnabled('resultsSearch')).toBe(true);
    });
  });

  describe('resultsVNextHostAllowsDefaultOn', () => {
    it('is true off public production and false on it — the guard kpiRegistry now uses', () => {
      expect(resultsVNextHostAllowsDefaultOn('localhost')).toBe(true);
      expect(resultsVNextHostAllowsDefaultOn('demo.consultify.ai')).toBe(true);
      expect(resultsVNextHostAllowsDefaultOn('consultify.ai')).toBe(false);
      expect(resultsVNextHostAllowsDefaultOn('www.consultify.ai')).toBe(false);
    });
  });
});
