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
    // WYJĄTEK ŚWIADOMY (STOP J-DOG-C 2026-09-09, zostawione i zgłoszone —
    // patrz evidence/jezyk-jdog-c/README.md): obie linie w
    // DBR77ReportTemplate.tsx niosą klasę `text-primary-*` (crimson, dług
    // zastany — `scripts/check-triada.baseline.txt`). Dotknięcie tej linii
    // (nawet samego tekstu) bramka TRIADA czyta jako NOWE naruszenie —
    // zmiana koloru byłaby zmianą wizualną zamrożonego modułu bez akceptu
    // właściciela. Do rozstrzygnięcia razem z resztą długu `primary-*`
    // w tym pliku, nie w paczce językowej.
    const DOZWOLONE = new Set([
      'reports/templates/DBR77ReportTemplate.tsx: „AUTOMATYZUJ"',
      'reports/templates/DBR77ReportTemplate.tsx: „Stanowisk"',
    ]);
    const trafienia = znajdzPolskiJsx(zrodla).filter((t) => !DOZWOLONE.has(t));
    expect(trafienia).toEqual([]);
  });
});
