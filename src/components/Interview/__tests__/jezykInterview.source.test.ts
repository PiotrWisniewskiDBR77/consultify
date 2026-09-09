/**
 * BEZPIECZNIK JĘZYKOWY MODUŁU 03 INTERVIEW (paczka J-DOG-C, DEC-453, 2026-09-09).
 *
 * DLACZEGO ISTNIEJE: paczki J4/J15/J16 zmierzyły, że polski BEZ diakrytyków
 * („Strategiczne", „Sekcje", „Zapisz", „Anuluj") przechodzi niewidoczny przez
 * `pomiar-jezyka.mjs`, bo ten rozpoznaje polski głównie po ogonkach i krótkiej
 * liście `polskieSilne/Slabe`. `src/i18n.ts` ustawia `fallbackLng: { en: ['en'] }`,
 * więc konto angielskie NIGDY nie spada na plik `pl` — spada na `defaultValue`
 * z KODU. Polski default (z ogonkami lub bez) jest równoznaczny z polskim
 * ekranem dla Anglika. Detektor: `tests/unit/i18n/polskiBezOgonkowWspolny.ts`
 * (ten sam algorytm co przyrząd pomocniczy `scripts/i18n/polski-bez-ogonkow.mjs`).
 *
 * ZASIĘG: `src/components/Interview/**`, `src/components/Survey/**`.
 *
 * MUTACJA (dowód, że test działa): podmień dowolny angielski defaultValue
 * przekazywany do `t` w zasięgu na dowolne polskie słowo -> RED w pierwszym
 * `it`; dopisz widoczny polski napis wprost w JSX poza `t` -> RED w drugim
 * `it`. Cofnięcie obu -> GREEN.
 */
import { describe, expect, it } from 'vitest';

import { znajdzPolskiJsx, znajdzPolskieDefaultValue, zbierzPlikiZrodlowe } from '../../../../tests/unit/i18n/polskiBezOgonkowWspolny';

const KATALOGI = [
  __dirname + '/../../Interview',
  __dirname + '/../../Survey',
];

const WYLACZONE: Record<string, string> = {};

const ZRODLA = zbierzPlikiZrodlowe(KATALOGI, WYLACZONE);

describe('J-DOG-C — moduł Interview mówi po angielsku w kodzie (bez ogonków też)', () => {
  it('nie ma polskiego defaultValue w t() (z ogonkami ani bez)', () => {
    expect(znajdzPolskieDefaultValue(ZRODLA)).toEqual([]);
  });

  it('nie ma polskich napisów poza t() w treści JSX i atrybutach', () => {
    expect(znajdzPolskiJsx(ZRODLA)).toEqual([]);
  });
});
