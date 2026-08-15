/**
 * @vitest-environment jsdom
 */

vi.mock('@/components/Economics/charts', () => ({
  TornadoChart: () => <div data-testid="tornado-chart" />,
  FootballField: () => <div data-testid="football-field" />,
  SensitivityHeatmap: () => <div data-testid="sensitivity-heatmap" />,
  FinanceWaterfall: () => <div data-testid="waterfall" />,
  PortfolioBubble: () => <div data-testid="portfolio-bubble" />,
  SCurve: () => <div data-testid="s-curve" />,
  BulletChart: () => <div data-testid="bullet-chart" />,
  GoldenThreadSankey: () => <div data-testid="golden-thread-sankey" />,
}));

vi.mock('@/components/Economics/charts/TornadoChart', () => ({
  TornadoChart: () => <div data-testid="tornado-chart" />,
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  DriverPlannerPanel,
  type DriverNode,
} from '../../../src/components/Economics/panels/DriverPlannerPanel';

describe('DriverPlannerPanel — epic F5 (Driver Planner + What-If)', () => {
  const realModelTree: DriverNode = {
    id: 'revenue',
    label: 'Przychód',
    op: 'multiply',
    children: [
      { id: 'customers', label: 'Klienci', value: 1200, min: 0, max: 2400 },
      { id: 'arpu', label: 'ARPU', value: 240, min: 0, max: 480 },
    ],
  };

  it('requires a selected financial model instead of rendering synthetic data', () => {
    render(<DriverPlannerPanel />);

    expect(screen.getByTestId('driver-planner-panel')).toBeInTheDocument();
    expect(screen.getByTestId('driver-planner-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('driver-tree-viz')).not.toBeInTheDocument();
  });

  it('renders custom root label when custom driverTree provided', () => {
    const customTree: DriverNode = {
      id: 'profit',
      label: 'Zysk operacyjny',
      op: 'subtract',
      children: [
        { id: 'revenue', label: 'Przychody', value: 500_000 },
        { id: 'costs', label: 'Koszty', value: 200_000 },
      ],
    };

    render(<DriverPlannerPanel driverTree={customTree} />);

    // Root label appears once (no slider for branch nodes)
    expect(screen.getByText('Zysk operacyjny')).toBeInTheDocument();
    // Leaf labels appear in tree viz node AND slider label — use getAllByText
    expect(screen.getAllByText(/Przychody/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Koszty/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders leaf driver input for every leaf node in the tree', () => {
    const customTree: DriverNode = {
      id: 'total',
      label: 'Razem',
      op: 'add',
      children: [
        { id: 'leafA', label: 'Segment A', value: 100, min: 0, max: 500, step: 10 },
        { id: 'leafB', label: 'Segment B', value: 200, min: 0, max: 500, step: 10 },
      ],
    };

    render(<DriverPlannerPanel driverTree={customTree} />);

    // Each leaf gets a numeric input with aria-label matching the leaf label.
    const inputA = screen.getByRole('spinbutton', { name: 'Segment A' });
    const inputB = screen.getByRole('spinbutton', { name: 'Segment B' });
    expect(inputA).toBeInTheDocument();
    expect(inputB).toBeInTheDocument();
    // Slider containers are also rendered for each leaf
    expect(screen.getByTestId('driver-slider-leafA')).toBeInTheDocument();
    expect(screen.getByTestId('driver-slider-leafB')).toBeInTheDocument();
  });

  it('shows computed root value in the whatif result output area', () => {
    // Default SaaS tree: Klienci=1200 × ARPU=240 = 288 000 → displayed as "288,0 tys."
    render(<DriverPlannerPanel driverTree={realModelTree} />);

    const whatifResult = screen.getByTestId('whatif-result');
    expect(whatifResult).toBeInTheDocument();

    // The whatif-value span should contain a non-empty value (not "—")
    const valuSpan = screen.getByTestId('whatif-value');
    expect(valuSpan.textContent).not.toBe('—');
    // 1200 × 240 = 288000 → formatted as "288,0 tys."
    expect(valuSpan.textContent).toMatch(/288/);
  });

  it('renders at least one range input (slider) for leaf drivers', () => {
    render(<DriverPlannerPanel driverTree={realModelTree} />);

    // The default tree has min/max defined on both leaves → sliders rendered.
    // role="slider" matches <input type="range"> in jsdom.
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBeGreaterThanOrEqual(1);
  });
});
