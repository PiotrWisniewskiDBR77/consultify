/**
 * 1.12-R1 — reguła dopasowania rekordów przebiegu „ACO”.
 *
 * DLACZEGO TEST, A NIE PRZEBIEG: lokalna baza stanowiska nie ma ani jednego
 * takiego rekordu (pomiar 06.09: `ie_aggregate_state` = 42 wiersze dla DBR77,
 * z tego 0 typu `intervention_case`/`management_signal`), więc `--dry-run`
 * wypisał „0 trafień”. Zero trafień na zbiorze bez trafień NIE JEST dowodem,
 * że reguła działa — dowodem jest ten plik.
 *
 * Ładunki poniżej są przepisane z `tests/e2e/initiatives-execution/
 * aco-definition-browser.spec.ts` (linie wskazane w planie B5), a nie
 * wymyślone pod test.
 */
import { describe, expect, it } from 'vitest';

import { OKNO_DAT, SYGNATURY_TEKSTOWE, dopasujAco } from '../../../server/scripts/usun-rekordy-aco.js';

describe('sygnatury ACO', () => {
  it('łapie „Apply independently approved…” w etykiecie opcji interwencji (spec:1367)', () => {
    const wynik = dopasujAco({
      interventionId: 'int-1',
      options: [
        { optionId: 'do-nothing', label: 'Do nothing' },
        { optionId: 'action-1', label: 'Apply independently approved Plan resequence' },
      ],
    });
    expect(wynik.trafienia).toHaveLength(1);
    expect(wynik.trafienia[0]).toContain('Apply independently approved');
  });

  it('łapie „ACO execution control” w nazwie migawki raportu (spec:1619)', () => {
    const wynik = dopasujAco({ name: 'ACO execution control', asOf: '2026-12-16' });
    expect(wynik.trafienia[0]).toContain('ACO execution control');
    expect(wynik.dataZPrzyszlosci).toBe(true);
  });

  it('łapie „Intervention Authority” jako etykietę roli (spec:1534)', () => {
    const wynik = dopasujAco({ authorityLabel: 'Intervention Authority', verifyBy: '2026-12-15' });
    expect(wynik.trafienia[0]).toContain('Intervention Authority');
    expect(wynik.dataZPrzyszlosci).toBe(true);
  });

  it('znajduje sygnaturę zagnieżdżoną głęboko, nie tylko w polu `title`', () => {
    const wynik = dopasujAco({
      detail: { plan: { steps: [{ note: 'Apply independently approved Plan resequence' }] } },
    });
    expect(wynik.trafienia).toHaveLength(1);
  });

  it('NIE rusza legalnego rekordu, nawet gdy ma termin w grudniu 2026', () => {
    // To jest sedno bezpiecznika: data z przyszłości SAMA nie kasuje niczego.
    const wynik = dopasujAco({
      title: 'Przegląd bezpieczeństwa hurtowni',
      verifyBy: '2026-12-16',
    });
    expect(wynik.trafienia).toHaveLength(0);
    expect(wynik.dataZPrzyszlosci).toBe(true);
  });

  it('NIE rusza rekordu, który tylko brzmi podobnie', () => {
    expect(dopasujAco({ title: 'Interwencja: zatwierdzenie planu' }).trafienia).toHaveLength(0);
    expect(dopasujAco({ title: 'Apply for approval' }).trafienia).toHaveLength(0);
    expect(dopasujAco({}).trafienia).toHaveLength(0);
    expect(dopasujAco(null).trafienia).toHaveLength(0);
  });

  it('okno dat pokrywa dokładnie 15–17 grudnia 2026 z przebiegu ACO', () => {
    expect(OKNO_DAT.test('2026-12-15')).toBe(true);
    expect(OKNO_DAT.test('2026-12-17')).toBe(true);
    expect(OKNO_DAT.test('2026-12-18')).toBe(false);
    expect(OKNO_DAT.test('2026-11-16')).toBe(false);
  });

  it('każda sygnatura wskazuje linię pliku e2e, z której pochodzi', () => {
    expect(SYGNATURY_TEKSTOWE).toHaveLength(3);
    for (const s of SYGNATURY_TEKSTOWE) {
      expect(s.skad).toContain('aco-definition-browser.spec.ts:');
    }
  });
});
