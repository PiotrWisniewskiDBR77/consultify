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
  isBlockedInitiative,
  isDecisionOverdue,
  isOpenDecision,
  isTaskBlocked,
  isTaskOverdue,
  onTimeFromInitiatives,
  openDecisions,
  overdueOpenDecisions,
  raidLevelScore,
  raidOwnerDisplayName,
  raidSeverityLabel,
  raidTypeLabel,
  taskSlipDays,
  topRaidItemsByLevel,
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

  /*
   * 1.12-R3 — TEN TEST ZMIENIŁ TREŚĆ ŚWIADOMIE.
   * Do 06.09 sprawdzał, że odchylenie liczy się od `plannedEndDate` („−4"
   * znaczyło „zostały 4 dni"). To była zła miara: wystarczyło przesunąć
   * `plannedEndDate`, żeby opóźnienie zniknęło. R3 przenosi punkt odniesienia
   * na plan ZAMROŻONY (`baselineEndDate`), którego serwer nie pozwala ruszyć
   * drugi raz bez decyzji z zatwierdzającym.
   */
  it('bez baseline’u odchylenia NIE MA — „—", nie zero i nie liczba z planu', () => {
    expect(initiativeDeviationDays({ plannedEndDate: dayShift(-10) }, NOW)).toBeNull();
    expect(initiativeDeviationDays({ plannedEndDate: dayShift(4) }, NOW)).toBeNull();
  });

  it('plan zgodny z baseline’em = 0 (zobowiązanie dotrzymane), nie liczba ujemna', () => {
    expect(
      initiativeDeviationDays(
        { baselineEndDate: dayShift(40), plannedEndDate: dayShift(40) },
        NOW
      )
    ).toBe(0);
  });

  it('przesunięty termin = DODATNIE odchylenie, choć plan wciąż jest w przyszłości', () => {
    // Dokładnie przypadek z planu R3: „Legacy Decommission", +40 dni.
    expect(
      initiativeDeviationDays(
        { baselineEndDate: dayShift(49), plannedEndDate: dayShift(89) },
        NOW
      )
    ).toBe(40);
  });

  it('termin minął, a rzeczy nie ma → odchylenie ROŚNIE (liczy się od dziś)', () => {
    expect(
      initiativeDeviationDays(
        { baselineEndDate: dayShift(-30), plannedEndDate: dayShift(-10) },
        NOW
      )
    ).toBe(30);
  });

  it('jest FAKT → odchylenie zamknięte na fakcie, przestaje rosnąć', () => {
    expect(
      initiativeDeviationDays(
        {
          baselineEndDate: dayShift(-30),
          plannedEndDate: dayShift(-10),
          actualEndDate: dayShift(-12),
        },
        NOW
      )
    ).toBe(18);
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

describe('1.12-R1b — inicjatywa zablokowana w OBU słownikach', () => {
  it('stary słownik: status BLOCKED wprost', () => {
    expect(isBlockedInitiative({ status: 'BLOCKED' })).toBe(true);
  });

  it('nowy słownik (migracja P12): IN_EXECUTION + on_hold=true', () => {
    expect(isBlockedInitiative({ status: 'IN_EXECUTION', onHold: true })).toBe(true);
    // snake_case — wersja, którą realnie zwraca SQL bez aliasu.
    expect(isBlockedInitiative({ status: 'IN_EXECUTION', on_hold: true })).toBe(true);
  });

  it('IN_EXECUTION/EXECUTING bez on_hold NIE jest blokerem', () => {
    expect(isBlockedInitiative({ status: 'IN_EXECUTION' })).toBe(false);
    expect(isBlockedInitiative({ status: 'EXECUTING', onHold: false })).toBe(false);
  });

  it('inne statusy (SCHEDULED, DONE) nigdy nie są blokerem, on_hold czy nie', () => {
    expect(isBlockedInitiative({ status: 'SCHEDULED', onHold: true })).toBe(false);
    expect(isBlockedInitiative({ status: 'DONE', onHold: true })).toBe(false);
  });
});

describe('1.12-R1b — RAID (Kokpit „Ryzyka")', () => {
  it('poziom = P × I gdy oba pola są (skala 1..4 na oś)', () => {
    expect(raidLevelScore({ probability: 'HIGH', impact: 'HIGH' })).toBe(9);
    expect(raidLevelScore({ probability: 'LOW', impact: 'CRITICAL' })).toBe(4);
  });

  it('brak P lub I cofa się do riskScore zapisanego w bazie, a bez niego → null', () => {
    expect(raidLevelScore({ probability: 'HIGH', riskScore: 6 })).toBe(6);
    expect(raidLevelScore({ impact: 'HIGH' })).toBeNull();
    expect(raidLevelScore({})).toBeNull();
  });

  it('typ po polsku i angielsku, nieznany typ wraca dosłownie', () => {
    expect(raidTypeLabel('RISK')).toBe('Ryzyko');
    expect(raidTypeLabel('DEPENDENCY', false)).toBe('Dependency');
    expect(raidTypeLabel('WEIRD')).toBe('WEIRD');
  });

  it('severity fallback, gdy P×I się nie liczy', () => {
    expect(raidSeverityLabel({ impact: 'HIGH' })).toBe('Wysokie');
    expect(raidSeverityLabel({})).toBeNull();
  });

  it('właściciel: nazwa z API → katalog organizacji → null (NIGDY „Nieznany użytkownik")', () => {
    expect(raidOwnerDisplayName({ ownerName: 'Jan Kowalski', ownerId: 'u1' })).toBe(
      'Jan Kowalski'
    );
    expect(raidOwnerDisplayName({ ownerId: 'u1' }, (id) => (id === 'u1' ? 'Anna Nowak' : null))).toBe(
      'Anna Nowak'
    );
    // POMIAR R1: 16/16 pozycji RAID mają ownerId spoza organization_members —
    // Kokpit pokazuje pustkę (null → „—" w UI), nie „Nieznany użytkownik".
    expect(raidOwnerDisplayName({ ownerId: 'u-nieznany' }, () => null)).toBeNull();
    expect(raidOwnerDisplayName({})).toBeNull();
  });

  it('TOP 10 posortowane malejąco po poziomie; brak poziomu na końcu, nie wypycha policzonych', () => {
    // POMIAR: `/api/raid` → 16 pozycji na DBR77 (RISK/ISSUE/DEPENDENCY/ASSUMPTION).
    const items = [
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `r${i}`,
        type: 'RISK',
        probability: 'HIGH',
        impact: 'HIGH', // poziom 9
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `i${i}`,
        type: 'ISSUE',
        probability: 'LOW',
        impact: 'LOW', // poziom 1
      })),
      { id: 'top-1', type: 'RISK', probability: 'HIGH', impact: 'CRITICAL' }, // poziom 12 — najwyższy
      { id: 'no-level', type: 'DEPENDENCY' }, // brak P/I/riskScore
    ];
    expect(items).toHaveLength(16);

    const top = topRaidItemsByLevel(items, 10);
    expect(top).toHaveLength(10);
    expect(top[0].id).toBe('top-1'); // poziom 12, zawsze pierwszy
    expect(top.some((r) => r.id === 'no-level')).toBe(false); // brak poziomu nie wchodzi do TOP 10
    expect(top.slice(1).every((r) => r.type === 'RISK')).toBe(true); // 9 pozostałych miejsc: poziom 9 przed poziomem 1
  });
});
