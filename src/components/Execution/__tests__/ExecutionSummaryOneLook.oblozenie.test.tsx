/**
 * @vitest-environment jsdom
 *
 * 1.12-R1b (2) — kafel „Obłożenie" Kokpitu. POMIAR: do teraz „—"/„0 osób"
 * (silnik `capacityTimeline` liczy podaż z `initiative_resources`, 0 wierszy
 * w DBR77). R2 wystawił `GET /api/execution-control/capacity/resource-plan`
 * → `summary` (utilizationPercent/overloadedCount/peopleCount); ExecutionHub
 * (host) wpina te pola w `people` — ten plik sprawdza RENDER kafla z takim
 * podpięciem, bez zmiany hosta (za ciężki do zamontowania — patrz
 * `ExecutionHub.kokpitRaidOblozenie.source.test.ts` dla dowodu na źródle).
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import ExecutionSummaryOneLook from '../ExecutionSummaryOneLook';

const baseProps = {
  health: { healthScore: 70, progressPercent: 50, phaseLabel: null },
  onTime: { onTimePercent: 80, onTrackCount: 4, atRiskCount: 1, delayedCount: 0, totalInitiatives: 5 },
  value: null,
  topRisks: [],
  decisions: [],
  milestones: [],
  currency: 'PLN',
  isPolish: true,
  generatedAt: null,
  activeView: 'ryzyka' as const,
};

describe('ExecutionSummaryOneLook — kafel „Obłożenie" z resource-plan (1.12-R1b)', () => {
  it('mock summary (utilizationPercent=38, overloadedCount=11) → „38%", „11 przeciąż."', () => {
    render(
      <ExecutionSummaryOneLook
        {...baseProps}
        people={{
          utilizationPercent: 38,
          overallocatedCount: 11,
          underutilizedCount: 0,
          unassignedInitiatives: 0,
          headcount: 5,
        }}
      />
    );
    expect(screen.getByText('38%')).toBeTruthy();
    expect(screen.getByText(/11\s*przeciąż\./)).toBeTruthy();
    expect(screen.getByText(/5\s*osób/)).toBeTruthy();
  });

  it('brak podaży wcale (peopleCount=0) → „—", nie „0%"', () => {
    render(
      <ExecutionSummaryOneLook
        {...baseProps}
        people={{
          utilizationPercent: null,
          overallocatedCount: 0,
          underutilizedCount: 0,
          unassignedInitiatives: 0,
          headcount: 0,
        }}
      />
    );
    const oblozenieCard = screen.getByText('Obłożenie').parentElement;
    expect(oblozenieCard?.textContent).toContain('—');
    expect(oblozenieCard?.textContent).not.toContain('0%');
  });

  it('wszyscy z domyślnej podaży (defaultCapacityAssumed) → podpis „domyślnie 40 h/tydz.", nie milczy', () => {
    render(
      <ExecutionSummaryOneLook
        {...baseProps}
        people={{
          utilizationPercent: 62,
          overallocatedCount: 0,
          underutilizedCount: 0,
          unassignedInitiatives: 0,
          headcount: 5,
          defaultCapacityAssumed: true,
        }}
      />
    );
    expect(screen.getByText('domyślnie 40 h/tydz.')).toBeTruthy();
  });
});
