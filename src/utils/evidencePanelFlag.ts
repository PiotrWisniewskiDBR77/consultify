/**
 * Evidence panel UI flag (HP-17, 2026-07-15).
 *
 * HP-16 wired real `EvidenceContract` generation (deterministic, zero-LLM
 * confidence/sources/assumptions) into 8 generator services — see
 * `server/src/services/evidence/evidenceContract.ts`. The persisted, FE-facing
 * form (`EvidenceEnvelope` via `evidenceEnvelopeService.ts`) and its render
 * (`EvidencePanelSection.tsx`, `src/components/standard/`) landed for exactly
 * ONE artifact type — Insight (`src/components/Interview/InsightViewer.tsx`,
 * unconditional — no flag, already accepted). The other 5-6 archetypes
 * (canvas/deck/document/report/initiative/finance) had the UI slot ready but
 * no wiring.
 *
 * Per CLAUDE.md rule #7 (Piotr is never the first visual tester), every NEW
 * wiring point added by HP-17 goes behind this flag (default OFF) so nothing
 * changes visually until screenshots are reviewed and accepted — same
 * resolution order/shape as `artifactApprovalUiFlag.ts` / `studioFlag.ts`.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_evidencePanel=0|1` — operator bypass.
 *   2. `localStorage["ff.evidencePanel"]` — user/org override.
 *   3. Default: OFF (nothing renders differently until a Vegas pass flips it
 *      after owner acceptance on screenshots).
 */

const LS_KEY = 'ff.evidencePanel';
const QUERY_KEY = 'ff_evidencePanel';

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

export function isEvidencePanelEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return true; // FLIP default ON — delegowany akcept Piotra 2026-07-16 (galeria czysta; Vegas dopracuje wygląd)
}

export const EVIDENCE_PANEL_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
} as const;
