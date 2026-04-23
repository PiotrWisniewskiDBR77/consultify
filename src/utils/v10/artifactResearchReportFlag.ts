/**
 * Chat V10 / V10-ART-020 — feature flag for the research_report
 * typed schema + claim/citation + hedging-discipline invariants.
 *
 * Runtime contract lives in
 * `src/models/artifact/ResearchReportSchema.ts`. Default OFF —
 * Wave A seed pins the 8-block catalogue, the claim-must-cite
 * invariant, the "un-hedged claims only on certain findings"
 * honesty rule, and the pure index builder; the Wave B
 * citation renderer + hedging chips UI and the Deep Research
 * writer (V10-RSR-*) bind to this shape.
 */

const LS_KEY = 'ff.artifact_research_report';
const QUERY_KEY = 'ff_artifact_research_report';
const ENV_KEY = 'VITE_ARTIFACT_RESEARCH_REPORT';

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

export function isArtifactResearchReportEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const ARTIFACT_RESEARCH_REPORT_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
