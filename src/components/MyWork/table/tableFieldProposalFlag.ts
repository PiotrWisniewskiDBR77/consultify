/**
 * P1-6 — Flaga podglądu propozycji dla autofill/odświeżania w Tabeli (domyślnie OFF).
 *
 * Kontekst (rozdz. 09 §4 standardu idea-workspace): akcje `tbl_autofill_from_artifact`
 * i `tbl_refresh_artifact_data` dziś NADPISUJĄ pola wierszy natychmiast po odpowiedzi AI
 * (`useTableQuickActions.ts` — `nodesUndo.push(...)` wołane PO zapisie, bez podglądu).
 * To ta sama klasa defektu co destrukcyjny import (P0-2), tylko w Tabeli.
 *
 * ON: zmiana z AI/automatu ląduje najpierw jako PROPOZYCJA — overlay z różnicą
 *     (co było → co będzie) i przyciskami „Zastosuj / Odrzuć". Migawka (undo) zdejmowana
 *     dopiero PRZED zastosowaniem zaakceptowanych wierszy.
 * OFF (domyślnie): zachowanie jak dziś (auto-apply), żeby NIC nie zmieniło się wizualnie,
 *     dopóki właściciel nie zaakceptuje na zrzutach — reguła #7 CLAUDE.md (Piotr nie może być
 *     pierwszym testerem wizualnym). Po akcepcie: flip default na ON + re-tag punktu.
 *
 * Kolejność rozstrzygania (wygrywa pierwsza): URL query → localStorage → domyślnie false.
 * Ten sam kształt co `evidencePanelFlag.ts` / `mindmapExportFlags.ts` (jeden system).
 */

const QUERY_KEY = 'ff_tableFieldProposal';
const LOCAL_STORAGE_KEY = 'ff.tableFieldProposal';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const v = String(raw).trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false;
  return null;
}

function readQueryOverride(): boolean | null {
  if (typeof window === 'undefined' || !window.location?.search) return null;
  try {
    return parseFlag(new URLSearchParams(window.location.search).get(QUERY_KEY));
  } catch {
    return null;
  }
}

function readLocalStorage(): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return parseFlag(window.localStorage.getItem(LOCAL_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * True gdy autofill/odświeżanie mają iść przez podgląd propozycji (domyślnie OFF).
 * Do flipu na ON DOPIERO po akcepcie właściciela na zrzutach (reguła #7).
 */
export function isTableFieldProposalEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return false; // domyślnie OFF — do akceptu Piotra na zrzutach
}

export const TABLE_FIELD_PROPOSAL_FLAG_KEYS = {
  query: QUERY_KEY,
  localStorage: LOCAL_STORAGE_KEY,
};
