// Testy funkcji klasyfikującej bramki językowej J0
// (docs/program/JEZYK_EN_PL_20260908/J0_BRAMKA.md, PLAN.md §J0 pkt 4).
//
// Importuje `scripts/i18n/pomiar-jezyka.mjs` bezpośrednio — moduł jest
// bezpieczny do importu dzięki strażnicy `process.argv[1] === ...` na końcu
// pliku (main() odpala się TYLKO przy `node pomiar-jezyka.mjs`, nigdy przy
// `import`), więc import tutaj NIE uruchamia pełnego skanu repo.
//
// 5 przypadków wymaganych przez zlecenie:
//   1. diakrytyki                    -> wykrywa polski
//   2. polskie słowo bez diakrytyków -> wykrywa polski (po słowniku)
//   3. nazwa własna z wyjątków       -> NIE wykrywa (ani polski, ani angielski)
//   4. klucz i18n / kod błędu w stylu SCREAMING_SNAKE_CASE -> NIE ocenia
//      (pomijaneWartosci: `^[A-Z0-9_.:-]+$` — to już kod, nie zdanie; ta sama
//      reguła, którą skanujSerwer() stosuje do odróżnienia kodu błędu od
//      zdania w K5, patrz POMIAR.md przykład `errors.INITIATIVE_LOCKED`)
//   5. URL                            -> NIE ocenia (pomijana wartość)
import { describe, it, expect } from 'vitest';
import { wykryjPolski, wykryjAngielski, wartoOceniac } from '../pomiar-jezyka.mjs';

describe('pomiar-jezyka: wykryjPolski / wykryjAngielski (klasyfikacja bramki J0)', () => {
  it('1. diakrytyki — polskie zdanie z ogonkami jest wykrywane jako PL', () => {
    const wynik = wykryjPolski('Zapisano zmiany pomyślnie, proszę czekać');
    expect(wynik).not.toBeNull();
    expect(wynik.jezyk).toBe('pl');
    expect(wynik.dowod.some((d) => d.startsWith('diakrytyk:'))).toBe(true);
  });

  it('2. polskie słowo BEZ diakrytyków (silny słownik) — nadal wykrywane jako PL', () => {
    // "brak" i "wszystkie" siedzą w polskieSilne (pomiar-jezyka.wyjatki.json) —
    // zero polskich znaków diakrytycznych, a mimo to trafienie.
    const wynik = wykryjPolski('brak wszystkie');
    expect(wynik).not.toBeNull();
    expect(wynik.jezyk).toBe('pl');
    expect(wynik.dowod.some((d) => d.startsWith('pl:'))).toBe(true);
    expect(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test('brak wszystkie')).toBe(false);
  });

  it('3. nazwa własna z listy wyjątków (Consultify) — NIE jest flagowana ani jako PL, ani jako EN', () => {
    expect(wykryjPolski('Consultify')).toBeNull();
    expect(wykryjAngielski('Consultify')).toBeNull();
    // Nazwa własna w środku dłuższego, neutralnego frazowania (bez słów ze
    // słownika) też nie ma prawa się złapać.
    expect(wykryjPolski('Teresa DBR77')).toBeNull();
  });

  it('4. kod błędu SCREAMING_SNAKE_CASE (klucz i18n / errorCode) — nie jest oceniany jako tekst językowy', () => {
    expect(wartoOceniac('INITIATIVE_LOCKED')).toBe(false);
    expect(wykryjPolski('INITIATIVE_LOCKED')).toBeNull();
    expect(wykryjAngielski('INITIATIVE_LOCKED')).toBeNull();
  });

  it('5. URL — pomijana wartość (pomijaneWartosci: ^https?://), nie jest oceniana', () => {
    expect(wartoOceniac('https://consultify.ai/organization/settings')).toBe(false);
    expect(wykryjPolski('https://consultify.ai/organization/settings')).toBeNull();
    expect(wykryjAngielski('https://consultify.ai/organization/settings')).toBeNull();
  });
});
