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
  // D-D (2026-06-29): verified-ready M15 cockpit defaults ON everywhere EXCEPT
  // public production (consultify.ai). Demo/stage/dev → ON (Piotr's odbiór sees
  // the full cockpit without ?ff_ params); prod stays env-gated (D-G = no prod).
  // Reversible: drop this line to restore default-OFF.
  return !isPublicProductionHost(
    typeof window !== 'undefined' ? window.location.hostname : ''
  );
}

export const RESULTS_FLAG_KEYS = FLAGS;
