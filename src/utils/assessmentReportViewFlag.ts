/**
 * Flaga widoku dokumentu raportu Oceny (`ff_assessmentReportView`).
 *
 * Włącza nowy, kontraktowy widok siedmiu rozdziałów. Domyślnie pozostaje
 * wyłączona (fail-closed) do czasu akceptacji zrzutów przez właściciela.
 * Kolejność rozstrzygania: query > localStorage > env > OFF.
 */

const LS_KEY = 'ff.assessment_report_view';
const QUERY_KEY = 'ff_assessmentReportView';
const ENV_KEY = 'VITE_ASSESSMENT_REPORT_VIEW';

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

export function isAssessmentReportViewEnabled(): boolean {
  if (cached !== null) return cached;
  try {
    const fromQuery = readQueryOverride();
    const fromLs = fromQuery === null ? readLocalStorage() : null;
    const fromEnv = readEnvFlag();
    const resolved = fromQuery ?? fromLs ?? fromEnv ?? false;
    cached = resolved;
    return resolved;
  } catch {
    cached = false;
    return false;
  }
}

export function resetAssessmentReportViewFlagCache(): void {
  cached = null;
}

export const ASSESSMENT_REPORT_VIEW_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
