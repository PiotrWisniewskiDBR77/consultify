/**
 * @vitest-environment jsdom
 *
 * DEC-426 (1.1-E-1, właściciel 06.09): Kokpit menedżera miał DWA panele obok
 * siebie („Co nam grozi" / „Co muszę rozstrzygnąć"), oba wąskie i zawsze
 * widoczne naraz. Po zmianie: JEDNA tabela pełnej szerokości, przełączana
 * przez `activeView` (chip Menu 3 w hoście — ExecutionHub/StandardModuleBar).
 *
 * Ten test blokuje regres na poziomie komponentu (props-driven, bezstanowy):
 *  a) `activeView="ryzyka"` renderuje TYLKO tabelę ryzyk (kolumna „Poziom
 *     (P×I)"), nie renderuje tabeli rozstrzygnięć (kolumna „Termin").
 *  b) `activeView="rozstrzygniecia"` odwrotnie.
 *  c) klik wiersza „bloker" (kind: 'blocker') w tabeli rozstrzygnięć wywołuje
 *     onOpenEntity('initiative', <id inicjatywy, bez prefiksu 'blk:'>), NIE
 *     onOpenEntity('decision', 'blk:...') — inicjatywa ma realną kartę,
 *     decyzja/ryzyko dziś nie (patrz ZNALEZISKA w meldunku 1.1-E-1).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import ExecutionSummaryOneLook, {
  type OneLookDecision,
  type OneLookRisk,
} from '../ExecutionSummaryOneLook';

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
  milestones: [],
  currency: 'PLN',
  isPolish: true,
  generatedAt: null,
};

const RISKS: OneLookRisk[] = [
  {
    id: 'r1',
    title: 'Ryzyko testowe',
    probability: 'HIGH',
    impact: 'HIGH',
    score: 20,
    ownerName: 'Jan Kowalski',
    initiativeId: 'i1',
    initiativeName: 'Inicjatywa A',
    status: 'OPEN',
    dueDate: null,
    mitigationStatus: null,
  },
];

const DECISIONS: OneLookDecision[] = [
  {
    id: 'blk:init-9',
    title: 'Zablokowana inicjatywa X',
    kind: 'blocker',
    ownerName: 'Anna Nowak',
    ageDays: null,
    dueDate: null,
    initiativeId: 'init-9',
    initiativeName: 'Inicjatywa X',
    context: 'Zablokowana inicjatywa',
  },
  {
    id: 'dec:55',
    title: 'Zwykła decyzja',
    kind: 'decision',
    ownerName: 'Ewa Wiśniewska',
    ageDays: 2,
    dueDate: '2026-09-10',
    initiativeId: null,
    initiativeName: null,
    context: null,
  },
];

describe('ExecutionSummaryOneLook — przełącznik Ryzyka/Rozstrzygnięcia (DEC-426)', () => {
  it('activeView="ryzyka": renderuje TYLKO tabelę ryzyk', () => {
    render(
      <ExecutionSummaryOneLook
        {...baseProps}
        topRisks={RISKS}
        decisions={DECISIONS}
        activeView="ryzyka"
      />
    );
    expect(screen.getByText('Poziom (P×I)')).toBeTruthy();
    expect(screen.getByText('Ryzyko testowe')).toBeTruthy();
    expect(screen.queryByText('Termin')).toBeNull();
    expect(screen.queryByText('Zwykła decyzja')).toBeNull();
  });

  it('activeView="rozstrzygniecia": renderuje TYLKO tabelę rozstrzygnięć', () => {
    render(
      <ExecutionSummaryOneLook
        {...baseProps}
        topRisks={RISKS}
        decisions={DECISIONS}
        activeView="rozstrzygniecia"
      />
    );
    expect(screen.getByText('Termin')).toBeTruthy();
    expect(screen.getByText('Zwykła decyzja')).toBeTruthy();
    expect(screen.queryByText('Poziom (P×I)')).toBeNull();
    expect(screen.queryByText('Ryzyko testowe')).toBeNull();
  });

  it('klik wiersza blokera otwiera inicjatywę (nie „decision" z prefiksem blk:)', () => {
    const onOpenEntity = vi.fn();
    render(
      <ExecutionSummaryOneLook
        {...baseProps}
        topRisks={RISKS}
        decisions={DECISIONS}
        activeView="rozstrzygniecia"
        onOpenEntity={onOpenEntity}
      />
    );
    fireEvent.click(screen.getByText('Zablokowana inicjatywa X'));
    expect(onOpenEntity).toHaveBeenCalledWith('initiative', 'init-9');
    expect(onOpenEntity).not.toHaveBeenCalledWith('decision', 'blk:init-9');

    onOpenEntity.mockClear();
    fireEvent.click(screen.getByText('Zwykła decyzja'));
    expect(onOpenEntity).toHaveBeenCalledWith('decision', 'dec:55');
  });
});
