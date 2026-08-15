/**
 * @vitest-environment jsdom
 */

vi.mock('@/components/Economics/charts', () => ({
  FootballField: () => <div data-testid="football-field" />,
  SensitivityHeatmap: () => <div data-testid="sensitivity-heatmap" />,
  TornadoChart: () => <div data-testid="tornado-chart" />,
  FinanceWaterfall: () => <div data-testid="waterfall" />,
  PortfolioBubble: () => <div data-testid="portfolio-bubble" />,
  SCurve: () => <div data-testid="s-curve" />,
  BulletChart: () => <div data-testid="bullet-chart" />,
  GoldenThreadSankey: () => <div data-testid="golden-thread-sankey" />,
}));

vi.mock('@/components/Economics/charts/FootballField', () => ({
  FootballField: () => <div data-testid="football-field" />,
}));

vi.mock('@/components/Economics/charts/SensitivityHeatmap', () => ({
  SensitivityHeatmap: () => <div data-testid="sensitivity-heatmap" />,
}));

vi.mock('@/components/Economics/charts/TornadoChart', () => ({
  TornadoChart: () => <div data-testid="tornado-chart" />,
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ValuationVisualsPanel } from '../../../src/components/Economics/panels/ValuationVisualsPanel';

describe('ValuationVisualsPanel — epic F1/F4 (Football Field + Sensitivity + Tornado)', () => {
  it('renders empty state when valuation is null', () => {
    render(<ValuationVisualsPanel valuation={null} />);

    const panel = screen.getByTestId('valuation-visuals-panel');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute('data-empty', 'true');
    expect(
      screen.getByText('Run the valuation to see the visualizations.'),
    ).toBeInTheDocument();
  });

  it('renders empty state when valuation is undefined', () => {
    render(<ValuationVisualsPanel />);

    const panel = screen.getByTestId('valuation-visuals-panel');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute('data-empty', 'true');
    expect(
      screen.getByText('Run the valuation to see the visualizations.'),
    ).toBeInTheDocument();
  });

  it('renders football field section when dcf.enterpriseValue is provided', () => {
    render(
      <ValuationVisualsPanel
        valuation={{ dcf: { enterpriseValue: 5_000_000 } }}
      />,
    );

    // Panel should not be in empty state
    const panel = screen.getByTestId('valuation-visuals-panel');
    expect(panel).not.toHaveAttribute('data-empty', 'true');

    // Football section and mocked chart must be present
    expect(screen.getByTestId('valuation-football')).toBeInTheDocument();
    expect(screen.getByTestId('football-field')).toBeInTheDocument();
  });

  it('renders sensitivity heatmap section when sensitivity.matrix has entries', () => {
    render(
      <ValuationVisualsPanel
        valuation={{
          sensitivity: {
            waccGrid: [0.08, 0.09, 0.10],
            gGrid: [0.02, 0.03],
            matrix: [
              { wacc: 0.08, g: 0.02, ev: 4_800_000 },
              { wacc: 0.09, g: 0.02, ev: 5_000_000 },
              { wacc: 0.10, g: 0.03, ev: 5_200_000 },
            ],
          },
        }}
      />,
    );

    expect(screen.getByTestId('valuation-heatmap')).toBeInTheDocument();
    expect(screen.getByTestId('sensitivity-heatmap')).toBeInTheDocument();
  });

  it('renders tornado chart section when tornado array has entries', () => {
    render(
      <ValuationVisualsPanel
        valuation={{
          dcf: { enterpriseValue: 5_000_000 },
          tornado: [
            { label: 'WACC', low: 4_500_000, high: 5_500_000 },
            { label: 'Cena jednostkowa', low: 4_200_000, high: 5_800_000 },
          ],
        }}
      />,
    );

    expect(screen.getByTestId('valuation-tornado')).toBeInTheDocument();
    expect(screen.getByTestId('tornado-chart')).toBeInTheDocument();
  });
});
