import { describe, expect, it } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

import {
  SensitivityHeatmap,
  type SensitivityCell,
} from '../../src/components/Economics/charts/SensitivityHeatmap';

const X_LABELS = ['8%', '10%', '12%'];
const Y_LABELS = ['1%', '2%', '3%'];

function buildMatrix(): SensitivityCell[] {
  const cells: SensitivityCell[] = [];
  X_LABELS.forEach((x, xi) => {
    Y_LABELS.forEach((y, yi) => {
      cells.push({ x, y, value: 100 + xi * 10 + yi * 5 });
    });
  });
  return cells;
}

describe('SensitivityHeatmap', () => {
  it('renders x×y cells', () => {
    render(
      <SensitivityHeatmap xLabels={X_LABELS} yLabels={Y_LABELS} matrix={buildMatrix()} />
    );
    expect(screen.getByTestId('sensitivity-heatmap')).toBeInTheDocument();
    const cells = screen.getAllByTestId('heat-cell');
    expect(cells).toHaveLength(X_LABELS.length * Y_LABELS.length);
  });

  it('highlights the base cell (baseX,baseY)', () => {
    render(
      <SensitivityHeatmap
        xLabels={X_LABELS}
        yLabels={Y_LABELS}
        matrix={buildMatrix()}
        baseX="10%"
        baseY="2%"
      />
    );
    const baseCells = screen
      .getAllByTestId('heat-cell')
      .filter((el) => el.getAttribute('data-base') === 'true');
    expect(baseCells).toHaveLength(1);
    expect(baseCells[0]).toHaveAttribute('data-x', '10%');
    expect(baseCells[0]).toHaveAttribute('data-y', '2%');
  });

  it('marks no base cell when baseX/baseY are omitted', () => {
    render(
      <SensitivityHeatmap xLabels={X_LABELS} yLabels={Y_LABELS} matrix={buildMatrix()} />
    );
    const baseCells = screen
      .getAllByTestId('heat-cell')
      .filter((el) => el.getAttribute('data-base') === 'true');
    expect(baseCells).toHaveLength(0);
  });

  it('renders the color-scale legend', () => {
    render(
      <SensitivityHeatmap xLabels={X_LABELS} yLabels={Y_LABELS} matrix={buildMatrix()} />
    );
    expect(screen.getByTestId('heatmap-legend')).toBeInTheDocument();
  });

  it('renders the empty state when matrix is empty', () => {
    render(<SensitivityHeatmap xLabels={X_LABELS} yLabels={Y_LABELS} matrix={[]} />);
    const root = screen.getByTestId('sensitivity-heatmap');
    expect(root).toHaveAttribute('data-empty', 'true');
    expect(screen.queryByTestId('heat-cell')).not.toBeInTheDocument();
    expect(screen.getByText(/Brak danych/i)).toBeInTheDocument();
  });

  it('renders the empty state when labels are missing', () => {
    render(<SensitivityHeatmap xLabels={[]} yLabels={[]} matrix={buildMatrix()} />);
    expect(screen.getByTestId('sensitivity-heatmap')).toHaveAttribute('data-empty', 'true');
  });

  it('tolerates numeric x/y labels and values', () => {
    const matrix: SensitivityCell[] = [
      { x: 1, y: 1, value: 10 },
      { x: 2, y: 1, value: 20 },
      { x: 1, y: 2, value: 30 },
      { x: 2, y: 2, value: 40 },
    ];
    render(
      <SensitivityHeatmap xLabels={[1, 2]} yLabels={[1, 2]} matrix={matrix} baseX={2} baseY={2} />
    );
    expect(screen.getAllByTestId('heat-cell')).toHaveLength(4);
    const baseCells = screen
      .getAllByTestId('heat-cell')
      .filter((el) => el.getAttribute('data-base') === 'true');
    expect(baseCells).toHaveLength(1);
  });
});
