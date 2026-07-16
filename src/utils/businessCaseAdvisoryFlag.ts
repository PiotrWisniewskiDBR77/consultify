/**
 * Business Case Advisory UI flag (Oxford O4, 2026-07-15).
 *
 * `POST /api/v8/advisory/business-case` (server/src/routes/v8/advisory.routes.ts)
 * wires BusinessCaseService's 5-phase pipeline (PLAN → CONFIRM → MODEL →
 * REVIEW → NARRATIVE, server/src/services/advisory/BusinessCaseService.ts) to
 * HTTP but had zero callers in `src/` — a mounted, ready endpoint with no UI.
 * This flag gates the thin one-shot UI that calls it
 * (`src/components/Economics/InitiativeBusinessCaseCard.tsx`, wired into the
 * Initiative Detail Modal's "economics" tab).
 *
 * Per CLAUDE.md rule #7 (Piotr is never the first visual tester), this ships
 * default OFF so the first render/screenshot happens without Piotr, and only
 * flips default-ON after owner acceptance on screenshots (dark+light).
 *
 * Resolution order (highest wins), same shape as `artifactApprovalUiFlag.ts`:
 *   1. URL query `?ff_businessCaseAdvisory=0|1` — operator bypass.
 *   2. `localStorage["ff.businessCaseAdvisory"]` — user/org override.
 *   3. Default: OFF.
 */

const LS_KEY = 'ff.businessCaseAdvisory';
const QUERY_KEY = 'ff_businessCaseAdvisory';

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

export function isBusinessCaseAdvisoryEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return true; // FLIP default ON — delegowany akcept Piotra 2026-07-16 (galeria czysta; Vegas dopracuje wygląd)
}

export const BUSINESS_CASE_ADVISORY_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
} as const;
