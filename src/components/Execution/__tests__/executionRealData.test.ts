/**
 * 1.12-R1 — reguły „danych realnych" Realizacji.
 *
 * Każdy przypadek odwzorowuje POMIAR z 06.09 na org DBR77 (API 127.0.0.1:4100),
 * nie wyobrażenie o kształcie danych:
 *   · 12 decyzji po terminie, WSZYSTKIE `ESCALATED`, zero `PENDING`,
 *   · 26 inicjatyw w toku, 13 z `plannedEndDate`, 13 bez,
 *   · zadania bez `slaAt` (kolumna SLA zawsze pusta) — liczy się poślizg.
 */
import { describe, expect, it } from 'vitest';

import {
  decisionDaysOverdue,
  filterInFlightInitiatives,
  initiativeDeviationDays,
  initiativeLevelLabel,
  initiativeRag,
  isDecisionOverdue,
  isOpenDecision,
  isTaskBlocked,
  isTaskOverdue,
  onTimeFromInitiatives,
  openDecisions,
  overdueOpenDecisions,
  taskSlipDays,
} from '../executionRealData';

const NOW = Date.parse('2026-09-06T12:00:00.000Z');
const dayShift = (days: number) => new Date(NOW + days * 86_400_000).toISOString();

describe('inicjatywy w toku', () => {
  it('bierze EXECUTING, BLOCKED i TRACKING — a odrzuca DRAFT/SCHEDULED/DONE', () => {
    const rows = filterInFlightInitiatives([
      { id: '1', status: 'EXECUTING' },
      { id: '2', status: 'BLOCKED' },
      { id: '3', status: 'TRACKING' },
      { id: '4', status: 'SCHEDULED' },
      { id: '5', status: 'DRAFT' },
      { id: '6', status: 'DONE' },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['1', '2', '3']);
  });
});

describe('RAG inicjatywy', () => {
  it('brak plannedEndDate = SZARY, nigdy zielony (luka danych ≠ zdrowie)', () => {
    expect(initiativeRag({ status: 'EXECUTING' }, NOW)).toBe('grey');
    expect(initiativeDeviationDays({ status: 'EXECUTING' }, NOW)).toBeNull();
  });

  it('po terminie = czerwony, ≤7 dni = amber, dalej = zielony', () => {
    expect(initiativeRag({ plannedEndDate: dayShift(-3) }, NOW)).toBe('red');
    expect(initiativeRag({ plannedEndDate: dayShift(5) }, NOW)).toBe('amber');
    expect(initiativeRag({ plannedEndDate: dayShift(40) }, NOW)).toBe('green');
  });

  it('odchylenie w dniach jest dodatnie po terminie i ujemne przed', () => {
    expect(initiativeDeviationDays({ plannedEndDate: dayShift(-10) }, NOW)).toBe(10);
    expect(initiativeDeviationDays({ plannedEndDate: dayShift(4) }, NOW)).toBe(-4);
  });

  it('poziom L0–L5: `currentStage` jest NULL na wszystkich 72 inicjatywach → „—"', () => {
    expect(initiativeLevelLabel({ currentStage: null })).toBe('—');
    expect(initiativeLevelLabel({ currentStage: 'l3' })).toBe('L3');
  });
});

describe('kafel „Na czas" z realnych dat', () => {
  it('mianownik to inicjatywy Z DATĄ; bez daty liczone osobno, nie jako on-track', () => {
    const wynik = onTimeFromInitiatives(
      [
        { plannedEndDate: dayShift(30) },
        { plannedEndDate: dayShift(60) },
        { plannedEndDate: dayShift(3) },
        { plannedEndDate: dayShift(-5) },
        {},
        {},
      ],
      NOW
    );
    expect(wynik.onTrackCount).toBe(2);
    expect(wynik.atRiskCount).toBe(1);
    expect(wynik.delayedCount).toBe(1);
    expect(wynik.unknownCount).toBe(2);
    // 2 z 4 mierzalnych — a NIE 2 z 6 i nie 4 z 6 („wszystko poza zablokowanym").
    expect(wynik.onTimePercent).toBe(50);
  });

  it('portfel bez ani jednej daty daje null, nie 100%', () => {
    expect(onTimeFromInitiatives([{}, {}], NOW).onTimePercent).toBeNull();
  });
});

describe('decyzje — otwarte i po terminie', () => {
  // Odwzorowanie pomiaru DBR77: 25 otwartych, 12 po terminie, wszystkie ESCALATED.
  const decyzje = [
    ...Array.from({ length: 12 }, (_, i) => ({
      id: `esc-${i}`,
      status: 'ESCALATED',
      isOverdue: true,
      daysOverdue: i + 1,
    })),
    ...Array.from({ length: 13 }, (_, i) => ({
      id: `pend-${i}`,
      status: 'PENDING',
      isOverdue: false,
    })),
    { id: 'done-1', status: 'APPROVED', isOverdue: true },
    { id: 'done-2', status: 'REJECTED', isOverdue: false },
  ];

  it('ESCALATED liczy się jako otwarta — 25, nie 13', () => {
    expect(openDecisions(decyzje)).toHaveLength(25);
    expect(isOpenDecision({ status: 'ESCALATED' })).toBe(true);
  });

  it('po terminie = 12 (stary filtr „PENDING && po terminie" dawał 0)', () => {
    expect(overdueOpenDecisions(decyzje)).toHaveLength(12);
    const staryFiltr = decyzje.filter((d) => d.status === 'PENDING' && d.isOverdue);
    expect(staryFiltr).toHaveLength(0);
  });

  it('rozstrzygnięta decyzja po terminie nie wchodzi do „do rozstrzygnięcia"', () => {
    expect(overdueOpenDecisions(decyzje).some((d) => d.id === 'done-1')).toBe(false);
  });

  it('ufa liczbie serwera, a przelicza z daty tylko gdy pola brak', () => {
    expect(isDecisionOverdue({ status: 'PENDING', dueDate: dayShift(-2) }, NOW)).toBe(true);
    expect(decisionDaysOverdue({ status: 'PENDING', dueDate: dayShift(-2) }, NOW)).toBe(2);
    expect(decisionDaysOverdue({ status: 'PENDING', daysOverdue: 9 }, NOW)).toBe(9);
  });
});

describe('zadania — poślizg zamiast pustej kolumny SLA', () => {
  it('liczy dni po terminie dla otwartego zadania', () => {
    expect(taskSlipDays({ status: 'IN_PROGRESS', dueDate: dayShift(-4) }, NOW)).toBe(4);
    expect(isTaskOverdue({ status: 'IN_PROGRESS', dueDate: dayShift(-4) }, NOW)).toBe(true);
  });

  it('zamknięte zadanie po terminie NIE jest poślizgiem', () => {
    expect(taskSlipDays({ status: 'DONE', dueDate: dayShift(-40) }, NOW)).toBeNull();
    expect(isTaskOverdue({ status: 'DONE', dueDate: dayShift(-40) }, NOW)).toBe(false);
  });

  it('brak terminu = brak poślizgu, nie zero', () => {
    expect(taskSlipDays({ status: 'TODO' }, NOW)).toBeNull();
  });

  it('rozpoznaje zablokowane', () => {
    expect(isTaskBlocked({ status: 'blocked' })).toBe(true);
    expect(isTaskBlocked({ status: 'todo' })).toBe(false);
  });
});
