/**
 * ODMIANA LICZEBNIKA dla narzędzi w `scripts/dev/` (Node ESM).
 *
 * DLACZEGO KOPIA, A NIE IMPORT: źródłem prawdy jest `src/utils/liczebnik.ts`,
 * ale to TypeScript kompilowany przez Vite — Node nie zaimportuje go wprost,
 * a stawianie transpilera dla jednej czystej funkcji byłoby gorszym lekarstwem
 * niż choroba. Reguła jest przepisana ZNAK W ZNAK.
 *
 * BEZPIECZNIK PRZED ROZJAZDEM (bo „uważność" zawodzi zawsze):
 * `scripts/dev/lib/sprawdz-liczebnik.mjs` wyciąga przypadki testowe WPROST
 * z `tests/unit/utils/liczebnik.test.ts` i przepuszcza je przez TĘ funkcję.
 * Gdy ktoś zmieni regułę w produkcie i poprawi jej test, ten sprawdzian pęknie
 * — czyli kopia nie może po cichu zostać w tyle.
 *
 * Powód powstania (2026-09-02): karta modułu Spotkań mówiła „2 ekranów do
 * odbioru" — błędna odmiana na karcie, którą właściciel czyta jako pierwszą,
 * w dniu, w którym naprawiamy odmianę liczebników w produkcie.
 */
export function liczebnik(n, formy) {
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

/** `21 ekranów` — liczba i odmieniony rzeczownik razem, bo tak się tego używa. */
export const ile = (n, formy) => `${n} ${liczebnik(n, formy)}`;

/* Formy używane na kartach modułowych — w jednym miejscu, żeby nie odmieniać
   tego samego słowa dwa razy różnie na dwóch blokach tej samej karty. */
export const FORMY = {
  ekran: ['ekran', 'ekrany', 'ekranów'],
  ekranie: ['ekranie', 'ekranach', 'ekranach'],
  decyzja: ['decyzją', 'decyzjami', 'decyzjami'],
  uwaga: ['uwaga', 'uwagi', 'uwag'],
  pozycja: ['pozycja', 'pozycje', 'pozycji'],
};
