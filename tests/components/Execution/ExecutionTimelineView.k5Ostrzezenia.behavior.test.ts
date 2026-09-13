/**
 * K5-I4 — pasek „Top Warnings" na osi czasu Inicjatyw.
 *
 * DEFEKT ZE ZRZUTU (staging 2026-09-13, `k5-inicjatywy-widok-timeline-jasny.png`):
 * z dziesięciu ostrzeżeń DZIEWIĘĆ brzmiało „Blocked" — bo warunek brzmiał
 * `if (init.status === IN_EXECUTION)`, czyli każda inicjatywa w realizacji
 * była z definicji „zablokowana". Ostrzeżenie zapalone zawsze przestaje być
 * ostrzeżeniem. Dziesiąte niosło „179d overdue" — liczbę sklejoną ze skrótem
 * jednostki (rodzina defektu „8dni").
 */
import { describe, expect, it } from 'vitest';

import { computeTimelineWarnings } from '@/components/Execution/ExecutionTimelineView';
import { InitiativeStatus, type FullInitiative } from '@/types';

const init = (over: Partial<FullInitiative>): FullInitiative =>
  ({
    id: 'i-1',
    name: 'Automatyzacja magazynu WIP',
    status: InitiativeStatus.IN_EXECUTION,
    ...over,
  }) as FullInitiative;

describe('K5-I4 — „Blocked" tylko dla faktycznie zablokowanych', () => {
  it('nie oznacza zdrowej realizacji jako zablokowanej', () => {
    const warnings = computeTimelineWarnings([init({})]);
    expect(warnings.filter((w) => w.type === 'blocked')).toHaveLength(0);
  });

  it('oznacza realizację wstrzymaną (`onHold`) i z jawnym powodem', () => {
    const onHold = computeTimelineWarnings([init({ id: 'i-hold', onHold: true } as never)]);
    expect(onHold.filter((w) => w.type === 'blocked')).toHaveLength(1);

    const withReason = computeTimelineWarnings([
      init({ id: 'i-reason', blockedReason: 'Waiting for vendor' } as never),
    ]);
    expect(withReason.find((w) => w.type === 'blocked')?.message).toBe('Waiting for vendor');
  });
});

describe('K5-I4 — opóźnienie opisane słowem, nie skrótem', () => {
  it('pisze „N days overdue", nigdy „Nd overdue"', () => {
    const past = new Date(Date.now() - 179 * 86400000).toISOString();
    const warnings = computeTimelineWarnings([init({ plannedEndDate: past } as never)]);
    const overdue = warnings.find((w) => w.type === 'overdue');

    expect(overdue?.message).toMatch(/^\d+ days overdue$/);
    expect(overdue?.message).not.toMatch(/\dd overdue/);
  });

  it('liczbę pojedynczą odmienia („1 day overdue")', () => {
    const past = new Date(Date.now() - 1.5 * 86400000).toISOString();
    const warnings = computeTimelineWarnings([init({ plannedEndDate: past } as never)]);
    expect(warnings.find((w) => w.type === 'overdue')?.message).toBe('1 day overdue');
  });
});
