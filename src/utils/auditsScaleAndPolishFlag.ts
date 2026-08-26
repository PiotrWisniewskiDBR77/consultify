/**
 * Audits scale & polish reveal flag (2026-08-26, expert panel gap pack).
 *
 * Gates the batch of visual/UX fixes to the Audits module that came out of
 * the expert panel review (score 6.0/10): a full-screen `StandardTable`
 * criteria browser (drill-down from Processes, replacing the 208px
 * `max-h-52` mock preview list), the "Nowy audyt" primary CTA in
 * `AuditsMethodHub`'s `StandardModuleBar`, the overdue-session chip/
 * highlight in Processes, and the seven point-fixes inside
 * `CriterionWorkspaceV2`.
 *
 * OFF (default) → every touched screen renders byte-identical to before
 * this pack. ON → the new behaviors above are visible. Fail-closed: any
 * read error along the resolution chain resolves to OFF (mirrors
 * `src/utils/drdReportFlag.ts`), so a hostile/locked-down `window` never
 * accidentally reveals unreviewed UI.
 *
 * Per CLAUDE.md #7/#9: stays OFF until Piotr accepts clean screenshots —
 * do not flip the default without an explicit owner accept (mirror DEC-97
 * for `criterionWorkspaceV2Flag.ts`).
 *
 * Kolejność (wygrywa najwyższe):
 *   1. URL query `?ff_auditsScaleAndPolish=0|1` — bypass operatora / dev /
 *      dev-render / regression checks.
 *   2. `localStorage["ff.audits_scale_and_polish"]` — override user / org.
 *   3. `import.meta.env.VITE_AUDITS_SCALE_AND_POLISH` — build-time.
 *   4. Default: OFF.
 */

const LS_KEY = 'ff.audits_scale_and_polish';
const QUERY_KEY = 'ff_auditsScaleAndPolish';
const ENV_KEY = 'VITE_AUDITS_SCALE_AND_POLISH';

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

export function isAuditsScaleAndPolishEnabled(): boolean {
  try {
    const fromQuery = readQueryOverride();
    if (fromQuery !== null) return fromQuery;
    const fromLs = readLocalStorage();
    if (fromLs !== null) return fromLs;
    return readEnvFlag();
  } catch {
    return false;
  }
}

export const AUDITS_SCALE_AND_POLISH_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
