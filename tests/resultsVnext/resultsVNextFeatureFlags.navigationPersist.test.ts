/**
 * RN-G6 UI fix (task 1, 2026-08-12) — regression test for the real bug
 * reported by Piotr: clicking "Open" in the KPI registry preview panel
 * landed on the "not yet enabled" screen even though the flag had just been
 * turned on via `?ff_resultsVNextKpi=1` in the address bar.
 *
 * Root cause (confirmed live on the real app, see RN_G6_UIFIX.md): in-app
 * `navigate(path)` calls (`ResultsKpiRegistryPage.tsx` -> `/results/kpi/:kpiId`)
 * build a bare path string and never carry the current `location.search`
 * along, so the query-string flag is gone the instant the browser's
 * `window.location.search` updates to the new bare path — `readQuery`
 * (inside `isResultsVNextFlagEnabled`) then returns `null` for that read.
 *
 * Fix: `isResultsVNextFlagEnabled` now persists an EXPLICIT query value into
 * localStorage the moment it is read (`writeLocalStorage` in
 * `resultsVNextFeatureFlags.ts`) — localStorage is already 2nd in the
 * documented resolution order (query -> localStorage -> env -> default), so
 * every subsequent read this session — including ones after a navigate()
 * that dropped the query string — still resolves the same value. This test
 * simulates exactly that sequence (read with query present, then read again
 * with the query gone, as happens after an in-app navigate) directly against
 * `window.location.search`/`window.localStorage`, without needing a router.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isResultsVNextFlagEnabled, RESULTS_VNEXT_FLAG_KEYS } from '../../src/components/ResultsVNext/resultsVNextFeatureFlags';

const LS_KEY = RESULTS_VNEXT_FLAG_KEYS.kpiRegistry.localStorage; // 'ff.results_vnext_kpi_registry'
const QUERY_KEY = RESULTS_VNEXT_FLAG_KEYS.kpiRegistry.query; // 'ff_resultsVNextKpi'

function setLocationSearch(search: string): void {
  // `tests/setup.ts` already replaces `window.location` with a plain,
  // writable object (`{...window.location, assign/replace/reload: vi.fn()}`)
  // to stub JSDOM's "not implemented: navigation" errors — that object is
  // NOT a live `Location` bound to `window.history`, so `pushState` does not
  // change its `.search`. Redefining it the same way `setup.ts` does is the
  // only way this suite can drive `window.location.search`, which is
  // exactly what `readQuery()` in `resultsVNextFeatureFlags.ts` reads.
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search },
    writable: true,
  });
}

describe('resultsVNextFeatureFlags — flag survives in-app navigation that drops the query string (RN-G6 task 1)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
  });

  afterEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
  });

  it('defaults to false with no query, no localStorage, no env (never changed by this fix)', () => {
    expect(isResultsVNextFlagEnabled('kpiRegistry')).toBe(false);
  });

  it('reads true from an explicit query param (existing behaviour, unchanged)', () => {
    setLocationSearch(`?${QUERY_KEY}=1`);
    expect(isResultsVNextFlagEnabled('kpiRegistry')).toBe(true);
  });

  it('THE FIX: an explicit query read persists to localStorage, so a later read with the query gone (simulating navigate() dropping it) still resolves true', () => {
    setLocationSearch(`?${QUERY_KEY}=1`);
    expect(isResultsVNextFlagEnabled('kpiRegistry')).toBe(true); // registry page render

    // Simulate `navigate(ROUTES.RESULTS_KPI.TOOL.replace(...))` — a bare
    // path with no query string, exactly what ResultsKpiRegistryPage.tsx's
    // `onOpenTool`/`onOpenFull` build.
    setLocationSearch('');
    expect(isResultsVNextFlagEnabled('kpiRegistry')).toBe(true); // KpiToolPage render, post-navigate

    // And the persisted value really did land in localStorage under the
    // documented key (2nd in the resolution order), not some side channel.
    expect(window.localStorage.getItem(LS_KEY)).toBe('1');
  });

  it('an explicit query value persists even across an entirely fresh isResultsVNextFlagEnabled call sequence (not just the one component instance)', () => {
    setLocationSearch(`?${QUERY_KEY}=1`);
    isResultsVNextFlagEnabled('kpiRegistry');
    setLocationSearch(''); // query gone, as after navigate()
    expect(isResultsVNextFlagEnabled('kpiRegistry')).toBe(true);
    expect(isResultsVNextFlagEnabled('kpiRegistry')).toBe(true); // idempotent, not a one-shot fluke
  });

  it('an explicit query FALSE also persists (URL always wins, and sticks after navigate) — not only the enable direction', () => {
    setLocationSearch(`?${QUERY_KEY}=1`);
    isResultsVNextFlagEnabled('kpiRegistry');
    setLocationSearch(`?${QUERY_KEY}=0`);
    expect(isResultsVNextFlagEnabled('kpiRegistry')).toBe(false);
    setLocationSearch(''); // navigate away, query gone
    expect(isResultsVNextFlagEnabled('kpiRegistry')).toBe(false);
  });

  it('does NOT touch a DIFFERENT domain flag\'s localStorage key (per-domain isolation, master plan convention)', () => {
    setLocationSearch(`?${QUERY_KEY}=1`);
    isResultsVNextFlagEnabled('kpiRegistry');
    expect(window.localStorage.getItem(RESULTS_VNEXT_FLAG_KEYS.roiRegistry.localStorage)).toBeNull();
    expect(window.localStorage.getItem(RESULTS_VNEXT_FLAG_KEYS.okrRegistry.localStorage)).toBeNull();
  });

  it('never changes the DEFAULT (no query, no localStorage, no env still resolves false) — this fix is about persistence of an explicit choice, not a new default-on', () => {
    // Prove the persistence mechanism is live in this test run (sanity), then
    // prove a truly fresh flag (no prior explicit choice) is still OFF.
    setLocationSearch(`?${QUERY_KEY}=1`);
    isResultsVNextFlagEnabled('kpiRegistry');
    setLocationSearch('');
    expect(isResultsVNextFlagEnabled('roiRegistry')).toBe(false); // different domain, never touched
  });
});
