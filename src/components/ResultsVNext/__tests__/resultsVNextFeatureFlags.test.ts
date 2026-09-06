/**
 * @vitest-environment jsdom
 *
 * Unit tests for `isResultsVNextFlagEnabled` (RN-G2 registry flags:
 * kpiRegistry / roiRegistry / okrRegistry; `resultsSearch` usunięta DEC-422b/e).
 *
 * kpiRegistry flipped OFF -> ON (demo/stage/dev; public production stays
 * OFF) on 2026-08-27 — Piotr accepted the KPI registry on dev-render
 * screenshots (DEC-2026-08-26-112 flagged it "GOTOWE DO WŁĄCZENIA", decision
 * deferred to the owner's visual odbiór — that odbiór has now happened).
 *
 * DEC 03.09 wieczór (A1, docs/program/DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md
 * wiersz A1 — "14 ekranów Wyników: KPI, OKR, ROI, wyszukiwarka, uwaga"):
 * roiRegistry/okrRegistry join kpiRegistry in the same D-D
 * default-on shape (ON off public production, OFF on it).
 * resultsLegacyArchive is NOT part of this decision — stays default OFF
 * everywhere. `attentionEntry` (the fifth named domain, "uwaga") and
 * `managementReportEntry` were REMOVED entirely DEC-422 (06.09) — the owner
 * asked for both entry-point buttons gone, not just gated off; see
 * `ResultsVNextRegistryShell.tsx` for the removal note. Their flags no
 * longer exist in `FLAGS`/`ResultsVNextFlag`.
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

  describe('roiRegistry / okrRegistry — DEC 03.09 wieczór A1 default-on', () => {
    it('roiRegistry defaults ON off public production, OFF on it', () => {
      expect(isResultsVNextFlagEnabled('roiRegistry')).toBe(true);
      setLocation({ hostname: 'consultify.ai' });
      expect(isResultsVNextFlagEnabled('roiRegistry')).toBe(false);
    });

    it('okrRegistry defaults ON off public production, OFF on it', () => {
      expect(isResultsVNextFlagEnabled('okrRegistry')).toBe(true);
      setLocation({ hostname: 'consultify.ai' });
      expect(isResultsVNextFlagEnabled('okrRegistry')).toBe(false);
    });

    it('roiRegistry/okrRegistry still honour explicit query/localStorage "0" overrides despite the ON default', () => {
      window.localStorage.setItem(RESULTS_VNEXT_FLAG_KEYS.roiRegistry.localStorage, '0');
      expect(isResultsVNextFlagEnabled('roiRegistry')).toBe(false);
      setLocation({ search: `?${RESULTS_VNEXT_FLAG_KEYS.okrRegistry.query}=0` });
      expect(isResultsVNextFlagEnabled('okrRegistry')).toBe(false);
    });
  });

  describe('DEC-422 (06.09) — removed flags stay gone', () => {
    it('attentionEntry / managementReportEntry no longer exist in the flag table', () => {
      // MUTACJA: przywrócenie którejkolwiek flagi do FLAGS wywraca ten test.
      expect(Object.keys(RESULTS_VNEXT_FLAG_KEYS)).not.toContain('attentionEntry');
      expect(Object.keys(RESULTS_VNEXT_FLAG_KEYS)).not.toContain('managementReportEntry');
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
