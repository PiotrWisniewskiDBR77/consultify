/**
 * [ODMROZENIE 04_ASSESSMENT DEC-510] FALA G1 / kryterium S1.3 —
 * TEKST KARTY DZIAŁANIA Z ODCHYLENIA KPI: język i niepuste `action_text`.
 *
 * ★ POMIAR, KTÓRY TEN PLIK PILNUJE (14.09.2026, żywa baza stagingu):
 * Northwind (organizacja ANGIELSKA) miała 30 otwartych kart
 * `source_kind='kpi_deviation'` i WSZYSTKIE 30 było po polsku
 * („Odchylenie: Inventory Turns 01.2026 — rezultat…"), a `action_text`
 * we wszystkich 30 było PUSTE. Kryterium S1.3 („rezultat poza limitem →
 * Skrzynka → karta działania → zadanie osoby") nie może być zamknięte kartą,
 * która jest w obcym języku i nie mówi, co zrobić.
 *
 * Test jest CZYSTY (zero bazy): `buildKpiDeviationCardText` dostaje liczby
 * i zwraca zdania. Ścieżka zapisu (`ensureActionCardForKpiDeviation`) ma
 * własny dowód na realnym PG w `kpiDeviationActionCard.pg.test.ts`.
 *
 * DOWÓD MUTACYJNY: przywrócenie zaszytego polskiego literału problemu albo
 * `actionText: ''` robi ten plik czerwonym w co najmniej czterech miejscach.
 */
import { describe, expect, it } from 'vitest';

import { buildKpiDeviationCardText } from '../kpiDeviationActionCard.js';

const POLSKIE_DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/u;

const bazowe = {
  kpiName: 'Inventory Turns',
  period: '01.2026',
  unit: null as string | null,
  actualValue: 4.2,
  targetValue: 6,
};

describe('G1 / S1.3 — karta odchylenia KPI w organizacji ANGIELSKIEJ', () => {
  it('opis problemu jest po angielsku i nie ma ani jednego polskiego ogonka', () => {
    const { problem } = buildKpiDeviationCardText({ ...bazowe, locale: 'en' });
    expect(problem).toBe('Deviation: Inventory Turns 01.2026 — result 4.2 is outside the limit (target 6).');
    expect(problem).not.toMatch(POLSKIE_DIAKRYTYKI);
  });

  it('`action_text` NIE JEST PUSTE i niesie kierunek oraz wielkość odchylenia', () => {
    const { actionText } = buildKpiDeviationCardText({ ...bazowe, locale: 'en' });
    expect(actionText).not.toBe('');
    expect(actionText).toContain('shortfall of 1.8');
    expect(actionText).toContain('Inventory Turns');
    expect(actionText).toContain('01.2026');
    expect(actionText).toContain('record a corrective action with a deadline');
    expect(actionText).not.toMatch(POLSKIE_DIAKRYTYKI);
  });

  it('rezultat POWYŻEJ celu → „overrun", nie „shortfall" (kierunek liczony, nie zgadywany)', () => {
    const { actionText } = buildKpiDeviationCardText({
      ...bazowe,
      actualValue: 9.5,
      targetValue: 6,
      locale: 'en',
    });
    expect(actionText).toContain('overrun of 3.5');
    expect(actionText).not.toContain('shortfall');
  });

  it('jednostka miernika wchodzi do KAŻDEJ liczby zdania', () => {
    const { problem, actionText } = buildKpiDeviationCardText({
      ...bazowe,
      unit: 'days',
      actualValue: 18,
      targetValue: 12,
      locale: 'en',
    });
    expect(problem).toContain('result 18 days');
    expect(problem).toContain('target 12 days');
    expect(actionText).toContain('overrun of 6 days');
  });

  it('brak celu → zdanie NIE PODAJE wielkości odchylenia (nic nie zmyśla)', () => {
    const { problem, actionText } = buildKpiDeviationCardText({
      ...bazowe,
      targetValue: null,
      locale: 'en',
    });
    expect(problem).toContain('target —');
    expect(actionText).toContain('Review the result of Inventory Turns');
    expect(actionText).not.toMatch(/shortfall|overrun/u);
  });
});

describe('G1 / S1.3 — ta sama karta w organizacji POLSKIEJ', () => {
  it('opis problemu jest literalnie tym, co karta miała przed naprawą', () => {
    const { problem } = buildKpiDeviationCardText({ ...bazowe, locale: 'pl' });
    expect(problem).toBe('Odchylenie: Inventory Turns 01.2026 — rezultat 4,2 poza limitem (cel 6).');
  });

  it('`action_text` po polsku też nie jest puste i mówi, co zrobić', () => {
    const { actionText } = buildKpiDeviationCardText({ ...bazowe, locale: 'pl' });
    expect(actionText).toContain('niedobór 1,8');
    expect(actionText).toContain('zapisz działanie naprawcze z terminem');
  });

  it('liczby idą formatem LOKALNYM: 4,2 po polsku i 4.2 po angielsku', () => {
    expect(buildKpiDeviationCardText({ ...bazowe, locale: 'pl' }).problem).toContain('4,2');
    expect(buildKpiDeviationCardText({ ...bazowe, locale: 'en' }).problem).toContain('4.2');
  });

  it('wynik jest DETERMINISTYCZNY — te same liczby dają to samo zdanie', () => {
    const a = buildKpiDeviationCardText({ ...bazowe, locale: 'pl' });
    const b = buildKpiDeviationCardText({ ...bazowe, locale: 'pl' });
    expect(a).toEqual(b);
  });
});
