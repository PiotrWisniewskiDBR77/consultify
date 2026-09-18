/**
 * Feature flag — `ff_auditPackageViewer` (OP-2, Wpis 99, wiersz planu 65 / U-27).
 *
 * Gates the audit-pack OBJECT screen (`AuditPackObjectPage`, SPEC-A archetype C
 * Rekord) and the list→object entry that opens it:
 *   · route `/audit-programs/packs/:packId` — OFF redirects to the Library tab,
 *     exactly as before the route existed;
 *   · `AuditLibraryTab` row click / kebab "Open" — OFF keeps today's read-only
 *     right panel (`JedenPrawyPanel` + `StandardPreview`, DEC-397) unchanged.
 *
 * Fail-closed contract (CLAUDE.md #7 — "Piotr nigdy nie jest pierwszym testerem
 * wizualnym"): default OFF until the owner accepts it on screenshots. Any read
 * error along the chain also resolves to OFF, so a hostile/locked-down `window`
 * never reveals the screen through an error path.
 *
 * Resolution order (highest wins), identical to
 * `auditsFindingsAndReportViewFlag.ts`:
 *   1. URL query `?ff_auditPackageViewer=0|1` — instant per-session bypass
 *      (dev-render harness / regression checks).
 *   2. `localStorage["ff.audit_package_viewer"]` — user/org override.
 *   3. `import.meta.env.VITE_AUDIT_PACKAGE_VIEWER` — build-time override.
 *   4. Default: OFF.
 *
 * The result is cached at module scope — call
 * `resetAuditPackageViewerFlagCache` between reads in tests.
 */

const LS_KEY = 'ff.audit_package_viewer';
const QUERY_KEY = 'ff_auditPackageViewer';
const ENV_KEY = 'VITE_AUDIT_PACKAGE_VIEWER';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean | null {
  try {
    return parseFlag(
      (import.meta.env as unknown as Record<string, string | undefined>)?.[ENV_KEY]
    );
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

export function isAuditPackageViewerEnabled(): boolean {
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

export const resetAuditPackageViewerFlagCache = (): void => {
  cached = null;
};

export const AUDIT_PACKAGE_VIEWER_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
