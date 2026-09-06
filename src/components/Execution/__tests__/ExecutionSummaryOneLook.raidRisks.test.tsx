/**
 * @vitest-environment jsdom
 *
 * 1.12-R1b (1) — Kokpit „Ryzyka" z `/api/raid` (16 pozycji na DBR77, TOP 10
 * po poziomie P×I — sortowanie/przycinanie sprawdza `executionRealData.test.ts`
 * `topRaidItemsByLevel`; ten plik sprawdza RENDER: 10 wierszy w kolejności
 * podanej przez hosta, i fallback „Poziom" gdy P×I się nie liczy (severity →
 * „—").
 */
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import ExecutionSummaryOneLook, { type OneLookRisk } from '../ExecutionSummaryOneLook';

const baseProps = {
  health: { healthScore: 70, progressPercent: 50, phaseLabel: null },
  onTime: { onTimePercent: 80, onTrackCount: 4, atRiskCount: 1, delayedCount: 0, totalInitiatives: 5 },
  value: null,
  people: {
    utilizationPercent: 60,
    overallocatedCount: 0,
    underutilizedCount: 0,
    unassignedInitiatives: 0,
    headcount: 3,
  },
  decisions: [],
  milestones: [],
  currency: 'PLN',
  isPolish: true,
  generatedAt: null,
  activeView: 'ryzyka' as const,
};

// POMIAR: mock `/api/raid` z 16 pozycji (Wave 1.12-R1b), już przycięty do
// TOP 10 przez `topRaidItemsByLevel` (host — ExecutionHub) w kolejności
// malejącej po poziomie.
const TOP_10: OneLookRisk[] = Array.from({ length: 9 }, (_, i) => ({
  id: `r${i}`,
  title: `Ryzyko ${i}`,
  score: 9 - i,
  ownerName: null,
  initiativeId: null,
  initiativeName: null,
  status: 'OPEN',
  dueDate: null,
})).concat([
  {
    id: 'no-level',
    title: 'Zależność bez P/I',
    score: null,
    severityLabel: 'Wysokie',
    ownerName: null,
    initiativeId: null,
    initiativeName: null,
    status: 'OPEN',
    dueDate: null,
  },
]);

describe('ExecutionSummaryOneLook — TOP ryzyka RAID (1.12-R1b)', () => {
  it('renderuje dokładnie 10 wierszy, w kolejności podanej przez hosta', () => {
    render(<ExecutionSummaryOneLook {...baseProps} topRisks={TOP_10} />);
    for (const risk of TOP_10) {
      expect(screen.getByText(risk.title)).toBeTruthy();
    }
    const rows = screen.getAllByText(/^Ryzyko \d$|^Zależność bez P\/I$/);
    expect(rows).toHaveLength(10);
  });

  it('brak P×I pokazuje severityLabel („Wysokie"), nie zmyślony numer ani „Umiarkowane"', () => {
    render(<ExecutionSummaryOneLook {...baseProps} topRisks={TOP_10} />);
    const row = screen.getByText('Zależność bez P/I').closest('tr');
    expect(row).toBeTruthy();
    expect(within(row as HTMLElement).getByText('Wysokie')).toBeTruthy();
    expect(within(row as HTMLElement).queryByText('Umiarkowane')).toBeNull();
  });

  it('brak P×I i brak severity pokazuje „—" w kolumnie Poziom', () => {
    const risks: OneLookRisk[] = [
      {
        id: 'x1',
        title: 'Ryzyko bez niczego',
        score: null,
        severityLabel: null,
        ownerName: null,
        initiativeId: null,
        initiativeName: null,
        status: null,
        dueDate: null,
      },
    ];
    render(<ExecutionSummaryOneLook {...baseProps} topRisks={risks} />);
    const row = screen.getByText('Ryzyko bez niczego').closest('tr') as HTMLElement;
    // Kolumna „Poziom (P×I)" jest drugą kolumną tabeli (po „Ryzyko") — patrz
    // `riskColumns` w ExecutionSummaryOneLook.tsx.
    const levelCell = row.querySelectorAll('td')[1];
    expect(levelCell.textContent?.trim()).toBe('—');
  });
});
