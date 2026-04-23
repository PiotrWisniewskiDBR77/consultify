/**
 * Chat V10 / V10-ART-007 — feature flag for the MutationProposal envelope.
 *
 * Gates adoption of `assertMutationProposal` at the ArtifactStore
 * write boundary. When ON, every AI-sourced write MUST arrive wrapped
 * in a `MutationProposal` and pass the invariant bundle before the
 * apply pipeline (V10-ART-010) accepts it. When OFF, legacy direct
 * writes still pass through the store unchanged. Default OFF.
 * See `ADR-V10-002`.
 */

const LS_KEY = 'ff.artifact_mutation_proposal';
const QUERY_KEY = 'ff_artifact_mutation_proposal';
const ENV_KEY = 'VITE_ARTIFACT_MUTATION_PROPOSAL';

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

export function isArtifactMutationProposalEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ARTIFACT_MUTATION_PROPOSAL_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
