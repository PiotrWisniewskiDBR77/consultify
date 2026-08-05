/**
 * M03R-002 — flagi logiczne trzymane jako TEKST.
 *
 * `interview_library_templates.is_default` jest kolumną `text`, a nie boolean,
 * i niesie TRZY kodowania naraz (demo, 2026-08-04): `'0'` ×41, `'false'` ×7,
 * `'true'` ×2. Kod porównywał ją do liczby (`is_default = 1`), co Postgres
 * odrzuca komunikatem `operator does not exist: text = integer` — i cała
 * transakcja publikacji szablonu kończyła się błędem 500.
 *
 * Defekt był niewidoczny, bo odpala się tylko przy publikacji szablonu
 * oznaczonego jako domyślny; publikacja zwykłego szablonu przechodzi.
 *
 * Docelowo kolumna powinna być boolean (osobna migracja, poza tym zakresem).
 * Do tego czasu porównania idą przez ten predykat.
 */

/** Zapis kanoniczny dla flagi tekstowej. */
export const LEGACY_FLAG_TRUE = 'true';
export const LEGACY_FLAG_FALSE = 'false';

/**
 * Fragment SQL: czy tekstowa flaga jest prawdziwa. Obejmuje wszystkie
 * kodowania zastane w danych plus warianty, które inne moduły zapisują.
 */
export function isTruthyFlagSql(column: string): string {
  return `lower(coalesce(${column}::text, '')) IN ('1', 'true', 't', 'yes')`;
}

/** Odpowiednik po stronie JS — dla wartości odczytanych z bazy. */
export function isTruthyFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 't', 'yes'].includes(String(value ?? '').trim().toLowerCase());
}
