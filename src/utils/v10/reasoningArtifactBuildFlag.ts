/**
 * Chat V10 / V10-RSN-019 — feature flag for artifact_build workload contract.
 *
 * Runtime contract lives in
 * `src/models/reasoning/ArtifactBuild.ts`. Default OFF —
 * Wave A seed pins the ARTIFACT_TARGET_KINDS catalogue,
 * ARTIFACT_BUILD_BUDGET_TIERS, ARTIFACT_BUILD_BUDGETS,
 * ARTIFACT_BUILD_MIN_COVERAGE, ArtifactBuildRequest shape,
 * buildArtifactBuildRequest, and runtime invariants; Wave B wires
 * the full artifact generation pipeline and MutationProposal emission.
 */

const LS_KEY = 'ff.reasoning_artifact_build';
const QUERY_KEY = 'ff_reasoning_artifact_build';
const ENV_KEY = 'VITE_REASONING_ARTIFACT_BUILD';

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

export function isReasoningArtifactBuildEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const REASONING_ARTIFACT_BUILD_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
