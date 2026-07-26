/**
 * DRD Audit Report engine reveal flag (2026-07-26).
 *
 * `DRDAuditReportView` (src/views/DRDAuditReportView.tsx) is a fully built
 * editor for the DRD audit report — AI chat panel, per-section AI actions,
 * PDF export, and the publishing-grade "Raport DRD" client report — wired to
 * a LIVE backend (server/src/services/report/drdReportGenerator.ts +
 * drdReportService.ts, GET/POST /api/assessment-reports/:reportId/*). Despite
 * being complete, it has ZERO importers anywhere in the app — no route, no
 * button reaches it. This flag reveals a route + an entry point in the Audits
 * module (AuditsHub, "Raporty DRD" tab) WITHOUT going live for every user
 * first (canon: "Piotr nigdy nie jest pierwszym testerem wizualnym").
 *
 * OFF (default) → AuditsHub renders byte-identical to today (single "Audit
 * programs" tab, no /audit-programs/drd-report/:reportId route reachable).
 * ON → the "Raporty DRD" tab appears in AuditsHub, listing the org's
 * assessment reports (GET /api/assessment-reports) with an "Open" action that
 * navigates to the DRD report editor.
 *
 * Mirrors `src/utils/workbookTemplatesFlag.ts`'s reveal-flag pattern.
 *
 * Kolejność (wygrywa najwyższe):
 *   1. URL query `?ff_drd_report=0|1` — bypass operatora / dev / dev-render.
 *   2. `localStorage["ff.drdReport"]` — override user / org.
 *   3. `import.meta.env.VITE_DRD_REPORT_ENABLED` — build-time.
 *   4. Default: OFF.
 */

const LS_KEY = 'ff.drdReport';
const QUERY_KEY = 'ff_drd_report';
const ENV_KEY = 'VITE_DRD_REPORT_ENABLED';

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

export function isDrdReportEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const DRD_REPORT_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
