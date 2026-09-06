/**
 * Word template manual structure editor reveal flag (robota C1, 2026-07-22).
 *
 * Kreator AI-draft w Architekcie szablonów Word
 * (`DocumentStudioTemplateArchitectView`) generuje dziś szkic sekcji, ale
 * blueprint pierwotnie było READ-ONLY — użytkownik (autor szablonu) nie mógł
 * dodać, usunąć, przenieść ani przemianować sekcji przed akceptem. Ta flaga
 * odsłania RĘCZNY EDYTOR STRUKTURY na szkicu:
 *   OFF → widok bajt-identyczny ze stanem sprzed flagi (blueprint tylko do
 *         odczytu).
 *   ON (default) → dyskretne kontrolki edycji (dodaj/usuń/góra/dół/zmień
 *         nazwę).
 *
 * Kolejność (wygrywa najwyższe):
 *   1. URL query `?ff_tpl_editor=0|1` — bypass operatora / dev / dev-render.
 *   2. `localStorage["ff.tpl_editor"]` — override user / org.
 *   3. `import.meta.env.VITE_TPL_EDITOR_ENABLED` — build-time.
 *   4. Default: ON (flip 79a75de14e, akcept Piotra 2026-07-22 po live-verify;
 *      UWAGA: decyzja architekta D6 z 2026-07-24 postuluje OFF — konflikt do
 *      rozstrzygnięcia przez Piotra, nie zmieniaj defaultu bez jego słowa).
 */

const LS_KEY = 'ff.tpl_editor';
const QUERY_KEY = 'ff_tpl_editor';
const ENV_KEY = 'VITE_TPL_EDITOR_ENABLED';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  try {
    const parsed = parseFlag(
      (import.meta.env as unknown as Record<string, string | undefined>)?.[ENV_KEY]
    );
    return parsed === null ? true : parsed;
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

export function isTemplateStructureEditorEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const TEMPLATE_EDITOR_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
