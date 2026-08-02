import { useLayoutEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * TLS-01 — the five Tools Hub surfaces (Library, Sessions, Outputs, Reports,
 * Initiatives) as a stable, routable `?tab=` query param, two-way synced
 * with `activeTab` state.
 *
 * A two-EFFECT split (one URL->state, one state->URL) is tempting but
 * genuinely races: both effects fire from the SAME render, and whichever
 * one reads a stale pre-update closure can bounce the other's just-applied
 * change right back (concretely: a deep-link mount applies the URL's tab to
 * state, but the OTHER effect's stale closure -- still holding the
 * pre-update state -- then "corrects" the URL back to the old value,
 * re-triggering the first effect, forever). A ref-based "resolution in
 * flight" guard can block THAT specific case, but cannot by itself tell
 * "the URL changed externally (deep link/back-forward)" apart from "state
 * changed internally (a tab click) while the URL happens to still hold an
 * old value" -- both look identical as a bare `tabParam !== activeTab`
 * mismatch, so a guard tuned to fix one direction ends up fighting the
 * other (blocking legitimate user-initiated tab switches).
 *
 * Fix: ONE effect, and explicitly track which side actually changed since
 * the last time this effect ran (previous-value diffing via refs), so a
 * mismatch is resolved in the direction whose value has a NEW previous-vs-
 * current delta, never toward a side that merely hasn't caught up yet.
 */
const VALID_SURFACES = new Set(['library', 'sessions', 'outputs', 'reports', 'initiatives']);

export function normalizeSurfaceParam(raw: string | null | undefined, fallback: string): string {
  const value = String(raw || '').trim();
  return VALID_SURFACES.has(value) ? value : fallback;
}

interface UseSurfaceUrlSyncOptions {
  hydrated: boolean;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  defaultTab: string;
}

export function useSurfaceUrlSync({
  hydrated,
  activeTab,
  setActiveTab,
  defaultTab,
}: UseSurfaceUrlSyncOptions): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTabParam = searchParams.get('tab');
  const tabParam = normalizeSurfaceParam(rawTabParam, defaultTab);

  const setActiveTabRef = useRef(setActiveTab);
  setActiveTabRef.current = setActiveTab;
  const prevRawTabParamRef = useRef(rawTabParam);
  const prevActiveTabRef = useRef(activeTab);
  const isFirstRunRef = useRef(true);

  useLayoutEffect(() => {
    if (!hydrated) return;

    const isFirstRun = isFirstRunRef.current;
    isFirstRunRef.current = false;
    // On the very first run there is no genuine "previous" render to diff
    // against -- treat it as the URL side having just "arrived" (deep-link/
    // reload semantics: the URL wins on first load), never the state side.
    const rawChangedSinceLastRun = isFirstRun || rawTabParam !== prevRawTabParamRef.current;
    const activeChangedSinceLastRun = !isFirstRun && activeTab !== prevActiveTabRef.current;
    prevRawTabParamRef.current = rawTabParam;
    prevActiveTabRef.current = activeTab;

    if (tabParam === activeTab) return; // already consistent, nothing to reconcile

    if (rawChangedSinceLastRun && !activeChangedSinceLastRun) {
      // URL changed (deep link, reload, back/forward) -> apply to state.
      const explicitTab = rawTabParam && VALID_SURFACES.has(rawTabParam) ? rawTabParam : null;
      if (explicitTab) setActiveTabRef.current(explicitTab);
      return;
    }

    // State changed (a tab click) -> reflect it into the URL.
    const next = new URLSearchParams(searchParams);
    next.set('tab', activeTab);
    setSearchParams(next, { replace: true });
  }, [hydrated, activeTab, rawTabParam, tabParam, searchParams, setSearchParams]);
}
