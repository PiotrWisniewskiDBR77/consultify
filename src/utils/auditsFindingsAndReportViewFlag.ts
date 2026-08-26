/**
 * Feature flag — `ff_auditsFindingsAndReportView`.
 *
 * Gates TWO additions to the Audits method kernel (`AuditsMethodHub`), built
 * over backend endpoints that already exist and were never called from the
 * frontend:
 *   1. The 6th tab „Ustalenia" (findings/CAPA register) — `AuditFindingsTab`,
 *      over `GET /audits/findings*` (`findings.routes.ts`).
 *   2. The full report content view (SPEC-A Dokument archetype) —
 *      `AuditReportDocumentView`, over `GET /audits/reports/:id/presentation`
 *      (`reports.routes.ts`).
 *
 * Fail-closed contract (CLAUDE.md #7 — "Piotr nigdy nie jest pierwszym
 * testerem wizualnym"): default OFF. Resolution mirrors
 * `criterionWorkspaceV2Flag.ts` (query > localStorage > env > default), the
 * ONLY difference being the default value (`false` here, not `true`) — this
 * screen has not been shown to the owner yet, so it stays behind the flag
 * until a dev-render screenshot is accepted.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_auditsFindingsAndReportView=0|1` — instant per-session
 *      bypass (dev-render harness / regression checks).
 *   2. `localStorage["ff.audits_findings_and_report_view"]` — user/org override.
 *   3. `import.meta.env.VITE_AUDITS_FINDINGS_AND_REPORT_VIEW` — build-time override.
 *   4. Default: OFF.
 *
 * Resolution result is cached at module scope — call
 * `resetAuditsFindingsAndReportViewFlagCache` between reads in tests.
 */

const LS_KEY = 'ff.audits_findings_and_report_view';
const QUERY_KEY = 'ff_auditsFindingsAndReportView';
const ENV_KEY = 'VITE_AUDITS_FINDINGS_AND_REPORT_VIEW';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean | null {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    return parseFlag(meta?.env?.[ENV_KEY]);
  } catch {
    return null;
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

let cached: boolean | null = null;

/**
 * Resolution: query > localStorage > env > default (OFF, fail-closed). Any
 * read error along the chain resolves to OFF rather than throwing, so a
 * hostile/locked-down `window` never accidentally turns the screen ON.
 */
export function isAuditsFindingsAndReportViewEnabled(): boolean {
  if (cached !== null) return cached;
  let resolved: boolean;
  try {
    const fromQuery = readQueryOverride();
    const fromLs = fromQuery === null ? readLocalStorage() : null;
    const fromEnv = readEnvFlag();
    resolved = fromQuery ?? fromLs ?? fromEnv ?? false;
  } catch {
    resolved = false;
  }
  cached = resolved;
  return cached;
}

export const resetAuditsFindingsAndReportViewFlagCache = (): void => {
  cached = null;
};

export const AUDITS_FINDINGS_AND_REPORT_VIEW_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
