/**
 * @vitest-environment jsdom
 *
 * M16 Value Office panel — wstrzyknięte fetchery, fail-soft, busy-state.
 * Sprawdza: render waterfall (steps) + bubble (NPV×ryzyko) po fetchu,
 * KPI-strip (identified/realized) i degradację przy błędzie.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock prymitywów wykresów — testujemy okablowanie panelu, nie SVG.
vi.mock('@/components/Economics/charts', () => ({
  FinanceWaterfall: ({ steps }: { steps: Array<{ label: string }> }) => (
    <div data-testid="mock-waterfall" data-steps={steps.length}>
      {steps.map((s) => s.label).join(',')}
    </div>
  ),
  PortfolioBubble: ({ points }: { points: Array<{ id: string }> }) => (
    <div data-testid="mock-bubble" data-points={points.length}>
      {points.map((p) => p.id).join(',')}
    </div>
  ),
}));

// Api nie powinno być wołane (wstrzykujemy fetchery), ale mockujemy bezpiecznie.
vi.mock('@/services/api', () => ({
  Api: { post: vi.fn() },
}));

import { ValueOfficePanel } from '../../src/components/Economics/panels/ValueOfficePanel';

const bridgeResponse = {
  data: {
    steps: [
      { label: 'Baseline', value: 0, kind: 'start' as const },
      { label: 'Zrealizowane', value: 500_000, kind: 'increase' as const },
      { label: 'Net Value', value: 500_000, kind: 'total' as const },
    ],
    totalRealized: 500_000,
    totalIdentified: 1_200_000,
  },
};

const portfolioResponse = {
  data: [
    { id: 'a', name: 'A', npv: 900_000, risk: 0.2, effort: 3, quadrant: 'fund' as const, rank: 1 },
    { id: 'b', name: 'B', npv: 200_000, risk: 0.7, effort: 8, quadrant: 'defer' as const, rank: 2 },
  ],
};

const sampleInitiatives = [
  { id: 'i1', name: 'Init 1', value: 1_000_000, stage: 'realized', npv: 800_000, risk: 0.3, effort: 4 },
];

describe('ValueOfficePanel', () => {
  it('renderuje waterfall + bubble + KPI po udanym fetchu', async () => {
    const valueBridgeFetcher = vi.fn().mockResolvedValue(bridgeResponse);
    const portfolioFetcher = vi.fn().mockResolvedValue(portfolioResponse);

    render(
      <ValueOfficePanel
        initiatives={sampleInitiatives}
        valueBridgeFetcher={valueBridgeFetcher}
        portfolioFetcher={portfolioFetcher}
      />
    );

    // Panel + sekcje obecne od razu.
    expect(screen.getByTestId('value-office-panel')).toBeTruthy();
    expect(screen.getByTestId('value-bridge-chart')).toBeTruthy();
    expect(screen.getByTestId('portfolio-board')).toBeTruthy();

    // Waterfall dostaje kroki z value-bridge.
    await waitFor(() => {
      expect(screen.getByTestId('mock-waterfall').getAttribute('data-steps')).toBe('3');
    });

    // Bubble dostaje 2 punkty (x=risk, y=npv, size=effort).
    expect(screen.getByTestId('mock-bubble').getAttribute('data-points')).toBe('2');
    expect(screen.getByTestId('mock-bubble').textContent).toContain('a');
    expect(screen.getByTestId('mock-bubble').textContent).toContain('b');

    // KPI-strip — sformatowane wartości.
    expect(screen.getByTestId('kpi-total-identified').textContent).toContain('1.2M');
    expect(screen.getByTestId('kpi-total-realized').textContent).toContain('500k');

    // Fetchery dostały przekazane inicjatywy.
    expect(valueBridgeFetcher).toHaveBeenCalledWith(sampleInitiatives);
    expect(portfolioFetcher).toHaveBeenCalledWith(sampleInitiatives);
  });

  it('używa przykładu, gdy brak inicjatyw z kokpitu', async () => {
    const valueBridgeFetcher = vi.fn().mockResolvedValue(bridgeResponse);
    const portfolioFetcher = vi.fn().mockResolvedValue(portfolioResponse);

    render(
      <ValueOfficePanel
        valueBridgeFetcher={valueBridgeFetcher}
        portfolioFetcher={portfolioFetcher}
      />
    );

    await waitFor(() => {
      expect(valueBridgeFetcher).toHaveBeenCalled();
    });
    // Fetcher dostał niepustą listę przykładową, nie [].
    const passed = valueBridgeFetcher.mock.calls[0][0];
    expect(Array.isArray(passed)).toBe(true);
    expect(passed.length).toBeGreaterThan(0);
  });

  it('fail-soft: błąd fetchu degraduje do cichej notki, nie blokuje kokpitu', async () => {
    const valueBridgeFetcher = vi.fn().mockRejectedValue(new Error('boom'));
    const portfolioFetcher = vi.fn().mockResolvedValue(portfolioResponse);

    render(
      <ValueOfficePanel
        initiatives={sampleInitiatives}
        valueBridgeFetcher={valueBridgeFetcher}
        portfolioFetcher={portfolioFetcher}
      />
    );

    // Panel nadal obecny (data-testid stabilny), ale bez wykresów.
    await waitFor(() => {
      expect(screen.getByTestId('value-office-panel').textContent).toContain(
        'niedostępny'
      );
    });
    expect(screen.queryByTestId('mock-waterfall')).toBeNull();
    expect(screen.queryByTestId('mock-bubble')).toBeNull();
  });
});
