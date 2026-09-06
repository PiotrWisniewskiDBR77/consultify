/**
 * Liczniki statusów dla chipów Menu 3 w Materiałach.
 *
 * ODBIÓR NA ŻYWO 05.09 (pakiet 10 · Materiały): zakładka „Dokumenty" pokazywała
 * „Wszystkie 79" obok „Szkic 0 / Gotowy 0 / Wyeksportowany 0 /
 * Zarchiwizowany 0", mimo że KAŻDY widoczny wiersz miał status „Szkic".
 *
 * Przyczyna: liczenie szło twardo po polu `status`, a wiersze tej zakładki to
 * `UnifiedOutputRow`, który pola `status` NIE MA — status trzyma w `statusKey`
 * (`types.ts`: „Normalized for command-row chips"). `it.status` było zawsze
 * `undefined`, więc każdy chip wychodził 0. Filtrowanie w tabeli działało, bo
 * `OutputsAggregateTabContent` filtruje po `item.statusKey`: LICZNIK I FILTR
 * CZYTAŁY DWA RÓŻNE POLA tego samego wiersza.
 *
 * Szablony i prezentacje mają realne pole `status`, więc pole źródłowe jest
 * wybierane jawnie, zamiast zgadywane jedno dla wszystkich.
 */
/**
 * DEC-423b/c (06.09.2026): dropdown Status i chipy Menu 3 stoją nad KAŻDĄ
 * zakładką Materiałów, więc lista zakresów objęła też Wszystkie i Arkusze —
 * oba to `UnifiedOutputRow`, czyli status w `statusKey` (tak jak Dokumenty).
 */
export type MaterialsStatusCountScope =
  | 'outputs_all'
  | 'outputs_documents'
  | 'outputs_sheets'
  | 'templates'
  | 'presentations';

const STATUS_KEY_SCOPES: ReadonlySet<MaterialsStatusCountScope> = new Set([
  'outputs_all',
  'outputs_documents',
  'outputs_sheets',
]);

/** Które pole niesie status w danym zbiorze wierszy. */
export function statusFieldForScope(scope: MaterialsStatusCountScope): 'statusKey' | 'status' {
  return STATUS_KEY_SCOPES.has(scope) ? 'statusKey' : 'status';
}

export function countRowsByStatus(
  items: ReadonlyArray<Record<string, unknown>> | null | undefined,
  scope: MaterialsStatusCountScope
): Record<string, number> {
  const field = statusFieldForScope(scope);
  return (items || []).reduce<Record<string, number>>((acc, item) => {
    const value = String(item?.[field] ?? '')
      .trim()
      .toLowerCase();
    if (!value) return acc;
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}
