/**
 * Flaga widoku dokumentu raportu Oceny (`ff_assessmentReportView`).
 *
 * Włącza nowy, kontraktowy widok siedmiu rozdziałów. Piotr zaakceptował
 * ekran raportu Oceny (dzień 27, po FIX-ach, DEC-146/148) na zrzutach
 * 2026-08-27 — domyślnie ON od tej daty. `localStorage`/query "off" (i inne
 * fałszywe zapisy) nadal wyłączają go per-sesję. Kolejność rozstrzygania:
 * query > localStorage > env > ON. Każdy z trzech odczytów (`readQueryOverride`,
 * `readLocalStorage`, `readEnvFlag`) połyka własne błędy i zwraca `null`,
 * więc pojedynczy zepsuty odczyt po prostu spada w łańcuchu do kolejnego
 * źródła (docelowo do domyślnego ON); zewnętrzny `catch` w
 * `isAssessmentReportViewEnabled` zostaje nietknięty i nadal ustawia OFF,
 * gdyby coś rzuciło poza tymi trzema funkcjami.
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

export function isAssessmentReportViewEnabled(): boolean {
  if (cached !== null) return cached;
  try {
    const fromQuery = readQueryOverride();
    const fromLs = fromQuery === null ? readLocalStorage() : null;
    const fromEnv = readEnvFlag();
    // Default ON since 2026-08-27 owner accept (DEC-146/148) — only the
    // bottom of the query > localStorage > env > default chain changed; the
    // catch below still fails closed on any read error.
    const resolved = fromQuery ?? fromLs ?? fromEnv ?? true;
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
