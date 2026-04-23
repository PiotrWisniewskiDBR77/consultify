/**
 * Chat V10 / V10-ART-003 — feature flag for the ReviewState FSM.
 *
 * What this flag gates
 * --------------------
 * Adoption of `nextReviewState` / `canTransition` (via
 * `ReviewStateMachine.ts`) as the single resolver for artifact
 * review-lifecycle transitions. Off-by-default until the store
 * integration (V10-ART-023) lands.
 *
 * Default: **OFF**. See `ADR-V10-002`.
 *
 * Resolution order
 * ----------------
 *   1. URL query   `?ff_artifact_review_fsm=0|1`
 *   2. localStorage `ff.artifact_review_fsm`
 *   3. env          `VITE_ARTIFACT_REVIEW_FSM`
 *   4. Hard default — `false`.
 */

const LS_KEY = 'ff.artifact_review_fsm';
const QUERY_KEY = 'ff_artifact_review_fsm';
const ENV_KEY = 'VITE_ARTIFACT_REVIEW_FSM';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    const parsed = parseFlag(meta?.env?.[ENV_KEY]);
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

export function isArtifactReviewFsmEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ARTIFACT_REVIEW_FSM_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
