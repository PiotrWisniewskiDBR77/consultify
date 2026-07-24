/**
 * P2-4 (Z2) — Flaga warstwy wizualnej prawego panelu Idei (domyślnie OFF).
 *
 * Kontekst (docs/standards/idea-workspace/07_PRAWY_PANEL.md §3 „Wygląd (Z2)"):
 * dzisiejszy panel (`IdeaWorkspaceTools.tsx`) to płaski akordeon — sekcje pełnej
 * szerokości rozdzielone włoskową kreską (`border-b`), z mieszaną typografią i bez
 * hierarchii kart. Właściciel: „prawy panel nie może wyglądać wsiowo… zaproponuj im
 * nowe elementy graficzne". Cel: podnieść WARSTWĘ WIZUALNĄ (karty, odstępy, typografia,
 * spójna ikonografia) do zaakceptowanego prototypu — BEZ zmiany funkcji.
 *
 * ON: sekcje jako WYNIESIONE KARTY (`c-surface-raised` + `c-border-subtle`, zaokr. 11 px)
 *     na tle panelu; nagłówki sekcji wersalikami 10,5 px / waga 750 w `c-text-muted`;
 *     spójny odstęp 12 px między kartami; karty nie kurczą się przy przewijaniu.
 *     Wszystko na tokenach `c-*` (dark+light). Zero crimsona w CTA/stanach aktywnych.
 * OFF (domyślnie): dzisiejszy wygląd 1:1 (płaski akordeon), żeby NIC nie zmieniło się
 *     wizualnie, dopóki właściciel nie zaakceptuje na zrzutach — reguła #7 CLAUDE.md
 *     (Piotr nie może być pierwszym testerem wizualnym). Po akcepcie: flip default na ON
 *     + re-tag punktu.
 *
 * Kolejność rozstrzygania (wygrywa pierwsza): URL query → localStorage → domyślnie false.
 * Ten sam kształt co `table/tableFieldProposalFlag.ts` (jeden system flag lokalnych),
 * więc nadzorca robi render-verify na wolnym porcie przez `?ff_ideaPanelVisual=1`.
 */

const QUERY_KEY = 'ff_ideaPanelVisual';
const LOCAL_STORAGE_KEY = 'ff.ideaPanelVisual';

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
 * True gdy prawy panel Idei ma renderować się w nowym języku wizualnym (kartowym).
 * Domyślnie OFF — do flipu na ON DOPIERO po akcepcie właściciela na zrzutach (reguła #7).
 */
export function isIdeaPanelVisualEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return false; // domyślnie OFF — do akceptu Piotra na zrzutach
}

export const IDEA_PANEL_VISUAL_FLAG_KEYS = {
  query: QUERY_KEY,
  localStorage: LOCAL_STORAGE_KEY,
};
