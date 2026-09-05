/**
 * tableEmptyState — rozróżnienie DWÓCH uczciwych stanów pustki tabeli.
 *
 * POWÓD ISTNIENIA (pomiar na żywo 05.09, `idea-table-tool-empty-filter`):
 * tabela z SZEŚCIOMA wierszami, po wpisaniu w filtr ciągu bez trafień
 * („zzzzqqq"), pokazywała komunikat „Tabela jest jeszcze pusta / Zacznij od
 * struktury: wybierz framework, dodaj pierwszy wiersz lub użyj szablonu"
 * z przyciskami budowania struktury. To kłamstwo o stanie danych: rekordy
 * SĄ, schowała je zawężająca fraza. Użytkownik czyta „nic tu nie ma" i
 * zaczyna budować od zera to, co już zbudował.
 *
 * Dwa stany:
 *  - `no-records` — w tabeli naprawdę nie ma ani jednego wiersza; miejsce na
 *    zachętę do zbudowania struktury.
 *  - `no-filter-results` — wiersze są, ale żaden nie przechodzi przez filtr;
 *    jedyne sensowne wyjście to wyczyszczenie filtra.
 */

export type TableEmptyStateKind = 'none' | 'no-records' | 'no-filter-results';

export interface TableEmptyStateInput {
  /** Liczba wierszy PO filtrowaniu — to, co realnie trafia do <tbody>. */
  visibleRowCount: number;
  /** Liczba wierszy PRZED filtrowaniem (bez ramek/pomocniczych węzłów). */
  totalRowCount: number;
  /** Fraza z pola „Filtruj". */
  filterInput?: string | null;
  /** Reguły filtra per kolumna (FilterBuilder). */
  filterRuleCount?: number;
}

/**
 * Czy jakikolwiek filtr realnie zawęża widok.
 *
 * Sam FAKT, że pole filtra istnieje, nie wystarcza — pusta fraza i zerowa
 * lista reguł to brak filtra, nie „filtr bez trafień".
 */
export function hasActiveTableFilter(input: TableEmptyStateInput): boolean {
  const text = (input.filterInput ?? '').trim();
  return text.length > 0 || (input.filterRuleCount ?? 0) > 0;
}

export function resolveTableEmptyState(input: TableEmptyStateInput): TableEmptyStateKind {
  if (input.visibleRowCount > 0) return 'none';
  // Rekordy są, ale filtr je schował — nigdy nie wołaj tego „pustą tabelą".
  if (input.totalRowCount > 0 && hasActiveTableFilter(input)) return 'no-filter-results';
  return 'no-records';
}
