/**
 * Polska odmiana liczebnika głównego — trzy formy gramatyczne rzeczownika
 * (polski ma trzy, angielski dwie: singular/plural — dlatego kod pisany pod
 * wzorzec `${n} rzeczownik` daje poprawny wynik dla większości liczb i
 * błędny dla 1, np. „1 dni" zamiast „1 dzień").
 *
 * Reguła (CLDR pl, liczby całkowite nieujemne):
 *  - n === 1                                              → forma 1 (mianownik lp.)   np. „1 dzień"
 *  - n % 10 w 2..4  ORAZ  n % 100 poza 12..14 (wyjątek nastek) → forma 2 (2-4)         np. „2 dni", „22 dni"
 *  - pozostałe (0, 5-21, 25-31, ...)                      → forma 3 (5+ / genetiv)    np. „5 dni", „12 dni", „101 dni"
 *
 * Przykład: `liczebnik(n, ['dzień', 'dni', 'dni'])`, `liczebnik(n, ['test', 'testy', 'testów'])`.
 *
 * Nieujemne liczby całkowite. Wartości niecałkowite (np. średnie, uśrednione
 * dni) dostają formę 3 (genetiv) — to bezpieczny domyślny wybór dla ułamków.
 */
export function liczebnik(n: number, formy: readonly [string, string, string]): string {
  const [jeden, kilka, wiele] = formy;
  if (!Number.isFinite(n)) return wiele;
  if (n === 1) return jeden;
  if (!Number.isInteger(n)) return wiele;
  const abs = Math.abs(n);
  const ostatniaCyfra = abs % 10;
  const dwieOstatnieCyfry = abs % 100;
  const nastka = dwieOstatnieCyfry >= 12 && dwieOstatnieCyfry <= 14;
  if (ostatniaCyfra >= 2 && ostatniaCyfra <= 4 && !nastka) return kilka;
  return wiele;
}
