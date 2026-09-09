/**
 * BEZPIECZNIK JĘZYKOWY MODUŁU 05 ASSESSMENT (paczka J-DOG-C, DEC-453, 2026-09-09).
 *
 * DLACZEGO ISTNIEJE: paczki J4/J15/J16 zmierzyły, że polski BEZ diakrytyków
 * przechodzi niewidoczny przez `pomiar-jezyka.mjs` (rozpoznaje polski głównie
 * po ogonkach + krótkiej liście `polskieSilne/Slabe`). `src/i18n.ts` ustawia
 * `fallbackLng: { en: ['en'] }`, więc konto angielskie NIGDY nie spada na plik
 * `pl` — spada na `defaultValue` z KODU. Detektor:
 * `tests/unit/i18n/polskiBezOgonkowWspolny.ts` (ten sam algorytm co przyrząd
 * pomocniczy `scripts/i18n/polski-bez-ogonkow.mjs`), łapie m.in. „Kolor",
 * „Priorytet", „Macierz osi", „Aktor" — bez ani jednego ogonka.
 *
 * ZASIĘG: `src/components/assessment/**`, `src/components/MaturityMatrix/**`.
 *
 * MUTACJA (dowód, że test działa): podmień dowolny angielski defaultValue
 * przekazywany do `t` w zasięgu na dowolne polskie słowo -> RED w pierwszym
 * `it`; dopisz widoczny polski napis wprost w JSX poza `t` -> RED w drugim
 * `it`. Cofnięcie obu -> GREEN.
 */
import { describe, expect, it } from 'vitest';

import { znajdzPolskiJsx, znajdzPolskieDefaultValue, zbierzPlikiZrodlowe } from '../../../../tests/unit/i18n/polskiBezOgonkowWspolny';

const KATALOGI = [
  __dirname + '/..',
  __dirname + '/../../MaturityMatrix',
];

describe('J-DOG-C — moduł Assessment mówi po angielsku w kodzie (bez ogonków też)', () => {
  it('nie ma polskiego defaultValue w t() (z ogonkami ani bez)', () => {
    const zrodla = zbierzPlikiZrodlowe(KATALOGI);
    expect(znajdzPolskieDefaultValue(zrodla)).toEqual([]);
  });

  it('nie ma polskich napisów poza t() w treści JSX i atrybutach', () => {
    const zrodla = zbierzPlikiZrodlowe(KATALOGI);
    // NAPRAWIONE (JEZYK-CRIMSON-3, DEC-453, 09.09): obie linie w
    // DBR77ReportTemplate.tsx („AUTOMATYZUJ" linia ~219, „Stanowisk" linia
    // ~392) przeniesione do `t()` — właściciel zgodził się na zmianę koloru
    // WYŁĄCZNIE tych dwóch linii (crimson → teal), żeby odblokować naprawę
    // językową. Reszta długu `primary-*` w tym pliku (kontener/ikona/wartość
    // liczbowa obu kafelków) zostaje ŚWIADOMIE crimson — poza zakresem tej
    // paczki, zgłoszone jako STOP w evidence/jezyk-crimson-3/README.md.
    const trafienia = znajdzPolskiJsx(zrodla);
    expect(trafienia).toEqual([]);
  });
});
