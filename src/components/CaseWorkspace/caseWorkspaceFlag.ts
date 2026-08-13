/**
 * Zlecenia (Case Workspace) — flaga runtime, DOMYŚLNIE WYŁĄCZONA.
 *
 * Wzorzec 1:1 z `src/utils/drdReportFlag.ts` (jedyny w tym repo wzorzec,
 * który daje zrzut ekranu bez deploya i bez logowania właściciela — CLAUDE.md
 * reguła #7). Kolejność rozstrzygania:
 *
 *   1. `?ff_zlecenia=1` / `=0` w adresie  → zapisuje się do localStorage,
 *   2. `localStorage['ff.caseWorkspace']`,
 *   3. `import.meta.env.VITE_ENABLE_CASE_WORKSPACE === 'true'`,
 *   4. WYŁĄCZONE.
 *
 * CLAUDE.md reguła #9 (zakaz masowego włączania): moduł wchodzi na demo
 * WYŁĄCZNIE po akceptacji właściciela na czystym zrzucie, jeden ekran po
 * drugim. Do tego czasu trasa `/zlecenia` NIE JEST NAWET REJESTROWANA —
 * `src/App.tsx` czyta tę funkcję raz, przy starcie modułu, i przy `false`
 * w ogóle nie dodaje `<Route>` (identycznie jak `isStyleGuideEnabled`).
 */

export const CASE_WORKSPACE_QUERY_FLAG = 'ff_zlecenia';
export const CASE_WORKSPACE_STORAGE_KEY = 'ff.caseWorkspace';

function readQueryOverride(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = new URLSearchParams(window.location.search).get(CASE_WORKSPACE_QUERY_FLAG);
    if (raw === null) return null;
    return raw === '1' || raw.toLowerCase() === 'true';
  } catch {
    return null;
  }
}

function readStored(): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CASE_WORKSPACE_STORAGE_KEY);
    if (raw === null) return null;
    return raw === '1' || raw.toLowerCase() === 'true';
  } catch {
    return null;
  }
}

function persist(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CASE_WORKSPACE_STORAGE_KEY, value ? '1' : '0');
  } catch {
    /* prywatny tryb przeglądarki — flaga zostaje tylko na czas sesji */
  }
}

function readEnv(): boolean {
  try {
    return import.meta.env?.VITE_ENABLE_CASE_WORKSPACE === 'true';
  } catch {
    return false;
  }
}

export function isCaseWorkspaceEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) {
    persist(fromQuery);
    return fromQuery;
  }
  const fromStorage = readStored();
  if (fromStorage !== null) return fromStorage;
  return readEnv();
}
