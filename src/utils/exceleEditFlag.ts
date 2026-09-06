/**
 * Excel — flaga edytowalnej siatki (2026-07-28, "najmniejszy arkusz, który
 * jest naprawdę arkuszem").
 *
 * Dziś w przeglądarce nie da się zmienić ANI JEDNEJ komórki wygenerowanego
 * skoroszytu — `KimiWorkspaceShell`'s xlsx-grid to zwykła, tylko-do-odczytu
 * `<table>` (patrz `src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx`).
 * Ta flaga odsłania `EditableSpreadsheetGrid` w jej miejsce: klik → edycja →
 * Enter/Tab/Escape, przeliczanie formuł zależnych (`workbookFormulaEngine.ts`)
 * i zapis komórki na serwer (`PATCH /api/workbook/:id/cell`).
 *
 * Wzorowana 1:1 na `src/utils/exceleFlag.ts` (ta sama kolejność źródeł, ta sama
 * semantyka kill-switcha).
 *
 * ZMIANA DOMYŚLNEJ (2026-07-28, zlecenie Piotra — "jeden Excel na każdej
 * ścieżce, bez flag w adresie"): oba widoki arkusza (parametric-templates i
 * KimiWorkspaceShell reopen) zostały zweryfikowane wzrokiem na produkcji —
 * edycja działa, przeliczanie formuł działa, zapis działa. Odstępstwo od
 * reguły #7 ("nic domyślnie bez akceptu") jest ŚWIADOME i zlecone wprost:
 * właściciel przestaje musieć sklejać `?ff_excele_edit=1` ręcznie. Kill-switch
 * `?ff_excele_edit=0` / `localStorage["ff.excele.edit"]=false` działa dalej
 * bez zmian.
 *
 * Kolejność (wygrywa najwyższe):
 *   1. URL query `?ff_excele_edit=0|1` — bypass operatora / dev / dev-render.
 *   2. `localStorage["ff.excele.edit"]` — override user / org.
 *   3. `import.meta.env.VITE_EXCELE_EDIT_ENABLED` — build-time.
 *   4. Default: ON (2026-07-28) — env jawnie nieustawione = ON.
 */

const LS_KEY = 'ff.excele.edit';
const QUERY_KEY = 'ff_excele_edit';
const ENV_KEY = 'VITE_EXCELE_EDIT_ENABLED';

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
    // Default ON (2026-07-28) — env jawnie nieustawione = ON, patrz nagłówek pliku.
    return parsed === null ? true : parsed;
  } catch {
    return true;
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

export function isExceleEditEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const EXCELE_EDIT_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
