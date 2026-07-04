/**
 * @vitest-environment jsdom
 *
 * MatrixView — cross-tab (select/status axes) and quadrant (numeric axes) modes.
 *
 * Covers the tp-views-finish task: axis pickers, count-crosstab cells, and the
 * click-a-cell → record-list popover (v1 aggregation = count only).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MatrixView } from '../MatrixView';
import type { ColumnDef, TableNode } from '../tableTypes';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));

const statusCol: ColumnDef = {
  key: 'status',
  header: 'Status',
  type: 'status',
  visible: true,
  width: 120,
  options: ['Todo', 'Done'],
};

const priorityCol: ColumnDef = {
  key: 'priority',
  header: 'Priority',
  type: 'select',
  visible: true,
  width: 120,
  options: ['Low', 'High'],
};

const impactCol: ColumnDef = {
  key: 'impact',
  header: 'Impact',
  type: 'rating',
  visible: true,
  width: 100,
};

const effortCol: ColumnDef = {
  key: 'effort',
  header: 'Effort',
  type: 'rating',
  visible: true,
  width: 100,
};

const columns = [statusCol, priorityCol, impactCol, effortCol];

function node(id: string, data: Record<string, unknown>): TableNode {
  return { id, type: 'idea', data, position: { x: 0, y: 0 } } as TableNode;
}

describe('MatrixView — crosstab mode (categorical axes)', () => {
  const nodes = [
    node('n1', { label: 'Alpha', status: 'Todo', priority: 'Low' }),
    node('n2', { label: 'Beta', status: 'Todo', priority: 'Low' }),
    node('n3', { label: 'Gamma', status: 'Done', priority: 'High' }),
  ];

  it('renders a row/column grid with option headers from both axes', () => {
    render(
      <MatrixView nodes={nodes} xAxis={priorityCol} yAxis={statusCol} columns={columns} />
    );
    expect(screen.getByTestId('matrix-crosstab')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Todo')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('counts records at the intersection of X and Y', () => {
    render(
      <MatrixView nodes={nodes} xAxis={priorityCol} yAxis={statusCol} columns={columns} />
    );
    // Todo x Low = 2 records (n1, n2)
    expect(screen.getByTitle('Show 2 records')).toBeInTheDocument();
    // Done x High = 1 record (n3)
    expect(screen.getByTitle('Show 1 records')).toBeInTheDocument();
  });

  it('opens a popover listing matching records when a populated cell is clicked, and calls onNodeClick', () => {
    const onNodeClick = vi.fn();
    render(
      <MatrixView
        nodes={nodes}
        xAxis={priorityCol}
        yAxis={statusCol}
        columns={columns}
        onNodeClick={onNodeClick}
      />
    );
    fireEvent.click(screen.getByTitle('Show 2 records'));
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Alpha'));
    expect(onNodeClick).toHaveBeenCalledWith('n1');
  });

  it('does not open a popover for an empty (zero-count) cell', () => {
    render(
      <MatrixView nodes={nodes} xAxis={priorityCol} yAxis={statusCol} columns={columns} />
    );
    // Done x Low has 0 records — the cell button should be disabled and have no title.
    const grid = screen.getByTestId('matrix-crosstab');
    const buttons = grid.querySelectorAll('button');
    const emptyCellButtons = Array.from(buttons).filter((b) => b.textContent === '');
    expect(emptyCellButtons.length).toBeGreaterThan(0);
    for (const b of emptyCellButtons) {
      expect(b).toBeDisabled();
    }
  });

  it('renders an axis picker restricted to select/status/rating/number/multiselect fields', () => {
    const onAxisChange = vi.fn();
    render(
      <MatrixView
        nodes={nodes}
        xAxis={priorityCol}
        yAxis={statusCol}
        columns={columns}
        onAxisChange={onAxisChange}
      />
    );
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2);
    fireEvent.change(selects[0]!, { target: { value: statusCol.key } });
    expect(onAxisChange).toHaveBeenCalledWith('x', statusCol);
  });
});

describe('MatrixView — quadrant mode (numeric axes, backward compatible)', () => {
  const nodes = [
    node('n1', { label: 'HighImpactLowEffort', impact: 5, effort: 1 }),
    node('n2', { label: 'HighBoth', impact: 5, effort: 5 }),
  ];

  it('falls back to the existing quadrant rendering when both axes are numeric', () => {
    render(<MatrixView nodes={nodes} xAxis={effortCol} yAxis={impactCol} columns={columns} />);
    expect(screen.queryByTestId('matrix-crosstab')).not.toBeInTheDocument();
    expect(screen.getByText('HighImpactLowEffort')).toBeInTheDocument();
    expect(screen.getByText('HighBoth')).toBeInTheDocument();
  });

  it('clicking a quadrant card still calls onNodeClick directly (no popover)', () => {
    const onNodeClick = vi.fn();
    render(
      <MatrixView
        nodes={nodes}
        xAxis={effortCol}
        yAxis={impactCol}
        columns={columns}
        onNodeClick={onNodeClick}
      />
    );
    fireEvent.click(screen.getByText('HighBoth'));
    expect(onNodeClick).toHaveBeenCalledWith('n2');
  });
});
