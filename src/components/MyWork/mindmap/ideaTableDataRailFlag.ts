/**
 * Flaga P2-5: Tabela dostaje DATA-rail, nie canvasowy.
 *
 * Standard rozdz. 06 §2: lewy rail Tabeli nie powinien zawierac pojec plotna
 * (tryb kursora / Reka / Polacz — Tabela nie ma plotna) ani pozycji nalezacych
 * do Menu 3 (Szablony, Import). Dzis Tabela dostaje wspolny rail canvasowy z
 * wyszarzonym „trybem kursora" (P1-1) i popoverami Szablony/Import — czytelne,
 * ale wg standardu nie ich miejsce.
 *
 * Zmiana WIZUALNA, wiec za flaga (reguła #7): OFF = dzisiejszy rail (wyszarzone
 * sloty), ON = czysty data-rail Tabeli. Domyslnie OFF do akceptu Piotra na
 * zrzutach. Kolejnosc: URL `?ff_tableDataRail=1` → localStorage → false.
 */
const QUERY_KEY = 'ff_tableDataRail';
const STORAGE_KEY = 'ff.tableDataRail';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const v = raw.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  return null;
}

export function isTableDataRailEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const fromQuery = parseFlag(new URLSearchParams(window.location.search).get(QUERY_KEY));
    if (fromQuery !== null) return fromQuery;
  } catch {
    /* ignore */
  }
  try {
    const fromStorage = parseFlag(window.localStorage.getItem(STORAGE_KEY));
    if (fromStorage !== null) return fromStorage;
  } catch {
    /* ignore */
  }
  // Wlaczone domyslnie 2026-07-24: Piotr testuje na demo, wiec praca ma byc
  // WIDOCZNA. Render-verify wykonany wczesniej (reguła #7 spelniona).
  return true;
}
