/**
 * Sklejenie WARTOŚCI z JEDNOSTKĄ MIARY — separator zależny od jednostki (2026-09-02).
 *
 * SKĄD TO SIĘ WZIĘŁO. Zakładka Rollout pokazywała w tabeli „Śledzenie KPI"
 * literalne `8dni`, `12dni`, `6dni`, bo prezenter sklejał `${value}${unit}` bez
 * żadnego separatora. Defekt przeżył wszystkie wcześniejsze przeglądy tego ekranu
 * z jednego powodu:
 *
 *   ★ WIDAĆ GO WYŁĄCZNIE PRZY JEDNEJ WARTOŚCI DANYCH. Pozostałe wskaźniki na tym
 *     samym ekranie mają `unit: '%'`, a `74%` jest POPRAWNE — procent spacji nie
 *     potrzebuje. Jedna wartość jednostki maskowała defekt wszystkich pozostałych.
 *     Grep też go nie znajdował: ciąg „8dni" nie istnieje w kodzie, powstaje
 *     dopiero przy renderowaniu.
 *
 * REGUŁA. Jednostka zaczynająca się od LITERY jest osobnym wyrazem i dostaje
 * spację (`8 dni`, `120 zł`, `4 h`, `12 szt.`). Jednostka będąca SYMBOLEM przykleja
 * się do liczby (`74%`, `20°`, `3×`, `5‰`) — tak każe typografia i tak wygląda
 * poprawny stan zastany, którego nie wolno zepsuć „naprawą".
 *
 * ODPORNOŚĆ NA DRUGĄ KONWENCJĘ. W repozytorium żyją równolegle DWA sposoby:
 * jedne wołacze wpisują spację do samej WARTOŚCI jednostki (`unit=" MB"`,
 * `` unit={` ${usage.storage.unit}`} `` — Ustawienia/Płatności, TrendIndicator),
 * inne nie wpisują jej nigdzie (Rollout, LiveDashboard). Dlatego funkcja najpierw
 * PRZYCINA jednostkę i sama decyduje o separatorze — podana z wiodącą spacją nie
 * da podwójnej. Dzięki temu można ją bezpiecznie podłączyć także tam, gdzie dziś
 * spacja siedzi w danych.
 *
 * CZEGO ŚWIADOMIE NIE ROBI: nie odmienia. „1 dzień" wymaga odmiany rzeczownika,
 * a jednostka przychodzi z danych jako GOTOWY NAPIS — odmiana wymaga zmiany
 * kontraktu wskaźnika (trzy formy zamiast jednego pola `unit`), nie separatora.
 * Powód i droga wyjścia: `docs/program/grafika/ODLOZONE.md`.
 */

/** Symbole, które przyklejają się do liczby bez spacji. */
const SYMBOL_BEZ_SPACJI = /^[%‰°×✕xX°'"″′°′″]/;

export function zJednostka(
  wartosc: string | number | null | undefined,
  jednostka: string | null | undefined,
  pusteGdyBrakWartosci = '—'
): string {
  if (wartosc === null || wartosc === undefined || wartosc === '') return pusteGdyBrakWartosci;
  const w = String(wartosc);
  const j = String(jednostka ?? '').trim();
  if (!j) return w;
  // Symbol przykleja się; wyraz (litera, także polska) dostaje spację.
  // `\p{L}` zamiast `[a-z]`, żeby „ł" w „łóżek" albo „µ" w „µm" liczyły się jak litera.
  if (SYMBOL_BEZ_SPACJI.test(j)) return `${w}${j}`;
  return /^\p{L}/u.test(j) ? `${w} ${j}` : `${w}${j}`;
}
