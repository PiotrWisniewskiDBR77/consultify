/**
 * @vitest-environment jsdom
 *
 * M16/1.2+1.3 — ValuationVisualsPanel FE binding.
 * Renderuje football + heatmap + tornado z mock-valuation; pusty stan bez danych.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import {
  ValuationVisualsPanel,
  type ValuationResults,
} from '../../src/components/Economics/panels/ValuationVisualsPanel';

const fullValuation: ValuationResults = {
  dcf: { enterpriseValue: 10_000_000 },
  comps: { impliedEnterpriseValue: { min: 8_000_000, median: 9_500_000, max: 12_000_000 } },
  sensitivity: {
    waccGrid: ['8%', '10%', '12%'],
    gGrid: ['1%', '2%', '3%'],
    matrix: [
      { wacc: '8%', g: '1%', ev: 9_000_000 },
      { wacc: '10%', g: '2%', ev: 10_000_000 },
      { wacc: '12%', g: '3%', ev: 11_500_000 },
      { wacc: '8%', g: '3%', ev: 12_500_000 },
    ],
  },
  tornado: [
    { label: 'WACC', low: 8_000_000, high: 12_000_000 },
    { label: 'Wzrost', low: 9_000_000, high: 11_000_000 },
  ],
  assetBased: { netAssetValue: 7_500_000 },
};

describe('ValuationVisualsPanel', () => {
  it('renders the panel root', () => {
    const { getByTestId } = render(<ValuationVisualsPanel valuation={fullValuation} />);
    expect(getByTestId('valuation-visuals-panel')).toBeInTheDocument();
  });

  it('renders football field, heatmap and tornado sections with full data', () => {
    const { getByTestId } = render(<ValuationVisualsPanel valuation={fullValuation} />);
    expect(getByTestId('valuation-football')).toBeInTheDocument();
    expect(getByTestId('valuation-heatmap')).toBeInTheDocument();
    expect(getByTestId('valuation-tornado')).toBeInTheDocument();
  });

  it('renders the underlying chart primitives (not their empty states)', () => {
    const { getByTestId } = render(<ValuationVisualsPanel valuation={fullValuation} />);
    expect(getByTestId('football-field')).not.toHaveAttribute('data-empty', 'true');
    expect(getByTestId('sensitivity-heatmap')).not.toHaveAttribute('data-empty', 'true');
    expect(getByTestId('tornado-chart')).toBeInTheDocument();
  });

  it('builds a football range per available method (DCF, comps, asset-based)', () => {
    const { getAllByTestId } = render(<ValuationVisualsPanel valuation={fullValuation} />);
    const labels = getAllByTestId('ff-range').map((el) => el.getAttribute('data-label'));
    expect(labels).toContain('DCF');
    expect(labels).toContain('Comparables');
    expect(labels).toContain('Asset-based (NAV)');
  });

  it('renders heatmap cells from sensitivity.matrix mapped to {x,y,value}', () => {
    const { getAllByTestId } = render(<ValuationVisualsPanel valuation={fullValuation} />);
    // 3 wacc × 3 g = 9 komórek w siatce
    expect(getAllByTestId('heat-cell').length).toBe(9);
  });

  it('renders tornado bars from tornado drivers', () => {
    const { getAllByTestId } = render(<ValuationVisualsPanel valuation={fullValuation} />);
    expect(getAllByTestId('tornado-bar').length).toBe(2);
  });

  it('shows the empty state when no valuation data is present', () => {
    const { getByTestId, queryByTestId } = render(<ValuationVisualsPanel valuation={{}} />);
    const root = getByTestId('valuation-visuals-panel');
    expect(root).toHaveAttribute('data-empty', 'true');
    expect(root.textContent).toContain('Run the valuation');
    expect(queryByTestId('valuation-football')).toBeNull();
    expect(queryByTestId('valuation-heatmap')).toBeNull();
    expect(queryByTestId('valuation-tornado')).toBeNull();
  });

  it('shows the empty state when valuation is null/undefined', () => {
    const { getByTestId } = render(<ValuationVisualsPanel valuation={null} />);
    expect(getByTestId('valuation-visuals-panel')).toHaveAttribute('data-empty', 'true');
  });

  it('fails soft: renders only the sections that have data', () => {
    const partial: ValuationResults = {
      tornado: [{ label: 'WACC', low: 1_000, high: 3_000 }],
    };
    const { getByTestId, queryByTestId } = render(<ValuationVisualsPanel valuation={partial} />);
    // panel renderuje wszystkie sekcje (additive), ale football/heatmap mają sekcyjny pusty stan
    expect(getByTestId('valuation-tornado')).toBeInTheDocument();
    expect(getByTestId('valuation-football').textContent).toContain('No valuation');
    expect(getByTestId('valuation-heatmap').textContent).toContain('No sensitivity');
    expect(queryByTestId('tornado-chart')).toBeInTheDocument();
  });
});
