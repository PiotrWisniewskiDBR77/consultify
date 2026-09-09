/**
 * BEZPIECZNIK JĘZYKOWY MODUŁU 12 MEETING (paczka J-DOG-C, DEC-453, 2026-09-09).
 *
 * DLACZEGO ISTNIEJE: paczki J4/J15/J16 zmierzyły, że polski BEZ diakrytyków
 * przechodzi niewidoczny przez `pomiar-jezyka.mjs`. `src/i18n.ts` ustawia
 * `fallbackLng: { en: ['en'] }`, więc konto angielskie NIGDY nie spada na plik
 * `pl` — spada na `defaultValue` z KODU. Detektor:
 * `tests/unit/i18n/polskiBezOgonkowWspolny.ts` (ten sam algorytm co przyrząd
 * pomocniczy `scripts/i18n/polski-bez-ogonkow.mjs`).
 *
 * ZASIĘG: `src/components/Meeting/**`.
 *
 * MUTACJA (dowód, że test działa): podmień dowolny angielski defaultValue
 * przekazywany do `t` w zasięgu na dowolne polskie słowo -> RED w pierwszym
 * `it`; dopisz widoczny polski napis wprost w JSX poza `t` -> RED w drugim
 * `it`. Cofnięcie obu -> GREEN.
 */
import { describe, expect, it } from 'vitest';

import { znajdzPolskiJsx, znajdzPolskieDefaultValue, zbierzPlikiZrodlowe } from '../../../../tests/unit/i18n/polskiBezOgonkowWspolny';

const KATALOGI = [__dirname + '/..'];

describe('J-DOG-C — moduł Meeting mówi po angielsku w kodzie (bez ogonków też)', () => {
  it('nie ma polskiego defaultValue w t() (z ogonkami ani bez)', () => {
    const zrodla = zbierzPlikiZrodlowe(KATALOGI);
    expect(znajdzPolskieDefaultValue(zrodla)).toEqual([]);
  });

  it('nie ma polskich napisów poza t() w treści JSX i atrybutach', () => {
    const zrodla = zbierzPlikiZrodlowe(KATALOGI);
    expect(znajdzPolskiJsx(zrodla)).toEqual([]);
  });
});
