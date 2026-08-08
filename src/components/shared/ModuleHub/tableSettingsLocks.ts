/**
 * tableSettingsLocks — kolumny, których Settings2 nigdy nie pozwala ukryć.
 *
 * ── R04-1 ───────────────────────────────────────────────────────────────────
 *
 * Kontrakt §5 (Settings2): „kolumna identyfikatora oraz Actions są Required/locked".
 *
 * Do R04-1 `required` przychodziło wyłącznie od wywołującego, więc każdy ekran
 * mógł pozwolić ukryć kolumnę identyfikującą albo kolumnę akcji — czyli
 * zostawić rejestr bez nazwy rekordu albo bez wejścia do kebaba. Blokada jest
 * teraz w komponencie i żaden ekran nie ma jak jej wyłączyć, choćby podał
 * `required: false`.
 *
 * Identyfikator rozpoznajemy po POZYCJI (§5: „pierwsza kolumna danych
 * identyfikuje rekord"), a kolumnę akcji po id.
 *
 * Osobny moduł, a nie eksport z pliku komponentu — nie-komponentowy eksport
 * psuje Fast Refresh (`react-refresh/only-export-components`). Ta sama zasada,
 * z której powstały `previewContract.ts` i `previewGeometry.ts` w R03.
 *
 * @module components/shared/ModuleHub/tableSettingsLocks
 */

/** Identyfikatory, pod którymi w repo występuje kolumna akcji wiersza. */
const ACTION_COLUMN_IDS = new Set(['actions', 'action', 'rowActions', 'kebab']);

/**
 * Czy kolumna jest zablokowana kanonicznie, niezależnie od tego, co podał ekran.
 *
 * @param columnId id kolumny
 * @param index pozycja w zadeklarowanej kolejności (0 = kolumna identyfikująca)
 */
export function isAlwaysLockedColumn(columnId: string, index: number): boolean {
  return index === 0 || ACTION_COLUMN_IDS.has(columnId);
}
