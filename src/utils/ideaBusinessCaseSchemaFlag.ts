/**
 * Idea Business Case UI flag — Program D / epic E08 (2026-08-10).
 *
 * Gates the new "Karta biznesowa" / "Business case" collapsible section in
 * the Idea workspace's Przegląd tab (`IdeaBusinessCaseSection.tsx`, embedded
 * from `IdeaWorkspaceTools.tsx`).
 *
 * Per CLAUDE.md rule #7 (Piotr is never the first visual tester), this ships
 * default OFF — the first render/screenshot must happen without Piotr, in a
 * harness, before this flips on.
 *
 * Resolution order (highest wins) — same shape as `businessCaseAdvisoryFlag.ts`:
 *   1. URL query `?ff_ideaBusinessCase=0|1` — operator bypass.
 *   2. `localStorage["ff.idea_business_case"]` — user/org override.
 *   3. `import.meta.env.VITE_IDEA_BUSINESS_CASE` — build-time override.
 *   4. Default: OFF.
 */

import {
  isDemoAcceptanceProfileEnabled,
  type DemoAcceptanceProfileSource,
} from './demoAcceptanceProfile';

const LS_KEY = 'ff.idea_business_case';
const QUERY_KEY = 'ff_ideaBusinessCase';
const ENV_KEY = 'VITE_IDEA_BUSINESS_CASE';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readQueryOverride(): boolean | null {
  if (typeof window === 'undefined' || !window.location) return null;
  try {
    return parseFlag(new URLSearchParams(window.location.search).get(QUERY_KEY));
  } catch {
    return null;
  }
}

function readLocalStorage(): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return parseFlag(window.localStorage.getItem(LS_KEY));
  } catch {
    return null;
  }
}

export function isIdeaBusinessCaseEnabled(profileSource?: DemoAcceptanceProfileSource): boolean {
  if (isDemoAcceptanceProfileEnabled(profileSource)) return true;
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  try {
    const env =
      profileSource?.env ??
      (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    const fromEnv = parseFlag(env?.[ENV_KEY]);
    if (fromEnv !== null) return fromEnv;
  } catch {
    // Fall through to the fail-closed default.
  }
  return false; // default OFF — needs owner acceptance on a clean screenshot first (CLAUDE.md #7)
}

export const IDEA_BUSINESS_CASE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
