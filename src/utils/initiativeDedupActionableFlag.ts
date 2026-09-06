/**
 * I1 — Actionable dedup for the Initiative Generator(s).
 *
 * Consultify has TWO deliberately-disjoint initiative generators (see
 * docs/initiatives + finding_two_initiative_generators_divergence):
 *   1. Tools ▸ Inicjatywy  (ToolController.generateInitiatives, real AI, single-shot)
 *   2. InitiativeWizardModal / InitiativeGeneratorModal (canonical, Insight-driven)
 *
 * Dedup already EXISTS on demo but is only INFORMATIONAL:
 *   - Tools path → `duplicateWarnings` → a warning toast ("review the portfolio").
 *   - Insight path (InitiativeProposalBoard) → a single ambiguous "Scal/Merge"
 *     button (which actually files an `extend` suggested change) + a neutral Dismiss.
 *
 * I1 makes the dedup ACTIONABLE: the human gets an explicit **Skip (pomiń)** vs
 * **Merge (scal)** choice instead of a toothless warning. Owner decision 07-19:
 * greenlight I1 ONLY — I2/I3 (full generator unification) stay on hold.
 *
 * This flag gates ONLY the Insight/Wizard (front-end) surface. The Tools-path
 * skip behaviour is server-gated by `process.env.INITIATIVE_DEDUP_ACTIONABLE`
 * (ToolController); the two are turned on together by an operator. Default OFF on
 * both → runtime is byte-for-byte identical to today's demo behaviour.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_initiativeDedupActionable=0|1` — operator bypass for staging.
 *   2. `localStorage["ff.initiative_dedup_actionable"]` — user / org override.
 *   3. `import.meta.env.VITE_INITIATIVE_DEDUP_ACTIONABLE` — build-time default.
 *   4. Default: OFF.
 */

const LS_KEY = 'ff.initiative_dedup_actionable';
const QUERY_KEY = 'ff_initiativeDedupActionable';
const ENV_KEY = 'VITE_INITIATIVE_DEDUP_ACTIONABLE';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  try {
    const parsed = parseFlag(
      (import.meta.env as unknown as Record<string, string | undefined>)?.[ENV_KEY]
    );
    return parsed === null ? false : parsed;
  } catch {
    return false;
  }
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

export function isInitiativeDedupActionableEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const INITIATIVE_DEDUP_ACTIONABLE_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
