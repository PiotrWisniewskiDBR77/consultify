/**
 * R3 (plan 1.12 §C4) — reguła re-baseline i odchylenie od planu bazowego.
 *
 * Test celuje w SAMĄ REGUŁĘ, nie w scenariusz: sprawdza, że drugie przesunięcie
 * BEZ decyzji jest odrzucone kodem, że decyzja bez zatwierdzającego nie jest
 * decyzją, i że odchylenie nie da się „wyzerować" przesunięciem terminu.
 */
import { describe, expect, it } from 'vitest';

import {
  deviationDaysFromBaseline,
  evaluateScheduleShift,
  isSameScheduledDay,
  REBASELINE_APPROVER_REQUIRED,
  REBASELINE_DECISION_REQUIRED,
} from '../scheduleBaseline.js';

const NOW = Date.parse('2026-09-06T12:00:00.000Z');
const dzien = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

describe('reguła re-baseline', () => {
  it('PIERWSZE przesunięcie wolno zrobić wprost, bez decyzji', () => {
    const v = evaluateScheduleShift(0, null);
    expect(v.allowed).toBe(true);
    expect(v).toMatchObject({ shiftIndex: 1, requiresDecision: false });
  });

  it('DRUGIE przesunięcie bez decyzji = ODMOWA 409 z jawnym kodem', () => {
    const v = evaluateScheduleShift(1, null);
    expect(v.allowed).toBe(false);
    expect(v).toMatchObject({ status: 409, code: REBASELINE_DECISION_REQUIRED, shiftIndex: 2 });
  });

  it('decyzja BEZ zatwierdzającego nie jest decyzją', () => {
    const v = evaluateScheduleShift(1, { decisionId: 'dec-1', approvedBy: '   ' });
    expect(v.allowed).toBe(false);
    expect(v).toMatchObject({ status: 409, code: REBASELINE_APPROVER_REQUIRED });
  });

  it('DRUGIE przesunięcie z decyzją i zatwierdzającym przechodzi', () => {
    const v = evaluateScheduleShift(1, { decisionId: 'dec-1', approvedBy: 'user-77' });
    expect(v.allowed).toBe(true);
    expect(v).toMatchObject({ shiftIndex: 2, requiresDecision: true });
  });

  it('reguła nie wygasa po drugim razie — piąte przesunięcie też wymaga decyzji', () => {
    expect(evaluateScheduleShift(4, null).allowed).toBe(false);
    expect(evaluateScheduleShift(4, { approvedBy: 'user-77' }).allowed).toBe(true);
  });

  it('licznik ujemny/NaN traktowany jak zero, a nie jak „reguła wyłączona"', () => {
    expect(evaluateScheduleShift(Number.NaN, null).allowed).toBe(true);
    expect(evaluateScheduleShift(-5, null).allowed).toBe(true);
    // …ale już nie odwrotnie: dodatni licznik NIE daje się przekręcić na 0.
    expect(evaluateScheduleShift(1.9, null).allowed).toBe(false);
  });
});

describe('odchylenie od planu bazowego', () => {
  it('brak baseline’u → null („—"), NIGDY zero', () => {
    expect(
      deviationDaysFromBaseline({ baselineDate: null, currentDate: dzien(-10), now: NOW })
    ).toBeNull();
  });

  it('plan równy baseline’owi → 0', () => {
    expect(
      deviationDaysFromBaseline({ baselineDate: dzien(30), currentDate: dzien(30), now: NOW })
    ).toBe(0);
  });

  it('PRZESUNIĘCIE TERMINU NIE KASUJE OPÓŹNIENIA — to jest sedno R3', () => {
    // Termin był na +49 dni, przesunięto na +89. Stara miara (dziś − plan)
    // dałaby −89 („zostało 89 dni") i RAG „Na czas". Baseline pokazuje +40.
    expect(
      deviationDaysFromBaseline({ baselineDate: dzien(49), currentDate: dzien(89), now: NOW })
    ).toBe(40);
  });

  it('po minionym terminie odchylenie rośnie z każdym dniem, nie zastyga', () => {
    expect(
      deviationDaysFromBaseline({ baselineDate: dzien(-30), currentDate: dzien(-10), now: NOW })
    ).toBe(30);
  });

  it('FAKT zamyka rachunek — odchylenie przestaje rosnąć', () => {
    expect(
      deviationDaysFromBaseline({
        baselineDate: dzien(-30),
        currentDate: dzien(-10),
        actualDate: dzien(-12),
        now: NOW,
      })
    ).toBe(18);
  });

  it('zrobione przed czasem = odchylenie ujemne (i to jest poprawne)', () => {
    expect(
      deviationDaysFromBaseline({
        baselineDate: dzien(-10),
        currentDate: dzien(-10),
        actualDate: dzien(-15),
        now: NOW,
      })
    ).toBe(-5);
  });
});

describe('porównanie dat po dniu kalendarzowym', () => {
  it('ta sama data o innej godzinie NIE jest przesunięciem', () => {
    expect(isSameScheduledDay('2026-12-04T21:09:17.841Z', '2026-12-04')).toBe(true);
  });
  it('inny dzień jest przesunięciem', () => {
    expect(isSameScheduledDay('2026-12-04', '2026-12-05')).toBe(false);
  });
  it('null vs data = zmiana; null vs null = brak zmiany', () => {
    expect(isSameScheduledDay(null, '2026-12-05')).toBe(false);
    expect(isSameScheduledDay(null, null)).toBe(true);
  });
});
