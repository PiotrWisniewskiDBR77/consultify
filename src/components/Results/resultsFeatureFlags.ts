/**
 * M15 — Results cockpit feature flags (default OFF, live-safe).
 *
 * New M15 surfaces (M14 handoff inbox, value driver tree, transformation
 * scorecard, …) ship behind flags so they land in code without changing the live
 * ResultsHub until a deliberate flip + pixel-verify. Resolution order (first
 * wins): URL query → localStorage → Vite build env → default false.
 *
 * Mirrors src/components/Execution/executionFeatureFlags.ts (one system).
 */

import { isPublicProductionHost } from '@/utils/publicProduction';

type FlagKeys = { query: string; localStorage: string; env: string };

const FLAGS = {
  m14Handoff: {
    query: 'ff_m14Handoff',
    localStorage: 'ff.results_m14_handoff',
    env: 'VITE_RESULTS_M14_HANDOFF_ENABLED',
  },
  valueDriverTree: {
    query: 'ff_valueTree',
    localStorage: 'ff.results_value_tree',
    env: 'VITE_RESULTS_VALUE_TREE_ENABLED',
  },
  transformationScorecard: {
    query: 'ff_valueScorecard',
    localStorage: 'ff.results_scorecard',
    env: 'VITE_RESULTS_SCORECARD_ENABLED',
  },
  strategicLayer: {
    query: 'ff_strategicLayer',
    localStorage: 'ff.results_strategic_layer',
    env: 'VITE_RESULTS_STRATEGIC_LAYER_ENABLED',
  },
  aiInsights: {
    query: 'ff_aiInsights',
    localStorage: 'ff.results_ai_insights',
    env: 'VITE_RESULTS_AI_INSIGHTS_ENABLED',
  },
  portfolioInsights: {
    query: 'ff_portfolioInsights',
    localStorage: 'ff.results_portfolio_insights',
    env: 'VITE_RESULTS_PORTFOLIO_INSIGHTS_ENABLED',
  },
  // #81/OC2 (2026-07-13): new ResultsHub mount (ResultsThreePairsView) — a new
  // wired *screen*, not just a new panel. NOT covered by the D-D default-on
  // fallback below (kanon rule #7: Piotr must see a dev-render screenshot
  // first). Stays default OFF until that odbiór, then flip via env/localStorage.
  threePairs: {
    query: 'ff_resultsThreePairs',
    localStorage: 'ff.results_three_pairs',
    env: 'VITE_RESULTS_THREE_PAIRS_ENABLED',
  },
  // #M15/OC2 (2026-07-15): wires the 3 previously orphaned engines
  // (kpiAnomalyService/kpiForecastService/deviationRcaSuggestService, added to
  // v8/results.routes.ts in fala 3) into the deviation-case panel of
  // KPITimeSeriesDrawer — anomaly badge, forecast projection, RCA hypothesis
  // suggestions. Default OFF (rule #7: dev-render + Piotr's odbiór on
  // screenshots before any default flip). NOT part of the threePairs D-D
  // default-on set above — this is a brand-new AI surface, not a
  // verified-ready cockpit screen.
  deviationDiagnostics: {
    query: 'ff_deviationDiagnostics',
    localStorage: 'ff.results_deviation_diagnostics',
    env: 'VITE_RESULTS_DEVIATION_DIAGNOSTICS_ENABLED',
  },
  // #RES-003A (2026-08-01): canonical KPI Recovery Card — wires the
  // hypothesis → confirmed cause → actions/checkpoints → close/continue/escalate
  // loop into the deviation-case tab of KPITimeSeriesDrawer. Default OFF (rule
  // #7: dev-render + Piotr's odbiór on a clean screenshot before any default
  // flip). Not part of the D-D default-on set below — brand-new artifact-shaped
  // screen, not a previously verified cockpit surface.
  recoveryCard: {
    query: 'ff_recoveryCard',
    localStorage: 'ff.results_recovery_card',
    env: 'VITE_RESULTS_RECOVERY_CARD_ENABLED',
  },
} as const satisfies Record<string, FlagKeys>;

export type ResultsFlag = keyof typeof FLAGS;

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw == null) return null;
  const v = raw.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  return null;
}

function readQuery(key: string): boolean | null {
  if (typeof window === 'undefined' || !window.location?.search) return null;
  try {
    return parseFlag(new URLSearchParams(window.location.search).get(key));
  } catch {
    return null;
  }
}

function readLocalStorage(key: string): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return parseFlag(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

function readEnv(key: string): boolean {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env;
    return parseFlag(env?.[key]) === true;
  } catch {
    return false;
  }
}

/** True when the given Results cockpit feature is enabled (default OFF). */
export function isResultsFlagEnabled(flag: ResultsFlag): boolean {
  const keys = FLAGS[flag];
  const fromQuery = readQuery(keys.query);
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage(keys.localStorage);
  if (fromLs !== null) return fromLs;
  if (readEnv(keys.env)) return true;
  // recoveryCard (#RES-003A, 2026-08-01): brand-new artifact-shaped screen, not
  // yet dev-render-verified by Piotr. Deliberately EXCLUDED from the D-D
  // default-on fallback below — must read as OFF on every host (prod, demo,
  // stage, dev) until an explicit opt-in via ?ff_recoveryCard=1 / localStorage
  // / env, per CLAUDE.md rule #7. Remove this early-return only after Piotr's
  // odbiór on a clean dev-render screenshot, same as deviationDiagnostics below.
  if (flag === 'recoveryCard') return false;
  // deviationDiagnostics (#M15/OC2): AI RCA-suggest surface. Zweryfikowany
  // dev-render (harness light+dark, 2026-07-16 — RCA hipotezy + akcje renderują
  // czysto, dark-safe, zero crimson w bramkowanym UI) → przeniesiony do zbioru
  // D-D default-on (demo/stage/dev ON, prod OFF via isPublicProductionHost).
  // Opt-out: ?ff_deviationDiagnostics=0.
  // threePairs (#81/OC2): Piotr ZAAKCEPTOWAŁ redesign na zrzucie harness 07-13
  // (CLAUDE.md rule #7 spełniona) → dołączony do D-D default-on (demo/stage/dev),
  // prod pozostaje OFF. Opt-out: ?ff_resultsThreePairs=0.
  // D-D (2026-06-29): verified-ready M15 cockpit defaults ON everywhere EXCEPT
  // public production (consultify.ai). Demo/stage/dev → ON (Piotr's odbiór sees
  // the full cockpit without ?ff_ params); prod stays env-gated (D-G = no prod).
  // Reversible: drop this line to restore default-OFF.
  return !isPublicProductionHost(typeof window !== 'undefined' ? window.location.hostname : '');
}

export const RESULTS_FLAG_KEYS = FLAGS;
